import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const iterations = 210000;
  const digest = "sha256";
  const hash = pbkdf2Sync(password, salt, iterations, 32, digest).toString("hex");

  return `pbkdf2$${digest}$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    return bcrypt.compareSync(password, storedHash);
  }

  const [scheme, digest, iterationsValue, salt, hash] = storedHash.split("$");

  if (scheme !== "pbkdf2" || !digest || !iterationsValue || !salt || !hash) {
    return false;
  }

  const iterations = Number(iterationsValue);
  const hashBuffer = Buffer.from(hash, "hex");
  const passwordBuffer = pbkdf2Sync(password, salt, iterations, hashBuffer.length, digest);

  return hashBuffer.length === passwordBuffer.length && timingSafeEqual(hashBuffer, passwordBuffer);
}
