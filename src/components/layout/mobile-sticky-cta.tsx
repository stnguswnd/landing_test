import { contact } from "@/content/landing";

export function MobileStickyCta() {
  return (
    <div className="mobile-sticky-cta">
      <a href={`tel:${contact.phone}`} className="mobile-sticky-cta__button mobile-sticky-cta__button--primary">
        전화하기
      </a>
      <a href="#contact" className="mobile-sticky-cta__button mobile-sticky-cta__button--secondary">
        상담 문의
      </a>
      <a href="#curriculum" className="mobile-sticky-cta__button mobile-sticky-cta__button--ghost">
        커리큘럼
      </a>
    </div>
  );
}
