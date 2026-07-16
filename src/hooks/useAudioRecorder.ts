"use client";

import { useEffect, useRef, useState } from "react";

const MIME_TYPE_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];

function getMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function useAudioRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const [state, setState] = useState<"idle" | "requesting_permission" | "recording" | "recorded" | "error">("idle");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function clearTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function revoke(url: string | null) {
    if (url) URL.revokeObjectURL(url);
  }

  async function startRecording() {
    if (typeof MediaRecorder === "undefined") {
      setErrorMessage("이 브라우저는 녹음을 지원하지 않습니다.");
      setState("error");
      return false;
    }
    try {
      setState("requesting_permission");
      setErrorMessage(null);
      revoke(previewUrl);
      setPreviewUrl(null);
      setRecordingBlob(null);
      setDurationSec(0);
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      function fail(message: string) {
        clearTimer();
        stream.getTracks().forEach((track) => track.stop());
        revoke(previewUrl);
        setPreviewUrl(null);
        setRecordingBlob(null);
        setErrorMessage(message);
        setState("error");
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
        clearTimer();
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        // 녹음이 중간에 깨져 데이터가 하나도 없으면 빈 파일이 제출되어 강사 피드백 단계에서
        // "녹음 파일을 불러오지 못했습니다" 오류로 이어진다. 여기서 막고 다시 녹음하도록 안내한다.
        if (blob.size === 0) {
          setErrorMessage("녹음이 정상적으로 저장되지 않았어요. 다시 녹음해주세요.");
          setState("error");
          return;
        }
        // 앞서 onerror가 먼저 발동했더라도, 여기서 유효한 파일을 만들었으면 살려낸 것이므로
        // 에러 상태를 정리하고 성공으로 확정한다.
        const url = URL.createObjectURL(blob);
        setErrorMessage(null);
        setRecordingBlob(blob);
        setPreviewUrl(url);
        setState("recorded");
      };
      recorder.start();
      setState("recording");
      timerRef.current = window.setInterval(() => setDurationSec((value) => value + 1), 1000);
      return true;
    } catch {
      setErrorMessage("마이크 권한을 확인해 주세요.");
      setState("error");
      return false;
    }
  }

  function stopRecording() {
    clearTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function resetRecording() {
    clearTimer();
    revoke(previewUrl);
    setPreviewUrl(null);
    setRecordingBlob(null);
    setDurationSec(0);
    setState("idle");
  }

  function dismissError() {
    setErrorMessage(null);
    setState((prev) => (prev === "error" ? "idle" : prev));
  }

  useEffect(() => {
    return () => revoke(previewUrl);
  }, [previewUrl]);

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
      clearTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { state, recordingBlob, previewUrl, durationSec, errorMessage, startRecording, stopRecording, resetRecording, dismissError };
}
