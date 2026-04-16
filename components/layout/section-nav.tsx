"use client";

import { useEffect, useState } from "react";
import { navigation } from "@/content/landing";
import { getScrollTargetTop, scrollToSectionById } from "@/lib/scroll";
import type { SectionId } from "@/lib/seo";

function getActiveSection(): SectionId | undefined {
  if (typeof window === "undefined") {
    return navigation[0]?.id;
  }

  const scrollPosition = window.scrollY + getScrollTargetTop();
  let nextActive = navigation[0]?.id;

  for (const item of navigation) {
    const element = document.getElementById(item.id);

    if (!element) {
      continue;
    }

    if (element.offsetTop <= scrollPosition) {
      nextActive = item.id;
    }
  }

  return nextActive;
}

export function SectionNav() {
  const [active, setActive] = useState<SectionId | undefined>(navigation[0]?.id);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const syncActiveSection = () => {
      const nextActive = getActiveSection();

      if (nextActive) {
        setActive(nextActive);
      }
    };

    syncActiveSection();
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", syncActiveSection);

    return () => {
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", syncActiveSection);
    };
  }, []);

  const onNavigate = (id?: SectionId) => {
    setMenuOpen(false);

    if (!id) {
      return;
    }

    setActive(id);
    scrollToSectionById(id);
  };

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <a
          href="#hero"
          className="topbar__brand"
          aria-label="jaintimes english home"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("hero");
          }}
        >
          <span className="topbar__brand-mark" />
          <span className="topbar__brand-text">
            <strong>jaintimes</strong>
            <span>english</span>
          </span>
        </a>

        <nav className="topbar__nav topbar__nav--desktop" aria-label="Primary sections">
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`topbar__link ${active === item.id ? "is-active" : ""}`}
              aria-current={active === item.id ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.id);
              }}
            >
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="topbar__mobile-actions">
          <a
            href="#contact"
            className="topbar__consult"
            onClick={(event) => {
              event.preventDefault();
              onNavigate("contact");
            }}
          >
            상담 문의
          </a>
          <button
            type="button"
            className={`topbar__menu-button ${menuOpen ? "is-open" : ""}`}
            aria-label="메뉴 열기"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className={`mobile-menu ${menuOpen ? "is-open" : ""}`}>
        <nav className="mobile-menu__panel" aria-label="Mobile sections">
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`mobile-menu__link ${active === item.id ? "is-active" : ""}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.id);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
