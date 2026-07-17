import { describe, expect, it } from "vitest";

import {
  normalizeDailyWorkItems,
  serializeDailyWorkItems,
  withDailyWorkItems
} from "@/lib/project-control/daily-work-items";
import { createEmptyDailyReport, createProject } from "@/lib/project-storage";
import { countCompletedWork } from "@/lib/project-control/dashboard-selectors";
import { buildDailyChecklist } from "@/lib/daily-report-checklist";

describe("daily work item compatibility", () => {
  it("migrates legacy completed and ongoing text into stable work items", () => {
    const items = normalizeDailyWorkItems({
      id: "report-1",
      completedWork: "ตั้งเสา\nเดินท่อ, เก็บพื้นที่",
      ongoingWork: "ฉาบผนัง; ตรวจระบบไฟ"
    });

    expect(items.map(({ title, status }) => ({ title, status }))).toEqual([
      { title: "ตั้งเสา", status: "completed" },
      { title: "เดินท่อ", status: "completed" },
      { title: "เก็บพื้นที่", status: "completed" },
      { title: "ฉาบผนัง", status: "ongoing" },
      { title: "ตรวจระบบไฟ", status: "ongoing" }
    ]);
    expect(items[0].id).toBe("report-1-work-completed-1");
  });

  it("treats workItems as authoritative when legacy strings conflict", () => {
    const items = normalizeDailyWorkItems({
      id: "report-2",
      completedWork: "ข้อความเก่า",
      ongoingWork: "ข้อความเก่า",
      workItems: [
        { id: "item-1", title: "งานใหม่", status: "completed" },
        { id: "item-2", title: "งานต่อเนื่อง", status: "ongoing" }
      ]
    });

    expect(items).toEqual([
      { id: "item-1", title: "งานใหม่", status: "completed" },
      { id: "item-2", title: "งานต่อเนื่อง", status: "ongoing" }
    ]);
  });

  it("serializes work items back to the legacy text fields", () => {
    expect(
      serializeDailyWorkItems([
        { id: "item-1", title: "ตั้งเสา", status: "completed" },
        { id: "item-2", title: "เดินท่อ", status: "completed" },
        { id: "item-3", title: "ฉาบผนัง", status: "ongoing" }
      ])
    ).toEqual({
      completedWork: "ตั้งเสา\nเดินท่อ",
      ongoingWork: "ฉาบผนัง"
    });
  });

  it("dual-writes normalized items and legacy fields onto a report", () => {
    const report = createEmptyDailyReport(createProject("company-1", "บ้านตัวอย่าง"));
    const next = withDailyWorkItems(report, [
      { id: "item-1", title: "ติดตั้งโครงคร่าว", status: "completed" },
      { id: "item-2", title: "ฉาบผนัง", status: "ongoing" }
    ]);

    expect(next.workItems).toHaveLength(2);
    expect(next.completedWork).toBe("ติดตั้งโครงคร่าว");
    expect(next.ongoingWork).toBe("ฉาบผนัง");
  });

  it("lets Dashboard and the daily checklist consume authoritative workItems", () => {
    const report = {
      ...createEmptyDailyReport(createProject("company-1", "บ้านตัวอย่าง")),
      completedWork: "ข้อความเก่าที่ไม่ควรถูกนับ",
      ongoingWork: "",
      workItems: [
        { id: "item-1", title: "ตั้งเสา", status: "completed" as const },
        { id: "item-2", title: "เดินท่อ", status: "completed" as const },
        { id: "item-3", title: "ฉาบผนัง", status: "ongoing" as const }
      ]
    };

    expect(countCompletedWork(report)).toBe(2);
    expect(buildDailyChecklist(report).find((item) => item.id === "ongoingWork")).toMatchObject({
      completed: true,
      summary: "ฉาบผนัง"
    });
  });
});
