# Assignment Type, Student UI, Submission Flow Alignment

작성일: 2026-06-05

## 1. 작업 목표

이번 작업의 목표는 `assignment_items` 제거가 아니며, `assignment_parts` 중심으로 전체 구조를 리팩터링하는 것도 아니다.

목표는 기존 DB 구조를 유지한 상태에서 숙제 유형, 학생 UI 렌더링, 제출 API가 서로 다른 기준을 사용하면서 발생할 수 있는 불일치를 최소 수정으로 해결하는 것이다.

특히 아래 문제를 방지하는 데 초점을 맞췄다.

- 단일 listening 과제가 listening_recording처럼 보이는 문제
- active part가 1개뿐인 단일 숙제가 MultiPartHomework로 렌더링되는 문제
- 학생 홈 카드와 학생 상세 화면의 숙제 유형 표시 기준이 다른 문제
- UI가 잘못 연결되더라도 서버가 잘못된 recording 제출을 받아들이는 문제
- `assignment_type`, `assignment_items.item_type`, `assignment_parts.part_type`의 우선순위가 파일마다 다르게 적용되는 문제

## 2. 명시적으로 하지 않은 것

이번 작업에서는 아래 항목을 건드리지 않았다.

- `assignment_items` 테이블 삭제
- `assignment_parts` 테이블 삭제
- `submission_items.assignment_item_id` 삭제
- 기존 제출 데이터 삭제
- 정상 과제의 `assignment_items` row 삭제
- 정상 과제의 `assignment_parts` row 삭제
- DB migration 추가
- 테이블 drop SQL 추가
- 전체 학생 제출 API 구조 변경
- 강사 생성/수정 API 대규모 리팩터링
- quiz/photo/writing/vocabulary 로직 대규모 리팩터링
- DB update/delete 실행

## 3. 기존 문제 구조

현재 숙제 유형은 세 위치에 저장된다.

- `assignments.assignment_type`
- `assignment_items.item_type`
- `assignment_parts.part_type`

기존 코드에서는 학생 상세 화면과 학생 홈 화면에 각각 `effectiveAssignmentType` 로직이 있었고, 이 로직은 단일 active part가 있을 때 `assignment_type`보다 `part_type`을 우선했다.

문제가 되는 흐름은 다음과 같았다.

```txt
assignment_type = listening
item_type = listening
part_type = recording
active_part_count = 1

기존 학생 상세:
activeParts.length > 0
→ MultiPartHomework
→ part_type = recording 기준
→ RlRecordingHomework
→ /api/student/submissions/recording 호출 가능
```

또한 기존 `effectiveAssignmentType`과 `MultiPartHomework` 내부 매핑에는 알 수 없는 part type 또는 명시되지 않은 타입이 recording 계열로 떨어지는 fallback이 있었다.

```ts
return "listening_recording";
```

이 fallback은 타입 판단 실패 시 recording UI를 표시할 수 있어 위험하다.

## 4. 확정한 도메인 규칙

### 4-1. 단일 숙제의 canonical type

단일 숙제의 대표 유형은 반드시 아래 값을 기준으로 한다.

```txt
assignments.assignment_type
```

학생 상세, 학생 홈 카드, 단일 제출 흐름은 이 값을 기준으로 판단한다.

예상 매핑:

| assignment_type | 학생 UI | 제출 API |
| --- | --- | --- |
| listening | ListeningHomework | /api/student/submissions/listening |
| listening_recording | RlRecordingHomework | /api/student/submissions/recording |
| writing | WritingHomework | /api/student/submissions/writing |
| photo_submission | PhotoSubmissionHomework | /api/student/submissions/photo |
| vocabulary_example | VocabularyExampleHomework | /api/student/submissions/vocabulary-example |
| vocabulary_recording | VocabularyRecordingHomework | recording 계열 API |
| quiz | QuizHomework | quiz 제출 흐름 |

### 4-2. 멀티파트 숙제 판단 기준

