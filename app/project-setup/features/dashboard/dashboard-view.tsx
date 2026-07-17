"use client";

import { useState, type ReactNode } from "react";
import {
  calculateCategoryProgress,
  calculateCategoryTotal,
  calculateOverallBoqTotal,
  calculateWeightedProgress,
  formatCompactCurrency,
  formatCurrency,
  formatPercent
} from "@/lib/project-calculations";
import { countCompletedWork, selectDashboardIssues, selectDisplayEntries } from "@/lib/project-control/dashboard-selectors";
import { selectDashboardTodayPulse } from "@/lib/project-control/dashboard-today-view-model";
import { selectDashboardReportSnapshot, selectProjectReportHistory } from "@/lib/project-control/daily-report-selectors";
import { formatDashboardDateSpan, formatDashboardShortDate } from "@/lib/project-control/dashboard-view-model";
import { filterActiveProjectsForDisplay } from "@/lib/project-sorting";
import { getWorkspaceEntryGuidance } from "@/lib/project-control/workspace-entry-guidance";
import { formatThaiReportDate } from "@/lib/project-control/daily-report-ui";
import { getMobileSectionMeta } from "@/lib/project-control/mobile-module-ui";
import { todayString, type DailyReport, type Project, type ProjectControlData } from "@/lib/project-storage";
import { CeoQuotesCard } from "../../ceo-quotes-card";
import { PersonalScheduleCard } from "../../personal-schedule-card";
import { Button, Card, PlaceholderProjectVisual, ProgressBar } from "../shared/ui";
import { MobileCompactRow, MobileContextActionBar, MobileEmptyState, MobileModuleHeader, MobileNumberedSection, MobileSummaryStrip } from "../shared/mobile-module-ui";
import { DesktopModuleHeader, DesktopSectionCard, DesktopSummaryStrip } from "../shared/desktop-module-ui";
import { TodayPulse } from "./today-pulse";
function DashboardSectionHeading({
  eyebrow,
  title,
  actionLabel
}: {
  eyebrow: string;
  title: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h3>
      </div>
      {actionLabel ? (
        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
          {actionLabel}
        </span>
      ) : null}
    </div>
  );
}

type DashboardMetricTone = "blue" | "emerald" | "amber" | "slate";

type DashboardMetricItem = {
  label: string;
  shortLabel?: string;
  value: string;
  valueTitle?: string;
  valueTestId?: string;
  hint?: string;
  tone?: DashboardMetricTone;
};

function DashboardMetricTile({
  label,
  shortLabel,
  value,
  valueTitle,
  valueTestId,
  hint,
  tone = "blue"
}: DashboardMetricItem) {
  const toneClasses =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "slate"
          ? "bg-slate-100 text-slate-700"
          : "bg-blue-50 text-blue-700";

  return (
    <Card className="h-full min-h-[148px]">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <p className="min-h-[2.5rem] min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-600">{label}</p>
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black ${toneClasses}`}>
            {(shortLabel || label).slice(0, 1)}
          </div>
        </div>
        <div className="mt-auto pt-4">
          <p
            title={valueTitle}
            data-testid={valueTestId}
            className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[1.68rem] font-black leading-[0.95] tracking-tight text-slate-950 sm:text-[2rem]"
          >
            {value}
          </p>
          <div className="mt-3 min-h-[2.5rem]">
            {hint ? <p className="text-sm font-medium leading-5 text-slate-500">{hint}</p> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DashboardMetricStrip({ items }: { items: DashboardMetricItem[] }) {
  const toneClasses = (tone: DashboardMetricTone = "blue") =>
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "slate"
          ? "bg-slate-100 text-slate-700"
          : "bg-blue-50 text-blue-700";

  return (
    <>
      <div
        data-dashboard-metrics="desktop-strip"
        className="hidden overflow-x-auto rounded-[14px] border border-slate-200 bg-white md:flex"
      >
        {items.map((item, index) => (
          <div
            key={item.label}
            className={`flex min-w-[196px] flex-1 items-center gap-4 px-5 py-5 ${
              index === 0 ? "" : "border-l border-slate-200/80"
            }`}
          >
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black ${toneClasses(item.tone)}`}>
              {(item.shortLabel || item.label).slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.shortLabel || item.label}</p>
              <p
                title={item.valueTitle}
                data-testid={item.valueTestId ? `${item.valueTestId}-desktop` : undefined}
                className="mt-2 truncate text-[1.9rem] font-black leading-none tracking-tight text-slate-950"
              >
                {item.value}
              </p>
              {item.hint ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{item.hint}</p> : null}
            </div>
          </div>
        ))}
      </div>

      <div data-dashboard-metrics-mobile="card-grid" className="grid gap-3 sm:grid-cols-2 md:hidden">
        {items.map((item) => (
          <DashboardMetricTile key={item.label} {...item} />
        ))}
      </div>
    </>
  );
}

