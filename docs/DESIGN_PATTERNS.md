# 랜딩 페이지 디자인 패턴

이 문서는 현재 랜딩 페이지 구현을 기준으로 추출한 디자인 패턴이다.  
주요 소스는 `app/globals.css`, `app/layout.tsx`, `components/landing/*`, `components/layout/*`이다.

## 1. 디자인 방향

전체 톤은 교육 브랜드에 맞춘 그린 계열의 신뢰감 있는 프리미엄 랜딩 페이지다.

- 실제 수업/학습 이미지를 크게 사용해 신뢰를 먼저 만든다.
- 배경은 밝은 민트와 화이트를 중심으로 유지한다.
- CTA, 배지, 주요 단계 표시는 진한 그린으로 통일한다.
- 정보는 섹션 단위로 길게 흐르며, 모바일에서는 1열 스택으로 단순화한다.
- 카드와 패널은 둥글고 부드럽지만, 과도한 장식보다 내용 가독성을 우선한다.

## 2. 폰트

### 메인 폰트

한글 메인 폰트는 **SUIT Variable**을 사용한다. 제목과 본문 모두 같은 폰트 패밀리를 공유한다.

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css"
/>
```

```css
:root {
  --font-heading:
    "SUIT Variable", "Noto Sans KR", "Malgun Gothic", "Segoe UI", sans-serif;
  --font-body:
    "SUIT Variable", "Noto Sans KR", "Malgun Gothic", "Segoe UI", sans-serif;
}

body {
  font-family: var(--font-body), sans-serif;
}
```

### 보조 폰트

학생 손편지/감성 카피 영역에는 Google Fonts의 **Gaegu**를 보조 폰트로 사용한다.

```html
<link
  href="https://fonts.googleapis.com/css2?family=Gaegu&display=swap"
  rel="stylesheet"
/>
```

```css
.gaegu-regular {
  font-family: "Gaegu", sans-serif;
  font-weight: 400;
  font-style: normal;
}
```

### 타이포그래피 규칙

- Hero H1: `clamp(2.8rem, 5vw, 4.8rem)`, `700`, `line-height: 1.3`
- 모바일 Hero H1: `clamp(2.2rem, 9.5vw, 3.2rem)`
- Section H2: `clamp(1.9rem, 3.8vw, 3rem)`, `700`
- Teacher H2: `clamp(2rem, 4vw, 3.2rem)`, `700`
- CTA H2: `clamp(1.8rem, 4vw, 2.7rem)`
- 본문: `1rem`, `line-height: 1.7`, muted color
- 큰 강조 수치/카드 제목: `1.5rem` 또는 `1.8rem`, `700`

## 3. 컬러 토큰

```css
:root {
  --bg: #f7fbf6;
  --surface: #ffffff;
  --surface-soft: #f3faf4;
  --surface-mint: #e8f6eb;
  --text: #1b221c;
  --text-muted: #5b655d;
  --line: rgba(20, 83, 45, 0.1);
  --green: #178341;
  --green-strong: #14532d;
  --green-pale: #dcfce7;
}
```

### 사용 규칙

- `--green`: 기본 CTA, 타임라인 마커, 강한 브랜드 포인트
- `--green-strong`: 제목, 보조 버튼 텍스트, 짙은 강조
- `--green-pale`: 태그/칩 배경
- `--surface`: 카드와 CTA 패널 배경
- `--surface-soft`, `--surface-mint`: 보조 정보 박스와 모바일 메뉴 배경
- `--text-muted`: 설명문, 메타 라벨, 푸터 텍스트
- `--line`: 카드/패널/헤더의 낮은 대비 보더

## 4. 레이아웃 토큰

```css
:root {
  --container: 1080px;
  --container-narrow: 820px;
  --header-h: 78px;
  --gap-section: 72px;
  --radius-card: 22px;
  --radius-panel: 28px;
  --radius-pill: 999px;
}
```

모바일에서는 헤더와 섹션 간격, radius를 줄인다.

```css
@media (max-width: 767px) {
  :root {
    --header-h: 72px;
    --gap-section: 52px;
    --radius-card: 18px;
    --radius-panel: 22px;
  }
}
```

## 5. 공통 구조

### Page Shell

- 고정 헤더 높이만큼 상단 여백을 둔다.
- 모든 섹션은 `scroll-margin-top`을 가져 앵커 이동 시 헤더에 가리지 않게 한다.

```css
.page-shell {
  padding-top: var(--header-h);
}

.section {
  padding: var(--gap-section) 0;
  scroll-margin-top: calc(var(--header-h) + 16px);
}
```

### Container

- 기본 컨테이너는 최대 `1080px`.
- CTA처럼 좁게 읽히는 영역은 `820px`.

```css
.container {
  width: min(calc(100% - 28px), var(--container));
  margin: 0 auto;
}

