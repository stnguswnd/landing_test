"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const TEACHER_REVIEW_UPDATED_KEY = "teacher-review-updated";

export function TeacherReviewRefreshGuard() {
  const router = useRouter();

  useEffect(() => {
    function refreshIfReviewChanged() {
      if (sessionStorage.getItem(TEACHER_REVIEW_UPDATED_KEY) !== "1") return;
      sessionStorage.removeItem(TEACHER_REVIEW_UPDATED_KEY);
      window.setTimeout(() => router.refresh(), 0);
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) refreshIfReviewChanged();
    }

    window.addEventListener("popstate", refreshIfReviewChanged);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("popstate", refreshIfReviewChanged);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
