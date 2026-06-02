alter table assignments drop constraint if exists assignments_assignment_type_check;
alter table assignments add constraint assignments_assignment_type_check
  check (assignment_type in (
    'listening_recording',
    'listening',
    'writing',
    'vocabulary_example',
    'vocabulary_recording',
    'photo_submission',
    'quiz'
  ));

alter table assignment_parts drop constraint if exists assignment_parts_part_type_check;
alter table assignment_parts add constraint assignment_parts_part_type_check
  check (part_type in (
    'instruction',
    'listening',
    'recording',
    'writing',
    'photo_submission',
    'vocabulary_example',
    'vocabulary_recording',
    'quiz'
  ));

alter table assignment_items drop constraint if exists assignment_items_item_type_check;
alter table assignment_items add constraint assignment_items_item_type_check
  check (item_type in (
    'listening_recording',
    'listening',
    'writing_prompt',
    'vocabulary_example',
    'vocabulary_recording',
    'photo_submission',
    'quiz_prompt'
  ));

create table if not exists assignment_quiz_questions (
  id text primary key,
  assignment_part_id text not null references assignment_parts(id) on delete cascade,
  question_text text not null,
  explanation text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table assignment_quiz_questions
  add column if not exists explanation text;

create index if not exists assignment_quiz_questions_part_idx
  on assignment_quiz_questions(assignment_part_id, order_index);

drop trigger if exists assignment_quiz_questions_set_updated_at on assignment_quiz_questions;
create trigger assignment_quiz_questions_set_updated_at
before update on assignment_quiz_questions
for each row execute function set_updated_at();

create table if not exists assignment_quiz_choices (
  id text primary key,
  question_id text not null references assignment_quiz_questions(id) on delete cascade,
  choice_label text,
  choice_text text not null,
  is_correct boolean not null default false,
  incorrect_reason text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table assignment_quiz_choices
  add column if not exists choice_label text,
  add column if not exists incorrect_reason text;

create index if not exists assignment_quiz_choices_question_idx
  on assignment_quiz_choices(question_id, order_index);

update assignment_quiz_choices
set choice_label = (order_index + 1)::text,
    updated_at = now()
where choice_label is null
   or choice_label ~ '^[A-Za-z]+$'
   or choice_label ~ '^[0-9]+$';

create unique index if not exists assignment_quiz_choices_one_correct_idx
  on assignment_quiz_choices(question_id)
  where is_correct = true;

drop trigger if exists assignment_quiz_choices_set_updated_at on assignment_quiz_choices;
create trigger assignment_quiz_choices_set_updated_at
before update on assignment_quiz_choices
for each row execute function set_updated_at();

create table if not exists assignment_quiz_question_attachments (
  id text primary key,
  question_id text not null references assignment_quiz_questions(id) on delete cascade,
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
  unique (storage_bucket, storage_path)
);

create index if not exists assignment_quiz_question_attachments_question_idx
  on assignment_quiz_question_attachments(question_id, attachment_type, order_index);

drop trigger if exists assignment_quiz_question_attachments_set_updated_at on assignment_quiz_question_attachments;
create trigger assignment_quiz_question_attachments_set_updated_at
before update on assignment_quiz_question_attachments
for each row execute function set_updated_at();

create table if not exists submission_quiz_answers (
  id text primary key,
  submission_id text not null references submissions(id) on delete cascade,
  submission_item_id text references submission_items(id) on delete cascade,
  assignment_part_id text not null references assignment_parts(id) on delete cascade,
  question_id text not null references assignment_quiz_questions(id) on delete cascade,
  selected_choice_id text references assignment_quiz_choices(id) on delete set null,
  answer_text text,
  is_correct boolean,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

alter table submission_quiz_answers
  add column if not exists submission_item_id text references submission_items(id) on delete cascade,
  add column if not exists answer_text text;

create index if not exists submission_quiz_answers_submission_idx
  on submission_quiz_answers(submission_id, assignment_part_id);

create index if not exists submission_quiz_answers_question_idx
  on submission_quiz_answers(question_id);

drop trigger if exists submission_quiz_answers_set_updated_at on submission_quiz_answers;
create trigger submission_quiz_answers_set_updated_at
before update on submission_quiz_answers
for each row execute function set_updated_at();
