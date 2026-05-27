"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useParams } from "next/navigation";

import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatDue } from "@/lib/format";
import { cn } from "@/lib/utils";

type AssignmentClass = {
  id: string;
  name: string;
  status?: "active" | "archived";
  studentCount: number;
  students: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string; description?: string | null }>;
};

type TargetStudent = {
  studentId: string;
  studentName: string;
  targetId: string;
  dueAt: string | null;
  detailHref: string | null;
  submissionStatus: "submitted" | "not_submitted";
  submittedAt: string | null;
};

type TargetGroup = {
  classId: string;
  className: string;
  assignedCount: number;
  submittedCount: number;
  notSubmittedCount: number;
  students: TargetStudent[];
};

type TargetData = {
  assignment: {
    id: string;
    title: string;
    subject: string;
    type: string;
    typeLabel: string;
    status: string;
    defaultDueAt: string | null;
  };
  summary: {
    classCount: number;
    assignedStudentCount: number;
    submittedCount: number;
    notSubmittedCount: number;
  };
  groups: TargetGroup[];
};

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function dateTimeLocalToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function statusLabel(status: string) {
  if (status === "published") return "게시됨";
  if (status === "draft") return "비공개";
  if (status === "closed") return "마감";
  if (status === "archived") return "보관됨";
  return status;
}

