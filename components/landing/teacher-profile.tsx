import Image from "next/image";
import { Section } from "@/components/layout/section";
import { teacherProfile } from "@/content/landing";

export function TeacherProfile() {
  return (
    <Section id="teacher">
      <div className="teacher-profile">
        <div className="teacher-profile__header">
          <span className="tag">{teacherProfile.tag}</span>

          <h2 className="teacher-profile__title">Jane Kwok</h2>
          <div className="teacher-profile__summary">
            {teacherProfile.metrics.map((item) => (
              <article key={item.label} className="teacher-profile__metric">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="teacher-profile__body">
          <div className="teacher-profile__media">
            <div className="teacher-profile__image-card">
              <Image
                src="/images/profile-img.jpg"
                alt="곽재인 선생님 프로필 사진"
                width={1200}
                height={1600}
                className="teacher-profile__image"
              />
            </div>
          </div>

          <div className="teacher-profile__content">
            <p className="teacher-profile__intro">{teacherProfile.intro}</p>

            <div className="teacher-profile__resume">
              <div className="teacher-profile__resume-heading">
                <strong>학력 · 경력 · 수상이력</strong>
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
          </div>
        </div>
      </div>
    </Section>
  );
}
