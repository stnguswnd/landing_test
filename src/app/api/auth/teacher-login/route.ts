import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { createSession, type UserRole } from "@/lib/auth/session";
import { query } from "@/lib/postgres";

export const runtime = "nodejs";

type LoginUserRow = {
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = body?.username?.trim();
  const password = body?.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const result = await query<LoginUserRow>(
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
    [username],
  );
  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (!user.teacher_id) {
    return NextResponse.json({ error: "강사 계정 정보가 연결되어 있지 않습니다." }, { status: 403 });
  }

  await createSession({
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.teacher_display_name ?? user.display_name,
    linkedStudentId: user.linked_student_id,
  });

  return NextResponse.json({
    user: {
      teacherId: user.teacher_id,
      username: user.username,
      role: user.role,
      displayName: user.teacher_display_name ?? user.display_name,
      email: user.teacher_email,
    },
  });
}
