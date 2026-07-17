import { describe, expect, it } from "vitest";
import { resolveDailyReportDateSelection } from "@/lib/project-control/daily-report-selection";
import { createEmptyDailyReport, createProject } from "@/lib/project-storage";

describe("daily report date selection", () => {
  const project = createProject("company-1", "Site A");

  function report(id: string, reportDate: string) {
    return { ...createEmptyDailyReport(project), id, reportDate, updatedAt: `${reportDate}T12:00:00.000Z` };
  }

  it("loads the saved report and its closest prior report for edit mode", () => {
    const result = resolveDailyReportDateSelection(
      [report("new", "2026-07-15"), report("old", "2026-07-14")],
      "2026-07-15"
    );

    expect(result.mode).toBe("edit");
    expect(result.savedReport?.id).toBe("new");
    expect(result.previousReport?.id).toBe("old");
  });

  it("returns create mode with the closest prior report for a new date", () => {
    const result = resolveDailyReportDateSelection(
      [report("future", "2026-07-16"), report("old", "2026-07-14")],
      "2026-07-15"
    );

    expect(result.mode).toBe("create");
    expect(result.savedReport).toBeNull();
    expect(result.previousReport?.id).toBe("old");
  });
});
