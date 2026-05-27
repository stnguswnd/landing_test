import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type CandidateRow = {
  id: string;
  target_status: string;
};

export async function PATCH(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const body = await request.json().catch(() => null) as { targetIds?: string[] } | null;
  const targetIds = Array.from(new Set((body?.targetIds ?? []).filter(Boolean)));

  if (targetIds.length === 0) {
    return NextResponse.json({ error: "취소할 학생을 선택해주세요." }, { status: 400 });
  }

  try {
    const candidates = await query<CandidateRow>(
      `
        select
          at.id,
          at.status as target_status
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $1
        where at.id = any($2::text[])
      `,
      [teacherId, targetIds],
    );

    const cancellableIds = candidates.rows
      .filter((row) => row.target_status !== "cancelled")
      .map((row) => row.id);
    const skippedTargetIds = candidates.rows.filter((row) => !cancellableIds.includes(row.id)).map((row) => row.id);

    if (cancellableIds.length > 0) {
      await query(
        `
          update assignment_targets
          set status = 'cancelled',
              cancelled_at = now(),
              cancelled_by = $1,
              updated_at = now()
          where id = any($2::text[])
        `,
        [teacherId, cancellableIds],
      );
    }

    return NextResponse.json({
      cancelledCount: cancellableIds.length,
      skippedTargetIds,
    });
  } catch (error) {
    console.error(error);
    const code = (error as { code?: string }).code;
    if (code === "42703" || code === "23514") {
      return NextResponse.json(
        {
          error: "배정 취소 DB 구조가 아직 적용되지 않았습니다. database/assignment_target_management.sql 마이그레이션을 먼저 실행해주세요.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "배정 취소 중 오류가 발생했습니다." }, { status: 500 });
  }
}
