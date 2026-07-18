"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export const TEACHER_REVIEW_UPDATED_KEY = "teacher-review-updated";

export function TeacherReviewRefreshGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function refreshIfReviewChanged() {
      if (sessionStorage.getItem(TEACHER_REVIEW_UPDATED_KEY) !== "1") return;
      sessionStorage.removeItem(TEACHER_REVIEW_UPDATED_KEY);
      router.refresh();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) refreshIfReviewChanged();
    }

    // App Router가 뒤로가기 대상 화면을 실제로 마운트한 뒤 갱신한다.
    // popstate 단계에서 실행하면 Chrome이 이전 RSC 화면을 복원하기 전에
    // 플래그가 소비될 수 있어 마운트 시점 확인이 더 안정적이다.
    refreshIfReviewChanged();
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname, router]);

  return null;
}
