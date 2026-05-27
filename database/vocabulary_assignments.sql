alter table assignments drop constraint if exists assignments_assignment_type_check;
alter table assignments add constraint assignments_assignment_type_check
  check (assignment_type in (
    'listening_recording',
    'listening',
    'writing',
    'vocabulary_example',
    'vocabulary_recording'
  ));

alter table assignment_items drop constraint if exists assignment_items_item_type_check;
alter table assignment_items add constraint assignment_items_item_type_check
  check (item_type in (
    'listening_recording',
    'listening',
    'writing_prompt',
    'vocabulary_example',
    'vocabulary_recording'
  ));

create table if not exists assignment_vocabulary_items (
  id text primary key,
  assignment_id text not null references assignments(id) on delete cascade,
  word text not null,
  meaning text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, order_index)
);

create table if not exists submission_vocabulary_items (
  id text primary key,
  submission_id text not null references submissions(id) on delete cascade,
  assignment_vocabulary_item_id text not null references assignment_vocabulary_items(id) on delete cascade,
  original_answer_text text,
  ai_corrected_text text,
  ai_feedback text,
  ai_grammar_notes text,
  ai_feedback_raw jsonb,
  revised_answer_text text,
  teacher_comment text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed', 'returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, assignment_vocabulary_item_id)
);

create index if not exists assignment_vocabulary_items_assignment_idx
  on assignment_vocabulary_items(assignment_id, order_index);

create index if not exists submission_vocabulary_items_submission_idx
  on submission_vocabulary_items(submission_id);

drop trigger if exists assignment_vocabulary_items_set_updated_at on assignment_vocabulary_items;
create trigger assignment_vocabulary_items_set_updated_at
before update on assignment_vocabulary_items
for each row execute function set_updated_at();

drop trigger if exists submission_vocabulary_items_set_updated_at on submission_vocabulary_items;
create trigger submission_vocabulary_items_set_updated_at
before update on submission_vocabulary_items
for each row execute function set_updated_at();
