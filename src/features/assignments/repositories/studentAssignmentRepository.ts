import "server-only";

import { query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { normalizeAssignmentItemType, normalizeAssignmentType, normalizeWritingMode, normalizeWritingUnit } from "@/lib/assignmentTypes";
import type { Assignment } from "@/types/assignment";

type ItemRow = {
  id: string;
  assignment_id: string;
  item_type: Assignment["items"][number]["itemType"];
  title: string | null;
  passage_text: string;
  audio_url: string | null;
  audio_storage_path: string | null;
  audio_file_name: string | null;
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
  attachments: AttachmentRow[] | null;
};

type AttachmentRow = {
  id: string;
  submission_item_id: string;
  submission_id: string;
  assignment_item_id: string | null;
  attachment_type: "image" | "audio" | "video" | "file";
  storage_bucket: string;
  storage_path: string;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_sec: number | null;
  width_px: number | null;
  height_px: number | null;
  order_index: number;
};

type QuizQuestionRow = {
  id: string;
  assignment_part_id: string;
  question_text: string;
  explanation: string | null;
  order_index: number;
  choices: QuizChoiceRow[] | null;
  attachments: QuizQuestionAttachmentRow[] | null;
};

type QuizChoiceRow = {
  id: string;
  question_id: string;
  choice_label: string | null;
  choice_text: string;
  is_correct: boolean;
  incorrect_reason: string | null;
  order_index: number;
};

type QuizQuestionAttachmentRow = {
  id: string;
  question_id: string;
  attachment_type: "image" | "audio" | "video" | "file";
  storage_bucket: string;
  storage_path: string;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_sec: number | null;
  width_px: number | null;
  height_px: number | null;
  order_index: number;
};

type AssignmentPartRow = {
  id: string;
  assignment_id: string;
  part_type: "instruction" | "listening" | "recording" | "writing" | "photo_submission" | "vocabulary_example" | "vocabulary_recording" | "quiz";
  instruction_kind: "general" | "grading" | "other";
  title: string | null;
  instruction: string | null;
  script_text: string | null;
  writing_mode: string | null;
  writing_unit: string | null;
  writing_hint: string | null;
  writing_example: string | null;
  is_required: boolean;
  allow_submission: boolean;
  min_submission_count: number;
  max_submission_count: number;
  order_index: number;
  status: "active" | "archived";
  attachments: AssignmentPartAttachmentRow[] | null;
  vocabulary_items: AssignmentRow["vocabulary_items"] | null;
  quiz_questions: QuizQuestionRow[] | null;
};

type AssignmentPartAttachmentRow = {
  id: string;
  assignment_part_id: string;
  attachment_type: "image" | "audio" | "video" | "file";
  storage_bucket: string;
  storage_path: string;
  file_url: string | null;
  file_name: string | null;
  order_index: number;
};

type AssignmentDraftAttachmentRow = {
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

type AssignmentDraftRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  assignment_target_id: string | null;
  current_part_id: string | null;
  current_part_order: number;
  draft_data: Record<string, unknown>;
  status: "draft" | "submitted" | "discarded";
  updated_at: string;
  attachments: AssignmentDraftAttachmentRow[] | null;
};

type SubmissionPartRow = {
  id: string;
  assignment_part_id: string;
  part_type: AssignmentPartRow["part_type"] | null;
  title: string | null;
  script_text: string | null;
  recording_url: string | null;
  recording_storage_path: string | null;
  recording_file_name: string | null;
  recording_duration_sec: number | null;
  original_answer_text: string | null;
  answer_text: string | null;
  ai_corrected_text: string | null;
  ai_feedback: string | null;
  ai_grammar_notes: string | null;
  ai_expression_notes: string | null;
  attachments: AttachmentRow[] | null;
  quiz_answers: SubmissionQuizAnswerRow[] | null;
};

type SubmissionQuizAnswerRow = {
  id: string;
  submission_id: string;
  submission_item_id: string | null;
  assignment_part_id: string;
  question_id: string;
  selected_choice_id: string | null;
  answer_text: string | null;
  is_correct: boolean | null;
  answered_at: string;
};

type AssignmentRow = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  assignment_type: Assignment["assignmentType"];
  subject_name: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  due_at: Date | null;
  status: Assignment["status"];
  target_status?: string;
  submitted_at: Date | null;
  submission_id: string | null;
  submission_status: string | null;
  reviewed_at: Date | null;
  teacher_comment: string | null;
  created_at: Date;
  items: ItemRow[] | null;
  vocabulary_items: Array<{
    id: string;
    assignment_id: string;
    assignment_part_id: string | null;
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
    status: "draft" | "submitted" | "reviewed" | "returned";
  }> | null;
  parts: AssignmentPartRow[] | null;
  submission_parts: SubmissionPartRow[] | null;
  draft: AssignmentDraftRow | null;
};

