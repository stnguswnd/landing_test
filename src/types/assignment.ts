import type { AssignmentItemType, AssignmentType, WritingMode, WritingUnit } from "@/lib/assignmentTypes";

export type Assignment = {
  id: string;
  teacherId: string;
  classId: string;
  title: string;
  description?: string;
  assignmentType: AssignmentType;
  assignmentSubject?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  dueAt?: string;
  status: "draft" | "published" | "closed" | "archived";
  targetStatus?: "assigned" | "submitted" | "late" | "excused" | string;
  submittedAt?: string;
  reviewedAt?: string;
  teacherComment?: string;
  submissionId?: string;
  vocabularyItems?: AssignmentVocabularyItem[];
  submissionVocabularyItems?: SubmissionVocabularyItem[];
  parts?: AssignmentPart[];
  submissionParts?: AssignmentSubmissionPart[];
  draft?: StudentAssignmentDraft;
  items: AssignmentItem[];
  createdAt: string;
};

export type AssignmentSubmissionPart = {
  id: string;
  assignmentPartId: string;
  title?: string;
  partType?: AssignmentPart["partType"];
  scriptText?: string;
  recordingUrl?: string;
  recordingFileName?: string;
  recordingDurationSec?: number;
  originalAnswerText?: string;
  answerText?: string;
  aiCorrectedText?: string;
  aiFeedback?: string;
  aiGrammarNotes?: string;
  aiExpressionNotes?: string;
  attachments?: SubmissionItemAttachment[];
};

export type StudentAssignmentDraft = {
  id: string;
  assignmentId: string;
  studentId: string;
  assignmentTargetId?: string;
  currentPartId?: string;
  currentPartOrder: number;
  draftData: Record<string, unknown>;
  status: "draft" | "submitted" | "discarded";
  updatedAt: string;
  attachments?: StudentAssignmentDraftAttachment[];
};

export type StudentAssignmentDraftAttachment = {
  id: string;
  draftId: string;
  assignmentPartId?: string;
  assignmentItemId?: string;
  attachmentType: "image" | "audio" | "video" | "file";
  storageBucket: string;
  storagePath: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  durationSec?: number;
  orderIndex: number;
};

export type AssignmentPart = {
  id: string;
  assignmentId: string;
  partType: "instruction" | "listening" | "recording" | "writing" | "photo_submission" | "vocabulary_example" | "vocabulary_recording";
  title?: string;
  instruction?: string;
  scriptText?: string;
  writingMode?: WritingMode;
  writingUnit?: WritingUnit;
  writingHint?: string;
  writingExample?: string;
  vocabularyItems?: AssignmentVocabularyItem[];
  isRequired: boolean;
  allowSubmission: boolean;
  minSubmissionCount: number;
  maxSubmissionCount: number;
  orderIndex: number;
  status: "active" | "archived";
  attachments?: AssignmentPartAttachment[];
};

export type AssignmentPartAttachment = {
  id: string;
  assignmentPartId: string;
  attachmentType: "image" | "audio" | "video" | "file";
  fileName?: string;
  fileUrl?: string;
  orderIndex: number;
};

export type AssignmentVocabularyItem = {
  id: string;
  assignmentId: string;
  assignmentPartId?: string;
  word: string;
  meaning: string;
  orderIndex: number;
};

export type SubmissionVocabularyItem = {
  id: string;
  submissionId: string;
  assignmentVocabularyItemId: string;
  originalAnswerText?: string;
  aiCorrectedText?: string;
  aiFeedback?: string;
  aiGrammarNotes?: string;
  aiFeedbackRaw?: unknown;
  revisedAnswerText?: string;
  teacherComment?: string;
  status: "draft" | "submitted" | "reviewed" | "returned";
};

export type AssignmentItem = {
  id: string;
  assignmentId: string;
  itemType: AssignmentItemType;
  title?: string;
  passageText: string;
  audioUrl?: string;
  audioFileName?: string;
  recordingUrl?: string;
  recordingFileName?: string;
  recordingDurationSec?: number;
  orderIndex: number;
  minRecordingSec: number;
  maxRecordingSec: number;
  writingMode?: WritingMode;
  writingUnit?: WritingUnit;
  writingUnitCount?: number;
  promptText?: string;
  writingInstructions?: string;
  writingHint?: string;
  writingExample?: string;
  originalAnswerText?: string;
  answerText?: string;
  aiCorrectedText?: string;
  aiFeedback?: string;
  aiGrammarNotes?: string;
  aiExpressionNotes?: string;
  aiFeedbackRaw?: unknown;
  attachments?: SubmissionItemAttachment[];
};

export type SubmissionItemAttachment = {
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
};
