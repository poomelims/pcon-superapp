import { describe, expect, it } from "vitest";

import { createCarryForwardDailyReport, createEmptyDailyReport, createProject, type DailyReport } from "@/lib/project-storage";

const project = {
  ...createProject("company-1", "บ้านตัวอย่าง"),
  team: ["ภูมิใจ", "แต๊ก"]
};

describe("daily report reporter behavior", () => {
  it("defaults preparedBy to the first configured project member", () => {
    const report = createEmptyDailyReport(project);

    expect(report.preparedBy).toBe("ภูมิใจ");
    expect(report.preparedByPhone).toBe("");
  });

  it("keeps legacy preparedBy but does not carry reporter phone into new drafts", () => {
    const priorReport: DailyReport = {
      ...createEmptyDailyReport(project),
      id: "report-1",
      reportDate: "2026-05-09",
      preparedBy: "แต๊ก",
      preparedByPhone: "081-111-2222"
    };

    const nextReport = createCarryForwardDailyReport(project, priorReport, "2026-05-10");

    expect(nextReport.preparedBy).toBe("แต๊ก");
    expect(nextReport.preparedByPhone).toBe("");
  });
});