진짜 멀티파트 숙제는 active part가 2개 이상인 경우로 정의했다.

```txt
activeParts.length >= 2
```

따라서 active part가 0개 또는 1개이면 단일 숙제로 렌더링한다.

```txt
activeParts.length = 0 → 단일 숙제
activeParts.length = 1 → 단일 숙제
activeParts.length >= 2 → MultiPartHomework
```

### 4-3. 멀티파트 내부 part type

active part가 2개 이상인 진짜 멀티파트 숙제에서는 각 part의 UI를 `assignment_parts.part_type` 기준으로 렌더링한다.

part type 매핑:

| part_type | assignment type |
| --- | --- |
| listening | listening |
| recording | listening_recording |
| writing | writing |
| photo_submission | photo_submission |
| vocabulary_example | vocabulary_example |
| vocabulary_recording | vocabulary_recording |
| quiz | quiz |
| instruction | undefined |

`instruction`은 제출 UI로 매핑하지 않는다.

### 4-4. assignment_items.item_type의 역할

`assignment_items.item_type`은 유지한다.

역할은 다음과 같다.

- 기존 제출 API와 submission_items 연결을 위한 호환 데이터
- 단일 숙제에서 `assignments.assignment_type`과 일치해야 하는 검증 대상
- 서버 API에서 잘못된 제출을 방어하기 위한 보조 검증값

단일 숙제 UI의 최우선 기준은 `assignment_type`이며, `item_type`이 UI 타입을 덮어쓰지 않게 했다.

## 5. DB 정합성 점검 결과

### 5-1. Alphabet Lesson 정상 비교

아래 과제를 확인했다.

- `Alphabet Lesson 1-4`
- `Alphabet Lesson 1-5`
- `Alphabet Lesson 1-6`
- `Alphabet Lesson 1-7`

결과:

| 과제 | assignment_type | item_count | active_part_count | item_types | part_types |
| --- | --- | ---: | ---: | --- | --- |
| Alphabet Lesson 1-4 | listening_recording | 1 | 1 | listening_recording | recording |
| Alphabet Lesson 1-5 | listening | 1 | 1 | listening | listening |
| Alphabet Lesson 1-6 | listening_recording | 1 | 1 | listening_recording | recording |
| Alphabet Lesson 1-7 | listening | 1 | 1 | listening | listening |

현재 정상 과제 데이터는 `assignment_type`, `item_type`, `part_type`이 기대 매핑과 일치한다.

### 5-2. Phonics Worksheet 확인

추가 요청으로 아래 과제도 확인했다.

- `Phonics Worksheet 1-1`
- `Phonics Worksheet 1-2`
- `Phonics Worksheet 1-3`

결과:

| 과제 | assignment_type | status | item_count | active_part_count | active_target_count | submission_count | item_types | part_types |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Phonics Worksheet 1-1 | quiz | draft | 1 | 1 | 3 | 1 | quiz_prompt | quiz |
| Phonics Worksheet 1-2 | quiz | draft | 1 | 1 | 0 | 0 | quiz_prompt | quiz |
| Phonics Worksheet 1-3 | quiz | draft | 1 | 1 | 0 | 0 | quiz_prompt | quiz |

DB 타입 정합성 자체에는 문제가 없다.

다만 기존 코드에서는 active part가 1개라도 `MultiPartHomework`로 렌더링했기 때문에, `Phonics Worksheet 1-1 ~ 1-3`도 이번 수정의 영향을 받는 케이스였다.

수정 후에는 active part가 1개인 quiz 과제가 단일 숙제로 처리되어 `QuizHomework`로 렌더링된다.

### 5-3. orphan 확인

아래 orphan count를 확인했다.

| 항목 | count |
| --- | ---: |
| orphan_assignment_targets | 0 |
| orphan_submissions | 0 |
| orphan_submission_items | 0 |
| orphan_assignment_items | 0 |
| orphan_assignment_parts | 0 |

