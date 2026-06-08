"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { saveAssignmentDraft, submitAssignmentDraft } from "@/features/assignments/api/assignmentDraftApi";
import { assignmentTypeFromPartType } from "@/features/assignments/assignmentType";
import { itemTypeForAssignmentType } from "@/lib/assignmentTypes";
import type { Assignment } from "@/types/assignment";
import { ListeningHomework } from "./ListeningHomework";
import type { PartSavePayload } from "./partMode";
import { PhotoSubmissionHomework } from "./PhotoSubmissionHomework";
import { QuizPartPlayer } from "./QuizPartPlayer";
import { RlRecordingHomework } from "./RlRecordingHomework";
import { VocabularyExampleHomework } from "./VocabularyExampleHomework";
import { VocabularyRecordingHomework } from "./VocabularyRecordingHomework";
import { WritingHomework } from "./WritingHomework";
import { SubmissionAlertModal } from "./SubmissionAlertModal";

type AssignmentPart = NonNullable<Assignment["parts"]>[number];

function partTypeLabel(type: AssignmentPart["partType"]) {
  if (type === "instruction") return "설명";
  if (type === "listening") return "듣기 숙제";
  if (type === "recording") return "녹음 제출 숙제";
  if (type === "writing") return "라이팅 숙제";
  if (type === "photo_submission") return "사진 제출 숙제";
  if (type === "quiz") return "퀴즈 숙제";
  if (type === "vocabulary_example") return "단어 예문 숙제";
  return "단어 녹음 숙제";
}

function assignmentForPart(assignment: Assignment, part: AssignmentPart, assignmentType: Assignment["assignmentType"]): Assignment {
  const image = (part.attachments ?? []).find((attachment) => attachment.attachmentType === "image");
  const audio = (part.attachments ?? []).find((attachment) => attachment.attachmentType === "audio");
  const baseItem = assignment.items[0];
  const submittedPart = (assignment.submissionParts ?? []).find((item) => item.assignmentPartId === part.id);

  return {
    ...assignment,
    assignmentType,
    title: part.title || assignment.title,
    description: part.instruction || assignment.description,
    imageUrl: image?.fileUrl ?? assignment.imageUrl,
    items: baseItem
      ? [{
          ...baseItem,
          itemType: itemTypeForAssignmentType(assignmentType),
          title: part.title || baseItem.title,
          passageText: part.scriptText || baseItem.passageText,
          audioUrl: audio?.fileUrl || baseItem.audioUrl,
          audioFileName: audio?.fileName || baseItem.audioFileName,
          writingMode: part.writingMode ?? baseItem.writingMode,
          writingUnit: part.writingUnit ?? baseItem.writingUnit,
          writingHint: part.writingHint ?? baseItem.writingHint,
          writingExample: part.writingExample ?? baseItem.writingExample,
          recordingUrl: submittedPart?.recordingUrl,
          recordingFileName: submittedPart?.recordingFileName,
          recordingDurationSec: submittedPart?.recordingDurationSec,
          originalAnswerText: submittedPart?.originalAnswerText,
          answerText: submittedPart?.answerText,
          aiCorrectedText: submittedPart?.aiCorrectedText,
          aiFeedback: submittedPart?.aiFeedback,
          aiGrammarNotes: submittedPart?.aiGrammarNotes,
          aiExpressionNotes: submittedPart?.aiExpressionNotes,
          attachments: submittedPart?.attachments ?? [],
        }]
      : [],
    vocabularyItems: part.vocabularyItems?.length ? part.vocabularyItems : assignment.vocabularyItems,
  };
}

