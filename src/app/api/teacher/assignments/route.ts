import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";

import { postgresPool, query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireTeacherSession } from "@/server/teacher/session";
import { isSupportedAssignmentType, itemTypeForAssignmentType, normalizeAssignmentType } from "@/lib/assignmentTypes";

export const runtime = "nodejs";

const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AUDIO_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = "png, jpg, jpeg, gif, webp, heic, heif, bmp, tif, tiff, svg";
const SUPPORTED_AUDIO_EXTENSIONS = "mp3, m4a, wav, webm, ogg, oga, aac, aif, aiff, caf, flac, amr";

type StorageBucketOptions = {
  fileSizeLimit: number;
  allowedMimeTypes: string[];
};

type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  assignment_type: string;
  image_url: string | null;
  image_storage_path: string | null;
  image_file_name: string | null;
  status: string;
  item_id: string | null;
  item_type: string | null;
  passage_title: string | null;
  passage_text: string | null;
  audio_url: string | null;
  audio_storage_path: string | null;
  audio_file_name: string | null;
  min_recording_sec: number | null;
  max_recording_sec: number | null;
  writing_mode: string | null;
  writing_unit: string | null;
  writing_unit_count: number | null;
  prompt_text: string | null;
  writing_instructions: string | null;
  writing_hint: string | null;
  writing_example: string | null;
  vocabulary_items: Array<{
    id: string;
    assignment_id: string;
    assignment_part_id: string | null;
    word: string;
    meaning: string;
    order_index: number;
  }> | null;
  parts: AssignmentPartRow[] | null;
  updated_at: Date;
};

type AssignmentPartRow = {
  id: string;
  assignment_id: string;
  part_type: string;
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
  archived_at: string | null;
  archived_reason: string | null;
  attachments: AssignmentPartAttachmentRow[] | null;
  vocabulary_items: AssignmentVocabularyItemRow[] | null;
  quiz_questions: QuizQuestionRow[] | null;
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

type QuizQuestionInput = {
  id?: string;
  questionText: string;
  explanation?: string | null;
  orderIndex: number;
  choices: QuizChoiceInput[];
};

type QuizChoiceInput = {
  id?: string;
  choiceLabel: string;
  choiceText: string;
  isCorrect: boolean;
  incorrectReason?: string | null;
  orderIndex: number;
};

type AssignmentVocabularyItemRow = {
  id: string;
  assignment_id: string;
  assignment_part_id: string | null;
  word: string;
  meaning: string;
  order_index: number;
};

type AssignmentPartAttachmentRow = {
  id: string;
  assignment_part_id: string;
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

type AssignmentPartInput = {
  id?: string;
  partType: string;
  instructionKind: "general" | "grading" | "other";
  title: string;
  instruction: string;
  scriptText: string;
  writingMode?: string | null;
  writingUnit?: string | null;
  writingHint?: string | null;
  writingExample?: string | null;
  vocabularyRows?: Array<{ word: string; meaning: string; orderIndex: number }>;
  quizQuestions?: QuizQuestionInput[];
  isRequired: boolean;
  allowSubmission: boolean;
  minSubmissionCount: number;
  maxSubmissionCount: number;
  orderIndex: number;
};

type SyncedAssignmentPart = {
  id: string;
  orderIndex: number;
};

type PartFilesByIndex = Map<number, { imageFiles: File[]; audioFiles: File[] }>;
type QuizQuestionFilesByKey = Map<string, { imageFiles: File[]; audioFiles: File[] }>;

type AssignmentTargetInput = {
  classId: string;
  classSubjectId?: string;
  dueDate: string;
  dueTime: string;
  visibility: "draft" | "published";
  targetMode: "all" | "partial";
  selectedStudents: string[];
};

type StudentTargetRow = {
  id: string;
};

type ClassTargetRow = {
  id: string;
  student_count: number;
};

type AssignmentListRow = {
  id: string;
  title: string;
  description: string | null;
  assignment_type: string;
  assignment_part_types: string[] | null;
  status: string;
  subject_names: string[] | null;
  class_names: string[] | null;
  class_summaries: Array<{
    classId: string;
    className: string;
    subjectId: string | null;
    subjectName: string | null;
    dueAt: string | null;
    targetCount: number;
    submittedCount: number;
    studentNames: string[];
  }> | null;
  target_count: number;
  submitted_count: number;
  due_at: Date | null;
  updated_at: Date;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || `${randomUUID()}`;
}

function fileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function fileDebugInfo(file: File) {
  return `파일명: ${file.name}, 확장자: ${fileExtension(file.name) || "없음"}, 브라우저 파일 타입: ${file.type || "없음"}, 용량: ${(file.size / 1024 / 1024).toFixed(1)}MB`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?|svg)$/i.test(file.name);
}

function isAudioFile(file: File) {
  return file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg|oga|aac|aiff?|caf|flac|amr)$/i.test(file.name);
}

function imageContentType(file: File) {
  if (file.type) return file.type;
  if (/\.heic$/i.test(file.name)) return "image/heic";
  if (/\.heif$/i.test(file.name)) return "image/heif";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  if (/\.gif$/i.test(file.name)) return "image/gif";
  if (/\.bmp$/i.test(file.name)) return "image/bmp";
  if (/\.tiff?$/i.test(file.name)) return "image/tiff";
  if (/\.svg$/i.test(file.name)) return "image/svg+xml";
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  return "image/png";
}

function audioContentType(file: File) {
  if (file.type) return file.type;
  if (/\.m4a$/i.test(file.name)) return "audio/mp4";
  if (/\.aac$/i.test(file.name)) return "audio/aac";
  if (/\.wav$/i.test(file.name)) return "audio/wav";
  if (/\.webm$/i.test(file.name)) return "audio/webm";
  if (/\.og[ag]?$/i.test(file.name)) return "audio/ogg";
  if (/\.aiff?$/i.test(file.name)) return "audio/aiff";
  if (/\.caf$/i.test(file.name)) return "audio/x-caf";
  if (/\.flac$/i.test(file.name)) return "audio/flac";
  if (/\.amr$/i.test(file.name)) return "audio/amr";
  return "audio/mpeg";
}

function storageErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function databaseErrorPayload(error: unknown) {
  const pgError = error as {
    message?: unknown;
    code?: unknown;
    detail?: unknown;
    hint?: unknown;
    constraint?: unknown;
    table?: unknown;
    column?: unknown;
  };
  return {
    error: `과제 저장 중 오류가 발생했습니다: ${storageErrorMessage(error)}`,
    code: typeof pgError.code === "string" ? pgError.code : undefined,
    detail: typeof pgError.detail === "string" ? pgError.detail : undefined,
    hint: typeof pgError.hint === "string" ? pgError.hint : undefined,
    constraint: typeof pgError.constraint === "string" ? pgError.constraint : undefined,
    table: typeof pgError.table === "string" ? pgError.table : undefined,
    column: typeof pgError.column === "string" ? pgError.column : undefined,
  };
}

function isMissingBucketError(error: { status?: number; message?: string } | null) {
  return error?.status === 404 || /bucket.*not found|not found|does not exist/i.test(error?.message ?? "");
}

function supportsMimeType(allowedMimeTypes: string[] | undefined, mimeTypes: string[]) {
  if (!allowedMimeTypes || allowedMimeTypes.length === 0) return true;
  return mimeTypes.some((mimeType) => {
    const [type] = mimeType.split("/");
    return allowedMimeTypes.includes(mimeType) || allowedMimeTypes.includes(`${type}/*`);
  });
}

