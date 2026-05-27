import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { normalizeAssignmentItemType, normalizeAssignmentType, normalizeWritingMode, normalizeWritingUnit } from "@/lib/assignmentTypes";
import { requireStudentSession } from "@/server/auth/studentSession";

export const runtime = "nodejs";

type AssignmentItemRow = {
  id: string;
  assignment_id: string;
  item_type: string;
  title: string | null;
  passage_text: string;
  audio_url: string | null;
  audio_file_name: string | null;
  audio_storage_path: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  recording_url: string | null;
  recording_storage_path: string | null;
  recording_file_name: string | null;
  recording_duration_sec: number | null;
  order_index: number;
  min_recording_sec: number;
  max_recording_sec: number;
  writing_mode: string | null;
  writing_unit: string | null;
  writing_unit_count: number | null;
  prompt_text: string | null;
  writing_instructions: string | null;
  writing_hint: string | null;
  writing_example: string | null;
  original_answer_text: string | null;
  answer_text: string | null;
  ai_corrected_text: string | null;
  ai_feedback: string | null;
  ai_grammar_notes: string | null;
  ai_expression_notes: string | null;
  ai_feedback_raw: unknown;
};

type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  assignment_type: string;
  subject_name: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  due_at: Date | null;
  target_status: string;
  submitted_at: Date | null;
  submission_id: string | null;
  submission_status: string | null;
  reviewed_at: Date | null;
  teacher_comment: string | null;
  created_at: Date;
  items: AssignmentItemRow[] | null;
  vocabulary_items: Array<{
    id: string;
    assignment_id: string;
    word: string;
    meaning: string;
    order_index: number;
  }> | null;
  submission_vocabulary_items: Array<{
    id: string;
    submission_id: string;
    assignment_vocabulary_item_id: string;
    original_answer_text: string | null;
    ai_corrected_text: string | null;
    ai_feedback: string | null;
    ai_grammar_notes: string | null;
    ai_feedback_raw: unknown;
    revised_answer_text: string | null;
    teacher_comment: string | null;
    status: string;
  }> | null;
};

