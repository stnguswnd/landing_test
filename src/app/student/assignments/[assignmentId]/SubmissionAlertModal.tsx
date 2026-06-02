"use client";

import { Button } from "@/components/ui/Button";

export function SubmissionAlertModal({
  title = "확인해주세요",
  message,
  onClose,
}: {
  title?: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={onClose}>확인</Button>
        </div>
      </div>
    </div>
  );
}
