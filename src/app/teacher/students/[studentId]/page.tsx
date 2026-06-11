import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { query } from "@/lib/postgres";
import { assignmentTypeLabel as formatAssignmentTypeLabel } from "@/lib/assignmentTypes";
import { getTeacherSession } from "@/server/teacher/session";
import { SubmissionDeleteButton } from "./SubmissionDeleteButton";
import type {
  ManagedStudent,
  StudentLearningHistory,
} from "@/features/student-management/types/studentManagement";

type StudentRow = {
  id: string;
  student_login_id: string;
  name: string;
  school_name: string | null;
  grade: string | null;
  avatar_key: string;
  memo: string | null;
  status: "active" | "inactive";
  class_ids: string[] | null;
  class_names: string[] | null;
  created_at: Date;
  updated_at: Date;
};

type HistoryRow = {
  id: string;
  student_id: string;
  date: string | Date;
  assignment_title: string;
  assignment_type: StudentLearningHistory["assignmentType"];
  assignment_types: StudentLearningHistory["assignmentType"][] | null;
  class_name: string | null;
  submit_status: StudentLearningHistory["submitStatus"];
  score: number | null;
  review_status: StudentLearningHistory["reviewStatus"];
  detail_href: string | null;
  submission_id: string | null;
  assignment_target_id: string;
};

function toDate(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value.slice(0, 10);
}

