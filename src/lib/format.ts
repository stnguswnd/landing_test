export function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function formatDue(value?: string) {
  if (!value) return "마감일 없음";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:00`) : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}