async function ensureStorageBucket(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  options: StorageBucketOptions,
) {
  const current = await supabase.storage.getBucket(bucket);

  if (current.error) {
    if (!isMissingBucketError(current.error)) {
      throw new Error(`Storage bucket check failed (${bucket}): ${current.error.message}`);
    }

    const created = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: options.fileSizeLimit,
      allowedMimeTypes: options.allowedMimeTypes,
    });

    if (created.error && created.error.status !== 409) {
      throw new Error(`Storage bucket create failed (${bucket}): ${created.error.message}`);
    }
    return;
  }

  const fileSizeLimit = current.data.file_size_limit ?? 0;
  const needsFileSizeUpdate = fileSizeLimit > 0 && fileSizeLimit < options.fileSizeLimit;
  const needsMimeUpdate = !supportsMimeType(current.data.allowed_mime_types, options.allowedMimeTypes);

  if (!needsFileSizeUpdate && !needsMimeUpdate) return;

  const updated = await supabase.storage.updateBucket(bucket, {
    public: current.data.public,
    fileSizeLimit: needsFileSizeUpdate ? options.fileSizeLimit : current.data.file_size_limit,
    allowedMimeTypes: needsMimeUpdate ? options.allowedMimeTypes : current.data.allowed_mime_types,
  });

  if (updated.error) {
    throw new Error(`Storage bucket update failed (${bucket}): ${updated.error.message}`);
  }
}

