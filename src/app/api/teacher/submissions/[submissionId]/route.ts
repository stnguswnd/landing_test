import { NextResponse } from "next/server";

import { getTeacherSubmissionDetail } from "@/server/teacher/submissionDetail";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { submissionId } = await context.params;
  const detail = await getTeacherSubmissionDetail(teacherId, submissionId);

  if (!detail) {
    return NextResponse.json({ error: "제출을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
