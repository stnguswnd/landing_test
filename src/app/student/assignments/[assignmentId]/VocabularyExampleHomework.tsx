"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import type { Assignment } from "@/types/assignment";
import { ReadyStepButton } from "./ReadyStepButton";

type WordState = {
  originalAnswerText: string;
  aiCorrectedText: string;
  aiFeedback: string;
  aiGrammarNotes: string;
  aiFeedbackRaw?: unknown;
  revisedAnswerText: string;
  reviewed: boolean;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function VocabularyExampleHomework({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const item = assignment.items[0];
  const vocabularyItems = assignment.vocabularyItems ?? [];
  const submittedByWord = new Map((assignment.submissionVocabularyItems ?? []).map((answer) => [answer.assignmentVocabularyItemId, answer]));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [states, setStates] = useState<Record<string, WordState>>(() => {
    const initial: Record<string, WordState> = {};
    for (const word of vocabularyItems) {
      const submitted = submittedByWord.get(word.id);
      initial[word.id] = {
        originalAnswerText: submitted?.originalAnswerText ?? "",
        aiCorrectedText: submitted?.aiCorrectedText ?? "",
        aiFeedback: submitted?.aiFeedback ?? "",
        aiGrammarNotes: submitted?.aiGrammarNotes ?? "",
        aiFeedbackRaw: submitted?.aiFeedbackRaw,
        revisedAnswerText: submitted?.revisedAnswerText ?? "",
        reviewed: Boolean(submitted?.aiCorrectedText),
      };
    }
    return initial;
  });
  const [message, setMessage] = useState("");
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const currentWord = vocabularyItems[currentIndex];
  const currentState = currentWord ? states[currentWord.id] : undefined;
  const allReady = vocabularyItems.length > 0 && vocabularyItems.every((word) => states[word.id]?.reviewed && states[word.id]?.revisedAnswerText.trim());
  const isLast = currentIndex === vocabularyItems.length - 1;

  const instruction = item?.passageText || "Write a sentence using a given vocabulary.";
  const progressText = useMemo(() => `${Math.min(currentIndex + 1, vocabularyItems.length)} / ${vocabularyItems.length}`, [currentIndex, vocabularyItems.length]);

  function updateCurrent(patch: Partial<WordState>) {
    if (!currentWord) return;
    setStates((current) => ({ ...current, [currentWord.id]: { ...current[currentWord.id], ...patch } }));
  }

  function requestFeedback() {
    if (!currentWord || !currentState?.originalAnswerText.trim()) return;
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/student/vocabulary-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: currentWord.word,
          meaning: currentWord.meaning,
          sentence: currentState.originalAnswerText,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "AI 첨삭 중 오류가 발생했습니다.");
        return;
      }
      updateCurrent({
        aiCorrectedText: data.correctedText ?? currentState.originalAnswerText,
        aiFeedback: data.feedback ?? "",
        aiGrammarNotes: data.grammarNotes ?? "",
        aiFeedbackRaw: data.raw,
        revisedAnswerText: data.correctedText ?? "",
        reviewed: true,
      });
    });
  }

  function submit() {
    if (!item || !allReady) return;
    startTransition(async () => {
      const answers = vocabularyItems.map((word) => ({
        assignmentVocabularyItemId: word.id,
        originalAnswerText: states[word.id].originalAnswerText,
        aiCorrectedText: states[word.id].aiCorrectedText,
        aiFeedback: states[word.id].aiFeedback,
        aiGrammarNotes: states[word.id].aiGrammarNotes,
        aiFeedbackRaw: states[word.id].aiFeedbackRaw,
        revisedAnswerText: states[word.id].revisedAnswerText,
      }));
      const response = await fetch("/api/student/submissions/vocabulary-example", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, assignmentItemId: item.id, answers }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "제출 중 오류가 발생했습니다.");
        return;
      }
      router.push(`/student/assignments/${assignment.id}/complete`);
    });
  }

  if (!currentWord || !currentState) {
    return <Card><p className="text-sm text-slate-500">등록된 단어가 없습니다. 선생님에게 문의해주세요.</p></Card>;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{assignment.assignmentSubject ?? "Phonics"}</Badge>
          {assignment.dueAt && <Badge tone="yellow">마감 {formatDateTime(assignment.dueAt)}</Badge>}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">{assignment.title}</h1>
        {assignment.description && <p className="mt-2 text-slate-600">{assignment.description}</p>}
        <p className="mt-3 text-lg font-semibold text-slate-700">{instruction}</p>
      </Card>

      <Card>
        <p className="text-4xl font-extrabold text-action">{progressText}</p>
        <div className="mt-4 grid overflow-hidden rounded-xl border border-blue-100 bg-blue-50 md:grid-cols-2">
          <div className="grid place-items-center border-b border-blue-100 p-8 md:border-b-0 md:border-r">
            <p className="text-sm font-bold text-slate-500">단어</p>
            <p className="mt-4 text-5xl font-extrabold text-ink">{currentWord.word}</p>
          </div>
          <div className="grid place-items-center p-8">
            <p className="text-sm font-bold text-slate-500">뜻</p>
            <p className="mt-4 text-5xl font-extrabold text-ink">{currentWord.meaning}</p>
          </div>
        </div>
      </Card>

      <Card>
        <label className="grid gap-2 text-sm font-bold">
          문장 작성
          <Textarea
            value={currentState.originalAnswerText}
            onChange={(event) => updateCurrent({ originalAnswerText: event.target.value })}
            placeholder="Write a sentence."
            className="min-h-[140px] text-base"
          />
        </label>
        <p className="mt-2 text-right text-sm font-semibold text-slate-400">{currentState.originalAnswerText.length} / 200</p>

        {currentState.reviewed && (
          <div className="mt-5 rounded-xl border border-line p-4">
            <h2 className="text-lg font-extrabold">AI 첨삭 결과</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">내 문장</p>
                <p className="mt-3 whitespace-pre-wrap text-lg">{currentState.originalAnswerText}</p>
              </div>
              <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                <p className="text-sm font-bold text-green-700">첨삭 문장</p>
                <p className="mt-3 whitespace-pre-wrap text-lg">{currentState.aiCorrectedText}</p>
              </div>
            </div>
            {currentState.aiFeedback && <p className="mt-4 leading-7 text-slate-700">{currentState.aiFeedback}</p>}
            {currentState.aiGrammarNotes && <p className="mt-2 text-sm leading-6 text-slate-600">{currentState.aiGrammarNotes}</p>}
            <label className="mt-4 grid gap-2 text-sm font-bold">
              다시 쓰기
              <Textarea
                value={currentState.revisedAnswerText}
                onChange={(event) => updateCurrent({ revisedAnswerText: event.target.value })}
                placeholder="첨삭을 보고 다시 써보세요."
                className="min-h-[120px] text-base"
              />
            </label>
          </div>
        )}

        {message && <p className="mt-3 text-sm font-semibold text-danger">{message}</p>}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Button type="button" variant="secondary" disabled={currentIndex === 0 || pending} onClick={() => setCurrentIndex((value) => Math.max(value - 1, 0))}>
            전 단어
          </Button>
          <Button type="button" variant="secondary" disabled={!currentState.originalAnswerText.trim() || currentState.reviewed || pending} onClick={requestFeedback}>
            {pending ? "첨삭 중..." : currentState.reviewed ? "1회 첨삭 완료" : "AI 첨삭받기"}
          </Button>
          {isLast ? (
            <ReadyStepButton disabled={!allReady || pending} onClick={() => setIsSubmitOpen(true)} tooltip="모든 단어 연습이 끝났어요. 제출할 수 있어요.">제출하기</ReadyStepButton>
          ) : (
            <ReadyStepButton disabled={!currentState.reviewed || !currentState.revisedAnswerText.trim()} onClick={() => setCurrentIndex((value) => Math.min(value + 1, vocabularyItems.length - 1))} tooltip="첨삭 확인과 다시 쓰기가 끝났어요. 다음 단어로 넘어갈 수 있어요.">
              다음 단어
            </ReadyStepButton>
          )}
        </div>
      </Card>

      {isSubmitOpen && (
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
    </div>
  );
}
