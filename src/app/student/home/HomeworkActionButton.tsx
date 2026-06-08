"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

type HomeworkActionButtonProps = {
  href: string;
  children: string;
};

const HOMEWORK_SECTION_URL = "/student/home#weekly-homework";
const HOMEWORK_LIST_BOUNDARY_STATE_KEY = "__studentHomeworkListBoundary";

export function HomeworkActionButton({ href, children }: HomeworkActionButtonProps) {
  const router = useRouter();

  function openHomework() {
    if (typeof window !== "undefined") {
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (window.location.pathname === "/student/home" && currentUrl !== HOMEWORK_SECTION_URL) {
        window.history.pushState({ [HOMEWORK_LIST_BOUNDARY_STATE_KEY]: true }, "", HOMEWORK_SECTION_URL);
      }
    }
    router.push(href);
  }

  return (
    <Button type="button" onClick={openHomework} className="mt-4 min-h-10 w-full px-3 text-xs sm:min-h-12 sm:text-sm">
      {children}
    </Button>
  );
}
