import type { SectionId } from "@/lib/seo";

export const navigation: Array<{ id: SectionId; label: string }> = [
  { id: "hero", label: "소개" },
  { id: "teacher", label: "선생님 이력" },
  { id: "curriculum", label: "커리큘럼" },
  { id: "roadmap", label: "로드맵" },
  { id: "system", label: "수업 포인트" },
  { id: "contact", label: "상담 문의" },
];

export const hero = {
  eyebrow: "초등 영어 홈스쿨링",
  title: ["영어를 오래 잘하는 힘,", "초등부터 완성합니다."],
  description: "초등 2년안에 중고등학생의 영어수준까지!",
  strengths: [
    {
      title: "2년 커리큘럼",
      description:
        "파닉스 5단계, 읽기, 쓰기, 말하기, 독해, 어휘, 문법까지 2년안에!",
    },
    {
      title: "직접 관리형 수업",
      description: "수업 이해부터 숙제 마무리까지 관리 중심으로 운영",
    },
    {
      title: "학력 + 경력",
      description: "해외 학력과 오랜 티칭 경험을 바탕으로 안정적인 수업 제공",
    },
  ],
  primaryCta: { label: "상담 문의하기", href: "#contact" },
  secondaryCta: { label: "커리큘럼 보기", href: "#curriculum" },
};

export const teacherProfile = {
  tag: "선생님 이력",
  title: "검증된 학력과 탄탄한 티칭 경험으로 지도합니다.",
  intro:
    "저는 미국 시민권자로서 서울·경기 지역에서 20년간 초등학생 영어 교육을 해왔습니다. 알파벳과 파닉스부터 시작해 문법 완성까지, 아이들의 영어 기초를 탄탄하게 세우고 실력을 확실히 끌어올리는 데 집중해왔습니다. 그 결과 많은 학생들이 외고 및 해외대학 진학으로 이어졌으며, 중학교 진학 시점에는 높은 수준의 영어 실력을 갖추고 타 학원 레벨테스트에서도 최고 레벨을 받는 경우가 많았습니다.",
  metrics: [
    { label: "해외 학력", value: "USC" },
    { label: "교원 자격", value: "MTAC" },
    { label: "수상 경력", value: "YBM Award" },
    { label: "지도 경험", value: "20년+" },
  ],
  highlights: [
    "Univ. of Southern California (USC)",
    "미국 교원 자격 보유",
    "YBM 어학원 강사 출신",
    "MTAC 교원 자격증",
    "YBM Award Winner",
  ],
};

export const curriculumIntro = {
  tag: "커리큘럼",
  title: "2년 과정으로 중·고등학교 수준까지 LEVEL UP!",

  highlight:
    "영어 읽기, 쓰기, 말하기, 독해, 어휘, 문법을 단계별로 연결하는 2년형 집중 커리큘럼",
};

export const programs = [
  {
    name: "파닉스 기초반",
    target: "초등 기초 다지기",
    frequency: "주 1회 / 주 2회",
    price: "월 10만원 / 20만원",
    duration: "회당 60분",
    summary: "파닉스와 기본 문장 읽기를 정확하게 잡는 입문 과정",
    details:
      "영어 알파벳과 기본 문장 구조를 정확하게 익히고, 발음과 읽기를 자연스럽게 연결하는 기초 수업입니다.",
  },
  {
    name: "STEPS",
    target: "초등 고학년 기본반",
    frequency: "주 2회 / 주 3회",
    price: "월 20만원 / 30만원",
    duration: "회당 90분",
    summary: "중등 진학 전에 필요한 기반을 탄탄하게 만드는 집중 과정",
    details:
      "중등 영어로 넘어가기 전 필요한 문법, 어휘, 독해 기초를 정리하고 영어 문장 확장 과정으로 자연스럽게 이어집니다.",
  },
  {
    name: "BOOST",
    target: "심화 학습 및 시험 대비",
    frequency: "주 2회 / 주 3회",
    price: "월 20만원 / 30만원",
    duration: "회당 90분",
    summary: "영어 5대 영역을 고르게 다지며 문장 구성과 독해를 강화하는 과정",
    details:
      "읽기, 쓰기, 말하기, 독해, 어휘와 문법을 통합해 영어 문장 감각을 키우고 시험형 학습까지 폭넓게 연결합니다.",
  },
  {
    name: "TJ 시험대비반",
    target: "약점 보완",
    frequency: "주 1회",
    price: "월 10만원",
    duration: "집중반",
    summary: "시험 직전 필요한 영역만 빠르게 보완하는 집중 수업",
    details:
      "필요한 단원과 유형을 중심으로 보완하며 현재 학습과 충돌 없이 짧고 밀도 있게 끌어올리는 수업입니다.",
  },
  {
    name: "SEP-C 말하기반",
    target: "말하기 보완",
    frequency: "주 2회",
    price: "월 10만원",
    duration: "실전 발화",
    summary: "발화 자신감과 말하기 리듬을 강화하는 보완 프로그램",
    details:
      "실전 말하기 감각을 높이고 영어로 반응하는 힘을 키우는 데 초점을 둔 수업입니다.",
  },
  {
    name: "쓰기 읽기반",
    target: "라이팅 보완",
    frequency: "주 1회",
    price: "월 10만원",
    duration: "라이팅 트레이닝",
    summary: "짧은 문장부터 생각을 정리해 쓰는 흐름까지 연결하는 라이팅 수업",
    details:
      "아이 스스로 표현한 문장을 구조화하고 읽기 학습과 연동해 안정적으로 정리하는 수업입니다.",
  },
  {
    name: "신문 읽기반",
    target: "리딩 심화",
    frequency: "주 2회",
    price: "월 10만원",
    duration: "Times For Kid / Jr. Herald",
    summary: "시사와 리딩을 함께 다루며 배경지식과 독해력을 넓히는 과정",
    details:
      "리딩 지문을 단순 해석으로 끝내지 않고 배경지식과 표현까지 연결하는 심화 읽기 수업입니다.",
  },
];

