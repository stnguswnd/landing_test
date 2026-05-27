import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { query } from "@/lib/postgres";

export class TeacherSessionError extends Error {
  status = 401;

  constructor(message = "Teacher session required.") {
    super(message);
    this.name = "TeacherSessionError";
  }
}

export type TeacherSession = {
  teacherId: string;
  appUserId: string;
  username: string;
  displayName: string;
  email: string;
  role: "teacher";
};

type TeacherSessionRow = {
  id: string;
  email: string;
  display_name: string;
};

export async function getTeacherSession(): Promise<TeacherSession | null> {
  const user = await getCurrentUser();

  if (!user || user.role !== "teacher") {
    return null;
  }

  const result = await query<TeacherSessionRow>(
    `
      select id, email, display_name
      from teachers
      where app_user_id = $1 and role = 'teacher'
      limit 1
    `,
    [user.id],
  );
  const teacher = result.rows[0];

  if (!teacher) {
    return null;
  }

  return {
    teacherId: teacher.id,
    appUserId: user.id,
    username: user.username,
    displayName: teacher.display_name || user.displayName,
    email: teacher.email,
    role: "teacher",
  };
}

export async function requireTeacherSession(): Promise<TeacherSession> {
  const session = await getTeacherSession();
  if (!session) {
    throw new TeacherSessionError();
  }
  return session;
}
