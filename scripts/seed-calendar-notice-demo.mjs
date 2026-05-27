import fs from "fs";
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

const args = parseArgs(process.argv.slice(2));
const teacherId = args["teacher-id"]?.trim() || "teacher-1";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
  console.warn("Production mode detected. Set ALLOW_DEMO_SEED=true to run calendar demo seed.");
  process.exit(0);
}

const pool = new Pool({ connectionString: readDatabaseUrl() });

try {
  const teacher = await pool.query("select id from teachers where id = $1 limit 1", [teacherId]);
  if (!teacher.rowCount) {
    throw new Error(`Teacher not found: ${teacherId}. Run create:teacher first or pass --teacher-id.`);
  }

  const classResult = await pool.query("select id from classes where teacher_id = $1 limit 1", [teacherId]);
  if (!classResult.rowCount) {
    throw new Error(`No classes found for teacher: ${teacherId}. Seed or create classes before demo calendar seed.`);
  }

  const sql = fs.readFileSync("database/calendar_notice_demo_seed.sql", "utf8").replaceAll("teacher-1", teacherId);
  await pool.query(sql);
  console.log(`database/calendar_notice_demo_seed.sql applied for teacher ${teacherId}`);
} finally {
  await pool.end();
}
