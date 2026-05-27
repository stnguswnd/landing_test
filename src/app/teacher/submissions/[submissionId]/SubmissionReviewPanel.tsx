"use client";

import { useState, useTransition } from "react";

import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { assignmentSubjectLabel, assignmentTypeLabel, normalizeAssignmentType, writingModeLabel, writingUnitLabel } from "@/lib/assignmentTypes";
import { formatDateTime } from "@/lib/format";
import type { TeacherSubmissionDetail } from "@/server/teacher/submissionDetail";

type SubmissionDetail = TeacherSubmissionDetail;
type ReviewStatus = "reviewed" | "returned";

function statusLabel(status: string) {
  if (status === "reviewed" || status === "completed") return "완료";
  if (status === "returned") return "반려";
  if (status === "submitted" || status === "late") return "검토 대기";
  return status;
}

function statusTone(status: string) {
  if (status === "reviewed" || status === "completed") return "green";
  if (status === "returned") return "red";
  return "blue";
}

function reviewActionLabel(status: ReviewStatus) {
  return status === "reviewed" ? "승인" : "반려";
}

export function SubmissionReviewPanel({ detail }: { detail: SubmissionDetail }) {
  const [comment, setComment] = useState(detail.teacherComment ?? "");
  const [status, setStatus] = useState(detail.status);
  const [reviewedAt, setReviewedAt] = useState(detail.reviewedAt);
  const [message, setMessage] = useState("");
  const [confirmStatus, setConfirmStatus] = useState<ReviewStatus | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ReviewStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const assignmentType = normalizeAssignmentType(detail.assignment?.assignmentType);

  function review(nextStatus: ReviewStatus) {
    if (isPending) return;
    setPendingStatus(nextStatus);
    setConfirmStatus(null);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/teacher/submissions/${detail.submissionId}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus, teacherComment: comment }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setMessage(data?.error ?? "검토 저장 중 오류가 발생했습니다.");
          return;
        }
        setStatus(nextStatus);
        setReviewedAt(data?.reviewedAt ?? new Date().toISOString());
        setMessage(nextStatus === "reviewed" ? "승인 피드백을 저장했습니다." : "반려 피드백을 저장했습니다.");
      } catch {
        setMessage("검토 저장 중 오류가 발생했습니다.");
      } finally {
        setPendingStatus(null);
      }
    });
  }

  return (
    <div className="grid gap-4">
      {message && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">{message}</p>}
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold">{detail.student.name} / {detail.assignment.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
              {detail.isLate && <Badge tone="yellow">지각 제출</Badge>}
              <Badge tone="blue">{assignmentSubjectLabel(assignmentType)}</Badge>
              <Badge tone="green">{assignmentTypeLabel(assignmentType)}</Badge>
              {detail.student.classNames?.length ? <Badge>{detail.student.classNames.join(", ")}</Badge> : null}
              <Badge>제출 {formatDateTime(detail.submittedAt)}</Badge>
              <Badge>마감 {formatDateTime(detail.dueAt)}</Badge>
              {reviewedAt && <Badge>검토 {formatDateTime(reviewedAt)}</Badge>}
            </div>
          </div>
          <Button href="/teacher/assignments" variant="secondary">숙제 관리로</Button>
        </div>
      </Card>

      {assignmentType === "listening_recording" && <RecordingReview items={detail.items} />}
      {assignmentType === "listening" && <ListeningReview submittedAt={detail.submittedAt} />}
      {assignmentType === "writing" && <WritingReview items={detail.items} />}
      {assignmentType === "vocabulary_example" && <VocabularyExampleReview vocabularyItems={detail.vocabularyItems ?? []} />}
      {assignmentType === "vocabulary_recording" && <VocabularyRecordingReview items={detail.items} vocabularyItems={detail.vocabularyItems ?? []} />}

      <Card>
        <h3 className="text-lg font-bold">선생님 최종 피드백</h3>
        <label className="mt-4 grid gap-2 text-sm font-semibold">
          코멘트
          <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="학생에게 전달할 피드백을 입력하세요." />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant={status === "returned" ? "danger" : "secondary"}
            onClick={() => setConfirmStatus("returned")}
            disabled={isPending}
          >
            {pendingStatus === "returned" ? "반려 저장 중..." : status === "returned" ? "반려됨" : "반려"}
          </Button>
          <Button
            onClick={() => setConfirmStatus("reviewed")}
            disabled={isPending}
            variant={status === "reviewed" ? "secondary" : "primary"}
          >
            {pendingStatus === "reviewed" ? "승인 저장 중..." : status === "reviewed" ? "승인됨" : "승인"}
          </Button>
        </div>
      </Card>

      {confirmStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-soft">
            <h3 className="text-lg font-bold">{reviewActionLabel(confirmStatus)}하시겠습니까?</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              이 제출물을 {reviewActionLabel(confirmStatus)} 처리합니다. 이후에도 승인과 반려 상태는 다시 변경할 수 있습니다.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmStatus(null)} disabled={isPending}>취소</Button>
              <Button type="button" variant={confirmStatus === "returned" ? "danger" : "primary"} onClick={() => review(confirmStatus)} disabled={isPending}>
                {pendingStatus === confirmStatus ? "저장 중..." : reviewActionLabel(confirmStatus)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VocabularyExampleReview({ vocabularyItems }: { vocabularyItems: NonNullable<SubmissionDetail["vocabularyItems"]> }) {
  return (
    <Card>
      <h3 className="text-lg font-bold">단어장 예문 제출</h3>
      <div className="mt-4 grid gap-3">
        {vocabularyItems.map((item, index) => (
          <article key={item.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{index + 1}</Badge>
              <p className="text-lg font-extrabold">{item.word}</p>
              <p className="text-slate-500">{item.meaning}</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <TextBlock title="처음 쓴 문장" value={item.originalAnswerText} />
              <TextBlock title="AI 첨삭문" value={item.aiCorrectedText} tone="blue" />
              <TextBlock title="다시 쓴 글" value={item.revisedAnswerText} tone="green" />
            </div>
            <div className="mt-3 rounded-md bg-paper p-3">
              <p className="font-bold">AI 피드백</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.aiFeedback ?? "-"}</p>
              {item.aiGrammarNotes && <p className="mt-2 whitespace-pre-wrap text-sm leading-6"><strong>문법 교정사항</strong><br />{item.aiGrammarNotes}</p>}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

function VocabularyRecordingReview({ items, vocabularyItems }: { items: SubmissionDetail["items"]; vocabularyItems: NonNullable<SubmissionDetail["vocabularyItems"]> }) {
  return (
    <div className="grid gap-4">
      <Card>
        <h3 className="text-lg font-bold">단어장</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {vocabularyItems.map((item) => (
            <div key={item.id} className="grid grid-cols-2 rounded-md border border-line">
              <span className="border-r border-line px-3 py-2 font-bold">{item.word}</span>
              <span className="px-3 py-2">{item.meaning}</span>
            </div>
          ))}
        </div>
      </Card>
      <RecordingReview items={items} />
    </div>
  );
}

function TextBlock({ title, value, tone }: { title: string; value?: string; tone?: "blue" | "green" }) {
  const classes = tone === "blue"
    ? "rounded-md border border-blue-100 bg-blue-50 p-4"
    : tone === "green"
      ? "rounded-md border border-green-100 bg-green-50 p-4"
      : "rounded-md border border-line p-4";
  return (
    <div className={classes}>
      <p className="font-bold">{title}</p>
      <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{value ?? "-"}</p>
    </div>
  );
}

function RecordingReview({ items }: { items: SubmissionDetail["items"] }) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <Card key={item.assignmentItemId}>
          <h3 className="text-lg font-bold">{item.title ?? "녹음 제출 항목"}</h3>
          {item.passageText && <p className="mt-4 rounded-md bg-paper p-4 text-lg leading-8">{item.passageText}</p>}
          {item.audioUrl && <div className="mt-4"><p className="mb-2 text-sm font-semibold">원본 음원</p><AudioPlayer src={item.audioUrl} /></div>}
          {item.recordingUrl ? (
            <div className="mt-4"><p className="mb-2 text-sm font-semibold">학생 녹음 파일</p><AudioPlayer src={item.recordingUrl} /></div>
          ) : (
            <p className="mt-4 rounded-md bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">녹음 파일을 아직 불러오지 못했습니다.</p>
          )}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">파일명</dt><dd className="font-semibold">{item.recordingFileName ?? "-"}</dd></div>
            <div><dt className="text-slate-500">길이</dt><dd className="font-semibold">{item.recordingDurationSec ?? "-"}초</dd></div>
          </dl>
        </Card>
      ))}
    </div>
  );
}

function ListeningReview({ submittedAt }: { submittedAt?: string }) {
  return (
    <Card>
      <h3 className="text-lg font-bold">리스닝 완료 확인</h3>
      <p className="mt-3 rounded-md bg-green-50 p-4 text-sm font-semibold text-green-800">
        학생이 음원을 끝까지 듣고 완료 처리했습니다.
      </p>
      <p className="mt-3 text-sm text-slate-600">완료 일시: {formatDateTime(submittedAt)}</p>
    </Card>
  );
}

function WritingReview({ items }: { items: SubmissionDetail["items"] }) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <Card key={item.assignmentItemId}>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">{writingModeLabel(item.writingMode)}</Badge>
            <Badge tone="green">{writingUnitLabel(item.writingUnit)}</Badge>
          </div>
          {(item.promptText || item.passageText) && (
            <div className="mt-4 rounded-md bg-paper p-4">
              <p className="font-bold">주제 / 지시문</p>
              <p className="mt-2 whitespace-pre-wrap leading-7">{item.promptText || item.passageText}</p>
            </div>
          )}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-line p-4">
              <p className="font-bold">첫 번째 글</p>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{item.originalAnswerText ?? item.answerText ?? "-"}</p>
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
              <p className="font-bold text-action">AI 첨삭문</p>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{item.aiCorrectedText ?? "-"}</p>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-green-100 bg-green-50 p-4">
            <p className="font-bold text-green-800">다시 쓴 글</p>
            <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{item.answerText ?? "-"}</p>
          </div>
          <div className="mt-4 rounded-md bg-paper p-4">
            <p className="font-bold">AI 피드백</p>
            <p className="mt-2 whitespace-pre-wrap leading-7">{item.aiFeedback ?? "-"}</p>
            {item.aiGrammarNotes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6"><strong>문법 교정사항</strong><br />{item.aiGrammarNotes}</p>}
            {item.aiExpressionNotes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6"><strong>알면 좋은 표현</strong><br />{item.aiExpressionNotes}</p>}
          </div>
        </Card>
      ))}
    </div>
  );
}
