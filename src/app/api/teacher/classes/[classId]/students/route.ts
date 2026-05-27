import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { postgresPool, query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  const result = await query(
    `
      select s.id, s.name, s.student_login_id as "studentLoginId", s.school_name as "schoolName", s.grade, s.status
      from students s
      join class_memberships cm on cm.student_id = s.id
      join classes c on c.id = cm.class_id
      where c.id = $1 and c.teacher_id = $2
      order by s.name
    `,
    [classId, teacherId],
  );
  return NextResponse.json({ students: result.rows });
}

export async function POST(request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  const body = await request.json().catch(() => null) as { studentIds?: string[] } | null;
  const studentIds = Array.from(new Set((body?.studentIds ?? []).filter(Boolean)));

  if (studentIds.length === 0) {
    return NextResponse.json({ error: "추가할 학생을 선택해주세요." }, { status: 400 });
  }

  const client = await postgresPool.connect();
  try {
    await client.query("begin");

    const classResult = await client.query<{ id: string }>(
      "select id from classes where id = $1 and teacher_id = $2 and status = 'active' limit 1",
      [classId, teacherId],
    );
    if (!classResult.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
    }

    const studentResult = await client.query<{ id: string }>(
      "select id from students where teacher_id = $1 and status = 'active' and id = any($2::text[])",
      [teacherId, studentIds],
    );
    if (studentResult.rows.length !== studentIds.length) {
      await client.query("rollback");
      return NextResponse.json({ error: "선택한 학생 중 찾을 수 없는 학생이 있습니다." }, { status: 400 });
    }

    let addedCount = 0;
    for (const student of studentResult.rows) {
      const insert = await client.query(
        `
          insert into class_memberships (id, class_id, student_id)
          values ($1, $2, $3)
          on conflict (class_id, student_id) do nothing
          returning id
        `,
        [`membership-${randomUUID()}`, classId, student.id],
      );
      if (insert.rowCount) addedCount += 1;
    }

    await client.query("commit");
    return NextResponse.json({ ok: true, addedCount });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "학생 추가 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
