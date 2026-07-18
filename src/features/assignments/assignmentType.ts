import type { AssignmentType } from "@/lib/assignmentTypes";
import type { AssignmentPart } from "@/types/assignment";

type AssignmentLike = {
  assignmentType: AssignmentType;
  parts?: Array<{ status: string }>;
};

export function getCanonicalAssignmentType(assignment: AssignmentLike): AssignmentType {
  return assignment.assignmentType;
}

export function getActiveAssignmentParts<T extends { status: string }>(parts: T[] | undefined): T[] {
  return (parts ?? []).filter((part) => part.status === "active");
}

export function isMultipartAssignment(assignment: AssignmentLike): boolean {
  return getActiveAssignmentParts(assignment.parts).length >= 2;
}

export function assignmentTypeFromPartType(partType: AssignmentPart["partType"]): AssignmentType | undefined {
  if (partType === "instruction") return "material";
  if (partType === "listening") return "listening";
  if (partType === "recording") return "listening_recording";
  if (partType === "writing") return "writing";
  if (partType === "photo_submission") return "photo_submission";
  if (partType === "vocabulary_example") return "vocabulary_example";
  if (partType === "vocabulary_recording") return "vocabulary_recording";
  if (partType === "quiz") return "quiz";
  return undefined;
}
