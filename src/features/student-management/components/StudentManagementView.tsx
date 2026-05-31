"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { gradeOptions, studentAvatars, studentRepository } from "@/features/student-management/repositories/studentRepository";
import type { Class } from "@/types/class";
import type { ManagedStudent, StudentLearningHistory, StudentManagementTab } from "@/features/student-management/types/studentManagement";
import { assignmentTypeLabel as formatAssignmentTypeLabel } from "@/lib/assignmentTypes";

const tabs: Array<{ id: StudentManagementTab; label: string }> = [
  { id: "detail", label: "상세정보" },
  { id: "learning", label: "학습이력" },
];

type PasswordTarget = "student" | "parent";

const avatarLabel: Record<string, string> = {
  robot: "AI",
  "boy-blonde": "B",
  "girl-brown": "G",
  "boy-dark": "S",
  "girl-black": "A",
  "boy-orange": "O",
  "girl-red": "R",
};

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="모달 닫기">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function StudentManagementView({ initialStudents }: { initialStudents: ManagedStudent[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudents[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<StudentManagementTab>("detail");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<PasswordTarget | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [learningHistory, setLearningHistory] = useState<StudentLearningHistory[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0] ?? null;

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      [student.name, student.studentId, ...student.classNames].filter(Boolean).some((value) => value.toLowerCase().includes(query)),
    );
  }, [searchQuery, students]);

  async function loadClasses() {
    const response = await fetch("/api/teacher/classes", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    const items = response.ok ? await response.json() as Class[] : [];
    setClasses(items.filter((classItem) => classItem.status === "active"));
  }

  async function loadStudents() {
    const response = await fetch("/api/teacher/students", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!response.ok) {
      throw new Error("학생 목록을 불러오지 못했습니다.");
    }

    const items = await response.json() as ManagedStudent[];
    setStudents(items);
    setSelectedStudentId((current) => {
      if (current && items.some((student) => student.id === current)) return current;
      return items[0]?.id ?? null;
    });
  }

  useEffect(() => {
    loadStudents().catch(() => setToast("학생 목록을 불러오지 못했습니다."));
    loadClasses().catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!selectedStudent) {
      setLearningHistory([]);
      return;
    }
    studentRepository.getLearningHistory(selectedStudent.id).then(setLearningHistory).catch(() => setLearningHistory([]));
  }, [selectedStudent]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function updateSelectedStudent(input: Partial<ManagedStudent>) {
    if (!selectedStudent) return;
    if ("name" in input && !input.name?.trim()) {
      setToast("학생 이름을 입력해주세요.");
      return;
    }
    const nextStudents = await studentRepository.updateStudent(selectedStudent.id, input, students);
    setStudents(nextStudents);
    setToast("학생 정보가 수정되었습니다.");
  }

  async function deleteSelectedStudent() {
    if (!selectedStudent) return;
    const nextStudents = await studentRepository.deleteStudent(selectedStudent.id, students);
    setStudents(nextStudents);
    setSelectedStudentId(nextStudents[0]?.id ?? null);
    setIsDeleteConfirmOpen(false);
    setToast("학생이 삭제되었습니다.");
  }

  async function changePassword(password: string) {
    if (!selectedStudent || !passwordTarget) return;
    const nextStudents = await studentRepository.updateStudent(
      selectedStudent.id,
      passwordTarget === "student" ? { password } : { parentPassword: password },
      students,
    );
    setStudents(nextStudents);
    setPasswordTarget(null);
    setToast(passwordTarget === "student" ? "학생 비밀번호가 변경되었습니다." : "보호자 비밀번호가 변경되었습니다.");
  }

  async function createStudent(formData: FormData) {
    const classIds = formData.getAll("classIds").map(String).filter(Boolean);
    const created = await studentRepository.createStudent({
      name: String(formData.get("name") ?? "").trim(),
      studentId: String(formData.get("studentId") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      schoolName: String(formData.get("schoolName") ?? "").trim(),
      grade: String(formData.get("grade") ?? "").trim(),
      classIds,
      avatarKey: String(formData.get("avatarKey") ?? "robot"),
      memo: String(formData.get("memo") ?? "").trim(),
    });

    setStudents((current) => [created, ...current]);
    setSelectedStudentId(created.id);
    setIsCreateModalOpen(false);
    setToast("학생이 등록되었습니다.");
  }

  async function deleteLearningHistoryItem(item: StudentLearningHistory) {
    if (!selectedStudent || !item.submissionId) return;
    await studentRepository.deleteSubmissionHistory(selectedStudent.id, item.submissionId);
    const nextHistory = await studentRepository.getLearningHistory(selectedStudent.id);
    setLearningHistory(nextHistory);
    setToast("제출 내역이 삭제되었습니다.");
  }

  return (
    <div className="relative">
      {toast && <div className="fixed right-4 top-4 z-50 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white shadow-soft">{toast}</div>}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <StudentSelector
          filteredStudents={filteredStudents}
          selectedStudentId={selectedStudent?.id ?? null}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onSelect={(studentId) => {
            setSelectedStudentId(studentId);
            setActiveTab("detail");
          }}
        />
        <StudentDetailPanel
          student={selectedStudent}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onCreate={() => setIsCreateModalOpen(true)}
          onStudentPassword={() => setPasswordTarget("student")}
          onParentPassword={() => setPasswordTarget("parent")}
          onDelete={() => setIsDeleteConfirmOpen(true)}
          onUpdate={updateSelectedStudent}
          learningHistory={learningHistory}
          onDeleteLearningHistory={deleteLearningHistoryItem}
          classes={classes}
        />
      </div>

      {isCreateModalOpen && <CreateStudentModal classes={classes} onClose={() => setIsCreateModalOpen(false)} onSubmit={createStudent} />}
      {passwordTarget && (
        <PasswordModal
          title={passwordTarget === "student" ? "학생 비밀번호 변경" : "보호자 비밀번호 변경"}
          onClose={() => setPasswordTarget(null)}
          onSubmit={changePassword}
        />
      )}
      {isDeleteConfirmOpen && (
        <ConfirmModal
          title="학생 삭제"
          message="이 학생을 삭제할까요? 학생과 연결된 과제 제출 이력도 함께 삭제됩니다."
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={deleteSelectedStudent}
        />
      )}
    </div>
  );
}

function StudentSelector({
  filteredStudents,
  selectedStudentId,
  searchQuery,
  onSearch,
  onSelect,
}: {
  filteredStudents: ManagedStudent[];
  selectedStudentId: string | null;
  searchQuery: string;
  onSearch: (value: string) => void;
  onSelect: (studentId: string) => void;
}) {
  return (
    <aside className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <label className="grid gap-2 text-sm font-semibold">
        학생 검색
        <Input value={searchQuery} onChange={(event) => onSearch(event.target.value)} placeholder="학생 이름 또는 아이디" />
      </label>
      <div className="mt-4 max-h-[calc(100vh-260px)] min-h-80 overflow-auto pr-1">
        {filteredStudents.length === 0 ? (
          <EmptyState>검색 결과가 없습니다.</EmptyState>
        ) : (
          <div className="grid gap-2">
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border border-line p-3 text-left transition hover:border-action",
                  selectedStudentId === student.id && "border-action bg-blue-50",
                )}
                onClick={() => onSelect(student.id)}
              >
                <Avatar avatarKey={student.avatarKey} selected={selectedStudentId === student.id} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{student.name}</span>
                  <span className="block truncate text-xs text-slate-500">{student.studentId}</span>
                  <span className="block truncate text-xs text-slate-400">{student.classNames.join(", ") || "미배정"}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function StudentDetailPanel({
  student,
  activeTab,
  setActiveTab,
  onCreate,
  onStudentPassword,
  onParentPassword,
  onDelete,
  onUpdate,
  learningHistory,
  onDeleteLearningHistory,
  classes,
}: {
  student: ManagedStudent | null;
  activeTab: StudentManagementTab;
  setActiveTab: (tab: StudentManagementTab) => void;
  onCreate: () => void;
  onStudentPassword: () => void;
  onParentPassword: () => void;
  onDelete: () => void;
  onUpdate: (input: Partial<ManagedStudent>) => void;
  learningHistory: StudentLearningHistory[];
  onDeleteLearningHistory: (item: StudentLearningHistory) => void | Promise<void>;
  classes: Class[];
}) {
  if (!student) {
    return (
      <section className="rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-4 flex justify-end">
          <Button onClick={onCreate}>학생 추가</Button>
        </div>
        <EmptyState>학생을 선택해주세요.</EmptyState>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-soft md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-action">학생 관리</p>
          <h1 className="text-2xl font-bold">{student.name}</h1>
        </div>
        <Button onClick={onCreate}>학생 추가</Button>
      </div>
      <div className="mt-5 overflow-x-auto border-b border-line">
        <div className="flex min-w-max gap-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={cn(
                "border-b-2 px-1 py-3 text-sm font-bold",
                activeTab === tab.id ? "border-action text-action" : "border-transparent text-slate-500",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <HomeworkStatusOverview history={learningHistory} />
      <div className="mt-5">
        {activeTab === "detail" && (
          <DetailTab
            student={student}
            classes={classes}
            onStudentPassword={onStudentPassword}
            onParentPassword={onParentPassword}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        )}
        {activeTab === "learning" && <LearningTab history={learningHistory} onDelete={onDeleteLearningHistory} />}
      </div>
    </section>
  );
}

function HomeworkStatusOverview({ history }: { history: StudentLearningHistory[] }) {
  const submittedCount = history.filter((item) => item.submitStatus === "submitted" || item.submitStatus === "late").length;
  const missingCount = history.filter((item) => item.submitStatus === "not_submitted").length;
  const needsReviewCount = history.filter((item) => item.reviewStatus === "pending").length;

  return (
    <section className="mt-5 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusMetric label="전체 숙제" value={history.length} />
        <StatusMetric label="제출 완료" value={submittedCount} tone="green" />
        <StatusMetric label="미제출" value={missingCount} tone="red" />
        <StatusMetric label="검토 필요" value={needsReviewCount} tone="yellow" />
      </div>
    </section>
  );
}

function StatusMetric({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "green" | "red" | "yellow" }) {
  const valueClass =
    tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : tone === "yellow" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function DetailTab({
  student,
  classes,
  onStudentPassword,
  onParentPassword,
  onDelete,
  onUpdate,
}: {
  student: ManagedStudent;
  classes: Class[];
  onStudentPassword: () => void;
  onParentPassword: () => void;
  onDelete: () => void;
  onUpdate: (input: Partial<ManagedStudent>) => void;
}) {
  const [draft, setDraft] = useState(student);
  const [selectedClassIds, setSelectedClassIds] = useState(student.classIds);

  useEffect(() => {
    setDraft(student);
    setSelectedClassIds(student.classIds);
  }, [student]);

  function toggleClass(classId: string) {
    setSelectedClassIds((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]);
  }

  return (
    <div className="grid gap-5">
      <div className="overflow-hidden rounded-md border border-line bg-white">
        <DetailRow label="학생 아이디">
          <span className="font-semibold">{student.studentId}</span>
        </DetailRow>
        <DetailRow label="비밀번호">
          <Button variant="secondary" onClick={onStudentPassword}>비밀번호 변경</Button>
        </DetailRow>
        <DetailRow label="학생 이름">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </DetailRow>
        <DetailRow label="학교 / 학년">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Input value={draft.schoolName ?? ""} onChange={(event) => setDraft({ ...draft, schoolName: event.target.value })} />
            <Select value={draft.grade ?? ""} onChange={(event) => setDraft({ ...draft, grade: event.target.value })}>
              <option value="">선택</option>
              {gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}
            </Select>
          </div>
        </DetailRow>
        <DetailRow label="반 배정">
          <ClassCheckboxGroup classes={classes} selectedClassIds={selectedClassIds} onToggle={toggleClass} />
        </DetailRow>
        <DetailRow label="학생 아이콘">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {studentAvatars.map((avatar) => (
              <button
                key={avatar}
                className={cn("rounded-md border p-2", draft.avatarKey === avatar ? "border-action bg-blue-50" : "border-line")}
                onClick={() => setDraft({ ...draft, avatarKey: avatar })}
                type="button"
              >
                <Avatar avatarKey={avatar} selected={draft.avatarKey === avatar} />
              </button>
            ))}
          </div>
        </DetailRow>
        <DetailRow label="메모">
          <Textarea value={draft.memo ?? ""} onChange={(event) => setDraft({ ...draft, memo: event.target.value })} />
        </DetailRow>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-white">
        <DetailRow label="보호자 계정">
          <span className="font-semibold">{draft.parentId || "미등록"}</span>
        </DetailRow>
        <DetailRow label="보호자 비밀번호">
          <Button variant="secondary" onClick={onParentPassword}>비밀번호 변경</Button>
        </DetailRow>
      </div>
      <div className="grid gap-2 sm:flex sm:justify-end">
        <Button variant="danger" onClick={onDelete}>학생 삭제</Button>
        <Button onClick={() => onUpdate({ ...draft, classIds: selectedClassIds })}>정보 수정</Button>
      </div>
    </div>
  );
}

function ClassCheckboxGroup({
  classes,
  selectedClassIds,
  onToggle,
}: {
  classes: Class[];
  selectedClassIds: string[];
  onToggle: (classId: string) => void;
}) {
  if (classes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">
        아직 생성된 반이 없습니다. 먼저 반 관리에서 반을 만들어주세요.
        <div className="mt-3">
          <Button href="/teacher/classes" variant="secondary">반 관리로 이동</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {classes.map((classItem) => (
        <label key={classItem.id} className="flex items-start gap-3 rounded-md border border-line p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={selectedClassIds.includes(classItem.id)}
            onChange={() => onToggle(classItem.id)}
          />
          <span>
            <span className="block font-bold">{classItem.name}</span>
            <span className="block text-xs text-slate-500">학생 {classItem.studentCount}명</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid border-b border-line last:border-b-0 md:grid-cols-[220px_1fr]">
      <div className="bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700">{label}</div>
      <div className="min-w-0 px-4 py-3 text-sm text-slate-800">{children}</div>
    </div>
  );
}

function Avatar({ avatarKey, selected }: { avatarKey: string; selected?: boolean }) {
  return (
    <span className={cn("grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold", selected ? "bg-action text-white" : "bg-slate-100 text-slate-700")}>
      {avatarLabel[avatarKey] ?? "ST"}
    </span>
  );
}

function LearningTab({ history, onDelete }: { history: StudentLearningHistory[]; onDelete: (item: StudentLearningHistory) => void | Promise<void> }) {
  const [deleteTarget, setDeleteTarget] = useState<StudentLearningHistory | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget?.submissionId) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "제출 내역 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (history.length === 0) return <EmptyState>아직 학습 이력이 없습니다.</EmptyState>;
  return (
    <>
      <Table headers={["날짜", "숙제명", "반", "유형", "제출 상태", "피드백 상태", "상세 보기", "삭제"]}>
        {history.map((item) => (
          <tr key={item.id} className="border-t border-line">
            <td className="py-3">{item.date}</td>
            <td className="font-semibold">{item.assignmentTitle}</td>
            <td>{item.className ?? "-"}</td>
            <td>{assignmentTypeLabel(item.assignmentType)}</td>
            <td><Badge tone={item.submitStatus === "submitted" ? "green" : item.submitStatus === "late" ? "yellow" : "red"}>{submitStatusLabel(item.submitStatus)}</Badge></td>
            <td>{reviewStatusLabel(item.reviewStatus)}</td>
            <td>{item.detailHref ? <Button href={item.detailHref} variant="secondary">상세</Button> : <Button disabled variant="secondary">상세</Button>}</td>
            <td>
              <Button type="button" variant="danger" disabled={!item.submissionId} onClick={() => setDeleteTarget(item)}>
                삭제하기
              </Button>
            </td>
          </tr>
        ))}
      </Table>
      {deleteTarget && (
        <Modal title="제출 내역 삭제" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm leading-6 text-slate-700">
            {deleteTarget.assignmentTitle} 제출 내역만 삭제할까요? 배정 이력은 남고 학생에게는 다시 미제출 과제로 보입니다.
          </p>
          {deleteError && <p className="mt-3 text-sm font-semibold text-danger">{deleteError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button type="button" variant="danger" disabled={isDeleting} onClick={confirmDelete}>
              {isDeleting ? "삭제 중..." : "삭제하기"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="py-2 font-bold">{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function CreateStudentModal({
  classes,
  onClose,
  onSubmit,
}: {
  classes: Class[];
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Modal title="학생 등록" onClose={onClose}>
      <form action={onSubmit} className="grid gap-4">
        {classes.length === 0 && (
          <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">
            아직 생성된 반이 없습니다. 학생은 미배정 상태로 등록할 수 있습니다.
            <div className="mt-3">
              <Button href="/teacher/classes" variant="secondary">반 관리로 이동</Button>
            </div>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">학생 이름<Input name="name" required /></label>
          <label className="grid gap-2 text-sm font-semibold">학생 아이디<Input name="studentId" required /></label>
          <label className="grid gap-2 text-sm font-semibold">초기 비밀번호<Input name="password" type="password" required /></label>
          <label className="grid gap-2 text-sm font-semibold">학교<Input name="schoolName" /></label>
          <label className="grid gap-2 text-sm font-semibold">학년<Select name="grade"><option value="">선택</option>{gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}</Select></label>
        </div>
        <div className="grid gap-2 text-sm font-semibold">
          배정할 반
          <CreateClassCheckboxGroup classes={classes} />
        </div>
        <label className="grid gap-2 text-sm font-semibold">학생 아이콘<Select name="avatarKey">{studentAvatars.map((avatar) => <option key={avatar}>{avatar}</option>)}</Select></label>
        <label className="grid gap-2 text-sm font-semibold">메모<Textarea name="memo" /></label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
          <Button type="submit">등록</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateClassCheckboxGroup({ classes }: { classes: Class[] }) {
  if (classes.length === 0) return <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">선택 가능한 반이 없습니다.</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {classes.map((classItem) => (
        <label key={classItem.id} className="flex items-start gap-3 rounded-md border border-line p-3 text-sm">
          <input type="checkbox" name="classIds" value={classItem.id} className="mt-1" />
          <span>
            <span className="block font-bold">{classItem.name}</span>
            <span className="block text-xs text-slate-500">학생 {classItem.studentCount}명</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function PasswordModal({ title, onClose, onSubmit }: { title: string; onClose: () => void; onSubmit: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");

  function submit() {
    if (!password) {
      setMessage("변경할 비밀번호를 입력해 주세요.");
      return;
    }
    if (password !== confirm) {
      setMessage("비밀번호와 확인 값이 일치해야 합니다.");
      return;
    }
    onSubmit(password);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">변경 비밀번호<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold">비밀번호 확인<Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
        {message && <p className="text-sm font-semibold text-danger">{message}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={submit}>변경</Button></div>
      </div>
    </Modal>
  );
}

function ConfirmModal({ title, message, onCancel, onConfirm }: { title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm leading-6 text-slate-700">{message}</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>취소</Button><Button variant="danger" onClick={onConfirm}>확인</Button></div>
    </Modal>
  );
}

function assignmentTypeLabel(type: string) {
  return formatAssignmentTypeLabel(type);
}

function submitStatusLabel(status: StudentLearningHistory["submitStatus"]) {
  return status === "submitted" ? "제출 완료" : status === "late" ? "지각 제출" : "미제출";
}

function reviewStatusLabel(status: StudentLearningHistory["reviewStatus"]) {
  return status === "pending" ? "검토 필요" : status === "reviewed" ? "검토 완료" : "-";
}
