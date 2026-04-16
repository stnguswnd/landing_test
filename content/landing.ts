import type { SectionId } from "@/lib/seo";

export const navigation: Array<{ id: SectionId; label: string }> = [
  { id: "hero", label: "소개" },
  { id: "teacher", label: "선생님 이력" },
  { id: "curriculum", label: "커리큘럼" },
  { id: "roadmap", label: "로드맵" },
  { id: "system", label: "후기·포인트" },
  { id: "contact", label: "상담 문의" },
];

export const hero = {
  eyebrow: "초등 영어 홈스쿨링",
  title: ["영어를 오래 잘하는 힘,", "초등부터 jainetimes english 에서", "차근히 완성합니다."],
  description:
    "문해력, 듣기, 쓰기, 말하기, 독해, 어휘, 문법까지 2년 커리큘럼으로 연결하고, 학생 성향에 맞는 관리 방식으로 영어를 꾸준히 끌어올립니다.",
  strengths: [
    {
      title: "2년 커리큘럼",
      description: "초등부터 중·고등 수준까지 자연스럽게 이어지는 성장 설계",
    },
    {
      title: "직접 관리형 수업",
      description: "수업 안에서 이해와 숙지까지 마무리하는 관리 중심 운영",
    },
    {
      title: "실력 + 경험",
      description: "해외 학력과 다년간 지도 경험을 바탕으로 안정적인 수업 제공",
    },
  ],
  primaryCta: { label: "상담 문의하기", href: "#contact" },
  secondaryCta: { label: "커리큘럼 보기", href: "#curriculum" },
};

export const teacherProfile = {
  tag: "선생님 이력",
  title: "확실한 실력, 검증된 경험으로 지도합니다.",
  intro:
    "서울·경기 지역에서 미국 시민권자인 선생님이 20년간 초등학생을 대상으로 알파벳부터 문법 완성까지 탄탄하게 지도해왔습니다. 많은 학생들이 외고와 해외대학 진학으로 이어졌고, 중학교 진학 시점에는 매우 높은 수준의 영어를 구사하며 타 학원 레벨테스트에서도 최고 레벨을 받는 경우가 많았습니다.",
  metrics: [
    { label: "해외 학력", value: "USC" },
    { label: "교원 자격", value: "MTAC" },
    { label: "수상 경력", value: "YBM Award" },
    { label: "지도 경험", value: "20년+" },
  ],
  highlights: [
    "Univ. of Southern California (USC)",
    "미국 시민권자",
    "YBM 어학원 강사 출신",
    "MTAC 미국 교원 자격증",
    "YBM AWARD WINNER",
    "원어교육 기반 수업 운영",
    "단시간 Level-up 경험 다수",
    "초등부터 중등 연결형 지도",
  ],
};

export const curriculumIntro = {
  tag: "커리큘럼",
  title: "jainetimes 2년과정으로 중·고등학교 수준까지 Level-Up!",
  description:
    "처음에는 과정의 차이를 빠르게 이해하고, 관심이 가는 반만 자세히 열어보는 구조로 정리했습니다. 과정이 많아 보여도 실제 탐색은 가볍게, 비교는 쉽게 보이도록 구성했습니다.",
  highlight:
    "영어 듣기, 쓰기, 말하기, 독해, 어휘, 문법을 단계별로 연결하는 2년형 핵심 커리큘럼",
};

