alter table assignments drop constraint if exists assignments_assignment_type_check;
alter table assignments add constraint assignments_assignment_type_check
  check (assignment_type in (
    'listening_recording',
    'listening',
    'writing',
    'vocabulary_example',
    'vocabulary_recording',
    'photo_submission'
  ));

alter table assignment_items drop constraint if exists assignment_items_item_type_check;
alter table assignment_items add constraint assignment_items_item_type_check
  check (item_type in (
    'listening_recording',
    'listening',
    'writing_prompt',
    'vocabulary_example',
    'vocabulary_recording',
    'photo_submission'
  ));

alter table assignment_items add column if not exists min_photo_count integer not null default 1;
alter table assignment_items add column if not exists max_photo_count integer not null default 10;

alter table assignment_items drop constraint if exists assignment_items_photo_count_check;
alter table assignment_items add constraint assignment_items_photo_count_check
  check (
    min_photo_count >= 0
    and max_photo_count >= min_photo_count
    and max_photo_count <= 20
  );

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

create index if not exists submission_item_attachments_submission_idx
  on submission_item_attachments(submission_id);

create index if not exists submission_item_attachments_item_idx
  on submission_item_attachments(submission_item_id, order_index);

drop trigger if exists submission_item_attachments_set_updated_at on submission_item_attachments;
create trigger submission_item_attachments_set_updated_at
before update on submission_item_attachments
for each row execute function set_updated_at();

insert into submission_item_attachments (
  id,
  submission_item_id,
  submission_id,
  assignment_item_id,
  attachment_type,
  storage_bucket,
  storage_path,
  file_url,
  file_name,
  mime_type,
  file_size_bytes,
  duration_sec,
  order_index
)
select
  'attachment-' || gen_random_uuid(),
  si.id,
  si.submission_id,
  si.assignment_item_id,
  'audio',
  'homework-audio',
  si.recording_storage_path,
  si.recording_url,
  si.recording_file_name,
  si.recording_mime_type,
  si.file_size_bytes,
  si.recording_duration_sec,
  0
from submission_items si
where si.recording_storage_path is not null
  and not exists (
    select 1
    from submission_item_attachments sia
    where sia.submission_item_id = si.id
      and sia.attachment_type = 'audio'
      and sia.storage_path = si.recording_storage_path
  );
