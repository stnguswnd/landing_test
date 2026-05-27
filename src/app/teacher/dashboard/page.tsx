"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { CalendarItem } from "@/lib/calendarTypes";
import { cn } from "@/lib/utils";

type DashboardData = {
  weekStart: string;
  weekEnd: string;
  todayClasses: ScheduleItem[];
  weeklySchedule: ScheduleItem[];
  assignmentSummary: { totalAssigned: number; submitted: number; missing: number; needsReview: number };
  classCards: Array<{
    classId: string;
    className: string;
    studentCount: number;
    assignedCount: number;
    submittedCount: number;
    missingCount: number;
    needsReviewCount: number;
  }>;
};

type ScheduleItem = Omit<CalendarItem, "classId" | "className"> & {
  classId: string;
  className: string;
  bookTitle?: string | null;
  progressTitle?: string | null;
  progressMemo?: string | null;
  nextPrep?: string | null;
  homeworkCount?: number;
};

type Notice = {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  publishedAt: string | null;
};

function addDays(date: string, days: number) {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function mondayOfThisWeek() {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + offset);
  return now.toISOString().slice(0, 10);
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${date}T00:00:00`));
}

function scheduleItemLabel(item: ScheduleItem) {
  if (item.type === "class") return "수업";
  if (item.type === "makeup_class") return "보강";
  if (item.type === "cancelled_class") return "휴강";
  if (item.type === "assignment_due") return "숙제 마감";
  if (item.type === "test") return "시험";
  if (item.type === "notice") return "공지";
  return "기타";
}

function scheduleItemTone(item: ScheduleItem): "blue" | "green" | "yellow" | "red" | "purple" | "gray" {
  if (item.type === "class") return "blue";
  if (item.type === "makeup_class") return "green";
  if (item.type === "cancelled_class") return "gray";
  if (item.type === "assignment_due") return "yellow";
  if (item.type === "test") return "red";
  if (item.type === "notice") return "purple";
  return "gray";
}

function scheduleItemBorder(item: ScheduleItem) {
  if (item.type === "class") return "border-blue-100 bg-blue-50/40";
  if (item.type === "makeup_class") return "border-green-100 bg-green-50/40";
  if (item.type === "cancelled_class") return "border-red-100 bg-red-50/20";
  if (item.type === "assignment_due") return "border-amber-200 bg-amber-50/60";
  if (item.type === "test") return "border-red-200 bg-red-50/30";
  if (item.type === "notice") return "border-purple-100 bg-purple-50/30";
  return "border-line bg-white";
}

function scheduleTimeLabel(item: ScheduleItem) {
  const startTime = formatClockTime(item.startTime);
  const endTime = formatClockTime(item.endTime);
  if (item.type === "assignment_due" && (startTime || endTime)) return `마감 ${startTime || endTime}`;
  if (item.type === "assignment_due") return "마감일";
  if (startTime || endTime) return `${startTime}${startTime && endTime ? " - " : ""}${endTime}`;
  return "시간 미정";
}

function formatClockTime(value?: string | null) {
  if (!value) return "";
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
}

function calendarEventTypeForItem(item: ScheduleItem) {
  if (item.type === "makeup_class") return "makeup";
  if (item.type === "cancelled_class") return "cancelled";
  if (item.type === "notice") return "notice";
  if (item.type === "class") return "class";
  return "etc";
}

export default function TeacherDashboardPage() {
  const [weekStart, setWeekStart] = useState(mondayOfThisWeek);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [editingCalendarItem, setEditingCalendarItem] = useState<ScheduleItem | null>(null);
  const [editingTestItem, setEditingTestItem] = useState<ScheduleItem | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/teacher/dashboard?weekStart=${weekStart}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "대시보드를 불러오지 못했습니다.");
    setData(body as DashboardData);
  }, [weekStart]);

  useEffect(() => {
    loadDashboard().catch((err: Error) => setError(err.message));
  }, [loadDashboard]);

  async function refresh(msg: string) {
    setMessage(msg);
    await loadDashboard();
  }

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const filteredWeeklySchedule = useMemo(
    () => (data?.weeklySchedule ?? []).filter((item) => selectedClassId === "all" || item.classId === selectedClassId),
    [data?.weeklySchedule, selectedClassId]
  );
  const filteredTodayClasses = useMemo(
    () => (data?.todayClasses ?? []).filter((item) => selectedClassId === "all" || item.classId === selectedClassId),
    [data?.todayClasses, selectedClassId]
  );

  return (
    <TeacherLayout title="대시보드">
      {message && <p className="mt-4 rounded-md bg-blue-50 px-4 py-3 text-sm font-semibold text-action">{message}</p>}
      {error && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold">이번 주 일정</h2>
            <p className="mt-1 text-sm text-slate-500">
              {data?.weekStart ?? weekStart} - {data?.weekEnd ?? addDays(weekStart, 6)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} className="w-40">
              <option value="all">전체 반</option>
              {(data?.classCards ?? []).map((classItem) => (
                <option key={classItem.classId} value={classItem.classId}>
                  {classItem.className}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ 이전 주</Button>
            <Button
              variant="secondary"
              onClick={() => setWeekStart(mondayOfThisWeek())}
              className={weekStart === mondayOfThisWeek() ? "border-action bg-blue-50 text-action" : undefined}
            >
              이번 주
            </Button>
            <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>다음 주 ›</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-7">
          {weekDays.map((day) => {
            const dayItems = filteredWeeklySchedule.filter((item) => item.date === day);
            return (
              <div key={day} className="min-w-0 rounded-md border border-line bg-white p-3">
                <p className="font-bold">{dateLabel(day)}</p>
                <div className="mt-3 grid max-h-[460px] gap-2 overflow-y-auto pr-1">
                  {dayItems.map((item) => (
                    <ScheduleCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
                  ))}
                  {dayItems.length === 0 && <p className="py-1 text-center text-xs text-slate-400">일정 없음</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-5">
        <GlobalNoticeSection />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="text-lg font-bold">오늘 일정</h2>
          <div className="mt-3 grid gap-2">
            {filteredTodayClasses.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">오늘 일정이 없습니다.</p>
            ) : (
              filteredTodayClasses.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-line bg-white p-3 text-left text-sm font-semibold transition hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={scheduleItemTone(item)}>{scheduleItemLabel(item)}</Badge>
                      <span className="truncate text-xs font-semibold text-slate-500">{item.className}</span>
                    </span>
                    <span className="block truncate font-bold">{item.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{scheduleTimeLabel(item)}</span>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">반별 진행 상황</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data?.classCards ?? []).map((classItem) => (
              <div key={classItem.classId} className="rounded-md border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{classItem.className}</h3>
                    <p className="mt-1 text-sm text-slate-500">학생 {classItem.studentCount}명</p>
                  </div>
                  <Button href={`/teacher/classes/${classItem.classId}`} variant="secondary">상세</Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <ProgressBadge label="진행 중" value={classItem.assignedCount} />
                  <ProgressBadge label="제출" value={classItem.submittedCount} />
                  <ProgressBadge label="미제출" value={classItem.missingCount} tone="red" />
                  <ProgressBadge label="검토" value={classItem.needsReviewCount} tone="yellow" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {selectedItem && (
        <ScheduleDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEditCalendar={() => {
            setEditingCalendarItem(selectedItem);
            setSelectedItem(null);
          }}
          onEditTest={() => {
            setEditingTestItem(selectedItem);
            setSelectedItem(null);
          }}
          onDeleted={async (msg) => {
            setSelectedItem(null);
            await refresh(msg);
          }}
        />
      )}
      {editingCalendarItem && (
        <CalendarEventEditModal
          item={editingCalendarItem}
          onClose={() => setEditingCalendarItem(null)}
          onSaved={async () => {
            setEditingCalendarItem(null);
            await refresh("일정을 수정했습니다.");
          }}
        />
      )}
      {editingTestItem && (
        <TestEditModal
          item={editingTestItem}
          onClose={() => setEditingTestItem(null)}
          onSaved={async () => {
            setEditingTestItem(null);
            await refresh("시험을 수정했습니다.");
          }}
        />
      )}
    </TeacherLayout>
  );
}

function ScheduleCard({ item, onClick }: { item: ScheduleItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("w-full min-w-0 rounded-md border p-2 text-left transition hover:shadow-sm", scheduleItemBorder(item))}
    >
      <span className="block min-w-0">
        <span className="mb-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={scheduleItemTone(item)}>{scheduleItemLabel(item)}</Badge>
          <Badge>{item.className}</Badge>
        </span>
        <span className="line-clamp-2 block break-words text-sm font-bold leading-5 text-slate-950">{item.title}</span>
        <span className="block text-xs text-slate-500">{scheduleTimeLabel(item)}</span>
        {item.subject && <span className="block truncate text-xs font-semibold text-slate-500">{item.subject}</span>}
      </span>
    </button>
  );
}

function ScheduleDetailModal({
  item,
  onClose,
  onEditCalendar,
  onEditTest,
  onDeleted,
}: {
  item: ScheduleItem;
  onClose: () => void;
  onEditCalendar: () => void;
  onEditTest: () => void;
  onDeleted: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const isCalendarEvent = item.source === "class_calendar_event";
  const isTest = item.source === "test";
  const isAssignment = item.source === "assignment_due";

  async function remove() {
    setError("");
    if (isCalendarEvent) {
      if (!window.confirm("이 일정을 삭제할까요?")) return;
      const response = await fetch(`/api/teacher/classes/${item.classId}/calendar-events/${item.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "일정을 삭제하지 못했습니다.");
        return;
      }
      onDeleted("일정을 삭제했습니다.");
      return;
    }

    if (isTest && item.testId) {
      if (!window.confirm("시험을 삭제할까요? 입력된 결과는 보존되고 시험은 목록에서 숨겨집니다.")) return;
      const response = await fetch(`/api/teacher/tests/${item.testId}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "시험을 삭제하지 못했습니다.");
        return;
      }
      onDeleted("시험을 삭제했습니다.");
    }
  }

  return (
    <Modal title="일정 상세" onClose={onClose}>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone={scheduleItemTone(item)}>{scheduleItemLabel(item)}</Badge>
          <Badge>{item.className}</Badge>
          {item.subject && <Badge>{item.subject}</Badge>}
        </div>
        <div>
          <h3 className="break-words text-xl font-bold">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{dateLabel(item.date)} · {scheduleTimeLabel(item)}</p>
        </div>
        {item.description && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">{item.description}</p>}
        {isAssignment && (
          <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            숙제 마감은 과제 배정 데이터에서 가져옵니다. 수정이나 취소는 배정 관리에서 처리합니다.
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>닫기</Button>
        {isCalendarEvent && <Button type="button" variant="secondary" onClick={onEditCalendar}>수정</Button>}
        {isTest && <Button type="button" variant="secondary" onClick={onEditTest}>수정</Button>}
        {isAssignment && item.assignmentId && <Button href={`/teacher/assignments/${item.assignmentId}/targets`} variant="secondary">배정 관리</Button>}
        {(isCalendarEvent || isTest) && <Button type="button" variant="danger" onClick={remove}>삭제</Button>}
      </div>
    </Modal>
  );
}

function CalendarEventEditModal({ item, onClose, onSaved }: { item: ScheduleItem; onClose: () => void; onSaved: () => void }) {
  const [eventType, setEventType] = useState(calendarEventTypeForItem(item));
  const [title, setTitle] = useState(item.title);
  const [eventDate, setEventDate] = useState(item.date);
  const [startTime, setStartTime] = useState(formatClockTime(item.startTime));
  const [endTime, setEndTime] = useState(formatClockTime(item.endTime));
  const [description, setDescription] = useState(item.description ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/teacher/classes/${item.classId}/calendar-events/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, title, eventDate, startTime: startTime || null, endTime: endTime || null, description, status: "active" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "일정을 수정하지 못했습니다.");
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal title="일정 수정" onClose={onClose}>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          유형
          <Select value={eventType} onChange={(event) => setEventType(event.target.value)}>
            <option value="class">수업</option>
            <option value="makeup">보강</option>
            <option value="cancelled">휴강</option>
            <option value="notice">공지</option>
            <option value="etc">기타</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          제목
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold">
            날짜
            <Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            시작
            <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            종료
            <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          설명
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
        <Button type="button" onClick={save} disabled={isPending}>{isPending ? "저장 중..." : "저장"}</Button>
      </div>
    </Modal>
  );
}

function TestEditModal({ item, onClose, onSaved }: { item: ScheduleItem; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [subject, setSubject] = useState(item.subject ?? "");
  const [testDate, setTestDate] = useState(item.date);
  const [startTime, setStartTime] = useState(formatClockTime(item.startTime));
  const [endTime, setEndTime] = useState(formatClockTime(item.endTime));
  const [scope, setScope] = useState(item.description ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!item.testId) return;
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/teacher/tests/${item.testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: item.classId, title, subject, testDate, startTime: startTime || null, endTime: endTime || null, scope, status: item.status ?? "scheduled" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "시험을 수정하지 못했습니다.");
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal title="시험 수정" onClose={onClose}>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          시험명
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          과목
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold">
            날짜
            <Input type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            시작
            <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            종료
            <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          범위
          <Textarea value={scope} onChange={(event) => setScope(event.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
        <Button type="button" onClick={save} disabled={isPending}>{isPending ? "저장 중..." : "저장"}</Button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-8 px-2 py-1">닫기</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GlobalNoticeSection() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/teacher/notices/global", { cache: "no-store" });
    const data = await response.json();
    setNotices(data.notices ?? []);
  }

  useEffect(() => {
    load().catch(() => setNotices([]));
  }, []);

  async function remove(noticeId: string) {
    if (!window.confirm("전체 공지사항을 삭제할까요?")) return;
    await fetch(`/api/teacher/notices/${noticeId}`, { method: "DELETE" });
    setMessage("전체 공지사항을 삭제했습니다.");
    await load();
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">전체 공지사항</h2>
          <p className="mt-1 text-sm text-slate-500">강사의 모든 학생에게 보이는 공지입니다.</p>
        </div>
        <Button type="button" onClick={() => { setEditing(null); setIsOpen(true); }}>전체 공지 작성</Button>
      </div>
      {message && <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-action">{message}</p>}
      <div className="mt-4 grid gap-3">
        {notices.length === 0 ? (
          <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-slate-500">등록된 전체 공지사항이 없습니다.</p>
        ) : (
          notices.map((notice) => (
            <article key={notice.id} className="rounded-md border border-line p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">전체</Badge>
                    <Badge>{notice.status}</Badge>
                  </div>
                  <h3 className="mt-2 font-bold">{notice.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{notice.content}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{notice.publishedAt ?? notice.createdAt}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => { setEditing(notice); setIsOpen(true); }}>수정</Button>
                  <Button type="button" variant="danger" onClick={() => remove(notice.id)}>삭제</Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      {isOpen && (
        <NoticeFormModal
          notice={editing}
          onClose={() => setIsOpen(false)}
          onSaved={async () => {
            setIsOpen(false);
            setMessage("전체 공지사항을 저장했습니다.");
            await load();
          }}
        />
      )}
    </Card>
  );
}

function NoticeFormModal({ notice, onClose, onSaved }: { notice: Notice | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [imageUrl, setImageUrl] = useState(notice?.imageUrl ?? "");
  const [status, setStatus] = useState(notice?.status ?? "published");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    setError("");
    startTransition(async () => {
      const response = await fetch(notice ? `/api/teacher/notices/${notice.id}` : "/api/teacher/notices/global", {
        method: notice ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, imageUrl: imageUrl || null, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "공지 저장 중 오류가 발생했습니다.");
        return;
      }
      onSaved();
    });
  }

  return (
    <Modal title={notice ? "전체 공지 수정" : "전체 공지 작성"} onClose={onClose}>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          제목
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          본문
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          이미지 URL
          <Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="선택 사항" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          공개 상태
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="published">published</option>
            <option value="draft">draft</option>
            <option value="hidden">hidden</option>
          </Select>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
        <Button type="button" onClick={save} disabled={isPending}>{isPending ? "저장 중..." : "저장"}</Button>
      </div>
    </Modal>
  );
}

function ProgressBadge({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "red" | "yellow" }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={tone === "red" ? "mt-1 text-xl font-bold text-red-700" : tone === "yellow" ? "mt-1 text-xl font-bold text-amber-700" : "mt-1 text-xl font-bold text-slate-900"}>{value}</p>
    </div>
  );
}
