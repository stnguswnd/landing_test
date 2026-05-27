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

type AnswerInput = {
  assignmentVocabularyItemId: string;
  originalAnswerText: string;
  aiCorrectedText?: string;
  aiFeedback?: string;
  aiGrammarNotes?: string;
  aiFeedbackRaw?: unknown;
  revisedAnswerText: string;
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
  const answers = Array.isArray(body.answers) ? body.answers as AnswerInput[] : [];

  if (!assignmentId || !assignmentItemId || answers.length === 0) {
    return NextResponse.json({ error: "제출할 단어장 답안이 필요합니다." }, { status: 400 });
  }

  const client = await postgresPool.connect();
  try {
    const targetResult = await client.query<TargetRow>(
      `
        select
          at.id as target_id,
          sub.id as submission_id,
          coalesce(at.due_at, a.due_at) as due_at
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $3
        join assignment_items ai on ai.assignment_id = a.id and ai.id = $4
        left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
        where at.assignment_id = $1
          and at.student_id = $2
          and at.status <> 'cancelled'
          and a.assignment_type = 'vocabulary_example'
        limit 1
      `,
      [assignmentId, session.studentId, session.teacherId, assignmentItemId],
    );

    const target = targetResult.rows[0];
    if (!target) return NextResponse.json({ error: "배정되지 않은 단어장 예문 숙제입니다." }, { status: 403 });

    const submissionId = target.submission_id ?? `submission-${randomUUID()}`;
    const targetStatus = target.due_at && target.due_at.getTime() < Date.now() ? "late" : "submitted";
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
      [submissionId, assignmentId, session.studentId, target.target_id, submissionStatus],
    );

    await client.query(
      `
        insert into submission_items (id, submission_id, assignment_item_id)
        values ($1, $2, $3)
        on conflict (submission_id, assignment_item_id)
        do update set updated_at = now()
      `,
      [`submission-item-${randomUUID()}`, submissionId, assignmentItemId],
    );

    for (const answer of answers) {
      const vocabularyItemId = String(answer.assignmentVocabularyItemId ?? "").trim();
      if (!vocabularyItemId) continue;
      await client.query(
        `
          insert into submission_vocabulary_items (
            id, submission_id, assignment_vocabulary_item_id,
            original_answer_text, ai_corrected_text, ai_feedback, ai_grammar_notes,
            ai_feedback_raw, revised_answer_text, status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, 'submitted')
          on conflict (submission_id, assignment_vocabulary_item_id)
          do update set
            original_answer_text = excluded.original_answer_text,
            ai_corrected_text = excluded.ai_corrected_text,
            ai_feedback = excluded.ai_feedback,
            ai_grammar_notes = excluded.ai_grammar_notes,
            ai_feedback_raw = excluded.ai_feedback_raw,
            revised_answer_text = excluded.revised_answer_text,
            status = 'submitted',
            updated_at = now()
        `,
        [
          `submission-vocab-${randomUUID()}`,
          submissionId,
          vocabularyItemId,
          String(answer.originalAnswerText ?? "").trim(),
          String(answer.aiCorrectedText ?? "").trim() || null,
          String(answer.aiFeedback ?? "").trim() || null,
          String(answer.aiGrammarNotes ?? "").trim() || null,
          answer.aiFeedbackRaw ? JSON.stringify(answer.aiFeedbackRaw) : null,
          String(answer.revisedAnswerText ?? "").trim(),
        ],
      );
    }

    await client.query(
      "update assignment_targets set status = $2, submitted_at = now(), reviewed = false, updated_at = now() where id = $1",
      [target.target_id, targetStatus],
    );
    await client.query("commit");

    return NextResponse.json({ submissionId, status: targetStatus, submittedAt: new Date().toISOString() });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "단어장 예문 제출 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
