import { sortWithCompare } from "@/lib/runtime-compat";
import type { DailyReport, ProjectControlData } from "@/lib/project-control/types";

export function selectProjectReportHistory(
  data: Pick<ProjectControlData, "dailyReports">,
  companyId: string,
  projectId: string
): DailyReport[] {
  return sortWithCompare(
    data.dailyReports.filter((report) => report.companyId === companyId && report.projectId === projectId),
    (a, b) => b.reportDate.localeCompare(a.reportDate) || b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function selectDashboardReportSnapshot(reports: DailyReport[], activeDraftId?: string): DailyReport | null {
  if (activeDraftId) {
    const savedDraft = reports.find((report) => report.id === activeDraftId);
    if (savedDraft) {
      return savedDraft;
    }
  }

  return reports[0] ?? null;
}
