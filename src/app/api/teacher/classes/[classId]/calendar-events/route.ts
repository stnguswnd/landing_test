import { NextResponse } from "next/server";
import { assertClass, createCalendarEvent, createCalendarEvents, getClassCalendarEvents } from "@/lib/dashboardData";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  if (!(await assertClass(teacherId, classId))) return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
  const url = new URL(request.url);
  return NextResponse.json({
    events: await getClassCalendarEvents(teacherId, classId, url.searchParams.get("start") ?? undefined, url.searchParams.get("end") ?? undefined),
  });
}

export async function POST(request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  if (!(await assertClass(teacherId, classId))) return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
  try {
    const body = await request.json();
    if (body?.mode === "weekday_bulk") {
      const result = await createCalendarEvents(teacherId, classId, body);
      return NextResponse.json(result, { status: 201 });
    }
    const eventId = await createCalendarEvent(teacherId, classId, body);
    return NextResponse.json({ eventId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "일정 생성 중 오류가 발생했습니다." }, { status: 400 });
  }
}
