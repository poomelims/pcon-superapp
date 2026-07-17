import { describe, expect, it } from "vitest";

import {
  calculateAverageCostPerManDay,
  calculateCrewManDays,
  calculateLaborWithholdingAmounts,
  calculateNetCrewPayment,
  calculateWithholdingTax,
  getCompanyMonthlyHrSummary,
  getCrewMonthlySummary,
  maskNationalId
} from "@/lib/hr-calculations";
import { type Crew, type DailyReport, type LaborExpense } from "@/lib/project-storage";

const crew: Crew = {
  id: "crew-1",
  companyId: "company-1",
  leaderName: "ทีมคุณสมชาย",
  nationalId: "1101700234567",
  phone: "0812345678",
  workTypes: ["ไฟฟ้า", "ประปา"],
  note: "",
  status: "active",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
};

const expenses: LaborExpense[] = [
  {
    id: "expense-1",
    companyId: "company-1",
    crewId: "crew-1",
    projectId: "project-1",
    expenseDate: "2026-05-10",
    workType: "ไฟฟ้า",
    description: "ค่าแรงเดินสายไฟ",
    amount: 10000,
    note: "",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "expense-2",
    companyId: "company-1",
    crewId: "crew-1",
    projectId: "project-1",
    expenseDate: "2026-05-20",
    workType: "ประปา",
    description: "ค่าแรงประปา",
    amount: 5000,
    note: "",
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z"
  },
  {
    id: "expense-other-month",
    companyId: "company-1",
    crewId: "crew-1",
    expenseDate: "2026-04-20",
    description: "ค่าแรงเดือนก่อน",
    amount: 9000,
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z"
  }
];

const reports: DailyReport[] = [
  {
    id: "report-1",
    companyId: "company-1",
    projectId: "project-1",
    reportDate: "2026-05-10",
    preparedBy: "หัวหน้าไซต์",
    preparedByPhone: "",
    summary: "",
    workItems: [],
    completedWork: "",
    ongoingWork: "",
    problems: "ฝนตก",
    materials: "",
    nextPlan: "",
    customerNote: "",
    internalNote: "",
    workers: [
      {
        id: "worker-1",
        crewId: "crew-1",
        name: "ทีมคุณสมชาย",
        trade: "ไฟฟ้า",
        count: 4,
        startTime: "08:00",
        endTime: "17:00",
        taskTitle: "เดินสายไฟ",
        taskStatus: "ดำเนินการ",
        note: ""
      }
    ],
    progressUpdates: [],
    problemIssues: [],
    photos: [],
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "report-2",
    companyId: "company-1",
    projectId: "project-2",
    reportDate: "2026-05-11",
    preparedBy: "หัวหน้าไซต์",
    preparedByPhone: "",
    summary: "",
    workItems: [],
    completedWork: "",
    ongoingWork: "",
    problems: "",
    materials: "",
    nextPlan: "",
    customerNote: "",
    internalNote: "",
    workers: [
      {
        id: "worker-2",
        crewId: "crew-1",
        name: "ทีมคุณสมชาย",
        trade: "ประปา",
        count: 3,
        startTime: "08:00",
        endTime: "17:00",
        taskTitle: "วางท่อ",
        taskStatus: "เสร็จ",
        note: ""
      }
    ],
    progressUpdates: [],
    problemIssues: [],
    photos: [],
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z"
  }
];

describe("HR labor calculations and privacy helpers", () => {
  it("calculates withholding amounts from before-tax and after-tax HR labor inputs", () => {
    expect(calculateLaborWithholdingAmounts(2183, "after_withholding")).toEqual({
      grossAmount: 2250.52,
      withholdingTax: 67.52,
      netAmount: 2183
    });
    expect(calculateLaborWithholdingAmounts(2250, "before_withholding")).toEqual({
      grossAmount: 2250,
      withholdingTax: 67.5,
      netAmount: 2182.5
    });
  });

  it("calculates 3 percent withholding tax and net payment", () => {
    expect(calculateWithholdingTax(15000)).toBe(450);
    expect(calculateNetCrewPayment(15000)).toBe(14550);
    expect(calculateWithholdingTax(745.36)).toBe(22.36);
    expect(calculateNetCrewPayment(745.36)).toBe(723);
    expect(calculateWithholdingTax(0)).toBe(0);
    expect(calculateNetCrewPayment(0)).toBe(0);
  });

  it("calculates man-days and average cost per man-day for a selected month", () => {
    expect(calculateCrewManDays("crew-1", "2026-05", reports)).toBe(7);
    expect(calculateAverageCostPerManDay(15000, 7)).toBeCloseTo(2142.857);
    expect(calculateAverageCostPerManDay(15000, 0)).toBe(0);
  });

  it("builds monthly crew and company summaries from HR expenses and Daily Report manpower", () => {
    const summary = getCrewMonthlySummary(crew, "2026-05", expenses, reports);
    const companySummary = getCompanyMonthlyHrSummary("company-1", "2026-05", [crew], expenses, reports);

    expect(summary.monthlyPaid).toBe(15000);
    expect(summary.withholdingTax).toBe(450);
    expect(summary.netAmount).toBe(14550);
    expect(summary.manDays).toBe(7);
    expect(summary.projectCount).toBe(2);
    expect(summary.relatedReportCount).toBe(2);
    expect(summary.problemNoteCount).toBe(1);
    expect(companySummary.monthlyPaid).toBe(15000);
    expect(companySummary.totalManDays).toBe(7);
    expect(companySummary.mostUsedCrew?.crew.id).toBe("crew-1");
  });

  it("masks national IDs without exposing the full value in list-safe output", () => {
    const masked = maskNationalId("1101700234567");

    expect(masked).toBe("*********4567");
    expect(masked).not.toContain("1101700234567");
    expect(maskNationalId("")).toBe("ยังไม่ระบุ");
  });
});
