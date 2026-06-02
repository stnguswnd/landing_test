# 2026-06-01 Quiz Assignment Update Notes

이 문서는 2026년 6월 1일에 반영한 퀴즈 숙제 기능 추가 작업을 정리한 문서입니다.

이번 업데이트의 핵심은 기존 숙제 구조를 무너뜨리지 않고, 이미 들어와 있는 `assignment_parts` 기반 멀티 Part 숙제 구조 위에 `quiz` Part 유형을 추가한 것입니다. 새 퀴즈 데이터의 source of truth는 `assignment_items`가 아니라 `assignment_parts`와 퀴즈 전용 테이블입니다.

## 요약

- Part 유형에 `quiz`를 추가했습니다.
- Quiz Part 하나는 문제 1개가 아니라 여러 문제를 담는 퀴즈 세트입니다.
- 한 숙제 안에 여러 Part를 둘 수 있고, 그중 하나 또는 여러 개가 Quiz Part일 수 있습니다.
- 단일 퀴즈 숙제도 내부적으로는 Part 1개짜리 숙제로 처리합니다.
- 퀴즈 문제, 선택지, 문제별 첨부, 학생 답안을 위한 DB 테이블을 추가했습니다.
- 퀴즈 선택지는 `A/B/C`가 아니라 `1/2/3` 숫자 라벨을 기본값으로 사용합니다.
- 기존 DB에 저장된 퀴즈 선택지 라벨도 숫자로 마이그레이션했습니다.
- 학생은 보기 선택 후 피드백을 즉시 볼 수 있습니다.
- 오답을 골라도 다른 보기를 다시 선택할 수 있습니다.
- 정답을 골라도 다른 보기로 바꿀 수 있습니다.
- 단, 현재 선택한 답이 정답일 때만 다음 문제 또는 제출로 넘어갈 수 있습니다.
- 오답을 눌렀을 때 즉시 정답을 노출하지 않습니다.
- 제출 완료 후 결과 화면에서는 정답/오답과 정답, 오답 이유를 확인할 수 있습니다.
- 문제 삭제 버튼을 누르면 바로 삭제하지 않고 확인 모달을 먼저 표시합니다.
- Part 삭제 버튼을 누르면 바로 삭제하지 않고 확인 모달을 먼저 표시합니다.
- 과제 첨부 파일 업로드 정책은 파일 1개당 10MB, 숙제 저장 요청 전체 100MB로 정리했습니다.
- 배정 취소 정책은 해당 학생의 배정, 제출 이력, 제출 첨부 파일까지 삭제하는 hard delete 방식으로 변경했습니다.
- 학생 관리의 제출 이력 삭제는 배정은 유지하고 제출 기록만 삭제하는 방식으로 정리했습니다.

## 변경 파일

### 새 파일

- `database/quiz_assignments.sql`
- `scripts/apply-quiz-assignments.mjs`
- `src/app/student/assignments/[assignmentId]/QuizHomework.tsx`
- `src/app/student/assignments/[assignmentId]/QuizPartPlayer.tsx`
- `docs/2026-06-01-quiz-assignment-update-notes.md`

### 수정 파일

- `package.json`
- `src/lib/assignmentTypes.ts`
- `src/types/assignment.ts`
- `src/types/submission.ts`
- `src/app/api/teacher/assignments/route.ts`
- `src/features/assignments/repositories/studentAssignmentRepository.ts`
- `src/app/api/student/assignments/[assignmentId]/draft/submit/route.ts`
- `src/app/student/assignments/[assignmentId]/page.tsx`
- `src/app/student/assignments/[assignmentId]/MultiPartHomework.tsx`
- `src/app/student/assignments/[assignmentId]/complete/page.tsx`
- `src/app/teacher/assignments/new/page.tsx`
- `src/app/teacher/assignments/[assignmentId]/preview/page.tsx`
- `src/server/teacher/submissionDetail.ts`
- `src/app/teacher/submissions/[submissionId]/SubmissionReviewPanel.tsx`
- `src/features/student-management/types/studentManagement.ts`
- `src/app/api/teacher/assignment-targets/cancel/route.ts`
- `src/app/api/teacher/students/[studentId]/history/route.ts`
- `next.config.ts`

