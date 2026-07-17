import { describe, expect, it } from "vitest";

import {
  buildBuyinAccountingCsv,
  calculateBuyinNetAmount,
  calculateBuyinVatAmount,
  getBuyinEntriesForExport,
  getBuyinEntriesForSelectedMonth,
  getSelectedMonthExportDate,
  groupBuyinByVendor,
  sanitizeTaxId,
  sortBuyinVendorsByPaidAmount,
  validateTaxId
} from "@/lib/buyin-calculations";
import { type BuyinEntry } from "@/lib/project-storage";

function entry(overrides: Partial<BuyinEntry>): BuyinEntry {
  return {
    id: overrides.id ?? "buyin-1",
    companyId: overrides.companyId ?? "company-1",
    projectId: overrides.projectId,
    entryDate: overrides.entryDate ?? "2026-05-10",
    type: overrides.type ?? "expense",
    storeName: overrides.storeName,
    vendorName: overrides.vendorName,
    vendorTaxId: overrides.vendorTaxId,
    description: overrides.description ?? "",
    category: overrides.category ?? "",
    amountPaid: overrides.amountPaid ?? 0,
    includeVat: overrides.includeVat ?? false,
    netAmount: overrides.netAmount ?? overrides.amountPaid ?? 0,
    vatAmount: overrides.vatAmount ?? 0,
    note: overrides.note ?? "",
    createdAt: overrides.createdAt ?? "2026-05-10T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-05-10T00:00:00.000Z"
  };
}

describe("BUYIN accounting calculations", () => {
  it("calculates no VAT for expenses and VAT-inclusive split for vendor invoices", () => {
    expect(calculateBuyinNetAmount(1070, false)).toBe(1070);
    expect(calculateBuyinVatAmount(1070, false)).toBe(0);
    expect(calculateBuyinNetAmount(1070, true)).toBe(1000);
    expect(calculateBuyinVatAmount(1070, true)).toBe(70);
  });

  it("filters current month-to-date entries and excludes future or prior month rows", () => {
    const rows = [
      entry({ id: "old", entryDate: "2026-04-30", amountPaid: 100 }),
      entry({ id: "in", entryDate: "2026-05-01", amountPaid: 200 }),
      entry({ id: "today", entryDate: "2026-05-17", amountPaid: 300 }),
      entry({ id: "future", entryDate: "2026-05-18", amountPaid: 400 })
    ];

    expect(getBuyinEntriesForExport(rows, "2026-05-17").map((row) => row.id)).toEqual(["in", "today"]);
  });

  it("filters a selected historical month for downloadable archives", () => {
    const rows = [
      entry({ id: "march", entryDate: "2026-03-31", amountPaid: 100 }),
      entry({ id: "apr-start", entryDate: "2026-04-01", amountPaid: 200 }),
      entry({ id: "apr-end", entryDate: "2026-04-30", amountPaid: 300 }),
      entry({ id: "may", entryDate: "2026-05-01", amountPaid: 400 })
    ];

    expect(getSelectedMonthExportDate("2026-04", "2026-05-22")).toBe("2026-04-30");
    expect(getBuyinEntriesForSelectedMonth(rows, "2026-04", "2026-05-22").map((row) => row.id)).toEqual(["apr-start", "apr-end"]);
  });

  it("does not export future BUYIN rows when a future month is selected", () => {
    const rows = [
      entry({ id: "today", entryDate: "2026-05-22", amountPaid: 100 }),
      entry({ id: "future-this-month", entryDate: "2026-05-29", amountPaid: 200 }),
      entry({ id: "future-next-month", entryDate: "2026-06-01", amountPaid: 300 })
    ];

    expect(getSelectedMonthExportDate("2026-06", "2026-05-22")).toBe("2026-05-22");
    expect(getBuyinEntriesForSelectedMonth(rows, "2026-06", "2026-05-22")).toEqual([]);
    expect(getBuyinEntriesForSelectedMonth(rows, "2026-05", "2026-05-22").map((row) => row.id)).toEqual(["today"]);
  });

  it("groups by vendor or store and sorts by total paid descending", () => {
    const groups = sortBuyinVendorsByPaidAmount(
      groupBuyinByVendor([
        entry({ id: "a", storeName: "ร้าน A", amountPaid: 300, netAmount: 300 }),
        entry({ id: "b", type: "invoice", vendorName: "Vendor B", vendorTaxId: "1234567890123", amountPaid: 1070, netAmount: 1000, vatAmount: 70 }),
        entry({ id: "c", storeName: "ร้าน A", amountPaid: 250, netAmount: 250 })
      ])
    );

    expect(groups.map((group) => group.vendorName)).toEqual(["Vendor B", "ร้าน A"]);
    expect(groups[0].totalPaidAmount).toBe(1070);
    expect(groups[1].itemCount).toBe(2);
  });

  it("sanitizes tax ID and builds Excel-friendly accounting CSV", () => {
    const csv = buildBuyinAccountingCsv(
      [
        entry({ id: "a", storeName: "ร้านวัสดุ, หลัก", amountPaid: 500, netAmount: 500 }),
        entry({
          id: "b",
          type: "invoice",
          vendorName: "บริษัท \"ดี\"",
          vendorTaxId: "1-2345-67890-12-3",
          amountPaid: 1070,
          includeVat: true,
          netAmount: 1000,
          vatAmount: 70,
          description: "อุปกรณ์\nไฟฟ้า"
        })
      ],
      [],
      "2026-05-17"
    );

    expect(sanitizeTaxId("1-2345-67890-12-3")).toBe("1234567890123");
    expect(validateTaxId("1-2345-67890-12-3")).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("SUMMARY_BY_VENDOR");
    expect(csv).toContain("DETAILS");
    expect(csv).toContain("\"ร้านวัสดุ, หลัก\"");
    expect(csv).toContain("\"บริษัท \"\"ดี\"\"\"");
    expect(csv).toContain("\"อุปกรณ์\nไฟฟ้า\"");
    expect(csv).toContain("TOTAL");
    expect(csv).toContain("1570,1500,70");
  });
});
