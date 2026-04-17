"use client";

import { Section } from "@/components/layout/section";

export function ShowcaseCarousel() {
  return (
    <Section id="showcase" className="showcase-section">
      <div className="showcase-carousel">
        <div className="showcase-carousel__viewport">
          <video
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
