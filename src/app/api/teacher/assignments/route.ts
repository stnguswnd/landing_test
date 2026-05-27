import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";

import { postgresPool, query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireTeacherSession } from "@/server/teacher/session";
import { isSupportedAssignmentType, itemTypeForAssignmentType, normalizeAssignmentType } from "@/lib/assignmentTypes";

export const runtime = "nodejs";

const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AUDIO_FILE_SIZE = 20 * 1024 * 1024;

type StorageBucketOptions = {
  fileSizeLimit: number;
  allowedMimeTypes: string[];
};

type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  assignment_type: string;
  image_url: string | null;
  image_storage_path: string | null;
  image_file_name: string | null;
  status: string;
  item_id: string | null;
  item_type: string | null;
  passage_title: string | null;
  passage_text: string | null;
  audio_url: string | null;
  audio_storage_path: string | null;
  audio_file_name: string | null;
  min_recording_sec: number | null;
  max_recording_sec: number | null;
  writing_mode: string | null;
  writing_unit: string | null;
  writing_unit_count: number | null;
  prompt_text: string | null;
  writing_instructions: string | null;
  writing_hint: string | null;
  writing_example: string | null;
  vocabulary_items: Array<{
    id: string;
    assignment_id: string;
    word: string;
    meaning: string;
    order_index: number;
  }> | null;
  updated_at: Date;
};

type AssignmentTargetInput = {
  classId: string;
  classSubjectId?: string;
  dueDate: string;
  dueTime: string;
  visibility: "draft" | "published";
  targetMode: "all" | "partial";
  selectedStudents: string[];
};

type StudentTargetRow = {
  id: string;
};

type ClassTargetRow = {
  id: string;
  student_count: number;
};

type AssignmentListRow = {
  id: string;
  title: string;
  description: string | null;
  assignment_type: string;
  status: string;
  subject_names: string[] | null;
  class_names: string[] | null;
  class_summaries: Array<{
    classId: string;
    className: string;
    subjectId: string | null;
    subjectName: string | null;
    dueAt: string | null;
    targetCount: number;
    submittedCount: number;
    studentNames: string[];
  }> | null;
  target_count: number;
  submitted_count: number;
  due_at: Date | null;
  updated_at: Date;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || `${randomUUID()}`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

function isAudioFile(file: File) {
  return file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg)$/i.test(file.name);
}

function storageErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingBucketError(error: { status?: number; message?: string } | null) {
  return error?.status === 404 || /bucket.*not found|not found|does not exist/i.test(error?.message ?? "");
}

function supportsMimeType(allowedMimeTypes: string[] | undefined, mimeTypes: string[]) {
  if (!allowedMimeTypes || allowedMimeTypes.length === 0) return true;
  return mimeTypes.some((mimeType) => {
    const [type] = mimeType.split("/");
    return allowedMimeTypes.includes(mimeType) || allowedMimeTypes.includes(`${type}/*`);
  });
}

async function ensureStorageBucket(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  options: StorageBucketOptions,
) {
  const current = await supabase.storage.getBucket(bucket);

  if (current.error) {
    if (!isMissingBucketError(current.error)) {
      throw new Error(`Storage bucket check failed (${bucket}): ${current.error.message}`);
    }

    const created = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: options.fileSizeLimit,
      allowedMimeTypes: options.allowedMimeTypes,
    });

    if (created.error && created.error.status !== 409) {
      throw new Error(`Storage bucket create failed (${bucket}): ${created.error.message}`);
    }
    return;
  }

  const fileSizeLimit = current.data.file_size_limit ?? 0;
  const needsFileSizeUpdate = fileSizeLimit > 0 && fileSizeLimit < options.fileSizeLimit;
  const needsMimeUpdate = !supportsMimeType(current.data.allowed_mime_types, options.allowedMimeTypes);

  if (!needsFileSizeUpdate && !needsMimeUpdate) return;

  const updated = await supabase.storage.updateBucket(bucket, {
    public: current.data.public,
    fileSizeLimit: needsFileSizeUpdate ? options.fileSizeLimit : current.data.file_size_limit,
    allowedMimeTypes: needsMimeUpdate ? options.allowedMimeTypes : current.data.allowed_mime_types,
  });

  if (updated.error) {
    throw new Error(`Storage bucket update failed (${bucket}): ${updated.error.message}`);
  }
}

