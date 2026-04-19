import type { Metadata } from "next";
import { Contact } from "@/components/landing/contact";
import { Curriculum } from "@/components/landing/curriculum";
import { Hero } from "@/components/landing/hero";
import { Points } from "@/components/landing/points";
import { Roadmap } from "@/components/landing/roadmap";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";
import { TeacherProfile } from "@/components/landing/teacher-profile";
import { Footer } from "@/components/layout/footer";
import { MobileStickyCta } from "@/components/layout/mobile-sticky-cta";
import { SectionNav } from "@/components/layout/section-nav";
import { siteConfig } from "@/lib/seo";
import { contact } from "@/content/landing";

export const metadata: Metadata = {
  title: "인천 영어학원 · 영종도 초등 영어 · 제인타임즈",
  description:
    "인천 영종도에서 초등 영어를 중심으로 문해력, 듣기, 쓰기, 말하기, 독해, 어휘, 문법까지 체계적으로 연결하는 Janetimes English 영어 프로그램을 소개합니다.",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "인천 영어학원",
    "인천 영어",
    "영종도 영어학원",
    "영종도 초등 영어",
    "제인타임즈",
    "제인타임스",
    "재인타임즈",
    "재인타임스",
    "Janetimes English",
    "초등 영어",
    "영어 커리큘럼",
  ],
  openGraph: {
    title: "인천 영어학원 · 영종도 초등 영어 · 제인타임즈",
    description:
      "인천 영종도에서 초등 영어를 중심으로 문해력, 듣기, 쓰기, 말하기, 독해, 어휘, 문법까지 체계적으로 연결하는 Janetimes English 영어 프로그램을 소개합니다.",
    url: "/",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        alt: "Janetimes English 대표 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "인천 영어학원 · 영종도 초등 영어 · 제인타임즈",
    description:
      "인천 영종도에서 초등 영어를 중심으로 문해력, 듣기, 쓰기, 말하기, 독해, 어휘, 문법까지 체계적으로 연결하는 Janetimes English 영어 프로그램을 소개합니다.",
    images: [siteConfig.ogImage],
  },
};

export default function HomePage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: siteConfig.name,
    alternateName: ["Janetimes English", "제인타임즈", "재인타임즈"],
    description: siteConfig.description,
    telephone: contact.phone,
    url: siteConfig.url,
    image: `${siteConfig.url}${siteConfig.ogImage}`,
    areaServed: ["인천", "영종도"],
  };

  return (
    <>
      <main className="page-shell">
        <SectionNav />
        <Hero />
        <TeacherProfile />
        <Curriculum />
        <Roadmap />
        <Points />
        <ShowcaseCarousel />
        <Contact />
        <MobileStickyCta />
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
