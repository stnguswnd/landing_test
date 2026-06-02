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

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state : {};

    window.history.replaceState({ ...currentState, [GUARD_STATE_KEY]: "anchor" }, "", currentUrl);
    window.history.pushState({ [GUARD_STATE_KEY]: "trap" }, "", currentUrl);

    function handlePopState() {
      window.history.replaceState({ [GUARD_STATE_KEY]: "redirect" }, "", fallbackHref);
      window.location.replace(fallbackHref);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [fallbackHref, pathname]);

  return null;
}
