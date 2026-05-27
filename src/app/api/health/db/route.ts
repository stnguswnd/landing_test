import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";

export async function GET() {
  const result = await query<{ database_name: string; user_name: string }>(
    "select current_database() as database_name, current_user as user_name",
  );

  return NextResponse.json({
    ok: true,
    database: result.rows[0]?.database_name,
    user: result.rows[0]?.user_name,
  });
}
