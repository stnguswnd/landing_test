"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ClassScheduleForm } from "@/features/classes/ClassScheduleForm";
import { formatTimeRange } from "@/lib/calendarTypes";
import { cn } from "@/lib/utils";

type Tab = "overview" | "students" | "notices" | "homework" | "schedule" | "tests";
type StudentRow = { id: string; name: string; studentLoginId: string; status: string; classIds?: string[]; classNames?: string[] };
type AssignmentRow = { id: string; title: string; assignmentType: string; classSubjectId?: string | null; subjectName?: string | null; dueAt: string | null; targetCount: number; submittedCount: number; missingCount: number; needsReviewCount: number };
type Notice = { id: string; title: string; content: string; imageUrl: string | null; status: string; createdAt: string };
type CalendarEvent = { id: string; eventType: string; title: string; description?: string | null; eventDate: string; startTime?: string | null; endTime?: string | null; status: string };
type TestRow = { id: string; title: string; subject: string; testDate: string; startTime?: string | null; endTime?: string | null; scope?: string | null; status: string; resultCount: number; passCount: number; nonpassCount: number };
type TestResultRow = { studentId: string; studentName: string; score: number | null; maxScore: number; result: "PASS" | "NonPASS"; teacherMemo: string; takenAt?: string | null };
type ClassItem = { name: string; description?: string | null; status?: "active" | "archived" };
type ClassSubject = { id: string; classId: string; name: string; description: string; status: string };
type DeletePreview = { deleted: boolean; archived: boolean; reason: "no_history" | "has_history" };
type HomeworkStatusItem = { assignmentId: string; title: string; subject: string; submissionId?: string };
type AssignmentCatalogRow = {
  id: string;
  title: string;
  description: string;
  assignmentType: string;
  assignmentSubjects?: string[];
  targetCount: number;
  updatedAt: string;
};
type ClassHomeworkOverview = {
  class_id: string;
  subjects: string[];
  students: Array<{
    studentId: string;
    studentName: string;
    reviewItems: HomeworkStatusItem[];
    missingItems: HomeworkStatusItem[];
  }>;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "개요" },
  { id: "students", label: "학생" },
  { id: "notices", label: "공지사항" },
  { id: "homework", label: "숙제" },
  { id: "schedule", label: "수업 일정" },
  { id: "tests", label: "테스트" },
];

function eventLabel(type: string) {
  if (type === "class") return "정규수업";
  if (type === "cancelled") return "휴강";
  if (type === "makeup") return "보강";
  if (type === "test") return "시험";
  if (type === "notice") return "공지";
  return "기타";
}

