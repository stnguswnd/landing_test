# 학생 숙제 제출 후 뒤로가기 흐름 복원 기록

작성일: 2026-06-08

## 작성 배경

Codex가 이전 작업 도중 종료되었고, 종료 전 대화 내용은 현재 세션에 남아 있지 않았다.

다만 워크스페이스에는 아직 커밋되지 않은 변경사항이 남아 있었기 때문에, `git status --short`와 `git diff`를 기준으로 이전에 진행 중이던 작업의 의도와 현재 상태를 복원했다.

이 문서는 그 복원 내용을 기록하기 위한 문서다.

## 확인한 작업 흔적

`git status --short` 기준으로 다음 파일들이 수정되어 있었다.

- `src/app/student/assignments/[assignmentId]/ListeningHomework.tsx`
- `src/app/student/assignments/[assignmentId]/MultiPartHomework.tsx`
- `src/app/student/assignments/[assignmentId]/PhotoSubmissionHomework.tsx`
- `src/app/student/assignments/[assignmentId]/QuizPartPlayer.tsx`
- `src/app/student/assignments/[assignmentId]/RlRecordingHomework.tsx`
- `src/app/student/assignments/[assignmentId]/VocabularyExampleHomework.tsx`
- `src/app/student/assignments/[assignmentId]/VocabularyRecordingHomework.tsx`
- `src/app/student/assignments/[assignmentId]/WritingHomework.tsx`
- `src/app/student/home/page.tsx`
- `src/components/layout/StudentLayout.tsx`

그리고 다음 파일이 새로 추가된 상태였다.

- `src/app/student/home/HomeworkActionButton.tsx`

워크스페이스 루트에는 `dev-server.log`, `dev-server.err.log` 파일도 있었지만 두 파일 모두 0바이트라서 실제 실행 로그는 남아 있지 않았다.

워크스페이스 내부에 `.codex` 디렉터리는 없었다.

## 복원한 작업 의도

변경사항의 공통된 방향을 보면, 이전 작업의 목적은 다음 문제를 해결하는 것이었던 것으로 보인다.

학생이 숙제를 제출한 뒤 완료 페이지로 이동했을 때, 브라우저의 뒤로가기 버튼을 누르면 방금 제출한 숙제 입력 화면으로 다시 돌아갈 수 있는 문제가 있었다.

이 문제는 특히 다음 상황에서 사용자 경험상 문제가 된다.

- 학생이 제출을 완료했다고 생각했는데 뒤로가기로 다시 작성 화면에 들어갈 수 있음
- 이미 제출된 과제를 다시 수정하거나 다시 제출할 수 있는 것처럼 보일 수 있음
- 완료 페이지가 최종 상태처럼 동작하지 않고, 히스토리상 중간 화면처럼 남음
- 학생이 홈으로 돌아가려는 의도로 뒤로가기를 눌렀는데 제출 화면으로 돌아가 혼란이 생길 수 있음

따라서 이전 작업은 `뒤로가기를 전역으로 막는 방식`이 아니라, `제출 성공 후 브라우저 히스토리를 올바르게 정리하는 방식`으로 방향을 바꾼 것으로 보인다.

## 핵심 변경 방향

확인된 변경은 크게 세 가지다.

1. 숙제 제출 성공 후 완료 페이지 이동을 `router.push`에서 `router.replace`로 변경
2. 학생 레이아웃에서 전역 뒤로가기 가드 제거
3. 홈의 숙제 버튼 클릭 시 홈의 숙제 섹션 앵커를 히스토리에 남기도록 변경

이 세 변경은 함께 보면 하나의 흐름을 만든다.

학생이 홈의 숙제 목록에서 숙제를 연다.

숙제 제출이 성공하면 현재 숙제 입력 페이지가 완료 페이지로 `replace`된다.

그 결과 완료 페이지에서 브라우저 뒤로가기를 눌렀을 때 방금 제출한 입력 화면으로 돌아가지 않고, 이전에 남겨둔 홈의 숙제 섹션으로 돌아가는 흐름이 된다.

## 제출 성공 후 `router.replace`로 변경된 파일들

다음 파일들에서 제출 성공 후 이동 코드가 `router.push(...)`에서 `router.replace(...)`로 변경되어 있었다.

### `ListeningHomework.tsx`

파일:

- `src/app/student/assignments/[assignmentId]/ListeningHomework.tsx`

변경 전 의도:

- 리스닝 숙제 완료 처리 후 `/student/assignments/${assignment.id}/complete`로 이동
- 기존에는 `router.push(...)`를 사용했기 때문에 리스닝 숙제 화면이 브라우저 히스토리에 남음

변경 후:

