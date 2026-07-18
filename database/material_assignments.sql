alter table assignments drop constraint if exists assignments_assignment_type_check;
alter table assignments add constraint assignments_assignment_type_check
  check (assignment_type in (
    'material', 'listening_recording', 'listening', 'writing',
    'vocabulary_example', 'vocabulary_recording', 'photo_submission', 'quiz'
  ));

alter table assignment_items drop constraint if exists assignment_items_item_type_check;
alter table assignment_items add constraint assignment_items_item_type_check
  check (item_type in (
    'material', 'listening_recording', 'listening', 'writing_prompt',
    'vocabulary_example', 'vocabulary_recording', 'photo_submission', 'quiz_prompt'
  ));

alter table assignment_parts
  add column if not exists instruction_kind text not null default 'general';

alter table assignment_parts drop constraint if exists assignment_parts_instruction_kind_check;
alter table assignment_parts add constraint assignment_parts_instruction_kind_check
  check (instruction_kind in ('general', 'grading', 'other'));