## DB 변경

### 새 migration 파일

추가 파일:

```text
database/quiz_assignments.sql
```

이 migration은 재실행 가능하도록 작성했습니다.

사용한 패턴:

- `create table if not exists`
- `alter table ... add column if not exists`
- `create index if not exists`
- check constraint는 기존 constraint를 drop 후 recreate
- 기존 선택지 라벨은 숫자로 갱신

### apply script

추가 파일:

```text
scripts/apply-quiz-assignments.mjs
```

기존 apply script 패턴과 동일하게 `.env.local` 또는 `.env`에서 `DATABASE_URL`을 읽고 `database/quiz_assignments.sql`을 실행합니다.

`package.json`에는 아래 script를 추가했습니다.

```json
"apply:quiz-assignments": "node scripts/apply-quiz-assignments.mjs"
```

실제 DB에는 아래 명령으로 migration을 적용했습니다.

```bash
npm.cmd run apply:quiz-assignments
```

적용 결과:

```text
database/quiz_assignments.sql applied
```

### check constraint 확장

아래 check constraint에 `quiz`를 추가했습니다.

1. `assignments.assignment_type`
2. `assignment_parts.part_type`
3. `assignment_items.item_type`

`assignment_items.item_type`에는 legacy/fallback 호환을 위해 `quiz_prompt`를 추가했습니다. 단, 새 퀴즈 데이터의 기준은 `assignment_items`가 아니라 `assignment_parts`와 퀴즈 전용 테이블입니다.

### 새 테이블

#### `assignment_quiz_questions`

역할:

- Quiz Part 안의 문제 목록입니다.
- 한 `assignment_part_id`에 여러 문제가 들어갈 수 있습니다.

주요 컬럼:

- `id`
- `assignment_part_id`
- `question_text`
- `explanation`
- `order_index`
- `created_at`
- `updated_at`

#### `assignment_quiz_choices`

역할:

- 각 문제의 선택지 목록입니다.
- 문제 하나당 선택지는 여러 개입니다.
- 문제당 정답은 1개입니다.

주요 컬럼:

- `id`
- `question_id`
- `choice_label`
- `choice_text`
- `is_correct`
- `incorrect_reason`
- `order_index`
- `created_at`
- `updated_at`

중요 정책:

- `choice_label` 기본값은 `1`, `2`, `3` 형식입니다.
- 기존 `A`, `B`, `C` 라벨도 migration에서 `order_index + 1` 기준으로 숫자 라벨로 바꿨습니다.
- `incorrect_reason`은 오답 선택지를 눌렀을 때 보여줄 피드백입니다.
- 정답 선택지의 `incorrect_reason`은 비워도 됩니다.

#### `assignment_quiz_question_attachments`

역할:

- 문제별 이미지/오디오 첨부를 저장합니다.
- 기존 `assignment_part_attachments`는 Part 전체 첨부용이고, 퀴즈에서는 문제마다 다른 이미지/오디오가 필요하므로 별도 테이블을 사용합니다.

주요 컬럼:

- `id`
- `question_id`
- `attachment_type`
- `storage_bucket`
- `storage_path`
- `file_url`
- `file_name`
- `mime_type`
- `file_size_bytes`
- `duration_sec`
- `width_px`
- `height_px`
- `order_index`

#### `submission_quiz_answers`

역할:

- 학생이 각 문제에서 선택한 답을 저장합니다.
- 정오답은 서버에서 다시 계산해 저장합니다.

주요 컬럼:

- `id`
- `submission_id`
- `submission_item_id`
- `assignment_part_id`
- `question_id`
- `selected_choice_id`
- `answer_text`
- `is_correct`
- `answered_at`
- `created_at`
- `updated_at`

중요 정책:

- `unique (submission_id, question_id)`로 같은 제출에서 같은 문제 답안 중복 저장을 막습니다.
- 클라이언트가 보낸 정오답은 신뢰하지 않습니다.
- 최종 제출 시 서버가 `assignment_quiz_choices.is_correct`를 조회해 `submission_quiz_answers.is_correct`를 계산합니다.