function HomeworkByPart({
  assignment,
  part,
  onSavePart,
  photoFiles,
  onPhotoFilesChange,
  label,
  tooltip,
}: {
  assignment: Assignment;
  part: AssignmentPart;
  onSavePart?: (payload?: PartSavePayload) => void | Promise<void>;
  photoFiles?: File[];
  onPhotoFilesChange?: (files: File[]) => void;
  label?: string;
  tooltip?: string;
}) {
  const assignmentType = assignmentTypeFromPartType(part.partType);
  const partMode = onSavePart ? { onSave: onSavePart, label, tooltip } : undefined;
  const draftData = (assignment.draft?.draftData?.[part.id] ?? undefined) as Record<string, unknown> | undefined;
  const draftAttachments = (assignment.draft?.attachments ?? []).filter((attachment) => attachment.assignmentPartId === part.id);

  if (!assignmentType) return <PartContent part={part} />;

  const effectiveAssignment = assignmentForPart(assignment, part, assignmentType);

  if (assignmentType === "photo_submission") {
    return (
      <PhotoSubmissionHomework
        assignment={{ ...effectiveAssignment, assignmentType }}
        partMode={partMode}
        initialFiles={photoFiles}
        onSelectedFilesChange={onPhotoFilesChange}
        draftAttachments={draftAttachments}
      />
    );
  }
  if (assignmentType === "quiz") {
    return <QuizPartPlayer assignment={assignment} part={part} partMode={partMode} />;
  }
  if (assignmentType === "listening") return <ListeningHomework assignment={{ ...effectiveAssignment, assignmentType }} partMode={partMode} />;
  if (assignmentType === "writing") return <WritingHomework assignment={{ ...effectiveAssignment, assignmentType }} partMode={partMode} draftData={draftData} />;
  if (assignmentType === "vocabulary_example") return <VocabularyExampleHomework assignment={{ ...effectiveAssignment, assignmentType }} partMode={partMode} draftData={draftData} />;
  if (assignmentType === "vocabulary_recording") return <VocabularyRecordingHomework assignment={{ ...effectiveAssignment, assignmentType }} partMode={partMode} draftAttachments={draftAttachments} />;
  return <RlRecordingHomework assignment={{ ...effectiveAssignment, assignmentType }} partMode={partMode} draftAttachments={draftAttachments} />;
}

