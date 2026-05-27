export type CalendarItemSource = "class_calendar_event" | "assignment_due" | "test";

export type CalendarItemType =
  | "class"
  | "makeup_class"
  | "cancelled_class"
  | "assignment_due"
  | "test"
  | "notice"
  | "etc";

export type CalendarItem = {
  id: string;
  source: CalendarItemSource;
  type: CalendarItemType;
  title: string;
  date: string;
  classId: string | null;
  className: string | null;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  subject: string | null;
  status: string | null;
  assignmentId?: string | null;
  targetCount?: number;
  testId?: string | null;
};

export function formatTimeRange(startTime?: string | null, endTime?: string | null, fallback = "시간 미정") {
  if (!startTime && !endTime) return fallback;
  return `${startTime ?? ""}${startTime && endTime ? " - " : ""}${endTime ?? ""}`;
}
