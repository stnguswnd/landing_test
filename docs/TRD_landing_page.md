# TRD — 영어 학원 단일형 랜딩 페이지 기술 요구사항

## 1. 문서 개요
- **목적**: Next.js 기반의 SEO 친화적 랜딩 페이지를 안정적으로 개발/배포하기 위한 기술 구조 정의
- **대상 독자**: Codex, 프론트엔드 개발자, 추후 백엔드/운영 담당자
- **전제**: 현재는 랜딩 중심, 이후 Supabase 기반 게시판/음원 기능 확장 예정

---

## 2. 기술 스택 제안

### 2.1 Frontend
- Next.js 15+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (선택)
- Framer Motion (최소 사용)
- Lucide React 아이콘

### 2.2 Backend / Data
- 초기 MVP: 정적 콘텐츠 중심
- 확장 시:
  - Supabase Auth (필요 시)
  - Supabase Database (공지/게시판)
  - Supabase Storage (mp3, 이미지, 첨부파일)

### 2.3 Deployment
- Vercel 배포 권장
- 환경변수는 Vercel Project Settings에서 관리
- 추후 Supabase 연결 시 preview/prod 분리

---

## 3. 아키텍처 원칙
1. **SEO 우선**: 가능한 서버 렌더링과 정적 생성 활용
2. **콘텐츠 중심 구조**: 데이터와 프레젠테이션 분리
3. **확장 가능 구조**: 게시판/음원 기능을 쉽게 추가할 수 있어야 함
4. **운영 단순성**: 작은 팀이 유지보수 가능해야 함
5. **성능 최적화**: 이미지, 폰트, 애니메이션 절제

---

## 4. 앱 구조 제안

```txt
app/
  layout.tsx
  page.tsx
  sitemap.ts
  robots.ts
  globals.css

components/
  layout/
    section.tsx
    container.tsx
    footer.tsx
    floating-cta.tsx
    section-nav.tsx
  landing/
    hero.tsx
    overview.tsx
    brand.tsx
    roadmap.tsx
    learning-system.tsx
    admission-process.tsx
    faq.tsx
    final-cta.tsx
  ui/
    button.tsx
    badge.tsx
    card.tsx
    accordion.tsx
    tabs.tsx

lib/
  seo.ts
  utils.ts
  analytics.ts
  constants.ts

content/
  landing.ts
  seo.ts
  faq.ts
  roadmap.ts

public/
  images/
  og/
  icons/

styles/
  tokens.css
```

---

## 5. 라우팅 전략

### 현재
- `/` : 메인 랜딩 페이지

### 추후 확장
- `/notice` : 공지/게시판 목록
- `/notice/[slug]` : 게시글 상세
- `/media` : 음원/자료 목록
- `/media/[slug]` : 자료 상세 및 mp3 재생
- `/contact` : 문의 페이지
- `/level-test` : 레벨 테스트 신청 페이지

---

## 6. 렌더링 전략

### 랜딩 페이지
- 기본은 정적 생성(SSG) 또는 App Router의 캐시 가능한 서버 컴포넌트 사용
- 상호작용이 필요한 일부 컴포넌트만 Client Component로 제한
  - roadmap tab
  - faq accordion
  - section active state

### 추후 게시판/음원
- 목록 페이지: ISR 또는 서버 컴포넌트 fetch
- 상세 페이지: 동적 route + 메타데이터 생성

---

## 7. SEO 설계

### 7.1 메타데이터
- `generateMetadata()` 사용
- title, description, keywords, openGraph, twitter 카드 포함
- canonical URL 지정

### 7.2 구조화 데이터
- JSON-LD 주입
- 권장 schema
  - `EducationalOrganization`
  - `FAQPage`
  - `WebSite`

### 7.3 사이트맵/로봇
- `app/sitemap.ts`
- `app/robots.ts`

### 7.4 heading 규칙
- H1: 페이지 대표 메시지 1개
- H2: 주요 섹션 제목
- H3: 카드/하위 블록 제목

---

## 8. 콘텐츠 관리 방식

### MVP 단계
- `content/*.ts` 파일에 구조화 데이터 저장
- 예시:
  - heroCopy
  - overviewCards
  - brandValues
  - roadmapGroups
  - learningSteps
  - faqItems

### 장점
- 카피 수정이 쉬움
- 다국어/브랜치별 변형 대응 가능
- 추후 CMS/Supabase 이전이 쉬움

---

## 9. 컴포넌트 설계 원칙

### 9.1 공통 원칙
- 재사용 가능 컴포넌트 우선
- 프레젠테이션과 데이터 분리
- 섹션 단위 독립성 확보

### 9.2 섹션 인터페이스 예시
```ts
export type SectionId =
  | 'hero'
  | 'overview'
  | 'brand'
  | 'roadmap'
  | 'system'
  | 'admission'
  | 'faq'
  | 'cta';
```

### 9.3 카드 데이터 예시
```ts
export interface FeatureCard {
  title: string;
  description: string;
  icon?: string;
  tag?: string;
}
```

---

## 10. 스타일링 전략

### 10.1 방식
- Tailwind CSS 기본 사용
- 토큰화된 색상/간격/반경 사용
- 글로벌 CSS 최소화

### 10.2 디자인 토큰 분리
- primary, secondary, accent, muted, surface 등 semantic token 사용
- 특정 색상값을 컴포넌트에 직접 박아넣지 않기

---

## 11. 반응형 설계 원칙

### 브레이크포인트 예시
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

