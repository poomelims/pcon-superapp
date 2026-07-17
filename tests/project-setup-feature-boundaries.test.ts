import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const workspacePath = join(root, "app", "project-setup", "workspace.tsx");
const loaderPath = join(root, "app", "project-setup", "features", "feature-loaders.tsx");

const featureFiles = [
  ["dashboard", "dashboard-view.tsx"],
  ["project", "project-view.tsx"],
  ["daily-report", "daily-report-view.tsx"],
  ["hr", "hr-view.tsx"],
  ["buyin", "buyin-view.tsx"],
  ["pdf", "daily-report-sheet.tsx"]
] as const;

describe("project setup feature boundaries", () => {
  it("keeps each large workspace view in its own feature module", () => {
    for (const [feature, file] of featureFiles) {
      expect(existsSync(join(root, "app", "project-setup", "features", feature, file)), `${feature}/${file}`).toBe(true);
    }
  });

  it("loads tab features through explicit dynamic import boundaries", () => {
    expect(existsSync(loaderPath)).toBe(true);
    const source = readFileSync(loaderPath, "utf8");

    for (const [feature, file] of featureFiles.slice(0, 5)) {
      expect(source).toContain(`import("./${feature}/${file.replace(/\.tsx$/, "")}")`);
    }
  });

  it("leaves workspace as state orchestration instead of view implementations", () => {
    const source = readFileSync(workspacePath, "utf8");

    expect(source).not.toMatch(/function (DashboardView|ProjectInfoView|BoqView|DailyReportView|HrView|BuyinView|PrintDailyReportSheet)\(/);
    expect(source.split(/\r?\n/).length).toBeLessThan(4000);
  });

  it("loads the PDF document only while previewing or exporting", () => {
    const workspace = readFileSync(workspacePath, "utf8");
    const daily = readFileSync(
      join(root, "app", "project-setup", "features", "daily-report", "daily-report-view.tsx"),
      "utf8"
    );

    expect(workspace).toContain("showPdfPreview || isExportingPdf");
    expect(workspace).toContain("await waitForPdfExportRoot(pdfExportRef)");
    expect(daily).toContain("{showPdfPreview || isExportingPdf ? (");
  });

});
