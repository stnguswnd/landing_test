import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;

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

type ClassBody = {
  name?: string;
  description?: string;
  status?: "active" | "archived";
  removeLogo?: boolean;
};

type ClassRow = {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  logo_storage_path: string | null;
  logo_file_name: string | null;
  status: "active" | "archived";
  created_at: Date;
  updated_at?: Date;
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

async function withSignedLogo(row: ClassRow) {
  return {
    ...row,
    logo_url: (await signedUrl(row.logo_storage_path)) || row.logo_url || null,
  };
}

export async function GET(request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await params;
  const result = await query<ClassRow>(
    `
      select id, teacher_id, name, description, logo_url, logo_storage_path, logo_file_name, status, created_at
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

  return NextResponse.json({ class: await withSignedLogo(result.rows[0]) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { classId } = await params;
  const contentType = request.headers.get("content-type") ?? "";
  const formData = contentType.includes("multipart/form-data") ? await request.formData() : null;
  const body = formData ? null : await request.json().catch(() => null) as ClassBody | null;
  const requestedStatus = formData ? String(formData.get("status") ?? "") : body?.status;

  if (requestedStatus && requestedStatus !== "active") {
    return NextResponse.json({ error: "지원하지 않는 반 상태입니다." }, { status: 400 });
  }

  if (requestedStatus === "active") {
    try {
      const result = await query<ClassRow>(
        `
          update classes
          set status = 'active',
              updated_at = now()
          where id = $1
            and teacher_id = $2
            and status = 'archived'
          returning id, teacher_id, name, description, logo_url, logo_storage_path, logo_file_name, status, created_at, updated_at
        `,
        [classId, teacherId],
      );

      if (!result.rows[0]) {
        return NextResponse.json({ error: "재활성화할 반을 찾을 수 없습니다." }, { status: 404 });
      }

      return NextResponse.json({ class: await withSignedLogo(result.rows[0]) });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "같은 이름의 활성 반이 있어 재활성화할 수 없습니다." }, { status: 409 });
      }
      console.error(error);
      return NextResponse.json({ error: "반을 재활성화하지 못했습니다." }, { status: 500 });
    }
  }

  const name = (formData ? String(formData.get("name") ?? "") : body?.name ?? "").trim();
  const description = (formData ? String(formData.get("description") ?? "") : body?.description ?? "").trim() || null;
  if (!name) {
    return NextResponse.json({ error: "반 이름을 입력해주세요." }, { status: 400 });
  }

  const existing = await query<{ logo_storage_path: string | null }>(
    "select logo_storage_path from classes where id = $1 and teacher_id = $2 limit 1",
    [classId, teacherId],
  );
  if (!existing.rows[0]) {
    return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
  }

  const logoFile = formData?.get("logoFile");
  const removeLogo = formData?.get("removeLogo") === "1" || body?.removeLogo === true;
  let logoUrl: string | null | undefined;
  let logoStoragePath: string | null | undefined;
  let logoFileName: string | null | undefined;

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
  } else if (removeLogo) {
    logoUrl = null;
    logoStoragePath = null;
    logoFileName = null;
  }

  try {
    const result = await query<ClassRow>(
      `
        update classes
        set name = $3,
            description = $4,
            logo_url = case when $5::boolean then $6 else logo_url end,
            logo_storage_path = case when $5::boolean then $7 else logo_storage_path end,
            logo_file_name = case when $5::boolean then $8 else logo_file_name end,
            updated_at = now()
        where id = $1
          and teacher_id = $2
        returning id, teacher_id, name, description, logo_url, logo_storage_path, logo_file_name, status, created_at, updated_at
      `,
      [classId, teacherId, name, description, logoStoragePath !== undefined, logoUrl ?? null, logoStoragePath ?? null, logoFileName ?? null],
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: "반을 찾을 수 없습니다." }, { status: 404 });
    }

    if (logoStoragePath !== undefined && existing.rows[0].logo_storage_path && existing.rows[0].logo_storage_path !== logoStoragePath) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.storage.from(storageBuckets.images).remove([existing.rows[0].logo_storage_path]);
      if (error) console.error(error);
    }

    return NextResponse.json({ class: await withSignedLogo(result.rows[0]) });
  } catch (error) {
    if (logoStoragePath) {
      const supabase = createSupabaseAdminClient();
      await supabase.storage.from(storageBuckets.images).remove([logoStoragePath]);
    }
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
  const existing = await query<{ id: string; logo_storage_path: string | null }>(
    "select id, logo_storage_path from classes where id = $1 and teacher_id = $2 limit 1",
    [classId, teacherId],
  );

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
  if (existing.rows[0].logo_storage_path) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(storageBuckets.images).remove([existing.rows[0].logo_storage_path]);
    if (error) console.error(error);
  }
  return NextResponse.json({
    ok: true,
    deleted: true,
    archived: false,
    reason: "no_history",
  });
}
