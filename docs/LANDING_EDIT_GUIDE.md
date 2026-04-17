# 랜딩 페이지 수정 가이드

이 문서는 `html/css` 중심으로 작업하는 디자이너가 현재 랜딩 페이지 구조를 빠르게 이해하고, 어디를 수정하면 되는지 바로 파악할 수 있도록 정리한 안내서입니다.

결론부터 말하면, `globals.css`를 집중해서 보는 것은 맞습니다. 다만 `globals.css`만 보면 충분하지는 않습니다.

- `globals.css`: 전체 공통 스타일, 레이아웃 규칙, 반응형 규칙
- `app/page.tsx`: 섹션 배치 순서
- `components/landing/*`: 각 섹션의 실제 HTML 구조
- `content/landing.ts`: 문구, 버튼 텍스트, 카드 데이터

즉, 디자인 수정은 보통 아래 순서로 보면 됩니다.

1. `app/page.tsx`로 섹션 순서 확인
2. 수정하려는 섹션의 `components/landing/*.tsx`에서 구조 확인
3. 스타일은 `app/globals.css`에서 수정
4. 문구/리스트/버튼명은 `content/landing.ts`에서 수정

## 1. 프로젝트를 아주 단순하게 보면

이 프로젝트는 `Next.js`로 만들어졌지만, 퍼블리싱 관점에서는 아래처럼 생각하면 됩니다.

- `tsx` 파일 = HTML 구조를 만드는 파일
- `globals.css` = 전체 CSS 파일
- `content/landing.ts` = 문구/데이터 모음
- `public/images` = 실제 이미지 파일

즉, 일반적인 정적 퍼블리싱과 비교하면:

- HTML 한 장에 다 들어있는 구조가 아니라
- "섹션별 HTML 파일" + "공통 CSS" + "문구 데이터 파일"로 분리되어 있다고 보면 됩니다

## 2. 가장 먼저 봐야 하는 파일

### `app/page.tsx`

이 파일은 메인 페이지에서 어떤 섹션을 어떤 순서로 보여주는지 정하는 곳입니다.

현재 순서는 아래와 같습니다.

1. 상단 고정 메뉴 `SectionNav`
2. 히어로 `Hero`
3. 강사 소개 `TeacherProfile`
4. 커리큘럼 `Curriculum`
5. 로드맵 `Roadmap`
6. 포인트/스토리 `Points`
7. 문의 CTA `Contact`
8. 모바일 하단 고정 버튼 `MobileStickyCta`
9. 푸터 `Footer`

즉, "섹션 순서를 바꾸고 싶다"면 먼저 이 파일을 보면 됩니다.

## 3. `globals.css`는 어떤 역할인가

`app/globals.css`는 이 사이트의 거의 모든 스타일이 들어있는 핵심 파일입니다.

특히 아래 내용이 전부 여기 들어 있습니다.

- 컬러 변수
- 폰트 변수
- 공통 여백
- 컨테이너 폭
- 상단 헤더 높이
- 버튼 스타일
- 카드 스타일
- 각 섹션 클래스 스타일
- 모바일 반응형 규칙

### 먼저 보면 좋은 구간

#### 1) 최상단 `:root`

여기서 사이트 전체 분위기가 결정됩니다.

- `--bg`: 전체 배경색
- `--surface`: 카드 기본 배경
- `--surface-soft`, `--surface-mint`: 연한 배경톤
- `--text`, `--text-muted`: 본문/보조 텍스트 색
- `--green`, `--green-strong`: 메인 포인트 컬러
- `--radius-*`: 둥근 정도
- `--gap-section`: 섹션 간격
- `--container`: 최대 너비
- `--header-h`: 상단 메뉴 높이

브랜드 톤을 바꾸고 싶으면 여기부터 보는 게 가장 효율적입니다.

#### 2) 공통 클래스

아래 클래스들은 사이트 전체에 반복해서 쓰입니다.

- `.container`
- `.section`
- `.button`
- `.button--primary`
- `.button--secondary`
- `.tag`
- `.section-heading`

예를 들어 버튼 모양을 전체적으로 바꾸고 싶으면 각 섹션 파일이 아니라 `globals.css`의 `.button` 계열을 수정하면 됩니다.

#### 3) 섹션별 클래스

`globals.css` 안에는 섹션 단위 스타일도 같이 들어 있습니다.

- `.hero*`
- `.teacher-*`
- `.program-*`
- `.timeline-*`
- `.story-*`
- `.cta-panel*`
- `.topbar*`
- `.mobile-sticky-cta*`

즉, 공통 CSS이지만 사실상 "페이지 전체 스타일 파일" 역할도 같이 하고 있습니다.

#### 4) 맨 아래 `@media (max-width: 767px)`

