"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { saveAssignmentDraft, submitAssignmentDraft } from "@/features/assignments/api/assignmentDraftApi";
import type { Assignment } from "@/types/assignment";
import type { PartSavePayload } from "./partMode";

type AssignmentPart = NonNullable<Assignment["parts"]>[number];

type QuizPartPlayerProps = {
  assignment: Assignment;
  part: AssignmentPart;
  partIndex?: number;
  partCount?: number;
  partMode?: {
    onSave: (payload?: PartSavePayload) => void | Promise<void>;
    label?: string;
    tooltip?: string;
  };
};

function initialAnswers(assignment: Assignment, part: AssignmentPart) {
  const draftData = assignment.draft?.draftData?.[part.id] as { quizAnswers?: Record<string, string> } | undefined;
  const submitted = (assignment.submissionParts ?? [])
    .find((submissionPart) => submissionPart.assignmentPartId === part.id)
    ?.quizAnswers ?? [];
  return {
    ...(draftData?.quizAnswers ?? {}),
    ...Object.fromEntries(submitted.map((answer) => [answer.questionId, answer.selectedChoiceId ?? ""]).filter(([, choiceId]) => choiceId)),
  };
}

export function QuizPartPlayer({ assignment, part, partIndex = 0, partCount = 1, partMode }: QuizPartPlayerProps) {
  const router = useRouter();
  const questions = [...(part.quizQuestions ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialAnswers(assignment, part));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const currentQuestion = questions[currentIndex];
  const selectedChoiceId = currentQuestion ? answers[currentQuestion.id] : "";
  const hasSelectedChoice = Boolean(selectedChoiceId);
  const canContinue = hasSelectedChoice;
  const answeredCount = useMemo(() => questions.filter((question) => answers[question.id]).length, [answers, questions]);
  const isLastQuestion = currentIndex === questions.length - 1;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  async function persist(nextAnswers: Record<string, string>) {
    await saveAssignmentDraft({
      assignmentId: assignment.id,
      assignmentPartId: part.id,
      assignmentItemId: assignment.items[0]?.id,
      currentPartOrder: part.orderIndex,
      data: {
        partType: "quiz",
        quizAnswers: nextAnswers,
        savedAt: new Date().toISOString(),
      },
    });
  }

  async function selectChoice(choiceId: string) {
    if (!currentQuestion) return;
    const nextAnswers = { ...answers, [currentQuestion.id]: choiceId };
    setAnswers(nextAnswers);
    setError("");
    try {
      await persist(nextAnswers);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "답안을 저장하지 못했습니다.");
    }
  }

  async function goNextOrSubmit() {
    if (!canContinue) return;
    if (!isLastQuestion) {
      setCurrentIndex((value) => Math.min(value + 1, questions.length - 1));
      return;
    }
    if (!allAnswered) return;

    setPending(true);
    setError("");
    try {
      if (partMode) {
        await partMode.onSave({ data: { partType: "quiz", quizAnswers: answers } });
      } else {
        await persist(answers);
        await submitAssignmentDraft(assignment.id);
        router.push(`/student/assignments/${assignment.id}/complete`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "퀴즈를 제출하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  if (questions.length === 0) {
    return <Card><p className="text-sm font-semibold text-slate-600">퀴즈 문제가 아직 없습니다.</p></Card>;
  }

  const images = (currentQuestion.attachments ?? []).filter((attachment) => attachment.attachmentType === "image");
  const audioFiles = (currentQuestion.attachments ?? []).filter((attachment) => attachment.attachmentType === "audio");
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">Part {partIndex + 1} / {partCount}</Badge>
              <Badge tone="green">퀴즈</Badge>
            </div>
            <h2 className="mt-2 text-2xl font-extrabold">{part.title || assignment.title}</h2>
            {part.instruction && <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{part.instruction}</p>}
          </div>
          <p className="text-sm font-extrabold text-action">{currentIndex + 1} / {questions.length}</p>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-action" style={{ width: `${progressPercent}%` }} />
        </div>
      </Card>

      <Card>
        <p className="text-sm font-extrabold text-action">Q{currentIndex + 1}</p>
        <h3 className="mt-2 text-2xl font-extrabold leading-9">{currentQuestion.questionText}</h3>

        {images.length > 0 && (
          <div className="mt-5 grid gap-3">
            {images.map((image) => (
              <img key={image.id} src={image.fileUrl} alt={image.fileName ?? "퀴즈 이미지"} className="max-h-[360px] w-full rounded-lg border border-line object-contain" />
            ))}
          </div>
        )}

        {audioFiles.length > 0 && (
          <div className="mt-5 grid gap-3">
            {audioFiles.map((audio) => (
              <div key={audio.id} className="rounded-lg border border-line bg-blue-50 p-3">
                <p className="mb-2 text-base font-extrabold text-action">발음 듣기</p>
                {audio.fileUrl && <AudioPlayer src={audio.fileUrl} preload="metadata" />}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {currentQuestion.choices.map((choice) => {
            const isSelected = choice.id === selectedChoiceId;
            const tone = isSelected ? "border-action bg-blue-50 text-action" : "border-line bg-white text-slate-800";
            return (
              <button
                key={choice.id}
                type="button"
              disabled={false}
                onClick={() => selectChoice(choice.id)}
                className={`min-h-16 rounded-lg border-2 px-4 py-3 text-left text-xl font-extrabold transition ${tone} disabled:cursor-default`}
              >
                {choice.choiceLabel || ""}. {choice.choiceText}
              </button>
            );
          })}
        </div>
      </Card>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}

      <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-paper/95 py-3 backdrop-blur">
        <Button type="button" variant="secondary" onClick={() => setCurrentIndex((value) => Math.max(value - 1, 0))} disabled={currentIndex === 0 || pending}>
          이전 문제
        </Button>
        <Button type="button" onClick={goNextOrSubmit} disabled={!canContinue || pending || (isLastQuestion && !allAnswered)}>
          {!selectedChoiceId ? "답을 선택해주세요" : isLastQuestion ? (partMode?.label ?? "제출하기") : "다음 문제"}
        </Button>
      </div>
    </div>
  );
}
