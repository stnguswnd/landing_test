import "server-only";

import bcrypt from "bcryptjs";

const saltRounds = 12;

export function hashStudentPassword(password: string) {
  return bcrypt.hash(password, saltRounds);
}

export function verifyStudentPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