## DB migration 적용 중 확인된 오류

퀴즈 숙제를 저장할 때 다음 오류가 발생했습니다.

```text
HTTP 500
과제 저장 중 오류가 발생했습니다: new row for relation "assignment_parts" violates check constraint "assignment_parts_part_type_check"
code: 23514
constraint: assignment_parts_part_type_check
table: assignment_parts
```

원인:

- 실제 DB의 `assignment_parts_part_type_check`에 아직 `quiz`가 포함되지 않았습니다.
- 코드에서는 `part_type = 'quiz'`를 저장하려고 했지만 DB constraint가 막았습니다.

조치:

```bash
npm.cmd run apply:quiz-assignments
```

적용 후 `quiz` Part 저장이 가능해졌습니다.

## 타입 변경

### `src/lib/assignmentTypes.ts`

추가/변경:

- `AssignmentType`에 `quiz` 추가
- `AssignmentItemType`에 `quiz_prompt` 추가
- `SUPPORTED_ASSIGNMENT_TYPES`에 `quiz` 추가
- `assignmentTypeLabel("quiz")`는 `퀴즈`
- `itemTypeForAssignmentType("quiz")`는 `quiz_prompt`
- `normalizeAssignmentItemType`에서 `quiz_prompt` 허용

### `src/types/assignment.ts`

추가/변경:

- `AssignmentPart.partType`에 `quiz` 추가
- `AssignmentPart.quizQuestions?: QuizQuestion[]` 추가
- `AssignmentSubmissionPart.quizAnswers?: SubmissionQuizAnswer[]` 추가
- `QuizQuestion` 타입 추가
- `QuizChoice` 타입 추가
- `QuizQuestionAttachment` 타입 추가
- `SubmissionQuizAnswer` 타입 추가

### `src/types/submission.ts`

추가:

- `SubmissionQuizAnswer` 타입
- `Submission.quizAnswers?: SubmissionQuizAnswer[]`

### `src/features/student-management/types/studentManagement.ts`

변경:

- 학생 관리/학습 이력 쪽 assignment type union에 `quiz` 추가

## 강사 과제 저장 API 변경

파일:

```text
src/app/api/teacher/assignments/route.ts
```

### 저장 payload

Part JSON 안에 `quizQuestions` 배열을 받을 수 있게 했습니다.

예시:

```json
{
  "partType": "quiz",
  "title": "Phonics Quiz",
  "instruction": "알맞은 알파벳을 골라 빈칸을 채우세요.",
  "quizQuestions": [
    {
      "questionText": "_pple 안에 들어갈 알파벳을 고르시오.",
      "explanation": "apple은 a로 시작합니다.",
      "choices": [
        {
          "choiceLabel": "1",
          "choiceText": "a",
          "isCorrect": true,
          "incorrectReason": ""
        },
        {
          "choiceLabel": "2",
          "choiceText": "b",
          "isCorrect": false,
          "incorrectReason": "apple은 b로 시작하지 않아요."
        }
      ]
    }
  ]
}
```

### 저장 로직

추가 함수:

- `parseQuizQuestions`
- `parseQuizQuestionFiles`
- `syncQuizQuestions`
- `replaceQuizQuestionAttachments`

저장 흐름:

1. 기존 과제 기본 정보 저장
2. legacy/fallback용 `assignment_items` 1개 유지
3. `assignment_parts` 저장
4. `assignment_vocabulary_items` 저장
5. `assignment_part_attachments` 저장
6. Quiz Part인 경우:
   - `assignment_quiz_questions` 저장
   - `assignment_quiz_choices` 저장
   - `assignment_quiz_question_attachments` 저장

### validation

Quiz Part 저장 전 서버에서 아래를 검사합니다.

- 퀴즈 문제는 최소 1개 이상
- 각 문제의 선택지는 최소 2개 이상
- 각 문제의 정답은 정확히 1개
- 문제 문장 필수
- 선택지 내용 필수

### 오류 응답 개선

기존에는 저장 트랜잭션 내부 오류가 모두 아래처럼 뭉개졌습니다.

