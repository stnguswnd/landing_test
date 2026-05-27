import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type ClassSubjectRow = {
  id: string;
  class_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

function mapSubject(row: ClassSubjectRow) {
  return {
    id: row.id,
    classId: row.class_id,
    name: row.name,
    description: row.description ?? "",
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function assertClass(teacherId: string, classId: string) {
  const result = await query("select id from classes where id = $1 and teacher_id = $2 limit 1", [classId, teacherId]);
  return Boolean(result.rows[0]);
}

export async function GET(_request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  if (!(await assertClass(teacherId, classId))) {
    return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
  }

  const result = await query<ClassSubjectRow>(
    `
      select id, class_id, name, description, status, created_at, updated_at
      from class_subjects
      where teacher_id = $1
        and class_id = $2
        and status = 'active'
      order by created_at asc, name asc
    `,
    [teacherId, classId],
  );

  return NextResponse.json({ subjects: result.rows.map(mapSubject) });
}

export async function POST(request: Request, context: { params: Promise<{ classId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await context.params;
  const body = await request.json().catch(() => null) as { name?: string; description?: string } | null;
  const name = body?.name?.trim();
  const description = body?.description?.trim() || null;

  if (!(await assertClass(teacherId, classId))) {
    return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!name) {
    return NextResponse.json({ error: "과목명을 입력해주세요." }, { status: 400 });
  }

  try {
    const result = await query<ClassSubjectRow>(
      `
        insert into class_subjects (id, teacher_id, class_id, name, description)
        values ($1, $2, $3, $4, $5)
        returning id, class_id, name, description, status, created_at, updated_at
      `,
      [`class-subject-${randomUUID()}`, teacherId, classId, name, description],
    );
    return NextResponse.json({ subject: mapSubject(result.rows[0]) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "이미 같은 이름의 과목이 있습니다." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "과목을 저장하지 못했습니다." }, { status: 500 });
  }
}