function mapStudent(row: StudentRow): ManagedStudent {
  return {
    id: row.id,
    studentId: row.student_login_id,
    studentLoginId: row.student_login_id,
    name: row.name,
    schoolName: row.school_name ?? undefined,
    grade: row.grade ?? undefined,
    classIds: row.class_ids ?? [],
    classNames: row.class_names ?? [],
    avatarKey: row.avatar_key,
    memo: row.memo ?? undefined,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapHistory(row: HistoryRow): StudentLearningHistory {
  return {
    id: row.id,
    studentId: row.student_id,
    date: toDate(row.date),
    assignmentTitle: row.assignment_title,
    assignmentType: row.assignment_type,
    assignmentTypes: row.assignment_types ?? [row.assignment_type],
    className: row.class_name ?? undefined,
    submitStatus: row.submit_status,
    score: row.score,
    reviewStatus: row.review_status,
    detailHref: row.detail_href ?? undefined,
    submissionId: row.submission_id ?? undefined,
    assignmentTargetId: row.assignment_target_id,
  };
}

async function getStudent(teacherId: string, studentId: string) {
  const result = await query<StudentRow>(
    `
      select
        s.id,
        s.student_login_id,
        s.name,
        s.school_name,
        s.grade,
        s.avatar_key,
        s.memo,
        s.status,
        coalesce(array_remove(array_agg(c.id order by c.name), null), array[]::text[]) as class_ids,
        coalesce(array_remove(array_agg(c.name order by c.name), null), array[]::text[]) as class_names,
        s.created_at,
        s.updated_at
      from students s
      left join class_memberships cm on cm.student_id = s.id
      left join classes c
        on c.id = cm.class_id
       and c.teacher_id = s.teacher_id
       and c.status = 'active'
      where s.id = $1 and s.teacher_id = $2
      group by s.id
    `,
    [studentId, teacherId],
  );

  return result.rows[0] ? mapStudent(result.rows[0]) : null;
}

async function getLearningHistory(teacherId: string, studentId: string) {
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
              part_summary.assignment_types[1]
          end,
          a.assignment_type
        ) as assignment_type,
        coalesce(part_summary.assignment_types, array[a.assignment_type]) as assignment_types,
        c.name as class_name,
        case
          when sub.id is not null then 'submitted'
          when coalesce(at.due_at, a.due_at) is not null and coalesce(at.due_at, a.due_at) < now() then 'late'
          else 'not_submitted'
        end as submit_status,
        tf.score,
        case
          when sub.status = 'returned' then 'returned'
          when sub.status = 'reviewed' or at.reviewed = true or tf.id is not null then 'approved'
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
        select count(*)::int as part_count, array_agg(part_types.assignment_type order by part_types.first_order) as assignment_types
        from (
          select
            case ap.part_type
              when 'recording' then 'listening_recording'
              else ap.part_type
            end as assignment_type,
            min(ap.order_index) as first_order
          from assignment_parts ap
          where ap.assignment_id = a.id
            and ap.status = 'active'
            and ap.part_type <> 'instruction'
          group by
            case ap.part_type
              when 'recording' then 'listening_recording'
              else ap.part_type
            end
        ) part_types
      ) part_summary on true
      where at.student_id = $1
        and at.status <> 'cancelled'
        and (coalesce(at.class_id, a.class_id) is null or c.id is not null)
      group by
        at.assignment_id,
        at.id,
        at.student_id,
        at.submitted_at,
        at.due_at,
        a.due_at,
        a.created_at,
        a.title,
        a.assignment_type,
        part_summary.part_count,
        part_summary.assignment_types,
        c.name,
        sub.id,
        sub.status,
        sub.id,
        at.reviewed,
        tf.id,
        tf.score
      order by date desc, a.title
    `,
    [studentId, teacherId],
  );

  return result.rows.map(mapHistory);
}

function assignmentTypeLabel(type: string) {
  return formatAssignmentTypeLabel(type);
}

function AssignmentTypeBadges({ item }: { item: StudentLearningHistory }) {
  const types = item.assignmentTypes?.length ? item.assignmentTypes : [item.assignmentType];
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((type) => (
        <Badge key={type}>{assignmentTypeLabel(type)}</Badge>
      ))}
    </div>
  );
}

function submitStatusLabel(status: StudentLearningHistory["submitStatus"]) {
  if (status === "submitted") return "제출 완료";
  if (status === "late") return "미제출(마감 지남)";
  return "미제출";
}

function reviewStatusLabel(status: StudentLearningHistory["reviewStatus"]) {
  if (status === "pending") return "검토 필요";
  if (status === "approved" || status === "reviewed") return "승인";
  if (status === "returned") return "반려";
  return "피드백 없음";
}

function submitTone(status: StudentLearningHistory["submitStatus"]) {
  if (status === "submitted") return "green";
  if (status === "late") return "yellow";
  return "red";
}

function reviewTone(status: StudentLearningHistory["reviewStatus"]) {
  if (status === "pending") return "yellow";
  if (status === "approved" || status === "reviewed") return "green";
  if (status === "returned") return "red";
  return "gray";
}

export default async function StudentLearningHistoryPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const session = await getTeacherSession();
  if (!session) redirect("/login");

  const { studentId } = await params;
  const student = await getStudent(session.teacherId, studentId);
  if (!student) notFound();

  const history = await getLearningHistory(session.teacherId, studentId);

  const submittedCount = history.filter((item) => item.submitStatus === "submitted").length;
  const missingCount = history.filter((item) => item.submitStatus === "not_submitted" || item.submitStatus === "late").length;
  const pendingCount = history.filter((item) => item.reviewStatus === "pending").length;
  const approvedCount = history.filter((item) => item.reviewStatus === "approved" || item.reviewStatus === "reviewed").length;
  const returnedCount = history.filter((item) => item.reviewStatus === "returned").length;

  return (
    <TeacherLayout title={`${student.name} 학습 이력`}>
      <div className="grid gap-5">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-action">
                {student.classNames.length > 0 ? student.classNames.join(", ") : "활성 반 없음"}
              </p>
              <h2 className="mt-1 text-2xl font-bold">{student.name}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {student.schoolName ?? "-"} / {student.grade ?? "-"}
              </p>
            </div>
            <Button href="/teacher/classes" variant="secondary">반 관리로</Button>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-6">
          <Card><p className="text-sm text-slate-500">전체 과제</p><p className="mt-2 text-2xl font-bold">{history.length}개</p></Card>
          <Card><p className="text-sm text-slate-500">제출 완료</p><p className="mt-2 text-2xl font-bold">{submittedCount}개</p></Card>
          <Card><p className="text-sm text-slate-500">미제출</p><p className="mt-2 text-2xl font-bold">{missingCount}개</p></Card>
          <Card><p className="text-sm text-slate-500">검토 필요</p><p className="mt-2 text-2xl font-bold">{pendingCount}개</p></Card>
          <Card><p className="text-sm text-slate-500">승인</p><p className="mt-2 text-2xl font-bold">{approvedCount}개</p></Card>
          <Card><p className="text-sm text-slate-500">반려</p><p className="mt-2 text-2xl font-bold">{returnedCount}개</p></Card>
        </div>

        <Card>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold">학습 이력</h3>
            <p className="text-sm text-slate-500">학생별 과제 제출 상태와 피드백 현황을 확인합니다.</p>
          </div>
          <div className="mt-4 grid gap-3">
            {history.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-6 text-center text-sm text-slate-500">
                아직 학습 이력이 없습니다.
              </p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-md border border-line p-4 lg:grid-cols-[120px_1fr_170px_140px_120px_140px_120px] lg:items-center">
                  <p className="text-sm font-bold text-slate-500">{item.date}</p>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{item.assignmentTitle}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.className ?? "-"}</p>
                  </div>
                  <AssignmentTypeBadges item={item} />
                  <Badge tone={submitTone(item.submitStatus)}>{submitStatusLabel(item.submitStatus)}</Badge>
                  <Badge tone={reviewTone(item.reviewStatus)}>{reviewStatusLabel(item.reviewStatus)}</Badge>
                  {item.detailHref ? (
                    <Button href={item.detailHref} variant={item.reviewStatus === "pending" ? "primary" : "secondary"}>
                      {item.reviewStatus === "pending" ? "피드백하기" : "상세"}
                    </Button>
                  ) : (
                    <Button disabled variant="secondary">피드백 없음</Button>
                  )}
                  <SubmissionDeleteButton
                    studentId={student.id}
                    submissionId={item.submissionId}
                    assignmentTitle={item.assignmentTitle}
                  />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </TeacherLayout>
  );
}
