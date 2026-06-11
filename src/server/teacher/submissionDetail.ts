import "server-only";

import { query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { normalizeAssignmentType } from "@/lib/assignmentTypes";

type SubmissionRow = {
  submission_id: string;
  status: string;
  target_reviewed: boolean | null;
  feedback_id: string | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  due_at: Date | null;
  teacher_comment: string | null;
  student_id: string;
  student_name: string;
  school_name: string | null;
  grade: string | null;
  class_names: string[] | null;
  assignment_id: string;
  assignment_title: string;
  assignment_type: string;
  submission_item_id: string | null;
  assignment_item_id: string | null;
  assignment_part_id: string | null;
  part_type: string | null;
  part_title: string | null;
  part_script_text: string | null;
  item_title: string | null;
  passage_text: string | null;
  writing_mode: string | null;
  writing_unit: string | null;
  writing_unit_count: number | null;
  prompt_text: string | null;
  audio_url: string | null;
  audio_storage_path: string | null;
  recording_url: string | null;
  recording_storage_path: string | null;
  recording_duration_sec: number | null;
  recording_file_name: string | null;
  original_answer_text: string | null;
  answer_text: string | null;
  ai_corrected_text: string | null;
  ai_feedback: string | null;
  ai_grammar_notes: string | null;
  ai_expression_notes: string | null;
  attachments: AttachmentRow[] | null;
  quiz_answers: QuizAnswerRow[] | null;
};

type QuizAnswerRow = {
  id: string;
  question_id: string;
  question_text: string;
  selected_choice_id: string | null;
  selected_choice_label: string | null;
  selected_choice_text: string | null;
  correct_choice_label: string | null;
  correct_choice_text: string | null;
  incorrect_reason: string | null;
  is_correct: boolean | null;
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

type VocabularyRow = {
  id: string;
  word: string;
  meaning: string;
  order_index: number;
  original_answer_text: string | null;
  ai_corrected_text: string | null;
  ai_feedback: string | null;
  ai_grammar_notes: string | null;
  revised_answer_text: string | null;
  teacher_comment: string | null;
  status: string | null;
};

export type TeacherSubmissionDetail = {
  submissionId: string;
  student: {
    id: string;
    name: string;
    schoolName?: string;
    grade?: string;
    classNames: string[];
  };
  assignment: {
    id: string;
    title: string;
    assignmentType: string;
  };
  items: Array<{
    assignmentItemId: string;
    assignmentPartId?: string;
    partType?: string;
    title?: string;
    passageText?: string;
    audioUrl?: string;
    recordingUrl?: string;
    recordingDurationSec?: number;
    recordingFileName?: string;
    writingMode?: string;
    writingUnit?: string;
    writingUnitCount?: number;
    promptText?: string;
    originalAnswerText?: string;
    answerText?: string;
    aiCorrectedText?: string;
    aiFeedback?: string;
    aiGrammarNotes?: string;
    aiExpressionNotes?: string;
    attachments?: Array<{
      id: string;
      submissionItemId: string;
      submissionId: string;
      assignmentItemId?: string;
      attachmentType: "image" | "audio" | "video" | "file";
      storageBucket: string;
      storagePath: string;
      fileUrl?: string;
      fileName?: string;
      mimeType?: string;
      fileSizeBytes?: number;
      durationSec?: number;
      widthPx?: number;
      heightPx?: number;
      orderIndex: number;
    }>;
    quizAnswers?: QuizAnswerRow[];
  }>;
  vocabularyItems: Array<{
    id: string;
    word: string;
    meaning: string;
    orderIndex: number;
    originalAnswerText?: string;
    aiCorrectedText?: string;
    aiFeedback?: string;
    aiGrammarNotes?: string;
    revisedAnswerText?: string;
    teacherComment?: string;
    status?: string;
  }>;
  status: string;
  submittedAt?: string;
  dueAt?: string;
  isLate: boolean;
  reviewedAt?: string;
  teacherComment?: string;
};

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

export async function getTeacherSubmissionDetail(
  teacherId: string,
  submissionId: string,
): Promise<TeacherSubmissionDetail | null> {
  const result = await query<SubmissionRow>(
    `
      select
        sub.id as submission_id,
        sub.status,
        at.reviewed as target_reviewed,
        tf.id as feedback_id,
        sub.submitted_at,
        sub.reviewed_at,
        coalesce(at.due_at, a.due_at) as due_at,
        coalesce(sub.teacher_comment, tf.comment) as teacher_comment,
        s.id as student_id,
        s.name as student_name,
        s.school_name,
        s.grade,
        coalesce(array_remove(array_agg(distinct c.name), null), array[]::text[]) as class_names,
        a.id as assignment_id,
        a.title as assignment_title,
        a.assignment_type,
        si.id as submission_item_id,
        ai.id as assignment_item_id,
        ap.id as assignment_part_id,
        ap.part_type,
        ap.title as part_title,
        ap.script_text as part_script_text,
        ai.title as item_title,
        ai.passage_text,
        ai.writing_mode,
        ai.writing_unit,
        ai.writing_unit_count,
        ai.prompt_text,
        ai.audio_url,
        ai.audio_storage_path,
        si.recording_url,
        si.recording_storage_path,
        si.recording_duration_sec,
        si.recording_file_name,
        si.original_answer_text,
        si.answer_text,
        si.ai_corrected_text,
        si.ai_feedback,
        si.ai_grammar_notes,
        si.ai_expression_notes,
        coalesce(
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
        ) as attachments,
        coalesce(
          (
            select json_agg(
              json_build_object(
                'id', sqa.id,
                'question_id', aqq.id,
                'question_text', aqq.question_text,
                'selected_choice_id', sqa.selected_choice_id,
                'selected_choice_label', selected.choice_label,
                'selected_choice_text', selected.choice_text,
                'correct_choice_label', correct.choice_label,
                'correct_choice_text', correct.choice_text,
                'incorrect_reason', selected.incorrect_reason,
                'is_correct', sqa.is_correct
              )
              order by aqq.order_index
            )
            from submission_quiz_answers sqa
            join assignment_quiz_questions aqq on aqq.id = sqa.question_id
            left join assignment_quiz_choices selected on selected.id = sqa.selected_choice_id
            left join assignment_quiz_choices correct on correct.question_id = aqq.id and correct.is_correct = true
            where sqa.submission_item_id = si.id
          ),
          '[]'::json
        ) as quiz_answers
      from submissions sub
      join students s on s.id = sub.student_id
      join assignments a on a.id = sub.assignment_id and a.teacher_id = $2
      left join assignment_targets at
        on at.id = sub.assignment_target_id
        or (at.assignment_id = sub.assignment_id and at.student_id = sub.student_id)
      left join submission_items si on si.submission_id = sub.id
      left join assignment_items ai on ai.id = si.assignment_item_id
      left join assignment_parts ap on ap.id = si.assignment_part_id
      left join teacher_feedback tf on tf.submission_id = sub.id and tf.teacher_id = a.teacher_id
      left join class_memberships cm on cm.student_id = s.id
      left join classes c on c.id = cm.class_id and c.teacher_id = a.teacher_id and c.status = 'active'
      where sub.id = $1
      group by sub.id, at.reviewed, at.due_at, a.due_at, tf.id, tf.comment, s.id, a.id, ai.id, ap.id, si.id
      order by coalesce(ap.order_index, ai.order_index)
    `,
    [submissionId, teacherId],
  );

  const first = result.rows[0];
  if (!first) return null;
  const detailStatus = first.status === "returned"
    ? "returned"
    : first.status === "reviewed" || first.target_reviewed || first.feedback_id
      ? "reviewed"
      : first.status;

  const vocabularyResult = await query<VocabularyRow>(
    `
      select
        avi.id,
        avi.word,
        avi.meaning,
        avi.order_index,
        svi.original_answer_text,
        svi.ai_corrected_text,
        svi.ai_feedback,
        svi.ai_grammar_notes,
        svi.revised_answer_text,
        svi.teacher_comment,
        svi.status
      from assignment_vocabulary_items avi
      left join submission_vocabulary_items svi
        on svi.assignment_vocabulary_item_id = avi.id
       and svi.submission_id = $1
      where avi.assignment_id = $2
      order by avi.order_index
    `,
    [submissionId, first.assignment_id],
  );

  const rowsWithItems = result.rows.filter((row) => row.submission_item_id);

  return {
    submissionId: first.submission_id,
    student: {
      id: first.student_id,
      name: first.student_name,
      schoolName: first.school_name ?? undefined,
      grade: first.grade ?? undefined,
      classNames: first.class_names ?? [],
    },
    assignment: {
      id: first.assignment_id,
      title: first.assignment_title,
      assignmentType: normalizeAssignmentType(first.assignment_type),
    },
    items: await Promise.all(rowsWithItems.map(async (row) => ({
      assignmentItemId: (row.assignment_item_id ?? row.assignment_part_id ?? row.submission_item_id) as string,
      assignmentPartId: row.assignment_part_id ?? undefined,
      partType: row.part_type ?? undefined,
      title: row.item_title ?? row.part_title ?? undefined,
      passageText: row.passage_text ?? row.part_script_text ?? undefined,
      writingMode: row.writing_mode ?? undefined,
      writingUnit: row.writing_unit ?? undefined,
      writingUnitCount: row.writing_unit_count ?? undefined,
      promptText: row.prompt_text ?? undefined,
      audioUrl: ((await signedUrl(storageBuckets.audio, row.audio_storage_path)) || row.audio_url) ?? undefined,
      recordingUrl: ((await signedUrl(storageBuckets.audio, row.recording_storage_path)) || row.recording_url) ?? undefined,
      recordingDurationSec: row.recording_duration_sec ?? undefined,
      recordingFileName: row.recording_file_name ?? undefined,
      originalAnswerText: row.original_answer_text ?? undefined,
      answerText: row.answer_text ?? undefined,
      aiCorrectedText: row.ai_corrected_text ?? undefined,
      aiFeedback: row.ai_feedback ?? undefined,
      aiGrammarNotes: row.ai_grammar_notes ?? undefined,
      aiExpressionNotes: row.ai_expression_notes ?? undefined,
      attachments: await Promise.all((row.attachments ?? []).map(mapAttachment)),
      quizAnswers: row.quiz_answers ?? [],
    }))),
    vocabularyItems: vocabularyResult.rows.map((row) => ({
      id: row.id,
      word: row.word,
      meaning: row.meaning,
      orderIndex: row.order_index,
      originalAnswerText: row.original_answer_text ?? undefined,
      aiCorrectedText: row.ai_corrected_text ?? undefined,
      aiFeedback: row.ai_feedback ?? undefined,
      aiGrammarNotes: row.ai_grammar_notes ?? undefined,
      revisedAnswerText: row.revised_answer_text ?? undefined,
      teacherComment: row.teacher_comment ?? undefined,
      status: row.status ?? undefined,
    })),
    status: detailStatus,
    submittedAt: first.submitted_at?.toISOString(),
    dueAt: first.due_at?.toISOString(),
    isLate: Boolean(first.submitted_at && first.due_at && first.submitted_at.getTime() > first.due_at.getTime()),
    reviewedAt: first.reviewed_at?.toISOString(),
    teacherComment: first.teacher_comment ?? undefined,
  };
}
