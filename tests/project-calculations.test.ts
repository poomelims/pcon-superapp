import { describe, expect, it } from "vitest";

import {
  applyProgressPreset,
  calculateCategoryProgress,
  calculateCategoryTotal,
  calculateItemTotal,
  calculateOverallBoqTotal,
  calculateWeightedProgress,
  clampProgress,
  formatCompactCurrency,
  formatCompactNumber
} from "@/lib/project-calculations";

import type { Project } from "@/lib/project-storage";

const project: Project = {
  id: "project-1",
  companyId: "company-1",
  name: "บ้านตัวอย่าง",
  status: "ดำเนินการ",
  owner: "เจ้าของบ้าน",
  team: [],
  note: "",
  coverImage: null,
  customer: {
    name: "คุณลูกค้า",
    phone: "",
    email: "",
    lineId: "",
    siteAddress: "",
    siteContact: ""
  },
  budget: {
    mainContract: 500000,
    variationOrder: 20000
  },
  timeline: {
    startDate: "2026-05-09",
    dueDate: "2026-08-09"
  },
  boq: [
    {
      id: "cat-1",
      name: "งานโครงสร้าง",
      items: [
        {
          id: "item-1",
          description: "ฐานราก",
          quantity: 10,
          unit: "ตร.ม.",
          unitPrice: 1000,
          progress: 50
        },
        {
          id: "item-2",
          description: "เสา",
          quantity: 5,
          unit: "ต้น",
          unitPrice: 2000,
          progress: 100
        }
      ]
    },
    {
      id: "cat-2",
      name: "งานสี",
      items: [
        {
          id: "item-3",
          description: "สีภายใน",
          quantity: 20,
          unit: "ตร.ม.",
          unitPrice: 500,
          progress: 0
        }
      ]
    }
  ],
  createdAt: "2026-05-09T00:00:00.000Z",
  updatedAt: "2026-05-09T00:00:00.000Z"
};

describe("project calculations", () => {
  it("calculates item, category, and overall BOQ totals", () => {
    expect(calculateItemTotal(project.boq[0].items[0])).toBe(10000);
    expect(calculateCategoryTotal(project.boq[0])).toBe(20000);
    expect(calculateOverallBoqTotal(project)).toBe(30000);
  });

  it("uses weighted progress instead of a simple average", () => {
    expect(calculateCategoryProgress(project.boq[0])).toBe(75);
    expect(calculateWeightedProgress(project)).toBe(50);
  });

  it("clamps progress and treats negative money inputs as zero", () => {
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(140)).toBe(100);
    expect(
      calculateItemTotal({
        id: "bad",
        description: "bad input",
        quantity: -4,
        unit: "งาน",
        unitPrice: -10,
        progress: 0
      })
    ).toBe(0);
  });

  it("applies progress presets through the same clamp rules", () => {
    expect(applyProgressPreset(0)).toBe(0);
    expect(applyProgressPreset(30)).toBe(30);
    expect(applyProgressPreset(60)).toBe(60);
    expect(applyProgressPreset(90)).toBe(90);
    expect(applyProgressPreset(100)).toBe(100);
    expect(applyProgressPreset(120)).toBe(100);
  });

  it("formats compact numbers and currency for narrow metric cards", () => {
    expect(formatCompactNumber(0)).toBe("0");
    expect(formatCompactNumber(1250)).toBe("1.25K");
    expect(formatCompactNumber(9_990_000)).toBe("9.99M");
    expect(formatCompactNumber(125_400_000)).toBe("125M");

    expect(formatCompactCurrency(52_000)).toBe("฿52,000");
    expect(formatCompactCurrency(9_998_990_001)).toBe("฿10B");
    expect(formatCompactCurrency(2_222_222_211)).toBe("฿2.22B");
  });
});