```text
과제 저장 중 오류가 발생했습니다.
```

이번 업데이트에서 DB 오류 상세를 응답에 포함하도록 바꿨습니다.

응답에 포함되는 정보:

- `error`
- `code`
- `detail`
- `hint`
- `constraint`
- `table`
- `column`

예시:

```text
HTTP 500
과제 저장 중 오류가 발생했습니다: ...
code: 23514
constraint: assignment_parts_part_type_check
table: assignment_parts
```

### 업로드 용량 정책

파일 업로드 정책을 아래처럼 정리했습니다.

```text
파일 1개당 최대 용량: 10MB
숙제 저장 요청 전체 최대 용량: 100MB
```

적용 위치:

- `src/app/teacher/assignments/new/page.tsx`
- `src/app/api/teacher/assignments/route.ts`
- `next.config.ts`

클라이언트 사전 검증:

- 이미지 1개가 10MB를 넘으면 저장 전에 막습니다.
- 오디오 1개가 10MB를 넘으면 저장 전에 막습니다.
- 한 숙제 저장 요청에 포함된 첨부 파일 합계가 100MB를 넘으면 저장 전에 막습니다.

서버 검증:

- API에서도 이미지/오디오 파일 1개당 10MB 제한을 다시 검사합니다.
- 클라이언트 검증을 우회해도 서버에서 막힙니다.

Next proxy 설정:

```ts
experimental: {
  proxyClientMaxBodySize: "100mb",
}
```

이 설정을 추가한 이유:

- 이 repo는 `src/proxy.ts`를 사용합니다.
- proxy가 있는 경우 요청 body 크기 제한이 먼저 걸릴 수 있습니다.
- 실제 저장 API에 도달하기 전에 `HTTP 413`이 날 수 있어서 proxy 요청 한도를 100MB로 올렸습니다.

413 오류 표시도 개선했습니다.

기존에는 아래처럼 원인이 모호했습니다.

```text
숙제를 저장하지 못했습니다
HTTP 413
```

변경 후에는 아래처럼 안내합니다.

```text
첨부 파일 용량이 서버에서 허용하는 요청 크기를 초과했습니다.
한 번에 저장 가능한 첨부 파일 합계는 약 100MB 이하로 맞춰주세요.
이미지나 오디오를 압축하거나 파일 개수를 줄인 뒤 다시 저장해주세요.
HTTP 413
```

## 강사 과제 조회 API 변경

파일:

```text
src/app/api/teacher/assignments/route.ts
```

숙제 상세 조회 시 `assignment_parts` 안에 아래 데이터를 포함합니다.

- `quizQuestions`
- 각 question의 `choices`
- 각 question의 `attachments`

정렬 기준:

- 문제: `assignment_quiz_questions.order_index`
- 선택지: `assignment_quiz_choices.order_index`
- 첨부: `attachment_type`, `order_index`

## 학생 숙제 조회 변경

파일:

```text
src/features/assignments/repositories/studentAssignmentRepository.ts
```

학생 숙제 조회 시 Quiz Part에 아래 데이터를 포함합니다.

- `quizQuestions`
- `choices`
- `question attachments`
- 제출된 `quizAnswers`

학생 제출 완료/이력 화면에서 사용할 수 있도록 `submissionParts.quizAnswers`도 매핑합니다.

## 학생 제출 저장 변경

파일:

```text
src/app/api/student/assignments/[assignmentId]/draft/submit/route.ts
```

멀티 Part 제출 최종화 시 Quiz Part 답안을 저장하도록 확장했습니다.

저장 흐름:

1. `student_assignment_drafts.draft_data`에서 `quizAnswers`를 읽습니다.
2. 각 `questionId -> selectedChoiceId`를 순회합니다.
3. 서버가 `assignment_quiz_choices`를 조회합니다.
4. 선택지가 해당 question과 part에 속하는지 확인합니다.
5. `choice_text`와 `is_correct`를 서버 기준으로 가져옵니다.
6. `submission_quiz_answers`에 저장합니다.

중요:

