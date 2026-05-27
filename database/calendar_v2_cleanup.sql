-- ============================================================
-- calendar_v2_cleanup.sql
-- Destructive cleanup for the calendar v2 migration.
--
-- Do NOT run this until:
--   1. database/calendar_v2_additive.sql has been applied.
--   2. the deployed app no longer reads class_schedule_days.
--   3. the deployed app no longer writes schedule_day_id.
--   4. dashboard, student calendar, and class detail calendar are verified.
-- ============================================================

begin;

-- Preserve the list of legacy duplicated test events before unlinking tests.
create temporary table calendar_v2_legacy_test_events as
select calendar_event_id as id
from tests
where calendar_event_id is not null;

-- tests is now the source of truth for test schedules.
update tests
set calendar_event_id = null,
    updated_at = now()
where calendar_event_id is not null;

-- Remove only duplicated legacy test calendar rows that were linked from tests.
delete from class_calendar_events
where event_type = 'test'
  and id in (select id from calendar_v2_legacy_test_events);

drop table calendar_v2_legacy_test_events;

-- Remove legacy cross-links to class_schedule_days.
alter table tests
  drop constraint if exists tests_calendar_event_id_fkey;

alter table tests
  drop column if exists calendar_event_id;

alter table class_calendar_events
  drop constraint if exists class_calendar_events_schedule_day_id_fkey;

alter table class_calendar_events
  drop column if exists schedule_day_id;

alter table assignments
  drop constraint if exists assignments_schedule_day_id_fkey;

alter table assignments
  drop column if exists schedule_day_id;

-- class_schedule_days is no longer an application source table.
drop table if exists class_schedule_days cascade;

commit;
