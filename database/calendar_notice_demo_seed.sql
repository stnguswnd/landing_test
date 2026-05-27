-- Demo data for calendar, notice, and test features.
-- Run only after a teacher and classes/students exist.
-- Default demo teacher: teacher-1.

insert into notices (id, teacher_id, title, content, status, published_at)
select 'notice-global-weekly', 'teacher-1', '이번 주 학원 전체 안내', '이번 주 금요일은 정상 수업입니다.', 'published', '2026-05-25T09:00:00+09:00'
where exists (select 1 from teachers where id = 'teacher-1')
on conflict (id) do nothing;

insert into notices (id, teacher_id, title, content, status, published_at)
select 'notice-global-summer', 'teacher-1', '여름방학 특강 안내', '여름방학 특강 신청이 시작되었습니다.', 'published', '2026-05-24T09:00:00+09:00'
where exists (select 1 from teachers where id = 'teacher-1')
on conflict (id) do nothing;

insert into notice_targets (id, notice_id, target_type)
select 'notice-target-global-weekly', 'notice-global-weekly', 'all'
where exists (select 1 from notices where id = 'notice-global-weekly')
on conflict (id) do nothing;

insert into notice_targets (id, notice_id, target_type)
select 'notice-target-global-summer', 'notice-global-summer', 'all'
where exists (select 1 from notices where id = 'notice-global-summer')
on conflict (id) do nothing;

insert into notices (id, teacher_id, title, content, status, published_at)
select 'notice-class-speaking-homework', c.teacher_id, '필수 Basic Speaking 숙제 안내', '이번 주 녹음 숙제를 꼭 제출해주세요.', 'published', '2026-05-25T10:00:00+09:00'
from classes c
where c.teacher_id = 'teacher-1' and c.name ilike '%Basic Speaking%'
limit 1
on conflict (id) do nothing;

insert into notice_targets (id, notice_id, class_id, target_type)
select 'notice-target-class-speaking-homework', 'notice-class-speaking-homework', c.id, 'class'
from classes c
where c.teacher_id = 'teacher-1' and c.name ilike '%Basic Speaking%'
  and exists (select 1 from notices where id = 'notice-class-speaking-homework')
limit 1
on conflict (id) do nothing;

insert into class_calendar_events (id, teacher_id, class_id, event_type, title, description, event_date, status)
select 'event-friday-cancelled', c.teacher_id, c.id, 'cancelled', '금요일 휴강', '이번 주 금요일 수업은 휴강입니다.', '2026-05-29', 'active'
from classes c
where c.teacher_id = 'teacher-1'
order by c.created_at asc
limit 1
on conflict (id) do nothing;

insert into class_calendar_events (id, teacher_id, class_id, event_type, title, description, event_date, status)
select 'event-ar-makeup', c.teacher_id, c.id, 'makeup', 'AR 보강', 'AR 보강 수업입니다.', '2026-06-01', 'active'
from classes c
where c.teacher_id = 'teacher-1'
order by c.created_at asc
limit 1
on conflict (id) do nothing;

insert into tests (id, teacher_id, class_id, title, subject, test_date, start_time, end_time, scope, status)
select 'test-sr-vocab', c.teacher_id, c.id, 'SR Vocabulary Test', 'SR', '2026-05-27', '16:00', '16:30', 'Unit 3 ~ Unit 4', 'scheduled'
from classes c
where c.teacher_id = 'teacher-1'
order by c.created_at asc
limit 1
on conflict (id) do nothing;

insert into test_results (id, test_id, teacher_id, class_id, student_id, score, result, teacher_memo, taken_at)
select concat('test-result-sr-', s.id), 'test-sr-vocab', s.teacher_id, cm.class_id, s.id,
  case when s.name in ('Hayun', '하윤') then 64 else 92 end,
  case when s.name in ('Hayun', '하윤') then 'NonPASS' else 'PASS' end,
  case when s.name in ('Hayun', '하윤') then '복습이 더 필요합니다.' else '잘했습니다.' end,
  '2026-05-20'
from students s
join class_memberships cm on cm.student_id = s.id
join tests t on t.id = 'test-sr-vocab' and t.class_id = cm.class_id
where s.teacher_id = 'teacher-1'
  and s.name in ('유재영', 'Yoo Jaeyoung', 'Hayun', '하윤')
on conflict (test_id, student_id) do nothing;
