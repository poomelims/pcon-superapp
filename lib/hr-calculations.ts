import { type Crew, type DailyReport, type LaborExpense } from "@/lib/project-storage";

export type LaborWithholdingMode = "before_withholding" | "after_withholding";

export type LaborWithholdingAmounts = {
  grossAmount: number;
  withholdingTax: number;
  netAmount: number;
};

export type CrewMonthlySummary = {
  crew: Crew;
  month: string;
  monthlyPaid: number;
  withholdingTax: number;
  netAmount: number;
  manDays: number;
  averageCostPerManDay: number;
  siteDays: number;
  projectCount: number;
  relatedReportCount: number;
  problemNoteCount: number;
};

export type CompanyMonthlyHrSummary = {
  companyId: string;
  month: string;
  registeredCrewCount: number;
  monthlyPaid: number;
  withholdingTax: number;
  netAmount: number;
  totalManDays: number;
  averageCostPerManDay: number;
  mostUsedCrew: CrewMonthlySummary | null;
  crewSummaries: CrewMonthlySummary[];
};

function monthMatches(dateValue: string, month: string): boolean {
  return dateValue.startsWith(`${month}-`);
}

function safeAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateMonthlyCrewPaid(crewId: string, month: string, expenses: LaborExpense[]): number {
  return expenses
    .filter((expense) => expense.crewId === crewId && monthMatches(expense.expenseDate, month))
    .reduce((total, expense) => total + safeAmount(expense.amount), 0);
}

export function calculateWithholdingTax(monthlyPaid: number): number {
  return calculateLaborWithholdingAmounts(monthlyPaid, "before_withholding").withholdingTax;
}

export function calculateNetCrewPayment(monthlyPaid: number): number {
  return calculateLaborWithholdingAmounts(monthlyPaid, "before_withholding").netAmount;
}

export function calculateLaborWithholdingAmounts(amount: number, mode: LaborWithholdingMode): LaborWithholdingAmounts {
  const safeInput = safeAmount(amount);

  if (safeInput <= 0) {
    return {
      grossAmount: 0,
      withholdingTax: 0,
      netAmount: 0
    };
  }

  if (mode === "after_withholding") {
    const netAmount = roundMoney(safeInput);
    const withholdingTax = roundMoney((netAmount / 97) * 3);
    return {
      grossAmount: roundMoney(netAmount + withholdingTax),
      withholdingTax,
      netAmount
    };
  }

  const grossAmount = roundMoney(safeInput);
  const withholdingTax = roundMoney((grossAmount / 100) * 3);
  return {
    grossAmount,
    withholdingTax,
    netAmount: roundMoney(grossAmount - withholdingTax)
  };
}

export function calculateCrewManDays(crewId: string, month: string, reports: DailyReport[]): number {
  return reports
    .filter((report) => monthMatches(report.reportDate, month))
    .flatMap((report) => report.workers)
    .filter((worker) => worker.crewId === crewId)
    .reduce((total, worker) => total + Math.max(0, worker.count), 0);
}

export function calculateAverageCostPerManDay(monthlyPaid: number, manDays: number): number {
  if (manDays <= 0) {
    return 0;
  }

  return monthlyPaid / manDays;
}

export function getCrewMonthlySummary(
  crew: Crew,
  month: string,
  expenses: LaborExpense[],
  reports: DailyReport[]
): CrewMonthlySummary {
  const crewReports = reports.filter(
    (report) => monthMatches(report.reportDate, month) && report.workers.some((worker) => worker.crewId === crew.id)
  );
  const relatedProjectIds = new Set<string>();
  let problemNoteCount = 0;

  for (const report of crewReports) {
    relatedProjectIds.add(report.projectId);
    if (report.problems.trim() || report.problemIssues.length > 0) {
      problemNoteCount += 1;
    }
  }

  const monthlyPaid = calculateMonthlyCrewPaid(crew.id, month, expenses);
  const manDays = calculateCrewManDays(crew.id, month, reports);

  return {
    crew,
    month,
    monthlyPaid,
    withholdingTax: calculateWithholdingTax(monthlyPaid),
    netAmount: calculateNetCrewPayment(monthlyPaid),
    manDays,
    averageCostPerManDay: calculateAverageCostPerManDay(monthlyPaid, manDays),
    siteDays: new Set(crewReports.map((report) => report.reportDate)).size,
    projectCount: relatedProjectIds.size,
    relatedReportCount: crewReports.length,
    problemNoteCount
  };
}

export function getCompanyMonthlyHrSummary(
  companyId: string,
  month: string,
  crews: Crew[],
  expenses: LaborExpense[],
  reports: DailyReport[]
): CompanyMonthlyHrSummary {
  const companyCrews = crews.filter((crew) => crew.companyId === companyId);
  const companyReports = reports.filter((report) => report.companyId === companyId);
  const companyExpenses = expenses.filter((expense) => expense.companyId === companyId);
  const crewSummaries = companyCrews.map((crew) => getCrewMonthlySummary(crew, month, companyExpenses, companyReports));
  const monthlyPaid = crewSummaries.reduce((total, summary) => total + summary.monthlyPaid, 0);
  const totalManDays = crewSummaries.reduce((total, summary) => total + summary.manDays, 0);
  const mostUsedCrew =
    crewSummaries
      .filter((summary) => summary.manDays > 0 || summary.siteDays > 0)
      .sort((a, b) => b.manDays - a.manDays || b.siteDays - a.siteDays)[0] ?? null;

  return {
    companyId,
    month,
    registeredCrewCount: companyCrews.length,
    monthlyPaid,
    withholdingTax: calculateWithholdingTax(monthlyPaid),
    netAmount: calculateNetCrewPayment(monthlyPaid),
    totalManDays,
    averageCostPerManDay: calculateAverageCostPerManDay(monthlyPaid, totalManDays),
    mostUsedCrew,
    crewSummaries
  };
}

export function maskNationalId(nationalId: string): string {
  const digits = nationalId.replace(/\D/g, "");

  if (!digits) {
    return "ยังไม่ระบุ";
  }

  const visibleTail = digits.slice(-4);
  return `${"*".repeat(Math.max(0, digits.length - visibleTail.length))}${visibleTail}`;
}
