# 2026-06-01 레거시 정리 및 최적화 계획

## 현재 결론

현재 코드에서 `assignment_parts`가 새 숙제 구조의 기준이지만, `assignment_items`는 아직 완전히 삭제할 수 없다.

이유는 기존 단일 숙제 화면과 학생 제출 API가 여전히 `assignment.items[0]` 또는 `assignment_item_id`를 기준으로 동작하기 때문이다. 지금 `assignment_items`를 제거하면 기존 녹음, 리스닝, 라이팅, 단어장, 사진 제출 숙제 제출 흐름이 깨질 수 있다.

## 이번에 정리한 것

- 사용처가 없는 legacy 숙제 타입 판별 코드 제거
  - `LEGACY_ASSIGNMENT_TYPES`
  - `isLegacyAssignmentType`

## 아직 남아 있는 레거시 경로

### 1. `assignment_items`

현재 역할:

- 기존 단일 숙제 화면의 fallback 데이터
- 기존 학생 제출 API의 `assignment_item_id` 기준 검증
- 강사 미리보기와 일부 결과 화면의 fallback 데이터

완전 제거 전 필요한 작업:

- 단일 숙제 화면도 `assignment_parts[0]`를 우선 사용하도록 전환
- 제출 API가 `assignment_part_id`를 기준으로 검증/저장하도록 전환
- 기존 제출 데이터와 AI 피드백 데이터의 `assignment_item_id` 의존성 정리
- 구데이터 조회를 위한 fallback 정책 확정

### 2. `assignment.items[0]`

현재 여러 학생 숙제 컴포넌트에서 첫 번째 item을 기준으로 화면을 구성한다.

대상:

- 리스닝
- 듣고 녹음하기
- 라이팅
- 단어장 예문
- 단어장 녹음
- 사진 제출

정리 방향:

- 새 데이터는 `assignment.parts[0]` 또는 현재 진행 중인 Part를 기준으로 렌더링
- `assignment.items[0]`는 구데이터 fallback일 때만 사용

### 3. 제출 API의 `assignment_item_id`

현재 기존 제출 API는 대부분 `assignment_items`를 join해서 숙제 유형과 소유권을 검증한다.

정리 방향:

- 요청 payload에 `assignmentPartId`를 포함
- 서버에서 `assignment_parts` 기준으로 검증
- 필요할 때만 legacy item id를 보조 값으로 저장

### 4. 오래된 DB 마이그레이션

과거 SQL 파일 중 일부는 예전 숙제 유형 체크 제약을 다시 만들 수 있다.

주의:

- 새 환경에서는 최종적으로 `quiz_assignments.sql`까지 적용되어야 한다.
- 마이그레이션 적용 순서가 꼬이면 `quiz` 체크 제약이 빠질 수 있다.
- 장기적으로는 체크 제약 갱신 SQL을 한 곳에서 관리하는 편이 안전하다.

## 권장 정리 순서

### Phase 1. 읽기 모델 정리

- 학생 숙제 조회 결과에서 Part 중심 데이터를 표준으로 만든다.
- 기존 `items`는 legacy fallback으로만 명시한다.
- 단일 숙제 화면도 내부적으로는 Part 1개짜리 숙제로 처리한다.

### Phase 2. 학생 제출 API 정리

- 녹음, 리스닝, 라이팅, 사진 제출, 단어장 제출 API를 `assignment_part_id` 기준으로 전환한다.
- `submission_items.assignment_part_id`를 모든 새 제출의 기준으로 사용한다.
- `assignment_item_id`는 기존 데이터 호환용으로만 남긴다.

### Phase 3. 강사 생성/수정 경로 정리

- 새 숙제 생성 시 `assignment_parts`와 Part별 전용 테이블을 source of truth로 사용한다.
- `assignment_items` 생성은 legacy fallback이 필요한 동안만 최소화한다.
- 강사 미리보기와 수정 화면은 Part 데이터를 우선 사용한다.

### Phase 4. 결과/리포트 화면 정리

- 학생 제출 완료 화면과 강사 제출 상세 화면을 Part 기준으로 통일한다.
- 퀴즈처럼 Part 전용 답안 테이블이 있는 유형은 Part 아래에서 직접 조회한다.
- 기존 item 기반 답안은 fallback으로만 표시한다.

### Phase 5. DB 레거시 축소

- 모든 새 흐름이 Part 기준으로 안정화된 뒤 `assignment_items`를 deprecated 상태로 고정한다.
- 충분한 운영 검증 후 실제 삭제 또는 read-only legacy 테이블 전환을 검토한다.

## 최적화 포인트

- 중복된 숙제 유형 정규화 로직을 `src/lib/assignmentTypes.ts`로 모은다.
- 학생 숙제 조회에서 quiz questions, choices, attachments를 한 번에 묶어 내려 중복 렌더링 처리를 줄인다.
- Part별 제출 완료 여부 계산을 공통 유틸로 분리한다.
- 강사/학생 퀴즈 화면은 같은 `QuizPartPlayer` 계열 컴포넌트를 재사용한다.

## 운영 기준

- 새 기능의 기준은 `assignment_parts`다.
- `assignment_items`는 legacy/fallback이다.
- 새 퀴즈 데이터는 `assignment_parts`, `assignment_quiz_questions`, `assignment_quiz_choices`, `assignment_quiz_question_attachments`, `submission_quiz_answers`를 기준으로 저장한다.
- 구데이터가 남아 있는 동안은 fallback을 제거하지 않는다.
