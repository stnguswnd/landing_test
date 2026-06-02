"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

export function SubmissionDeleteButton({
  studentId,
  submissionId,
  assignmentTitle,
}: {
  studentId: string;
  submissionId?: string;
  assignmentTitle: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function deleteSubmission() {
    if (!submissionId) return;
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/teacher/students/${studentId}/history`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "제출 내역을 삭제하지 못했습니다.");
        return;
      }
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="danger" disabled={!submissionId} onClick={() => setIsOpen(true)}>
        삭제하기
      </Button>
      {isOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <h2 className="text-xl font-extrabold">제출 내역을 삭제할까요?</h2>
            <p className="mt-3 leading-7 text-slate-600">
              {assignmentTitle} 제출 내역만 삭제됩니다. 배정 이력은 남고 학생에게는 다시 미제출 과제로 보입니다.
            </p>
            {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" disabled={pending} onClick={() => setIsOpen(false)}>취소</Button>
              <Button type="button" variant="danger" disabled={pending} onClick={deleteSubmission}>
                {pending ? "삭제 중..." : "삭제하기"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
