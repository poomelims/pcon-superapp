"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  buildBuyinAccountingCsv,
  calculateBuyinNetAmount,
  calculateBuyinTotals,
  calculateBuyinVatAmount,
  getBuyinDisplayVendorName,
  getBuyinEntriesForSelectedMonth,
  getSelectedMonthExportDate,
  groupBuyinByVendor,
  sanitizeTaxId,
  sortBuyinVendorsByPaidAmount
} from "@/lib/buyin-calculations";
import { formatCompactCurrency, nonNegativeNumber } from "@/lib/project-calculations";
import {
  createBuyinEntry,
  todayString,
  type BuyinEntry,
  type BuyinEntryType,
  type ProjectControlData
} from "@/lib/project-storage";
import { sortProjectsForDisplay } from "@/lib/project-sorting";
import { getMobileSectionMeta } from "@/lib/project-control/mobile-module-ui";
import { Button, Card, Field, MiniStatCard, SectionHeader, Select, TextInput } from "../shared/ui";
import { MobileCompactRow, MobileContextActionBar, MobileEmptyState, MobileModuleHeader, MobileNumberedSection, MobileSummaryStrip } from "../shared/mobile-module-ui";
import { DesktopActionBar, DesktopModuleHeader, DesktopSummaryStrip } from "../shared/desktop-module-ui";
import { numberFromInput, type WorkspaceNotice as Notice } from "../shared/utils";

function currentMonthString(now = new Date()): string {
  return todayString(now).slice(0, 7);
}