- 클라이언트의 정오답 값은 저장하지 않습니다.
- 서버가 `assignment_quiz_choices.is_correct`를 기준으로 계산합니다.
- 기존 제출 재저장 시 해당 submission의 기존 quiz answers를 삭제 후 다시 저장합니다.

## 강사 UI 변경

파일:

```text
src/app/teacher/assignments/new/page.tsx
```

### Part 유형에 퀴즈 추가

`파트 유형` 선택지에 `퀴즈`를 추가했습니다.

### Quiz Part UI

Quiz Part에서 표시하는 항목:

- 파트 제목
- 파트 유형
- 퀴즈 안내
- 퀴즈 문제 목록
- 문제 추가 버튼
- 문제 삭제 버튼
- 문제 문장
- 정답 설명
- 문제 이미지
- 문제 오디오
- 선택지 목록
- 선택지 추가 버튼
- 정답 radio
- 선택지 라벨
- 선택지 내용
- 오답 이유
- 선택지 삭제 버튼

### 삭제 확인 모달

강사 숙제 생성/수정 화면에서 실수로 삭제되는 것을 막기 위해 확인 모달을 추가했습니다.

#### Part 삭제

Part의 `삭제` 버튼을 누르면 바로 삭제하지 않고 아래 모달을 표시합니다.

```text
Part를 삭제하시겠습니까?
```

확인 시 화면에서 Part가 제거됩니다. 저장 전까지는 DB에 반영되지 않습니다.

#### 퀴즈 문제 삭제

Quiz Part 안의 `문제 삭제` 버튼도 바로 삭제하지 않고 아래 모달을 표시합니다.

```text
문제를 삭제하시겠습니까?
```

모달에는 어느 Part의 몇 번 문제를 삭제하는지 표시합니다.

예:

```text
Phonics Quiz의 Q2 문제를 삭제합니다. 저장 전까지는 화면에서만 삭제된 상태입니다.
```

### Quiz Part에서 숨긴 항목

기존 Part 공통 폼에서 Quiz Part에 맞지 않는 항목은 숨겼습니다.

숨긴 항목:

- 퀴즈 보조 설명
- 파트 공통 이미지
- 파트 공통 오디오
- 필수 파트
- 최소 제출 수
- 최대 제출 수

이유:

- 퀴즈의 실제 콘텐츠는 문제 단위입니다.
- 이미지/오디오는 Part 공통이 아니라 문제별 첨부가 source of truth입니다.
- 퀴즈 Part 완료 조건은 제출 수가 아니라 문제별 정답 선택입니다.

### 선택지 라벨 정책

기존:

```text
A, B, C
```

변경 후:

```text
1, 2, 3
```

새 선택지 생성, 선택지 삭제 후 재정렬, 저장 payload 모두 숫자 라벨을 사용하도록 수정했습니다.

## 강사 미리보기 변경

파일:

```text
src/app/teacher/assignments/[assignmentId]/preview/page.tsx
```

Quiz Part 미리보기를 추가했습니다.

표시 내용:

- Part 번호
- Part 유형: 퀴즈
- 문제 탭
- 현재 문제 번호
- 문제 문장
- 문제 이미지
- 문제 오디오
- 선택지 버튼
- 정답/오답 피드백
- 오답 이유
- 이전/다음 문제 버튼

미리보기 동작:

- 선택지는 항상 다시 선택할 수 있습니다.
- 현재 선택한 답이 정답일 때만 다음 문제로 넘어갈 수 있습니다.
- 오답을 눌렀을 때 정답을 바로 보여주지 않습니다.
- 정답을 눌렀다가 다시 오답으로 바꾸면 다음 문제로 넘어갈 수 없습니다.

## 학생 UI 변경

### 새 컴포넌트

추가 파일:

```text
src/app/student/assignments/[assignmentId]/QuizHomework.tsx
src/app/student/assignments/[assignmentId]/QuizPartPlayer.tsx
```

역할:

- `QuizHomework`: 단일 Quiz Part 숙제용 wrapper
- `QuizPartPlayer`: 실제 퀴즈 풀이 UI

`QuizPartPlayer`는 단일 퀴즈 숙제와 멀티 Part 안의 Quiz Part에서 모두 재사용합니다.

