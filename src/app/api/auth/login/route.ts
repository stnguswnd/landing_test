import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { createSession, getDestinationForRole, type UserRole } from "@/lib/auth/session";
import { query } from "@/lib/postgres";
import { setStudentSession } from "@/server/auth/studentSession";
import { verifyStudentPassword } from "@/server/auth/studentPassword";

export const runtime = "nodejs";

type TeacherLoginRow = {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  display_name: string;
  linked_student_id: string | null;
  teacher_id: string | null;
  teacher_email: string | null;
  teacher_display_name: string | null;
};

type StudentLoginRow = {
  id: string;
  teacher_id: string;
  student_login_id: string;
  password_hash: string;
  status: "active" | "inactive";
  name: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { loginId?: string; password?: string } | null;
  const loginId = body?.loginId?.trim();
  const password = body?.password ?? "";

  if (!loginId || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const teacherResult = await query<TeacherLoginRow>(
    `
      select
        u.id,
        u.username,
        u.password_hash,
        u.role,
        u.display_name,
        u.linked_student_id,
        t.id as teacher_id,
        t.email as teacher_email,
        t.display_name as teacher_display_name
      from app_users u
      left join teachers t on t.app_user_id = u.id
      where u.username = $1 and u.role = 'teacher'
      limit 1
    `,
    [loginId],
  );
  const teacher = teacherResult.rows[0];

  if (teacher && verifyPassword(password, teacher.password_hash)) {
    if (!teacher.teacher_id) {
      return NextResponse.json({ error: "강사 계정 정보가 연결되어 있지 않습니다." }, { status: 403 });
    }

    await createSession({
      id: teacher.id,
      username: teacher.username,
      role: teacher.role,
      displayName: teacher.teacher_display_name ?? teacher.display_name,
      linkedStudentId: teacher.linked_student_id,
    });

    return NextResponse.json({
      role: "teacher",
      destination: getDestinationForRole("teacher"),
      user: {
        teacherId: teacher.teacher_id,
        username: teacher.username,
        role: teacher.role,
        displayName: teacher.teacher_display_name ?? teacher.display_name,
        email: teacher.teacher_email,
      },
    });
  }

  const studentResult = await query<StudentLoginRow>(
    `
      select id, teacher_id, student_login_id, password_hash, status, name
      from students
      where student_login_id = $1 and status = 'active'
      order by created_at asc
      limit 1
    `,
    [loginId],
  );
  const student = studentResult.rows[0];

  if (!student || !(await verifyStudentPassword(password, student.password_hash))) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await setStudentSession({
    studentId: student.id,
    teacherId: student.teacher_id,
    role: "student",
  });

  return NextResponse.json({
    role: "student",
    destination: "/student/home",
    student: {
      id: student.id,
      teacherId: student.teacher_id,
      studentLoginId: student.student_login_id,
      name: student.name,
    },
  });
}
