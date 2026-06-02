import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

const MAX_IMAGE_FILE_SIZE = 50 * 1024 * 1024;
const MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024;

type TargetRow = {
  target_id: string;
};

type DraftRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  assignment_target_id: string | null;
  current_part_id: string | null;
  current_part_order: number;
  draft_data: Record<string, unknown>;
  status: "draft" | "submitted" | "discarded";
  updated_at: Date;
};

type DraftAttachmentRow = {
  id: string;
  draft_id: string;
  assignment_part_id: string | null;
  assignment_item_id: string | null;
  attachment_type: "image" | "audio" | "video" | "file";
  storage_bucket: string;
  storage_path: string;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_sec: number | null;
  order_index: number;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "draft-file";
}

function attachmentBucket(type: string) {
  return type === "audio" ? storageBuckets.audio : storageBuckets.images;
}

function maxFileSize(type: string) {
  return type === "audio" ? MAX_AUDIO_FILE_SIZE : MAX_IMAGE_FILE_SIZE;
}

async function signedUrl(bucket: string, path: string | null) {
  if (!path) return "";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

async function fetchDraft(draftId: string) {
  const client = await postgresPool.connect();
  try {
    const draft = await client.query<DraftRow>(
      "select * from student_assignment_drafts where id = $1 limit 1",
      [draftId],
    );
    const row = draft.rows[0];
    if (!row) return null;

    const attachments = await client.query<DraftAttachmentRow>(
      `
        select *
        from student_assignment_draft_attachments
        where draft_id = $1
        order by assignment_part_id, attachment_type, order_index
      `,
      [draftId],
    );

    return {
      id: row.id,
      assignmentId: row.assignment_id,
      studentId: row.student_id,
      assignmentTargetId: row.assignment_target_id ?? undefined,
      currentPartId: row.current_part_id ?? undefined,
      currentPartOrder: row.current_part_order,
      draftData: row.draft_data ?? {},
      status: row.status,
      updatedAt: row.updated_at.toISOString(),
      attachments: await Promise.all(attachments.rows.map(async (attachment) => ({
        id: attachment.id,
        draftId: attachment.draft_id,
        assignmentPartId: attachment.assignment_part_id ?? undefined,
        assignmentItemId: attachment.assignment_item_id ?? undefined,
        attachmentType: attachment.attachment_type,
        storageBucket: attachment.storage_bucket,
        storagePath: attachment.storage_path,
        fileUrl: ((await signedUrl(attachment.storage_bucket, attachment.storage_path)) || attachment.file_url) ?? undefined,
        fileName: attachment.file_name ?? undefined,
        mimeType: attachment.mime_type ?? undefined,
        fileSizeBytes: attachment.file_size_bytes ?? undefined,
        durationSec: attachment.duration_sec ?? undefined,
        orderIndex: attachment.order_index,
      }))),
    };
  } finally {
    client.release();
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  let session;
  try {
    session = await requireStudentSession();
  } catch {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const { assignmentId } = await context.params;
  const result = await postgresPool.query<{ id: string }>(
    `
      select sad.id
      from student_assignment_drafts sad
      join assignments a on a.id = sad.assignment_id and a.teacher_id = $3
      where sad.assignment_id = $1
        and sad.student_id = $2
        and sad.status = 'draft'
      limit 1
    `,
    [assignmentId, session.studentId, session.teacherId],
  );

  const draftId = result.rows[0]?.id;
  if (!draftId) return NextResponse.json({ draft: null });
  return NextResponse.json({ draft: await fetchDraft(draftId) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  let session;
  try {
    session = await requireStudentSession();
  } catch {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const { assignmentId } = await context.params;
  const formData = await request.formData();
  const assignmentPartId = String(formData.get("assignmentPartId") ?? "").trim();
  const assignmentItemId = String(formData.get("assignmentItemId") ?? "").trim();
  const currentPartOrder = Number(formData.get("currentPartOrder") ?? 0);
  const attachmentType = String(formData.get("attachmentType") ?? "").trim();
  const dataRaw = String(formData.get("data") ?? "{}");
  const replaceAttachments = String(formData.get("replaceAttachments") ?? "false") === "true";
  const files = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);

  if (!assignmentPartId) {
    return NextResponse.json({ error: "Part 정보가 필요합니다." }, { status: 400 });
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataRaw);
  } catch {
    return NextResponse.json({ error: "임시저장 데이터 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (files.length > 0 && !["image", "audio"].includes(attachmentType)) {
    return NextResponse.json({ error: "파일 유형이 필요합니다." }, { status: 400 });
  }

  for (const file of files) {
    if (file.size > maxFileSize(attachmentType)) {
      return NextResponse.json({ error: attachmentType === "audio" ? "파일 1개당 최대 50MB까지 저장할 수 있습니다." : "사진 1개당 최대 50MB까지 저장할 수 있습니다." }, { status: 400 });
    }
    if (attachmentType === "image" && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 저장할 수 있습니다." }, { status: 400 });
    }
  }

  const client = await postgresPool.connect();
  const uploadedPaths: Array<{ bucket: string; path: string }> = [];

  try {
    const target = await client.query<TargetRow>(
      `
        select at.id as target_id
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $3
        join assignment_parts ap on ap.assignment_id = a.id and ap.id = $4 and ap.status = 'active'
        where at.assignment_id = $1
          and at.student_id = $2
          and at.status <> 'cancelled'
        limit 1
      `,
      [assignmentId, session.studentId, session.teacherId, assignmentPartId],
    );

    const targetRow = target.rows[0];
    if (!targetRow) {
      return NextResponse.json({ error: "배정되지 않은 과제입니다." }, { status: 403 });
    }

    const draftId = `assignment-draft-${randomUUID()}`;

    await client.query("begin");
    const draft = await client.query<{ id: string; draft_data: Record<string, unknown> }>(
      `
        insert into student_assignment_drafts (
          id, assignment_id, student_id, assignment_target_id, current_part_id, current_part_order, draft_data, status
        )
        values ($1, $2, $3, $4, $5, $6, jsonb_build_object($5::text, $7::jsonb), 'draft')
        on conflict (assignment_id, student_id) where status = 'draft'
        do update set
          assignment_target_id = excluded.assignment_target_id,
          current_part_id = excluded.current_part_id,
          current_part_order = excluded.current_part_order,
          draft_data = coalesce(student_assignment_drafts.draft_data, '{}'::jsonb) || jsonb_build_object($5::text, $7::jsonb),
          updated_at = now()
        returning id, draft_data
      `,
      [draftId, assignmentId, session.studentId, targetRow.target_id, assignmentPartId, currentPartOrder, JSON.stringify(data)],
    );

    const activeDraftId = draft.rows[0].id;

    if (replaceAttachments && attachmentType) {
      await client.query(
        `
          delete from student_assignment_draft_attachments
          where draft_id = $1
            and assignment_part_id = $2
            and attachment_type = $3
        `,
        [activeDraftId, assignmentPartId, attachmentType],
      );
    }

    if (files.length > 0) {
      const supabase = createSupabaseAdminClient();
      const bucket = attachmentBucket(attachmentType);

      for (const [index, file] of files.entries()) {
        const fileName = safeFileName(file.name);
        const storagePath = `drafts/${activeDraftId}/${assignmentPartId}/${index + 1}-${Date.now()}-${fileName}`;
        const bytes = Buffer.from(await file.arrayBuffer());
        const upload = await supabase.storage.from(bucket).upload(storagePath, bytes, {
          contentType: file.type || (attachmentType === "audio" ? "audio/webm" : "image/png"),
          upsert: true,
        });

        if (upload.error) {
          throw upload.error;
        }

        uploadedPaths.push({ bucket, path: storagePath });
        const publicUrl = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;

        await client.query(
          `
            insert into student_assignment_draft_attachments (
              id, draft_id, assignment_part_id, assignment_item_id, attachment_type,
              storage_bucket, storage_path, file_url, file_name, mime_type, file_size_bytes,
              duration_sec, order_index
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `,
          [
            `assignment-draft-attachment-${randomUUID()}`,
            activeDraftId,
            assignmentPartId,
            assignmentItemId || null,
            attachmentType,
            bucket,
            storagePath,
            publicUrl,
            fileName,
            file.type || null,
            file.size,
            Number(formData.get("durationSec") ?? 0) || null,
            index,
          ],
        );
      }
    }

    await client.query("commit");
    return NextResponse.json({ draft: await fetchDraft(activeDraftId) });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const supabase = createSupabaseAdminClient();
    await Promise.all(uploadedPaths.map((item) => supabase.storage.from(item.bucket).remove([item.path]).catch(() => undefined)));
    console.error(error);
    return NextResponse.json({ error: "임시저장 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  let session;
  try {
    session = await requireStudentSession();
  } catch {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const { assignmentId } = await context.params;
  await postgresPool.query(
    `
      update student_assignment_drafts sad
      set status = 'discarded', updated_at = now()
      from assignments a
      where sad.assignment_id = a.id
        and a.teacher_id = $3
        and sad.assignment_id = $1
        and sad.student_id = $2
        and sad.status = 'draft'
    `,
    [assignmentId, session.studentId, session.teacherId],
  );

  return NextResponse.json({ ok: true });
}