orphan 데이터는 발견되지 않았다.

### 5-4. 보정 SQL 필요 여부

현재 확인한 데이터 기준으로 DB 보정 SQL은 필요하지 않다.

이번 작업에서는 select만 실행했고 update/delete는 실행하지 않았다.

## 6. 변경 파일 상세

### 6-1. `src/features/assignments/assignmentType.ts`

새 공통 helper를 추가했다.

역할:

- 단일 숙제 canonical type 반환
- active parts 필터링
- 멀티파트 여부 판단
- 멀티파트 내부에서만 part type을 assignment type으로 매핑

주요 함수:

```ts
export function getCanonicalAssignmentType(assignment: AssignmentLike): AssignmentType {
  return assignment.assignmentType;
}
```

단일 숙제 대표 타입은 `assignment.assignmentType`이다.

```ts
export function isMultipartAssignment(assignment: AssignmentLike): boolean {
  return getActiveAssignmentParts(assignment.parts).length >= 2;
}
```

active part가 2개 이상일 때만 멀티파트로 본다.

```ts
export function assignmentTypeFromPartType(partType: AssignmentPart["partType"]): AssignmentType | undefined {
  if (partType === "listening") return "listening";
  if (partType === "recording") return "listening_recording";
  if (partType === "writing") return "writing";
  if (partType === "photo_submission") return "photo_submission";
  if (partType === "vocabulary_example") return "vocabulary_example";
  if (partType === "vocabulary_recording") return "vocabulary_recording";
  if (partType === "quiz") return "quiz";
  return undefined;
}
```

`recording → listening_recording` 매핑은 fallback이 아니라 멀티파트 내부의 명시 매핑이다.

`instruction` 또는 알 수 없는 part type은 `undefined`를 반환한다. recording UI로 fallback하지 않는다.

### 6-2. `src/app/student/assignments/[assignmentId]/page.tsx`

학생 숙제 상세 화면을 수정했다.

기존 문제:

```tsx
activeParts.length > 0
  ? <MultiPartHomework assignment={assignment} />
  : <HomeworkByType assignment={assignment} />
```

active part가 1개만 있어도 멀티파트로 처리되었다.

수정 후:

```tsx
{isMultipartAssignment(assignment)
  ? <MultiPartHomework assignment={assignment} />
  : <HomeworkByType assignment={assignment} />}
```

`isMultipartAssignment`는 active part 2개 이상일 때만 true다.

또한 `HomeworkByType`의 타입 결정 기준을 `getCanonicalAssignmentType(assignment)`로 통일했다.

기존에는 다음 기준이 섞여 있었다.

- active single part의 `partType`
- first item의 `itemType`
- 마지막 fallback으로 `assignmentType`

수정 후 단일 숙제는 `assignmentType`만 기준으로 렌더링한다.

quiz 단일 과제의 경우 `QuizHomework`가 part를 필요로 하므로 active quiz part를 찾아 넘긴다.

```tsx
if (assignmentType === "quiz") {
  const quizPart = activeParts.find((part) => part.partType === "quiz");
  return quizPart ? <QuizHomework assignment={{ ...assignment, assignmentType }} part={quizPart} /> : null;
}
```

### 6-3. `src/app/student/assignments/[assignmentId]/MultiPartHomework.tsx`

멀티파트 내부 타입 매핑을 정리했다.

기존 문제:

- `assignmentTypeForPart`
- `itemTypeForPart`

두 함수 모두 명시되지 않은 타입을 `listening_recording`으로 fallback했다.

수정 후:

- `assignmentTypeFromPartType(part.partType)` 사용
- `itemTypeForAssignmentType(assignmentType)` 사용
- 알 수 없는 part type은 `PartContent`만 표시하고 제출 UI로 매핑하지 않음

```tsx
const assignmentType = assignmentTypeFromPartType(part.partType);

if (!assignmentType) return <PartContent part={part} />;
```

