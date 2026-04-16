import Image from "next/image";
import { Section } from "@/components/layout/section";
import { teacherProfile } from "@/content/landing";

export function TeacherProfile() {
  return (
    <Section id="teacher">
      <div className="section-heading">
        <span className="tag">{teacherProfile.tag}</span>
        <h2>{teacherProfile.title}</h2>
        <p>{teacherProfile.intro}</p>
      </div>

      <div className="teacher-showcase">
        <div className="teacher-metrics">
          {teacherProfile.metrics.map((item) => (
            <article key={item.label} className="teacher-metrics__item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <div className="teacher-image-card">
          <Image
            src="/images/이력.png"
            alt="선생님 이력 소개 이미지"
            width={588}
            height={888}
            className="teacher-image-card__image"
          />
        </div>

        <div className="teacher-highlights">
          {teacherProfile.highlights.map((item) => (
            <div key={item} className="teacher-highlights__item">
              {item}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