### 학생 화면 진입 분기

파일:

```text
src/app/student/assignments/[assignmentId]/page.tsx
```

분기:

1. active part가 2개 이상이면 `MultiPartHomework`
2. active part가 1개이고 `partType === "quiz"`이면 `QuizHomework`
3. 나머지는 기존 `HomeworkByType`

### 멀티 Part 안의 Quiz Part

파일:

```text
src/app/student/assignments/[assignmentId]/MultiPartHomework.tsx
```

변경:

- `partType === "quiz"`이면 `QuizPartPlayer`를 렌더링합니다.
- 기존 recording/listening/writing/vocabulary/photo 흐름은 유지했습니다.

### 학생 Quiz UI 동작

현재 동작:

- 문제별로 이미지/오디오를 볼 수 있습니다.
- 오디오는 자동 재생하지 않습니다.
- 학생이 직접 눌러 반복 재생할 수 있습니다.
- 선택지를 누르면 즉시 피드백을 보여줍니다.
- 오답이면 오답 이유를 보여줍니다.
- 오답을 골라도 다른 보기 선택이 가능합니다.
- 정답을 골라도 다른 보기 선택이 가능합니다.
- 현재 선택한 답이 정답일 때만 다음 문제 또는 제출 버튼이 활성화됩니다.
- 정답을 골랐다가 오답으로 바꾸면 다음/제출이 다시 비활성화됩니다.
- 오답 선택 직후 정답을 바로 노출하지 않습니다.

### 학생 draft 저장

학생이 선택지를 누를 때마다 draft에 저장합니다.

저장 형태:

```json
{
  "partType": "quiz",
  "quizAnswers": {
    "quiz-question-1": "quiz-choice-1",
    "quiz-question-2": "quiz-choice-5"
  },
  "savedAt": "..."
}
```

저장 API:

```text
POST /api/student/assignments/[assignmentId]/draft
```

## 학생 제출 완료 화면 변경

파일:

```text
src/app/student/assignments/[assignmentId]/complete/page.tsx
```

Quiz 결과 표시를 추가했습니다.

표시 내용:

- 총 문제 수
- 정답 수
- 문제별 결과
- 문제 문장
- 내 답
- 정답 여부
- 오답인 경우 정답
- 오답 이유

중요:

- 풀이 중에는 오답 선택 시 정답을 바로 보여주지 않습니다.
- 제출 완료 후 결과 화면에서는 정답을 보여줍니다.

## 강사 제출 상세 화면 변경

### 서버 조회

파일:

```text
src/server/teacher/submissionDetail.ts
```

`submission_quiz_answers`를 조회해 강사 제출 상세 데이터에 포함합니다.

포함 데이터:

- question id
- question text
- selected choice
- correct choice
- incorrect reason
- is correct

### UI

파일:

```text
src/app/teacher/submissions/[submissionId]/SubmissionReviewPanel.tsx
```

Quiz Part 결과 표시를 추가했습니다.

표시 내용:

- Part별 퀴즈 결과
- 정답 수 / 전체 문제 수
- 문제별 학생 답
- 정답 여부
- 오답인 경우 정답
- 오답 이유

## 배정 취소 / 제출 이력 삭제 정책 변경

이번 작업 중 삭제 정책을 아래처럼 정리했습니다.

### 1. 배정 취소

파일:

```text
src/app/api/teacher/assignment-targets/cancel/route.ts
```

배정 취소는 이제 `assignment_targets.status = 'cancelled'`로 남기지 않고 hard delete합니다.

즉, 강사가 특정 학생의 배정을 취소하면 해당 학생에게 그 숙제가 배정되지 않았던 것처럼 정리됩니다.

삭제 대상:

- `assignment_targets`
- `submissions`
- `submission_items`
- `submission_item_attachments`
- `submission_vocabulary_items`
- `submission_quiz_answers`
- `teacher_feedback`
- `student_ai_feedback_attempts`
- `student_assignment_drafts`
- `student_assignment_draft_attachments`

Storage에서도 같이 삭제하는 파일:

- 학생 제출 사진
- 학생 제출 녹음 파일
- 학생 임시저장 첨부 파일

