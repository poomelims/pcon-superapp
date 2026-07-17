"use client";

import { normalizeDailyWorkItems, serializeDailyWorkItems } from "@/lib/project-control/daily-work-items";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  calculateBuyinNetAmount,
  calculateBuyinVatAmount,
  sanitizeTaxId,
  validateTaxId
} from "@/lib/buyin-calculations";
import {
  calculateOverallBoqTotal,
  calculateWeightedProgress,
  clampProgress,
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  nonNegativeNumber
} from "@/lib/project-calculations";
import {
  createDailyReportPdfFilename,
  limitDailyReportPhotos,
  limitProblemIssuePhotos,
  MAX_DAILY_REPORT_PHOTOS,
  MAX_PROBLEM_ISSUE_PHOTOS,
  summarizeProblemIssues
} from "@/lib/daily-report-media";
import {
  createBlankDailyReportDraft,
  createCarryForwardDailyReport,
  createCrew,
  createDefaultDailyWorker,
  createEmptyProblemIssue,
  createId,
  createProject,
  confirmDailyChecklistItems,
  BuyinEntry,
  Crew,
  DailyProblemIssue,
  DailyProblemPhoto,
  DailyProgressUpdate,
  DailyReportPhoto,
  DailyReport,
  DailyWorker,
  LaborExpense,
  Project,
  ProjectControlData,
  pruneDailyReportMediaByRetention,
  todayString,
  updateActiveCompanyName
} from "@/lib/project-storage";
import { browserProjectControlRepository } from "@/lib/project-control/repository";
import { resolveDailyReportDateSelection } from "@/lib/project-control/daily-report-selection";
import { getMobilePrimaryTabs } from "@/lib/project-control/mobile-shell";
import {
  applyCrewRemovalPolicy,
  LocalPersistenceError,
  runLocalFirstCloudSync
} from "@/lib/project-control/workspace-policies";
import {
  clearCloudSyncToken,
  getStoredCloudSyncToken,
  loadCloudSyncHealthApi,
  loadDataFromCloudApi,
  pushDataToCloudApi,
  setCloudSyncToken
} from "@/lib/cloud-sync-client";
import { formatCloudSyncErrorAdvice, type CloudSyncHealthReport } from "@/lib/cloud-sync-diagnostics";
import { type DailyChecklistItemId } from "@/lib/daily-report-checklist";
import { canExportDailyReportPdf, downloadElementAsPdf } from "@/lib/daily-report-pdf";
import { resolveDailyReportPermissions } from "@/lib/daily-report-permissions";
import {
  applyDailyProgressUpdatesToProject,
  createCanonicalDailyProgressUpdates,
  createDailyReportPdfSnapshot,
} from "@/lib/daily-report-progress";
import {
  filterActiveProjectsForDisplay,
  filterProjectsByCompany,
  filterSuccessProjectsForDisplay,
  sortProjectsForDisplay
} from "@/lib/project-sorting";
import { resolveProjectActionPermissions } from "@/lib/project-action-permissions";
import { APP_RELEASE_NOTE, APP_VERSION } from "@/lib/app-version";
import { loadLocalDevSession } from "@/lib/local-dev-auth";
import { safeCloneSerializable, sortWithCompare } from "@/lib/runtime-compat";
import { getSupabaseClient, isLocalDevBypassEnabled } from "@/lib/supabase/client";
import { AuthStatus } from "./auth-status";
import { useMemberAccess } from "./use-member-access";
import { VersionBadge } from "./version-badge";
import { MobileReferenceTabs, MobileShellIcon, PconReferenceMark } from "./mobile-shell-ui";
import { BuyinView, DailyReportView, DashboardView, HrView, PrintDailyReportSheet, ProjectInfoView } from "./features/feature-loaders";
import { DesktopToolMenu } from "./features/shared/desktop-module-ui";

const loadLocalData = browserProjectControlRepository.load;
const saveLocalData = browserProjectControlRepository.save;
const importProjectControlJson = browserProjectControlRepository.importJson;
const exportProjectControlJson = browserProjectControlRepository.exportJson;

type TabId = "dashboard" | "info" | "daily" | "hr" | "buyin";
type Notice = { type: "success" | "error" | "info"; text: string } | null;
type PendingDeleteConfirmation = {
  label: string;
  confirmText: string;
  onConfirm: () => void | Promise<void>;
} | null;
type DailySaveStatus = "idle" | "saving" | "saved" | "error";

const MIN_FLOATING_SAVE_SPINNER_MS = 3000;

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "info", label: "Project / BOQ" },
  { id: "daily", label: "Daily Report" },
  { id: "hr", label: "HR / ทีมช่าง" },
  { id: "buyin", label: "BUYIN / จัดซื้อ" }
];

const smileGreetingEmojis = ["😊", "😄", "😁", "🙂", "😃", "😆", "🥰", "😇"];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPdfExportRoot(
  ref: { current: HTMLDivElement | null },
  timeoutMs = 5000
): Promise<HTMLDivElement | null> {
  const startedAt = Date.now();

  while (!ref.current && Date.now() - startedAt < timeoutMs) {
    await delay(50);
  }

  return ref.current;
}

function currentMonthString(now = new Date()): string {
  return todayString(now).slice(0, 7);
}

function sortCrewsForDisplay(crews: Crew[]): Crew[] {
  return sortWithCompare(crews, (a, b) => {
    const statusDiff = (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const nameDiff = (a.leaderName || "").localeCompare(b.leaderName || "", "th");
    if (nameDiff !== 0) {
      return nameDiff;
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function getGreetingByHour(hour: number): string {
  if (hour < 5) {
    return "สวัสดีตอนดึก";
  }

  if (hour < 12) {
    return "สวัสดีตอนเช้า";
  }

  if (hour < 17) {
    return "สวัสดีตอนบ่าย";
  }

  if (hour < 20) {
    return "สวัสดีตอนเย็น";
  }

  return "สวัสดีตอนค่ำ";
}

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const fileReader = new FileReader();

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    fileReader.onload = () => resolve(String(fileReader.result));
    fileReader.onerror = () => reject(fileReader.error ?? new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    fileReader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("ประมวลผลรูปไม่สำเร็จ"));
    img.src = rawDataUrl;
  });

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return rawDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.78);
}

function createDailyDraftWithBoqProgress(project: Project, previousReport: DailyReport | null = null): DailyReport {
  const baseReport = previousReport ? createCarryForwardDailyReport(project, previousReport) : createBlankDailyReportDraft(project);

  const draftWorkers = previousReport ? [createDefaultDailyWorker()] : baseReport.workers;

  return {
    ...baseReport,
    workers: draftWorkers,
    progressUpdates: createCanonicalDailyProgressUpdates(project, baseReport.progressUpdates, previousReport)
  };
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

function normalizeDailyReportWorkers(workers: DailyWorker[]): DailyWorker[] {
  const normalizedWorkers = new Map<string, DailyWorker>();

  for (const worker of workers) {
    const hasTodayInput =
      worker.name.trim() ||
      worker.crewId?.trim() ||
      worker.taskTitle.trim() ||
      worker.note.trim() ||
      worker.startTime !== "08:00" ||
      worker.endTime !== "17:00" ||
      worker.trade !== "ทั่วไป" ||
      worker.taskStatus !== "ดำเนินการ" ||
      worker.count !== 1;

    if (!hasTodayInput) {
      continue;
    }

    normalizedWorkers.set(worker.id, {
      ...worker,
      count: Math.max(0, worker.count)
    });
  }

  return Array.from(normalizedWorkers.values());
}

function withUpdatedProject(
  data: ProjectControlData,
  projectId: string,
  updater: (project: Project) => Project
): ProjectControlData {
  return {
    ...data,
    projects: data.projects.map((project) =>
      project.id === projectId ? updater({ ...project, updatedAt: new Date().toISOString() }) : project
    )
  };
}

function ProgressBar({ value, tone = "emerald" }: { value: number; tone?: "emerald" | "amber" | "rose" }) {
  const color = tone === "amber" ? "bg-amber-500" : tone === "rose" ? "bg-rose-500" : "bg-emerald-600";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-50" aria-label={`progress ${value}%`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clampProgress(value)}%` }} />
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm text-slate-900 shadow-sm shadow-emerald-950/[0.03] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${
        props.className ?? ""
      }`}
    />
  );
}

function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "amber" | "danger" | "ghost";
}) {
  const variants = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-200",
    secondary: "border border-emerald-100 bg-white text-slate-800 hover:border-emerald-200 hover:bg-emerald-50 disabled:text-slate-400",
    amber: "bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-200",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
    ghost: "bg-transparent text-emerald-800 hover:bg-emerald-50 disabled:text-slate-400"
  };

  return (
    <button
      {...props}
      className={`min-h-11 rounded-2xl px-4 text-sm font-bold shadow-[0_10px_24px_rgba(22,101,52,0.08)] transition focus:outline-none focus:ring-2 focus:ring-emerald-100 ${variants[variant]} ${className}`}
    />
  );
}

function FloatingCloudSaveButton({
  isSaving,
  onSave,
  label,
  disabled = false,
  className = "lg:hidden"
}: {
  isSaving: boolean;
  onSave: () => void | Promise<unknown>;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={isSaving ? "Saving..." : label}
      className={`fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 min-h-13 items-center justify-center gap-2 rounded-[20px] border border-emerald-600 bg-emerald-700 px-4 text-white shadow-[0_16px_34px_rgba(15,23,42,0.22)] backdrop-blur transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-emerald-200 ${className}`}
      onClick={onSave}
      disabled={disabled || isSaving}
    >
      {isSaving ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/45 border-t-white" aria-hidden="true" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 3.5h11.5L20.5 7.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" />
          <path d="M7.5 3.5v6h8v-6" />
          <path d="M8 20.5v-6h8v6" />
          <path d="M13.5 6.5h1.5" />
        </svg>
      )}
      <span className="text-sm font-black">{isSaving ? "กำลังบันทึก..." : label}</span>
    </button>
  );
}

function Card({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`w-full max-w-full min-w-0 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/98 p-4 shadow-[0_14px_44px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition-shadow sm:rounded-[28px] sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

function ProgressRing({
  value,
  size = 92,
  stroke = 9,
  tone = "blue"
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "blue" | "emerald" | "slate";
}) {
  const safeValue = clampProgress(value);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeValue / 100) * circumference;
  const color =
    tone === "emerald" ? "#16a34a" : tone === "slate" ? "#334155" : "#2563eb";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-2xl font-black text-slate-950">{Math.round(safeValue)}%</div>
        </div>
      </div>
    </div>
  );
}

function CloudSyncGuidePanel({
  health,
  isChecking,
  onRunCheck,
  onClose
}: {
  health: CloudSyncHealthReport | null;
  isChecking: boolean;
  onRunCheck: () => void | Promise<void>;
  onClose: () => void;
}) {
  const failedTables = health?.tables.filter((table) => table.status === "error") ?? [];

  return (
    <Card className="mb-5 border-red-200 bg-red-50/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-red-700">วิธีแก้ Cloud Sync</p>
          <h2 className="mt-1 text-xl font-black leading-tight text-slate-950">ตรวจ Token, Env, Schema และ Supabase permission</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            Diagnostics นี้อ่านเฉพาะสถานะระบบ ไม่ส่งค่า secret/token และไม่แสดงข้อมูลลูกค้าในหน้าเว็บ
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={onRunCheck} disabled={isChecking}>
            {isChecking ? "Checking..." : "Run diagnostics"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[20px] border border-red-100 bg-white px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Manual runbook</p>
          <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm font-semibold leading-6 text-slate-700">
            <li>Vercel env ต้องมี NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY, PCON_CLOUD_SYNC_TOKEN</li>
            <li>SUPABASE_SECRET_KEY ต้องเป็น sb_secret หรือ service_role ฝั่ง server เท่านั้น</li>
            <li>ถ้า schema/table/column fail ให้รัน compatibility SQL แล้ว notify pgrst, &apos;reload schema&apos;</li>
            <li>ถ้า permission denied หรือ 42501 ให้ grant service_role กับตาราง Cloud Sync</li>
            <li>ถ้า invalid input syntax for type uuid ให้ใช้ text-id compatibility patch</li>
          </ol>
        </div>

        <div className="rounded-[20px] border border-red-100 bg-white px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Diagnostics result</p>
          {health ? (
            <div className="mt-3 grid gap-3 text-sm font-semibold leading-6 text-slate-700">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="font-black text-slate-950">{health.summary.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Server key: {health.serverKey.kind} / elevated: {health.serverKey.looksElevated ? "yes" : "no"}
                </p>
              </div>
              {failedTables.length > 0 ? (
                <div className="grid gap-2">
                  {failedTables.slice(0, 4).map((table) => (
                    <div key={table.table} className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2">
                      <p className="font-black text-red-700">{table.table}</p>
                      <p className="mt-1 text-xs text-slate-600">{table.advice ?? table.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-emerald-50 px-3 py-2 font-bold text-emerald-800">ตารางหลักตอบได้ครบจาก server API</p>
              )}
              <div className="grid gap-1 text-xs text-slate-500">
                {health.manualChecks.map((check) => (
                  <p key={check}>- {check}</p>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-4 text-sm font-semibold leading-6 text-slate-600">
              กด Run diagnostics เพื่อเช็ก table/schema/grant ผ่าน server API แบบไม่แตะข้อมูลลูกค้า
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

type ShellIconName =
  | "dashboard"
  | "project"
  | "daily"
  | "boq"
  | "team"
  | "document"
  | "calendar"
  | "report"
  | "settings"
  | "export";

function ShellIcon({ name, className = "" }: { name: ShellIconName; className?: string }) {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...iconProps}>
          <path d="M3 13.5 12 5l9 8.5" />
          <path d="M5 11.5V20h5.5v-5.5h3V20H19v-8.5" />
        </svg>
      );
    case "project":
      return (
        <svg {...iconProps}>
          <path d="M4 6.5h6l1.5 2H20v9.5A2 2 0 0 1 18 20H6a2 2 0 0 1-2-2z" />
          <path d="M8 12h8" />
          <path d="M8 15.5h5" />
        </svg>
      );
    case "daily":
      return (
        <svg {...iconProps}>
          <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
          <path d="M8 2.5v3" />
          <path d="M16 2.5v3" />
          <path d="M7.5 10h9" />
          <path d="M7.5 14h9" />
        </svg>
      );
    case "boq":
      return (
        <svg {...iconProps}>
          <path d="M6 4.5h12" />
          <path d="M6 9.5h12" />
          <path d="M6 14.5h12" />
          <path d="M6 19.5h12" />
          <circle cx="4.5" cy="4.5" r=".75" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="9.5" r=".75" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="14.5" r=".75" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="19.5" r=".75" fill="currentColor" stroke="none" />
        </svg>
      );
    case "team":
      return (
        <svg {...iconProps}>
          <circle cx="8" cy="8.5" r="3" />
          <circle cx="16.5" cy="9.5" r="2.5" />
          <path d="M3.5 19c1.2-3 4-4.5 7-4.5s5.8 1.5 7 4.5" />
          <path d="M14.5 15.2c2 .3 3.8 1.4 5 3.3" />
        </svg>
      );
    case "document":
      return (
        <svg {...iconProps}>
          <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" />
          <path d="M14 3.5V8h4" />
          <path d="M8.5 12h7" />
          <path d="M8.5 15.5h7" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...iconProps}>
          <rect x="4" y="5" width="16" height="15" rx="2.5" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 9.5h16" />
        </svg>
      );
    case "report":
      return (
        <svg {...iconProps}>
          <path d="M5.5 18.5V10" />
          <path d="M11.5 18.5V6" />
          <path d="M17.5 18.5V13" />
          <path d="M4 20.5h16" />
        </svg>
      );
    case "settings":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3.25" />
          <path d="m19 12 1.7-1-1.2-2-1.9.2a6.8 6.8 0 0 0-1.2-1.2l.2-1.9-2-1.2-1 1.7a6.8 6.8 0 0 0-1.6 0l-1-1.7-2 1.2.2 1.9a6.8 6.8 0 0 0-1.2 1.2L3.5 9l-1.2 2 1.7 1a6.8 6.8 0 0 0 0 1.6l-1.7 1 1.2 2 1.9-.2a6.8 6.8 0 0 0 1.2 1.2l-.2 1.9 2 1.2 1-1.7a6.8 6.8 0 0 0 1.6 0l1 1.7 2-1.2-.2-1.9a6.8 6.8 0 0 0 1.2-1.2l1.9.2 1.2-2-1.7-1a6.8 6.8 0 0 0 0-1.6Z" />
        </svg>
      );
    case "export":
      return (
        <svg {...iconProps}>
          <path d="M12 3.5v11" />
          <path d="m8.5 10 3.5 4 3.5-4" />
          <path d="M4.5 15.5V19a1.5 1.5 0 0 0 1.5 1.5h12A1.5 1.5 0 0 0 19.5 19v-3.5" />
        </svg>
      );
    default:
      return null;
  }
}

function ShellNavButton({
  label,
  active,
  onClick,
  icon
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon: ShellIconName;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-12 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
        active
          ? "bg-emerald-50 text-emerald-700 before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-r-full before:bg-emerald-600"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
          active ? "text-emerald-700" : "text-slate-500"
        }`}
      >
        <ShellIcon name={icon} className="h-5 w-5" />
      </span>
      <span className="truncate">
        {label === "Project / BOQ" ? (
          <>
            <span className="lg:hidden">Project</span>
            <span className="hidden lg:inline">Project / BOQ</span>
          </>
        ) : label}
      </span>
    </button>
  );
}

function PlaceholderProjectVisual({
  label,
  compact = false,
  imageUrl,
  imageAlt
}: {
  label: string;
  compact?: boolean;
  imageUrl?: string | null;
  imageAlt?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[24px] ${
        compact ? "aspect-[4/3]" : "aspect-[16/10]"
      } bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.45),_transparent_35%),linear-gradient(145deg,#10233f_0%,#142f53_38%,#2a5b74_100%)]`}
    >
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imageAlt ?? label} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.46)_100%)]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgba(15,23,42,0.15)_100%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-[42%] bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.22)_30%,rgba(15,23,42,0.55)_100%)]" />
          <div className="absolute bottom-5 left-[10%] h-[42%] w-[30%] rounded-t-[18px] bg-[#1a2536]/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
          <div className="absolute bottom-5 left-[34%] h-[52%] w-[34%] rounded-t-[18px] bg-[#202f45]/95 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
          <div className="absolute bottom-5 right-[10%] h-[36%] w-[24%] rounded-t-[18px] bg-[#192638]/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
          <div className="absolute bottom-[28%] left-[38%] h-[16%] w-[12%] rounded bg-amber-200/90" />
          <div className="absolute bottom-[28%] left-[53%] h-[16%] w-[12%] rounded bg-amber-100/85" />
          <div className="absolute bottom-[12%] left-[14%] h-[12%] w-[12%] rounded bg-amber-100/80" />
          <div className="absolute bottom-[14%] right-[15%] h-[10%] w-[11%] rounded bg-amber-100/80" />
        </>
      )}
      <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/90 backdrop-blur">
        {label}
      </div>
    </div>
  );
}

