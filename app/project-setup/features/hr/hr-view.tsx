"use client";

import { type FormEvent, useState } from "react";
import {
  calculateLaborWithholdingAmounts,
  getCompanyMonthlyHrSummary,
  getCrewMonthlySummary,
  maskNationalId,
  type CrewMonthlySummary,
  type LaborWithholdingMode
} from "@/lib/hr-calculations";
import { buildHrExpensesCsv } from "@/lib/hr-export";
import { nonNegativeNumber } from "@/lib/project-calculations";
import {
  createCrew,
  createLaborExpense,
  todayString,
  type Crew,
  type LaborExpense,
  type ProjectControlData
} from "@/lib/project-storage";
import { sortWithCompare } from "@/lib/runtime-compat";
import { sortProjectsForDisplay } from "@/lib/project-sorting";
import { getMobileSectionMeta } from "@/lib/project-control/mobile-module-ui";
import { Button, Card, Field, SectionHeader, Select, TextArea, TextInput } from "../shared/ui";
import { MobileCompactRow, MobileContextActionBar, MobileEmptyState, MobileModuleHeader, MobileNumberedSection, MobileSummaryStrip } from "../shared/mobile-module-ui";
import { DesktopActionBar, DesktopModuleHeader, DesktopSummaryStrip } from "../shared/desktop-module-ui";
import { numberFromInput, tradeOptions, type WorkspaceNotice as Notice } from "../shared/utils";

function currentMonthString(now = new Date()): string {
  return todayString(now).slice(0, 7);
}

function sortCrewsForDisplay(crews: Crew[]): Crew[] {
  return sortWithCompare(crews, (a, b) => {
    const statusDiff = (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1);
    return statusDiff || (a.leaderName || "").localeCompare(b.leaderName || "", "th") || b.updatedAt.localeCompare(a.updatedAt);
  });
}

