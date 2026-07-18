import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  const result = await query(
    `
      select
        a.id,
        a.title,
        a.assignment_type as "assignmentType",
        at.class_subject_id as "classSubjectId",
        cs.name as "subjectName",
        coalesce(min(at.due_at), a.due_at) as "dueAt",
        count(distinct at.student_id)::int as "targetCount",
        count(distinct at.student_id) filter (where at.status in ('submitted', 'late'))::int as "submittedCount",
        count(distinct at.student_id) filter (where at.status = 'assigned')::int as "missingCount",
        count(distinct at.student_id) filter (
          where at.status in ('submitted', 'late')
            and at.reviewed = false
            and coalesce(sub.status, '') not in ('reviewed', 'returned')
            and tf.id is null
        )::int as "needsReviewCount"
      from assignments a
      join assignment_targets at
        on at.assignment_id = a.id
       and at.status <> 'cancelled'
       and (
         at.class_id = $1
         or (
           (a.class_id is null or a.class_id = $1)
           and exists (
             select 1
             from class_memberships cm
             where cm.class_id = $1
               and cm.student_id = at.student_id
           )
         )
       )
      left join submissions sub on sub.assignment_id = a.id and sub.student_id = at.student_id
      left join teacher_feedback tf on tf.submission_id = sub.id and tf.teacher_id = a.teacher_id
      left join class_subjects cs on cs.id = at.class_subject_id and cs.teacher_id = a.teacher_id
      join students s on s.id = at.student_id
      where a.teacher_id = $2
        and a.assignment_type <> 'material'
      group by a.id, at.class_subject_id, cs.name
      order by coalesce(min(at.due_at), a.due_at, a.created_at) desc
    `,
    [classId, teacherId],
  );

  return NextResponse.json({ assignments: result.rows });
}