export const programs = [
  {
    name: "예비반",
    target: "초등 기초 다지기",
    frequency: "주 1회 / 주 2회",
    price: "월 10만원 / 20만원",
    duration: "1회당 60분",
    summary: "Phonics와 기본 문장 습관을 정확하게 잡는 입문 과정",
    details:
      "영어 단어와 문장을 정확하고 속도 있게 쓰고, 원어민 발음으로 말하며 암기하는 기초 습관을 만드는 수업입니다.",
  },
  {
    name: "STEPS",
    target: "초등 고학년 · 정규반",
    frequency: "주 2회 / 주 3회",
    price: "월 20만원 / 30만원",
    duration: "1회당 90분",
    summary: "중·고등학교 진학 전 필요한 기반을 탄탄하게 만드는 핵심 과정",
    details:
      "중·고등학교 진학 준비를 탄탄하게 마무리하고, 영어권 현지 학업과정으로 자연스럽게 이어지도록 설계된 2년 정규 프로그램입니다.",
  },
  {
    name: "BOOST",
    target: "심화 학습 · 시험 대비",
    frequency: "주 2회 / 주 3회",
    price: "월 20만원 / 30만원",
    duration: "1회당 90분",
    summary: "영어 5대 영역을 토대로 문장 개념과 작문까지 강화하는 과정",
    details:
      "듣기, 쓰기, 말하기, 독해, 어휘·문법을 통합해 영어 문장 개념을 더 깊게 다루고, 영어작문과 각종 시험 대비까지 함께 이어갑니다.",
  },
  {
    name: "TJ 시험대비반",
    target: "단기 보완",
    frequency: "주 1회",
    price: "월 10만원",
    duration: "집중반",
    summary: "시험 직전 필요한 영역만 빠르게 보완하는 집중 수업",
    details: "필요한 단원과 유형을 중심으로 보완하며 현재 반 학습과 충돌 없이 짧게 끌어올리는 수업입니다.",
  },
  {
    name: "SEP-C 말하기반",
    target: "말하기 보완",
    frequency: "월 2회",
    price: "월 10만원",
    duration: "실전 발화",
    summary: "발화 자신감과 말하기 루틴을 강화하는 보완 프로그램",
    details: "실전 말하기 감각을 높이고, 꾸준히 영어로 반응하는 힘을 키우는 데 초점을 둡니다.",
  },
  {
    name: "일기 쓰기반",
    target: "라이팅 보완",
    frequency: "주 1회",
    price: "월 10만원",
    duration: "라이팅 루틴",
    summary: "짧은 문장부터 생각을 쓰는 힘까지 연결하는 라이팅 수업",
    details: "아이 스스로 표현을 문장으로 정리하고, 쓰기 습관을 안정적으로 유지하도록 돕는 수업입니다.",
  },
  {
    name: "신문읽기반",
    target: "리딩 심화",
    frequency: "월 2회",
    price: "월 10만원",
    duration: "Times For Kid / Jr. Herald",
    summary: "시사와 리딩을 함께 다루며 배경지식과 독해력을 넓히는 과정",
    details: "리딩 지문을 단순 해석으로 끝내지 않고 배경지식과 생각의 깊이까지 연결하는 심화형 읽기 수업입니다.",
  },
];

export const roadmap = {
  tag: "로드맵",
  title: "초등에서 시작해 중·고등 영어 수준까지 끌어올리는 성장 흐름",
  intro:
    "복잡한 표 대신 단계별 목적이 먼저 읽히는 흐름으로 바꿨습니다. 우리 아이가 지금 어디쯤인지, 다음 단계에서 무엇을 준비하는지 빠르게 파악할 수 있습니다.",
  steps: [
    {
      title: "1단계. 기초 습관 형성",
      description: "Phonics, 정확한 발음, 기본 문장 읽기와 쓰기 습관을 잡습니다.",
    },
    {
      title: "2단계. 문장 개념 확장",
      description: "빠른 암기력과 정확한 문장 개념을 확보해 읽기와 쓰기의 밀도를 높입니다.",
    },
    {
      title: "3단계. 학교 영어 대비",
      description: "중·고등학교 진학 전 필요한 문법, 독해, 서술형 대응력을 탄탄하게 완성합니다.",
    },
    {
      title: "4단계. 실전 연결",
      description: "영어권 현지 학교 수업 연계와 심화 학습, 시험 대비까지 자연스럽게 이어갑니다.",
    },
    {
      title: "5단계. 글로벌 성장",
      description: "장기적으로는 국내외 어디서도 흔들리지 않는 영어 실력을 목표로 합니다.",
    },
  ],
};

export const points = [
  {
    tag: "POINT 1",
    title: "아이의 표정이 달라질거예요.",
    description:
      "수업시간 안에서 이해와 숙지가 마무리되도록 관리하기 때문에, 아이가 영어를 더 덜 부담스럽게 받아들이게 됩니다.",
    quote: "선생님과 공부하면서 영어공부가 재밌는 거구나 느꼈어요.",
    result: "수업 이해도와 참여감이 높아져 영어에 대한 거부감이 줄어듭니다.",
    imageSrc: "/images/point1.png",
    imageAlt: "학생이 선생님께 쓴 편지 후기 이미지",
    layout: "letter" as const,
  },
  {
    tag: "POINT 2",
    title: "2년 안에 끝나는 커리큘럼 구조",
    description:
      "Phonics부터 듣기, 쓰기, 말하기, 독해, 어휘, 문법까지 2년 안에 한 흐름으로 연결해 목표를 분명하게 잡습니다.",
    quote: "공부를 좋아하지 않았던 학생도 즐겁게 공부할 수 있도록 하겠습니다.",
    result: "과정이 많아 보여도 실제 학습 흐름은 단순하고 목표는 분명합니다.",
    imageSrc: "/images/point2.png",
    imageAlt: "학생들이 공부하는 사진이 담긴 후기 이미지",
    layout: "gallery" as const,
  },
];

export const contact = {
  label: "상담 문의",
  title: "상담부터 커리큘럼 안내까지 바로 연결해드립니다.",
  description:
    "처음 문의하는 학부모도 부담 없이 확인할 수 있도록 연락처와 상담 유도만 남겼습니다. 마지막 구간은 전환이 잘 일어나도록 짧고 명확하게 정리했습니다.",
  name: "JANE",
  phone: "01027601568",
  bank: "국민은행 216701-04-033600  예금주: 곽재인",
  kakaoLabel: "카카오 문의",
};
