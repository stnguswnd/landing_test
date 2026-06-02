"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatTimeRange, type CalendarItemType } from "@/lib/calendarTypes";
import { cn } from "@/lib/utils";

export type StudentCalendarEvent = {
  id: string;
  date: string;
  title: string;
  type: CalendarItemType | "assignment" | "cancelled" | "makeup";
  count?: number;
  subject?: string;
  status?: string;
  className?: string;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

function buildMonthDays(anchor = "2026-05-01") {
  const base = new Date(`${anchor}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: last }, (_, index) => {
      const day = index + 1;
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }),
  ];
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "06";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : "";
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
  const today = todayDate();
  if (isSameMonth(today, targetMonth)) return today;

  const current = new Date(`${dateOnly(currentSelectedDate)}T00:00:00`);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  if (current.getDate() <= lastDay) {
    return toDateString(new Date(target.getFullYear(), target.getMonth(), current.getDate()));
  }
  return toDateString(new Date(target.getFullYear(), target.getMonth(), 1));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`));
}

function monthTitle(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(`${value}T00:00:00`));
}

function eventLabel(type: StudentCalendarEvent["type"]) {
  if (type === "assignment" || type === "assignment_due") return "숙제";
  if (type === "test") return "시험";
  if (type === "cancelled" || type === "cancelled_class") return "휴강";
  if (type === "makeup" || type === "makeup_class") return "보강";
  if (type === "class") return "정규 수업";
  if (type === "notice") return "공지";
  return "기타";
}

function eventTone(type: StudentCalendarEvent["type"]): "blue" | "green" | "yellow" | "red" | "gray" {
  if (type === "assignment" || type === "assignment_due") return "blue";
  if (type === "test") return "yellow";
  if (type === "cancelled" || type === "cancelled_class") return "red";
  if (type === "makeup" || type === "makeup_class") return "green";
  if (type === "class") return "blue";
  return "gray";
}

function assignmentStatusLabel(status?: string) {
  if (status === "submitted" || status === "reviewed") return "제출 완료";
  if (status === "returned") return "반려";
  if (status === "late") return "마감 지남";
  return "미제출";
}

function assignmentStatusTone(status?: string): "green" | "yellow" | "red" | "gray" {
  if (status === "submitted" || status === "reviewed") return "green";
  if (status === "returned") return "red";
  if (status === "late") return "yellow";
  return "gray";
}

function eventTimeText(event: StudentCalendarEvent) {
  const fallback = event.type === "assignment" || event.type === "assignment_due" ? "마감 시간 미정" : "시간 미정";
  const timeRange = formatTimeRange(event.startTime, event.endTime, fallback);

  if (event.type === "assignment" || event.type === "assignment_due") return `마감 ${timeRange}`;
  if (event.type === "test") return `시험 시간 ${timeRange}`;
  if (event.type === "cancelled" || event.type === "cancelled_class") return `휴강 시간 ${timeRange}`;
  if (event.type === "makeup" || event.type === "makeup_class") return `보강 시간 ${timeRange}`;
  if (event.type === "class") return `수업 시간 ${timeRange}`;
  return timeRange;
}

function compareEventsByTime(left: StudentCalendarEvent, right: StudentCalendarEvent) {
  const timeOrder = (left.startTime ?? "99:99").localeCompare(right.startTime ?? "99:99");
  if (timeOrder !== 0) return timeOrder;
  return left.title.localeCompare(right.title);
}

