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
      return;
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
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordingBlob(blob);
        setPreviewUrl(url);
        setState("recorded");
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setState("recording");
      timerRef.current = window.setInterval(() => setDurationSec((value) => value + 1), 1000);
    } catch {
      setErrorMessage("마이크 권한을 확인해 주세요.");
      setState("error");
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

  useEffect(() => {
    return () => {
      clearTimer();
      revoke(previewUrl);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [previewUrl]);

  return { state, recordingBlob, previewUrl, durationSec, errorMessage, startRecording, stopRecording, resetRecording };
}
