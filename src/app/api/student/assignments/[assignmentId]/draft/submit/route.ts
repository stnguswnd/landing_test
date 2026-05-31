import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

type DraftRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  assignment_target_id: string | null;
  current_part_id: string | null;
  current_part_order: number;
  draft_data: Record<string, Record<string, unknown>>;
  due_at: Date | null;
  target_id: string;
  submission_id: string | null;
};

type PartRow = {
  id: string;
  part_type: string;
  title: string | null;
  script_text: string | null;
  order_index: number;
};

type DraftAttachmentRow = {
  id: string;
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

type SubmissionAttachmentRow = DraftAttachmentRow & {
  submission_item_id: string;
  submission_id: string;
};

type VocabularyAnswer = {
  originalAnswerText?: string;
  aiCorrectedText?: string;
  aiFeedback?: string;
  aiGrammarNotes?: string;
  aiFeedbackRaw?: unknown;
  revisedAnswerText?: string;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

export async function POST(
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
  const client = await postgresPool.connect();

  try {
    const draftResult = await client.query<DraftRow>(
      `
        select
          sad.*,
          coalesce(at.due_at, a.due_at) as due_at,
          at.id as target_id,
          sub.id as submission_id
        from student_assignment_drafts sad
        join assignments a on a.id = sad.assignment_id and a.teacher_id = $3
        join assignment_targets at on at.assignment_id = sad.assignment_id and at.student_id = sad.student_id and at.status <> 'cancelled'
        left join submissions sub on sub.assignment_id = sad.assignment_id and sub.student_id = sad.student_id
        where sad.assignment_id = $1
          and sad.student_id = $2
          and sad.status = 'draft'
        limit 1
      `,
      [assignmentId, session.studentId, session.teacherId],
    );

    const draft = draftResult.rows[0];
    if (!draft) {
      return NextResponse.json({ error: "최종 제출할 임시저장 내용이 없습니다." }, { status: 400 });
    }

    const partsResult = await client.query<PartRow>(
      `
        select id, part_type, title, script_text, order_index
        from assignment_parts
        where assignment_id = $1 and status = 'active'
        order by order_index
      `,
      [assignmentId],
    );

    const attachmentsResult = await client.query<DraftAttachmentRow>(
      `
        select *
        from student_assignment_draft_attachments
        where draft_id = $1
        order by assignment_part_id, attachment_type, order_index
      `,
      [draft.id],
    );

    const assignmentItem = await client.query<{ id: string }>(
      "select id from assignment_items where assignment_id = $1 order by order_index limit 1",
      [assignmentId],
    );
    const fallbackAssignmentItemId = assignmentItem.rows[0]?.id ?? null;
    const submissionId = draft.submission_id ?? `submission-${randomUUID()}`;
    const targetStatus = draft.due_at && draft.due_at.getTime() < Date.now() ? "late" : "submitted";
    const keptSubmissionAttachmentIds = Array.from(new Set(Object.values(draft.draft_data ?? {}).flatMap((data) => stringArray(data.keptSubmissionAttachmentIds))));
    let keptSubmissionAttachments: SubmissionAttachmentRow[] = [];
    if (draft.submission_id && keptSubmissionAttachmentIds.length > 0) {
      const keptResult = await client.query<SubmissionAttachmentRow>(
        `
          select
            id, submission_item_id, submission_id, assignment_part_id, assignment_item_id,
            attachment_type, storage_bucket, storage_path, file_url, file_name,
            mime_type, file_size_bytes, duration_sec, order_index
          from submission_item_attachments
          where submission_id = $1
            and id = any($2::text[])
          order by assignment_part_id, attachment_type, order_index
        `,
        [draft.submission_id, keptSubmissionAttachmentIds],
      );
      keptSubmissionAttachments = keptResult.rows;
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
      [submissionId, assignmentId, session.studentId, draft.target_id],
    );

    await client.query("delete from submission_item_attachments where submission_id = $1", [submissionId]);
    await client.query("delete from submission_items where submission_id = $1", [submissionId]);
    await client.query("delete from submission_vocabulary_items where submission_id = $1", [submissionId]);

    for (const part of partsResult.rows) {
      const data = draft.draft_data?.[part.id] ?? {};
      const partAttachments = attachmentsResult.rows.filter((attachment) => attachment.assignment_part_id === part.id);
      const keptPartAttachments = keptSubmissionAttachments.filter((attachment) => attachment.assignment_part_id === part.id);
      const allPartAttachments = [...keptPartAttachments, ...partAttachments];
      const submissionItemId = `submission-item-${randomUUID()}`;
      const recording = allPartAttachments.find((attachment) => attachment.attachment_type === "audio");
      const aiResult = data.aiResult as Record<string, unknown> | undefined;
      const states = data.states as Record<string, VocabularyAnswer> | undefined;

      await client.query(
        `
          insert into submission_items (
            id, submission_id, assignment_item_id, assignment_part_id, recording_url,
            recording_storage_path, recording_file_name, recording_duration_sec,
            original_answer_text, answer_text, ai_corrected_text, ai_feedback,
            ai_grammar_notes, ai_expression_notes, ai_feedback_raw
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
        `,
        [
          submissionItemId,
          submissionId,
          null,
          part.id,
          recording?.file_url ?? null,
          recording?.storage_path ?? null,
          recording?.file_name ?? null,
          recording?.duration_sec ?? (typeof data.durationSec === "number" ? data.durationSec : null),
          text(data.answerText),
          text(data.revisedText) ?? (states ? JSON.stringify(states) : null),
          text(aiResult?.correctedText),
          text(aiResult?.feedback),
          Array.isArray(aiResult?.grammarNotes) ? aiResult.grammarNotes.join("\n") : null,
          Array.isArray(aiResult?.expressionNotes) ? aiResult.expressionNotes.join("\n") : null,
          JSON.stringify(aiResult?.raw ?? data),
        ],
      );

      for (const [attachmentIndex, attachment] of allPartAttachments.entries()) {
        await client.query(
          `
            insert into submission_item_attachments (
              id, submission_item_id, submission_id, assignment_item_id, assignment_part_id,
              attachment_type, storage_bucket, storage_path, file_url, file_name,
              mime_type, file_size_bytes, duration_sec, order_index
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `,
          [
            `submission-attachment-${randomUUID()}`,
            submissionItemId,
            submissionId,
            fallbackAssignmentItemId,
            part.id,
            attachment.attachment_type,
            attachment.storage_bucket,
            attachment.storage_path,
            attachment.file_url,
            attachment.file_name,
            attachment.mime_type,
            attachment.file_size_bytes,
            attachment.duration_sec,
            attachmentIndex,
          ],
        );
      }

      if (states && part.part_type === "vocabulary_example") {
        for (const [vocabularyItemId, answer] of Object.entries(states)) {
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
              text(answer.originalAnswerText),
              text(answer.aiCorrectedText),
              text(answer.aiFeedback),
              text(answer.aiGrammarNotes),
              answer.aiFeedbackRaw ? JSON.stringify(answer.aiFeedbackRaw) : null,
              text(answer.revisedAnswerText),
            ],
          );
        }
      }
    }

    await client.query(
      "update assignment_targets set status = $2, submitted_at = now(), reviewed = false, updated_at = now() where id = $1",
      [draft.target_id, targetStatus],
    );
    await client.query(
      "update student_assignment_drafts set status = 'submitted', updated_at = now() where id = $1",
      [draft.id],
    );
    await client.query("commit");

    return NextResponse.json({ submissionId, submittedAt: new Date().toISOString(), status: targetStatus });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "최종 제출 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