async function signedUrl(bucket: string, path: string | null) {
  if (!path) return "";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

async function mapPartAttachment(attachment: AssignmentPartAttachmentRow) {
  return {
    id: attachment.id,
    assignmentPartId: attachment.assignment_part_id,
    attachmentType: attachment.attachment_type,
    storageBucket: attachment.storage_bucket,
    storagePath: attachment.storage_path,
    fileUrl: (await signedUrl(attachment.storage_bucket, attachment.storage_path)) || attachment.file_url || "",
    fileName: attachment.file_name ?? "",
    mimeType: attachment.mime_type ?? "",
    fileSizeBytes: attachment.file_size_bytes ?? undefined,
    durationSec: attachment.duration_sec ?? undefined,
    widthPx: attachment.width_px ?? undefined,
    heightPx: attachment.height_px ?? undefined,
    orderIndex: attachment.order_index,
  };
}

async function mapQuizQuestionAttachment(attachment: QuizQuestionAttachmentRow) {
  return {
    id: attachment.id,
    questionId: attachment.question_id,
    attachmentType: attachment.attachment_type,
    storageBucket: attachment.storage_bucket,
    storagePath: attachment.storage_path,
    fileUrl: (await signedUrl(attachment.storage_bucket, attachment.storage_path)) || attachment.file_url || "",
    fileName: attachment.file_name ?? "",
    mimeType: attachment.mime_type ?? "",
    fileSizeBytes: attachment.file_size_bytes ?? undefined,
    durationSec: attachment.duration_sec ?? undefined,
    widthPx: attachment.width_px ?? undefined,
    heightPx: attachment.height_px ?? undefined,
    orderIndex: attachment.order_index,
  };
}

async function mapQuizQuestion(question: QuizQuestionRow) {
  return {
    id: question.id,
    assignmentPartId: question.assignment_part_id,
    questionText: question.question_text,
    explanation: question.explanation ?? "",
    orderIndex: question.order_index,
    choices: (question.choices ?? []).map((choice) => ({
      id: choice.id,
      questionId: choice.question_id,
      choiceLabel: choice.choice_label ?? "",
      choiceText: choice.choice_text,
      isCorrect: choice.is_correct,
      incorrectReason: choice.incorrect_reason ?? "",
      orderIndex: choice.order_index,
    })),
    attachments: await Promise.all((question.attachments ?? []).map(mapQuizQuestionAttachment)),
  };
}

async function mapAssignment(row: AssignmentRow) {
  const activeParts = (row.parts ?? []).filter((part) => part.status !== "archived");
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    type: normalizeAssignmentType(row.assignment_type),
    status: row.status,
    imageUrl: (await signedUrl(storageBuckets.images, row.image_storage_path)) || row.image_url || "",
    imageStoragePath: row.image_storage_path ?? undefined,
    imageFileName: row.image_file_name ?? undefined,
    item: {
      id: row.item_id,
      type: itemTypeForAssignmentType(row.assignment_type),
      title: row.passage_title ?? "",
      passageText: row.passage_text ?? "",
      audioUrl: (await signedUrl(storageBuckets.audio, row.audio_storage_path)) || row.audio_url || "",
      audioStoragePath: row.audio_storage_path ?? undefined,
      audioFileName: row.audio_file_name ?? "",
      minRecordingSec: String(row.min_recording_sec ?? 0),
      maxRecordingSec: String(row.max_recording_sec ?? 120),
      writingMode: row.writing_mode ?? undefined,
      writingUnit: row.writing_unit ?? undefined,
      writingUnitCount: row.writing_unit_count ?? 4,
      promptText: row.prompt_text ?? "",
      writingInstructions: row.writing_instructions ?? "",
      writingHint: row.writing_hint ?? "",
      writingExample: row.writing_example ?? "",
    },
    vocabularyItems: (row.vocabulary_items ?? []).map((item) => ({
      id: item.id,
      assignmentId: item.assignment_id,
      assignmentPartId: item.assignment_part_id ?? undefined,
      word: item.word,
      meaning: item.meaning,
      orderIndex: item.order_index,
    })),
    partTypes: Array.from(new Set(activeParts.map((part) => part.part_type))),
    parts: await Promise.all((row.parts ?? []).map(async (part) => ({
      id: part.id,
      assignmentId: part.assignment_id,
      partType: part.part_type,
      instructionKind: part.instruction_kind,
      title: part.title ?? "",
      instruction: part.instruction ?? "",
      scriptText: part.script_text ?? "",
      writingMode: part.writing_mode ?? undefined,
      writingUnit: part.writing_unit ?? undefined,
      writingHint: part.writing_hint ?? "",
      writingExample: part.writing_example ?? "",
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
      archivedAt: part.archived_at ?? undefined,
      archivedReason: part.archived_reason ?? undefined,
      attachments: await Promise.all((part.attachments ?? []).map(mapPartAttachment)),
      quizQuestions: await Promise.all((part.quiz_questions ?? []).map(mapQuizQuestion)),
    }))),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function getAssignmentRow(id: string, teacherId: string) {
  const result = await query<AssignmentRow>(
    `
      select
        a.id,
        a.title,
        a.description,
        a.assignment_type,
        a.image_url,
        a.image_storage_path,
        a.image_file_name,
        a.status,
        ai.id as item_id,
        ai.item_type,
        ai.title as passage_title,
        ai.passage_text,
        ai.audio_url,
        ai.audio_storage_path,
        ai.audio_file_name,
        ai.min_recording_sec,
        ai.max_recording_sec,
        ai.writing_mode,
        ai.writing_unit,
        ai.writing_unit_count,
        ai.prompt_text,
        ai.writing_instructions,
        ai.writing_hint,
        ai.writing_example,
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
                'archived_at', ap.archived_at,
                'archived_reason', ap.archived_reason,
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
                        'mime_type', apa.mime_type,
                        'file_size_bytes', apa.file_size_bytes,
                        'duration_sec', apa.duration_sec,
                        'width_px', apa.width_px,
                        'height_px', apa.height_px,
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
          ),
          '[]'::json
        ) as parts,
        a.updated_at
      from assignments a
      left join assignment_items ai on ai.assignment_id = a.id and ai.order_index = 1
      where a.id = $1 and a.teacher_id = $2
      limit 1
    `,
    [id, teacherId],
  );

  return result.rows[0] ?? null;
}

export async function GET(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    const result = await query<AssignmentListRow>(
      `
        with class_summary as (
          select
            at.assignment_id,
            at.class_id,
            at.class_subject_id,
            csu.name as subject_name,
            coalesce(c.name, '미지정 반') as class_name,
            count(distinct at.student_id)::int as target_count,
            count(distinct at.student_id) filter (where at.status in ('submitted', 'late'))::int as submitted_count,
            min(at.due_at) as due_at
            ,
            coalesce(
              array_remove(array_agg(distinct s.name order by s.name), null),
              array[]::text[]
            ) as student_names
          from assignment_targets at
          join assignments a on a.id = at.assignment_id
          left join classes c on c.id = at.class_id and c.teacher_id = a.teacher_id and c.status = 'active'
          left join class_subjects csu on csu.id = at.class_subject_id and csu.teacher_id = a.teacher_id
          left join students s on s.id = at.student_id and s.teacher_id = a.teacher_id
          where a.teacher_id = $1
            and at.status <> 'cancelled'
            and (at.class_id is null or c.id is not null)
          group by at.assignment_id, at.class_id, c.name, at.class_subject_id, csu.name
        )
        select
          a.id,
          a.title,
          a.description,
          a.assignment_type,
          coalesce(
            (
              select array_agg(part_types.part_type order by part_types.first_order)
              from (
                select ap.part_type, min(ap.order_index) as first_order
                from assignment_parts ap
                where ap.assignment_id = a.id
                  and ap.status = 'active'
                group by ap.part_type
              ) part_types
            ),
            array[]::text[]
          ) as assignment_part_types,
          a.status,
          coalesce(array_remove(array_agg(distinct cs.subject_name), null), array[]::text[]) as subject_names,
          coalesce(array_remove(array_agg(distinct cs.class_name), null), array[]::text[]) as class_names,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'classId', cs.class_id,
                'className', cs.class_name,
                'subjectId', cs.class_subject_id,
                'subjectName', cs.subject_name,
                'dueAt', cs.due_at,
                'targetCount', cs.target_count,
                'submittedCount', cs.submitted_count,
                'studentNames', cs.student_names
              )
              order by cs.class_name
            ) filter (where cs.class_id is not null),
            '[]'::jsonb
          ) as class_summaries,
          coalesce(sum(cs.target_count), 0)::int as target_count,
          coalesce(sum(cs.submitted_count), 0)::int as submitted_count,
          coalesce(min(cs.due_at), a.due_at) as due_at,
          a.updated_at
        from assignments a
        left join class_summary cs on cs.assignment_id = a.id
        where a.teacher_id = $1
        group by a.id
        order by a.updated_at desc
      `,
      [teacherId],
    );

    return NextResponse.json({
      assignments: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? "",
        assignmentType: normalizeAssignmentType(row.assignment_type),
        assignmentTypes: row.assignment_part_types?.length ? row.assignment_part_types : [normalizeAssignmentType(row.assignment_type)],
        assignmentSubject: (row.subject_names ?? []).join(", "),
        assignmentSubjects: row.subject_names ?? [],
        status: row.status,
        classNames: row.class_names ?? [],
        classSummaries: row.class_summaries ?? [],
        targetCount: row.target_count,
        submittedCount: row.submitted_count,
        unsubmittedCount: Math.max(row.target_count - row.submitted_count, 0),
        dueAt: row.due_at?.toISOString() ?? null,
        updatedAt: row.updated_at.toISOString(),
      })),
    });
  }

  const row = await getAssignmentRow(id, teacherId);
  return NextResponse.json({ assignment: row ? await mapAssignment(row) : null });
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const formData = await request.formData();
  const id = String(formData.get("id") ?? "").trim() || `assignment-${randomUUID()}`;
  const title = String(formData.get("title") ?? "").trim();
  const rawType = String(formData.get("type") ?? "listening_recording").trim();
  if (!isSupportedAssignmentType(rawType)) {
    return NextResponse.json({ error: "지원하지 않는 숙제 유형입니다." }, { status: 400 });
  }
  const type = rawType;
  const description = String(formData.get("description") ?? "").trim();
  const passageTitle = String(formData.get("passageTitle") ?? "").trim();
  const rawPassageText = String(formData.get("passageText") ?? "").trim();
  const minRecordingSec = Number(formData.get("minRecordingSec") ?? 0);
  const maxRecordingSec = Number(formData.get("maxRecordingSec") ?? 120);
  const writingMode = String(formData.get("writingMode") ?? "").trim() || null;
  const writingUnit = String(formData.get("writingUnit") ?? "").trim() || null;
  const writingUnitCount = Number(formData.get("writingUnitCount") ?? 4);
  const promptText = String(formData.get("promptText") ?? "").trim();
  const writingInstructions = String(formData.get("writingInstructions") ?? "").trim();
  const writingHint = String(formData.get("writingHint") ?? "").trim();
  const writingExample = String(formData.get("writingExample") ?? "").trim();
  const passageText = type === "writing" && promptText ? promptText : rawPassageText;
  const vocabularyItems = parseVocabularyItems(formData.get("vocabularyItems"));
  const parts = parseAssignmentParts(formData.get("parts"), type, {
    title: passageTitle,
    instruction: description,
    scriptText: passageText,
  });
  const imageFile = formData.get("imageFile");
  const audioFile = formData.get("audioFile");
  const partFiles = parsePartFiles(formData);
  const quizQuestionFiles = parseQuizQuestionFiles(formData);
  const targetAssignments = parseTargetAssignments(formData.get("assignments"));

  if (!title) {
    return NextResponse.json({ error: "과제 제목을 입력해 주세요." }, { status: 400 });
  }
  const hasVocabularyPart = parts.some((part) => part.partType === "vocabulary_example" || part.partType === "vocabulary_recording");
  const hasPartVocabularyRows = parts.some((part) => (part.vocabularyRows ?? []).length > 0);
  if (hasVocabularyPart && !hasPartVocabularyRows && vocabularyItems.length === 0) {
      return NextResponse.json({ error: "단어를 1개 이상 입력해주세요." }, { status: 400 });
  }
  for (const [partIndex, part] of parts.entries()) {
    if (part.partType !== "quiz") continue;
    if (!part.quizQuestions || part.quizQuestions.length === 0) {
      return NextResponse.json({ error: `Part ${partIndex + 1}: 퀴즈 문제를 1개 이상 추가해주세요.` }, { status: 400 });
    }
    for (const [questionIndex, question] of part.quizQuestions.entries()) {
      if (question.choices.length < 2) {
        return NextResponse.json({ error: `Part ${partIndex + 1} Q${questionIndex + 1}: 선택지를 2개 이상 추가해주세요.` }, { status: 400 });
      }
      if (question.choices.filter((choice) => choice.isCorrect).length !== 1) {
        return NextResponse.json({ error: `Part ${partIndex + 1} Q${questionIndex + 1}: 정답 선택지를 정확히 1개 선택해주세요.` }, { status: 400 });
      }
    }
  }

  const existingUploadResult = await query<{
    image_storage_path: string | null;
    audio_storage_path: string | null;
  }>(
    `
      select a.image_storage_path, ai.audio_storage_path
      from assignments a
      left join assignment_items ai on ai.assignment_id = a.id and ai.order_index = 1
      where a.id = $1 and a.teacher_id = $2
      limit 1
    `,
    [id, teacherId],
  );
  const existingImageStoragePath = existingUploadResult.rows[0]?.image_storage_path ?? null;
  const existingAudioStoragePath = existingUploadResult.rows[0]?.audio_storage_path ?? null;

  const supabase = createSupabaseAdminClient();
  let imageUrl: string | null = null;
  let imageStoragePath: string | null = null;
  let imageFileName: string | null = null;
  let audioUrl: string | null = null;
  let audioStoragePath: string | null = null;
  let audioFileName: string | null = String(formData.get("audioFileName") ?? "").trim() || null;

  if (imageFile instanceof File) {
    if (!isImageFile(imageFile)) {
      return NextResponse.json({ error: `이미지 파일 형식을 확인해주세요.\n${fileDebugInfo(imageFile)}\n업로드 가능한 이미지 형식: ${SUPPORTED_IMAGE_EXTENSIONS}` }, { status: 400 });
    }
    if (imageFile.size > MAX_IMAGE_FILE_SIZE) {
      return NextResponse.json({ error: `이미지 파일 용량이 너무 큽니다.\n${fileDebugInfo(imageFile)}\n이미지는 1개당 최대 10MB까지 업로드할 수 있습니다.` }, { status: 400 });
    }
    imageFileName = safeFileName(imageFile.name);
    imageStoragePath = `assignments/${id}/images/${imageFileName}`;
    try {
      await ensureStorageBucket(supabase, storageBuckets.images, {
        fileSizeLimit: MAX_IMAGE_FILE_SIZE,
        allowedMimeTypes: ["image/*"],
      });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: `이미지 저장소 준비 실패: ${storageErrorMessage(error)}` }, { status: 500 });
    }
    const { error } = await supabase.storage.from(storageBuckets.images).upload(
      imageStoragePath,
      Buffer.from(await imageFile.arrayBuffer()),
      { contentType: imageContentType(imageFile), upsert: true },
    );

    if (error) {
      console.error({ bucket: storageBuckets.images, path: imageStoragePath, error });
      return NextResponse.json({ error: `이미지 업로드 실패: ${error.message}` }, { status: 500 });
    }

    imageUrl = supabase.storage.from(storageBuckets.images).getPublicUrl(imageStoragePath).data.publicUrl;
  }

  if (audioFile instanceof File) {
    if (!isAudioFile(audioFile)) {
      return NextResponse.json({ error: `오디오 파일 형식을 확인해주세요.\n${fileDebugInfo(audioFile)}\n업로드 가능한 오디오 형식: ${SUPPORTED_AUDIO_EXTENSIONS}` }, { status: 400 });
    }
    if (audioFile.size > MAX_AUDIO_FILE_SIZE) {
      return NextResponse.json({ error: `오디오 파일 용량이 너무 큽니다.\n${fileDebugInfo(audioFile)}\n오디오는 1개당 최대 10MB까지 업로드할 수 있습니다.` }, { status: 400 });
    }
    audioFileName = safeFileName(audioFile.name);
    audioStoragePath = `assignments/${id}/audio/${audioFileName}`;
    try {
      await ensureStorageBucket(supabase, storageBuckets.audio, {
        fileSizeLimit: MAX_AUDIO_FILE_SIZE,
        allowedMimeTypes: ["audio/*", "application/octet-stream"],
      });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: `오디오 저장소 준비 실패: ${storageErrorMessage(error)}` }, { status: 500 });
    }
    const { error } = await supabase.storage.from(storageBuckets.audio).upload(
      audioStoragePath,
      Buffer.from(await audioFile.arrayBuffer()),
      { contentType: audioContentType(audioFile), upsert: true },
    );

    if (error) {
      console.error({ bucket: storageBuckets.audio, path: audioStoragePath, error });
      return NextResponse.json({ error: `오디오 업로드 실패: ${error.message}` }, { status: 500 });
    }

    audioUrl = supabase.storage.from(storageBuckets.audio).getPublicUrl(audioStoragePath).data.publicUrl;
  }

  const client = await postgresPool.connect();
  let assignedCount = 0;
  const classCounts: Array<{ classId: string; selectedCount: number }> = [];

  try {
    await client.query("begin");

    const firstTarget = targetAssignments[0];
    const assignmentStatus = targetAssignments.length > 0
      ? (targetAssignments.some((item) => item.visibility === "published") ? "published" : "draft")
      : "draft";
    const assignmentDueAt = firstTarget ? toDueAt(firstTarget.dueDate, firstTarget.dueTime) : null;
    const assignmentClassId = targetAssignments.length === 1 ? targetAssignments[0].classId : null;

    for (const targetAssignment of targetAssignments) {
      const classResult = await client.query<ClassTargetRow>(
        `
          select c.id, count(distinct s.id)::int as student_count
          from classes c
          left join class_memberships cm on cm.class_id = c.id
          left join students s on s.id = cm.student_id and s.teacher_id = c.teacher_id and s.status = 'active'
          where c.id = $1 and c.teacher_id = $2 and c.status = 'active'
          group by c.id
        `,
        [targetAssignment.classId, teacherId],
      );
      const classRow = classResult.rows[0];
      if (!classRow) {
        await client.query("rollback");
        return NextResponse.json({ error: "선택한 반을 찾을 수 없습니다." }, { status: 400 });
      }
      if (targetAssignment.targetMode === "all" && classRow.student_count === 0) {
        await client.query("rollback");
        return NextResponse.json({ error: "선택한 반에 배정할 학생이 없습니다." }, { status: 400 });
      }
      if (targetAssignment.targetMode === "partial" && targetAssignment.selectedStudents.length === 0) {
        await client.query("rollback");
        return NextResponse.json({ error: "일부 학생 배정은 학생을 최소 1명 선택해야 합니다." }, { status: 400 });
      }
      const subjectResult = await client.query<{ id: string }>(
        `
          select id
          from class_subjects
          where id = $1
            and class_id = $2
            and teacher_id = $3
            and status = 'active'
          limit 1
        `,
        [targetAssignment.classSubjectId ?? "", targetAssignment.classId, teacherId],
      );
      if (!subjectResult.rows[0]) {
        await client.query("rollback");
        return NextResponse.json({ error: "선택한 반 과목을 찾을 수 없습니다." }, { status: 400 });
      }
    }

    await client.query(
      `
        insert into assignments (
          id, teacher_id, class_id, title, description, assignment_type,
          image_url, image_storage_path, image_file_name, due_at, status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (id)
        do update set
          class_id = excluded.class_id,
          title = excluded.title,
          description = excluded.description,
          assignment_type = excluded.assignment_type,
          image_url = coalesce(excluded.image_url, assignments.image_url),
          image_storage_path = coalesce(excluded.image_storage_path, assignments.image_storage_path),
          image_file_name = coalesce(excluded.image_file_name, assignments.image_file_name),
          due_at = coalesce(excluded.due_at, assignments.due_at),
          status = excluded.status,
          updated_at = now()
      `,
      [id, teacherId, assignmentClassId, title, description || null, type, imageUrl, imageStoragePath, imageFileName, assignmentDueAt, assignmentStatus],
    );

    await client.query(
      `
        insert into assignment_items (
          id, assignment_id, item_type, title, passage_text, audio_url, audio_storage_path,
          audio_file_name, order_index, min_recording_sec, max_recording_sec,
          writing_mode, writing_unit, writing_unit_count, prompt_text,
          writing_instructions, writing_hint, writing_example
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        on conflict (assignment_id, order_index)
        do update set
          item_type = excluded.item_type,
          title = excluded.title,
          passage_text = excluded.passage_text,
          audio_url = coalesce(excluded.audio_url, assignment_items.audio_url),
          audio_storage_path = coalesce(excluded.audio_storage_path, assignment_items.audio_storage_path),
          audio_file_name = coalesce(excluded.audio_file_name, assignment_items.audio_file_name),
          min_recording_sec = excluded.min_recording_sec,
          max_recording_sec = excluded.max_recording_sec,
          writing_mode = excluded.writing_mode,
          writing_unit = excluded.writing_unit,
          writing_unit_count = excluded.writing_unit_count,
          prompt_text = excluded.prompt_text,
          writing_instructions = excluded.writing_instructions,
          writing_hint = excluded.writing_hint,
          writing_example = excluded.writing_example,
          updated_at = now()
      `,
      [
        `${id}-item-1`,
        id,
        itemTypeForAssignmentType(type),
        passageTitle || null,
        passageText,
        audioUrl,
        audioStoragePath,
        audioFileName,
        Number.isFinite(minRecordingSec) ? minRecordingSec : 0,
        Number.isFinite(maxRecordingSec) ? maxRecordingSec : 120,
        type === "writing" && (writingMode === "picture_description" || writingMode === "topic_diary") ? writingMode : null,
        type === "writing" && (writingUnit === "paragraphs" || writingUnit === "sentences") ? writingUnit : null,
        type === "writing" && Number.isFinite(writingUnitCount) ? writingUnitCount : 4,
        type === "writing" ? promptText || null : null,
        type === "writing" ? writingInstructions || null : null,
        type === "writing" ? writingHint || null : null,
        type === "writing" ? writingExample || null : null,
      ],
    );

    const syncedParts = await syncAssignmentParts(client, id, parts);
    await syncAssignmentPartVocabularyItems(client, id, syncedParts, parts, vocabularyItems);
    await syncAssignmentPartFiles(client, supabase, id, syncedParts, partFiles);
    await syncQuizQuestions(client, supabase, id, syncedParts, parts, quizQuestionFiles);

    for (const targetAssignment of targetAssignments) {
      const dueAt = toDueAt(targetAssignment.dueDate, targetAssignment.dueTime);
      const students = await findTargetStudents(client, teacherId, targetAssignment);
      if (students.length === 0) {
        await client.query("rollback");
        return NextResponse.json({ error: "배정 대상 학생을 찾을 수 없습니다." }, { status: 400 });
      }
      classCounts.push({ classId: targetAssignment.classId, selectedCount: students.length });

      for (const student of students) {
        await client.query(
          `
            insert into assignment_targets (id, assignment_id, class_id, class_subject_id, student_id, status, due_at)
            values ($1, $2, $3, $4, $5, 'assigned', $6)
            on conflict (assignment_id, student_id)
            do update set
              class_id = excluded.class_id,
              class_subject_id = excluded.class_subject_id,
              due_at = excluded.due_at,
              status = case
                when assignment_targets.status in ('submitted', 'late') then assignment_targets.status
                else 'assigned'
              end,
              cancelled_at = null,
              cancelled_by = null,
              updated_at = now()
          `,
          [`target-${randomUUID()}`, id, targetAssignment.classId, targetAssignment.classSubjectId, student.id, dueAt],
        );
        assignedCount += 1;
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json(databaseErrorPayload(error), { status: 500 });
  } finally {
    client.release();
  }

  const row = await getAssignmentRow(id, teacherId);

  const staleFiles: Array<{ bucket: string; path: string }> = [];
  if (imageStoragePath && existingImageStoragePath && existingImageStoragePath !== imageStoragePath) {
    staleFiles.push({ bucket: storageBuckets.images, path: existingImageStoragePath });
  }
  if (audioStoragePath && existingAudioStoragePath && existingAudioStoragePath !== audioStoragePath) {
    staleFiles.push({ bucket: storageBuckets.audio, path: existingAudioStoragePath });
  }
  await Promise.all(staleFiles.map(async (file) => {
    const { error } = await supabase.storage.from(file.bucket).remove([file.path]);
    if (error) console.error(error);
  }));

  return NextResponse.json({
    assignment: row ? await mapAssignment(row) : null,
    uploaded: {
      image: Boolean(imageStoragePath),
      audio: Boolean(audioStoragePath),
    },
    assignedCount,
    classCounts,
  });
}

export async function DELETE(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "삭제할 과제를 찾을 수 없습니다." }, { status: 400 });
  }

  const client = await postgresPool.connect();
  let imageStoragePath: string | null = null;
  let audioStoragePath: string | null = null;

  try {
    await client.query("begin");

    const assignmentResult = await client.query<{
      id: string;
      image_storage_path: string | null;
      audio_storage_path: string | null;
      target_count: number;
      submission_count: number;
    }>(
      `
        select
          a.id,
          a.image_storage_path,
          ai.audio_storage_path,
          count(at.id) filter (where at.status <> 'cancelled')::int as target_count,
          count(distinct sub.id)::int as submission_count
        from assignments a
        left join assignment_items ai on ai.assignment_id = a.id
        left join assignment_targets at on at.assignment_id = a.id
        left join submissions sub on sub.assignment_id = a.id
        where a.id = $1 and a.teacher_id = $2
        group by a.id, a.image_storage_path, ai.audio_storage_path
        limit 1
      `,
      [id, teacherId],
    );
    const assignment = assignmentResult.rows[0];

    if (!assignment) {
      await client.query("rollback");
      return NextResponse.json({ error: "삭제할 과제를 찾을 수 없습니다." }, { status: 404 });
    }

    if (assignment.target_count > 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "이미 반이나 학생에게 배정된 과제는 삭제할 수 없습니다. 배정 관리에서 취소해주세요." }, { status: 409 });
    }
    if (assignment.submission_count > 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "학생 제출 기록이 있는 과제는 삭제할 수 없습니다." }, { status: 409 });
    }

    imageStoragePath = assignment.image_storage_path;
    audioStoragePath = assignment.audio_storage_path;

    await client.query("delete from assignment_vocabulary_items where assignment_id = $1", [id]);
    await client.query("delete from assignment_items where assignment_id = $1", [id]);
    await client.query("delete from assignment_targets where assignment_id = $1", [id]);
    await client.query("delete from assignments where id = $1 and teacher_id = $2", [id, teacherId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "과제를 삭제하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }

  const supabase = createSupabaseAdminClient();
  if (imageStoragePath) {
    const { error } = await supabase.storage.from(storageBuckets.images).remove([imageStoragePath]);
    if (error) console.error(error);
  }
  if (audioStoragePath) {
    const { error } = await supabase.storage.from(storageBuckets.audio).remove([audioStoragePath]);
    if (error) console.error(error);
  }

  return NextResponse.json({ ok: true });
}

function parseTargetAssignments(value: FormDataEntryValue | null): AssignmentTargetInput[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as AssignmentTargetInput[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item.classId && item.classSubjectId && item.dueDate);
  } catch {
    return [];
  }
}