async function signedUrl(bucket: string, path: string | null) {
  if (!path) return "";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

async function mapAssignment(row: AssignmentRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    type: normalizeAssignmentType(row.assignment_type),
    status: row.status,
    imageUrl: (await signedUrl(storageBuckets.images, row.image_storage_path)) || row.image_url || "",
    imageStoragePath: row.image_storage_path ?? undefined,
    imageFileName: row.image_file_name ?? undefined,
    item: {
      id: row.item_id,
      type: itemTypeForAssignmentType(row.assignment_type),
      title: row.passage_title ?? "",
      passageText: row.passage_text ?? "",
      audioUrl: (await signedUrl(storageBuckets.audio, row.audio_storage_path)) || row.audio_url || "",
      audioStoragePath: row.audio_storage_path ?? undefined,
      audioFileName: row.audio_file_name ?? "",
      minRecordingSec: String(row.min_recording_sec ?? 0),
      maxRecordingSec: String(row.max_recording_sec ?? 120),
      writingMode: row.writing_mode ?? undefined,
      writingUnit: row.writing_unit ?? undefined,
      writingUnitCount: row.writing_unit_count ?? 4,
      promptText: row.prompt_text ?? "",
      writingInstructions: row.writing_instructions ?? "",
      writingHint: row.writing_hint ?? "",
      writingExample: row.writing_example ?? "",
    },
    vocabularyItems: (row.vocabulary_items ?? []).map((item) => ({
      id: item.id,
      assignmentId: item.assignment_id,
      word: item.word,
      meaning: item.meaning,
      orderIndex: item.order_index,
    })),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function getAssignmentRow(id: string, teacherId: string) {
  const result = await query<AssignmentRow>(
    `
      select
        a.id,
        a.title,
        a.description,
        a.assignment_type,
        a.image_url,
        a.image_storage_path,
        a.image_file_name,
        a.status,
        ai.id as item_id,
        ai.item_type,
        ai.title as passage_title,
        ai.passage_text,
        ai.audio_url,
        ai.audio_storage_path,
        ai.audio_file_name,
        ai.min_recording_sec,
        ai.max_recording_sec,
        ai.writing_mode,
        ai.writing_unit,
        ai.writing_unit_count,
        ai.prompt_text,
        ai.writing_instructions,
        ai.writing_hint,
        ai.writing_example,
        coalesce(
          (
            select json_agg(
              json_build_object(
                'id', avi.id,
                'assignment_id', avi.assignment_id,
                'word', avi.word,
                'meaning', avi.meaning,
                'order_index', avi.order_index
              )
              order by avi.order_index
            )
            from assignment_vocabulary_items avi
            where avi.assignment_id = a.id
          ),
          '[]'::json
        ) as vocabulary_items,
        a.updated_at
      from assignments a
      left join assignment_items ai on ai.assignment_id = a.id and ai.order_index = 1
      where a.id = $1 and a.teacher_id = $2
      limit 1
    `,
    [id, teacherId],
  );

  return result.rows[0] ?? null;
}

export async function GET(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    const result = await query<AssignmentListRow>(
      `
        with class_summary as (
          select
            at.assignment_id,
            at.class_id,
            at.class_subject_id,
            csu.name as subject_name,
            coalesce(c.name, '미지정 반') as class_name,
            count(distinct at.student_id)::int as target_count,
            count(distinct at.student_id) filter (where at.status in ('submitted', 'late'))::int as submitted_count,
            min(at.due_at) as due_at
            ,
            coalesce(
              array_remove(array_agg(distinct s.name order by s.name), null),
              array[]::text[]
            ) as student_names
          from assignment_targets at
          join assignments a on a.id = at.assignment_id
          left join classes c on c.id = at.class_id and c.teacher_id = a.teacher_id
          left join class_subjects csu on csu.id = at.class_subject_id and csu.teacher_id = a.teacher_id
          left join students s on s.id = at.student_id and s.teacher_id = a.teacher_id
          where a.teacher_id = $1
            and at.status <> 'cancelled'
          group by at.assignment_id, at.class_id, c.name, at.class_subject_id, csu.name
        )
        select
          a.id,
          a.title,
          a.description,
          a.assignment_type,
          a.status,
          coalesce(array_remove(array_agg(distinct cs.subject_name), null), array[]::text[]) as subject_names,
          coalesce(array_remove(array_agg(distinct cs.class_name), null), array[]::text[]) as class_names,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'classId', cs.class_id,
                'className', cs.class_name,
                'subjectId', cs.class_subject_id,
                'subjectName', cs.subject_name,
                'dueAt', cs.due_at,
                'targetCount', cs.target_count,
                'submittedCount', cs.submitted_count,
                'studentNames', cs.student_names
              )
              order by cs.class_name
            ) filter (where cs.class_id is not null),
            '[]'::jsonb
          ) as class_summaries,
          coalesce(sum(cs.target_count), 0)::int as target_count,
          coalesce(sum(cs.submitted_count), 0)::int as submitted_count,
          coalesce(min(cs.due_at), a.due_at) as due_at,
          a.updated_at
        from assignments a
        left join class_summary cs on cs.assignment_id = a.id
        where a.teacher_id = $1
        group by a.id
        order by a.updated_at desc
      `,
      [teacherId],
    );

    return NextResponse.json({
      assignments: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? "",
        assignmentType: normalizeAssignmentType(row.assignment_type),
        assignmentSubject: (row.subject_names ?? []).join(", "),
        assignmentSubjects: row.subject_names ?? [],
        status: row.status,
        classNames: row.class_names ?? [],
        classSummaries: row.class_summaries ?? [],
        targetCount: row.target_count,
        submittedCount: row.submitted_count,
        unsubmittedCount: Math.max(row.target_count - row.submitted_count, 0),
        dueAt: row.due_at?.toISOString() ?? null,
        updatedAt: row.updated_at.toISOString(),
      })),
    });
  }

  const row = await getAssignmentRow(id, teacherId);
  return NextResponse.json({ assignment: row ? await mapAssignment(row) : null });
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim() || `assignment-${randomUUID()}`;
  const title = String(formData.get("title") ?? "").trim();
  const rawType = String(formData.get("type") ?? "listening_recording").trim();
  if (!isSupportedAssignmentType(rawType)) {
    return NextResponse.json({ error: "지원하지 않는 숙제 유형입니다." }, { status: 400 });
  }
  const type = rawType;
  const description = String(formData.get("description") ?? "").trim();
  const passageTitle = String(formData.get("passageTitle") ?? "").trim();
  const rawPassageText = String(formData.get("passageText") ?? "").trim();
  const minRecordingSec = Number(formData.get("minRecordingSec") ?? 0);
  const maxRecordingSec = Number(formData.get("maxRecordingSec") ?? 120);
  const writingMode = String(formData.get("writingMode") ?? "").trim() || null;
  const writingUnit = String(formData.get("writingUnit") ?? "").trim() || null;
  const writingUnitCount = Number(formData.get("writingUnitCount") ?? 4);
  const promptText = String(formData.get("promptText") ?? "").trim();
  const writingInstructions = String(formData.get("writingInstructions") ?? "").trim();
  const writingHint = String(formData.get("writingHint") ?? "").trim();
  const writingExample = String(formData.get("writingExample") ?? "").trim();
  const passageText = type === "writing" && promptText ? promptText : rawPassageText;
  const vocabularyItems = parseVocabularyItems(formData.get("vocabularyItems"));
  const imageFile = formData.get("imageFile");
  const audioFile = formData.get("audioFile");
  const targetAssignments = parseTargetAssignments(formData.get("assignments"));

  if (!title) {
    return NextResponse.json({ error: "과제 제목을 입력해 주세요." }, { status: 400 });
  }
  if ((type === "vocabulary_example" || type === "vocabulary_recording") && vocabularyItems.length === 0) {
    return NextResponse.json({ error: "단어를 1개 이상 입력해주세요." }, { status: 400 });
  }

  const existingUploadResult = await query<{
    image_storage_path: string | null;
    audio_storage_path: string | null;
  }>(
    `
      select a.image_storage_path, ai.audio_storage_path
      from assignments a
      left join assignment_items ai on ai.assignment_id = a.id and ai.order_index = 1
      where a.id = $1 and a.teacher_id = $2
      limit 1
    `,
    [id, teacherId],
  );
  const existingImageStoragePath = existingUploadResult.rows[0]?.image_storage_path ?? null;
  const existingAudioStoragePath = existingUploadResult.rows[0]?.audio_storage_path ?? null;

  const supabase = createSupabaseAdminClient();
  let imageUrl: string | null = null;
  let imageStoragePath: string | null = null;
  let imageFileName: string | null = null;
  let audioUrl: string | null = null;
  let audioStoragePath: string | null = null;
  let audioFileName: string | null = String(formData.get("audioFileName") ?? "").trim() || null;

  if (imageFile instanceof File) {
    if (!isImageFile(imageFile)) {
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (imageFile.size > MAX_IMAGE_FILE_SIZE) {
      return NextResponse.json({ error: "이미지는 최대 10MB까지 업로드할 수 있습니다." }, { status: 400 });
    }
    imageFileName = safeFileName(imageFile.name);
    imageStoragePath = `assignments/${id}/images/${imageFileName}`;
    try {
      await ensureStorageBucket(supabase, storageBuckets.images, {
        fileSizeLimit: MAX_IMAGE_FILE_SIZE,
        allowedMimeTypes: ["image/*"],
      });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: `이미지 저장소 준비 실패: ${storageErrorMessage(error)}` }, { status: 500 });
    }
    const { error } = await supabase.storage.from(storageBuckets.images).upload(
      imageStoragePath,
      Buffer.from(await imageFile.arrayBuffer()),
      { contentType: imageFile.type || "image/png", upsert: true },
    );

    if (error) {
      console.error({ bucket: storageBuckets.images, path: imageStoragePath, error });
      return NextResponse.json({ error: `이미지 업로드 실패: ${error.message}` }, { status: 500 });
    }

    imageUrl = supabase.storage.from(storageBuckets.images).getPublicUrl(imageStoragePath).data.publicUrl;
  }

  if (audioFile instanceof File) {
    if (!isAudioFile(audioFile)) {
      return NextResponse.json({ error: "오디오 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (audioFile.size > MAX_AUDIO_FILE_SIZE) {
      return NextResponse.json({ error: "MP3 파일은 최대 20MB까지 업로드할 수 있습니다." }, { status: 400 });
    }
    audioFileName = safeFileName(audioFile.name);
    audioStoragePath = `assignments/${id}/audio/${audioFileName}`;
    try {
      await ensureStorageBucket(supabase, storageBuckets.audio, {
        fileSizeLimit: MAX_AUDIO_FILE_SIZE,
        allowedMimeTypes: ["audio/*", "application/octet-stream"],
      });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: `오디오 저장소 준비 실패: ${storageErrorMessage(error)}` }, { status: 500 });
    }
    const { error } = await supabase.storage.from(storageBuckets.audio).upload(
      audioStoragePath,
      Buffer.from(await audioFile.arrayBuffer()),
      { contentType: audioFile.type || "audio/mpeg", upsert: true },
    );

    if (error) {
      console.error({ bucket: storageBuckets.audio, path: audioStoragePath, error });
      return NextResponse.json({ error: `오디오 업로드 실패: ${error.message}` }, { status: 500 });
    }

    audioUrl = supabase.storage.from(storageBuckets.audio).getPublicUrl(audioStoragePath).data.publicUrl;
  }

  const client = await postgresPool.connect();
  let assignedCount = 0;
  const classCounts: Array<{ classId: string; selectedCount: number }> = [];

  try {
    await client.query("begin");

    const firstTarget = targetAssignments[0];
    const assignmentStatus = targetAssignments.length > 0
      ? (targetAssignments.some((item) => item.visibility === "published") ? "published" : "draft")
      : "draft";
    const assignmentDueAt = firstTarget ? toDueAt(firstTarget.dueDate, firstTarget.dueTime) : null;
    const assignmentClassId = targetAssignments.length === 1 ? targetAssignments[0].classId : null;

    for (const targetAssignment of targetAssignments) {
      const classResult = await client.query<ClassTargetRow>(
        `
          select c.id, count(distinct s.id)::int as student_count
          from classes c
          left join class_memberships cm on cm.class_id = c.id
          left join students s on s.id = cm.student_id and s.teacher_id = c.teacher_id and s.status = 'active'
          where c.id = $1 and c.teacher_id = $2 and c.status = 'active'
          group by c.id
        `,
        [targetAssignment.classId, teacherId],
      );
      const classRow = classResult.rows[0];
      if (!classRow) {
        await client.query("rollback");
        return NextResponse.json({ error: "선택한 반을 찾을 수 없습니다." }, { status: 400 });
      }
      if (targetAssignment.targetMode === "all" && classRow.student_count === 0) {
        await client.query("rollback");
        return NextResponse.json({ error: "선택한 반에 배정할 학생이 없습니다." }, { status: 400 });
      }
      if (targetAssignment.targetMode === "partial" && targetAssignment.selectedStudents.length === 0) {
        await client.query("rollback");
        return NextResponse.json({ error: "일부 학생 배정은 학생을 최소 1명 선택해야 합니다." }, { status: 400 });
      }
      const subjectResult = await client.query<{ id: string }>(
        `
          select id
          from class_subjects
          where id = $1
            and class_id = $2
            and teacher_id = $3
            and status = 'active'
          limit 1
        `,
        [targetAssignment.classSubjectId ?? "", targetAssignment.classId, teacherId],
      );
      if (!subjectResult.rows[0]) {
        await client.query("rollback");
        return NextResponse.json({ error: "선택한 반 과목을 찾을 수 없습니다." }, { status: 400 });
      }
    }

    await client.query(
      `
        insert into assignments (
          id, teacher_id, class_id, title, description, assignment_type,
          image_url, image_storage_path, image_file_name, due_at, status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (id)
        do update set
          class_id = excluded.class_id,
          title = excluded.title,
          description = excluded.description,
          assignment_type = excluded.assignment_type,
          image_url = coalesce(excluded.image_url, assignments.image_url),
          image_storage_path = coalesce(excluded.image_storage_path, assignments.image_storage_path),
          image_file_name = coalesce(excluded.image_file_name, assignments.image_file_name),
          due_at = coalesce(excluded.due_at, assignments.due_at),
          status = excluded.status,
          updated_at = now()
      `,
      [id, teacherId, assignmentClassId, title, description || null, type, imageUrl, imageStoragePath, imageFileName, assignmentDueAt, assignmentStatus],
    );

    await client.query(
      `
        insert into assignment_items (
          id, assignment_id, item_type, title, passage_text, audio_url, audio_storage_path,
          audio_file_name, order_index, min_recording_sec, max_recording_sec,
          writing_mode, writing_unit, writing_unit_count, prompt_text,
          writing_instructions, writing_hint, writing_example
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        on conflict (assignment_id, order_index)
        do update set
          item_type = excluded.item_type,
          title = excluded.title,
          passage_text = excluded.passage_text,
          audio_url = coalesce(excluded.audio_url, assignment_items.audio_url),
          audio_storage_path = coalesce(excluded.audio_storage_path, assignment_items.audio_storage_path),
          audio_file_name = coalesce(excluded.audio_file_name, assignment_items.audio_file_name),
          min_recording_sec = excluded.min_recording_sec,
          max_recording_sec = excluded.max_recording_sec,
          writing_mode = excluded.writing_mode,
          writing_unit = excluded.writing_unit,
          writing_unit_count = excluded.writing_unit_count,
          prompt_text = excluded.prompt_text,
          writing_instructions = excluded.writing_instructions,
          writing_hint = excluded.writing_hint,
          writing_example = excluded.writing_example,
          updated_at = now()
      `,
      [
        `${id}-item-1`,
        id,
        itemTypeForAssignmentType(type),
        passageTitle || null,
        passageText,
        audioUrl,
        audioStoragePath,
        audioFileName,
        Number.isFinite(minRecordingSec) ? minRecordingSec : 0,
        Number.isFinite(maxRecordingSec) ? maxRecordingSec : 120,
        type === "writing" && (writingMode === "picture_description" || writingMode === "topic_diary") ? writingMode : null,
        type === "writing" && (writingUnit === "paragraphs" || writingUnit === "sentences") ? writingUnit : null,
        type === "writing" && Number.isFinite(writingUnitCount) ? writingUnitCount : 4,
        type === "writing" ? promptText || null : null,
        type === "writing" ? writingInstructions || null : null,
        type === "writing" ? writingHint || null : null,
        type === "writing" ? writingExample || null : null,
      ],
    );

    if (type === "vocabulary_example" || type === "vocabulary_recording") {
      await client.query("delete from assignment_vocabulary_items where assignment_id = $1", [id]);
      for (const item of vocabularyItems) {
        await client.query(
          `
            insert into assignment_vocabulary_items (id, assignment_id, word, meaning, order_index)
            values ($1, $2, $3, $4, $5)
          `,
          [`assignment-vocab-${randomUUID()}`, id, item.word, item.meaning, item.orderIndex],
        );
      }
    }

    for (const targetAssignment of targetAssignments) {
      const dueAt = toDueAt(targetAssignment.dueDate, targetAssignment.dueTime);
      const students = await findTargetStudents(client, teacherId, targetAssignment);
      if (students.length === 0) {
        await client.query("rollback");
        return NextResponse.json({ error: "배정 대상 학생을 찾을 수 없습니다." }, { status: 400 });
      }
      classCounts.push({ classId: targetAssignment.classId, selectedCount: students.length });

      for (const student of students) {
        await client.query(
          `
            insert into assignment_targets (id, assignment_id, class_id, class_subject_id, student_id, status, due_at)
            values ($1, $2, $3, $4, $5, 'assigned', $6)
            on conflict (assignment_id, student_id)
            do update set
              class_id = excluded.class_id,
              class_subject_id = excluded.class_subject_id,
              due_at = excluded.due_at,
              status = case
                when assignment_targets.status in ('submitted', 'late') then assignment_targets.status
                else 'assigned'
              end,
              cancelled_at = null,
              cancelled_by = null,
              updated_at = now()
          `,
          [`target-${randomUUID()}`, id, targetAssignment.classId, targetAssignment.classSubjectId, student.id, dueAt],
        );
        assignedCount += 1;
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "과제 저장 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }

  const row = await getAssignmentRow(id, teacherId);

  const staleFiles: Array<{ bucket: string; path: string }> = [];
  if (imageStoragePath && existingImageStoragePath && existingImageStoragePath !== imageStoragePath) {
    staleFiles.push({ bucket: storageBuckets.images, path: existingImageStoragePath });
  }
  if (audioStoragePath && existingAudioStoragePath && existingAudioStoragePath !== audioStoragePath) {
    staleFiles.push({ bucket: storageBuckets.audio, path: existingAudioStoragePath });
  }
  await Promise.all(staleFiles.map(async (file) => {
    const { error } = await supabase.storage.from(file.bucket).remove([file.path]);
    if (error) console.error(error);
  }));

  return NextResponse.json({
    assignment: row ? await mapAssignment(row) : null,
    uploaded: {
      image: Boolean(imageStoragePath),
      audio: Boolean(audioStoragePath),
    },
    assignedCount,
    classCounts,
  });
}

export async function DELETE(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "삭제할 과제를 찾을 수 없습니다." }, { status: 400 });
  }

  const client = await postgresPool.connect();
  let imageStoragePath: string | null = null;
  let audioStoragePath: string | null = null;

  try {
    await client.query("begin");

    const assignmentResult = await client.query<{
      id: string;
      image_storage_path: string | null;
      audio_storage_path: string | null;
      target_count: number;
      submission_count: number;
    }>(
      `
        select
          a.id,
          a.image_storage_path,
          ai.audio_storage_path,
          count(at.id) filter (where at.status <> 'cancelled')::int as target_count,
          count(distinct sub.id)::int as submission_count
        from assignments a
        left join assignment_items ai on ai.assignment_id = a.id
        left join assignment_targets at on at.assignment_id = a.id
        left join submissions sub on sub.assignment_id = a.id
        where a.id = $1 and a.teacher_id = $2
        group by a.id, a.image_storage_path, ai.audio_storage_path
        limit 1
      `,
      [id, teacherId],
    );
    const assignment = assignmentResult.rows[0];

    if (!assignment) {
      await client.query("rollback");
      return NextResponse.json({ error: "삭제할 과제를 찾을 수 없습니다." }, { status: 404 });
    }

    if (assignment.target_count > 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "이미 반이나 학생에게 배정된 과제는 삭제할 수 없습니다. 배정 관리에서 취소해주세요." }, { status: 409 });
    }
    if (assignment.submission_count > 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "학생 제출 기록이 있는 과제는 삭제할 수 없습니다." }, { status: 409 });
    }

    imageStoragePath = assignment.image_storage_path;
    audioStoragePath = assignment.audio_storage_path;

    await client.query("delete from assignment_vocabulary_items where assignment_id = $1", [id]);
    await client.query("delete from assignment_items where assignment_id = $1", [id]);
    await client.query("delete from assignment_targets where assignment_id = $1", [id]);
    await client.query("delete from assignments where id = $1 and teacher_id = $2", [id, teacherId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "과제를 삭제하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }

  const supabase = createSupabaseAdminClient();
  if (imageStoragePath) {
    const { error } = await supabase.storage.from(storageBuckets.images).remove([imageStoragePath]);
    if (error) console.error(error);
  }
  if (audioStoragePath) {
    const { error } = await supabase.storage.from(storageBuckets.audio).remove([audioStoragePath]);
    if (error) console.error(error);
  }

  return NextResponse.json({ ok: true });
}

function parseTargetAssignments(value: FormDataEntryValue | null): AssignmentTargetInput[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as AssignmentTargetInput[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item.classId && item.classSubjectId && item.dueDate);
  } catch {
    return [];
  }
}

