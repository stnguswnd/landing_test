export const siteConfig = {
  name: "jainetimes english",
  title: "jainetimes english | 초등 영어 홈스쿨링 랜딩 페이지",
  description:
    "문해력, 듣기, 쓰기, 말하기, 독해, 어휘, 문법까지 2년 커리큘럼으로 연결하는 jainetimes english 랜딩 페이지입니다.",
  url: "https://example.com",
  ogImage: "/images/jainetimes-hero.jpg",
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
