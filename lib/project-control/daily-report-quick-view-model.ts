import type { DailyChecklistItemId } from "@/lib/daily-report-checklist";
import type { DailyReport } from "@/lib/project-control/types";

export type DailyQuickSection = "work" | "site" | "progress" | "plan" | "problems" | "photos";
export type DailyQuickSectionStatus = "empty" | "in-progress" | "complete";

type SaveState = "idle" | "saving" | "saved" | "error";

function hasTrimmedText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMaterialRows(materials: string): boolean {
  return materials
    .split(/[\n,]+/)
    .map((row) => row.trim())
    .some((row) => row.length > 0);
}

function hasWorkerRows(report: DailyReport): boolean {
  return report.workers.some((worker) => {
    const hasCustomText = [worker.name, worker.crewId, worker.taskTitle, worker.note].some(hasTrimmedText);
    const hasCustomDefaults =
      (hasTrimmedText(worker.trade) && worker.trade.trim() !== "ทั่วไป") ||
      (hasTrimmedText(worker.startTime) && worker.startTime.trim() !== "08:00") ||
      (hasTrimmedText(worker.endTime) && worker.endTime.trim() !== "17:00") ||
      worker.taskStatus !== "ดำเนินการ";
    const hasMeaningfulCount = Number.isFinite(worker.count) && worker.count > 1;

    return hasCustomText || hasCustomDefaults || hasMeaningfulCount;
  });
}

function hasProgressRows(report: DailyReport): boolean {
  return report.progressUpdates.some((update) => {
    const hasTarget = [update.categoryId, update.itemId, update.title, update.note].some(hasTrimmedText);
    const hasProgressChange =
      Number.isFinite(update.previousProgress) &&
      Number.isFinite(update.newProgress) &&
      update.previousProgress !== update.newProgress;

    return hasTarget || hasProgressChange;
  });
}

function hasProblemIssueContent(issue: DailyReport["problemIssues"][number]): boolean {
  return hasTrimmedText(issue.title) || hasTrimmedText(issue.detail) || issue.photos.length > 0;
}

function getSiteSectionStatus(report: DailyReport): DailyQuickSectionStatus {
  return statusFromFlags([hasMaterialRows(report.materials), hasWorkerRows(report)]);
}

function getPlanSectionStatus(report: DailyReport): DailyQuickSectionStatus {
  if (hasTrimmedText(report.nextPlan)) {
    return "complete";
  }

  const hasPartialPlanContent = hasTrimmedText(report.customerNote) || hasTrimmedText(report.internalNote);

  return hasPartialPlanContent ? "in-progress" : "empty";
}

function getProblemsSectionStatus(report: DailyReport): DailyQuickSectionStatus {
  if (hasTrimmedText(report.problems) && report.problemIssues.length === 0) {
    return "complete";
  }

  if (report.problemIssues.length === 0) {
    return "empty";
  }

  const completeIssueCount = report.problemIssues.filter(hasProblemIssueContent).length;

  return completeIssueCount === report.problemIssues.length ? "complete" : "in-progress";
}

function statusFromFlags(flags: readonly boolean[]): DailyQuickSectionStatus {
  const completeCount = flags.filter(Boolean).length;

  if (completeCount === 0) {
    return "empty";
  }

  return completeCount === flags.length ? "complete" : "in-progress";
}

export function getDailyQuickSectionStatus(
  report: DailyReport,
  section: DailyQuickSection
): DailyQuickSectionStatus {
  switch (section) {
    case "work":
      return statusFromFlags([
        hasTrimmedText(report.summary),
        hasTrimmedText(report.completedWork),
        hasTrimmedText(report.ongoingWork)
      ]);
    case "site":
      return getSiteSectionStatus(report);
    case "progress":
      return statusFromFlags([hasProgressRows(report)]);
    case "plan":
      return getPlanSectionStatus(report);
    case "problems":
      return getProblemsSectionStatus(report);
    case "photos":
      return report.photos.length > 0 ? "complete" : "empty";
  }
}

export function resolveDailyQuickSection(
  checklistId?: DailyChecklistItemId | null
): DailyQuickSection {
  switch (checklistId) {
    case "sitePhotos":
      return "photos";
    case "workers":
    case "materials":
      return "site";
    case "nextPlan":
      return "plan";
    case "problems":
      return "problems";
    case "reportDate":
    case "summary":
    case "completedWork":
    case "ongoingWork":
    default:
      return "work";
  }
}

export function getDailyReportSaveFeedback(
  state: SaveState,
  isEditing: boolean
): { label: string; tone: "neutral" | "success" | "error"; actionLabel: string } {
  const editActionLabel = isEditing ? "แก้ไขรายงาน" : "บันทึกรายงาน";

  switch (state) {
    case "saving":
      return {
        label: "กำลังบันทึก…",
        tone: "neutral",
        actionLabel: "กำลังบันทึก…"
      };
    case "saved":
      return {
        label: "บันทึกในเครื่องแล้ว",
        tone: "success",
        actionLabel: editActionLabel
      };
    case "error":
      return {
        label: "บันทึกไม่สำเร็จ — ลองอีกครั้ง",
        tone: "error",
        actionLabel: editActionLabel
      };
    case "idle":
    default:
      return {
        label: editActionLabel,
        tone: "neutral",
        actionLabel: editActionLabel
      };
  }
}