function formatHrCurrency(value: number): string {
  const safeValue = nonNegativeNumber(value);
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: Number.isInteger(safeValue) ? 0 : 2, maximumFractionDigits: 2 }).format(safeValue);
}
export function HrView({
  data,
  activeCompanyId,
  activeProjectId,
  selectedMonth,
  setSelectedMonth,
  setNotice,
  saveCrew,
  deleteCrew,
  saveLaborExpense,
  deleteLaborExpense,
  isSyncingCloud,
  openDailyReport
}: {
  data: ProjectControlData;
  activeCompanyId: string;
  activeProjectId: string;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  setNotice: (notice: Notice) => void;
  saveCrew: (crew: Crew) => boolean;
  deleteCrew: (crewId: string) => void;
  saveLaborExpense: (expense: LaborExpense) => boolean;
  deleteLaborExpense: (expenseId: string) => void;
  isSyncingCloud: boolean;
  openDailyReport: () => void;
}) {
  const companyCrews = sortCrewsForDisplay(data.crews.filter((crew) => crew.companyId === activeCompanyId));
  const companyExpenses = data.laborExpenses.filter((expense) => expense.companyId === activeCompanyId);
  const companyReports = data.dailyReports.filter((report) => report.companyId === activeCompanyId);
  const projects = sortProjectsForDisplay(
    data.projects.filter((project) => project.companyId === activeCompanyId),
    todayString()
  );
  const summary = getCompanyMonthlyHrSummary(activeCompanyId, selectedMonth, companyCrews, companyExpenses, companyReports);
  const todayManpower = companyReports
    .filter((report) => report.reportDate === todayString())
    .reduce((total, report) => total + report.workers.reduce((workerTotal, worker) => workerTotal + Math.max(0, worker.count), 0), 0);
  const monthExpenses = companyExpenses
    .filter((expense) => expense.expenseDate.startsWith(`${selectedMonth}-`))
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const [crewForm, setCrewForm] = useState<Crew>(() => createCrew(activeCompanyId, { workTypes: ["ทั่วไป"] }));
  const [expenseForm, setExpenseForm] = useState<LaborExpense>(() =>
    createLaborExpense(activeCompanyId, {
      crewId: companyCrews[0]?.id ?? "",
      projectId: activeProjectId || undefined,
      expenseDate: todayString(),
      workType: companyCrews[0]?.workTypes[0] ?? "ทั่วไป"
    })
  );
  const [expenseAmountInput, setExpenseAmountInput] = useState(0);
  const [expenseWithholdingMode, setExpenseWithholdingMode] = useState<LaborWithholdingMode>("before_withholding");
  const [customWorkType, setCustomWorkType] = useState("");
  const [revealedCrewId, setRevealedCrewId] = useState<string | null>(null);
  const [activeMobileSection, setActiveMobileSection] = useState("hr-expense");
  const [mobileFeedback, setMobileFeedback] = useState<{ tone: "success" | "error"; label: string } | null>(null);
  const expenseWithholdingPreview = calculateLaborWithholdingAmounts(expenseAmountInput, expenseWithholdingMode);

  function resetCrewForm() {
    setCrewForm(createCrew(activeCompanyId, { workTypes: ["ทั่วไป"] }));
    setCustomWorkType("");
  }

  function resetExpenseForm(nextCrewId = companyCrews[0]?.id ?? "") {
    const nextCrew = companyCrews.find((crew) => crew.id === nextCrewId);
    setExpenseForm(
      createLaborExpense(activeCompanyId, {
        crewId: nextCrewId,
        projectId: activeProjectId || undefined,
        expenseDate: todayString(),
        workType: nextCrew?.workTypes[0] ?? "ทั่วไป"
      })
    );
    setExpenseAmountInput(0);
  }

  function toggleCrewWorkType(workType: string) {
    setCrewForm((current) => {
      const exists = current.workTypes.includes(workType);
      return {
        ...current,
        workTypes: exists ? current.workTypes.filter((entry) => entry !== workType) : [...current.workTypes, workType]
      };
    });
  }

  function commitCrew() {
    const saved = saveCrew(crewForm);
    setMobileFeedback(saved ? { tone: "success", label: "บันทึกทีมช่างแล้ว" } : { tone: "error", label: "กรอกข้อมูลทีมช่างให้ครบ" });
    if (saved) resetCrewForm();
    return saved;
  }

  function submitCrew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitCrew();
  }

  function commitExpense() {
    if (expenseAmountInput < 0) {
      const saved = saveLaborExpense({ ...expenseForm, amount: expenseAmountInput });
      setMobileFeedback({ tone: "error", label: "ยอดจ่ายต้องไม่ติดลบ" });
      return saved;
    }

    const nextExpense = {
      ...expenseForm,
      amount: expenseWithholdingPreview.grossAmount
    };

    if (!nextExpense.expenseDate.trim() || !nextExpense.crewId.trim() || nextExpense.amount < 0) {
      const saved = saveLaborExpense(nextExpense);
      setMobileFeedback({ tone: "error", label: "กรอกข้อมูลค่าแรงให้ครบ" });
      return saved;
    }

    const saved = saveLaborExpense(nextExpense);
    setMobileFeedback(saved ? { tone: "success", label: "บันทึกค่าแรงแล้ว" } : { tone: "error", label: "บันทึกค่าแรงไม่สำเร็จ" });
    if (saved) resetExpenseForm(nextExpense.crewId);
    return saved;
  }

  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitExpense();
  }

  function summaryForCrew(crew: Crew): CrewMonthlySummary {
    return getCrewMonthlySummary(crew, selectedMonth, companyExpenses, companyReports);
  }

  function scrollToHrSection(sectionId: "hr-daily-expense-entry" | "hr-month-expense-table") {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function editLaborExpense(expense: LaborExpense) {
    setExpenseForm(expense);
    setExpenseAmountInput(expense.amount);
    setExpenseWithholdingMode("before_withholding");
  }

  function handleExportHrExpensesCsv() {
    if (monthExpenses.length === 0) {
      setNotice({ type: "error", text: "ไม่มีข้อมูลรายจ่ายของเดือนนี้สำหรับ export" });
      return;
    }

    const csv = buildHrExpensesCsv(
      selectedMonth,
      monthExpenses.map((expense) => {
        const crew = companyCrews.find((entry) => entry.id === expense.crewId);
        const project = projects.find((entry) => entry.id === expense.projectId);
        const amounts = calculateLaborWithholdingAmounts(expense.amount, "before_withholding");

        return {
          expenseDate: expense.expenseDate,
          crewName: crew?.leaderName ?? "ไม่พบทีม",
          projectName: project?.name ?? "-",
          workType: expense.workType || "-",
          description: expense.description || "-",
          amount: amounts.grossAmount,
          withholdingTax: amounts.withholdingTax,
          netAmount: amounts.netAmount
        };
      })
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pcon-hr-expenses-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ type: "success", text: "Export CSV รายจ่ายแรงงานสำเร็จ" });
  }

  const mobileSections = {
    expense: getMobileSectionMeta({ id: "hr-expense", number: 1, title: "บันทึกค่าแรง", completed: [Boolean(expenseForm.expenseDate), Boolean(expenseForm.crewId), expenseAmountInput > 0].filter(Boolean).length, total: 3 }),
    crew: getMobileSectionMeta({ id: "hr-crew", number: 2, title: "ทีมช่าง", completed: [Boolean(crewForm.leaderName.trim()), Boolean(crewForm.nationalId.trim()), crewForm.workTypes.length > 0].filter(Boolean).length, total: 3 }),
    history: getMobileSectionMeta({ id: "hr-history", number: 3, title: "รายการค่าแรงเดือนนี้", completed: monthExpenses.length > 0 ? 1 : 0, total: 1 }),
    performance: getMobileSectionMeta({ id: "hr-performance", number: 4, title: "ประสิทธิภาพทีม", completed: summary.crewSummaries.length > 0 ? 1 : 0, total: 1 })
  };
  const activeCrewCount = companyCrews.filter((crew) => crew.status === "active").length;
  const mobileActionIsExpense = activeMobileSection === mobileSections.expense.id;
  const mobileActionIsCrew = activeMobileSection === mobileSections.crew.id;
  const mobileActionLabel = mobileActionIsExpense ? "บันทึกค่าแรง" : mobileActionIsCrew ? "บันทึกทีมช่าง" : "+ บันทึกค่าแรง";
  function runMobileHrAction() {
    setMobileFeedback(null);
    if (mobileActionIsExpense) return commitExpense();
    if (mobileActionIsCrew) return commitCrew();
    setActiveMobileSection(mobileSections.expense.id);
    queueMicrotask(() => document.querySelector<HTMLInputElement>("[data-mobile-hr-expense-date]")?.focus());
  }

  return (
    <>
    <div data-mobile-hr-layout className="grid gap-3 pb-32 md:hidden">
      <h2 className="sr-only">ทะเบียนทีมช่างและค่าแรง</h2>
      <MobileModuleHeader title="HR / ทีมช่าง" context={new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01T12:00:00+07:00`))} detail="ทีมช่างและค่าแรง" action={<TextInput aria-label="เดือนที่ต้องการดู" type="month" value={selectedMonth} max={currentMonthString()} onChange={(event) => setSelectedMonth(event.target.value || currentMonthString())} className="w-[122px] px-2 text-xs" />} />
      <MobileSummaryStrip items={[
        { label: "ทีมช่าง Active", value: String(activeCrewCount) },
        { label: "คนเข้าไซต์วันนี้", value: String(todayManpower), tone: "amber" },
        { label: "ค่าแรงสุทธิเดือนนี้", value: formatHrCurrency(summary.netAmount), tone: "slate" }
      ]} />
      <div className="grid gap-3">
        <MobileNumberedSection meta={mobileSections.expense} expanded={activeMobileSection === mobileSections.expense.id} onToggle={() => setActiveMobileSection(mobileSections.expense.id)}>
          <form className="grid gap-3 bg-emerald-50/30 p-3" onSubmit={submitExpense}>
            <Field label="วันที่จ่าย"><TextInput data-mobile-hr-expense-date type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm((current) => ({ ...current, expenseDate: event.target.value }))} /></Field>
            <Field label="ทีมช่าง / หัวหน้าทีม"><Select value={expenseForm.crewId} onChange={(event) => { const crewId = event.target.value; const crew = companyCrews.find((entry) => entry.id === crewId); setExpenseForm((current) => ({ ...current, crewId, workType: crew?.workTypes[0] ?? current.workType })); }}><option value="">เลือกทีมช่าง</option>{companyCrews.map((crew) => <option key={crew.id} value={crew.id}>{crew.leaderName}</option>)}</Select></Field>
            <Field label="โปรเจกต์"><Select value={expenseForm.projectId ?? ""} onChange={(event) => setExpenseForm((current) => ({ ...current, projectId: event.target.value || undefined }))}><option value="">ไม่ระบุโปรเจกต์</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field>
            <Field label="ประเภทงาน"><Select value={expenseForm.workType} onChange={(event) => setExpenseForm((current) => ({ ...current, workType: event.target.value }))}>{Array.from(new Set([...tradeOptions, expenseForm.workType].filter(Boolean))).map((trade) => <option key={trade}>{trade}</option>)}</Select></Field>
            <Field label="ยอดจ่าย"><TextInput type="number" min={0} value={expenseAmountInput} onChange={(event) => setExpenseAmountInput(numberFromInput(event.target.value))} /></Field>
            <Field label="รายละเอียด"><TextInput value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} /></Field>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-emerald-100 bg-white p-3 text-center text-xs"><div><p className="text-slate-400">ก่อนหัก</p><p className="font-black">{formatHrCurrency(expenseWithholdingPreview.grossAmount)}</p></div><div><p className="text-slate-400">หัก 3%</p><p className="font-black text-amber-600">{formatHrCurrency(expenseWithholdingPreview.withholdingTax)}</p></div><div><p className="text-slate-400">สุทธิ</p><p className="font-black text-emerald-700">{formatHrCurrency(expenseWithholdingPreview.netAmount)}</p></div></div>
          </form>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.crew} expanded={activeMobileSection === mobileSections.crew.id} onToggle={() => setActiveMobileSection(mobileSections.crew.id)}>
          <div className="grid gap-3 p-3">
            <form className="grid gap-3" onSubmit={submitCrew}><Field label="ชื่อหัวหน้าทีม / ผู้รับเงิน"><TextInput value={crewForm.leaderName} onChange={(event) => setCrewForm((current) => ({ ...current, leaderName: event.target.value }))} /></Field><Field label="เลขบัตรประชาชน"><TextInput value={crewForm.nationalId} onChange={(event) => setCrewForm((current) => ({ ...current, nationalId: event.target.value }))} /></Field><Field label="เบอร์โทร"><TextInput value={crewForm.phone} onChange={(event) => setCrewForm((current) => ({ ...current, phone: event.target.value }))} /></Field><Field label="สถานะ"><Select value={crewForm.status} onChange={(event) => setCrewForm((current) => ({ ...current, status: event.target.value as Crew["status"] }))}><option value="active">active</option><option value="inactive">inactive</option></Select></Field><div><p className="mb-2 text-sm font-semibold text-slate-600">ประเภทงาน</p><div className="flex flex-wrap gap-2">{tradeOptions.map((trade) => <button key={trade} type="button" className={`min-h-10 rounded-full border px-3 text-xs font-bold ${crewForm.workTypes.includes(trade) ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600"}`} onClick={() => toggleCrewWorkType(trade)}>{trade}</button>)}</div></div><Field label="หมายเหตุ"><TextArea value={crewForm.note} onChange={(event) => setCrewForm((current) => ({ ...current, note: event.target.value }))} /></Field></form>
            <div className="grid gap-2">{companyCrews.length > 0 ? companyCrews.map((crew) => <MobileCompactRow key={crew.id} title={crew.leaderName} detail={crew.workTypes.join(", ") || "ทั่วไป"} value={crew.status} onClick={() => setCrewForm(crew)} />) : <MobileEmptyState>ยังไม่มีทีมช่าง</MobileEmptyState>}</div>
          </div>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.history} expanded={activeMobileSection === mobileSections.history.id} onToggle={() => setActiveMobileSection(mobileSections.history.id)}>
          <div className="grid gap-2 p-3">{monthExpenses.length > 0 ? monthExpenses.map((expense) => <MobileCompactRow key={expense.id} title={companyCrews.find((crew) => crew.id === expense.crewId)?.leaderName || "ไม่พบทีม"} detail={`${expense.expenseDate} · ${expense.description || expense.workType || "ค่าแรง"}`} value={formatHrCurrency(expense.amount)} onClick={() => editLaborExpense(expense)} />) : <MobileEmptyState>ยังไม่มีรายจ่ายแรงงานของเดือนที่เลือก</MobileEmptyState>}<Button variant="secondary" onClick={handleExportHrExpensesCsv}>Export CSV</Button></div>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.performance} expanded={activeMobileSection === mobileSections.performance.id} onToggle={() => setActiveMobileSection(mobileSections.performance.id)}>
          <div className="grid gap-2 p-3">{summary.crewSummaries.length > 0 ? summary.crewSummaries.map((crewSummary) => <MobileCompactRow key={crewSummary.crew.id} title={crewSummary.crew.leaderName} detail={`เข้าไซต์ ${crewSummary.siteDays} วัน · ${crewSummary.manDays} man-day`} value={formatHrCurrency(crewSummary.averageCostPerManDay)} />) : <MobileEmptyState>ยังไม่มีข้อมูลประสิทธิภาพทีม</MobileEmptyState>}</div>
        </MobileNumberedSection>
      </div>
      <MobileContextActionBar label={mobileActionLabel} feedback={mobileFeedback} onClick={runMobileHrAction} />
    </div>
    <div className="hidden md:block">
    <div data-hr-module="phase-hr-1" className="grid w-full max-w-full min-w-0 gap-5 pb-24 lg:pb-0">
      <DesktopModuleHeader
        title="ทะเบียนทีมช่างและค่าแรง"
        context={`HR / ทีมช่าง · ${new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01T12:00:00+07:00`))}`}
        detail="เก็บผู้รับเงิน เลขบัตร และรายจ่ายแรงงานแยกจาก Daily Report"
        action={<TextInput aria-label="เดือนที่ต้องการดู" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value || currentMonthString())} className="w-[150px]" />}
        attribute="data-hr-desktop-summary"
      />
      <DesktopSummaryStrip items={[
        { label: "ทีมช่างที่ Active", value: `${activeCrewCount} ทีม`, hint: `${summary.registeredCrewCount} ทีมที่ลงทะเบียน` },
        { label: "แรงงานวันนี้", value: `${todayManpower} คน`, hint: "ดึงจาก Daily Report วันนี้", tone: "amber" },
        { label: "ค่าแรงสุทธิเดือนนี้", value: formatHrCurrency(summary.netAmount), hint: `ก่อนหัก ${formatHrCurrency(summary.monthlyPaid)}`, tone: "slate" }
      ]} />
      <DesktopActionBar attribute="data-hr-desktop-action-bar">
        <Button variant="secondary" onClick={openDailyReport}>เปิด Daily Report</Button>
        <Button variant="secondary" onClick={() => scrollToHrSection("hr-daily-expense-entry")}>บันทึกรายจ่ายแรงงาน</Button>
        <Button variant="secondary" onClick={() => scrollToHrSection("hr-month-expense-table")}>ดูรายจ่ายเดือนนี้</Button>
        <Button variant="secondary" onClick={handleExportHrExpensesCsv}>Export CSV</Button>
      </DesktopActionBar>

      <div className="grid w-full max-w-full min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="min-w-0">
          <SectionHeader eyebrow="Crew Registry" title="ทะเบียนหัวหน้าทีม / ผู้รับเงิน" />
          {companyCrews.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-emerald-200 bg-emerald-50/70 p-5">
              <h3 className="text-lg font-black text-slate-950">ยังไม่มีทีมช่าง</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                เพิ่มหัวหน้าทีมช่างคนแรก เพื่อใช้เลือกใน Daily Report และติดตามค่าใช้จ่ายรายเดือน
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {companyCrews.map((crew) => {
                const crewSummary = summaryForCrew(crew);
                return (
                  <div key={crew.id} className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-base font-black text-slate-950">{crew.leaderName || "ยังไม่ระบุชื่อ"}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          เลขบัตร: {revealedCrewId === crew.id ? crew.nationalId || "ยังไม่ระบุ" : maskNationalId(crew.nationalId)}
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-slate-500">
                          โทร: {crew.phone?.trim() || "ยังไม่ระบุ"}
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-500">{crew.workTypes.join(", ") || "ยังไม่ระบุประเภทงาน"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-2 text-xs font-black ${crew.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {crew.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                      <span className="rounded-2xl bg-slate-50 px-3 py-2">เข้าไซต์ {crewSummary.siteDays} วัน</span>
                      <span className="rounded-2xl bg-slate-50 px-3 py-2">{crewSummary.manDays} man-day</span>
                      <span className="rounded-2xl bg-slate-50 px-3 py-2">{formatHrCurrency(crewSummary.monthlyPaid)}</span>
                      <span className="rounded-2xl bg-slate-50 px-3 py-2">{formatHrCurrency(crewSummary.averageCostPerManDay)}/man-day</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => setCrewForm(crew)}>
                        แก้ไข
                      </Button>
                      <Button variant="ghost" onClick={() => setRevealedCrewId(revealedCrewId === crew.id ? null : crew.id)}>
                        {revealedCrewId === crew.id ? "ซ่อนเลขบัตร" : "ดูเลขบัตร"}
                      </Button>
                      <Button variant="danger" onClick={() => deleteCrew(crew.id)}>
                        ลบทีม
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <SectionHeader eyebrow="Crew Form" title={companyCrews.some((crew) => crew.id === crewForm.id) ? "แก้ไขทีมช่าง" : "เพิ่มทีมช่าง"} />
          <form className="mt-4 grid gap-3" onSubmit={submitCrew}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="ชื่อหัวหน้าทีม / ผู้รับเงิน">
                <TextInput value={crewForm.leaderName} onChange={(event) => setCrewForm({ ...crewForm, leaderName: event.target.value })} />
              </Field>
              <Field label="เลขบัตรประชาชน">
                <TextInput value={crewForm.nationalId} onChange={(event) => setCrewForm({ ...crewForm, nationalId: event.target.value })} />
              </Field>
              <Field label="เบอร์โทร">
                <TextInput value={crewForm.phone ?? ""} onChange={(event) => setCrewForm({ ...crewForm, phone: event.target.value })} />
              </Field>
              <Field label="สถานะ">
                <Select value={crewForm.status} onChange={(event) => setCrewForm({ ...crewForm, status: event.target.value === "inactive" ? "inactive" : "active" })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </Select>
              </Field>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">ประเภทงานที่ทำได้</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tradeOptions.map((workType) => (
                  <button
                    key={workType}
                    type="button"
                    className={`min-h-10 rounded-full border px-3 text-xs font-black ${
                      crewForm.workTypes.includes(workType) ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700"
                    }`}
                    onClick={() => toggleCrewWorkType(workType)}
                  >
                    {workType}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <TextInput value={customWorkType} placeholder="เพิ่มประเภทงานเอง" onChange={(event) => setCustomWorkType(event.target.value)} />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const nextWorkType = customWorkType.trim();
                    if (nextWorkType) {
                      setCrewForm({ ...crewForm, workTypes: Array.from(new Set([...crewForm.workTypes, nextWorkType])) });
                      setCustomWorkType("");
                    }
                  }}
                >
                  + เพิ่มประเภทงาน
                </Button>
              </div>
            </div>
            <Field label="หมายเหตุ">
              <TextArea value={crewForm.note ?? ""} onChange={(event) => setCrewForm({ ...crewForm, note: event.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSyncingCloud}>
                {isSyncingCloud ? "กำลัง Sync Cloud..." : companyCrews.some((crew) => crew.id === crewForm.id) ? "อัปเดตข้อมูลทีมช่าง" : "+ เพิ่มทีมช่าง"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetCrewForm}>ล้างฟอร์ม</Button>
            </div>
          </form>
        </Card>
      </div>

      <div id="hr-daily-expense-entry" className="min-w-0 scroll-mt-24">
        <Card className="min-w-0">
          <SectionHeader eyebrow="Daily Labor Expense Entry" title="บันทึกรายจ่ายแรงงานรายวัน (HR-only)" />
          <form className="mt-4 grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))] xl:items-end" onSubmit={submitExpense}>
            <Field label="วันที่จ่าย">
              <TextInput type="date" value={expenseForm.expenseDate} onChange={(event) => setExpenseForm({ ...expenseForm, expenseDate: event.target.value })} />
            </Field>
            <Field label="ทีมช่าง / หัวหน้าทีม">
              <Select
                value={expenseForm.crewId}
                onChange={(event) => {
                  const selectedCrew = companyCrews.find((crew) => crew.id === event.target.value);
                  setExpenseForm({
                    ...expenseForm,
                    crewId: event.target.value,
                    workType: selectedCrew?.workTypes[0] ?? expenseForm.workType
                  });
                }}
              >
                <option value="">เลือกทีมช่าง</option>
                {companyCrews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.leaderName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="โปรเจกต์">
              <Select value={expenseForm.projectId ?? ""} onChange={(event) => setExpenseForm({ ...expenseForm, projectId: event.target.value || undefined })}>
                <option value="">ไม่ระบุโปรเจกต์</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ประเภทงาน">
              <Select value={expenseForm.workType ?? ""} onChange={(event) => setExpenseForm({ ...expenseForm, workType: event.target.value })}>
                <option value="">ไม่ระบุ</option>
                {Array.from(new Set([...tradeOptions, ...(companyCrews.find((crew) => crew.id === expenseForm.crewId)?.workTypes ?? [])])).map((workType) => (
                  <option key={workType} value={workType}>
                    {workType}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="รายละเอียด">
              <TextInput value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} />
            </Field>
            <Field label="ยอดจ่าย">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                value={expenseAmountInput}
                onChange={(event) => setExpenseAmountInput(numberFromInput(event.target.value))}
              />
            </Field>
            <div className="grid gap-2 xl:col-span-2">
              <p className="text-xs font-semibold text-slate-600">วิธีคำนวณหัก ณ ที่จ่าย</p>
              <div className="grid gap-2 rounded-2xl bg-slate-50 p-2 sm:grid-cols-2">
                {([
                  { id: "after_withholding", label: "ยอดจ่ายจริงหลังหัก 3%" },
                  { id: "before_withholding", label: "ยอดก่อนหัก 3%" }
                ] as Array<{ id: LaborWithholdingMode; label: string }>).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`min-h-11 rounded-2xl px-3 text-sm font-black transition ${
                      expenseWithholdingMode === mode.id ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-slate-700"
                    }`}
                    onClick={() => setExpenseWithholdingMode(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="หมายเหตุ">
              <TextInput value={expenseForm.note ?? ""} onChange={(event) => setExpenseForm({ ...expenseForm, note: event.target.value })} />
            </Field>
            <div className="grid gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm xl:col-span-4 sm:grid-cols-3">
              <div>
                <p className="font-bold text-slate-500">ยอดก่อนหัก</p>
                <p className="mt-1 font-black text-slate-950">{formatHrCurrency(expenseWithholdingPreview.grossAmount)}</p>
              </div>
              <div>
                <p className="font-bold text-slate-500">หัก ณ ที่จ่าย 3%</p>
                <p className="mt-1 font-black text-slate-950">{formatHrCurrency(expenseWithholdingPreview.withholdingTax)}</p>
              </div>
              <div>
                <p className="font-bold text-slate-500">ยอดจ่ายจริง</p>
                <p className="mt-1 font-black text-slate-950">{formatHrCurrency(expenseWithholdingPreview.netAmount)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={companyCrews.length === 0}>
                บันทึกรายจ่าย
              </Button>
              <Button type="button" variant="secondary" onClick={() => resetExpenseForm()}>
                ล้างฟอร์ม
              </Button>
            </div>
          </form>
          {companyCrews.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              ยังไม่มีทีมช่าง กรุณาเพิ่มหัวหน้าทีมก่อนบันทึกรายจ่าย
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid w-full max-w-full min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div id="hr-month-expense-table" className="min-w-0 scroll-mt-24">
          <Card className="min-w-0">
            <SectionHeader
              eyebrow="Expense Table by Selected Month"
              title={`รายจ่ายแรงงานเดือนที่เลือก ${selectedMonth}`}
              action={
                <Button className="w-full sm:w-auto" variant="secondary" onClick={handleExportHrExpensesCsv}>
                  Export CSV
                </Button>
              }
            />
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              เปลี่ยนเดือนจากด้านบนเพื่อดูข้อมูลย้อนหลัง และข้อมูลในตารางและไฟล์ดาวน์โหลดจะอิงเดือนที่เลือก
            </p>
            {monthExpenses.length === 0 ? (
              <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
                <h3 className="text-lg font-black text-slate-950">ยังไม่มีรายจ่ายแรงงานของเดือนที่เลือก</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  บันทึกรายจ่ายจากหน้า HR เพื่อคำนวณยอดสะสมและหัก ณ ที่จ่าย
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-[24px] border border-slate-200 max-w-full">
                <table className="min-w-[760px] w-full text-left text-sm lg:min-w-[900px]">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-3 py-3">วันที่</th>
                      <th className="px-3 py-3">ทีมช่าง / ผู้รับเงิน</th>
                      <th className="px-3 py-3">โปรเจกต์</th>
                      <th className="px-3 py-3">ประเภทงาน</th>
                      <th className="px-3 py-3">รายละเอียด</th>
                      <th className="px-3 py-3 text-right">ยอดก่อนหัก</th>
                      <th className="px-3 py-3 text-right">หัก ณ ที่จ่าย 3%</th>
                      <th className="px-3 py-3 text-right">ยอดจ่ายจริง</th>
                      <th className="px-3 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthExpenses.map((expense) => {
                      const crew = companyCrews.find((entry) => entry.id === expense.crewId);
                      const project = projects.find((entry) => entry.id === expense.projectId);
                      const amounts = calculateLaborWithholdingAmounts(expense.amount, "before_withholding");
                      return (
                        <tr key={expense.id} className="border-t border-slate-100">
                          <td className="px-3 py-3 font-semibold">{expense.expenseDate}</td>
                          <td className="px-3 py-3">{crew?.leaderName ?? "ไม่พบทีม"}</td>
                          <td className="px-3 py-3">{project?.name ?? "-"}</td>
                          <td className="px-3 py-3">{expense.workType || "-"}</td>
                          <td className="px-3 py-3">{expense.description || "-"}</td>
                          <td className="px-3 py-3 text-right font-black">{formatHrCurrency(amounts.grossAmount)}</td>
                          <td className="px-3 py-3 text-right">{formatHrCurrency(amounts.withholdingTax)}</td>
                          <td className="px-3 py-3 text-right">{formatHrCurrency(amounts.netAmount)}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              <Button className="min-h-9 px-3 text-xs" variant="secondary" onClick={() => editLaborExpense(expense)}>
                                edit
                              </Button>
                              <Button className="min-h-9 px-3 text-xs" variant="danger" onClick={() => deleteLaborExpense(expense.id)}>
                                delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card className="min-w-0">
          <SectionHeader eyebrow="Crew Performance" title="ตัวชี้วัดประสิทธิภาพแบบง่าย" />
          {summary.crewSummaries.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
              <h3 className="text-lg font-black text-slate-950">ยังไม่มีข้อมูลแรงงานจาก Daily Report</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                เมื่อกรอกรายงานประจำวัน ระบบจะนำจำนวน manpower มาสรุปใน HR อัตโนมัติ
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {summary.crewSummaries.map((crewSummary) => (
                <div key={crewSummary.crew.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{crewSummary.crew.leaderName}</p>
                      <p className="mt-1 text-sm text-slate-500">{crewSummary.crew.workTypes.join(", ") || "ทั่วไป"}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{crewSummary.crew.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <span>เข้าไซต์ {crewSummary.siteDays} วัน</span>
                    <span>manpower รวม {crewSummary.manDays}</span>
                    <span>โปรเจกต์ {crewSummary.projectCount}</span>
                    <span>Daily Report {crewSummary.relatedReportCount}</span>
                    <span>ปัญหาที่เกี่ยวข้อง {crewSummary.problemNoteCount}</span>
                    <span>{formatHrCurrency(crewSummary.averageCostPerManDay)}/man-day</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
    </div>
    </>
  );
}
