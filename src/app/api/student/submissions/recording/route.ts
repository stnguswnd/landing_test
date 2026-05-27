import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

type TargetRow = {
  target_id: string;
  assignment_id: string;
  assignment_item_id: string;
  submission_id: string | null;
  due_at: Date | null;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "recording.webm";
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
  const durationSec = Number(formData.get("durationSec") ?? 0);
  const file = formData.get("file");

  if (!assignmentId || !assignmentItemId || !(file instanceof File)) {
    return NextResponse.json({ error: "과제, 문항, 녹음 파일이 필요합니다." }, { status: 400 });
  }

  const client = await postgresPool.connect();

  try {
    const target = await client.query<TargetRow>(
      `
        select
          at.id as target_id,
          at.assignment_id,
          ai.id as assignment_item_id,
          sub.id as submission_id,
          coalesce(at.due_at, a.due_at) as due_at
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $4
        join assignment_items ai on ai.assignment_id = at.assignment_id and ai.id = $3
        left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
        where at.assignment_id = $1 and at.student_id = $2
        limit 1
      `,
      [assignmentId, session.studentId, assignmentItemId, session.teacherId],
    );

    if (!target.rows[0]) {
      return NextResponse.json({ error: "배정되지 않은 과제입니다." }, { status: 403 });
    }

    const submissionId = target.rows[0].submission_id ?? `submission-${randomUUID()}`;
    const targetStatus = target.rows[0].due_at && target.rows[0].due_at.getTime() < Date.now() ? "late" : "submitted";
    const submissionStatus = "submitted";
    const fileName = safeFileName(file.name);
    const storagePath = `submissions/${submissionId}/${assignmentItemId}/${fileName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const supabase = createSupabaseAdminClient();
    const upload = await supabase.storage.from(storageBuckets.audio).upload(storagePath, bytes, {
      contentType: file.type || "audio/webm",
      upsert: true,
    });

    if (upload.error) {
      console.error(upload.error);
      return NextResponse.json({ error: "녹음 파일 업로드 중 오류가 발생했습니다." }, { status: 500 });
    }

    const publicUrl = supabase.storage.from(storageBuckets.audio).getPublicUrl(storagePath).data.publicUrl;

    await client.query("begin");
    await client.query(
      `
        insert into submissions (id, assignment_id, student_id, assignment_target_id, status, submitted_at)
        values ($1, $2, $3, $4, $5, now())
        on conflict (assignment_id, student_id)
        do update set
          assignment_target_id = excluded.assignment_target_id,
          status = excluded.status,
          submitted_at = now(),
          updated_at = now()
      `,
      [submissionId, assignmentId, session.studentId, target.rows[0].target_id, submissionStatus],
    );

    await client.query(
      `
        insert into submission_items (
          id, submission_id, assignment_item_id, recording_storage_path, recording_url,
          recording_file_name, recording_mime_type, file_size_bytes, recording_duration_sec
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (submission_id, assignment_item_id)
        do update set
          recording_storage_path = excluded.recording_storage_path,
          recording_url = excluded.recording_url,
          recording_file_name = excluded.recording_file_name,
          recording_mime_type = excluded.recording_mime_type,
          file_size_bytes = excluded.file_size_bytes,
          recording_duration_sec = excluded.recording_duration_sec,
          updated_at = now()
      `,
      [
        `submission-item-${randomUUID()}`,
        submissionId,
        assignmentItemId,
        storagePath,
        publicUrl,
        fileName,
        file.type || "audio/webm",
        file.size,
        Number.isFinite(durationSec) ? Math.round(durationSec) : null,
      ],
    );

    await client.query(
      "update assignment_targets set status = $2, submitted_at = now(), reviewed = false, updated_at = now() where id = $1",
      [target.rows[0].target_id, targetStatus],
    );

    await client.query("commit");

    return NextResponse.json({
      submissionId,
      submittedAt: new Date().toISOString(),
      status: targetStatus,
      recordingStoragePath: storagePath,
      recordingUrl: publicUrl,
    });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "녹음 제출 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
