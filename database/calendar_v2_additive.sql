-- ============================================================
-- calendar_v2_additive.sql
-- Non-destructive migration for calendar/source-of-truth cleanup.
--
-- Run manually in Supabase SQL Editor before deploying calendar v2 code.
--
-- Policy:
-- - class_schedule_days is legacy.
-- - class_calendar_events owns class/makeup/cancelled/notice/etc events.
-- - tests owns test schedule.
-- - assignments + assignment_targets own assignment due dates.
--
-- This file does not drop tables or columns.
-- ============================================================

begin;

-- Helpful read indexes for the unified calendar loaders.
create index if not exists class_calendar_events_teacher_status_date_idx
  on class_calendar_events(teacher_id, status, event_date);

create index if not exists class_calendar_events_class_status_date_idx
  on class_calendar_events(class_id, status, event_date);

create index if not exists tests_teacher_status_date_idx
  on tests(teacher_id, status, test_date);

create index if not exists tests_class_status_date_idx
  on tests(class_id, status, test_date);

create index if not exists assignment_targets_student_due_status_idx
  on assignment_targets(student_id, due_at, status);

create index if not exists assignments_teacher_due_status_idx
  on assignments(teacher_id, due_at, status);

-- Copy legacy class_schedule_days into class_calendar_events.
-- This preserves schedule visibility once code stops reading class_schedule_days.
--
-- Mapping:
-- - has_class = true  -> event_type = 'class'
-- - has_class = false -> event_type = 'cancelled'
-- - progress_title/book_title becomes title fallback.
-- - progress_memo/next_prep becomes description fallback.
--
-- The id is deterministic, making this migration rerunnable.
insert into class_calendar_events (
  id,
  teacher_id,
  class_id,
  schedule_day_id,
  event_type,
  title,
  description,
  event_date,
  start_time,
  end_time,
  status,
  created_at,
  updated_at
)
select
  'legacy-schedule-' || d.id as id,
  c.teacher_id,
  d.class_id,
  d.id as schedule_day_id,
  case when d.has_class then 'class' else 'cancelled' end as event_type,
  coalesce(nullif(trim(d.progress_title), ''), nullif(trim(d.book_title), ''), case when d.has_class then '정규수업' else '휴강' end) as title,
  nullif(trim(concat_ws(E'\n', d.progress_memo, case when d.next_prep is not null then '다음 준비: ' || d.next_prep else null end)), '') as description,
  d.date as event_date,
  d.start_time,
  d.end_time,
  'active' as status,
  d.created_at,
  d.updated_at
from class_schedule_days d
join classes c on c.id = d.class_id
where not exists (
  select 1
  from class_calendar_events e
  where e.id = 'legacy-schedule-' || d.id
);

commit;