export default function AssignmentTargetsPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;

  const [data, setData] = useState<TargetData | null>(null);
  const [classes, setClasses] = useState<AssignmentClass[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addClassId, setAddClassId] = useState("");
  const [addClassSubjectId, setAddClassSubjectId] = useState("");
  const [addStudentIds, setAddStudentIds] = useState<string[]>([]);
  const [addDueAt, setAddDueAt] = useState("");
  const [bulkDueAt, setBulkDueAt] = useState("");
  const [isDueModalOpen, setIsDueModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadTargets() {
    setError("");
    try {
      const response = await fetch(`/api/teacher/assignments/${assignmentId}/targets`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "배정 현황을 불러오지 못했습니다.");
      setData(json);
      setExpanded((current) => current.length > 0 ? current : json.groups.slice(0, 1).map((group: TargetGroup) => group.classId));
      setSelectedTargetIds([]);
      setAddStudentIds([]);
      setAddDueAt(toDateTimeLocal(json.assignment.defaultDueAt));
      setBulkDueAt(toDateTimeLocal(json.assignment.defaultDueAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "배정 현황을 불러오지 못했습니다.");
    }
  }

  async function loadClasses() {
    try {
      const response = await fetch("/api/teacher/classes", { cache: "no-store" });
      const json: AssignmentClass[] = await response.json();
      const activeClasses = json.filter((item) => item.status !== "archived");
      setClasses(activeClasses);
      setAddClassId((current) => current || activeClasses[0]?.id || "");
      setAddClassSubjectId((current) => current || activeClasses[0]?.subjects[0]?.id || "");
    } catch {
      setClasses([]);
    }
  }

  useEffect(() => {
    loadTargets();
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const activeTargetStudentIds = useMemo(() => {
    const ids = new Set<string>();
    data?.groups.forEach((group) => group.students.forEach((student) => ids.add(student.studentId)));
    return ids;
  }, [data]);

  const filteredGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (data?.groups ?? [])
      .filter((group) => classFilter === "all" || group.classId === classFilter)
      .map((group) => {
        const students = group.students.filter((student) => {
          const matchesQuery = !keyword || student.studentName.toLowerCase().includes(keyword);
          const matchesStatus = statusFilter === "all" || student.submissionStatus === statusFilter;
          return matchesQuery && matchesStatus;
        });
        return {
          ...group,
          students,
          assignedCount: students.length,
          submittedCount: students.filter((student) => student.submissionStatus === "submitted").length,
          notSubmittedCount: students.filter((student) => student.submissionStatus !== "submitted").length,
        };
      })
      .filter((group) => group.students.length > 0 || (!keyword && statusFilter === "all"));
  }, [classFilter, data, query, statusFilter]);

  const selectedTargets = useMemo(() => {
    const targets = data?.groups.flatMap((group) => group.students) ?? [];
    return targets.filter((target) => selectedTargetIds.includes(target.targetId));
  }, [data, selectedTargetIds]);
  const selectedSubmittedCount = selectedTargets.filter((target) => target.submissionStatus === "submitted").length;
  const addClass = classes.find((item) => item.id === addClassId);
  const addClassSubjects = addClass?.subjects ?? [];
  const addableStudents = (addClass?.students ?? []).filter((student) => !activeTargetStudentIds.has(student.id));

  function selectAddClass(classId: string) {
    const nextClass = classes.find((item) => item.id === classId);
    setAddClassId(classId);
    setAddClassSubjectId(nextClass?.subjects[0]?.id ?? "");
    setAddStudentIds([]);
  }

  function toggleGroup(classId: string) {
    setExpanded((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]);
  }

  function toggleTarget(targetId: string) {
    setSelectedTargetIds((current) => current.includes(targetId) ? current.filter((id) => id !== targetId) : [...current, targetId]);
  }

  function toggleGroupTargets(students: TargetStudent[]) {
    const targetIds = students.map((student) => student.targetId);
    setSelectedTargetIds((current) => {
      const allSelected = targetIds.length > 0 && targetIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !targetIds.includes(id));
      return Array.from(new Set([...current, ...targetIds]));
    });
  }

  function toggleAddStudent(studentId: string) {
    setAddStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  }

  function addTargets() {
    const dueAt = dateTimeLocalToIso(addDueAt);
    if (!addClassId || !addClassSubjectId || addStudentIds.length === 0) {
      setError("추가 배정할 반, 반 과목, 학생을 선택해주세요.");
      return;
    }
    startTransition(async () => {
      const response = await fetch(`/api/teacher/assignments/${assignmentId}/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: addClassId, classSubjectId: addClassSubjectId, studentIds: addStudentIds, dueAt }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error ?? "학생 추가 배정 중 오류가 발생했습니다.");
        return;
      }
      setMessage(`학생 ${json.assignedCount ?? addStudentIds.length}명에게 숙제를 배정했습니다.`);
      setIsAddOpen(false);
      await loadTargets();
    });
  }

  function updateDueDate() {
    const dueAt = dateTimeLocalToIso(bulkDueAt);
    if (selectedTargetIds.length === 0 || !dueAt) {
      setError("마감일을 변경할 학생과 새 마감일을 선택해주세요.");
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/teacher/assignment-targets/due-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetIds: selectedTargetIds, dueAt }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error ?? "마감일 변경 중 오류가 발생했습니다.");
        return;
      }
      setMessage(`선택 학생 ${json.updatedCount ?? 0}명의 마감일을 변경했습니다.`);
      setIsDueModalOpen(false);
      await loadTargets();
    });
  }

  function cancelTargets() {
    if (selectedTargetIds.length === 0) return;
    startTransition(async () => {
      const response = await fetch("/api/teacher/assignment-targets/cancel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetIds: selectedTargetIds }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json.error ?? "배정 취소 중 오류가 발생했습니다.");
        return;
      }
      const skipped = json.skippedSubmittedCount ? ` 제출 완료 ${json.skippedSubmittedCount}명은 취소하지 않았습니다.` : "";
      setMessage(`배정 ${json.cancelledCount ?? 0}건을 취소했습니다.${skipped}`);
      setIsCancelModalOpen(false);
      await loadTargets();
    });
  }

  return (
    <TeacherLayout title="숙제 배정 관리">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-700">강사 모드</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-normal text-ink">숙제 배정 관리</h1>
          <p className="mt-2 text-sm text-slate-500">현재 배정 현황을 확인하고, 학생 추가/마감일 변경/미제출 학생 배정 취소를 처리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={`/teacher/assignments/new?assignmentId=${assignmentId}`} variant="secondary">과제 수정</Button>
          <Button href="/teacher/assignments" variant="secondary">← 숙제 목록으로 돌아가기</Button>
        </div>
      </div>

      {message && <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">{message}</p>}
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

      <Card className="mb-4">
        <h2 className="text-xl font-bold">{data?.assignment.title ?? "숙제를 불러오는 중입니다."}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryChip label="과목 / 유형" value={data ? `${data.assignment.subject} · ${data.assignment.typeLabel}` : "-"} />
          <SummaryChip label="배정 대상" value={data ? `${data.summary.classCount}개 반 · ${data.summary.assignedStudentCount}명` : "-"} />
          <SummaryChip label="제출 현황" value={data ? `제출 ${data.summary.submittedCount}/${data.summary.assignedStudentCount}명` : "-"} />
          <SummaryChip label="미제출" value={data ? `${data.summary.notSubmittedCount}명` : "-"} />
          <SummaryChip label="기본 마감" value={data?.assignment.defaultDueAt ? formatDue(data.assignment.defaultDueAt) : "-"} />
          <SummaryChip label="공개 상태" value={data ? statusLabel(data.assignment.status) : "-"} />
        </div>
      </Card>

      <Card className="mb-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold">학생명 검색<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="학생명 검색" /></label>
          <label className="grid gap-2 text-sm font-semibold">제출 상태<Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">전체</option><option value="submitted">제출 완료</option><option value="not_submitted">미제출</option></Select></label>
          <label className="grid gap-2 text-sm font-semibold">반<Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="all">전체 반</option>{data?.groups.map((group) => <option key={group.classId} value={group.classId}>{group.className}</option>)}</Select></label>
          <Button type="button" onClick={() => setIsAddOpen(true)}>+ 학생 추가 배정</Button>
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setExpanded((data?.groups ?? []).map((group) => group.classId))}>전체 펼치기</Button>
        <Button type="button" variant="secondary" onClick={() => setExpanded([])}>전체 접기</Button>
      </div>

      <section className="grid gap-3 pb-24">
        {filteredGroups.map((group) => {
          const isOpen = expanded.includes(group.classId);
          const groupTargetIds = group.students.map((student) => student.targetId);
          const allGroupSelected = groupTargetIds.length > 0 && groupTargetIds.every((id) => selectedTargetIds.includes(id));
          const someGroupSelected = groupTargetIds.some((id) => selectedTargetIds.includes(id));
          return (
            <Card key={group.classId} className="p-0">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <label className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-600" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={allGroupSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = !allGroupSelected && someGroupSelected;
                      }}
                      onChange={() => toggleGroupTargets(group.students)}
                    />
                    전체 선택
                  </label>
                  <button type="button" className="text-left" onClick={() => toggleGroup(group.classId)}>
                    <span className="font-bold">{isOpen ? "▼" : "▶"} {group.className}</span>
                  </button>
                </div>
                <span className="text-sm text-slate-600">배정 {group.assignedCount}명 · 제출 {group.submittedCount}명 · 미제출 {group.notSubmittedCount}명</span>
              </div>
              {isOpen && <StudentTable students={group.students} selectedTargetIds={selectedTargetIds} onToggle={toggleTarget} />}
            </Card>
          );
        })}
        {!filteredGroups.length && <Card><p className="text-sm text-slate-500">조건에 맞는 배정 학생이 없습니다.</p></Card>}
      </section>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 p-4">
          <div className="h-full w-full max-w-md overflow-auto rounded-lg bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-bold">학생 추가 배정</h2><p className="mt-1 text-sm text-slate-500">아직 이 숙제를 받지 않은 학생만 표시됩니다.</p></div>
              <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>닫기</Button>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm font-semibold">반 선택<Select value={addClassId} onChange={(event) => selectAddClass(event.target.value)}>{classes.map((classItem) => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}</Select></label>
              <label className="grid gap-2 text-sm font-semibold">
                반 과목 선택
                <Select value={addClassSubjectId} onChange={(event) => setAddClassSubjectId(event.target.value)} disabled={addClassSubjects.length === 0}>
                  {addClassSubjects.length ? addClassSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>) : <option value="">과목 없음</option>}
                </Select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">마감일<Input type="datetime-local" value={addDueAt} onChange={(event) => setAddDueAt(event.target.value)} /></label>
              <div className="max-h-[45vh] overflow-auto rounded-md border border-line p-2">
                {addableStudents.length ? addableStudents.map((student) => (
                  <label key={student.id} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold hover:bg-slate-50">
                    <input type="checkbox" checked={addStudentIds.includes(student.id)} onChange={() => toggleAddStudent(student.id)} />
                    {student.name}
                  </label>
                )) : <p className="p-2 text-sm text-slate-500">추가 배정할 학생이 없습니다.</p>}
              </div>
              <Button type="button" onClick={addTargets} disabled={isPending || !addClassSubjectId || addStudentIds.length === 0}>{isPending ? "배정 중..." : "학생 추가 배정"}</Button>
            </div>
          </div>
        </div>
      )}

      {selectedTargetIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-bold">선택된 학생 {selectedTargetIds.length}명 {selectedSubmittedCount > 0 && <span className="text-sm font-semibold text-slate-500">· 제출 완료 포함 {selectedSubmittedCount}명</span>}</p>
            <div className="grid gap-2 sm:flex">
              <Button type="button" variant="secondary" onClick={() => setIsDueModalOpen(true)}>마감일 변경</Button>
              <Button type="button" variant="danger" onClick={() => setIsCancelModalOpen(true)}>배정 취소</Button>
            </div>
          </div>
        </div>
      )}

      {isDueModalOpen && (
        <ConfirmBox title={`선택한 ${selectedTargetIds.length}명의 마감일을 변경합니다.`} onClose={() => setIsDueModalOpen(false)}>
          <label className="grid gap-2 text-sm font-semibold">새 마감일<Input type="datetime-local" value={bulkDueAt} onChange={(event) => setBulkDueAt(event.target.value)} /></label>
          <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button type="button" variant="secondary" onClick={() => setIsDueModalOpen(false)}>취소</Button><Button type="button" onClick={updateDueDate} disabled={isPending}>{isPending ? "변경 중..." : "변경"}</Button></div>
        </ConfirmBox>
      )}

      {isCancelModalOpen && (
        <ConfirmBox title="선택한 학생의 숙제 배정을 취소하시겠습니까?" onClose={() => setIsCancelModalOpen(false)}>
          <p className="leading-7 text-slate-600">미제출 학생만 취소됩니다. 제출 완료 학생은 제출 기록 보존을 위해 취소되지 않습니다.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button type="button" variant="secondary" onClick={() => setIsCancelModalOpen(false)}>닫기</Button><Button type="button" variant="danger" onClick={cancelTargets} disabled={isPending}>{isPending ? "취소 중..." : "배정 취소"}</Button></div>
        </ConfirmBox>
      )}
    </TeacherLayout>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-line bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-bold text-ink">{value}</p></div>;
}

function StudentTable({ students, selectedTargetIds, onToggle }: { students: TargetStudent[]; selectedTargetIds: string[]; onToggle: (targetId: string) => void }) {
  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr><th className="w-10 px-3 py-2"></th><th className="px-3 py-2">학생명</th><th className="px-3 py-2">제출 상태</th><th className="px-3 py-2">제출 일시</th><th className="px-3 py-2">개별 마감일</th><th className="px-3 py-2">피드백</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {students.map((student) => (
            <tr key={student.targetId}>
              <td className="px-3 py-2"><input type="checkbox" checked={selectedTargetIds.includes(student.targetId)} onChange={() => onToggle(student.targetId)} /></td>
              <td className="px-3 py-2 font-semibold">{student.studentName}</td>
              <td className="px-3 py-2"><Badge tone={student.submissionStatus === "submitted" ? "green" : "gray"}>{student.submissionStatus === "submitted" ? "제출 완료" : "미제출"}</Badge></td>
              <td className="px-3 py-2">{student.submittedAt ? formatDue(student.submittedAt) : "-"}</td>
              <td className="px-3 py-2">{student.dueAt ? formatDue(student.dueAt) : "-"}</td>
              <td className="px-3 py-2">
                {student.detailHref ? (
                  <Button href={student.detailHref} variant="secondary">피드백</Button>
                ) : (
                  <Button disabled variant="secondary">피드백</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmBox({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2><button type="button" className="text-sm font-semibold text-slate-500" onClick={onClose}>닫기</button></div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
