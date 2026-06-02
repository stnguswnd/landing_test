import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type BulkTargetInput = {
  classId: string;
  targetType: "all" | "partial";
  studentIds: string[];
};

type StorageObjectRef = {
  storage_bucket: string;
  storage_path: string;
};

type StudentTargetRow = {
  id: string;
};

async function tableExists(client: { query: typeof postgresPool.query }, tableName: string) {
  const result = await client.query<{ exists: boolean }>("select to_regclass($1) is not null as exists", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.exists);
}

async function deleteIfTableExists(
  client: { query: typeof postgresPool.query },
  tableName: string,
  sql: string,
  values: unknown[],
) {
  if (!(await tableExists(client, tableName))) return 0;
  const deleted = await client.query(sql, values);
  return deleted.rowCount ?? 0;
}

async function collectStorageObjects(client: { query: typeof postgresPool.query }, targetIds: string[], teacherId: string) {
  const objects = new Map<string, StorageObjectRef>();
  const add = (bucket: string | null | undefined, path: string | null | undefined) => {
    if (!bucket || !path) return;
    objects.set(`${bucket}:${path}`, { storage_bucket: bucket, storage_path: path });
  };

  if (await tableExists(client, "submission_item_attachments")) {
    const result = await client.query<StorageObjectRef>(
      `
        select distinct sia.storage_bucket, sia.storage_path
        from submission_item_attachments sia
        join submissions sub on sub.id = sia.submission_id
        join assignments a on a.id = sub.assignment_id and a.teacher_id = $2
        join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
        where at.id = any($1::text[])
          and sia.storage_path is not null
      `,
      [targetIds, teacherId],
    );
    result.rows.forEach((row) => add(row.storage_bucket, row.storage_path));
  }

  if (await tableExists(client, "submission_items")) {
    const result = await client.query<{ recording_storage_path: string | null }>(
      `
        select distinct si.recording_storage_path
        from submission_items si
        join submissions sub on sub.id = si.submission_id
        join assignments a on a.id = sub.assignment_id and a.teacher_id = $2
        join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
        where at.id = any($1::text[])
          and si.recording_storage_path is not null
      `,
      [targetIds, teacherId],
    );
    result.rows.forEach((row) => add(storageBuckets.audio, row.recording_storage_path));
  }

  if (await tableExists(client, "student_assignment_draft_attachments")) {
    const result = await client.query<StorageObjectRef>(
      `
        select distinct sada.storage_bucket, sada.storage_path
        from student_assignment_draft_attachments sada
        join student_assignment_drafts sad on sad.id = sada.draft_id
        join assignments a on a.id = sad.assignment_id and a.teacher_id = $2
        join assignment_targets at on at.assignment_id = sad.assignment_id and at.student_id = sad.student_id
        where at.id = any($1::text[])
          and sada.storage_path is not null
      `,
      [targetIds, teacherId],
    );
    result.rows.forEach((row) => add(row.storage_bucket, row.storage_path));
  }

  return Array.from(objects.values());
}

async function deleteStorageObjects(objects: StorageObjectRef[]) {
  const supabase = createSupabaseAdminClient();
  const objectsByBucket = new Map<string, string[]>();

  for (const object of objects) {
    const current = objectsByBucket.get(object.storage_bucket) ?? [];
    current.push(object.storage_path);
    objectsByBucket.set(object.storage_bucket, current);
  }

  let deletedCount = 0;
  const errors: string[] = [];
  for (const [bucket, paths] of objectsByBucket.entries()) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      errors.push(`${bucket}: ${error.message}`);
      continue;
    }
    deletedCount += paths.length;
  }

  return { deletedCount, errors };
}

