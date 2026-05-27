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

export async function PATCH(request: Request, context: { params: Promise<{ classId: string; subjectId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId, subjectId } = await context.params;
  const body = await request.json().catch(() => null) as { name?: string; description?: string } | null;
  const name = body?.name?.trim();
  const description = body?.description?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "과목명을 입력해주세요." }, { status: 400 });
  }

  try {
    const result = await query<ClassSubjectRow>(
      `
        update class_subjects
        set name = $4,
            description = $5,
            updated_at = now()
        where id = $1
          and class_id = $2
          and teacher_id = $3
        returning id, class_id, name, description, status, created_at, updated_at
      `,
      [subjectId, classId, teacherId, name, description],
    );
    if (!result.rows[0]) {
      return NextResponse.json({ error: "과목을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ subject: mapSubject(result.rows[0]) });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "이미 같은 이름의 과목이 있습니다." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "과목을 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ classId: string; subjectId: string }> }) {
  const { teacherId } = await requireTeacherSession();
  const { classId, subjectId } = await context.params;

  const result = await query<ClassSubjectRow>(
    `
      update class_subjects
      set status = 'archived',
          updated_at = now()
      where id = $1
        and class_id = $2
        and teacher_id = $3
      returning id, class_id, name, description, status, created_at, updated_at
    `,
    [subjectId, classId, teacherId],
  );
  if (!result.rows[0]) {
    return NextResponse.json({ error: "과목을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ subject: mapSubject(result.rows[0]) });
}
