alter table assignment_items add column if not exists writing_mode text;
alter table assignment_items alter column passage_text drop not null;
alter table assignment_items add column if not exists writing_unit text;
alter table assignment_items add column if not exists writing_unit_count integer not null default 4;
alter table assignment_items add column if not exists prompt_text text;
alter table assignment_items add column if not exists writing_instructions text;
alter table assignment_items add column if not exists writing_hint text;
alter table assignment_items add column if not exists writing_example text;

alter table submission_items add column if not exists answer_text text;
alter table submission_items add column if not exists original_answer_text text;
alter table submission_items add column if not exists ai_corrected_text text;
alter table submission_items add column if not exists ai_feedback text;
alter table submission_items add column if not exists ai_grammar_notes text;
alter table submission_items add column if not exists ai_expression_notes text;
alter table submission_items add column if not exists ai_feedback_raw jsonb;

alter table assignment_items drop constraint if exists assignment_items_writing_mode_check;
alter table assignment_items add constraint assignment_items_writing_mode_check
  check (writing_mode is null or writing_mode in ('picture_description', 'topic_diary'));

alter table assignment_items drop constraint if exists assignment_items_writing_unit_check;
alter table assignment_items add constraint assignment_items_writing_unit_check
  check (writing_unit is null or writing_unit in ('paragraphs', 'sentences'));

update assignments
set assignment_type = 'listening_recording'
where assignment_type not in ('listening_recording', 'listening', 'writing', 'vocabulary_example', 'vocabulary_recording');

update assignments
set assignment_subject = 'Phonics'
where assignment_subject in ('RL', 'Listening', 'Writing')
   or assignment_subject is null
   or trim(assignment_subject) = '';

update assignment_items ai
set item_type = 'writing_prompt'
from assignments a
where a.id = ai.assignment_id
  and a.assignment_type = 'writing';

update assignment_items
set item_type = 'listening_recording'
where item_type not in ('listening_recording', 'listening', 'writing_prompt');

alter table assignments drop constraint if exists assignments_assignment_type_check;
alter table assignments add constraint assignments_assignment_type_check
  check (assignment_type in ('listening_recording', 'listening', 'writing', 'vocabulary_example', 'vocabulary_recording'));

alter table assignment_items drop constraint if exists assignment_items_item_type_check;
alter table assignment_items add constraint assignment_items_item_type_check
  check (item_type in ('listening_recording', 'listening', 'writing_prompt', 'vocabulary_example', 'vocabulary_recording'));
