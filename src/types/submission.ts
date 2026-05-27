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
};
