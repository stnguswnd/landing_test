import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type ClassRow = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  student_count: number;
  students: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; description: string | null }>;
  created_at: Date;
};

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || randomUUID().slice(0, 8);
}

function mapClass(row: ClassRow, teacherId: string) {
  return {
    id: row.id,
    teacherId,
    name: row.name,
    description: row.description ?? "",
    status: row.status,
    studentCount: row.student_count,
    students: row.students,
    subjects: row.subjects ?? [],
    createdAt: row.created_at.toISOString(),
  };
}

export async function GET() {
  const { teacherId } = await requireTeacherSession();
  const result = await query<ClassRow>(
    `
      select
        c.id,
        c.name,
        c.description,
        c.status,
        c.created_at,
        count(distinct s.id)::int as student_count,
        coalesce(
          json_agg(
            distinct jsonb_build_object('id', s.id, 'name', s.name)
          ) filter (where s.id is not null),
          '[]'::json
        ) as students,
        coalesce(
          (
            select json_agg(
              json_build_object('id', cs.id, 'name', cs.name, 'description', cs.description)
              order by cs.created_at asc, cs.name asc
            )
            from class_subjects cs
            where cs.class_id = c.id
              and cs.teacher_id = c.teacher_id
              and cs.status = 'active'
          ),
          '[]'::json
        ) as subjects
      from classes c
      left join class_memberships cm on cm.class_id = c.id
      left join students s on s.id = cm.student_id and s.teacher_id = c.teacher_id
      where c.teacher_id = $1
      group by c.id
      order by c.created_at asc
    `,
    [teacherId],
  );

  return NextResponse.json(result.rows.map((row) => mapClass(row, teacherId)));
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const body = await request.json().catch(() => null) as {
    name?: string;
    description?: string;
    status?: "active" | "archived";
  } | null;

  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "반 이름을 입력해주세요." }, { status: 400 });
  }

  const duplicate = await query(
    "select id from classes where teacher_id = $1 and lower(name) = lower($2) limit 1",
    [teacherId, name],
  );
  if (duplicate.rows[0]) {
    return NextResponse.json({ error: "이미 같은 이름의 반이 있습니다." }, { status: 409 });
  }

  try {
    const result = await query<ClassRow>(
      `
        insert into classes (id, teacher_id, name, description, status)
        values ($1, $2, $3, $4, $5)
        returning id, name, description, status, created_at, 0::int as student_count, '[]'::json as students, '[]'::json as subjects
      `,
      [
        `class-${slugify(name)}-${randomUUID().slice(0, 6)}`,
        teacherId,
        name,
        body?.description?.trim() || null,
        body?.status ?? "active",
      ],
    );

    return NextResponse.json(mapClass(result.rows[0], teacherId), { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "이미 같은 이름의 반이 있습니다." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "반 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
