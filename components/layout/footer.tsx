import Image from "next/image";
import { Container } from "@/components/layout/container";

export function Footer() {
  return (
    <footer className="footer">
      <Container>
        <div className="footer__inner">
          <Image
            src="/images/color-logo.png"
            alt="janetimes english"
            width={6432}
            height={3464}
            className="footer__logo-image"
          />
        </div>
      </Container>
    </footer>
  );
}
