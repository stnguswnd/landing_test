# 2026-06-08 Student Back Navigation and Quiz Resubmission Notes

작성일: 2026-06-08

이 문서는 학생 모드 브라우저 뒤로가기 정책, 카카오톡 등 외부 링크 유입 대응, 퀴즈 반려 후 재제출 허용 문제를 다음 작업자가 이어서 확인할 수 있도록 정리한 기록이다.

## 최종 목표

학생 모드에서는 브라우저/모바일 기본 뒤로가기가 아래 흐름을 따라야 한다.

```text
/student/assignments/[assignmentId]
→ 뒤로가기
/student/home#weekly-homework
→ 뒤로가기
/student/home#today
→ 뒤로가기 반복
/student/home#today 유지
```

로그아웃 상태에서는 반대로 학생 URL에 들어오면 안 된다.

```text
/student/home
/student/assignments/[assignmentId]
/student/assignments/[assignmentId]/complete
→ 세션 없음
→ /
```

## 현재 학생 라우트 구조

- 학생 홈 실제 화면: `src/app/student/home/page.tsx`
- `/student`: `src/app/student/page.tsx`에서 `/student/home#today`로 redirect
- 숙제 상세/진행: `src/app/student/assignments/[assignmentId]/page.tsx`
- 숙제 완료: `src/app/student/assignments/[assignmentId]/complete/page.tsx`
- 숙제 카드 클릭: `src/app/student/home/HomeworkActionButton.tsx`
- 학생 홈 hash/뒤로가기 보정: `src/app/student/home/StudentHomeHashNavigation.tsx`

## 현재 미커밋 변경 요약

현재 작업 끝 상태에서 `git status --short` 기준 미커밋 변경은 아래 2개 파일이다.

- `src/app/student/home/HomeworkActionButton.tsx`
- `src/app/student/home/StudentHomeHashNavigation.tsx`

단, 아래 섹션에는 이전 단계에서 이미 반영된 관련 변경도 함께 설명한다.

## 학생 홈 hash navigation

파일: `src/app/student/home/StudentHomeHashNavigation.tsx`

역할:

1. `/student/home`에 hash 없이 들어오면 `replaceState`로 `/student/home#today`로 정리한다.
2. `#today`, `#weekly-homework`에 맞춰 `scrollIntoView`를 실행한다.
3. `hashchange`, `popstate`를 감지한다.
4. 로그인 상태 학생이 학생 모드 밖으로 나가려 하면 `/student/home#today`로 복구한다.
5. `/student/home#weekly-homework`로 직접 유입된 경우에도 `#today → #weekly-homework` 순서의 내부 히스토리를 만든다.

현재 핵심 로직:

```ts
if (window.location.pathname === STUDENT_HOME_PATH && !window.location.hash) {
  window.history.replaceState(window.history.state, "", `${STUDENT_HOME_PATH}${TODAY_HASH}`);
}
```

```ts
if (isStudentAuthenticated() && !window.location.pathname.startsWith("/student")) {
  pushHomeBoundary();
  router.replace(`${STUDENT_HOME_PATH}${TODAY_HASH}`, { scroll: false });
  return;
}
```

`pushState`만 쓰면 URL은 바뀌어도 Next.js App Router 내부 상태가 `/` 렌더로 넘어갈 가능성이 있어 `router.replace("/student/home#today", { scroll: false })`를 함께 호출하도록 보완했다.

`scroll: false`를 둔 이유는 hash scroll은 이 컴포넌트의 `scrollIntoView` 로직에서 처리하기 때문이다.

## 학생 홈 boundary 정책

학생이 로그인 상태이고 `/student/home#today`에 있으면 학생 모드의 시작점으로 본다.

브라우저 뒤로가기로 `/` 또는 `/login` 등 학생 모드 밖으로 나가려 하면 다시 `/student/home#today`로 복구한다.

로그아웃 상태에서는 이 guard가 동작하면 안 된다. 현재 guard는 `homework_role=student` 쿠키를 확인한다.

```ts
function isStudentAuthenticated() {
  return getCookie("homework_role") === "student";
}
```

로그아웃 시 `homework_role` 쿠키가 삭제되므로 guard가 작동하지 않는다.

## 카카오톡/외부 링크로 학생 홈 유입

카카오톡 채팅방에서 학생 홈 링크로 들어오는 경우를 보완했다.

### `/student/home`

hash가 없으므로 `/student/home#today`로 `replaceState` 처리된다.

### `/student/home#today`

