import { describe, expect, it } from "vitest";

import { createCanonicalDailyProgressUpdates, createDailyReportPdfSnapshot, fillMissingBoqProgressUpdates } from "@/lib/daily-report-progress";
import { calculateWeightedProgress } from "@/lib/project-calculations";
import { createEmptyDailyReport, createProject, type DailyProgressUpdate } from "@/lib/project-storage";

describe("daily report progress helpers", () => {
  it("creates one progress update for every BOQ item when a draft has none", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      boq: [
        {
          id: "cat-1",
          name: "งานโครงสร้าง",
          items: [
            { id: "item-1", description: "ฐานราก", quantity: 1, unit: "งาน", unitPrice: 100, progress: 40 },
            { id: "item-2", description: "เสา", quantity: 1, unit: "งาน", unitPrice: 100, progress: 60 }
          ]
        },
        {
          id: "cat-2",
          name: "งานสถาปัตย์",
          items: [{ id: "item-3", description: "ผนัง", quantity: 1, unit: "งาน", unitPrice: 100, progress: 10 }]
        }
      ]
    };
    const report = createEmptyDailyReport(project);

    const updates = fillMissingBoqProgressUpdates(project, report.progressUpdates);

    expect(updates).toHaveLength(3);
    expect(updates.map((update) => update.itemId)).toEqual(["item-1", "item-2", "item-3"]);
    expect(updates[0]).toMatchObject({
      categoryId: "cat-1",
      itemId: "item-1",
      title: "งานโครงสร้าง / ฐานราก",
      previousProgress: 40,
      newProgress: 40
    });
  });

  it("refreshes existing linked progress titles from current BOQ labels without changing entered values", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      boq: [
        {
          id: "cat-renamed",
          name: "งานสถาปัตย์",
          items: [
            { id: "item-renamed", description: "ผนังกั้นห้อง", quantity: 1, unit: "งาน", unitPrice: 100, progress: 40 },
            { id: "item-2", description: "เสา", quantity: 1, unit: "งาน", unitPrice: 100, progress: 60 }
          ]
        }
      ]
    };
    const existing = {
      id: "existing-update",
      categoryId: "cat-renamed",
      itemId: "item-renamed",
      title: "งานเดิม / รายการเดิม",
      previousProgress: 40,
      newProgress: 75,
      note: "keep me"
    };

    const updates = fillMissingBoqProgressUpdates(project, [existing]);

    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      id: "existing-update",
      categoryId: "cat-renamed",
      itemId: "item-renamed",
      title: "งานสถาปัตย์ / ผนังกั้นห้อง",
      previousProgress: 40,
      newProgress: 75,
      note: "keep me"
    });
    expect(updates.map((update) => update.itemId)).toEqual(["item-renamed", "item-2"]);
  });

  it("drops orphan progress updates so Daily Report only shows current BOQ items", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      boq: [
        {
          id: "cat-1",
          name: "งานโครงสร้าง",
          items: [{ id: "item-1", description: "ฐานราก", quantity: 1, unit: "งาน", unitPrice: 100, progress: 40 }]
        }
      ]
    };
    const orphan: DailyProgressUpdate = {
      id: "orphan-update",
      categoryId: "old-cat",
      itemId: "old-item",
      title: "หมวดเก่า / รายการเก่า",
      previousProgress: 10,
      newProgress: 80,
      note: "ยังต้องแสดงใน PDF"
    };

    const updates = fillMissingBoqProgressUpdates(project, [orphan]);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      categoryId: "cat-1",
      itemId: "item-1",
      title: "งานโครงสร้าง / ฐานราก"
    });
  });

  it("creates canonical BOQ progress rows from duplicated report updates and keeps the latest entered value", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      boq: [
        {
          id: "cat-1",
          name: "หมวดงาน",
          items: [
            { id: "item-1", description: "งานรื้อถอน", quantity: 1, unit: "งาน", unitPrice: 70000, progress: 90 },
            { id: "item-2", description: "งาน Protection", quantity: 1, unit: "งาน", unitPrice: 20000, progress: 90 },
            { id: "item-3", description: "งานก่อฉาบผนัง", quantity: 1, unit: "งาน", unitPrice: 50000, progress: 0 },
            { id: "item-4", description: "งานเดินท่อประปา", quantity: 1, unit: "งาน", unitPrice: 20000, progress: 0 }
          ]
        }
      ]
    };
    const duplicatedUpdates: DailyProgressUpdate[] = Array.from({ length: 7 }).flatMap((_, round) =>
      project.boq[0].items.map((item, itemIndex) => ({
        id: `update-${round}-${item.id}`,
        categoryId: "cat-1",
        itemId: item.id,
        title: `stale ${item.description}`,
        previousProgress: item.progress,
        newProgress: round === 6 && itemIndex === 2 ? 75 : item.progress,
        note: round === 6 && itemIndex === 2 ? "latest note" : ""
      }))
    );

    const updates = createCanonicalDailyProgressUpdates(project, duplicatedUpdates);

    expect(duplicatedUpdates).toHaveLength(28);
    expect(updates).toHaveLength(4);
    expect(updates.map((update) => update.itemId)).toEqual(["item-1", "item-2", "item-3", "item-4"]);
    expect(updates[2]).toMatchObject({
      itemId: "item-3",
      title: "หมวดงาน / งานก่อฉาบผนัง",
      previousProgress: 0,
      newProgress: 75,
      note: "latest note"
    });
  });

  it("uses the previous report new progress as today's previous progress", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      boq: [
        {
          id: "cat-1",
          name: "หมวดงาน",
          items: [
            { id: "item-1", description: "งานรื้อถอน", quantity: 1, unit: "งาน", unitPrice: 100, progress: 10 },
            { id: "item-2", description: "งาน Protection", quantity: 1, unit: "งาน", unitPrice: 100, progress: 20 }
          ]
        }
      ]
    };
    const previousReport = {
      ...createEmptyDailyReport(project),
      reportDate: "2026-05-23",
      progressUpdates: [
        {
          id: "previous-1",
          categoryId: "cat-1",
          itemId: "item-1",
          title: "old",
          previousProgress: 10,
          newProgress: 80,
          note: ""
        }
      ]
    };
    const currentUpdates: DailyProgressUpdate[] = [
      {
        id: "today-1",
        categoryId: "cat-1",
        itemId: "item-1",
        title: "today",
        previousProgress: 10,
        newProgress: 100,
        note: "done today"
      }
    ];

    const updates = createCanonicalDailyProgressUpdates(project, currentUpdates, previousReport);

    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      itemId: "item-1",
      previousProgress: 80,
      newProgress: 100,
      note: "done today"
    });
    expect(updates[1]).toMatchObject({
      itemId: "item-2",
      previousProgress: 20,
      newProgress: 20
    });
  });

  it("builds a PDF snapshot from the current draft progress before the report is saved", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      boq: [
        {
          id: "cat-1",
          name: "งานโครงสร้าง",
          items: [
            { id: "item-1", description: "ฐานราก", quantity: 1, unit: "งาน", unitPrice: 100, progress: 20 },
            { id: "item-2", description: "เสา", quantity: 1, unit: "งาน", unitPrice: 300, progress: 40 }
          ]
        }
      ]
    };
    const report = {
      ...createEmptyDailyReport(project),
      progressUpdates: [
        {
          id: "update-1",
          categoryId: "cat-1",
          itemId: "item-1",
          title: "stale title",
          previousProgress: 20,
          newProgress: 100,
          note: "เสร็จแล้ว"
        }
      ]
    };

    const snapshot = createDailyReportPdfSnapshot(project, report);

    expect(snapshot.report.progressUpdates[0]).toMatchObject({
      title: "งานโครงสร้าง / ฐานราก",
      newProgress: 100,
      note: "เสร็จแล้ว"
    });
    expect(calculateWeightedProgress(snapshot.project)).toBeCloseTo(55);
    expect(calculateWeightedProgress(project)).toBe(35);
  });

  it("builds a PDF snapshot with one row per BOQ item after duplicate cleanup", () => {
    const project = {
      ...createProject("company-1", "บ้านตัวอย่าง"),
      boq: [
        {
          id: "cat-1",
          name: "หมวดงาน",
          items: [
            { id: "item-1", description: "งานรื้อถอน", quantity: 1, unit: "งาน", unitPrice: 70000, progress: 90 },
            { id: "item-2", description: "งาน Protection", quantity: 1, unit: "งาน", unitPrice: 20000, progress: 90 },
            { id: "item-3", description: "งานก่อฉาบผนัง", quantity: 1, unit: "งาน", unitPrice: 50000, progress: 0 },
            { id: "item-4", description: "งานเดินท่อประปา", quantity: 1, unit: "งาน", unitPrice: 20000, progress: 0 }
          ]
        }
      ]
    };
    const report = {
      ...createEmptyDailyReport(project),
      progressUpdates: Array.from({ length: 7 }).flatMap((_, round) =>
        project.boq[0].items.map((item) => ({
          id: `update-${round}-${item.id}`,
          categoryId: "cat-1",
          itemId: item.id,
          title: "stale",
          previousProgress: item.progress,
          newProgress: round === 6 && item.id === "item-4" ? 100 : item.progress,
          note: ""
        }))
      )
    };

    const snapshot = createDailyReportPdfSnapshot(project, report);

    expect(snapshot.report.progressUpdates).toHaveLength(4);
    expect(snapshot.report.progressUpdates.map((update) => update.itemId)).toEqual(["item-1", "item-2", "item-3", "item-4"]);
    expect(snapshot.report.progressUpdates[3].newProgress).toBe(100);
    expect(calculateWeightedProgress(snapshot.project)).toBeCloseTo(63.125);
  });
});
