import { describe, expect, it } from "vitest";

import {
  countCompletedWork,
  selectDashboardIssues,
  selectDisplayEntries,
  splitDashboardEntries
} from "@/lib/project-control/dashboard-selectors";
import { createEmptyDailyReport, createProject } from "@/lib/project-storage";

describe("dashboard selectors", () => {
  it("keeps zero-state counts at zero instead of counting placeholder text", () => {
    expect(countCompletedWork(null)).toBe(0);
    expect(selectDashboardIssues(null)).toEqual([]);
    expect(selectDisplayEntries("", "ยังไม่มีข้อมูล")).toEqual(["ยังไม่มีข้อมูล"]);
  });

  it("counts only real completed work entries", () => {
    const report = createEmptyDailyReport(createProject("company-1"));
    report.completedWork = "ตั้งเสา\nเดินท่อ, เก็บพื้นที่";

    expect(countCompletedWork(report)).toBe(3);
    expect(splitDashboardEntries(report.completedWork)).toEqual(["ตั้งเสา", "เดินท่อ", "เก็บพื้นที่"]);
  });

  it("prefers structured problem issues and falls back to legacy problem text", () => {
    const report = createEmptyDailyReport(createProject("company-1"));
    report.problems = "ฝนตก; วัสดุล่าช้า";

    expect(selectDashboardIssues(report)).toHaveLength(2);

    report.problemIssues = [{ id: "issue-1", title: "พื้นที่เปียก", detail: "รอระบายน้ำ", photos: [] }];
    expect(selectDashboardIssues(report)).toEqual([
      { id: "issue-1", title: "พื้นที่เปียก", detail: "รอระบายน้ำ" }
    ]);
  });
});
