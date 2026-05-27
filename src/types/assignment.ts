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
  items: AssignmentItem[];
  createdAt: string;
};

export type AssignmentVocabularyItem = {
  id: string;
  assignmentId: string;
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
};
