"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { requestWritingFeedback, submitWritingAssignment, type WritingFeedbackResult } from "@/features/submissions/api/submissionApi";
import { formatDateTime, formatDue } from "@/lib/format";
import type { Assignment } from "@/types/assignment";
import { ReadyStepButton } from "./ReadyStepButton";

function writingInstruction(item: Assignment["items"][number]) {
  const unit = item.writingUnit === "sentences" ? "sentences" : "paragraphs";
  if (item.writingMode === "picture_description") {
    return unit === "sentences"
      ? "See the picture and describe it in 4 sentences."
      : "See the picture and describe it in 4 paragraphs.";
  }
  return unit === "sentences"
    ? "Write 4 sentences about below."
    : "Write a 4 paragraph essay about below.";
}

export function WritingHomework({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const item = assignment.items[0];
  const [answerText, setAnswerText] = useState(item?.answerText ?? "");
  const [revisedText, setRevisedText] = useState("");
  const revisedTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [aiResult, setAiResult] = useState<WritingFeedbackResult | null>(
    item?.aiCorrectedText
      ? {
          correctedText: item.aiCorrectedText,
          feedback: item.aiFeedback ?? "",
          grammarNotes: item.aiGrammarNotes ? [item.aiGrammarNotes] : [],
          expressionNotes: item.aiExpressionNotes ? [item.aiExpressionNotes] : [],
          raw: item.aiFeedbackRaw,
        }
      : null,
  );
  const [hasReceivedAiFeedback, setHasReceivedAiFeedback] = useState(Boolean(item?.aiCorrectedText));
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const canRequestAiFeedback = answerText.trim().length > 0 && !pending;
  const canSubmit = hasReceivedAiFeedback && revisedText.trim().length > 0 && aiResult !== null && !pending;
  const promptText = item?.promptText || item?.passageText || "";

  function requestFeedback() {
    if (!item || !canRequestAiFeedback) return;
    setError("");
    setIsAiModalOpen(true);
    startTransition(async () => {
      try {
        const result = await requestWritingFeedback({
          assignmentId: assignment.id,
          assignmentItemId: item.id,
          writingMode: item.writingMode,
          writingUnit: item.writingUnit,
          writingUnitCount: item.writingUnitCount ?? 4,
          promptText,
          writingInstructions: item.writingInstructions,
          writingHint: item.writingHint,
          writingExample: item.writingExample,
          imageUrl: assignment.imageUrl,
          answerText,
        });
        setAiResult(result);
        setHasReceivedAiFeedback(true);
        setRevisedText("");
        window.setTimeout(() => revisedTextRef.current?.focus(), 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI 첨삭에 실패했습니다. 다시 시도해주세요.");
      } finally {
        setIsAiModalOpen(false);
      }
    });
  }

  function confirmSubmit() {
    if (!item || !aiResult || !canSubmit) return;
    setError("");
    startTransition(async () => {
      try {
        await submitWritingAssignment({
          assignmentId: assignment.id,
          assignmentItemId: item.id,
          writingMode: item.writingMode,
          writingUnit: item.writingUnit,
          writingUnitCount: item.writingUnitCount ?? 4,
          promptText,
          writingInstructions: item.writingInstructions,
          writingHint: item.writingHint,
          writingExample: item.writingExample,
          imageUrl: assignment.imageUrl,
          originalAnswerText: answerText,
          answerText: revisedText,
          aiCorrectedText: aiResult.correctedText,
          aiFeedback: aiResult.feedback,
          aiGrammarNotes: aiResult.grammarNotes.join("\n"),
          aiExpressionNotes: aiResult.expressionNotes.join("\n"),
          aiFeedbackRaw: aiResult.raw,
        });
        setIsSubmitModalOpen(false);
        router.push(`/student/assignments/${assignment.id}/complete`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "라이팅 제출 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Card className="shadow-soft">
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{assignment.classId || "내 반"}</Badge>
          <Badge tone="green">Writing</Badge>
          {assignment.dueAt && <Badge tone="yellow">마감: {formatDue(assignment.dueAt)}</Badge>}
          {assignment.submittedAt && <Badge tone="green">제출: {formatDateTime(assignment.submittedAt)}</Badge>}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{assignment.title}</h1>
        {assignment.description && <p className="mt-2 leading-7 text-slate-600">{assignment.description}</p>}
      </Card>

      <Card>
        <p className="text-sm font-bold text-action">Writing</p>
        <h2 className="mt-2 text-lg font-bold">{item ? writingInstruction(item) : "Write in English."}</h2>
      </Card>

      <Card>
        <h2 className="font-bold">{item?.writingMode === "picture_description" ? "그림" : "주제"}</h2>
        {assignment.imageUrl && (
          <div className="mt-4 overflow-hidden rounded-lg border border-line bg-slate-50">
            <img src={assignment.imageUrl} alt="라이팅 과제 이미지" className="h-auto w-full" />
          </div>
        )}
        {promptText && (
          <div className="mt-4 rounded-lg bg-paper p-4">
            <p className="mb-2 text-sm font-bold text-slate-500">{item?.writingMode === "picture_description" ? "추가 주제 또는 관찰 포인트" : "주제"}</p>
            <p className="whitespace-pre-wrap text-lg font-semibold leading-8 text-slate-800">{promptText}</p>
          </div>
        )}
        {(item?.writingInstructions || item?.writingHint || item?.writingExample) && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {item.writingInstructions && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-bold text-action">추가 지시문</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.writingInstructions}</p>
              </div>
            )}
            {item.writingHint && (
              <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
                <p className="text-sm font-bold text-yellow-800">힌트</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.writingHint}</p>
              </div>
            )}
            {item.writingExample && (
              <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                <p className="text-sm font-bold text-green-800">예시</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.writingExample}</p>
              </div>
            )}
          </div>
        )}
        {!assignment.imageUrl && !promptText && !item?.writingInstructions && !item?.writingHint && !item?.writingExample && <p className="mt-3 text-sm text-slate-500">표시할 이미지 또는 주제가 없습니다.</p>}
      </Card>

      <Card>
        <label className="grid gap-2 text-sm font-bold">
          내가 쓴 글
          <Textarea
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            placeholder="4 paragraphs or sentences."
            className="min-h-[220px] text-base leading-7"
          />
        </label>

        {aiResult && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-line p-4">
              <p className="font-bold">내가 쓴 글</p>
              <p className="mt-3 whitespace-pre-wrap leading-8 text-slate-700">{answerText}</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="font-bold text-action">AI 선생님 첨삭</p>
              <p className="mt-3 whitespace-pre-wrap leading-8 text-slate-800">{aiResult?.correctedText}</p>
            </div>
          </div>
        )}

        {aiResult && (
          <div className="mt-4 rounded-lg bg-paper p-4">
            <p className="font-bold">AI 선생님의 설명</p>
            <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{aiResult?.feedback}</p>
            {aiResult?.grammarNotes?.length ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600"><strong>문법 교정사항</strong><br />{aiResult.grammarNotes.join("\n")}</p> : null}
            {aiResult?.expressionNotes?.length ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600"><strong>알면 좋은 표현</strong><br />{aiResult.expressionNotes.join("\n")}</p> : null}
          </div>
        )}

        {aiResult && (
          <div className="mt-4 rounded-lg border border-line p-4">
            <label className="grid gap-2 text-sm font-bold">
              다시 쓰는 글
              <Textarea
                ref={revisedTextRef}
                value={revisedText}
                onChange={(event) => setRevisedText(event.target.value)}
                placeholder="AI 선생님 첨삭을 보고 다시 써보세요."
                className="min-h-[220px] text-base leading-7"
              />
            </label>
          </div>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="secondary" disabled={!canRequestAiFeedback} onClick={requestFeedback} className="min-h-12 text-base">
            {hasReceivedAiFeedback ? "AI 첨삭 다시 받기" : "AI 첨삭받기"}
          </Button>
          <ReadyStepButton disabled={!canSubmit} onClick={() => setIsSubmitModalOpen(true)} className="min-h-12 text-base" tooltip="수정본 작성이 끝났어요. 제출할 수 있어요.">
            제출하기
          </ReadyStepButton>
        </div>
      </Card>

      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-soft">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-action" />
            <h2 className="mt-4 text-xl font-extrabold">AI 선생님이 첨삭하는중이에요!</h2>
            <p className="mt-2 text-slate-600">잠시 기다려주세요…</p>
          </div>
        </div>
      )}

      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <h2 className="text-xl font-extrabold">제출하시겠습니까?</h2>
            <p className="mt-3 leading-7 text-slate-600">제출하면 선생님이 확인해보고 완료, 미완료를 알려줄거에요.</p>
            {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => setIsSubmitModalOpen(false)} disabled={pending}>아니요</Button>
              <Button type="button" onClick={confirmSubmit} disabled={pending}>{pending ? "제출 중..." : "네"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
