import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PROJECT_STORAGE_KEY,
  createDefaultData,
  createEmptyDailyReport,
  createProject,
  exportProjectControlJson,
  importProjectControlJson
} from "@/lib/project-storage";
import {
  selectDashboardReportSnapshot,
  selectProjectReportHistory
} from "@/lib/project-control/daily-report-selectors";

describe("Project Control module boundaries", () => {
  it("keeps the legacy storage key and default owner company", () => {
    const data = createDefaultData();

    expect(PROJECT_STORAGE_KEY).toBe("pcon_project_setup_data");
    expect(data.companies[0]).toMatchObject({ name: "บริษัทของฉัน", role: "owner" });
    expect(data.companies.some((company) => company.id === data.activeCompanyId)).toBe(true);
    expect(data.projects).toEqual([]);
  });

  it("round-trips legacy JSON without losing company-scoped reports", () => {
    const data = createDefaultData();
    const project = createProject(data.activeCompanyId, "บ้านทดสอบ");
    const report = { ...createEmptyDailyReport(project), summary: "ตรวจงานโครงสร้าง" };
    const source = {
      ...data,
      projects: [project],
      activeProjectId: project.id,
      dailyReports: [report]
    };

    const restored = importProjectControlJson(exportProjectControlJson(source), "2026-07-15");

    expect(restored.projects[0]).toMatchObject({ id: project.id, companyId: data.activeCompanyId });
    expect(restored.dailyReports[0]).toMatchObject({ id: report.id, projectId: project.id, summary: report.summary });
  });

  it("filters and sorts Daily Report history by both company and project", () => {
    const project = createProject("company-a", "Project A");
    const older = { ...createEmptyDailyReport(project), id: "older", reportDate: "2026-07-13" };
    const latest = { ...createEmptyDailyReport(project), id: "latest", reportDate: "2026-07-15" };
    const otherCompany = { ...latest, id: "other-company", companyId: "company-b" };
    const history = selectProjectReportHistory({ dailyReports: [older, otherCompany, latest] }, "company-a", project.id);

    expect(history.map((report) => report.id)).toEqual(["latest", "older"]);
    expect(selectDashboardReportSnapshot(history, "unsaved-draft")).toBe(latest);
    expect(selectDashboardReportSnapshot(history, "older")).toBe(older);
  });

  it("keeps project-storage as a thin compatibility facade", () => {
    const source = readFileSync(join(process.cwd(), "lib", "project-storage.ts"), "utf8");

    expect(source.split(/\r?\n/).length).toBeLessThan(30);
    expect(source).toContain('export * from "@/lib/project-control/local-repository"');
    expect(source).toContain('export * from "@/lib/project-control/cloud-mapping"');
  });
});