모바일 스타일은 거의 여기에서 한 번에 관리됩니다.

모바일에서:

- 2단이 1단으로 바뀌는지
- 버튼이 세로로 쌓이는지
- 카드 패딩이 줄어드는지
- 하단 고정 CTA가 뜨는지

이런 내용은 이 구간에서 확인하면 됩니다.

## 4. 그래서 `globals.css`만 보면 되나?

정리하면:

- 전체 분위기 수정: 거의 `globals.css`만 보면 됨
- 섹션 내부 배치 수정: `components/landing/*.tsx`도 같이 봐야 함
- 문구 수정: `content/landing.ts`를 봐야 함
- 이미지 교체: `public/images`와 해당 컴포넌트를 같이 봐야 함

즉, `globals.css`를 중심으로 보는 건 맞지만, 실제 수정 작업은 보통 아래처럼 같이 움직입니다.

### 자주 있는 작업별로 보면

#### 배경색, 버튼색, 카드 라운드, 전체 여백 바꾸기

- 주로 `app/globals.css`

#### 히어로에서 버튼 위치 바꾸기, 텍스트 블록 순서 바꾸기

- `components/landing/hero.tsx`
- 필요하면 `app/globals.css`

#### 커리큘럼 카드 개수나 문구 수정

- `content/landing.ts`
- 필요하면 `components/landing/curriculum.tsx`
- 필요하면 `app/globals.css`

#### 섹션 순서 바꾸기

- `app/page.tsx`

#### 이미지 교체

- `public/images/*`
- 이미지를 불러오는 해당 컴포넌트 파일

## 5. 섹션별로 어디를 보면 되는지

### 1) 상단 메뉴

- 구조: `components/layout/section-nav.tsx`
- 스타일: `app/globals.css`의 `.topbar*`, `.mobile-menu*`

수정 예시:

- 메뉴 높이
- 로고 크기
- 메뉴 간격
- 활성 메뉴 색상
- 모바일 메뉴 열림 영역

### 2) 히어로 섹션

- 구조: `components/landing/hero.tsx`
- 스타일: `app/globals.css`의 `.hero*`, `.hero-panel*`, `.hero-strengths*`
- 문구: `content/landing.ts`의 `hero`

수정 예시:

- 메인 카피 줄 수 조정
- 좌우 2단 비율 조정
- 히어로 이미지 크기
- 버튼 디자인
- 강조 텍스트 컬러

### 3) 강사 소개 섹션

- 구조: `components/landing/teacher-profile.tsx`
- 스타일: `app/globals.css`의 `.teacher-*`
- 문구: `content/landing.ts`의 `teacherProfile`

수정 예시:

- 숫자 카드 4개 스타일
- 이미지 카드 크기
- 하이라이트 박스 정렬

### 4) 커리큘럼 섹션

- 구조: `components/landing/curriculum.tsx`
- 스타일: `app/globals.css`의 `.program-*`, `.highlight-strip`
- 문구: `content/landing.ts`의 `curriculumIntro`, `programs`

수정 예시:

- 카드 2열/1열 변경
- 상세보기 버튼 스타일
- 카드 내부 메타 정보 배치
- 프로그램 개수 추가/삭제

### 5) 로드맵 섹션

- 구조: `components/landing/roadmap.tsx`
- 스타일: `app/globals.css`의 `.timeline*`, `.roadmap-*`
- 문구: `content/landing.ts`의 `roadmap`

수정 예시:

- 단계 원형 마커 크기
- 타임라인 카드 스타일
- 로드맵 이미지 위치

### 6) 포인트/사례 섹션

- 구조: `components/landing/points.tsx`
- 스타일: `app/globals.css`의 `.story-*`
- 문구: `content/landing.ts`의 `points`

수정 예시:

- 이미지와 텍스트 좌우 배치
- 강조 문구 스타일
- 사례 카드 간격

### 7) 문의 CTA 섹션

- 구조: `components/landing/contact.tsx`
- 스타일: `app/globals.css`의 `.cta-panel*`
- 문구: `content/landing.ts`의 `contact`

수정 예시:

- 문의 버튼 스타일
- 중앙 정렬/좌측 정렬 변경
- 연락처 정보 노출 방식

### 8) 모바일 하단 고정 버튼

- 구조: `components/layout/mobile-sticky-cta.tsx`
- 스타일: `app/globals.css`의 `.mobile-sticky-cta*`

수정 예시:

- 버튼 3개 비율
- 하단 고정 높이
- 모바일에서만 노출 여부

## 6. 퍼블리셔 관점에서 추천하는 읽는 순서

처음 파악할 때는 아래 순서가 제일 편합니다.

