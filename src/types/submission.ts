export type Submission = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: "not_submitted" | "submitted" | "reviewed" | "returned";
  submittedAt?: string;
  items: SubmissionItem[];
  teacherComment?: string;
  reviewedAt?: string;
};

export type SubmissionItem = {
  id: string;
  submissionId: string;
  assignmentItemId: string;
  recordingUrl?: string;
  recordingFileName?: string;
  recordingMimeType?: string;
  recordingDurationSec?: number;
  fileSizeBytes?: number;
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
