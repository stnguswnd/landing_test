import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { postgresPool, query } from "@/lib/postgres";
import { hashStudentPassword } from "@/server/auth/studentPassword";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type StudentRow = {
  id: string;
  student_login_id: string;
  name: string;
  school_name: string | null;
  grade: string | null;
  avatar_key: string;
  memo: string | null;
  status: "active" | "inactive";
  class_ids: string[] | null;
  class_names: string[] | null;
  created_at: Date;
  updated_at: Date;
};

function mapStudent(row: StudentRow) {
  return {
    id: row.id,
    studentId: row.student_login_id,
    studentLoginId: row.student_login_id,
    name: row.name,
    schoolName: row.school_name ?? undefined,
    grade: row.grade ?? undefined,
    classIds: row.class_ids ?? [],
    classNames: row.class_names ?? [],
    avatarKey: row.avatar_key,
    memo: row.memo ?? undefined,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function validateClassIds(client: { query: typeof postgresPool.query }, teacherId: string, classIds: string[]) {
  const uniqueClassIds = Array.from(new Set(classIds.filter(Boolean)));
  if (uniqueClassIds.length === 0) {
    return { valid: true, classIds: uniqueClassIds, error: null };
  }

  const result = await client.query<{ id: string }>(
    "select id from classes where teacher_id = $1 and status = 'active' and id = any($2::text[])",
    [teacherId, uniqueClassIds],
  );
  if (result.rows.length !== uniqueClassIds.length) {
    return { valid: false, classIds: uniqueClassIds, error: "선택한 반 중 유효하지 않은 반이 있습니다." };
  }
  return { valid: true, classIds: uniqueClassIds, error: null };
}

export async function GET() {
  const { teacherId } = await requireTeacherSession();
  const result = await query<StudentRow>(
    `
      select
        s.id,
        s.student_login_id,
        s.name,
        s.school_name,
        s.grade,
        s.avatar_key,
        s.memo,
        s.status,
        coalesce(array_remove(array_agg(c.id order by c.name), null), array[]::text[]) as class_ids,
        coalesce(array_remove(array_agg(c.name order by c.name), null), array[]::text[]) as class_names,
        s.created_at,
        s.updated_at
      from students s
      left join class_memberships cm on cm.student_id = s.id
      left join classes c on c.id = cm.class_id and c.teacher_id = s.teacher_id
      where s.teacher_id = $1
      group by s.id
      order by s.created_at desc
    `,
    [teacherId],
  );

  return NextResponse.json(result.rows.map(mapStudent));
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const body = await request.json().catch(() => null) as {
    name?: string;
    studentLoginId?: string;
    password?: string;
    schoolName?: string;
    grade?: string;
    classIds?: string[];
    memo?: string;
  } | null;

  const name = body?.name?.trim();
  const studentLoginId = body?.studentLoginId?.trim();
  const password = body?.password ?? "";
  const classIds = Array.isArray(body?.classIds) ? body.classIds.filter(Boolean) : [];

  if (!name || !studentLoginId || !password) {
    return NextResponse.json({ error: "학생 이름, 학생 아이디, 초기 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const client = await postgresPool.connect();
  const studentId = `student-${randomUUID()}`;

  try {
    await client.query("begin");

    const classValidation = await validateClassIds(client, teacherId, classIds);
    if (!classValidation.valid) {
      await client.query("rollback");
      return NextResponse.json({ error: classValidation.error }, { status: 400 });
    }

    const duplicate = await client.query(
      "select id from students where teacher_id = $1 and student_login_id = $2 limit 1",
      [teacherId, studentLoginId],
    );

    if (duplicate.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "이미 사용 중인 학생 아이디입니다." }, { status: 409 });
    }

    const passwordHash = await hashStudentPassword(password);

    await client.query(
      `
        insert into students (
          id, teacher_id, student_login_id, password_hash,
          name, school_name, grade, avatar_key, memo, status
        )
        values ($1, $2, $3, $4, $5, $6, $7, 'robot', $8, 'active')
      `,
      [
        studentId,
        teacherId,
        studentLoginId,
        passwordHash,
        name,
        body?.schoolName?.trim() || null,
        body?.grade?.trim() || null,
        body?.memo?.trim() || null,
      ],
    );

    for (const classId of classValidation.classIds) {
      await client.query(
        `
          insert into class_memberships (id, class_id, student_id)
          select $1, c.id, $2
          from classes c
          where c.id = $3 and c.teacher_id = $4
          on conflict (class_id, student_id) do nothing
        `,
        [`membership-${randomUUID()}`, studentId, classId, teacherId],
      );
    }

    const result = await client.query<StudentRow>(
      `
        select
          s.id,
          s.student_login_id,
          s.name,
          s.school_name,
          s.grade,
          s.avatar_key,
          s.memo,
          s.status,
          coalesce(array_remove(array_agg(c.id order by c.name), null), array[]::text[]) as class_ids,
          coalesce(array_remove(array_agg(c.name order by c.name), null), array[]::text[]) as class_names,
          s.created_at,
          s.updated_at
        from students s
        left join class_memberships cm on cm.student_id = s.id
        left join classes c on c.id = cm.class_id and c.teacher_id = s.teacher_id
        where s.id = $1 and s.teacher_id = $2
        group by s.id
      `,
      [studentId, teacherId],
    );

    await client.query("commit");

    return NextResponse.json(mapStudent(result.rows[0]), { status: 201 });
  } catch (error) {
    await client.query("rollback");
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 학생 아이디입니다." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "학생 생성 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
