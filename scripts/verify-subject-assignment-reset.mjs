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
  const checks = await pool.query(`
    select
      to_regclass('public.class_subjects') is not null as has_class_subjects,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'assignment_targets'
          and column_name = 'class_subject_id'
      ) as has_class_subject_id,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'assignments'
          and column_name = 'assignment_subject'
      ) as has_assignment_subject
  `);

  const counts = await pool.query(`
    select 'assignments' as table_name, count(*)::int as row_count from assignments
    union all select 'assignment_targets', count(*)::int from assignment_targets
    union all select 'assignment_items', count(*)::int from assignment_items
    union all select 'submissions', count(*)::int from submissions
    union all select 'submission_items', count(*)::int from submission_items
    union all select 'class_subjects', count(*)::int from class_subjects
    order by table_name
  `);

  console.log(JSON.stringify({ checks: checks.rows[0], counts: counts.rows }, null, 2));
} finally {
  await pool.end();
}
