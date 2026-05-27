import { Pool, type QueryResult, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL;

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

declare global {
  // eslint-disable-next-line no-var
  var postgresPool: Pool | undefined;
}

export const postgresPool =
  globalThis.postgresPool ??
  new Pool({
    connectionString: requireEnv(databaseUrl, "DATABASE_URL"),
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresPool = postgresPool;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return postgresPool.query<T>(text, params);
}
