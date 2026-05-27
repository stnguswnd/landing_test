# 과목/숙제 배정 대규모 업데이트 현재 상황

작성일: 2026-05-27

## 배경

현재 앱은 숙제 생성 시점에 과목을 고른다. 과목 값은 `assignments.assignment_subject`에 저장되고, 반/학생에게 배정된 뒤에도 이 값을 기준으로 목록, 필터, 캘린더, 학생 화면에서 과목을 표시한다.

앞으로는 과목의 소속을 "숙제 원본"이 아니라 "반에 배정된 숙제" 쪽으로 옮긴다.

- 각 반마다 과목을 직접 만든다.
- 과목은 고정 12개 목록에서 고르는 방식이 아니다.
- 숙제 생성 화면에서는 과목을 선택하지 않는다.
- 숙제를 학생에게 배정할 때 `반 선택 -> 그 반의 과목 선택 -> 학생/마감 선택` 순서로 바꾼다.
- 반 상세 페이지에서는 과목별로 숙제를 조회할 수 있어야 한다.
- 과목 생성 시 시간대를 설정해서 캘린더에 표시할지는 아직 결정 필요하다.

## 현재 구현 상태

### 과목

- 현재 코드에는 `src/lib/assignmentTypes.ts`의 `ASSIGNMENT_SUBJECTS` 고정 목록이 있다.
- 현재 과목은 별도 테이블이 아니라 `assignments.assignment_subject` 문자열 컬럼에 저장된다.
- 이 구조는 "반마다 그때그때 과목을 만든다"는 요구와 맞지 않는다.
- 새 구조에서는 `ASSIGNMENT_SUBJECTS`를 과목 source of truth로 쓰면 안 된다.

### 숙제 생성

- 생성 화면: `src/app/teacher/assignments/new/page.tsx`
- 생성 API: `src/app/api/teacher/assignments/route.ts`
- 생성 화면에 `SubjectPicker`가 있고, 현재는 고정 과목 중 하나를 선택한다.
- 생성 API는 form data의 `subject`를 받아 `assignments.assignment_subject`에 저장한다.
- 변경 후에는 숙제 원본 생성 단계에서 과목을 받지 않는다.

### 숙제 배정

- 배정 관리 화면: `src/app/teacher/assignments/[assignmentId]/targets/page.tsx`
- 배정 API: `src/app/api/teacher/assignments/[assignmentId]/targets/route.ts`
- 현재 추가 배정은 반과 학생, 마감일을 선택하지만 과목을 선택하지 않는다.
- 변경 후에는 배정 시점에 반 과목을 선택해야 한다.
- 같은 숙제 원본을 서로 다른 반의 서로 다른 과목에 배정할 수 있어야 한다.

### 반 상세

- 반 상세 페이지: `src/app/teacher/classes/[classId]/page.tsx`
- 숙제 탭은 현재 반에 배정된 숙제 전체를 보여준다.
- 과목별 필터는 아직 반 상세 숙제 탭에 없다.
- 변경 후에는 반에 생성된 과목 목록을 보여주고, 과목별 숙제 조회가 가능해야 한다.

### 캘린더/정규 수업

- 캘린더 v2 정책은 `database/calendar_v2_additive.sql`에 정리되어 있다.
- 현재 source of truth는 다음처럼 나뉜다.
- `class_calendar_events`: 정규 수업, 보강, 휴강, 공지성 일정 등
- `tests`: 시험 일정
- `assignments + assignment_targets`: 숙제 마감일
- `src/lib/dashboardData.ts`의 `createCalendarEvents`는 정규 수업을 기간/요일/시간 기준으로 일괄 생성한다.
- 따라서 "과목 생성 시 시간대 설정 후 캘린더 표시"는 기존 정규 수업 일괄 생성 기능과 역할이 겹칠 수 있다.

## 추가로 필요한 DB

### 1. `class_subjects`

반별 과목을 저장하는 새 테이블이다. 이번 요구의 핵심 테이블이다.

