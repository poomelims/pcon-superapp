import { describe, expect, it } from "vitest";

import { selectDashboardTodayPulse } from "@/lib/project-control/dashboard-today-view-model";
import { createDefaultDailyWorker, createEmptyDailyReport, createProject, type DailyReport } from "@/lib/project-storage";

const project = createProject("company-1", "Site A");

function reportWith(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    ...createEmptyDailyReport(project),
    ...overrides
  };
}

describe("dashboard today pulse selector", () => {
  it("returns an honest zero state when there is no report for today", () => {
    expect(selectDashboardTodayPulse([], "2026-07-16")).toEqual({
      workers: 0,
      completedWork: 0,
      blockers: [],
      nextPlan: "",
      reportState: "empty"
    });
  });

  it("summarizes meaningful workers, completed lines, blockers, and next plan", () => {
    const report = reportWith({
      reportDate: "2026-07-16",
      workers: [
        createDefaultDailyWorker(),
        { ...createDefaultDailyWorker(), id: "worker-1", name: " ทีมช่าง A ", count: 3 },
        { ...createDefaultDailyWorker(), id: "worker-2", name: "ทีมช่าง B", count: 2 }
      ],
      completedWork: "ตั้งเสา\nเดินท่อ, เก็บพื้นที่",
      problemIssues: [{ id: "issue-1", title: " วัสดุล่าช้า ", detail: " รอของจากร้าน ", photos: [] }],
      problems: "legacy should not win",
      nextPlan: "  เทคานชั้นสอง  "
    });

    expect(selectDashboardTodayPulse([report], "2026-07-16")).toEqual({
      workers: 5,
      completedWork: 3,
      blockers: ["วัสดุล่าช้า: รอของจากร้าน"],
      nextPlan: "เทคานชั้นสอง",
      reportState: "saved"
    });
  });

  it("chooses the latest valid updatedAt and keeps input order for ties", () => {
    const older = reportWith({ reportDate: "2026-07-16", updatedAt: "2026-07-16T08:00:00.000Z", nextPlan: "เก่า" });
    const newest = reportWith({ reportDate: "2026-07-16", updatedAt: "2026-07-16T12:00:00.000Z", nextPlan: "ใหม่" });
    const tied = reportWith({ reportDate: "2026-07-16", updatedAt: "2026-07-16T12:00:00.000Z", nextPlan: "เสมอ" });

    expect(selectDashboardTodayPulse([older, newest, tied], "2026-07-16").nextPlan).toBe("ใหม่");
    expect(selectDashboardTodayPulse([
      reportWith({ reportDate: "2026-07-16", updatedAt: "invalid", nextPlan: "invalid" }),
      newest
    ], "2026-07-16").nextPlan).toBe("ใหม่");
  });

  it("ignores other dates and trims empty blocker and plan values", () => {
    const otherDate = reportWith({ reportDate: "2026-07-15", workers: [{ ...createDefaultDailyWorker(), name: "เมื่อวาน", count: 8 }] });
    const today = reportWith({
      reportDate: "2026-07-16",
      problems: " ฝนตก; ;   ",
      problemIssues: [],
      nextPlan: "   ",
      completedWork: "  ,\n ; "
    });

    expect(selectDashboardTodayPulse([otherDate, today], "2026-07-16")).toEqual({
      workers: 0,
      completedWork: 0,
      blockers: ["ฝนตก"],
      nextPlan: "",
      reportState: "saved"
    });
  });
});
