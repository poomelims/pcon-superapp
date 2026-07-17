export const MAX_DAILY_REPORT_PHOTOS = 12;
export const MAX_PROBLEM_ISSUE_PHOTOS = 4;
export const DAILY_REPORT_MEDIA_RETENTION_DAYS = 3;

export function limitDailyReportPhotos<T>(photos: T[]): T[] {
  return photos.slice(0, MAX_DAILY_REPORT_PHOTOS);
}

export function limitProblemIssuePhotos<T>(photos: T[]): T[] {
  return photos.slice(0, MAX_PROBLEM_ISSUE_PHOTOS);
}

export function hasPrintableContent(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function summarizeProblemIssues(
  issues: Array<{
    title?: string | null;
    detail?: string | null;
  }>
): string {
  return issues
    .map((issue) => issue.title?.trim() || issue.detail?.trim() || "")
    .filter(Boolean)
    .join("\n");
}

export function shouldPruneDailyReportMedia(
  reportDate: string,
  today = new Date().toISOString().slice(0, 10),
  retentionDays = DAILY_REPORT_MEDIA_RETENTION_DAYS
): boolean {
  const reportTime = Date.parse(`${reportDate}T00:00:00Z`);
  const todayTime = Date.parse(`${today}T00:00:00Z`);

  if (Number.isNaN(reportTime) || Number.isNaN(todayTime)) {
    return false;
  }

  const diffDays = Math.floor((todayTime - reportTime) / (1000 * 60 * 60 * 24));
  return diffDays > retentionDays;
}

export function createDailyReportPdfFilename(projectName: string, reportDate: string): string {
  const normalizedProjectName = projectName
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reportDate.trim());
  const dateCode = dateMatch
    ? `${dateMatch[3]}${dateMatch[2]}${String((Number(dateMatch[1]) + 543) % 100).padStart(2, "0")}`
    : "000000";

  return `${normalizedProjectName || "Project"}_${dateCode}_DailyReport.pdf`;
}