export function ProjectControlWorkspace() {
  const [data, setData] = useState<ProjectControlData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [notice, setNotice] = useState<Notice>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dailyCloudStatus, setDailyCloudStatus] = useState<DailySaveStatus>("idle");
  const [dailyLocalStatus, setDailyLocalStatus] = useState<DailySaveStatus>("idle");
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isFloatingSaveMinBusy, setIsFloatingSaveMinBusy] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isCheckingCloudHealth, setIsCheckingCloudHealth] = useState(false);
  const [showCloudSyncGuide, setShowCloudSyncGuide] = useState(false);
  const [cloudSyncHealth, setCloudSyncHealth] = useState<CloudSyncHealthReport | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [dailyDraft, setDailyDraft] = useState<DailyReport | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [hidePdfCompanyName, setHidePdfCompanyName] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<PendingDeleteConfirmation>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [isProjectSearchOpen, setIsProjectSearchOpen] = useState(false);
  const [isMobileProjectSwitcherOpen, setIsMobileProjectSwitcherOpen] = useState(false);
  const [isMobileWorkspaceMenuOpen, setIsMobileWorkspaceMenuOpen] = useState(false);
  const [selectedHrMonth, setSelectedHrMonth] = useState(currentMonthString());
  const [buyinPrefill, setBuyinPrefill] = useState<{ projectId?: string; entryDate?: string } | null>(null);
  const [localGreeting, setLocalGreeting] = useState("สวัสดี");
  const [smileGreetingEmoji, setSmileGreetingEmoji] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const pdfExportRef = useRef<HTMLDivElement | null>(null);
  const projectSearchPanelRef = useRef<HTMLFormElement | null>(null);
  const contentStartRef = useRef<HTMLDivElement | null>(null);
  const dailyStatusProjectRef = useRef<string | null>(null);
  const memberAccess = useMemberAccess();

  function focusWorkspaceContentStart() {
    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      contentStartRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      contentStartRef.current?.focus({ preventScroll: true });
    });
  }

  function navigateToTab(tabId: TabId) {
    setActiveTab(tabId);
    setIsMobileProjectSwitcherOpen(false);
    setIsMobileWorkspaceMenuOpen(false);
    setIsProjectSearchOpen(false);
    setShowPdfPreview(false);

    focusWorkspaceContentStart();
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      async function loadWorkspace() {
        const localData = loadLocalData();
        setData(localData);
        saveLocalData(localData);
        setIsAuthChecking(false);

        const supabase = getSupabaseClient();
        const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

        if (!sessionData.session?.access_token) {
          const localDevSession = loadLocalDevSession();

          if (localDevSession) {
            setNotice(null);
            return;
          }

          if (isLocalDevBypassEnabled) {
            setNotice({ type: "info", text: "No login session; loaded local workspace" });
            return;
          }

          setNotice({ type: "info", text: "กรุณา Login ก่อนใช้งาน กำลังเปิดหน้า Login..." });
          window.location.assign("/login");
          return;
        }

        if (!sessionData.session.user.email_confirmed_at) {
          setNotice({ type: "info", text: "กรุณายืนยันอีเมลก่อนใช้งาน workspace" });
          window.location.assign(`/verify-email?email=${encodeURIComponent(sessionData.session.user.email ?? "")}`);
          return;
        }

        try {
          const response = await fetch("/api/member/workspace", {
            headers: {
              authorization: `Bearer ${sessionData.session.access_token}`
            }
          });
          const result = (await response.json().catch(() => ({}))) as {
            error?: string;
            data?: ProjectControlData;
          };

          if (!response.ok || !result.data) {
            throw new Error(result.error ?? "โหลด workspace ไม่สำเร็จ");
          }

          setData(result.data);
          saveLocalData(result.data);
          setNotice({ type: "success", text: "Loaded workspace ตามสิทธิ์ของ ID นี้แล้ว" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "โหลด workspace ไม่สำเร็จ";
          if (message.includes("ยังไม่ได้รับสิทธิ์เข้า workspace") || message.includes("ไม่มี company")) {
            setNotice({ type: "info", text: "กรุณาเข้าร่วมบริษัทหรือส่งคำขอสร้างบริษัทก่อนใช้งาน" });
            window.location.assign("/onboarding");
            return;
          }
          setNotice({
            type: "error",
            text: `${message} • Local workspace ยังใช้งานได้`
          });
        } finally {
          setIsAuthChecking(false);
        }
      }

      void loadWorkspace();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  const activeCompany = data?.companies.find((company) => company.id === data.activeCompanyId);
  const allCompanyProjects = useMemo(() => {
    if (!data) {
      return [];
    }

    return sortProjectsForDisplay(
      filterProjectsByCompany(data.projects, data.activeCompanyId),
      todayString()
    );
  }, [data]);
  const activeCompanyProjects = useMemo(() => filterActiveProjectsForDisplay(allCompanyProjects, todayString()), [allCompanyProjects]);
  const successCompanyProjects = useMemo(() => filterSuccessProjectsForDisplay(allCompanyProjects), [allCompanyProjects]);
  const companyProjects = activeCompanyProjects;
  const activeProject = allCompanyProjects.find((project) => project.id === data?.activeProjectId);
  const activeReports = useMemo(() => {
    if (!data || !activeProject) {
      return [];
    }

    return data.dailyReports
      .filter((report) => report.companyId === activeProject.companyId && report.projectId === activeProject.id)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  }, [activeProject, data]);
  const latestPriorReport = useMemo(() => {
    const today = todayString();
    return activeReports.find((report) => report.reportDate < today) ?? null;
  }, [activeReports]);
  const filteredProjectSearchResults = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalizedQuery = projectSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return sortProjectsForDisplay(
      companyProjects.filter((project) => (project.name || "").toLowerCase().includes(normalizedQuery)),
      todayString()
    ).slice(0, 6);
  }, [companyProjects, data, projectSearchQuery]);

  useEffect(() => {
    const draftTimer = window.setTimeout(() => {
      if (!activeProject) {
        setDailyDraft(null);
        if (dailyStatusProjectRef.current !== null) {
          setDailyCloudStatus("idle");
          setDailyLocalStatus("idle");
          dailyStatusProjectRef.current = null;
        }
        return;
      }

      const todaysReport = activeReports.find((report) => report.reportDate === todayString());
      const previousForToday = todaysReport
        ? activeReports.find((report) => report.id !== todaysReport.id && report.reportDate < todaysReport.reportDate) ?? null
        : latestPriorReport;
      if (dailyStatusProjectRef.current !== activeProject.id) {
        setDailyCloudStatus("idle");
        setDailyLocalStatus("idle");
        dailyStatusProjectRef.current = activeProject.id;
      }
      setDailyDraft(
        todaysReport
          ? normalizeDailyReportWithBoqProgress(activeProject, safeCloneSerializable(todaysReport), previousForToday)
          : latestPriorReport
            ? createDailyDraftWithBoqProgress(activeProject, latestPriorReport)
            : createDailyDraftWithBoqProgress(activeProject)
      );
    }, 0);

    return () => window.clearTimeout(draftTimer);
  }, [activeProject, activeReports, latestPriorReport]);

  useEffect(() => {
    if (!isProjectSearchOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!projectSearchPanelRef.current?.contains(event.target as Node)) {
        setIsProjectSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isProjectSearchOpen]);

  useEffect(() => {
    function refreshLocalGreeting() {
      setLocalGreeting(getGreetingByHour(new Date().getHours()));
    }

    refreshLocalGreeting();
    const timer = window.setInterval(refreshLocalGreeting, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSmileGreetingEmoji(smileGreetingEmojis[Math.floor(Math.random() * smileGreetingEmojis.length)] ?? "😊");
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const dashboardStats = useMemo(() => {
    if (!data) {
      return { total: 0, active: 0, done: 0, value: 0 };
    }

    return {
      total: allCompanyProjects.length,
      active: activeCompanyProjects.length,
      done: successCompanyProjects.length,
      value: allCompanyProjects.reduce((total, project) => total + calculateOverallBoqTotal(project), 0)
    };
  }, [activeCompanyProjects, allCompanyProjects, data, successCompanyProjects]);

  function updateData(nextData: ProjectControlData) {
    setData(nextData);
    saveLocalData(nextData);
  }

  function cloudSyncFailureText(message: string, localSafetyText: string): string {
    return `${message} • ${formatCloudSyncErrorAdvice(message)} • ${localSafetyText}`;
  }

  async function syncWorkspaceSnapshotToCloud(
    snapshot: ProjectControlData,
    messages: {
      syncing: string;
      success: string;
      failure: string;
    }
  ): Promise<boolean> {
    setIsSyncingCloud(true);

    try {
      await runLocalFirstCloudSync({
        saveLocal: () => {
          saveLocalData(snapshot);
          setNotice({ type: "info", text: messages.syncing });
        },
        pushCloud: () => pushDataToCloudApi(snapshot, getStoredCloudSyncToken())
      });
      setNotice({ type: "success", text: messages.success });
      return true;
    } catch (error) {
      if (error instanceof LocalPersistenceError) {
        setNotice({ type: "error", text: `บันทึกข้อมูลในเครื่องไม่สำเร็จ: ${error.message}` });
        return false;
      }

      const message = error instanceof Error ? error.message : "Cloud sync failed";
      setNotice({
        type: "error",
        text: `${messages.failure}: ${cloudSyncFailureText(message, "ข้อมูล local ยังปลอดภัย เครื่องอื่นจะเห็นหลัง Sync Cloud สำเร็จ")}`
      });
      return false;
    } finally {
      setIsSyncingCloud(false);
    }
  }

  async function syncWorkspaceToCloud(
    messages: {
      syncing: string;
      success: string;
      failure: string;
    }
  ): Promise<boolean> {
    if (!data) {
      return false;
    }

    return syncWorkspaceSnapshotToCloud(data, messages);
  }

  function updateDataAndSyncCloud(
    nextData: ProjectControlData,
    messages: {
      syncing: string;
      success: string;
      failure: string;
    }
  ) {
    updateData(nextData);
    void syncWorkspaceSnapshotToCloud(nextData, messages);
  }

  function hasLocalWorkspaceWork(snapshot: ProjectControlData): boolean {
    return (
      snapshot.projects.length > 0 ||
      snapshot.dailyReports.length > 0 ||
      snapshot.crews.length > 0 ||
      snapshot.laborExpenses.length > 0 ||
      snapshot.buyinEntries.length > 0
    );
  }

  async function saveCurrentWorkspaceBeforeLoadCloud(snapshot: ProjectControlData): Promise<boolean> {
    if (!hasLocalWorkspaceWork(snapshot)) {
      return true;
    }

    return syncWorkspaceSnapshotToCloud(snapshot, {
      syncing: "กำลัง Save Cloud ก่อน Load Cloud...",
      success: "Save Cloud ก่อน Load Cloud สำเร็จ กำลังโหลดข้อมูลล่าสุด...",
      failure: "Save Cloud ก่อน Load Cloud ไม่สำเร็จ"
    });
  }

  function clearDailySaveStatusOnEdit() {
    setDailyCloudStatus((currentStatus) => (currentStatus === "saved" || currentStatus === "error" ? "idle" : currentStatus));
    setDailyLocalStatus((currentStatus) => (currentStatus === "saved" || currentStatus === "error" ? "idle" : currentStatus));
  }

  function openProjectFromSearch(projectId: string) {
    if (!data) {
      return;
    }

    setData({ ...data, activeProjectId: projectId });
    navigateToTab("info");
    setProjectSearchQuery("");
    setIsProjectSearchOpen(false);
  }

  function setActiveProjectFromMobile(projectId: string) {
    if (!data) {
      return;
    }

    setData({ ...data, activeProjectId: projectId });
    setIsMobileProjectSwitcherOpen(false);
    setIsMobileWorkspaceMenuOpen(false);
    setIsProjectSearchOpen(false);
    focusWorkspaceContentStart();
  }

  function updateActiveProject(updater: (project: Project) => Project) {
    if (!data || !activeProject) {
      setNotice({ type: "error", text: "ไม่พบโปรเจกต์ที่กำลังเปิดอยู่" });
      return;
    }

    updateData(withUpdatedProject(data, activeProject.id, updater));
  }

  function updateCompanyName(name: string) {
    if (!data) {
      return;
    }

    updateData(updateActiveCompanyName(data, name));
  }

  async function uploadProjectCover(fileList: FileList | null) {
    if (!activeProject || !fileList) {
      return;
    }

    const coverFile = Array.from(fileList).find((file) => file.type.startsWith("image/"));

    if (!coverFile) {
      setNotice({ type: "error", text: "กรุณาเลือกรูปภาพสำหรับหน้าปกโปรเจกต์" });
      return;
    }

    try {
      const dataUrl = await fileToCompressedDataUrl(coverFile);
      updateActiveProject((project) => ({
        ...project,
        coverImage: {
          id: createId(),
          name: coverFile.name,
          dataUrl
        }
      }));
      setNotice({ type: "success", text: "อัปเดตรูปหน้าปก Project แล้ว" });
    } catch {
      setNotice({ type: "error", text: "อัปโหลดรูปหน้าปก Project ไม่สำเร็จ" });
    }
  }

  function removeProjectCover() {
    if (!activeProject) {
      return;
    }

    updateActiveProject((project) => ({
      ...project,
      coverImage: null
    }));
    setNotice({ type: "success", text: "ลบรูปหน้าปก Project แล้ว" });
  }

  function handleNewProject() {
    if (!data) {
      return;
    }

    const project = createProject(data.activeCompanyId, `โปรเจกต์ ${data.projects.length + 1}`);
    updateData({
      ...data,
      projects: [...data.projects, project],
      activeProjectId: project.id
    });
    navigateToTab("info");
    setNotice({ type: "success", text: "สร้างโปรเจกต์ใหม่แล้ว" });
  }

  function validateProjectSaveInputs(): boolean {
    if (!data) {
      return false;
    }

    const emptyCompany = data.companies.find((company) => company.id === data.activeCompanyId && !company.name.trim());

    if (emptyCompany) {
      setNotice({ type: "error", text: "กรุณาระบุชื่อบริษัทก่อนบันทึก" });
      return false;
    }

    const emptyProject = data.projects.find((project) => !project.name.trim());

    if (emptyProject) {
      setNotice({ type: "error", text: "กรุณาระบุชื่อโปรเจกต์ก่อนบันทึก" });
      return false;
    }

    return true;
  }

  async function handleSave(): Promise<boolean> {
    if (!validateProjectSaveInputs() || !data) {
      return false;
    }

    setIsSaving(true);

    try {
      await runLocalFirstCloudSync({
        saveLocal: () => {
          saveLocalData(data);
          setNotice({ type: "info", text: "บันทึก Project ในเครื่องแล้ว กำลัง Sync Cloud..." });
        },
        pushCloud: () => pushDataToCloudApi(data, getStoredCloudSyncToken())
      });
      setNotice({ type: "success", text: "Save Project แล้ว และ Sync Cloud สำเร็จ มือถือกด Load Cloud หรือ refresh เพื่อเห็นข้อมูลล่าสุด" });
    } catch (error) {
      if (error instanceof LocalPersistenceError) {
        setNotice({ type: "error", text: `บันทึก Project ในเครื่องไม่สำเร็จ: ${error.message}` });
        return false;
      }

      const message = error instanceof Error ? error.message : "Sync Cloud failed";
      setNotice({
        type: "error",
        text: cloudSyncFailureText(message, "Save Project ในเครื่องนี้แล้ว แต่เครื่องอื่นจะยังไม่เห็นจนกว่า Cloud Sync จะสำเร็จ")
      });
    } finally {
      setIsSaving(false);
    }

    return true;
  }

  function handleExport() {
    if (!data) {
      setNotice({ type: "error", text: "ไม่มีข้อมูลสำหรับ export" });
      return;
    }

    const blob = new Blob([exportProjectControlJson(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pcon-project-control-${todayString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ type: "success", text: "Export Project workspace JSON สำเร็จ" });
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importProjectControlJson(String(reader.result));
        setData(imported);
        saveLocalData(imported);
        setNotice({ type: "success", text: "Import JSON สำเร็จ พร้อม dailyReports" });
      } catch (error) {
        setNotice({
          type: "error",
          text: error instanceof Error ? error.message : "Invalid imported JSON"
        });
      } finally {
        setIsImporting(false);
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function confirmPrivilegedDeletePassword(confirmation: NonNullable<PendingDeleteConfirmation>) {
    if (!projectActionPermissions.canDeleteProject) {
      setNotice({ type: "error", text: "เฉพาะ Admin/Owner เท่านั้นที่ลบได้" });
      return;
    }

    setDeletePassword("");
    setDeleteConfirmation(confirmation);
  }

  async function submitPrivilegedDeletePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deleteConfirmation) {
      return;
    }

    setIsConfirmingDelete(true);

    try {
      if (memberAccess.hasSession && !memberAccess.isLocalDevSession) {
        const supabase = getSupabaseClient();

        if (!supabase) {
          throw new Error("ไม่พบ Supabase client สำหรับยืนยันรหัสผ่าน");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData.session?.user.email;

        if (!email) {
          throw new Error("ไม่พบอีเมลผู้ใช้สำหรับยืนยันรหัสผ่าน");
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: deletePassword
        });

        if (error) {
          throw new Error("รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง");
        }
      } else if (deletePassword.trim() !== deleteConfirmation.confirmText) {
        throw new Error(`โหมด Local ให้พิมพ์ ${deleteConfirmation.confirmText} เพื่อยืนยันการลบ`);
      }

      await deleteConfirmation.onConfirm();
      setDeleteConfirmation(null);
      setDeletePassword("");
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "ยืนยันการลบไม่สำเร็จ"
      });
    } finally {
      setIsConfirmingDelete(false);
    }
  }

  async function deleteProjectNow(projectId: string) {
    if (!data) {
      setNotice({ type: "error", text: "ไม่พบโปรเจกต์สำหรับลบ" });
      return;
    }

    const deletedProject = data.projects.find((project) => project.id === projectId);
    const remainingProjects = data.projects.filter((project) => project.id !== projectId);
    const remainingReports = data.dailyReports.filter((report) => report.projectId !== projectId);
    const nextActiveProject =
      filterActiveProjectsForDisplay(
        remainingProjects.filter((project) => project.companyId === data.activeCompanyId),
        todayString()
      )[0] ?? null;
    const nextData = {
      ...data,
      projects: remainingProjects,
      dailyReports: remainingReports,
      activeProjectId: nextActiveProject?.id ?? ""
    };
    setData(nextData);
    saveLocalData(nextData);
    navigateToTab("dashboard");
    await syncWorkspaceSnapshotToCloud(nextData, {
      syncing: `ลบโปรเจกต์ "${deletedProject?.name ?? "Project"}" ในเครื่องแล้ว กำลัง Sync Cloud...`,
      success: "ลบโปรเจกต์แล้ว และ Sync Cloud สำเร็จ",
      failure: "ลบโปรเจกต์ในเครื่องแล้ว แต่ Sync Cloud ไม่สำเร็จ Cloud ยังอาจเห็นโปรเจกต์นี้จนกว่า Sync Cloud จะสำเร็จ"
    });
  }

  async function markProjectDone() {
    if (!data || !activeProject) {
      setNotice({ type: "error", text: "ไม่พบโปรเจกต์สำหรับปิดงาน" });
      return;
    }

    if (activeProject.status === "จบงานแล้ว") {
      setNotice({ type: "info", text: "โปรเจกต์นี้อยู่ใน Success Project แล้ว" });
      return;
    }

    const nextProjects = data.projects.map((project) =>
      project.id === activeProject.id
        ? {
            ...project,
            status: "จบงานแล้ว",
            updatedAt: new Date().toISOString()
          }
        : project
    );
    const nextActiveProject =
      filterActiveProjectsForDisplay(
        nextProjects.filter((project) => project.companyId === data.activeCompanyId),
        todayString()
      )[0] ?? null;
    const nextData = {
      ...data,
      projects: nextProjects,
      activeProjectId: nextActiveProject?.id ?? ""
    };

    setData(nextData);
    saveLocalData(nextData);
    navigateToTab("dashboard");
    await syncWorkspaceSnapshotToCloud(nextData, {
      syncing: `ปิดงานโปรเจกต์ "${activeProject.name || "Project"}" แล้ว กำลัง Sync Cloud...`,
      success: "Project done แล้ว และ Sync Cloud สำเร็จ",
      failure: "Project done ในเครื่องแล้ว แต่ Sync Cloud ไม่สำเร็จ"
    });
  }

  function handleDeleteProject() {
    if (!data || !activeProject) {
      setNotice({ type: "error", text: "ไม่พบโปรเจกต์สำหรับลบ" });
      return;
    }

    confirmPrivilegedDeletePassword({
      label: `โปรเจกต์ "${activeProject.name}" และ Daily Report ทั้งหมดของโปรเจกต์นี้`,
      confirmText: activeProject.name || "DELETE",
      onConfirm: () => deleteProjectNow(activeProject.id)
    });
  }

  async function handleSyncCloud() {
    if (!data) {
      return;
    }

    const activeCompanyForSync = data.companies.find((company) => company.id === data.activeCompanyId);

    if (!activeCompanyForSync?.name.trim()) {
      setNotice({ type: "error", text: "กรุณาระบุชื่อบริษัทก่อน Sync Cloud" });
      return;
    }

    setIsSyncingCloud(true);
    setNotice({ type: "info", text: "Syncing cloud..." });

    try {
      await runLocalFirstCloudSync({
        saveLocal: () => saveLocalData(data),
        pushCloud: () => pushDataToCloudApi(data, getStoredCloudSyncToken())
      });
      setNotice({ type: "success", text: "Cloud sync completed และ local backup ยังคงอยู่" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloud sync failed";
      setNotice({
        type: "error",
        text: cloudSyncFailureText(
          message,
          error instanceof LocalPersistenceError ? "บันทึก local ไม่สำเร็จ จึงยังไม่ได้ส่งข้อมูลขึ้น Cloud" : "Local data is still safe"
        )
      });
    } finally {
      setIsSyncingCloud(false);
    }
  }

  function handleSetCloudToken() {
    const entered = window.prompt("กรอก PCON_CLOUD_SYNC_TOKEN ที่ตั้งไว้ใน Vercel env") ?? "";

    if (!setCloudSyncToken(entered)) {
      setNotice({ type: "error", text: "ยังไม่ได้ตั้ง Cloud Sync Token • Local data ของคุณยังปลอดภัย" });
      return;
    }

    setNotice({ type: "success", text: "บันทึก Cloud Sync Token ในเครื่องนี้แล้ว กด Sync Cloud ได้เลย" });
  }

  function handleClearCloudToken() {
    clearCloudSyncToken();
    setNotice({ type: "info", text: "ล้าง Cloud Sync Token ในเครื่องนี้แล้ว" });
  }

  async function openCloudSyncGuide() {
    setShowCloudSyncGuide(true);

    if (!projectActionPermissions.canUseFullProjectActions) {
      setNotice({ type: "error", text: "Cloud Sync diagnostics เฉพาะ Owner/Admin" });
      return;
    }

    setIsCheckingCloudHealth(true);

    try {
      const result = await loadCloudSyncHealthApi(getStoredCloudSyncToken());
      setCloudSyncHealth(result.health);
      setNotice({
        type: result.health.summary.status === "error" ? "error" : "success",
        text: result.health.summary.message
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloud Sync diagnostics failed";
      setNotice({
        type: "error",
        text: cloudSyncFailureText(message, "Diagnostics ไม่แตะข้อมูลลูกค้า และข้อมูล local ยังปลอดภัย")
      });
    } finally {
      setIsCheckingCloudHealth(false);
    }
  }

  async function handleLoadCloud() {
    if (!data) {
      return;
    }

    const hasLocalWork = hasLocalWorkspaceWork(data);
    if (
      hasLocalWork &&
      !window.confirm("Load Cloud จะ Save/Sync Cloud ข้อมูลในเครื่องก่อน แล้วจึงโหลดข้อมูลล่าสุดจาก Cloud เพื่อป้องกันข้อมูลสูญหาย ดำเนินการต่อหรือไม่?")
    ) {
      return;
    }

    const savedBeforeLoad = await saveCurrentWorkspaceBeforeLoadCloud(data);
    if (!savedBeforeLoad) {
      return;
    }

    setIsLoadingCloud(true);
    setNotice({ type: "info", text: "Loading cloud..." });

    try {
      const cloudData = await loadDataFromCloudApi(data.activeCompanyId, getStoredCloudSyncToken());
      const loaded = {
        ...cloudData,
        companies: [
          ...data.companies.filter((company) => company.id !== data.activeCompanyId),
          ...cloudData.companies
        ],
        projects: [
          ...data.projects.filter((project) => project.companyId !== data.activeCompanyId),
          ...cloudData.projects
        ],
        dailyReports: [
          ...data.dailyReports.filter((report) => report.companyId !== data.activeCompanyId),
          ...cloudData.dailyReports
        ],
        crews: [
          ...data.crews.filter((crew) => crew.companyId !== data.activeCompanyId),
          ...cloudData.crews
        ],
        laborExpenses: [
          ...data.laborExpenses.filter((expense) => expense.companyId !== data.activeCompanyId),
          ...cloudData.laborExpenses
        ],
        buyinEntries: [
          ...data.buyinEntries.filter((entry) => entry.companyId !== data.activeCompanyId),
          ...cloudData.buyinEntries
        ]
      };
      setData(loaded);
      saveLocalData(loaded);
      setNotice({ type: "success", text: "Loaded from cloud แล้ว และอัปเดต local backup ให้เรียบร้อย" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Load Cloud failed";
      setNotice({
        type: "error",
        text: cloudSyncFailureText(message, "Local data is still safe")
      });
    } finally {
      setIsLoadingCloud(false);
    }
  }

  function addBoqCategory() {
    updateActiveProject((project) => ({
      ...project,
      boq: [
        ...project.boq,
        {
          id: createId(),
          name: `หมวดงาน ${project.boq.length + 1}`,
          items: []
        }
      ]
    }));
  }

  function updateBoqCategory(categoryId: string, name: string) {
    updateActiveProject((project) => ({
      ...project,
      boq: project.boq.map((category) => (category.id === categoryId ? { ...category, name } : category))
    }));
  }

  function deleteBoqCategory(categoryId: string) {
    if (!projectActionPermissions.canDeleteBoq) {
      setNotice({ type: "error", text: "เฉพาะ Admin/Owner เท่านั้นที่ลบ BOQ ได้" });
      return;
    }

    if (!window.confirm("ลบหมวดงานนี้และรายการทั้งหมด?")) {
      return;
    }

    updateActiveProject((project) => ({
      ...project,
      boq: project.boq.filter((category) => category.id !== categoryId)
    }));
  }

  function addBoqItem(categoryId: string) {
    updateActiveProject((project) => ({
      ...project,
      boq: project.boq.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: [
                ...category.items,
                {
                  id: createId(),
                  description: "รายการใหม่",
                  quantity: 1,
                  unit: "งาน",
                  unitPrice: 0,
                  progress: 0
                }
              ]
            }
          : category
      )
    }));
  }

  function updateBoqItem(categoryId: string, itemId: string, patch: Partial<Project["boq"][number]["items"][number]>) {
    updateActiveProject((project) => ({
      ...project,
      boq: project.boq.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      ...patch,
                      quantity: nonNegativeNumber(patch.quantity ?? item.quantity),
                      unitPrice: nonNegativeNumber(patch.unitPrice ?? item.unitPrice),
                      progress: clampProgress(patch.progress ?? item.progress)
                    }
                  : item
              )
            }
          : category
      )
    }));
  }

  function deleteBoqItem(categoryId: string, itemId: string) {
    if (!projectActionPermissions.canDeleteBoq) {
      setNotice({ type: "error", text: "เฉพาะ Admin/Owner เท่านั้นที่ลบ BOQ ได้" });
      return;
    }

    updateActiveProject((project) => ({
      ...project,
      boq: project.boq.map((category) =>
        category.id === categoryId
          ? { ...category, items: category.items.filter((item) => item.id !== itemId) }
          : category
      )
    }));
  }

  function confirmDailyChecklistItem(itemId: DailyChecklistItemId) {
    setDailyDraft((currentDraft) => (currentDraft ? confirmDailyChecklistItems(currentDraft, [itemId]) : currentDraft));
  }

  function updateDailyDraft(patch: Partial<DailyReport>, confirmedItems: DailyChecklistItemId[] = []) {
    if (!dailyDraft) {
      return;
    }

    clearDailySaveStatusOnEdit();
    let compatiblePatch = patch;
    if (("completedWork" in patch || "ongoingWork" in patch) && !("workItems" in patch)) {
      const workItems = normalizeDailyWorkItems({
        id: dailyDraft.id,
        completedWork: patch.completedWork ?? dailyDraft.completedWork,
        ongoingWork: patch.ongoingWork ?? dailyDraft.ongoingWork
      });
      compatiblePatch = { ...patch, workItems, ...serializeDailyWorkItems(workItems) };
    }
    const updatedDraft = { ...dailyDraft, ...compatiblePatch, updatedAt: new Date().toISOString() };
    setDailyDraft(confirmedItems.length > 0 ? confirmDailyChecklistItems(updatedDraft, confirmedItems) : updatedDraft);
  }

  function updateProblemIssues(nextIssues: DailyProblemIssue[]) {
    updateDailyDraft({
      problemIssues: nextIssues,
      problems: summarizeProblemIssues(nextIssues)
    }, ["problems"]);
  }

  function addWorker() {
    if (!dailyDraft) {
      return;
    }

    updateDailyDraft({ workers: [...dailyDraft.workers, createDefaultDailyWorker()] }, ["workers"]);
  }

  function updateWorker(workerId: string, patch: Partial<DailyWorker>) {
    if (!dailyDraft) {
      return;
    }

    updateDailyDraft(
      {
        workers: dailyDraft.workers.map((worker) =>
          worker.id === workerId ? { ...worker, ...patch, count: nonNegativeNumber(patch.count ?? worker.count) } : worker
        )
      },
      ["workers"]
    );
  }

  function deleteWorker(workerId: string) {
    if (!dailyDraft) {
      return;
    }

    updateDailyDraft({ workers: dailyDraft.workers.filter((worker) => worker.id !== workerId) }, ["workers"]);
  }

  function saveDailyWorkerAsCrew(worker: DailyWorker) {
    if (!data) {
      return;
    }

    const leaderName = worker.name.trim();
    if (!leaderName) {
      setNotice({ type: "error", text: "กรุณาใส่ชื่อทีมก่อนบันทึกเป็นทีมช่าง HR" });
      return;
    }

    const now = new Date().toISOString();
    const crew = createCrew(data.activeCompanyId, {
      leaderName,
      nationalId: "",
      workTypes: worker.trade ? [worker.trade] : ["ทั่วไป"],
      status: "active"
    });
    const nextData = {
      ...data,
      crews: [...data.crews, crew]
    };

    updateDataAndSyncCloud(nextData, {
      syncing: "บันทึก HR ในเครื่องแล้ว กำลัง Sync Cloud...",
      success: "บันทึก HR แล้ว และ Sync Cloud สำเร็จ",
      failure: "Sync HR Cloud ไม่สำเร็จ"
    });
    updateWorker(worker.id, { crewId: crew.id, name: crew.leaderName, trade: crew.workTypes[0] ?? worker.trade });
    setSelectedHrMonth(currentMonthString(new Date(now)));
    navigateToTab("hr");
    setNotice({ type: "info", text: "เพิ่มทีมช่างจาก Daily Report แล้ว กรุณาใส่เลขบัตรประชาชนใน HR ให้ครบก่อนใช้เป็นผู้รับเงิน" });
  }

  function saveCrew(nextCrew: Crew): boolean {
    if (!data) {
      return false;
    }

    if (!nextCrew.leaderName.trim()) {
      setNotice({ type: "error", text: "กรุณาใส่ชื่อหัวหน้าทีม" });
      return false;
    }

    if (!nextCrew.nationalId.trim()) {
      setNotice({ type: "error", text: "กรุณาใส่เลขบัตรประชาชน" });
      return false;
    }

    if (nextCrew.workTypes.length === 0) {
      setNotice({ type: "error", text: "กรุณาเลือกประเภทงานที่ทำได้" });
      return false;
    }

    const normalizedCrew = {
      ...nextCrew,
      companyId: nextCrew.companyId || data.activeCompanyId,
      workTypes: Array.from(new Set(nextCrew.workTypes.map((workType) => workType.trim()).filter(Boolean))),
      updatedAt: new Date().toISOString()
    };
    const exists = data.crews.some((crew) => crew.id === normalizedCrew.id);
    const nextData = {
      ...data,
      crews: exists ? data.crews.map((crew) => (crew.id === normalizedCrew.id ? normalizedCrew : crew)) : [...data.crews, normalizedCrew]
    };
    updateDataAndSyncCloud(nextData, {
      syncing: "บันทึก HR ในเครื่องแล้ว กำลัง Sync Cloud...",
      success: "บันทึก HR แล้ว และ Sync Cloud สำเร็จ",
      failure: "Sync HR Cloud ไม่สำเร็จ"
    });
    return true;
  }

  function deleteCrew(crewId: string) {
    if (!data) {
      return;
    }

    const nextData = applyCrewRemovalPolicy(data, crewId, new Date().toISOString());
    updateDataAndSyncCloud(nextData, {
      syncing: "บันทึก HR ในเครื่องแล้ว กำลัง Sync Cloud...",
      success: "บันทึก HR แล้ว และ Sync Cloud สำเร็จ",
      failure: "Sync HR Cloud ไม่สำเร็จ"
    });
  }

  function saveLaborExpense(nextExpense: LaborExpense): boolean {
    if (!data) {
      return false;
    }

    if (!nextExpense.expenseDate.trim()) {
      setNotice({ type: "error", text: "กรุณาเลือกวันที่จ่าย" });
      return false;
    }

    if (!nextExpense.crewId.trim()) {
      setNotice({ type: "error", text: "กรุณาเลือกทีมช่าง" });
      return false;
    }

    if (nextExpense.amount < 0) {
      setNotice({ type: "error", text: "ยอดจ่ายต้องไม่ติดลบ" });
      return false;
    }

    const normalizedExpense = {
      ...nextExpense,
      companyId: nextExpense.companyId || data.activeCompanyId,
      amount: nonNegativeNumber(nextExpense.amount),
      updatedAt: new Date().toISOString()
    };
    const exists = data.laborExpenses.some((expense) => expense.id === normalizedExpense.id);
    const nextData = {
      ...data,
      laborExpenses: exists
        ? data.laborExpenses.map((expense) => (expense.id === normalizedExpense.id ? normalizedExpense : expense))
        : [...data.laborExpenses, normalizedExpense]
    };
    updateDataAndSyncCloud(nextData, {
      syncing: "บันทึก HR ในเครื่องแล้ว กำลัง Sync Cloud...",
      success: "บันทึก HR แล้ว และ Sync Cloud สำเร็จ",
      failure: "Sync HR Cloud ไม่สำเร็จ"
    });
    setSelectedHrMonth(normalizedExpense.expenseDate.slice(0, 7));
    return true;
  }

  function deleteLaborExpense(expenseId: string) {
    if (!data) {
      return;
    }

    const nextData = {
      ...data,
      laborExpenses: data.laborExpenses.filter((expense) => expense.id !== expenseId)
    };
    updateDataAndSyncCloud(nextData, {
      syncing: "บันทึก HR ในเครื่องแล้ว กำลัง Sync Cloud...",
      success: "บันทึก HR แล้ว และ Sync Cloud สำเร็จ",
      failure: "Sync HR Cloud ไม่สำเร็จ"
    });
  }

  function openBuyinFromDailyReport(entryDate?: string) {
    setBuyinPrefill({
      projectId: activeProject?.id,
      entryDate: entryDate || dailyDraft?.reportDate || todayString()
    });
    navigateToTab("buyin");
  }

  function saveBuyinEntry(nextEntry: BuyinEntry): boolean {
    if (!data) {
      return false;
    }

    if (!nextEntry.entryDate.trim()) {
      setNotice({ type: "error", text: "กรุณาเลือกวันที่" });
      return false;
    }

    if (nextEntry.amountPaid < 0) {
      setNotice({ type: "error", text: "ยอดเงินต้องไม่ติดลบ" });
      return false;
    }

    if (nextEntry.type === "expense" && !nextEntry.storeName?.trim()) {
      setNotice({ type: "error", text: "กรุณาใส่ร้านค้า" });
      return false;
    }

    if (nextEntry.type === "invoice") {
      if (!nextEntry.vendorName?.trim()) {
        setNotice({ type: "error", text: "กรุณาใส่ชื่อผู้ขาย" });
        return false;
      }

      if (!nextEntry.vendorTaxId?.trim()) {
        setNotice({ type: "error", text: "กรุณาใส่เลขประจำตัวผู้เสียภาษี" });
        return false;
      }

      if (!validateTaxId(nextEntry.vendorTaxId)) {
        setNotice({ type: "error", text: "เลขผู้เสียภาษีควรมี 13 หลัก" });
        return false;
      }
    }

    const amountPaid = nonNegativeNumber(nextEntry.amountPaid);
    const normalizedEntry: BuyinEntry = {
      ...nextEntry,
      companyId: nextEntry.companyId || data.activeCompanyId,
      vendorTaxId: sanitizeTaxId(nextEntry.vendorTaxId ?? ""),
      amountPaid,
      netAmount: calculateBuyinNetAmount(amountPaid, nextEntry.includeVat),
      vatAmount: calculateBuyinVatAmount(amountPaid, nextEntry.includeVat),
      updatedAt: new Date().toISOString()
    };
    const exists = data.buyinEntries.some((entry) => entry.id === normalizedEntry.id);
    const nextData = {
      ...data,
      buyinEntries: exists
        ? data.buyinEntries.map((entry) => (entry.id === normalizedEntry.id ? normalizedEntry : entry))
        : [...data.buyinEntries, normalizedEntry]
    };
    updateDataAndSyncCloud(nextData, {
      syncing: "บันทึก BUYIN ในเครื่องแล้ว กำลัง Sync Cloud...",
      success: "บันทึก BUYIN แล้ว และ Sync Cloud สำเร็จ",
      failure: "Sync BUYIN Cloud ไม่สำเร็จ"
    });
    return true;
  }

  function deleteBuyinEntry(entryId: string) {
    if (!data) {
      return;
    }

    const nextData = {
      ...data,
      buyinEntries: data.buyinEntries.filter((entry) => entry.id !== entryId)
    };
    updateDataAndSyncCloud(nextData, {
      syncing: "บันทึก BUYIN ในเครื่องแล้ว กำลัง Sync Cloud...",
      success: "บันทึก BUYIN แล้ว และ Sync Cloud สำเร็จ",
      failure: "Sync BUYIN Cloud ไม่สำเร็จ"
    });
  }

  function setProblemIssueCount(targetCount: number) {
    if (!dailyDraft) {
      return;
    }

    const safeCount = Math.max(0, targetCount);
    const currentIssues = dailyDraft.problemIssues;

    if (safeCount <= currentIssues.length) {
      updateProblemIssues(currentIssues.slice(0, safeCount));
      return;
    }

    const nextIssues = [...currentIssues];
    while (nextIssues.length < safeCount) {
      nextIssues.push(createEmptyProblemIssue());
    }

    updateProblemIssues(nextIssues);
  }

  function addProblemIssue() {
    if (!dailyDraft) {
      return;
    }

    updateProblemIssues([...dailyDraft.problemIssues, createEmptyProblemIssue()]);
  }

  function updateProblemIssue(issueId: string, patch: Partial<DailyProblemIssue>) {
    if (!dailyDraft) {
      return;
    }

    updateProblemIssues(dailyDraft.problemIssues.map((issue) => (issue.id === issueId ? { ...issue, ...patch } : issue)));
  }

  function deleteProblemIssue(issueId: string) {
    if (!dailyDraft) {
      return;
    }

    updateProblemIssues(dailyDraft.problemIssues.filter((issue) => issue.id !== issueId));
  }

  async function uploadProblemIssuePhotos(issueId: string, fileList: FileList | null) {
    if (!dailyDraft || !fileList) {
      return;
    }

    const issue = dailyDraft.problemIssues.find((entry) => entry.id === issueId);
    if (!issue) {
      return;
    }

    const imageFiles = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    const remainingSlots = Math.max(0, MAX_PROBLEM_ISSUE_PHOTOS - issue.photos.length);

    if (remainingSlots === 0) {
      setNotice({ type: "info", text: "รายการปัญหานี้อัพรูปได้ครบแล้ว" });
      return;
    }

    const acceptedFiles = imageFiles.slice(0, remainingSlots);
    const nextPhotos: DailyProblemPhoto[] = [];

    try {
      for (const file of acceptedFiles) {
        nextPhotos.push({
          id: createId(),
          name: file.name,
          dataUrl: await fileToCompressedDataUrl(file)
        });
      }
    } catch {
      setNotice({ type: "error", text: "อัพรูปปัญหาไม่สำเร็จ" });
      return;
    }

    updateProblemIssue(issueId, {
      photos: limitProblemIssuePhotos([...issue.photos, ...nextPhotos])
    });
    setNotice({ type: "success", text: "อัพรูปปัญหาแล้ว" });
  }

  function removeProblemIssuePhoto(issueId: string, photoId: string) {
    if (!dailyDraft) {
      return;
    }

    const issue = dailyDraft.problemIssues.find((entry) => entry.id === issueId);
    if (!issue) {
      return;
    }

    updateProblemIssue(issueId, {
      photos: issue.photos.filter((photo) => photo.id !== photoId)
    });
  }

  function updateProgressUpdate(updateId: string, patch: Partial<DailyProgressUpdate>) {
    if (!dailyDraft) {
      return;
    }

    updateDailyDraft({
      progressUpdates: dailyDraft.progressUpdates.map((update) =>
        update.id === updateId
          ? {
              ...update,
              ...patch,
              previousProgress: clampProgress(patch.previousProgress ?? update.previousProgress),
              newProgress: clampProgress(patch.newProgress ?? update.newProgress)
            }
          : update
      )
    });
  }

  function validateDailyReportSaveInputs(): boolean {
    if (!data || !activeProject || !dailyDraft) {
      setNotice({ type: "error", text: "ไม่พบโปรเจกต์หรือรายงานที่ต้องการบันทึก" });
      return false;
    }

    if (!dailyDraft.reportDate) {
      setNotice({ type: "error", text: "กรุณาระบุวันที่รายงาน" });
      return false;
    }

    if (dailyDraft.workers.some((worker) => worker.count < 0)) {
      setNotice({ type: "error", text: "จำนวนช่างต้องไม่ติดลบ" });
      return false;
    }

    return true;
  }

  async function saveDailyReport(): Promise<boolean> {
    if (!validateDailyReportSaveInputs() || !data || !activeProject || !dailyDraft) {
      return false;
    }

    setDailyCloudStatus("saving");
    setDailyLocalStatus("saving");
    setIsSyncingCloud(true);

    const previousReportForSave =
      activeReports.find((report) => report.id !== dailyDraft.id && report.reportDate < dailyDraft.reportDate) ?? null;
    const syncedDailyDraft = normalizeDailyReportWithBoqProgress(
      activeProject,
      createDailyReportPdfSnapshot(activeProject, dailyDraft, previousReportForSave).report,
      previousReportForSave
    );
    let nextData = withUpdatedProject(data, activeProject.id, (project) =>
      applyDailyProgressUpdatesToProject(project, syncedDailyDraft.progressUpdates)
    );

    const reportToSave: DailyReport = {
      ...syncedDailyDraft,
      companyId: activeProject.companyId,
      projectId: activeProject.id,
      problems: summarizeProblemIssues(syncedDailyDraft.problemIssues),
      updatedAt: new Date().toISOString()
    };
    const exists = nextData.dailyReports.some((report) => report.id === reportToSave.id);
    nextData = {
      ...nextData,
      dailyReports: exists
        ? nextData.dailyReports.map((report) => (report.id === reportToSave.id ? reportToSave : report))
        : [...nextData.dailyReports, reportToSave]
    };

    const prunedData = pruneDailyReportMediaByRetention(nextData);
    const savedReport = prunedData.dailyReports.find((report) => report.id === reportToSave.id) ?? reportToSave;

    setData(prunedData);
    setDailyDraft(normalizeDailyReportWithBoqProgress(activeProject, savedReport, previousReportForSave));

    try {
      await runLocalFirstCloudSync({
        saveLocal: () => saveLocalData(prunedData),
        pushCloud: () => pushDataToCloudApi(prunedData, getStoredCloudSyncToken())
      });
      setDailyCloudStatus("saved");
      setDailyLocalStatus("saved");
      setNotice({ type: "success", text: "บันทึก Daily Report แล้ว และ Sync Cloud สำเร็จ" });
    } catch (error) {
      setDailyCloudStatus("error");

      if (error instanceof LocalPersistenceError) {
        setDailyLocalStatus("error");
        setNotice({ type: "error", text: `บันทึก Daily Report ในเครื่องไม่สำเร็จ: ${error.message}` });
        return false;
      }

      setDailyLocalStatus("saved");
      const message = error instanceof Error ? error.message : "Sync Cloud ไม่สำเร็จ";
      setNotice({
        type: "error",
        text: cloudSyncFailureText(message, "บันทึกในเครื่องแล้ว ข้อมูล local ยังปลอดภัย")
      });
    } finally {
      setIsSyncingCloud(false);
    }

    return true;
  }

  function changeDailyReportDate(reportDate: string) {
    if (!dailyDraft || !activeProject) {
      return;
    }

    const { savedReport, previousReport } = resolveDailyReportDateSelection(activeReports, reportDate);

    if (savedReport) {
      setDailyCloudStatus("idle");
      setDailyLocalStatus("idle");
      setDailyDraft(normalizeDailyReportWithBoqProgress(activeProject, safeCloneSerializable(savedReport), previousReport));
      setShowPdfPreview(false);
      setNotice({ type: "success", text: `โหลด Daily Report วันที่ ${reportDate} แล้ว สามารถแก้ไขต่อได้` });
      return;
    }

    clearDailySaveStatusOnEdit();
    updateDailyDraft({
      reportDate,
      progressUpdates: activeProject
        ? createCanonicalDailyProgressUpdates(activeProject, dailyDraft.progressUpdates, previousReport)
        : dailyDraft.progressUpdates
    });
    setShowPdfPreview(false);
    setNotice({ type: "info", text: `ยังไม่มีรายงานวันที่ ${reportDate} แก้ไขร่างนี้แล้วกด Save Report เพื่อบันทึกได้` });
  }

  function newDailyReport() {
    if (!activeProject) {
      setNotice({ type: "error", text: "กรุณาสร้างหรือเลือกโปรเจกต์ก่อน" });
      return;
    }

    setDailyCloudStatus("idle");
    setDailyLocalStatus("idle");
    setDailyDraft(createDailyDraftWithBoqProgress(activeProject, latestPriorReport));
    setShowPdfPreview(false);
    setNotice({ type: "info", text: latestPriorReport ? "ดึงข้อมูลล่าสุดมาเป็นร่างของวันนี้แล้ว" : "เริ่มรายงานใหม่สำหรับวันนี้" });
  }

  function openDailyReport(report: DailyReport) {
    if (!activeProject) {
      return;
    }

    const previousForReport =
      activeReports.find((candidate) => candidate.id !== report.id && candidate.reportDate < report.reportDate) ?? null;
    setDailyCloudStatus("idle");
    setDailyLocalStatus("idle");
    setDailyDraft(normalizeDailyReportWithBoqProgress(activeProject, safeCloneSerializable(report), previousForReport));
    setShowPdfPreview(false);
    navigateToTab("daily");
    setNotice({ type: "success", text: "โหลดรายงานจากประวัติแล้ว" });
  }

  function deleteDailyReportNow(reportId: string) {
    if (!data) {
      return;
    }

    const nextData = {
      ...data,
      dailyReports: data.dailyReports.filter((report) => report.id !== reportId)
    };
    setData(nextData);
    saveLocalData(nextData);
    if (dailyDraft?.id === reportId && activeProject) {
      const fallbackReport =
        sortWithCompare(
          nextData.dailyReports.filter((report) => report.projectId === activeProject.id && report.reportDate < todayString()),
          (a, b) => b.reportDate.localeCompare(a.reportDate)
        )[0] ?? null;
      setDailyCloudStatus("idle");
      setDailyLocalStatus("idle");
      setDailyDraft(createDailyDraftWithBoqProgress(activeProject, fallbackReport));
    }
    setShowPdfPreview(false);
    setNotice({ type: "success", text: "ลบ Daily Report แล้ว" });
  }

  function deleteDailyReport(reportId: string) {
    if (!data) {
      return;
    }

    const targetReport = data.dailyReports.find((report) => report.id === reportId);
    const reportLabel = targetReport ? `Daily Report วันที่ ${targetReport.reportDate}` : "Daily Report";

    confirmPrivilegedDeletePassword({
      label: reportLabel,
      confirmText: targetReport?.reportDate ?? "DELETE",
      onConfirm: () => deleteDailyReportNow(reportId)
    });
  }

  function exportDailyReport() {
    if (!dailyDraft) {
      setNotice({ type: "error", text: "ไม่มี Daily Report สำหรับ export" });
      return;
    }

    const blob = new Blob([JSON.stringify(dailyDraft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-report-${dailyDraft.reportDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ type: "success", text: "Export Daily Report JSON แล้ว" });
  }

  async function uploadDailyReportPhotos(fileList: FileList | null) {
    if (!dailyDraft || !fileList) {
      return;
    }

    const selectedFiles = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    const remainingSlots = Math.max(0, MAX_DAILY_REPORT_PHOTOS - dailyDraft.photos.length);

    if (remainingSlots === 0) {
      setNotice({ type: "error", text: `อัพรูปได้สูงสุด ${MAX_DAILY_REPORT_PHOTOS} รูปต่อรายงาน` });
      return;
    }

    const acceptedFiles = selectedFiles.slice(0, remainingSlots);
    const nextPhotos: DailyReportPhoto[] = [];

    for (const file of acceptedFiles) {
      const dataUrl = await fileToCompressedDataUrl(file);
      nextPhotos.push({
        id: createId(),
        name: file.name,
        dataUrl
      });
    }

    updateDailyDraft({
      photos: limitDailyReportPhotos([...dailyDraft.photos, ...nextPhotos])
    });

    if (selectedFiles.length > acceptedFiles.length) {
      setNotice({ type: "info", text: `รับรูปเพิ่มได้อีก ${remainingSlots} รูป จึงตัดส่วนเกินออกแล้ว` });
      return;
    }

    setNotice({ type: "success", text: `เพิ่มรูปเข้ารายงานแล้ว ${nextPhotos.length} รูป` });
  }

  function removeDailyReportPhoto(photoId: string) {
    if (!dailyDraft) {
      return;
    }

    updateDailyDraft({
      photos: dailyDraft.photos.filter((photo) => photo.id !== photoId)
    });
    setNotice({ type: "success", text: "ลบรูปออกจากรายงานแล้ว" });
  }

  function previewDailyReportPdf() {
    if (!dailyDraft) {
      setNotice({ type: "error", text: "ไม่มี Daily Report สำหรับ preview" });
      return;
    }

    setShowPdfPreview(true);
    setNotice({ type: "success", text: "เปิด preview แล้ว ตรวจรูปแบบก่อน export PDF ได้ทันที" });
  }

  async function exportDailyReportPdf() {
    if (!activeProject || !dailyDraft) {
      setNotice({ type: "error", text: "ไม่พบข้อมูลพร้อมสำหรับ Save PDF" });
      return;
    }

    setIsExportingPdf(true);
    setNotice({ type: "info", text: "กำลังสร้าง PDF..." });

    try {
      const exportRoot = await waitForPdfExportRoot(pdfExportRef);

      if (
        !canExportDailyReportPdf({
          hasProject: true,
          hasReport: true,
          hasExportRoot: Boolean(exportRoot)
        }) ||
        !exportRoot
      ) {
        throw new Error("ไม่พบโครง PDF สำหรับดาวน์โหลด");
      }

      await downloadElementAsPdf(
        exportRoot,
        createDailyReportPdfFilename(activeProject.name || "project", dailyDraft.reportDate)
      );
      setNotice({ type: "success", text: "ดาวน์โหลด PDF แล้ว" });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? `สร้าง PDF ไม่สำเร็จ: ${error.message}` : "สร้าง PDF ไม่สำเร็จ"
      });
    } finally {
      setIsExportingPdf(false);
    }
  }

  if (!data) {
    return (
      <main className="grid min-h-screen w-full max-w-full min-w-0 place-items-center overflow-x-hidden bg-slate-50 p-6 text-slate-700">
        <Card className="w-full max-w-sm text-center">
          <p className="text-sm font-semibold">Loading workspace</p>
          <p className="mt-2 text-xs text-slate-500">
            {isAuthChecking ? "กำลังตรวจสอบ Login และโหลดสิทธิ์จาก Cloud" : "กำลังเตรียมข้อมูล"}
          </p>
        </Card>
      </main>
    );
  }

  const boqTotal = activeProject ? calculateOverallBoqTotal(activeProject) : 0;
  const progress = activeProject ? calculateWeightedProgress(activeProject) : 0;
  const latestReport = activeReports[0];
  const totalContract = activeProject
    ? activeProject.budget.mainContract + activeProject.budget.variationOrder
    : 0;
  const totalWorkers = dailyDraft?.workers.reduce((total, worker) => total + worker.count, 0) ?? 0;
  const effectiveRole = memberAccess.hasSession ? memberAccess.role ?? activeCompany?.role ?? "viewer" : "owner";
  const dailyReportPermissions = resolveDailyReportPermissions(effectiveRole);
  const projectActionPermissions = resolveProjectActionPermissions(effectiveRole);
  const canShowProjectReadinessBadges =
    memberAccess.canManageMembers && projectActionPermissions.canSeeProjectReadinessBadges;
  const floatingSaveAction =
    activeTab === "daily"
      ? {
          label: "บันทึก Daily Report",
          busy: dailyCloudStatus === "saving",
          disabled: dailyCloudStatus === "saving",
          canStart: () => {
            if (!dailyReportPermissions.canSaveReport) {
              setNotice({ type: "error", text: "ไม่มีสิทธิ์บันทึก Daily Report" });
              return false;
            }

            if (!dailyDraft) {
              setNotice({ type: "error", text: "ไม่มี Daily Report ให้บันทึก" });
              return false;
            }

            return validateDailyReportSaveInputs();
          },
          onSave: () => {
            return saveDailyReport();
          }
        }
      : activeTab === "hr"
        ? {
            label: "Sync HR Cloud",
            busy: isSyncingCloud,
            disabled: isSyncingCloud || isLoadingCloud,
            canStart: () => Boolean(data),
            onSave: () => {
              return syncWorkspaceToCloud({
                syncing: "กำลัง Sync HR Cloud...",
                success: "Sync HR Cloud สำเร็จ มือถือกด Load Cloud หรือ refresh เพื่อเห็นข้อมูลล่าสุด",
                failure: "Sync HR Cloud ไม่สำเร็จ"
              });
            }
          }
        : activeTab === "buyin"
          ? {
              label: "Sync BUYIN Cloud",
              busy: isSyncingCloud,
              disabled: isSyncingCloud || isLoadingCloud,
              canStart: () => Boolean(data),
              onSave: () => {
                return syncWorkspaceToCloud({
                  syncing: "กำลัง Sync BUYIN Cloud...",
                  success: "Sync BUYIN Cloud สำเร็จ มือถือกด Load Cloud หรือ refresh เพื่อเห็นข้อมูลล่าสุด",
                  failure: "Sync BUYIN Cloud ไม่สำเร็จ"
                });
              }
            }
          : {
              label: "บันทึก Project",
              busy: isSaving || isSyncingCloud || isLoadingCloud,
              disabled: isSaving || isSyncingCloud || isLoadingCloud,
              canStart: validateProjectSaveInputs,
              onSave: () => {
                return handleSave();
              }
            };
  async function runFloatingSaveAction() {
    if (floatingSaveAction.disabled || floatingSaveAction.busy || isFloatingSaveMinBusy) {
      return;
    }

    if (!floatingSaveAction.canStart()) {
      return;
    }

    const startedAt = Date.now();
    setIsFloatingSaveMinBusy(true);

    try {
      await floatingSaveAction.onSave();
    } finally {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = MIN_FLOATING_SAVE_SPINNER_MS - elapsedMs;

      if (remainingMs > 0) {
        await delay(remainingMs);
      }

      setIsFloatingSaveMinBusy(false);
    }
  }
  const showProjectSetupPanel = activeTab === "info";
  const visibleTabs = tabs.filter((tab) => {
    if (tab.id === "dashboard") {
      return memberAccess.canAccess("dashboard");
    }
    if (tab.id === "info") {
      return memberAccess.canAccess("project");
    }
    if (tab.id === "daily") {
      return memberAccess.canAccess("daily_report");
    }
    if (tab.id === "hr") {
      return memberAccess.canAccess("hr");
    }
    return memberAccess.canAccess("buyin");
  });
  const workspaceUserName =
    memberAccess.displayName?.trim() ||
    (memberAccess.hasSession ? "ผู้ใช้งาน" : "ผู้ใช้งาน local");
  const reporterName = workspaceUserName;
  const reporterPhone = memberAccess.phone?.trim() || "-";
  const topLoadCloudDisabled = isLoadingCloud || isSaving || isSyncingCloud || dailyCloudStatus === "saving";
  const workspaceStatusChip =
    isLoadingCloud
      ? {
          label: "Loading Cloud...",
          className: "border-sky-200 bg-sky-50 text-sky-700"
        }
      : isSaving
        ? {
            label: "Saving Project...",
            className: "border-sky-200 bg-sky-50 text-sky-700"
          }
        : dailyCloudStatus === "saving"
          ? {
              label: "Saving to Cloud...",
              className: "border-sky-200 bg-sky-50 text-sky-700"
            }
          : dailyCloudStatus === "saved"
            ? {
                label: "Saved to Cloud",
                className: "border-emerald-100 bg-emerald-50 text-emerald-700"
              }
            : dailyCloudStatus === "error"
              ? {
                  label: "Cloud Save Failed",
                  className: "border-red-200 bg-red-50 text-red-700"
                }
              : isSyncingCloud
                ? {
                    label: "Syncing Cloud...",
                    className: "border-sky-200 bg-sky-50 text-sky-700"
                  }
                : {
                    label: "Cloud Sync Ready",
                    className: "border-emerald-100 bg-emerald-50 text-emerald-700"
                  };
  const shellTitle =
    activeTab === "dashboard"
      ? `${localGreeting}, ${workspaceUserName}`
      : activeTab === "info"
        ? "ข้อมูลโครงการ"
      : activeTab === "daily"
        ? "รายงานประจำวัน"
        : activeTab === "hr"
          ? "HR / ทีมช่าง"
          : "BUYIN / จัดซื้อ";
  const shellSubtitle =
    activeTab === "dashboard"
      ? "ภาพรวมการดำเนินงานทั้งหมด"
      : activeTab === "info"
        ? "Project, BOQ และข้อมูลลูกค้ายังทำงานบน logic เดิมทั้งหมด"
        : activeTab === "daily"
          ? "Daily Report workflow, save, history, import/export และ PDF ยังทำงานตามเดิม"
          : activeTab === "hr"
            ? "ทะเบียนทีมช่าง ค่าแรงรายวัน และสรุปภาษีหัก ณ ที่จ่าย"
            : "บันทึกซื้อของ ใบกำกับผู้ขาย และ Export CSV สำหรับบัญชี";
  const shellGreetingSupport =
    activeTab === "dashboard" ? `ขอให้เป็นวันที่ดี ${smileGreetingEmoji || "😊"}` : null;
  const realShellItems = visibleTabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    mobileLabel: tab.id === "daily" ? "Daily Report" : tab.id === "hr" ? "HR" : tab.label,
    icon: tab.id === "dashboard" ? "dashboard" : tab.id === "info" ? "project" : tab.id === "daily" ? "daily" : tab.id === "hr" ? "team" : "export",
    onClick: () => navigateToTab(tab.id),
    active: activeTab === tab.id
  })) as Array<{ id: TabId; label: string; mobileLabel: string; icon: ShellIconName; onClick: () => void; active: boolean }>;
  const mobilePrimaryTabs = getMobilePrimaryTabs().filter((tab) => visibleTabs.some((visibleTab) => visibleTab.id === tab.id));
  const secondaryMobileShellItems = realShellItems.filter((item) => item.id === "hr" || item.id === "buyin");

  return (
    <main data-desktop-workspace-shell className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-slate-900 md:bg-[var(--background)]">
      <input
        ref={importInputRef}
        className="hidden"
        type="file"
        accept="application/json"
        onChange={handleImport}
        data-testid="workspace-import-input"
      />
      {activeTab === "info" ? (
        <FloatingCloudSaveButton
          isSaving={floatingSaveAction.busy || isFloatingSaveMinBusy}
          onSave={runFloatingSaveAction}
          label={floatingSaveAction.label}
          disabled={floatingSaveAction.disabled || isFloatingSaveMinBusy}
          className="flex md:hidden"
        />
      ) : null}
      <div className="mx-auto w-full max-w-[1740px] min-w-0 overflow-x-hidden px-0 py-0 sm:px-2 sm:py-2 md:px-4 md:py-4">
        <div className="w-full max-w-full min-w-0 overflow-x-hidden rounded-none bg-white shadow-none md:rounded-[18px] md:border md:border-slate-200/80 md:shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <div className="grid min-h-screen w-full max-w-full min-w-0 overflow-x-hidden md:grid-cols-[var(--pcon-desktop-sidebar-width)_minmax(0,1fr)]">
            <aside data-desktop-sidebar className="hidden border-r border-slate-200 bg-white p-4 text-slate-700 md:flex md:flex-col">
              <div className="flex items-center gap-2 border-b border-slate-100 px-2 pb-5">
                <PconReferenceMark className="h-9 w-9 shrink-0" />
                <div>
                  <h1 className="text-[1.7rem] font-bold leading-none tracking-[-0.04em] text-slate-950">PCON</h1>
                  <p className="mt-1 text-[10px] font-semibold tracking-[0.04em] text-slate-500">Project Control</p>
                </div>
              </div>

              <div data-desktop-main-modules className="mt-6 grid gap-1.5">
                {realShellItems.map((item) => (
                  <ShellNavButton key={item.label} label={item.label} icon={item.icon} active={item.active} onClick={item.onClick} />
                ))}
              </div>

              <div className="mt-auto flex items-center gap-3 border-t border-slate-100 px-3 pt-5 text-sm font-semibold text-slate-500">
                <ShellIcon name="settings" className="h-5 w-5" />
                <span>ตั้งค่า</span>
              </div>
            </aside>

            <section className="w-full max-w-full min-w-0 overflow-x-hidden bg-white">
              <header data-desktop-workspace-header className="w-full max-w-full min-w-0 overflow-x-hidden border-b border-slate-200 bg-white px-4 pt-4 md:px-6 md:py-4">
                <div className="flex w-full max-w-full min-w-0 flex-col gap-0 md:flex-row md:items-center md:justify-between md:gap-4">
                  <div className="relative md:hidden">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_44px] items-center gap-2">
                      <div className="flex h-12 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 shadow-sm">
                        <PconReferenceMark className="h-8 w-8 shrink-0" />
                        <div className="leading-none">
                          <p className="text-[12px] font-black text-slate-950">PCON</p>
                          <p className="mt-0.5 text-[8px] font-semibold text-slate-500">Project Control</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        data-mobile-active-project
                        aria-expanded={isMobileProjectSwitcherOpen}
                        aria-label="เลือกโปรเจกต์ปัจจุบัน"
                        className="flex h-12 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left shadow-sm"
                        onClick={() => setIsMobileProjectSwitcherOpen((current) => !current)}
                      >
                        <MobileShellIcon name="dashboard" className="h-5 w-5 shrink-0 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800">
                          {activeProject?.name ? `${activeProject.name} • ปัจจุบัน` : companyProjects.length > 0 ? "เลือกโปรเจกต์" : "ยังไม่มีโปรเจกต์"}
                        </span>
                        <MobileShellIcon name="chevron" className={`h-4 w-4 shrink-0 text-slate-500 transition ${isMobileProjectSwitcherOpen ? "rotate-180" : ""}`} />
                      </button>

                      <button
                        type="button"
                        aria-label="เมนูเพิ่มเติม"
                        aria-expanded={isMobileWorkspaceMenuOpen}
                        className="grid h-11 w-11 place-items-center rounded-xl bg-white text-slate-700"
                        onClick={() => setIsMobileWorkspaceMenuOpen((current) => !current)}
                      >
                        <MobileShellIcon name={isMobileWorkspaceMenuOpen ? "close" : "menu"} className="h-7 w-7" />
                      </button>
                    </div>

                    {isMobileProjectSwitcherOpen ? (
                      <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 rounded-[22px] border border-emerald-100 bg-white p-2 shadow-[0_22px_40px_rgba(15,23,42,0.16)]">
                        {companyProjects.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-bold text-slate-500">
                            ยังไม่มีโปรเจกต์
                          </div>
                        ) : (
                          <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
                            {companyProjects.map((project) => (
                              <button
                                key={project.id}
                                type="button"
                                className={`rounded-2xl border px-3 py-3 text-left transition ${
                                  project.id === data.activeProjectId
                                    ? "border-emerald-300 bg-emerald-50"
                                    : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/70"
                                }`}
                                onClick={() => setActiveProjectFromMobile(project.id)}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-slate-950">{project.name || "ยังไม่มีชื่อโปรเจกต์"}</p>
                                    <p className="mt-1 truncate text-xs font-bold text-slate-500">
                                      {project.status || "ยังไม่ระบุสถานะ"}{project.customer.name ? ` • ${project.customer.name}` : ""}
                                    </p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
                                    {Math.round(calculateWeightedProgress(project))}%
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div
                    data-dashboard-header="balanced"
                    className="hidden min-w-0 flex-1 md:grid md:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)] md:items-start md:gap-5 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]"
                  >
                    <div className="min-w-0 max-w-[26rem]">
                      <p className="text-xs font-semibold text-slate-500">โปรเจกต์ปัจจุบัน</p>
                      <h1 className="mt-1 max-w-[22ch] truncate text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-slate-950">{shellTitle}</h1>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500">{shellSubtitle}</p>
                      {shellGreetingSupport ? <p className="mt-1 text-xs font-semibold text-emerald-700">{shellGreetingSupport}</p> : null}
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-3 xl:grid-cols-[minmax(250px,0.9fr)_minmax(220px,0.72fr)]">
                        <button
                          type="button"
                          onClick={() => navigateToTab("info")}
                          className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-slate-500">โปรเจกต์ที่เลือก</p>
                            <p className="mt-1 truncate text-sm font-bold text-slate-950">{activeProject?.name || "ยังไม่มีโปรเจกต์"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{activeProject?.status || "พร้อมเริ่ม setup"}</p>
                          </div>
                          <div className="rounded-full bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
                            {activeProject ? `${Math.round(progress)}%` : "setup"}
                          </div>
                        </button>

                        <form
                          ref={projectSearchPanelRef}
                          data-desktop-project-switcher
                          className="relative flex min-h-12 items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                          onSubmit={(event: FormEvent<HTMLFormElement>) => {
                            event.preventDefault();
                            setIsProjectSearchOpen(true);
                          }}
                        >
                          <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm text-slate-500">⌕</span>
                          <div className="min-w-0 flex-1">
                            <label htmlFor="project-search-input" className="text-[10px] font-semibold text-slate-500">
                              ค้นหาโปรเจกต์
                            </label>
                            <input
                              id="project-search-input"
                              type="search"
                              value={projectSearchQuery}
                              placeholder="ค้นหาชื่อโปรเจกต์"
                              onFocus={() => setIsProjectSearchOpen(true)}
                              onChange={(event) => {
                                setProjectSearchQuery(event.target.value);
                                setIsProjectSearchOpen(true);
                              }}
                              className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                            />
                            <p className="mt-1 text-[10px] font-medium text-slate-500">กดเลือกเพื่อเปิดหน้า Project</p>
                          </div>
                          <button
                            type="submit"
                            className="mt-1 shrink-0 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-100"
                          >
                            ค้นหา
                          </button>

                          {isProjectSearchOpen ? (
                            <div className="absolute inset-x-4 top-[calc(100%-0.35rem)] z-20 rounded-[22px] border border-slate-200 bg-white p-2 shadow-[0_22px_40px_rgba(15,23,42,0.14)]">
                              {projectSearchQuery.trim().length === 0 ? (
                                <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-500">พิมพ์ชื่อโปรเจกต์เพื่อเริ่มค้นหา</p>
                              ) : filteredProjectSearchResults.length > 0 ? (
                                <div className="grid gap-2">
                                  {filteredProjectSearchResults.map((project) => (
                                    <button
                                      key={project.id}
                                      type="button"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => openProjectFromSearch(project.id)}
                                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                                        project.id === data?.activeProjectId
                                          ? "border-emerald-200 bg-emerald-50"
                                          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/70"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-black text-slate-950">{project.name || "ยังไม่มีชื่อโปรเจกต์"}</p>
                                          <p className="mt-1 truncate text-xs text-slate-500">
                                            {project.customer.siteAddress || project.customer.name || "ยังไม่ระบุไซต์งาน"}
                                          </p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
                                          {Math.round(calculateWeightedProgress(project))}%
                                        </span>
                                      </div>
                                      <div className="mt-2 flex items-center justify-between gap-3">
                                        <span className="truncate text-xs font-semibold text-emerald-700">{project.status || "พร้อมเริ่มงาน"}</span>
                                        <span className="shrink-0 text-xs font-bold text-slate-500">
                                          {project.id === data?.activeProjectId ? "เปิดอยู่ตอนนี้" : "เลือกโปรเจกต์"}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-500">ไม่พบโปรเจกต์ที่ค้นหา</p>
                              )}
                            </div>
                          ) : null}
                        </form>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                          {activeCompany?.name ?? "บริษัทของฉัน"}
                        </span>
                        {activeProject ? (
                          <Button className="min-h-10 rounded-lg px-3 text-sm" onClick={() => navigateToTab("daily")}>
                            เปิด Daily Report ของวันนี้
                          </Button>
                        ) : null}
                        {activeProject && activeTab !== "info" ? (
                          <Button variant="secondary" className="min-h-10 rounded-lg px-3 text-sm" onClick={() => navigateToTab("info")}>
                            แก้ไข Project + BOQ
                          </Button>
                        ) : null}
                        {dailyCloudStatus === "error" ? (
                          <button type="button" className={`rounded-full border px-3 py-1.5 text-xs font-bold ${workspaceStatusChip.className}`} onClick={openCloudSyncGuide}>
                            {workspaceStatusChip.label}
                          </button>
                        ) : (
                          <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${workspaceStatusChip.className}`}>
                            {workspaceStatusChip.label}
                          </span>
                        )}
                        <DesktopToolMenu>
                          {projectActionPermissions.canLoadCloud ? (
                            <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" aria-label="Load Cloud" onClick={handleLoadCloud} disabled={topLoadCloudDisabled}>
                              {isLoadingCloud ? "Loading..." : "Load Cloud"}
                            </Button>
                          ) : null}
                          {projectActionPermissions.canSyncCloud ? (
                            <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" onClick={handleSyncCloud} disabled={isSyncingCloud}>
                              {isSyncingCloud ? "Syncing..." : "Sync Cloud"}
                            </Button>
                          ) : null}
                          {projectActionPermissions.canExportJson ? <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" onClick={handleExport}>Export Workspace</Button> : null}
                          {projectActionPermissions.canImportJson ? <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" onClick={() => importInputRef.current?.click()} disabled={isImporting}>{isImporting ? "Importing..." : "Import Workspace"}</Button> : null}
                          {activeTab === "daily" && dailyDraft ? (
                            <>
                              {dailyReportPermissions.canCreateReport ? <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" onClick={newDailyReport}>รายงานใหม่</Button> : null}
                              {dailyReportPermissions.canPreviewPdf ? <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" onClick={previewDailyReportPdf}>Preview PDF</Button> : null}
                              {dailyReportPermissions.canSavePdf ? <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" onClick={exportDailyReportPdf}>Save PDF</Button> : null}
                              {dailyReportPermissions.canExportJson ? <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" onClick={exportDailyReport}>ส่งออก JSON</Button> : null}
                              {dailyReportPermissions.canDeleteReport ? <Button variant="danger" className="w-full rounded-lg px-3 text-sm" onClick={() => deleteDailyReport(dailyDraft.id)}>ลบรายงาน</Button> : null}
                            </>
                          ) : null}
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">role: {effectiveRole}</span>
                          <VersionBadge version={APP_VERSION} releaseNote={APP_RELEASE_NOTE} />
                          <AuthStatus />
                          {memberAccess.canManageMembers ? <a href="/admin" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-emerald-50">Admin</a> : null}
                          <Button variant="secondary" className="w-full rounded-lg px-3 text-sm" onClick={() => navigateToTab("dashboard")}>Home</Button>
                        </DesktopToolMenu>
                      </div>
                    </div>
                  </div>

                  <div data-mobile-workspace-menu className={`${isMobileWorkspaceMenuOpen ? "block" : "hidden"} w-full max-w-full min-w-0 md:hidden`}>
                    <div className="hidden">
                      <Button variant="secondary" className="min-w-0 px-3" onClick={() => navigateToTab("dashboard")}>
                        Home
                      </Button>
                      {projectActionPermissions.canLoadCloud ? (
                        <Button
                          variant="secondary"
                          className="min-w-0 px-3"
                          aria-label="Load Cloud"
                          onClick={handleLoadCloud}
                          disabled={topLoadCloudDisabled}
                        >
                          {isLoadingCloud ? "Loading..." : "Load Cloud"}
                        </Button>
                      ) : null}
                      <button
                        type="button"
                        aria-expanded={isMobileWorkspaceMenuOpen}
                        aria-controls="mobile-workspace-menu-panel"
                        className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-100"
                        onClick={() => setIsMobileWorkspaceMenuOpen((current) => !current)}
                      >
                        {isMobileWorkspaceMenuOpen ? "ปิดเครื่องมือ" : "เครื่องมือ"}
                      </button>
                    </div>

                    {isMobileWorkspaceMenuOpen ? (
                      <div
                        id="mobile-workspace-menu-panel"
                        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 grid max-h-[78vh] grid-cols-2 gap-2 overflow-y-auto rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
                      >
                        <div className="col-span-2 flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <p className="text-base font-black text-slate-950">เมนูและเครื่องมือ</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">{shellTitle}</p>
                          </div>
                          <button
                            type="button"
                            aria-label="ปิดเมนู"
                            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600"
                            onClick={() => setIsMobileWorkspaceMenuOpen(false)}
                          >
                            <MobileShellIcon name="close" className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="col-span-2 grid grid-cols-2 gap-2 border-b border-slate-100 pb-3">
                          {projectActionPermissions.canCreateProject ? (
                            <button type="button" className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-800" onClick={handleNewProject}>
                              สร้างโปรเจกต์ใหม่
                            </button>
                          ) : null}
                          {secondaryMobileShellItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`min-h-12 rounded-2xl px-3 text-sm font-black ${
                                item.active ? "bg-emerald-700 text-white" : "border border-slate-200 bg-slate-50 text-slate-800"
                              }`}
                              onClick={item.onClick}
                            >
                              {item.mobileLabel}
                            </button>
                          ))}
                        </div>
                        {activeTab === "daily" && dailyDraft ? (
                          <div className="col-span-2 grid grid-cols-2 gap-2 border-b border-slate-100 pb-3">
                            {dailyReportPermissions.canCreateReport ? <Button variant="secondary" onClick={newDailyReport}>รายงานใหม่</Button> : null}
                            {dailyReportPermissions.canPreviewPdf ? <Button variant="secondary" onClick={previewDailyReportPdf}>Preview PDF</Button> : null}
                            {dailyReportPermissions.canSavePdf ? <Button variant="secondary" onClick={exportDailyReportPdf}>Save PDF</Button> : null}
                            {dailyReportPermissions.canExportJson ? <Button variant="secondary" onClick={exportDailyReport}>ส่งออก JSON</Button> : null}
                            {dailyReportPermissions.canDeleteReport ? <Button variant="danger" onClick={() => deleteDailyReport(dailyDraft.id)}>ลบรายงาน</Button> : null}
                          </div>
                        ) : null}
                        <div className="col-span-2 grid grid-cols-2 gap-2 border-b border-slate-100 pb-3">
                          {projectActionPermissions.canLoadCloud ? <Button variant="secondary" onClick={handleLoadCloud} disabled={topLoadCloudDisabled}>{isLoadingCloud ? "Loading..." : "Load Cloud"}</Button> : null}
                          {projectActionPermissions.canSyncCloud ? <Button variant="secondary" onClick={handleSyncCloud} disabled={isSyncingCloud}>{isSyncingCloud ? "Syncing..." : "Sync Cloud"}</Button> : null}
                          {projectActionPermissions.canExportJson ? <Button variant="secondary" onClick={handleExport}>Export Workspace</Button> : null}
                          {projectActionPermissions.canImportJson ? <Button variant="secondary" onClick={() => importInputRef.current?.click()} disabled={isImporting}>{isImporting ? "Importing..." : "Import Workspace"}</Button> : null}
                        </div>
                        <span className="min-w-0 truncate rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                          {activeCompany?.name ?? "บริษัทของฉัน"}
                        </span>
                        <span className="min-w-0 truncate rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                          role: {effectiveRole}
                        </span>
                        {dailyCloudStatus === "error" ? (
                          <button
                            type="button"
                            className={`min-w-0 truncate rounded-full border px-3 py-2 text-xs font-black ${workspaceStatusChip.className}`}
                            onClick={openCloudSyncGuide}
                          >
                            {workspaceStatusChip.label}
                          </button>
                        ) : (
                          <span className={`min-w-0 truncate rounded-full border px-3 py-2 text-xs font-black ${workspaceStatusChip.className}`}>
                            {workspaceStatusChip.label}
                          </span>
                        )}
                        <VersionBadge version={APP_VERSION} releaseNote={APP_RELEASE_NOTE} />
                        <AuthStatus />
                        {memberAccess.canManageMembers ? (
                          <a href="/admin" className="min-w-0 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 shadow-sm hover:bg-emerald-50">
                            Admin
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <MobileReferenceTabs
                  tabs={mobilePrimaryTabs}
                  activeTab={activeTab}
                  onNavigate={(tabId) => navigateToTab(tabId)}
                />

                {canShowProjectReadinessBadges ? (
                  <div
                    className={`mt-4 max-w-full min-w-0 gap-2 text-xs font-bold text-slate-500 ${
                      isMobileWorkspaceMenuOpen ? "grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center" : "hidden"
                    }`}
                  >
                    <span className="min-w-0 truncate rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">Phase 3 login-ready</span>
                    <span className="min-w-0 truncate rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">Phase 2 local-first + cloud-ready</span>
                    <span className="min-w-0 truncate rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">No fake workflow</span>
                    <span className="min-w-0 truncate rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">Daily Report refreshed</span>
                  </div>
                ) : null}
              </header>

              <div
                ref={contentStartRef}
                tabIndex={-1}
                data-testid="workspace-content-start"
                className="w-full max-w-full min-w-0 overflow-x-hidden px-4 py-4 pb-32 outline-none md:px-6 md:py-6"
              >
                {notice ? (
                  <div
                    data-mobile-safe-notice
                    className={`${activeTab === "daily" || notice.type === "error" ? "sticky top-2" : "hidden md:block"} z-30 mb-5 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm md:static ${
                      notice.type === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : notice.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-sky-200 bg-sky-50 text-sky-800"
                    }`}
                  >
                    {notice.text}
                  </div>
                ) : null}

                {projectActionPermissions.canUseFullProjectActions && (showCloudSyncGuide || dailyCloudStatus === "error") ? (
                  <CloudSyncGuidePanel
                    health={cloudSyncHealth}
                    isChecking={isCheckingCloudHealth}
                    onRunCheck={openCloudSyncGuide}
                    onClose={() => setShowCloudSyncGuide(false)}
                  />
                ) : null}

                {showProjectSetupPanel && activeProject ? (
                  <Card className="mb-6 hidden overflow-hidden md:block">
                    <div className="grid gap-5 xl:grid-cols-[220px_1fr_180px] xl:items-center">
                      <PlaceholderProjectVisual
                        label="Project"
                        compact
                        imageUrl={activeProject.coverImage?.dataUrl}
                        imageAlt={activeProject.coverImage?.name ?? activeProject.name}
                      />
                      <div>
                        <div className="mb-4 max-w-xl">
                          <Field label="ชื่อบริษัทของเรา">
                            <TextInput
                              value={activeCompany?.name ?? ""}
                              onChange={(event) => updateCompanyName(event.target.value)}
                              placeholder="เช่น PCON Construction"
                            />
                          </Field>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className="line-clamp-2 max-w-3xl text-3xl font-black leading-tight tracking-tight text-slate-950"
                            title={activeProject.name}
                          >
                            {activeProject.name}
                          </h2>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            {activeProject.status}
                          </span>
                        </div>
                        <p
                          className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-400"
                          title={`${activeProject.customer.name || "ยังไม่ระบุลูกค้า"} • ${
                            latestReport ? latestReport.reportDate : "ยังไม่มีรายงานล่าสุด"
                          }`}
                        >
                          {activeProject.customer.name || "ยังไม่ระบุลูกค้า"} • {latestReport ? latestReport.reportDate : "ยังไม่มีรายงานล่าสุด"}
                        </p>
                        <div className="mt-5 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Contract</p>
                            <p className="mt-2 text-lg font-black leading-tight text-slate-950 sm:text-xl" title={formatCurrency(totalContract)}>
                              {formatCompactCurrency(totalContract)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">BOQ Total</p>
                            <p className="mt-2 text-lg font-black leading-tight text-slate-950 sm:text-xl" title={formatCurrency(boqTotal)}>
                              {formatCompactCurrency(boqTotal)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Latest Summary</p>
                            <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-700">
                              {latestReport?.summary || "ยังไม่มี Daily Report ล่าสุด"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                            <span>Project Progress</span>
                            <span>{formatPercent(progress)}</span>
                          </div>
                          <ProgressBar value={progress} />
                        </div>
                      </div>
                      <div data-project-desktop-action-bar className="grid gap-4">
                        <div className="grid place-items-center rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                          <ProgressRing value={progress} />
                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Weighted Progress</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                          {projectActionPermissions.canSaveProject ? (
                            <Button onClick={handleSave} disabled={isSaving}>
                              {isSaving ? "Saving..." : "Save Project"}
                            </Button>
                          ) : null}
                          {projectActionPermissions.canSaveProject ? (
                            <Button
                              variant="amber"
                              onClick={markProjectDone}
                              disabled={isSaving || isSyncingCloud || activeProject.status === "จบงานแล้ว"}
                            >
                              Project done
                            </Button>
                          ) : null}
                          {projectActionPermissions.canSyncCloud ? (
                            <Button variant="secondary" onClick={handleSyncCloud} disabled={isSyncingCloud}>
                              {isSyncingCloud ? "Syncing..." : "Sync Cloud"}
                            </Button>
                          ) : null}
                          {projectActionPermissions.canLoadCloud ? (
                            <Button variant="secondary" onClick={handleLoadCloud} disabled={topLoadCloudDisabled}>
                              {isLoadingCloud ? "Loading..." : "Load Cloud"}
                            </Button>
                          ) : null}
                          {projectActionPermissions.canSetCloudToken ? (
                            <Button variant="secondary" onClick={handleSetCloudToken}>
                              Set Token
                            </Button>
                          ) : null}
                          {projectActionPermissions.canClearCloudToken ? (
                            <Button variant="ghost" onClick={handleClearCloudToken}>
                              Clear Token
                            </Button>
                          ) : null}
                          {projectActionPermissions.canExportJson ? (
                            <div className="grid gap-1">
                              <Button variant="secondary" onClick={handleExport}>
                                Export
                              </Button>
                              <p className="text-[10px] font-bold leading-4 text-amber-700">
                                ไฟล์นี้มีข้อมูลส่วนบุคคล กรุณาเก็บรักษาอย่างปลอดภัย
                              </p>
                            </div>
                          ) : null}
                          {projectActionPermissions.canImportJson ? (
                            <Button variant="secondary" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
                              {isImporting ? "Importing..." : "Import"}
                            </Button>
                          ) : null}
                          {projectActionPermissions.canDeleteProject ? (
                            <Button variant="danger" onClick={handleDeleteProject}>
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : null}

                {showProjectSetupPanel && !activeProject ? (
                  <Card className="mb-6 overflow-hidden">
                    <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
                      <div>
                        <div className="mb-4 max-w-xl">
                          <Field label="ชื่อบริษัทของเรา">
                            <TextInput
                              value={activeCompany?.name ?? ""}
                              onChange={(event) => updateCompanyName(event.target.value)}
                              placeholder="เช่น PCON Construction"
                            />
                          </Field>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">Workspace is ready</p>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">เริ่มจากโปรเจกต์แรกของคุณ</h2>
                        <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                          สร้างโปรเจกต์เพื่อเริ่ม BOQ และ Daily Report หรือใช้ Load Cloud เพื่อนำข้อมูลงานที่มีอยู่ขึ้นมาใน shell ใหม่ได้ทันที
                        </p>
                        {projectActionPermissions.canCreateProject ? (
                          <div className="mt-6 flex flex-wrap gap-2">
                            <Button onClick={handleNewProject}>+ New Project</Button>
                            {projectActionPermissions.canLoadCloud ? (
                              <Button variant="secondary" onClick={handleLoadCloud} disabled={topLoadCloudDisabled}>
                                {isLoadingCloud ? "Loading..." : "Load Cloud"}
                              </Button>
                            ) : null}
                            {projectActionPermissions.canSetCloudToken ? (
                              <Button variant="secondary" onClick={handleSetCloudToken}>
                                Set Token
                              </Button>
                            ) : null}
                            {projectActionPermissions.canImportJson ? (
                              <Button variant="secondary" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
                                {isImporting ? "Importing..." : "Import"}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <PlaceholderProjectVisual label="Workspace" />
                    </div>
                  </Card>
                ) : null}

                {activeTab === "dashboard" ? (
                  <DashboardView
                    data={data}
                    stats={dashboardStats}
                    activeProjectId={data.activeProjectId}
                    activeProject={activeProject}
                    successProjects={successCompanyProjects}
                    activeDraft={dailyDraft}
                    onOpenProject={(projectId) => {
                      setData({ ...data, activeProjectId: projectId });
                      navigateToTab("info");
                    }}
                    onOpenDailyReport={(projectId) => {
                      setData({ ...data, activeProjectId: projectId });
                      navigateToTab("daily");
                    }}
                    onNewProject={handleNewProject}
                  />
                ) : null}

                {activeTab === "info" && activeProject ? (
                  <ProjectInfoView
                    project={activeProject}
                    totalContract={totalContract}
                    updateActiveProject={updateActiveProject}
                    uploadProjectCover={uploadProjectCover}
                    removeProjectCover={removeProjectCover}
                    addBoqCategory={addBoqCategory}
                    updateBoqCategory={updateBoqCategory}
                    deleteBoqCategory={deleteBoqCategory}
                    addBoqItem={addBoqItem}
                    updateBoqItem={updateBoqItem}
                    deleteBoqItem={deleteBoqItem}
                    canDeleteBoq={projectActionPermissions.canDeleteBoq}
                  />
                ) : null}

                {activeTab === "daily" && activeProject && dailyDraft ? (
                  <DailyReportView
                    activeProject={activeProject}
                    draft={dailyDraft}
                    reports={activeReports}
                    totalWorkers={totalWorkers}
                    reporterName={reporterName}
                    reporterPhone={reporterPhone}
                    updateDraft={updateDailyDraft}
                    confirmChecklistItem={confirmDailyChecklistItem}
                    changeReportDate={changeDailyReportDate}
                    newReport={newDailyReport}
                    saveReport={saveDailyReport}
                    saveStatus={dailyLocalStatus}
                    isSavingReport={dailyCloudStatus === "saving"}
                    exportReport={exportDailyReport}
                    previewPdf={previewDailyReportPdf}
                    exportPdf={exportDailyReportPdf}
                    permissions={dailyReportPermissions}
                    closePdfPreview={() => setShowPdfPreview(false)}
                    showPdfPreview={showPdfPreview}
                    pdfExportRef={pdfExportRef}
                    isExportingPdf={isExportingPdf}
                    hidePdfCompanyName={hidePdfCompanyName}
                    setHidePdfCompanyName={setHidePdfCompanyName}
                    activeCompanyName={activeCompany?.name ?? "บริษัทของฉัน"}
                    deleteDraft={() => deleteDailyReport(dailyDraft.id)}
                    openReport={openDailyReport}
                    deleteReport={deleteDailyReport}
                    addWorker={addWorker}
                    updateWorker={updateWorker}
                    deleteWorker={deleteWorker}
                    registeredCrews={sortCrewsForDisplay(data.crews.filter((crew) => crew.companyId === data.activeCompanyId && crew.status === "active"))}
                    saveWorkerAsCrew={saveDailyWorkerAsCrew}
                    openHr={() => navigateToTab("hr")}
                    openBuyin={() => openBuyinFromDailyReport(dailyDraft.reportDate)}
                    setProblemIssueCount={setProblemIssueCount}
                    addProblemIssue={addProblemIssue}
                    updateProblemIssue={updateProblemIssue}
                    deleteProblemIssue={deleteProblemIssue}
                    uploadProblemIssuePhotos={uploadProblemIssuePhotos}
                    removeProblemIssuePhoto={removeProblemIssuePhoto}
                    updateProgressUpdate={updateProgressUpdate}
                    uploadPhotos={uploadDailyReportPhotos}
                    removePhoto={removeDailyReportPhoto}
                  />
                ) : null}

                {activeTab === "hr" ? (
                  <HrView
                    data={data}
                    activeCompanyId={data.activeCompanyId}
                    activeProjectId={data.activeProjectId}
                    selectedMonth={selectedHrMonth}
                    setSelectedMonth={setSelectedHrMonth}
                    setNotice={setNotice}
                    saveCrew={saveCrew}
                    deleteCrew={deleteCrew}
                    saveLaborExpense={saveLaborExpense}
                    deleteLaborExpense={deleteLaborExpense}
                    isSyncingCloud={isSyncingCloud}
                    openDailyReport={() => navigateToTab("daily")}
                  />
                ) : null}

                {activeTab === "buyin" ? (
                  <BuyinView
                    data={data}
                    activeCompanyId={data.activeCompanyId}
                    activeProjectId={data.activeProjectId}
                    prefill={buyinPrefill}
                    clearPrefill={() => setBuyinPrefill(null)}
                    setNotice={setNotice}
                    saveBuyinEntry={saveBuyinEntry}
                    deleteBuyinEntry={deleteBuyinEntry}
                  />
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
      {activeProject && dailyDraft && (showPdfPreview || isExportingPdf) ? (
        <PrintDailyReportSheet
          project={activeProject}
          report={dailyDraft}
          companyName={activeCompany?.name ?? "บริษัทของฉัน"}
          hideCompanyName={hidePdfCompanyName}
          reporterName={reporterName}
          reporterPhone={reporterPhone}
        />
      ) : null}
      {deleteConfirmation ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <form
            className="w-full max-w-md rounded-[28px] border border-red-100 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
            onSubmit={submitPrivilegedDeletePassword}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">Admin/Owner required</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">ยืนยันการลบ</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              กรอกรหัสผ่าน Admin/Owner อีกครั้ง เพื่อลบ {deleteConfirmation.label} และป้องกันการกดผิด
            </p>
            <div className="mt-5">
              <Field label={memberAccess.hasSession && !memberAccess.isLocalDevSession ? "รหัสผ่าน Admin/Owner" : `พิมพ์ ${deleteConfirmation.confirmText} เพื่อยืนยัน`}>
                <TextInput
                  autoFocus
                  type={memberAccess.hasSession && !memberAccess.isLocalDevSession ? "password" : "text"}
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder={memberAccess.hasSession && !memberAccess.isLocalDevSession ? "กรอกรหัสผ่านอีกครั้ง" : deleteConfirmation.confirmText}
                />
              </Field>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDeleteConfirmation(null);
                  setDeletePassword("");
                }}
                disabled={isConfirmingDelete}
              >
                Close
              </Button>
              <Button type="submit" variant="danger" disabled={isConfirmingDelete || !deletePassword.trim()}>
                {isConfirmingDelete ? "กำลังยืนยัน..." : "Delete"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
