import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { query } from "@/lib/postgres";
import { requireTeacherSession, TeacherSessionError } from "@/server/teacher/session";

export const runtime = "nodejs";

type PasswordRow = {
  password_hash: string;
};

export async function PATCH(request: Request) {
  try {
    const session = await requireTeacherSession();
    const body = (await request.json().catch(() => null)) as
      | { currentPassword?: string; newPassword?: string; confirmPassword?: string }
      | null;
    const currentPassword = body?.currentPassword ?? "";
    const newPassword = body?.newPassword ?? "";
    const confirmPassword = body?.confirmPassword ?? "";

    if (!currentPassword) return NextResponse.json({ error: "현재 비밀번호를 입력해주세요." }, { status: 400 });
    if (newPassword.length < 8) return NextResponse.json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
    if (newPassword !== confirmPassword) return NextResponse.json({ error: "새 비밀번호가 서로 일치하지 않습니다." }, { status: 400 });

    const result = await query<PasswordRow>(
      `
        select u.password_hash
        from app_users u
        join teachers t on t.app_user_id = u.id
        where t.id = $1
        limit 1
      `,
      [session.teacherId],
    );
    const row = result.rows[0];

    if (!row) {
      return NextResponse.json({ error: "강사 계정을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!verifyPassword(currentPassword, row.password_hash)) {
      return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      `
        update app_users u
        set password_hash = $1, updated_at = now()
        from teachers t
        where t.app_user_id = u.id and t.id = $2
      `,
      [passwordHash, session.teacherId],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TeacherSessionError) {
      return NextResponse.json({ error: "강사 로그인이 필요합니다." }, { status: 401 });
    }
    return NextResponse.json({ error: "비밀번호를 변경하지 못했습니다." }, { status: 500 });
  }
}
