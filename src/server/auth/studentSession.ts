import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export type StudentSession = {
  studentId: string;
  teacherId: string;
  role: "student";
};

const studentSessionCookieName = "homework_student_session";
const roleCookieName = "homework_role";
const maxAgeSeconds = 60 * 60 * 24 * 7;

function getSecret() {
  return process.env.AUTH_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-student-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encodeSession(session: StudentSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string): StudentSession | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<StudentSession>;
    if (!parsed.studentId || !parsed.teacherId || parsed.role !== "student") return null;
    return {
      studentId: parsed.studentId,
      teacherId: parsed.teacherId,
      role: "student",
    };
  } catch {
    return null;
  }
}

export async function setStudentSession(session: StudentSession) {
  const cookieStore = await cookies();
  cookieStore.set(studentSessionCookieName, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
  cookieStore.set(roleCookieName, "student", {
    httpOnly: false,
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });
}

export async function getStudentSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(studentSessionCookieName)?.value;
  return value ? decodeSession(value) : null;
}

export async function requireStudentSession() {
  const session = await getStudentSession();
  if (!session) {
    throw new Error("Student session required.");
  }
  return session;
}

export async function clearStudentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(studentSessionCookieName);
  cookieStore.delete(roleCookieName);
}

export { studentSessionCookieName };
