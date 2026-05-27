"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { assignmentTypeLabel as formatAssignmentTypeLabel } from "@/lib/assignmentTypes";

import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatDue } from "@/lib/format";
import { cn } from "@/lib/utils";

type AssignmentClassSummary = {
  classId: string;
  className: string;
  subjectName?: string | null;
  dueAt: string | null;
  targetCount: number;
  submittedCount: number;
  studentNames: string[];
};

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  assignmentType: string;
  assignmentSubject: string;
  assignmentSubjects?: string[];
  status: "published" | "draft" | "closed" | "archived" | string;
  classNames: string[];
  classSummaries: AssignmentClassSummary[];
  targetCount: number;
  submittedCount: number;
  unsubmittedCount: number;
  dueAt: string | null;
  updatedAt: string;
};

type AssignmentClass = {
  id: string;
  name: string;
  status?: "active" | "archived";
  studentCount: number;
  students: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; description?: string | null }>;
};

type TargetSelection = {
  classId: string;
  classSubjectId: string;
  dueDate: string;
  dueTime: string;
  visibility: "published" | "draft";
  targetType: "all" | "partial";
  studentIds: string[];
  studentSearch: string;
};

function typeLabel(type: string) {
  return formatAssignmentTypeLabel(type);
}

function subjectLabel(subject: string) {
  return subject || "기타";
}

