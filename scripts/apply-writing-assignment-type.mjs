import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;

async function readDatabaseUrlFromEnvFile() {
  try {
    const env = await readFile(new URL("../.env", import.meta.url), "utf8");
    const match = env.match(/^DATABASE_URL=(["']?)(.+?)\1\s*$/m);
    return match?.[2];
  } catch {
    return undefined;
  }
}

const connectionString = process.env.DATABASE_URL || await readDatabaseUrlFromEnvFile();

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = await readFile(new URL("../database/finalize_assignment_types_and_writing.sql", import.meta.url), "utf8");
const pool = new Pool({ connectionString });

try {
  await pool.query(sql);
  console.log("Applied writing assignment type migration.");
} finally {
  await pool.end();
}
