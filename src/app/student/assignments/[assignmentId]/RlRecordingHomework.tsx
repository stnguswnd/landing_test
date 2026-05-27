"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { submitRecording } from "@/features/submissions/api/submissionApi";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { formatDateTime, formatDue } from "@/lib/format";
import type { Assignment } from "@/types/assignment";
import { ReadyStepButton } from "./ReadyStepButton";

type RlHomeworkStep = 1 | 2;

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function Header({ assignment }: { assignment: Assignment }) {
  return (
    <Card className="shadow-soft">
      <div className="flex flex-wrap gap-2">
        <Badge tone="blue">{assignment.classId || "내 반"}</Badge>
        <Badge tone="green">RL 녹음</Badge>
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

export function RlRecordingHomework({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const item = assignment.items[0];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorder = useAudioRecorder();
  const [step, setStep] = useState<RlHomeworkStep>(1);
  const [hasListenedFullAudio, setHasListenedFullAudio] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const minRecordingSec = item?.minRecordingSec ?? 0;
  const canSubmit = Boolean(recorder.recordingBlob) && recorder.durationSec >= minRecordingSec && !pending;

  function goStep(nextStep: RlHomeworkStep) {
    if (nextStep === 2 && !hasListenedFullAudio) return;
    audioRef.current?.pause();
    recordedAudioRef.current?.pause();
    if (recorder.state === "recording") recorder.stopRecording();
    setStep(nextStep);
  }

  async function startRecording() {
    audioRef.current?.pause();
    recordedAudioRef.current?.pause();
    setError("");
    await recorder.startRecording();
  }

  function playOriginalAudio() {
    if (recorder.state === "recording") recorder.stopRecording();
    recordedAudioRef.current?.pause();
    setStep(1);
    window.setTimeout(() => audioRef.current?.play().catch(() => undefined), 0);
  }

  function confirmSubmit() {
    const recordingBlob = recorder.recordingBlob;
    if (!recordingBlob || !item || !canSubmit) return;
    setError("");
    startTransition(async () => {
      try {
        await submitRecording({
          assignmentId: assignment.id,
          assignmentItemId: item.id,
          durationSec: recorder.durationSec,
          file: recordingBlob,
          fileName: `recording-${assignment.id}-${Date.now()}.webm`,
        });
        setSubmitOpen(false);
        router.push(`/student/assignments/${assignment.id}/complete`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "녹음 제출 중 오류가 발생했습니다.");
        setSubmitOpen(false);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <Card>
        <p className="text-sm font-bold text-action">{step === 1 ? "1 / 2 듣기" : "2 / 2 녹음"}</p>
        <h2 className="mt-2 text-lg font-bold">{step === 1 ? "Listen and Repeat" : "Record"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {step === 1
            ? "원본 MP3를 끝까지 듣고 문장을 연습해보세요."
            : "문장을 보면서 내 목소리로 녹음한 뒤 제출하세요."}
        </p>
      </Card>
      <Content assignment={assignment} />
      <Card>
        {step === 1 ? (
          <>
            <h2 className="font-bold">원본 MP3 듣기</h2>
            {item?.audioUrl ? (
              <>
                <AudioPlayer ref={audioRef} className="mt-4" src={item.audioUrl} preload="metadata" onEnded={() => setHasListenedFullAudio(true)} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}>-10초</Button>
                  <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10); }}>+10초</Button>
                </div>
                <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-action">
                  {hasListenedFullAudio ? "끝까지 들었어요. 이제 녹음할 수 있습니다." : "녹음하려면 원본 MP3를 끝까지 한 번 들어주세요."}
                </p>
              </>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-line p-4 text-sm text-slate-500">등록된 음원 파일이 없습니다. 선생님에게 문의해주세요.</p>
            )}
          </>
        ) : (
          <>
            <h2 className="font-bold">내 녹음</h2>
            <div className="mt-4 rounded-lg border border-line p-4">
              <p className="font-semibold">녹음 상태: {recorder.state === "recording" ? "녹음 중" : recorder.previewUrl ? "녹음 완료" : "대기 중"}</p>
              <p className="mt-1 text-sm text-slate-500">녹음 시간: {formatSeconds(recorder.durationSec)} / 최소 {formatSeconds(minRecordingSec)}</p>
              {recorder.errorMessage && <p className="mt-3 text-sm font-semibold text-danger">마이크 권한이 필요합니다.</p>}
              {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
            </div>
            {recorder.previewUrl && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-bold text-slate-600">내 녹음 다시 듣기</p>
                <AudioPlayer ref={recordedAudioRef} src={recorder.previewUrl} preload="metadata" onPlay={() => audioRef.current?.pause()} />
              </div>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {recorder.state === "recording" ? (
                <Button type="button" variant="danger" onClick={recorder.stopRecording}>녹음 완료</Button>
              ) : (
                <Button type="button" onClick={startRecording}>{recorder.previewUrl ? "다시 녹음하기" : "녹음 시작"}</Button>
              )}
              <Button type="button" variant="secondary" onClick={recorder.resetRecording} disabled={!recorder.previewUrl}>초기화하기</Button>
            </div>
          </>
        )}
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <Button type="button" variant={step === 1 ? "primary" : "secondary"} className={step === 1 ? "hover:bg-action" : undefined} onClick={playOriginalAudio}>듣고 연습하기</Button>
        <ReadyStepButton variant={step === 2 ? "primary" : "secondary"} className={step === 2 ? "cursor-default hover:bg-action" : undefined} disabled={!hasListenedFullAudio} onClick={() => goStep(2)} tooltip="음원을 끝까지 들었어요. 이제 녹음 단계로 넘어갈 수 있어요.">녹음하기</ReadyStepButton>
        <ReadyStepButton disabled={!canSubmit} onClick={() => setSubmitOpen(true)} tooltip="녹음이 완료됐어요. 제출하기를 누를 수 있어요.">제출하기</ReadyStepButton>
      </div>
      {submitOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <h2 className="text-xl font-extrabold">제출하시겠습니까?</h2>
            <p className="mt-3 leading-7 text-slate-600">제출하면 선생님이 확인한 뒤 완료 또는 미완료 상태를 알려줄 거예요.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => setSubmitOpen(false)} disabled={pending}>아니요</Button>
              <Button type="button" onClick={confirmSubmit} disabled={pending}>{pending ? "제출 중..." : "네"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
