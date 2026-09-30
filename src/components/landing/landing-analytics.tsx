"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { useReportWebVitals } from "next/web-vitals";

import {
  GA_MEASUREMENT_ID,
  GTM_CONTAINER_ID,
  trackAnalyticsEvent,
} from "@/lib/analytics";

const scrollDepthThresholds = [25, 50, 75, 90, 100];
const dwellTimeThresholds = [10, 30, 60, 120, 300, 600];

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 100) || undefined;
}

function safeDestination(link: HTMLAnchorElement) {
  const href = link.getAttribute("href");
  if (!href) return undefined;
  if (href.startsWith("tel:")) return "tel";
  if (href.startsWith("mailto:")) return "mailto";

  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.hash}`
      : `${url.origin}${url.pathname}`;
  } catch {
    return href.slice(0, 100);
  }
}

function eventNameForElement(element: HTMLElement) {
  if (element instanceof HTMLAnchorElement) {
    const href = element.getAttribute("href") || "";
    if (href.startsWith("tel:")) return "phone_contact_click";
    if (href === "/login") return "login_click";
    if (href.startsWith("#")) return "section_navigation";
    return "link_click";
  }

  return "button_click";
}

export function LandingAnalytics() {
  const reportedVitals = useRef(new Set<string>());

  useReportWebVitals((metric) => {
    const reportKey = `${metric.name}:${metric.id}`;
    if (reportedVitals.current.has(reportKey)) return;
    reportedVitals.current.add(reportKey);

    trackAnalyticsEvent("web_vital", {
      metric_name: metric.name,
      metric_id: metric.id,
      metric_value: metric.name === "CLS"
        ? Math.round(metric.value * 1000) / 1000
        : Math.round(metric.value),
      metric_rating: metric.rating,
    });
  });

  useEffect(() => {
    const firedScrollDepths = new Set<number>();
    const firedDwellTimes = new Set<number>();
    const viewedSections = new Set<string>();
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main.landing-root section[id]"));
    let activeSectionId: string | null = null;
    let activeSectionStartedAt = performance.now();
    let activeSeconds = 0;
    let lastDwellTick = performance.now();
    let animationFrame = 0;

    const sendSectionEngagement = (reason: string) => {
      if (!activeSectionId) return;

      const seconds = Math.round((performance.now() - activeSectionStartedAt) / 1000);
      if (seconds > 0) {
        trackAnalyticsEvent("section_engagement", {
          section_id: activeSectionId,
          engagement_time_seconds: seconds,
          leave_reason: reason,
          transport_type: reason === "page_exit" ? "beacon" : undefined,
        });
      }

      activeSectionStartedAt = performance.now();
    };

    const syncActiveSection = () => {
      animationFrame = 0;
      const viewportTarget = window.innerHeight * 0.42;
      let nextSection: HTMLElement | undefined;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

        const distance = rect.top <= viewportTarget && rect.bottom >= viewportTarget
          ? 0
          : Math.min(Math.abs(rect.top - viewportTarget), Math.abs(rect.bottom - viewportTarget));

        if (distance < closestDistance) {
          closestDistance = distance;
          nextSection = section;
        }
      }

      if (!nextSection || nextSection.id === activeSectionId) return;
      sendSectionEngagement("section_change");
      activeSectionId = nextSection.id;
      activeSectionStartedAt = performance.now();

      if (!viewedSections.has(nextSection.id)) {
        viewedSections.add(nextSection.id);
        trackAnalyticsEvent("section_view", { section_id: nextSection.id });
      }
    };

    const requestSectionSync = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(syncActiveSection);
    };

    const syncScrollDepth = () => {
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      const scrollableHeight = Math.max(documentHeight - window.innerHeight, 1);
      const depth = Math.min(100, Math.round((window.scrollY / scrollableHeight) * 100));

      for (const threshold of scrollDepthThresholds) {
        if (depth >= threshold && !firedScrollDepths.has(threshold)) {
          firedScrollDepths.add(threshold);
          trackAnalyticsEvent("scroll_depth", { percent_scrolled: threshold });
        }
      }
    };

    const onScroll = () => {
      syncScrollDepth();
      requestSectionSync();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const element = target.closest<HTMLElement>("a, button, [role='button']");
      if (!element || element.dataset.analyticsTracked === "true") return;

      const link = element instanceof HTMLAnchorElement ? element : undefined;
      trackAnalyticsEvent(eventNameForElement(element), {
        element_text: cleanText(element.textContent),
        element_id: element.id || undefined,
        destination: link ? safeDestination(link) : undefined,
      });
    };

    const reviewObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;

        const element = entry.target as HTMLElement;
        trackAnalyticsEvent("review_image_view", {
          review_index: Number(element.dataset.reviewIndex),
          image_file: element.dataset.reviewImage,
        });
        observer.unobserve(element);
      }
    }, { threshold: 0.6 });

    document.querySelectorAll<HTMLElement>(".student-reviews__item").forEach((element) => {
      reviewObserver.observe(element);
    });

    const videoCleanups = Array.from(document.querySelectorAll<HTMLVideoElement>("main.landing-root video")).map((video) => {
      const firedProgress = new Set<number>();
      let hasStarted = false;

      const videoName = video.currentSrc.split("/").pop() || video.getAttribute("src") || "landing_video";
      const onPlay = () => {
        if (hasStarted) return;
        hasStarted = true;
        trackAnalyticsEvent("video_start", {
          video_name: videoName,
          autoplay: video.autoplay,
        });
      };
      const onPause = () => {
        if (!video.ended) {
          trackAnalyticsEvent("video_pause", {
            video_name: videoName,
            video_current_time: Math.round(video.currentTime),
          });
        }
      };
      const onEnded = () => {
        trackAnalyticsEvent("video_complete", { video_name: videoName });
      };
      const onTimeUpdate = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        const progress = (video.currentTime / video.duration) * 100;

        for (const threshold of [25, 50, 75, 90]) {
          if (progress >= threshold && !firedProgress.has(threshold)) {
            firedProgress.add(threshold);
            trackAnalyticsEvent("video_progress", {
              video_name: videoName,
              video_percent: threshold,
            });
          }
        }
      };
      const onVideoClick = () => {
        trackAnalyticsEvent("video_click", {
          video_name: videoName,
          video_current_time: Math.round(video.currentTime),
        });
      };

      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onEnded);
      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("click", onVideoClick);
      if (!video.paused) onPlay();

      return () => {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("click", onVideoClick);
      };
    });

    const dwellInterval = window.setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible") {
        activeSeconds += Math.max(0, (now - lastDwellTick) / 1000);
      }
      lastDwellTick = now;

      for (const threshold of dwellTimeThresholds) {
        if (activeSeconds >= threshold && !firedDwellTimes.has(threshold)) {
          firedDwellTimes.add(threshold);
          trackAnalyticsEvent("dwell_time", { active_time_seconds: threshold });
        }
      }
    }, 1000);

    const onVisibilityChange = () => {
      const now = performance.now();
      if (document.visibilityState === "hidden") {
        activeSeconds += Math.max(0, (now - lastDwellTick) / 1000);
        sendSectionEngagement("page_hidden");
      } else {
        activeSectionStartedAt = now;
      }
      lastDwellTick = now;
    };

    const onPageHide = () => {
      const now = performance.now();
      if (document.visibilityState === "visible") {
        activeSeconds += Math.max(0, (now - lastDwellTick) / 1000);
      }
      lastDwellTick = now;
      sendSectionEngagement("page_exit");
      trackAnalyticsEvent("page_exit", {
        active_time_seconds: Math.round(activeSeconds),
        max_scroll_depth: Math.max(0, ...firedScrollDepths),
        transport_type: "beacon",
      });
    };

    const onError = () => {
      trackAnalyticsEvent("client_error", { error_type: "script_error" });
    };
    const onUnhandledRejection = () => {
      trackAnalyticsEvent("client_error", { error_type: "unhandled_rejection" });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", requestSectionSync);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    document.addEventListener("visibilitychange", onVisibilityChange);
    syncScrollDepth();
    syncActiveSection();

    return () => {
      sendSectionEngagement("component_unmount");
      window.clearInterval(dwellInterval);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      reviewObserver.disconnect();
      videoCleanups.forEach((cleanup) => cleanup());
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", requestSectionSync);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <>
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');`}
      </Script>
      <Script
        id="google-analytics-library"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];
window.gtag=window.gtag||function(){dataLayer.push(arguments);};
gtag('js',new Date());
gtag('config','${GA_MEASUREMENT_ID}',{
  send_page_view:true,
  cookie_domain:'auto',
  cookie_update:true,
  allow_google_signals:true,
  allow_ad_personalization_signals:true
});`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
