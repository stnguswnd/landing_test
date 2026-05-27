import { NextResponse } from "next/server";
import { deleteNotice, updateNotice } from "@/lib/dashboardData";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ noticeId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { noticeId } = await context.params;
  const body = await request.json().catch(() => ({}));
  await updateNotice(teacherId, noticeId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ noticeId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { noticeId } = await context.params;
  await deleteNotice(teacherId, noticeId);
  return NextResponse.json({ ok: true });
}
