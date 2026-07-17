import { describe, expect, it } from "vitest";

import {
  getDailyQuickSectionStatus,
  getDailyReportSaveFeedback,
  resolveDailyQuickSection
} from "@/lib/project-control/daily-report-quick-view-model";
import {
  createDefaultDailyWorker,
  createEmptyDailyReport,
  createProject,
  type DailyReport
} from "@/lib/project-storage";

const project = createProject("company-1", "Site A");

function reportWith(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    ...createEmptyDailyReport(project),
    ...overrides
  };
}

describe("daily report quick view model", () => {
  it("marks an empty report as empty in every quick section", () => {
    const report = reportWith();

    expect(getDailyQuickSectionStatus(report, "work")).toBe("empty");
    expect(getDailyQuickSectionStatus(report, "site")).toBe("empty");
    expect(getDailyQuickSectionStatus(report, "progress")).toBe("empty");
    expect(getDailyQuickSectionStatus(report, "plan")).toBe("empty");
    expect(getDailyQuickSectionStatus(report, "problems")).toBe("empty");
    expect(getDailyQuickSectionStatus(report, "photos")).toBe("empty");
  });

  it("uses trimmed work fields to distinguish progress from completion", () => {
    expect(getDailyQuickSectionStatus(reportWith({ summary: "งานวันนี้" }), "work")).toBe("in-progress");
    expect(
      getDailyQuickSectionStatus(
        reportWith({ summary: " งาน ", completedWork: " เสร็จ ", ongoingWork: " ต่อ " }),
        "work"
      )
    ).toBe("complete");
  });

  it("ignores a blank default worker row and counts meaningful worker rows", () => {
    const blankWorkerReport = reportWith({ workers: [createDefaultDailyWorker()] });
    expect(getDailyQuickSectionStatus(blankWorkerReport, "site")).toBe("empty");

    const workerReport = reportWith({
      workers: [{ ...createDefaultDailyWorker(), name: " ทีมช่าง A " }]
    });
    expect(getDailyQuickSectionStatus(workerReport, "site")).toBe("in-progress");
    expect(
      getDailyQuickSectionStatus(
        reportWith({
          materials: "ปูน",
          workers: [{ ...createDefaultDailyWorker(), name: "ทีมช่าง A" }]
        }),
        "site"
      )
    ).toBe("complete");
  });

  it("keeps photos out of the site section and marks a photo section complete", () => {
    const materialReport = reportWith({ materials: " ปูน, \n , เหล็ก " });
    expect(getDailyQuickSectionStatus(materialReport, "site")).toBe("in-progress");

    const photoReport = reportWith({
      photos: [{ id: "photo-1", name: "site.jpg", dataUrl: "data:image/jpeg;base64,site" }]
    });
    expect(getDailyQuickSectionStatus(photoReport, "site")).toBe("empty");
    expect(getDailyQuickSectionStatus(photoReport, "photos")).toBe("complete");
  });

  it("counts only non-empty progress rows", () => {
    const blankProgressReport = reportWith({
      progressUpdates: [
        {
          id: "progress-blank",
          previousProgress: 0,
          newProgress: 0,
          title: "  ",
          note: "  "
        }
      ]
    });
    expect(getDailyQuickSectionStatus(blankProgressReport, "progress")).toBe("empty");

    const progressReport = reportWith({
      progressUpdates: [
        {
          id: "progress-1",
          categoryId: "category-1",
          itemId: "item-1",
          previousProgress: 25,
          newProgress: 50,
          title: "งานโครงสร้าง",
          note: "ตรวจแล้ว"
        }
      ]
    });
    expect(getDailyQuickSectionStatus(progressReport, "progress")).toBe("complete");
  });

  it("treats next plan as the minimal valid plan and keeps problems in their own section", () => {
    expect(getDailyQuickSectionStatus(reportWith({ problems: " มีฝนตก " }), "plan")).toBe("empty");
    expect(getDailyQuickSectionStatus(reportWith({ problems: " มีฝนตก " }), "problems")).toBe("complete");
    expect(getDailyQuickSectionStatus(reportWith({ nextPlan: "ตรวจงานพรุ่งนี้" }), "plan")).toBe("complete");

    const report = reportWith({
      problemIssues: [{ id: "issue-1", title: "วัสดุมาช้า", detail: "รอของ", photos: [] }],
      nextPlan: "ตรวจงานพรุ่งนี้",
      customerNote: "",
      internalNote: ""
    });
    expect(getDailyQuickSectionStatus(report, "plan")).toBe("complete");
  });

  it("keeps partial plan content in progress until the next plan is present", () => {
    expect(getDailyQuickSectionStatus(reportWith({ customerNote: "แจ้งลูกค้าแล้ว" }), "plan")).toBe("in-progress");
    expect(getDailyQuickSectionStatus(reportWith({ internalNote: "ติดตามผู้รับเหมา" }), "plan")).toBe("in-progress");
  });

  it("does not mutate the report while deriving statuses", () => {
    const report = reportWith({
      materials: " ปูน, เหล็ก ",
      workers: [{ ...createDefaultDailyWorker(), name: "ทีมช่าง" }]
    });
    const before = structuredClone(report);

    getDailyQuickSectionStatus(report, "site");

    expect(report).toEqual(before);
  });

  it("maps checklist targets to their quick sections and defaults to work", () => {
    expect(resolveDailyQuickSection("reportDate")).toBe("work");
    expect(resolveDailyQuickSection("summary")).toBe("work");
    expect(resolveDailyQuickSection("completedWork")).toBe("work");
    expect(resolveDailyQuickSection("ongoingWork")).toBe("work");
    expect(resolveDailyQuickSection("workers")).toBe("site");
    expect(resolveDailyQuickSection("materials")).toBe("site");
    expect(resolveDailyQuickSection("sitePhotos")).toBe("photos");
    expect(resolveDailyQuickSection("problems")).toBe("problems");
    expect(resolveDailyQuickSection("nextPlan")).toBe("plan");
    expect(resolveDailyQuickSection(null)).toBe("work");
    expect(resolveDailyQuickSection(undefined)).toBe("work");
    expect(resolveDailyQuickSection("unknown" as never)).toBe("work");
  });

  it("returns the exact save feedback for creating and editing", () => {
    expect(getDailyReportSaveFeedback("idle", false)).toEqual({
      label: "บันทึกรายงาน",
      tone: "neutral",
      actionLabel: "บันทึกรายงาน"
    });
    expect(getDailyReportSaveFeedback("idle", true)).toEqual({
      label: "แก้ไขรายงาน",
      tone: "neutral",
      actionLabel: "แก้ไขรายงาน"
    });
    expect(getDailyReportSaveFeedback("saving", false)).toEqual({
      label: "กำลังบันทึก…",
      tone: "neutral",
      actionLabel: "กำลังบันทึก…"
    });
    expect(getDailyReportSaveFeedback("saved", false)).toEqual({
      label: "บันทึกในเครื่องแล้ว",
      tone: "success",
      actionLabel: "บันทึกรายงาน"
    });
    expect(getDailyReportSaveFeedback("saved", true)).toEqual({
      label: "บันทึกในเครื่องแล้ว",
      tone: "success",
      actionLabel: "แก้ไขรายงาน"
    });
    expect(getDailyReportSaveFeedback("error", false)).toEqual({
      label: "บันทึกไม่สำเร็จ — ลองอีกครั้ง",
      tone: "error",
      actionLabel: "บันทึกรายงาน"
    });
    expect(getDailyReportSaveFeedback("error", true)).toEqual({
      label: "บันทึกไม่สำเร็จ — ลองอีกครั้ง",
      tone: "error",
      actionLabel: "แก้ไขรายงาน"
    });
  });
});
