import { randomBytes } from "crypto";
import { cookies } from "next/headers";

import { query } from "@/lib/postgres";
import { clearStudentSession } from "@/server/auth/studentSession";

export type UserRole = "teacher" | "parent" | "student";

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  linkedStudentId: string | null;
};

const sessionCookieName = "homework_session";
const roleCookieName = "homework_role";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

type AuthUserRow = {
  id: string;
  username: string;
  role: UserRole;
  display_name: string;
  linked_student_id: string | null;
};

function mapUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    displayName: row.display_name,
    linkedStudentId: row.linked_student_id,
  };
}

export function getDestinationForRole(role: UserRole) {
  return role === "teacher" ? "/teacher/dashboard" : "/student/home";
}

export async function createSession(user: AuthUser) {
  const sessionId = randomBytes(32).toString("hex");

  await query(
    "insert into auth_sessions (id, user_id, expires_at) values ($1, $2, now() + ($3 || ' seconds')::interval)",
    [sessionId, user.id, sessionMaxAgeSeconds],
  );

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: sessionMaxAgeSeconds,
    path: "/",
  });
  cookieStore.set(roleCookieName, user.role, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: sessionMaxAgeSeconds,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;

  if (sessionId) {
    await query("delete from auth_sessions where id = $1", [sessionId]);
  }

  cookieStore.delete(sessionCookieName);
  cookieStore.delete(roleCookieName);
  await clearStudentSession();
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;

  if (!sessionId) {
    return null;
  }

  const result = await query<AuthUserRow>(
    `
      select u.id, u.username, u.role, u.display_name, u.linked_student_id
      from auth_sessions s
      join app_users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()
    `,
    [sessionId],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}
