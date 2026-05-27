export type RecordingSubmissionInput = {
  assignmentId: string;
  assignmentItemId: string;
  durationSec: number;
  file: Blob;
  fileName?: string;
};

export async function submitRecording(input: RecordingSubmissionInput) {
  const formData = new FormData();
  formData.set("assignmentId", input.assignmentId);
  formData.set("assignmentItemId", input.assignmentItemId);
  formData.set("durationSec", String(input.durationSec));
  formData.set("file", input.file, input.fileName ?? "recording.webm");

  const response = await fetch("/api/student/submissions/recording", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "녹음 제출 중 오류가 발생했습니다.");
  }

  return data as { submissionId: string; submittedAt: string; status: string; recordingStoragePath: string; recordingUrl: string };
}

export async function completeListeningAssignment(assignmentId: string) {
  const response = await fetch("/api/student/submissions/listening", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignmentId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "리스닝 숙제 완료 처리 중 오류가 발생했습니다.");
  }

  return data as { submissionId: string; submittedAt: string; status: string };
}

export type WritingFeedbackInput = {
  assignmentId: string;
  assignmentItemId: string;
  writingMode?: string;
  writingUnit?: string;
  writingUnitCount?: number;
  promptText?: string;
  writingInstructions?: string;
  writingHint?: string;
  writingExample?: string;
  imageUrl?: string;
  answerText: string;
};

export type WritingFeedbackResult = {
  correctedText: string;
  feedback: string;
  grammarNotes: string[];
  expressionNotes: string[];
  raw?: unknown;
  isFallback?: boolean;
};

export async function requestWritingFeedback(input: WritingFeedbackInput) {
  const response = await fetch("/api/student/writing-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "AI 첨삭 중 오류가 발생했습니다.");
  }
  return data as WritingFeedbackResult;
}

export async function submitWritingAssignment(input: WritingFeedbackInput & {
  originalAnswerText?: string;
  aiCorrectedText: string;
  aiFeedback: string;
  aiGrammarNotes?: string;
  aiExpressionNotes?: string;
  aiFeedbackRaw?: unknown;
}) {
  const response = await fetch("/api/student/submissions/writing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "라이팅 제출 중 오류가 발생했습니다.");
  }
  return data as { submissionId: string; submittedAt: string; status: string };
}
