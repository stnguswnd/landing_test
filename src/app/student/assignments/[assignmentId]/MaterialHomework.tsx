"use client";

import { useRef, useState } from "react";

import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Assignment } from "@/types/assignment";

function kindLabel(kind?: "general" | "grading" | "other") {
  if (kind === "grading") return "채점";
  if (kind === "other") return "기타";
  return "안내";
}

export function MaterialHomework({ assignment }: { assignment: Assignment }) {
  const parts = (assignment.parts ?? []).filter((part) => part.status === "active" && part.partType === "instruction");
  const [currentIndex, setCurrentIndex] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const currentPart = parts[currentIndex];

  if (!currentPart) return null;

  const images = (currentPart.attachments ?? []).filter((item) => item.attachmentType === "image");
  const audios = (currentPart.attachments ?? []).filter((item) => item.attachmentType === "audio");
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === parts.length - 1;

  function moveTo(index: number) {
    setCurrentIndex(Math.max(0, Math.min(index, parts.length - 1)));
    window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div ref={topRef} className="grid scroll-mt-24 gap-4">
      {parts.length > 1 && (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-action">Part {currentIndex + 1} / {parts.length}</p>
              <h2 className="mt-1 text-xl font-bold">자료 보기</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {parts.map((part, index) => (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => moveTo(index)}
                  className={`rounded-full border px-3 py-1 text-xs font-extrabold ${
                    index === currentIndex ? "border-action bg-action text-white" : "border-line bg-white text-slate-600"
                  }`}
                >
                  Part {index + 1} · {kindLabel(part.instructionKind)}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card key={currentPart.id}>
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{assignment.assignmentSubject ?? assignment.classId ?? "내 반"}</Badge>
          <Badge>{kindLabel(currentPart.instructionKind)}</Badge>
        </div>
        <h2 className="mt-3 text-xl font-bold">{currentPart.title || assignment.title}</h2>
        {currentPart.instruction && <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{currentPart.instruction}</p>}
        {currentPart.scriptText && <p className="mt-4 whitespace-pre-wrap rounded-md bg-paper p-4 leading-7">{currentPart.scriptText}</p>}
        {images.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {images.map((item) => item.fileUrl ? <img key={item.id} src={item.fileUrl} alt={item.fileName ?? "자료 이미지"} className="w-full rounded-lg border border-line" /> : null)}
          </div>
        )}
        {audios.map((item) => item.fileUrl ? <AudioPlayer key={item.id} className="mt-4" src={item.fileUrl} preload="metadata" /> : null)}
      </Card>

      <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-paper/95 py-3 backdrop-blur">
        <Button type="button" variant="secondary" disabled={isFirst} onClick={() => moveTo(currentIndex - 1)}>
          이전
        </Button>
        {isLast ? (
          <Button href="/student/home#weekly-homework">과제 목록으로</Button>
        ) : (
          <Button type="button" onClick={() => moveTo(currentIndex + 1)}>다음</Button>
        )}
      </div>
    </div>
  );
}
