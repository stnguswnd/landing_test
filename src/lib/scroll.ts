const SCROLL_GAP = 12;

function getHeaderHeight() {
  if (typeof window === "undefined") {
    return 0;
  }

  const header = document.querySelector(".topbar");
  return header instanceof HTMLElement ? header.offsetHeight : 0;
}

export function getScrollTargetTop() {
  return getHeaderHeight() + SCROLL_GAP;
}

export function scrollToSectionById(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  const top = element.getBoundingClientRect().top + window.scrollY - getScrollTargetTop();

  window.scrollTo({
    top,
    behavior: "smooth",
  });
}
