import type { DailyReport } from "@/lib/project-storage";
import { selectDailyWorkText } from "@/lib/project-control/daily-work-items";

export const dailyChecklistAnchorIds = {
  sitePhotos: "daily-report-anchor-site-photos",
  reportDate: "daily-report-anchor-report-date",
  summary: "daily-report-anchor-summary",
  completedWork: "daily-report-anchor-completed-work",
  ongoingWork: "daily-report-anchor-ongoing-work",
  problems: "daily-report-anchor-problems",
  materials: "daily-report-anchor-materials",
  nextPlan: "daily-report-anchor-next-plan",
  workers: "daily-report-anchor-workers"
} as const;

export type DailyChecklistItemId = keyof typeof dailyChecklistAnchorIds;

export type DailyChecklistItem = {
  id: DailyChecklistItemId;
  label: string;
  completed: boolean;
  summary: string;
  anchorId: (typeof dailyChecklistAnchorIds)[DailyChecklistItemId];
};

function shortText(value: string, fallback: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.length > 72 ? `${trimmed.slice(0, 72).trimEnd()}...` : trimmed;
}

function isChecklistItemCompleted(report: DailyReport, itemId: DailyChecklistItemId, hasCurrentContent: boolean): boolean {
  if (!hasCurrentContent) {
    return false;
  }

  if (!report.carryForwardSourceReportId || itemId === "reportDate") {
    return true;
  }

  return (report.confirmedChecklistItems ?? []).includes(itemId);
}

export function buildDailyChecklist(report: DailyReport): DailyChecklistItem[] {
  const completedWork = selectDailyWorkText(report, "completed");
  const ongoingWork = selectDailyWorkText(report, "ongoing");
  const hasStructuredProblemContent = report.problemIssues.some(
    (issue) => issue.title.trim() || issue.detail.trim() || issue.photos.length > 0
  );
  const problemSummary =
    report.problemIssues.length > 0
      ? hasStructuredProblemContent
        ? `${report.problemIssues.length} รายการ`
        : `${report.problemIssues.length} รายการรอกรอก`
      : report.problems.trim()
        ? "มีข้อความปัญหา"
        : "ไม่มีปัญหาในวันนี้";

  const workerCount = report.workers.reduce((total, worker) => total + Math.max(0, worker.count), 0);

  return [
    {
      id: "sitePhotos",
      label: "อัพรูปหน้างาน",
      completed: isChecklistItemCompleted(report, "sitePhotos", report.photos.length > 0),
      summary: report.photos.length > 0 ? `${report.photos.length} รูป` : "ยังไม่มีรูปหน้างาน",
      anchorId: dailyChecklistAnchorIds.sitePhotos
    },
    {
      id: "reportDate",
      label: "วันที่รายงาน",
      completed: isChecklistItemCompleted(report, "reportDate", Boolean(report.reportDate.trim())),
      summary: report.reportDate.trim() || "ยังไม่เลือกวันที่",
      anchorId: dailyChecklistAnchorIds.reportDate
    },
    {
      id: "summary",
      label: "สรุปงานวันนี้",
      completed: isChecklistItemCompleted(report, "summary", Boolean(report.summary.trim())),
      summary: shortText(report.summary, "ยังไม่กรอก"),
      anchorId: dailyChecklistAnchorIds.summary
    },
    {
      id: "completedWork",
      label: "งานที่ทำเสร็จวันนี้",
      completed: isChecklistItemCompleted(report, "completedWork", Boolean(completedWork.trim())),
      summary: shortText(completedWork, "ยังไม่กรอก"),
      anchorId: dailyChecklistAnchorIds.completedWork
    },
    {
      id: "ongoingWork",
      label: "งานที่กำลังดำเนินการ",
      completed: isChecklistItemCompleted(report, "ongoingWork", Boolean(ongoingWork.trim())),
      summary: shortText(ongoingWork, "ยังไม่กรอก"),
      anchorId: dailyChecklistAnchorIds.ongoingWork
    },
    {
      id: "problems",
      label: "ปัญหา / อุปสรรค",
      completed: isChecklistItemCompleted(report, "problems", report.problemIssues.length === 0 || hasStructuredProblemContent || Boolean(report.problems.trim())),
      summary: problemSummary,
      anchorId: dailyChecklistAnchorIds.problems
    },
    {
      id: "materials",
      label: "วัสดุที่ใช้ / เข้าไซต์",
      completed: isChecklistItemCompleted(report, "materials", Boolean(report.materials.trim())),
      summary: shortText(report.materials, "ยังไม่กรอก"),
      anchorId: dailyChecklistAnchorIds.materials
    },
    {
      id: "nextPlan",
      label: "แผนงานวันถัดไป",
      completed: isChecklistItemCompleted(report, "nextPlan", Boolean(report.nextPlan.trim())),
      summary: shortText(report.nextPlan, "ยังไม่กรอก"),
      anchorId: dailyChecklistAnchorIds.nextPlan
    },
    {
      id: "workers",
      label: "ทีม / ช่างในไซต์",
      completed: isChecklistItemCompleted(report, "workers", report.workers.length > 0),
      summary: workerCount > 0 ? `${workerCount} คน • ${report.workers.length} ทีม` : "ยังไม่มีทีมงาน",
      anchorId: dailyChecklistAnchorIds.workers
    }
  ];
}
