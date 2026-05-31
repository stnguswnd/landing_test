# 2026-05-31 Homework Migration Notes

이 문서는 2026년 5월 31일에 반영한 숙제/제출 구조 확장 작업의 DB 마이그레이션 내용을 개발자가 이어서 이해하고 유지보수할 수 있도록 정리한 문서입니다.

## 요약

이번 변경의 핵심은 기존의 "숙제 1개 = 숙제 유형 1개 = 제출물 1개"에 가까운 구조를 다음 구조로 확장한 것입니다.

- 숙제 유형에 `photo_submission` 추가
- 숙제 하나에 여러 `Part`를 둘 수 있는 `assignment_parts` 구조 추가
- Part별 이미지/오디오 등 강사용 첨부 파일을 저장하는 `assignment_part_attachments` 추가
- 학생 제출물에 여러 첨부 파일을 붙일 수 있는 `submission_item_attachments` 추가
- 멀티 Part 진행 중 임시저장/이어하기를 위한 `student_assignment_drafts`, `student_assignment_draft_attachments` 추가
- AI 첨삭 횟수를 제출 기준으로 제한하기 위한 `student_ai_feedback_attempts` 추가
- 기존 녹음 제출 파일을 새 첨부 테이블로 이관하는 데이터 마이그레이션 포함
- 기존 단일 숙제를 자동으로 Part 1개짜리 숙제로 변환하는 데이터 마이그레이션 포함

## 적용 순서

권장 적용 순서는 아래와 같습니다.

```bash
npm run apply:photo-submission
npm run apply:assignment-parts
npm run apply:assignment-drafts
npm run apply:ai-feedback-attempts
```

각 스크립트는 `.env.local` 또는 `.env`에서 `DATABASE_URL`을 읽고, 대응되는 SQL 파일을 실행합니다.

| npm script | SQL file | 목적 |
| --- | --- | --- |
| `apply:photo-submission` | `database/photo_submission_assignments.sql` | 사진 제출 유형, 제출 첨부 테이블 추가 |
| `apply:assignment-parts` | `database/assignment_parts.sql` | 멀티 Part 구조 및 Part 첨부 테이블 추가 |
| `apply:assignment-drafts` | `database/student_assignment_drafts.sql` | 학생 임시저장/이어하기 테이블 추가 |
| `apply:ai-feedback-attempts` | `database/ai_feedback_attempts.sql` | AI 첨삭 시도 횟수 기록 테이블 추가 |

주의: 네 파일 모두 `create table if not exists`, `add column if not exists`, `create index if not exists`를 중심으로 작성되어 있어 재실행 가능하도록 설계되어 있습니다. 단, 데이터 이관 `insert ... select` 구문은 `not exists` 조건으로 중복 삽입을 방지합니다.

## 1. 사진 제출 유형 추가

파일: `database/photo_submission_assignments.sql`

### 1.1 `assignments.assignment_type` 체크 제약 확장

기존 숙제 유형 체크 제약에 `photo_submission`을 추가했습니다.

허용 유형:

- `listening_recording`
- `listening`
- `writing`
- `vocabulary_example`
- `vocabulary_recording`
- `photo_submission`

의도:

- 강사가 사진 제출 숙제를 생성할 수 있게 함
- 숙제 목록/학생 목록/미리보기에서 사진 제출 타입을 정상 타입으로 취급하게 함

### 1.2 `assignment_items.item_type` 체크 제약 확장

기존 문항 유형 체크 제약에도 `photo_submission`을 추가했습니다.

허용 유형:

- `listening_recording`
- `listening`
- `writing_prompt`
- `vocabulary_example`
- `vocabulary_recording`
- `photo_submission`

의도:

- 사진 제출 숙제도 기존 `assignment_items` 기반 조회 흐름에서 깨지지 않도록 함
- 학생 제출 API에서 `assignment_item_id`를 기준으로 사진 제출 문항을 찾을 수 있게 함

### 1.3 사진 제출 개수 컬럼 추가

`assignment_items`에 아래 컬럼을 추가했습니다.

| 컬럼 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `min_photo_count` | `integer not null` | `1` | 학생이 최소 제출해야 하는 사진 수 |
| `max_photo_count` | `integer not null` | `10` | 학생이 최대 제출할 수 있는 사진 수 |

체크 제약:

```sql
min_photo_count >= 0
and max_photo_count >= min_photo_count
and max_photo_count <= 20
```

현재 프론트/API 정책:

