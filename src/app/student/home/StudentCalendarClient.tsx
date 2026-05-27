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
  if (type === "class") return "수업";
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

export function StudentCalendarClient({ events }: { events: StudentCalendarEvent[] }) {
  const firstDate = events[0]?.date ?? "2026-05-25";
  const [selectedDate, setSelectedDate] = useState(firstDate);
  const days = buildMonthDays(firstDate);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, StudentCalendarEvent[]>();
    for (const event of events) {
      const key = event.date.slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return grouped;
  }, [events]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  return (
    <section id="student-calendar" className="student-section">
      <Badge tone="green">Calendar</Badge>
      <h2 className="mb-5 mt-3 text-[clamp(1.9rem,3.8vw,3rem)] font-bold leading-[1.3]">캘린더</h2>
      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">{monthTitle(firstDate)}</h3>
            <p className="mt-1 text-sm leading-6 text-[#5b655d]">날짜를 누르면 숙제, 시험, 휴강, 보강 일정을 확인할 수 있어요.</p>
          </div>
          <Badge tone="blue">반 공유 캘린더</Badge>
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
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={cn(
                            "h-2 w-2 rounded-full",
                            (event.type === "cancelled" || event.type === "cancelled_class") && "bg-red-500",
                            event.type === "test" && "bg-yellow-500",
                            (event.type === "makeup" || event.type === "makeup_class") && "bg-green-500",
                            (event.type === "assignment" || event.type === "assignment_due") && "bg-blue-500",
                            (event.type === "class" || event.type === "notice" || event.type === "etc") && "bg-slate-400",
                          )}
                        />
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
                const timeRange = formatTimeRange(event.startTime, event.endTime, "");
                return (
                  <article key={event.id} className="rounded-[18px] border border-line bg-[#f7fbf6] px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={eventTone(event.type)}>{eventLabel(event.type)}</Badge>
                      {event.className && <span className="text-xs font-semibold text-slate-500">{event.className}</span>}
                    </div>
                    <p className="mt-2 text-sm font-bold text-ink">{event.title}</p>
                    {event.type === "test" && <p className="mt-1 text-xs font-semibold text-slate-500">{timeRange || "시간 미정"}</p>}
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
