"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { assignmentTypeLabel, normalizeAssignmentType } from "@/lib/assignmentTypes";

type TeacherAssignmentPreview = {
  id: string;
  title: string;
  description: string;
  type: string;
  partTypes?: string[];
  subject: string;
  status: string;
  imageUrl: string;
  item: {
    id: string | null;
    title: string;
    passageText: string;
    audioUrl: string;
    minRecordingSec: string;
    maxRecordingSec: string;
    writingMode?: string;
    writingUnit?: string;
    promptText?: string;
    writingInstructions?: string;
    writingHint?: string;
    writingExample?: string;
  };
  vocabularyItems?: Array<{ id: string; word: string; meaning: string; orderIndex: number }>;
  parts?: Array<{
    id: string;
    partType: string;
    title: string;
    instruction: string;
    scriptText: string;
    writingMode?: string;
    writingUnit?: string;
    writingHint?: string;
    writingExample?: string;
    vocabularyItems?: Array<{ id: string; word: string; meaning: string; orderIndex: number }>;
    isRequired: boolean;
    allowSubmission: boolean;
    minSubmissionCount: number;
    maxSubmissionCount: number;
    orderIndex: number;
    status: string;
    attachments?: Array<{
      id: string;
      attachmentType: "image" | "audio" | "video" | "file";
      fileUrl: string;
      fileName: string;
      orderIndex: number;
    }>;
  }>;
};

type AiPreview = {
  correctedText: string;
  feedback: string;
  grammarNotes?: string[];
  expressionNotes?: string[];
};

type PreviewAttachment = NonNullable<NonNullable<TeacherAssignmentPreview["parts"]>[number]["attachments"]>[number];

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function assignmentImageAttachment(assignment: TeacherAssignmentPreview): PreviewAttachment[] {
  if (!assignment.imageUrl) return [];
  return [{
    id: `${assignment.id}-assignment-image`,
    attachmentType: "image",
    fileUrl: assignment.imageUrl,
    fileName: assignment.title || "과제 이미지",
    orderIndex: -1,
  }];
}

function mergeImageAttachments(assignment: TeacherAssignmentPreview, attachments: PreviewAttachment[] = []) {
  const seen = new Set<string>();
  return [...assignmentImageAttachment(assignment), ...attachments.filter((attachment) => attachment.attachmentType === "image")]
    .filter((attachment) => {
      if (!attachment.fileUrl || seen.has(attachment.fileUrl)) return false;
      seen.add(attachment.fileUrl);
      return true;
    });
}

export default function TeacherAssignmentPreviewPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<TeacherAssignmentPreview | null>(null);
  const [error, setError] = useState("");
  const normalizedType = assignment ? normalizeAssignmentType(assignment.type) : null;
  const normalizedAssignment = assignment && normalizedType ? { ...assignment, type: normalizedType } : null;

  useEffect(() => {
    fetch(`/api/teacher/assignments?id=${assignmentId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setAssignment(data.assignment ?? null))
      .catch(() => setError("과제 미리보기를 불러오지 못했습니다."));
  }, [assignmentId]);

  return (
    <TeacherLayout title="학생 화면 미리보기">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-500">
          실제 학생 화면과 같은 흐름으로 입력, 녹음, AI 첨삭을 테스트할 수 있습니다. 제출 버튼은 실제 저장 API를 호출하지 않습니다.
        </p>
        <Button href="/teacher/assignments" variant="secondary">숙제 목록으로</Button>
      </div>
      {error && <Card><p className="text-sm font-semibold text-danger">{error}</p></Card>}
      {!assignment && !error && <Card><p className="text-sm text-slate-500">미리보기를 불러오는 중입니다.</p></Card>}
      {assignment?.parts?.length ? (
        <MultiPartPreview assignment={assignment} />
      ) : (
        <>
          {normalizedAssignment?.type === "listening_recording" && <RlPreview assignment={normalizedAssignment} />}
          {normalizedAssignment?.type === "listening" && <ListeningPreview assignment={normalizedAssignment} />}
          {normalizedAssignment?.type === "writing" && <WritingPreview assignment={normalizedAssignment} />}
          {normalizedAssignment?.type === "vocabulary_example" && <VocabularyPreview assignment={normalizedAssignment} mode="example" />}
          {normalizedAssignment?.type === "vocabulary_recording" && <VocabularyPreview assignment={normalizedAssignment} mode="recording" />}
          {normalizedAssignment?.type === "photo_submission" && <PhotoSubmissionPreview assignment={normalizedAssignment} />}
        </>
      )}
    </TeacherLayout>
  );
}

function partTypeLabel(type: string) {
  if (type === "recording") return "듣고녹음하기";
  if (type === "listening") return "리스닝";
  if (type === "writing") return "라이팅";
  if (type === "photo_submission") return "사진 제출";
  if (type === "vocabulary_example") return "단어장 예문";
  if (type === "vocabulary_recording") return "단어장 녹음";
  return assignmentTypeLabel(type);
}

function Header({ assignment }: { assignment: TeacherAssignmentPreview }) {
  const partTypes = assignment.partTypes?.length
    ? assignment.partTypes
    : Array.from(new Set((assignment.parts ?? []).filter((part) => part.status !== "archived").map((part) => part.partType)));
  return (
    <Card className="shadow-soft">
      <div className="flex flex-wrap gap-2">
        <Badge tone="blue">{assignment.subject || "Phonics"}</Badge>
        {(partTypes.length ? partTypes : [assignment.type]).map((type) => (
          <Badge key={type} tone="green">{partTypeLabel(type)}</Badge>
        ))}
        <Badge>{assignment.status}</Badge>
      </div>
      <h1 className="mt-4 text-2xl font-bold">{assignment.title}</h1>
      {assignment.description && <p className="mt-2 leading-7 text-slate-600">{assignment.description}</p>}
    </Card>
  );
}

function MultiPartPreview({ assignment }: { assignment: TeacherAssignmentPreview }) {
  const parts = (assignment.parts ?? []).filter((part) => part.status !== "archived").sort((a, b) => a.orderIndex - b.orderIndex);
  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <Card>
        <h2 className="font-bold">숙제 내용</h2>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{assignment.description || "설명이 없습니다."}</p>
      </Card>
      <div className="grid gap-4">
        {parts.map((part, index) => <PartPreviewCard key={part.id} assignment={assignment} part={part} index={index} />)}
      </div>
    </div>
  );
}

function PartPreviewCard({
  assignment,
  part,
  index,
}: {
  assignment: TeacherAssignmentPreview;
  part: NonNullable<TeacherAssignmentPreview["parts"]>[number];
  index: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorder = useAudioRecorder();
  const [hasListenedFullAudio, setHasListenedFullAudio] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [answerText, setAnswerText] = useState("");
  const imageAttachments = mergeImageAttachments(assignment, part.attachments ?? []);
  const audioAttachments = (part.attachments ?? []).filter((attachment) => attachment.attachmentType === "audio");
  const firstAudioUrl = audioAttachments[0]?.fileUrl ?? "";
  const isSentences = part.writingUnit === "sentences";
  const isTopicDiary = part.writingMode === "topic_diary";

  function goStep(nextStep: 1 | 2) {
    if (nextStep === 2 && !hasListenedFullAudio) return;
    audioRef.current?.pause();
    recordedAudioRef.current?.pause();
    if (recorder.state === "recording") recorder.stopRecording();
    setStep(nextStep);
  }

  async function startRecording() {
    audioRef.current?.pause();
    recordedAudioRef.current?.pause();
    await recorder.startRecording();
  }

  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        <Badge tone="blue">Part {index + 1}</Badge>
        <Badge tone="green">{partTypeLabel(part.partType)}</Badge>
        {part.isRequired && <Badge>필수</Badge>}
      </div>
      <h2 className="mt-3 text-lg font-bold">{part.title || `Part ${index + 1}`}</h2>

      {(part.partType === "recording" || part.partType === "listening") && (
        <div className="mt-4 grid gap-4">
          <PartContent part={part} imageAttachments={imageAttachments} />
          <div className="rounded-lg border border-line p-4">
            <p className="text-sm font-bold text-action">{part.partType === "recording" && step === 2 ? "Record" : "Listen"}</p>
            <h3 className="mt-2 font-bold">{part.partType === "recording" && step === 2 ? "문장을 보며 내 목소리로 녹음해보세요." : "원본 음원을 끝까지 듣습니다."}</h3>
            {step === 1 && (
              <>
                <AudioPlayer ref={audioRef} className="mt-4" src={firstAudioUrl} preload="metadata" onEnded={() => setHasListenedFullAudio(true)} />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}>-10초</Button>
                  <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10); }}>+10초</Button>
                </div>
              </>
            )}
            {part.partType === "recording" && step === 2 && (
              <>
                <div className="mt-4 rounded-lg border border-line p-4">
                  <p className="font-semibold">녹음 상태: {recorder.state === "recording" ? "녹음 중" : recorder.previewUrl ? "녹음 완료" : "대기 중"}</p>
                  <p className="mt-1 text-sm text-slate-500">녹음 시간: {formatSeconds(recorder.durationSec)}</p>
                </div>
                {recorder.previewUrl && <AudioPlayer ref={recordedAudioRef} className="mt-4" src={recorder.previewUrl} preload="metadata" />}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {recorder.state === "recording" ? (
                    <Button type="button" variant="danger" onClick={recorder.stopRecording}>녹음 중지</Button>
                  ) : (
                    <Button type="button" onClick={startRecording}>녹음 시작</Button>
                  )}
                  <Button type="button" variant="secondary" onClick={recorder.resetRecording} disabled={!recorder.previewUrl}>다시 녹음하기</Button>
                </div>
              </>
            )}
          </div>
          {part.partType === "recording" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Button type="button" variant={step === 1 ? "primary" : "secondary"} onClick={() => goStep(1)}>듣기</Button>
              <Button type="button" variant={step === 2 ? "primary" : "secondary"} disabled={!hasListenedFullAudio} onClick={() => goStep(2)}>녹음</Button>
              <Button type="button" disabled={!recorder.previewUrl}>저장하기</Button>
            </div>
          ) : (
            <Button type="button" disabled={!hasListenedFullAudio}>저장하기</Button>
          )}
        </div>
      )}

      {part.partType === "writing" && (
        <div className="mt-4 grid gap-4">
          <Card className="border border-line shadow-none">
            <p className="text-sm font-bold text-action">Writing</p>
            <h3 className="mt-2 font-bold">
              {isTopicDiary
                ? `Write 4 ${isSentences ? "sentences" : "paragraphs"} about below.`
                : `See the picture and describe it in 4 ${isSentences ? "sentences" : "paragraphs"}.`}
            </h3>
          </Card>
          <PartContent part={part} imageAttachments={imageAttachments} />
          <label className="grid gap-2 text-sm font-bold">
            내가 쓴 글
            <Textarea className="min-h-[160px]" value={answerText} onChange={(event) => setAnswerText(event.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="secondary" disabled={!answerText.trim()}>AI 첨삭받기</Button>
            <Button type="button" disabled={!answerText.trim()}>저장하기</Button>
          </div>
        </div>
      )}

      {(part.partType === "vocabulary_example" || part.partType === "vocabulary_recording") && (
        <div className="mt-4 grid gap-4">
          <PartContent part={part} imageAttachments={imageAttachments} />
          <div className="rounded-lg border border-line p-4">
            <h3 className="font-bold">단어장</h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(part.vocabularyItems ?? []).map((item) => (
                <div key={item.id} className="grid grid-cols-2 rounded-md border border-line">
                  <span className="border-r border-line px-3 py-2 font-bold">{item.word}</span>
                  <span className="px-3 py-2">{item.meaning}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="rounded-lg bg-blue-50 p-3 text-sm font-semibold text-action">
            {part.partType === "vocabulary_example" ? "학생은 단어별로 문장을 작성하고 AI 첨삭을 받습니다." : "학생은 단어장을 보며 녹음하고 저장합니다."}
          </p>
        </div>
      )}

      {part.partType === "photo_submission" && (
        <div className="mt-4 grid gap-4">
          <PartContent part={part} imageAttachments={imageAttachments} audioAttachments={audioAttachments} />
          <div className="rounded-lg border border-dashed border-line p-4">
            <h3 className="font-bold">사진 제출</h3>
            <p className="mt-2 text-sm text-slate-500">학생 화면에서는 여기서 여러 장의 사진을 선택하고 저장합니다. 파일 1개당 최대 10MB까지 업로드할 수 있습니다.</p>
          </div>
          <Button type="button">저장하기</Button>
        </div>
      )}
    </Card>
  );
}

function PartContent({
  part,
  imageAttachments,
  audioAttachments = [],
}: {
  part: NonNullable<TeacherAssignmentPreview["parts"]>[number];
  imageAttachments: NonNullable<NonNullable<TeacherAssignmentPreview["parts"]>[number]["attachments"]>;
  audioAttachments?: NonNullable<NonNullable<TeacherAssignmentPreview["parts"]>[number]["attachments"]>;
}) {
  return (
    <div className="rounded-lg border border-line p-4">
      {part.instruction && <p className="whitespace-pre-wrap leading-7 text-slate-700">{part.instruction}</p>}
      {imageAttachments.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {imageAttachments.map((attachment) => (
            <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line bg-slate-50">
              <img src={attachment.fileUrl} alt={attachment.fileName || part.title} className="h-auto w-full object-contain" />
            </a>
          ))}
        </div>
      )}
      {part.scriptText && (
        <div className="mt-4 rounded-lg bg-paper p-4">
          <p className="whitespace-pre-wrap leading-7 text-slate-800">{part.scriptText}</p>
        </div>
      )}
      {(part.writingHint || part.writingExample) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {part.writingHint && <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4"><p className="font-bold text-yellow-800">힌트</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{part.writingHint}</p></div>}
          {part.writingExample && <div className="rounded-lg border border-green-100 bg-green-50 p-4"><p className="font-bold text-green-800">예시</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{part.writingExample}</p></div>}
        </div>
      )}
      {audioAttachments.length > 0 && (
        <div className="mt-4 grid gap-3">
          {audioAttachments.map((attachment) => <AudioPlayer key={attachment.id} src={attachment.fileUrl} preload="metadata" />)}
        </div>
      )}
    </div>
  );
}

function VocabularyPreview({ assignment, mode }: { assignment: TeacherAssignmentPreview; mode: "example" | "recording" }) {
  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <Card>
        <p className="text-sm font-bold text-action">{mode === "example" ? "Vocabulary Sentence Writing" : "Vocabulary Reading"}</p>
        <h2 className="mt-2 text-lg font-bold">{assignment.item.passageText || (mode === "example" ? "Write a sentence using a given vocabulary." : "Read out loud and record.")}</h2>
      </Card>
      <Card>
        <h2 className="font-bold">단어장</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(assignment.vocabularyItems ?? []).map((item) => (
            <div key={item.id} className="grid grid-cols-2 rounded-md border border-line">
              <span className="border-r border-line px-3 py-2 font-bold">{item.word}</span>
              <span className="px-3 py-2">{item.meaning}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-sm text-slate-600">
          {mode === "example"
            ? "학생 화면에서는 단어별로 문장 작성, AI 첨삭, 다시 쓰기를 진행합니다."
            : "학생 화면에서는 단어장을 보며 전체를 한 번에 녹음하고 제출합니다."}
        </p>
      </Card>
    </div>
  );
}

function Content({
  assignment,
  promptText,
  imageAttachments = [],
}: {
  assignment: TeacherAssignmentPreview;
  promptText?: string;
  imageAttachments?: PreviewAttachment[];
}) {
  const text = promptText ?? assignment.item.passageText;
  const hasWritingGuide = assignment.item.writingInstructions || assignment.item.writingHint || assignment.item.writingExample;
  const displayImages = mergeImageAttachments(assignment, imageAttachments);
  return (
    <Card>
      <h2 className="font-bold">이미지 / 스크립트</h2>
      {displayImages.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {displayImages.map((image) => (
            <a key={image.id} href={image.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line bg-slate-50">
              <img src={image.fileUrl} alt={image.fileName || "과제 이미지"} className="h-auto w-full object-contain" />
            </a>
          ))}
        </div>
      )}
      {text && (
        <div className="mt-4 max-h-[300px] overflow-auto rounded-lg bg-paper p-4">
          <p className="whitespace-pre-wrap text-lg leading-9 text-slate-800">{text}</p>
        </div>
      )}
      {hasWritingGuide && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {assignment.item.writingInstructions && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-action">추가 지시문</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assignment.item.writingInstructions}</p>
            </div>
          )}
          {assignment.item.writingHint && (
            <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
              <p className="text-sm font-bold text-yellow-800">힌트</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assignment.item.writingHint}</p>
            </div>
          )}
          {assignment.item.writingExample && (
            <div className="rounded-lg border border-green-100 bg-green-50 p-4">
              <p className="text-sm font-bold text-green-800">예시</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assignment.item.writingExample}</p>
            </div>
          )}
        </div>
      )}
      {displayImages.length === 0 && !text && !hasWritingGuide && <p className="mt-3 text-sm text-slate-500">표시할 이미지 또는 스크립트가 없습니다.</p>}
    </Card>
  );
}

function RlPreview({ assignment }: { assignment: TeacherAssignmentPreview }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorder = useAudioRecorder();
  const [step, setStep] = useState<1 | 2>(1);
  const [hasListenedFullAudio, setHasListenedFullAudio] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  const minRecordingSec = Number(assignment.item.minRecordingSec || 0);
  const canSubmit = Boolean(recorder.recordingBlob) && recorder.durationSec >= minRecordingSec;

  function goStep(nextStep: 1 | 2) {
    if (nextStep === 2 && !hasListenedFullAudio) return;
    audioRef.current?.pause();
    recordedAudioRef.current?.pause();
    if (recorder.state === "recording") recorder.stopRecording();
    setStep(nextStep);
  }

  async function startRecording() {
    audioRef.current?.pause();
    recordedAudioRef.current?.pause();
    await recorder.startRecording();
  }

  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <Card>
        <p className="text-sm font-bold text-action">{step === 1 ? "Listen and Repeat" : "Record"}</p>
        <h2 className="mt-2 text-lg font-bold">{step === 1 ? "원본 음원을 끝까지 듣고 따라 말해보세요." : "문장을 보며 내 목소리로 녹음해보세요."}</h2>
      </Card>
      <Content assignment={assignment} />
      <Card>
        {step === 1 ? (
          <>
            <h2 className="font-bold">MP3 재생바</h2>
            <AudioPlayer ref={audioRef} className="mt-4" src={assignment.item.audioUrl} preload="metadata" onEnded={() => setHasListenedFullAudio(true)} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}>-10초</Button>
              <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10); }}>+10초</Button>
            </div>
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-action">
              {hasListenedFullAudio ? "녹음 단계로 이동할 수 있습니다." : "학생 화면에서는 끝까지 들어야 녹음 단계가 열립니다."}
            </p>
          </>
        ) : (
          <>
            <h2 className="font-bold">녹음 바</h2>
            <div className="mt-4 rounded-lg border border-line p-4">
              <p className="font-semibold">녹음 상태: {recorder.state === "recording" ? "녹음 중" : recorder.previewUrl ? "녹음 완료" : "대기 중"}</p>
              <p className="mt-1 text-sm text-slate-500">녹음 시간: {formatSeconds(recorder.durationSec)} / 최소 {formatSeconds(minRecordingSec)}</p>
              {recorder.errorMessage && <p className="mt-3 text-sm font-semibold text-danger">마이크 권한이 필요합니다.</p>}
            </div>
            {recorder.previewUrl && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-bold text-slate-600">미리보기 녹음 다시 듣기</p>
                <AudioPlayer ref={recordedAudioRef} src={recorder.previewUrl} preload="metadata" onPlay={() => audioRef.current?.pause()} />
              </div>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {recorder.state === "recording" ? (
                <Button type="button" variant="danger" onClick={recorder.stopRecording}>녹음 중지</Button>
              ) : (
                <Button type="button" onClick={startRecording}>녹음 시작</Button>
              )}
              <Button type="button" variant="secondary" onClick={recorder.resetRecording} disabled={!recorder.previewUrl}>다시 녹음하기</Button>
            </div>
          </>
        )}
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <Button type="button" variant={step === 1 ? "primary" : "secondary"} onClick={() => goStep(1)}>듣기</Button>
        <Button type="button" variant={step === 2 ? "primary" : "secondary"} disabled={!hasListenedFullAudio} onClick={() => goStep(2)}>녹음</Button>
        <Button type="button" disabled={!canSubmit} onClick={() => setSubmitOpen(true)}>제출</Button>
      </div>
      {submitOpen && <PreviewSubmitModal onClose={() => setSubmitOpen(false)} />}
    </div>
  );
}

function ListeningPreview({ assignment }: { assignment: TeacherAssignmentPreview }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasListenedFullAudio, setHasListenedFullAudio] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <Card><p className="text-sm font-bold text-action">Listen and Repeat</p><h2 className="mt-2 text-lg font-bold">원본 음원을 끝까지 듣고 완료합니다.</h2></Card>
      <Content assignment={assignment} />
      <Card>
        <h2 className="font-bold">MP3 재생바</h2>
        <AudioPlayer ref={audioRef} className="mt-4" src={assignment.item.audioUrl} preload="metadata" onEnded={() => setHasListenedFullAudio(true)} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}>-10초</Button>
          <Button type="button" variant="secondary" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 10); }}>+10초</Button>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button">듣기</Button>
        <Button type="button" disabled={!hasListenedFullAudio} onClick={() => setCompleteOpen(true)}>완료하기</Button>
      </div>
      {completeOpen && <PreviewSubmitModal title="완료하시겠습니까?" body="미리보기에서는 완료 상태가 저장되지 않습니다." onClose={() => setCompleteOpen(false)} />}
    </div>
  );
}

function PhotoSubmissionPreview({ assignment }: { assignment: TeacherAssignmentPreview }) {
  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <Card>
        <p className="text-sm font-bold text-action">Photo Submission</p>
        <h2 className="mt-2 text-lg font-bold">사진 설명과 스크립트를 확인한 뒤 사진을 첨부합니다.</h2>
      </Card>
      <Content assignment={assignment} />
      <Card>
        <h2 className="font-bold">사진 제출</h2>
        <p className="mt-3 rounded-lg border border-dashed border-line p-4 text-sm text-slate-500">
          학생 화면에서는 여기서 여러 장의 사진을 선택하고 제출합니다. 파일 1개당 최대 10MB까지 업로드할 수 있습니다.
        </p>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={() => undefined}>제출하기</Button>
        </div>
      </Card>
    </div>
  );
}

function WritingPreview({ assignment }: { assignment: TeacherAssignmentPreview }) {
  const isSentences = assignment.item.writingUnit === "sentences";
  const isPicture = assignment.item.writingMode !== "topic_diary";
  const instruction = isPicture
    ? `See the picture and describe it in 4 ${isSentences ? "sentences" : "paragraphs"}.`
    : isSentences
      ? "Write 4 sentences about below."
      : "Write a 4 paragraph essay about below.";
  const promptText = assignment.item.promptText || assignment.item.passageText;
  const storageKey = `teacher-preview-writing-${assignment.id}`;
  const [answerText, setAnswerText] = useState("");
  const [revisedText, setRevisedText] = useState("");
  const revisedTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAnswerText(window.localStorage.getItem(storageKey) ?? "");
  }, [storageKey]);

  function updateAnswer(value: string) {
    setAnswerText(value);
    window.localStorage.setItem(storageKey, value);
  }

  async function requestAiPreview() {
    if (!answerText.trim()) return;
    setError("");
    setIsAiLoading(true);
    try {
      const response = await fetch("/api/teacher/writing-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          assignmentItemId: assignment.item.id,
          writingMode: assignment.item.writingMode,
          writingUnit: assignment.item.writingUnit,
          promptText,
          writingInstructions: assignment.item.writingInstructions,
          writingHint: assignment.item.writingHint,
          writingExample: assignment.item.writingExample,
          imageUrl: assignment.imageUrl,
          answerText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI 첨삭에 실패했습니다.");
      setAiPreview(data);
      setRevisedText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 첨삭에 실패했습니다.");
    } finally {
      setIsAiLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Header assignment={assignment} />
      <Card><p className="text-sm font-bold text-action">Writing</p><h2 className="mt-2 text-lg font-bold">{instruction}</h2></Card>
      <Content assignment={assignment} promptText={promptText} />
      <Card>
        <label className="grid gap-2 text-sm font-bold">
          내가 쓴 글
          <Textarea className="min-h-[180px]" placeholder="4 paragraphs or sentences." value={answerText} onChange={(event) => updateAnswer(event.target.value)} />
        </label>
        {aiPreview && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-line p-4">
              <p className="font-bold">내가 쓴 글</p>
              <p className="mt-2 whitespace-pre-wrap leading-7">{answerText}</p>
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
              <p className="font-bold text-action">AI 선생님 첨삭</p>
              <p className="mt-2 whitespace-pre-wrap leading-7">{aiPreview.correctedText}</p>
              <p className="mt-3 text-sm text-slate-600">{aiPreview.feedback}</p>
              {aiPreview.grammarNotes?.length ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600"><strong>문법 교정사항</strong><br />{aiPreview.grammarNotes.join("\n")}</p> : null}
              {aiPreview.expressionNotes?.length ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600"><strong>알면 좋은 표현</strong><br />{aiPreview.expressionNotes.join("\n")}</p> : null}
            </div>
          </div>
        )}
        {aiPreview && (
          <div className="mt-4 rounded-lg border border-line p-4">
            <label className="grid gap-2 text-sm font-bold">
              다시 쓰는 글
              <Textarea
                ref={revisedTextRef}
                className="min-h-[180px]"
                placeholder="AI 선생님 첨삭을 보고 다시 써보세요."
                value={revisedText}
                onChange={(event) => setRevisedText(event.target.value)}
              />
            </label>
          </div>
        )}
        {error && <p className="mt-4 text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="secondary" onClick={requestAiPreview} disabled={!answerText.trim() || isAiLoading}>{isAiLoading ? "AI 첨삭 중..." : "AI 첨삭받기"}</Button>
          <Button type="button" disabled={!aiPreview || !revisedText.trim()} onClick={() => setSubmitOpen(true)}>제출하기</Button>
        </div>
      </Card>
      {isAiLoading && <LoadingModal />}
      {submitOpen && <PreviewSubmitModal onClose={() => setSubmitOpen(false)} />}
    </div>
  );
}

function LoadingModal() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-soft">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-action" />
        <h2 className="mt-4 text-xl font-extrabold">AI 선생님이 첨삭하는 중이에요!</h2>
        <p className="mt-2 text-slate-600">잠시 기다려주세요.</p>
      </div>
    </div>
  );
}

function PreviewSubmitModal({
  title = "제출하시겠습니까?",
  body = "미리보기에서는 입력, 녹음, AI 첨삭을 테스트할 수 있지만 실제 제출은 저장되지 않습니다.",
  onClose,
}: {
  title?: string;
  body?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-3 leading-7 text-slate-600">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}
