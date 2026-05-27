-- Homework Studio assignment target management migration.
-- Purpose:
-- - Keep assignment_targets as the source of truth for "who received this homework".
-- - Support soft cancellation before submission.
-- - Preserve submissions after a student has submitted.
-- - Support per-student due date changes without changing the assignment source due_at.

alter table assignment_targets
  add column if not exists cancelled_at timestamptz;

alter table assignment_targets
  add column if not exists cancelled_by text references teachers(id) on delete set null;

update assignment_targets
set status = 'assigned'
where status is null;

alter table assignment_targets
  drop constraint if exists assignment_targets_status_check;

alter table assignment_targets
  add constraint assignment_targets_status_check
  check (status in ('assigned', 'submitted', 'late', 'excused', 'cancelled'));

create index if not exists idx_assignment_targets_assignment_status
  on assignment_targets(assignment_id, status);

create index if not exists idx_assignment_targets_assignment_class_status
  on assignment_targets(assignment_id, class_id, status);

create index if not exists idx_assignment_targets_cancelled_at
  on assignment_targets(cancelled_at)
  where status = 'cancelled';

create or replace view assignment_target_status_view as
select
  at.id as target_id,
  at.assignment_id,
  at.class_id,
  c.name as class_name,
  at.student_id,
  s.name as student_name,
  at.status as target_status,
  at.due_at,
  at.submitted_at as target_submitted_at,
  at.reviewed,
  at.feedback,
  at.cancelled_at,
  at.cancelled_by,
  sub.id as submission_id,
  sub.status as submission_status,
  sub.submitted_at,
  sub.reviewed_at,
  case
    when at.status = 'cancelled' then 'cancelled'
    when sub.id is not null and coalesce(sub.status, 'not_submitted') <> 'not_submitted' then 'submitted'
    when at.status in ('submitted', 'late') then 'submitted'
    else 'not_submitted'
  end as computed_submission_status,
  case
    when at.status = 'cancelled' then false
    when sub.id is not null and coalesce(sub.status, 'not_submitted') <> 'not_submitted' then false
    when at.status in ('submitted', 'late') then false
    else true
  end as cancellable
from assignment_targets at
join assignments a on a.id = at.assignment_id
join students s on s.id = at.student_id
left join classes c on c.id = at.class_id
left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id;