function calendarMarkerClass(type: StudentCalendarEvent["type"]) {
  if (type === "cancelled" || type === "cancelled_class") return "bg-red-50 text-red-700";
  if (type === "test") return "bg-yellow-50 text-yellow-700";
  if (type === "makeup" || type === "makeup_class") return "bg-green-50 text-green-700";
  if (type === "assignment" || type === "assignment_due") return "bg-violet-50 text-violet-700";
  if (type === "class") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function calendarMarkerLabel(type: StudentCalendarEvent["type"]) {
  if (type === "class") return "수업";
  return eventLabel(type);
}

export function StudentCalendarClient({ events }: { events: StudentCalendarEvent[] }) {
  const today = todayDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [displayMonth, setDisplayMonth] = useState(monthStart(today));
  const days = buildMonthDays(displayMonth);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, StudentCalendarEvent[]>();
    for (const event of events) {
      const key = event.date.slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    for (const [key, dayEvents] of grouped) {
      grouped.set(key, [...dayEvents].sort(compareEventsByTime));
    }
    return grouped;
  }, [events]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  function moveMonth(amount: number) {
    setDisplayMonth((current) => {
      const nextMonth = addMonths(current, amount);
      setSelectedDate((currentSelectedDate) => selectedDateForMonth(nextMonth, currentSelectedDate));
      return nextMonth;
    });
  }

  function goToday() {
    const todayValue = todayDate();
    setDisplayMonth(monthStart(todayValue));
    setSelectedDate(todayValue);
  }

  return (
    <section id="student-calendar" className="student-section">
      <Badge tone="green">Calendar</Badge>
      <h2 className="mb-5 mt-3 text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.3]">캘린더</h2>
      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                aria-label="이전달"
              >
                &lt;
              </button>
              <h3 className="min-w-28 text-center text-lg font-bold">{monthTitle(displayMonth)}</h3>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                aria-label="다음달"
              >
                &gt;
              </button>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#5b655d]">날짜를 누르면 숙제, 시험, 휴강, 보강 일정을 확인할 수 있어요.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              className="inline-flex min-h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              오늘
            </button>
            <Badge tone="blue">반 공유 캘린더</Badge>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#5b655d]">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            const dayEvents = date ? eventsByDate.get(date) ?? [] : [];
            const isSelected = date === selectedDate;
            return (
              <button
                key={date ?? `empty-${index}`}
                type="button"
                disabled={!date}
                onClick={() => date && setSelectedDate(date)}
                className={cn(
                  "min-h-20 rounded-[14px] border border-line bg-white p-1.5 text-left text-sm transition disabled:bg-transparent",
                  date && "hover:border-action hover:bg-[#f3faf4]",
                  isSelected && "border-action bg-[#f3faf4] ring-1 ring-action",
                )}
              >
                {date && (
                  <>
                    <span className="font-bold">{Number(date.slice(-2))}</span>
                    <div className="mt-1 grid gap-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={cn(
                            "truncate rounded px-1.5 py-0.5 text-[10px] font-bold leading-4",
                            calendarMarkerClass(event.type),
                          )}
                        >
                          {calendarMarkerLabel(event.type)}
                        </span>
                      ))}
                    </div>
                    {dayEvents.length > 3 && <p className="mt-1 text-[11px] font-bold text-slate-500">+{dayEvents.length - 3}</p>}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <h4 className="font-bold">{formatDate(selectedDate)} 일정</h4>
          {selectedEvents.length === 0 ? (
            <p className="mt-3 rounded-[18px] border border-dashed border-line p-4 text-center text-sm text-[#5b655d]">선택한 날짜에 등록된 일정이 없습니다.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {selectedEvents.map((event) => {
                return (
                  <article key={event.id} className="rounded-[18px] border border-line bg-[#f7fbf6] px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={eventTone(event.type)}>{eventLabel(event.type)}</Badge>
                      {event.className && <span className="text-xs font-semibold text-slate-500">{event.className}</span>}
                    </div>
                    <p className="mt-2 text-sm font-bold text-ink">{event.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{eventTimeText(event)}</p>
                    {event.description && (
                      <p className="mt-2 rounded-[12px] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#5b655d]">
                        {event.description}
                      </p>
                    )}
                    {(event.type === "assignment" || event.type === "assignment_due") && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {event.subject && <Badge tone="blue">{event.subject}</Badge>}
                        <Badge tone={assignmentStatusTone(event.status)}>{assignmentStatusLabel(event.status)}</Badge>
                      </div>
                    )}
                    {typeof event.count === "number" && <p className="mt-1 text-xs font-semibold text-slate-500">총 {event.count}개</p>}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
