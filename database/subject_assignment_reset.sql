-- Subject assignment reset migration.
-- Destructive for homework data:
-- - Deletes current assignment/submission mock data.
-- - Adds class_subjects.
-- - Adds assignment_targets.class_subject_id.
-- - Drops assignments.assignment_subject.

begin;

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

alter table assignment_targets
  add column if not exists class_subject_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignment_targets_class_subject_id_fkey'
  ) then
    alter table assignment_targets
      add constraint assignment_targets_class_subject_id_fkey
      foreign key (class_subject_id)
      references class_subjects(id)
      on delete restrict;
  end if;
end $$;

create index if not exists class_subjects_teacher_class_status_idx
  on class_subjects(teacher_id, class_id, status);

create index if not exists assignment_targets_class_subject_idx
  on assignment_targets(class_id, class_subject_id, status);

do $$
begin
  if to_regclass('public.submission_vocabulary_items') is not null then
    execute 'delete from submission_vocabulary_items';
  end if;

  if to_regclass('public.teacher_feedback') is not null then
    execute 'delete from teacher_feedback';
  end if;

  if to_regclass('public.submission_items') is not null then
    execute 'delete from submission_items';
  end if;

  if to_regclass('public.submissions') is not null then
    execute 'delete from submissions';
  end if;

  if to_regclass('public.assignment_vocabulary_items') is not null then
    execute 'delete from assignment_vocabulary_items';
  end if;

  if to_regclass('public.assignment_items') is not null then
    execute 'delete from assignment_items';
  end if;

  if to_regclass('public.assignment_targets') is not null then
    execute 'delete from assignment_targets';
  end if;

  if to_regclass('public.assignments') is not null then
    execute 'delete from assignments';
  end if;
end $$;

alter table assignments
  drop column if exists assignment_subject;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
  ) then
    drop trigger if exists class_subjects_set_updated_at on class_subjects;
    create trigger class_subjects_set_updated_at
    before update on class_subjects
    for each row execute function set_updated_at();
  end if;
end $$;

commit;
