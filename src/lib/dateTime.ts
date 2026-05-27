export function addMinutesToTime(time: string, minutes: number) {
  const match = time.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatClockTime(value?: string | null) {
  if (!value) return "";
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${displayHour}:${minute}`;
}

export function formatTimeRange(startTime?: string | null, endTime?: string | null, fallback = "시간 미정") {
  const start = formatClockTime(startTime);
  const end = formatClockTime(endTime);
  if (!start && !end) return fallback;
  return `${start}${start && end ? " - " : ""}${end}`;
}

export function getDatesByWeekdays(startDate: string, endDate: string, weekdays: number[]) {
  if (!startDate || !endDate || weekdays.length === 0) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const selected = new Set(weekdays);
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (selected.has(cursor.getDay())) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
