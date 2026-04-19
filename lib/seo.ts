function resolveSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!envUrl) {
    return "http://localhost:3000";
  }

  const normalizedUrl = envUrl.startsWith("http")
    ? envUrl
    : `https://${envUrl}`;
  return normalizedUrl.replace(/\/$/, "");
}

export const siteConfig = {
  name: "Janetimes English",
  title: "Janetimes English | 인천 영종도 초등 영어",
  description:
    "인천 영종도에서 초등 영어를 중심으로 문해력, 듣기, 쓰기, 말하기, 독해, 어휘, 문법까지 연결하는 2년 커리큘럼의 Janetimes English 랜딩 페이지입니다.",
  url: resolveSiteUrl(),
  ogImage: "/images/janetimes-hero.jpg",
  phone: "010-2760-1568",
  locale: "ko_KR",
  keywords: [
    "인천 영어학원",
    "인천 영어",
    "영종도 영어학원",
    "영종도 초등 영어",
    "초등 영어",
    "초등 영어 홈스쿨링",
    "영어 커리큘럼",
    "영어 학원",
    "janetimes english",
    "제인 타임즈",
    "제인 타임스",
    "제인타임즈",
    "제인타임스",
    "재인 타임즈",
    "재인 타임스",
    "재인타임즈",
    "재인타임스",
  ],
} as const;
