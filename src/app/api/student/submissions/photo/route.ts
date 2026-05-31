import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

const MAX_IMAGE_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PHOTO_COUNT = 20;

type TargetRow = {
  target_id: string;
  assignment_id: string;
  assignment_item_id: string;
  submission_id: string | null;
  due_at: Date | null;
  min_photo_count: number;
  max_photo_count: number;
};

type ExistingAttachmentRow = {
  id: string;
  order_index: number;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "photo.png";
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireStudentSession();
  } catch {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const assignmentItemId = String(formData.get("assignmentItemId") ?? "").trim();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
  const keptAttachmentIds = parseKeptAttachmentIds(formData.get("keptAttachmentIds"));

  if (!assignmentId || !assignmentItemId) {
    return NextResponse.json({ error: "과제와 문항 정보가 필요합니다." }, { status: 400 });
  }
  if (files.length > MAX_PHOTO_COUNT) {
    return NextResponse.json({ error: `사진은 최대 ${MAX_PHOTO_COUNT}장까지 제출할 수 있습니다.` }, { status: 400 });
  }

  for (const file of files) {
    if (!isImageFile(file)) {
      return NextResponse.json({ error: "이미지 파일만 제출할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_FILE_SIZE) {
      return NextResponse.json({ error: "사진 1개당 최대 50MB까지 제출할 수 있습니다." }, { status: 400 });
    }
  }

  const client = await postgresPool.connect();
  const uploadedPaths: string[] = [];

  try {
    const target = await client.query<TargetRow>(
      `
        select
          at.id as target_id,
          at.assignment_id,
          ai.id as assignment_item_id,
          sub.id as submission_id,
          coalesce(at.due_at, a.due_at) as due_at,
          ai.min_photo_count,
          ai.max_photo_count
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $4 and a.assignment_type = 'photo_submission'
        join assignment_items ai on ai.assignment_id = at.assignment_id and ai.id = $3 and ai.item_type = 'photo_submission'
        left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
        where at.assignment_id = $1 and at.student_id = $2
        limit 1
      `,
      [assignmentId, session.studentId, assignmentItemId, session.teacherId],
    );

    const targetRow = target.rows[0];
    if (!targetRow) {
      return NextResponse.json({ error: "배정되지 않은 사진 제출 과제입니다." }, { status: 403 });
    }

    let keptAttachments: ExistingAttachmentRow[] = [];
    if (targetRow.submission_id && keptAttachmentIds.length > 0) {
      const keptResult = await client.query<ExistingAttachmentRow>(
        `
          select sia.id, sia.order_index
          from submission_item_attachments sia
          join submission_items si on si.id = sia.submission_item_id
          where si.submission_id = $1
            and si.assignment_item_id = $2
            and sia.attachment_type = 'image'
            and sia.id = any($3::text[])
          order by sia.order_index
        `,
        [targetRow.submission_id, assignmentItemId, keptAttachmentIds],
      );
      keptAttachments = keptResult.rows;
    }

    const totalPhotoCount = keptAttachments.length + files.length;
    if (totalPhotoCount < targetRow.min_photo_count || totalPhotoCount > targetRow.max_photo_count) {
      return NextResponse.json(
        { error: `사진은 ${targetRow.min_photo_count}장 이상, ${targetRow.max_photo_count}장 이하로 제출해주세요.` },
        { status: 400 },
      );
    }

    const submissionId = targetRow.submission_id ?? `submission-${randomUUID()}`;
    const targetStatus = targetRow.due_at && targetRow.due_at.getTime() < Date.now() ? "late" : "submitted";
    const supabase = createSupabaseAdminClient();
    const uploaded = [];

    for (const [index, file] of files.entries()) {
      const fileName = safeFileName(file.name);
      const storagePath = `submissions/${submissionId}/${assignmentItemId}/photos/${index + 1}-${Date.now()}-${fileName}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const upload = await supabase.storage.from(storageBuckets.images).upload(storagePath, bytes, {
        contentType: file.type || "image/png",
        upsert: true,
      });

      if (upload.error) {
        console.error(upload.error);
        return NextResponse.json({ error: "사진 업로드 중 오류가 발생했습니다." }, { status: 500 });
      }

      uploadedPaths.push(storagePath);
      uploaded.push({
        file,
        fileName,
        storagePath,
        publicUrl: supabase.storage.from(storageBuckets.images).getPublicUrl(storagePath).data.publicUrl,
        orderIndex: index,
      });
    }

    await client.query("begin");
    await client.query(
      `
        insert into submissions (id, assignment_id, student_id, assignment_target_id, status, submitted_at)
        values ($1, $2, $3, $4, 'submitted', now())
        on conflict (assignment_id, student_id)
        do update set
          assignment_target_id = excluded.assignment_target_id,
          status = excluded.status,
          submitted_at = now(),
          reviewed_at = null,
          teacher_comment = null,
          updated_at = now()
      `,
      [submissionId, assignmentId, session.studentId, targetRow.target_id],
    );

    const submissionItem = await client.query<{ id: string }>(
      `
        insert into submission_items (id, submission_id, assignment_item_id)
        values ($1, $2, $3)
        on conflict (submission_id, assignment_item_id)
        do update set updated_at = now()
        returning id
      `,
      [`submission-item-${randomUUID()}`, submissionId, assignmentItemId],
    );
    const submissionItemId = submissionItem.rows[0].id;

    if (keptAttachments.length > 0) {
      await client.query(
        "delete from submission_item_attachments where submission_item_id = $1 and attachment_type = 'image' and not (id = any($2::text[]))",
        [submissionItemId, keptAttachments.map((attachment) => attachment.id)],
      );
      for (const [index, attachment] of keptAttachments.entries()) {
        await client.query(
          "update submission_item_attachments set order_index = $2, updated_at = now() where id = $1",
          [attachment.id, index],
        );
      }
    } else {
      await client.query(
        "delete from submission_item_attachments where submission_item_id = $1 and attachment_type = 'image'",
        [submissionItemId],
      );
    }

    for (const item of uploaded) {
      await client.query(
        `
          insert into submission_item_attachments (
            id, submission_item_id, submission_id, assignment_item_id, attachment_type,
            storage_bucket, storage_path, file_url, file_name, mime_type, file_size_bytes, order_index
          )
          values ($1, $2, $3, $4, 'image', $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          `attachment-${randomUUID()}`,
          submissionItemId,
          submissionId,
          assignmentItemId,
          storageBuckets.images,
          item.storagePath,
          item.publicUrl,
          item.fileName,
          item.file.type || "image/png",
          item.file.size,
          keptAttachments.length + item.orderIndex,
        ],
      );
    }

    await client.query(
      "update assignment_targets set status = $2, submitted_at = now(), reviewed = false, updated_at = now() where id = $1",
      [targetRow.target_id, targetStatus],
    );

    await client.query("commit");

    return NextResponse.json({
      submissionId,
      submittedAt: new Date().toISOString(),
      status: targetStatus,
      attachments: uploaded.map((item) => ({
        storagePath: item.storagePath,
        url: item.publicUrl,
        fileName: item.fileName,
      })),
    });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "사진 제출 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}

function parseKeptAttachmentIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, MAX_PHOTO_COUNT);
  } catch {
    return [];
  }
}