function PartContent({ part }: { part: AssignmentPart }) {
  const images = (part.attachments ?? []).filter((attachment) => attachment.attachmentType === "image");
  const audioFiles = (part.attachments ?? []).filter((attachment) => attachment.attachmentType === "audio");

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="green">{partTypeLabel(part.partType)}</Badge>
        {part.isRequired && <Badge tone="yellow">필수</Badge>}
        {part.allowSubmission && <Badge tone="blue">제출 필요</Badge>}
      </div>
      <h2 className="mt-4 text-xl font-bold">{part.title || partTypeLabel(part.partType)}</h2>
      {part.instruction && <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-600">{part.instruction}</p>}
      {images.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {images.map((image) => (
            <a key={image.id} href={image.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line bg-slate-50">
              <img src={image.fileUrl} alt={image.fileName ?? "파트 이미지"} className="h-auto w-full object-contain" />
            </a>
          ))}
        </div>
      )}
      {part.scriptText && (
        <div className="mt-4 rounded-lg bg-paper p-4">
          <p className="whitespace-pre-wrap text-lg leading-9 text-slate-800">{part.scriptText}</p>
        </div>
      )}
      {audioFiles.length > 0 && (
        <div className="mt-4 grid gap-3">
          {audioFiles.map((audio) => (
            <div key={audio.id}>
              <p className="mb-2 text-sm font-semibold text-slate-600">{audio.fileName || "오디오 파일"}</p>
              {audio.fileUrl && <AudioPlayer src={audio.fileUrl} preload="metadata" />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function MultiPartHomework({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const parts = (assignment.parts ?? []).filter((part) => part.status === "active");
  const initialIndex = Math.max(0, parts.findIndex((part) => part.id === assignment.draft?.currentPartId));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [savedParts, setSavedParts] = useState<Set<string>>(() => new Set(Object.keys(assignment.draft?.draftData ?? {})));
  const [photoFilesByPart, setPhotoFilesByPart] = useState<Record<string, File[]>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const currentPart = parts[currentIndex];
  const isLastPart = currentIndex === parts.length - 1;

  if (!currentPart || parts.length <= 1) return currentPart ? <HomeworkByPart assignment={assignment} part={currentPart} /> : null;

  function updatePhotoFiles(partId: string, files: File[]) {
    setPhotoFilesByPart((current) => ({ ...current, [partId]: files }));
  }

  async function persistCurrentPart(payload?: PartSavePayload) {
    if (!currentPart) return;
    const assignmentType = assignmentTypeFromPartType(currentPart.partType);
    const effectiveAssignment = assignmentType ? assignmentForPart(assignment, currentPart, assignmentType) : assignment;
    const assignmentItemId = effectiveAssignment.items[0]?.id;
    await saveAssignmentDraft({
      assignmentId: assignment.id,
      assignmentPartId: currentPart.id,
      assignmentItemId,
      currentPartOrder: currentPart.orderIndex,
      data: {
        partType: currentPart.partType,
        savedAt: new Date().toISOString(),
        ...(payload?.data ?? {}),
      },
      files: payload?.files,
      attachmentType: payload?.attachmentType,
      replaceAttachments: payload?.replaceAttachments,
      durationSec: payload?.durationSec,
    });
    setSavedParts((current) => new Set(current).add(currentPart.id));
  }

  async function saveAndContinue(payload?: PartSavePayload) {
    setSaving(true);
    setSaveError("");
    try {
      await persistCurrentPart(payload);
      setCurrentIndex((value) => Math.min(value + 1, parts.length - 1));
    } catch (error) {
      const message = error instanceof Error ? error.message : "임시저장 중 오류가 발생했습니다.";
      setSaveError(message);
      setAlertMessage(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAndSubmit(payload?: PartSavePayload) {
    setSubmitting(true);
    setSaveError("");
    try {
      await persistCurrentPart(payload);
      await submitAssignmentDraft(assignment.id);
      router.replace(`/student/assignments/${assignment.id}/complete`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "최종 제출 중 오류가 발생했습니다.";
      setSaveError(message);
      setAlertMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-action">Part {currentIndex + 1} / {parts.length}</p>
            <h2 className="mt-1 text-xl font-bold">멀티 Part 숙제</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {parts.map((part, index) => (
              <button
                key={part.id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`rounded-full border px-3 py-1 text-xs font-extrabold ${
                  index === currentIndex ? "border-action bg-action text-white" : "border-line bg-white text-slate-600"
                }`}
              >
                Part {index + 1} · {partTypeLabel(part.partType)}{savedParts.has(part.id) ? " 저장됨" : ""}
              </button>
            ))}
          </div>
        </div>
      </Card>
      {saving && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">임시저장 중입니다.</p>}
      {submitting && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">최종 제출 중입니다.</p>}

      {!isLastPart ? (
        <>
          <HomeworkByPart
            key={currentPart.id}
            assignment={assignment}
            part={currentPart}
            onSavePart={saveAndContinue}
            photoFiles={photoFilesByPart[currentPart.id]}
            onPhotoFilesChange={(files) => updatePhotoFiles(currentPart.id, files)}
          />
          <div className="hidden justify-end">
            <Button type="button" onClick={() => saveAndContinue()}>저장하기</Button>
          </div>
        </>
      ) : (
        <HomeworkByPart
          key={currentPart.id}
          assignment={assignment}
          part={currentPart}
          onSavePart={saveAndSubmit}
          label="제출하기"
          tooltip="마지막 Part까지 완료했어요. 제출할 수 있습니다."
          photoFiles={photoFilesByPart[currentPart.id]}
          onPhotoFilesChange={(files) => updatePhotoFiles(currentPart.id, files)}
        />
      )}
      {(saveError || alertMessage) && (
        <SubmissionAlertModal message={alertMessage || saveError} onClose={() => { setSaveError(""); setAlertMessage(""); }} />
      )}
    </div>
  );
}
