"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshOnHistoryRestore() {
  const router = useRouter();

  useEffect(() => {
    // App Router로 새로 진입하거나 Chrome 뒤로가기로 화면이 다시 마운트될 때
    // 서버 컴포넌트 데이터를 항상 최신 상태로 다시 가져온다.
    router.refresh();

    function onPageShow(event: PageTransitionEvent) {
      // Chrome/Safari가 문서 전체를 BFCache에서 복원하면 effect가 다시 실행되지
      // 않을 수 있으므로 이 경우에도 최신 데이터를 요청한다.
      if (event.persisted) router.refresh();
    }

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  return null;
}
