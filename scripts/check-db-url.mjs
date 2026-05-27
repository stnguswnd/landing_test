import fs from "fs";
import { Client } from "pg";

function readEnvFile(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

function readKeyFromEnvText(envText, key) {
  const match = envText.match(new RegExp(`^${key}=(["']?)(.+?)\\1\\s*$`, "m"));
  return match?.[2] ?? null;
}

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return { source: "process.env", value: process.env.DATABASE_URL };
  }

  const envLocalText = readEnvFile(".env.local");
  const envText = readEnvFile(".env");

  if (envLocalText) {
    const value = readKeyFromEnvText(envLocalText, "DATABASE_URL");
    if (value) return { source: ".env.local", value };
  }

  if (envText) {
    const value = readKeyFromEnvText(envText, "DATABASE_URL");
    if (value) return { source: ".env", value };
  }

  throw new Error("DATABASE_URL not found in process.env, .env.local, or .env");
}

function redact(value, password) {
  if (!password) return value;
  return value.split(password).join("[hidden]");
}

let loaded;
let parsed;

try {
  loaded = readDatabaseUrl();
  parsed = new URL(loaded.value);

  console.log(`DATABASE_URL loaded from ${loaded.source}`);
  console.log(`host: ${parsed.hostname}`);
  console.log(`port: ${parsed.port || "(default)"}`);
  console.log(`database: ${parsed.pathname.replace(/^\//, "") || "(none)"}`);
  console.log(`username: ${decodeURIComponent(parsed.username)}`);
  console.log(`sslmode: ${parsed.searchParams.get("sslmode") ?? "(none)"}`);
  console.log("password: [hidden]");
  console.log("");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const client = new Client({ connectionString: loaded.value });

try {
  await client.connect();
  const result = await client.query("select current_user, current_database(), now()");
  const row = result.rows[0];

  console.log("Database connected");
  console.log(`current_user: ${row.current_user}`);
  console.log(`current_database: ${row.current_database}`);
  console.log(`now: ${row.now.toISOString()}`);
} catch (error) {
  const password = decodeURIComponent(parsed.password);
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(redact(message, password));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
