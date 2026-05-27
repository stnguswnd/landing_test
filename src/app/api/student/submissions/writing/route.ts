import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

type TargetRow = {
  target_id: string;
  submission_id: string | null;
  assignment_item_id: string | null;
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
  const assignmentItemId = String(body.assignmentItemId ?? "").trim();
  const originalAnswerText = String(body.originalAnswerText ?? "").trim();
  const answerText = String(body.answerText ?? "").trim();
  const aiCorrectedText = String(body.aiCorrectedText ?? "").trim();
  const aiFeedback = String(body.aiFeedback ?? "").trim();
  const aiGrammarNotes = String(body.aiGrammarNotes ?? "").trim();
  const aiExpressionNotes = String(body.aiExpressionNotes ?? "").trim();
  const aiFeedbackRaw = body.aiFeedbackRaw ?? null;

  if (!assignmentId || !assignmentItemId || !answerText) {
    return NextResponse.json({ error: "라이팅 제출 정보가 부족합니다." }, { status: 400 });
  }

  const client = await postgresPool.connect();
  try {
    const target = await client.query<TargetRow>(
      `
        select
          at.id as target_id,
          sub.id as submission_id,
          ai.id as assignment_item_id,
          coalesce(at.due_at, a.due_at) as due_at
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $3
        join assignment_items ai on ai.assignment_id = a.id and ai.id = $4
        left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
        where at.assignment_id = $1
          and at.student_id = $2
          and a.assignment_type = 'writing'
        limit 1
      `,
      [assignmentId, session.studentId, session.teacherId, assignmentItemId],
    );

    const row = target.rows[0];
    if (!row) {
      return NextResponse.json({ error: "배정되지 않았거나 라이팅 숙제가 아닙니다." }, { status: 403 });
    }

    const submissionId = row.submission_id ?? `submission-${randomUUID()}`;
    const itemSubmissionId = `submission-item-${randomUUID()}`;
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
      `
        insert into submission_items (
          id, submission_id, assignment_item_id, original_answer_text, answer_text, ai_corrected_text,
          ai_feedback, ai_grammar_notes, ai_expression_notes, ai_feedback_raw
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        on conflict (submission_id, assignment_item_id)
        do update set
          original_answer_text = excluded.original_answer_text,
          answer_text = excluded.answer_text,
          ai_corrected_text = excluded.ai_corrected_text,
          ai_feedback = excluded.ai_feedback,
          ai_grammar_notes = excluded.ai_grammar_notes,
          ai_expression_notes = excluded.ai_expression_notes,
          ai_feedback_raw = excluded.ai_feedback_raw,
          updated_at = now()
      `,
      [
        itemSubmissionId,
        submissionId,
        assignmentItemId,
        originalAnswerText || null,
        answerText,
        aiCorrectedText || null,
        aiFeedback || null,
        aiGrammarNotes || null,
        aiExpressionNotes || null,
        JSON.stringify(aiFeedbackRaw),
      ],
    );

    await client.query("update assignment_targets set status = $2, submitted_at = now(), reviewed = false, updated_at = now() where id = $1", [row.target_id, targetStatus]);
    await client.query("commit");

    return NextResponse.json({ submissionId, submittedAt: new Date().toISOString(), status: targetStatus });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "라이팅 제출 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
