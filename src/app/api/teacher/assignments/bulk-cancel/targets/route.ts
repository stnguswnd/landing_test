import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type AssignedTargetRow = {
  class_id: string;
  class_name: string;
  student_id: string;
  student_name: string;
  target_count: number;
  submitted_count: number;
};

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const body = await request.json().catch(() => null) as { assignmentIds?: string[] } | null;
  const assignmentIds = Array.from(new Set((body?.assignmentIds ?? []).filter(Boolean)));

  if (assignmentIds.length === 0) {
    return NextResponse.json({ error: "배정 취소할 숙제를 먼저 선택해주세요." }, { status: 400 });
  }

  const result = await postgresPool.query<AssignedTargetRow>(
    `
      select
        c.id as class_id,
        c.name as class_name,
        s.id as student_id,
        s.name as student_name,
        count(distinct at.id)::integer as target_count,
        count(distinct sub.id)::integer as submitted_count
      from assignment_targets at
      join assignments a on a.id = at.assignment_id and a.teacher_id = $2
      join classes c on c.id = at.class_id and c.teacher_id = $2 and c.status = 'active'
      join students s on s.id = at.student_id and s.teacher_id = $2 and s.status = 'active'
      left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
      where at.assignment_id = any($1::text[])
        and coalesce(at.status, 'assigned') <> 'cancelled'
      group by c.id, c.name, s.id, s.name
      order by c.name asc, s.name asc
    `,
    [assignmentIds, teacherId],
  );

  const classMap = new Map<string, {
    id: string;
    name: string;
    studentCount: number;
    assignedTargetCount: number;
    submittedCount: number;
    students: Array<{ id: string; name: string; assignedTargetCount: number; submittedCount: number }>;
    subjects: [];
  }>();

  for (const row of result.rows) {
    const current = classMap.get(row.class_id) ?? {
      id: row.class_id,
      name: row.class_name,
      studentCount: 0,
      assignedTargetCount: 0,
      submittedCount: 0,
      students: [],
      subjects: [],
    };
    current.students.push({
      id: row.student_id,
      name: row.student_name,
      assignedTargetCount: Number(row.target_count ?? 0),
      submittedCount: Number(row.submitted_count ?? 0),
    });
    current.assignedTargetCount += Number(row.target_count ?? 0);
    current.submittedCount += Number(row.submitted_count ?? 0);
    current.studentCount = current.students.length;
    classMap.set(row.class_id, current);
  }

  return NextResponse.json({ classes: Array.from(classMap.values()) });
}
