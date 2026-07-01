"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { type AssignmentType, type WritingMode, type WritingUnit } from "@/lib/assignmentTypes";

type VocabularyRow = {
  word: string;
  meaning: string;
};

type AssignmentPartType =
  | "instruction"
  | "listening"
  | "recording"
  | "writing"
  | "photo_submission"
  | "vocabulary_example"
  | "vocabulary_recording"
  | "quiz";

type QuizChoiceState = {
  id?: string;
  choiceLabel: string;
  choiceText: string;
  isCorrect: boolean;
  incorrectReason: string;
};

type QuizQuestionAttachmentState = {
  id: string;
  attachmentType: "image" | "audio" | "video" | "file";
  fileName?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  orderIndex: number;
};

type QuizQuestionState = {
  id?: string;
  questionText: string;
  explanation: string;
  choices: QuizChoiceState[];
  imageFiles: File[];
  audioFiles: File[];
  attachments: QuizQuestionAttachmentState[];
};

type AssignmentPartState = {
  id?: string;
  partType: AssignmentPartType;
  title: string;
  instruction: string;
  scriptText: string;
  writingMode: WritingMode;
  writingUnit: WritingUnit;
  writingHint: string;
  writingExample: string;
  vocabularyRows: VocabularyRow[];
  isRequired: boolean;
  allowSubmission: boolean;
  minSubmissionCount: string;
  maxSubmissionCount: string;
  imageFiles: File[];
  audioFiles: File[];
  attachments: AssignmentPartAttachmentState[];
  quizQuestions: QuizQuestionState[];
};

type AssignmentPartAttachmentState = {
  id: string;
  attachmentType: "image" | "audio" | "video" | "file";
  fileName?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  orderIndex: number;
};

type TemplateState = {
  title: string;
  type: AssignmentType | "";
  description: string;
  passageTitle: string;
  passageText: string;
  minRecordingSec: string;
  maxRecordingSec: string;
  audioFileName: string;
  audioUrl: string;
  imageUrl: string;
  imageFileName: string;
  writingMode: WritingMode;
  writingUnit: WritingUnit;
  promptText: string;
  writingInstructions: string;
  writingHint: string;
  writingExample: string;
  vocabularyRows: VocabularyRow[];
  parts: AssignmentPartState[];
};

const assignmentPartTypes: AssignmentPartType[] = ["recording", "listening", "writing", "vocabulary_example", "vocabulary_recording", "photo_submission", "quiz"];
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ASSIGNMENT_UPLOAD_BYTES = 100 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = "png, jpg, jpeg, gif, webp, heic, heif, bmp, tif, tiff, svg";
const SUPPORTED_AUDIO_EXTENSIONS = "mp3, m4a, wav, webm, ogg, oga, aac, aif, aiff, caf, flac, amr";

function partTypeLabel(type: AssignmentPartType) {
  if (type === "instruction") return "설명";
  if (type === "listening") return "듣기";
  if (type === "recording") return "듣고녹음하기";
  if (type === "writing") return "쓰기";
  if (type === "photo_submission") return "사진 제출";
  if (type === "quiz") return "퀴즈";
  if (type === "vocabulary_example") return "단어장 예문";
  return "단어장 녹음";
}

function partTypeForAssignmentType(type: AssignmentType | ""): AssignmentPartType {
  if (type === "listening") return "listening";
  if (type === "writing") return "writing";
  if (type === "photo_submission") return "photo_submission";
  if (type === "quiz") return "quiz";
  if (type === "vocabulary_example") return "vocabulary_example";
  if (type === "vocabulary_recording") return "vocabulary_recording";
  return "recording";
}

function assignmentTypeForPartType(type: AssignmentPartType): AssignmentType {
  if (type === "listening") return "listening";
  if (type === "writing") return "writing";
  if (type === "photo_submission") return "photo_submission";
  if (type === "quiz") return "quiz";
  if (type === "vocabulary_example") return "vocabulary_example";
  if (type === "vocabulary_recording") return "vocabulary_recording";
  return "listening_recording";
}

function assignmentTypeForParts(parts: AssignmentPartState[]): AssignmentType {
  const contentParts = parts.filter((part) => part.partType !== "instruction");
  const types = Array.from(new Set(contentParts.map((part) => assignmentTypeForPartType(part.partType))));
  if (types.length === 1) return types[0];
  return "listening_recording";
}

function partAllowsSubmission(type: AssignmentPartType) {
  return type !== "instruction" && type !== "listening";
}

function createQuizChoice(index: number, isCorrect = false): QuizChoiceState {
  return {
    id: `quiz-choice-${crypto.randomUUID()}`,
    choiceLabel: String(index + 1),
    choiceText: "",
    isCorrect,
    incorrectReason: "",
  };
}

function createQuizQuestion(index: number): QuizQuestionState {
  return {
    id: `quiz-question-${crypto.randomUUID()}`,
    questionText: "",
    explanation: "",
    choices: [createQuizChoice(0, true), createQuizChoice(1), createQuizChoice(2)],
    imageFiles: [],
    audioFiles: [],
    attachments: [],
  };
}

function defaultVocabularyRows(): VocabularyRow[] {
  return [
    { word: "apple", meaning: "사과" },
    { word: "library", meaning: "도서관" },
  ];
}