학생 홈 시작 boundary가 만들어진다. 뒤로가기를 반복해도 로그인 상태면 `/student/home#today`에 머무른다.

### `/student/home#weekly-homework`

이전 히스토리에 `#today`가 없을 수 있으므로 `StudentHomeHashNavigation.tsx`에서 아래 순서를 만든다.

```text
외부 앱 또는 이전 페이지
→ /student/home#today
→ /student/home#weekly-homework
```

관련 함수:

```ts
function ensureWeeklyHomeworkHasTodayFallback() {
  if (!isStudentAuthenticated()) return;
  if (window.location.pathname !== STUDENT_HOME_PATH || window.location.hash !== "#weekly-homework") return;

  const state = historyState();
  if (state[HOMEWORK_LIST_BOUNDARY_STATE_KEY] === true) return;

  window.history.replaceState({ ...state, [HOME_BOUNDARY_STATE_KEY]: true }, "", `${STUDENT_HOME_PATH}${TODAY_HASH}`);
  window.history.pushState({ [HOMEWORK_LIST_BOUNDARY_STATE_KEY]: true }, "", `${STUDENT_HOME_PATH}#weekly-homework`);
}
```

이렇게 하면 카카오톡에서 weekly 섹션으로 바로 들어와 숙제 카드를 눌러도 뒤로가기 흐름은 아래와 같다.

```text
/student/assignments/[assignmentId]
→ /student/home#weekly-homework
→ /student/home#today
→ /student/home#today 유지
```

## 숙제 카드 클릭 히스토리

파일: `src/app/student/home/HomeworkActionButton.tsx`

숙제 카드 클릭 시 상세 페이지로 이동하기 전에 `/student/home#weekly-homework`를 히스토리에 남긴다.

```ts
if (window.location.pathname === "/student/home" && currentUrl !== HOMEWORK_SECTION_URL) {
  window.history.pushState({ [HOMEWORK_LIST_BOUNDARY_STATE_KEY]: true }, "", HOMEWORK_SECTION_URL);
}
router.push(href);
```

기대 흐름:

```text
/student/home#today
→ /student/home#weekly-homework
→ /student/assignments/[assignmentId]
```

이미 `/student/home#weekly-homework`에 있을 때 숙제 카드를 누르면 `currentUrl !== HOMEWORK_SECTION_URL` 조건 때문에 같은 weekly entry를 과하게 중복 push하지 않는다.

## 숙제 상세 직접 유입 정책

대화 중 상세 직접 유입 대응용 client boundary를 잠깐 추가했다가, 사용자가 "숙제 상세 직접 유입은 없을 것"이라고 정정하여 제거했다.

현재 최종 상태:

- `src/app/student/assignments/[assignmentId]/StudentAssignmentHistoryBoundary.tsx` 없음
- `HomeworkActionButton.tsx`에 `sessionStorage` marker 없음
- 숙제 상세 직접 링크(`/student/assignments/[assignmentId]`)를 외부 앱에서 바로 열면 별도 fallback boundary는 만들지 않는다.

남은 리스크:

카카오톡 등 외부 앱에서 숙제 상세 URL을 직접 열면 이전 히스토리에 `/student/home#weekly-homework`가 없을 수 있다. 이 경우 뒤로가기가 외부 앱/이전 페이지로 갈 수 있다.

현재 요구상 상세 직접 유입은 제외된 상태다.

## 숙제 제출 완료 후 이동

제출 성공 후 각 숙제 컴포넌트는 `/student/assignments/${assignment.id}/complete`로 `router.replace(...)` 이동한다.

확인된 유형:

- `ListeningHomework.tsx`
- `PhotoSubmissionHomework.tsx`
- `WritingHomework.tsx`
- `VocabularyExampleHomework.tsx`
- `VocabularyRecordingHomework.tsx`
- `RlRecordingHomework.tsx`
- `MultiPartHomework.tsx`
- `QuizPartPlayer.tsx`

`replace`를 유지한 이유:

완료 페이지에서 브라우저 뒤로가기를 눌렀을 때 제출 직전 입력 화면으로 돌아가지 않게 하기 위해서다.

완료 페이지의 "과제 목록으로" 버튼은 `/student/home#weekly-homework`로 이동하도록 변경되어 있다.

파일:

- `src/app/student/assignments/[assignmentId]/complete/page.tsx`

## 학생 로그인 목적지 통일

학생 로그인 성공 및 이미 로그인 상태 redirect 목적지를 `/student/home#today`로 통일했다.

관련 파일:

- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/student-login/route.ts`
- `src/app/login/LoginForm.tsx`
- `src/app/login/page.tsx`
- `src/app/page.tsx`
- `src/app/student/page.tsx`
- `src/lib/auth/session.ts`
- `src/proxy.ts`

`LoginForm.tsx`는 로그인 성공 시 `window.location.replace(data.destination ?? "/login")`를 사용한다. 따라서 로그인 페이지 자체는 브라우저 히스토리에서 교체된다.

학생 destination은 `/student/home#today`다.

## 세션 없는 학생 보호 라우트

로그아웃 상태에서 학생 페이지 접근 시 `/`로 redirect되도록 변경했다.

대상:

- `src/proxy.ts`
- `src/app/student/home/page.tsx`
- `src/app/student/assignments/[assignmentId]/page.tsx`
- `src/app/student/assignments/[assignmentId]/complete/page.tsx`
- `src/lib/auth/actions.ts`

로그아웃 action:

```ts
export async function logoutAction() {
  await destroySession();
  redirect("/");
}
```

## 퀴즈 반려 후 재제출 문제

문제:

퀴즈는 한 번 제출하면 재제출을 막아야 하지만, 강사가 반려(`returned`)한 경우에는 다시 제출이 가능해야 했다. 화면에서는 반려로 보이지만 제출 API에서 계속 막히는 문제가 있었다.

원인:

학생 화면은 `submissions.status = 'returned'`를 보고 반려로 계산한다.

반면 최종 제출 API는 `assignment_targets.status`만 `target_status`로 가져오고 있었다.

`assignment_targets.status`는 DB constraint상 `returned`를 가질 수 없다.

```sql
check (status in ('assigned', 'submitted', 'late', 'excused', 'cancelled'))
```

따라서 반려 상태가 `submissions.status = returned`에 있어도 API는 이를 알지 못했다.

수정:

파일:

- `src/app/api/student/assignments/[assignmentId]/draft/submit/route.ts`

`target_status` 계산을 학생 화면과 같은 기준으로 변경했다.

```sql
case
  when sub.status in ('reviewed', 'returned') then sub.status
  when at.status in ('submitted', 'late') then at.status
  else coalesce(sub.status, at.status)
end as target_status
```

이제 퀴즈도 `submissions.status = returned`이면 재제출 차단 조건을 통과한다.

## 전역 guard는 사용하지 않음

아래는 사용하지 않았다.

- `TeacherLayout`의 `BackNavigationGuard`를 학생 모드에 적용하지 않음
- 전역 `popstate` 방어 로직 추가하지 않음
- 학생 레이아웃 전체에 뒤로가기 trap을 걸지 않음

현재 guard는 학생 홈의 `StudentHomeHashNavigation.tsx`에만 있다.

## 기대 테스트 흐름

### A. 일반 로그인 후 학생 홈

```text
학생 로그인
→ /student/home#today
→ 뒤로가기
→ /student/home#today 유지
```

### B. 일반 숙제 상세 흐름

```text
/student/home#today
→ 숙제 카드 클릭
→ /student/home#weekly-homework
→ /student/assignments/[assignmentId]
→ 뒤로가기
→ /student/home#weekly-homework
→ 뒤로가기
→ /student/home#today
→ 뒤로가기 반복
→ /student/home#today 유지
```

### C. 카카오톡에서 학생 홈 링크 진입

```text
카카오톡
→ /student/home 또는 /student/home#today
→ /student/home#today
→ 숙제 카드 클릭
→ /student/home#weekly-homework
→ /student/assignments/[assignmentId]
→ 뒤로가기
→ /student/home#weekly-homework
→ 뒤로가기
→ /student/home#today
→ 뒤로가기 반복
→ /student/home#today 유지
```

### D. 카카오톡에서 `/student/home#weekly-homework` 진입

```text
카카오톡
→ /student/home#weekly-homework
```

내부적으로 아래처럼 히스토리를 정리한다.

```text
/student/home#today
→ /student/home#weekly-homework
```

이후 숙제 클릭/뒤로가기는 일반 흐름과 같다.

### E. 로그아웃 후

```text
로그아웃
→ /
→ 뒤로가기 또는 학생 URL 직접 접근
→ 학생 화면 표시 안 됨
→ /
```

## 마지막 빌드 확인

마지막 확인 명령:

```text
npm.cmd run build
```

결과:

```text
Compiled successfully
Finished TypeScript
Generating static pages completed
```

빌드와 TypeScript 체크는 통과했다.
