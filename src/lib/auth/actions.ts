"use server";

import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getDestinationForRole, type UserRole } from "@/lib/auth/session";
import { query } from "@/lib/postgres";

type ActionState = {
  error?: string;
};

type LoginUserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  display_name: string;
  linked_student_id: string | null;
};

export async function loginAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "아이디와 비밀번호를 입력해 주세요." };
  }

  const result = await query<LoginUserRow>(
    `
      select id, username, password_hash, role, display_name, linked_student_id
      from app_users
      where username = $1
      limit 1
    `,
    [username],
  );
  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  await createSession({
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name,
    linkedStudentId: user.linked_student_id,
  });

  redirect(getDestinationForRole(user.role));
}

export async function signupAction(_previousState: ActionState, _formData: FormData): Promise<ActionState> {
  return { error: "공개 회원가입은 지원하지 않습니다. 계정은 관리자 또는 강사가 발급합니다." };
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