응답에는 기존 UI 호환을 위해 `cancelledCount`를 유지하고, 실제 삭제 개수도 함께 내려줍니다.

```json
{
  "cancelledCount": 1,
  "deletedTargetCount": 1,
  "deletedSubmissionCount": 1,
  "deletedStorageObjectCount": 2
}
```

정책 의미:

- 배정 취소는 “이 학생에게 이 숙제를 더 이상 배정하지 않음”입니다.
- 제출 이력과 제출 파일도 함께 제거합니다.
- 취소 이력을 DB에 남기지는 않습니다.

### 2. 학생 관리의 제출 이력 삭제

파일:

```text
src/app/api/teacher/students/[studentId]/history/route.ts
```

학생 관리에서 개별 제출 이력을 삭제하는 기능은 배정 취소와 다릅니다.

정책:

- 제출 기록만 삭제합니다.
- 배정 자체는 유지합니다.
- 학생에게는 해당 숙제가 다시 미제출 상태로 남습니다.

삭제 대상:

- `submissions`
- `submission_items`
- `submission_item_attachments`
- `submission_vocabulary_items`
- `submission_quiz_answers`
- `teacher_feedback`
- `student_ai_feedback_attempts`
- `student_assignment_drafts`
- `student_assignment_draft_attachments`

Storage에서도 같이 삭제하는 파일:

- 해당 제출의 사진
- 해당 제출의 녹음 파일
- 해당 숙제/학생의 임시저장 첨부 파일

유지하는 것:

- `assignment_targets`

삭제 후 target 상태:

```text
assignment_targets.status = assigned
assignment_targets.submitted_at = null
assignment_targets.reviewed = false
assignment_targets.feedback = null
```

정책 의미:

- 제출만 지운 것이므로 숙제 배정은 그대로 남습니다.
- 학생 관리 화면에서는 해당 과제가 제출 완료가 아니라 미제출/늦음 상태로 보일 수 있습니다.

예:

```text
Jane - Alphabet Lesson 1-3 제출 이력 삭제
```

결과:

- Jane의 `Alphabet Lesson 1-3` 제출 row는 삭제됩니다.
- 관련 제출 상세와 파일도 삭제됩니다.
- 하지만 Jane에게 배정된 `Alphabet Lesson 1-3` target은 남습니다.
- 따라서 화면에는 이 숙제가 다시 미제출 상태로 보일 수 있습니다.

### 3. 두 삭제 기능의 차이

```text
배정 취소
= 배정 자체를 제거
= 제출 이력과 파일도 제거
= 학생에게 숙제가 더 이상 보이지 않는 방향

학생 관리 > 제출 이력 삭제
= 제출 기록만 제거
= 배정은 유지
= 학생에게 숙제가 미제출 상태로 다시 남는 방향
```

## 레거시 정리

파일:

```text
src/lib/assignmentTypes.ts
docs/2026-06-01-legacy-cleanup-plan.md
```

이번 작업에서 사용처가 없는 legacy 숙제 타입 판별 코드를 제거했습니다.

제거한 항목:

- `LEGACY_ASSIGNMENT_TYPES`
- `isLegacyAssignmentType`

다만 `assignment_items` 자체는 아직 삭제하지 않았습니다.

이유:

- 기존 단일 숙제 화면이 `assignment.items[0]`를 사용합니다.
- 기존 제출 API들이 `assignment_item_id` 기준으로 검증합니다.
- `assignment_items`를 바로 삭제하면 기존 리스닝, 녹음, 라이팅, 단어장, 사진 제출 흐름이 깨질 수 있습니다.

따라서 현재 정책은 아래와 같습니다.

```text
새 기능 기준: assignment_parts
기존 호환/fallback: assignment_items
```

자세한 정리 계획은 아래 문서에 따로 남겼습니다.

```text
docs/2026-06-01-legacy-cleanup-plan.md
```

## 퀴즈 선택지 정책 최종 상태

### 생성/편집

- 선택지 라벨은 기본적으로 `1`, `2`, `3`입니다.
- 강사가 직접 수정할 수는 있습니다.
- 선택지 삭제 후 남은 선택지는 숫자로 재정렬됩니다.

