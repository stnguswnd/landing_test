import { NextResponse } from "next/server";
import { deleteNotice, updateNotice } from "@/lib/dashboardData";
import { parseNoticeInput } from "@/server/teacher/noticeImageUpload";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ noticeId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { noticeId } = await context.params;
  try {
    const body = await parseNoticeInput(request, teacherId);
    await updateNotice(teacherId, noticeId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "공지 수정 중 오류가 발생했습니다." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ noticeId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { noticeId } = await context.params;
  await deleteNotice(teacherId, noticeId);
  return NextResponse.json({ ok: true });
}