- `router.replace(...)` 사용
- 완료 처리 후 현재 리스닝 숙제 화면을 완료 페이지로 대체함

의미:

- 완료 페이지에서 뒤로가기 시 리스닝 숙제 입력/완료 처리 화면으로 되돌아가는 것을 줄이려는 변경

### `MultiPartHomework.tsx`

파일:

- `src/app/student/assignments/[assignmentId]/MultiPartHomework.tsx`

변경 전 의도:

- 멀티파트 과제의 현재 파트 저장
- 전체 과제 최종 제출
- 완료 페이지로 이동

변경 후:

- 최종 제출 성공 후 `router.replace(...)`로 완료 페이지 이동

의미:

- 여러 파트로 구성된 과제에서도 최종 제출 후 입력 플로우가 히스토리에 남지 않도록 맞춘 변경
- 단일 유형 과제뿐 아니라 멀티파트 과제까지 동일한 제출 완료 경험을 주려는 의도로 보임

### `PhotoSubmissionHomework.tsx`

파일:

- `src/app/student/assignments/[assignmentId]/PhotoSubmissionHomework.tsx`

변경 전 의도:

- 새 사진과 유지할 기존 첨부 파일 정보를 제출
- 제출 모달을 닫고 완료 페이지로 이동

변경 후:

- 사진 제출 성공 후 `router.replace(...)` 사용

의미:

- 사진 제출 완료 후 브라우저 뒤로가기로 다시 사진 업로드 화면으로 돌아가는 것을 방지하려는 변경

### `QuizPartPlayer.tsx`

파일:

- `src/app/student/assignments/[assignmentId]/QuizPartPlayer.tsx`

변경 전 의도:

- 퀴즈 답안 저장
- 마지막 파트인 경우 과제 최종 제출
- 완료 페이지로 이동

변경 후:

- 마지막 파트 제출 후 완료 페이지 이동을 `router.replace(...)`로 변경

의미:

- 퀴즈 제출 완료 후 다시 퀴즈 풀이 화면으로 돌아가는 흐름을 막으려는 변경
- 특히 퀴즈는 이미 `page.tsx`에서 제출된 퀴즈를 완료 페이지로 리다이렉트하는 로직이 있었기 때문에, 클라이언트 히스토리까지 함께 정리하려는 의도로 보임

관련 기존 로직:

- `src/app/student/assignments/[assignmentId]/page.tsx`
- 퀴즈 과제가 이미 제출되었고 `returned` 상태가 아니면 완료 페이지로 `redirect(...)`

### `RlRecordingHomework.tsx`

파일:

- `src/app/student/assignments/[assignmentId]/RlRecordingHomework.tsx`

변경 전 의도:

- 녹음 파일 제출
- 제출 모달 닫기
- 완료 페이지로 이동

변경 후:

- 녹음 제출 성공 후 `router.replace(...)` 사용

의미:

- 녹음 제출 후 이전 녹음 화면으로 돌아가지 않도록 하는 변경

### `VocabularyExampleHomework.tsx`

파일:

- `src/app/student/assignments/[assignmentId]/VocabularyExampleHomework.tsx`

변경 전 의도:

- 단어 예문 제출 서버 액션 실행
- 오류가 없으면 완료 페이지로 이동

변경 후:

- 완료 페이지 이동을 `router.replace(...)`로 변경

의미:

- 단어 예문 숙제 제출 완료 후 다시 작성 화면으로 돌아가는 흐름을 줄이려는 변경

### `VocabularyRecordingHomework.tsx`

파일:

- `src/app/student/assignments/[assignmentId]/VocabularyRecordingHomework.tsx`

변경 전 의도:

- 단어 녹음 제출 서버 액션 실행
- 오류가 없으면 완료 페이지로 이동

변경 후:

- 완료 페이지 이동을 `router.replace(...)`로 변경

의미:

- 단어 녹음 숙제 제출 완료 후 다시 녹음 화면으로 돌아가는 흐름을 줄이려는 변경

### `WritingHomework.tsx`

파일:

- `src/app/student/assignments/[assignmentId]/WritingHomework.tsx`

변경 전 의도:

- 라이팅 제출
- AI 첨삭 결과 저장
- 제출 모달 닫기
- 완료 페이지로 이동

변경 후:

- 라이팅 제출 성공 후 `router.replace(...)` 사용

의미:

- 라이팅 제출 완료 후 뒤로가기로 다시 작성 화면으로 들어가는 흐름을 막으려는 변경

## 학생 레이아웃의 `BackNavigationGuard` 제거

파일:

- `src/components/layout/StudentLayout.tsx`

변경 내용:

- `BackNavigationGuard` import 제거
- `<BackNavigationGuard fallbackHref="/student/home" />` 렌더링 제거

