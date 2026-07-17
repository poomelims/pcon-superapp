import { type BuyinEntry, type Project } from "@/lib/project-storage";

export type BuyinVendorSummary = {
  vendorName: string;
  taxId: string;
  entryType: BuyinEntry["type"] | "mixed";
  itemCount: number;
  totalPaidAmount: number;
  totalNetAmount: number;
  totalVat7: number;
  firstEntryDate: string;
  lastEntryDate: string;
  entries: BuyinEntry[];
};

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateBuyinNetAmount(amountPaid: number, includeVat: boolean): number {
  const safeAmount = Math.max(0, Number.isFinite(amountPaid) ? amountPaid : 0);
  return includeVat ? roundMoney(safeAmount / 1.07) : roundMoney(safeAmount);
}

export function calculateBuyinVatAmount(amountPaid: number, includeVat: boolean): number {
  const safeAmount = Math.max(0, Number.isFinite(amountPaid) ? amountPaid : 0);
  return includeVat ? roundMoney(safeAmount - calculateBuyinNetAmount(safeAmount, true)) : 0;
}

export function sanitizeTaxId(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateTaxId(value: string): boolean {
  return sanitizeTaxId(value).length === 13;
}

export function getBuyinDisplayVendorName(entry: BuyinEntry): string {
  return entry.type === "invoice" ? entry.vendorName?.trim() || "ไม่ระบุผู้ขาย" : entry.storeName?.trim() || "ไม่ระบุร้านค้า";
}

export function getBuyinVendorKey(entry: BuyinEntry): string {
  const name = getBuyinDisplayVendorName(entry).toLowerCase();
  const taxId = entry.type === "invoice" ? sanitizeTaxId(entry.vendorTaxId ?? "") : "";
  return `${entry.type}:${taxId || name}`;
}

export function getCurrentMonthToTodayRange(currentDate: string): { startDate: string; endDate: string } {
  const endDate = currentDate.slice(0, 10);
  return {
    startDate: `${endDate.slice(0, 7)}-01`,
    endDate
  };
}

function getLastDateOfMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

export function getSelectedMonthExportDate(selectedMonth: string, currentDate: string): string {
  const safeMonth = /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : currentDate.slice(0, 7);
  const currentMonth = currentDate.slice(0, 7);

  if (safeMonth >= currentMonth) {
    return currentDate.slice(0, 10);
  }

  return getLastDateOfMonth(safeMonth);
}

export function getBuyinEntriesForExport(entries: BuyinEntry[], currentDate: string): BuyinEntry[] {
  const { startDate, endDate } = getCurrentMonthToTodayRange(currentDate);
  return entries
    .filter((entry) => entry.entryDate >= startDate && entry.entryDate <= endDate)
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
}

export function getBuyinEntriesForSelectedMonth(entries: BuyinEntry[], selectedMonth: string, currentDate: string): BuyinEntry[] {
  const safeMonth = /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : currentDate.slice(0, 7);
  const startDate = `${safeMonth}-01`;
  const endDate = getSelectedMonthExportDate(safeMonth, currentDate);

  return entries
    .filter((entry) => entry.entryDate >= startDate && entry.entryDate <= endDate)
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
}

export function groupBuyinByVendor(entries: BuyinEntry[]): BuyinVendorSummary[] {
  const groups = new Map<string, BuyinEntry[]>();

  for (const entry of entries) {
    const key = getBuyinVendorKey(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return Array.from(groups.values()).map((groupEntries) => {
    const sorted = [...groupEntries].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
    const entryTypes = new Set(groupEntries.map((entry) => entry.type));
    const firstInvoice = groupEntries.find((entry) => entry.type === "invoice" && entry.vendorTaxId);

    return {
      vendorName: getBuyinDisplayVendorName(groupEntries[0]),
      taxId: firstInvoice?.vendorTaxId ?? "",
      entryType: entryTypes.size === 1 ? groupEntries[0].type : "mixed",
      itemCount: groupEntries.length,
      totalPaidAmount: roundMoney(groupEntries.reduce((total, entry) => total + Math.max(0, entry.amountPaid), 0)),
      totalNetAmount: roundMoney(groupEntries.reduce((total, entry) => total + Math.max(0, entry.netAmount), 0)),
      totalVat7: roundMoney(groupEntries.reduce((total, entry) => total + Math.max(0, entry.vatAmount), 0)),
      firstEntryDate: sorted[0]?.entryDate ?? "",
      lastEntryDate: sorted[sorted.length - 1]?.entryDate ?? "",
      entries: groupEntries
    };
  });
}

export function sortBuyinVendorsByPaidAmount(groups: BuyinVendorSummary[]): BuyinVendorSummary[] {
  return [...groups].sort((a, b) => b.totalPaidAmount - a.totalPaidAmount || a.vendorName.localeCompare(b.vendorName));
}

export function calculateBuyinTotals(entries: BuyinEntry[]): { paidAmount: number; netAmount: number; vatAmount: number } {
  return {
    paidAmount: roundMoney(entries.reduce((total, entry) => total + Math.max(0, entry.amountPaid), 0)),
    netAmount: roundMoney(entries.reduce((total, entry) => total + Math.max(0, entry.netAmount), 0)),
    vatAmount: roundMoney(entries.reduce((total, entry) => total + Math.max(0, entry.vatAmount), 0))
  };
}

function escapeCsvCell(value: string | number): string {
  const normalized = typeof value === "number" ? String(value) : value;
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, "\"\"")}"` : normalized;
}

export function buildBuyinAccountingCsv(entries: BuyinEntry[], projects: Project[], currentDate: string): string {
  const rows = getBuyinEntriesForExport(entries, currentDate);
  const groups = sortBuyinVendorsByPaidAmount(groupBuyinByVendor(rows));
  const totals = calculateBuyinTotals(rows);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const csvRows: Array<Array<string | number>> = [
    ["SUMMARY_BY_VENDOR"],
    ["vendor_name", "tax_id", "entry_type", "item_count", "total_paid_amount", "total_net_amount", "total_vat_7", "first_entry_date", "last_entry_date"],
    ...groups.map((group) => [
      group.vendorName,
      group.taxId,
      group.entryType,
      group.itemCount,
      group.totalPaidAmount,
      group.totalNetAmount,
      group.totalVat7,
      group.firstEntryDate,
      group.lastEntryDate
    ]),
    ["TOTAL", "", "", rows.length, totals.paidAmount, totals.netAmount, totals.vatAmount, "", ""],
    [],
    ["DETAILS"],
    ["date", "entry_type", "vendor_or_store", "tax_id", "project_name", "description", "category", "paid_amount", "net_amount", "vat_7", "note"],
    ...rows.map((entry) => [
      entry.entryDate,
      entry.type,
      getBuyinDisplayVendorName(entry),
      entry.type === "invoice" ? entry.vendorTaxId ?? "" : "",
      entry.projectId ? projectNames.get(entry.projectId) ?? "Archived / unknown project" : "",
      entry.description ?? "",
      entry.category ?? "",
      entry.amountPaid,
      entry.netAmount,
      entry.vatAmount,
      entry.note ?? ""
    ]),
    ["TOTAL", "", "", "", "", "", "", totals.paidAmount, totals.netAmount, totals.vatAmount, ""]
  ];

  return `\uFEFF${csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}`;
}
