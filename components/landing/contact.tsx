import { Section } from "@/components/layout/section";
import { contact } from "@/content/landing";

export function Contact() {
  return (
    <Section id="contact" narrow>
      <div className="cta-panel">
        <span className="tag">{contact.label}</span>
        <h2>{contact.title}</h2>
        <p>{contact.description}</p>

        <div className="cta-panel__actions">
          <a href={`tel:${contact.phone}`} className="button button--primary">
            전화 상담 {contact.phone}
          </a>
          <a href={`tel:${contact.phone}`} className="button button--secondary">
            {contact.kakaoLabel}
          </a>
        </div>

        <div className="cta-panel__meta">
          <strong>
            {contact.name} {contact.phone}
          </strong>
          <span>{contact.bank}</span>
        </div>
      </div>
    </Section>
  );
}
