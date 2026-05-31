import { NextResponse } from "next/server";
import { createNotice, getGlobalNotices } from "@/lib/dashboardData";
import { parseNoticeInput } from "@/server/teacher/noticeImageUpload";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function GET() {
  const { teacherId } = await requireTeacherSession();
  return NextResponse.json({ notices: await getGlobalNotices(teacherId) });
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  try {
    const body = await parseNoticeInput(request, teacherId);
    const noticeId = await createNotice(teacherId, body, { type: "all" });
    return NextResponse.json({ noticeId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "공지 생성 중 오류가 발생했습니다." }, { status: 400 });
  }
}
