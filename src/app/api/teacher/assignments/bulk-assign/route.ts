import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";

import { postgresPool } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type BulkTargetInput = {
  classId: string;
  classSubjectId?: string;
  dueDate: string;
  dueTime: string;
  visibility: "published" | "draft";
  targetType: "all" | "partial";
  studentIds: string[];
};

type StudentTargetRow = {
  id: string;
};

function toDueAt(date: string, time: string) {
  return `${date}T${time || "23:59"}:00+09:00`;
}

async function findTargetStudents(client: PoolClient, teacherId: string, target: BulkTargetInput) {
  if (target.targetType === "partial") {
    const result = await client.query<StudentTargetRow>(
      `
        select distinct s.id
        from students s
        join class_memberships cm on cm.student_id = s.id
        where s.teacher_id = $1
          and s.status = 'active'
          and cm.class_id = $2
          and s.id = any($3::text[])
      `,
      [teacherId, target.classId, target.studentIds],
    );
    return result.rows;
  }

  const result = await client.query<StudentTargetRow>(
    `
      select distinct s.id
      from students s
      join class_memberships cm on cm.student_id = s.id
      where s.teacher_id = $1
        and s.status = 'active'
        and cm.class_id = $2
    `,
    [teacherId, target.classId],
  );
  return result.rows;
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const body = await request.json().catch(() => null) as {
    assignmentIds?: string[];
    targets?: BulkTargetInput[];
  } | null;

  const assignmentIds = Array.from(new Set((body?.assignmentIds ?? []).filter(Boolean)));
  const targets = body?.targets ?? [];

  if (assignmentIds.length === 0) {
    return NextResponse.json({ error: "배정할 숙제를 먼저 선택해주세요." }, { status: 400 });
  }
  if (targets.length === 0) {
    return NextResponse.json({ error: "배정할 반을 1개 이상 선택해주세요." }, { status: 400 });
  }

  for (const target of targets) {
    if (!target.classId || !target.classSubjectId || !target.dueDate || !target.dueTime) {
      return NextResponse.json({ error: "선택한 반마다 마감일과 마감 시간을 입력해주세요." }, { status: 400 });
    }
    if (target.targetType === "partial" && target.studentIds.length === 0) {
      return NextResponse.json({ error: "일부 학생만 배정할 때는 학생을 1명 이상 선택해주세요." }, { status: 400 });
    }
  }

  const client = await postgresPool.connect();

  try {
    await client.query("begin");

    const assignmentResult = await client.query<{ id: string }>(
      `
        select id
        from assignments
        where teacher_id = $1
          and id = any($2::text[])
      `,
      [teacherId, assignmentIds],
    );
    if (assignmentResult.rows.length !== assignmentIds.length) {
      await client.query("rollback");
      return NextResponse.json({ error: "선택한 숙제 중 찾을 수 없는 항목이 있습니다." }, { status: 400 });
    }

    let assignedCount = 0;
    const published = targets.some((target) => target.visibility === "published");
    const firstTarget = targets[0];

    for (const target of targets) {
      const classResult = await client.query<{ id: string }>(
        "select id from classes where id = $1 and teacher_id = $2 and status = 'active'",
        [target.classId, teacherId],
      );
      if (!classResult.rows[0]) {
        await client.query("rollback");
        return NextResponse.json({ error: "선택한 반을 찾을 수 없습니다." }, { status: 400 });
      }

      const subjectResult = await client.query<{ id: string }>(
        "select id from class_subjects where id = $1 and class_id = $2 and teacher_id = $3 and status = 'active' limit 1",
        [target.classSubjectId, target.classId, teacherId],
      );
      if (!subjectResult.rows[0]) {
        await client.query("rollback");
        return NextResponse.json({ error: "선택한 반 과목을 찾을 수 없습니다." }, { status: 400 });
      }

      const students = await findTargetStudents(client, teacherId, target);
      if (students.length === 0) {
        await client.query("rollback");
        return NextResponse.json({ error: "배정 대상 학생을 찾을 수 없습니다." }, { status: 400 });
      }

      const dueAt = toDueAt(target.dueDate, target.dueTime);
      for (const assignmentId of assignmentIds) {
        for (const student of students) {
          await client.query(
            `
              insert into assignment_targets (id, assignment_id, class_id, class_subject_id, student_id, status, due_at)
              values ($1, $2, $3, $4, $5, 'assigned', $6)
              on conflict (assignment_id, student_id)
              do update set
                class_id = excluded.class_id,
                class_subject_id = excluded.class_subject_id,
                due_at = excluded.due_at,
                status = case
                  when assignment_targets.status in ('submitted', 'late') then assignment_targets.status
                  else 'assigned'
                end,
                reviewed = case
                  when assignment_targets.status in ('submitted', 'late') then assignment_targets.reviewed
                  else false
                end,
                cancelled_at = null,
                cancelled_by = null,
                updated_at = now()
            `,
            [`target-${randomUUID()}`, assignmentId, target.classId, target.classSubjectId, student.id, dueAt],
          );
          assignedCount += 1;
        }
      }
    }

    await client.query(
      `
        update assignments
        set
          status = $3,
          due_at = coalesce($4::timestamptz, due_at),
          class_id = case when $5::int = 1 then $6 else null end,
          updated_at = now()
        where teacher_id = $1
          and id = any($2::text[])
      `,
      [
        teacherId,
        assignmentIds,
        published ? "published" : "draft",
        firstTarget ? toDueAt(firstTarget.dueDate, firstTarget.dueTime) : null,
        targets.length,
        firstTarget?.classId ?? null,
      ],
    );

    await client.query("commit");
    return NextResponse.json({ ok: true, assignedCount });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "숙제 배정 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
