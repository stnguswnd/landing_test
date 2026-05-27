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
import { assignmentTypeLabel, type AssignmentType, type WritingMode, type WritingUnit } from "@/lib/assignmentTypes";

type VocabularyRow = {
  word: string;
  meaning: string;
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
};

const assignmentTypes: AssignmentType[] = ["listening_recording", "listening", "writing", "vocabulary_example", "vocabulary_recording"];

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
    vocabularyRows: [
      { word: "apple", meaning: "사과" },
      { word: "library", meaning: "도서관" },
    ],
  };
}

function FileStatus({
  label,
  fileName,
  url,
  kind,
  pendingFileName,
}: {
  label: string;
  fileName?: string;
  url?: string;
  kind: "image" | "audio";
  pendingFileName?: string;
}) {
  if (!fileName && !url) {
    return <p className="rounded-md border border-dashed border-line bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">저장된 파일이 없습니다.</p>;
  }

  return (
    <div className="grid gap-2 rounded-md border border-line bg-slate-50 p-3 text-xs text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-slate-700">{pendingFileName ? "새로 선택한 파일" : label}</span>
        <span className="max-w-full truncate font-semibold">{fileName || "파일명 없음"}</span>
      </div>
      {pendingFileName && <p className="text-slate-500">저장하면 기존 파일이 이 파일로 교체됩니다.</p>}
      {url && kind === "image" && (
        <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-line bg-white">
          <img src={url} alt={fileName || label} className="max-h-40 w-full object-contain" />
        </a>
      )}
      {url && kind === "audio" && <audio controls src={url} className="w-full" />}
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="font-bold text-action underline-offset-2 hover:underline">
          파일 열기
        </a>
      )}
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
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [template, setTemplate] = useState<TemplateState>(emptyTemplate);

  const currentAssignmentId = routeAssignmentId ?? newAssignmentId;
  const selectedType = template.type || "listening_recording";
  const isVocabulary = selectedType === "vocabulary_example" || selectedType === "vocabulary_recording";

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
      });
    }

    loadAssignment().catch(() => setMessage("숙제를 불러오지 못했습니다."));
    return () => {
      ignore = true;
    };
  }, [routeAssignmentId]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  function onImageFileChange(file?: File) {
    setImageFile(file ?? null);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : "");
  }

  function onAudioFileChange(file?: File) {
    setAudioFile(file ?? null);
    setAudioPreviewUrl(file ? URL.createObjectURL(file) : "");
  }

  function validVocabularyRows() {
    return template.vocabularyRows
      .map((row) => ({ word: row.word.trim(), meaning: row.meaning.trim() }))
      .filter((row) => row.word && row.meaning)
      .slice(0, 200);
  }

  function saveAssignment() {
    if (!template.type) {
      setMessage("숙제 유형을 선택해주세요.");
      return;
    }
    if (!template.title.trim()) {
      setMessage("숙제 제목을 입력해주세요.");
      return;
    }
    const vocabularyRows = validVocabularyRows();
    if (isVocabulary && vocabularyRows.length === 0) {
      setMessage("단어를 1개 이상 입력해주세요.");
      return;
    }

    startSaving(async () => {
      const formData = new FormData();
      formData.set("id", currentAssignmentId);
      formData.set("title", template.title);
      formData.set("type", template.type);
      formData.set("description", template.description);
      formData.set("passageTitle", template.passageTitle);
      formData.set("passageText", template.type === "writing" && template.writingMode === "topic_diary" ? template.promptText : template.passageText);
      formData.set("minRecordingSec", template.minRecordingSec);
      formData.set("maxRecordingSec", template.maxRecordingSec);
      formData.set("audioFileName", template.audioFileName);
      formData.set("writingMode", template.writingMode);
      formData.set("writingUnit", template.writingUnit);
      formData.set("writingUnitCount", "4");
      formData.set("promptText", template.promptText);
      formData.set("writingInstructions", template.writingInstructions);
      formData.set("writingHint", template.writingHint);
      formData.set("writingExample", template.writingExample);
      formData.set("vocabularyItems", JSON.stringify(vocabularyRows.map((row, index) => ({ ...row, orderIndex: index }))));
      if (imageFile) formData.set("imageFile", imageFile, imageFile.name);
      if (audioFile) formData.set("audioFile", audioFile, audioFile.name);

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
        setImageFile(null);
        setAudioFile(null);
        setImagePreviewUrl("");
        setAudioPreviewUrl("");
      }
      if (!response.ok) {
        setMessage(data.error ?? "숙제를 저장하지 못했습니다.");
        return;
      }
      setMessage(isEditMode ? "숙제를 수정했습니다." : "숙제를 생성했습니다. 숙제 목록에서 반과 과목을 선택해 배정해주세요.");
    });
  }

  return (
    <TeacherLayout title={isEditMode ? "숙제 수정" : "숙제 생성"}>
      <div className="grid gap-5">
        {message && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">{message}</p>}
        <Card>
          <div className="mb-5">
            <h2 className="text-xl font-bold">숙제 내용</h2>
            <p className="mt-1 text-sm text-slate-500">과목은 숙제 생성이 아니라 반에 배정할 때 선택합니다.</p>
          </div>
          <div className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                숙제 제목
                <Input value={template.title} onChange={(event) => setTemplate({ ...template, title: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                숙제 유형
                <Select value={template.type} onChange={(event) => setTemplate({ ...template, type: event.target.value as AssignmentType })} disabled={isEditMode}>
                  <option value="">유형 선택</option>
                  {assignmentTypes.map((type) => <option key={type} value={type}>{assignmentTypeLabel(type)}</option>)}
                </Select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold">
              설명
              <Textarea value={template.description} onChange={(event) => setTemplate({ ...template, description: event.target.value })} />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                지문 제목
                <Input value={template.passageTitle} onChange={(event) => setTemplate({ ...template, passageTitle: event.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-semibold">
                  최소 녹음 초
                  <Input type="number" value={template.minRecordingSec} onChange={(event) => setTemplate({ ...template, minRecordingSec: event.target.value })} />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  최대 녹음 초
                  <Input type="number" value={template.maxRecordingSec} onChange={(event) => setTemplate({ ...template, maxRecordingSec: event.target.value })} />
                </label>
              </div>
            </div>

            <label className="grid gap-2 text-sm font-semibold">
              지문 / 프롬프트
              <Textarea value={template.passageText} onChange={(event) => setTemplate({ ...template, passageText: event.target.value })} />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                이미지 파일
                <Input type="file" accept="image/*" onChange={(event) => onImageFileChange(event.target.files?.[0])} />
                <FileStatus
                  label="현재 저장된 이미지"
                  fileName={imageFile?.name ?? template.imageFileName}
                  url={imagePreviewUrl || template.imageUrl}
                  kind="image"
                  pendingFileName={imageFile?.name}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                오디오 파일
                <Input type="file" accept="audio/*" onChange={(event) => onAudioFileChange(event.target.files?.[0])} />
                <FileStatus
                  label="현재 저장된 오디오"
                  fileName={audioFile?.name ?? template.audioFileName}
                  url={audioPreviewUrl || template.audioUrl}
                  kind="audio"
                  pendingFileName={audioFile?.name}
                />
              </label>
            </div>

            {selectedType === "writing" && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Writing 방식
                  <Select value={template.writingMode} onChange={(event) => setTemplate({ ...template, writingMode: event.target.value as WritingMode })}>
                    <option value="picture_description">그림 묘사</option>
                    <option value="topic_diary">주제/일기 쓰기</option>
                  </Select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  작성 단위
                  <Select value={template.writingUnit} onChange={(event) => setTemplate({ ...template, writingUnit: event.target.value as WritingUnit })}>
                    <option value="paragraphs">4 paragraphs</option>
                    <option value="sentences">4 sentences</option>
                  </Select>
                </label>
              </div>
            )}

            {isVocabulary && (
              <section className="grid gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">단어 목록</h3>
                  <Button type="button" variant="secondary" onClick={() => setTemplate({ ...template, vocabularyRows: [...template.vocabularyRows, { word: "", meaning: "" }] })}>단어 추가</Button>
                </div>
                <div className="grid gap-2">
                  {template.vocabularyRows.map((row, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <Input value={row.word} onChange={(event) => setTemplate({ ...template, vocabularyRows: template.vocabularyRows.map((item, itemIndex) => itemIndex === index ? { ...item, word: event.target.value } : item) })} placeholder="단어" />
                      <Input value={row.meaning} onChange={(event) => setTemplate({ ...template, vocabularyRows: template.vocabularyRows.map((item, itemIndex) => itemIndex === index ? { ...item, meaning: event.target.value } : item) })} placeholder="뜻" />
                      <Button type="button" variant="secondary" onClick={() => setTemplate({ ...template, vocabularyRows: template.vocabularyRows.filter((_, itemIndex) => itemIndex !== index) })}>삭제</Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="flex justify-end gap-2">
              <Button href="/teacher/assignments" variant="secondary">취소</Button>
              <Button type="button" onClick={saveAssignment} disabled={isSaving}>{isSaving ? "저장 중..." : "저장"}</Button>
            </div>
          </div>
        </Card>
      </div>
    </TeacherLayout>
  );
}
