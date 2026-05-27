import { NextResponse } from "next/server";
import { assertClass, createNotice, getClassNotices } from "@/lib/dashboardData";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  if (!(await assertClass(teacherId, classId))) return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ notices: await getClassNotices(teacherId, classId) });
}

export async function POST(request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  if (!(await assertClass(teacherId, classId))) return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
  try {
    const body = await request.json();
    const noticeId = await createNotice(teacherId, body, { type: "class", classId });
    return NextResponse.json({ noticeId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "공지 생성 중 오류가 발생했습니다." }, { status: 400 });
  }
}