function parseVocabularyItems(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as Array<{ word?: unknown; meaning?: unknown; orderIndex?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => ({
        word: String(item.word ?? "").trim(),
        meaning: String(item.meaning ?? "").trim(),
        orderIndex: Number.isFinite(Number(item.orderIndex)) ? Number(item.orderIndex) : index,
      }))
      .filter((item) => item.word && item.meaning)
      .slice(0, 200)
      .map((item, index) => ({ ...item, orderIndex: index }));
  } catch {
    return [];
  }
}

function parseQuizQuestions(value: unknown): QuizQuestionInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((question, questionIndex) => {
      const item = question as {
        id?: unknown;
        questionText?: unknown;
        explanation?: unknown;
        choices?: unknown;
      };
      const choices = Array.isArray(item.choices)
        ? item.choices
            .map((choice, choiceIndex) => {
              const choiceItem = choice as {
                id?: unknown;
                choiceLabel?: unknown;
                choiceText?: unknown;
                isCorrect?: unknown;
                incorrectReason?: unknown;
              };
              return {
                id: typeof choiceItem.id === "string" && choiceItem.id.startsWith("quiz-choice-") ? choiceItem.id : undefined,
                choiceLabel: String(choiceItem.choiceLabel ?? "").trim() || String(choiceIndex + 1),
                choiceText: String(choiceItem.choiceText ?? "").trim(),
                isCorrect: choiceItem.isCorrect === true,
                incorrectReason: String(choiceItem.incorrectReason ?? "").trim() || null,
                orderIndex: choiceIndex,
              };
            })
            .filter((choice) => choice.choiceText)
            .slice(0, 6)
        : [];

      return {
        id: typeof item.id === "string" && item.id.startsWith("quiz-question-") ? item.id : undefined,
        questionText: String(item.questionText ?? "").trim(),
        explanation: String(item.explanation ?? "").trim() || null,
        orderIndex: questionIndex,
        choices,
      };
    })
    .filter((question) => question.questionText)
    .slice(0, 100);
}

