create table if not exists student_ai_feedback_attempts (
  id text primary key,
  assignment_id text not null references assignments(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  assignment_item_id text references assignment_items(id) on delete cascade,
  assignment_vocabulary_item_id text references assignment_vocabulary_items(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('writing', 'vocabulary_example')),
  created_at timestamptz not null default now()
);

create index if not exists student_ai_feedback_attempts_scope_idx
  on student_ai_feedback_attempts(assignment_id, student_id, feedback_type, assignment_item_id, assignment_vocabulary_item_id, created_at);
