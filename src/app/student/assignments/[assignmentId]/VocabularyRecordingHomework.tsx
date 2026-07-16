"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Assignment, StudentAssignmentDraftAttachment } from "@/types/assignment";
import type { PartMode } from "./partMode";
import { ReadyStepButton } from "./ReadyStepButton";
import { RecordingStatusBar } from "./RecordingStatusBar";
import { SubmissionAlertModal } from "./SubmissionAlertModal";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function VocabularyRecordingHomework({ assignment, partMode, draftAttachments = [] }: { assignment: Assignment; partMode?: PartMode; draftAttachments?: StudentAssignmentDraftAttachment[] }) {
  const router = useRouter();
  const item = assignment.items[0];
  const vocabularyItems = assignment.vocabularyItems ?? [];
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "recorded">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const draftAudio = draftAttachments.find((attachment) => attachment.attachmentType === "audio");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(draftAudio?.fileUrl ?? assignment.items[0]?.recordingUrl ?? null);
  const [message, setMessage] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (recordingUrl?.startsWith("blob:")) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  useEffect(() => {
    return () => {
      // 언마운트 시: 녹음 중이면 핸들러를 떼고 정지시켜, 사라진 컴포넌트에서 상태가 갱신되거나
      // 미완료 파일이 만들어지는 것을 막는다.
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state === "recording") {
          try { recorder.stop(); } catch { /* 이미 종료된 경우 무시 */ }
        }
      }
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    if (typeof MediaRecorder === "undefined") {
      setMessage("이 브라우저는 녹음을 지원하지 않습니다.");
      return;
    }
    try {
      setMessage("");
      recordedAudioRef.current?.pause();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      function fail(text: string) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        // 재녹음이 실패하면 이전 녹음을 남겨두지 않는다. (상태 idle인데 제출 버튼만 켜져 있는 엇갈림 방지)
        if (recordingUrl?.startsWith("blob:")) URL.revokeObjectURL(recordingUrl);
        setRecordingBlob(null);
        setRecordingUrl(null);
        setMessage(text);
        setRecordingStatus("idle");
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => fail("녹음 중 문제가 발생했어요. 다시 녹음해주세요.");
      // 녹음 도중 마이크 스트림이 끊기면(전화 수신, 화면 잠금, 기기 분리 등) 녹음기를 정상 종료시켜
      // 그때까지 버퍼된 데이터라도 onstop에서 안전하게 파일로 만들 수 있게 한다.
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        };
      });
      recorder.onstop = () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        // 녹음이 중간에 깨져 데이터가 하나도 없으면 빈 파일이 제출되어 강사 피드백 단계에서
        // "녹음 파일을 불러오지 못했습니다" 오류로 이어진다. 여기서 막고 다시 녹음하도록 안내한다.
        if (blob.size === 0) {
          fail("녹음이 정상적으로 저장되지 않았어요. 다시 녹음해주세요.");
          return;
        }
        // 앞서 onerror가 먼저 발동했더라도, 여기서 유효한 파일을 만들었으면 살려낸 것이므로
        // 에러 메시지를 정리하고 성공으로 확정한다.
        if (recordingUrl?.startsWith("blob:")) URL.revokeObjectURL(recordingUrl);
        setMessage("");
        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        setRecordingStatus("recorded");
      };
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
      recorder.start();
      setRecordingStatus("recording");
    } catch {
      setMessage("마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.");
    }
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
  }

  function resetRecording() {
    recordedAudioRef.current?.pause();
    if (recordingUrl?.startsWith("blob:")) URL.revokeObjectURL(recordingUrl);
    setRecordingBlob(null);
    setRecordingUrl(null);
    setRecordingSeconds(0);
    setRecordingStatus("idle");
  }

  function submit() {
    if (!item || !recordingBlob) return;
    startTransition(async () => {
      const file = new File([recordingBlob], `vocabulary-recording-${assignment.id}.webm`, { type: recordingBlob.type || "audio/webm" });
      const formData = new FormData();
      formData.set("assignmentId", assignment.id);
      formData.set("assignmentItemId", item.id);
      formData.set("durationSec", String(recordingSeconds));
      formData.set("file", file, file.name);
      const response = await fetch("/api/student/submissions/recording", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "녹음 제출 중 오류가 발생했습니다.");
        return;
      }
      router.replace(`/student/assignments/${assignment.id}/complete`);
    });
  }

  function savePart() {
    if (!partMode || !recordingBlob || recordingStatus === "recording") return;
    partMode.onSave({
      data: { recordingSeconds },
      files: [recordingBlob],
      attachmentType: "audio",
      replaceAttachments: true,
      durationSec: recordingSeconds,
    });
  }

  return (
    <div className="grid gap-4 pb-56">
      <Card>
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{assignment.assignmentSubject ?? "Phonics"}</Badge>
          {assignment.dueAt && <Badge tone="yellow">마감 {formatDateTime(assignment.dueAt)}</Badge>}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">{assignment.title}</h1>
        {assignment.description && <p className="mt-2 text-slate-600">{assignment.description}</p>}
        <p className="mt-3 text-lg font-semibold text-slate-700">{item?.passageText || "Read out loud and record."}</p>
        {item?.writingInstructions && <p className="mt-2 text-sm text-slate-500">{item.writingInstructions}</p>}
      </Card>

      <Card>
        <div className="max-h-[620px] overflow-y-auto pr-1">
          <div className="grid gap-3">
            {vocabularyItems.map((word) => (
              <div key={word.id} className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-white text-lg font-bold shadow-sm">
                <div className="border-r border-line px-6 py-5 text-ink">{word.word}</div>
                <div className="px-6 py-5 text-ink">{word.meaning}</div>
              </div>
            ))}
          </div>
        </div>
        {vocabularyItems.length === 0 && <p className="text-sm text-slate-500">등록된 단어가 없습니다. 선생님에게 문의해주세요.</p>}
      </Card>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto grid max-w-5xl gap-4 rounded-2xl border border-line bg-white p-4 shadow-soft">
          <RecordingStatusBar
            seconds={recordingSeconds}
            isRecording={recordingStatus === "recording"}
            formatSeconds={formatSeconds}
          />
          {recordingStatus === "recorded" && <p className="text-sm font-semibold text-action">녹음 완료</p>}
          {recordingUrl && (
            <audio
              ref={recordedAudioRef}
              src={recordingUrl}
              controls
              controlsList="nodownload"
              className="w-full"
            />
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Button type="button" variant="secondary" disabled={!recordingUrl || recordingStatus === "recording"} onClick={() => recordedAudioRef.current?.play()}>
              다시 듣기
            </Button>
            {recordingStatus === "recording" ? (
              <Button type="button" variant="danger" onClick={stopRecording}>녹음 중지</Button>
            ) : (
              <Button type="button" onClick={startRecording}>{recordingStatus === "recorded" ? "다시 녹음 시작" : "녹음 시작"}</Button>
            )}
            <Button type="button" variant="secondary" disabled={!recordingUrl || recordingStatus === "recording"} onClick={resetRecording}>
              다시 녹음하기
            </Button>
          </div>
          <ReadyStepButton
            className="min-h-12 text-base"
            disabled={!recordingBlob || recordingStatus === "recording" || pending}
            disabledReason={recordingStatus === "recording" ? "녹음을 중지한 뒤 제출할 수 있습니다." : !recordingBlob ? "녹음을 완료한 뒤 제출할 수 있습니다." : undefined}
            onDisabledClick={setAlertMessage}
            onClick={partMode ? savePart : () => setIsSubmitOpen(true)}
            tooltip={partMode ? partMode.tooltip ?? "녹음이 완료됐어요. 저장할 수 있어요." : "녹음이 완료됐어요. 제출할 수 있어요."}
          >
            {partMode ? partMode.label ?? "저장하기" : "제출하기"}
          </ReadyStepButton>
        </div>
      </div>

      {!partMode && isSubmitOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <h2 className="text-xl font-extrabold">제출하시겠습니까?</h2>
            <p className="mt-3 leading-7 text-slate-600">제출하면 선생님이 확인해보고 완료, 미완료를 알려줄거예요.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => setIsSubmitOpen(false)} disabled={pending}>아니요</Button>
              <Button type="button" onClick={submit} disabled={pending}>{pending ? "제출 중..." : "네"}</Button>
            </div>
          </div>
        </div>
      )}
      {(message || alertMessage) && (
        <SubmissionAlertModal message={message || alertMessage} onClose={() => { setMessage(""); setAlertMessage(""); }} />
      )}
    </div>
  );
}