function partTypeForAssignmentType(type: string) {
  if (type === "material") return "instruction";
  if (type === "listening") return "listening";
  if (type === "writing") return "writing";
  if (type === "photo_submission") return "photo_submission";
  if (type === "vocabulary_example") return "vocabulary_example";
  if (type === "vocabulary_recording") return "vocabulary_recording";
  if (type === "quiz") return "quiz";
  return "recording";
}

function allowsSubmission(partType: string) {
  return partType !== "instruction" && partType !== "listening";
}

function isAssignmentPartType(value: string) {
  return [
    "instruction",
    "listening",
    "recording",
    "writing",
    "photo_submission",
    "vocabulary_example",
    "vocabulary_recording",
    "quiz",
  ].includes(value);
}

function defaultAssignmentPart(type: string, fallback: { title: string; instruction: string; scriptText: string }): AssignmentPartInput {
  const partType = partTypeForAssignmentType(type);
  return {
    partType,
    instructionKind: "general",
    title: fallback.title,
    instruction: fallback.instruction,
    scriptText: fallback.scriptText,
    writingMode: type === "writing" ? "picture_description" : null,
    writingUnit: type === "writing" ? "paragraphs" : null,
    writingHint: null,
    writingExample: null,
    vocabularyRows: [],
    isRequired: true,
    allowSubmission: allowsSubmission(partType),
    minSubmissionCount: allowsSubmission(partType) ? 1 : 0,
    maxSubmissionCount: 1,
    orderIndex: 0,
  };
}