async function signedUrl(bucket: string, path: string | null) {
  if (!path) return "";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

export async function GET() {
  let session;
  try {
    session = await requireStudentSession();
  } catch {
    return NextResponse.json({ error: "학생 로그인이 필요합니다." }, { status: 401 });
  }

  const result = await query<AssignmentRow>(
    `
      select
        a.id,
        a.title,
        a.description,
        a.assignment_type,
        cs.name as subject_name,
        a.image_url,
        a.image_storage_path,
        coalesce(at.due_at, a.due_at) as due_at,
        case
          when sub.status in ('reviewed', 'returned') then sub.status
          when at.status in ('submitted', 'late') then at.status
          else coalesce(sub.status, at.status)
        end as target_status,
        coalesce(sub.submitted_at, at.submitted_at) as submitted_at,
        sub.id as submission_id,
        sub.status as submission_status,
        sub.reviewed_at,
        coalesce(sub.teacher_comment, tf.comment) as teacher_comment,
        a.created_at,
        coalesce(
          json_agg(
            json_build_object(
              'id', ai.id,
              'assignment_id', ai.assignment_id,
              'item_type', ai.item_type,
              'title', ai.title,
              'passage_text', ai.passage_text,
              'audio_url', ai.audio_url,
              'audio_file_name', ai.audio_file_name,
              'audio_storage_path', ai.audio_storage_path,
              'image_url', ai.image_url,
              'image_storage_path', ai.image_storage_path,
              'recording_url', si.recording_url,
              'recording_storage_path', si.recording_storage_path,
              'recording_file_name', si.recording_file_name,
              'recording_duration_sec', si.recording_duration_sec,
              'order_index', ai.order_index,
              'min_recording_sec', ai.min_recording_sec,
              'max_recording_sec', ai.max_recording_sec,
              'writing_mode', ai.writing_mode,
              'writing_unit', ai.writing_unit,
              'writing_unit_count', ai.writing_unit_count,
              'prompt_text', ai.prompt_text,
              'writing_instructions', ai.writing_instructions,
              'writing_hint', ai.writing_hint,
              'writing_example', ai.writing_example,
              'original_answer_text', si.original_answer_text,
              'answer_text', si.answer_text,
              'ai_corrected_text', si.ai_corrected_text,
              'ai_feedback', si.ai_feedback,
              'ai_grammar_notes', si.ai_grammar_notes,
              'ai_expression_notes', si.ai_expression_notes,
              'ai_feedback_raw', si.ai_feedback_raw
            )
            order by ai.order_index
          ) filter (where ai.id is not null),
          '[]'::json
        ) as items,
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
        coalesce(
          (
            select json_agg(
              json_build_object(
                'id', svi.id,
                'submission_id', svi.submission_id,
                'assignment_vocabulary_item_id', svi.assignment_vocabulary_item_id,
                'original_answer_text', svi.original_answer_text,
                'ai_corrected_text', svi.ai_corrected_text,
                'ai_feedback', svi.ai_feedback,
                'ai_grammar_notes', svi.ai_grammar_notes,
                'ai_feedback_raw', svi.ai_feedback_raw,
                'revised_answer_text', svi.revised_answer_text,
                'teacher_comment', svi.teacher_comment,
                'status', svi.status
              )
              order by avi.order_index
            )
            from submission_vocabulary_items svi
            join assignment_vocabulary_items avi on avi.id = svi.assignment_vocabulary_item_id
            where svi.submission_id = sub.id
          ),
          '[]'::json
        ) as submission_vocabulary_items
      from assignment_targets at
      join assignments a on a.id = at.assignment_id and a.teacher_id = $2
      left join class_subjects cs on cs.id = at.class_subject_id and cs.teacher_id = a.teacher_id
      left join assignment_items ai on ai.assignment_id = a.id
      left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
      left join submission_items si on si.submission_id = sub.id and si.assignment_item_id = ai.id
      left join teacher_feedback tf on tf.submission_id = sub.id and tf.teacher_id = a.teacher_id
      where at.student_id = $1
        and at.status <> 'cancelled'
      group by a.id, cs.name, at.status, at.due_at, at.submitted_at, sub.id, sub.status, sub.submitted_at, sub.reviewed_at, sub.teacher_comment, tf.comment
      order by coalesce(at.due_at, a.due_at, a.created_at) asc
    `,
    [session.studentId, session.teacherId],
  );

  const assignments = await Promise.all(
    result.rows.map(async (row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      assignmentType: normalizeAssignmentType(row.assignment_type),
      assignmentSubject: row.subject_name ?? undefined,
      imageUrl: ((await signedUrl(storageBuckets.images, row.image_storage_path)) || row.image_url) ?? undefined,
      imageStoragePath: row.image_storage_path ?? undefined,
      dueAt: row.due_at?.toISOString(),
      status: row.target_status,
      targetStatus: row.target_status,
      submittedAt: row.submitted_at?.toISOString(),
      submissionId: row.submission_id ?? undefined,
      submissionStatus: row.submission_status ?? undefined,
      reviewedAt: row.reviewed_at?.toISOString(),
      teacherComment: row.teacher_comment ?? undefined,
      createdAt: row.created_at.toISOString(),
      vocabularyItems: (row.vocabulary_items ?? []).map((item) => ({
        id: item.id,
        assignmentId: item.assignment_id,
        word: item.word,
        meaning: item.meaning,
        orderIndex: item.order_index,
      })),
      submissionVocabularyItems: (row.submission_vocabulary_items ?? []).map((item) => ({
        id: item.id,
        submissionId: item.submission_id,
        assignmentVocabularyItemId: item.assignment_vocabulary_item_id,
        originalAnswerText: item.original_answer_text ?? undefined,
        aiCorrectedText: item.ai_corrected_text ?? undefined,
        aiFeedback: item.ai_feedback ?? undefined,
        aiGrammarNotes: item.ai_grammar_notes ?? undefined,
        aiFeedbackRaw: item.ai_feedback_raw ?? undefined,
        revisedAnswerText: item.revised_answer_text ?? undefined,
        teacherComment: item.teacher_comment ?? undefined,
        status: item.status,
      })),
      items: await Promise.all((row.items ?? []).map(async (item) => ({
        id: item.id,
        assignmentId: item.assignment_id,
        itemType: normalizeAssignmentItemType(item.item_type, row.assignment_type),
        title: item.title ?? undefined,
        passageText: item.passage_text,
        audioUrl: ((await signedUrl(storageBuckets.audio, item.audio_storage_path)) || item.audio_url) ?? undefined,
        audioFileName: item.audio_file_name ?? undefined,
        audioStoragePath: item.audio_storage_path ?? undefined,
        recordingUrl: ((await signedUrl(storageBuckets.audio, item.recording_storage_path)) || item.recording_url) ?? undefined,
        recordingFileName: item.recording_file_name ?? undefined,
        recordingDurationSec: item.recording_duration_sec ?? undefined,
        imageUrl: item.image_url ?? undefined,
        imageStoragePath: item.image_storage_path ?? undefined,
        orderIndex: item.order_index,
        minRecordingSec: item.min_recording_sec,
        maxRecordingSec: item.max_recording_sec,
        writingMode: normalizeWritingMode(item.writing_mode),
        writingUnit: normalizeWritingUnit(item.writing_unit),
        writingUnitCount: item.writing_unit_count ?? undefined,
        promptText: item.prompt_text ?? undefined,
        writingInstructions: item.writing_instructions ?? undefined,
        writingHint: item.writing_hint ?? undefined,
        writingExample: item.writing_example ?? undefined,
        originalAnswerText: item.original_answer_text ?? undefined,
        answerText: item.answer_text ?? undefined,
        aiCorrectedText: item.ai_corrected_text ?? undefined,
        aiFeedback: item.ai_feedback ?? undefined,
        aiGrammarNotes: item.ai_grammar_notes ?? undefined,
        aiExpressionNotes: item.ai_expression_notes ?? undefined,
        aiFeedbackRaw: item.ai_feedback_raw ?? undefined,
      }))),
    })),
  );

  return NextResponse.json(assignments);
}
