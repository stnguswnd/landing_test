import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

type TargetRow = {
  target_id: string;
  submission_id: string | null;
  due_at: Date | null;
};

export async function POST(request: Request) {
  let session;
  try {
    session = await requireStudentSession();
  } catch {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const assignmentId = String(body.assignmentId ?? "").trim();

  if (!assignmentId) {
    return NextResponse.json({ error: "과제 ID가 필요합니다." }, { status: 400 });
  }

  const client = await postgresPool.connect();

  try {
    const target = await client.query<TargetRow>(
      `
        select
          at.id as target_id,
          sub.id as submission_id,
          coalesce(at.due_at, a.due_at) as due_at
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $3
        left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
        where at.assignment_id = $1
          and at.student_id = $2
          and a.assignment_type = 'listening'
        limit 1
      `,
      [assignmentId, session.studentId, session.teacherId],
    );

    const row = target.rows[0];
    if (!row) {
      return NextResponse.json({ error: "배정되지 않았거나 리스닝 숙제가 아닙니다." }, { status: 403 });
    }

    const submissionId = row.submission_id ?? `submission-${randomUUID()}`;
    const targetStatus = row.due_at && row.due_at.getTime() < Date.now() ? "late" : "submitted";
    const submissionStatus = "submitted";

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
      [submissionId, assignmentId, session.studentId, row.target_id, submissionStatus],
    );

    await client.query(
      "update assignment_targets set status = $2, submitted_at = now(), reviewed = false, updated_at = now() where id = $1",
      [row.target_id, targetStatus],
    );
    await client.query("commit");

    return NextResponse.json({
      submissionId,
      submittedAt: new Date().toISOString(),
      status: targetStatus,
    });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "리스닝 숙제 완료 처리 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