const assignmentTitleCollator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

function compareAssignmentsByTitle(a: Assignment, b: Assignment) {
  const titleCompare = assignmentTitleCollator.compare(a.title, b.title);
  if (titleCompare !== 0) return titleCompare;
  return a.createdAt.localeCompare(b.createdAt);
}

async function signedUrl(bucket: string, path: string | null) {
  if (!path) return "";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

async function mapAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    submissionItemId: row.submission_item_id,
    submissionId: row.submission_id,
    assignmentItemId: row.assignment_item_id ?? undefined,
    attachmentType: row.attachment_type,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileUrl: ((await signedUrl(row.storage_bucket, row.storage_path)) || row.file_url) ?? undefined,
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    widthPx: row.width_px ?? undefined,
    heightPx: row.height_px ?? undefined,
    orderIndex: row.order_index,
  };
}

async function mapPartAttachment(row: AssignmentPartAttachmentRow) {
  return {
    id: row.id,
    assignmentPartId: row.assignment_part_id,
    attachmentType: row.attachment_type,
    fileName: row.file_name ?? undefined,
    fileUrl: ((await signedUrl(row.storage_bucket, row.storage_path)) || row.file_url) ?? undefined,
    orderIndex: row.order_index,
  };
}

async function mapQuizQuestionAttachment(row: QuizQuestionAttachmentRow) {
  return {
    id: row.id,
    questionId: row.question_id,
    attachmentType: row.attachment_type,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileUrl: ((await signedUrl(row.storage_bucket, row.storage_path)) || row.file_url) ?? undefined,
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    widthPx: row.width_px ?? undefined,
    heightPx: row.height_px ?? undefined,
    orderIndex: row.order_index,
  };
}

async function mapQuizQuestion(row: QuizQuestionRow) {
  return {
    id: row.id,
    assignmentPartId: row.assignment_part_id,
    questionText: row.question_text,
    explanation: row.explanation ?? undefined,
    orderIndex: row.order_index,
    choices: (row.choices ?? []).map((choice) => ({
      id: choice.id,
      questionId: choice.question_id,
      choiceLabel: choice.choice_label ?? undefined,
      choiceText: choice.choice_text,
      isCorrect: choice.is_correct,
      incorrectReason: choice.incorrect_reason ?? undefined,
      orderIndex: choice.order_index,
    })),
    attachments: await Promise.all((row.attachments ?? []).map(mapQuizQuestionAttachment)),
  };
}

async function mapDraftAttachment(row: AssignmentDraftAttachmentRow) {
  return {
    id: row.id,
    draftId: row.draft_id,
    assignmentPartId: row.assignment_part_id ?? undefined,
    assignmentItemId: row.assignment_item_id ?? undefined,
    attachmentType: row.attachment_type,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileUrl: ((await signedUrl(row.storage_bucket, row.storage_path)) || row.file_url) ?? undefined,
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    orderIndex: row.order_index,
  };
}

