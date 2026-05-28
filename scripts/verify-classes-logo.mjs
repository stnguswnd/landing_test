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

const expectedColumns = ["logo_url", "logo_storage_path", "logo_file_name"];
const pool = new Pool({ connectionString: readDatabaseUrl() });

try {
  const result = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'classes'
        and column_name = any($1)
      order by column_name
    `,
    [expectedColumns],
  );
  const found = new Set(result.rows.map((row) => row.column_name));
  const missing = expectedColumns.filter((column) => !found.has(column));

  if (missing.length > 0) {
    throw new Error(`Missing classes columns: ${missing.join(", ")}`);
  }

  console.log(`classes logo columns verified: ${expectedColumns.join(", ")}`);
} finally {
  await pool.end();
}
