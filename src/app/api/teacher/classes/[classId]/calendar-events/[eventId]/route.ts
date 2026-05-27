import { NextResponse } from "next/server";
import { deleteCalendarEvent, updateCalendarEvent } from "@/lib/dashboardData";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ classId: string; eventId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId, eventId } = await context.params;
  const body = await request.json().catch(() => ({}));
  await updateCalendarEvent(teacherId, classId, eventId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ classId: string; eventId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId, eventId } = await context.params;
  await deleteCalendarEvent(teacherId, classId, eventId);
  return NextResponse.json({ ok: true });
}
