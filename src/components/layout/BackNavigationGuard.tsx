"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type BackNavigationGuardProps = {
  fallbackHref: string;
};

const GUARD_STATE_KEY = "__janetimesBackGuard";

export function BackNavigationGuard({ fallbackHref }: BackNavigationGuardProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    function currentUrl() {
      return `${window.location.pathname}${window.location.search}${window.location.hash}`;
    }

    function historyState() {
      return window.history.state && typeof window.history.state === "object" ? window.history.state : {};
    }

    function armGuard() {
      const state = historyState();
      const url = currentUrl();
      window.history.replaceState({ ...state, [GUARD_STATE_KEY]: "anchor" }, "", url);
      window.history.pushState({ ...state, [GUARD_STATE_KEY]: "trap" }, "", url);
    }

    armGuard();

    function handlePopState() {
      window.history.pushState({ ...historyState(), [GUARD_STATE_KEY]: "trap" }, "", currentUrl());
      window.location.replace(fallbackHref);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [fallbackHref, pathname]);

  return null;
}