function parseAssignmentParts(
  value: FormDataEntryValue | null,
  assignmentType: string,
  fallback: { title: string; instruction: string; scriptText: string },
): AssignmentPartInput[] {
  if (typeof value !== "string" || !value.trim()) return [defaultAssignmentPart(assignmentType, fallback)];
  try {
    const parsed = JSON.parse(value) as Array<Partial<AssignmentPartInput>>;
    if (!Array.isArray(parsed)) return [defaultAssignmentPart(assignmentType, fallback)];
    const parts = parsed
      .map((part, index) => {
        const partType = isAssignmentPartType(String(part.partType ?? "")) ? String(part.partType) : partTypeForAssignmentType(assignmentType);
        return {
          id: typeof part.id === "string" && part.id.startsWith("assignment-part-") ? part.id : undefined,
          partType,
          instructionKind: (part.instructionKind === "grading" || part.instructionKind === "other" ? part.instructionKind : "general") as AssignmentPartInput["instructionKind"],
          title: String(part.title ?? "").trim(),
          instruction: String(part.instruction ?? "").trim(),
          scriptText: String(part.scriptText ?? "").trim(),
          writingMode: String(part.writingMode ?? "").trim() || null,
          writingUnit: String(part.writingUnit ?? "").trim() || null,
          writingHint: String(part.writingHint ?? "").trim() || null,
          writingExample: String(part.writingExample ?? "").trim() || null,
          vocabularyRows: Array.isArray(part.vocabularyRows)
            ? part.vocabularyRows
                .map((item, itemIndex) => ({
                  word: String((item as { word?: unknown }).word ?? "").trim(),
                  meaning: String((item as { meaning?: unknown }).meaning ?? "").trim(),
                  orderIndex: itemIndex,
                }))
                .filter((item) => item.word && item.meaning)
                .slice(0, 200)
            : [],
          quizQuestions: partType === "quiz" ? parseQuizQuestions((part as { quizQuestions?: unknown }).quizQuestions) : [],
          isRequired: part.isRequired !== false,
          allowSubmission: typeof part.allowSubmission === "boolean" ? part.allowSubmission : allowsSubmission(partType),
          minSubmissionCount: Number.isFinite(Number(part.minSubmissionCount)) ? Math.max(0, Number(part.minSubmissionCount)) : (allowsSubmission(partType) ? 1 : 0),
          maxSubmissionCount: Number.isFinite(Number(part.maxSubmissionCount)) ? Math.max(1, Number(part.maxSubmissionCount)) : 1,
          orderIndex: index,
        };
      })
      .slice(0, 50);
    return parts.length ? parts : [defaultAssignmentPart(assignmentType, fallback)];
  } catch {
    return [defaultAssignmentPart(assignmentType, fallback)];
  }
}

function parsePartFiles(formData: FormData): PartFilesByIndex {
  const filesByIndex: PartFilesByIndex = new Map();
  for (const [key, value] of formData.entries()) {
    if (!(value instanceof File) || value.size === 0) continue;
    const match = key.match(/^part(Image|Audio)Files\[(\d+)\]$/);
    if (!match) continue;
    const index = Number(match[2]);
    if (!Number.isInteger(index) || index < 0) continue;
    const current = filesByIndex.get(index) ?? { imageFiles: [], audioFiles: [] };
    if (match[1] === "Image") current.imageFiles.push(value);
    if (match[1] === "Audio") current.audioFiles.push(value);
    filesByIndex.set(index, current);
  }
  return filesByIndex;
}

function parseQuizQuestionFiles(formData: FormData): QuizQuestionFilesByKey {
  const filesByKey: QuizQuestionFilesByKey = new Map();
  for (const [key, value] of formData.entries()) {
    if (!(value instanceof File) || value.size === 0) continue;
    const match = key.match(/^quizQuestion(Image|Audio)Files\[(\d+)\]\[(\d+)\]$/);
    if (!match) continue;
    const partIndex = Number(match[2]);
    const questionIndex = Number(match[3]);
    if (!Number.isInteger(partIndex) || !Number.isInteger(questionIndex) || partIndex < 0 || questionIndex < 0) continue;
    const mapKey = `${partIndex}:${questionIndex}`;
    const current = filesByKey.get(mapKey) ?? { imageFiles: [], audioFiles: [] };
    if (match[1] === "Image") current.imageFiles.push(value);
    if (match[1] === "Audio") current.audioFiles.push(value);
    filesByKey.set(mapKey, current);
  }
  return filesByKey;
}

