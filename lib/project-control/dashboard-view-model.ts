export function formatDashboardShortDate(value?: string | null): string {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}`;
}

export function formatDashboardDateSpan(startDate?: string | null, dueDate?: string | null): string {
  const start = formatDashboardShortDate(startDate);
  const due = formatDashboardShortDate(dueDate);
  if (start === "-" && due === "-") return "-";
  if (start === "-") return due;
  if (due === "-") return start;
  return `${start}-${due}`;
}