.container--narrow {
  width: min(calc(100% - 28px), var(--container-narrow));
}
```

## 6. 주요 컴포넌트 패턴

### Fixed Topbar

- 상단 고정 헤더.
- 흰색 반투명 배경과 blur를 사용한다.
- 데스크톱은 중앙 섹션 내비게이션, 모바일은 상담 CTA + 햄버거 메뉴.
- 활성 메뉴는 그린 텍스트와 하단 pill underline으로 표시한다.

핵심 스타일:

```css
.topbar {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 60;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
```

### Hero

- 첫 화면은 full-bleed 이미지 히어로다.
- 이미지 위에 좌측 어두운 그라데이션 오버레이를 올려 텍스트 대비를 확보한다.
- 카피는 하단 정렬, 강점 카드는 하단 3열 배치.
- 모바일에서는 강점 카드를 1열로 쌓는다.

구성:

- full viewport width panel
- background image
- dark overlay gradient
- eyebrow
- large H1
- description
- primary/secondary CTA
- 3 strength cards

### Eyebrow / Tag / Chip

작은 분류 라벨은 모두 pill 형태를 사용한다.

```css
.eyebrow,
.tag,
.program-chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border-radius: var(--radius-pill);
  background: var(--green-pale);
  color: var(--green-strong);
  font-weight: 700;
}
```

Hero 내부에서는 배경 이미지 위에 놓이므로 반투명 화이트/민트 톤으로 변형한다.

### Button

버튼은 pill radius, 46px 이상 높이, 굵은 텍스트를 기본으로 한다.

- Primary: 그린 배경 + 흰색 텍스트
- Secondary: 흰색 배경 + 짙은 그린 텍스트
- Hero Secondary: 반투명 흰색 배경 + 흰색 텍스트

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  border-radius: var(--radius-pill);
  font-size: 1rem;
  font-weight: 700;
}
```

### Teacher Profile Gallery

- 2열 이미지 갤러리 구조.
- 좌우 컬럼에 다른 수직 오프셋을 주어 스크롤 시 가벼운 패럴랙스 느낌을 만든다.
- 카드 이미지는 살짝 회전시켜 포트폴리오/앨범 같은 인상을 준다.
- 모바일에서는 회전과 오프셋을 제거하고 1열로 정리한다.

패턴:

- left column: resume card + large image
- right column: two stacked images
- card border: `1px solid var(--line)`
- shadow: `var(--shadow-sm)`
- radius: `var(--radius-card)`

### Curriculum Cards

- 배경 섹션은 상단에서 민트가 흐르는 그라데이션.
- 상단에 큰 highlight strip을 배치한다.
- 프로그램 카드는 데스크톱 2열, 모바일 1열.
- 카드 내부는 chip, 큰 프로그램명, 설명, 2열 메타 정보로 구성한다.

구성:

- section heading
- highlight strip
- `program-grid`
- `program-card`
- `program-meta`

### Roadmap Timeline

- 단계형 학습 과정을 세로 타임라인으로 보여준다.
- 좌측 원형 숫자 마커와 우측 설명 카드가 한 행을 이룬다.
- 숫자 마커는 강한 그린으로 고정해 진행감을 만든다.

```css
.timeline__item {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 14px;
}

.timeline__marker {
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: var(--green);
  color: #fff;
}
```

### System / Student Story Section

- 강한 그린 배경으로 분위기를 전환한다.
- 텍스트는 pale green 계열을 사용한다.
- 카드의 배경/보더/radius를 제거해 콘텐츠가 섹션 배경 위에 자연스럽게 놓이게 한다.
- 손편지 텍스트에는 `Gaegu`를 적용한다.

### Showcase Video

- 비디오 섹션은 진한 그린 배경 위에 큰 영상 뷰포트를 배치한다.
- 뷰포트는 둥근 radius와 어두운 fallback 배경을 가진다.
- 데스크톱 최소 높이 `640px`, 모바일 `320px`.

### CTA Panel

- 중앙 정렬된 흰색 패널.
- 좁은 컨테이너(`container--narrow`) 안에 배치한다.
- 태그, 제목, 버튼 그룹 순서.
- 모바일에서는 좌측 정렬로 바꿔 읽기 흐름을 자연스럽게 만든다.

### Mobile Sticky CTA

- 모바일 전용 하단 고정 CTA 바.
- 3개 버튼을 그리드로 배치한다.
- 배경은 반투명 화이트, 보더와 shadow로 떠 있는 느낌을 준다.

```css
.mobile-sticky-cta {
  position: fixed;
  left: 14px;
  right: 14px;
  bottom: 14px;
  z-index: 70;
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 1fr;
  gap: 8px;
}
```

## 7. 반응형 규칙

모바일 기준 breakpoint는 `767px`이다.

- 데스크톱 내비게이션 숨김
- 모바일 상담 CTA와 메뉴 버튼 표시
- Hero strength cards: 3열에서 1열
- Program grid: 2열에서 1열
- Program meta: 2열에서 1열
- Story card: 2열에서 1열
- Teacher gallery: 2열에서 1열
- 이미지 회전/패럴랙스 제거
- 버튼 그룹은 세로 스택
- 하단 sticky CTA 표시


이미지 스타일은 과한 필터보다 `object-fit: cover`, 자연스러운 radius, 낮은 대비 border를 중심으로 한다.

## 9. 그림자와 보더

```css
:root {
  --shadow-sm: 0 10px 24px rgba(20, 83, 45, 0.05);
  --shadow-md: 0 20px 44px rgba(20, 83, 45, 0.07);
}
```

- 일반 카드: `--shadow-sm`
- 모바일 sticky CTA: `--shadow-md`
- 보더는 대부분 `var(--line)`로 낮은 대비를 유지한다.

## 10. 재사용 체크리스트

새 섹션이나 컴포넌트를 추가할 때는 아래 기준을 따른다.

- 한글 폰트는 `SUIT Variable`을 기본으로 사용한다.
- 제목은 `letter-spacing: -0.05em`, `line-height: 1.3` 계열을 유지한다.
- 주요 CTA는 `--green`, 보조 CTA는 화이트/민트 기반으로 구성한다.
- 카드 radius는 `--radius-card`, 큰 패널은 `--radius-panel`을 사용한다.
- 섹션 간격은 `--gap-section`을 따른다.
- 데스크톱에서 2열 이상인 구조는 모바일에서 1열로 바꾼다.
- 이미지 위 텍스트는 반드시 오버레이로 대비를 확보한다.
- 모바일에서는 하단 sticky CTA와 겹치지 않도록 body 하단 여백을 유지한다.

