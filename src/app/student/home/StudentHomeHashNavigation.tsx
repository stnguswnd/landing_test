"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STUDENT_HOME_PATH = "/student/home";
const TODAY_HASH = "#today";
const KNOWN_SECTION_HASHES = new Set([TODAY_HASH, "#weekly-homework"]);
const HOME_BOUNDARY_STATE_KEY = "__studentHomeBoundary";
const HOMEWORK_LIST_BOUNDARY_STATE_KEY = "__studentHomeworkListBoundary";

function getCookie(name: string) {
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function historyState() {
  return window.history.state && typeof window.history.state === "object" ? window.history.state : {};
}

function isStudentAuthenticated() {
  return getCookie("homework_role") === "student";
}

function scrollToCurrentHash() {
  const hash = window.location.hash || TODAY_HASH;
  if (!KNOWN_SECTION_HASHES.has(hash)) return;

  const section = document.getElementById(hash.slice(1));
  section?.scrollIntoView({ block: "start" });
}

function pushHomeBoundary() {
  const state = historyState();
  if (state[HOME_BOUNDARY_STATE_KEY] === true) return;
  window.history.pushState({ ...state, [HOME_BOUNDARY_STATE_KEY]: true }, "", `${STUDENT_HOME_PATH}${TODAY_HASH}`);
}

function ensureWeeklyHomeworkHasTodayFallback() {
  if (!isStudentAuthenticated()) return;
  if (window.location.pathname !== STUDENT_HOME_PATH || window.location.hash !== "#weekly-homework") return;

  const state = historyState();
  if (state[HOMEWORK_LIST_BOUNDARY_STATE_KEY] === true) return;

  window.history.replaceState({ ...state, [HOME_BOUNDARY_STATE_KEY]: true }, "", `${STUDENT_HOME_PATH}${TODAY_HASH}`);
  window.history.pushState({ [HOMEWORK_LIST_BOUNDARY_STATE_KEY]: true }, "", `${STUDENT_HOME_PATH}#weekly-homework`);
}

export function StudentHomeHashNavigation() {
  const router = useRouter();

  useEffect(() => {
    if (window.location.pathname === STUDENT_HOME_PATH && !window.location.hash) {
      window.history.replaceState(window.history.state, "", `${STUDENT_HOME_PATH}${TODAY_HASH}`);
    }
    ensureWeeklyHomeworkHasTodayFallback();

    const scrollAfterRender = () => window.requestAnimationFrame(scrollToCurrentHash);
    const keepStudentHomeBoundary = () => {
      if (!isStudentAuthenticated()) return;
      if (window.location.pathname !== STUDENT_HOME_PATH || window.location.hash !== TODAY_HASH) return;

      pushHomeBoundary();
    };
    const syncHashState = () => {
      ensureWeeklyHomeworkHasTodayFallback();
      scrollAfterRender();
      keepStudentHomeBoundary();
    };
    const syncPopState = () => {
      if (isStudentAuthenticated() && !window.location.pathname.startsWith("/student")) {
        pushHomeBoundary();
        router.replace(`${STUDENT_HOME_PATH}${TODAY_HASH}`, { scroll: false });
        return;
      }

      scrollAfterRender();
      keepStudentHomeBoundary();
    };

    scrollAfterRender();
    keepStudentHomeBoundary();

    window.addEventListener("hashchange", syncHashState);
    window.addEventListener("popstate", syncPopState);
    return () => {
      window.removeEventListener("hashchange", syncHashState);
      window.removeEventListener("popstate", syncPopState);
    };
  }, [router]);

  return null;
}
