"use client";

import { Section } from "@/components/layout/section";
import { curriculumIntro, programs } from "@/content/landing";

export function Curriculum() {
  return (
    <Section id="curriculum" className="curriculum-section">
      <div className="section-heading">
        <span className="tag">{curriculumIntro.tag}</span>
        <h2>{curriculumIntro.title}</h2>
      </div>

      <div className="highlight-strip">
        <strong>{curriculumIntro.highlight}</strong>
      </div>

      <div className="program-grid">
        {programs.map((program) => (
          <article key={program.name} className="program-card">
            <div className="program-card__summary">
              <span className="program-chip">{program.target}</span>
              <div className="program-card__summary-main">
                <h3>{program.name}</h3>
                <p>{program.details}</p>
              </div>
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
          </article>
        ))}
      </div>
    </Section>
  );
}
