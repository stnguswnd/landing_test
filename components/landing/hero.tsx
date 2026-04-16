"use client";

import Image from "next/image";
import { Section } from "@/components/layout/section";
import { hero } from "@/content/landing";
import { scrollToSectionById } from "@/lib/scroll";

export function Hero() {
  return (
    <Section id="hero" className="hero">
      <div className="hero-panel">
        <div className="hero-panel__copy">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 className="hero__title">
            {hero.title.map((line) => (
              <span key={line} className={line.includes("janetimes") ? "hero__title--accent" : ""}>
                {line}
              </span>
            ))}
          </h1>
          <p className="hero__description">{hero.description}</p>

          <div className="hero-strengths">
            {hero.strengths.map((item) => (
              <article key={item.title} className="hero-strengths__item">
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          <div className="button-row hero__actions">
            <a
              href={hero.primaryCta.href}
              className="button button--primary"
              onClick={(event) => {
                event.preventDefault();
                scrollToSectionById("contact");
              }}
            >
              {hero.primaryCta.label}
            </a>
            <a
              href={hero.secondaryCta.href}
              className="button button--secondary"
              onClick={(event) => {
                event.preventDefault();
                scrollToSectionById("curriculum");
              }}
            >
              {hero.secondaryCta.label}
            </a>
          </div>
        </div>

        <div className="hero-panel__visual">
          <div className="hero-visual-card">
            <div className="logo-mark">
              <span className="logo-mark__shape" />
              <div>
                <strong>janetimes</strong>
                <span>english</span>
              </div>
            </div>

            <div className="hero-visual-card__image">
              <Image
                src="/images/hero-v2.png"
                alt="janetimes english 소개 이미지"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="hero__image"
              />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