```sql
create table class_subjects (
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

용도:

- 반마다 자유롭게 과목을 만든다.
- 예: `Phonics`, `Reading A`, `문법`, `월수 SL`, `Janet Class 1 Reading`
- 과목이 고정 12개가 아니므로 `name`은 자유 입력값이다.
- 삭제 대신 `status = 'archived'`를 우선 권장한다. 기존 배정/제출 기록이 과목을 참조할 수 있기 때문이다.
- `description`은 1차에 포함한다. 과목 운영 메모나 수업 범위 설명을 저장할 수 있다.
- `color`, `sort_order` 같은 UI 보조 컬럼은 1차에는 넣지 않는다. 실제 UI에서 필요해질 때 추가한다.

필수 인덱스:

```sql
create index class_subjects_teacher_class_status_idx
  on class_subjects(teacher_id, class_id, status);
```

### 2. `assignment_targets.class_subject_id`

학생별 숙제 배정에 "이 배정이 어떤 반 과목에 속하는지"를 저장한다.

```sql
alter table assignment_targets
  add column class_subject_id text references class_subjects(id) on delete restrict;
```

용도:

- 숙제 원본이 아니라 배정 단위에 과목을 붙인다.
- 같은 숙제를 A반 `Reading`에도, B반 `Grammar`에도 배정할 수 있다.
- 반 상세 숙제 필터는 이 값을 기준으로 한다.
- 학생 홈/학생 숙제 목록/캘린더의 과목 표시도 이 값을 우선 사용한다.

필수 인덱스:

```sql
create index assignment_targets_class_subject_idx
  on assignment_targets(class_id, class_subject_id, status);
```

### 3. 선택 사항: `assignment_target_groups`

현재 `assignment_targets`는 학생별 row다. 같은 숙제를 한 반 20명에게 배정하면 `class_subject_id`, `due_at` 같은 값이 20번 반복된다.

중복을 줄이고 배정 묶음을 명확히 관리하려면 그룹 테이블을 추가할 수 있다.

```sql
create table assignment_target_groups (
  id text primary key,
  teacher_id text not null references teachers(id) on delete cascade,
  assignment_id text not null references assignments(id) on delete cascade,
  class_id text not null references classes(id) on delete cascade,
  class_subject_id text not null references class_subjects(id) on delete restrict,
  due_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('active', 'cancelled', 'archived'))
);

alter table assignment_targets
  add column assignment_target_group_id text references assignment_target_groups(id) on delete set null;
```

판단:

- 빠른 1차 전환이 목표면 `assignment_target_groups` 없이 `assignment_targets.class_subject_id`만 추가한다.
- 장기적으로 배정 묶음 단위의 수정/취소/통계가 중요하면 `assignment_target_groups`를 추가하는 편이 좋다.

### 4. 선택 사항: `class_subject_schedules`

과목 자체에 요일/시간대를 붙이고 싶을 때 쓰는 테이블이다.

```sql
create table class_subject_schedules (
  id text primary key,
  class_subject_id text not null references class_subjects(id) on delete cascade,
  weekday integer not null,
  start_time time not null,
  end_time time not null,
  effective_from date,
  effective_to date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (weekday between 0 and 6),
  check (status in ('active', 'archived'))
);
```

현재 판단:

- 1차 업데이트에는 넣지 않는 것을 권장한다.
- 이미 `class_calendar_events`로 정규 수업을 일괄 저장할 수 있다.
- 과목 생성이 곧 캘린더 이벤트 생성까지 하면 일정 중복과 source of truth 충돌이 생길 수 있다.
- 과목별 시간표가 정말 필요해지면 2차에서 `class_subject_schedules`를 추가하고, 여기서 `class_calendar_events`를 생성하는 흐름으로 분리한다.

## 목표 데이터 구조

```txt
classes
  id

class_subjects
  id
  class_id
  name
  status

assignments
  id
  title
  assignment_type
  content fields...

assignment_targets
  assignment_id
  class_id
  class_subject_id
  student_id
  due_at
  status
```

핵심 분리:

```txt
assignments
  숙제 원본: 제목, 유형, 본문, 이미지, 오디오, 단어 목록

assignment_targets
  배정 인스턴스: 반, 반 과목, 학생, 마감일, 제출 상태
