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

alter table assignment_parts
  add column if not exists writing_mode text,
  add column if not exists writing_unit text,
  add column if not exists writing_hint text,
  add column if not exists writing_example text;

alter table assignment_parts drop constraint if exists assignment_parts_writing_mode_check;
alter table assignment_parts add constraint assignment_parts_writing_mode_check
  check (writing_mode is null or writing_mode in ('picture_description', 'topic_diary'));

alter table assignment_parts drop constraint if exists assignment_parts_writing_unit_check;
alter table assignment_parts add constraint assignment_parts_writing_unit_check
  check (writing_unit is null or writing_unit in ('paragraphs', 'sentences'));

alter table if exists assignment_vocabulary_items
  add column if not exists assignment_part_id text references assignment_parts(id) on delete cascade;

do $$
begin
  if to_regclass('public.assignment_vocabulary_items') is not null then
    create index if not exists assignment_vocabulary_items_part_idx
      on assignment_vocabulary_items(assignment_part_id, order_index);
  end if;
end $$;

alter table assignment_parts drop constraint if exists assignment_parts_assignment_id_order_index_key;

create unique index if not exists assignment_parts_active_order_unique
  on assignment_parts(assignment_id, order_index)
  where status = 'active';

create index if not exists assignment_parts_assignment_idx
  on assignment_parts(assignment_id, status, order_index);

drop trigger if exists assignment_parts_set_updated_at on assignment_parts;
create trigger assignment_parts_set_updated_at
before update on assignment_parts
for each row execute function set_updated_at();

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

create index if not exists assignment_part_attachments_part_idx
  on assignment_part_attachments(assignment_part_id, attachment_type, order_index);

drop trigger if exists assignment_part_attachments_set_updated_at on assignment_part_attachments;
create trigger assignment_part_attachments_set_updated_at
before update on assignment_part_attachments
for each row execute function set_updated_at();

alter table submission_items
  add column if not exists assignment_part_id text references assignment_parts(id) on delete set null;

create unique index if not exists submission_items_submission_part_unique
  on submission_items(submission_id, assignment_part_id)
  where assignment_part_id is not null;

alter table submission_item_attachments
  add column if not exists assignment_part_id text references assignment_parts(id) on delete set null;

insert into assignment_parts (
  id,
  assignment_id,
  part_type,
  title,
  instruction,
  script_text,
  writing_mode,
  writing_unit,
  writing_hint,
  writing_example,
  allow_submission,
  min_submission_count,
  max_submission_count,
  order_index
)
select
  'assignment-part-' || gen_random_uuid(),
  a.id,
  case
    when a.assignment_type = 'listening' then 'listening'
    when a.assignment_type = 'writing' then 'writing'
    when a.assignment_type = 'photo_submission' then 'photo_submission'
    when a.assignment_type = 'vocabulary_example' then 'vocabulary_example'
    when a.assignment_type = 'vocabulary_recording' then 'vocabulary_recording'
    else 'recording'
  end,
  ai.title,
  a.description,
  ai.passage_text,
  ai.writing_mode,
  ai.writing_unit,
  ai.writing_hint,
  ai.writing_example,
  case when a.assignment_type in ('listening') then false else true end,
  case when a.assignment_type in ('listening') then 0 else 1 end,
  1,
  0
from assignments a
left join assignment_items ai on ai.assignment_id = a.id and ai.order_index = 1
where not exists (
  select 1 from assignment_parts ap where ap.assignment_id = a.id
);
