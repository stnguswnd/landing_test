import { NextResponse } from "next/server";

import { postgresPool, query } from "@/lib/postgres";
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
  submission_id: string | null;
  assignment_target_id: string;
};

async function deleteIfTableExists(
  client: { query: typeof postgresPool.query },
  tableName: string,
  sql: string,
  values: unknown[],
) {
  const result = await client.query<{ exists: boolean }>("select to_regclass($1) is not null as exists", [`public.${tableName}`]);
  if (result.rows[0]?.exists) {
    await client.query(sql, values);
  }
}

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
        at.id as assignment_target_id,
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
        case when sub.id is not null then concat('/teacher/submissions/', sub.id) else null end as detail_href,
        sub.id as submission_id
      from assignment_targets at
      join assignments a on a.id = at.assignment_id and a.teacher_id = $2
      left join submissions sub on sub.assignment_id = a.id and sub.student_id = at.student_id
      left join teacher_feedback tf on tf.submission_id = sub.id
      left join classes c on c.id = coalesce(at.class_id, a.class_id) and c.teacher_id = a.teacher_id and c.status = 'active'
      where at.student_id = $1
        and at.status <> 'cancelled'
        and (coalesce(at.class_id, a.class_id) is null or c.id is not null)
      group by at.assignment_id, at.id, at.student_id, at.submitted_at, at.due_at, a.due_at, a.created_at, a.title, a.assignment_type, c.name, sub.id, sub.status, at.reviewed, tf.id, tf.score
      order by date desc, a.title
    `,
    [studentId, teacherId],
  );

  return NextResponse.json(result.rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    assignmentTargetId: row.assignment_target_id,
    date: toDate(row.date),
    assignmentTitle: row.assignment_title,
    assignmentType: row.assignment_type,
    className: row.class_name ?? undefined,
    submitStatus: row.submit_status,
    score: row.score,
    reviewStatus: row.review_status,
    detailHref: row.detail_href ?? undefined,
    submissionId: row.submission_id ?? undefined,
  })));
}

export async function DELETE(request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { studentId } = await params;
  const body = await request.json().catch(() => ({}));
  const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
  if (!submissionId) return NextResponse.json({ error: "삭제할 제출 내역을 찾을 수 없습니다." }, { status: 400 });

  const client = await postgresPool.connect();
  try {
    await client.query("begin");

    const target = await client.query<{
      id: string;
      assignment_id: string;
      student_id: string;
      submission_id: string | null;
    }>(
      `
        select
          at.id,
          at.assignment_id,
          at.student_id,
          sub.id as submission_id
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $3
        left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
        where at.student_id = $2
          and sub.id = $1
        for update of at
      `,
      [submissionId, studentId, teacherId],
    );

    const row = target.rows[0];
    if (!row) {
      await client.query("rollback");
      return NextResponse.json({ error: "학습 이력을 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.submission_id) {
      await deleteIfTableExists(client, "submission_vocabulary_items", "delete from submission_vocabulary_items where submission_id = $1", [row.submission_id]);
      await deleteIfTableExists(client, "teacher_feedback", "delete from teacher_feedback where submission_id = $1", [row.submission_id]);
      await deleteIfTableExists(client, "submission_item_attachments", "delete from submission_item_attachments where submission_id = $1", [row.submission_id]);
      await deleteIfTableExists(client, "submission_items", "delete from submission_items where submission_id = $1", [row.submission_id]);
      await client.query("delete from submissions where id = $1", [row.submission_id]);
    }

    await deleteIfTableExists(
      client,
      "student_ai_feedback_attempts",
      "delete from student_ai_feedback_attempts where assignment_id = $1 and student_id = $2",
      [row.assignment_id, row.student_id],
    );
    await client.query(
      `
        update assignment_targets
        set status = 'assigned',
            submitted_at = null,
            reviewed = false,
            feedback = null,
            updated_at = now()
        where id = $1 and status <> 'cancelled'
      `,
      [row.id],
    );

    await client.query("commit");
    return NextResponse.json({ deleted: true });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "제출 내역 삭제 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
