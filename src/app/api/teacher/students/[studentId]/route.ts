import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { postgresPool } from "@/lib/postgres";
import { hashStudentPassword } from "@/server/auth/studentPassword";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ studentId: string }>;
};

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

async function findStudent(teacherId: string, studentId: string) {
  const result = await postgresPool.query<StudentRow>(
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
  return result.rows[0] ? mapStudent(result.rows[0]) : null;
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

export async function GET(_request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { studentId } = await params;
  const student = await findStudent(teacherId, studentId);
  if (!student) return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(student);
}

export async function PATCH(request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { studentId } = await params;
  const body = await request.json().catch(() => null) as {
    studentLoginId?: string;
    password?: string;
    name?: string;
    schoolName?: string;
    grade?: string;
    avatarKey?: string;
    memo?: string;
    status?: "active" | "inactive";
    classIds?: string[];
  } | null;

  if (!body) return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });

  const client = await postgresPool.connect();
  try {
    await client.query("begin");

    const existing = await client.query("select id from students where id = $1 and teacher_id = $2", [studentId, teacherId]);
    if (!existing.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    const setValue = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    const nextLoginId = body.studentLoginId?.trim();
    if (nextLoginId) {
      setValue("student_login_id", nextLoginId);
    }
    if (typeof body.password === "string" && body.password.trim()) {
      setValue("password_hash", await hashStudentPassword(body.password));
    }
    if (typeof body.name === "string") setValue("name", body.name.trim());
    if (typeof body.schoolName === "string") setValue("school_name", body.schoolName.trim() || null);
    if (typeof body.grade === "string") setValue("grade", body.grade.trim() || null);
    if (typeof body.avatarKey === "string") setValue("avatar_key", body.avatarKey.trim() || "robot");
    if (typeof body.memo === "string") setValue("memo", body.memo.trim() || null);
    if (body.status === "active" || body.status === "inactive") setValue("status", body.status);

    if (updates.length > 0) {
      values.push(studentId, teacherId);
      await client.query(
        `update students set ${updates.join(", ")}, updated_at = now() where id = $${values.length - 1} and teacher_id = $${values.length}`,
        values,
      );
    }

    if (Array.isArray(body.classIds)) {
      const classValidation = await validateClassIds(client, teacherId, body.classIds);
      if (!classValidation.valid) {
        await client.query("rollback");
        return NextResponse.json({ error: classValidation.error }, { status: 400 });
      }

      await client.query("delete from class_memberships where student_id = $1", [studentId]);
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
    }

    await client.query("commit");
    const student = await findStudent(teacherId, studentId);
    return NextResponse.json(student);
  } catch (error) {
    await client.query("rollback");
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 학생 아이디입니다." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "학생 수정 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { studentId } = await params;
  const result = await postgresPool.query(
    `
      update students
      set status = 'inactive', updated_at = now()
      where id = $1 and teacher_id = $2
      returning id
    `,
    [studentId, teacherId],
  );
  if (!result.rows[0]) return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  const student = await findStudent(teacherId, studentId);
  return NextResponse.json(student);
}
