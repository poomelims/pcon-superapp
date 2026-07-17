import { describe, expect, test } from "vitest";

import { getMobileSectionMeta } from "@/lib/project-control/mobile-module-ui";

describe("mobile module section metadata", () => {
  test("uses empty, in-progress, and complete tones from real completion counts", () => {
    expect(getMobileSectionMeta({ id: "boq", number: 1, title: "BOQ", completed: 0, total: 3 })).toMatchObject({ tone: "empty", statusLabel: "0/3 ไม่สมบูรณ์" });
    expect(getMobileSectionMeta({ id: "boq", number: 1, title: "BOQ", completed: 2, total: 3 })).toMatchObject({ tone: "in-progress", statusLabel: "2/3 ไม่สมบูรณ์" });
    expect(getMobileSectionMeta({ id: "boq", number: 1, title: "BOQ", completed: 3, total: 3 })).toMatchObject({ tone: "complete", statusLabel: "3/3 เสร็จสมบูรณ์" });
  });

  test("clamps invalid counts and preserves identity fields", () => {
    expect(getMobileSectionMeta({ id: "expense", number: 4, title: "ค่าแรง", completed: 9, total: 3 })).toEqual({
      id: "expense",
      number: 4,
      title: "ค่าแรง",
      completed: 3,
      total: 3,
      tone: "complete",
      statusLabel: "3/3 เสร็จสมบูรณ์"
    });
  });
});