export const roadmap = {
  tag: "로드맵",
  title: "국내·해외 모두에 강한 인재 양성은 초등학교 때부터 이미 시작됩니다.",
  intro:
    "복잡해 보이는 과정을 단계별 목표 중심으로 재구성했습니다. 우리 아이가 지금 어디쯤인지, 다음 단계에서 무엇을 준비해야 하는지 빠르게 파악할 수 있습니다.",
  steps: [
    {
      title: "1단계. 기초 읽기 완성",
      description:
        "Phonics, 정확한 발음, 기본 문장 읽기와 쓰기 기초를 익힙니다.",
    },
    {
      title: "2단계. 문장 확장 훈련",
      description:
        "빠른 읽기와 정확한 문장 구성을 바탕으로 읽기와 쓰기의 균형을 맞춥니다.",
    },
    {
      title: "3단계. 학교 영어 대비",
      description:
        "중등 진학 전 필요한 문법, 독해, 서술형 대응력을 체계적으로 완성합니다.",
    },
    {
      title: "4단계. 실전 연결",
      description:
        "영어권 학습, 학교 수업 연계, 심화 학습과 시험 대비까지 자연스럽게 이어갑니다.",
    },
    {
      title: "5단계. 장기 성장",
      description:
        "장기적으로는 국내외 어디서도 흔들리지 않는 영어 실력을 목표로 합니다.",
    },
  ],
};

export const points = [
  {
    tag: "POINT 1",
    title: "아이의 수업 태도가 먼저 달라집니다.",
    description:
      "수업 시간 안에서 이해와 숙제 흐름까지 관리하기 때문에 아이가 영어를 더 편안하게 받아들이게 됩니다.",
    quote: "선생님과 공부하면 영어 공부가 훨씬 덜 부담스러워요.",
    result: "수업 이해도와 참여감이 올라가고 영어에 대한 거부감이 줄어듭니다.",
    imageSrc: "/images/point1.png",
    imageAlt: "학생과 선생님 수업 장면 이미지",
    layout: "letter" as const,
  },
  {
    tag: "POINT 2",
    title: "2년 안에 끝나는 커리큘럼 구조",
    description:
      "Phonics부터 읽기, 쓰기, 말하기, 독해, 어휘, 문법까지 2년 안에 한 흐름으로 연결해 목표를 분명하게 학습합니다.",
    quote: "공부를 좋아하지 않는 학생도 즐겁게 공부할 수 있도록 설계합니다.",
    result: "과정이 많아 보여도 실제 학습 흐름은 단순하고 목표가 선명합니다.",
    imageSrc: "/images/point2.png",
    imageAlt: "학생들이 공부하는 사진형 이미지",
    layout: "gallery" as const,
  },
];

export const contact = {
  label: "상담 문의",
  title: "상담 & 커리큘럼 안내",
  description: "",
  name: "JANE",
  phone: "01027601568",
  bank: "국민은행 216701-04-033600 예금주 곽재인",
  kakaoLabel: "카카오 문의",
};
