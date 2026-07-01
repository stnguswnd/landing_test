"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshOnHistoryRestore() {
  const router = useRouter();

  useEffect(() => {
    function refreshSoon() {
      window.setTimeout(() => router.refresh(), 0);
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) refreshSoon();
    }

    window.addEventListener("popstate", refreshSoon);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("popstate", refreshSoon);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
