"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  DAILY_PROGRESS_PRESETS,
  applyProgressPreset,
  calculateCategoryProgress,
  calculateOverallBoqTotal,
  calculateWeightedProgress,
  formatCompactCurrency,
  formatPercent
} from "@/lib/project-calculations";
import { buildDailyChecklist, dailyChecklistAnchorIds, type DailyChecklistItemId } from "@/lib/daily-report-checklist";
import {
  DAILY_REPORT_MEDIA_RETENTION_DAYS,
  MAX_DAILY_REPORT_PHOTOS,
  MAX_PROBLEM_ISSUE_PHOTOS
} from "@/lib/daily-report-media";
import type { DailyReportPermissions } from "@/lib/daily-report-permissions";
import { createCanonicalDailyProgressUpdates, createDailyReportPdfSnapshot } from "@/lib/daily-report-progress";
import {
  getDailyQuickSectionStatus,
  getDailyReportSaveFeedback,
  resolveDailyQuickSection,
  type DailyQuickSection as DailyQuickSectionId
} from "@/lib/project-control/daily-report-quick-view-model";
import { formatThaiReportDate, getDailyReferenceSectionMeta } from "@/lib/project-control/daily-report-ui";
import { serializeDailyWorkItems } from "@/lib/project-control/daily-work-items";
import type { DailyWorkItemStatus } from "@/lib/project-control/types";
import type {
  Crew,
  DailyProblemIssue,
  DailyProgressUpdate,
  DailyReport,
  DailyWorker,
  Project
} from "@/lib/project-storage";
import {
  Button,
  Card,
  DashboardMetricTile,
  Field,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  Select,
  TextArea,
  TextInput
} from "../shared/ui";
import { numberFromInput, tradeOptions } from "../shared/utils";
import { DailyQuickSection } from "./daily-quick-section";
import { DailySaveBar } from "./daily-save-bar";
import { DailyWorkItemEditor } from "./daily-work-item-editor";

type DailyMobileSection = DailyQuickSectionId;
const taskStatusOptions: Array<DailyWorker["taskStatus"]> = ["ดำเนินการ", "แก้ไข", "เสร็จ"];
const problemCountPresets = [0, 1, 2, 3, 4, 5];

const DailyReportSheetContent = dynamic(
  () => import("../pdf/daily-report-sheet").then((module) => module.DailyReportSheetContent),
  { loading: () => <div className="min-h-[1123px] w-[794px] animate-pulse bg-slate-100" /> }
);

function normalizeDailyReportWorkers(workers: DailyWorker[]): DailyWorker[] {
  return workers
    .filter(
      (worker) =>
        worker.name.trim() ||
        worker.crewId?.trim() ||
        worker.taskTitle.trim() ||
        worker.note.trim() ||
        worker.startTime !== "08:00" ||
        worker.endTime !== "17:00" ||
        worker.trade !== "ทั่วไป" ||
        worker.taskStatus !== "ดำเนินการ" ||
        worker.count !== 1
    )
    .map((worker) => ({ ...worker, count: Math.max(0, worker.count) }));
}

