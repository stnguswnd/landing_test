"use client";

import Image from "next/image";
import { Section } from "@/components/layout/section";
import { hero } from "@/content/landing";
import { scrollToSectionById } from "@/lib/scroll";

export function Hero() {
  return (
    <Section id="hero" className="hero">
      <div className="hero-panel">
        <Image
          src="/images/01.jpg"
          alt="janetimes english hero"
          fill
          priority
          sizes="100vw"
          className="hero__image"
        />

        <div className="hero-panel__overlay" />

        <div className="hero-panel__content">
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
                className="button button--secondary hero__button-secondary"
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSectionById("curriculum");
                }}
              >
                {hero.secondaryCta.label}
              </a>
            </div>
          </div>

          <div className="hero-strengths">
            {hero.strengths.map((item) => (
              <article key={item.title} className="hero-strengths__item">
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
