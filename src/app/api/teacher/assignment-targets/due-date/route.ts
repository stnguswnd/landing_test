import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const body = await request.json().catch(() => null) as { targetIds?: string[]; dueAt?: string } | null;
  const targetIds = Array.from(new Set((body?.targetIds ?? []).filter(Boolean)));
  const dueAt = body?.dueAt ? new Date(body.dueAt) : null;

  if (targetIds.length === 0 || !dueAt || Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "변경할 학생과 새 마감일을 입력해주세요." }, { status: 400 });
  }

  const result = await query<{ id: string }>(
    `
      update assignment_targets at
      set due_at = $1,
          updated_at = now()
      from assignments a
      where a.id = at.assignment_id
        and a.teacher_id = $2
        and at.id = any($3::text[])
        and at.status <> 'cancelled'
      returning at.id
    `,
    [dueAt, teacherId, targetIds],
  );

  return NextResponse.json({ ok: true, updatedCount: result.rowCount ?? result.rows.length });
}
