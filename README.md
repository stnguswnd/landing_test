# Student Homework Frontend

학원 소개 랜딩 페이지와 강사·학생용 숙제 관리 기능을 제공하는 Next.js 애플리케이션입니다.

## 기술 구성

- Next.js 16 (App Router)
- React 19
- TypeScript
- PostgreSQL (`pg`)
- Supabase Database / Storage
- Tailwind CSS
- OpenAI API (AI 첨삭 기능에서 선택적으로 사용)

## 요구 사항

- Node.js 20.9 이상
- npm
- 애플리케이션용 PostgreSQL 데이터베이스
- 이미지와 오디오 업로드에 사용할 Supabase 프로젝트

## 현재 저장소에서 실행

의존성과 `.env`가 이미 준비된 환경에서는 다음 명령으로 실행합니다.

```powershell
cd C:\Users\user\Desktop\landing_test
npm run dev
```

브라우저에서 <http://localhost:3000>을 엽니다.

3000번 포트를 이미 사용하고 있다면 다른 포트를 지정할 수 있습니다.

```powershell
npm run dev -- -p 3001
```

## 새 환경에서 처음 실행

### 1. 의존성 설치

`package-lock.json` 기준으로 설치합니다.

```powershell
npm ci
```

### 2. 환경변수 준비

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS/Linux:

```bash
cp .env.example .env.local
```

복사한 `.env.local`의 예시 값을 실제 개발 환경 값으로 변경합니다.

| 변수 | 용도 | 필수 여부 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | 필수 |
| `AUTH_SESSION_SECRET` | 로그인 세션 서명용 비밀키 | 필수 |
| `NEXT_PUBLIC_SITE_URL` | 애플리케이션 기본 URL | 필수 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 필수 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개(anon) 키 | 필수 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 측 Supabase 관리 키 | 필수 |
| `NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET` | 이미지 Storage 버킷 이름 | 필수 |
| `NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET` | 오디오 Storage 버킷 이름 | 필수 |
| `OPENAI_API_KEY` | 작문·어휘 AI 첨삭 | 해당 기능 사용 시 필수 |
| `OPENAI_WRITING_MODEL` | AI 첨삭에 사용할 모델 | 선택 |
| `ALLOW_DEMO_SEED` | 프로덕션 환경의 데모 시드 허용 여부 | 선택 |

`AUTH_SESSION_SECRET`에는 예시 문자열을 그대로 사용하지 말고 충분히 긴 임의 문자열을 설정합니다. `SUPABASE_SERVICE_ROLE_KEY`와 `OPENAI_API_KEY`는 브라우저에 노출되는 `NEXT_PUBLIC_` 변수로 만들면 안 됩니다.

Next.js와 저장소의 DB 스크립트는 `.env.local`을 `.env`보다 우선해서 읽습니다.

### 3. DB 연결 확인

```powershell
npm run check:db
```

연결에 성공하면 DB 호스트, 데이터베이스 이름과 `Database connected` 메시지가 표시됩니다. 비밀번호는 출력되지 않습니다.

### 4. 개발 서버 실행

```powershell
npm run dev
```

## 프로덕션 빌드와 실행

```powershell
npm run build
npm run start
```

`npm run start`를 실행하기 전에 `npm run build`가 완료되어 있어야 합니다.

## 데이터베이스 관련 주의사항

이 저장소의 `database/` 디렉터리에는 기존 스키마에 적용하는 추가 SQL과 기능별 마이그레이션이 들어 있습니다. 신규 PostgreSQL/Supabase 데이터베이스를 처음부터 구성하는 완전한 기본 스키마는 현재 저장소에 포함되어 있지 않습니다.

따라서 다음 중 하나가 필요합니다.

- 이미 스키마가 구성된 프로젝트 DB에 연결
- 별도로 보관된 기본 스키마를 먼저 적용한 뒤 `database/`의 필요한 마이그레이션 적용

