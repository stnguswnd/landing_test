"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { submitPhotoAssignment } from "@/features/submissions/api/submissionApi";
import { formatDateTime, formatDue } from "@/lib/format";
import type { Assignment, StudentAssignmentDraftAttachment } from "@/types/assignment";
import type { PartMode } from "./partMode";
import { ReadyStepButton } from "./ReadyStepButton";
import { SubmissionAlertModal } from "./SubmissionAlertModal";

const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_PHOTO_COUNT = 20;

type PreviewFile = {
  file: File;
  url: string;
};

function Header({ assignment }: { assignment: Assignment }) {
  return (
    <Card className="shadow-soft">
      <div className="flex flex-wrap gap-2">
        <Badge tone="blue">{assignment.assignmentSubject ?? assignment.classId ?? "내 반"}</Badge>
        <Badge tone="green">사진 제출</Badge>
        {assignment.dueAt && <Badge tone="yellow">마감: {formatDue(assignment.dueAt)}</Badge>}
        {assignment.submittedAt && <Badge tone="green">제출: {formatDateTime(assignment.submittedAt)}</Badge>}
      </div>
      <h1 className="mt-4 text-2xl font-bold">{assignment.title}</h1>
      {assignment.description && <p className="mt-2 leading-7 text-slate-600">{assignment.description}</p>}
    </Card>
  );
}

function AssignmentContent({ assignment }: { assignment: Assignment }) {
  const item = assignment.items[0];

  return (
    <Card>
      <h2 className="font-bold">사진 설명 / 스크립트</h2>
      {assignment.imageUrl && (
        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-slate-50">
          <img src={assignment.imageUrl} alt="과제 이미지" className="h-auto w-full" />
        </div>
      )}
      {item?.passageText && (
        <div className="mt-4 rounded-lg bg-paper p-4">
          <p className="whitespace-pre-wrap text-lg leading-9 text-slate-800">{item.passageText}</p>
        </div>
      )}
      {!assignment.imageUrl && !item?.passageText && (
        <p className="mt-3 text-sm text-slate-500">선생님이 남긴 사진 설명 또는 스크립트가 없습니다.</p>
      )}
    </Card>
  );
}

