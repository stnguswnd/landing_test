import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;

type ClassRow = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  logo_storage_path: string | null;
  logo_file_name: string | null;
  status: "active" | "archived";
  student_count: number;
  students: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; description: string | null }>;
  created_at: Date;
};

type ClassBody = {
  name?: string;
  description?: string;
  status?: "active" | "archived";
};

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || randomUUID().slice(0, 8);
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || `${randomUUID()}`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
}

async function signedUrl(path: string | null) {
  if (!path) return "";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(storageBuckets.images).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

function mapClass(row: ClassRow, teacherId: string) {
  return {
    id: row.id,
    teacherId,
    name: row.name,
    description: row.description ?? "",
    logoUrl: row.logo_url,
    logoStoragePath: row.logo_storage_path ?? undefined,
    logoFileName: row.logo_file_name ?? undefined,
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
        c.logo_url,
        c.logo_storage_path,
        c.logo_file_name,
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

  const classes = await Promise.all(result.rows.map(async (row) => ({
    ...mapClass(row, teacherId),
    logoUrl: (await signedUrl(row.logo_storage_path)) || row.logo_url || "",
  })));

  return NextResponse.json(classes);
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const contentType = request.headers.get("content-type") ?? "";
  const formData = contentType.includes("multipart/form-data") ? await request.formData() : null;
  const body = formData ? null : await request.json().catch(() => null) as ClassBody | null;

  const name = (formData ? String(formData.get("name") ?? "") : body?.name ?? "").trim();
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

  const classId = `class-${slugify(name)}-${randomUUID().slice(0, 6)}`;
  const logoFile = formData?.get("logoFile");
  let logoUrl: string | null = null;
  let logoStoragePath: string | null = null;
  let logoFileName: string | null = null;

  if (logoFile instanceof File && logoFile.size > 0) {
    if (!isImageFile(logoFile)) {
      return NextResponse.json({ error: "로고는 이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (logoFile.size > MAX_LOGO_FILE_SIZE) {
      return NextResponse.json({ error: "로고 이미지는 최대 5MB까지 업로드할 수 있습니다." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    logoFileName = safeFileName(logoFile.name);
    logoStoragePath = `classes/${classId}/logo/${randomUUID()}-${logoFileName}`;
    const { error } = await supabase.storage.from(storageBuckets.images).upload(
      logoStoragePath,
      Buffer.from(await logoFile.arrayBuffer()),
      { contentType: logoFile.type || "image/png", upsert: true },
    );

    if (error) {
      console.error({ bucket: storageBuckets.images, path: logoStoragePath, error });
      return NextResponse.json({ error: `로고 업로드에 실패했습니다: ${error.message}` }, { status: 500 });
    }

    logoUrl = supabase.storage.from(storageBuckets.images).getPublicUrl(logoStoragePath).data.publicUrl;
  }

  try {
    const result = await query<ClassRow>(
      `
        insert into classes (id, teacher_id, name, description, logo_url, logo_storage_path, logo_file_name, status)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id, name, description, logo_url, logo_storage_path, logo_file_name, status, created_at, 0::int as student_count, '[]'::json as students, '[]'::json as subjects
      `,
      [
        classId,
        teacherId,
        name,
        (formData ? String(formData.get("description") ?? "") : body?.description ?? "").trim() || null,
        logoUrl,
        logoStoragePath,
        logoFileName,
        (formData ? String(formData.get("status") ?? "active") : body?.status) === "archived" ? "archived" : "active",
      ],
    );

    return NextResponse.json({
      ...mapClass(result.rows[0], teacherId),
      logoUrl: (await signedUrl(result.rows[0].logo_storage_path)) || result.rows[0].logo_url || "",
    }, { status: 201 });
  } catch (error) {
    if (logoStoragePath) {
      const supabase = createSupabaseAdminClient();
      await supabase.storage.from(storageBuckets.images).remove([logoStoragePath]);
    }
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "이미 같은 이름의 반이 있습니다." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "반 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
