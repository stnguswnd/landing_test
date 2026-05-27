# Supabase 과목/숙제 배정 DB 작업 절차

작성일: 2026-05-27

## 적용 결과

2026-05-27에 Supabase에 `database/subject_assignment_reset.sql`을 적용했다.

검증 결과:

```json
{
  "has_class_subjects": true,
  "has_class_subject_id": true,
  "has_assignment_subject": false
}
```

숙제 관련 주요 테이블 row count:

```txt
assignment_items: 0
assignment_targets: 0
assignments: 0
class_subjects: 0
submission_items: 0
submissions: 0
```

## 결정 사항

- 반별 과목은 고정 12개가 아니라 반마다 직접 생성한다.
- `assignments.assignment_subject` 컬럼은 제거한다.
- 기존 숙제 관련 목업 데이터는 삭제한다.
- 기존 숙제 데이터를 삭제하므로 `assignments.assignment_subject` 기반 backfill은 하지 않는다.
- 새 숙제 배정부터 `assignment_targets.class_subject_id`를 사용한다.

## 적용 SQL

적용 파일:

```txt
database/subject_assignment_reset.sql
```

실행 스크립트:

```txt
scripts/apply-subject-assignment-reset.mjs
```

## DB 변경 내용

### 1. `class_subjects` 추가

```sql
create table if not exists class_subjects (
  id text primary key,
  teacher_id text not null references teachers(id) on delete cascade,
  class_id text not null references classes(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, name),
  check (status in ('active', 'archived'))
);
```

### 2. `assignment_targets.class_subject_id` 추가

```sql
alter table assignment_targets
  add column if not exists class_subject_id text;
```

이 컬럼은 `class_subjects(id)`를 참조한다. 코드 전환 중에는 nullable로 둔다.

### 3. 숙제 관련 목업 데이터 삭제

삭제 대상:

- `submission_vocabulary_items`
- `teacher_feedback`
- `submission_items`
- `submissions`
- `assignment_vocabulary_items`
- `assignment_items`
- `assignment_targets`
- `assignments`

학생, 반, 공지, 시험, 캘린더 정규 수업 데이터는 이 SQL에서 삭제하지 않는다.

### 4. `assignments.assignment_subject` 제거

```sql
alter table assignments
  drop column if exists assignment_subject;
```

## 적용 순서

1. Supabase 연결 확인
2. `database/subject_assignment_reset.sql` 실행
3. `class_subjects` 테이블 존재 확인
4. `assignment_targets.class_subject_id` 컬럼 존재 확인
5. `assignments.assignment_subject` 컬럼 제거 확인
6. 숙제 관련 테이블 row count가 0인지 확인
7. 이후 앱 코드에서 `assignment_subject` 참조 제거

## 주의 사항

앱 코드도 `assignment_subject` 컬럼 참조를 제거했다. 숙제 원본은 과목을 저장하지 않고, 배정/조회 화면은 `assignment_targets.class_subject_id`와 `class_subjects.name`을 사용한다.

적용한 코드 작업:

1. 숙제 생성 화면에서 `SubjectPicker` 제거
2. 숙제 생성 API에서 `assignment_subject` insert/update 제거
3. 배정 화면에서 반 과목 선택 추가
4. 배정 API에서 `class_subject_id` 검증 및 저장
5. 조회 쿼리에서 `class_subjects.name`을 과목 표시값으로 join
