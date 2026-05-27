import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { submissionId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status = body.status === "returned" ? "returned" : "reviewed";
  const comment = String(body.teacherComment ?? "").trim() || null;
  const client = await postgresPool.connect();

  try {
    await client.query("begin");

    const result = await client.query<{
      id: string;
      assignment_id: string;
      student_id: string;
      assignment_target_id: string | null;
    }>(
      `
        update submissions sub
        set status = $3, teacher_comment = $4, reviewed_at = now(), updated_at = now()
        from assignments a
        where sub.id = $1 and sub.assignment_id = a.id and a.teacher_id = $2
        returning sub.id, sub.assignment_id, sub.student_id, sub.assignment_target_id
      `,
      [submissionId, teacherId, status, comment],
    );

    const submission = result.rows[0];
    if (!submission) {
      await client.query("rollback");
      return NextResponse.json({ error: "제출을 찾을 수 없습니다." }, { status: 404 });
    }

    await client.query(
      `
        update assignment_targets at
        set reviewed = true, feedback = $5, updated_at = now()
        where (
          at.id = $1
          or (at.assignment_id = $2 and at.student_id = $3)
        )
        and exists (
          select 1
          from assignments a
          where a.id = at.assignment_id and a.teacher_id = $4
        )
      `,
      [submission.assignment_target_id, submission.assignment_id, submission.student_id, teacherId, comment],
    );

    await client.query(
      `
        insert into teacher_feedback (id, submission_id, teacher_id, comment)
        values ($1, $2, $3, $4)
        on conflict (submission_id)
        do update set
          comment = excluded.comment,
          teacher_id = excluded.teacher_id,
          updated_at = now()
      `,
      [`feedback-${submissionId}`, submissionId, teacherId, comment],
    );

    await client.query("commit");

    return NextResponse.json({
      ok: true,
      submissionId,
      status,
      teacherComment: comment,
      reviewedAt: new Date().toISOString(),
    });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "검토 저장 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
