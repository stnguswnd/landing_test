"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Section } from "@/components/layout/section";
import { teacherProfile } from "@/content/landing";

const leftColumnImages = [
  {
    src: "/images/01.jpg",
    alt: "Teacher profile gallery image 01",
    className:
      "teacher-profile__gallery-card teacher-profile__gallery-card--left-image",
  },
];

const rightColumnImages = [
  {
    src: "/images/02.jpg",
    alt: "Teacher profile gallery image 02",
    className:
      "teacher-profile__gallery-card teacher-profile__gallery-card--right-top",
  },
  {
    src: "/images/05.png",
    alt: "Teacher profile gallery image 05",
    className:
      "teacher-profile__gallery-card teacher-profile__gallery-card--right-bottom",
  },
];

export function TeacherProfile() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [columnOffset, setColumnOffset] = useState(0);

  useEffect(() => {
    const updateOffset = () => {
      const section = sectionRef.current;
      if (!section) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const totalDistance = rect.height + viewportHeight;
      const progress = (viewportHeight - rect.top) / totalDistance;
      const clampedProgress = Math.max(0, Math.min(progress, 1));
      const offset = (clampedProgress - 0.5) * 120;

      setColumnOffset(offset);
    };

    let frameId = 0;

    const onScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateOffset);
    };

    updateOffset();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const galleryStyle = {
    "--teacher-left-offset": `${-columnOffset}px`,
    "--teacher-right-offset": `${columnOffset}px`,
  } as CSSProperties;

  return (
    <Section id="teacher">
      <div className="teacher-profile" ref={sectionRef}>
        <div className="teacher-profile__header">
          <span className="tag">{teacherProfile.tag}</span>

          <h2 className="teacher-profile__title">
            탄탄하고 즐거운 수업을 하는<br></br>곽재인 선생님
          </h2>
        </div>

        <div className="teacher-profile__body">
          <div
            className="teacher-profile__gallery"
            aria-label="Teacher profile gallery"
            style={galleryStyle}
          >
            <div className="teacher-profile__column teacher-profile__column--left">
              <div className="teacher-profile__resume">
                <div className="teacher-profile__resume-heading">
                  <strong>Enjoy & Beyond!</strong>
                </div>

                <div className="teacher-profile__resume-list">
                  {teacherProfile.highlights.map((item) => (
                    <div key={item} className="teacher-profile__resume-item">
                      <span className="teacher-profile__resume-bullet" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {leftColumnImages.map((image) => (
                <div key={image.src} className={image.className}>
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={1200}
                    height={1600}
                    className="teacher-profile__gallery-image"
                  />
                </div>
              ))}
            </div>

            <div className="teacher-profile__column teacher-profile__column--right">
              {rightColumnImages.map((image) => (
                <div key={image.src} className={image.className}>
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={1200}
                    height={1600}
                    className="teacher-profile__gallery-image"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