- 사진 파일은 최대 20장까지 처리 가능
- 파일 1개당 최대 용량은 기존 이미지 업로드 정책인 10MB 유지
- API에서는 `min_photo_count`, `max_photo_count`를 기준으로 제출 가능 여부를 검증

## 2. 학생 제출 첨부 테이블 추가

파일: `database/photo_submission_assignments.sql`

### 2.1 `submission_item_attachments`

학생 제출 항목(`submission_items`)에 여러 파일을 첨부하기 위한 테이블입니다.

```sql
create table if not exists submission_item_attachments (
  id text primary key,
  submission_item_id text not null references submission_items(id) on delete cascade,
  submission_id text not null references submissions(id) on delete cascade,
  assignment_item_id text references assignment_items(id) on delete cascade,
  attachment_type text not null check (attachment_type in ('image', 'audio', 'video', 'file')),
  storage_bucket text not null,
  storage_path text not null,
  file_url text,
  file_name text,
  mime_type text,
  file_size_bytes integer,
  duration_sec integer,
  width_px integer,
  height_px integer,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_item_id, attachment_type, order_index),
  unique (storage_bucket, storage_path)
);
```

### 2.2 컬럼 의미

| 컬럼 | 설명 |
| --- | --- |
| `submission_item_id` | 어떤 제출 항목에 붙은 파일인지 |
| `submission_id` | 어떤 제출물에 속한 파일인지. 삭제/조회 최적화용 |
| `assignment_item_id` | 기존 단일 문항 기반 제출과 연결 |
| `attachment_type` | `image`, `audio`, `video`, `file` 중 하나 |
| `storage_bucket` | Supabase Storage bucket 이름 |
| `storage_path` | Storage 내부 path |
| `file_url` | public URL 또는 signed URL 결과 저장용 |
| `file_name` | 원본 파일명 |
| `mime_type` | 업로드 파일 MIME type |
| `file_size_bytes` | 파일 크기 |
| `duration_sec` | 오디오/비디오 길이 |
| `width_px`, `height_px` | 이미지/비디오 해상도 확장용 |
| `order_index` | 여러 첨부 파일의 표시 순서 |

### 2.3 인덱스

```sql
create index if not exists submission_item_attachments_submission_idx
  on submission_item_attachments(submission_id);

create index if not exists submission_item_attachments_item_idx
  on submission_item_attachments(submission_item_id, order_index);
```

조회 패턴:

- 제출 상세에서 `submission_id` 기준으로 첨부 전체 조회
- 제출 항목별 UI에서 `submission_item_id, order_index` 기준으로 정렬 표시

### 2.4 기존 녹음 파일 이관

기존 `submission_items`에 직접 저장되던 녹음 파일 메타데이터를 `submission_item_attachments`로 이관합니다.

이관 대상:

- `submission_items.recording_storage_path is not null`

생성되는 첨부:

- `attachment_type = 'audio'`
- `storage_bucket = 'homework-audio'`
- `storage_path = submission_items.recording_storage_path`
- `file_url = submission_items.recording_url`
- `file_name = submission_items.recording_file_name`
- `mime_type = submission_items.recording_mime_type`
- `file_size_bytes = submission_items.file_size_bytes`
- `duration_sec = submission_items.recording_duration_sec`
- `order_index = 0`

중복 방지:

```sql
not exists (
  select 1
  from submission_item_attachments sia
  where sia.submission_item_id = si.id
    and sia.attachment_type = 'audio'
    and sia.storage_path = si.recording_storage_path
)
```

중요:

- 기존 `submission_items`의 녹음 컬럼은 제거하지 않았습니다.
- 하위 호환을 위해 기존 컬럼도 계속 남아 있습니다.
- 새 구현에서는 첨부 테이블을 우선 사용하고, 기존 컬럼은 fallback/legacy 성격으로 볼 수 있습니다.

## 3. 멀티 Part 숙제 구조 추가

파일: `database/assignment_parts.sql`

### 3.1 `assignment_parts`

숙제 하나 안에 여러 Part를 구성하기 위한 테이블입니다.