async function mapAssignmentWithSignedUrls(row: AssignmentRow): Promise<Assignment> {
  const items = await Promise.all((row.items ?? []).map(async (item) => ({
    id: item.id,
    assignmentId: item.assignment_id,
    itemType: normalizeAssignmentItemType(item.item_type, row.assignment_type),
    title: item.title ?? undefined,
    passageText: item.passage_text,
    audioUrl: ((await signedUrl(storageBuckets.audio, item.audio_storage_path)) || item.audio_url) ?? undefined,
    audioFileName: item.audio_file_name ?? undefined,
    recordingUrl: ((await signedUrl(storageBuckets.audio, item.recording_storage_path)) || item.recording_url) ?? undefined,
    recordingFileName: item.recording_file_name ?? undefined,
    recordingDurationSec: item.recording_duration_sec ?? undefined,
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
    attachments: await Promise.all((item.attachments ?? []).map(mapAttachment)),
  })));

  return {
    id: row.id,
    teacherId: row.teacher_id,
    classId: row.class_id ?? "",
    title: row.title,
    description: row.description ?? undefined,
    assignmentType: normalizeAssignmentType(row.assignment_type),
    assignmentSubject: row.subject_name ?? undefined,
    imageUrl: ((await signedUrl(storageBuckets.images, row.image_storage_path)) || row.image_url) ?? undefined,
    imageStoragePath: row.image_storage_path ?? undefined,
    dueAt: row.due_at?.toISOString(),
    status: row.status,
    targetStatus: row.target_status,
    submittedAt: row.submitted_at?.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString(),
    teacherComment: row.teacher_comment ?? undefined,
    submissionId: row.submission_id ?? undefined,
    vocabularyItems: (row.vocabulary_items ?? []).map((item) => ({
      id: item.id,
      assignmentId: item.assignment_id,
      assignmentPartId: item.assignment_part_id ?? undefined,
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
    parts: await Promise.all((row.parts ?? []).map(async (part) => ({
      id: part.id,
      assignmentId: part.assignment_id,
      partType: part.part_type,
      instructionKind: part.instruction_kind,
      title: part.title ?? undefined,
      instruction: part.instruction ?? undefined,
      scriptText: part.script_text ?? undefined,
      writingMode: normalizeWritingMode(part.writing_mode),
      writingUnit: normalizeWritingUnit(part.writing_unit),
      writingHint: part.writing_hint ?? undefined,
      writingExample: part.writing_example ?? undefined,
      vocabularyItems: (part.vocabulary_items ?? []).map((item) => ({
        id: item.id,
        assignmentId: item.assignment_id,
        assignmentPartId: item.assignment_part_id ?? undefined,
        word: item.word,
        meaning: item.meaning,
        orderIndex: item.order_index,
      })),
      isRequired: part.is_required,
      allowSubmission: part.allow_submission,
      minSubmissionCount: part.min_submission_count,
      maxSubmissionCount: part.max_submission_count,
      orderIndex: part.order_index,
      status: part.status,
      attachments: await Promise.all((part.attachments ?? []).map(mapPartAttachment)),
      quizQuestions: await Promise.all((part.quiz_questions ?? []).map(mapQuizQuestion)),
    }))),
    submissionParts: await Promise.all((row.submission_parts ?? []).map(async (part) => ({
      id: part.id,
      assignmentPartId: part.assignment_part_id,
      partType: part.part_type ?? undefined,
      title: part.title ?? undefined,
      scriptText: part.script_text ?? undefined,
      recordingUrl: ((await signedUrl(storageBuckets.audio, part.recording_storage_path)) || part.recording_url) ?? undefined,
      recordingFileName: part.recording_file_name ?? undefined,
      recordingDurationSec: part.recording_duration_sec ?? undefined,
      originalAnswerText: part.original_answer_text ?? undefined,
      answerText: part.answer_text ?? undefined,
      aiCorrectedText: part.ai_corrected_text ?? undefined,
      aiFeedback: part.ai_feedback ?? undefined,
      aiGrammarNotes: part.ai_grammar_notes ?? undefined,
      aiExpressionNotes: part.ai_expression_notes ?? undefined,
      attachments: await Promise.all((part.attachments ?? []).map(mapAttachment)),
      quizAnswers: (part.quiz_answers ?? []).map((answer) => ({
        id: answer.id,
        submissionId: answer.submission_id,
        submissionItemId: answer.submission_item_id ?? undefined,
        assignmentPartId: answer.assignment_part_id,
        questionId: answer.question_id,
        selectedChoiceId: answer.selected_choice_id ?? undefined,
        answerText: answer.answer_text ?? undefined,
        isCorrect: answer.is_correct ?? undefined,
        answeredAt: new Date(answer.answered_at).toISOString(),
      })),
    }))),
    draft: row.draft
      ? {
          id: row.draft.id,
          assignmentId: row.draft.assignment_id,
          studentId: row.draft.student_id,
          assignmentTargetId: row.draft.assignment_target_id ?? undefined,
          currentPartId: row.draft.current_part_id ?? undefined,
          currentPartOrder: row.draft.current_part_order,
          draftData: row.draft.draft_data ?? {},
          status: row.draft.status,
          updatedAt: new Date(row.draft.updated_at).toISOString(),
          attachments: await Promise.all((row.draft.attachments ?? []).map(mapDraftAttachment)),
        }
      : undefined,
    createdAt: row.created_at.toISOString(),
    items,
  };
}

export const studentAssignmentRepository = {
  async getAssignmentsForStudent(studentId: string, teacherId: string) {
    const result = await query<AssignmentRow>(
      `
        select
          a.id, a.teacher_id, a.class_id, a.title, a.description, a.assignment_type, cs.name as subject_name, a.image_url, a.image_storage_path,
          coalesce(at.due_at, a.due_at) as due_at,
          a.status,
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
                'audio_storage_path', ai.audio_storage_path,
                'audio_file_name', ai.audio_file_name,
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
                'ai_feedback_raw', si.ai_feedback_raw,
                'attachments', coalesce(
                  (
                    select json_agg(
                      json_build_object(
                        'id', sia.id,
                        'submission_item_id', sia.submission_item_id,
                        'submission_id', sia.submission_id,
                        'assignment_item_id', sia.assignment_item_id,
                        'attachment_type', sia.attachment_type,
                        'storage_bucket', sia.storage_bucket,
                        'storage_path', sia.storage_path,
                        'file_url', sia.file_url,
                        'file_name', sia.file_name,
                        'mime_type', sia.mime_type,
                        'file_size_bytes', sia.file_size_bytes,
                        'duration_sec', sia.duration_sec,
                        'width_px', sia.width_px,
                        'height_px', sia.height_px,
                        'order_index', sia.order_index
                      )
                      order by sia.order_index
                    )
                    from submission_item_attachments sia
                    where sia.submission_item_id = si.id
                  ),
                  '[]'::json
                )
              )
              order by ai.order_index
            ) filter (where ai.id is not null),
            '[]'::json
          ) as items
          ,
          coalesce(
            (
              select json_agg(
                json_build_object(
                  'id', avi.id,
                  'assignment_id', avi.assignment_id,
                  'assignment_part_id', avi.assignment_part_id,
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
          ) as submission_vocabulary_items,
          coalesce(
            (
              select json_agg(
                json_build_object(
                  'id', ap.id,
                  'assignment_id', ap.assignment_id,
                  'part_type', ap.part_type,
                  'instruction_kind', ap.instruction_kind,
                  'title', ap.title,
                  'instruction', ap.instruction,
                  'script_text', ap.script_text,
                  'writing_mode', ap.writing_mode,
                  'writing_unit', ap.writing_unit,
                  'writing_hint', ap.writing_hint,
                  'writing_example', ap.writing_example,
                  'is_required', ap.is_required,
                  'allow_submission', ap.allow_submission,
                  'min_submission_count', ap.min_submission_count,
                  'max_submission_count', ap.max_submission_count,
                  'order_index', ap.order_index,
                  'status', ap.status,
                  'attachments', coalesce(
                    (
                      select json_agg(
                        json_build_object(
                          'id', apa.id,
                          'assignment_part_id', apa.assignment_part_id,
                          'attachment_type', apa.attachment_type,
                          'storage_bucket', apa.storage_bucket,
                          'storage_path', apa.storage_path,
                          'file_url', apa.file_url,
                          'file_name', apa.file_name,
                          'order_index', apa.order_index
                        )
                        order by apa.attachment_type, apa.order_index
                      )
                      from assignment_part_attachments apa
                      where apa.assignment_part_id = ap.id
                    ),
                    '[]'::json
                  ),
                  'vocabulary_items', coalesce(
                    (
                      select json_agg(
                        json_build_object(
                          'id', avi.id,
                          'assignment_id', avi.assignment_id,
                          'assignment_part_id', avi.assignment_part_id,
                          'word', avi.word,
                          'meaning', avi.meaning,
                          'order_index', avi.order_index
                        )
                        order by avi.order_index
                      )
                      from assignment_vocabulary_items avi
                      where avi.assignment_part_id = ap.id
                    ),
                    '[]'::json
                  ),
                  'quiz_questions', coalesce(
                    (
                      select json_agg(
                        json_build_object(
                          'id', aqq.id,
                          'assignment_part_id', aqq.assignment_part_id,
                          'question_text', aqq.question_text,
                          'explanation', aqq.explanation,
                          'order_index', aqq.order_index,
                          'choices', coalesce(
                            (
                              select json_agg(
                                json_build_object(
                                  'id', aqc.id,
                                  'question_id', aqc.question_id,
                                  'choice_label', aqc.choice_label,
                                  'choice_text', aqc.choice_text,
                                  'is_correct', aqc.is_correct,
                                  'incorrect_reason', aqc.incorrect_reason,
                                  'order_index', aqc.order_index
                                )
                                order by aqc.order_index
                              )
                              from assignment_quiz_choices aqc
                              where aqc.question_id = aqq.id
                            ),
                            '[]'::json
                          ),
                          'attachments', coalesce(
                            (
                              select json_agg(
                                json_build_object(
                                  'id', aqqa.id,
                                  'question_id', aqqa.question_id,
                                  'attachment_type', aqqa.attachment_type,
                                  'storage_bucket', aqqa.storage_bucket,
                                  'storage_path', aqqa.storage_path,
                                  'file_url', aqqa.file_url,
                                  'file_name', aqqa.file_name,
                                  'mime_type', aqqa.mime_type,
                                  'file_size_bytes', aqqa.file_size_bytes,
                                  'duration_sec', aqqa.duration_sec,
                                  'width_px', aqqa.width_px,
                                  'height_px', aqqa.height_px,
                                  'order_index', aqqa.order_index
                                )
                                order by aqqa.attachment_type, aqqa.order_index
                              )
                              from assignment_quiz_question_attachments aqqa
                              where aqqa.question_id = aqq.id
                            ),
                            '[]'::json
                          )
                        )
                        order by aqq.order_index
                      )
                      from assignment_quiz_questions aqq
                      where aqq.assignment_part_id = ap.id
                    ),
                    '[]'::json
                  )
                )
                order by ap.order_index
              )
              from assignment_parts ap
              where ap.assignment_id = a.id
                and ap.status = 'active'
            ),
            '[]'::json
          ) as parts,
          coalesce(
            (
              select json_agg(
                json_build_object(
                  'id', spi.id,
                  'assignment_part_id', spi.assignment_part_id,
                  'part_type', sp.part_type,
                  'title', sp.title,
                  'script_text', sp.script_text,
                  'recording_url', spi.recording_url,
                  'recording_storage_path', spi.recording_storage_path,
                  'recording_file_name', spi.recording_file_name,
                  'recording_duration_sec', spi.recording_duration_sec,
                  'original_answer_text', spi.original_answer_text,
                  'answer_text', spi.answer_text,
                  'ai_corrected_text', spi.ai_corrected_text,
                  'ai_feedback', spi.ai_feedback,
                  'ai_grammar_notes', spi.ai_grammar_notes,
                  'ai_expression_notes', spi.ai_expression_notes,
                  'attachments', coalesce(
                    (
                      select json_agg(
                        json_build_object(
                          'id', sia.id,
                          'submission_item_id', sia.submission_item_id,
                          'submission_id', sia.submission_id,
                          'assignment_item_id', sia.assignment_item_id,
                          'attachment_type', sia.attachment_type,
                          'storage_bucket', sia.storage_bucket,
                          'storage_path', sia.storage_path,
                          'file_url', sia.file_url,
                          'file_name', sia.file_name,
                          'mime_type', sia.mime_type,
                          'file_size_bytes', sia.file_size_bytes,
                          'duration_sec', sia.duration_sec,
                          'width_px', sia.width_px,
                          'height_px', sia.height_px,
                          'order_index', sia.order_index
                        )
                        order by sia.order_index
                      )
                      from submission_item_attachments sia
                      where sia.submission_item_id = spi.id
                    ),
                    '[]'::json
                  ),
                  'quiz_answers', coalesce(
                    (
                      select json_agg(
                        json_build_object(
                          'id', sqa.id,
                          'submission_id', sqa.submission_id,
                          'submission_item_id', sqa.submission_item_id,
                          'assignment_part_id', sqa.assignment_part_id,
                          'question_id', sqa.question_id,
                          'selected_choice_id', sqa.selected_choice_id,
                          'answer_text', sqa.answer_text,
                          'is_correct', sqa.is_correct,
                          'answered_at', sqa.answered_at
                        )
                        order by aqq.order_index
                      )
                      from submission_quiz_answers sqa
                      join assignment_quiz_questions aqq on aqq.id = sqa.question_id
                      where sqa.submission_item_id = spi.id
                    ),
                    '[]'::json
                  )
                )
                order by sp.order_index
              )
              from submission_items spi
              join assignment_parts sp on sp.id = spi.assignment_part_id
              where spi.submission_id = sub.id
            ),
            '[]'::json
          ) as submission_parts,
          (
            select json_build_object(
              'id', sad.id,
              'assignment_id', sad.assignment_id,
              'student_id', sad.student_id,
              'assignment_target_id', sad.assignment_target_id,
              'current_part_id', sad.current_part_id,
              'current_part_order', sad.current_part_order,
              'draft_data', sad.draft_data,
              'status', sad.status,
              'updated_at', sad.updated_at,
              'attachments', coalesce(
                (
                  select json_agg(
                    json_build_object(
                      'id', sada.id,
                      'draft_id', sada.draft_id,
                      'assignment_part_id', sada.assignment_part_id,
                      'assignment_item_id', sada.assignment_item_id,
                      'attachment_type', sada.attachment_type,
                      'storage_bucket', sada.storage_bucket,
                      'storage_path', sada.storage_path,
                      'file_url', sada.file_url,
                      'file_name', sada.file_name,
                      'mime_type', sada.mime_type,
                      'file_size_bytes', sada.file_size_bytes,
                      'duration_sec', sada.duration_sec,
                      'order_index', sada.order_index
                    )
                    order by sada.assignment_part_id, sada.attachment_type, sada.order_index
                  )
                  from student_assignment_draft_attachments sada
                  where sada.draft_id = sad.id
                ),
                '[]'::json
              )
            )
            from student_assignment_drafts sad
            where sad.assignment_id = a.id
              and sad.student_id = at.student_id
              and sad.status = 'draft'
            limit 1
          ) as draft
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $2
        left join class_subjects cs on cs.id = at.class_subject_id and cs.teacher_id = a.teacher_id
        left join assignment_items ai on ai.assignment_id = a.id
        left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
        left join submission_items si on si.submission_id = sub.id and si.assignment_item_id = ai.id
        left join teacher_feedback tf on tf.submission_id = sub.id and tf.teacher_id = a.teacher_id
        where at.student_id = $1
          and at.status <> 'cancelled'
          and (
            coalesce(at.due_at, a.due_at) is null
            or coalesce(at.due_at, a.due_at) >= now()
          )
          and (
            coalesce(at.class_id, a.class_id) is null
            or exists (
              select 1
              from classes c
              where c.id = coalesce(at.class_id, a.class_id)
                and c.teacher_id = a.teacher_id
                and c.status = 'active'
            )
          )
        group by a.id, cs.name, at.student_id, at.due_at, at.status, at.submitted_at, sub.id, sub.status, sub.submitted_at, sub.reviewed_at, sub.teacher_comment, tf.comment
        order by coalesce(at.due_at, a.due_at, a.created_at) asc
      `,
      [studentId, teacherId],
    );

    const assignments = await Promise.all(result.rows.map(mapAssignmentWithSignedUrls));
    return assignments.sort(compareAssignmentsByTitle);
  },

  async getAssignmentForStudent(studentId: string, teacherId: string, assignmentId: string) {
    const assignments = await this.getAssignmentsForStudent(studentId, teacherId);
    return assignments.find((assignment) => assignment.id === assignmentId);
  },
};
