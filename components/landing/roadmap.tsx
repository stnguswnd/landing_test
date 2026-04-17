import Image from "next/image";
import { Section } from "@/components/layout/section";
import { roadmap } from "@/content/landing";

export function Roadmap() {
  return (
    <Section id="roadmap">
      <div className="section-heading">
        <span className="tag">{roadmap.tag}</span>
        <h2>{roadmap.title}</h2>
        <p>{roadmap.intro}</p>
      </div>

      <div className="roadmap-showcase">
        <div className="timeline">
          {roadmap.steps.map((step, index) => (
            <article key={step.title} className="timeline__item">
              <div className="timeline__marker">
                <span>{index + 1}</span>
              </div>
              <div className="timeline__content">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="roadmap-image-card">
          <Image
            src="/images/03.png"
            alt="로드맵 다이어그램 이미지"
            width={588}
            height={888}
            className="roadmap-image-card__image"
          />
        </div>
      </div>
    </Section>
  );
}
