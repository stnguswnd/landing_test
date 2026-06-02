import { NextResponse } from "next/server";

import { postgresPool, query } from "@/lib/postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ studentId: string }>;
};

type HistoryRow = {
  id: string;
  student_id: string;
  date: string | Date;
  assignment_title: string;
  assignment_type: string;
  class_name: string | null;
  submit_status: "submitted" | "not_submitted" | "late";
  score: number | null;
  review_status: "pending" | "reviewed" | "none";
  detail_href: string | null;
  submission_id: string | null;
  assignment_target_id: string;
};

async function deleteIfTableExists(
  client: { query: typeof postgresPool.query },
  tableName: string,
  sql: string,
  values: unknown[],
) {
  const result = await client.query<{ exists: boolean }>("select to_regclass($1) is not null as exists", [`public.${tableName}`]);
  if (result.rows[0]?.exists) {
    await client.query(sql, values);
  }
}

async function tableExists(client: { query: typeof postgresPool.query }, tableName: string) {
  const result = await client.query<{ exists: boolean }>("select to_regclass($1) is not null as exists", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.exists);
}

type StorageObjectRef = {
  storage_bucket: string;
  storage_path: string;
};

async function collectStorageObjects(client: { query: typeof postgresPool.query }, assignmentId: string, studentId: string, submissionId: string) {
  const objects = new Map<string, StorageObjectRef>();
  const add = (bucket: string | null | undefined, path: string | null | undefined) => {
    if (!bucket || !path) return;
    objects.set(`${bucket}:${path}`, { storage_bucket: bucket, storage_path: path });
  };

  if (await tableExists(client, "submission_item_attachments")) {
    const result = await client.query<StorageObjectRef>(
      `
        select distinct storage_bucket, storage_path
        from submission_item_attachments
        where submission_id = $1
          and storage_path is not null
      `,
      [submissionId],
    );
    result.rows.forEach((row) => add(row.storage_bucket, row.storage_path));
  }

  if (await tableExists(client, "submission_items")) {
    const result = await client.query<{ recording_storage_path: string | null }>(
      `
        select distinct recording_storage_path
        from submission_items
        where submission_id = $1
          and recording_storage_path is not null
      `,
      [submissionId],
    );
    result.rows.forEach((row) => add(storageBuckets.audio, row.recording_storage_path));
  }

  if (await tableExists(client, "student_assignment_draft_attachments")) {
    const result = await client.query<StorageObjectRef>(
      `
        select distinct sada.storage_bucket, sada.storage_path
        from student_assignment_draft_attachments sada
        join student_assignment_drafts sad on sad.id = sada.draft_id
        where sad.assignment_id = $1
          and sad.student_id = $2
          and sada.storage_path is not null
      `,
      [assignmentId, studentId],
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

function toDate(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value.slice(0, 10);
}

export async function GET(_request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { studentId } = await params;
  const student = await query("select id from students where id = $1 and teacher_id = $2", [studentId, teacherId]);
  if (!student.rows[0]) return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });

  const result = await query<HistoryRow>(
    `
      select
        concat('history-', at.assignment_id, '-', at.student_id) as id,
        at.id as assignment_target_id,
        at.student_id,
        coalesce(at.submitted_at, at.due_at, a.due_at, a.created_at)::date as date,
        a.title as assignment_title,
        coalesce(
          case
            when part_summary.part_count = 1 then
              case part_summary.part_type
                when 'recording' then 'listening_recording'
                else part_summary.part_type
              end
          end,
          a.assignment_type
        ) as assignment_type,
        c.name as class_name,
        case
          when sub.id is not null then 'submitted'
          when coalesce(at.due_at, a.due_at) is not null and coalesce(at.due_at, a.due_at) < now() then 'late'
          else 'not_submitted'
        end as submit_status,
        tf.score,
        case
          when sub.status = 'reviewed' or at.reviewed = true or tf.id is not null then 'reviewed'
          when sub.id is not null then 'pending'
          else 'none'
        end as review_status,
        case when sub.id is not null then concat('/teacher/submissions/', sub.id) else null end as detail_href,
        sub.id as submission_id
      from assignment_targets at
      join assignments a on a.id = at.assignment_id and a.teacher_id = $2
      left join submissions sub on sub.assignment_id = a.id and sub.student_id = at.student_id
      left join teacher_feedback tf on tf.submission_id = sub.id
      left join classes c on c.id = coalesce(at.class_id, a.class_id) and c.teacher_id = a.teacher_id and c.status = 'active'
      left join lateral (
        select count(*)::int as part_count, min(ap.part_type) as part_type
        from assignment_parts ap
        where ap.assignment_id = a.id
          and ap.status = 'active'
      ) part_summary on true
      where at.student_id = $1
        and at.status <> 'cancelled'
        and (coalesce(at.class_id, a.class_id) is null or c.id is not null)
      group by at.assignment_id, at.id, at.student_id, at.submitted_at, at.due_at, a.due_at, a.created_at, a.title, a.assignment_type, part_summary.part_count, part_summary.part_type, c.name, sub.id, sub.status, at.reviewed, tf.id, tf.score
      order by date desc, a.title
    `,
    [studentId, teacherId],
  );

  return NextResponse.json(result.rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    assignmentTargetId: row.assignment_target_id,
    date: toDate(row.date),
    assignmentTitle: row.assignment_title,
    assignmentType: row.assignment_type,
    className: row.class_name ?? undefined,
    submitStatus: row.submit_status,
    score: row.score,
    reviewStatus: row.review_status,
    detailHref: row.detail_href ?? undefined,
    submissionId: row.submission_id ?? undefined,
  })));
}

