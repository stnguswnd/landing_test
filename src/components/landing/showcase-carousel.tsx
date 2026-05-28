"use client";

import { useEffect, useRef } from "react";

import { Section } from "@/components/layout/section";

export function ShowcaseCarousel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
  }, []);

  return (
    <Section id="showcase" className="showcase-section">
      <div className="showcase-carousel">
        <div className="showcase-carousel__viewport">
          <video
            ref={videoRef}
            className="showcase-carousel__media"
            src="/images/video.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            controls={false}
          />
        </div>
      </div>
    </Section>
  );
}
