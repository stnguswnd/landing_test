export type AssignmentType =
  | "listening_recording"
  | "listening"
  | "writing"
  | "vocabulary_example"
  | "vocabulary_recording";

export type AssignmentItemType =
  | "listening_recording"
  | "listening"
  | "writing_prompt"
  | "vocabulary_example"
  | "vocabulary_recording";

export type WritingMode = "picture_description" | "topic_diary";

export type WritingUnit = "paragraphs" | "sentences";

export type AssignmentSubject = string;

const SUPPORTED_ASSIGNMENT_TYPES = ["listening_recording", "listening", "writing", "vocabulary_example", "vocabulary_recording"] as const;

const LEGACY_ASSIGNMENT_TYPES = [
  "image_speaking",
  "sentence_shadowing",
  "free_speaking",
  "quiz",
  "vocabulary",
  "general",
] as const;

export function isSupportedAssignmentType(value: string | null | undefined): value is AssignmentType {
  return SUPPORTED_ASSIGNMENT_TYPES.includes(value as AssignmentType);
}

export function isLegacyAssignmentType(value: string | null | undefined) {
  return LEGACY_ASSIGNMENT_TYPES.includes(value as (typeof LEGACY_ASSIGNMENT_TYPES)[number]);
}

export function normalizeAssignmentType(value: string | null | undefined): AssignmentType {
  if (isSupportedAssignmentType(value)) return value;
  return "listening_recording";
}

export function assignmentTypeLabel(value: string | null | undefined) {
  const type = normalizeAssignmentType(value);
  if (type === "vocabulary_example") return "단어장 예문";
  if (type === "vocabulary_recording") return "단어장 녹음";
  if (type === "writing") return "라이팅";
  if (type === "listening") return "리스닝";
  return "RL 녹음";
}

export function assignmentSubjectLabel(value: string | null | undefined) {
  return normalizeAssignmentSubject(value);
}

export function normalizeAssignmentSubject(value: string | null | undefined): AssignmentSubject {
  return String(value ?? "").trim();
}

export function assignmentSubjectForType() {
  return "";
}

export function itemTypeForAssignmentType(value: string | null | undefined): AssignmentItemType {
  const type = normalizeAssignmentType(value);
  if (type === "vocabulary_example") return "vocabulary_example";
  if (type === "vocabulary_recording") return "vocabulary_recording";
  if (type === "writing") return "writing_prompt";
  return type;
}

export function normalizeAssignmentItemType(
  itemType: string | null | undefined,
  assignmentType?: string | null,
): AssignmentItemType {
  if (
    itemType === "listening" ||
    itemType === "listening_recording" ||
    itemType === "writing_prompt" ||
    itemType === "vocabulary_example" ||
    itemType === "vocabulary_recording"
  ) return itemType;
  return itemTypeForAssignmentType(assignmentType);
}

export function normalizeWritingMode(value: string | null | undefined): WritingMode | undefined {
  if (value === "picture_description" || value === "topic_diary") return value;
  return undefined;
}

export function normalizeWritingUnit(value: string | null | undefined): WritingUnit | undefined {
  if (value === "paragraphs" || value === "sentences") return value;
  return undefined;
}

export function writingModeLabel(value: string | null | undefined) {
  if (value === "topic_diary") return "주제/일기 쓰기";
  if (value === "picture_description") return "그림 묘사";
  return "라이팅";
}

export function writingUnitLabel(value: string | null | undefined) {
  if (value === "sentences") return "4 sentences";
  return "4 paragraphs";
}
