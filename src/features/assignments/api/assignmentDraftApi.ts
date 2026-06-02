import type { StudentAssignmentDraft } from "@/types/assignment";

export type SaveAssignmentDraftInput = {
  assignmentId: string;
  assignmentPartId: string;
  assignmentItemId?: string;
  currentPartOrder: number;
  data?: Record<string, unknown>;
  files?: File[] | Blob[];
  fileNamePrefix?: string;
  attachmentType?: "image" | "audio";
  replaceAttachments?: boolean;
  durationSec?: number;
};

export async function saveAssignmentDraft(input: SaveAssignmentDraftInput) {
  const formData = new FormData();
  formData.set("assignmentPartId", input.assignmentPartId);
  if (input.assignmentItemId) formData.set("assignmentItemId", input.assignmentItemId);
  formData.set("currentPartOrder", String(input.currentPartOrder));
  formData.set("data", JSON.stringify(input.data ?? {}));
  formData.set("replaceAttachments", input.replaceAttachments ? "true" : "false");
  if (input.attachmentType) formData.set("attachmentType", input.attachmentType);
  if (input.durationSec !== undefined) formData.set("durationSec", String(input.durationSec));

  for (const [index, file] of (input.files ?? []).entries()) {
    const fileName = file instanceof File
      ? file.name
      : `${input.fileNamePrefix ?? "draft-file"}-${index + 1}.webm`;
    formData.append("files", file, fileName);
  }

  const response = await fetch(`/api/student/assignments/${input.assignmentId}/draft`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "임시저장 중 오류가 발생했습니다.");
  }
  return data.draft as StudentAssignmentDraft;
}

export async function fetchAssignmentDraft(assignmentId: string) {
  const response = await fetch(`/api/student/assignments/${assignmentId}/draft`, { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "임시저장 조회 중 오류가 발생했습니다.");
  }
  return (data.draft ?? null) as StudentAssignmentDraft | null;
}

export async function submitAssignmentDraft(assignmentId: string) {
  const response = await fetch(`/api/student/assignments/${assignmentId}/draft/submit`, { method: "POST" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "최종 제출 중 오류가 발생했습니다.");
  }
  return data as { submissionId: string; submittedAt: string; status: string };
}
