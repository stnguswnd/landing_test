-- Existing local DB patch: allow Listening homework without recreating tables.
alter table assignments drop constraint if exists assignments_assignment_type_check;
alter table assignments
  add constraint assignments_assignment_type_check
  check (assignment_type in (
    'listening_recording',
    'listening',
    'image_speaking',
    'sentence_shadowing',
    'free_speaking',
    'writing',
    'quiz',
    'vocabulary',
    'general'
  ));

alter table assignment_items drop constraint if exists assignment_items_item_type_check;
alter table assignment_items
  add constraint assignment_items_item_type_check
  check (item_type in (
    'listening_recording',
    'listening',
    'image_speaking',
    'sentence_shadowing',
    'free_speaking',
    'writing_prompt',
    'quiz_question'
  ));
