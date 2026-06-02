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

alter table submission_items
  alter column assignment_item_id drop not null;

create unique index if not exists student_assignment_drafts_active_unique
  on student_assignment_drafts(assignment_id, student_id)
  where status = 'draft';

create index if not exists student_assignment_drafts_student_idx
  on student_assignment_drafts(student_id, status, updated_at desc);

drop trigger if exists student_assignment_drafts_set_updated_at on student_assignment_drafts;
create trigger student_assignment_drafts_set_updated_at
before update on student_assignment_drafts
for each row execute function set_updated_at();

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

create index if not exists student_assignment_draft_attachments_draft_idx
  on student_assignment_draft_attachments(draft_id, assignment_part_id, attachment_type, order_index);

drop trigger if exists student_assignment_draft_attachments_set_updated_at on student_assignment_draft_attachments;
create trigger student_assignment_draft_attachments_set_updated_at
before update on student_assignment_draft_attachments
for each row execute function set_updated_at();
