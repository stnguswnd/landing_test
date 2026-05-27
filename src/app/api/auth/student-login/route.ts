import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { setStudentSession } from "@/server/auth/studentSession";
import { verifyStudentPassword } from "@/server/auth/studentPassword";

export const runtime = "nodejs";

type StudentLoginRow = {
  id: string;
  teacher_id: string;
  student_login_id: string;
  password_hash: string;
  status: "active" | "inactive";
  name: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { studentLoginId?: string; password?: string } | null;
  const studentLoginId = body?.studentLoginId?.trim();
  const password = body?.password ?? "";

  if (!studentLoginId || !password) {
    return NextResponse.json({ error: "학생 아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const result = await query<StudentLoginRow>(
    `
      select id, teacher_id, student_login_id, password_hash, status, name
      from students
      where student_login_id = $1 and status = 'active'
      order by created_at asc
      limit 1
    `,
    [studentLoginId],
  );
  const student = result.rows[0];

  if (!student || !(await verifyStudentPassword(password, student.password_hash))) {
    return NextResponse.json({ error: "학생 아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await setStudentSession({
    studentId: student.id,
    teacherId: student.teacher_id,
    role: "student",
  });

  return NextResponse.json({
    student: {
      id: student.id,
      teacherId: student.teacher_id,
      studentLoginId: student.student_login_id,
      name: student.name,
    },
  });
}
