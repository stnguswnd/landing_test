import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type SubmissionStatusRow = {
  student_id: string;
  student_name: string;
  class_names: string[] | null;
  target_status: string;
  submitted_at: Date | null;
  due_at: Date | null;
  reviewed: boolean;
  submission_id: string | null;
  recording_url: string | null;
  recording_storage_path: string | null;
  teacher_comment: string | null;
};

async function signedUrl(bucket: string, path: string | null) {
  if (!path) return "";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const { teacherId } = await requireTeacherSession();
  const { assignmentId } = await context.params;

  const assignment = await query<{ id: string }>(
    "select id from assignments where id = $1 and teacher_id = $2 limit 1",
    [assignmentId, teacherId],
  );

  if (!assignment.rows[0]) {
    return NextResponse.json({ error: "과제를 찾을 수 없습니다." }, { status: 404 });
  }

  const result = await query<SubmissionStatusRow>(
    `
      select
        s.id as student_id,
        s.name as student_name,
        coalesce(array_remove(array_agg(distinct c.name), null), array[]::text[]) as class_names,
        at.status as target_status,
        coalesce(sub.submitted_at, at.submitted_at) as submitted_at,
        coalesce(at.due_at, a.due_at) as due_at,
        at.reviewed,
        sub.id as submission_id,
        (
          select si.recording_storage_path
          from submission_items si
          where si.submission_id = sub.id
          order by si.created_at desc
          limit 1
        ) as recording_storage_path,
        (
          select si.recording_url
          from submission_items si
          where si.submission_id = sub.id
          order by si.created_at desc
          limit 1
        ) as recording_url,
        sub.teacher_comment
      from assignment_targets at
      join students s on s.id = at.student_id and s.teacher_id = $2
      left join classes c on c.id = at.class_id and c.teacher_id = $2
      left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
      left join assignments a on a.id = at.assignment_id and a.teacher_id = $2
      where at.assignment_id = $1
        and at.status <> 'cancelled'
      group by s.id, at.id, a.due_at, sub.id
      order by s.name asc
    `,
    [assignmentId, teacherId],
  );

  const rows = await Promise.all(
    result.rows.map(async (row) => ({
      studentId: row.student_id,
      studentName: row.student_name,
      classNames: row.class_names ?? [],
      targetStatus: row.target_status,
      submittedAt: row.submitted_at?.toISOString() ?? null,
      dueAt: row.due_at?.toISOString() ?? null,
      isLate: Boolean(row.submitted_at && row.due_at && row.submitted_at.getTime() > row.due_at.getTime()),
      reviewed: row.reviewed,
      submissionId: row.submission_id,
      recordingUrl: (await signedUrl(storageBuckets.audio, row.recording_storage_path)) || row.recording_url,
      teacherComment: row.teacher_comment,
    })),
  );

  return NextResponse.json(rows);
}
