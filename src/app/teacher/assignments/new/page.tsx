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
  | "vocabulary_recording";

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
};

type AssignmentPartAttachmentState = {
  id: string;
  attachmentType: "image" | "audio" | "video" | "file";
  fileName?: string;
  fileUrl?: string;
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

const assignmentPartTypes: AssignmentPartType[] = ["recording", "listening", "writing", "vocabulary_example", "vocabulary_recording", "photo_submission"];

function partTypeLabel(type: AssignmentPartType) {
  if (type === "instruction") return "설명";
  if (type === "listening") return "리스닝";
  if (type === "recording") return "RL 녹음";
  if (type === "writing") return "라이팅";
  if (type === "photo_submission") return "사진 제출";
  if (type === "vocabulary_example") return "단어장 예문";
  return "단어장 녹음";
}

function partTypeForAssignmentType(type: AssignmentType | ""): AssignmentPartType {
  if (type === "listening") return "listening";
  if (type === "writing") return "writing";
  if (type === "photo_submission") return "photo_submission";
  if (type === "vocabulary_example") return "vocabulary_example";
  if (type === "vocabulary_recording") return "vocabulary_recording";
  return "recording";
}

function partAllowsSubmission(type: AssignmentPartType) {
  return type !== "instruction" && type !== "listening";
}

function defaultVocabularyRows(): VocabularyRow[] {
  return [
    { word: "apple", meaning: "사과" },
    { word: "library", meaning: "도서관" },
  ];
}

function partFieldCopy(type: AssignmentPartType) {
  if (type === "listening") {
    return {
      instructionLabel: "듣기 안내",
      scriptLabel: "리스닝 스크립트",
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
      helper: "기존 RL 녹음 숙제처럼 학생이 듣고 녹음합니다.",
      submitLabel: "녹음 파일 수",
    };
  }
  if (type === "writing") {
    return {
      instructionLabel: "라이팅 추가 지시문",
      scriptLabel: "주제 / 프롬프트",
      imageLabel: "라이팅 이미지",
      audioLabel: "예시 오디오 파일",
      helper: "기존 라이팅 숙제처럼 주제, 이미지, 지시문을 Part 안에 넣습니다.",
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
  };
}, index: number): AssignmentPartState {
  const part = createPart(data.type ?? "listening_recording", index);
  const scriptText = data.item?.passageText || data.item?.promptText || "";
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
  };
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

function PartFileSummary({
  kind,
  selectedFiles,
  attachments,
}: {
  kind: "image" | "audio";
  selectedFiles: File[];
  attachments: AssignmentPartAttachmentState[];
}) {
  if (selectedFiles.length > 0) {
    return (
      <div className="grid gap-2 rounded-md border border-line bg-white p-3 text-xs text-slate-600">
        <p className="font-bold text-slate-700">새로 선택한 파일 {selectedFiles.length}개</p>
        {selectedFiles.map((file) => <p key={`${file.name}-${file.size}`} className="truncate font-semibold">{file.name}</p>)}
        {attachments.length > 0 && <p className="text-slate-500">저장하면 기존 {kind === "image" ? "이미지" : "오디오"} 파일을 교체합니다.</p>}
      </div>
    );
  }

  if (attachments.length === 0) {
    return <p className="rounded-md border border-dashed border-line bg-white px-3 py-2 text-xs font-semibold text-slate-500">저장된 파일이 없습니다.</p>;
  }

  return (
    <div className="grid gap-2 rounded-md border border-line bg-white p-3 text-xs text-slate-600">
      <p className="font-bold text-slate-700">저장된 파일 {attachments.length}개</p>
      {attachments.map((attachment) => (
        <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="truncate font-semibold text-action underline-offset-2 hover:underline">
          {attachment.fileName || "파일 열기"}
        </a>
      ))}
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
        parts: data.assignment.parts?.length
          ? data.assignment.parts
              .filter((part: { status?: string }) => part.status !== "archived")
              .map((part: {
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
                attachments?: AssignmentPartAttachmentState[];
              }, index: number) => ({
                id: part.id,
                partType: part.partType ?? createPart(data.assignment.type ?? "listening_recording", index).partType,
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
                attachments: part.attachments ?? [],
              }))
          : [createLegacyPart(data.assignment, 0)],
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

  function validVocabularyRows(rows: VocabularyRow[]) {
    return rows
      .map((row) => ({ word: row.word.trim(), meaning: row.meaning.trim() }))
      .filter((row) => row.word && row.meaning)
      .slice(0, 200);
  }

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

  function saveAssignment() {
    if (!template.title.trim()) {
      setAlert({
        title: "입력되지 않은 항목이 있습니다",
        message: "숙제 제목을 입력해주세요.",
      });
      return;
    }
    const effectiveType: AssignmentType = "listening_recording";
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
        isRequired: part.isRequired,
        allowSubmission: part.allowSubmission,
        minSubmissionCount: Number(part.minSubmissionCount),
        maxSubmissionCount: Number(part.maxSubmissionCount),
        orderIndex: index,
      }))));
      template.parts.forEach((part, index) => {
        part.imageFiles.forEach((file) => formData.append(`partImageFiles[${index}]`, file, file.name));
        part.audioFiles.forEach((file) => formData.append(`partAudioFiles[${index}]`, file, file.name));
      });
      const response = await fetch("/api/teacher/assignments", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (data.assignment) {
        setTemplate((current) => ({
          ...current,
          audioFileName: data.assignment.item?.audioFileName ?? current.audioFileName,
          audioUrl: data.assignment.item?.audioUrl ?? current.audioUrl,
          imageUrl: data.assignment.imageUrl || current.imageUrl,
          imageFileName: data.assignment.imageFileName ?? current.imageFileName,
        }));
      }
      if (!response.ok) {
        setAlert({
          title: "숙제를 저장하지 못했습니다",
          message: data.error ?? "입력한 내용을 확인한 뒤 다시 시도해주세요.",
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
                      <Button type="button" variant="danger" onClick={() => removePart(index)} disabled={template.parts.length <= 1}>삭제</Button>
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

                    <label className="grid gap-2 text-sm font-semibold">
                      {copy.instructionLabel}
                      <Textarea value={part.instruction} onChange={(event) => updatePart(index, { instruction: event.target.value })} />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold">
                      {copy.scriptLabel}
                      <Textarea value={part.scriptText} onChange={(event) => updatePart(index, { scriptText: event.target.value })} />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold">
                        {copy.imageLabel}
                        <Input type="file" accept="image/*" multiple onChange={(event) => updatePartFiles(index, "imageFiles", event.target.files)} />
                        <PartFileSummary
                          kind="image"
                          selectedFiles={part.imageFiles}
                          attachments={part.attachments.filter((attachment) => attachment.attachmentType === "image")}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">
                        {copy.audioLabel}
                        <Input type="file" accept="audio/*" multiple onChange={(event) => updatePartFiles(index, "audioFiles", event.target.files)} />
                        <PartFileSummary
                          kind="audio"
                          selectedFiles={part.audioFiles}
                          attachments={part.attachments.filter((attachment) => attachment.attachmentType === "audio")}
                        />
                      </label>
                    </div>

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
    </TeacherLayout>
  );
}