### 풀이 중

- 모든 선택지는 언제든 다시 누를 수 있습니다.
- 현재 선택한 답만 강조됩니다.
- 현재 선택이 오답이면 오답 스타일과 오답 이유를 보여줍니다.
- 현재 선택이 정답이면 정답 스타일과 정답 메시지를 보여줍니다.
- 현재 선택이 정답일 때만 다음/제출 버튼이 활성화됩니다.

### 제출 후

- 제출 결과 화면에서는 정답과 오답 이유를 보여줍니다.

## 검증

### build

아래 명령을 여러 차례 실행했고 통과했습니다.

```bash
npm.cmd run build
```

결과:

```text
Compiled successfully
Finished TypeScript
```

### encoding check

아래 명령도 실행했습니다.

```bash
npm.cmd run check:encoding
```

결과는 실패했습니다.

실패 원인은 이번 퀴즈 변경 파일이 아니라 기존 한글 문장 오탐으로 보입니다.

출력 예:

```text
docs\2026-05-31-homework-migration-notes.md:170
src\components\landing\points.tsx:28
src\components\landing\points.tsx:33
src\components\landing\points.tsx:38
```

## 적용 순서

새 환경 또는 DB 초기화 후에는 아래 순서로 적용하는 것이 좋습니다.

```bash
npm.cmd run apply:photo-submission
npm.cmd run apply:assignment-parts
npm.cmd run apply:assignment-drafts
npm.cmd run apply:ai-feedback-attempts
npm.cmd run apply:quiz-assignments
```

이미 앞 migration들이 적용된 DB라면 퀴즈 관련 적용은 아래만 실행해도 됩니다.

```bash
npm.cmd run apply:quiz-assignments
```

## 남아 있는 주의점

### `assignment_items`는 여전히 legacy/fallback

교사 과제 생성 API는 기존 흐름과 호환을 위해 `assignment_items`에 기본 item 1개를 유지합니다. 하지만 새 Quiz 데이터의 실제 기준은 다음입니다.

- `assignment_parts`
- `assignment_quiz_questions`
- `assignment_quiz_choices`
- `assignment_quiz_question_attachments`
- `submission_quiz_answers`

### 단일 Quiz와 멀티 Part Quiz는 같은 모델

단일 Quiz:

```text
assignments
  assignment_parts[0].part_type = quiz
```

멀티 Part Quiz:

```text
assignments
  assignment_parts[0].part_type = quiz
  assignment_parts[1].part_type = listening
  assignment_parts[2].part_type = recording
```

둘 다 같은 `QuizPartPlayer`를 사용합니다.

### 풀이 중 정답 비노출

요구사항에 따라 오답을 눌렀을 때 바로 정답은 보여주지 않습니다. 정답은 제출 완료 후 결과 화면과 강사 제출 상세에서 보여줍니다.

## 최종 상태

현재 repo 기준으로 퀴즈 숙제는 다음을 지원합니다.

- Quiz Part 생성
- Quiz Part 안에 여러 문제 추가
- 문제별 이미지 첨부
- 문제별 오디오 첨부
- 선택지 2개 이상
- 정답 1개 지정
- 오답 이유 입력
- 숫자 선택지 라벨
- 단일 Quiz 숙제
- 멀티 Part 안의 Quiz Part
- 학생 풀이 UI
- 학생 즉시 피드백
- 오답 후 재선택
- 정답 후 재선택
- 현재 선택이 정답일 때만 다음 이동
- 문제 삭제 확인 모달
- Part 삭제 확인 모달
- 파일 1개당 10MB 제한
- 숙제 저장 요청 전체 100MB 제한
- 413 용량 초과 오류 명확화
- 배정 취소 시 배정/제출/첨부 파일 hard delete
- 학생 관리 제출 이력 삭제 시 제출/첨부 파일 삭제 및 배정 유지
- draft 저장
- 최종 제출 저장
- 서버 정오답 계산
- 학생 제출 결과 표시
- 강사 제출 상세 표시
- 교사 미리보기