function eventTone(type: string): "blue" | "green" | "red" | "yellow" | "gray" {
  if (type === "class") return "blue";
  if (type === "cancelled") return "red";
  if (type === "makeup") return "green";
  if (type === "test") return "yellow";
  return "gray";
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${dateOnly(value)}T00:00:00`));
}

function buildMonthDays(anchor = "2026-05-01") {
  const base = new Date(`${anchor}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: last }, (_, index) => `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`),
  ];
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(value: string) {
  const date = new Date(`${dateOnly(value)}T00:00:00`);
  return toDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

function addMonths(value: string, amount: number) {
  const date = new Date(`${dateOnly(value)}T00:00:00`);
  return toDateString(new Date(date.getFullYear(), date.getMonth() + amount, 1));
}

function isSameMonth(left: string, right: string) {
  return dateOnly(left).slice(0, 7) === dateOnly(right).slice(0, 7);
}

function selectedDateForMonth(targetMonth: string, currentSelectedDate: string) {
  const target = new Date(`${dateOnly(targetMonth)}T00:00:00`);
  const today = toDateString(new Date());
  if (isSameMonth(today, targetMonth)) return today;

  const current = new Date(`${dateOnly(currentSelectedDate)}T00:00:00`);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  if (current.getDate() <= lastDay) {
    return toDateString(new Date(target.getFullYear(), target.getMonth(), current.getDate()));
  }
  return toDateString(new Date(target.getFullYear(), target.getMonth(), 1));
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [assignmentCatalog, setAssignmentCatalog] = useState<AssignmentCatalogRow[]>([]);
  const [homeworkOverview, setHomeworkOverview] = useState<ClassHomeworkOverview | null>(null);
  const [message, setMessage] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isReactivateOpen, setIsReactivateOpen] = useState(false);
  const [deleteActionPreview, setDeleteActionPreview] = useState<DeletePreview | null>(null);
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();

  async function loadAll() {
    const [classData, studentData, assignmentData, noticeData, eventData, testData, subjectData, assignmentCatalogData, activeOverviewData, archivedOverviewData] = await Promise.all([
      fetch(`/api/teacher/classes/${classId}`).then((response) => response.json()),
      fetch(`/api/teacher/classes/${classId}/students`).then((response) => response.json()),
      fetch(`/api/teacher/classes/${classId}/assignments`).then((response) => response.json()),
      fetch(`/api/teacher/classes/${classId}/notices`).then((response) => response.json()).catch(() => ({ notices: [] })),
      fetch(`/api/teacher/classes/${classId}/calendar-events`).then((response) => response.json()).catch(() => ({ events: [] })),
      fetch(`/api/teacher/tests?classId=${classId}`).then((response) => response.json()).catch(() => ({ tests: [] })),
      fetch(`/api/teacher/classes/${classId}/subjects`).then((response) => response.json()).catch(() => ({ subjects: [] })),
      fetch("/api/teacher/assignments").then((response) => response.json()).catch(() => ({ assignments: [] })),
      fetch("/api/teacher/classes/overview?status=active").then((response) => response.json()).catch(() => ({ classes: [] })),
      fetch("/api/teacher/classes/overview?status=archived").then((response) => response.json()).catch(() => ({ classes: [] })),
    ]);
    setClassItem(classData.class ?? null);
    setStudents(studentData.students ?? []);
    setAssignments(assignmentData.assignments ?? []);
    setNotices(noticeData.notices ?? []);
    setEvents(eventData.events ?? []);
    setTests(testData.tests ?? []);
    setSubjects(subjectData.subjects ?? []);
    setAssignmentCatalog(assignmentCatalogData.assignments ?? []);
    setHomeworkOverview(
      [...(activeOverviewData.classes ?? []), ...(archivedOverviewData.classes ?? [])].find((item: ClassHomeworkOverview) => item.class_id === classId) ?? null,
    );
  }

  async function loadDeletePreview() {
    const response = await fetch(`/api/teacher/classes/${classId}?deletePreview=1`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) setDeleteActionPreview(data);
  }

  useEffect(() => {
    loadAll().catch(() => undefined);
    loadDeletePreview().catch(() => setDeleteActionPreview(null));
  }, [classId]);

  async function refresh(msg: string) {
    setMessage(msg);
    await loadAll();
  }

  async function updateClass(formData: FormData) {
    const response = await fetch(`/api/teacher/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(data?.error ?? "반 정보를 수정하지 못했습니다.");
      return;
    }

    setIsEditOpen(false);
    setMessage("반 정보를 수정했습니다.");
    await loadAll();
  }

  async function reactivateClass() {
    const response = await fetch(`/api/teacher/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(data?.error ?? "반을 재활성화하지 못했습니다.");
      setIsReactivateOpen(false);
      return;
    }

    setIsReactivateOpen(false);
    window.sessionStorage.setItem("classDeleteMessage", "반이 재활성화되었습니다.");
    router.push("/teacher/classes");
  }

  async function openDeleteModal() {
    const response = await fetch(`/api/teacher/classes/${classId}?deletePreview=1`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "반 삭제 상태를 확인하지 못했습니다.");
      return;
    }
    setDeletePreview(data);
    setDeleteActionPreview(data);
  }

  function deleteClass() {
    startDeleteTransition(async () => {
      const response = await fetch(`/api/teacher/classes/${classId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "반 삭제 처리 중 오류가 발생했습니다.");
        setDeletePreview(null);
        return;
      }

      setDeletePreview(null);
      if (data.deleted) {
        window.sessionStorage.setItem("classDeleteMessage", "반이 삭제되었습니다. 학생은 유지되고 반 배정만 해제되었습니다.");
        router.push("/teacher/classes");
        return;
      }

      setMessage("반이 비활성 처리되었습니다. 기존 기록은 유지됩니다.");
      await loadAll();
    });
  }

  return (
    <TeacherLayout title={classItem?.name ?? "반 상세"}>
      <div className="grid gap-4">
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold">{classItem?.name ?? "반 상세"}</h1>
              <p className="mt-2 text-slate-600">{classItem?.description ?? "-"}</p>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                학생 {students.length}명 · 숙제 {assignments.length}개 · 예정 시험 {tests.filter((test) => test.status === "scheduled").length}개 · 공유 일정 {events.length + tests.length + assignments.filter((assignment) => assignment.dueAt).length}개
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setIsEditOpen(true)}>반 수정하기</Button>
              <Button type="button" variant="secondary" onClick={() => setIsAddStudentOpen(true)}>학생 추가</Button>
              <Button type="button" variant="secondary" onClick={() => setIsSubjectModalOpen(true)}>과목 관리</Button>
              {classItem?.status === "archived" ? (
                <Button onClick={() => setIsReactivateOpen(true)}>반 재활성화</Button>
              ) : (
                <Button variant="danger" onClick={openDeleteModal}>
                  {deleteActionPreview?.archived ? "반 비활성화" : "반 삭제"}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {message && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">{message}</p>}

        <div className="overflow-x-auto border-b border-line">
          <div className="flex min-w-max gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn("border-b-2 px-2 py-3 text-sm font-bold", activeTab === tab.id ? "border-action text-action" : "border-transparent text-slate-500")}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && <OverviewTab classId={classId} notices={notices} subjects={subjects} homeworkOverview={homeworkOverview} assignments={assignments} assignmentCatalog={assignmentCatalog} students={students} events={events} tests={tests} onChanged={refresh} />}
        {activeTab === "students" && <StudentsTab classId={classId} students={students} onChanged={refresh} />}
        {activeTab === "notices" && <NoticesTab classId={classId} notices={notices} onChanged={refresh} />}
        {activeTab === "homework" && <HomeworkTab subjects={subjects} assignments={assignments} />}
        {activeTab === "schedule" && <ScheduleTab classId={classId} events={events} tests={tests} assignments={assignments} onChanged={refresh} />}
        {activeTab === "tests" && <TestsTab classId={classId} students={students} tests={tests} onChanged={refresh} />}
        {isAddStudentOpen && (
          <AddExistingStudentsModal
            classId={classId}
            currentStudentIds={students.map((student) => student.id)}
            onClose={() => setIsAddStudentOpen(false)}
            onAdded={(addedCount) => {
              setIsAddStudentOpen(false);
              refresh(`학생 ${addedCount}명을 반에 추가했습니다.`);
            }}
          />
        )}
        {isSubjectModalOpen && (
          <SubjectManagementModal
            classId={classId}
            subjects={subjects}
            onClose={() => setIsSubjectModalOpen(false)}
            onChanged={refresh}
          />
        )}
        {isEditOpen && classItem && (
          <ClassEditModal
            classItem={classItem}
            onClose={() => setIsEditOpen(false)}
            onSubmit={updateClass}
          />
        )}
        {isReactivateOpen && (
          <ClassReactivateModal
            onClose={() => setIsReactivateOpen(false)}
            onConfirm={reactivateClass}
          />
        )}
        {deletePreview && <ClassDeleteModal preview={deletePreview} isPending={isDeletePending} onClose={() => setDeletePreview(null)} onConfirm={deleteClass} />}
      </div>
    </TeacherLayout>
  );
}

function ClassDeleteModal({
  preview,
  isPending,
  onClose,
  onConfirm,
}: {
  preview: DeletePreview;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = preview.deleted ? "이 반을 완전히 삭제하시겠습니까?" : "이 반은 비활성 처리됩니다.";
  const message = preview.deleted
    ? "학생은 삭제되지 않고, 이 반과의 배정만 해제됩니다. 아직 숙제/제출/수업 기록이 없어 완전 삭제할 수 있습니다."
    : "이 반에는 숙제/제출/수업 기록이 있어 완전히 삭제할 수 없습니다. 반은 비활성 처리되어 활성 반 목록에서 숨겨지고, 학생과 기존 기록은 유지됩니다.";

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid gap-4">
        <p className="text-sm leading-6 text-slate-700">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant={preview.deleted ? "danger" : "primary"} onClick={onConfirm} disabled={isPending}>
            {isPending ? "처리 중..." : preview.deleted ? "완전 삭제" : "비활성 처리"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ClassEditModal({
  classItem,
  onClose,
  onSubmit,
}: {
  classItem: { name: string; description?: string | null };
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Modal title="반 정보 수정" onClose={onClose}>
      <form action={onSubmit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          반 이름
          <Input name="name" required defaultValue={classItem.name} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          설명
          <Textarea name="description" defaultValue={classItem.description ?? ""} />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
          <Button type="submit">저장</Button>
        </div>
      </form>
    </Modal>
  );
}

function ClassReactivateModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="이 반을 다시 활성화하시겠습니까?" onClose={onClose}>
      <div className="grid gap-4">
        <p className="text-sm leading-6 text-slate-700">
          기존 학생 배정과 학습 기록은 그대로 유지됩니다. 재활성화하면 반 관리 목록에 다시 표시됩니다.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={onConfirm}>반 재활성화</Button>
        </div>
      </div>
    </Modal>
  );
}

function OverviewTab({
  classId,
  notices,
  subjects,
  homeworkOverview,
  assignments,
  assignmentCatalog,
  students,
  events,
  tests,
  onChanged,
}: {
  classId: string;
  notices: Notice[];
  subjects: ClassSubject[];
  homeworkOverview: ClassHomeworkOverview | null;
  assignments: AssignmentRow[];
  assignmentCatalog: AssignmentCatalogRow[];
  students: StudentRow[];
  events: CalendarEvent[];
  tests: TestRow[];
  onChanged: (msg: string) => void;
}) {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [assignSubject, setAssignSubject] = useState<ClassSubject | null>(null);
  const firstDate = events[0]?.eventDate ?? tests[0]?.testDate ?? assignments.find((assignment) => assignment.dueAt)?.dueAt ?? "2026-05-25";
  const [selectedDate, setSelectedDate] = useState(dateOnly(firstDate));
  const [displayMonth, setDisplayMonth] = useState(monthStart(firstDate));
  const visibleEvents = events.filter((event) => event.status !== "hidden");
  const upcomingTests = tests
    .filter((test) => test.status !== "hidden")
    .sort((left, right) => dateOnly(left.testDate).localeCompare(dateOnly(right.testDate)));
  const subjectNames = Array.from(new Set([
    ...subjects.map((subject) => subject.name),
    ...(homeworkOverview?.subjects ?? []),
    ...assignments.map((assignment) => assignment.subjectName ?? "").filter(Boolean),
  ]));
  const ungroupedAssignments = assignments.filter((assignment) => !assignment.classSubjectId);
  if (ungroupedAssignments.length > 0 && !subjectNames.includes("과목 없음")) subjectNames.push("과목 없음");

  function moveMonth(amount: number) {
    setDisplayMonth((current) => {
      const nextMonth = addMonths(current, amount);
      setSelectedDate((currentSelectedDate) => selectedDateForMonth(nextMonth, currentSelectedDate));
      return nextMonth;
    });
  }

  function moveToday() {
    const today = toDateString(new Date());
    setDisplayMonth(monthStart(today));
    setSelectedDate(today);
  }

  return (
    <div className="grid gap-5">
      <ClassNoticeOverview notices={notices} onCreate={() => setIsNoticeOpen(true)} />
      <SubjectStudentHomeworkOverview
        classId={classId}
        subjectNames={subjectNames}
        subjects={subjects}
        assignments={assignments}
        assignmentCatalog={assignmentCatalog}
        students={students}
        homeworkOverview={homeworkOverview}
        onAssignSubject={setAssignSubject}
      />
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-0">
          <ClassCalendarGrid
            events={visibleEvents}
            tests={tests}
            assignments={assignments}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            displayMonth={displayMonth}
            onPreviousMonth={() => moveMonth(-1)}
            onNextMonth={() => moveMonth(1)}
            onToday={moveToday}
            action={<Button onClick={() => setIsScheduleOpen(true)}>일정 추가</Button>}
          />
          <ClassSelectedDateSchedule
            selectedDate={selectedDate}
            events={visibleEvents}
            tests={tests}
            assignments={assignments}
          />
        </div>
        <ClassTestOverview tests={upcomingTests} onCreate={() => setIsTestOpen(true)} />
      </div>
      {isScheduleOpen && (
        <ClassScheduleForm
          classId={classId}
          event={null}
          onClose={() => setIsScheduleOpen(false)}
          onSaved={(message) => {
            setIsScheduleOpen(false);
            onChanged(message ?? "일정을 저장했습니다.");
          }}
        />
      )}
      {isNoticeOpen && (
        <NoticeModal
          classId={classId}
          notice={null}
          onClose={() => setIsNoticeOpen(false)}
          onSaved={() => {
            setIsNoticeOpen(false);
            onChanged("반 공지사항을 저장했습니다.");
          }}
        />
      )}
      {assignSubject && (
        <SubjectAssignmentModal
          classId={classId}
          subject={assignSubject}
          assignments={assignmentCatalog}
          students={students}
          onClose={() => setAssignSubject(null)}
          onAssigned={(assignedCount) => {
            setAssignSubject(null);
            onChanged(`과제를 배정했습니다. 대상 ${assignedCount}건`);
          }}
        />
      )}
      {isTestOpen && (
        <TestModal
          classId={classId}
          test={null}
          onClose={() => setIsTestOpen(false)}
          onSaved={() => {
            setIsTestOpen(false);
            onChanged("테스트를 저장했습니다.");
          }}
        />
      )}
    </div>
  );
}

function ClassNoticeOverview({ notices, onCreate }: { notices: Notice[]; onCreate: () => void }) {
  const visibleNotices = notices.slice(0, 5);
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">공지사항</h2>
        <div className="flex items-center gap-2">
          <Badge tone="blue">{visibleNotices.length}개</Badge>
          <Button type="button" onClick={onCreate}>반 공지 작성</Button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {visibleNotices.length ? (
          visibleNotices.map((notice) => (
            <article key={notice.id} className="rounded-md border border-line bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{notice.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{notice.content}</p>
                </div>
                <Badge tone={notice.status === "published" ? "green" : "gray"}>{notice.status}</Badge>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500 md:col-span-2">등록된 공지사항이 없습니다.</p>
        )}
      </div>
    </Card>
  );
}

function SubjectStudentHomeworkOverview({
  classId,
  subjectNames,
  subjects,
  assignments,
  assignmentCatalog,
  students,
  homeworkOverview,
  onAssignSubject,
}: {
  classId: string;
  subjectNames: string[];
  subjects: ClassSubject[];
  assignments: AssignmentRow[];
  assignmentCatalog: AssignmentCatalogRow[];
  students: StudentRow[];
  homeworkOverview: ClassHomeworkOverview | null;
  onAssignSubject: (subject: ClassSubject) => void;
}) {
  return (
    <Card>
      <h2 className="font-bold">과목별 학생 숙제 현황</h2>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {subjectNames.length ? (
          subjectNames.map((subjectName) => (
            <SubjectStudentStatusCard
              key={subjectName}
              subjectName={subjectName}
              classId={classId}
              subjects={subjects}
              assignments={assignments}
              assignmentCatalog={assignmentCatalog}
              allStudents={students}
              students={homeworkOverview?.students ?? []}
              onAssignSubject={onAssignSubject}
            />
          ))
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500 xl:col-span-2">등록된 과목이나 숙제가 없습니다.</p>
        )}
      </div>
    </Card>
  );
}

function SubjectStudentStatusCard({
  subjectName,
  classId,
  subjects,
  assignments,
  assignmentCatalog,
  allStudents,
  students,
  onAssignSubject,
}: {
  subjectName: string;
  classId: string;
  subjects: ClassSubject[];
  assignments: AssignmentRow[];
  assignmentCatalog: AssignmentCatalogRow[];
  allStudents: StudentRow[];
  students: ClassHomeworkOverview["students"];
  onAssignSubject: (subject: ClassSubject) => void;
}) {
  const subjectIds = subjects.filter((subject) => subject.name === subjectName).map((subject) => subject.id);
  const subject = subjects.find((item) => item.name === subjectName);
  const subjectAssignments = subjectName === "과목 없음"
    ? assignments.filter((assignment) => !assignment.classSubjectId)
    : assignments.filter((assignment) => subjectIds.includes(assignment.classSubjectId ?? "") || assignment.subjectName === subjectName);
  const displayStudents = students.length > 0
    ? students
    : allStudents.map((student) => ({ studentId: student.id, studentName: student.name, reviewItems: [], missingItems: [] }));
  const assignableCount = assignmentCatalog.length;

  const totals = subjectAssignments.reduce(
    (sum, assignment) => ({
      targetCount: sum.targetCount + assignment.targetCount,
      missingCount: sum.missingCount + assignment.missingCount,
      needsReviewCount: sum.needsReviewCount + assignment.needsReviewCount,
    }),
    { targetCount: 0, missingCount: 0, needsReviewCount: 0 },
  );

  return (
    <section className="rounded-md border border-line p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <h3 className="min-w-0 font-bold leading-9">{subjectName}</h3>
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
          <Badge>숙제 {subjectAssignments.length}</Badge>
          <Badge tone="red">미제출 {totals.missingCount}</Badge>
          <Badge tone="yellow">검토 {totals.needsReviewCount}</Badge>
          <Button
            type="button"
            variant="secondary"
            onClick={() => subject && onAssignSubject(subject)}
            disabled={!subject || assignableCount === 0}
          >
            과제 배정
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {displayStudents.length ? (
          displayStudents.map((student) => {
            const missingItems = student.missingItems.filter((item) => item.subject === subjectName);
            const reviewItems = student.reviewItems.filter((item) => item.subject === subjectName);
            return (
              <SubjectStudentHomeworkCard
                key={`${subjectName}-${student.studentId}`}
                studentId={student.studentId}
                studentName={student.studentName}
                reviewItems={reviewItems}
                missingItems={missingItems}
              />
            );
          })
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">등록된 학생이 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function SubjectStudentHomeworkCard({
  studentId,
  studentName,
  reviewItems,
  missingItems,
}: {
  studentId: string;
  studentName: string;
  reviewItems: HomeworkStatusItem[];
  missingItems: HomeworkStatusItem[];
}) {
  return (
    <Link
      href={`/teacher/students/${studentId}`}
      className="block rounded-md border border-line bg-slate-50 p-4 transition hover:border-action hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-action/30"
    >
      <p className="text-lg font-bold text-ink">{studentName}</p>
      <SubjectStatusRow label="검토 필요" tone="review" items={reviewItems} emptyLabel="없음" />
      <div className="my-2 border-t border-line" />
      <SubjectStatusRow label="미완료" tone="missing" items={missingItems} emptyLabel="없음" />
    </Link>
  );
}

function SubjectStatusRow({
  label,
  tone,
  items,
  emptyLabel,
}: {
  label: string;
  tone: "review" | "missing";
  items: HomeworkStatusItem[];
  emptyLabel: string;
}) {
  return (
    <div className="mt-3 grid grid-cols-[76px_1fr] items-center gap-3 text-sm">
      <p className={tone === "review" ? "font-bold text-action" : "font-bold text-red-700"}>{label}</p>
      <div className="flex min-w-0 flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-slate-400">{emptyLabel}</span>
        ) : (
          items.map((item) => <SubjectHomeworkPill key={`${label}-${item.assignmentId}`} item={item} tone={tone} />)
        )}
      </div>
    </div>
  );
}

function SubjectHomeworkPill({ item, tone }: { item: HomeworkStatusItem; tone: "review" | "missing" }) {
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

function SubjectAssignmentModal({
  classId,
  subject,
  assignments,
  students,
  onClose,
  onAssigned,
}: {
  classId: string;
  subject: ClassSubject;
  assignments: AssignmentCatalogRow[];
  students: StudentRow[];
  onClose: () => void;
  onAssigned: (assignedCount: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(todayDate());
  const [dueTime, setDueTime] = useState("23:59");
  const [visibility, setVisibility] = useState<"published" | "draft">("published");
  const [targetType, setTargetType] = useState<"all" | "partial">("all");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredAssignments = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return assignments
      .filter((assignment) => {
        const matchesQuery = !keyword
          || assignment.title.toLowerCase().includes(keyword)
          || assignment.description.toLowerCase().includes(keyword);
        return matchesQuery;
      })
      .slice(0, 20);
  }, [assignments, query]);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    return students.filter((student) => !keyword || student.name.toLowerCase().includes(keyword));
  }, [studentSearch, students]);

  function toggleStudent(studentId: string) {
    setStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  }

  function toggleAssignment(assignmentId: string) {
    setSelectedAssignmentIds((current) => (
      current.includes(assignmentId)
        ? current.filter((id) => id !== assignmentId)
        : [...current, assignmentId]
    ));
  }

  function assignHomework() {
    if (selectedAssignmentIds.length === 0) {
      setError("배정할 과제를 1개 이상 선택해주세요.");
      return;
    }
    if (!dueDate || !dueTime) {
      setError("마감일과 마감 시간을 입력해주세요.");
      return;
    }
    if (targetType === "partial" && studentIds.length === 0) {
      setError("일부 학생만 배정하려면 학생을 1명 이상 선택해주세요.");
      return;
    }
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/teacher/assignments/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: selectedAssignmentIds,
          targets: [{
            classId,
            classSubjectId: subject.id,
            dueDate,
            dueTime,
            visibility,
            targetType,
            studentIds,
          }],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "과제 배정 중 오류가 발생했습니다.");
        return;
      }
      onAssigned(data.assignedCount ?? 0);
    });
  }

  return (
    <Modal title={`${subject.name} 과제 배정`} onClose={onClose}>
      <div className="grid gap-5">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

        <div className="grid gap-3 rounded-md border border-line bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-500">반</p>
              <p className="mt-1 font-bold">현재 반</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">과목</p>
              <p className="mt-1 font-bold">{subject.name}</p>
            </div>
          </div>
        </div>

        <section className="grid gap-3">
          <div className="grid gap-2">
            <label className="grid gap-2 text-sm font-semibold">
              기존 과제 찾기
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="과제명 검색" />
            </label>
            <p className="text-sm font-semibold text-slate-500">선택 {selectedAssignmentIds.length}개</p>
          </div>
          <div className="grid max-h-72 gap-2 overflow-auto rounded-md border border-line p-2">
            {filteredAssignments.length ? (
              filteredAssignments.map((assignment) => (
                <label
                  key={assignment.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border border-line bg-white p-3 transition hover:border-action",
                    selectedAssignmentIds.includes(assignment.id) && "border-action bg-blue-50 ring-1 ring-action",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedAssignmentIds.includes(assignment.id)}
                    onChange={() => toggleAssignment(assignment.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{assignment.title}</span>
                    <span className="mt-1 line-clamp-2 text-sm text-slate-500">{assignment.description || "설명 없음"}</span>
                    <span className="mt-2 flex flex-wrap gap-2">
                      <Badge>{assignment.assignmentType}</Badge>
                      <Badge tone={assignment.targetCount > 0 ? "green" : "gray"}>{assignment.targetCount > 0 ? "배정됨" : "미배정"}</Badge>
                    </span>
                  </span>
                </label>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">찾을 수 있는 과제가 없습니다.</p>
            )}
          </div>
        </section>

        <section className="grid gap-3 rounded-md border border-line p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">마감일<Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-semibold">마감 시간<Input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-semibold">
              공개 상태
              <Select value={visibility} onChange={(event) => setVisibility(event.target.value as "published" | "draft")}>
                <option value="published">게시</option>
                <option value="draft">비공개</option>
              </Select>
            </label>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">대상 학생</legend>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <label className="flex items-center gap-2"><input type="radio" checked={targetType === "all"} onChange={() => { setTargetType("all"); setStudentIds([]); }} />반 전체</label>
              <label className="flex items-center gap-2"><input type="radio" checked={targetType === "partial"} onChange={() => setTargetType("partial")} />일부 학생만</label>
            </div>
          </fieldset>
          {targetType === "partial" && (
            <div className="grid gap-3 rounded-md bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <label className="grid flex-1 gap-2 text-sm font-semibold">
                  학생 검색
                  <Input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="학생 이름 검색" />
                </label>
                <p className="text-sm font-semibold text-slate-600">선택 {studentIds.length}명</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredStudents.map((student) => (
                  <label key={student.id} className="flex items-center gap-2 rounded-md border border-line bg-white p-2 text-sm font-semibold">
                    <input type="checkbox" checked={studentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                    {student.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
          <Button type="button" onClick={assignHomework} disabled={isPending}>{isPending ? "배정 중..." : `배정하기 (${selectedAssignmentIds.length})`}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ClassTestOverview({ tests, onCreate }: { tests: TestRow[]; onCreate: () => void }) {
  return (
    <Card className="h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">시험</h2>
        <div className="flex items-center gap-2">
          <Badge tone="yellow">{tests.length}개</Badge>
          <Button type="button" onClick={onCreate}>시험 추가</Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {tests.length ? (
          tests.slice(0, 8).map((test) => (
            <article key={test.id} className="rounded-md border border-line bg-slate-50 p-4">
              <Badge tone="blue">{test.subject}</Badge>
              <h3 className="mt-2 font-bold">{test.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{formatDate(test.testDate)} · {formatTimeRange(test.startTime, test.endTime)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>결과 {test.resultCount}</Badge>
                <Badge tone="green">PASS {test.passCount}</Badge>
                <Badge tone="red">NonPASS {test.nonpassCount}</Badge>
              </div>
              {test.scope && <p className="mt-2 text-sm text-slate-600">범위: {test.scope}</p>}
            </article>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">등록된 시험이 없습니다.</p>
        )}
      </div>
    </Card>
  );
}

function SubjectHomeworkSummary({
  subjects,
  ungroupedAssignments,
}: {
  subjects: Array<{ id: string; name: string; assignments: AssignmentRow[]; targetCount: number; submittedCount: number; missingCount: number; needsReviewCount: number }>;
  ungroupedAssignments: AssignmentRow[];
}) {
  const hasItems = subjects.length > 0 || ungroupedAssignments.length > 0;

  return (
    <Card>
      <h2 className="font-bold">과목별 숙제 현황</h2>
      <div className="mt-3 grid gap-3">
        {hasItems ? (
          <>
            {subjects.map((subject) => (
              <div key={subject.id} className="rounded-md border border-line p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold">{subject.name}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge>숙제 {subject.assignments.length}</Badge>
                    <Badge tone="green">제출 {subject.submittedCount}/{subject.targetCount}</Badge>
                    <Badge tone="red">미제출 {subject.missingCount}</Badge>
                    <Badge tone="yellow">검토 {subject.needsReviewCount}</Badge>
                  </div>
                </div>
                <div className="mt-2 grid gap-1">
                  {subject.assignments.slice(0, 3).map((assignment) => (
                    <p key={assignment.id} className="truncate text-sm text-slate-500">
                      {assignment.title} · 제출 {assignment.submittedCount}/{assignment.targetCount}
                    </p>
                  ))}
                  {subject.assignments.length === 0 && <p className="text-sm text-slate-400">배정된 숙제가 없습니다.</p>}
                </div>
              </div>
            ))}
            {ungroupedAssignments.length > 0 && (
              <div className="rounded-md border border-line p-3">
                <p className="font-semibold">과목 없음</p>
                <div className="mt-2 grid gap-1">
                  {ungroupedAssignments.slice(0, 3).map((assignment) => (
                    <p key={assignment.id} className="truncate text-sm text-slate-500">
                      {assignment.title} · 제출 {assignment.submittedCount}/{assignment.targetCount}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">등록된 과목이나 숙제가 없습니다.</p>
        )}
      </div>
    </Card>
  );
}

function SummaryCard({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; meta: string }> }) {
  return (
    <Card>
      <h2 className="font-bold">{title}</h2>
      <div className="mt-3 grid gap-2">
        {items.length ? items.map((item) => <ListLine key={item.id} title={item.title} meta={item.meta} />) : <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">{empty}</p>}
      </div>
    </Card>
  );
}

function ListLine({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-md border border-line p-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{meta}</p>
    </div>
  );
}

function StudentsTab({ classId, students, onChanged }: { classId: string; students: StudentRow[]; onChanged: (msg: string) => void }) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">학생 목록</h2>
        <Button type="button" onClick={() => setIsAddOpen(true)}>학생 추가</Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {students.length ? (
          students.map((student) => (
            <Link
              key={student.id}
              href={`/teacher/students/${student.id}`}
              className="block rounded-md border border-line p-3 text-sm transition hover:border-action hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-action/30"
            >
              <p className="font-bold">{student.name}</p>
              <p className="text-slate-500">{student.studentLoginId}</p>
              <Badge tone={student.status === "active" ? "green" : "gray"}>{student.status}</Badge>
            </Link>
          ))
        ) : (
          <p className="text-sm text-slate-500">이 반에 등록된 학생이 없습니다.</p>
        )}
      </div>
      {isAddOpen && (
        <AddExistingStudentsModal
          classId={classId}
          currentStudentIds={students.map((student) => student.id)}
          onClose={() => setIsAddOpen(false)}
          onAdded={(addedCount) => {
            setIsAddOpen(false);
            onChanged(`학생 ${addedCount}명을 반에 추가했습니다.`);
          }}
        />
      )}
    </Card>
  );
}

function AddExistingStudentsModal({
  classId,
  currentStudentIds,
  onClose,
  onAdded,
}: {
  classId: string;
  currentStudentIds: string[];
  onClose: () => void;
  onAdded: (addedCount: number) => void;
}) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/teacher/students", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: StudentRow[]) => setStudents(data.filter((student) => student.status === "active" && !currentStudentIds.includes(student.id))))
      .catch(() => setStudents([]));
  }, [currentStudentIds]);

  const filteredStudents = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return students.filter((student) => (
      !keyword
      || student.name.toLowerCase().includes(keyword)
      || student.studentLoginId.toLowerCase().includes(keyword)
    ));
  }, [query, students]);

  function toggleStudent(studentId: string) {
    setSelectedIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  }

  function addStudents() {
    if (selectedIds.length === 0) {
      setError("추가할 학생을 선택해주세요.");
      return;
    }
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "학생을 추가하지 못했습니다.");
        return;
      }
      onAdded(data.addedCount ?? selectedIds.length);
    });
  }

  return (
    <Modal title="기존 학생 추가" onClose={onClose}>
      <div className="grid gap-4">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <label className="grid gap-2 text-sm font-semibold">
          학생 검색
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="학생 이름 또는 아이디 검색" />
        </label>
        <div className="grid max-h-[55vh] gap-2 overflow-auto rounded-md border border-line p-2 sm:grid-cols-2">
          {filteredStudents.length ? (
            filteredStudents.map((student) => (
              <label key={student.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-white p-3 text-sm transition hover:border-action">
                <input type="checkbox" className="mt-1" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                <span>
                  <span className="block font-bold">{student.name}</span>
                  <span className="text-slate-500">{student.studentLoginId}</span>
                  {student.classNames && student.classNames.length > 0 && (
                    <span className="mt-1 block text-xs font-semibold text-slate-400">{student.classNames.join(", ")}</span>
                  )}
                </span>
              </label>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500 sm:col-span-2">추가할 수 있는 기존 학생이 없습니다.</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
          <Button type="button" onClick={addStudents} disabled={isPending || selectedIds.length === 0}>
            {isPending ? "추가 중..." : `선택 학생 추가 (${selectedIds.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function HomeworkTab({ subjects, assignments }: { subjects: ClassSubject[]; assignments: AssignmentRow[] }) {
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const filteredAssignments = selectedSubjectId === "all" ? assignments : assignments.filter((assignment) => assignment.classSubjectId === selectedSubjectId);

  useEffect(() => {
    if (selectedSubjectId !== "all" && !subjects.some((subject) => subject.id === selectedSubjectId)) {
      setSelectedSubjectId("all");
    }
  }, [selectedSubjectId, subjects]);

  return (
    <Card>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="font-bold">숙제 관리</h2>
      </div>
      <div className="mt-4 rounded-md border border-line bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selectedSubjectId === "all" ? "primary" : "secondary"} onClick={() => setSelectedSubjectId("all")}>전체</Button>
          {subjects.map((subject) => (
            <Button key={subject.id} type="button" variant={selectedSubjectId === subject.id ? "primary" : "secondary"} onClick={() => setSelectedSubjectId(subject.id)}>
              {subject.name}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        {filteredAssignments.length ? (
          filteredAssignments.map((assignment) => (
            <div key={assignment.id} className="rounded-md border border-line p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-bold">{assignment.title}</h3>
                  <p className="text-sm text-slate-500">마감 {assignment.dueAt ? formatDate(assignment.dueAt) : "-"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>대상 {assignment.targetCount}</Badge>
                    <Badge tone="green">제출 {assignment.submittedCount}</Badge>
                    <Badge tone="red">미제출 {assignment.missingCount}</Badge>
                    <Badge tone="yellow">검토 {assignment.needsReviewCount}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button href={`/teacher/assignments/${assignment.id}/targets`} variant="secondary">
                    배정 관리
                  </Button>
                  <Button href={`/teacher/assignments/new?assignmentId=${assignment.id}`} variant="secondary">
                    수정
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">등록된 숙제가 없습니다.</p>
        )}
      </div>
    </Card>
  );
}

function SubjectManagementModal({
  classId,
  subjects,
  onClose,
  onChanged,
}: {
  classId: string;
  subjects: ClassSubject[];
  onClose: () => void;
  onChanged: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjectDrafts, setSubjectDrafts] = useState<Record<string, { name: string; description: string }>>({});

  function draftFor(subject: ClassSubject) {
    return subjectDrafts[subject.id] ?? { name: subject.name, description: subject.description ?? "" };
  }

  function updateSubjectDraft(subject: ClassSubject, patch: Partial<{ name: string; description: string }>) {
    setSubjectDrafts((current) => ({
      ...current,
      [subject.id]: { ...draftFor(subject), ...patch },
    }));
  }

  async function addSubject() {
    const response = await fetch(`/api/teacher/classes/${classId}/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      onChanged(data.error ?? "과목을 저장하지 못했습니다.");
      return;
    }
    setName("");
    setDescription("");
    onChanged("과목을 추가했습니다.");
  }

  async function saveSubject(subject: ClassSubject) {
    const draft = draftFor(subject);
    const response = await fetch(`/api/teacher/classes/${classId}/subjects/${subject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name, description: draft.description }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      onChanged(data.error ?? "과목을 수정하지 못했습니다.");
      return;
    }
    setSubjectDrafts((current) => {
      const next = { ...current };
      delete next[subject.id];
      return next;
    });
    onChanged("과목을 수정했습니다.");
  }

  async function archiveSubject(subjectId: string) {
    const response = await fetch(`/api/teacher/classes/${classId}/subjects/${subjectId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    onChanged(response.ok ? "과목을 삭제했습니다." : data.error ?? "과목을 삭제하지 못했습니다.");
  }

  return (
    <Modal title="과목 관리" onClose={onClose}>
      <div className="grid gap-5">
        <div className="grid gap-3 rounded-md border border-line bg-slate-50 p-4">
          <h3 className="font-bold">과목 추가</h3>
          <label className="grid gap-1 text-sm font-semibold">
            과목명
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Reading A" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            설명
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="선택 사항" />
          </label>
          <div className="flex justify-end">
            <Button type="button" onClick={addSubject}>과목 추가</Button>
          </div>
        </div>
        <div className="grid gap-3">
          <h3 className="font-bold">과목 목록</h3>
          {subjects.length ? (
            subjects.map((subject) => {
              const draft = draftFor(subject);
              return (
                <div key={subject.id} className="grid gap-3 rounded-md border border-line p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">
                      과목명
                      <Input value={draft.name} onChange={(event) => updateSubjectDraft(subject, { name: event.target.value })} />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                      설명
                      <Input value={draft.description} onChange={(event) => updateSubjectDraft(subject, { description: event.target.value })} />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => saveSubject(subject)}>수정 저장</Button>
                    <Button type="button" variant="danger" onClick={() => archiveSubject(subject.id)}>삭제</Button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">등록된 과목이 없습니다.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function NoticesTab({ classId, notices, onChanged }: { classId: string; notices: Notice[]; onChanged: (msg: string) => void }) {
  const [editing, setEditing] = useState<Notice | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function remove(noticeId: string) {
    if (!window.confirm("반 공지사항을 삭제할까요?")) return;
    await fetch(`/api/teacher/notices/${noticeId}`, { method: "DELETE" });
    onChanged("반 공지사항을 삭제했습니다.");
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">반 공지사항</h2>
        <Button onClick={() => { setEditing(null); setIsOpen(true); }}>반 공지 작성</Button>
      </div>
      <div className="mt-3 grid gap-3">
        {notices.length ? (
          notices.map((notice) => (
            <div key={notice.id} className="rounded-md border border-line p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex gap-2">
                    <Badge tone="green">반</Badge>
                    <Badge>{notice.status}</Badge>
                  </div>
                  <h3 className="mt-2 font-bold">{notice.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{notice.content}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setEditing(notice); setIsOpen(true); }}>수정</Button>
                  <Button variant="danger" onClick={() => remove(notice.id)}>삭제</Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">이 반에 등록된 공지사항이 없습니다.</p>
        )}
      </div>
      {isOpen && <NoticeModal classId={classId} notice={editing} onClose={() => setIsOpen(false)} onSaved={() => { setIsOpen(false); onChanged("반 공지사항을 저장했습니다."); }} />}
    </Card>
  );
}

function NoticeModal({ classId, notice, onClose, onSaved }: { classId: string; notice: Notice | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [imageUrl, setImageUrl] = useState(notice?.imageUrl ?? "");
  const [status, setStatus] = useState(notice?.status ?? "published");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await fetch(notice ? `/api/teacher/notices/${notice.id}` : `/api/teacher/classes/${classId}/notices`, {
        method: notice ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, imageUrl: imageUrl || null, status }),
      });
      onSaved();
    });
  }

  return (
    <Modal title={notice ? "반 공지 수정" : "반 공지 작성"} onClose={onClose}>
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">제목<Input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold">본문<Textarea value={content} onChange={(event) => setContent(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold">이미지 URL<Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold">공개 상태<Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="published">published</option><option value="draft">draft</option><option value="hidden">hidden</option></Select></label>
        <ModalActions onClose={onClose} onSave={save} isPending={isPending} />
      </div>
    </Modal>
  );
}

function ClassSelectedDateSchedule({
  selectedDate,
  events,
  tests,
  assignments,
}: {
  selectedDate: string;
  events: CalendarEvent[];
  tests: TestRow[];
  assignments: AssignmentRow[];
}) {
  const selectedEvents = events.filter((event) => dateOnly(event.eventDate) === selectedDate);
  const selectedTests = tests.filter((test) => test.status !== "hidden" && dateOnly(test.testDate) === selectedDate);
  const selectedAssignments = assignments.filter((assignment) => dateOnly(assignment.dueAt) === selectedDate);
  const hasItems = selectedEvents.length > 0 || selectedTests.length > 0 || selectedAssignments.length > 0;

  return (
    <Card className="rounded-t-none border-t-0 shadow-none">
      <h3 className="font-bold">{formatDate(selectedDate)} 일정</h3>
      <div className="mt-3 grid gap-3">
        {selectedEvents.map((event) => (
          <article key={event.id} className="rounded-md border border-line bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={eventTone(event.eventType)}>{eventLabel(event.eventType)}</Badge>
              <span className="text-xs font-semibold text-slate-500">{formatTimeRange(event.startTime, event.endTime, "시간 미정")}</span>
            </div>
            <p className="mt-2 font-bold">{event.title}</p>
            {event.description && <p className="mt-1 text-sm leading-6 text-slate-600">{event.description}</p>}
          </article>
        ))}
        {selectedTests.map((test) => (
          <article key={test.id} className="rounded-md border border-line bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="yellow">시험</Badge>
              <Badge tone="blue">{test.subject}</Badge>
              <span className="text-xs font-semibold text-slate-500">{formatTimeRange(test.startTime, test.endTime, "시간 미정")}</span>
            </div>
            <p className="mt-2 font-bold">{test.title}</p>
            {test.scope && <p className="mt-1 text-sm text-slate-600">범위: {test.scope}</p>}
          </article>
        ))}
        {selectedAssignments.map((assignment) => (
          <article key={assignment.id} className="rounded-md border border-line bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">숙제 마감</Badge>
              {assignment.subjectName && <Badge>{assignment.subjectName}</Badge>}
            </div>
            <p className="mt-2 font-bold">{assignment.title}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>대상 {assignment.targetCount}</Badge>
              <Badge tone="green">제출 {assignment.submittedCount}</Badge>
              <Badge tone="red">미제출 {assignment.missingCount}</Badge>
              <Badge tone="yellow">검토 {assignment.needsReviewCount}</Badge>
            </div>
          </article>
        ))}
        {!hasItems && (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">선택한 날짜에 등록된 일정이 없습니다.</p>
        )}
      </div>
    </Card>
  );
}

function ScheduleTab({ classId, events, tests, assignments, onChanged }: { classId: string; events: CalendarEvent[]; tests: TestRow[]; assignments: AssignmentRow[]; onChanged: (msg: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const firstDate = events[0]?.eventDate ?? tests[0]?.testDate ?? assignments.find((assignment) => assignment.dueAt)?.dueAt ?? "2026-05-25";
  const [selectedDate, setSelectedDate] = useState(dateOnly(firstDate));
  const [displayMonth, setDisplayMonth] = useState(monthStart(firstDate));
  const visibleEvents = events.filter((event) => event.status !== "hidden");
  const selectedEvents = visibleEvents.filter((event) => dateOnly(event.eventDate) === selectedDate);
  const selectedTests = tests.filter((test) => test.status !== "hidden" && dateOnly(test.testDate) === selectedDate);
  const selectedAssignments = assignments.filter((assignment) => dateOnly(assignment.dueAt) === selectedDate);

  function moveMonth(amount: number) {
    setDisplayMonth((current) => {
      const nextMonth = addMonths(current, amount);
      setSelectedDate((currentSelectedDate) => selectedDateForMonth(nextMonth, currentSelectedDate));
      return nextMonth;
    });
  }

  function moveToday() {
    const today = toDateString(new Date());
    setDisplayMonth(monthStart(today));
    setSelectedDate(today);
  }

  async function remove(eventId: string) {
    await fetch(`/api/teacher/classes/${classId}/calendar-events/${eventId}`, { method: "DELETE" });
    onChanged("일정을 삭제했습니다.");
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">수업 일정</h2>
          <p className="mt-1 text-sm text-slate-500">이 캘린더는 반 단위로 공유되어 같은 반 학생 홈 화면에도 표시됩니다.</p>
        </div>
        <Button onClick={() => { setEditingEvent(null); setIsOpen(true); }}>일정 추가</Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <ClassCalendarGrid
          events={visibleEvents}
          tests={tests}
          assignments={assignments}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          displayMonth={displayMonth}
          onPreviousMonth={() => moveMonth(-1)}
          onNextMonth={() => moveMonth(1)}
          onToday={moveToday}
        />
        <div className="rounded-lg border border-line bg-slate-50 p-4">
          <h3 className="font-bold">{formatDate(selectedDate)} 일정</h3>
          <div className="mt-3 grid gap-3">
            {selectedEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-line bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone={eventTone(event.eventType)}>{eventLabel(event.eventType)}</Badge>
                    <p className="mt-2 font-bold">{event.title}</p>
                    <p className="text-sm text-slate-500">{event.startTime ?? ""}{event.startTime || event.endTime ? " - " : ""}{event.endTime ?? ""}</p>
                    {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => { setEditingEvent(event); setIsOpen(true); }}>수정</Button>
                    <Button variant="danger" onClick={() => remove(event.id)}>삭제</Button>
                  </div>
                </div>
              </div>
            ))}
            {selectedTests.map((test) => (
              <div key={test.id} className="rounded-md border border-line bg-white p-3">
                <Badge tone="yellow">시험</Badge>
                <p className="mt-2 font-bold">{test.title}</p>
                <p className="text-sm text-slate-500">{test.subject} · {formatTimeRange(test.startTime, test.endTime)} · {test.scope ?? "-"}</p>
              </div>
            ))}
            {selectedAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-md border border-line bg-white p-3">
                <Badge tone="blue">숙제 마감</Badge>
                <p className="mt-2 font-bold">{assignment.title}</p>
                <p className="text-sm text-slate-500">제출 {assignment.submittedCount}/{assignment.targetCount}명</p>
              </div>
            ))}
            {selectedEvents.length === 0 && selectedTests.length === 0 && selectedAssignments.length === 0 && <p className="rounded-md border border-dashed border-line bg-white p-4 text-center text-sm text-slate-500">선택한 날짜에 일정이 없습니다.</p>}
          </div>
        </div>
      </div>

      {isOpen && <ClassScheduleForm classId={classId} event={editingEvent} onClose={() => setIsOpen(false)} onSaved={(message) => { setIsOpen(false); setEditingEvent(null); onChanged(message ?? "일정을 저장했습니다."); }} />}
    </Card>
  );
}

function ClassCalendarGrid({
  events,
  tests,
  assignments,
  selectedDate,
  onSelectDate,
  displayMonth,
  onPreviousMonth,
  onNextMonth,
  onToday,
  action,
}: {
  events: CalendarEvent[];
  tests: TestRow[];
  assignments: AssignmentRow[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  displayMonth: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  action?: ReactNode;
}) {
  const days = buildMonthDays(displayMonth);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, Array<{ type: string; id: string; label: string }>>();
    for (const event of events) {
      const key = dateOnly(event.eventDate);
      grouped.set(key, [...(grouped.get(key) ?? []), { type: event.eventType, id: event.id, label: eventLabel(event.eventType) }]);
    }
    for (const test of tests) {
      const key = dateOnly(test.testDate);
      grouped.set(key, [...(grouped.get(key) ?? []), { type: "test", id: test.id, label: test.subject }]);
    }
    for (const assignment of assignments) {
      const key = dateOnly(assignment.dueAt);
      if (key) grouped.set(key, [...(grouped.get(key) ?? []), { type: "assignment_due", id: assignment.id, label: "숙제" }]);
    }
    return grouped;
  }, [events, tests, assignments]);

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            aria-label="이전달"
          >
            &lt;
          </button>
          <h3 className="min-w-28 text-center text-base font-extrabold text-ink">
            {new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(`${dateOnly(displayMonth)}T00:00:00`))}
          </h3>
          <button
            type="button"
            onClick={onNextMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            aria-label="다음달"
          >
            &gt;
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToday}
            className="inline-flex min-h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            오늘
          </button>
          {action ?? <Badge tone="blue">반 캘린더</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          const markers = date ? eventsByDate.get(date) ?? [] : [];
          const isSelected = date === selectedDate;
          return (
            <button
              key={date ?? `empty-${index}`}
              type="button"
              disabled={!date}
              onClick={() => date && onSelectDate(date)}
              className={cn("min-h-20 rounded-md border border-line p-1.5 text-left text-sm transition disabled:bg-transparent", date && "bg-white hover:border-action hover:bg-blue-50", isSelected && "border-action bg-blue-50 ring-1 ring-action")}
            >
              {date && (
                <>
                  <span className="font-bold">{Number(date.slice(-2))}</span>
                  <div className="mt-1 grid gap-1">
                    {markers.slice(0, 2).map((marker) => (
                      <span
                        key={`${marker.type}-${marker.id}`}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[10px] font-bold leading-4",
                          marker.type === "cancelled" && "bg-red-50 text-red-700",
                          marker.type === "test" && "bg-yellow-50 text-yellow-700",
                          marker.type === "assignment_due" && "bg-violet-50 text-violet-700",
                          marker.type === "makeup" && "bg-green-50 text-green-700",
                          marker.type === "class" && "bg-blue-50 text-blue-700",
                          marker.type === "etc" && "bg-slate-100 text-slate-600",
                        )}
                      >
                        {marker.label}
                      </span>
                    ))}
                    {markers.length > 2 && <span className="text-[10px] font-bold text-slate-500">+{markers.length - 2}</span>}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleModal({ classId, event, onClose, onSaved }: { classId: string; event: CalendarEvent | null; onClose: () => void; onSaved: () => void }) {
  const [eventType, setEventType] = useState(event?.eventType ?? "class");
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventDate, setEventDate] = useState(event?.eventDate ?? "2026-05-25");
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(event ? `/api/teacher/classes/${classId}/calendar-events/${event.id}` : `/api/teacher/classes/${classId}/calendar-events`, {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, title, eventDate, startTime: startTime || null, endTime: endTime || null, description }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "일정을 저장하지 못했습니다.");
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal title={event ? "일정 수정" : "일정 추가"} onClose={onClose}>
      <div className="grid gap-4">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <label className="grid gap-2 text-sm font-semibold">유형<Select value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="class">정규수업</option><option value="cancelled">휴강</option><option value="makeup">보강</option><option value="notice">공지</option><option value="etc">기타</option></Select></label>
        <label className="grid gap-2 text-sm font-semibold">날짜<Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">시작 시간<Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-semibold">종료 시간<Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        </div>
        <label className="grid gap-2 text-sm font-semibold">제목<Input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold">설명<Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <ModalActions onClose={onClose} onSave={save} isPending={isPending} />
      </div>
    </Modal>
  );
}

function TestsTab({ classId, students, tests, onChanged }: { classId: string; students: StudentRow[]; tests: TestRow[]; onChanged: (msg: string) => void }) {
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<TestRow | null>(null);
  const [resultTest, setResultTest] = useState<TestRow | null>(null);

  async function remove(testId: string) {
    await fetch(`/api/teacher/tests/${testId}`, { method: "DELETE" });
    onChanged("테스트를 삭제했습니다.");
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">테스트 관리</h2>
        <Button onClick={() => { setEditingTest(null); setIsTestOpen(true); }}>테스트 추가</Button>
      </div>
      <div className="mt-3 grid gap-3">
        {tests.length ? (
          tests.map((test) => (
            <div key={test.id} className="rounded-md border border-line p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <Badge tone="blue">{test.subject}</Badge>
                  <h3 className="mt-2 font-bold">{test.title}</h3>
                <p className="text-sm text-slate-500">{formatDate(test.testDate)} · {formatTimeRange(test.startTime, test.endTime)} · 범위: {test.scope ?? "-"}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge>결과 {test.resultCount}</Badge>
                    <Badge tone="green">PASS {test.passCount}</Badge>
                    <Badge tone="red">NonPASS {test.nonpassCount}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setResultTest(test)}>결과 입력</Button>
                  <Button variant="secondary" onClick={() => { setEditingTest(test); setIsTestOpen(true); }}>수정</Button>
                  <Button variant="danger" onClick={() => remove(test.id)}>삭제</Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">등록된 테스트가 없습니다.</p>
        )}
      </div>
      {isTestOpen && <TestModal classId={classId} test={editingTest} onClose={() => setIsTestOpen(false)} onSaved={() => { setIsTestOpen(false); setEditingTest(null); onChanged("테스트를 저장했습니다."); }} />}
      {resultTest && <TestResultModal test={resultTest} students={students} onClose={() => setResultTest(null)} onSaved={() => { setResultTest(null); onChanged("테스트 결과를 저장했습니다."); }} />}
    </Card>
  );
}

function TestModal({ classId, test, onClose, onSaved }: { classId: string; test: TestRow | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(test?.title ?? "");
  const [subject, setSubject] = useState(test?.subject ?? "SR");
  const [testDate, setTestDate] = useState(test?.testDate ?? "2026-05-27");
  const [startTime, setStartTime] = useState(test?.startTime ?? "");
  const [endTime, setEndTime] = useState(test?.endTime ?? "");
  const [scope, setScope] = useState(test?.scope ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(test ? `/api/teacher/tests/${test.id}` : "/api/teacher/tests", {
        method: test ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, title, subject, testDate, startTime: startTime || null, endTime: endTime || null, scope }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "테스트를 저장하지 못했습니다.");
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal title={test ? "테스트 수정" : "테스트 추가"} onClose={onClose}>
      <div className="grid gap-4">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <label className="grid gap-2 text-sm font-semibold">시험명<Input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold">과목<Input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold">시험 날짜<Input type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">시작 시간<Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-semibold">종료 시간<Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        </div>
        <label className="grid gap-2 text-sm font-semibold">범위<Input value={scope} onChange={(event) => setScope(event.target.value)} /></label>
        <ModalActions onClose={onClose} onSave={save} isPending={isPending} />
      </div>
    </Modal>
  );
}

function TestResultModal({ test, students, onClose, onSaved }: { test: TestRow; students: StudentRow[]; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<TestResultRow[]>(students.map((student) => ({ studentId: student.id, studentName: student.name, score: null, maxScore: 100, result: "PASS", teacherMemo: "", takenAt: test.testDate })));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/teacher/tests/${test.id}/results`)
      .then((response) => response.json())
      .then((data) => {
        if (data.results?.length) setRows(data.results);
      })
      .catch(() => undefined);
  }, [test.id]);

  function update(studentId: string, input: Partial<TestResultRow>) {
    setRows((current) => current.map((row) => (row.studentId === studentId ? { ...row, ...input } : row)));
  }

  function save() {
    startTransition(async () => {
      await fetch(`/api/teacher/tests/${test.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: rows }),
      });
      onSaved();
    });
  }

  return (
    <Modal title={`${test.title} 결과 입력`} onClose={onClose}>
      <div className="grid max-h-[65vh] gap-3 overflow-auto">
        {rows.map((row) => (
          <div key={row.studentId} className="rounded-md border border-line p-3">
            <p className="font-bold">{row.studentName}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-[120px_150px_1fr]">
              <Input type="number" value={row.score ?? ""} onChange={(event) => update(row.studentId, { score: event.target.value ? Number(event.target.value) : null })} placeholder="점수" />
              <Select value={row.result} onChange={(event) => update(row.studentId, { result: event.target.value as "PASS" | "NonPASS" })}>
                <option value="PASS">PASS</option>
                <option value="NonPASS">NonPASS</option>
              </Select>
              <Input value={row.teacherMemo} onChange={(event) => update(row.studentId, { teacherMemo: event.target.value })} placeholder="선생님 메모" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button onClick={save} disabled={isPending}>{isPending ? "저장 중..." : "저장"}</Button>
      </div>
    </Modal>
  );
}

function ModalActions({ onClose, onSave, isPending }: { onClose: () => void; onSave: () => void; isPending: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose}>취소</Button>
      <Button onClick={onSave} disabled={isPending}>{isPending ? "저장 중..." : "저장"}</Button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
        </div>
        {children}
      </div>
    </div>
  );
}
