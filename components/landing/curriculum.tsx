"use client";

import { useState } from "react";
import { Section } from "@/components/layout/section";
import { curriculumIntro, programs } from "@/content/landing";

export function Curriculum() {
  const [openProgram, setOpenProgram] = useState("");

  return (
    <Section id="curriculum" className="curriculum-section">
      <div className="section-heading">
        <span className="tag">{curriculumIntro.tag}</span>
        <h2>{curriculumIntro.title}</h2>
        <p>{curriculumIntro.description}</p>
      </div>

      <div className="highlight-strip">
        <strong>{curriculumIntro.highlight}</strong>
      </div>

      <div className="program-grid">
        {programs.map((program) => {
          const isOpen = openProgram === program.name;

          return (
            <article key={program.name} className={`program-card ${isOpen ? "is-open" : ""}`}>
              <div className="program-card__summary">
                <div className="program-card__summary-main">
                  <h3>{program.name}</h3>
                  <p>{program.summary}</p>
                </div>
                <span className="program-chip">{program.target}</span>
              </div>

              <div className="program-meta">
                <div>
                  <span>수업 빈도</span>
                  <strong>{program.frequency}</strong>
                </div>
                <div>
                  <span>가격</span>
                  <strong>{program.price}</strong>
                </div>
                <div>
                  <span>수업 시간</span>
                  <strong>{program.duration}</strong>
                </div>
              </div>

              <button
                type="button"
                className="program-card__toggle"
                aria-expanded={isOpen}
                onClick={() => setOpenProgram(isOpen ? "" : program.name)}
              >
                {isOpen ? "상세 닫기" : "상세 보기"}
              </button>

              <div className={`program-card__details ${isOpen ? "is-open" : ""}`}>
                <p>{program.details}</p>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
