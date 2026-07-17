export type HrExpenseCsvRow = {
  expenseDate: string;
  crewName: string;
  projectName: string;
  workType: string;
  description: string;
  amount: number;
  withholdingTax: number;
  netAmount: number;
};

function escapeCsvCell(value: string | number): string {
  const normalized = typeof value === "number" ? String(value) : value;

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }

  return normalized;
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function buildHrExpensesCsv(month: string, rows: HrExpenseCsvRow[]): string {
  const csvRows: Array<Array<string | number>> = [
    ["เดือนที่เลือก", month],
    ["วันที่", "ทีมช่าง / ผู้รับเงิน", "โปรเจกต์", "ประเภทงาน", "รายละเอียด", "ยอดก่อนหัก", "หัก ณ ที่จ่าย 3%", "ยอดจ่ายจริง"],
    ...rows.map((row) => [
      row.expenseDate,
      row.crewName,
      row.projectName || "-",
      row.workType || "-",
      row.description || "-",
      roundMoney(row.amount),
      roundMoney(row.withholdingTax),
      roundMoney(row.netAmount)
    ])
  ];

  return `\uFEFF${csvRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}`;
}