이제 `instruction` 같은 part가 recording UI로 잘못 떨어지지 않는다.

### 6-4. `src/app/student/home/page.tsx`

학생 홈 카드의 숙제 유형 표시와 제출 상태 계산을 상세 화면과 같은 기준으로 맞췄다.

기존 문제:

- 홈에도 별도 `effectiveAssignmentType`이 있었다.
- 단일 active part가 있으면 `partType`이 `assignmentType`보다 우선될 수 있었다.
- active part가 하나라도 있으면 recording part 여부가 상태 계산에 영향을 줄 수 있었다.

수정 후:

- 단일 숙제 라벨은 `getCanonicalAssignmentType(assignment)` 기준
- 멀티파트 숙제 라벨만 part별 타입 기준
- recording 필요 여부도 `isMultipartAssignment(assignment)` 기준으로 분기

```ts
if (!isMultipartAssignment(assignment)) {
  return [assignmentTypeLabel(getCanonicalAssignmentType(assignment))];
}
```

```ts
const currentType = getCanonicalAssignmentType(assignment);
const currentRequiresRecording = isMultipartAssignment(assignment)
  ? hasRecordingPart
  : currentType === "listening_recording" || currentType === "vocabulary_recording";
```

### 6-5. `src/app/api/student/submissions/recording/route.ts`

recording 제출 API에 타입 방어를 추가했다.

기존 문제:

기존 query는 학생에게 배정된 과제이고 `assignmentItemId`가 해당 과제에 속하기만 하면 recording 제출을 받을 수 있었다.

즉 UI가 잘못 연결되어 listening 과제가 recording API로 제출되면 서버가 막지 못할 수 있었다.

수정 후:

query에서 `a.assignment_type`, `ai.item_type`을 함께 조회한다.

```sql
select
  at.id as target_id,
  at.assignment_id,
  ai.id as assignment_item_id,
  a.assignment_type,
  ai.item_type,
  sub.id as submission_id,
  coalesce(at.due_at, a.due_at) as due_at
```

그리고 두 값이 모두 recording 계열일 때만 허용한다.

```ts
const isRecordingAssignment = targetRow.assignment_type === "listening_recording" || targetRow.assignment_type === "vocabulary_recording";
const isRecordingItem = targetRow.item_type === "listening_recording" || targetRow.item_type === "vocabulary_recording";

if (!isRecordingAssignment || !isRecordingItem) {
  return NextResponse.json({ error: "녹음 제출 과제가 아닙니다." }, { status: 400 });
}
```

이 기준을 엄격하게 둔 이유:

- 단일 숙제 canonical type은 `assignment_type`이기 때문
- `item_type`만 recording이어도 `assignment_type`이 listening이면 데이터 불일치로 봐야 하기 때문
- UI 실수나 데이터 불일치가 있어도 listening 과제의 recording 제출을 서버에서 차단해야 하기 때문

## 7. 정리한 변경분

### 7-1. 삭제한 untracked 문서

아래 파일은 이전 작업에서 남아 있던 untracked 문서였고, 이번 기능 변경과 무관해서 삭제했다.

```txt
docs/2026-06-05-assignment-items-rollback-and-cleanup-notes.md
```

### 7-2. 빌드 생성 파일 원복

`npm run build` 실행 중 아래 파일이 자동 변경되었다.

- `next-env.d.ts`
- `tsconfig.tsbuildinfo`

두 파일은 이번 기능 변경과 무관하므로 원복했다.

현재 작업트리에는 이번 수정 대상 파일만 남아 있다.

## 8. 검증 결과

### 8-1. TypeScript

아래 명령을 실행했다.

```bash
npx tsc --noEmit
```

결과:

```txt
통과
```

캐시 파일 변경을 피하기 위해 아래 명령도 다시 실행했다.

```bash
npx tsc --noEmit --incremental false
```

결과:

```txt
통과
```

### 8-2. Build

아래 명령을 실행했다.

```bash
npm run build
```