마이그레이션 스크립트와 시드 명령은 연결된 DB를 실제로 변경합니다. 운영 DB에서 실행하기 전에 대상 `DATABASE_URL`을 반드시 확인해야 합니다.

DB 연결 대상 확인:

```powershell
npm run check:db
```

테스트용 인증·학생 데이터를 넣는 명령:

```powershell
npm run seed:auth
```

이 명령은 사용자, 강사, 반, 학생 데이터를 추가하거나 갱신하므로 개발·테스트 DB에서만 사용합니다.

강사 계정 생성:

```powershell
npm run create:teacher -- --username teacher01 --password "change-this-password" --email "teacher@example.com" --name "Teacher Name"
```

## 주요 npm 명령

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Webpack 기반 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 및 TypeScript 검사 |
| `npm run start` | 빌드된 애플리케이션 실행 |
| `npm run check:db` | `DATABASE_URL` 확인 및 DB 연결 테스트 |
| `npm run check:encoding` | 저장소의 인코딩 검사 스크립트 실행 |
| `npm run create:teacher` | 강사 계정 생성 |
| `npm run seed:auth` | 개발용 인증·학생 데이터 추가/갱신 |
| `npm run seed:calendar-demo` | 개발용 캘린더·공지 데이터 추가 |

그 밖의 `apply:*` 명령은 기능별 DB 마이그레이션입니다. 필요한 변경과 대상 DB를 확인한 뒤 실행합니다.

## 주요 경로

- `src/app/`: 페이지와 API 라우트
- `src/components/`: 공통 및 랜딩 UI 컴포넌트
- `src/features/`: 기능별 컴포넌트, API 호출, 저장소 코드
- `src/lib/`: PostgreSQL, Supabase, 인증 등의 공통 코드
- `src/server/`: 서버 전용 로직
- `database/`: 추가 SQL 및 기능별 DB 마이그레이션
- `scripts/`: DB 검사, 시드, 마이그레이션 실행 스크립트
- `docs/`: 변경 이력과 기능별 작업 문서

## 학생 후기 이미지 관리

학생 후기 이미지는 `public/images/reviews/`에 넣습니다. 파일명은 다음처럼 두 자리 숫자로 시작하는 방식을 권장합니다.

```text
01.png
02.jpg
03.webp
...
10.png
```

이미지 확장자가 달라도 파일명의 숫자 순서대로 자동 정렬됩니다. 데스크톱에서는 3열, 모바일에서는 2열로 표시됩니다. 이미지를 누르면 확대 모달이 열리고 이전·다음 버튼으로 다른 후기를 볼 수 있습니다.

처음에는 3줄 분량만 표시됩니다. 그보다 이미지가 많으면 아래쪽에 그라데이션과 `후기 더 보기` 버튼이 나타나고, 버튼을 누르면 나머지 이미지가 모두 표시됩니다.

## 문제 해결

### `Missing DATABASE_URL`

`.env.local` 또는 `.env`에 `DATABASE_URL`이 있는지 확인한 후 다음 명령을 실행합니다.

```powershell
npm run check:db
```

### Supabase 관련 환경변수가 없다는 오류

다음 값이 실제 Supabase 프로젝트 값으로 설정되어 있는지 확인합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### AI 첨삭 요청 실패

`OPENAI_API_KEY`가 예시 값이 아닌 실제 서버용 키인지 확인합니다. AI 첨삭을 사용하지 않는 경우에는 기본 화면과 일반 숙제 기능 실행에 필요하지 않습니다.

### 화면의 한글이 깨져 보이는 경우

기존 파일을 일괄 변환하거나 저장 인코딩을 추측해서 덮어쓰지 않습니다. 먼저 터미널·에디터의 표시 인코딩과 실제 파일 바이트를 구분해서 확인하고, 수정 대상이 명확할 때만 개별 파일을 변경합니다.