function DashboardProjectStripCard({
  project,
  progress,
  isActive,
  onSelect
}: {
  project: Project;
  progress: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full max-w-full min-w-0 overflow-hidden rounded-[24px] border px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 sm:w-[340px] sm:shrink-0 sm:snap-start xl:w-auto xl:basis-[360px] ${
        isActive
          ? "border-emerald-300 bg-[linear-gradient(160deg,rgba(236,253,245,0.95),rgba(255,255,255,0.98))] shadow-[0_18px_40px_rgba(22,101,52,0.12)]"
          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/60"
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="line-clamp-2 min-w-0 text-base font-bold leading-5 text-slate-950">{project.name || "ยังไม่มีชื่อโปรเจกต์"}</p>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 shadow-sm">
              {project.status || "Project"}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{project.customer.siteAddress || project.customer.name || "ยังไม่ระบุไซต์งาน"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white">{Math.round(progress)}%</span>
      </div>
      <div className="mt-4">
        <ProgressBar value={progress} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-semibold text-slate-500">{project.owner || "ยังไม่ระบุเจ้าของโครงการ"}</span>
        <span className="shrink-0 font-bold text-emerald-800">{isActive ? "Active now" : "Open project"}</span>
      </div>
    </button>
  );
}
export function DashboardView({
  data,
  stats,
  activeProjectId,
  activeProject,
  successProjects,
  activeDraft,
  onOpenProject,
  onOpenDailyReport,
  onNewProject
}: {
  data: ProjectControlData;
  stats: { total: number; active: number; done: number; value: number };
  activeProjectId: string;
  activeProject?: Project;
  successProjects: Project[];
  activeDraft: DailyReport | null;
  onOpenProject: (projectId: string) => void;
  onOpenDailyReport: (projectId: string) => void;
  onNewProject: () => void;
}) {
  const dashboardProjects = filterActiveProjectsForDisplay(
    data.projects.filter((entry) => entry.companyId === data.activeCompanyId),
    todayString()
  );
  const project = activeProject ?? dashboardProjects.find((entry) => entry.id === activeProjectId);
  const activeProjectReports = project
    ? selectProjectReportHistory(data, project.companyId, project.id)
    : [];
  const todayPulse = selectDashboardTodayPulse(activeProjectReports, todayString());
  const reportSnapshot = selectDashboardReportSnapshot(activeProjectReports, activeDraft?.id);
  const recentReports = activeProjectReports.slice(0, 4);
  const projectProgress = project ? calculateWeightedProgress(project) : 0;
  const projectTotal = project ? calculateOverallBoqTotal(project) : 0;
  const totalContract = project ? project.budget.mainContract + project.budget.variationOrder : 0;
  const totalWorkers = reportSnapshot?.workers.reduce((total, worker) => total + worker.count, 0) ?? 0;
  const completedCount = countCompletedWork(reportSnapshot);
  const completedLines = selectDisplayEntries(reportSnapshot?.completedWork, "ยังไม่มีรายการงานที่ทำเสร็จ");
  const ongoingLines = selectDisplayEntries(reportSnapshot?.ongoingWork, "ยังไม่มีรายการงานที่กำลังดำเนินการ");
  const nextPlanLines = selectDisplayEntries(reportSnapshot?.nextPlan, "ยังไม่มีแผนงานล่วงหน้า");
  const materialLines = selectDisplayEntries(reportSnapshot?.materials, "ยังไม่มีวัสดุที่บันทึกไว้");
  const issueRows = selectDashboardIssues(reportSnapshot);
  const boqRows = project
    ? project.boq.slice(0, 5).map((category) => ({
        id: category.id,
        name: category.name || "BOQ Category",
        total: calculateCategoryTotal(category),
        progress: calculateCategoryProgress(category)
      }))
    : [];
  const boqBreakdown = project
    ? project.boq.flatMap((category) => category.items).reduce(
        (totals, item) => {
          const amount = Math.max(0, item.quantity) * Math.max(0, item.unitPrice);
          const progress = Math.min(100, Math.max(0, item.progress));
          if (progress >= 100) totals.completed += amount;
          else if (progress > 0) totals.ongoing += amount;
          else totals.notStarted += amount;
          return totals;
        },
        { completed: 0, ongoing: 0, notStarted: 0 }
      )
    : { completed: 0, ongoing: 0, notStarted: 0 };
  const activeProjectCards = dashboardProjects;
  const entryGuidance = getWorkspaceEntryGuidance(Boolean(project));
  const metricItems: DashboardMetricItem[] = [
    {
      label: "Progress รวม",
      shortLabel: "Progress",
      value: formatPercent(projectProgress),
      valueTitle: formatPercent(projectProgress),
      hint: "ภาพรวมจาก BOQ weighted progress",
      tone: "emerald"
    },
    {
      label: "BOQ รวม",
      shortLabel: "BOQ Total",
      value: formatCompactCurrency(projectTotal || stats.value),
      valueTitle: formatCurrency(projectTotal || stats.value),
      hint: "มูลค่า BOQ ของโปรเจกต์ที่เลือก",
      tone: "slate"
    },
    {
      label: "งบประมาณรวม",
      shortLabel: "Budget",
      value: formatCompactCurrency(totalContract),
      valueTitle: formatCurrency(totalContract),
      hint: "Main contract + variation order",
      tone: "blue"
    },
    {
      label: "งานที่เสร็จวันนี้",
      shortLabel: "Completed",
      value: String(completedCount),
      valueTitle: String(completedCount),
      valueTestId: "dashboard-completed-count",
      hint: "อิงจากรายการ completed work ล่าสุด",
      tone: "emerald"
    },
    {
      label: "แรงงานวันนี้",
      shortLabel: "Workers",
      value: String(totalWorkers),
      valueTitle: String(totalWorkers),
      valueTestId: "dashboard-workers-count",
      hint: `${reportSnapshot?.workers.length ?? 0} ทีม / แถวช่างในรายงานล่าสุด`,
      tone: "amber"
    }
  ];
  const [activeMobileSection, setActiveMobileSection] = useState("dashboard-today");
  const todayLabel = formatThaiReportDate(todayString());
  const mobileSections = {
    today: getMobileSectionMeta({ id: "dashboard-today", number: 1, title: "ภาพรวมวันนี้", completed: todayPulse.reportState === "empty" ? 0 : 3, total: 3 }),
    plan: getMobileSectionMeta({ id: "dashboard-plan", number: 2, title: "ปัญหาและแผนงาน", completed: Number(todayPulse.blockers.length > 0) + Number(Boolean(todayPulse.nextPlan)), total: 2 }),
    projects: getMobileSectionMeta({ id: "dashboard-projects", number: 3, title: "โครงการที่กำลังดำเนินการ", completed: dashboardProjects.length > 0 ? 1 : 0, total: 1 }),
    more: getMobileSectionMeta({ id: "dashboard-more", number: 4, title: "ข้อมูลเพิ่มเติม", completed: Number(stats.total > 0) + Number(recentReports.length > 0), total: 2 })
  };

  function mobileSection(meta: typeof mobileSections.today, content: ReactNode) {
    return <MobileNumberedSection meta={meta} expanded={activeMobileSection === meta.id} onToggle={() => setActiveMobileSection(meta.id)}>{content}</MobileNumberedSection>;
  }

  return (
    <>
    <div data-mobile-dashboard-layout className="grid gap-3 pb-32 md:hidden">
      <MobileModuleHeader title="ภาพรวมวันนี้" context={project?.name || "ยังไม่มีโปรเจกต์"} detail={`${todayLabel.dateLabel} · ${todayLabel.weekdayLabel}`} />
      <MobileSummaryStrip items={[
        { label: "สถานะโครงการ", value: project?.status || "ยังไม่เริ่ม" },
        { label: "ความคืบหน้า", value: formatPercent(projectProgress) },
        { label: "ปัญหาต้องตาม", value: String(todayPulse.blockers.length), tone: todayPulse.blockers.length > 0 ? "amber" : "emerald" }
      ]} />
      <div className="grid gap-3">
        {mobileSection(mobileSections.today, <div data-testid="dashboard-today-pulse" className="grid gap-3 bg-emerald-50/30 p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[{label:"คนเข้าไซต์",value:todayPulse.workers,testId:"dashboard-today-workers"},{label:"งานเสร็จ",value:todayPulse.completedWork,testId:"dashboard-today-completed"},{label:"ปัญหา",value:todayPulse.blockers.length,testId:"dashboard-today-blockers"}].map((item) => <div key={item.label} className="rounded-xl border border-emerald-100 bg-white px-2 py-3"><p className="text-[10px] font-semibold text-slate-500">{item.label}</p><p data-testid={item.testId} className="mt-1 text-xl font-black text-slate-900">{item.value}</p></div>)}
          </div>
          <MobileCompactRow title="แผนงานถัดไป" detail={todayPulse.nextPlan || "ยังไม่มีแผนถัดไป"} detailTestId="dashboard-today-next-plan" />
          {todayPulse.blockers.length === 0 ? <p className="text-sm font-semibold text-emerald-700">ยังไม่มีปัญหาที่ต้องติดตาม</p> : null}
          {todayPulse.blockers.slice(0, 2).map((blocker) => <p key={blocker} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{blocker}</p>)}
        </div>)}
        {mobileSection(mobileSections.plan, <div className="grid gap-2 p-3">
          {issueRows.length > 0 ? issueRows.slice(0, 4).map((issue) => <MobileCompactRow key={issue.id} title={issue.title} detail={issue.detail} value="ติดตาม" />) : <MobileEmptyState>ยังไม่มีปัญหาที่ต้องติดตาม</MobileEmptyState>}
          <MobileCompactRow title="แผนพรุ่งนี้" detail={todayPulse.nextPlan || "ยังไม่มีแผนงาน"} />
        </div>)}
        {mobileSection(mobileSections.projects, <div className="grid gap-2 p-3">
          {activeProjectCards.length > 0 ? activeProjectCards.map((entry) => <MobileCompactRow key={entry.id} title={entry.name || "ยังไม่มีชื่อโปรเจกต์"} detail={entry.customer.siteAddress || entry.owner || "ยังไม่ระบุไซต์"} value={formatPercent(calculateWeightedProgress(entry))} onClick={() => onOpenProject(entry.id)} />) : <MobileEmptyState>ยังไม่มีโปรเจกต์ที่กำลังดำเนินการ</MobileEmptyState>}
        </div>)}
        {mobileSection(mobileSections.more, <div className="grid gap-2 p-3">
          <MobileCompactRow title="รายงานล่าสุด" detail={recentReports[0]?.summary || "ยังไม่มี Daily Report"} value={`${recentReports.length} รายการ`} />
          <MobileCompactRow title="Portfolio" detail={`${stats.total} โปรเจกต์ · ปิดแล้ว ${stats.done}`} value={formatCompactCurrency(stats.value)} />
          <MobileCompactRow title="ปฏิทินและแรงบันดาลใจ" detail="ดูรายละเอียดเพิ่มเติมบนหน้าจอ Tablet / Desktop" />
        </div>)}
      </div>
      <MobileContextActionBar label={project ? "บันทึกรายงานวันนี้" : "สร้างโปรเจกต์แรก"} ariaLabel={project ? "บันทึกรายงานวันนี้" : "สร้างโปรเจกต์ใหม่"} onClick={() => project ? onOpenDailyReport(project.id) : onNewProject()} />
    </div>
    <div data-dashboard-layout="reference-desktop" className="hidden md:block">
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)] xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
      <div className="grid min-w-0 gap-5">
        <DesktopModuleHeader
          title="ภาพรวมวันนี้"
          context={project?.name || "ยังไม่มีโปรเจกต์"}
          detail={`${todayLabel.dateLabel} · ${todayLabel.weekdayLabel}`}
          action={project ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">สถานะ: {project.status || "ยังไม่ระบุ"}</span> : null}
          attribute="data-dashboard-module-header"
        />

        <DesktopSummaryStrip
          attribute="data-dashboard-summary-strip"
          items={[
            { label: "สถานะโครงการ", value: project?.status || "ยังไม่เริ่ม", tone: project?.status === "มีปัญหา" ? "amber" : "emerald" },
            { label: "ความคืบหน้าโดยรวม", value: formatPercent(projectProgress), hint: "weighted BOQ", tone: "emerald" },
            { label: "BOQ รวม", value: formatCompactCurrency(projectTotal || stats.value), hint: "มูลค่ารวมของโครงการ", tone: "slate" }
          ]}
        />

        <section data-testid="dashboard-today-pulse-desktop" className="min-w-0 overflow-hidden rounded-[14px] border border-slate-200 bg-white">
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 xl:grid-cols-4 xl:divide-y-0">
            {[
              { label: "ทีมหน้างานวันนี้", value: todayPulse.workers, testId: "dashboard-today-workers-desktop", tone: "emerald" },
              { label: "งานที่ทำเสร็จวันนี้", value: todayPulse.completedWork, testId: "dashboard-today-completed-desktop", tone: "emerald" },
              { label: "ปัญหา / อุปสรรค", value: todayPulse.blockers.length, testId: "dashboard-today-blockers-desktop", tone: todayPulse.blockers.length > 0 ? "amber" : "emerald" },
              { label: "แผนงานวันพรุ่งนี้", value: todayPulse.nextPlan ? nextPlanLines.length : 0, testId: "dashboard-today-next-plan-desktop", tone: "emerald" }
            ].map((item) => (
              <div key={item.testId} className="min-w-0 px-4 py-5">
                <p className="truncate text-xs font-semibold text-slate-500">{item.label}</p>
                <p data-testid={item.testId} className={`mt-3 text-[1.9rem] font-bold leading-none ${item.tone === "amber" ? "text-amber-600" : "text-emerald-700"}`}>
                  {item.value}
                </p>
                {item.testId === "dashboard-today-next-plan-desktop" ? <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-500">{todayPulse.nextPlan || "ยังไม่มีแผนถัดไป"}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <DesktopSectionCard
          title="Daily Report วันนี้"
          detail={reportSnapshot ? `บันทึกแล้วเมื่อ ${formatDashboardShortDate(reportSnapshot.reportDate)}` : "ยังไม่ได้บันทึกข้อมูลหน้างานวันนี้"}
          action={project ? <Button data-testid="dashboard-today-open-report" className="min-h-10 rounded-lg px-4 text-sm" onClick={() => onOpenDailyReport(project.id)}>เปิด Daily Report ของวันนี้</Button> : <Button className="min-h-10 rounded-lg px-4 text-sm" onClick={onNewProject}>สร้างโปรเจกต์ใหม่</Button>}
          attribute="data-dashboard-daily-report-cta"
        >
          <div className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${reportSnapshot ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${reportSnapshot ? "bg-emerald-600" : "bg-amber-500"}`} />
            <span>{reportSnapshot ? "ข้อมูลวันนี้พร้อมใช้ติดตามงานและสรุปให้ลูกค้า" : "เปิดบันทึกเพื่อสรุปความคืบหน้า ปัญหา และแผนงานประจำวัน"}</span>
          </div>
        </DesktopSectionCard>

        <DesktopSectionCard title="รายงานประจำวันล่าสุด" detail={`${recentReports.length} รายการล่าสุด`} attribute="data-dashboard-latest-reports">
          {recentReports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-2 py-2">วันที่</th>
                    <th className="px-2 py-2">รายงาน</th>
                    <th className="px-2 py-2">ทีมงาน</th>
                    <th className="px-2 py-2 text-right">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((report) => (
                    <tr key={report.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="whitespace-nowrap px-2 py-3 font-semibold text-slate-700">{formatDashboardShortDate(report.reportDate)}</td>
                      <td className="max-w-[360px] px-2 py-3">
                        <button type="button" className="block max-w-full text-left hover:text-emerald-700" onClick={() => onOpenDailyReport(report.projectId)}>
                          <span className="block truncate font-semibold text-slate-800">{report.summary || report.completedWork || report.ongoingWork || "รายงานประจำวัน"}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{report.projectId === project?.id ? project?.name : "โปรเจกต์อื่น"}</span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-slate-600">{report.workers.reduce((total, worker) => total + worker.count, 0)} คน</td>
                      <td className="px-2 py-3 text-right"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">เสร็จสิ้น</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">ยังไม่มี Daily Report ที่บันทึกแล้วสำหรับโปรเจกต์นี้</div>
          )}
        </DesktopSectionCard>
      </div>

      <aside data-dashboard-right-rail="reference" className="grid min-w-0 content-start gap-5">
        <DesktopSectionCard title="ความคืบหน้า BOQ" detail="ถ่วงน้ำหนักจากรายการ BOQ" attribute="data-dashboard-boq-progress">
          <div className="flex items-end justify-between gap-4">
            <p className="text-[2.2rem] font-bold leading-none tracking-[-0.04em] text-emerald-700">{formatPercent(projectProgress)}</p>
            <p className="text-right text-xs font-semibold text-slate-500">มูลค่า BOQ รวม<br /><span className="text-sm text-slate-800">{formatCurrency(projectTotal)}</span></p>
          </div>
          <div className="mt-4"><ProgressBar value={projectProgress} /></div>
          <div className="mt-5 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><span className="text-slate-500">งานที่เสร็จแล้ว</span><span className="font-semibold text-slate-800">{formatCurrency(boqBreakdown.completed)}</span></div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><span className="text-slate-500">งานที่กำลังทำ</span><span className="font-semibold text-slate-800">{formatCurrency(boqBreakdown.ongoing)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-slate-500">งานที่ยังไม่เริ่ม</span><span className="font-semibold text-slate-800">{formatCurrency(boqBreakdown.notStarted)}</span></div>
          </div>
          <Button variant="secondary" className="mt-5 w-full rounded-lg text-sm" onClick={() => project ? onOpenProject(project.id) : onNewProject()}>ดูรายละเอียด BOQ</Button>
        </DesktopSectionCard>

        <DesktopSectionCard title="สรุปตามหมวดงาน" detail={`${boqRows.length} หมวดหลัก`} attribute="data-dashboard-workstream-progress">
          <div className="grid gap-3">
            {boqRows.length > 0 ? boqRows.map((row) => (
              <div key={row.id} className="grid gap-2">
                <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold text-slate-700">{row.name}</span><span className="font-bold text-emerald-700">{formatPercent(row.progress)}</span></div>
                <ProgressBar value={row.progress} />
              </div>
            )) : <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">เพิ่มหมวดงานใน Project / BOQ เพื่อดูความคืบหน้า</div>}
          </div>
        </DesktopSectionCard>

        <DesktopSectionCard title="ลิงก์ด่วน" attribute="data-dashboard-quick-links">
          <div className="grid gap-2">
            <button type="button" className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 text-left text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50" onClick={() => project ? onOpenDailyReport(project.id) : onNewProject()}><span>รายงานประจำวัน</span><span aria-hidden="true">›</span></button>
            <button type="button" className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 text-left text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50" onClick={() => project ? onOpenProject(project.id) : onNewProject()}><span>Project + BOQ</span><span aria-hidden="true">›</span></button>
          </div>
        </DesktopSectionCard>
      </aside>
    </div>
    </div>

    <div data-dashboard-secondary className="hidden gap-5 md:grid">
      <div className="grid gap-5 xl:grid-cols-2">
        <DesktopSectionCard title="โครงการที่กำลังดำเนินการ" detail={`${activeProjectCards.length} โปรเจกต์`} attribute="data-dashboard-active-projects">
          {activeProjectCards.length > 0 ? <div className="grid gap-2">{activeProjectCards.map((entry) => <DashboardProjectStripCard key={entry.id} project={entry} progress={calculateWeightedProgress(entry)} isActive={entry.id === activeProjectId} onSelect={() => onOpenProject(entry.id)} />)}</div> : <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">ยังไม่มีโปรเจกต์ที่กำลังดำเนินการ</div>}
        </DesktopSectionCard>
        <DesktopSectionCard title="ปัญหาและแผนงาน" detail={`${issueRows.length} รายการที่ต้องติดตาม`} attribute="data-dashboard-issue-watch">
          <div className="grid gap-2">{issueRows.length > 0 ? issueRows.slice(0, 4).map((issue) => <div key={issue.id} className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-3"><p className="text-sm font-bold text-slate-800">{issue.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{issue.detail}</p></div>) : <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">ยังไม่มีปัญหาที่ต้องติดตาม</p>}<div className="rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700"><span className="text-slate-500">แผนถัดไป: </span>{todayPulse.nextPlan || "ยังไม่มีแผนถัดไป"}</div></div>
        </DesktopSectionCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <DesktopSectionCard title="ภาพรวมตัวชี้วัด" detail="ข้อมูลเพิ่มเติมสำหรับการติดตามงาน" attribute="data-dashboard-dashboard-metrics"><DashboardMetricStrip items={metricItems} /></DesktopSectionCard>
        <div className="grid gap-5"><div data-dashboard-section="daily-calendar"><PersonalScheduleCard /></div><div data-dashboard-section="ceo-quotes"><CeoQuotesCard /></div></div>
      </div>
    </div>

    <div className="hidden">
    <div
      data-dashboard-layout="split-1-0.75"
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]"
    >
      {project ? (
        <div data-dashboard-section="project-running" className="xl:col-start-1 xl:row-start-1">
            <Card className="min-w-0 overflow-hidden bg-[linear-gradient(160deg,rgba(255,255,255,0.99),rgba(240,253,244,0.82))]">
              <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[128px_minmax(0,1fr)_220px] xl:items-start">
                <div className="w-full max-w-[128px] justify-self-start">
                  <PlaceholderProjectVisual
                    label={project.status || "Project"}
                    compact
                    imageUrl={project.coverImage?.dataUrl}
                    imageAlt={project.coverImage?.name ?? project.name}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 max-w-3xl break-words text-[1.75rem] font-black leading-[1.08] tracking-tight text-slate-950 sm:text-[2.05rem]">{project.name}</h2>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{project.status}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {project.customer.siteAddress || "ยังไม่ระบุที่ตั้งไซต์งาน"}
                  </p>
                  <div className="mt-5 grid max-w-full grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3 sm:max-w-[520px]">
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm xl:flex xl:items-center xl:justify-between 2xl:block">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Owner</p>
                      <p className="mt-2 break-words text-sm font-bold text-slate-900 xl:mt-0 xl:text-right 2xl:mt-2 2xl:text-left">{project.owner || "ยังไม่ระบุ"}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm xl:flex xl:items-center xl:justify-between 2xl:block">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Timeline</p>
                      <p className="mt-2 break-words text-sm font-bold text-slate-900 xl:mt-0 xl:text-right 2xl:mt-2 2xl:text-left">{formatDashboardDateSpan(project.timeline.startDate, project.timeline.dueDate)}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm xl:flex xl:items-center xl:justify-between 2xl:block">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Last report</p>
                      <p className="mt-2 break-words text-sm font-bold text-slate-900 xl:mt-0 xl:text-right 2xl:mt-2 2xl:text-left">{formatDashboardShortDate(reportSnapshot?.reportDate)}</p>
                    </div>
                  </div>
                </div>
                <div className="w-full max-w-full min-w-0 rounded-[24px] border border-emerald-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:max-w-[220px] sm:rounded-[28px] sm:p-5 xl:justify-self-end">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">ความคืบหน้ารวม</p>
                    <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{formatPercent(projectProgress)}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-500">คำนวณจาก weighted BOQ progress ตามกฎเดิมของระบบ</p>
                  </div>
                  <div className="mt-5">
                    <ProgressBar value={projectProgress} />
                  </div>
                  <div className="mt-5 grid gap-2">
                    <Button className="w-full max-w-full min-w-0 whitespace-normal" onClick={() => onOpenDailyReport(project.id)}>
                      เปิด Daily Report ของวันนี้
                    </Button>
                    <Button className="w-full max-w-full min-w-0 whitespace-normal" variant="secondary" onClick={() => onOpenProject(project.id)}>
                      ดูรายละเอียดโครงการ
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
        </div>
      ) : null}

      {project ? (
        <div data-dashboard-section="today-pulse" className="xl:col-start-1 xl:row-start-2">
          <TodayPulse
            pulse={todayPulse}
            onOpenDailyReport={() => onOpenDailyReport(project.id)}
            onOpenProject={() => onOpenProject(project.id)}
          />
        </div>
      ) : null}

      {dashboardProjects.length > 0 ? (
        <div data-dashboard-section="active-projects" className="xl:col-start-1 xl:row-start-3">
            <Card className="min-w-0">
              <DashboardSectionHeading eyebrow="Active Projects" title="Active Projects" actionLabel={`${Math.min(3, activeProjectCards.length)} / ${activeProjectCards.length} ในหน้าหลัก`} />
              <div
                data-active-projects-strip
                data-active-project-window="3"
                className="mt-5 grid max-w-full gap-4 sm:flex sm:snap-x sm:snap-mandatory sm:overflow-x-auto sm:overscroll-x-contain sm:pb-2"
              >
                {activeProjectCards.map((entry) => (
                  <DashboardProjectStripCard
                    key={entry.id}
                    project={entry}
                    progress={calculateWeightedProgress(entry)}
                    isActive={entry.id === activeProjectId}
                    onSelect={() => onOpenProject(entry.id)}
                  />
                ))}
              </div>
            </Card>
        </div>
      ) : null}

      <div data-dashboard-section="new-project" className="xl:col-start-1 xl:row-start-4">
        {successProjects.length > 0 ? (
          <div data-dashboard-section="success-projects" className="mb-6">
            <Card className="min-w-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,244,0.86))]">
              <DashboardSectionHeading eyebrow="Success Project" title="Success Project" actionLabel={`${successProjects.length} โปรเจกต์จบงาน`} />
              <div className="mt-5 grid gap-3">
                {successProjects.map((entry) => {
                  const successProgress = calculateWeightedProgress(entry);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className="rounded-[24px] border border-emerald-100 bg-white px-4 py-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                      onClick={() => onOpenProject(entry.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-base font-black text-slate-950">{entry.name || "Project"}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {entry.customer.name || "ยังไม่ระบุลูกค้า"} • {formatDashboardDateSpan(entry.timeline.startDate, entry.timeline.dueDate)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                          {formatPercent(successProgress)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : null}
        <Card className="min-w-0 overflow-hidden border-emerald-100 bg-[linear-gradient(145deg,#ffffff_0%,#f0fdf4_100%)]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.72fr)] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{entryGuidance.eyebrow}</p>
              <h2 className="mt-2 max-w-[22ch] break-words text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
                {entryGuidance.title}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{entryGuidance.description}</p>
              {project ? (
                <p className="mt-3 text-sm font-bold text-slate-500">
                  โปรเจกต์ปัจจุบัน: <span className="text-slate-950">{project.name}</span> • {formatPercent(projectProgress)}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 lg:justify-items-stretch">
              <Button
                className="w-full max-w-full min-w-0 whitespace-normal"
                aria-label={project ? entryGuidance.primaryAction : "สร้างโปรเจกต์ใหม่"}
                onClick={() => (project ? onOpenDailyReport(project.id) : onNewProject())}
              >
                {entryGuidance.primaryAction}
              </Button>
              <Button
                className="w-full max-w-full min-w-0 whitespace-normal"
                variant="secondary"
                onClick={() => (project ? onOpenProject(project.id) : onNewProject())}
              >
                {entryGuidance.secondaryAction}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div data-dashboard-right-rail="paired-grid" className="contents">
        <div data-dashboard-section="issue-watch" className="xl:col-start-2 xl:row-start-1">
          <div className="w-full xl:max-w-[520px] xl:justify-self-end">
            <Card className="w-full">
              <DashboardSectionHeading eyebrow="Issue Watch" title="ประเด็นสำคัญ / ปัญหา" actionLabel={`${issueRows.length} รายการ`} />
              <div className="mt-5 grid gap-3">
                {issueRows.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-5">
                    <p className="text-sm font-black text-emerald-900">ยังไม่มีปัญหาที่ต้องติดตาม</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-700">ข้อมูลจะอัปเดตจาก Daily Report ล่าสุดของโปรเจกต์</p>
                  </div>
                ) : issueRows.slice(0, 4).map((issue, index) => (
                  <div key={issue.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">{issue.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{issue.detail}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                          index === 0
                            ? "bg-red-50 text-red-600"
                            : index === 1
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {index === 0 ? "สูง" : index === 1 ? "กลาง" : "ต่ำ"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div data-dashboard-section="daily-calendar" className="min-w-0 w-full xl:col-start-2 xl:row-start-2">
          <div className="w-full xl:max-w-[520px] xl:justify-self-end">
            <PersonalScheduleCard />
          </div>
        </div>

        <div data-dashboard-section="ceo-quotes" className="min-w-0 w-full xl:col-start-2 xl:row-start-3">
          <div className="w-full xl:max-w-[520px] xl:justify-self-end">
            <CeoQuotesCard />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:col-span-2 xl:row-start-5">
        <div data-dashboard-section="dashboard-metrics" className="min-w-0">
          <DashboardMetricStrip items={metricItems.map((item) => ({ ...item, valueTestId: undefined }))} />
        </div>

        {dashboardProjects.length === 0 ? (
          <Card data-dashboard-empty-state="first-project" className="min-h-[340px]">
            <div className="mx-auto grid max-w-3xl gap-6 py-4 text-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">เริ่มใช้งานใน 3 ขั้นตอน</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">ไม่ต้องเรียนระบบนาน ก็เริ่มคุมงานได้</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  ระบบจะพาคุณจากข้อมูลโครงการ ไปสู่การบันทึกหน้างานแบบเป็นขั้นตอน และเก็บข้อมูลไว้ในเครื่องทันที
                </p>
              </div>
              <div className="grid gap-3 text-left sm:grid-cols-3">
                {entryGuidance.steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:block sm:text-center">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-black text-white sm:mx-auto">{index + 1}</span>
                    <p className="text-sm font-black text-slate-800 sm:mt-3">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div data-dashboard-section="workstream-progress">
                <Card className="min-w-0 h-full">
                  <DashboardSectionHeading eyebrow="Workstream Progress" title="ภาพรวมความคืบหน้างาน" actionLabel={`${boqRows.length} หมวดหลัก`} />
                  <div className="mt-5 grid gap-4">
                    {boqRows.length > 0 ? (
                      boqRows.map((row) => (
                        <div key={row.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-900">{row.name}</p>
                              <p className="text-xs font-semibold text-slate-500" title={formatCurrency(row.total)}>
                                BOQ {formatCompactCurrency(row.total)}
                              </p>
                            </div>
                            <p className="text-lg font-black text-slate-950">{Math.round(row.progress)}%</p>
                          </div>
                          <ProgressBar value={row.progress} />
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                        เพิ่ม BOQ category และ item ในแท็บ Project เพื่อให้ dashboard แสดงความคืบหน้าเป็นหมวดงาน
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div data-dashboard-section="latest-daily-reports">
                <Card className="min-w-0 h-full">
                  <DashboardSectionHeading eyebrow="Latest Daily Reports" title="รายงานประจำวันล่าสุด" actionLabel={`${recentReports.length} รายการล่าสุด`} />
                  <div className="mt-5 grid gap-3">
                    {recentReports.length > 0 ? (
                      recentReports.map((report) => (
                        <button
                          key={report.id}
                          type="button"
                          className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                          onClick={() => onOpenDailyReport(report.projectId)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900">
                                {dashboardProjects.find((entry) => entry.id === report.projectId)?.name || "Project"}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-500">{report.reportDate}</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600">
                              {report.workers.reduce((total, worker) => total + worker.count, 0)} คน
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                            {report.summary || report.completedWork || report.ongoingWork || "ยังไม่มีข้อความสรุป"}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                        ยังไม่มี daily report ที่บันทึกแล้วสำหรับโปรเจกต์นี้
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {project ? (
              <div data-dashboard-section="today-snapshot">
                <Card className="min-w-0">
                  <DashboardSectionHeading eyebrow="Today Snapshot" title="สรุปจากรายงานวันนี้" actionLabel={reportSnapshot?.reportDate || "draft"} />
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Completed Work</p>
                      <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-600">
                        {completedLines.slice(0, 3).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Next Plan</p>
                      <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-600">
                        {nextPlanLines.slice(0, 3).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div data-dashboard-section="boq-summary">
                <Card className="min-w-0 h-full">
                  <DashboardSectionHeading eyebrow="BOQ Summary" title="สรุป BOQ" actionLabel={`${stats.active} โปรเจกต์ที่กำลังดำเนินการ`} />
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Portfolio Snapshot</p>
                      <div className="mt-4 grid gap-3">
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-semibold text-slate-500">โปรเจกต์ทั้งหมด</span>
                          <span className="text-lg font-black text-slate-950">{stats.total}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-semibold text-slate-500">โปรเจกต์ที่ปิดแล้ว</span>
                          <span className="text-lg font-black text-slate-950">{stats.done}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-semibold text-slate-500">มูลค่า BOQ รวม</span>
                          <span className="text-lg font-black text-slate-950" title={formatCurrency(stats.value)}>
                            {formatCompactCurrency(stats.value)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Active Project Lens</p>
                      <div className="mt-4 grid gap-3">
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-semibold text-slate-500">BOQ โปรเจกต์ปัจจุบัน</span>
                          <span className="text-lg font-black text-slate-950" title={formatCurrency(projectTotal)}>
                            {formatCompactCurrency(projectTotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-semibold text-slate-500">งบประมาณรวม</span>
                          <span className="text-lg font-black text-slate-950" title={formatCurrency(totalContract)}>
                            {formatCompactCurrency(totalContract)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-semibold text-slate-500">Progress รวม</span>
                          <span className="text-lg font-black text-slate-950">{formatPercent(projectProgress)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div data-dashboard-section="insight-board">
                <Card className="min-w-0 h-full">
                  <DashboardSectionHeading eyebrow="Insight board" title="Insight board" actionLabel="Live now + compact preview" />
                  <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Live Snapshot</p>
                      <div className="mt-4 grid gap-4">
                        <div>
                          <p className="text-sm font-black text-slate-900">งานที่กำลังดำเนินการ</p>
                          <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-600">
                            {ongoingLines.slice(0, 3).map((line) => (
                              <li key={line} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">วัสดุ / แผนถัดไป</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
                              {materialLines[0]}
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
                              {nextPlanLines[0]}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,rgba(236,253,245,0.95),rgba(255,255,255,0.96))] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Data status</p>
                      <h4 className="mt-2 text-base font-black text-slate-950">ข้อมูลหน้างานล่าสุด</h4>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {reportSnapshot
                          ? `อัปเดตจากรายงานวันที่ ${reportSnapshot.reportDate}`
                          : "ยังไม่มี Daily Report ที่บันทึกสำหรับโปรเจกต์นี้"}
                      </p>
                      <div className="mt-3 rounded-2xl border border-emerald-100 bg-white px-3 py-2 text-[11px] font-bold leading-5 text-emerald-700">
                        {recentReports.length} รายงานล่าสุดพร้อมใช้งาน
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </div>
    </>
  );
}
