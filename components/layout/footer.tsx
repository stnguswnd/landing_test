import Image from "next/image";
import { Container } from "@/components/layout/container";
import { contact } from "@/content/landing";

export function Footer() {
  return (
    <footer className="footer">
      <Container>
        <div className="footer__inner">
          <div className="footer__brand">
            <Image
              src="/images/color-logo.png"
              alt="janetimes english"
              width={6432}
              height={3464}
              className="footer__logo-image"
            />
          </div>

          <div className="footer__content">
            <p className="footer__text">
              <strong>{contact.name}</strong> {contact.phone}
            </p>
            <p className="footer__text">{contact.bank}</p>
            <p className="footer__text">
              인천광역시 중구 하늘달빛로 139 (우편번호 22406)
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