function normalizeDailyReportWithBoqProgress(
  project: Project,
  report: DailyReport,
  previousReport: DailyReport | null = null
): DailyReport {
  return {
    ...report,
    workers: normalizeDailyReportWorkers(report.workers),
    progressUpdates: createCanonicalDailyProgressUpdates(project, report.progressUpdates, previousReport)
  };
}
function DailyReportActionBar({
  reportDate,
  projectName,
  status,
  modeLabel,
  modeClassName,
  onDateChange,
  onNew,
  onSave,
  isSavingReport,
  onExport,
  onSavePdf,
  onPreviewPdf,
  onDelete,
  permissions
}: {
  reportDate: string;
  projectName: string;
  status: string;
  modeLabel: string;
  modeClassName: string;
  onDateChange: (reportDate: string) => void;
  onNew: () => void;
  onSave: () => void | Promise<unknown>;
  isSavingReport: boolean;
  onExport: () => void;
  onSavePdf: () => void | Promise<void>;
  onPreviewPdf: () => void;
  onDelete: () => void;
  permissions: DailyReportPermissions;
}) {
  return (
    <Card data-daily-desktop-action-bar className="border-emerald-200/80 bg-white/95 p-3 backdrop-blur md:sticky md:top-3 md:z-20">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,330px)_auto] md:items-center">
        <div className="min-w-0">
          <p className="text-sm font-black text-emerald-700">รายงานประจำวัน</p>
          <h2 className="mt-1 line-clamp-1 text-2xl font-black tracking-tight text-slate-950" title={projectName}>
            {projectName}
          </h2>
          <p className="mt-1 text-xs font-bold text-slate-500">สถานะโปรเจกต์: {status || "-"}</p>
          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${modeClassName}`}>{modeLabel}</span>
        </div>
        <Field label="วันที่รายงาน">
          <TextInput type="date" value={reportDate} onChange={(event) => onDateChange(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap md:justify-end">
          {permissions.canSaveReport ? (
            <Button className="hidden w-full sm:w-auto md:inline-flex" onClick={onSave} disabled={isSavingReport}>
              {isSavingReport ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-t-white" aria-hidden="true" />
                  Saving...
                </span>
              ) : (
                "Save Report"
              )}
            </Button>
          ) : null}
          <div className="hidden gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {permissions.canSavePdf ? (
              <Button className="w-full sm:w-auto" variant="secondary" onClick={onSavePdf}>
                Save PDF
              </Button>
            ) : null}
            {permissions.canPreviewPdf ? (
              <Button className="w-full sm:w-auto" variant="secondary" onClick={onPreviewPdf}>
                Preview PDF
              </Button>
            ) : null}
            {permissions.canExportJson ? (
              <Button className="w-full sm:w-auto" variant="secondary" onClick={onExport}>
                ส่งออก JSON
              </Button>
            ) : null}
            {permissions.canCreateReport ? (
              <Button className="w-full sm:w-auto" variant="ghost" onClick={onNew}>
                รายงานใหม่
              </Button>
            ) : null}
            {permissions.canDeleteReport ? (
              <Button className="w-full sm:w-auto" variant="danger" onClick={onDelete}>
                ลบ
              </Button>
            ) : null}
          </div>
          <details data-daily-secondary-tools className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:hidden">
            <summary className="cursor-pointer list-none py-1 text-sm font-black text-slate-700">เครื่องมือเพิ่มเติม</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {permissions.canSavePdf ? <Button variant="secondary" onClick={onSavePdf}>Save PDF</Button> : null}
              {permissions.canPreviewPdf ? <Button variant="secondary" onClick={onPreviewPdf}>Preview PDF</Button> : null}
              {permissions.canExportJson ? <Button variant="secondary" onClick={onExport}>ส่งออก JSON</Button> : null}
              {permissions.canCreateReport ? <Button variant="ghost" onClick={onNew}>รายงานใหม่</Button> : null}
              {permissions.canDeleteReport ? <Button variant="danger" onClick={onDelete}>ลบ</Button> : null}
            </div>
          </details>
        </div>
      </div>
    </Card>
  );
}
export function DailyReportView({
  activeProject,
  draft,
  reports,
  totalWorkers,
  reporterName,
  reporterPhone,
  updateDraft,
  confirmChecklistItem,
  changeReportDate,
  newReport,
  saveReport,
  saveStatus,
  isSavingReport,
  exportReport,
  previewPdf,
  exportPdf,
  permissions,
  closePdfPreview,
  showPdfPreview,
  pdfExportRef,
  isExportingPdf,
  hidePdfCompanyName,
  setHidePdfCompanyName,
  activeCompanyName,
  deleteDraft,
  openReport,
  deleteReport,
  addWorker,
  updateWorker,
  deleteWorker,
  registeredCrews,
  saveWorkerAsCrew,
  openHr,
  openBuyin,
  setProblemIssueCount,
  addProblemIssue,
  updateProblemIssue,
  deleteProblemIssue,
  uploadProblemIssuePhotos,
  removeProblemIssuePhoto,
  updateProgressUpdate,
  uploadPhotos,
  removePhoto
}: {
  activeProject: Project;
  draft: DailyReport;
  reports: DailyReport[];
  totalWorkers: number;
  reporterName: string;
  reporterPhone: string;
  updateDraft: (patch: Partial<DailyReport>, confirmedItems?: DailyChecklistItemId[]) => void;
  confirmChecklistItem: (itemId: DailyChecklistItemId) => void;
  changeReportDate: (reportDate: string) => void;
  newReport: () => void;
  saveReport: () => void | Promise<unknown>;
  saveStatus: "idle" | "saving" | "saved" | "error";
  isSavingReport: boolean;
  exportReport: () => void;
  previewPdf: () => void;
  exportPdf: () => void;
  permissions: DailyReportPermissions;
  closePdfPreview: () => void;
  showPdfPreview: boolean;
  pdfExportRef: React.RefObject<HTMLDivElement | null>;
  isExportingPdf: boolean;
  hidePdfCompanyName: boolean;
  setHidePdfCompanyName: (value: boolean) => void;
  activeCompanyName: string;
  deleteDraft: () => void;
  openReport: (report: DailyReport) => void;
  deleteReport: (reportId: string) => void;
  addWorker: () => void;
  updateWorker: (workerId: string, patch: Partial<DailyWorker>) => void;
  deleteWorker: (workerId: string) => void;
  registeredCrews: Crew[];
  saveWorkerAsCrew: (worker: DailyWorker) => void;
  openHr: () => void;
  openBuyin: () => void;
  setProblemIssueCount: (targetCount: number) => void;
  addProblemIssue: () => void;
  updateProblemIssue: (issueId: string, patch: Partial<DailyProblemIssue>) => void;
  deleteProblemIssue: (issueId: string) => void;
  uploadProblemIssuePhotos: (issueId: string, fileList: FileList | null) => Promise<void>;
  removeProblemIssuePhoto: (issueId: string, photoId: string) => void;
  updateProgressUpdate: (updateId: string, patch: Partial<DailyProgressUpdate>) => void;
  uploadPhotos: (fileList: FileList | null) => Promise<void>;
  removePhoto: (photoId: string) => void;
}) {
  const progress = calculateWeightedProgress(activeProject);
  const boqTotal = calculateOverallBoqTotal(activeProject);
  const estimatedBudgetUsed = activeProject.boq.reduce(
    (total, category) =>
      total + category.items.reduce((categoryTotal, item) => categoryTotal + item.quantity * item.unitPrice * (item.progress / 100), 0),
    0
  );
  const itemOptions = activeProject.boq.flatMap((category) =>
    category.items.map((item) => ({
      value: `${category.id}:${item.id}`,
      label: `${category.name} / ${item.description}`,
      progress: item.progress
    }))
  );
  const completedTasks = draft.progressUpdates.filter((item) => item.newProgress >= 100).length;
  const activeIssues = draft.problemIssues.length;
  const checklistItems = buildDailyChecklist(draft);
  const siteSignalCount = [
    draft.materials.trim(),
    draft.workers.some((worker) => worker.name.trim() || worker.count > 1) ? "workers" : ""
  ].filter(Boolean).length;
  const problemIssueTotal = Math.max(1, draft.problemIssues.length);
  const completedProblemIssueCount = draft.problemIssues.filter(
    (issue) => issue.title.trim() || issue.detail.trim() || issue.photos.length > 0
  ).length;
  const problemSectionCompletedCount =
    draft.problemIssues.length > 0 ? completedProblemIssueCount : draft.problems.trim() ? 1 : 0;
  const dailySectionMeta = {
    work: getDailyReferenceSectionMeta(
      "work",
      getDailyQuickSectionStatus(draft, "work"),
      [draft.summary, draft.completedWork, draft.ongoingWork].filter((value) => value.trim()).length,
      3
    ),
    site: getDailyReferenceSectionMeta(
      "site",
      getDailyQuickSectionStatus(draft, "site"),
      siteSignalCount,
      2
    ),
    progress: getDailyReferenceSectionMeta(
      "progress",
      getDailyQuickSectionStatus(draft, "progress"),
      draft.progressUpdates.some((update) => update.title.trim() || update.newProgress !== update.previousProgress) ? 1 : 0,
      1
    ),
    plan: getDailyReferenceSectionMeta(
      "plan",
      getDailyQuickSectionStatus(draft, "plan"),
      draft.nextPlan.trim() ? 1 : 0,
      1
    ),
    problems: getDailyReferenceSectionMeta(
      "problems",
      getDailyQuickSectionStatus(draft, "problems"),
      problemSectionCompletedCount,
      problemIssueTotal
    ),
    photos: getDailyReferenceSectionMeta(
      "photos",
      getDailyQuickSectionStatus(draft, "photos"),
      draft.photos.length > 0 ? 1 : 0,
      1
    )
  };
  const materialsCount = draft.materials
    .split(/\n|,/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  const workRows =
    draft.progressUpdates.length > 0
      ? draft.progressUpdates.map((update) => ({
          id: update.id,
          title: update.title || "Progress update",
          status:
            update.newProgress >= 100 ? "Completed" : update.newProgress > update.previousProgress ? "In Progress" : "Not Started",
          detail:
            update.newProgress >= 100
              ? `Completed at ${update.newProgress}%`
              : update.newProgress > update.previousProgress
                ? `In Progress • ${update.newProgress}%`
                : "Not Started",
          tone:
            update.newProgress >= 100 ? "emerald" : update.newProgress > update.previousProgress ? "blue" : "slate"
        }))
      : activeProject.boq
          .flatMap((category) =>
            category.items.slice(0, 4).map((item) => ({
              id: item.id,
              title: `${item.description || "BOQ item"}${category.name ? ` - ${category.name}` : ""}`,
              status: item.progress >= 100 ? "Completed" : item.progress > 0 ? "In Progress" : "Not Started",
              detail: item.progress >= 100 ? "Completed" : item.progress > 0 ? `In Progress • ${item.progress}%` : "Not Started",
              tone: item.progress >= 100 ? "emerald" : item.progress > 0 ? "blue" : "slate"
            }))
          )
          .slice(0, 4);
  const historyReportOptions = reports.map((report) => ({
    report,
    workerCount: report.workers.reduce((total, worker) => total + worker.count, 0),
    issueCount: report.problemIssues.length
  }));
  const isEditingSavedReport = reports.some((report) => report.id === draft.id);
  const thaiReportDate = formatThaiReportDate(draft.reportDate);
  const reportModeLabel = isEditingSavedReport ? "Editing saved report" : "Creating new report";
  const reportModeClassName = isEditingSavedReport ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700";
  const saveFeedback = getDailyReportSaveFeedback(saveStatus, isEditingSavedReport);
  const selectedHistoryReport =
    reports.find((report) => report.id === draft.id) ??
    reports.find((report) => report.reportDate === draft.reportDate) ??
    reports[0] ??
    null;
  const selectedHistoryOption = historyReportOptions.find((option) => option.report.id === selectedHistoryReport?.id) ?? null;
  const historyWorkdayCount = new Set(reports.map((report) => report.reportDate)).size;
  const isCarryForwardDraft = Boolean(draft.carryForwardSourceDate) && !isEditingSavedReport;
  const [activeMobileSection, setActiveMobileSection] = useState<DailyMobileSection>("work");
  const [showReportHistory, setShowReportHistory] = useState(false);
  const previousDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousDraftIdRef.current === draft.id) {
      return;
    }

    previousDraftIdRef.current = draft.id;
    setActiveMobileSection("work");
    if (isEditingSavedReport) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      const summaryField = document.querySelector<HTMLInputElement | HTMLTextAreaElement>("[data-mobile-daily-summary]");
      const activeElement = document.activeElement;
      const activeField =
        activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement;
      if (!summaryField || summaryField.offsetParent === null || activeField) {
        return;
      }
      summaryField?.focus({ preventScroll: true });
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [draft.id, isEditingSavedReport]);

  function revealChecklistItem(item: (typeof checklistItems)[number]) {
    const targetSection = resolveDailyQuickSection(item.id);

    setActiveMobileSection(targetSection);
    confirmChecklistItem(item.id);
    window.requestAnimationFrame(() => {
      const section =
        Array.from(document.querySelectorAll<HTMLElement>("[data-daily-report-anchor]"))
          .find((candidate) => candidate.dataset.dailyReportAnchor === item.anchorId && candidate.offsetParent !== null) ??
        document.getElementById(item.anchorId);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = Array.from(section?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select") ?? []).find(
        (field) => !field.disabled && field.offsetParent !== null
      );
      const firstButton = Array.from(section?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
        (button) => !button.disabled && button.offsetParent !== null
      );
      (firstField ?? firstButton)?.focus({ preventScroll: true });
    });
  }

  function commitWorkItems(workItems: DailyReport["workItems"]) {
    updateDraft({ workItems, ...serializeDailyWorkItems(workItems) }, ["completedWork", "ongoingWork"]);
  }

  function addWorkItem(title: string, status: DailyWorkItemStatus) {
    commitWorkItems([...draft.workItems, { id: crypto.randomUUID(), title, status }]);
  }

  function toggleWorkItem(itemId: string) {
    commitWorkItems(draft.workItems.map((item) => item.id === itemId ? { ...item, status: item.status === "completed" ? "ongoing" : "completed" } : item));
  }

  function updateWorkItemTitle(itemId: string, title: string) {
    commitWorkItems(draft.workItems.map((item) => item.id === itemId ? { ...item, title } : item));
  }

  function deleteWorkItem(itemId: string) {
    commitWorkItems(draft.workItems.filter((item) => item.id !== itemId));
  }
  const reportHistoryCard = (
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Report History</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">ประวัติรายงาน</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">ทำงานมาแล้ว</p>
              <p className="mt-1 text-xl font-black text-slate-950">{historyWorkdayCount} วัน</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">มีรายงาน</p>
              <p className="mt-1 text-xl font-black text-slate-950">{reports.length} ใบ</p>
            </div>
          </div>
        </div>
        {reports.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">ยังไม่มีรายงานย้อนหลัง</div>
        ) : (
          <div className="mt-4 grid gap-3">
            <Field label="เลือกวันที่มีรายงาน">
              <Select
                value={selectedHistoryReport?.id ?? ""}
                onChange={(event) => {
                  const selectedReport = reports.find((report) => report.id === event.target.value);
                  if (selectedReport) {
                    openReport(selectedReport);
                  }
                }}
              >
                {historyReportOptions.map(({ report, workerCount, issueCount }) => (
                  <option key={report.id} value={report.id}>
                    {report.reportDate} • {workerCount} คน • {issueCount} ปัญหา
                  </option>
                ))}
              </Select>
            </Field>

            {selectedHistoryReport && selectedHistoryOption ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">{selectedHistoryReport.reportDate}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{selectedHistoryReport.summary || "ไม่มีสรุป"}</p>
                    <p className="mt-1 text-xs leading-5 text-red-600">
                      {selectedHistoryReport.problemIssues.length > 0
                        ? `${selectedHistoryReport.problemIssues.length} ปัญหา • ${selectedHistoryReport.problems || "มีรายละเอียดในรายการปัญหา"}`
                        : selectedHistoryReport.problems || "ไม่มีปัญหาสำคัญ"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                      {selectedHistoryOption.workerCount} คน
                    </div>
                    <div className="rounded-full bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">
                      {selectedHistoryReport.progressUpdates.length} progress
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => openReport(selectedHistoryReport)}>
                    Open report
                  </Button>
                  {permissions.canDeleteReport ? (
                    <Button variant="danger" onClick={() => deleteReport(selectedHistoryReport.id)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>
  );
  const boqCategoryRows = activeProject.boq.map((category) => ({
    id: category.id,
    name: category.name,
    progress: calculateCategoryProgress(category)
  }));
  const pdfPreviewCardRef = useRef<HTMLDivElement | null>(null);
  const pdfPreviewViewportRef = useRef<HTMLDivElement | null>(null);
  const pdfPreviewDocumentRef = useRef<HTMLDivElement | null>(null);
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewViewportHeight, setPreviewViewportHeight] = useState(0);
  const [previewDocumentHeight, setPreviewDocumentHeight] = useState(1123);
  const [isPdfPreviewControlsHidden, setIsPdfPreviewControlsHidden] = useState(false);
  const previousReportForDraft = reports.find((report) => report.id !== draft.id && report.reportDate < draft.reportDate) ?? null;
  const normalizedDraftForPdf = normalizeDailyReportWithBoqProgress(activeProject, draft, previousReportForDraft);
  const pdfSnapshot = createDailyReportPdfSnapshot(activeProject, normalizedDraftForPdf, previousReportForDraft);

  useEffect(() => {
    if (!showPdfPreview) {
      return;
    }

    const resetControlsTimer = window.setTimeout(() => {
      setIsPdfPreviewControlsHidden(false);
    }, 0);
    const syncPreviewViewport = () => {
      const nextIsMobilePreview = window.innerWidth < 1024;
      const previewBaseWidth = 794;
      const viewportWidth = pdfPreviewViewportRef.current?.clientWidth ?? window.innerWidth;
      const availableWidth = Math.max(1, viewportWidth - (nextIsMobilePreview ? 24 : 0));
      const nextPreviewDocumentHeight = Math.max(1123, pdfPreviewDocumentRef.current?.scrollHeight ?? 1123);

      setIsMobilePreview(nextIsMobilePreview);
      setPreviewScale(Math.min(1, availableWidth / previewBaseWidth));
      setPreviewViewportHeight(window.innerHeight);
      setPreviewDocumentHeight(nextPreviewDocumentHeight);
    };

    const previewFrame = window.requestAnimationFrame(syncPreviewViewport);
    window.addEventListener("resize", syncPreviewViewport);

    return () => {
      window.clearTimeout(resetControlsTimer);
      window.cancelAnimationFrame(previewFrame);
      window.removeEventListener("resize", syncPreviewViewport);
    };
  }, [showPdfPreview]);

  useEffect(() => {
    if (!showPdfPreview) {
      return;
    }

    const previewTimer = window.setTimeout(() => {
      if (window.innerWidth >= 1024) {
        pdfPreviewCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);

    return () => window.clearTimeout(previewTimer);
  }, [showPdfPreview]);

  const previewSurface = (
    <>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-600">
        <span>A4 preview</span>
        <span className="text-right">210 x 297 mm • export จะใช้สเกลเดียวกับกรอบกระดาษนี้</span>
      </div>
      <div
        className="mx-auto overflow-hidden rounded-[24px] bg-white shadow-xl"
        style={{
          width: `${Math.round(794 * previewScale)}px`,
          height: `${Math.round(previewDocumentHeight * previewScale)}px`
        }}
      >
        <div
          ref={pdfPreviewDocumentRef}
          className="origin-top"
          style={{
            width: "794px",
            transform: `scale(${previewScale})`,
            transformOrigin: "top left"
          }}
        >
          <DailyReportSheetContent
            project={pdfSnapshot.project}
            report={pdfSnapshot.report}
            companyName={activeCompanyName}
            hideCompanyName={hidePdfCompanyName}
            reporterName={reporterName}
            reporterPhone={reporterPhone}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="grid gap-3 pb-40 xl:gap-5 xl:pb-0">
      <div className="hidden xl:block">
        <DailyReportActionBar
          reportDate={draft.reportDate}
          projectName={activeProject.name}
          status={activeProject.status}
          modeLabel={reportModeLabel}
          modeClassName={reportModeClassName}
          onDateChange={changeReportDate}
          onNew={newReport}
          onSave={saveReport}
          isSavingReport={isSavingReport}
          onExport={exportReport}
          onSavePdf={exportPdf}
          onPreviewPdf={previewPdf}
          onDelete={deleteDraft}
          permissions={permissions}
        />
      </div>

      {showPdfPreview ? (
        <div ref={pdfPreviewCardRef} className="fixed inset-0 z-50 bg-slate-950/45 lg:static lg:z-auto lg:bg-transparent">
          <Card
            className={
              isMobilePreview
                ? "flex h-full flex-col rounded-none border-0 bg-slate-100 p-0 shadow-none"
                : "overflow-hidden border-slate-300 bg-slate-100/70"
            }
          >
            <div
              className={
                isMobilePreview
                  ? `sticky top-0 z-10 border-b border-slate-200 bg-white transition-all ${isPdfPreviewControlsHidden ? "px-3 py-2" : "px-4 py-4"}`
                  : ""
              }
            >
              <div className="flex flex-col items-start justify-start gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-500">Preview PDF</p>
                  {isPdfPreviewControlsHidden && isMobilePreview ? null : (
                    <>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">ดูหน้ากระดาษก่อน export</h3>
                      <p className="mt-2 text-sm text-slate-600">เช็ก layout, ข้อความ, และรูป ก่อนกด Download</p>
                    </>
                  )}
                </div>
                {isPdfPreviewControlsHidden && isMobilePreview ? (
                  <div className="flex w-full items-center justify-between gap-2">
                    <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setIsPdfPreviewControlsHidden(false)}>
                      Show
                    </Button>
                    <button
                      type="button"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-lg font-black text-slate-600 shadow-sm"
                      onClick={closePdfPreview}
                      aria-label="ปิด preview"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap lg:w-auto">
                    <Button className="w-full sm:w-auto" onClick={exportPdf} disabled={isExportingPdf}>
                      {isExportingPdf ? "กำลังสร้าง PDF..." : "Download"}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant={hidePdfCompanyName ? "primary" : "secondary"}
                      onClick={() => setHidePdfCompanyName(!hidePdfCompanyName)}
                    >
                      {hidePdfCompanyName ? "แสดงชื่อบริษัท" : "ซ่อนชื่อบริษัท"}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="secondary"
                      onClick={() => {
                        if (isMobilePreview) {
                          setIsPdfPreviewControlsHidden(true);
                          return;
                        }

                        closePdfPreview();
                      }}
                    >
                      Hide
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {isMobilePreview ? (
              <div
                ref={pdfPreviewViewportRef}
                className={`flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 overscroll-contain ${isPdfPreviewControlsHidden ? "pt-2" : "pt-3"}`}
                style={{
                  maxHeight: previewViewportHeight
                    ? `${Math.max(320, previewViewportHeight - (isPdfPreviewControlsHidden ? 68 : 104))}px`
                    : undefined
                }}
              >
                <div className="rounded-[28px] border border-slate-200 bg-slate-200 p-3">{previewSurface}</div>
              </div>
            ) : (
              <div
                ref={pdfPreviewViewportRef}
                className="mt-4 max-h-[calc(100vh-8rem)] w-full min-w-0 max-w-full overflow-auto rounded-[28px] border border-slate-200 bg-slate-200 p-3 overscroll-contain"
              >
                {previewSurface}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {showPdfPreview || isExportingPdf ? (
        <div
          ref={pdfExportRef}
          data-pdf-export-root="true"
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 -z-10 w-[794px] min-w-[794px] max-w-[794px] bg-white"
        >
          <DailyReportSheetContent
            project={pdfSnapshot.project}
            report={pdfSnapshot.report}
            companyName={activeCompanyName}
            hideCompanyName={hidePdfCompanyName}
            reporterName={reporterName}
            reporterPhone={reporterPhone}
          />
        </div>
      ) : null}

      <div className="hidden" aria-hidden="true">
        {checklistItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => revealChecklistItem(item)}
            className={`min-w-0 rounded-full border px-3 py-2 text-left text-[11px] font-black sm:flex-none sm:px-4 sm:text-xs ${
              item.completed ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800"
            }`}
          >
            <span className="block truncate sm:whitespace-nowrap">
              {item.completed ? "✓" : "!"} {item.label}
            </span>
          </button>
        ))}
      </div>

      <div data-daily-report-section="hero">
        <Card data-daily-desktop-summary className="overflow-hidden border-0 bg-white p-0 shadow-none sm:p-5 md:border md:p-5 md:shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
          <div className="flex items-end justify-between gap-3 pb-4 md:border-b md:border-slate-100">
            <div>
              <p className="text-[26px] font-black tracking-tight text-slate-950">วันนี้</p>
              <p className="mt-2 text-base font-black text-slate-800">{thaiReportDate.dateLabel}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">{thaiReportDate.weekdayLabel}</p>
            </div>
            <label className="relative flex min-h-12 shrink-0 cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3 text-center text-xs font-black text-slate-700">
              <span>▣&nbsp; เปลี่ยนวันที่</span>
              <TextInput
                aria-label="เปลี่ยนวันที่"
                type="date"
                value={draft.reportDate}
                onChange={(event) => changeReportDate(event.target.value)}
                className="absolute inset-0 h-full min-h-0 w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          <div className="hidden items-center justify-between gap-3 md:flex">
            {permissions.canCreateReport ? (
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-xl text-slate-700 shadow-sm"
                onClick={newReport}
                aria-label="สร้างรายงานใหม่"
              >
                +
              </button>
            ) : (
              <div className="h-12 w-12" aria-hidden="true" />
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500">Daily Report</p>
              <h3 className="text-2xl font-black tracking-tight text-slate-950">{activeProject.name}</h3>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {draft.reportDate}
            </div>
          </div>

          <div className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-white px-1 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.07)] md:mt-4 md:gap-2" data-daily-reference-summary>
            <div className="border-r border-slate-100 px-2 text-center xl:px-3">
              <p className="text-[10px] font-semibold text-slate-400">สถานะโครงการ</p>
              <p className="mt-2 flex items-center justify-center gap-1 text-xs font-black text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />{activeProject.status || "ดำเนินการ"}</p>
            </div>
            <div className="border-r border-slate-100 px-2 text-center xl:px-3">
              <p className="text-[10px] font-semibold text-slate-400">ความคืบหน้าโดยรวม</p>
              <p className="mt-1 text-xl font-black text-emerald-600">{formatPercent(progress)}</p>
            </div>
            <div className="px-1 text-center xl:px-3">
              <p className="text-[10px] font-semibold text-slate-400">งบประมาณที่ใช้ไป</p>
              <p className="mt-1 truncate text-xs font-black text-slate-900">{formatCompactCurrency(estimatedBudgetUsed)}</p>
              <p className="truncate text-[9px] text-slate-400">จาก {formatCompactCurrency(boqTotal)}</p>
            </div>
          </div>
        </Card>
      </div>

      {isCarryForwardDraft ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900 shadow-sm">
          ดึงข้อมูลจากรายงานวันที่ {draft.carryForwardSourceDate} มาเป็นร่างของวันนี้แล้ว แต่ยังไม่ได้บันทึก กดหรือแก้แต่ละช่องใน Today Checklist เพื่อยืนยันว่าใช้ข้อมูลนี้สำหรับวันนี้
        </div>
      ) : null}

      <div data-daily-report-section="history" className="hidden xl:block">
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 text-left text-sm font-black text-slate-800 shadow-sm"
          aria-expanded={showReportHistory}
          aria-controls="daily-report-history-content"
          onClick={() => setShowReportHistory((current) => !current)}
        >
          <span>ประวัติรายงาน ({reports.length})</span>
          <span aria-hidden="true">{showReportHistory ? "−" : "+"}</span>
        </button>
        <div id="daily-report-history-content" className={showReportHistory ? "mt-3 block" : "hidden"}>
          {reportHistoryCard}
        </div>
      </div>

      <div data-daily-report-section="checklist" className="hidden xl:block">
        <Card className="p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Today Checklist</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">ข้อมูลที่ต้องกรอกวันนี้</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
              เริ่มจากรายการสำคัญก่อน
            </div>
          </div>
          <div data-daily-report-checklist="compact-075" className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {checklistItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => revealChecklistItem(item)}
                className={`rounded-[18px] border px-2.5 py-2.5 text-left transition hover:-translate-y-0.5 ${
                  item.completed
                    ? "border-emerald-100 bg-[linear-gradient(180deg,rgba(240,253,244,0.96),rgba(255,255,255,0.98))]"
                    : "border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))]"
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <p className="text-xs font-black text-slate-950">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-[1.1rem] text-slate-600">{item.summary}</p>
                  </div>
                  <div
                    className={`grid h-6 min-w-6 place-items-center rounded-full text-[11px] font-black ${
                      item.completed ? "bg-emerald-600 text-white" : "bg-amber-400 text-white"
                    }`}
                  >
                    {item.completed ? "✓" : "!"}
                  </div>
                </div>
                <p className={`mt-1.5 text-[9px] font-black uppercase tracking-[0.18em] ${item.completed ? "text-emerald-700" : "text-amber-700"}`}>
                  {item.completed ? "พร้อมแล้ว" : "รอกรอก"}
                </p>
              </button>
            ))}
            <button
              type="button"
              onClick={openBuyin}
              className="rounded-[18px] border border-emerald-700 bg-emerald-700 px-2.5 py-2.5 text-left text-white shadow-[0_12px_26px_rgba(4,120,87,0.18)] transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <p className="text-xs font-black">BUYIN — บันทึกซื้อของ / ใบกำกับผู้ขาย</p>
                  <p className="mt-1 text-[11px] leading-[1.1rem] text-emerald-50">เปิดหน้า BUYIN เพื่อบันทึกข้อมูลจัดซื้อแยกจาก Daily Report</p>
                </div>
                <div className="grid h-6 min-w-6 place-items-center rounded-full bg-white text-[11px] font-black text-emerald-700">
                  →
                </div>
              </div>
              <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-50">
                LOCKED SHORTCUT
              </p>
            </button>
          </div>
        </Card>
      </div>

      <div data-daily-report-quick-layout className="grid min-w-0 gap-3 xl:hidden">
        <DailyQuickSection
          id="daily-work"
          number={dailySectionMeta.work.number}
          title="งานวันนี้"
          status={dailySectionMeta.work.tone}
          statusLabel={dailySectionMeta.work.statusLabel}
          expanded={activeMobileSection === "work"}
          controls="daily-mobile-work-fields"
          onToggle={() => setActiveMobileSection("work")}
        >
          <div id="daily-mobile-work-fields" className="grid gap-4 border-t border-slate-100 bg-emerald-50/30 p-3">
            <Field label="สรุปงานวันนี้ *">
              <TextArea
                data-mobile-daily-summary
                maxLength={500}
                value={draft.summary}
                onFocus={() => confirmChecklistItem("summary")}
                onChange={(event) => updateDraft({ summary: event.target.value }, ["summary"])}
              />
              <p className="mt-1 text-right text-[10px] font-semibold text-slate-400">{draft.summary.length}/500</p>
            </Field>
            <DailyWorkItemEditor
              items={draft.workItems}
              onAdd={addWorkItem}
              onToggleStatus={toggleWorkItem}
              onUpdateTitle={updateWorkItemTitle}
              onDelete={deleteWorkItem}
            />
          </div>
        </DailyQuickSection>
        <DailyQuickSection
          id="daily-site"
          number={dailySectionMeta.site.number}
          title="คนและวัสดุ"
          status={dailySectionMeta.site.tone}
          statusLabel={dailySectionMeta.site.statusLabel}
          expanded={activeMobileSection === "site"}
          controls="daily-mobile-site-fields"
          onToggle={() => setActiveMobileSection("site")}
        >
          <div id="daily-mobile-site-fields" className="grid gap-4 border-t border-slate-100 p-3">
            <Field label="วัสดุที่ใช้ / วัสดุเข้าไซต์">
              <TextArea value={draft.materials} onFocus={() => confirmChecklistItem("materials")} onChange={(event) => updateDraft({ materials: event.target.value }, ["materials"])} />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-black text-slate-800">ทีมช่างเข้าไซต์</p><p className="text-xs text-slate-500">{totalWorkers} คน · {draft.workers.length} ทีม</p></div>
              <Button type="button" variant="secondary" onClick={addWorker}>+ เพิ่มช่าง</Button>
            </div>
            {draft.workers.map((worker) => (
              <div key={worker.id} className="grid grid-cols-[1fr_84px] gap-2 rounded-xl border border-slate-200 p-3">
                <TextInput aria-label="ชื่อช่างหรือทีม" value={worker.name} placeholder="ชื่อช่าง / ทีม" onChange={(event) => updateWorker(worker.id, { name: event.target.value })} />
                <TextInput aria-label="จำนวนคน" type="number" min={0} value={worker.count} onChange={(event) => updateWorker(worker.id, { count: numberFromInput(event.target.value) })} />
                <TextInput className="col-span-2" value={worker.taskTitle} placeholder="งานที่ทำ" onChange={(event) => updateWorker(worker.id, { taskTitle: event.target.value })} />
                <button type="button" className="col-span-2 min-h-10 text-right text-xs font-bold text-red-600" onClick={() => deleteWorker(worker.id)}>ลบทีมนี้</button>
              </div>
            ))}
          </div>
        </DailyQuickSection>
        <DailyQuickSection
          id="daily-progress"
          number={dailySectionMeta.progress.number}
          title="ความคืบหน้า BOQ"
          status={dailySectionMeta.progress.tone}
          statusLabel={dailySectionMeta.progress.statusLabel}
          expanded={activeMobileSection === "progress"}
          controls="daily-mobile-progress-fields"
          onToggle={() => setActiveMobileSection("progress")}
        >
          <div id="daily-mobile-progress-fields" className="grid gap-3 border-t border-slate-100 p-3">
            {draft.progressUpdates.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">ยังไม่มี BOQ item ให้บันทึกความคืบหน้า</p> : draft.progressUpdates.map((update) => (
              <div key={update.id} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-black text-slate-800">{update.title || "BOQ item"}</p>
                <div className="grid grid-cols-[1fr_90px] items-center gap-2">
                  <p className="text-xs text-slate-500">เดิม {update.previousProgress}%</p>
                  <TextInput aria-label={`ความคืบหน้า ${update.title}`} type="number" min={0} max={100} value={update.newProgress} onChange={(event) => updateProgressUpdate(update.id, { newProgress: numberFromInput(event.target.value) })} />
                </div>
                <TextInput value={update.note} placeholder="หมายเหตุ" onChange={(event) => updateProgressUpdate(update.id, { note: event.target.value })} />
              </div>
            ))}
          </div>
        </DailyQuickSection>
        <DailyQuickSection
          id="daily-plan"
          number={dailySectionMeta.plan.number}
          title="แผนงานวันพรุ่งนี้"
          status={dailySectionMeta.plan.tone}
          statusLabel={dailySectionMeta.plan.statusLabel}
          expanded={activeMobileSection === "plan"}
          controls="daily-mobile-plan-fields"
          onToggle={() => setActiveMobileSection("plan")}
        >
          <div id="daily-mobile-plan-fields" className="grid gap-4 border-t border-slate-100 p-3">
            <Field label="แผนงานวันถัดไป"><TextArea value={draft.nextPlan} onFocus={() => confirmChecklistItem("nextPlan")} onChange={(event) => updateDraft({ nextPlan: event.target.value }, ["nextPlan"])} /></Field>
            <Field label="หมายเหตุถึงลูกค้า"><TextArea value={draft.customerNote} onChange={(event) => updateDraft({ customerNote: event.target.value })} /></Field>
            <Field label="หมายเหตุภายในทีม"><TextArea value={draft.internalNote} onChange={(event) => updateDraft({ internalNote: event.target.value })} /></Field>
          </div>
        </DailyQuickSection>
        <DailyQuickSection
          id="daily-problems"
          number={dailySectionMeta.problems.number}
          title="ปัญหาและอุปสรรค"
          status={dailySectionMeta.problems.tone}
          statusLabel={dailySectionMeta.problems.statusLabel}
          expanded={activeMobileSection === "problems"}
          controls="daily-mobile-problem-fields"
          onToggle={() => setActiveMobileSection("problems")}
        >
          <div id="daily-mobile-problem-fields" className="grid gap-4 border-t border-slate-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-800">ปัญหา / อุปสรรค ({draft.problemIssues.length})</p>
              <Button type="button" variant="secondary" onClick={addProblemIssue}>+ เพิ่มปัญหา</Button>
            </div>
            {draft.problemIssues.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">ยังไม่มีปัญหาในวันนี้</p>
            ) : (
              draft.problemIssues.map((issue, index) => (
                <ProblemIssueCard
                  key={issue.id}
                  issue={issue}
                  index={index}
                  updateIssue={updateProblemIssue}
                  deleteIssue={deleteProblemIssue}
                  uploadPhotos={uploadProblemIssuePhotos}
                  removePhoto={removeProblemIssuePhoto}
                />
              ))
            )}
          </div>
        </DailyQuickSection>
        <DailyQuickSection
          id="daily-photos"
          number={dailySectionMeta.photos.number}
          title="รูปงานประจำวัน"
          status={dailySectionMeta.photos.tone}
          statusLabel={dailySectionMeta.photos.statusLabel}
          expanded={activeMobileSection === "photos"}
          controls="daily-mobile-photo-fields"
          anchorId={dailyChecklistAnchorIds.sitePhotos}
          onToggle={() => setActiveMobileSection("photos")}
        >
          <div id="daily-mobile-photo-fields">
            <DailyReportPhotoSection variant="embedded" draft={draft} uploadPhotos={uploadPhotos} removePhoto={removePhoto} />
          </div>
        </DailyQuickSection>
        <div className="mt-2">
          <p className="mb-2 text-base font-black text-slate-800">ประวัติรายงานล่าสุด</p>
          {selectedHistoryReport ? (
            <button type="button" onClick={() => openReport(selectedHistoryReport)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <span className="text-xl" aria-hidden="true">▣</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-800">{formatThaiReportDate(selectedHistoryReport.reportDate).dateLabel}</span><span className="block truncate text-[11px] text-slate-500">{selectedHistoryReport.summary || "รายงานประจำวัน"}</span></span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">บันทึกแล้ว</span>
              <span aria-hidden="true">›</span>
            </button>
          ) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">ยังไม่มีรายงานย้อนหลัง</p>}
        </div>
      </div>

      <div
        data-daily-report-desktop-split="half"
        className="hidden gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start"
      >
        <div data-daily-report-required-sections className="grid min-w-0 content-start gap-5">
          <div
            data-daily-report-section="report-form"
            className={activeMobileSection === "work" || activeMobileSection === "site" || activeMobileSection === "plan" ? "block" : "hidden md:block"}
          >
            <Card className="min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Report Form</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">บันทึกรายงานประจำวัน</h3>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">
                  แก้ไขข้อมูลหลักของรายงานจาก section นี้
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div id={dailyChecklistAnchorIds.reportDate} className={activeMobileSection === "work" ? "block" : "hidden md:block"}>
                  <Field label="วันที่รายงาน">
                    <TextInput type="date" value={draft.reportDate} onChange={(event) => changeReportDate(event.target.value)} />
                  </Field>
                </div>
                <div id={dailyChecklistAnchorIds.summary} className={activeMobileSection === "work" ? "block" : "hidden md:block"}>
                  <Field label="สรุปงานวันนี้">
                    <TextInput value={draft.summary} onFocus={() => confirmChecklistItem("summary")} onChange={(event) => updateDraft({ summary: event.target.value }, ["summary"])} />
                  </Field>
                </div>
                <div id={dailyChecklistAnchorIds.materials} className={activeMobileSection === "site" ? "block" : "hidden md:block"}>
                  <Field label="วัสดุที่ใช้ / วัสดุเข้าไซต์">
                    <TextArea value={draft.materials} onFocus={() => confirmChecklistItem("materials")} onChange={(event) => updateDraft({ materials: event.target.value }, ["materials"])} />
                  </Field>
                </div>
                <div id={dailyChecklistAnchorIds.completedWork} className={activeMobileSection === "work" ? "block" : "hidden md:block"}>
                  <Field label="งานที่ทำเสร็จวันนี้">
                    <TextArea value={draft.completedWork} onFocus={() => confirmChecklistItem("completedWork")} onChange={(event) => updateDraft({ completedWork: event.target.value }, ["completedWork"])} />
                  </Field>
                </div>
                <div id={dailyChecklistAnchorIds.ongoingWork} className={activeMobileSection === "work" ? "block" : "hidden md:block"}>
                  <Field label="งานที่กำลังดำเนินการ">
                    <TextArea value={draft.ongoingWork} onFocus={() => confirmChecklistItem("ongoingWork")} onChange={(event) => updateDraft({ ongoingWork: event.target.value }, ["ongoingWork"])} />
                  </Field>
                </div>
                <div id={dailyChecklistAnchorIds.nextPlan} className={activeMobileSection === "plan" ? "block" : "hidden md:block"}>
                  <Field label="แผนงานวันถัดไป">
                    <TextArea value={draft.nextPlan} onFocus={() => confirmChecklistItem("nextPlan")} onChange={(event) => updateDraft({ nextPlan: event.target.value }, ["nextPlan"])} />
                  </Field>
                </div>
                <div id="daily-customer-note" className={activeMobileSection === "plan" ? "block" : "hidden md:block"}>
                  <Field label="หมายเหตุถึงลูกค้า">
                    <TextArea value={draft.customerNote} onChange={(event) => updateDraft({ customerNote: event.target.value })} />
                  </Field>
                </div>
                <div id="daily-internal-note" className={activeMobileSection === "plan" ? "block" : "hidden md:block"}>
                  <Field label="หมายเหตุภายในทีม">
                    <TextArea value={draft.internalNote} onChange={(event) => updateDraft({ internalNote: event.target.value })} />
                  </Field>
                </div>
              </div>
            </Card>
          </div>

          <div id={dailyChecklistAnchorIds.workers} data-daily-report-section="work-attendance" className={activeMobileSection === "site" ? "block" : "hidden md:block"}>
            <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Work Attendance</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">ทีมงาน, ช่าง, และสถานะงาน</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  เลือกทีมช่างจาก HR หรือพิมพ์ทีมชั่วคราวได้ ค่าแรงยังบันทึกเฉพาะใน HR เท่านั้น
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={openHr}>ไปบันทึกค่าใช้จ่ายใน HR</Button>
                <Button onClick={addWorker}>+ เพิ่มช่าง</Button>
              </div>
            </div>
            {draft.workers.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">ยังไม่มีช่างเข้าไซต์</div>
            ) : (
              <div className="mt-4 grid gap-3">
                {draft.workers.map((worker) => (
                  <div key={worker.id} className="grid gap-3 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.75),rgba(255,255,255,0.98))] p-4">
                    <div className="grid gap-2 md:grid-cols-2 md:items-end">
                      <Field label="เลือกทีมช่างจาก HR">
                        <Select
                          value={worker.crewId ?? ""}
                          onChange={(event) => {
                            const selectedCrew = registeredCrews.find((crew) => crew.id === event.target.value);
                            if (!selectedCrew) {
                              updateWorker(worker.id, { crewId: undefined });
                              return;
                            }
                            updateWorker(worker.id, {
                              crewId: selectedCrew.id,
                              name: selectedCrew.leaderName,
                              trade: selectedCrew.workTypes[0] ?? worker.trade
                            });
                          }}
                        >
                          <option value="">ทีมชั่วคราว / พิมพ์เอง</option>
                          {registeredCrews.map((crew) => (
                            <option key={crew.id} value={crew.id}>
                              {crew.leaderName} • {crew.workTypes.join(", ") || "ยังไม่ระบุประเภทงาน"}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="ชื่อช่าง / ทีม">
                        <TextInput value={worker.name} onChange={(event) => updateWorker(worker.id, { name: event.target.value })} />
                      </Field>
                      <Field label="ประเภทงาน">
                        <Select value={worker.trade} onChange={(event) => updateWorker(worker.id, { trade: event.target.value })}>
                          {Array.from(
                            new Set([
                              ...tradeOptions,
                              ...(registeredCrews.find((crew) => crew.id === worker.crewId)?.workTypes ?? []),
                              worker.trade
                            ].filter(Boolean))
                          ).map((trade) => (
                            <option key={trade} value={trade}>
                              {trade}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="จำนวนคน">
                        <TextInput
                          type="number"
                          min={0}
                          value={worker.count}
                          onChange={(event) => updateWorker(worker.id, { count: numberFromInput(event.target.value) })}
                        />
                      </Field>
                      <Field label="เวลาเข้า">
                        <TextInput type="time" value={worker.startTime} onChange={(event) => updateWorker(worker.id, { startTime: event.target.value })} />
                      </Field>
                      <Field label="เวลาออก">
                        <TextInput type="time" value={worker.endTime} onChange={(event) => updateWorker(worker.id, { endTime: event.target.value })} />
                      </Field>
                      <Field label="งานที่ทำ">
                        <TextInput value={worker.taskTitle} onChange={(event) => updateWorker(worker.id, { taskTitle: event.target.value })} />
                      </Field>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                      <div className="grid min-w-0 gap-3">
                        <Field label="สถานะงาน">
                          <TaskStatusSelector
                            value={worker.taskStatus}
                            onChange={(taskStatus) => updateWorker(worker.id, { taskStatus })}
                          />
                        </Field>
                        <Field label="หมายเหตุ">
                          <TextInput value={worker.note} onChange={(event) => updateWorker(worker.id, { note: event.target.value })} />
                        </Field>
                      </div>
                      <Button variant="danger" onClick={() => deleteWorker(worker.id)}>
                        ลบ
                      </Button>
                    </div>
                    {!worker.crewId && worker.name.trim() ? (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                        ทีมนี้ยังเป็นทีมชั่วคราวใน Daily Report
                        <Button className="ml-0 mt-2 min-h-9 px-3 text-xs sm:ml-2 sm:mt-0" variant="secondary" onClick={() => saveWorkerAsCrew(worker)}>
                          บันทึกเป็นทีมช่าง HR
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            </Card>
          </div>

          <div id="daily-progress-fields" data-daily-report-section="progress-update" className={activeMobileSection === "progress" ? "block" : "hidden md:block"}>
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Daily Progress Update</p>
                  <h3 className="mt-2 line-clamp-2 text-2xl font-black tracking-tight text-slate-950" title={activeProject.name}>
                    ความคืบหน้าของ Project : {activeProject.name}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    รายการจาก BOQ ปัจจุบันเท่านั้น แก้ New % และ Note ได้ แล้วระบบจะอัปเดต weighted progress ตอน Save Report
                  </p>
                </div>
              </div>
              {itemOptions.length === 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  ยังไม่มี BOQ item ให้เชื่อม บันทึกความคืบหน้าได้หลังเพิ่ม BOQ
                </div>
              ) : draft.progressUpdates.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">ยังไม่มี progress update</div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {draft.progressUpdates.map((update) => (
                    <div key={update.id} className="grid gap-3 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.75),rgba(255,255,255,0.98))] p-4 md:grid-cols-2 md:items-end">
                      <Field label="BOQ item">
                        <div className="flex min-h-11 items-center rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-sm">
                          {update.title || "BOQ item"}
                        </div>
                      </Field>
                      <Field label="Previous %">
                        <div className="flex min-h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                          {update.previousProgress}%
                        </div>
                      </Field>
                      <Field label="New %">
                        <div className="grid gap-2">
                          <TextInput
                            type="number"
                            min={0}
                            max={100}
                            value={update.newProgress}
                            onChange={(event) => updateProgressUpdate(update.id, { newProgress: numberFromInput(event.target.value) })}
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {DAILY_PROGRESS_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                className={`min-h-9 rounded-full border px-3 text-xs font-black transition ${
                                  update.newProgress === preset
                                    ? "border-slate-950 bg-slate-950 text-white"
                                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:text-slate-900"
                                }`}
                                onClick={() =>
                                  updateProgressUpdate(update.id, {
                                    newProgress: applyProgressPreset(preset)
                                  })
                                }
                              >
                                {preset}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </Field>
                      <Field label="Note">
                        <TextInput value={update.note} onChange={(event) => updateProgressUpdate(update.id, { note: event.target.value })} />
                      </Field>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div id={dailyChecklistAnchorIds.problems} data-daily-report-section="problems" className={activeMobileSection === "plan" ? "block" : "hidden md:block"}>
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Problems / Obstacles</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">ปัญหาและอุปสรรควันนี้</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {problemCountPresets.map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`min-h-10 rounded-full border px-4 text-sm font-black transition ${
                        draft.problemIssues.length === count
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-red-500 hover:text-red-700"
                      }`}
                      onClick={() => setProblemIssueCount(count)}
                    >
                      {count}
                    </button>
                  ))}
                  <Button variant="secondary" onClick={addProblemIssue}>
                    + เพิ่มปัญหา
                  </Button>
                </div>
              </div>

              {draft.problemIssues.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  ยังไม่มีปัญหาในวันนี้ เลือกจำนวนปัญหาหรือกดเพิ่มรายการได้
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {draft.problemIssues.map((issue, index) => (
                    <ProblemIssueCard
                      key={issue.id}
                      issue={issue}
                      index={index}
                      updateIssue={updateProblemIssue}
                      deleteIssue={deleteProblemIssue}
                      uploadPhotos={uploadProblemIssuePhotos}
                      removePhoto={removeProblemIssuePhoto}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div
            id="daily-report-desktop-site-photos"
            data-daily-report-anchor={dailyChecklistAnchorIds.sitePhotos}
            data-daily-report-section="site-photos"
            data-daily-report-mobile-section="site-photos"
            className="min-w-0 md:block"
          >
            <DailyReportPhotoSection
              variant="desktop"
              sectionNumber={dailySectionMeta.photos.number}
              draft={draft}
              uploadPhotos={uploadPhotos}
              removePhoto={removePhoto}
            />
          </div>
        </div>

        <div
          data-daily-report-readonly-sections
          className={`${activeMobileSection === "progress" ? "grid" : "hidden"} min-w-0 content-start gap-5 md:grid`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DashboardMetricTile label="Tasks Completed" value={String(completedTasks)} hint="จาก progress updates ที่ปิดแล้ว" tone="emerald" />
            <DashboardMetricTile label="Active Issues" value={String(activeIssues)} hint="ปัญหา / อุปสรรควันนี้" tone="amber" />
            <DashboardMetricTile label="Teams on Site" value={String(draft.workers.length)} hint={`${totalWorkers} คนในไซต์`} tone="blue" />
            <DashboardMetricTile label="Photos Uploaded" value={String(draft.photos.length)} hint="รูปหน้างานของรายงานนี้" tone="slate" />
          </div>

          <Card>
            <SectionHeader eyebrow="BOQ Weighted" title="ความคืบหน้า BOQ" />
            <div className="mt-5 grid grid-cols-[110px_1fr] items-center gap-4">
              <ProgressRing value={progress} size={104} stroke={10} tone="emerald" />
              <div>
                <p className="text-sm font-black text-slate-900">ความคืบหน้ารวม (Weighted)</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">BOQ รวม {formatCompactCurrency(boqTotal)}</p>
                <div className="mt-3">
                  <ProgressBar value={progress} />
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {boqCategoryRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm font-semibold text-slate-500">
                  ยังไม่มีหมวด BOQ
                </div>
              ) : (
                boqCategoryRows.map((category, index) => (
                  <div key={category.id} className="grid gap-2">
                    <div className="flex items-center justify-between gap-3 text-sm font-bold">
                      <span className="line-clamp-1 text-slate-700">
                        {index + 1}. {category.name || "หมวดงาน"}
                      </span>
                      <span className="text-emerald-700">{formatPercent(category.progress)}</span>
                    </div>
                    <ProgressBar value={category.progress} />
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Daily Work Progress</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">ภาพรวมความคืบหน้ารายวัน</h3>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">
                แสดงจาก progress updates หรือ BOQ items ล่าสุด
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              {workRows.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">ยังไม่มีข้อมูลความคืบหน้าในวันนี้</div>
              ) : (
                workRows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`grid gap-3 px-4 py-4 md:grid-cols-[auto_1fr_auto] md:items-center ${
                      index !== workRows.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                  >
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black ${
                        row.tone === "emerald"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.tone === "blue"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.tone === "emerald" ? "✓" : row.tone === "blue" ? "•" : "○"}
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-950">{row.title}</p>
                      <p className="mt-1 text-sm font-medium text-slate-500">{row.detail}</p>
                    </div>
                    <div
                      className={`rounded-full px-3 py-2 text-sm font-black ${
                        row.tone === "emerald"
                          ? "bg-emerald-50 text-emerald-700"
                          : row.tone === "blue"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold text-slate-500">Labor, Materials & Equipment</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">สรุปทรัพยากรหน้างาน</h3>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Labor</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{totalWorkers}</p>
                <p className="mt-1 text-sm text-slate-500">Workers on site</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Materials</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{materialsCount}</p>
                <p className="mt-1 text-sm text-slate-500">Items / lines reported</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Equipment</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{draft.workers.length}</p>
                <p className="mt-1 text-sm text-slate-500">Active teams as proxy</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold text-slate-500">Site Observations / Notes</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">บันทึกสั้นเพื่อใช้ติดตามหน้างาน</h3>
            <div className="mt-5 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {draft.summary || draft.internalNote || draft.customerNote || "ยังไม่มีบันทึกเพิ่มเติมในวันนี้"}
              </p>
            </div>
          </Card>
        </div>
      </div>
      {permissions.canSaveReport ? (
        <DailySaveBar feedback={saveFeedback} disabled={isSavingReport} onSave={saveReport} isEditing={isEditingSavedReport} />
      ) : null}
    </div>
  );
}

function TaskStatusSelector({
  value,
  onChange
}: {
  value: DailyWorker["taskStatus"];
  onChange: (status: DailyWorker["taskStatus"]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {taskStatusOptions.map((status) => (
        <button
          key={status}
          type="button"
          className={`min-h-10 rounded-full border px-4 text-sm font-black transition ${
            value === status
              ? status === "เสร็จ"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : status === "แก้ไข"
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-slate-950 bg-slate-950 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:text-slate-900"
          }`}
          onClick={() => onChange(status)}
        >
          {status}
        </button>
      ))}
    </div>
  );
}

function ProblemIssueCard({
  issue,
  index,
  updateIssue,
  deleteIssue,
  uploadPhotos,
  removePhoto
}: {
  issue: DailyProblemIssue;
  index: number;
  updateIssue: (issueId: string, patch: Partial<DailyProblemIssue>) => void;
  deleteIssue: (issueId: string) => void;
  uploadPhotos: (issueId: string, fileList: FileList | null) => Promise<void>;
  removePhoto: (issueId: string, photoId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remainingSlots = MAX_PROBLEM_ISSUE_PHOTOS - issue.photos.length;

  return (
    <div className="rounded-[28px] border border-red-100 bg-[linear-gradient(180deg,rgba(254,242,242,0.9),rgba(255,255,255,0.96))] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-red-700">Issue {index + 1}</p>
          <h4 className="text-lg font-black tracking-tight text-slate-900">ปัญหา / อุปสรรค</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={remainingSlots === 0}>
            อัพรูปปัญหา
          </Button>
          <Button variant="danger" onClick={() => deleteIssue(issue.id)}>
            ลบรายการ
          </Button>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={async (event) => {
              await uploadPhotos(issue.id, event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[.8fr_1.2fr]">
        <Field label="หัวข้อปัญหา">
          <TextInput value={issue.title} onChange={(event) => updateIssue(issue.id, { title: event.target.value })} />
        </Field>
        <Field label={`รายละเอียด • เหลือรูปได้อีก ${remainingSlots} รูป • ระบบล้างรูปหลัง ${DAILY_REPORT_MEDIA_RETENTION_DAYS} วัน`}>
          <TextArea value={issue.detail} onChange={(event) => updateIssue(issue.id, { detail: event.target.value })} />
        </Field>
      </div>

      {issue.photos.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-red-200 bg-white p-4 text-sm text-slate-500">
          ยังไม่มีรูปของปัญหานี้ อัพได้สูงสุด {MAX_PROBLEM_ISSUE_PHOTOS} รูป
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {issue.photos.map((photo, photoIndex) => (
            <div key={photo.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.dataUrl} alt={photo.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-800">รูปปัญหา {photoIndex + 1}</p>
                  <p className="truncate text-[11px] text-slate-500">{photo.name}</p>
                </div>
                <Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => removePhoto(issue.id, photo.id)}>
                  ลบ
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DailyReportPhotoSection({
  draft,
  uploadPhotos,
  removePhoto,
  variant = "desktop",
  sectionNumber
}: {
  draft: DailyReport;
  uploadPhotos: (fileList: FileList | null) => Promise<void>;
  removePhoto: (photoId: string) => void;
  variant?: "desktop" | "embedded";
  sectionNumber?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remainingSlots = MAX_DAILY_REPORT_PHOTOS - draft.photos.length;
  const isEmbedded = variant === "embedded";

  const content = (
    <div className={isEmbedded ? "grid gap-3 border-t border-slate-100 bg-emerald-50/30 p-3" : "grid gap-4"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {sectionNumber ? (
            <span
              data-daily-reference-section-number={sectionNumber}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white"
            >
              {sectionNumber}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Site Photos</p>
            <h3 className={`${isEmbedded ? "text-base" : "text-2xl"} font-black tracking-tight text-slate-950`}>รูปงานประจำวัน</h3>
            <p data-daily-report-photo-count className="text-xs text-slate-600">
              {draft.photos.length}/{MAX_DAILY_REPORT_PHOTOS} รูป • เหลือ {remainingSlots} รูป • รูปจะถูกล้างอัตโนมัติหลัง {DAILY_REPORT_MEDIA_RETENTION_DAYS} วัน
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-10"
            onClick={() => fileInputRef.current?.click()}
            disabled={remainingSlots === 0}
          >
            อัพรูปหน้างาน
          </Button>
          <input
            ref={fileInputRef}
            data-daily-report-photo-input
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={async (event) => {
              await uploadPhotos(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {draft.photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          ยังไม่มีรูปหน้างาน เลือกอัพรูปได้ครั้งเดียวหลายรูป
        </div>
      ) : (
        <div data-daily-report-photo-grid className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
          {draft.photos.map((photo, index) => (
            <div data-daily-report-photo-card key={photo.id} className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.dataUrl} alt={photo.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-800">รูป {index + 1}</p>
                  <p className="truncate text-[11px] text-slate-500">{photo.name}</p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="min-h-10 px-3 text-xs"
                  aria-label={`ลบรูป ${index + 1}`}
                  onClick={() => removePhoto(photo.id)}
                >
                  ลบ
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return isEmbedded ? <div data-daily-report-photo-section>{content}</div> : <Card data-daily-report-photo-section>{content}</Card>;
}
