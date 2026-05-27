"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type HomeworkItem = {
  assignmentId: string;
  title: string;
  subject: string;
  submissionId?: string;
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
  students: Array<{
    studentId: string;
    studentName: string;
    reviewItems: HomeworkItem[];
    missingItems: HomeworkItem[];
  }>;
};

const ALL_SUBJECTS = "전체";

export function ClassOverviewPage({ status }: { status: "active" | "archived" }) {
  const isArchived = status === "archived";
  const [classes, setClasses] = useState<ClassOverview[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, string>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadClasses() {
    const response = await fetch(`/api/teacher/classes/overview?status=${status}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({ classes: [] }));
    setClasses(data.classes ?? []);
  }

  useEffect(() => {
    loadClasses().catch(() => setClasses([]));
  }, [status]);

  useEffect(() => {
    const deleteMessage = window.sessionStorage.getItem("classDeleteMessage");
    if (!deleteMessage) return;
    window.sessionStorage.removeItem("classDeleteMessage");
    setMessage(deleteMessage);
  }, []);

  async function createClass(formData: FormData) {
    const response = await fetch("/api/teacher/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        status: "active",
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(data?.error ?? "반을 만들지 못했습니다.");
      return;
    }
    setMessage("반이 생성되었습니다.");
    setIsCreateOpen(false);
    await loadClasses();
  }

  function selectSubject(classId: string, subject: string) {
    setSelectedSubjects((current) => ({ ...current, [classId]: subject }));
  }

  return (
    <TeacherLayout title={isArchived ? "비활성 반" : "반 관리"}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-bold text-action">강사 모드</p>
          <h1 className="mt-1 text-3xl font-bold">{isArchived ? "저장소" : "반 관리"}</h1>
        </div>
        {!isArchived && <Button onClick={() => setIsCreateOpen(true)}>반 만들기</Button>}
      </div>

      <div className="mb-5">
        <h2 className="text-lg font-bold">{isArchived ? "비활성 반 목록" : "반별 학습 상태"}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isArchived
            ? "이력이 있어 삭제 대신 비활성 처리된 반을 따로 확인합니다."
            : "반의 학생 배정, 제출 상태, 검토 필요 과제를 확인합니다."}
        </p>
      </div>

      {message && <p className="mb-4 rounded-md bg-blue-50 px-4 py-3 text-sm font-semibold text-action">{message}</p>}

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {classes.map((classItem) => (
          <ClassStatusCard
            key={classItem.class_id}
            classItem={classItem}
            selectedSubject={selectedSubjects[classItem.class_id] ?? ALL_SUBJECTS}
            onSelectSubject={(subject) => selectSubject(classItem.class_id, subject)}
          />
        ))}
        {classes.length === 0 && (
          <Card className="w-full">
            <p className="text-sm text-slate-500">
              {isArchived ? "비활성 반이 없습니다." : "아직 생성된 반이 없습니다. 먼저 반을 만들어주세요."}
            </p>
          </Card>
        )}
      </div>

      {isCreateOpen && (
        <ClassCreateModal
          onClose={() => setIsCreateOpen(false)}
          onSubmit={createClass}
        />
      )}
    </TeacherLayout>
  );
}

function ClassCreateModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">반 만들기</h2>
          <button type="button" className="rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100" onClick={onClose}>
            닫기
          </button>
        </div>
        <form action={onSubmit} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            반 이름
            <Input name="name" required placeholder="예: RL Basic" />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            설명
            <Textarea name="description" placeholder="예: 초등 리딩 기초반" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
            <Button type="submit">생성</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClassStatusCard({
  classItem,
  selectedSubject,
  onSelectSubject,
}: {
  classItem: ClassOverview;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
}) {
  const subjects = useMemo(
    () => {
      const visibleSubjects = new Set(classItem.subjects);
      for (const student of classItem.students) {
        for (const item of [...student.reviewItems, ...student.missingItems]) {
          visibleSubjects.add(item.subject);
        }
      }
      return [ALL_SUBJECTS, ...Array.from(visibleSubjects).sort()];
    },
    [classItem.subjects, classItem.students],
  );

  const students = classItem.students.map((student) => ({
    ...student,
    reviewItems: filterBySubject(student.reviewItems, selectedSubject),
    missingItems: filterBySubject(student.missingItems, selectedSubject),
  })).filter((student) => selectedSubject === ALL_SUBJECTS || student.reviewItems.length > 0 || student.missingItems.length > 0);

  return (
    <Card className="min-h-[620px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{classItem.class_name}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">학생 {classItem.student_count}명</p>
          {classItem.class_status === "archived" && <Badge tone="gray">비활성</Badge>}
        </div>
        <Button href={`/teacher/classes/${classItem.class_id}`} variant="secondary">
          반 상세보기
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Badge tone="blue">진행 {classItem.assigned_count}</Badge>
        <Badge tone="red">미제출 {classItem.missing_count}</Badge>
        <Badge tone="yellow">검토 {classItem.needs_review_count}</Badge>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {subjects.map((subject) => (
          <button
            key={subject}
            type="button"
            className={
              selectedSubject === subject
                ? "rounded-full bg-action px-4 py-2 text-sm font-bold text-white"
                : "rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-action"
            }
            onClick={() => onSelectSubject(subject)}
          >
            {subject}
          </button>
        ))}
      </div>

      <div className="mt-5 grid max-h-[470px] gap-3 overflow-y-auto pr-1">
        {students.length === 0 ? (
          <p className="rounded-md border border-dashed border-line p-6 text-center text-sm text-slate-500">표시할 학습 상태가 없습니다.</p>
        ) : (
          students.map((student) => <StudentHomeworkCard key={student.studentId} student={student} />)
        )}
      </div>

    </Card>
  );
}

function StudentHomeworkCard({
  student,
}: {
  student: {
    studentId: string;
    studentName: string;
    reviewItems: HomeworkItem[];
    missingItems: HomeworkItem[];
  };
}) {
  return (
    <Link
      href={`/teacher/students/${student.studentId}`}
      className="block rounded-md border border-line bg-slate-50 p-4 transition hover:border-action hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-action/30"
    >
      <p className="text-lg font-bold text-ink">{student.studentName}</p>
      <StatusRow label="검토 필요" tone="review" items={student.reviewItems} emptyLabel="없음" />
      <div className="my-2 border-t border-line" />
      <StatusRow label="미완료" tone="missing" items={student.missingItems} emptyLabel="없음" />
    </Link>
  );
}

function StatusRow({
  label,
  tone,
  items,
  emptyLabel,
}: {
  label: string;
  tone: "review" | "missing";
  items: HomeworkItem[];
  emptyLabel: string;
}) {
  return (
    <div className="mt-3 grid grid-cols-[76px_1fr] items-center gap-3 text-sm">
      <p className={tone === "review" ? "font-bold text-action" : "font-bold text-red-700"}>{label}</p>
      <div className="flex min-w-0 flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-slate-400">{emptyLabel}</span>
        ) : (
          items.map((item) => <HomeworkPill key={`${label}-${item.assignmentId}`} item={item} tone={tone} />)
        )}
      </div>
    </div>
  );
}

function HomeworkPill({ item, tone }: { item: HomeworkItem; tone: "review" | "missing" }) {
  const classes =
    tone === "review"
      ? "inline-flex max-w-full min-w-0 items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-action"
      : "inline-flex max-w-full min-w-0 items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm font-bold text-red-700";

  return (
    <span className={classes}>
      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold">{item.subject}</span>
      <span className="min-w-0 truncate">{item.title}</span>
    </span>
  );
}

function filterBySubject(items: HomeworkItem[], selectedSubject: string) {
  if (selectedSubject === ALL_SUBJECTS) return items;
  return items.filter((item) => item.subject === selectedSubject);
}