async function syncAssignmentParts(client: PoolClient, assignmentId: string, parts: AssignmentPartInput[]): Promise<SyncedAssignmentPart[]> {
  const existing = await client.query<{ id: string; submission_count: number }>(
    `
      select ap.id, count(si.id)::int as submission_count
      from assignment_parts ap
      left join submission_items si on si.assignment_part_id = ap.id
      where ap.assignment_id = $1
      group by ap.id
    `,
    [assignmentId],
  );
  const existingById = new Map(existing.rows.map((row) => [row.id, row]));
  const nextIds = new Set<string>();
  const syncedParts: SyncedAssignmentPart[] = [];

  await client.query(
    "update assignment_parts set order_index = -1000 - order_index where assignment_id = $1 and status = 'active'",
    [assignmentId],
  );

  for (const [index, part] of parts.entries()) {
    const partId = part.id && existingById.has(part.id) ? part.id : `assignment-part-${randomUUID()}`;
    nextIds.add(partId);
    syncedParts.push({ id: partId, orderIndex: index });
    const maxSubmissionCount = Math.max(part.maxSubmissionCount, part.minSubmissionCount, 1);
    await client.query(
      `
        insert into assignment_parts (
          id, assignment_id, part_type, instruction_kind, title, instruction, script_text,
          writing_mode, writing_unit, writing_hint, writing_example,
          is_required, allow_submission, min_submission_count, max_submission_count,
          order_index, status, archived_at, archived_reason
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active', null, null)
        on conflict (id)
        do update set
          part_type = excluded.part_type,
          instruction_kind = excluded.instruction_kind,
          title = excluded.title,
          instruction = excluded.instruction,
          script_text = excluded.script_text,
          writing_mode = excluded.writing_mode,
          writing_unit = excluded.writing_unit,
          writing_hint = excluded.writing_hint,
          writing_example = excluded.writing_example,
          is_required = excluded.is_required,
          allow_submission = excluded.allow_submission,
          min_submission_count = excluded.min_submission_count,
          max_submission_count = excluded.max_submission_count,
          order_index = excluded.order_index,
          status = 'active',
          archived_at = null,
          archived_reason = null,
          updated_at = now()
      `,
      [
        partId,
        assignmentId,
        part.partType,
        part.instructionKind,
        part.title || null,
        part.instruction || null,
        part.scriptText || null,
        part.partType === "writing" && (part.writingMode === "picture_description" || part.writingMode === "topic_diary") ? part.writingMode : null,
        part.partType === "writing" && (part.writingUnit === "paragraphs" || part.writingUnit === "sentences") ? part.writingUnit : null,
        part.partType === "writing" ? part.writingHint || null : null,
        part.partType === "writing" ? part.writingExample || null : null,
        part.isRequired,
        part.allowSubmission,
        part.minSubmissionCount,
        maxSubmissionCount,
        index,
      ],
    );
  }

  for (const row of existing.rows) {
    if (nextIds.has(row.id)) continue;
    if (row.submission_count > 0) {
      await client.query(
        `
          update assignment_parts
          set status = 'archived',
              archived_at = coalesce(archived_at, now()),
              archived_reason = 'removed_after_submission',
              updated_at = now()
          where id = $1
        `,
        [row.id],
      );
    } else {
      await client.query("delete from assignment_parts where id = $1", [row.id]);
    }
  }

  return syncedParts;
}

async function syncAssignmentPartFiles(
  client: PoolClient,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  assignmentId: string,
  parts: SyncedAssignmentPart[],
  filesByIndex: PartFilesByIndex,
) {
  for (const part of parts) {
    const files = filesByIndex.get(part.orderIndex);
    if (!files) continue;
    if (files.imageFiles.length > 0) {
      await replacePartAttachments(client, supabase, assignmentId, part.id, "image", files.imageFiles);
    }
    if (files.audioFiles.length > 0) {
      await replacePartAttachments(client, supabase, assignmentId, part.id, "audio", files.audioFiles);
    }
  }
}

async function syncQuizQuestions(
  client: PoolClient,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  assignmentId: string,
  syncedParts: SyncedAssignmentPart[],
  parts: AssignmentPartInput[],
  filesByKey: QuizQuestionFilesByKey,
) {
  for (const syncedPart of syncedParts) {
    const part = parts[syncedPart.orderIndex];
    if (!part || part.partType !== "quiz") {
      await client.query(
        "delete from assignment_quiz_questions where assignment_part_id = $1",
        [syncedPart.id],
      );
      continue;
    }

    const existing = await client.query<{ id: string }>(
      "select id from assignment_quiz_questions where assignment_part_id = $1",
      [syncedPart.id],
    );
    const existingIds = new Set(existing.rows.map((row) => row.id));
    const nextQuestionIds = new Set<string>();

    for (const [questionIndex, question] of (part.quizQuestions ?? []).entries()) {
      const questionId = question.id && existingIds.has(question.id) ? question.id : `quiz-question-${randomUUID()}`;
      nextQuestionIds.add(questionId);
      await client.query(
        `
          insert into assignment_quiz_questions (
            id, assignment_part_id, question_text, explanation, order_index
          )
          values ($1, $2, $3, $4, $5)
          on conflict (id)
          do update set
            question_text = excluded.question_text,
            explanation = excluded.explanation,
            order_index = excluded.order_index,
            updated_at = now()
        `,
        [questionId, syncedPart.id, question.questionText, question.explanation || null, questionIndex],
      );

      const existingChoices = await client.query<{ id: string }>(
        "select id from assignment_quiz_choices where question_id = $1",
        [questionId],
      );
      const existingChoiceIds = new Set(existingChoices.rows.map((row) => row.id));
      const nextChoiceIds = new Set<string>();
      await client.query("update assignment_quiz_choices set is_correct = false where question_id = $1", [questionId]);
      for (const [choiceIndex, choice] of question.choices.entries()) {
        const choiceId = choice.id && existingChoiceIds.has(choice.id) ? choice.id : `quiz-choice-${randomUUID()}`;
        nextChoiceIds.add(choiceId);
        await client.query(
          `
            insert into assignment_quiz_choices (
              id, question_id, choice_label, choice_text, is_correct, incorrect_reason, order_index
            )
            values ($1, $2, $3, $4, $5, $6, $7)
            on conflict (id)
            do update set
              choice_label = excluded.choice_label,
              choice_text = excluded.choice_text,
              is_correct = excluded.is_correct,
              incorrect_reason = excluded.incorrect_reason,
              order_index = excluded.order_index,
              updated_at = now()
          `,
          [
            choiceId,
            questionId,
            choice.choiceLabel || String(choiceIndex + 1),
            choice.choiceText,
            choice.isCorrect,
            choice.incorrectReason || null,
            choiceIndex,
          ],
        );
      }
      for (const choiceId of existingChoiceIds) {
        if (!nextChoiceIds.has(choiceId)) {
          await client.query("delete from assignment_quiz_choices where id = $1", [choiceId]);
        }
      }

      const files = filesByKey.get(`${syncedPart.orderIndex}:${questionIndex}`);
      if (files?.imageFiles.length) {
        await replaceQuizQuestionAttachments(client, supabase, assignmentId, questionId, "image", files.imageFiles);
      }
      if (files?.audioFiles.length) {
        await replaceQuizQuestionAttachments(client, supabase, assignmentId, questionId, "audio", files.audioFiles);
      }
    }

    for (const questionId of existingIds) {
      if (!nextQuestionIds.has(questionId)) {
        await client.query("delete from assignment_quiz_questions where id = $1", [questionId]);
      }
    }
  }
}