function formatBuyinCurrency(value: number): string {
  const safeValue = nonNegativeNumber(value);
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: Number.isInteger(safeValue) ? 0 : 2, maximumFractionDigits: 2 }).format(safeValue);
}
export function BuyinView({
  data,
  activeCompanyId,
  activeProjectId,
  prefill,
  clearPrefill,
  setNotice,
  saveBuyinEntry,
  deleteBuyinEntry
}: {
  data: ProjectControlData;
  activeCompanyId: string;
  activeProjectId: string;
  prefill: { projectId?: string; entryDate?: string } | null;
  clearPrefill: () => void;
  setNotice: (notice: Notice) => void;
  saveBuyinEntry: (entry: BuyinEntry) => boolean;
  deleteBuyinEntry: (entryId: string) => void;
}) {
  const projects = sortProjectsForDisplay(
    data.projects.filter((project) => project.companyId === activeCompanyId),
    todayString()
  );
  const companyEntries = data.buyinEntries.filter((entry) => entry.companyId === activeCompanyId);
  const [selectedBuyinMonth, setSelectedBuyinMonth] = useState(currentMonthString());
  const selectedMonthExportDate = getSelectedMonthExportDate(selectedBuyinMonth, todayString());
  const monthEntries = getBuyinEntriesForSelectedMonth(companyEntries, selectedBuyinMonth, todayString());
  const vendorGroups = sortBuyinVendorsByPaidAmount(groupBuyinByVendor(monthEntries));
  const totals = calculateBuyinTotals(monthEntries);
  const topProject = projects
    .map((project) => ({
      project,
      total: monthEntries.filter((entry) => entry.projectId === project.id).reduce((sum, entry) => sum + entry.amountPaid, 0)
    }))
    .sort((a, b) => b.total - a.total)[0];
  const [entryForm, setEntryForm] = useState<BuyinEntry>(() =>
    createBuyinEntry(activeCompanyId, {
      projectId: activeProjectId || undefined,
      type: "expense",
      includeVat: false
    })
  );
  const [activeMobileSection, setActiveMobileSection] = useState("buyin-entry");
  const [mobileFeedback, setMobileFeedback] = useState<{ tone: "success" | "error"; label: string } | null>(null);

  useEffect(() => {
    if (!prefill) {
      return;
    }

    const nextPrefill = prefill;
    queueMicrotask(() => {
      setEntryForm((current) => ({
        ...current,
        projectId: nextPrefill.projectId || current.projectId,
        entryDate: nextPrefill.entryDate || current.entryDate
      }));
      clearPrefill();
    });
  }, [clearPrefill, prefill]);

  function updateEntryForm(patch: Partial<BuyinEntry>) {
    setEntryForm((current) => {
      const nextType = patch.type ?? current.type;
      const nextAmount = nonNegativeNumber(patch.amountPaid ?? current.amountPaid);
      const nextIncludeVat = typeof patch.includeVat === "boolean" ? patch.includeVat : current.includeVat;
      return {
        ...current,
        ...patch,
        type: nextType,
        amountPaid: nextAmount,
        includeVat: nextIncludeVat,
        netAmount: calculateBuyinNetAmount(nextAmount, nextIncludeVat),
        vatAmount: calculateBuyinVatAmount(nextAmount, nextIncludeVat)
      };
    });
  }

  function resetBuyinForm(type: BuyinEntryType = entryForm.type) {
    setEntryForm(
      createBuyinEntry(activeCompanyId, {
        projectId: activeProjectId || undefined,
        type,
        includeVat: type === "invoice"
      })
    );
  }

  function createNextBuyinDraftFromSavedEntry(savedEntry: BuyinEntry): BuyinEntry {
    return createBuyinEntry(activeCompanyId, {
      type: savedEntry.type,
      entryDate: savedEntry.entryDate,
      projectId: savedEntry.projectId || activeProjectId || undefined,
      includeVat: savedEntry.type === "invoice"
    });
  }

  function commitBuyin() {
    const saved = saveBuyinEntry({
      ...entryForm,
      vendorTaxId: sanitizeTaxId(entryForm.vendorTaxId ?? "")
    });

    if (!saved) {
      setMobileFeedback({ tone: "error", label: "กรอกข้อมูลรายการซื้อให้ครบ" });
      return false;
    }

    setEntryForm(createNextBuyinDraftFromSavedEntry(entryForm));
    setMobileFeedback({ tone: "success", label: "บันทึกรายการซื้อแล้ว" });
    return true;
  }

  function submitBuyin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitBuyin();
  }

  function exportBuyinCsv() {
    const exportEntries = getBuyinEntriesForSelectedMonth(companyEntries, selectedBuyinMonth, todayString());

    if (exportEntries.length === 0) {
      setNotice({ type: "error", text: "ไม่มีข้อมูลสำหรับ Export เดือนที่เลือก" });
      return;
    }

    const csv = buildBuyinAccountingCsv(exportEntries, projects, selectedMonthExportDate);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pcon-buyin-${selectedBuyinMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ type: "success", text: "Export CSV แล้ว" });
  }

  const mobileVendorName = entryForm.type === "expense" ? entryForm.storeName ?? "" : entryForm.vendorName ?? "";
  const mobileSections = {
    entry: getMobileSectionMeta({ id: "buyin-entry", number: 1, title: "เพิ่มรายการซื้อ", completed: [Boolean(entryForm.entryDate), Boolean(mobileVendorName.trim()), Boolean(entryForm.description?.trim()), entryForm.amountPaid > 0].filter(Boolean).length, total: 4 }),
    vendors: getMobileSectionMeta({ id: "buyin-vendors", number: 2, title: "ร้านค้าและผู้ขาย", completed: vendorGroups.length > 0 ? 1 : 0, total: 1 }),
    history: getMobileSectionMeta({ id: "buyin-history", number: 3, title: "รายการเดือนนี้", completed: monthEntries.length > 0 ? 1 : 0, total: 1 }),
    projects: getMobileSectionMeta({ id: "buyin-projects", number: 4, title: "สรุปตามโปรเจกต์", completed: topProject?.total ? 1 : 0, total: 1 })
  };
  function runMobileBuyinAction() {
    setMobileFeedback(null);
    if (activeMobileSection === mobileSections.entry.id) return commitBuyin();
    setActiveMobileSection(mobileSections.entry.id);
    queueMicrotask(() => document.querySelector<HTMLInputElement>("[data-mobile-buyin-date]")?.focus());
  }

  return (
    <>
    <div data-mobile-buyin-layout className="grid gap-3 pb-32 md:hidden">
      <h2 className="sr-only">บันทึกซื้อของและใบกำกับผู้ขาย</h2>
      <MobileModuleHeader title="BUYIN / จัดซื้อ" context={new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${selectedBuyinMonth}-01T12:00:00+07:00`))} detail={projects.find((project) => project.id === activeProjectId)?.name || "ทุกโปรเจกต์"} action={<TextInput aria-label="เลือกเดือนสำหรับดาวน์โหลด" type="month" max={currentMonthString()} value={selectedBuyinMonth} onChange={(event) => setSelectedBuyinMonth(event.target.value || currentMonthString())} className="w-[122px] px-2 text-xs" />} />
      <MobileSummaryStrip items={[
        { label: "ยอดจ่ายเดือนนี้", value: formatCompactCurrency(totals.paidAmount), tone: "slate" },
        { label: "จำนวนรายการ", value: String(monthEntries.length) },
        { label: "VAT 7% รวม", value: formatCompactCurrency(totals.vatAmount), tone: "amber" }
      ]} />
      <div className="grid gap-3">
        <MobileNumberedSection meta={mobileSections.entry} expanded={activeMobileSection === mobileSections.entry.id} onToggle={() => setActiveMobileSection(mobileSections.entry.id)}>
          <form className="grid gap-3 bg-emerald-50/30 p-3" onSubmit={submitBuyin}>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">{(["expense", "invoice"] as BuyinEntryType[]).map((type) => <button key={type} type="button" className={`min-h-11 rounded-xl text-xs font-black ${entryForm.type === type ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`} onClick={() => updateEntryForm({ type, includeVat: type === "invoice" })}>{type === "expense" ? "ซื้อของ" : "ใบกำกับ"}</button>)}</div>
            <Field label="วันที่"><TextInput data-mobile-buyin-date type="date" value={entryForm.entryDate} onChange={(event) => updateEntryForm({ entryDate: event.target.value })} /></Field>
            <Field label="โปรเจกต์"><Select value={entryForm.projectId ?? ""} onChange={(event) => updateEntryForm({ projectId: event.target.value || undefined })}><option value="">ไม่ระบุโปรเจกต์</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field>
            {entryForm.type === "expense" ? <Field label="ร้านค้า"><TextInput value={entryForm.storeName ?? ""} onChange={(event) => updateEntryForm({ storeName: event.target.value })} /></Field> : <><Field label="ชื่อผู้ขาย"><TextInput value={entryForm.vendorName ?? ""} onChange={(event) => updateEntryForm({ vendorName: event.target.value })} /></Field><Field label="เลขประจำตัวผู้เสียภาษี"><TextInput value={entryForm.vendorTaxId ?? ""} onChange={(event) => updateEntryForm({ vendorTaxId: sanitizeTaxId(event.target.value) })} /></Field></>}
            <Field label="รายละเอียด"><TextInput value={entryForm.description ?? ""} onChange={(event) => updateEntryForm({ description: event.target.value })} /></Field>
            <Field label="หมวดหมู่"><TextInput value={entryForm.category ?? ""} onChange={(event) => updateEntryForm({ category: event.target.value })} /></Field>
            <Field label="ยอดเงิน"><TextInput type="number" min={0} step="0.01" value={entryForm.amountPaid} onChange={(event) => updateEntryForm({ amountPaid: numberFromInput(event.target.value) })} /></Field>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-emerald-100 bg-white px-3 text-sm font-bold text-emerald-800"><input type="checkbox" checked={entryForm.includeVat} onChange={(event) => updateEntryForm({ includeVat: event.target.checked })} />รวม VAT 7%</label>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center text-xs"><div><p className="text-slate-400">จ่าย</p><p className="font-black">{formatBuyinCurrency(entryForm.amountPaid)}</p></div><div><p className="text-slate-400">ก่อน VAT</p><p className="font-black">{formatBuyinCurrency(entryForm.netAmount)}</p></div><div><p className="text-slate-400">VAT</p><p className="font-black text-amber-600">{formatBuyinCurrency(entryForm.vatAmount)}</p></div></div>
          </form>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.vendors} expanded={activeMobileSection === mobileSections.vendors.id} onToggle={() => setActiveMobileSection(mobileSections.vendors.id)}>
          <div className="grid gap-2 p-3">{vendorGroups.length > 0 ? vendorGroups.map((group) => <MobileCompactRow key={`${group.entryType}-${group.vendorName}-${group.taxId}`} title={group.vendorName} detail={`${group.itemCount} รายการ · VAT ${formatBuyinCurrency(group.totalVat7)}`} value={formatBuyinCurrency(group.totalPaidAmount)} />) : <MobileEmptyState>ยังไม่มีข้อมูลร้านค้า / ผู้ขาย</MobileEmptyState>}</div>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.history} expanded={activeMobileSection === mobileSections.history.id} onToggle={() => setActiveMobileSection(mobileSections.history.id)}>
          <div className="grid gap-2 p-3">{monthEntries.length > 0 ? monthEntries.map((entry) => <MobileCompactRow key={entry.id} title={getBuyinDisplayVendorName(entry)} detail={`${entry.entryDate} · ${entry.description || entry.category || entry.type}`} value={formatBuyinCurrency(entry.amountPaid)} onClick={() => { setEntryForm(entry); setActiveMobileSection(mobileSections.entry.id); }} />) : <MobileEmptyState>ยังไม่มีรายการซื้อของเดือนนี้</MobileEmptyState>}<Button variant="secondary" onClick={exportBuyinCsv}>Export CSV สำหรับบัญชี</Button></div>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.projects} expanded={activeMobileSection === mobileSections.projects.id} onToggle={() => setActiveMobileSection(mobileSections.projects.id)}>
          <div className="grid gap-2 p-3">{projects.map((project) => { const total = monthEntries.filter((entry) => entry.projectId === project.id).reduce((sum, entry) => sum + entry.amountPaid, 0); return total > 0 ? <MobileCompactRow key={project.id} title={project.name} detail={`${monthEntries.filter((entry) => entry.projectId === project.id).length} รายการ`} value={formatBuyinCurrency(total)} /> : null; })}{!topProject?.total ? <MobileEmptyState>ยังไม่มีค่าใช้จ่ายแยกตามโปรเจกต์</MobileEmptyState> : null}</div>
        </MobileNumberedSection>
      </div>
      <MobileContextActionBar label={activeMobileSection === mobileSections.entry.id ? "บันทึกรายการซื้อ" : "+ เพิ่มรายการ"} feedback={mobileFeedback} onClick={runMobileBuyinAction} />
    </div>
    <div className="hidden md:block">
    <div data-buyin-module="phase-buyin-1" className="grid w-full max-w-full min-w-0 gap-5 pb-24 lg:pb-0">
      <DesktopModuleHeader
        title="บันทึกซื้อของและใบกำกับผู้ขาย"
        context={`BUYIN / จัดซื้อ · ${new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${selectedBuyinMonth}-01T12:00:00+07:00`))}`}
        detail={projects.find((project) => project.id === activeProjectId)?.name || "ทุกโปรเจกต์"}
        action={<TextInput aria-label="เลือกเดือนสำหรับดาวน์โหลด" type="month" max={currentMonthString()} value={selectedBuyinMonth} onChange={(event) => setSelectedBuyinMonth(event.target.value || currentMonthString())} className="w-[150px]" />}
        attribute="data-buyin-desktop-summary"
      />
      <DesktopSummaryStrip items={[
        { label: "ยอดจ่ายเดือนนี้", value: formatCompactCurrency(totals.paidAmount), hint: `${monthEntries.length} รายการ`, tone: "slate" },
        { label: "จำนวนรายการ", value: `${monthEntries.length} รายการ`, hint: `${vendorGroups.length} ร้านค้า / ผู้ขาย` },
        { label: "VAT 7% รวม", value: formatCompactCurrency(totals.vatAmount), hint: `สุทธิ ${formatCompactCurrency(totals.netAmount)}`, tone: "amber" }
      ]} />
      <DesktopActionBar attribute="data-buyin-desktop-action-bar">
        <Button onClick={() => { resetBuyinForm(); document.getElementById("buyin-entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); queueMicrotask(() => document.querySelector<HTMLInputElement>("[data-desktop-buyin-date]")?.focus()); }}>+ เพิ่มรายการซื้อ</Button>
        <Button variant="secondary" onClick={exportBuyinCsv}>Export CSV สำหรับบัญชี</Button>
      </DesktopActionBar>

      <div className="grid w-full max-w-full min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="min-w-0">
          <SectionHeader eyebrow="BUYIN Entry Form" title="เพิ่มรายการซื้อของ / ใบกำกับ" />
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-[24px] bg-slate-50 p-2">
            {(["expense", "invoice"] as BuyinEntryType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`rounded-2xl px-3 py-3 text-sm font-black transition ${
                  entryForm.type === type ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-slate-700"
                }`}
                onClick={() => updateEntryForm({ type, includeVat: type === "invoice" })}
              >
                {type === "expense" ? "Expense" : "Invoice by Vendor"}
              </button>
            ))}
          </div>
          <form id="buyin-entry-form" className="mt-4 grid gap-3" onSubmit={submitBuyin}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="วันที่">
                <TextInput data-desktop-buyin-date type="date" value={entryForm.entryDate} onChange={(event) => updateEntryForm({ entryDate: event.target.value })} />
              </Field>
              <Field label="โปรเจกต์">
                <Select value={entryForm.projectId ?? ""} onChange={(event) => updateEntryForm({ projectId: event.target.value || undefined })}>
                  <option value="">ไม่ระบุโปรเจกต์</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {entryForm.type === "expense" ? (
                <Field label="ร้านค้า">
                  <TextInput value={entryForm.storeName ?? ""} onChange={(event) => updateEntryForm({ storeName: event.target.value })} />
                </Field>
              ) : (
                <>
                  <Field label="ชื่อผู้ขาย">
                    <TextInput value={entryForm.vendorName ?? ""} onChange={(event) => updateEntryForm({ vendorName: event.target.value })} />
                  </Field>
                  <Field label="เลขประจำตัวผู้เสียภาษี">
                    <TextInput value={entryForm.vendorTaxId ?? ""} onChange={(event) => updateEntryForm({ vendorTaxId: sanitizeTaxId(event.target.value) })} />
                  </Field>
                </>
              )}
              <Field label="รายละเอียด">
                <TextInput value={entryForm.description ?? ""} onChange={(event) => updateEntryForm({ description: event.target.value })} />
              </Field>
              <Field label="หมวดหมู่">
                <TextInput value={entryForm.category ?? ""} onChange={(event) => updateEntryForm({ category: event.target.value })} />
              </Field>
              <Field label="ยอดเงิน">
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={entryForm.amountPaid}
                  onChange={(event) => updateEntryForm({ amountPaid: numberFromInput(event.target.value) })}
                />
              </Field>
              <Field label="หมายเหตุ">
                <TextInput value={entryForm.note ?? ""} onChange={(event) => updateEntryForm({ note: event.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm font-bold text-emerald-800">
              <input
                type="checkbox"
                checked={entryForm.includeVat}
                onChange={(event) => updateEntryForm({ includeVat: event.target.checked })}
              />
              รวม VAT 7%
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStatCard label="ราคาจ่าย" value={formatBuyinCurrency(entryForm.amountPaid)} hint="ยอดที่จ่ายจริง" />
              <MiniStatCard label="ราคาสุทธิ" value={formatBuyinCurrency(entryForm.netAmount)} hint="ก่อน VAT" tone="slate" />
              <MiniStatCard label="VAT 7%" value={formatBuyinCurrency(entryForm.vatAmount)} hint={entryForm.includeVat ? "แยกจากยอดรวม" : "ไม่มี VAT"} tone="emerald" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save BUYIN</Button>
              <Button type="button" variant="secondary" onClick={() => resetBuyinForm()}>
                New Entry
              </Button>
              {companyEntries.some((entry) => entry.id === entryForm.id) ? (
                <Button type="button" variant="danger" onClick={() => deleteBuyinEntry(entryForm.id)}>
                  Delete Entry
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card className="min-w-0">
          <SectionHeader eyebrow="Vendor Monthly Summary" title="สรุปตามร้านค้า / ผู้ขาย" />
          {vendorGroups.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
              <h3 className="text-lg font-black text-slate-950">ยังไม่มีข้อมูลผู้ขาย</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                เมื่อบันทึกรายการ ระบบจะรวมยอดแยกตามร้านค้าและผู้ขายให้อัตโนมัติ
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {vendorGroups.map((group) => (
                <div key={`${group.entryType}-${group.vendorName}-${group.taxId}`} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">{group.vendorName}</p>
                      <p className="mt-1 text-sm text-slate-500">{group.taxId || "-"}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{group.itemCount} รายการ</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <span>{formatBuyinCurrency(group.totalPaidAmount)}</span>
                    <span>{formatBuyinCurrency(group.totalNetAmount)}</span>
                    <span>{formatBuyinCurrency(group.totalVat7)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="min-w-0">
        <SectionHeader
          eyebrow="Current Month-to-Date Table"
          title="รายการ BUYIN เดือนที่เลือก"
          action={
            <Button className="w-full sm:w-auto" variant="secondary" onClick={exportBuyinCsv}>
              Export CSV สำหรับบัญชี
            </Button>
          }
        />
        <div className="mt-3 grid gap-3 rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
          <p className="text-sm font-semibold leading-6 text-slate-600">
            เลือกเดือนย้อนหลังเพื่อดูตารางและดาวน์โหลด CSV ของเดือนนั้น เดือนปัจจุบันจะ Export ตั้งแต่วันที่ 1 ถึงวันนี้
          </p>
          <Field label="เลือกเดือนสำหรับดาวน์โหลด">
            <TextInput
              type="month"
              max={currentMonthString()}
              value={selectedBuyinMonth}
              onChange={(event) => setSelectedBuyinMonth(event.target.value || currentMonthString())}
            />
          </Field>
        </div>
        {monthEntries.length === 0 ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
            <h3 className="text-lg font-black text-slate-950">ยังไม่มีรายการซื้อของเดือนนี้</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              เริ่มบันทึกค่าใช้จ่ายจากการซื้อของหรือใบกำกับผู้ขาย เพื่อสรุปส่งบัญชีได้ง่าย
            </p>
            <Button className="mt-3" onClick={() => resetBuyinForm()}>
              + เพิ่มรายการ BUYIN
            </Button>
          </div>
        ) : (
          <div className="mt-4 max-w-full overflow-x-auto rounded-[24px] border border-slate-200">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">วันที่</th>
                  <th className="px-3 py-3">ประเภท</th>
                  <th className="px-3 py-3">ร้านค้า / ผู้ขาย</th>
                  <th className="px-3 py-3">เลขผู้เสียภาษี</th>
                  <th className="px-3 py-3">โปรเจกต์</th>
                  <th className="px-3 py-3">รายละเอียด</th>
                  <th className="px-3 py-3 text-right">ราคาจ่าย</th>
                  <th className="px-3 py-3 text-right">ราคาสุทธิ</th>
                  <th className="px-3 py-3 text-right">VAT 7%</th>
                  <th className="px-3 py-3">หมายเหตุ</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthEntries.map((entry) => {
                  const project = projects.find((item) => item.id === entry.projectId);
                  return (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-semibold">{entry.entryDate}</td>
                      <td className="px-3 py-3">{entry.type}</td>
                      <td className="px-3 py-3">{getBuyinDisplayVendorName(entry)}</td>
                      <td className="px-3 py-3">{entry.type === "invoice" ? entry.vendorTaxId || "-" : "-"}</td>
                      <td className="px-3 py-3">{entry.projectId ? project?.name ?? "Archived / unknown project" : "-"}</td>
                      <td className="px-3 py-3">{entry.description || "-"}</td>
                      <td className="px-3 py-3 text-right font-black">{formatBuyinCurrency(entry.amountPaid)}</td>
                      <td className="px-3 py-3 text-right">{formatBuyinCurrency(entry.netAmount)}</td>
                      <td className="px-3 py-3 text-right">{formatBuyinCurrency(entry.vatAmount)}</td>
                      <td className="px-3 py-3">{entry.note || "-"}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <Button className="min-h-9 px-3 text-xs" variant="secondary" onClick={() => setEntryForm(entry)}>
                            edit
                          </Button>
                          <Button className="min-h-9 px-3 text-xs" variant="danger" onClick={() => deleteBuyinEntry(entry.id)}>
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
    </div>
    </>
  );
}
