import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ studentId: string }>;
};

type HistoryRow = {
  id: string;
  student_id: string;
  date: string | Date;
  assignment_title: string;
  assignment_type: string;
  class_name: string | null;
  submit_status: "submitted" | "not_submitted" | "late";
  score: number | null;
  review_status: "pending" | "reviewed" | "none";
  detail_href: string | null;
};

function toDate(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value.slice(0, 10);
}

export async function GET(_request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { studentId } = await params;
  const student = await query("select id from students where id = $1 and teacher_id = $2", [studentId, teacherId]);
  if (!student.rows[0]) return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });

  const result = await query<HistoryRow>(
    `
      select
        concat('history-', at.assignment_id, '-', at.student_id) as id,
        at.student_id,
        coalesce(at.submitted_at, at.due_at, a.due_at, a.created_at)::date as date,
        a.title as assignment_title,
        a.assignment_type,
        c.name as class_name,
        case
          when sub.id is not null then 'submitted'
          when coalesce(at.due_at, a.due_at) is not null and coalesce(at.due_at, a.due_at) < now() then 'late'
          else 'not_submitted'
        end as submit_status,
        tf.score,
        case
          when sub.status = 'reviewed' or at.reviewed = true or tf.id is not null then 'reviewed'
          when sub.id is not null then 'pending'
          else 'none'
        end as review_status,
        case when sub.id is not null then concat('/teacher/submissions/', sub.id) else null end as detail_href
      from assignment_targets at
      join assignments a on a.id = at.assignment_id and a.teacher_id = $2
      left join submissions sub on sub.assignment_id = a.id and sub.student_id = at.student_id
      left join teacher_feedback tf on tf.submission_id = sub.id
      left join classes c on c.id = at.class_id and c.teacher_id = a.teacher_id
      where at.student_id = $1
      group by at.assignment_id, at.student_id, at.submitted_at, at.due_at, a.due_at, a.created_at, a.title, a.assignment_type, c.name, sub.id, sub.status, at.reviewed, tf.id, tf.score
      order by date desc, a.title
    `,
    [studentId, teacherId],
  );

  return NextResponse.json(result.rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    date: toDate(row.date),
    assignmentTitle: row.assignment_title,
    assignmentType: row.assignment_type,
    className: row.class_name ?? undefined,
    submitStatus: row.submit_status,
    score: row.score,
    reviewStatus: row.review_status,
    detailHref: row.detail_href ?? undefined,
  })));
}