async function replaceQuizQuestionAttachments(
  client: PoolClient,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  assignmentId: string,
  questionId: string,
  attachmentType: "image" | "audio",
  files: File[],
) {
  const bucket = attachmentType === "image" ? storageBuckets.images : storageBuckets.audio;
  const maxFileSize = attachmentType === "image" ? MAX_IMAGE_FILE_SIZE : MAX_AUDIO_FILE_SIZE;
  const isValidFile = attachmentType === "image" ? isImageFile : isAudioFile;

  for (const file of files) {
    if (!isValidFile(file)) {
      throw new Error(attachmentType === "image"
        ? `퀴즈 문제 이미지 파일 형식을 확인해주세요.\n${fileDebugInfo(file)}\n업로드 가능한 이미지 형식: ${SUPPORTED_IMAGE_EXTENSIONS}`
        : `퀴즈 문제 오디오 파일 형식을 확인해주세요.\n${fileDebugInfo(file)}\n업로드 가능한 오디오 형식: ${SUPPORTED_AUDIO_EXTENSIONS}`);
    }
    if (file.size > maxFileSize) {
      throw new Error(attachmentType === "image"
        ? `퀴즈 문제 이미지 파일 용량이 너무 큽니다.\n${fileDebugInfo(file)}\n이미지는 1개당 최대 10MB까지 업로드할 수 있습니다.`
        : `퀴즈 문제 오디오 파일 용량이 너무 큽니다.\n${fileDebugInfo(file)}\n오디오는 1개당 최대 10MB까지 업로드할 수 있습니다.`);
    }
  }

  await ensureStorageBucket(supabase, bucket, {
    fileSizeLimit: maxFileSize,
    allowedMimeTypes: attachmentType === "image" ? ["image/*"] : ["audio/*", "application/octet-stream"],
  });

  const existing = await client.query<{ storage_path: string }>(
    "select storage_path from assignment_quiz_question_attachments where question_id = $1 and attachment_type = $2",
    [questionId, attachmentType],
  );
  if (existing.rows.length > 0) {
    const { error } = await supabase.storage.from(bucket).remove(existing.rows.map((row) => row.storage_path));
    if (error) console.error(error);
  }
  await client.query(
    "delete from assignment_quiz_question_attachments where question_id = $1 and attachment_type = $2",
    [questionId, attachmentType],
  );

  for (const [index, file] of files.entries()) {
    const fileName = safeFileName(file.name);
    const storagePath = `assignments/${assignmentId}/quiz/${questionId}/${attachmentType}/${index + 1}-${Date.now()}-${fileName}`;
    const upload = await supabase.storage.from(bucket).upload(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      { contentType: attachmentType === "image" ? imageContentType(file) : audioContentType(file), upsert: true },
    );
    if (upload.error) {
      throw new Error(`${attachmentType === "image" ? "퀴즈 문제 이미지" : "퀴즈 문제 오디오"} 업로드 실패: ${upload.error.message}`);
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
    await client.query(
      `
        insert into assignment_quiz_question_attachments (
          id, question_id, attachment_type, storage_bucket, storage_path,
          file_url, file_name, mime_type, file_size_bytes, order_index
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        `quiz-question-attachment-${randomUUID()}`,
        questionId,
        attachmentType,
        bucket,
        storagePath,
        publicUrl,
        fileName,
        file.type || (attachmentType === "image" ? "image/png" : "audio/mpeg"),
        file.size,
        index,
      ],
    );
  }
}

async function syncAssignmentPartVocabularyItems(
  client: PoolClient,
  assignmentId: string,
  syncedParts: SyncedAssignmentPart[],
  parts: AssignmentPartInput[],
  legacyVocabularyItems: Array<{ word: string; meaning: string; orderIndex: number }>,
) {
  await client.query("delete from assignment_vocabulary_items where assignment_id = $1", [assignmentId]);

  let insertedCount = 0;
  for (const syncedPart of syncedParts) {
    const part = parts[syncedPart.orderIndex];
    if (!part || (part.partType !== "vocabulary_example" && part.partType !== "vocabulary_recording")) continue;

    const rows = (part.vocabularyRows?.length ? part.vocabularyRows : legacyVocabularyItems)
      .map((item, index) => ({
        word: item.word.trim(),
        meaning: item.meaning.trim(),
        orderIndex: index,
      }))
      .filter((item) => item.word && item.meaning)
      .slice(0, 200);

    for (const item of rows) {
      await client.query(
        `
          insert into assignment_vocabulary_items (id, assignment_id, assignment_part_id, word, meaning, order_index)
          values ($1, $2, $3, $4, $5, $6)
        `,
        [`assignment-vocab-${randomUUID()}`, assignmentId, syncedPart.id, item.word, item.meaning, item.orderIndex],
      );
      insertedCount += 1;
    }
  }

  return insertedCount;
}

async function replacePartAttachments(
  client: PoolClient,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  assignmentId: string,
  partId: string,
  attachmentType: "image" | "audio",
  files: File[],
) {
  const bucket = attachmentType === "image" ? storageBuckets.images : storageBuckets.audio;
  const maxFileSize = attachmentType === "image" ? MAX_IMAGE_FILE_SIZE : MAX_AUDIO_FILE_SIZE;
  const isValidFile = attachmentType === "image" ? isImageFile : isAudioFile;

  for (const file of files) {
    if (!isValidFile(file)) {
      throw new Error(attachmentType === "image"
        ? `Part 이미지 파일 형식을 확인해주세요.\n${fileDebugInfo(file)}\n업로드 가능한 이미지 형식: ${SUPPORTED_IMAGE_EXTENSIONS}`
        : `Part 오디오 파일 형식을 확인해주세요.\n${fileDebugInfo(file)}\n업로드 가능한 오디오 형식: ${SUPPORTED_AUDIO_EXTENSIONS}`);
    }
    if (file.size > maxFileSize) {
      throw new Error(attachmentType === "image"
        ? `Part 이미지 파일 용량이 너무 큽니다.\n${fileDebugInfo(file)}\n이미지는 1개당 최대 10MB까지 업로드할 수 있습니다.`
        : `Part 오디오 파일 용량이 너무 큽니다.\n${fileDebugInfo(file)}\n오디오는 1개당 최대 10MB까지 업로드할 수 있습니다.`);
    }
  }

  await ensureStorageBucket(supabase, bucket, {
    fileSizeLimit: maxFileSize,
    allowedMimeTypes: attachmentType === "image" ? ["image/*"] : ["audio/*", "application/octet-stream"],
  });

  const existing = await client.query<{ storage_path: string }>(
    "select storage_path from assignment_part_attachments where assignment_part_id = $1 and attachment_type = $2",
    [partId, attachmentType],
  );

  if (existing.rows.length > 0) {
    const { error } = await supabase.storage.from(bucket).remove(existing.rows.map((row) => row.storage_path));
    if (error) console.error(error);
  }

  await client.query(
    "delete from assignment_part_attachments where assignment_part_id = $1 and attachment_type = $2",
    [partId, attachmentType],
  );

  for (const [index, file] of files.entries()) {
    const fileName = safeFileName(file.name);
    const storagePath = `assignments/${assignmentId}/parts/${partId}/${attachmentType}/${index + 1}-${Date.now()}-${fileName}`;
    const upload = await supabase.storage.from(bucket).upload(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      { contentType: attachmentType === "image" ? imageContentType(file) : audioContentType(file), upsert: true },
    );

    if (upload.error) {
      throw new Error(`${attachmentType === "image" ? "Part 이미지" : "Part 오디오"} 업로드 실패: ${upload.error.message}`);
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
    await client.query(
      `
        insert into assignment_part_attachments (
          id, assignment_part_id, attachment_type, storage_bucket, storage_path,
          file_url, file_name, mime_type, file_size_bytes, order_index
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        `assignment-part-attachment-${randomUUID()}`,
        partId,
        attachmentType,
        bucket,
        storagePath,
        publicUrl,
        fileName,
        file.type || (attachmentType === "image" ? "image/png" : "audio/mpeg"),
        file.size,
        index,
      ],
    );
  }
}

function toDueAt(date: string, time: string) {
  if (!date) return null;
  return `${date}T${time || "23:59"}:00+09:00`;
}

async function findTargetStudents(
  client: PoolClient,
  teacherId: string,
  target: AssignmentTargetInput,
) {
  if (target.targetMode === "partial" && target.selectedStudents.length > 0) {
    const result = await client.query<StudentTargetRow>(
      `
        select distinct s.id
        from students s
        join class_memberships cm on cm.student_id = s.id
        where s.teacher_id = $1
          and s.status = 'active'
          and cm.class_id = $2
          and s.id = any($3::text[])
      `,
      [teacherId, target.classId, target.selectedStudents],
    );
    return result.rows;
  }

  const result = await client.query<StudentTargetRow>(
    `
      select distinct s.id
      from students s
      join class_memberships cm on cm.student_id = s.id
      where s.teacher_id = $1
        and s.status = 'active'
        and cm.class_id = $2
    `,
    [teacherId, target.classId],
  );
  return result.rows;
}
