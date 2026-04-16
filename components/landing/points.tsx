import Image from "next/image";
import { Section } from "@/components/layout/section";
import { points } from "@/content/landing";

export function Points() {
  return (
    <Section id="system">
      <div className="section-heading">
        <span className="tag">후기 · 포인트</span>
        <h2>학생의 변화가 실제로 보이는 후기와 수업 분위기를 함께 보여드립니다.</h2>
      </div>

      <div className="story-grid">
        {points.map((point) => {
          const imageSrc =
            point.layout === "gallery" ? "/images/point2-v2.png" : point.imageSrc;

          return (
            <article
              key={point.tag}
              className={`story-card ${point.layout === "letter" ? "story-card--letter" : "story-card--gallery"}`}
            >
              <div className="story-card__copy">
                <span className="tag">{point.tag}</span>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
                <blockquote
                  className={point.tag === "POINT 2" ? "story-card__quote story-card__quote--emphasis" : "story-card__quote"}
                >
                  {point.quote}
                </blockquote>
                <strong className="story-card__result">{point.result}</strong>
              </div>

              <div className="story-card__media">
                <Image
                  src={imageSrc}
                  alt={point.imageAlt}
                  width={point.layout === "letter" ? 343 : 869}
                  height={point.layout === "letter" ? 565 : 2450}
                  className={`story-card__image ${point.layout === "letter" ? "is-letter" : "is-gallery"}`}
                />
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
