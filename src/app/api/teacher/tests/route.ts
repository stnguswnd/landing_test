import { NextResponse } from "next/server";
import { createTest, getTeacherTests } from "@/lib/dashboardData";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const url = new URL(request.url);
  return NextResponse.json({ tests: await getTeacherTests(teacherId, url.searchParams.get("classId") ?? undefined) });
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  try {
    const body = await request.json();
    const testId = await createTest(teacherId, body);
    return NextResponse.json({ testId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "테스트 생성 중 오류가 발생했습니다." }, { status: 400 });
  }
}