export async function DELETE(request: Request, { params }: Params) {
  const { teacherId } = await requireTeacherSession();
  const { studentId } = await params;
  const body = await request.json().catch(() => ({}));
  const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
  if (!submissionId) return NextResponse.json({ error: "삭제할 제출 내역을 찾을 수 없습니다." }, { status: 400 });

  const client = await postgresPool.connect();
  let storageObjects: StorageObjectRef[] = [];
  try {
    await client.query("begin");

    const target = await client.query<{
      id: string;
      assignment_id: string;
      student_id: string;
      submission_id: string | null;
    }>(
      `
        select
          at.id,
          at.assignment_id,
          at.student_id,
          sub.id as submission_id
        from assignment_targets at
        join assignments a on a.id = at.assignment_id and a.teacher_id = $3
        left join submissions sub on sub.assignment_id = at.assignment_id and sub.student_id = at.student_id
        where at.student_id = $2
          and sub.id = $1
        for update of at
      `,
      [submissionId, studentId, teacherId],
    );

    const row = target.rows[0];
    if (!row) {
      await client.query("rollback");
      return NextResponse.json({ error: "학습 이력을 찾을 수 없습니다." }, { status: 404 });
    }

    if (row.submission_id) {
      storageObjects = await collectStorageObjects(client, row.assignment_id, row.student_id, row.submission_id);
      await deleteIfTableExists(client, "submission_quiz_answers", "delete from submission_quiz_answers where submission_id = $1", [row.submission_id]);
      await deleteIfTableExists(client, "submission_vocabulary_items", "delete from submission_vocabulary_items where submission_id = $1", [row.submission_id]);
      await deleteIfTableExists(client, "teacher_feedback", "delete from teacher_feedback where submission_id = $1", [row.submission_id]);
      await deleteIfTableExists(client, "submission_item_attachments", "delete from submission_item_attachments where submission_id = $1", [row.submission_id]);
      await deleteIfTableExists(client, "submission_items", "delete from submission_items where submission_id = $1", [row.submission_id]);
      await client.query("delete from submissions where id = $1", [row.submission_id]);
      await deleteIfTableExists(
        client,
        "student_assignment_draft_attachments",
        `
          delete from student_assignment_draft_attachments sada
          using student_assignment_drafts sad
          where sad.assignment_id = $1
            and sad.student_id = $2
            and sada.draft_id = sad.id
        `,
        [row.assignment_id, row.student_id],
      );
      await deleteIfTableExists(
        client,
        "student_assignment_drafts",
        "delete from student_assignment_drafts where assignment_id = $1 and student_id = $2",
        [row.assignment_id, row.student_id],
      );
    }

    await deleteIfTableExists(
      client,
      "student_ai_feedback_attempts",
      "delete from student_ai_feedback_attempts where assignment_id = $1 and student_id = $2",
      [row.assignment_id, row.student_id],
    );
    await client.query(
      `
        update assignment_targets
        set status = 'assigned',
            submitted_at = null,
            reviewed = false,
            feedback = null,
            updated_at = now()
        where id = $1 and status <> 'cancelled'
      `,
      [row.id],
    );

    await client.query("commit");
    const storageResult = await deleteStorageObjects(storageObjects);
    if (storageResult.errors.length > 0) {
      console.error("Storage deletion failed after student history delete", storageResult.errors);
    }
    return NextResponse.json({
      deleted: true,
      deletedStorageObjectCount: storageResult.deletedCount,
      storageDeleteErrors: storageResult.errors,
    });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return NextResponse.json({ error: "제출 내역 삭제 중 오류가 발생했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