기존 구조:

- 학생 레이아웃 전체에 뒤로가기 가드가 걸려 있었음
- 학생 화면에서 브라우저 뒤로가기 이벤트가 발생하면 `/student/home`으로 강제 이동시키는 방식이었음

확인한 `BackNavigationGuard` 동작:

- 현재 URL에 히스토리 상태를 추가함
- `popstate` 이벤트를 감지함
- 뒤로가기가 발생하면 다시 현재 URL을 push하고 `window.location.replace(fallbackHref)`로 이동함

제거된 이유로 추정되는 점:

- 학생 화면 전체의 뒤로가기를 강제로 막으면 정상적인 탐색까지 방해할 수 있음
- 숙제 제출 완료 문제는 전역 가드보다 제출 성공 시점의 히스토리 정리가 더 직접적인 해결책임
- 학생이 홈, 숙제, 완료 페이지 사이를 이동하는 자연스러운 브라우저 동작을 최대한 유지하려는 방향으로 보임

현재 상태:

- `BackNavigationGuard` 파일 자체는 삭제되지 않았음
- `TeacherLayout`에서는 여전히 사용 중임

즉, 이번 변경은 가드를 완전히 제거한 것이 아니라 학생 레이아웃에서만 제거한 상태다.

## 홈 숙제 버튼 컴포넌트 추가

새 파일:

- `src/app/student/home/HomeworkActionButton.tsx`

이 파일은 클라이언트 컴포넌트다.

주요 동작:

- `useRouter`를 사용함
- 버튼 클릭 시 현재 경로가 `/student/home`인지 확인함
- 현재 URL이 `/student/home#weekly-homework`가 아니라면 브라우저 히스토리에 `/student/home#weekly-homework`를 push함
- 그 다음 실제 숙제 상세 페이지로 `router.push(href)` 이동함

상수:

- `HOMEWORK_SECTION_URL = "/student/home#weekly-homework"`

의미:

- 학생이 홈에서 숙제를 열기 전에, 홈의 주간 숙제 섹션을 브라우저 히스토리에 명시적으로 남김
- 이후 숙제 제출 완료 페이지에서 뒤로가기를 누르면 홈의 주간 숙제 섹션으로 돌아가게 하려는 의도로 보임

사용자 흐름으로 풀면 다음과 같다.

1. 학생이 `/student/home`에 있음
2. 주간 숙제 카드의 버튼을 누름
3. 코드가 먼저 `/student/home#weekly-homework`를 히스토리에 넣음
4. 숙제 상세 페이지로 이동함
5. 학생이 숙제를 제출함
6. 제출 화면이 완료 페이지로 `replace`됨
7. 완료 페이지에서 뒤로가기를 누르면 제출 화면이 아니라 `/student/home#weekly-homework`로 돌아감

## 홈 페이지 변경

파일:

- `src/app/student/home/page.tsx`

변경 내용 1:

- `HomeworkActionButton` import 추가

변경 내용 2:

- 주간 숙제 섹션의 className 변경

변경 전:

```tsx
<section id="weekly-homework" className="student-section">
```

변경 후:

```tsx
<section id="weekly-homework" className="student-section scroll-mt-24">
```

의미:

- `/student/home#weekly-homework`로 이동했을 때 고정 헤더 때문에 섹션 상단이 가려지지 않도록 여백을 둔 것으로 보임

변경 내용 3:

- 숙제 카드 하단 버튼이 기존 `Button`에서 `HomeworkActionButton`으로 교체됨

변경 전:

```tsx
<Button href={href} className="mt-4 min-h-10 w-full px-3 text-xs sm:min-h-12 sm:text-sm">
  {buttonLabel}
</Button>
```

변경 후:

```tsx
<HomeworkActionButton href={href}>
  {buttonLabel}
</HomeworkActionButton>
```

의미:

- 단순 링크 이동 대신 클릭 전에 히스토리 조작을 수행할 수 있도록 별도 컴포넌트로 분리함
- `page.tsx`는 서버 컴포넌트일 가능성이 높기 때문에, 브라우저의 `window.history`를 다루는 코드는 별도 클라이언트 컴포넌트로 분리한 것으로 보임

## 예상되는 최종 사용자 경험

변경 전 예상 흐름:

1. 학생이 홈에서 숙제를 클릭함
2. 숙제 작성 화면으로 이동함
3. 숙제를 제출함
4. 완료 페이지로 이동함
5. 브라우저 뒤로가기를 누름
6. 방금 제출한 숙제 작성 화면으로 돌아감

변경 후 의도된 흐름:

