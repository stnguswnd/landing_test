"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

export function HomeworkListBackLink() {
  const router = useRouter();

  return (
    <div className="mb-4">
      <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => router.replace("/student/home#weekly-homework", { scroll: false })}>
        ← 과제 목록으로
      </Button>
    </div>
  );
}
