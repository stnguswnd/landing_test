import { NextResponse } from "next/server";
import { getTestResults, upsertTestResults } from "@/lib/dashboardData";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ testId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { testId } = await context.params;
  return NextResponse.json({ results: await getTestResults(teacherId, testId) });
}

export async function POST(request: Request, context: { params: Promise<{ testId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { testId } = await context.params;
  const body = await request.json().catch(() => ({}));
  await upsertTestResults(teacherId, testId, Array.isArray(body.results) ? body.results : []);
  return NextResponse.json({ ok: true });
}
