import type { DailyReport } from "./types";
import { selectDailyWorkItems } from "./daily-work-items";

export type DashboardIssueRow = {
  id: string;
  title: string;
  detail: string;
};

export function splitDashboardEntries(value: string): string[] {
  return value
    .split(/\r?\n|•|,|;/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function countCompletedWork(report: DailyReport | null): number {
  return report ? selectDailyWorkItems(report).filter((item) => item.status === "completed").length : 0;
}

export function selectDashboardIssues(report: DailyReport | null): DashboardIssueRow[] {
  if (!report) {
    return [];
  }

  if (report.problemIssues.length > 0) {
    return report.problemIssues.map((issue, index) => ({
      id: issue.id,
      title: issue.title.trim() || `ปัญหา ${index + 1}`,
      detail: issue.detail.trim() || "ยังไม่มีรายละเอียดเพิ่มเติม"
    }));
  }

  return splitDashboardEntries(report.problems).map((entry, index) => ({
    id: `problem-${index}`,
    title: entry,
    detail: "จาก Daily Report ล่าสุด"
  }));
}

export function selectDisplayEntries(value: string | undefined, fallback: string): string[] {
  const entries = splitDashboardEntries(value ?? "");
  return entries.length > 0 ? entries : [fallback];
}