```

## 숙제 생성/배정 변경 방향

### 숙제 생성

- `SubjectPicker`를 제거한다.
- `assignments.assignment_subject`는 DB에서 제거했으므로 더 이상 저장하지 않는다.
- 숙제 원본은 과목을 모르는 상태로 저장된다.

### 숙제 배정

배정 화면은 다음 순서가 된다.

```txt
숙제 선택
-> 반 선택
-> 선택한 반의 과목 선택
-> 전체 학생 또는 일부 학생 선택
-> 마감일 선택
-> 배정
```

API 검증:

- `class_subject_id`가 실제로 선택한 `class_id`에 속하는지 확인한다.
- `class_subjects.status = 'active'`인지 확인한다.
- 학생들이 해당 반에 소속되어 있는지 확인한다.

## 반 상세 변경 방향

반 상세에 과목 관리 영역이 필요하다.

- 과목 목록
- 과목 추가
- 과목명 수정
- 과목 정렬
- 과목 비활성화
- 과목별 숙제 조회

숙제 탭 필터:

```txt
전체 | Reading A | Grammar | Phonics | ...
```

필터 기준:

```sql
assignment_targets.class_subject_id = selected_class_subject_id
```

기존 숙제 목업 데이터는 삭제했으므로 `class_subject_id` backfill은 하지 않는다. 새 배정부터 반드시 `class_subject_id`를 저장한다.

## 마이그레이션 방향

1. `class_subjects` 테이블 추가
2. `assignment_targets.class_subject_id` 컬럼 추가
3. 기존 숙제 관련 목업 데이터 삭제
4. `assignments.assignment_subject` 컬럼 제거
5. 숙제 생성 화면에서 `SubjectPicker` 제거
6. 숙제 생성 API에서 subject 저장 제거
7. 숙제 배정 화면에서 반 선택 후 해당 반의 과목 선택 추가
8. 배정 API에서 `class_subject_id` 검증 추가
9. 반 상세 페이지에 과목 CRUD 추가
10. 반 상세 숙제 탭에 과목 필터 추가
11. 학생 홈/학생 숙제 목록/캘린더에서 과목 표시는 `class_subjects.name` 우선 사용
12. 기존 `assignment_subject` 참조 코드 제거

Backfill은 생략한다. 기존 숙제/배정/제출 목업 데이터를 삭제했기 때문에 매칭할 기존 배정 데이터가 없다.

## 구현 시 확인해야 할 화면/API

- `src/app/teacher/assignments/new/page.tsx`
- `src/app/api/teacher/assignments/route.ts`
- `src/app/teacher/assignments/[assignmentId]/targets/page.tsx`
- `src/app/api/teacher/assignments/[assignmentId]/targets/route.ts`
- `src/app/teacher/classes/[classId]/page.tsx`
- `src/app/api/teacher/classes/[classId]/assignments`
- `src/app/api/teacher/classes/overview/route.ts`
- `src/lib/dashboardData.ts`
- `src/app/api/student/home/route.ts`
- `src/app/api/student/assignments/route.ts`

## 남은 결정 사항

- `assignment_targets.class_subject_id`만 추가할지, `assignment_target_groups`까지 만들지
- 과목 삭제를 실제 삭제로 할지, `archived` 처리만 허용할지
- 과목 색상/정렬을 1차에 넣을지
- 과목 시간대를 1차 범위에 넣을지, 정규 수업 캘린더 기능과 분리해 2차로 미룰지
- 남아 있는 앱 코드의 `assignment_subject` 참조를 어떤 순서로 제거할지

## 권장 1차 범위

1차는 과목/배정 모델 전환에 집중한다. 아래 12단계를 1차 구현 범위로 본다.

1. `class_subjects` 테이블 추가
2. `assignment_targets.class_subject_id` 컬럼 추가
3. 기존 숙제 관련 목업 데이터 삭제
4. `assignments.assignment_subject` 컬럼 제거
5. 숙제 생성 화면에서 `SubjectPicker` 제거
6. 숙제 생성 API에서 subject 저장 제거
7. 숙제 배정 화면에서 반 선택 후 해당 반의 과목 선택 추가
8. 배정 API에서 `class_subject_id` 검증 추가
9. 반 상세 페이지에 과목 CRUD 추가
10. 반 상세 숙제 탭에 과목 필터 추가
11. 학생 홈/학생 숙제 목록/캘린더에서 과목 표시는 `class_subjects.name` 우선 사용
12. 기존 `assignment_subject` 참조 코드 제거

과목 시간대와 캘린더 자동 표시는 2차로 미룬다. 이미 정규 수업 일괄 저장 기능이 있으므로, 지금 같이 넣으면 데이터 소스가 겹치고 일정 중복 문제가 생길 가능성이 높다.
