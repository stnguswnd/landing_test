import { NextResponse } from "next/server";
import { deleteTest, updateTest } from "@/lib/dashboardData";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ testId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { testId } = await context.params;
  const body = await request.json().catch(() => ({}));
  await updateTest(teacherId, testId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ testId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { testId } = await context.params;
  try {
    await deleteTest(teacherId, testId);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "시험 삭제 중 오류가 발생했습니다." }, { status: 404 });
  }
}