function parseVocabularyItems(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as Array<{ word?: unknown; meaning?: unknown; orderIndex?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => ({
        word: String(item.word ?? "").trim(),
        meaning: String(item.meaning ?? "").trim(),
        orderIndex: Number.isFinite(Number(item.orderIndex)) ? Number(item.orderIndex) : index,
      }))
      .filter((item) => item.word && item.meaning)
      .slice(0, 200)
      .map((item, index) => ({ ...item, orderIndex: index }));
  } catch {
    return [];
  }
}

function toDueAt(date: string, time: string) {
  if (!date) return null;
  return `${date}T${time || "23:59"}:00+09:00`;
}

async function findTargetStudents(
  client: PoolClient,
  teacherId: string,
  target: AssignmentTargetInput,
) {
  if (target.targetMode === "partial" && target.selectedStudents.length > 0) {
    const result = await client.query<StudentTargetRow>(
      `
        select distinct s.id
        from students s
        join class_memberships cm on cm.student_id = s.id
        where s.teacher_id = $1
          and s.status = 'active'
          and cm.class_id = $2
          and s.id = any($3::text[])
      `,
      [teacherId, target.classId, target.selectedStudents],
    );
    return result.rows;
  }

  const result = await client.query<StudentTargetRow>(
    `
      select distinct s.id
      from students s
      join class_memberships cm on cm.student_id = s.id
      where s.teacher_id = $1
        and s.status = 'active'
        and cm.class_id = $2
    `,
    [teacherId, target.classId],
  );
  return result.rows;
}