```sql
create table if not exists assignment_parts (
  id text primary key,
  assignment_id text not null references assignments(id) on delete cascade,
  part_type text not null check (part_type in (
    'instruction',
    'listening',
    'recording',
    'writing',
    'photo_submission',
    'vocabulary_example',
    'vocabulary_recording'
  )),
  title text,
  instruction text,
  script_text text,
  writing_mode text check (writing_mode is null or writing_mode in ('picture_description', 'topic_diary')),
  writing_unit text check (writing_unit is null or writing_unit in ('paragraphs', 'sentences')),
  writing_hint text,
  writing_example text,
  is_required boolean not null default true,
  allow_submission boolean not null default false,
  min_submission_count integer not null default 0,
  max_submission_count integer not null default 1,
  order_index integer not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  archived_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.2 Part 타입

| `part_type` | 의미 |
| --- | --- |
| `instruction` | 안내만 보여주는 Part. 현재 UI 선택 목록에서는 적극 사용하지 않음 |
| `listening` | 듣기 완료형 Part |
| `recording` | 듣고 따라 녹음하는 RL 녹음형 Part |
| `writing` | 라이팅 작성 + AI 첨삭형 Part |
| `photo_submission` | 사진 여러 장 제출형 Part |
| `vocabulary_example` | 단어장 예문 작성형 Part |
| `vocabulary_recording` | 단어장 녹음형 Part |

### 3.3 Part별 공통 필드

| 컬럼 | 설명 |
| --- | --- |
| `title` | Part 제목 |
| `instruction` | 학생에게 보여줄 안내문 |
| `script_text` | 스크립트, 문장, 프롬프트 등 본문 |
| `is_required` | 필수 Part 여부 |
| `allow_submission` | 제출이 필요한 Part인지 여부 |
| `min_submission_count` | 최소 제출 개수 |
| `max_submission_count` | 최대 제출 개수 |
| `order_index` | Part 순서 |
| `status` | `active` 또는 `archived` |

### 3.4 라이팅 전용 필드

Part별 라이팅 UI를 기존 단일 라이팅 숙제와 유사하게 구성하기 위해 아래 컬럼을 추가했습니다.

| 컬럼 | 설명 |
| --- | --- |
| `writing_mode` | `picture_description` 또는 `topic_diary` |
| `writing_unit` | `paragraphs` 또는 `sentences` |
| `writing_hint` | 힌트 |
| `writing_example` | 예시 답안 |

마이그레이션 파일에는 `create table`에 이미 포함되어 있지만, 기존에 테이블이 먼저 만들어진 환경을 고려해 아래 `alter table ... add column if not exists`도 포함되어 있습니다.

```sql
alter table assignment_parts
  add column if not exists writing_mode text,
  add column if not exists writing_unit text,
  add column if not exists writing_hint text,
  add column if not exists writing_example text;
```

### 3.5 Part 순서 제약

활성 Part 기준으로 한 숙제 안에서 `order_index`가 중복되지 않도록 unique index를 추가했습니다.

```sql
create unique index if not exists assignment_parts_active_order_unique
  on assignment_parts(assignment_id, order_index)
  where status = 'active';
```

주의:

- 삭제된 Part를 실제 삭제하지 않고 `archived`로 남기는 케이스를 고려한 설계입니다.
- 활성 Part만 순서 중복을 막습니다.

### 3.6 조회 인덱스

```sql
create index if not exists assignment_parts_assignment_idx
  on assignment_parts(assignment_id, status, order_index);
