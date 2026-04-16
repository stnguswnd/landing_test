function resolveSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!envUrl) {
    return "http://localhost:3000";
  }

  const normalizedUrl = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;

  return normalizedUrl.replace(/\/$/, "");
}

export const siteConfig = {
  name: "janetimes english",
  title: "janetimes english",
  description:
    "문해력, 듣기, 쓰기, 말하기, 독해, 어휘, 문법까지 2년 커리큘럼으로 연결하는 janetimes english 랜딩 페이지입니다.",
  url: resolveSiteUrl(),
  ogImage: "/images/janetimes-hero.jpg",
  phone: "01027601568",
};

export const sectionIds = [
  "hero",
  "teacher",
  "curriculum",
  "roadmap",
  "system",
  "contact",
] as const;

export type SectionId = (typeof sectionIds)[number];