첫 번째 실행은 샌드박스 환경에서 Turbopack이 내부 프로세스/포트 바인딩을 시도하다 실패했다.

오류 요약:

```txt
creating new process
binding to a port
Operation not permitted (os error 1)
```

이는 코드 오류가 아니라 샌드박스 제한으로 판단했다.

승인 모드에서 같은 명령을 다시 실행했다.

결과:

```txt
Compiled successfully
Finished TypeScript
Generating static pages 완료
build 통과
```

## 9. 현재 기대 동작

### 9-1. 정상 listening 과제

예:

- `Alphabet Lesson 1-5`
- `Alphabet Lesson 1-7`

기대:

- 학생 홈에서 listening/리스닝으로 표시
- 학생 상세에서 `ListeningHomework`
- recording UI 표시 안 함
- listening 제출 API 사용
- recording API 직접 호출 시 400 거부

### 9-2. 정상 listening_recording 과제

예:

- `Alphabet Lesson 1-4`
- `Alphabet Lesson 1-6`

기대:

- 학생 홈에서 listening_recording/듣고녹음하기로 표시
- 학생 상세에서 `RlRecordingHomework`
- recording API 제출 가능

### 9-3. Phonics Worksheet 1-1 ~ 1-3

DB 상태:

```txt
assignment_type = quiz
item_type = quiz_prompt
part_type = quiz
active_part_count = 1
```

기대:

- active part가 1개이므로 MultiPartHomework로 가지 않음
- 단일 quiz 숙제로 처리
- 학생 상세에서 `QuizHomework`

### 9-4. 불일치 재현 케이스

예상 케이스:

```txt
assignment_type = listening
item_type = listening
part_type = recording
active_part_count = 1
```

수정 후 기대:

- 학생 홈 라벨은 listening
- 학생 상세는 `ListeningHomework`
- `RlRecordingHomework`가 뜨지 않음
- recording API 직접 호출 시 400 거부

### 9-5. 진짜 멀티파트 케이스

예상 케이스:

```txt
active_part_count >= 2
part 1 = listening
part 2 = recording
part 3 = quiz
```

기대:

- `MultiPartHomework` 사용
- 각 part는 `partType` 기준으로 렌더링
- `recording` part는 멀티파트 내부에서만 `listening_recording` UI로 매핑

## 10. 남은 리스크와 후속 점검

### 10-1. `normalizeAssignmentType` fallback

`src/lib/assignmentTypes.ts`의 `normalizeAssignmentType`은 아직 알 수 없는 타입을 `listening_recording`으로 fallback한다.

이번 작업에서는 학생 상세/홈의 위험 분기에서 해당 fallback을 제거했지만, 다른 화면이나 API에서 여전히 사용할 수 있다.

후속으로 검토할 수 있는 방향:

- `normalizeAssignmentType`의 fallback을 더 안전한 값 또는 unsupported 처리로 변경
- 단, 영향 범위가 크므로 별도 작업으로 진행하는 것이 안전

### 10-2. 강사 생성/수정 API invariant

이번 작업에서는 강사 생성/수정 API를 대규모로 수정하지 않았다.

후속 점검 대상:

- 과제 생성 시 `assignment_type`, `assignment_items.item_type`, `assignment_parts.part_type` 매핑이 항상 일치하는지
- 과제 수정 시 type 변경 후 기존 partType이 stale 상태로 남지 않는지
- preview 화면이 학생 상세와 같은 canonical rule을 쓰는지

### 10-3. DB 제약조건

현재는 코드와 점검 SQL로 정합성을 관리한다.

추후 DB 제약조건이나 검증 쿼리를 추가할 수 있다.

다만 현재 구조는 레거시 호환이 필요하므로 DB constraint를 바로 강하게 거는 것은 위험할 수 있다.

### 10-4. 테스트 보강

현재 검증은 타입 체크, build, DB select 중심이다.

추후 추가하면 좋은 테스트:

- 단일 listening + part recording 불일치 mock에서 `ListeningHomework` 렌더링 확인
- active part 1개 quiz가 `QuizHomework`로 렌더링되는지 확인
- active part 2개 이상에서 `MultiPartHomework`가 사용되는지 확인
- listening 과제에 대해 recording API가 400을 반환하는지 확인

## 11. 최종 작업트리 변경 파일

현재 기능 변경으로 남은 파일:

```txt
src/features/assignments/assignmentType.ts
src/app/student/assignments/[assignmentId]/page.tsx
src/app/student/assignments/[assignmentId]/MultiPartHomework.tsx
src/app/student/home/page.tsx
src/app/api/student/submissions/recording/route.ts
docs/2026-06-05-assignment-type-ui-submission-alignment.md
```

## 12. 결론

이번 작업은 기존 데이터 구조를 유지하면서 타입 결정 규칙을 정리한 최소 수정이다.

핵심 변화는 다음이다.

```txt
단일 숙제:
assignment_type 기준

멀티파트 숙제:
active part 2개 이상일 때만 part_type 기준

recording 제출:
assignment_type과 item_type이 모두 recording 계열일 때만 허용
```

이 변경으로 listening 과제가 단일 part의 `part_type` 때문에 listening_recording처럼 보이거나 recording API로 제출되는 문제를 방지한다.

## 13. 추가 변경: 마감 지난 숙제 학생 화면 비노출

추가 요청으로 학생 화면에서 마감일이 지난 숙제가 아예 노출되지 않도록 처리했다.

### 13-1. 적용 기준

학생에게 보이는 과제 조회 조건에 아래 정책을 적용했다.

```txt
effective_due_at = coalesce(assignment_targets.due_at, assignments.due_at)

effective_due_at is null → 노출
effective_due_at >= now() → 노출
effective_due_at < now() → 비노출
```

`assignment_targets.due_at`이 있으면 학생별 마감일을 우선하고, 없으면 `assignments.due_at`을 사용한다.

### 13-2. 수정 파일

수정 파일:

```txt
src/features/assignments/repositories/studentAssignmentRepository.ts
src/app/api/student/assignments/route.ts
```

### 13-3. repository 조회 조건

`studentAssignmentRepository.getAssignmentsForStudent`의 where 조건에 아래 필터를 추가했다.

```sql
and (
  coalesce(at.due_at, a.due_at) is null
  or coalesce(at.due_at, a.due_at) >= now()
)
```

이 repository는 학생 홈과 학생 상세 페이지에서 사용된다.

결과:

- 학생 홈 목록에서 마감 지난 숙제 비노출
- 학생 상세 URL 직접 접근 시에도 `getAssignmentForStudent`가 찾지 못해 404 처리
- 완료 페이지도 같은 repository를 사용하므로 마감 지난 과제는 직접 접근 시 홈으로 redirect

### 13-4. API 조회 조건

`/api/student/assignments`에도 같은 필터를 추가했다.

```sql
and (
  coalesce(at.due_at, a.due_at) is null
  or coalesce(at.due_at, a.due_at) >= now()
)
```

서버 컴포넌트 화면과 API 응답이 서로 다르게 보이지 않도록 맞춘 것이다.

### 13-5. 주의점

이번 변경은 "학생 화면/학생 과제 목록 조회" 기준의 비노출 처리다.

제출 API 자체는 별도 엔드포인트에서 late 제출을 처리하는 기존 로직이 남아 있다.

추후 정말로 마감 후 제출도 서버에서 차단해야 한다면 아래 API들에도 별도 guard가 필요하다.

```txt
/api/student/submissions/listening
/api/student/submissions/recording
/api/student/submissions/writing
/api/student/submissions/photo
/api/student/submissions/vocabulary-example
/api/student/assignments/[assignmentId]/draft/submit
```

현재 요청은 "학생 화면에서 노출 안 되게"였기 때문에 조회 레이어에서 먼저 막았다.
