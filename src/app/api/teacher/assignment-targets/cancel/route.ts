import { NextResponse } from "next/server";

import { postgresPool } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type CandidateRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  target_status: string;
};

type StorageObjectRef = {
  storage_bucket: string;
  storage_path: string;
};

async function deleteIfTableExists(
  client: { query: typeof postgresPool.query },
  tableName: string,
  sql: string,
  values: unknown[],
) {
  const result = await client.query<{ exists: boolean }>("select to_regclass($1) is not null as exists", [`public.${tableName}`]);
  if (result.rows[0]?.exists) {
    const deleted = await client.query(sql, values);
    return deleted.rowCount ?? 0;
  }
  return 0;
}

async function tableExists(client: { query: typeof postgresPool.query }, tableName: string) {
  const result = await client.query<{ exists: boolean }>("select to_regclass($1) is not null as exists", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.exists);
}

async function collectStorageObjects(client: { query: typeof postgresPool.query }, targetIds: string[]) {
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
        join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
        where at.id = any($1::text[])
          and sia.storage_path is not null
      `,
      [targetIds],
    );
    result.rows.forEach((row) => add(row.storage_bucket, row.storage_path));
  }

  if (await tableExists(client, "submission_items")) {
    const result = await client.query<{ recording_storage_path: string | null }>(
      `
        select distinct si.recording_storage_path
        from submission_items si
        join submissions sub on sub.id = si.submission_id
        join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
        where at.id = any($1::text[])
          and si.recording_storage_path is not null
      `,
      [targetIds],
    );
    result.rows.forEach((row) => add(storageBuckets.audio, row.recording_storage_path));
  }

  if (await tableExists(client, "student_assignment_draft_attachments")) {
    const result = await client.query<StorageObjectRef>(
      `
        select distinct sada.storage_bucket, sada.storage_path
        from student_assignment_draft_attachments sada
        join student_assignment_drafts sad on sad.id = sada.draft_id
        join assignment_targets at on at.assignment_id = sad.assignment_id and at.student_id = sad.student_id
        where at.id = any($1::text[])
          and sada.storage_path is not null
      `,
      [targetIds],
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

export async function PATCH(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const body = await request.json().catch(() => null) as { targetIds?: string[] } | null;
  const targetIds = Array.from(new Set((body?.targetIds ?? []).filter(Boolean)));

  if (targetIds.length === 0) {
    return NextResponse.json({ error: "취소할 학생을 선택해주세요." }, { status: 400 });
  }

  const client = await postgresPool.connect();
  try {
    await client.query("begin");

    const candidates = await client.query<CandidateRow>(
      `
        select
          at.id,
          at.assignment_id,
          at.student_id,
          at.status as target_status
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $1
        where at.id = any($2::text[])
        for update of at
      `,
      [teacherId, targetIds],
    );

    const targetIdsToDelete = candidates.rows.map((row) => row.id);
    const foundIds = new Set(targetIdsToDelete);
    const skippedTargetIds = targetIds.filter((id) => !foundIds.has(id));

    let storageObjects: StorageObjectRef[] = [];
    let deletedSubmissionCount = 0;
    let deletedTargetCount = 0;
    if (targetIdsToDelete.length > 0) {
      storageObjects = await collectStorageObjects(client, targetIdsToDelete);

      await deleteIfTableExists(
        client,
        "submission_quiz_answers",
        `
          delete from submission_quiz_answers
          where submission_id in (
            select sub.id
            from submissions sub
            join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
            where at.id = any($1::text[])
          )
        `,
        [targetIdsToDelete],
      );
      await deleteIfTableExists(
        client,
        "submission_vocabulary_items",
        `
          delete from submission_vocabulary_items
          where submission_id in (
            select sub.id
            from submissions sub
            join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
            where at.id = any($1::text[])
          )
        `,
        [targetIdsToDelete],
      );
      await deleteIfTableExists(
        client,
        "teacher_feedback",
        `
          delete from teacher_feedback
          where submission_id in (
            select sub.id
            from submissions sub
            join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
            where at.id = any($1::text[])
          )
        `,
        [targetIdsToDelete],
      );
      await deleteIfTableExists(
        client,
        "submission_item_attachments",
        `
          delete from submission_item_attachments
          where submission_id in (
            select sub.id
            from submissions sub
            join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
            where at.id = any($1::text[])
          )
        `,
        [targetIdsToDelete],
      );
      await deleteIfTableExists(
        client,
        "submission_items",
        `
          delete from submission_items
          where submission_id in (
            select sub.id
            from submissions sub
            join assignment_targets at on at.assignment_id = sub.assignment_id and at.student_id = sub.student_id
            where at.id = any($1::text[])
          )
        `,
        [targetIdsToDelete],
      );
      await deleteIfTableExists(
        client,
        "student_ai_feedback_attempts",
        `
          delete from student_ai_feedback_attempts safa
          using assignment_targets at
          where at.id = any($1::text[])
            and safa.assignment_id = at.assignment_id
            and safa.student_id = at.student_id
        `,
        [targetIdsToDelete],
      );
      await deleteIfTableExists(
        client,
        "student_assignment_draft_attachments",
        `
          delete from student_assignment_draft_attachments sada
          using student_assignment_drafts sad, assignment_targets at
          where at.id = any($1::text[])
            and sad.assignment_id = at.assignment_id
            and sad.student_id = at.student_id
            and sada.draft_id = sad.id
        `,
        [targetIdsToDelete],
      );
      await deleteIfTableExists(
        client,
        "student_assignment_drafts",
        `
          delete from student_assignment_drafts sad
          using assignment_targets at
          where at.id = any($1::text[])
            and sad.assignment_id = at.assignment_id
            and sad.student_id = at.student_id
        `,
        [targetIdsToDelete],
      );

      const deletedSubmissions = await client.query(
        `
          delete from submissions sub
          using assignment_targets at
          where at.id = any($1::text[])
            and sub.assignment_id = at.assignment_id
            and sub.student_id = at.student_id
        `,
        [targetIdsToDelete],
      );
      deletedSubmissionCount = deletedSubmissions.rowCount ?? 0;

      const deletedTargets = await client.query(
        `
          delete from assignment_targets
          where id = any($1::text[])
        `,
        [targetIdsToDelete],
      );
      deletedTargetCount = deletedTargets.rowCount ?? 0;
    }

    await client.query("commit");

    const storageResult = await deleteStorageObjects(storageObjects);
    if (storageResult.errors.length > 0) {
      console.error("Storage deletion failed after assignment target hard delete", storageResult.errors);
    }

    return NextResponse.json({
      cancelledCount: deletedTargetCount,
      deletedTargetCount,
      deletedSubmissionCount,
      deletedStorageObjectCount: storageResult.deletedCount,
      storageDeleteErrors: storageResult.errors,
      skippedTargetIds,
    });
  } catch (error) {
    await client.query("rollback");
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
  } finally {
    client.release();
  }
}
