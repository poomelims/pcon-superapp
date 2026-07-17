import { sortWithCompare } from "@/lib/runtime-compat";
import type { DailyReport } from "@/lib/project-control/types";

export type DailyReportDateSelection = {
  mode: "create" | "edit";
  savedReport: DailyReport | null;
  previousReport: DailyReport | null;
};

export function resolveDailyReportDateSelection(
  reports: DailyReport[],
  reportDate: string
): DailyReportDateSelection {
  const savedReport = reports.find((report) => report.reportDate === reportDate) ?? null;
  const previousReport =
    sortWithCompare(
      reports.filter((report) => report.id !== savedReport?.id && report.reportDate < reportDate),
      (a, b) => b.reportDate.localeCompare(a.reportDate) || b.updatedAt.localeCompare(a.updatedAt)
    )[0] ?? null;

  return { mode: savedReport ? "edit" : "create", savedReport, previousReport };
}