1. 학생이 홈에서 숙제를 클릭함
2. 내부적으로 `/student/home#weekly-homework`가 히스토리에 남음
3. 숙제 작성 화면으로 이동함
4. 숙제를 제출함
5. 작성 화면이 완료 페이지로 대체됨
6. 완료 페이지에서 브라우저 뒤로가기를 누름
7. 방금 제출한 작성 화면이 아니라 홈의 주간 숙제 섹션으로 돌아감

## 이 방식의 장점

전역 뒤로가기 차단보다 범위가 좁다.

학생 화면 전체에서 뒤로가기를 막는 것이 아니라, 문제가 되는 제출 완료 흐름에서 히스토리를 정리한다.

사용자가 기대하는 브라우저 동작에 더 가깝다.

뒤로가기를 눌렀을 때 무조건 홈으로 강제 이동하는 대신, 실제 이전 맥락인 홈의 숙제 섹션으로 돌아가도록 설계되어 있다.

각 숙제 유형의 제출 성공 흐름이 일관된다.

리스닝, 녹음, 사진, 라이팅, 단어, 퀴즈, 멀티파트 모두 제출 성공 후 `replace`를 사용하도록 맞춰져 있다.

## 확인된 미완료 또는 미검증 사항

이 복원 작업 중에는 다음을 실제로 실행하지 않았다.

- 빌드
- 린트
- 타입체크
- 브라우저 수동 테스트
- 실제 학생 계정으로 숙제 제출 플로우 테스트

따라서 현재 문서는 코드 변경의 의도와 상태를 복원한 것이며, 동작 검증이 완료되었다는 뜻은 아니다.

## 추가로 확인하면 좋은 항목

### 1. 완료 페이지에서 뒤로가기 동작

확인할 시나리오:

1. 학생으로 로그인
2. `/student/home` 접속
3. 주간 숙제 카드에서 숙제 열기
4. 숙제 제출
5. 완료 페이지 도착
6. 브라우저 뒤로가기 클릭

기대 결과:

- 제출 입력 화면으로 돌아가지 않음
- `/student/home#weekly-homework` 또는 그에 준하는 홈의 숙제 섹션으로 이동함

### 2. 홈 앵커 스크롤 위치

확인할 URL:

- `/student/home#weekly-homework`

기대 결과:

- 주간 숙제 섹션이 화면에 보임
- 고정 헤더가 섹션 제목이나 첫 카드 내용을 가리지 않음

### 3. 홈이 아닌 곳에서 숙제 버튼을 누르는 경우

`HomeworkActionButton`은 현재 경로가 `/student/home`일 때만 히스토리를 조작한다.

현재 사용처는 홈의 숙제 카드로 보이므로 문제가 없어 보이지만, 나중에 같은 컴포넌트를 다른 페이지에서 재사용하면 동작 의도를 다시 확인해야 한다.

### 4. 제출 완료 페이지의 "다시 제출하기" 버튼

완료 페이지에는 상태에 따라 다시 제출 버튼이 노출된다.

확인된 코드:

- 퀴즈가 아니거나 `returned` 상태이면 `/student/assignments/${assignmentId}?resubmit=1`로 이동하는 버튼이 있음

이 버튼은 의도적으로 다시 제출 화면으로 이동시키는 기능이므로, 브라우저 뒤로가기 방지와 충돌하지 않는지 별도 확인이 필요하다.

### 5. 서버 리다이렉트와 클라이언트 히스토리의 조합

`src/app/student/assignments/[assignmentId]/page.tsx`에는 제출된 퀴즈를 완료 페이지로 서버 리다이렉트하는 로직이 있다.

이 로직과 클라이언트의 `router.replace(...)`가 함께 동작할 때, 브라우저 히스토리가 기대한 대로 구성되는지 실제 브라우저에서 확인하는 것이 좋다.

## 현재 기준 결론

이전 작업은 거의 일관된 방향으로 적용되어 있었다.

핵심은 학생 숙제 제출 후 완료 페이지로 이동할 때, 제출 화면을 브라우저 히스토리에 남기지 않는 것이다.

이를 위해 모든 주요 숙제 제출 컴포넌트에서 완료 페이지 이동을 `router.replace(...)`로 바꾸었고, 학생 레이아웃의 전역 뒤로가기 가드는 제거했다.

또한 홈에서 숙제를 열 때 `/student/home#weekly-homework`를 히스토리에 남겨, 완료 페이지에서 뒤로가기를 눌렀을 때 학생이 홈의 주간 숙제 섹션으로 자연스럽게 돌아가도록 구성한 상태다.

다만 실제 빌드와 브라우저 플로우 검증은 아직 수행되지 않았으므로, 다음 단계는 테스트와 수동 확인이다.
