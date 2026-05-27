import fs from "fs";
import { Pool } from "pg";

function readDatabaseUrl() {
  const envText = [".env.local", ".env"]
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) throw new Error("DATABASE_URL not found in .env or .env.local");
  return match[1];
}

const pool = new Pool({ connectionString: readDatabaseUrl() });

try {
  const sql = fs.readFileSync("database/add_listening_assignment_type.sql", "utf8");
  await pool.query(sql);
  console.log("database/add_listening_assignment_type.sql applied");
} finally {
  await pool.end();
}