export function PhotoSubmissionHomework({
  assignment,
  partMode,
  initialFiles = [],
  onSelectedFilesChange,
  draftAttachments = [],
}: {
  assignment: Assignment;
  partMode?: PartMode;
  initialFiles?: File[];
  onSelectedFilesChange?: (files: File[]) => void;
  draftAttachments?: StudentAssignmentDraftAttachment[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const item = assignment.items[0];
  const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>(() => initialFiles.map((file) => ({ file, url: URL.createObjectURL(file) })));
  const [submitOpen, setSubmitOpen] = useState(false);
  const [error, setError] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const existingImages = useMemo(
    () => (item?.attachments ?? []).filter((attachment) => attachment.attachmentType === "image"),
    [item?.attachments],
  );
  const [keptExistingImageIds, setKeptExistingImageIds] = useState<Set<string>>(() => new Set(existingImages.map((image) => image.id)));
  const visibleExistingImages = existingImages.filter((image) => keptExistingImageIds.has(image.id));
  const draftImages = draftAttachments.filter((attachment) => attachment.attachmentType === "image");
  const canSubmit = selectedFiles.length > 0 || visibleExistingImages.length > 0 || existingImages.length > 0 || (Boolean(partMode) && draftImages.length > 0);

  useEffect(() => {
    return () => {
      selectedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [selectedFiles]);

  function onFilesChange(files: FileList | null) {
    selectedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    setError("");

    const nextFiles = Array.from(files ?? []).slice(0, MAX_PHOTO_COUNT);
    const invalidFile = nextFiles.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setSelectedFiles([]);
      onSelectedFilesChange?.([]);
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }

    const oversizedFile = nextFiles.find((file) => file.size > MAX_IMAGE_FILE_SIZE);
    if (oversizedFile) {
      setSelectedFiles([]);
      onSelectedFilesChange?.([]);
      setError("사진 1개당 최대 10MB까지 제출할 수 있습니다.");
      return;
    }

    setSelectedFiles(nextFiles.map((file) => ({ file, url: URL.createObjectURL(file) })));
    onSelectedFilesChange?.(nextFiles);
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.url);
      const nextFiles = current.filter((_, currentIndex) => currentIndex !== index);
      onSelectedFilesChange?.(nextFiles.map((item) => item.file));
      return nextFiles;
    });
    setError("");
  }

  function removeExistingImage(id: string) {
    setKeptExistingImageIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setError("");
  }

  function confirmSubmit() {
    if (!item) {
      setError("제출할 문항을 찾을 수 없습니다.");
      return;
    }
    if (!canSubmit) {
      setError("제출할 사진을 1장 이상 선택해주세요.");
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        await submitPhotoAssignment({
          assignmentId: assignment.id,
          assignmentItemId: item.id,
          files: selectedFiles.map((item) => item.file),
          keptAttachmentIds: visibleExistingImages.map((image) => image.id),
        });
        setSubmitOpen(false);
        router.replace(`/student/assignments/${assignment.id}/complete`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "사진 제출 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <AssignmentContent assignment={assignment} />

      {existingImages.length > 0 && (
        <Card>
          <h2 className="font-bold">이미 제출한 사진</h2>
          {visibleExistingImages.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleExistingImages.map((image) => (
                <div key={image.id} className="relative overflow-hidden rounded-lg border border-line bg-slate-50">
                  <button
                    type="button"
                    aria-label={`${image.fileName ?? "제출 사진"} 삭제`}
                    onClick={() => removeExistingImage(image.id)}
                    className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-slate-950/70 text-sm font-extrabold text-white shadow-soft hover:bg-slate-950"
                  >
                    ×
                  </button>
                  <a href={image.fileUrl} target="_blank" rel="noreferrer" className="block">
                    <img src={image.fileUrl} alt={image.fileName ?? "제출 사진"} className="aspect-[4/3] w-full object-cover" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-line bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              기존 사진을 모두 삭제했습니다. 새 사진을 올리거나 제출해서 삭제를 반영할 수 있습니다.
            </p>
          )}
        </Card>
      )}

      {draftImages.length > 0 && selectedFiles.length === 0 && (
        <Card>
          <h2 className="font-bold">임시저장한 사진</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {draftImages.map((image) => (
              <a key={image.id} href={image.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line bg-slate-50">
                <img src={image.fileUrl} alt={image.fileName ?? "임시저장 사진"} className="aspect-[4/3] w-full object-cover" />
              </a>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">사진 업로드</h2>
            <p className="mt-1 text-sm text-slate-500">여러 장 선택할 수 있고, 사진 1개당 최대 10MB까지 제출할 수 있습니다.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            사진 업로드
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => onFilesChange(event.target.files)}
        />

        {selectedFiles.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selectedFiles.map((item, index) => (
              <div key={item.url} className="relative overflow-hidden rounded-lg border border-line bg-slate-50">
                <button
                  type="button"
                  aria-label={`${item.file.name} 삭제`}
                  onClick={() => removeSelectedFile(index)}
                  className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-slate-950/70 text-sm font-extrabold text-white shadow-soft hover:bg-slate-950"
                >
                  ×
                </button>
                <img src={item.url} alt={`선택한 사진 ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                <p className="truncate px-3 py-2 text-xs font-semibold text-slate-600">{item.file.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-line bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
            아직 선택한 사진이 없습니다.
          </div>
        )}
      </Card>

      {partMode ? (
        <ReadyStepButton
          disabled={!canSubmit || pending}
          disabledReason={!canSubmit ? "제출할 사진을 1장 이상 선택해주세요." : undefined}
          onDisabledClick={setAlertMessage}
          onClick={() => partMode.onSave({
            data: { keptSubmissionAttachmentIds: visibleExistingImages.map((image) => image.id) },
            files: selectedFiles.map((item) => item.file),
            attachmentType: "image",
            replaceAttachments: selectedFiles.length > 0,
          })}
          tooltip={partMode.tooltip ?? "저장할 수 있습니다."}
        >
          {partMode.label ?? "저장하기"}
        </ReadyStepButton>
      ) : (
      <ReadyStepButton
        disabled={!canSubmit || pending}
        disabledReason={!canSubmit ? "제출할 사진을 1장 이상 선택해주세요." : undefined}
        onDisabledClick={setAlertMessage}
        onClick={() => setSubmitOpen(true)}
        tooltip="이제 제출할 수 있습니다."
      >
        {pending ? "제출 중..." : existingImages.length > 0 ? "다시 제출하기" : "제출하기"}
      </ReadyStepButton>
      )}

      {submitOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <h2 className="text-xl font-extrabold">사진을 제출할까요?</h2>
            <p className="mt-3 leading-7 text-slate-600">X로 삭제한 기존 사진은 제거되고, 남겨둔 사진과 새 사진이 함께 제출됩니다.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => setSubmitOpen(false)} disabled={pending}>아니요</Button>
              <Button type="button" onClick={confirmSubmit} disabled={pending}>{pending ? "제출 중..." : "네"}</Button>
            </div>
          </div>
        </div>
      )}
      {(error || alertMessage) && (
        <SubmissionAlertModal message={error || alertMessage} onClose={() => { setError(""); setAlertMessage(""); }} />
      )}
    </div>
  );
}