```

사용 패턴:

- 강사 숙제 생성/수정
- 강사 숙제 미리보기
- 학생 숙제 화면
- 제출 상세에서 Part별 제출 내용 표시

## 4. Part별 강사용 첨부 테이블 추가

파일: `database/assignment_parts.sql`

### 4.1 `assignment_part_attachments`

강사가 Part별로 업로드하는 이미지/오디오/기타 파일을 저장합니다.

```sql
create table if not exists assignment_part_attachments (
  id text primary key,
  assignment_part_id text not null references assignment_parts(id) on delete cascade,
  attachment_type text not null check (attachment_type in ('image', 'audio', 'video', 'file')),
  storage_bucket text not null,
  storage_path text not null,
  file_url text,
  file_name text,
  mime_type text,
  file_size_bytes integer,
  duration_sec integer,
  width_px integer,
  height_px integer,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_part_id, attachment_type, order_index),
  unique (storage_bucket, storage_path)
);
```

### 4.2 사용 목적

강사가 숙제 생성 시 Part마다 따로 첨부할 수 있습니다.

예:

- 리스닝 Part: 원본 오디오, 참고 이미지
- 사진 제출 Part: 예시 이미지 여러 장, 예시 오디오
- 라이팅 Part: 그림 이미지, 참고 오디오
- 단어장 Part: 참고 이미지/오디오

### 4.3 파일 교체 정책

현재 API 구현은 Part 첨부 업로드 시 같은 Part/같은 attachment type의 기존 파일을 교체하는 방식입니다.

관련 API 코드:

- `src/app/api/teacher/assignments/route.ts`
- `uploadPartAttachments(...)`

흐름:

1. 새 Part 이미지/오디오 파일이 들어오면 기존 동일 타입 첨부의 `storage_path` 조회
2. Supabase Storage에서 기존 파일 제거
3. `assignment_part_attachments` 기존 row 삭제
4. 새 파일 업로드
5. 새 row 삽입

## 5. 기존 단일 숙제의 Part 이관

파일: `database/assignment_parts.sql`

기존 숙제는 `assignment_parts`가 없으므로, 모든 기존 숙제를 Part 1개짜리 숙제로 자동 변환합니다.

```sql
insert into assignment_parts (...)
select ...
from assignments a
left join assignment_items ai on ai.assignment_id = a.id and ai.order_index = 1
where not exists (
  select 1 from assignment_parts ap where ap.assignment_id = a.id
);
```

### 5.1 타입 매핑

| 기존 `assignments.assignment_type` | 생성되는 `assignment_parts.part_type` |
| --- | --- |
| `listening` | `listening` |
| `writing` | `writing` |
| `photo_submission` | `photo_submission` |
| `vocabulary_example` | `vocabulary_example` |
| `vocabulary_recording` | `vocabulary_recording` |
| 그 외, 기존 `listening_recording` 포함 | `recording` |

### 5.2 필드 매핑

| 기존 데이터 | Part 컬럼 |
| --- | --- |
| `assignment_items.title` | `assignment_parts.title` |
| `assignments.description` | `assignment_parts.instruction` |
| `assignment_items.passage_text` | `assignment_parts.script_text` |
| `assignment_items.writing_mode` | `assignment_parts.writing_mode` |
| `assignment_items.writing_unit` | `assignment_parts.writing_unit` |
| `assignment_items.writing_hint` | `assignment_parts.writing_hint` |
| `assignment_items.writing_example` | `assignment_parts.writing_example` |

### 5.3 제출 가능 여부

```sql
case when a.assignment_type in ('listening') then false else true end
```

- `listening`은 듣기 완료형이므로 `allow_submission = false`
- 나머지는 제출형으로 보고 `allow_submission = true`

### 5.4 주의사항

- 기존 숙제는 Part 1개짜리 멀티 Part 구조로 변환됩니다.
- 이 변환 이후 UI/API는 `assignment_parts`를 우선 조회합니다.
- 기존 단일 필드는 하위 호환용으로 남아 있습니다.

## 6. 단어장 항목의 Part 귀속

파일: `database/assignment_parts.sql`

`assignment_vocabulary_items`에 아래 컬럼을 추가했습니다.

```sql
alter table if exists assignment_vocabulary_items
  add column if not exists assignment_part_id text references assignment_parts(id) on delete cascade;
```

인덱스:

```sql
create index if not exists assignment_vocabulary_items_part_idx
  on assignment_vocabulary_items(assignment_part_id, order_index);
```

목적:

- 멀티 Part 숙제에서 Part별로 다른 단어장을 가질 수 있게 함
- 기존 단어장 예문/녹음 숙제의 단어 목록이 숙제 전체가 아니라 특정 Part에 종속되도록 확장

API 영향:

- 숙제 생성/수정 시 Part 안의 `vocabularyRows`를 `assignment_vocabulary_items.assignment_part_id`와 함께 저장
- 학생 화면에서는 현재 Part의 `vocabularyItems`를 우선 사용
- fallback으로 기존 assignment-level `vocabularyItems`도 유지

## 7. 제출 항목의 Part 귀속

파일: `database/assignment_parts.sql`

`submission_items`에 아래 컬럼을 추가했습니다.

```sql
alter table submission_items
  add column if not exists assignment_part_id text references assignment_parts(id) on delete set null;
```

unique index:

```sql
create unique index if not exists submission_items_submission_part_unique
  on submission_items(submission_id, assignment_part_id)
  where assignment_part_id is not null;
```

의도:

- 하나의 최종 제출물(`submissions`) 안에 Part별 제출 항목(`submission_items`)을 여러 개 저장
- 동일 제출물 안에서 같은 Part의 제출 항목이 중복 생성되지 않도록 방지

`submission_item_attachments`에도 Part 귀속 컬럼을 추가했습니다.

```sql
alter table submission_item_attachments
  add column if not exists assignment_part_id text references assignment_parts(id) on delete set null;
