"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { completeListeningAssignment } from "@/features/submissions/api/submissionApi";
import { formatDateTime, formatDue } from "@/lib/format";
import type { Assignment } from "@/types/assignment";
import { ReadyStepButton } from "./ReadyStepButton";

function Header({ assignment }: { assignment: Assignment }) {
  return (
    <Card className="shadow-soft">
      <div className="flex flex-wrap gap-2">
        <Badge tone="blue">{assignment.classId || "내 반"}</Badge>
        <Badge tone="green">리스닝</Badge>
        {assignment.dueAt && <Badge tone="yellow">마감: {formatDue(assignment.dueAt)}</Badge>}
        {assignment.submittedAt && <Badge tone="green">제출: {formatDateTime(assignment.submittedAt)}</Badge>}
      </div>
      <h1 className="mt-4 text-2xl font-bold">{assignment.title}</h1>
      {assignment.description && <p className="mt-2 leading-7 text-slate-600">{assignment.description}</p>}
    </Card>
  );
}

function Content({ assignment }: { assignment: Assignment }) {
  const item = assignment.items[0];
  return (
    <Card>
      <h2 className="font-bold">읽을 내용</h2>
      {assignment.imageUrl && (
        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-slate-50">
          <img src={assignment.imageUrl} alt="숙제 이미지" className="h-auto w-full" />
        </div>
      )}
      {item?.passageText && (
        <div className="mt-4 rounded-lg bg-paper p-4">
          <p className="whitespace-pre-wrap text-lg leading-9 text-slate-800">{item.passageText}</p>
        </div>
      )}
      {!assignment.imageUrl && !item?.passageText && <p className="mt-3 text-sm text-slate-500">표시할 이미지 또는 스크립트가 없습니다.</p>}
    </Card>
  );
}

export function ListeningHomework({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const item = assignment.items[0];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasListenedFullAudio, setHasListenedFullAudio] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function confirmComplete() {
    setError("");
    startTransition(async () => {
      try {
        await completeListeningAssignment(assignment.id);
        setCompleteOpen(false);
        router.push(`/student/assignments/${assignment.id}/complete`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "완료 처리에 실패했습니다. 다시 시도해주세요.");
      }
    });
  }

  function playOriginalAudio() {
    audioRef.current?.play().catch(() => undefined);
  }

  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <Card>
        <p className="text-sm font-bold text-action">1 / 1 듣기</p>
        <h2 className="mt-2 text-lg font-bold">Listen and Repeat</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">원본 MP3를 끝까지 들으면 숙제를 완료할 수 있습니다.</p>
      </Card>
      <Content assignment={assignment} />
      <Card>
        <h2 className="font-bold">원본 MP3 듣기</h2>
        {item?.audioUrl ? (
          <>
            <AudioPlayer ref={audioRef} className="mt-4" src={item.audioUrl} preload="metadata" onEnded={() => setHasListenedFullAudio(true)} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}>-10초</Button>
              <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10); }}>+10초</Button>
            </div>
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-action">
              {hasListenedFullAudio ? "끝까지 들었어요. 완료하기 버튼을 누를 수 있습니다." : "완료하려면 원본 MP3를 끝까지 한 번 들어주세요."}
            </p>
          </>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-line p-4 text-sm text-slate-500">등록된 음원 파일이 없습니다. 선생님에게 문의해주세요.</p>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" className="hover:bg-action" onClick={playOriginalAudio}>듣고 연습하기</Button>
        <ReadyStepButton disabled={!hasListenedFullAudio || pending} onClick={() => setCompleteOpen(true)} tooltip="음원을 끝까지 들었어요. 완료하기를 누를 수 있어요.">완료하기</ReadyStepButton>
      </div>
      {completeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <h2 className="text-xl font-extrabold">완료하시겠습니까?</h2>
            <p className="mt-3 leading-7 text-slate-600">완료하면 선생님에게 숙제를 했다고 알려줘요.</p>
            {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => setCompleteOpen(false)} disabled={pending}>아니요</Button>
              <Button type="button" onClick={confirmComplete} disabled={pending}>{pending ? "완료 처리 중..." : "네"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