function sortRows(rows: AssignmentRow[], sort: string) {
  const nextRows = [...rows];
  if (sort === "oldest") {
    return nextRows.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }
  if (sort === "due") {
    return nextRows.sort((a, b) => {
      const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }
  return nextRows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AssignmentsPage() {
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [sort, setSort] = useState("latest");
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [classes, setClasses] = useState<AssignmentClass[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  async function loadAssignments() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/teacher/assignments", { cache: "no-store" });
      const data = await response.json();
      setRows(data.assignments ?? []);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAssignments();
    fetch("/api/teacher/classes", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: AssignmentClass[]) => setClasses(data.filter((item) => item.status !== "archived")))
      .catch(() => setClasses([]));
  }, []);

  const subjects = useMemo(() => {
    return Array.from(new Set(rows.flatMap((row) => row.assignmentSubjects ?? []).filter(Boolean))).sort();
  }, [rows]);

  const classFilterOptions = useMemo(() => {
    const classMap = new Map<string, string>();
    rows.forEach((row) => {
      row.classSummaries.forEach((summary) => classMap.set(summary.classId, summary.className));
    });
    classes.forEach((classItem) => classMap.set(classItem.id, classItem.name));
    return Array.from(classMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [classes, rows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const matchesQuery = !keyword || row.title.toLowerCase().includes(keyword) || row.description.toLowerCase().includes(keyword);
      const matchesSubject = subjectFilter === "all" || (row.assignmentSubjects ?? []).includes(subjectFilter);
      const matchesClass = classFilter === "all" || row.classSummaries.some((summary) => summary.classId === classFilter);
      return matchesQuery && matchesSubject && matchesClass;
    });
    return sortRows(filtered, sort);
  }, [classFilter, query, rows, sort, subjectFilter]);

  const selectedAssignments = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);

  function toggleAssignment(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function openAssignModal() {
    if (selectedIds.length === 0) {
      setMessage("배정할 숙제를 먼저 선택해주세요.");
      return;
    }
    setMessage("");
    setIsModalOpen(true);
  }

  async function deleteUnassignedAssignment(row: AssignmentRow) {
    if (row.targetCount > 0) {
      setMessage("이미 반이나 학생에게 배정된 과제는 삭제할 수 없습니다.");
      return;
    }
    if (!window.confirm(`"${row.title}" 과제를 삭제할까요?`)) return;

    setDeletingId(row.id);
    const response = await fetch(`/api/teacher/assignments?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setDeletingId("");

    if (!response.ok) {
      setMessage(data.error ?? "과제를 삭제하지 못했습니다.");
      return;
    }

    setSelectedIds((current) => current.filter((id) => id !== row.id));
    setMessage("과제를 삭제했습니다.");
    await loadAssignments();
  }

  return (
    <TeacherLayout title="숙제 목록">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">강사용 목업</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-normal text-ink">숙제 목록</h1>
          <h2 className="mt-7 text-lg font-bold text-ink">숙제별 보기</h2>
          <p className="mt-1 text-sm text-slate-500">숙제 템플릿 기준으로 과목과 반별 배정 현황을 확인합니다.</p>
        </div>
        <div className="grid gap-2 sm:flex lg:self-center">
          <Button type="button" variant="secondary" onClick={openAssignModal}>선택한 숙제 일괄 배정</Button>
          <Button href="/teacher/assignments/new">숙제 만들기</Button>
        </div>
      </div>

      {message && <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">{message}</p>}

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-semibold">
            숙제 검색
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="숙제명 검색" />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            과목 필터
            <Select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="all">전체 과목</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>{subjectLabel(subject)}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            반 필터
            <Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="all">전체 반</option>
              {classFilterOptions.map(([classId, className]) => (
                <option key={classId} value={classId}>{className}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            정렬
            <Select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="due">마감 빠른순</option>
            </Select>
          </label>
        </div>
      </Card>

      <div className="grid gap-4">
        {filteredRows.map((row) => {
          const selected = selectedIds.includes(row.id);
          return (
            <Card key={row.id} className={cn("p-0 transition", selected && "border-action bg-blue-50/40 ring-1 ring-action")}>
              <div className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <label className="mt-1 flex size-6 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={selected}
                        onChange={() => toggleAssignment(row.id)}
                        aria-label={`${row.title} 선택`}
                      />
                    </label>
                    <div className="min-w-0">
                      <h2 className="text-lg font-extrabold text-ink">{row.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{row.description || "설명이 없습니다."}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={row.targetCount > 0 ? "green" : "gray"}>{row.targetCount > 0 ? "배정됨" : "미배정"}</Badge>
                        <Badge>{typeLabel(row.assignmentType)}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button href={`/teacher/assignments/${row.id}/preview`} variant="secondary">
                      미리보기
                    </Button>
                    <Button href={`/teacher/assignments/${row.id}/targets`} variant="secondary">
                      배정 관리
                    </Button>
                    <Button href={`/teacher/assignments/new?assignmentId=${row.id}`} variant="secondary">
                      숙제 수정하기
                    </Button>
                    {row.targetCount === 0 && (
                      <Button type="button" variant="danger" onClick={() => deleteUnassignedAssignment(row)} disabled={deletingId === row.id}>
                        {deletingId === row.id ? "삭제 중..." : "삭제"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-md border border-line bg-slate-50 p-4 text-sm">
                  <p className="font-bold text-ink">배정 요약</p>
                  {row.classSummaries.length > 0 ? (
                    <div className="mt-3 grid gap-3">
                      {row.classSummaries.map((summary) => (
                        <div key={`${row.id}-${summary.classId}`} className="rounded-md border border-line bg-white p-3">
                          <p className="font-bold text-ink">{summary.className}</p>
                          {summary.subjectName && <Badge tone="blue">{summary.subjectName}</Badge>}
                          <p className="mt-2 leading-6 text-slate-700">
                            {summary.studentNames.length > 0 ? summary.studentNames.join(", ") : "배정된 학생이 없습니다."}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-500">아직 배정된 반과 학생이 없습니다.</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {!isLoading && filteredRows.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">표시할 숙제가 없습니다.</p>
          </Card>
        )}
        {isLoading && (
          <Card>
            <p className="text-sm text-slate-500">숙제 목록을 불러오는 중입니다.</p>
          </Card>
        )}
      </div>

      {isModalOpen && (
        <AssignmentTargetModal
          assignments={selectedAssignments}
          classes={classes}
          onClose={() => setIsModalOpen(false)}
          onAssigned={(assignedCount) => {
            setIsModalOpen(false);
            setSelectedIds([]);
            setMessage(`숙제가 배정되었습니다. 대상 ${assignedCount}건`);
            loadAssignments();
          }}
        />
      )}
    </TeacherLayout>
  );
}

function AssignmentTargetModal({
  assignments,
  classes,
  onClose,
  onAssigned,
}: {
  assignments: AssignmentRow[];
  classes: AssignmentClass[];
  onClose: () => void;
  onAssigned: (assignedCount: number) => void;
}) {
  const [modalClasses, setModalClasses] = useState(classes);
  const [targetMap, setTargetMap] = useState<Record<string, TargetSelection>>({});
  const [subjectDrafts, setSubjectDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const targets = Object.values(targetMap);

  function toggleClass(classItem: AssignmentClass) {
    setTargetMap((current) => {
      if (current[classItem.id]) {
        const next = { ...current };
        delete next[classItem.id];
        return next;
      }
      return {
        ...current,
        [classItem.id]: {
          classId: classItem.id,
          classSubjectId: classItem.subjects[0]?.id ?? "",
          dueDate: todayDate(),
          dueTime: "23:59",
          visibility: "published",
          targetType: "all",
          studentIds: [],
          studentSearch: "",
        },
      };
    });
  }

  function updateTarget(classId: string, input: Partial<TargetSelection>) {
    setTargetMap((current) => {
      const existing = current[classId];
      if (!existing) return current;
      return { ...current, [classId]: { ...existing, ...input } };
    });
  }

  function toggleStudent(classId: string, studentId: string) {
    const target = targetMap[classId];
    if (!target) return;
    updateTarget(classId, {
      studentIds: target.studentIds.includes(studentId)
        ? target.studentIds.filter((id) => id !== studentId)
        : [...target.studentIds, studentId],
    });
  }

  async function createSubject(classId: string) {
    const name = subjectDrafts[classId]?.trim();
    if (!name) {
      setError("추가할 과목명을 입력해주세요.");
      return;
    }
    const response = await fetch(`/api/teacher/classes/${classId}/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.subject) {
      setError(data.error ?? "과목을 추가하지 못했습니다.");
      return;
    }
    setModalClasses((current) => current.map((classItem) => (
      classItem.id === classId
        ? { ...classItem, subjects: [...classItem.subjects, data.subject] }
        : classItem
    )));
    setSubjectDrafts((current) => ({ ...current, [classId]: "" }));
    updateTarget(classId, { classSubjectId: data.subject.id });
    setError("");
  }

  function validate() {
    if (assignments.length === 0) return "배정할 숙제를 먼저 선택해주세요.";
    if (targets.length === 0) return "배정할 반을 1개 이상 선택해주세요.";
    for (const target of targets) {
      if (!target.dueDate || !target.dueTime) return "선택한 반마다 마감일과 마감 시간을 입력해주세요.";
      if (!target.classSubjectId) return "배정할 반 과목을 선택해주세요.";
      if (target.targetType === "partial" && target.studentIds.length === 0) return "일부 학생만 배정할 때는 학생을 1명 이상 선택해주세요.";
    }
    return "";
  }

  function assignHomework() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/teacher/assignments/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: assignments.map((assignment) => assignment.id),
          targets: targets.map((target) => ({
            classId: target.classId,
            classSubjectId: target.classSubjectId,
            dueDate: target.dueDate,
            dueTime: target.dueTime,
            visibility: target.visibility,
            targetType: target.targetType,
            studentIds: target.studentIds,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "숙제 배정 중 오류가 발생했습니다.");
        return;
      }
      onAssigned(data.assignedCount ?? 0);
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">선택한 숙제 일괄 배정</h2>
            <p className="mt-1 text-sm text-slate-500">
              선택한 숙제를 반 또는 학생에게 일괄 배정합니다. 이미 배정된 학생은 중복 배정되지 않습니다.
              기존 배정 상태를 수정하려면 각 숙제의 [배정 관리]를 사용하세요.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>닫기</Button>
        </div>

        <section className="mt-4 rounded-md border border-line bg-slate-50 p-4">
          <h3 className="font-bold">선택된 숙제</h3>
          <ul className="mt-3 grid gap-2 text-sm">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="rounded-md border border-line bg-white px-3 py-2 font-semibold">{assignment.title}</li>
            ))}
          </ul>
        </section>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

        <section className="mt-4 grid gap-3">
          <h3 className="font-bold">대상 반 선택</h3>
          {modalClasses.map((classItem) => {
            const selected = targetMap[classItem.id];
            const filteredStudents = classItem.students.filter((student) => student.name.includes(selected?.studentSearch ?? ""));
            return (
              <div key={classItem.id} className={cn("rounded-md border border-line bg-white p-4", selected && "border-action bg-blue-50/30")}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 size-4" checked={Boolean(selected)} onChange={() => toggleClass(classItem)} />
                    <span>
                      <span className="block font-bold">{classItem.name}</span>
                      <span className="text-sm text-slate-500">학생 {classItem.studentCount}명</span>
                    </span>
                  </label>
                  {selected && (
                    <div className="grid gap-3 sm:grid-cols-4">
                      <label className="grid gap-2 text-sm font-semibold">
                        과목
                        <Select value={selected.classSubjectId} onChange={(event) => updateTarget(classItem.id, { classSubjectId: event.target.value })}>
                          <option value="">과목 선택</option>
                          {classItem.subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                          ))}
                        </Select>
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">마감일<Input type="date" value={selected.dueDate} onChange={(event) => updateTarget(classItem.id, { dueDate: event.target.value })} /></label>
                      <label className="grid gap-2 text-sm font-semibold">마감 시간<Input type="time" value={selected.dueTime} onChange={(event) => updateTarget(classItem.id, { dueTime: event.target.value })} /></label>
                      <label className="grid gap-2 text-sm font-semibold">공개 여부<Select value={selected.visibility} onChange={(event) => updateTarget(classItem.id, { visibility: event.target.value as TargetSelection["visibility"] })}><option value="published">게시됨</option><option value="draft">비공개</option></Select></label>
                    </div>
                  )}
                </div>

                {selected && (
                  <div className="mt-4 grid gap-3 border-t border-line pt-4">
                    <div className="grid gap-2 rounded-md border border-line bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <label className="grid gap-2 text-sm font-semibold">
                        과목 바로 추가
                        <Input
                          value={subjectDrafts[classItem.id] ?? ""}
                          onChange={(event) => setSubjectDrafts((current) => ({ ...current, [classItem.id]: event.target.value }))}
                          placeholder="예: Reading A"
                        />
                      </label>
                      <Button type="button" variant="secondary" onClick={() => createSubject(classItem.id)}>추가 후 선택</Button>
                    </div>
                    <fieldset className="grid gap-2">
                      <legend className="text-sm font-semibold">대상 학생</legend>
                      <div className="flex flex-wrap gap-4 text-sm font-semibold">
                        <label className="flex items-center gap-2"><input type="radio" checked={selected.targetType === "all"} onChange={() => updateTarget(classItem.id, { targetType: "all", studentIds: [] })} />반 전체</label>
                        <label className="flex items-center gap-2"><input type="radio" checked={selected.targetType === "partial"} onChange={() => updateTarget(classItem.id, { targetType: "partial" })} />일부 학생만</label>
                      </div>
                    </fieldset>

                    {selected.targetType === "partial" && (
                      <div className="grid gap-3 rounded-md bg-slate-50 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <label className="grid flex-1 gap-2 text-sm font-semibold">
                            학생 검색
                            <Input value={selected.studentSearch} onChange={(event) => updateTarget(classItem.id, { studentSearch: event.target.value })} placeholder="학생 이름 검색" />
                          </label>
                          <p className="text-sm font-semibold text-slate-600">선택 {selected.studentIds.length}명</p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {filteredStudents.map((student) => (
                            <label key={student.id} className="flex items-center gap-2 rounded-md border border-line bg-white p-2 text-sm font-semibold">
                              <input type="checkbox" checked={selected.studentIds.includes(student.id)} onChange={() => toggleStudent(classItem.id, student.id)} />
                              {student.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
          <Button type="button" onClick={assignHomework} disabled={isPending}>{isPending ? "배정 중..." : "배정하기"}</Button>
        </div>
      </div>
    </div>
  );
}
