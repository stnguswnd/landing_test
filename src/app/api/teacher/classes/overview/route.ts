import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";
import { requireTeacherSession } from "@/server/teacher/session";

export const runtime = "nodejs";

type Row = {
  class_id: string;
  class_name: string;
  class_status: "active" | "archived";
  student_id: string | null;
  student_name: string | null;
  assignment_id: string | null;
  assignment_title: string | null;
  subject_name: string | null;
  target_status: string | null;
  target_reviewed: boolean | null;
  submission_id: string | null;
  submission_status: string | null;
};

type SubjectRow = {
  class_id: string;
  subject_name: string;
};

type HomeworkItem = {
  assignmentId: string;
  title: string;
  subject: string;
  submissionId?: string;
};

type StudentOverview = {
  studentId: string;
  studentName: string;
  reviewItems: HomeworkItem[];
  missingItems: HomeworkItem[];
};

type ClassOverview = {
  class_id: string;
  class_name: string;
  class_status: "active" | "archived";
  student_count: number;
  assigned_count: number;
  submitted_count: number;
  missing_count: number;
  needs_review_count: number;
  subjects: string[];
  students: StudentOverview[];
};

export async function GET(request: Request) {
  const { teacherId } = await requireTeacherSession();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") === "archived" ? "archived" : "active";
  const result = await query<Row>(
    `
      select
        c.id as class_id,
        c.name as class_name,
        c.status as class_status,
        s.id as student_id,
        s.name as student_name,
        a.id as assignment_id,
        a.title as assignment_title,
        cs.name as subject_name,
        at.status as target_status,
        at.reviewed as target_reviewed,
        sub.id as submission_id,
        sub.status as submission_status
      from classes c
      left join class_memberships cm on cm.class_id = c.id
      left join students s on s.id = cm.student_id and s.status = 'active'
      left join assignment_targets at on at.student_id = s.id and at.class_id = c.id
      left join assignments a on a.id = at.assignment_id and a.teacher_id = c.teacher_id
      left join class_subjects cs on cs.id = at.class_subject_id and cs.teacher_id = c.teacher_id
      left join lateral (
        select sub.id, sub.status
        from submissions sub
        where sub.assignment_id = a.id and sub.student_id = s.id
        order by sub.submitted_at desc nulls last, sub.updated_at desc
        limit 1
      ) sub on true
      where c.teacher_id = $1 and c.status = $2
      order by c.created_at asc, s.name asc, a.updated_at desc nulls last
    `,
    [teacherId, status],
  );
  const subjectResult = await query<SubjectRow>(
    `
      select
        c.id as class_id,
        cs.name as subject_name
      from classes c
      join class_subjects cs on cs.class_id = c.id and cs.teacher_id = c.teacher_id
      where c.teacher_id = $1
        and c.status = $2
        and cs.status = 'active'
      order by c.created_at asc, cs.created_at asc, cs.name asc
    `,
    [teacherId, status],
  );

  const classes = new Map<string, ClassOverview>();
  const studentKeys = new Set<string>();
  const targetKeys = new Set<string>();
  const submittedKeys = new Set<string>();
  const missingKeys = new Set<string>();
  const reviewKeys = new Set<string>();

  for (const row of result.rows) {
    let classItem = classes.get(row.class_id);
    if (!classItem) {
        classItem = {
          class_id: row.class_id,
          class_name: row.class_name,
          class_status: row.class_status,
          student_count: 0,
        assigned_count: 0,
        submitted_count: 0,
        missing_count: 0,
        needs_review_count: 0,
        subjects: [],
        students: [],
      };
      classes.set(row.class_id, classItem);
    }

    if (!row.student_id || !row.student_name) continue;

    const studentClassKey = `${row.class_id}:${row.student_id}`;
    let student = classItem.students.find((item) => item.studentId === row.student_id);
    if (!student) {
      student = {
        studentId: row.student_id,
        studentName: row.student_name,
        reviewItems: [],
        missingItems: [],
      };
      classItem.students.push(student);
    }
    if (!studentKeys.has(studentClassKey)) {
      studentKeys.add(studentClassKey);
      classItem.student_count += 1;
    }

    if (!row.assignment_id || !row.assignment_title) continue;

    const subject = row.subject_name ?? "과목 없음";
    if (!classItem.subjects.includes(subject)) classItem.subjects.push(subject);

    const targetKey = `${row.class_id}:${row.student_id}:${row.assignment_id}`;
    if (!targetKeys.has(targetKey)) {
      targetKeys.add(targetKey);
      classItem.assigned_count += 1;
    }

    const item = {
      assignmentId: row.assignment_id,
      title: row.assignment_title,
      subject,
      submissionId: row.submission_id ?? undefined,
    };

    if (row.target_status === "assigned") {
      if (!missingKeys.has(targetKey)) {
        missingKeys.add(targetKey);
        classItem.missing_count += 1;
        student.missingItems.push(item);
      }
      continue;
    }

    if (row.target_status === "submitted" || row.target_status === "late") {
      if (!submittedKeys.has(targetKey)) {
        submittedKeys.add(targetKey);
        classItem.submitted_count += 1;
      }
      if (!row.target_reviewed && row.submission_status !== "reviewed") {
        if (!reviewKeys.has(targetKey)) {
          reviewKeys.add(targetKey);
          classItem.needs_review_count += 1;
          student.reviewItems.push(item);
        }
      }
    }
  }

  for (const row of subjectResult.rows) {
    const classItem = classes.get(row.class_id);
    if (classItem && !classItem.subjects.includes(row.subject_name)) {
      classItem.subjects.push(row.subject_name);
    }
  }

  return NextResponse.json({ classes: Array.from(classes.values()) });
}
