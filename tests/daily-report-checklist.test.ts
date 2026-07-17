import { describe, expect, it } from "vitest";

import { buildDailyChecklist } from "@/lib/daily-report-checklist";
import { confirmDailyChecklistItems, createCarryForwardDailyReport, createEmptyDailyReport, createProject, type DailyReport } from "@/lib/project-storage";

describe("daily report checklist", () => {
  it("summarizes missing daily inputs from the current draft", () => {
    const project = createProject("company-1", "บ้านตัวอย่าง");
    const report = createEmptyDailyReport(project);

    const checklist = buildDailyChecklist(report);

    expect(checklist[0]).toMatchObject({
      id: "sitePhotos",
      completed: false,
      summary: "ยังไม่มีรูปหน้างาน"
    });
    expect(checklist.find((item) => item.id === "summary")).toMatchObject({
      completed: false,
      summary: "ยังไม่กรอก"
    });
    expect(checklist.map((item) => item.id)).not.toContain("preparedBy");
    expect(checklist.find((item) => item.id === "workers")).toMatchObject({
      completed: false,
      summary: "ยังไม่มีทีมงาน"
    });
    expect(checklist.find((item) => item.id === "problems")).toMatchObject({
      completed: true,
      summary: "ไม่มีปัญหาในวันนี้"
    });
  });

  it("marks completed items and prefers structured issues when available", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      team: ["ภูมิใจ"]
    };
    const report = {
      ...createEmptyDailyReport(project),
      summary: "เทคอนกรีตชั้นล่าง",
      completedWork: "วางเหล็กเสร็จแล้ว",
      ongoingWork: "เตรียมแบบหล่อ",
      materials: "ปูน, เหล็ก",
      nextPlan: "ขึ้นแบบเสา",
      workers: [
        {
          id: "worker-1",
          name: "ทีมช่าง A",
          trade: "ปูน",
          count: 4,
          startTime: "08:00",
          endTime: "17:00",
          note: "",
          taskTitle: "เทคอนกรีต",
          taskStatus: "ดำเนินการ" as const
        }
      ],
      problems: "ข้อความเก่า",
      problemIssues: [{ id: "issue-1", title: "คอนกรีตมาช้า", detail: "รถส่งช้า 30 นาที", photos: [] }]
    };

    const checklist = buildDailyChecklist(report);

    expect(checklist.map((item) => item.id)).not.toContain("preparedBy");
    expect(checklist.find((item) => item.id === "problems")).toMatchObject({
      completed: true,
      summary: "1 รายการ"
    });
    expect(checklist.find((item) => item.id === "workers")).toMatchObject({
      completed: true,
      summary: "4 คน • 1 ทีม"
    });
  });

  it("marks the site photo checklist item complete when today has photos", () => {
    const project = createProject("company-1", "บ้านตัวอย่าง");
    const report = {
      ...createEmptyDailyReport(project),
      photos: [
        {
          id: "photo-1",
          name: "site.jpg",
          dataUrl: "data:image/jpeg;base64,site"
        }
      ]
    };

    const checklist = buildDailyChecklist(report);

    expect(checklist[0]).toMatchObject({
      id: "sitePhotos",
      completed: true,
      summary: "1 รูป"
    });
  });

  it("does not auto-complete carried-forward fields until the user confirms them", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      team: ["ภูมิใจ"]
    };
    const priorReport: DailyReport = {
      ...createEmptyDailyReport(project),
      id: "report-yesterday",
      reportDate: "2026-05-09",
      summary: "งานเดิมจากเมื่อวาน",
      completedWork: "เก็บงานสี",
      ongoingWork: "ติดตั้งสุขภัณฑ์",
      materials: "ปูนกาว",
      nextPlan: "ตรวจงาน",
      workers: [
        {
          id: "worker-1",
          name: "ทีมช่าง A",
          trade: "ทั่วไป",
          count: 2,
          startTime: "08:00",
          endTime: "17:00",
          taskTitle: "เก็บงาน",
          taskStatus: "ดำเนินการ",
          note: ""
        }
      ]
    };
    const carriedReport = createCarryForwardDailyReport(project, priorReport, "2026-05-10");

    const checklist = buildDailyChecklist(carriedReport);

    expect(checklist.find((item) => item.id === "summary")).toMatchObject({
      completed: false,
      summary: "งานเดิมจากเมื่อวาน"
    });
    expect(checklist.find((item) => item.id === "workers")).toMatchObject({
      completed: false,
      summary: "2 คน • 1 ทีม"
    });

    const confirmedReport = confirmDailyChecklistItems(carriedReport, ["summary", "workers"]);
    const confirmedChecklist = buildDailyChecklist(confirmedReport);

    expect(confirmedChecklist.find((item) => item.id === "summary")).toMatchObject({
      completed: true
    });
    expect(confirmedChecklist.find((item) => item.id === "workers")).toMatchObject({
      completed: true
    });
  });
});
