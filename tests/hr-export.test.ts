import { describe, expect, it } from "vitest";

import { buildHrExpensesCsv } from "@/lib/hr-export";

describe("HR expense CSV export", () => {
  it("builds accountant-friendly CSV with BOM, plain numbers, and escaped Thai text", () => {
    const csv = buildHrExpensesCsv("2026-04", [
      {
        expenseDate: "2026-04-15",
        crewName: "ทีมช่าง A",
        projectName: "Athene Phase 1",
        workType: "ไฟฟ้า",
        description: "เดินสายไฟ, อาคารหลัก",
        amount: 15000,
        withholdingTax: 450,
        netAmount: 14550
      },
      {
        expenseDate: "2026-04-16",
        crewName: "ทีม \"B\"",
        projectName: "",
        workType: "ประปา",
        description: "งานแก้ไข\nเร่งด่วน",
        amount: 745.36,
        withholdingTax: 22.3608,
        netAmount: 722.9992
      }
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("เดือนที่เลือก,2026-04");
    expect(csv).toContain("วันที่,ทีมช่าง / ผู้รับเงิน,โปรเจกต์,ประเภทงาน,รายละเอียด,ยอดก่อนหัก,หัก ณ ที่จ่าย 3%,ยอดจ่ายจริง");
    expect(csv).toContain("\"เดินสายไฟ, อาคารหลัก\"");
    expect(csv).toContain("\"ทีม \"\"B\"\"\"");
    expect(csv).toContain("\"งานแก้ไข\nเร่งด่วน\"");
    expect(csv).toContain("15000,450,14550");
    expect(csv).toContain("745.36,22.36,723");
    expect(csv).not.toContain("22.3608");
    expect(csv).not.toContain("฿");
  });
});