1. `app/page.tsx`
2. `components/landing/hero.tsx`
3. `components/landing/teacher-profile.tsx`
4. `components/landing/curriculum.tsx`
5. `components/landing/roadmap.tsx`
6. `components/landing/points.tsx`
7. `components/landing/contact.tsx`
8. `app/globals.css`
9. `content/landing.ts`

이 순서가 좋은 이유는:

- 먼저 구조를 보고
- 그다음 HTML 형태를 보고
- 그다음 CSS를 보고
- 마지막에 문구 데이터 위치를 확인할 수 있기 때문입니다

반대로 "디자인 톤만 먼저 바꾸고 싶다"면 아래 순서가 더 빠릅니다.

1. `app/globals.css`
2. 수정할 섹션의 `components/landing/*.tsx`
3. 필요하면 `content/landing.ts`

## 7. 지금 파일 구조에서 기억하면 좋은 포인트

### `Section` 컴포넌트

각 섹션은 `components/layout/section.tsx`를 통해 감싸지고 있습니다.

즉, 대부분의 섹션은 공통적으로:

- `section` 클래스를 가지고
- 내부에 `container`를 사용하고
- `id`로 메뉴 이동 대상이 됩니다

그래서 섹션 간격이나 스크롤 위치 보정은 보통 `globals.css`의 `.section`, `--header-h` 쪽을 보면 됩니다.

### 상단 메뉴는 스크롤 연동

`components/layout/section-nav.tsx`는 현재 보이는 섹션에 따라 메뉴 active 상태가 바뀝니다.

그래서 아래를 바꿀 때는 같이 생각해야 합니다.

- 섹션 `id`
- 헤더 높이
- 스크롤 마진

### CTA 버튼은 전화 링크 기반

문의 버튼은 단순한 버튼 모양이 아니라 `tel:` 링크를 사용하고 있습니다.

즉, 텍스트만 바꾸는 게 아니라 실제 링크 동작도 연결되어 있습니다.

## 8. 주의할 점

### 1) 현재 텍스트가 터미널에서 깨져 보임

`content/landing.ts`와 일부 컴포넌트의 한글이 현재 터미널 출력에서는 깨져 보였습니다.

가능성은 두 가지입니다.

- 파일 인코딩 문제가 실제로 있음
- PowerShell 출력 인코딩 문제로만 깨져 보임

수정 전에 에디터에서 실제 파일이 정상 한글로 보이는지 먼저 확인하는 것이 좋습니다.

만약 에디터에서도 깨져 있다면, 디자인 수정 전에 인코딩 정리가 먼저 필요합니다.

### 2) 클래스명을 먼저 바꾸기보다 CSS를 먼저 찾기

이 프로젝트는 CSS가 `globals.css` 한 곳에 많이 모여 있습니다.

그래서 클래스명을 섣불리 바꾸기보다:

1. 현재 클래스가 `globals.css` 어디에 있는지 찾고
2. 그 스타일을 수정하는 방식이 더 안전합니다

### 3) 모바일까지 같이 봐야 함

데스크탑에서 예쁘게 바뀌어도, 이 프로젝트는 모바일 하단 고정 CTA와 1단 전환 규칙이 있어서 모바일 확인이 중요합니다.

특히 아래는 같이 체크해야 합니다.

- 히어로 2단이 모바일에서 자연스럽게 1단으로 바뀌는지
- 버튼이 너무 길어서 줄바꿈이 깨지지 않는지
- 하단 고정 CTA가 다른 요소를 가리지 않는지

## 9. 빠른 결론

당장 집중해서 볼 파일은 맞습니다.

- 가장 중요: `app/globals.css`
- 같이 봐야 하는 구조 파일: `components/landing/*`
- 문구 수정 파일: `content/landing.ts`
- 섹션 순서 파일: `app/page.tsx`

즉, `globals.css`를 메인으로 보고 작업하되, "왜 이 스타일이 여기 적용되지?" 싶은 순간에는 해당 섹션 컴포넌트를 같이 보면 됩니다.

## 10. 추천 작업 방식

처음 수정할 때는 아래 방식이 가장 덜 헷갈립니다.

1. 바꾸고 싶은 섹션 하나만 정한다
2. 그 섹션 컴포넌트 파일을 열어서 구조를 본다
3. `globals.css`에서 같은 클래스명을 찾는다
4. 디자인 수정 후 모바일 구간도 같이 본다
5. 문구까지 수정할 일이 있으면 `content/landing.ts`를 수정한다

원하면 다음 단계로는 이 문서에 이어서

- "파일별 역할을 더 쉽게 표로 정리한 버전"
- "디자이너용 수정 체크리스트"
- "섹션별 클래스명 맵"

중 하나로 더 정리해드릴 수 있습니다.
