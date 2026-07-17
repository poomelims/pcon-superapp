import { describe, expect, it } from "vitest";

import {
  getDailyReferenceSectionMeta,
  getDailyReferenceSections
} from "@/lib/project-control/daily-report-ui";

describe("reference workspace UI metadata", () => {
  it("keeps the six daily sections in the field-first order", () => {
    expect(getDailyReferenceSections()).toEqual([
      { id: "work", number: 1, title: "งานวันนี้" },
      { id: "site", number: 2, title: "คนและวัสดุ" },
      { id: "progress", number: 3, title: "ความคืบหน้า BOQ" },
      { id: "plan", number: 4, title: "แผนงานวันพรุ่งนี้" },
      { id: "problems", number: 5, title: "ปัญหาและอุปสรรค" },
      { id: "photos", number: 6, title: "รูปงานประจำวัน" }
    ]);
  });

  it("formats section progress for complete and incomplete states", () => {
    expect(getDailyReferenceSectionMeta("work", "complete", 3, 3)).toMatchObject({
      number: 1,
      title: "งานวันนี้",
      statusLabel: "3/3 เสร็จสมบูรณ์",
      tone: "complete"
    });
    expect(getDailyReferenceSectionMeta("site", "in-progress", 2, 3)).toMatchObject({
      number: 2,
      title: "คนและวัสดุ",
      statusLabel: "2/3 ไม่สมบูรณ์",
      tone: "in-progress"
    });
  });
});
