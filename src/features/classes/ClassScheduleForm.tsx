"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { addMinutesToTime, formatClockTime, getDatesByWeekdays } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

type CalendarEvent = {
  id: string;
  eventType: string;
  title: string;
  description?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
};

const durations = [30, 45, 60, 90, 120];

export function ClassScheduleForm({ classId, event, onClose, onSaved }: { classId: string; event: CalendarEvent | null; onClose: () => void; onSaved: (message?: string) => void }) {
  const isEdit = Boolean(event);
  const [eventType, setEventType] = useState(event?.eventType ?? "class");
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventDate, setEventDate] = useState(event?.eventDate ?? todayString());
  const [startDate, setStartDate] = useState(event?.eventDate ?? todayString());
  const [endDate, setEndDate] = useState(event?.eventDate ?? addDays(todayString(), 35));
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(event?.startTime?.slice(0, 5) ?? "16:30");
  const [duration, setDuration] = useState(60);
  const [endTime, setEndTime] = useState(event?.endTime?.slice(0, 5) ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const isRegularClassBulk = !isEdit && eventType === "class";
  const computedEndTime = isRegularClassBulk && startTime ? addMinutesToTime(startTime, duration) : endTime;
  const previewDates = useMemo(() => isRegularClassBulk ? getDatesByWeekdays(startDate, endDate, weekdays) : [], [endDate, isRegularClassBulk, startDate, weekdays]);
  const canSave = isRegularClassBulk
    ? Boolean(startDate && endDate && endDate >= startDate && weekdays.length > 0 && startTime && duration && title.trim())
    : Boolean(eventDate && startTime && endTime && title.trim());

  function toggleWeekday(day: number) {
    setWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  }

  function save() {
    if (!canSave) {
      setError(isRegularClassBulk ? "시작일, 종료일, 요일, 시작 시간, 수업 길이, 제목을 입력해주세요." : "날짜, 시작 시간, 종료 시간, 제목을 입력해주세요.");
      return;
    }
    setError("");
    startTransition(async () => {
      const body = isRegularClassBulk
        ? { mode: "weekday_bulk", eventType: "class", title, description, startDate, endDate, weekdays, startTime, endTime: computedEndTime }
        : { eventType, title, description, eventDate, startTime: startTime || null, endTime: endTime || null };
      const response = await fetch(event ? `/api/teacher/classes/${classId}/calendar-events/${event.id}` : `/api/teacher/classes/${classId}/calendar-events`, {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "일정을 저장하지 못했습니다.");
        return;
      }
      if (isRegularClassBulk) {
        const skipped = data?.skippedCount ? ` 중복 ${data.skippedCount}개는 건너뛰었습니다.` : "";
        onSaved(`정규수업 일정 ${data?.createdCount ?? previewDates.length}개가 추가되었습니다.${skipped}`);
        return;
      }
      onSaved("일정을 저장했습니다.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{isEdit ? "일정 수정" : "일정 추가"}</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-8 px-2 py-1">닫기</Button>
        </div>
        <div className="grid gap-4">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          <label className="grid gap-2 text-sm font-semibold">
            유형
            <Select value={eventType} onChange={(event) => setEventType(event.target.value)} disabled={isEdit}>
              <option value="class">정규수업</option>
              <option value="makeup">보강</option>
              <option value="cancelled">휴강</option>
              <option value="notice">특강</option>
              <option value="etc">기타</option>
            </Select>
          </label>

          {isRegularClassBulk ? (
            <>
              <p className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                선택한 기간 동안 선택한 요일마다 정규수업 일정이 생성됩니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">시작일<Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label className="grid gap-2 text-sm font-semibold">종료일<Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
              </div>
              <WeekdaySelector selected={weekdays} onToggle={toggleWeekday} />
              <HourMinutePicker value={startTime} onChange={setStartTime} />
              <Picker title="수업 길이" options={durations} value={duration} onChange={setDuration} format={(value) => `${value}분`} />
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                종료 시간: {computedEndTime ? formatClockTime(computedEndTime) : "시작 시간을 선택해주세요."}
              </p>
              <p className="text-sm text-slate-500">
                {previewDates.length > 0
                  ? `${startDate}부터 ${endDate}까지 선택한 요일에 정규수업 ${previewDates.length}개가 생성됩니다.`
                  : "기간과 요일을 선택하면 생성될 일정 개수를 확인할 수 있습니다."}
              </p>
            </>
          ) : (
            <>
              <label className="grid gap-2 text-sm font-semibold">날짜<Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">시작 시간<Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
                <label className="grid gap-2 text-sm font-semibold">종료 시간<Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
              </div>
            </>
          )}

          <label className="grid gap-2 text-sm font-semibold">제목<Input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-semibold">설명<Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
            <Button type="button" onClick={save} disabled={isPending || !canSave}>{isPending ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekdaySelector({ selected, onToggle }: { selected: number[]; onToggle: (day: number) => void }) {
  const days = [
    { value: 1, label: "월" },
    { value: 2, label: "화" },
    { value: 3, label: "수" },
    { value: 4, label: "목" },
    { value: 5, label: "금" },
    { value: 6, label: "토" },
    { value: 0, label: "일" },
  ];
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">요일 선택</p>
      <div className="flex flex-wrap gap-2">
        {days.map((day) => (
          <button key={day.value} type="button" onClick={() => onToggle(day.value)} className={chipClass(selected.includes(day.value))}>
            {day.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HourMinutePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const hour = value.match(/^(\d{2}):(\d{2})/)?.[1] ?? "16";
  const minute = value.match(/^(\d{2}):(\d{2})/)?.[2] ?? "00";
  const hours = Array.from({ length: 14 }, (_, index) => index + 8);
  const minutes = ["00", "10", "20", "30", "40", "50"];

  function update(nextHour: string, nextMinute: string) {
    onChange(`${nextHour}:${nextMinute}`);
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">시작 시간</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          시
          <Select value={hour} onChange={(event) => update(event.target.value, minute)}>
            {hours.map((item) => (
              <option key={item} value={String(item).padStart(2, "0")}>
                {formatHourLabel(item)}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-600">
          분
          <Select value={minute} onChange={(event) => update(hour, event.target.value)}>
            {minutes.map((item) => (
              <option key={item} value={item}>
                {Number(item)}분
              </option>
            ))}
          </Select>
        </label>
      </div>
    </div>
  );
}

function formatHourLabel(hour: number) {
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${displayHour}시`;
}

function Picker<T extends string | number>({ title, options, value, onChange, format }: { title: string; options: T[]; value: T; onChange: (value: T) => void; format: (value: T) => string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={String(option)} type="button" onClick={() => onChange(option)} className={chipClass(value === option)}>
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function chipClass(active: boolean) {
  return cn("rounded-full border px-3 py-2 text-sm font-bold", active ? "border-action bg-blue-50 text-action" : "border-line bg-white text-slate-600");
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}
