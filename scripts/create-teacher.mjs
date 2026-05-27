import fs from "fs";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envText = [".env.local", ".env"]
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const match = envText.match(/^DATABASE_URL=(["']?)(.+?)\1\s*$/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.local, .env, or process.env");
  return match[2];
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key.slice(2)] = "";
    } else {
      args[key.slice(2)] = value;
      i += 1;
    }
  }
  return args;
}

function required(value, name) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) throw new Error(`${name} is required.`);
  return trimmed;
}

const args = parseArgs(process.argv.slice(2));
const username = required(args.username, "--username");
const password = required(args.password, "--password");
const email = required(args.email, "--email").toLowerCase();
const displayName = required(args.name, "--name");
const teacherId = args["teacher-id"]?.trim() || `teacher-${Date.now()}`;

if (password.length < 8) {
  throw new Error("--password must be at least 8 characters.");
}

const pool = new Pool({ connectionString: readDatabaseUrl() });
const client = await pool.connect();

try {
  await client.query("begin");

  const existingUser = await client.query("select id from app_users where username = $1 limit 1", [username]);
  if (existingUser.rowCount) throw new Error(`Username already exists: ${username}`);

  const existingEmail = await client.query("select id from teachers where lower(email) = lower($1) limit 1", [email]);
  if (existingEmail.rowCount) throw new Error(`Teacher email already exists: ${email}`);

  const existingTeacher = await client.query("select id from teachers where id = $1 limit 1", [teacherId]);
  if (existingTeacher.rowCount) throw new Error(`Teacher id already exists: ${teacherId}`);

  const appUserId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  await client.query(
    `
      insert into app_users (id, username, password_hash, role, display_name)
      values ($1, $2, $3, 'teacher', $4)
    `,
    [appUserId, username, passwordHash, displayName],
  );

  await client.query(
    `
      insert into teachers (id, app_user_id, email, display_name, role)
      values ($1, $2, $3, $4, 'teacher')
    `,
    [teacherId, appUserId, email, displayName],
  );

  await client.query("commit");

  console.log("✅ Teacher account created");
  console.log("");
  console.log(`username: ${username}`);
  console.log(`teacher_id: ${teacherId}`);
  console.log(`email: ${email}`);
  console.log("");
  console.log("초기 비밀번호는 안전한 채널로 강사에게 전달하고, 로그인 후 반드시 변경하도록 안내하세요.");
} catch (error) {
  await client.query("rollback");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