```

의도:

- 멀티 Part 제출에서 첨부 파일이 어느 Part의 제출물인지 명확히 추적
- 강사 제출 상세 화면에서 Part별 첨부 파일을 묶어서 표시

## 8. 학생 임시저장/이어하기 구조 추가

파일: `database/student_assignment_drafts.sql`

### 8.1 `student_assignment_drafts`

멀티 Part 숙제를 중간에 저장하고 이어서 하기 위한 draft root 테이블입니다.

```sql
create table if not exists student_assignment_drafts (
  id text primary key,
  assignment_id text not null references assignments(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  assignment_target_id text references assignment_targets(id) on delete set null,
  current_part_id text references assignment_parts(id) on delete set null,
  current_part_order integer not null default 0,
  draft_data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.2 컬럼 의미

| 컬럼 | 설명 |
| --- | --- |
| `assignment_id` | 어떤 숙제의 draft인지 |
| `student_id` | 어떤 학생의 draft인지 |
| `assignment_target_id` | 어떤 배정 이력과 연결되는지 |
| `current_part_id` | 마지막으로 저장한 Part |
| `current_part_order` | 마지막으로 저장한 Part 순서 |
| `draft_data` | Part별 텍스트/AI 결과/상태 등을 JSON으로 저장 |
| `status` | `draft`, `submitted`, `discarded` |

### 8.3 active draft unique index

```sql
create unique index if not exists student_assignment_drafts_active_unique
  on student_assignment_drafts(assignment_id, student_id)
  where status = 'draft';
```

의도:

- 학생 1명이 같은 숙제에 대해 진행 중 draft를 하나만 갖도록 제한
- 최종 제출 후 `status = 'submitted'`로 바뀌면 새 draft 생성 가능

### 8.4 `submission_items.assignment_item_id` nullable 변경

```sql
alter table submission_items
  alter column assignment_item_id drop not null;
```

이유:

- 멀티 Part 구조에서는 일부 Part 제출이 기존 `assignment_items` 1개와 직접 대응되지 않을 수 있음
- Part 중심 제출에서는 `assignment_part_id`가 더 중요한 식별자가 됨
- 기존 단일 숙제와의 하위 호환을 위해 `assignment_item_id`는 유지하되 nullable로 완화

## 9. 학생 임시저장 첨부 테이블 추가

파일: `database/student_assignment_drafts.sql`

### 9.1 `student_assignment_draft_attachments`

임시저장 상태의 파일 첨부를 저장합니다.

```sql
create table if not exists student_assignment_draft_attachments (
  id text primary key,
  draft_id text not null references student_assignment_drafts(id) on delete cascade,
  assignment_part_id text references assignment_parts(id) on delete cascade,
  assignment_item_id text references assignment_items(id) on delete set null,
  attachment_type text not null check (attachment_type in ('image', 'audio', 'video', 'file')),
  storage_bucket text not null,
  storage_path text not null,
  file_url text,
  file_name text,
  mime_type text,
  file_size_bytes integer,
  duration_sec integer,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);
```

### 9.2 사용 예시

사진 제출 Part:

- 학생이 Part 1에서 사진 3장 선택
- `저장하기` 클릭
- 파일은 Storage에 업로드
- 메타데이터는 `student_assignment_draft_attachments`에 저장
- 다시 들어오면 해당 Part의 draft attachment를 불러와 미리보기 표시

녹음 Part:

- 학생이 녹음 완료
- `저장하기` 클릭
- audio blob 업로드
- `duration_sec` 포함해 draft attachment 저장

라이팅/단어장 예문 Part:

- 파일이 없으므로 `draft_data` JSON에 작성 내용, AI 결과, 다시 쓴 글 등을 저장

### 9.3 최종 제출 시 변환

관련 API:

- `src/app/api/student/assignments/[assignmentId]/draft/submit/route.ts`

흐름:

1. `student_assignment_drafts` 조회
2. draft에 저장된 Part별 data/attachments 조회
3. 기존 동일 assignment/student 제출물이 있으면 제출 항목/첨부를 정리
4. `submissions` upsert
5. Part별 `submission_items` 생성
6. draft attachments를 `submission_item_attachments`로 복사
7. 기존 제출 첨부 중 학생이 유지하기로 한 첨부도 복사
8. `assignment_targets`를 `submitted` 또는 `late` 상태로 갱신
9. draft 상태를 `submitted`로 변경

## 10. AI 첨삭 시도 기록 테이블 추가

파일: `database/ai_feedback_attempts.sql`

### 10.1 `student_ai_feedback_attempts`

AI 첨삭 횟수를 기록하기 위한 테이블입니다.

```sql
create table if not exists student_ai_feedback_attempts (
  id text primary key,
  assignment_id text not null references assignments(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  assignment_item_id text references assignment_items(id) on delete cascade,
  assignment_vocabulary_item_id text references assignment_vocabulary_items(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('writing', 'vocabulary_example')),
  created_at timestamptz not null default now()
);
```

### 10.2 인덱스

```sql
create index if not exists student_ai_feedback_attempts_scope_idx
  on student_ai_feedback_attempts(assignment_id, student_id, feedback_type, assignment_item_id, assignment_vocabulary_item_id, created_at);
```

### 10.3 적용 대상

- 라이팅 AI 첨삭
- 단어장 예문 AI 첨삭

### 10.4 횟수 정책

현재 정책:

- 제출 기준 최대 3회
- 학생이 같은 숙제를 다시 제출하거나 제출 내역이 삭제되어 미제출로 돌아가면 기준 시점이 달라짐

관련 API:

- `src/app/api/student/writing-feedback/route.ts`
- `src/app/api/student/vocabulary-feedback/route.ts`

기본 흐름:

1. 현재 assignment/student/item 또는 vocabulary item 기준으로 최근 제출 시점 확인
2. 최근 제출 이후의 AI feedback attempt 수 조회
3. 3회 이상이면 400 응답
4. 3회 미만이면 AI 요청 처리
5. 성공 시 `student_ai_feedback_attempts`에 row 삽입

## 11. 삭제 정책

관련 API:

- `src/app/api/teacher/students/[studentId]/history/route.ts`

현재 삭제 정책:

- 강사가 학생 학습 이력에서 제출 내역 삭제 가능
- 삭제 가능한 대상은 `submissionId`가 있는 제출 완료 row만 가능
- 미제출 row는 삭제 버튼 비활성화
- API에서도 `submissionId`가 없으면 400 반환

삭제 시 실제로 삭제되는 데이터:

- `submission_vocabulary_items`
- `teacher_feedback`
- `submission_item_attachments`
- `submission_items`
- `submissions`
- `student_ai_feedback_attempts` 중 해당 assignment/student 범위

삭제 후 유지되는 데이터:

- `assignment_targets`
- `assignments`
- `assignment_parts`
- `assignment_items`
- `assignment_vocabulary_items`

삭제 후 상태 복구:

```sql
update assignment_targets
set status = 'assigned',
    submitted_at = null,
    reviewed = false,
    feedback = null,
    updated_at = now()
where id = $1 and status <> 'cancelled'
```

즉, 제출 이력만 삭제되고 배정 이력은 유지됩니다. 학생에게는 해당 숙제가 다시 미제출 상태로 보입니다.

주의:

- 제출 내역 삭제 시 `student_assignment_drafts`는 삭제하지 않습니다.
- 현재 정책상 배정 자체를 지우지 않고 다시 제출 가능하게 되돌리는 목적입니다.
- 만약 향후 "배정 이력까지 완전 삭제"가 필요하면 별도 API/권한/확인 문구를 분리하는 것이 안전합니다.

## 12. 주요 API 영향 범위

### 12.1 강사 숙제 생성/수정

파일:

- `src/app/api/teacher/assignments/route.ts`

주요 변경:

- `parts` JSON payload 파싱
- `assignment_parts` upsert
- 삭제된 Part 처리
  - 제출 이력이 없는 Part는 삭제 가능
  - 제출 이력이 있는 Part는 `archived` 처리
- Part별 vocabulary rows 저장
- Part별 이미지/오디오 업로드 및 `assignment_part_attachments` 저장
- 숙제 목록 조회 시 `partTypes` 반환
- 숙제 상세/미리보기 조회 시 `parts`, `attachments`, `vocabularyItems` 반환

### 12.2 학생 숙제 조회

파일:

- `src/features/assignments/repositories/studentAssignmentRepository.ts`
- `src/app/api/student/assignments/route.ts`

주요 변경:

- 숙제별 active Part 조회
- Part attachments 조회
- Part vocabulary items 조회
- 기존 제출물의 Part별 `submission_items` 조회
- draft 및 draft attachments 조회
- 학생 화면에서 `MultiPartHomework`로 분기

### 12.3 학생 임시저장

파일:

- `src/app/api/student/assignments/[assignmentId]/draft/route.ts`

주요 역할:

- Part별 draft data 저장
- Part별 draft attachment 업로드
- `replaceAttachments` 옵션에 따라 기존 draft attachment 교체
- 현재 진행 Part 저장

### 12.4 멀티 Part 최종 제출

파일:

- `src/app/api/student/assignments/[assignmentId]/draft/submit/route.ts`

주요 역할:

- draft를 최종 `submissions` + `submission_items` + `submission_item_attachments`로 변환
- 기존 제출물을 다시 제출하는 경우 기존 제출 항목/첨부 정리
- 기존 제출 첨부 중 유지 대상 복사
- assignment target 상태 갱신

### 12.5 사진 제출

파일:

- `src/app/api/student/submissions/photo/route.ts`

주요 역할:

- 새 사진 파일 업로드
- 기존 제출 사진 중 유지할 attachment id 처리
- 삭제한 기존 사진은 DB attachment row에서 제거
- min/max photo count 검증
- `submission_item_attachments`에 image attachment 저장

### 12.6 녹음 제출

파일:

- `src/app/api/student/submissions/recording/route.ts`

주요 변경:

- 기존 `submission_items.recording_*` 컬럼 저장 유지
- 동시에 `submission_item_attachments`에 `audio` attachment 저장
- 향후 여러 녹음 파일 제출 구조로 확장 가능

## 13. 데이터 모델 관계도

간단한 관계는 아래와 같습니다.

```text
assignments
  ├─ assignment_items
  ├─ assignment_parts
  │    ├─ assignment_part_attachments
  │    └─ assignment_vocabulary_items
  └─ assignment_targets

submissions
  └─ submission_items
       └─ submission_item_attachments

student_assignment_drafts
  └─ student_assignment_draft_attachments

student_ai_feedback_attempts
```

Part 중심 관계:

```text
assignment_parts.id
  ├─ assignment_vocabulary_items.assignment_part_id
  ├─ assignment_part_attachments.assignment_part_id
  ├─ submission_items.assignment_part_id
  ├─ submission_item_attachments.assignment_part_id
  └─ student_assignment_draft_attachments.assignment_part_id
```

## 14. 하위 호환 전략

이번 마이그레이션은 기존 단일 숙제 구조를 즉시 제거하지 않습니다.

남겨둔 기존 구조:

- `assignments.assignment_type`
- `assignment_items`
- `assignment_items.passage_text`
- `assignment_items.audio_url`
- `assignment_items.writing_*`
- `submission_items.recording_*`

새 구조:

- `assignment_parts`
- `assignment_part_attachments`
- `assignment_vocabulary_items.assignment_part_id`
- `submission_items.assignment_part_id`
- `submission_item_attachments`
- `student_assignment_drafts`

의도:

- 기존 단일 숙제 조회/제출 흐름이 깨지지 않게 함
- 새 멀티 Part 숙제는 Part 구조를 우선 사용
- 기존 녹음 제출은 새 attachment 구조로 이관하되 기존 컬럼도 유지

## 15. 운영/QA 체크리스트

마이그레이션 적용 후 아래 항목을 확인해야 합니다.

### DB 체크

```sql
select count(*) from assignment_parts;
select count(*) from assignment_part_attachments;
select count(*) from submission_item_attachments;
select count(*) from student_assignment_drafts;
select count(*) from student_assignment_draft_attachments;
select count(*) from student_ai_feedback_attempts;
```

### 기존 숙제 Part 생성 확인

```sql
select a.id, a.title, count(ap.id) as part_count
from assignments a
left join assignment_parts ap on ap.assignment_id = a.id
group by a.id, a.title
order by part_count asc, a.title;
```

기대:

- 모든 기존 숙제가 최소 Part 1개를 가져야 합니다.

### 기존 녹음 첨부 이관 확인

```sql
select count(*) as migrated_audio_attachments
from submission_item_attachments
where attachment_type = 'audio';
```

### 사진 제출 API 확인

체크 항목:

- 이미지 파일이 아닌 파일 업로드 시 거부
- 10MB 초과 이미지 업로드 시 거부
- 20장 초과 제출 시 거부
- 기존 사진 일부 삭제 후 재제출 시 삭제 반영
- 기존 사진 유지 + 새 사진 추가 시 둘 다 반영

### 멀티 Part QA

체크 항목:

- Part 1 저장 후 Part 2 이동
- 브라우저 새로고침 후 이어하기
- 사진 draft 미리보기 유지
- 녹음 draft 재생 가능
- 마지막 Part에서 최종 제출
- 강사 제출 상세에서 Part별 내용 표시

### 삭제 기능 QA

체크 항목:

- 제출된 학습 이력 row에서 삭제 버튼 활성화
- 미제출 row에서 삭제 버튼 비활성화
- 삭제 후 제출 상세 접근 불가
- 삭제 후 학습 이력에서 해당 과제가 미제출로 표시
- 학생 화면에서 다시 제출 가능

## 16. 주의해야 할 제약과 향후 개선점

### 16.1 Part 삭제 정책

강사 숙제 수정에서 Part 삭제 시:

- 제출 이력이 없는 Part는 실제 삭제 가능
- 제출 이력이 있는 Part는 `archived` 처리하는 것이 안전

이유:

- 학생 제출 상세/학습 이력에서 과거 제출 내용을 보존해야 하기 때문
- `assignment_parts.status = 'archived'`가 이를 위한 필드

### 16.2 첨부 파일 실제 Storage 삭제

현재 DB row 삭제와 Storage object 삭제는 API별로 구현 수준이 다를 수 있습니다.

주의:

- DB row 삭제가 곧 Storage 파일 삭제를 항상 의미하지 않을 수 있음
- 운영 Storage 비용/보안 정책상 orphan file 정리 작업이 필요할 수 있음

향후 권장:

- `storage_bucket`, `storage_path` 기준으로 삭제 큐 또는 정리 스크립트 추가
- 제출 삭제 시 Storage object까지 제거할지 정책 확정

### 16.3 여러 녹음 파일 제출

이번 구조는 여러 오디오 첨부를 수용할 수 있게 설계되었습니다.

현재:

- 단일 녹음 UI 중심
- `submission_item_attachments`는 여러 `audio` row 저장 가능

향후:

- 녹음 여러 개 제출 UI 추가
- `max_submission_count`를 녹음 파일 개수 제한으로 사용
- 기존 `submission_items.recording_*` 컬럼은 legacy/fallback으로만 사용 가능

### 16.4 단일 숙제와 멀티 Part 혼재

기존 단일 숙제도 Part 1개로 이관되었기 때문에, 앞으로는 가능하면 Part 기반을 source of truth로 보는 것이 좋습니다.

권장:

- 화면 표시: `assignment_parts` 우선
- 유형 태그: `assignment.partTypes` 또는 active parts 기준
- 학생 제출: Part가 있으면 Part 기반 제출
- 단일 fallback은 기존 데이터 보호용으로만 유지

## 17. 관련 파일 목록

### DB migration

- `database/photo_submission_assignments.sql`
- `database/assignment_parts.sql`
- `database/student_assignment_drafts.sql`
- `database/ai_feedback_attempts.sql`

### 적용 스크립트

- `scripts/apply-photo-submission-assignments.mjs`
- `scripts/apply-assignment-parts.mjs`
- `scripts/apply-student-assignment-drafts.mjs`
- `scripts/apply-ai-feedback-attempts.mjs`

### 주요 API

- `src/app/api/teacher/assignments/route.ts`
- `src/app/api/student/submissions/photo/route.ts`
- `src/app/api/student/submissions/recording/route.ts`
- `src/app/api/student/assignments/[assignmentId]/draft/route.ts`
- `src/app/api/student/assignments/[assignmentId]/draft/submit/route.ts`
- `src/app/api/student/writing-feedback/route.ts`
- `src/app/api/student/vocabulary-feedback/route.ts`
- `src/app/api/teacher/students/[studentId]/history/route.ts`

### 주요 조회/도메인 코드

- `src/features/assignments/repositories/studentAssignmentRepository.ts`
- `src/server/teacher/submissionDetail.ts`
- `src/types/assignment.ts`
- `src/types/submission.ts`

## 18. 최종 상태

이번 마이그레이션 이후 DB는 다음 요구사항을 수용할 수 있습니다.

- 사진 제출 숙제
- Part별 다른 숙제 유형 구성
- Part별 강사용 이미지/오디오 첨부
- 학생의 Part별 임시저장/이어하기
- 멀티 Part 최종 제출 aggregation
- 학생 제출의 여러 첨부 파일 저장
- 향후 녹음 파일 여러 개 제출 확장
- AI 첨삭 3회 제한
- 강사가 학생 제출 이력만 삭제하고 배정은 유지하는 운영 흐름