export async function POST(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const body = await request.json().catch(() => null) as { assignmentIds?: string[]; targets?: BulkTargetInput[] } | null;
  const assignmentIds = Array.from(new Set((body?.assignmentIds ?? []).filter(Boolean)));
  const targets = body?.targets ?? [];

  if (assignmentIds.length === 0) {
    return NextResponse.json({ error: "배정 취소할 숙제를 먼저 선택해주세요." }, { status: 400 });
  }
  if (targets.length === 0) {
    return NextResponse.json({ error: "배정 취소할 반을 1개 이상 선택해주세요." }, { status: 400 });
  }

  for (const target of targets) {
    if (!target.classId) {
      return NextResponse.json({ error: "선택한 반 정보를 확인해주세요." }, { status: 400 });
    }
    if (target.targetType === "partial" && target.studentIds.length === 0) {
      return NextResponse.json({ error: "일부 학생만 취소할 때는 학생을 1명 이상 선택해주세요." }, { status: 400 });
    }
  }

  const client = await postgresPool.connect();
  let storageObjects: StorageObjectRef[] = [];

  try {
    await client.query("begin");

    const assignmentResult = await client.query<{ id: string }>(
      `
        select id
        from assignments
        where teacher_id = $1
          and id = any($2::text[])
        for update
      `,
      [teacherId, assignmentIds],
    );
    const validAssignmentIds = assignmentResult.rows.map((row) => row.id);

    if (validAssignmentIds.length === 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "배정 취소할 숙제를 찾을 수 없습니다." }, { status: 404 });
    }

    const targetIdSet = new Set<string>();
    for (const target of targets) {
      const targetResult = await client.query<StudentTargetRow>(
        `
          select at.id
          from assignment_targets at
          join assignments a on a.id = at.assignment_id and a.teacher_id = $4
          where at.assignment_id = any($1::text[])
            and at.class_id = $2
            and (
              $3::boolean
              or at.student_id = any($5::text[])
            )
        `,
        [validAssignmentIds, target.classId, target.targetType === "all", teacherId, target.studentIds],
      );
      targetResult.rows.forEach((row) => targetIdSet.add(row.id));
    }
    const targetIds = Array.from(targetIdSet);

    if (targetIds.length === 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "선택한 반/학생에 취소할 배정이 없습니다." }, { status: 400 });
    }

    storageObjects = await collectStorageObjects(client, targetIds, teacherId);

    await deleteIfTableExists(
      client,
      "submission_quiz_answers",
      `
        delete from submission_quiz_answers
        where submission_id in (
          select sub.id
          from submissions sub
          join assignments a on a.id = sub.assignment_id and a.teacher_id = $2
          join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
          where at.id = any($1::text[])
        )
      `,
      [targetIds, teacherId],
    );
    await deleteIfTableExists(
      client,
      "submission_vocabulary_items",
      `
        delete from submission_vocabulary_items
        where submission_id in (
          select sub.id
          from submissions sub
          join assignments a on a.id = sub.assignment_id and a.teacher_id = $2
          join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
          where at.id = any($1::text[])
        )
      `,
      [targetIds, teacherId],
    );
    await deleteIfTableExists(
      client,
      "teacher_feedback",
      `
        delete from teacher_feedback
        where submission_id in (
          select sub.id
          from submissions sub
          join assignments a on a.id = sub.assignment_id and a.teacher_id = $2
          join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
          where at.id = any($1::text[])
        )
      `,
      [targetIds, teacherId],
    );
    await deleteIfTableExists(
      client,
      "submission_item_attachments",
      `
        delete from submission_item_attachments
        where submission_id in (
          select sub.id
          from submissions sub
          join assignments a on a.id = sub.assignment_id and a.teacher_id = $2
          join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
          where at.id = any($1::text[])
        )
      `,
      [targetIds, teacherId],
    );
    await deleteIfTableExists(
      client,
      "submission_items",
      `
        delete from submission_items
        where submission_id in (
          select sub.id
          from submissions sub
          join assignments a on a.id = sub.assignment_id and a.teacher_id = $2
          join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
          where at.id = any($1::text[])
        )
      `,
      [targetIds, teacherId],
    );
    await deleteIfTableExists(
      client,
      "student_ai_feedback_attempts",
      `
        delete from student_ai_feedback_attempts safa
        using assignment_targets at, assignments a
        where at.id = any($1::text[])
          and a.id = at.assignment_id
          and a.teacher_id = $2
          and safa.assignment_id = at.assignment_id
          and safa.student_id = at.student_id
      `,
      [targetIds, teacherId],
    );
    await deleteIfTableExists(
      client,
      "student_assignment_draft_attachments",
      `
        delete from student_assignment_draft_attachments sada
        using student_assignment_drafts sad, assignment_targets at, assignments a
        where sad.id = sada.draft_id
          and at.id = any($1::text[])
          and a.id = at.assignment_id
          and a.teacher_id = $2
          and sad.assignment_id = at.assignment_id
          and sad.student_id = at.student_id
      `,
      [targetIds, teacherId],
    );
    await deleteIfTableExists(
      client,
      "student_assignment_drafts",
      `
        delete from student_assignment_drafts sad
        using assignment_targets at, assignments a
        where at.id = any($1::text[])
          and a.id = at.assignment_id
          and a.teacher_id = $2
          and sad.assignment_id = at.assignment_id
          and sad.student_id = at.student_id
      `,
      [targetIds, teacherId],
    );

    const deletedSubmissions = await client.query(
      `
        delete from submissions sub
        using assignment_targets at, assignments a
        where at.id = any($1::text[])
          and a.id = at.assignment_id
          and a.teacher_id = $2
          and sub.assignment_id = at.assignment_id
          and sub.student_id = at.student_id
      `,
      [targetIds, teacherId],
    );

    const deletedTargets = await client.query(
      `
        delete from assignment_targets at
        using assignments a
        where a.id = at.assignment_id
          and a.teacher_id = $2
          and at.id = any($1::text[])
      `,
      [targetIds, teacherId],
    );

    await client.query("commit");

    const storageResult = await deleteStorageObjects(storageObjects);
    if (storageResult.errors.length > 0) {
      console.error("Storage deletion failed after bulk assignment target delete", storageResult.errors);
    }

    return NextResponse.json({
      ok: true,
      assignmentCount: validAssignmentIds.length,
      deletedTargetCount: deletedTargets.rowCount ?? 0,
      deletedSubmissionCount: deletedSubmissions.rowCount ?? 0,
      deletedStorageObjectCount: storageResult.deletedCount,
      storageDeleteErrors: storageResult.errors,
    });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error);
    return NextResponse.json({ error: "선택한 숙제 배정 취소 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