### 기준
- 모바일 우선 설계
- 표 형태는 모바일에서 카드 스택으로 대체
- CTA는 모바일에서 더 자주 노출

---

## 12. 애니메이션 정책
- 과한 모션 금지
- 등장 애니메이션은 opacity + translate 정도로 제한
- prefers-reduced-motion 대응
- Hero에서만 약한 강조 모션 허용

---

## 13. 접근성 기술 기준
- semantic HTML 사용
- button/link 역할 명확화
- accordion aria 속성 적용
- 키보드 tab 이동 가능
- 명도 대비 AA 이상 권장
- form 요소 label 연결

---

## 14. 이미지 처리 전략
- `next/image` 사용
- WebP/AVIF 우선
- Hero 및 주요 이미지에 크기 명시
- decorative image는 빈 alt, 정보성 이미지는 alt 작성
- 다이어그램성 요소는 가능하면 SVG/CSS로 제작

---

## 15. 폰트 전략
- Next font 사용
- 국문 가독성이 좋은 폰트 1종 + 영문 보조 1종 이하
- 폰트 수 최소화
- 서브셋 적용 권장

---

## 16. 성능 최적화 전략
- Client Component 최소화
- large dependency 최소화
- 이미지 lazy loading
- bundle analyzer로 확인
- 불필요한 shadow/filter/blur 남용 금지
- first viewport 콘텐츠 우선 렌더링

---

## 17. 분석 도구 연동

### 추천
- Google Analytics 4
- Vercel Analytics (선택)
- Microsoft Clarity (선택)

### 이벤트 추적 예시
- CTA 클릭
- FAQ 오픈
- 로드맵 탭 변경
- 문의 폼 이동
- 전화 링크 클릭

---

## 18. Supabase 확장 설계

### 18.1 추후 사용 시나리오
1. 공지사항 게시판
2. mp3 음원 업로드 및 재생
3. 학습 자료 게시판
4. 관리자 업로드 기능

### 18.2 스키마 초안

#### notices
- id
- slug
- title
- excerpt
- content
- is_published
- published_at
- created_at
- updated_at

#### media_items
- id
- slug
- title
- description
- file_url
- thumbnail_url
- category
- duration
- is_published
- created_at
- updated_at

#### faqs (선택)
- id
- question
- answer
- sort_order
- is_visible

---

## 19. mp3 재생 기능 확장 고려사항
- Supabase Storage에 mp3 저장
- signed URL 또는 public bucket 정책 결정
- HTML5 audio 기반 재생기 사용
- 모바일 autoplay 제한 고려
- waveform은 MVP 이후 검토
- 캐시 정책 및 파일 용량 관리 필요

---

## 20. 게시판 확장 고려사항
- slug 기반 SEO-friendly URL
- mdx 에디터 또는 간단한 textarea 관리자 페이지
- 썸네일/첨부파일 업로드 가능 구조
- 목록/상세 메타데이터 생성

---

## 21. 보안 및 운영 기준
- 환경변수는 `.env.local` / Vercel env 분리
- Supabase service role key는 서버에서만 사용
- 클라이언트에는 anon key만 노출
- 폼 악용 방지(reCAPTCHA/turnstile 검토)
- 관리자 기능은 추후 별도 보호 필요

---

## 22. 배포 전략

### MVP
- Vercel Production 1개
- GitHub 연동
- PR 기반 Preview 배포

### 권장 브랜치 전략
- `main`: production
- `develop` 또는 feature branch: preview

### 배포 체크리스트
- metadata 설정 완료
- OG 이미지 존재
- sitemap/robots 동작 확인
- CTA 링크 확인
- 모바일 실기기 확인
- Lighthouse 점검

---

## 23. 오류 처리 및 폴백
- 외부 데이터 의존이 거의 없는 구조로 MVP 단순화
- 추후 Supabase 연동 시:
  - 로딩 skeleton 제공
  - fetch 실패 시 fallback 메시지 노출
  - 미디어 파일 누락 시 placeholder 제공

---

## 24. 테스트 전략

### 24.1 수동 테스트
- 모바일/태블릿/데스크탑 반응형
- 앵커 스크롤 정상 동작
- CTA 버튼 링크 확인
- SEO 메타 반영 확인

### 24.2 자동 테스트 권장
- ESLint
- Type check
- Playwright e2e(핵심 CTA, section nav)
- Lighthouse CI(선택)

---

## 25. Codex 구현 지시용 핵심 포인트
1. App Router 기반으로 구성
2. `content/landing.ts`에서 모든 카피/데이터를 관리
3. 랜딩 페이지는 섹션 컴포넌트 조합으로 작성
4. sticky header 메뉴는 제거
5. 대신 간단한 in-page section nav 또는 floating nav 제공
6. green theme semantic token 적용
7. 추후 Supabase 게시판/미디어 페이지 확장이 가능하도록 route skeleton 확보
8. SEO 메타데이터, sitemap, robots 반드시 포함
9. 접근성과 모바일 가독성을 우선
10. Vercel 배포 기준으로 불필요한 복잡성 제거

---

## 26. 완료 기준
- Next.js 프로젝트에서 바로 구현 가능한 수준의 구조와 규칙이 문서화되어 있다.
- 랜딩 페이지 MVP와 추후 Supabase 확장 방향이 함께 정의되어 있다.
- Codex가 바로 코드 생성을 시작할 수 있을 정도로 폴더 구조, 컴포넌트 전략, SEO 전략이 명확하다.
