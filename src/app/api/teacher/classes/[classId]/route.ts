import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ classId: string }>;
};

type ClassHistoryCounts = {
  eventCount: number;
  assignmentCount: number;
  targetCount: number;
  testCount: number;
  testResultCount: number;
  noticeTargetCount: number;
};

const historyTables: Array<{ table: string; key: keyof ClassHistoryCounts }> = [
  { table: "class_calendar_events", key: "eventCount" },
  { table: "assignments", key: "assignmentCount" },
  { table: "assignment_targets", key: "targetCount" },
  { table: "tests", key: "testCount" },
  { table: "test_results", key: "testResultCount" },
  { table: "notice_targets", key: "noticeTargetCount" },
];

function emptyCounts(): ClassHistoryCounts {
  return {
    eventCount: 0,
    assignmentCount: 0,
    targetCount: 0,
    testCount: 0,
    testResultCount: 0,
    noticeTargetCount: 0,
  };
}

async function getClassHistoryCounts(classId: string) {
  const counts = emptyCounts();

  for (const item of historyTables) {
    const exists = await query<{ exists: string | null }>("select to_regclass($1) as exists", [`public.${item.table}`]);
    if (!exists.rows[0]?.exists) continue;

    const result = await query<{ count: string }>(`select count(*)::text as count from ${item.table} where class_id = $1`, [classId]);
    counts[item.key] = Number(result.rows[0]?.count ?? 0);
  }

  return counts;
}

function hasHistory(counts: ClassHistoryCounts) {
  return Object.values(counts).some((count) => count > 0);
}

export async function GET(request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await params;
  const result = await query(
    `
      select id, teacher_id, name, description, status, created_at
      from classes
      where id = $1 and teacher_id = $2
      limit 1
    `,
    [classId, teacherId],
  );

  if (!result.rows[0]) return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });

  const url = new URL(request.url);
  if (url.searchParams.get("deletePreview") === "1") {
    const counts = await getClassHistoryCounts(classId);
    const archived = hasHistory(counts);
    return NextResponse.json({
      ok: true,
      deleted: !archived,
      archived,
      reason: archived ? "has_history" : "no_history",
      counts,
    });
  }

  return NextResponse.json({ class: result.rows[0] });
}

export async function PATCH(request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await params;
  const body = await request.json().catch(() => null) as {
    name?: string;
    description?: string;
  } | null;

  const name = body?.name?.trim();
  const description = body?.description?.trim() || null;

  if (body && "status" in body) {
    if (body.status !== "active") {
      return NextResponse.json({ error: "지원하지 않는 반 상태입니다." }, { status: 400 });
    }

    try {
      const result = await query(
        `
          update classes
          set status = 'active',
              updated_at = now()
          where id = $1
            and teacher_id = $2
            and status = 'archived'
          returning id, teacher_id, name, description, status, created_at, updated_at
        `,
        [classId, teacherId],
      );

      if (!result.rows[0]) {
        return NextResponse.json({ error: "재활성화할 비활성 반을 찾을 수 없습니다." }, { status: 404 });
      }

      return NextResponse.json({ class: result.rows[0] });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "같은 이름의 활성 반이 있어 재활성화할 수 없습니다." }, { status: 409 });
      }
      console.error(error);
      return NextResponse.json({ error: "반을 재활성화하지 못했습니다." }, { status: 500 });
    }
  }

  if (!name) {
    return NextResponse.json({ error: "반 이름을 입력해주세요." }, { status: 400 });
  }

  try {
    const result = await query(
      `
        update classes
        set name = $3,
            description = $4,
            updated_at = now()
        where id = $1
          and teacher_id = $2
        returning id, teacher_id, name, description, status, created_at, updated_at
      `,
      [classId, teacherId, name, description],
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ class: result.rows[0] });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 반 이름입니다." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "반 정보를 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await params;
  const existing = await query("select id from classes where id = $1 and teacher_id = $2 limit 1", [classId, teacherId]);

  if (!existing.rows[0]) {
    return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
  }

  const counts = await getClassHistoryCounts(classId);
  if (hasHistory(counts)) {
    await query("update classes set status = 'archived', updated_at = now() where id = $1 and teacher_id = $2", [classId, teacherId]);
    return NextResponse.json({
      ok: true,
      deleted: false,
      archived: true,
      reason: "has_history",
      counts,
    });
  }

  await query("delete from classes where id = $1 and teacher_id = $2", [classId, teacherId]);
  return NextResponse.json({
    ok: true,
    deleted: true,
    archived: false,
    reason: "no_history",
  });
}