function validVocabularyRows(rows: VocabularyRow[]) {
  return rows
    .map((row) => ({ word: row.word.trim(), meaning: row.meaning.trim() }))
    .filter((row) => row.word && row.meaning)
    .slice(0, 200);
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${bytes}B`;
}

function fileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function isSupportedImageFile(file: File) {
  return file.type.startsWith("image/") || /^(png|jpe?g|gif|webp|heic|heif|bmp|tiff?|svg)$/.test(fileExtension(file.name));
}

function isSupportedAudioFile(file: File) {
  return file.type.startsWith("audio/") || /^(mp3|m4a|wav|webm|ogg|oga|aac|aiff?|caf|flac|amr)$/.test(fileExtension(file.name));
}

function partFieldCopy(type: AssignmentPartType) {
  if (type === "listening") {
    return {
      instructionLabel: "듣기 안내",
      scriptLabel: "듣기 스크립트",
      imageLabel: "참고 이미지",
      audioLabel: "원본 오디오 파일",
      helper: "학생은 오디오를 끝까지 듣고 이 Part를 저장합니다.",
      submitLabel: "제출 수",
    };
  }
  if (type === "recording") {
    return {
      instructionLabel: "녹음 안내",
      scriptLabel: "읽고 녹음할 문장",
      imageLabel: "참고 이미지",
      audioLabel: "따라 말할 오디오 파일",
      helper: "기존 듣고녹음하기 숙제처럼 학생이 듣고 녹음합니다.",
      submitLabel: "녹음 파일 수",
    };
  }
  if (type === "writing") {
    return {
      instructionLabel: "쓰기 추가 지시문",
      scriptLabel: "주제 / 프롬프트",
      imageLabel: "쓰기 이미지",
      audioLabel: "예시 오디오 파일",
      helper: "기존 쓰기 숙제처럼 주제, 이미지, 지시문을 Part 안에 넣습니다.",
      submitLabel: "작성 제출 수",
    };
  }
  if (type === "photo_submission") {
    return {
      instructionLabel: "사진 제출 안내",
      scriptLabel: "사진 설명 / 스크립트",
      imageLabel: "예시 이미지",
      audioLabel: "예시 오디오 파일",
      helper: "학생은 안내를 보고 사진을 여러 장 업로드해 제출합니다.",
      submitLabel: "사진 제출 수",
    };
  }
  if (type === "vocabulary_example") {
    return {
      instructionLabel: "단어 예문 안내",
      scriptLabel: "예문 작성 지시문",
      imageLabel: "참고 이미지",
      audioLabel: "예시 오디오 파일",
      helper: "기존 단어장 예문 숙제처럼 Part 안에서 단어 목록과 예문 작성 안내를 설정합니다.",
      submitLabel: "예문 제출 수",
    };
  }
  if (type === "vocabulary_recording") {
    return {
      instructionLabel: "단어 녹음 안내",
      scriptLabel: "단어 읽기 지시문",
      imageLabel: "참고 이미지",
      audioLabel: "예시 오디오 파일",
      helper: "기존 단어장 녹음 숙제처럼 Part 안에서 단어 목록과 읽기 안내를 설정합니다.",
      submitLabel: "녹음 파일 수",
    };
  }
  if (type === "quiz") {
    return {
      instructionLabel: "퀴즈 안내",
      scriptLabel: "퀴즈 보조 설명",
      imageLabel: "파트 공통 이미지",
      audioLabel: "파트 공통 오디오",
      helper: "Quiz Part 하나에 여러 문제를 추가할 수 있습니다.",
      submitLabel: "답안 수",
    };
  }
  return {
    instructionLabel: "설명",
    scriptLabel: "상세 내용",
    imageLabel: "참고 이미지",
    audioLabel: "참고 오디오",
    helper: "학생에게 안내만 보여주는 Part입니다.",
    submitLabel: "제출 수",
  };
}

function createPart(type: AssignmentType | "", index: number): AssignmentPartState {
  const partType = type ? partTypeForAssignmentType(type) : "recording";
  return {
    partType,
    title: `Part ${index + 1}`,
    instruction: "",
    scriptText: "",
    writingMode: "picture_description",
    writingUnit: "paragraphs",
    writingHint: "",
    writingExample: "",
    vocabularyRows: partType === "vocabulary_example" || partType === "vocabulary_recording" ? defaultVocabularyRows() : [],
    isRequired: true,
    allowSubmission: partAllowsSubmission(partType),
    minSubmissionCount: partAllowsSubmission(partType) ? "1" : "0",
    maxSubmissionCount: "1",
    imageFiles: [],
    audioFiles: [],
    attachments: [],
    quizQuestions: partType === "quiz" ? [createQuizQuestion(0)] : [],
  };
}

function createLegacyPart(data: {
  type?: AssignmentType;
  item?: {
    title?: string;
    passageText?: string;
    promptText?: string;
    writingInstructions?: string;
    writingMode?: WritingMode;
    writingUnit?: WritingUnit;
    writingHint?: string;
    writingExample?: string;
    minRecordingSec?: number;
    maxRecordingSec?: number;
    audioFileName?: string;
    audioUrl?: string;
  };
}, index: number): AssignmentPartState {
  const part = createPart(data.type ?? "listening_recording", index);
  const scriptText = data.item?.passageText || data.item?.promptText || "";
  const legacyAudioAttachment = data.item?.audioUrl
    ? [{
        id: `legacy-audio-${index}`,
        attachmentType: "audio" as const,
        fileName: data.item.audioFileName || "audio",
        fileUrl: data.item.audioUrl,
        orderIndex: 0,
      }]
    : [];
  return {
    ...part,
    title: data.item?.title || part.title,
    instruction: data.item?.writingInstructions || "",
    scriptText,
    writingMode: data.item?.writingMode ?? part.writingMode,
    writingUnit: data.item?.writingUnit ?? part.writingUnit,
    writingHint: data.item?.writingHint ?? "",
    writingExample: data.item?.writingExample ?? "",
    minSubmissionCount: String(data.item?.minRecordingSec ?? part.minSubmissionCount),
    maxSubmissionCount: String(data.item?.maxRecordingSec ?? part.maxSubmissionCount),
    attachments: legacyAudioAttachment,
  };
}

function assignmentPartsFromApi(assignment: {
  type?: AssignmentType;
  item?: Parameters<typeof createLegacyPart>[0]["item"];
  parts?: Array<{
    id?: string;
    partType?: AssignmentPartType;
    title?: string;
    instruction?: string;
    scriptText?: string;
    writingMode?: WritingMode;
    writingUnit?: WritingUnit;
    writingHint?: string;
    writingExample?: string;
    vocabularyItems?: VocabularyRow[];
    isRequired?: boolean;
    allowSubmission?: boolean;
    minSubmissionCount?: number;
    maxSubmissionCount?: number;
    status?: string;
    attachments?: AssignmentPartAttachmentState[];
    quizQuestions?: Array<{
      id?: string;
      questionText?: string;
      explanation?: string;
      choices?: QuizChoiceState[];
      attachments?: QuizQuestionAttachmentState[];
    }>;
  }>;
}) {
  const legacyAudioAttachment = assignment.item?.audioUrl
    ? [{
        id: "legacy-audio-0",
        attachmentType: "audio" as const,
        fileName: assignment.item.audioFileName || "audio",
        fileUrl: assignment.item.audioUrl,
        orderIndex: 0,
      }]
    : [];
  return assignment.parts?.length
    ? assignment.parts
        .filter((part) => part.status !== "archived")
        .map((part, index) => {
          const attachments = part.attachments ?? [];
          const hasPartAudio = attachments.some((attachment) => attachment.attachmentType === "audio");
          return {
            id: part.id,
            partType: part.partType ?? createPart(assignment.type ?? "listening_recording", index).partType,
            title: part.title ?? `Part ${index + 1}`,
            instruction: part.instruction ?? "",
            scriptText: part.scriptText ?? "",
            writingMode: part.writingMode ?? "picture_description",
            writingUnit: part.writingUnit ?? "paragraphs",
            writingHint: part.writingHint ?? "",
            writingExample: part.writingExample ?? "",
            vocabularyRows: part.vocabularyItems?.length
              ? part.vocabularyItems.map((item) => ({ word: item.word, meaning: item.meaning }))
              : (part.partType === "vocabulary_example" || part.partType === "vocabulary_recording" ? defaultVocabularyRows() : []),
            isRequired: part.isRequired ?? true,
            allowSubmission: part.allowSubmission ?? partAllowsSubmission(part.partType ?? "recording"),
            minSubmissionCount: String(part.minSubmissionCount ?? 0),
            maxSubmissionCount: String(part.maxSubmissionCount ?? 1),
            imageFiles: [],
            audioFiles: [],
            attachments: index === 0 && !hasPartAudio ? [...attachments, ...legacyAudioAttachment] : attachments,
            quizQuestions: part.partType === "quiz"
              ? (part.quizQuestions?.length
                ? part.quizQuestions.map((question, questionIndex) => ({
                    id: question.id,
                    questionText: question.questionText ?? "",
                    explanation: question.explanation ?? "",
                    choices: question.choices?.length
                      ? question.choices.map((choice, choiceIndex) => ({
                          id: choice.id,
                          choiceLabel: choice.choiceLabel || String(choiceIndex + 1),
                          choiceText: choice.choiceText,
                          isCorrect: choice.isCorrect,
                          incorrectReason: choice.incorrectReason ?? "",
                        }))
                      : [createQuizChoice(0, true), createQuizChoice(1)],
                    imageFiles: [],
                    audioFiles: [],
                    attachments: question.attachments ?? [],
                  }))
                : [createQuizQuestion(0)])
              : [],
          };
        })
    : [createLegacyPart(assignment, 0)];
}

function createAssignmentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `assignment-${crypto.randomUUID()}`;
  return `assignment-${Date.now()}`;
}

function emptyTemplate(): TemplateState {
  return {
    title: "",
    type: "",
    description: "",
    passageTitle: "",
    passageText: "",
    minRecordingSec: "3",
    maxRecordingSec: "120",
    audioFileName: "",
    audioUrl: "",
    imageUrl: "",
    imageFileName: "",
    writingMode: "picture_description",
    writingUnit: "paragraphs",
    promptText: "",
    writingInstructions: "",
    writingHint: "",
    writingExample: "",
    vocabularyRows: defaultVocabularyRows(),
    parts: [createPart("", 0)],
  };
}

function SelectedFilePreview({ kind, file }: { kind: "image" | "audio"; file: File }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="grid gap-2 rounded-md border border-line bg-white p-2">
      {kind === "image" && url && (
        <img
          src={url}
          alt={file.name}
          className="h-36 w-full rounded-md border border-line object-contain"
        />
      )}
      {kind === "audio" && url && (
        <audio controls src={url} className="w-full" />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-700">{file.name}</p>
        <p className="text-xs font-semibold text-slate-500">{formatFileSize(file.size)}</p>
      </div>
    </div>
  );
}

function AttachmentPreview({ kind, attachment }: { kind: "image" | "audio"; attachment: AssignmentPartAttachmentState }) {
  const fileName = attachment.fileName || "파일 열기";
  const fileUrl = attachment.fileUrl || "";
  const fileSize = typeof attachment.fileSizeBytes === "number" ? formatFileSize(attachment.fileSizeBytes) : "";

  return (
    <div className="grid gap-2 rounded-md border border-line bg-white p-2">
      {kind === "image" && fileUrl && (
        <a href={fileUrl} target="_blank" rel="noreferrer" aria-label={`${fileName} 새 창으로 열기`}>
          <img
            src={fileUrl}
            alt={fileName}
            className="h-36 w-full rounded-md border border-line object-contain"
          />
        </a>
      )}
      {kind === "audio" && fileUrl && (
        <audio controls src={fileUrl} className="w-full" />
      )}
      {fileUrl ? (
        <a href={fileUrl} target="_blank" rel="noreferrer" className="truncate text-xs font-semibold text-action underline-offset-2 hover:underline">
          {fileName}
        </a>
      ) : (
        <p className="truncate text-xs font-semibold text-slate-700">{fileName}</p>
      )}
      {fileSize && <p className="text-xs font-semibold text-slate-500">{fileSize}</p>}
    </div>
  );
}

function PartFileSummary({
  kind,
  selectedFiles,
  attachments,
}: {
  kind: "image" | "audio";
  selectedFiles: File[];
  attachments: AssignmentPartAttachmentState[];
}) {
  const selectedTotalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const savedTotalBytes = attachments.reduce((sum, attachment) => sum + (attachment.fileSizeBytes ?? 0), 0);

  if (selectedFiles.length > 0) {
    return (
      <div className="grid gap-3 rounded-md border border-line bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-bold text-slate-700">새로 선택한 파일 {selectedFiles.length}개 · 총 {formatFileSize(selectedTotalBytes)}</p>
        <div className="grid gap-2">
          {selectedFiles.map((file) => (
            <SelectedFilePreview key={`${file.name}-${file.size}-${file.lastModified}`} kind={kind} file={file} />
          ))}
        </div>
        {attachments.length > 0 && <p className="text-slate-500">저장하면 기존 {kind === "image" ? "이미지" : "오디오"} 파일을 교체합니다.</p>}
      </div>
    );
  }

  if (attachments.length === 0) {
    return <p className="rounded-md border border-dashed border-line bg-white px-3 py-2 text-xs font-semibold text-slate-500">저장된 파일이 없습니다.</p>;
  }

  return (
    <div className="grid gap-3 rounded-md border border-line bg-slate-50 p-3 text-xs text-slate-600">
      <p className="font-bold text-slate-700">
        저장된 파일 {attachments.length}개{savedTotalBytes > 0 ? ` · 총 ${formatFileSize(savedTotalBytes)}` : ""}
      </p>
      <div className="grid gap-2">
        {attachments.map((attachment) => (
          <AttachmentPreview key={attachment.id} kind={kind} attachment={attachment} />
        ))}
      </div>
    </div>
  );
}

function SaveAlertModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={onClose}>확인</Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>취소</Button>
          <Button type="button" variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function responseErrorMessage(data: unknown, response?: Response, responseText = "") {
  const fallback = "입력한 내용을 확인한 뒤 다시 시도해주세요.";
  if (response?.status === 413) {
    return [
      "첨부 파일 용량이 서버에서 허용하는 요청 크기를 초과했습니다.",
      `한 번에 저장 가능한 첨부 파일 합계는 약 ${formatFileSize(MAX_ASSIGNMENT_UPLOAD_BYTES)} 이하로 맞춰주세요.`,
      "이미지나 오디오를 압축하거나 파일 개수를 줄인 뒤 다시 저장해주세요.",
      "HTTP 413",
    ].join("\n");
  }
  const lines: string[] = [];
  if (response) lines.push(`HTTP ${response.status}`);
  if (data && typeof data === "object") {
    const error = (data as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) lines.push(error.trim());
    if (Array.isArray(error)) {
      const messages = error.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      lines.push(...messages);
    }
    for (const key of ["code", "detail", "hint", "constraint", "table", "column"] as const) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) lines.push(`${key}: ${value.trim()}`);
    }
    if (lines.length > 0) return lines.join("\n");
  }
  if (response && response.status >= 400) {
    const plainText = responseText.trim();
    if (plainText && plainText.length < 300 && !plainText.startsWith("<")) return plainText;
    return `${fallback}\nHTTP ${response.status}`;
  }
  return fallback;
}

function hasAttachment(part: AssignmentPartState, kind: "image" | "audio") {
  return part.attachments.some((attachment) => attachment.attachmentType === kind);
}

function validatePart(part: AssignmentPartState, index: number) {
  const partName = part.title.trim() || `Part ${index + 1}`;
  const prefix = `${partName}(${partTypeLabel(part.partType)})`;
  const minCount = Number(part.minSubmissionCount);
  const maxCount = Number(part.maxSubmissionCount);

  if (!part.title.trim()) return `${prefix}: Part 제목을 입력해주세요.`;
  if (part.allowSubmission) {
    if (!Number.isFinite(minCount) || minCount < 0) return `${prefix}: 최소 제출 수를 0 이상으로 입력해주세요.`;
    if (!Number.isFinite(maxCount) || maxCount < 1) return `${prefix}: 최대 제출 수를 1 이상으로 입력해주세요.`;
    if (minCount > maxCount) return `${prefix}: 최소 제출 수는 최대 제출 수보다 클 수 없습니다.`;
  }

  if (part.partType === "listening" && part.audioFiles.length === 0 && !hasAttachment(part, "audio")) {
    return `${prefix}: 학생이 들을 오디오 파일을 업로드해주세요.`;
  }
  if (part.partType === "recording" && !part.scriptText.trim() && part.audioFiles.length === 0 && !hasAttachment(part, "audio")) {
    return `${prefix}: 읽고 녹음할 문장 또는 따라 말할 오디오 파일을 입력해주세요.`;
  }
  if (part.partType === "writing" && !part.scriptText.trim()) {
    return `${prefix}: 쓰기 주제 / 프롬프트를 입력해주세요.`;
  }
  if (part.partType === "photo_submission" && !part.instruction.trim() && !part.scriptText.trim()) {
    return `${prefix}: 사진 제출 안내 또는 사진 설명을 입력해주세요.`;
  }
  if ((part.partType === "vocabulary_example" || part.partType === "vocabulary_recording") && validVocabularyRows(part.vocabularyRows).length === 0) {
    return `${prefix}: 단어와 뜻이 입력된 항목을 1개 이상 추가해주세요.`;
  }
  if (part.partType === "quiz") {
    if (part.quizQuestions.length === 0) return `${prefix}: 퀴즈 문제를 1개 이상 추가해주세요.`;
    for (const [questionIndex, question] of part.quizQuestions.entries()) {
      if (!question.questionText.trim()) return `${prefix} Q${questionIndex + 1}: 문제 문장을 입력해주세요.`;
      const choices = question.choices.filter((choice) => choice.choiceText.trim());
      if (choices.length < 2) return `${prefix} Q${questionIndex + 1}: 선택지를 2개 이상 입력해주세요.`;
      if (choices.filter((choice) => choice.isCorrect).length !== 1) return `${prefix} Q${questionIndex + 1}: 정답을 정확히 1개 선택해주세요.`;
    }
  }

  return null;
}

function validateTemplate(template: TemplateState) {
  if (!template.title.trim()) return "숙제 제목을 입력해주세요.";
  for (let index = 0; index < template.parts.length; index += 1) {
    const partError = validatePart(template.parts[index], index);
    if (partError) return partError;
  }
  return null;
}

function validateUploadSize(template: TemplateState) {
  let totalBytes = 0;

  for (const [index, part] of template.parts.entries()) {
    const partName = part.title.trim() || `Part ${index + 1}`;

    for (const file of part.imageFiles) {
      totalBytes += file.size;
      if (!isSupportedImageFile(file)) {
        return `${partName}: 이미지 파일 "${file.name}"의 형식을 확인해주세요.\n현재 확장자: ${fileExtension(file.name) || "없음"}\n브라우저 파일 타입: ${file.type || "없음"}\n업로드 가능한 이미지 형식: ${SUPPORTED_IMAGE_EXTENSIONS}`;
      }
      if (file.size > MAX_IMAGE_FILE_BYTES) {
        return `${partName}: 이미지 파일 "${file.name}"의 용량이 ${formatFileSize(file.size)}입니다.\n이미지는 1개당 최대 ${formatFileSize(MAX_IMAGE_FILE_BYTES)}까지 업로드할 수 있습니다.`;
      }
    }

    for (const file of part.audioFiles) {
      totalBytes += file.size;
      if (!isSupportedAudioFile(file)) {
        return `${partName}: 오디오 파일 "${file.name}"의 형식을 확인해주세요.\n현재 확장자: ${fileExtension(file.name) || "없음"}\n브라우저 파일 타입: ${file.type || "없음"}\n업로드 가능한 오디오 형식: ${SUPPORTED_AUDIO_EXTENSIONS}`;
      }
      if (file.size > MAX_AUDIO_FILE_BYTES) {
        return `${partName}: 오디오 파일 "${file.name}"의 용량이 ${formatFileSize(file.size)}입니다.\n오디오는 1개당 최대 ${formatFileSize(MAX_AUDIO_FILE_BYTES)}까지 업로드할 수 있습니다.`;
      }
    }

    for (const [questionIndex, question] of part.quizQuestions.entries()) {
      const questionName = `${partName} Q${questionIndex + 1}`;
      for (const file of question.imageFiles) {
        totalBytes += file.size;
        if (!isSupportedImageFile(file)) return `${questionName}: 이미지 파일 "${file.name}"의 형식을 확인해주세요.`;
        if (file.size > MAX_IMAGE_FILE_BYTES) return `${questionName}: 이미지는 1개당 최대 ${formatFileSize(MAX_IMAGE_FILE_BYTES)}까지 업로드할 수 있습니다.`;
      }
      for (const file of question.audioFiles) {
        totalBytes += file.size;
        if (!isSupportedAudioFile(file)) return `${questionName}: 오디오 파일 "${file.name}"의 형식을 확인해주세요.`;
        if (file.size > MAX_AUDIO_FILE_BYTES) return `${questionName}: 오디오는 1개당 최대 ${formatFileSize(MAX_AUDIO_FILE_BYTES)}까지 업로드할 수 있습니다.`;
      }
    }
  }

  if (totalBytes > MAX_ASSIGNMENT_UPLOAD_BYTES) {
    return `첨부 파일 총 용량이 너무 큽니다.\n현재 선택한 파일 합계: ${formatFileSize(totalBytes)}\n한 번에 저장 가능한 첨부 파일 합계: ${formatFileSize(MAX_ASSIGNMENT_UPLOAD_BYTES)} 이하\n\n이미지나 오디오를 압축하거나, 파일 개수를 줄인 뒤 다시 저장해주세요.`;
  }

  return null;
}

export default function NewAssignmentPage() {
  return (
    <Suspense fallback={<TeacherLayout title="숙제 생성"><Card><p className="text-sm text-slate-500">숙제 작성 화면을 불러오는 중입니다.</p></Card></TeacherLayout>}>
      <NewAssignmentForm />
    </Suspense>
  );
}

function NewAssignmentForm() {
  const searchParams = useSearchParams();
  const routeAssignmentId = searchParams.get("assignmentId");
  const isEditMode = Boolean(routeAssignmentId);
  const [newAssignmentId] = useState(createAssignmentId);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [partDeleteIndex, setPartDeleteIndex] = useState<number | null>(null);
  const [quizQuestionDeleteTarget, setQuizQuestionDeleteTarget] = useState<{ partIndex: number; questionIndex: number } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [template, setTemplate] = useState<TemplateState>(emptyTemplate);

  const currentAssignmentId = routeAssignmentId ?? newAssignmentId;
  const isVocabulary = template.parts.some((part) => part.partType === "vocabulary_example" || part.partType === "vocabulary_recording");

  useEffect(() => {
    if (!routeAssignmentId) return;
    let ignore = false;

    async function loadAssignment() {
      const response = await fetch(`/api/teacher/assignments?id=${encodeURIComponent(routeAssignmentId!)}`, { cache: "no-store" });
      const data = await response.json();
      if (ignore || !data.assignment) return;

      setTemplate({
        title: data.assignment.title ?? "",
        type: data.assignment.type ?? "listening_recording",
        description: data.assignment.description ?? "",
        passageTitle: data.assignment.item?.title ?? "",
        passageText: data.assignment.item?.passageText ?? "",
        minRecordingSec: String(data.assignment.item?.minRecordingSec ?? "3"),
        maxRecordingSec: String(data.assignment.item?.maxRecordingSec ?? "120"),
        audioFileName: data.assignment.item?.audioFileName ?? "",
        audioUrl: data.assignment.item?.audioUrl ?? "",
        imageUrl: data.assignment.imageUrl || "",
        imageFileName: data.assignment.imageFileName ?? "",
        writingMode: data.assignment.item?.writingMode ?? "picture_description",
        writingUnit: data.assignment.item?.writingUnit ?? "paragraphs",
        promptText: data.assignment.item?.promptText ?? "",
        writingInstructions: data.assignment.item?.writingInstructions ?? "",
        writingHint: data.assignment.item?.writingHint ?? "",
        writingExample: data.assignment.item?.writingExample ?? "",
        vocabularyRows: data.assignment.vocabularyItems?.length
          ? data.assignment.vocabularyItems.map((item: { word: string; meaning: string }) => ({ word: item.word, meaning: item.meaning }))
          : emptyTemplate().vocabularyRows,
        parts: assignmentPartsFromApi(data.assignment),
      });
    }

    loadAssignment().catch(() => setAlert({
      title: "숙제를 불러오지 못했습니다",
      message: "잠시 후 다시 시도해주세요.",
    }));
    return () => {
      ignore = true;
    };
  }, [routeAssignmentId]);

  function addPart() {
    setTemplate((current) => ({
      ...current,
      parts: [...current.parts, createPart("", current.parts.length)],
    }));
  }

  function updatePart(index: number, patch: Partial<AssignmentPartState>) {
    setTemplate((current) => ({
      ...current,
      parts: current.parts.map((part, partIndex) => {
        if (partIndex !== index) return part;
        const nextPart = { ...part, ...patch };
        if (patch.partType) {
          nextPart.allowSubmission = partAllowsSubmission(patch.partType);
          nextPart.minSubmissionCount = partAllowsSubmission(patch.partType) ? "1" : "0";
          nextPart.maxSubmissionCount = "1";
          nextPart.vocabularyRows = patch.partType === "vocabulary_example" || patch.partType === "vocabulary_recording"
            ? (part.vocabularyRows.length ? part.vocabularyRows : defaultVocabularyRows())
            : [];
          nextPart.quizQuestions = patch.partType === "quiz"
            ? (part.quizQuestions.length ? part.quizQuestions : [createQuizQuestion(0)])
            : [];
        }
        return nextPart;
      }),
    }));
  }

  function updatePartFiles(index: number, kind: "imageFiles" | "audioFiles", files: FileList | null) {
    setTemplate((current) => ({
      ...current,
      parts: current.parts.map((part, partIndex) => (
        partIndex === index ? { ...part, [kind]: Array.from(files ?? []) } : part
      )),
    }));
  }

  function removePart(index: number) {
    setTemplate((current) => ({
      ...current,
      parts: current.parts.length <= 1
        ? current.parts
        : current.parts.filter((_, partIndex) => partIndex !== index),
    }));
  }

  function confirmRemovePart() {
    if (partDeleteIndex === null) return;
    removePart(partDeleteIndex);
    setPartDeleteIndex(null);
  }

  function addVocabularyRow(partIndex: number) {
    updatePart(partIndex, {
      vocabularyRows: [...template.parts[partIndex].vocabularyRows, { word: "", meaning: "" }],
    });
  }

  function updateVocabularyRow(partIndex: number, rowIndex: number, patch: Partial<VocabularyRow>) {
    const part = template.parts[partIndex];
    updatePart(partIndex, {
      vocabularyRows: part.vocabularyRows.map((row, index) => index === rowIndex ? { ...row, ...patch } : row),
    });
  }

  function removeVocabularyRow(partIndex: number, rowIndex: number) {
    const part = template.parts[partIndex];
    updatePart(partIndex, {
      vocabularyRows: part.vocabularyRows.filter((_, index) => index !== rowIndex),
    });
  }

  function updateQuizQuestion(partIndex: number, questionIndex: number, patch: Partial<QuizQuestionState>) {
    const part = template.parts[partIndex];
    updatePart(partIndex, {
      quizQuestions: part.quizQuestions.map((question, index) => index === questionIndex ? { ...question, ...patch } : question),
    });
  }

  function addQuizQuestion(partIndex: number) {
    const part = template.parts[partIndex];
    updatePart(partIndex, {
      quizQuestions: [...part.quizQuestions, createQuizQuestion(part.quizQuestions.length)],
    });
  }

  function removeQuizQuestion(partIndex: number, questionIndex: number) {
    const part = template.parts[partIndex];
    updatePart(partIndex, {
      quizQuestions: part.quizQuestions.length <= 1
        ? part.quizQuestions
        : part.quizQuestions.filter((_, index) => index !== questionIndex),
    });
  }

  function confirmRemoveQuizQuestion() {
    if (!quizQuestionDeleteTarget) return;
    removeQuizQuestion(quizQuestionDeleteTarget.partIndex, quizQuestionDeleteTarget.questionIndex);
    setQuizQuestionDeleteTarget(null);
  }

  function updateQuizChoice(partIndex: number, questionIndex: number, choiceIndex: number, patch: Partial<QuizChoiceState>) {
    const question = template.parts[partIndex].quizQuestions[questionIndex];
    updateQuizQuestion(partIndex, questionIndex, {
      choices: question.choices.map((choice, index) => index === choiceIndex ? { ...choice, ...patch } : choice),
    });
  }

  function setCorrectQuizChoice(partIndex: number, questionIndex: number, choiceIndex: number) {
    const question = template.parts[partIndex].quizQuestions[questionIndex];
    updateQuizQuestion(partIndex, questionIndex, {
      choices: question.choices.map((choice, index) => ({ ...choice, isCorrect: index === choiceIndex })),
    });
  }

  function addQuizChoice(partIndex: number, questionIndex: number) {
    const question = template.parts[partIndex].quizQuestions[questionIndex];
    if (question.choices.length >= 6) return;
    updateQuizQuestion(partIndex, questionIndex, {
      choices: [...question.choices, createQuizChoice(question.choices.length)],
    });
  }

  function removeQuizChoice(partIndex: number, questionIndex: number, choiceIndex: number) {
    const question = template.parts[partIndex].quizQuestions[questionIndex];
    if (question.choices.length <= 2) return;
    const nextChoices = question.choices.filter((_, index) => index !== choiceIndex).map((choice, index) => ({
      ...choice,
      choiceLabel: String(index + 1),
    }));
    if (!nextChoices.some((choice) => choice.isCorrect)) nextChoices[0].isCorrect = true;
    updateQuizQuestion(partIndex, questionIndex, { choices: nextChoices });
  }

  function updateQuizQuestionFiles(partIndex: number, questionIndex: number, kind: "imageFiles" | "audioFiles", files: FileList | null) {
    updateQuizQuestion(partIndex, questionIndex, { [kind]: Array.from(files ?? []) } as Partial<QuizQuestionState>);
  }

  function saveAssignment() {
    const validationError = validateTemplate(template);
    if (validationError) {
      setAlert({
        title: "입력되지 않은 항목이 있습니다",
        message: validationError,
      });
      return;
    }
    const uploadSizeError = validateUploadSize(template);
    if (uploadSizeError) {
      setAlert({
        title: "첨부 파일 용량이 너무 큽니다",
        message: uploadSizeError,
      });
      return;
    }
    const effectiveType = assignmentTypeForParts(template.parts);
    const vocabularyRows = template.parts.flatMap((part) => validVocabularyRows(part.vocabularyRows));
    if (isVocabulary && vocabularyRows.length === 0) {
      setAlert({
        title: "입력되지 않은 항목이 있습니다",
        message: "단어장 Part에는 단어와 뜻이 입력된 항목이 1개 이상 필요합니다.",
      });
      return;
    }

    startSaving(async () => {
      const formData = new FormData();
      formData.set("id", currentAssignmentId);
      formData.set("title", template.title);
      formData.set("type", effectiveType);
      formData.set("description", template.description);
      formData.set("passageTitle", template.title);
      formData.set("passageText", template.description);
      formData.set("minRecordingSec", "0");
      formData.set("maxRecordingSec", "120");
      formData.set("audioFileName", template.audioFileName);
      formData.set("writingMode", template.writingMode);
      formData.set("writingUnit", template.writingUnit);
      formData.set("writingUnitCount", "4");
      formData.set("promptText", "");
      formData.set("writingInstructions", "");
      formData.set("writingHint", template.writingHint);
      formData.set("writingExample", template.writingExample);
      formData.set("vocabularyItems", JSON.stringify(vocabularyRows.map((row, index) => ({ ...row, orderIndex: index }))));
      formData.set("parts", JSON.stringify(template.parts.map((part, index) => ({
        id: part.id,
        partType: part.partType,
        title: part.title,
        instruction: part.instruction,
        scriptText: part.scriptText,
        writingMode: part.writingMode,
        writingUnit: part.writingUnit,
        writingHint: part.writingHint,
        writingExample: part.writingExample,
        vocabularyRows: validVocabularyRows(part.vocabularyRows),
        quizQuestions: part.partType === "quiz"
          ? part.quizQuestions.map((question, questionIndex) => ({
              id: question.id,
              questionText: question.questionText,
              explanation: question.explanation,
              orderIndex: questionIndex,
              choices: question.choices.map((choice, choiceIndex) => ({
                id: choice.id,
                choiceLabel: choice.choiceLabel || String(choiceIndex + 1),
                choiceText: choice.choiceText,
                isCorrect: choice.isCorrect,
                incorrectReason: choice.incorrectReason,
                orderIndex: choiceIndex,
              })),
            }))
          : [],
        isRequired: part.isRequired,
        allowSubmission: part.allowSubmission,
        minSubmissionCount: Number(part.minSubmissionCount),
        maxSubmissionCount: Number(part.maxSubmissionCount),
        orderIndex: index,
      }))));
      template.parts.forEach((part, index) => {
        part.imageFiles.forEach((file) => formData.append(`partImageFiles[${index}]`, file, file.name));
        part.audioFiles.forEach((file) => formData.append(`partAudioFiles[${index}]`, file, file.name));
        part.quizQuestions.forEach((question, questionIndex) => {
          question.imageFiles.forEach((file) => formData.append(`quizQuestionImageFiles[${index}][${questionIndex}]`, file, file.name));
          question.audioFiles.forEach((file) => formData.append(`quizQuestionAudioFiles[${index}][${questionIndex}]`, file, file.name));
        });
      });
      const response = await fetch("/api/teacher/assignments", { method: "POST", body: formData });
      const responseText = await response.text();
      let data: { assignment?: { item?: { audioFileName?: string; audioUrl?: string }; imageUrl?: string; imageFileName?: string } } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {};
      }
      const savedAssignment = data.assignment;
      if (savedAssignment) {
        setTemplate((current) => ({
          ...current,
          audioFileName: savedAssignment.item?.audioFileName ?? current.audioFileName,
          audioUrl: savedAssignment.item?.audioUrl ?? current.audioUrl,
          imageUrl: savedAssignment.imageUrl || current.imageUrl,
          imageFileName: savedAssignment.imageFileName ?? current.imageFileName,
          parts: assignmentPartsFromApi(savedAssignment),
        }));
      }
      if (!response.ok) {
        setAlert({
          title: "숙제를 저장하지 못했습니다",
          message: responseErrorMessage(data, response, responseText),
        });
        return;
      }
      setAlert({
        title: isEditMode ? "숙제를 수정했습니다" : "숙제를 생성했습니다",
        message: isEditMode ? "변경한 내용이 저장되었습니다." : "숙제 목록에서 반과 과목을 선택해 배정해주세요.",
      });
    });
  }

  return (
    <TeacherLayout title={isEditMode ? "숙제 수정" : "숙제 생성"}>
      <div className="grid gap-5">
        <Card>
          <div className="mb-5">
            <h2 className="text-xl font-bold">숙제 내용</h2>
            <p className="mt-1 text-sm text-slate-500">과목은 숙제 생성이 아니라 반에 배정할 때 선택합니다.</p>
          </div>
          <div className="grid gap-5">
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                숙제 제목
                <Input value={template.title} onChange={(event) => setTemplate({ ...template, title: event.target.value })} />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold">
              설명
              <Textarea value={template.description} onChange={(event) => setTemplate({ ...template, description: event.target.value })} />
            </label>

            <section className="grid gap-3 rounded-lg border border-line bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold">파트 구성</h3>
                  <p className="mt-1 text-sm text-slate-500">+ 버튼으로 학생이 진행할 파트를 여러 개 추가할 수 있습니다.</p>
                </div>
                <Button type="button" variant="secondary" onClick={addPart}>+ 파트 추가</Button>
              </div>

              <div className="grid gap-3">
                {template.parts.map((part, index) => (
                  <article key={part.id ?? index} className="grid gap-4 rounded-lg border border-line bg-white p-4">
                    {(() => {
                      const copy = partFieldCopy(part.partType);
                      return (
                        <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="blue">Part {index + 1}</Badge>
                        <Badge tone="green">{partTypeLabel(part.partType)}</Badge>
                      </div>
                      <Button type="button" variant="danger" onClick={() => setPartDeleteIndex(index)} disabled={template.parts.length <= 1}>삭제</Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold">
                        파트 유형
                        <Select value={part.partType} onChange={(event) => updatePart(index, { partType: event.target.value as AssignmentPartType })}>
                          {assignmentPartTypes.map((type) => <option key={type} value={type}>{partTypeLabel(type)}</option>)}
                        </Select>
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">
                        파트 제목
                        <Input value={part.title} onChange={(event) => updatePart(index, { title: event.target.value })} />
                      </label>
                    </div>

                    <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">{copy.helper}</p>

                    {part.partType === "writing" && (
                      <div className="grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="grid gap-2 text-sm font-semibold">
                            Writing 방식
                            <Select value={part.writingMode} onChange={(event) => updatePart(index, { writingMode: event.target.value as WritingMode })}>
                              <option value="picture_description">그림 묘사</option>
                              <option value="topic_diary">주제/일기 쓰기</option>
                            </Select>
                          </label>
                          <label className="grid gap-2 text-sm font-semibold">
                            작성 단위
                            <Select value={part.writingUnit} onChange={(event) => updatePart(index, { writingUnit: event.target.value as WritingUnit })}>
                              <option value="paragraphs">4 paragraphs</option>
                              <option value="sentences">4 sentences</option>
                            </Select>
                          </label>
                        </div>
                        <label className="grid gap-2 text-sm font-semibold">
                          힌트
                          <Textarea value={part.writingHint} onChange={(event) => updatePart(index, { writingHint: event.target.value })} />
                        </label>
                        <label className="grid gap-2 text-sm font-semibold">
                          예시 답안
                          <Textarea value={part.writingExample} onChange={(event) => updatePart(index, { writingExample: event.target.value })} />
                        </label>
                      </div>
                    )}

                    {(part.partType === "vocabulary_example" || part.partType === "vocabulary_recording") && (
                      <section className="grid gap-3 rounded-md border border-line bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-bold">단어 목록</h4>
                          <Button type="button" variant="secondary" onClick={() => addVocabularyRow(index)}>단어 추가</Button>
                        </div>
                        <div className="grid gap-2">
                          {part.vocabularyRows.map((row, rowIndex) => (
                            <div key={rowIndex} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                              <Input value={row.word} onChange={(event) => updateVocabularyRow(index, rowIndex, { word: event.target.value })} placeholder="단어" />
                              <Input value={row.meaning} onChange={(event) => updateVocabularyRow(index, rowIndex, { meaning: event.target.value })} placeholder="뜻" />
                              <Button type="button" variant="secondary" onClick={() => removeVocabularyRow(index, rowIndex)}>삭제</Button>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {part.partType === "quiz" && (
                      <section className="grid gap-4 rounded-md border border-line bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="font-bold">퀴즈 문제 목록</h4>
                          <Button type="button" variant="secondary" onClick={() => addQuizQuestion(index)}>문제 추가</Button>
                        </div>
                        {part.quizQuestions.map((question, questionIndex) => (
                          <article key={question.id ?? questionIndex} className="grid gap-4 rounded-lg border border-line bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <Badge tone="blue">Q{questionIndex + 1}</Badge>
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => setQuizQuestionDeleteTarget({ partIndex: index, questionIndex })}
                                disabled={part.quizQuestions.length <= 1}
                              >
                                문제 삭제
                              </Button>
                            </div>
                            <label className="grid gap-2 text-sm font-semibold">
                              문제 문장
                              <Textarea value={question.questionText} onChange={(event) => updateQuizQuestion(index, questionIndex, { questionText: event.target.value })} placeholder="_pple 안에 들어갈 알파벳을 고르시오." />
                            </label>
                            <label className="grid gap-2 text-sm font-semibold">
                              정답 설명
                              <Textarea value={question.explanation} onChange={(event) => updateQuizQuestion(index, questionIndex, { explanation: event.target.value })} placeholder="apple은 a로 시작합니다." />
                            </label>
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="grid gap-2 text-sm font-semibold">
                                문제 이미지
                                <Input type="file" accept="image/*,.heic,.heif,.bmp,.tif,.tiff,.svg" onChange={(event) => updateQuizQuestionFiles(index, questionIndex, "imageFiles", event.target.files)} />
                                <PartFileSummary
                                  kind="image"
                                  selectedFiles={question.imageFiles}
                                  attachments={question.attachments.filter((attachment) => attachment.attachmentType === "image")}
                                />
                              </label>
                              <label className="grid gap-2 text-sm font-semibold">
                                문제 오디오
                                <Input type="file" accept="audio/*,.m4a,.aac,.aif,.aiff,.caf,.flac,.amr,.oga,.ogg,.webm,.wav,.mp3" onChange={(event) => updateQuizQuestionFiles(index, questionIndex, "audioFiles", event.target.files)} />
                                <PartFileSummary
                                  kind="audio"
                                  selectedFiles={question.audioFiles}
                                  attachments={question.attachments.filter((attachment) => attachment.attachmentType === "audio")}
                                />
                              </label>
                            </div>
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between gap-3">
                                <h5 className="font-bold">선택지</h5>
                                <Button type="button" variant="secondary" onClick={() => addQuizChoice(index, questionIndex)} disabled={question.choices.length >= 6}>선택지 추가</Button>
                              </div>
                              {question.choices.map((choice, choiceIndex) => (
                                <div key={choice.id ?? choiceIndex} className="grid gap-2 rounded-md border border-line bg-slate-50 p-3 lg:grid-cols-[auto_56px_1fr_1.4fr_auto] lg:items-center">
                                  <label className="flex items-center gap-2 text-sm font-bold">
                                    <input type="radio" checked={choice.isCorrect} onChange={() => setCorrectQuizChoice(index, questionIndex, choiceIndex)} />
                                    정답
                                  </label>
                                  <Input value={choice.choiceLabel} onChange={(event) => updateQuizChoice(index, questionIndex, choiceIndex, { choiceLabel: event.target.value })} placeholder="1" />
                                  <Input value={choice.choiceText} onChange={(event) => updateQuizChoice(index, questionIndex, choiceIndex, { choiceText: event.target.value })} placeholder="a" />
                                  <Input value={choice.incorrectReason} onChange={(event) => updateQuizChoice(index, questionIndex, choiceIndex, { incorrectReason: event.target.value })} placeholder="오답 이유" />
                                  <Button type="button" variant="secondary" onClick={() => removeQuizChoice(index, questionIndex, choiceIndex)} disabled={question.choices.length <= 2}>삭제</Button>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </section>
                    )}

                    <label className="grid gap-2 text-sm font-semibold">
                      {copy.instructionLabel}
                      <Textarea value={part.instruction} onChange={(event) => updatePart(index, { instruction: event.target.value })} />
                    </label>

                    {part.partType !== "quiz" && (
                      <>
                        <label className="grid gap-2 text-sm font-semibold">
                          {copy.scriptLabel}
                          <Textarea value={part.scriptText} onChange={(event) => updatePart(index, { scriptText: event.target.value })} />
                        </label>

                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="grid gap-2 text-sm font-semibold">
                            {copy.imageLabel}
                            <Input type="file" accept="image/*,.heic,.heif,.bmp,.tif,.tiff,.svg" multiple onChange={(event) => updatePartFiles(index, "imageFiles", event.target.files)} />
                            <p className="text-xs font-semibold text-slate-500">
                              이미지 1개당 최대 {formatFileSize(MAX_IMAGE_FILE_BYTES)}, 첨부 전체 최대 {formatFileSize(MAX_ASSIGNMENT_UPLOAD_BYTES)}
                            </p>
                            <PartFileSummary
                              kind="image"
                              selectedFiles={part.imageFiles}
                              attachments={part.attachments.filter((attachment) => attachment.attachmentType === "image")}
                            />
                          </label>
                          <label className="grid gap-2 text-sm font-semibold">
                            {copy.audioLabel}
                            <Input type="file" accept="audio/*,.m4a,.aac,.aif,.aiff,.caf,.flac,.amr,.oga,.ogg,.webm,.wav,.mp3" multiple onChange={(event) => updatePartFiles(index, "audioFiles", event.target.files)} />
                            <p className="text-xs font-semibold text-slate-500">
                              오디오 1개당 최대 {formatFileSize(MAX_AUDIO_FILE_BYTES)}, 첨부 전체 최대 {formatFileSize(MAX_ASSIGNMENT_UPLOAD_BYTES)}
                            </p>
                            <PartFileSummary
                              kind="audio"
                              selectedFiles={part.audioFiles}
                              attachments={part.attachments.filter((attachment) => attachment.attachmentType === "audio")}
                            />
                          </label>
                        </div>
                      </>
                    )}

                    {part.partType !== "quiz" && (
                      <div className={`grid gap-4 ${part.allowSubmission ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input type="checkbox" checked={part.isRequired} onChange={(event) => updatePart(index, { isRequired: event.target.checked })} />
                          필수 파트
                        </label>
                        {part.allowSubmission && (
                          <>
                            <label className="grid gap-2 text-sm font-semibold">
                              최소 {copy.submitLabel}
                              <Input type="number" min="0" value={part.minSubmissionCount} onChange={(event) => updatePart(index, { minSubmissionCount: event.target.value })} />
                            </label>
                            <label className="grid gap-2 text-sm font-semibold">
                              최대 {copy.submitLabel}
                              <Input type="number" min="1" value={part.maxSubmissionCount} onChange={(event) => updatePart(index, { maxSubmissionCount: event.target.value })} />
                            </label>
                          </>
                        )}
                      </div>
                    )}
                        </>
                      );
                    })()}
                  </article>
                ))}
              </div>
            </section>

            <div className="flex justify-end gap-2">
              <Button href="/teacher/assignments" variant="secondary">취소</Button>
              <Button type="button" onClick={saveAssignment} disabled={isSaving}>{isSaving ? "저장 중..." : "저장"}</Button>
            </div>
          </div>
        </Card>
      </div>
      {alert && <SaveAlertModal title={alert.title} message={alert.message} onClose={() => setAlert(null)} />}
      {partDeleteIndex !== null && (
        <ConfirmModal
          title="Part를 삭제하시겠습니까?"
          message={`${template.parts[partDeleteIndex]?.title || `Part ${partDeleteIndex + 1}`}를 삭제합니다. 저장 전까지는 화면에서만 삭제된 상태입니다.`}
          confirmLabel="삭제"
          onCancel={() => setPartDeleteIndex(null)}
          onConfirm={confirmRemovePart}
        />
      )}
      {quizQuestionDeleteTarget && (
        <ConfirmModal
          title="문제를 삭제하시겠습니까?"
          message={`${template.parts[quizQuestionDeleteTarget.partIndex]?.title || `Part ${quizQuestionDeleteTarget.partIndex + 1}`}의 Q${quizQuestionDeleteTarget.questionIndex + 1} 문제를 삭제합니다. 저장 전까지는 화면에서만 삭제된 상태입니다.`}
          confirmLabel="삭제"
          onCancel={() => setQuizQuestionDeleteTarget(null)}
          onConfirm={confirmRemoveQuizQuestion}
        />
      )}
    </TeacherLayout>
  );
}
