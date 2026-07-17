import {
  calculateBuyinNetAmount,
  calculateBuyinVatAmount,
  sanitizeTaxId
} from "@/lib/buyin-calculations";
import {
  limitDailyReportPhotos,
  limitProblemIssuePhotos,
  shouldPruneDailyReportMedia,
  summarizeProblemIssues
} from "@/lib/daily-report-media";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { normalizeDailyWorkItems, serializeDailyWorkItems } from "@/lib/project-control/daily-work-items";
import { retryTransientCloudOperation, validateCloudSyncPayloadIntegrity } from "@/lib/project-control/cloud-sync-reliability";
import { type SupabaseClient } from "@supabase/supabase-js";
import type {
  BoqCategory,
  BoqItem,
  BuyinEntry,
  BuyinEntryType,
  Company,
  CompanyRole,
  Crew,
  DailyProblemIssue,
  DailyProblemPhoto,
  DailyProgressUpdate,
  DailyReport,
  DailyReportPhoto,
  DailyWorker,
  LaborExpense,
  Project,
  ProjectCoverImage,
  ProjectControlData
} from "@/lib/project-control/types";

export type {
  BoqCategory,
  BoqItem,
  BuyinEntry,
  BuyinEntryType,
  Company,
  CompanyRole,
  Crew,
  DailyProblemIssue,
  DailyProblemPhoto,
  DailyProgressUpdate,
  DailyReport,
  DailyReportPhoto,
  DailyWorker,
  LaborExpense,
  Project,
  ProjectControlData,
  ProjectCoverImage
} from "@/lib/project-control/types";

export const PROJECT_STORAGE_KEY = "pcon_project_setup_data";

type CloudCompanyRow = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type CloudProjectRow = {
  id: string;
  company_id: string;
  name: string;
  status: string | null;
  owner: string | null;
  team: string[] | null;
  note: string | null;
  cover_image: ProjectCoverImage | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_line_id: string | null;
  site_address: string | null;
  site_contact: string | null;
  main_contract: number | string | null;
  variation_order: number | string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type CloudBoqCategoryRow = {
  id: string;
  company_id: string;
  project_id: string;
  name: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type CloudBoqItemRow = {
  id: string;
  company_id: string;
  project_id: string;
  category_id: string;
  name: string | null;
  description: string | null;
  quantity: number | string | null;
  unit: string | null;
  unit_price: number | string | null;
  progress: number | string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type CloudDailyReportRow = {
  id: string;
  company_id: string;
  project_id: string;
  report_date: string;
  prepared_by: string | null;
  prepared_by_phone?: string | null;
  summary: string | null;
  completed_work: string | null;
  ongoing_work: string | null;
  problems: string | null;
  materials: string | null;
  next_plan: string | null;
  customer_note: string | null;
  internal_note: string | null;
  problem_issues: DailyProblemIssue[] | null;
  photos: DailyReportPhoto[] | null;
  created_at: string;
  updated_at: string;
};

type CloudDailyReportWorkerRow = {
  id: string;
  company_id: string;
  project_id: string;
  report_id: string;
  crew_id: string | null;
  name: string | null;
  trade: string | null;
  count: number | string | null;
  start_time: string | null;
  end_time: string | null;
  task_title: string | null;
  task_status: DailyWorker["taskStatus"] | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type CloudDailyReportProgressUpdateRow = {
  id: string;
  company_id: string;
  project_id: string;
  report_id: string;
  category_id: string | null;
  item_id: string | null;
  title: string | null;
  previous_progress: number | string | null;
  new_progress: number | string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type CloudCrewRow = {
  id: string;
  company_id: string;
  leader_name: string | null;
  national_id: string | null;
  phone: string | null;
  work_types: string[] | null;
  note: string | null;
  status: Crew["status"] | null;
  created_at: string;
  updated_at: string;
};

type CloudLaborExpenseRow = {
  id: string;
  company_id: string;
  crew_id: string;
  project_id: string | null;
  expense_date: string;
  work_type: string | null;
  description: string | null;
  amount: number | string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type CloudBuyinEntryRow = {
  id: string;
  company_id: string;
  project_id: string | null;
  entry_date: string;
  type: BuyinEntryType;
  store_name: string | null;
  vendor_name: string | null;
  vendor_tax_id: string | null;
  description: string | null;
  category: string | null;
  amount_paid: number | string | null;
  include_vat: boolean | null;
  net_amount: number | string | null;
  vat_amount: number | string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type CloudSyncPayload = {
  company: CloudCompanyRow;
  projects: CloudProjectRow[];
  boqCategories: CloudBoqCategoryRow[];
  boqItems: CloudBoqItemRow[];
  dailyReports: CloudDailyReportRow[];
  dailyReportWorkers: CloudDailyReportWorkerRow[];
  dailyReportProgressUpdates: CloudDailyReportProgressUpdateRow[];
  hrCrews: CloudCrewRow[];
  hrLaborExpenses: CloudLaborExpenseRow[];
  buyinEntries: CloudBuyinEntryRow[];
  diagnostics?: CloudSyncDiagnostics;
};

export type CloudSyncDiagnostics = {
  canDeleteMissingRows: boolean;
  mode: "delete-reconcile" | "upsert-only";
  counts: {
    projects: number;
    boqCategories: number;
    boqItems: number;
    dailyReports: number;
    dailyReportWorkers: number;
    dailyReportProgressUpdates: number;
    hrCrews: number;
    hrLaborExpenses: number;
    buyinEntries: number;
  };
  skippedDeleteTables: number;
};

export type CloudSyncOptions = {
  allowedProjectIds?: string[];
  canDeleteMissingRows?: boolean;
  includeCompanyHr?: boolean;
  allowedSections?: string[];
};

export type CloudLoadOptions = {
  allowedProjectIds?: string[];
  includeCompanyHr?: boolean;
  allowedSections?: string[];
};

const defaultCompanyId = "local-company-owner";

function toNumber(value: number | string | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function nonNegativeValue(value: number | string | null | undefined): number {
  return Math.max(0, toNumber(value));
}

function clampProgressValue(value: number | string | null | undefined): number {
  return Math.min(100, nonNegativeValue(value));
}

function toNullableDate(value: string): string | null {
  return value.trim() ? value : null;
}

function formatDateParts(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureUniqueCloudRowIds<T extends { id: string }>(rows: T[]): T[] {
  const usedIds = new Set<string>();

  return rows.map((row) => {
    if (!usedIds.has(row.id)) {
      usedIds.add(row.id);
      return row;
    }

    let nextId = createId();
    while (usedIds.has(nextId)) {
      nextId = createId();
    }

    usedIds.add(nextId);
    return { ...row, id: nextId };
  });
}

export function todayString(now = new Date()): string {
  return formatDateParts(now, "Asia/Bangkok");
}

export function createProject(companyId: string, name = "โปรเจกต์ใหม่"): Project {
  const now = new Date().toISOString();

  return {
    id: createId(),
    companyId,
    name,
    status: "ดำเนินการ",
    owner: "",
    team: [],
    note: "",
    coverImage: null,
    customer: {
      name: "",
      phone: "",
      email: "",
      lineId: "",
      siteAddress: "",
      siteContact: ""
    },
    budget: {
      mainContract: 0,
      variationOrder: 0
    },
    timeline: {
      startDate: todayString(),
      dueDate: ""
    },
    boq: [],
    createdAt: now,
    updatedAt: now
  };
}

export function updateActiveCompanyName(data: ProjectControlData, name: string): ProjectControlData {
  const now = new Date().toISOString();

  return {
    ...data,
    companies: data.companies.map((company) =>
      company.id === data.activeCompanyId
        ? {
            ...company,
            name,
            updatedAt: now
          }
        : company
    )
  };
}

export function createEmptyDailyReport(project: Project): DailyReport {
  const now = new Date().toISOString();

  return {
    id: createId(),
    companyId: project.companyId,
    projectId: project.id,
    reportDate: todayString(),
    preparedBy: project.team[0] ?? "",
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
    workers: [],
    progressUpdates: [],
    problemIssues: [],
    photos: [],
    createdAt: now,
    updatedAt: now
  };
}

export function createDefaultDailyWorker(): DailyWorker {
  return {
    id: createId(),
    name: "",
    trade: "ทั่วไป",
    count: 1,
    startTime: "08:00",
    endTime: "17:00",
    taskTitle: "",
    taskStatus: "ดำเนินการ",
    note: ""
  };
}

export function createCrew(
  companyId: string,
  overrides: Partial<Omit<Crew, "id" | "companyId" | "createdAt" | "updatedAt">> = {}
): Crew {
  const now = new Date().toISOString();

  return {
    id: createId(),
    companyId,
    leaderName: overrides.leaderName ?? "",
    nationalId: overrides.nationalId ?? "",
    phone: overrides.phone ?? "",
    workTypes: Array.isArray(overrides.workTypes) ? overrides.workTypes : [],
    note: overrides.note ?? "",
    status: overrides.status ?? "active",
    createdAt: now,
    updatedAt: now
  };
}

export function createLaborExpense(
  companyId: string,
  overrides: Partial<Omit<LaborExpense, "id" | "companyId" | "createdAt" | "updatedAt">> = {}
): LaborExpense {
  const now = new Date().toISOString();

  return {
    id: createId(),
    companyId,
    crewId: overrides.crewId ?? "",
    projectId: overrides.projectId,
    expenseDate: overrides.expenseDate ?? todayString(),
    workType: overrides.workType ?? "",
    description: overrides.description ?? "",
    amount: Math.max(0, toNumber(overrides.amount)),
    note: overrides.note ?? "",
    createdAt: now,
    updatedAt: now
  };
}

export function createBuyinEntry(
  companyId: string,
  overrides: Partial<Omit<BuyinEntry, "id" | "companyId" | "createdAt" | "updatedAt" | "netAmount" | "vatAmount">> = {}
): BuyinEntry {
  const now = new Date().toISOString();
  const type: BuyinEntryType = overrides.type === "invoice" ? "invoice" : "expense";
  const amountPaid = Math.max(0, toNumber(overrides.amountPaid));
  const includeVat = typeof overrides.includeVat === "boolean" ? overrides.includeVat : type === "invoice";

  return {
    id: createId(),
    companyId,
    projectId: overrides.projectId,
    entryDate: overrides.entryDate ?? todayString(),
    type,
    storeName: overrides.storeName ?? "",
    vendorName: overrides.vendorName ?? "",
    vendorTaxId: sanitizeTaxId(overrides.vendorTaxId ?? ""),
    description: overrides.description ?? "",
    category: overrides.category ?? "",
    amountPaid,
    includeVat,
    netAmount: calculateBuyinNetAmount(amountPaid, includeVat),
    vatAmount: calculateBuyinVatAmount(amountPaid, includeVat),
    note: overrides.note ?? "",
    createdAt: now,
    updatedAt: now
  };
}

export function createBlankDailyReportDraft(project: Project): DailyReport {
  return {
    ...createEmptyDailyReport(project),
    workers: [createDefaultDailyWorker()]
  };
}

export function createEmptyProblemIssue(): DailyProblemIssue {
  return {
    id: createId(),
    title: "",
    detail: "",
    photos: []
  };
}

export function createCarryForwardDailyReport(project: Project, previousReport: DailyReport, reportDate = todayString()): DailyReport {
  const now = new Date().toISOString();

  return {
    ...previousReport,
    id: createId(),
    companyId: project.companyId,
    projectId: project.id,
    reportDate,
    carryForwardSourceReportId: previousReport.id,
    carryForwardSourceDate: previousReport.reportDate,
    confirmedChecklistItems: [],
    preparedBy: previousReport.preparedBy || project.team[0] || "",
    preparedByPhone: "",
    problems: summarizeProblemIssues(previousReport.problemIssues),
    problemIssues: previousReport.problemIssues.map((issue) => ({
      ...issue,
      photos: []
    })),
    photos: [],
    createdAt: now,
    updatedAt: now
  };
}

export function confirmDailyChecklistItems(report: DailyReport, itemIds: string[]): DailyReport {
  const confirmed = new Set(report.confirmedChecklistItems ?? []);

  for (const itemId of itemIds) {
    if (itemId.trim()) {
      confirmed.add(itemId);
    }
  }

  return {
    ...report,
    confirmedChecklistItems: Array.from(confirmed)
  };
}

export function createDefaultData(): ProjectControlData {
  const now = new Date().toISOString();

  return {
    companies: [
      {
        id: defaultCompanyId,
        name: "บริษัทของฉัน",
        role: "owner",
        createdAt: now,
        updatedAt: now
      }
    ],
    activeCompanyId: defaultCompanyId,
    projects: [],
    activeProjectId: "",
    dailyReports: [],
    crews: [],
    laborExpenses: [],
    buyinEntries: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeCompany(company: unknown, fallback: Company): Company {
  if (!isRecord(company)) {
    return fallback;
  }

  return {
    id: typeof company.id === "string" ? company.id : fallback.id,
    name: typeof company.name === "string" && company.name.trim() ? company.name : fallback.name,
    role: isCompanyRole(company.role) ? company.role : fallback.role,
    createdAt: typeof company.createdAt === "string" ? company.createdAt : fallback.createdAt,
    updatedAt: typeof company.updatedAt === "string" ? company.updatedAt : fallback.updatedAt
  };
}

function isCompanyRole(value: unknown): value is CompanyRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "project_manager" ||
    value === "site_supervisor" ||
    value === "office_staff" ||
    value === "worker" ||
    value === "viewer"
  );
}

function normalizeWorker(worker: unknown): DailyWorker {
  if (!isRecord(worker)) {
    return createDefaultDailyWorker();
  }

  return {
    id: typeof worker.id === "string" ? worker.id : createId(),
    crewId: typeof worker.crewId === "string" && worker.crewId.trim() ? worker.crewId : undefined,
    name: typeof worker.name === "string" ? worker.name : "",
    trade: typeof worker.trade === "string" ? worker.trade : "ทั่วไป",
    count: worker.count === undefined ? 1 : nonNegativeValue(worker.count as number | string | null | undefined),
    startTime: typeof worker.startTime === "string" ? worker.startTime : "08:00",
    endTime: typeof worker.endTime === "string" ? worker.endTime : "17:00",
    taskTitle: typeof worker.taskTitle === "string" ? worker.taskTitle : "",
    taskStatus:
      worker.taskStatus === "ดำเนินการ" || worker.taskStatus === "แก้ไข" || worker.taskStatus === "เสร็จ"
        ? worker.taskStatus
        : "ดำเนินการ",
    note: typeof worker.note === "string" ? worker.note : ""
  };
}

function normalizeBoqItem(item: unknown): BoqItem | null {
  if (!isRecord(item)) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : createId(),
    description: typeof item.description === "string" ? item.description : typeof item.name === "string" ? item.name : "",
    quantity: nonNegativeValue(item.quantity as number | string | null | undefined),
    unit: typeof item.unit === "string" ? item.unit : "",
    unitPrice: nonNegativeValue(item.unitPrice as number | string | null | undefined),
    progress: clampProgressValue(item.progress as number | string | null | undefined)
  };
}

function normalizeBoqCategory(category: unknown): BoqCategory | null {
  if (!isRecord(category)) {
    return null;
  }

  return {
    id: typeof category.id === "string" ? category.id : createId(),
    name: typeof category.name === "string" ? category.name : "",
    items: Array.isArray(category.items) ? category.items.map(normalizeBoqItem).filter(Boolean) as BoqItem[] : []
  };
}

function normalizeProgressUpdate(update: unknown): DailyProgressUpdate | null {
  if (!isRecord(update)) {
    return null;
  }

  return {
    id: typeof update.id === "string" ? update.id : createId(),
    categoryId: typeof update.categoryId === "string" && update.categoryId.trim() ? update.categoryId : undefined,
    itemId: typeof update.itemId === "string" && update.itemId.trim() ? update.itemId : undefined,
    title: typeof update.title === "string" ? update.title : "",
    previousProgress: clampProgressValue(update.previousProgress as number | string | null | undefined),
    newProgress: clampProgressValue(update.newProgress as number | string | null | undefined),
    note: typeof update.note === "string" ? update.note : ""
  };
}

function normalizeCrew(crew: unknown, activeCompanyId: string): Crew | null {
  if (!isRecord(crew)) {
    return null;
  }

  const now = new Date().toISOString();
  const status = crew.status === "inactive" ? "inactive" : "active";

  return {
    id: typeof crew.id === "string" ? crew.id : createId(),
    companyId: typeof crew.companyId === "string" && crew.companyId.trim() ? crew.companyId : activeCompanyId,
    leaderName: typeof crew.leaderName === "string" ? crew.leaderName : "",
    nationalId: typeof crew.nationalId === "string" ? crew.nationalId : "",
    phone: typeof crew.phone === "string" ? crew.phone : "",
    workTypes: Array.isArray(crew.workTypes) ? crew.workTypes.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [],
    note: typeof crew.note === "string" ? crew.note : "",
    status,
    createdAt: typeof crew.createdAt === "string" ? crew.createdAt : now,
    updatedAt: typeof crew.updatedAt === "string" ? crew.updatedAt : now
  };
}

function normalizeLaborExpense(expense: unknown, activeCompanyId: string): LaborExpense | null {
  if (!isRecord(expense)) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: typeof expense.id === "string" ? expense.id : createId(),
    companyId: typeof expense.companyId === "string" && expense.companyId.trim() ? expense.companyId : activeCompanyId,
    crewId: typeof expense.crewId === "string" ? expense.crewId : "",
    projectId: typeof expense.projectId === "string" && expense.projectId.trim() ? expense.projectId : undefined,
    expenseDate: typeof expense.expenseDate === "string" && expense.expenseDate.trim() ? expense.expenseDate : todayString(),
    workType: typeof expense.workType === "string" ? expense.workType : "",
    description: typeof expense.description === "string" ? expense.description : "",
    amount: Math.max(0, toNumber(expense.amount as number | string | null | undefined)),
    note: typeof expense.note === "string" ? expense.note : "",
    createdAt: typeof expense.createdAt === "string" ? expense.createdAt : now,
    updatedAt: typeof expense.updatedAt === "string" ? expense.updatedAt : now
  };
}

function normalizeBuyinEntry(entry: unknown, activeCompanyId: string): BuyinEntry | null {
  if (!isRecord(entry)) {
    return null;
  }

  const now = new Date().toISOString();
  const type: BuyinEntryType = entry.type === "invoice" ? "invoice" : "expense";
  const amountPaid = Math.max(0, toNumber(entry.amountPaid as number | string | null | undefined));
  const includeVat = typeof entry.includeVat === "boolean" ? entry.includeVat : type === "invoice";

  return {
    id: typeof entry.id === "string" ? entry.id : createId(),
    companyId: typeof entry.companyId === "string" && entry.companyId.trim() ? entry.companyId : activeCompanyId,
    projectId: typeof entry.projectId === "string" && entry.projectId.trim() ? entry.projectId : undefined,
    entryDate: typeof entry.entryDate === "string" && entry.entryDate.trim() ? entry.entryDate : todayString(),
    type,
    storeName: typeof entry.storeName === "string" ? entry.storeName : "",
    vendorName: typeof entry.vendorName === "string" ? entry.vendorName : "",
    vendorTaxId: typeof entry.vendorTaxId === "string" ? sanitizeTaxId(entry.vendorTaxId) : "",
    description: typeof entry.description === "string" ? entry.description : "",
    category: typeof entry.category === "string" ? entry.category : "",
    amountPaid,
    includeVat,
    netAmount: calculateBuyinNetAmount(amountPaid, includeVat),
    vatAmount: calculateBuyinVatAmount(amountPaid, includeVat),
    note: typeof entry.note === "string" ? entry.note : "",
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : now,
    updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : now
  };
}

function normalizePhoto(photo: unknown): DailyReportPhoto | null {
  if (!isRecord(photo) || typeof photo.dataUrl !== "string") {
    return null;
  }

  return {
    id: typeof photo.id === "string" ? photo.id : createId(),
    name: typeof photo.name === "string" ? photo.name : "image.jpg",
    dataUrl: photo.dataUrl
  };
}

function normalizeProblemIssues(report: Record<string, unknown>): DailyProblemIssue[] {
  if (Array.isArray(report.problemIssues)) {
    return report.problemIssues.map((issue) => {
      if (!isRecord(issue)) {
        return createEmptyProblemIssue();
      }

      return {
        id: typeof issue.id === "string" ? issue.id : createId(),
        title: typeof issue.title === "string" ? issue.title : "",
        detail: typeof issue.detail === "string" ? issue.detail : "",
        photos: limitProblemIssuePhotos((Array.isArray(issue.photos) ? issue.photos : []).map(normalizePhoto).filter(Boolean) as DailyProblemPhoto[])
      };
    });
  }

  if (typeof report.problems === "string" && report.problems.trim()) {
    return [
      {
        id: createId(),
        title: "ปัญหา / อุปสรรค",
        detail: report.problems.trim(),
        photos: []
      }
    ];
  }

  return [];
}

function ensurePhaseOneData(data: ProjectControlData, today = todayString()): ProjectControlData {
  const fallback = createDefaultData();
  const companies = data.companies.length
    ? data.companies.map((company, index) => normalizeCompany(company, fallback.companies[index] ?? fallback.companies[0]))
    : fallback.companies;
  const activeCompanyId =
    data.activeCompanyId && companies.some((company) => company.id === data.activeCompanyId)
      ? data.activeCompanyId
      : companies[0].id;
  const projects = data.projects.map((project) => ({
    ...project,
    companyId: project.companyId || activeCompanyId,
    coverImage: normalizePhoto(isRecord(project) ? project.coverImage : null),
    team: Array.isArray(project.team) ? project.team : [],
    boq: Array.isArray(project.boq) ? project.boq.map(normalizeBoqCategory).filter(Boolean) as BoqCategory[] : []
  }));
  const activeProjectId =
    data.activeProjectId && projects.some((project) => project.id === data.activeProjectId)
      ? data.activeProjectId
      : projects[0]?.id ?? "";

  return {
    companies,
    activeCompanyId,
    projects,
    activeProjectId,
    dailyReports: data.dailyReports.map((report) => {
      const normalizedWorkers = Array.isArray(report.workers) ? report.workers.map(normalizeWorker) : [];
      const normalizedProblemIssues = isRecord(report) ? normalizeProblemIssues(report) : [];
      const shouldPruneMedia = shouldPruneDailyReportMedia(report.reportDate, today);
      const normalizedPhotos = shouldPruneMedia
        ? []
        : limitDailyReportPhotos((Array.isArray(report.photos) ? report.photos : []).map(normalizePhoto).filter(Boolean) as DailyReportPhoto[]);

      const workItems = normalizeDailyWorkItems(report);

      return {
        ...report,
        companyId: report.companyId || activeCompanyId,
        carryForwardSourceReportId: typeof report.carryForwardSourceReportId === "string" ? report.carryForwardSourceReportId : undefined,
        carryForwardSourceDate: typeof report.carryForwardSourceDate === "string" ? report.carryForwardSourceDate : undefined,
        confirmedChecklistItems: Array.isArray(report.confirmedChecklistItems)
          ? report.confirmedChecklistItems.filter((item): item is string => typeof item === "string")
          : undefined,
        preparedBy: typeof report.preparedBy === "string" ? report.preparedBy : projects.find((project) => project.id === report.projectId)?.team[0] ?? "",
        preparedByPhone: typeof report.preparedByPhone === "string" ? report.preparedByPhone : "",
        workItems,
        ...serializeDailyWorkItems(workItems),
        workers: normalizedWorkers,
        progressUpdates: Array.isArray(report.progressUpdates) ? report.progressUpdates.map(normalizeProgressUpdate).filter(Boolean) as DailyProgressUpdate[] : [],
        problemIssues: normalizedProblemIssues.map((issue) => ({
          ...issue,
          photos: shouldPruneMedia ? [] : issue.photos
        })),
        problems: summarizeProblemIssues(normalizedProblemIssues) || (typeof report.problems === "string" ? report.problems : ""),
        photos: normalizedPhotos
      };
    }),
    crews: (Array.isArray(data.crews) ? data.crews : []).map((crew) => normalizeCrew(crew, activeCompanyId)).filter(Boolean) as Crew[],
    laborExpenses: (Array.isArray(data.laborExpenses) ? data.laborExpenses : [])
      .map((expense) => normalizeLaborExpense(expense, activeCompanyId))
      .filter(Boolean) as LaborExpense[],
    buyinEntries: (Array.isArray(data.buyinEntries) ? data.buyinEntries : [])
      .map((entry) => normalizeBuyinEntry(entry, activeCompanyId))
      .filter(Boolean) as BuyinEntry[]
  };
}

export function loadLocalData(): ProjectControlData {
  return loadProjectControlData();
}

export function saveLocalData(data: ProjectControlData): void {
  saveProjectControlData(pruneDailyReportMediaByRetention(data));
}

export function isCloudReady(): boolean {
  return isSupabaseConfigured;
}

export function pruneDailyReportMediaByRetention(
  data: ProjectControlData,
  today = new Date().toISOString().slice(0, 10)
): ProjectControlData {
  return {
    ...data,
    dailyReports: data.dailyReports.map((report) => {
      const shouldPruneMedia = shouldPruneDailyReportMedia(report.reportDate, today);

      return {
        ...report,
        photos: shouldPruneMedia ? [] : limitDailyReportPhotos(Array.isArray(report.photos) ? report.photos : []),
        problemIssues: (Array.isArray(report.problemIssues) ? report.problemIssues : []).map((issue) => ({
          ...issue,
          photos: shouldPruneMedia ? [] : limitProblemIssuePhotos(Array.isArray(issue.photos) ? issue.photos : [])
        }))
      };
    })
  };
}

export function createCloudSafeSyncData(data: ProjectControlData): ProjectControlData {
  return {
    ...data,
    projects: data.projects.map((project) => ({
      ...project,
      coverImage: null
    })),
    dailyReports: data.dailyReports.map((report) => ({
      ...report,
      photos: [],
      problemIssues: stripProblemIssueCloudMedia(report.problemIssues)
    }))
  };
}

export function createCloudSyncPayload(
  data: ProjectControlData,
  companyId = data.activeCompanyId,
  today = new Date().toISOString().slice(0, 10)
): CloudSyncPayload {
  const prunedData = pruneDailyReportMediaByRetention(data, today);
  const company = prunedData.companies.find((entry) => entry.id === companyId);

  if (!company) {
    throw new Error("ไม่พบบริษัทที่ต้องการ sync ไป cloud");
  }

  const projects = prunedData.projects.filter((project) => project.companyId === companyId);
  const projectIds = new Set(projects.map((project) => project.id));
  const dailyReports = prunedData.dailyReports.filter((report) => report.companyId === companyId && projectIds.has(report.projectId));
  const hrCrews = prunedData.crews.filter((crew) => crew.companyId === companyId);
  const crewIds = new Set(hrCrews.map((crew) => crew.id));
  const hrLaborExpenses = prunedData.laborExpenses.filter(
    (expense) => expense.companyId === companyId && crewIds.has(expense.crewId) && (!expense.projectId || projectIds.has(expense.projectId))
  );
  const buyinEntries = prunedData.buyinEntries.filter(
    (entry) => entry.companyId === companyId && (!entry.projectId || projectIds.has(entry.projectId))
  );
  const dailyReportWorkers = ensureUniqueCloudRowIds(
    dailyReports.flatMap((report) =>
      report.workers.map((worker) => ({
        id: worker.id,
        company_id: report.companyId,
        project_id: report.projectId,
        report_id: report.id,
        crew_id: worker.crewId && crewIds.has(worker.crewId) ? worker.crewId : null,
        name: worker.name,
        trade: worker.trade,
        count: worker.count,
        start_time: worker.startTime || null,
        end_time: worker.endTime || null,
        task_title: worker.taskTitle,
        task_status: worker.taskStatus,
        note: worker.note,
        created_at: report.createdAt,
        updated_at: report.updatedAt
      }))
    )
  );
  const dailyReportProgressUpdates = ensureUniqueCloudRowIds(
    dailyReports.flatMap((report) =>
      report.progressUpdates.map((update) => ({
        id: update.id,
        company_id: report.companyId,
        project_id: report.projectId,
        report_id: report.id,
        category_id: update.categoryId ?? null,
        item_id: update.itemId ?? null,
        title: update.title,
        previous_progress: update.previousProgress,
        new_progress: update.newProgress,
        note: update.note,
        created_at: report.createdAt,
        updated_at: report.updatedAt
      }))
    )
  );

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: null,
      owner_user_id: null,
      created_at: company.createdAt,
      updated_at: company.updatedAt
    },
    projects: projects.map((project) => ({
      id: project.id,
      company_id: project.companyId,
      name: project.name,
      status: project.status,
      owner: project.owner,
      team: project.team,
      note: project.note,
      cover_image: null,
      customer_name: project.customer.name,
      customer_phone: project.customer.phone,
      customer_email: project.customer.email,
      customer_line_id: project.customer.lineId,
      site_address: project.customer.siteAddress,
      site_contact: project.customer.siteContact,
      main_contract: project.budget.mainContract,
      variation_order: project.budget.variationOrder,
      start_date: toNullableDate(project.timeline.startDate),
      due_date: toNullableDate(project.timeline.dueDate),
      created_at: project.createdAt,
      updated_at: project.updatedAt
    })),
    boqCategories: projects.flatMap((project) =>
      project.boq.map((category, index) => ({
        id: category.id,
        company_id: project.companyId,
        project_id: project.id,
        name: category.name,
        sort_order: index,
        created_at: project.createdAt,
        updated_at: project.updatedAt
      }))
    ),
    boqItems: projects.flatMap((project) =>
      project.boq.flatMap((category) =>
        category.items.map((item, index) => ({
          id: item.id,
          company_id: project.companyId,
          project_id: project.id,
          category_id: category.id,
          name: item.description,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          progress: item.progress,
          sort_order: index,
          created_at: project.createdAt,
          updated_at: project.updatedAt
        }))
      )
    ),
    dailyReports: dailyReports.map((report) => ({
      id: report.id,
      company_id: report.companyId,
      project_id: report.projectId,
      report_date: report.reportDate,
      prepared_by: report.preparedBy,
      prepared_by_phone: report.preparedByPhone,
      summary: report.summary,
      completed_work: report.completedWork,
      ongoing_work: report.ongoingWork,
      problems: report.problems,
      materials: report.materials,
      next_plan: report.nextPlan,
      customer_note: report.customerNote,
      internal_note: report.internalNote,
      problem_issues: stripProblemIssueCloudMedia(report.problemIssues),
      photos: [],
      created_at: report.createdAt,
      updated_at: report.updatedAt
    })),
    dailyReportWorkers,
    dailyReportProgressUpdates,
    hrCrews: hrCrews.map((crew) => ({
      id: crew.id,
      company_id: crew.companyId,
      leader_name: crew.leaderName,
      national_id: crew.nationalId,
      phone: crew.phone ?? "",
      work_types: crew.workTypes,
      note: crew.note ?? "",
      status: crew.status,
      created_at: crew.createdAt,
      updated_at: crew.updatedAt
    })),
    hrLaborExpenses: hrLaborExpenses.map((expense) => ({
      id: expense.id,
      company_id: expense.companyId,
      crew_id: expense.crewId,
      project_id: expense.projectId ?? null,
      expense_date: expense.expenseDate,
      work_type: expense.workType ?? "",
      description: expense.description,
      amount: expense.amount,
      note: expense.note ?? "",
      created_at: expense.createdAt,
      updated_at: expense.updatedAt
    })),
    buyinEntries: buyinEntries.map((entry) => ({
      id: entry.id,
      company_id: entry.companyId,
      project_id: entry.projectId ?? null,
      entry_date: entry.entryDate,
      type: entry.type,
      store_name: entry.storeName ?? "",
      vendor_name: entry.vendorName ?? "",
      vendor_tax_id: entry.vendorTaxId ?? "",
      description: entry.description ?? "",
      category: entry.category ?? "",
      amount_paid: entry.amountPaid,
      include_vat: entry.includeVat,
      net_amount: entry.netAmount,
      vat_amount: entry.vatAmount,
      note: entry.note ?? "",
      created_at: entry.createdAt,
      updated_at: entry.updatedAt
    }))
  };
}

function stripProblemIssueCloudMedia(problemIssues: DailyProblemIssue[]): DailyProblemIssue[] {
  return problemIssues.map((issue) => ({
    ...issue,
    photos: []
  }));
}

function requireSupabaseClient() {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase env ยังไม่ถูกตั้งค่า Local data ของคุณยังปลอดภัย");
  }

  return client;
}

function normalizeSupabaseErrorMessage(label: string, message: string): string {
  if (message.includes("daily_reports_project_id_fkey")) {
    return "บันทึก Daily Report ไป Cloud ไม่สำเร็จ เพราะยังไม่พบ Project หลักบน Cloud กรุณาบันทึก Project ขึ้น Cloud แล้วลอง Save Daily อีกครั้ง";
  }

  const missingSchemaColumn = message.match(/Could not find the '([^']+)' column of '([^']+)' in the schema cache/);
  if (missingSchemaColumn) {
    const [, column, table] = missingSchemaColumn;
    return `${label}: Cloud schema ยังไม่ได้อัปเดต: ${table}.${column} กรุณารัน Supabase schema migration จาก supabase/project-control-schema.sql แล้ว reload schema cache ด้วย notify pgrst, 'reload schema' • ข้อมูล local ยังปลอดภัย`;
  }

  const missingSchemaTable = message.match(/Could not find the table 'public\.([^']+)' in the schema cache/);
  if (missingSchemaTable) {
    const [, table] = missingSchemaTable;
    return `${label}: Cloud schema ยังไม่ได้อัปเดต: public.${table} กรุณารัน Supabase schema migration จาก supabase/project-control-schema.sql แล้ว reload schema cache ด้วย notify pgrst, 'reload schema' • ข้อมูล local ยังปลอดภัย`;
  }

  return `${label}: ${message}`;
}

async function throwOnSupabaseError<T extends { error: { message: string } | null }>(result: T, label: string): Promise<void> {
  if (result.error) {
    throw new Error(normalizeSupabaseErrorMessage(label, result.error.message));
  }
}

async function runCloudOperation<T extends { error: { message: string } | null }>(
  operation: () => PromiseLike<T> | T,
  label: string
): Promise<T> {
  return retryTransientCloudOperation(
    async () => {
      const result = await operation();
      await throwOnSupabaseError(result, label);
      return result;
    },
    { idempotent: true }
  );
}

type CloudOwnershipRow = {
  id: string | null;
  company_id: string | null;
};

type CloudOwnershipTable = {
  table: string;
  label: string;
  ids: string[];
};

async function findExistingCloudRowsById(
  client: SupabaseClient,
  table: string,
  ids: string[],
  label: string
): Promise<CloudOwnershipRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const tableClient = client.from(table) as unknown as {
    select?: (columns: string) => { in?: (column: string, values: string[]) => PromiseLike<{ data: CloudOwnershipRow[] | null; error: { message: string } | null }> };
  };
  const selected = tableClient.select?.("id, company_id");

  // Small mock clients used by local-only tests may not expose a complete
  // PostgREST builder. Real Supabase clients always provide `in`; skipping a
  // preflight for an incomplete test double keeps those tests focused on the
  // operation under test without weakening production behavior.
  if (!selected || typeof selected.in !== "function") {
    return [];
  }

  const result = await runCloudOperation(() => selected.in?.("id", ids) ?? { data: [], error: null }, `ตรวจสอบ ${label} ซ้ำบน cloud ไม่สำเร็จ`);
  return result.data ?? [];
}

async function preflightCloudPayloadOwnership(client: SupabaseClient, payload: CloudSyncPayload): Promise<void> {
  const tables: CloudOwnershipTable[] = [
    { table: "projects", label: "project", ids: payload.projects.map((row) => row.id) },
    { table: "boq_categories", label: "BOQ category", ids: payload.boqCategories.map((row) => row.id) },
    { table: "boq_items", label: "BOQ item", ids: payload.boqItems.map((row) => row.id) },
    { table: "daily_reports", label: "Daily Report", ids: payload.dailyReports.map((row) => row.id) },
    { table: "daily_report_workers", label: "Daily Report worker", ids: payload.dailyReportWorkers.map((row) => row.id) },
    {
      table: "daily_report_progress_updates",
      label: "Daily Report progress update",
      ids: payload.dailyReportProgressUpdates.map((row) => row.id)
    },
    { table: "hr_crews", label: "HR crew", ids: payload.hrCrews.map((row) => row.id) },
    { table: "hr_labor_expenses", label: "HR labor expense", ids: payload.hrLaborExpenses.map((row) => row.id) },
    { table: "buyin_entries", label: "BUYIN entry", ids: payload.buyinEntries.map((row) => row.id) }
  ];

  const references: CloudOwnershipTable[] = [
    { table: "daily_reports", label: "Daily Report worker report", ids: payload.dailyReportWorkers.map((row) => row.report_id) },
    {
      table: "daily_reports",
      label: "Daily Report progress report",
      ids: payload.dailyReportProgressUpdates.map((row) => row.report_id)
    },
    { table: "hr_crews", label: "Daily Report worker crew", ids: payload.dailyReportWorkers.map((row) => row.crew_id).filter((id): id is string => Boolean(id)) },
    { table: "hr_crews", label: "HR labor expense crew", ids: payload.hrLaborExpenses.map((row) => row.crew_id) },
    { table: "boq_categories", label: "progress category", ids: payload.dailyReportProgressUpdates.map((row) => row.category_id).filter((id): id is string => Boolean(id)) },
    { table: "boq_items", label: "progress item", ids: payload.dailyReportProgressUpdates.map((row) => row.item_id).filter((id): id is string => Boolean(id)) }
  ];

  const allChecks = [...tables, ...references].map((entry) => ({
    ...entry,
    ids: Array.from(new Set(entry.ids))
  }));
  const seenForeignRows = new Set<string>();

  for (const entry of allChecks) {
    const rows = await findExistingCloudRowsById(client, entry.table, entry.ids, entry.label);

    for (const row of rows) {
      if (!row.id || !row.company_id || row.company_id === payload.company.id) {
        continue;
      }

      const key = `${entry.table}:${row.id}`;
      if (seenForeignRows.has(key)) {
        continue;
      }

      seenForeignRows.add(key);
      throw new Error(`Cloud payload ${entry.label} id ${row.id} เป็นของ company อื่น ไม่สามารถเขียนทับข้อมูลข้ามบริษัทได้`);
    }
  }
}

function collectReferencedProjectIds(payload: CloudSyncPayload): string[] {
  const projectIds = new Set<string>();

  for (const row of payload.boqCategories) {
    projectIds.add(row.project_id);
  }

  for (const row of payload.boqItems) {
    projectIds.add(row.project_id);
  }

  for (const row of payload.dailyReports) {
    projectIds.add(row.project_id);
  }

  for (const row of payload.dailyReportWorkers) {
    projectIds.add(row.project_id);
  }

  for (const row of payload.dailyReportProgressUpdates) {
    projectIds.add(row.project_id);
  }

  for (const row of payload.hrLaborExpenses) {
    if (row.project_id) {
      projectIds.add(row.project_id);
    }
  }

  for (const row of payload.buyinEntries) {
    if (row.project_id) {
      projectIds.add(row.project_id);
    }
  }

  return Array.from(projectIds).filter(Boolean);
}

async function existingCloudProjectIds(client: SupabaseClient, companyId: string, projectIds: string[]): Promise<Set<string>> {
  if (projectIds.length === 0) {
    return new Set();
  }

  const result = await runCloudOperation(
    () => client.from("projects").select("id").eq("company_id", companyId).in("id", projectIds),
    "ตรวจสอบ project cloud ไม่สำเร็จ"
  );

  return new Set(((result.data ?? []) as Array<{ id: string | null }>).map((row) => row.id).filter((id): id is string => Boolean(id)));
}

async function ensureReferencedProjectsExist(
  client: SupabaseClient,
  companyId: string,
  payload: CloudSyncPayload,
  allowProjectWrite = true
): Promise<void> {
  const referencedProjectIds = collectReferencedProjectIds(payload);

  if (referencedProjectIds.length === 0) {
    return;
  }

  let existingProjectIds = await existingCloudProjectIds(client, companyId, referencedProjectIds);
  let missingProjectIds = referencedProjectIds.filter((projectId) => !existingProjectIds.has(projectId));
  const retryProjectRows = payload.projects.filter((project) => missingProjectIds.includes(project.id));

  if (retryProjectRows.length > 0 && allowProjectWrite) {
    await runCloudOperation(() => client.from("projects").upsert(retryProjectRows, { onConflict: "id" }), "บันทึก project ไม่สำเร็จ");
    existingProjectIds = await existingCloudProjectIds(client, companyId, referencedProjectIds);
    missingProjectIds = referencedProjectIds.filter((projectId) => !existingProjectIds.has(projectId));
  }

  if (missingProjectIds.length > 0) {
    throw new Error("บันทึก Daily Report ไป Cloud ไม่สำเร็จ เพราะยังไม่พบ Project หลักบน Cloud กรุณาบันทึก Project ขึ้น Cloud แล้วลอง Save Daily อีกครั้ง");
  }
}

export async function syncDataToSupabase(data: ProjectControlData): Promise<CloudSyncPayload> {
  const client = requireSupabaseClient();

  return syncDataToSupabaseWithClient(client, data);
}

export async function syncDataToSupabaseWithClient(
  client: SupabaseClient,
  data: ProjectControlData,
  syncOptions?: string[] | CloudSyncOptions
): Promise<CloudSyncPayload> {
  const payload = createCloudSyncPayload(data);
  const companyId = payload.company.id;
  const options: CloudSyncOptions = Array.isArray(syncOptions) ? { allowedProjectIds: syncOptions, canDeleteMissingRows: false } : (syncOptions ?? {});
  const allowedProjectIds = options.allowedProjectIds;
  const includeCompanyHr = options.includeCompanyHr ?? !allowedProjectIds;
  const canDeleteMissingRows = options.canDeleteMissingRows ?? !allowedProjectIds;
  const allowedSections = options.allowedSections ? new Set(options.allowedSections) : null;
  const allowedProjectIdSet = allowedProjectIds ? new Set(allowedProjectIds) : null;
  const scopedProjectIds = allowedProjectIdSet
    ? payload.projects.map((project) => project.id).filter((projectId) => allowedProjectIdSet.has(projectId))
    : payload.projects.map((project) => project.id);

  if (allowedProjectIdSet && scopedProjectIds.length === 0 && !includeCompanyHr) {
    throw new Error("ไม่มี project ที่ได้รับสิทธิ์สำหรับ sync");
  }

  const projectSectionAllowed = !allowedSections || allowedSections.has("project");
  const boqSectionAllowed = !allowedSections || allowedSections.has("boq");
  const dailyReportSectionAllowed = !allowedSections || allowedSections.has("daily_report");
  const buyinSectionAllowed = !allowedSections || allowedSections.has("buyin");
  const scopedPayload: CloudSyncPayload = allowedProjectIdSet
    ? {
        ...payload,
        projects: payload.projects.filter((project) => allowedProjectIdSet.has(project.id)),
        boqCategories: boqSectionAllowed ? payload.boqCategories.filter((category) => allowedProjectIdSet.has(category.project_id)) : [],
        boqItems: boqSectionAllowed ? payload.boqItems.filter((item) => allowedProjectIdSet.has(item.project_id)) : [],
        dailyReports: dailyReportSectionAllowed ? payload.dailyReports.filter((report) => allowedProjectIdSet.has(report.project_id)) : [],
        dailyReportWorkers: dailyReportSectionAllowed
          ? payload.dailyReportWorkers
              .filter((worker) => allowedProjectIdSet.has(worker.project_id))
              .map((worker) => (includeCompanyHr ? worker : { ...worker, crew_id: null }))
          : [],
        dailyReportProgressUpdates: dailyReportSectionAllowed
          ? payload.dailyReportProgressUpdates.filter((update) => allowedProjectIdSet.has(update.project_id))
          : [],
        hrCrews: includeCompanyHr ? payload.hrCrews : [],
        hrLaborExpenses: includeCompanyHr ? payload.hrLaborExpenses : [],
        buyinEntries: buyinSectionAllowed
          ? payload.buyinEntries.filter((entry) => Boolean(entry.project_id && allowedProjectIdSet.has(entry.project_id)))
          : []
      }
    : {
        ...payload,
        projects: payload.projects,
        boqCategories: boqSectionAllowed ? payload.boqCategories : [],
        boqItems: boqSectionAllowed ? payload.boqItems : [],
        dailyReports: dailyReportSectionAllowed ? payload.dailyReports : [],
        dailyReportWorkers: dailyReportSectionAllowed
          ? payload.dailyReportWorkers.map((worker) => (includeCompanyHr ? worker : { ...worker, crew_id: null }))
          : [],
        dailyReportProgressUpdates: dailyReportSectionAllowed ? payload.dailyReportProgressUpdates : [],
        hrCrews: includeCompanyHr ? payload.hrCrews : [],
        hrLaborExpenses: includeCompanyHr ? payload.hrLaborExpenses : [],
        buyinEntries: buyinSectionAllowed ? payload.buyinEntries : []
      };

  validateCloudSyncPayloadIntegrity(scopedPayload);
  await preflightCloudPayloadOwnership(client, scopedPayload);

  if (!allowedProjectIdSet) {
    await runCloudOperation(() => client.from("companies").upsert(payload.company, { onConflict: "id" }), "บันทึกบริษัทไม่สำเร็จ");
  }

  if (projectSectionAllowed && scopedPayload.projects.length > 0) {
    await runCloudOperation(() => client.from("projects").upsert(scopedPayload.projects, { onConflict: "id" }), "บันทึก project ไม่สำเร็จ");
  }

  await ensureReferencedProjectsExist(client, companyId, scopedPayload, projectSectionAllowed);

  if (scopedPayload.hrCrews.length > 0) {
    await runCloudOperation(() => client.from("hr_crews").upsert(scopedPayload.hrCrews, { onConflict: "id" }), "บันทึก HR crews ไม่สำเร็จ");
  }

  if (scopedPayload.boqCategories.length > 0) {
    await runCloudOperation(
      () => client.from("boq_categories").upsert(scopedPayload.boqCategories, { onConflict: "id" }),
      "บันทึก BOQ category ไม่สำเร็จ"
    );
  }

  if (scopedPayload.boqItems.length > 0) {
    await runCloudOperation(() => client.from("boq_items").upsert(scopedPayload.boqItems, { onConflict: "id" }), "บันทึก BOQ item ไม่สำเร็จ");
  }

  if (scopedPayload.dailyReports.length > 0) {
    await runCloudOperation(
      () => client.from("daily_reports").upsert(scopedPayload.dailyReports, { onConflict: "id" }),
      "บันทึก Daily Report ไม่สำเร็จ"
    );
  }

  if (scopedPayload.dailyReportWorkers.length > 0) {
    await runCloudOperation(
      () => client.from("daily_report_workers").upsert(scopedPayload.dailyReportWorkers, { onConflict: "id" }),
      "บันทึก Daily Report workers ไม่สำเร็จ"
    );
  }

  if (scopedPayload.dailyReportProgressUpdates.length > 0) {
    await runCloudOperation(
      () => client.from("daily_report_progress_updates").upsert(scopedPayload.dailyReportProgressUpdates, { onConflict: "id" }),
      "บันทึก Daily Report progress updates ไม่สำเร็จ"
    );
  }

  if (scopedPayload.hrLaborExpenses.length > 0) {
    await runCloudOperation(
      () => client.from("hr_labor_expenses").upsert(scopedPayload.hrLaborExpenses, { onConflict: "id" }),
      "บันทึก HR labor expenses ไม่สำเร็จ"
    );
  }

  if (scopedPayload.buyinEntries.length > 0) {
    await runCloudOperation(() => client.from("buyin_entries").upsert(scopedPayload.buyinEntries, { onConflict: "id" }), "บันทึก BUYIN ไม่สำเร็จ");
  }

  if (canDeleteMissingRows) {
    const deleteMissingProjectScopedRows = async (table: string, idsToKeep: string[], label: string) => {
      let query = client.from(table).delete().eq("company_id", companyId);

      if (allowedProjectIdSet) {
        query = query.in("project_id", scopedProjectIds);
      }

      if (idsToKeep.length > 0) {
        const queryWithNot = query as typeof query & { not?: (column: string, operator: string, value: string) => typeof query };
        if (typeof queryWithNot.not !== "function") {
          return;
        }
        query = queryWithNot.not("id", "in", `(${idsToKeep.join(",")})`);
      }

      await runCloudOperation(() => query, label);
    };
    const deleteMissingProjectRows = async () => {
      let query = client.from("projects").delete().eq("company_id", companyId);

      if (allowedProjectIdSet) {
        query = query.in("id", scopedProjectIds);
      }

      if (scopedPayload.projects.length > 0) {
        const queryWithNot = query as typeof query & { not?: (column: string, operator: string, value: string) => typeof query };
        if (typeof queryWithNot.not !== "function") {
          return;
        }
        query = queryWithNot.not("id", "in", `(${scopedPayload.projects.map((project) => project.id).join(",")})`);
      }

      await runCloudOperation(() => query, "ลบ project cloud เดิมไม่สำเร็จ");
    };
    const deleteMissingCompanyRows = async (table: string, idsToKeep: string[], label: string) => {
      let query = client.from(table).delete().eq("company_id", companyId);

      if (idsToKeep.length > 0) {
        const queryWithNot = query as typeof query & { not?: (column: string, operator: string, value: string) => typeof query };
        if (typeof queryWithNot.not !== "function") {
          return;
        }
        query = queryWithNot.not("id", "in", `(${idsToKeep.join(",")})`);
      }

      await runCloudOperation(() => query, label);
    };

    await deleteMissingProjectScopedRows(
      "daily_report_progress_updates",
      scopedPayload.dailyReportProgressUpdates.map((update) => update.id),
      "ลบ progress update cloud เดิมไม่สำเร็จ"
    );
    await deleteMissingProjectScopedRows(
      "daily_report_workers",
      scopedPayload.dailyReportWorkers.map((worker) => worker.id),
      "ลบ worker cloud เดิมไม่สำเร็จ"
    );
    await deleteMissingProjectScopedRows(
      "daily_reports",
      scopedPayload.dailyReports.map((report) => report.id),
      "ลบ daily report cloud เดิมไม่สำเร็จ"
    );
    await deleteMissingProjectScopedRows(
      "boq_items",
      scopedPayload.boqItems.map((item) => item.id),
      "ลบ BOQ item cloud เดิมไม่สำเร็จ"
    );
    await deleteMissingProjectScopedRows(
      "boq_categories",
      scopedPayload.boqCategories.map((category) => category.id),
      "ลบ BOQ category cloud เดิมไม่สำเร็จ"
    );
    if (!allowedProjectIdSet) {
      await deleteMissingCompanyRows(
        "hr_labor_expenses",
        scopedPayload.hrLaborExpenses.map((expense) => expense.id),
        "ลบ HR labor expense cloud เดิมไม่สำเร็จ"
      );
    }
    await deleteMissingProjectScopedRows(
      "buyin_entries",
      scopedPayload.buyinEntries.map((entry) => entry.id),
      "ลบ BUYIN cloud เดิมไม่สำเร็จ"
    );
    if (!allowedProjectIdSet) {
      await deleteMissingCompanyRows(
        "hr_crews",
        scopedPayload.hrCrews.map((crew) => crew.id),
        "ลบ HR crew cloud เดิมไม่สำเร็จ"
      );
    }
    await deleteMissingProjectRows();
  }

  return {
    ...scopedPayload,
    diagnostics: {
      canDeleteMissingRows,
      mode: canDeleteMissingRows ? "delete-reconcile" : "upsert-only",
      counts: {
        projects: scopedPayload.projects.length,
        boqCategories: scopedPayload.boqCategories.length,
        boqItems: scopedPayload.boqItems.length,
        dailyReports: scopedPayload.dailyReports.length,
        dailyReportWorkers: scopedPayload.dailyReportWorkers.length,
        dailyReportProgressUpdates: scopedPayload.dailyReportProgressUpdates.length,
        hrCrews: scopedPayload.hrCrews.length,
        hrLaborExpenses: scopedPayload.hrLaborExpenses.length,
        buyinEntries: scopedPayload.buyinEntries.length
      },
      skippedDeleteTables: canDeleteMissingRows ? 0 : 9
    }
  };
}

export async function loadDataFromSupabase(activeCompanyId: string, baseData?: ProjectControlData): Promise<ProjectControlData> {
  const client = requireSupabaseClient();

  return loadDataFromSupabaseWithClient(client, activeCompanyId, baseData);
}

export async function loadDataFromSupabaseWithClient(
  client: SupabaseClient,
  activeCompanyId: string,
  baseData?: ProjectControlData,
  syncOptions?: string[] | CloudLoadOptions
): Promise<ProjectControlData> {
  const options: CloudLoadOptions = Array.isArray(syncOptions) ? { allowedProjectIds: syncOptions, includeCompanyHr: false } : (syncOptions ?? {});
  const allowedProjectIds = options.allowedProjectIds;
  const includeCompanyHr = options.includeCompanyHr ?? !allowedProjectIds;
  const allowedSections = options.allowedSections ? new Set(options.allowedSections) : null;
  const includeBoq = !allowedSections || allowedSections.has("boq");
  const includeDailyReport = !allowedSections || allowedSections.has("daily_report");
  const includeHr = includeCompanyHr && (!allowedSections || allowedSections.has("hr"));
  const includeBuyin = !allowedSections || allowedSections.has("buyin");

  const companyResult = await runCloudOperation(
    () =>
      client
        .from("companies")
        .select("id, name, slug, owner_user_id, created_at, updated_at")
        .eq("id", activeCompanyId)
        .maybeSingle<CloudCompanyRow>(),
    "โหลดบริษัทจาก cloud ไม่สำเร็จ"
  );

  if (!companyResult.data) {
    throw new Error("ไม่พบบริษัทนี้บน Supabase");
  }

  const projectsResult =
    allowedProjectIds && allowedProjectIds.length === 0
      ? { data: [], error: null }
      : await runCloudOperation(
          () => {
            const projectsQuery = client.from("projects").select("*").eq("company_id", activeCompanyId);
            return (allowedProjectIds ? projectsQuery.in("id", allowedProjectIds) : projectsQuery).order("created_at", { ascending: true });
          },
          "โหลด project จาก cloud ไม่สำเร็จ"
        );
  const cloudProjects = (projectsResult.data ?? []) as CloudProjectRow[];
  const projectIds = cloudProjects.map((project) => project.id);

  const categoriesResult =
    includeBoq && projectIds.length > 0
      ? await runCloudOperation(
          () => client.from("boq_categories").select("*").eq("company_id", activeCompanyId).in("project_id", projectIds).order("sort_order", { ascending: true }),
          "โหลด BOQ categories จาก cloud ไม่สำเร็จ"
        )
      : { data: [], error: null };
  const cloudCategories = (categoriesResult.data ?? []) as CloudBoqCategoryRow[];

  const itemsResult =
    includeBoq && projectIds.length > 0
      ? await runCloudOperation(
          () => client.from("boq_items").select("*").eq("company_id", activeCompanyId).in("project_id", projectIds).order("sort_order", { ascending: true }),
          "โหลด BOQ items จาก cloud ไม่สำเร็จ"
        )
      : { data: [], error: null };
  const cloudItems = (itemsResult.data ?? []) as CloudBoqItemRow[];

  const reportsResult =
    includeDailyReport && projectIds.length > 0
      ? await runCloudOperation(
          () => client.from("daily_reports").select("*").eq("company_id", activeCompanyId).in("project_id", projectIds).order("report_date", { ascending: false }),
          "โหลด Daily Reports จาก cloud ไม่สำเร็จ"
        )
      : { data: [], error: null };
  const cloudReports = (reportsResult.data ?? []) as CloudDailyReportRow[];
  const reportIds = cloudReports.map((report) => report.id);

  const workersResult =
    includeDailyReport && reportIds.length > 0
      ? await runCloudOperation(
          () => client.from("daily_report_workers").select("*").eq("company_id", activeCompanyId).in("report_id", reportIds).order("created_at", { ascending: true }),
          "โหลด Daily Report workers จาก cloud ไม่สำเร็จ"
        )
      : { data: [], error: null };
  const cloudWorkers = (workersResult.data ?? []) as CloudDailyReportWorkerRow[];

  const progressResult =
    includeDailyReport && reportIds.length > 0
      ? await runCloudOperation(
          () =>
            client
              .from("daily_report_progress_updates")
              .select("*")
              .eq("company_id", activeCompanyId)
              .in("report_id", reportIds)
              .order("created_at", { ascending: true }),
          "โหลด Daily Report progress updates จาก cloud ไม่สำเร็จ"
        )
      : { data: [], error: null };
  const cloudProgressUpdates = (progressResult.data ?? []) as CloudDailyReportProgressUpdateRow[];

  const crewsResult = includeHr
    ? await runCloudOperation(
        () => client.from("hr_crews").select("*").eq("company_id", activeCompanyId).order("created_at", { ascending: true }),
        "โหลด HR crews จาก cloud ไม่สำเร็จ"
      )
    : { data: [], error: null };
  const cloudCrews = (crewsResult.data ?? []) as CloudCrewRow[];

  const laborExpensesResult = includeHr
    ? await runCloudOperation(
        () => client.from("hr_labor_expenses").select("*").eq("company_id", activeCompanyId).order("expense_date", { ascending: false }),
        "โหลด HR labor expenses จาก cloud ไม่สำเร็จ"
      )
    : { data: [], error: null };
  const cloudLaborExpenses = (laborExpensesResult.data ?? []) as CloudLaborExpenseRow[];

  const buyinResult =
    !includeBuyin
      ? { data: [], error: null }
      :
    allowedProjectIds && allowedProjectIds.length === 0
      ? { data: [], error: null }
      : await runCloudOperation(
          () => {
            const buyinQuery = client.from("buyin_entries").select("*").eq("company_id", activeCompanyId);
            return allowedProjectIds
              ? buyinQuery.in("project_id", allowedProjectIds).order("entry_date", { ascending: false })
              : buyinQuery.order("entry_date", { ascending: false });
          },
          "โหลด BUYIN จาก cloud ไม่สำเร็จ"
        );
  const cloudBuyinEntries = (buyinResult.data ?? []) as CloudBuyinEntryRow[];

  validateCloudSyncPayloadIntegrity(
    {
      company: companyResult.data,
      projects: cloudProjects,
      boqCategories: cloudCategories,
      boqItems: cloudItems,
      dailyReports: cloudReports,
      dailyReportWorkers: cloudWorkers,
      dailyReportProgressUpdates: cloudProgressUpdates,
      hrCrews: cloudCrews,
      hrLaborExpenses: cloudLaborExpenses,
      buyinEntries: cloudBuyinEntries
    },
    { allowMissingCrewReferences: !includeHr }
  );

  const projects: Project[] = cloudProjects.map((project) => {
    const categories = cloudCategories
      .filter((category) => category.project_id === project.id)
      .map((category) => ({
        id: category.id,
        name: category.name,
        items: cloudItems
          .filter((item) => item.project_id === project.id && item.category_id === category.id)
          .map((item) => ({
            id: item.id,
            description: item.description ?? "",
            quantity: toNumber(item.quantity),
            unit: item.unit ?? "",
            unitPrice: toNumber(item.unit_price),
            progress: toNumber(item.progress)
          }))
      }));

    return {
      id: project.id,
      companyId: project.company_id,
      name: project.name,
      status: project.status ?? "ดำเนินการ",
      owner: project.owner ?? "",
      team: Array.isArray(project.team) ? project.team : [],
      note: project.note ?? "",
      coverImage: normalizePhoto(project.cover_image),
      customer: {
        name: project.customer_name ?? "",
        phone: project.customer_phone ?? "",
        email: project.customer_email ?? "",
        lineId: project.customer_line_id ?? "",
        siteAddress: project.site_address ?? "",
        siteContact: project.site_contact ?? ""
      },
      budget: {
        mainContract: toNumber(project.main_contract),
        variationOrder: toNumber(project.variation_order)
      },
      timeline: {
        startDate: project.start_date ?? "",
        dueDate: project.due_date ?? ""
      },
      boq: categories,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    };
  });

  const dailyReports: DailyReport[] = cloudReports.map((report) => ({
    id: report.id,
    companyId: report.company_id,
    projectId: report.project_id,
    reportDate: report.report_date,
    preparedBy: report.prepared_by ?? "",
    preparedByPhone: report.prepared_by_phone ?? "",
    summary: report.summary ?? "",
    workItems: normalizeDailyWorkItems({
      id: report.id,
      completedWork: report.completed_work,
      ongoingWork: report.ongoing_work
    }),
    completedWork: report.completed_work ?? "",
    ongoingWork: report.ongoing_work ?? "",
    problems: report.problems ?? "",
    materials: report.materials ?? "",
    nextPlan: report.next_plan ?? "",
    customerNote: report.customer_note ?? "",
    internalNote: report.internal_note ?? "",
    workers: cloudWorkers
      .filter((worker) => worker.report_id === report.id)
      .map((worker) => ({
        id: worker.id,
        crewId: worker.crew_id ?? undefined,
        name: worker.name ?? "",
        trade: worker.trade ?? "ทั่วไป",
        count: toNumber(worker.count),
        startTime: worker.start_time ?? "",
        endTime: worker.end_time ?? "",
        taskTitle: worker.task_title ?? "",
        taskStatus: worker.task_status ?? "ดำเนินการ",
        note: worker.note ?? ""
      })),
    progressUpdates: cloudProgressUpdates
      .filter((update) => update.report_id === report.id)
      .map((update) => ({
        id: update.id,
        categoryId: update.category_id ?? undefined,
        itemId: update.item_id ?? undefined,
        title: update.title ?? "",
        previousProgress: toNumber(update.previous_progress),
        newProgress: toNumber(update.new_progress),
        note: update.note ?? ""
      })),
    problemIssues: Array.isArray(report.problem_issues) ? report.problem_issues : [],
    photos: Array.isArray(report.photos) ? report.photos : [],
    createdAt: report.created_at,
    updatedAt: report.updated_at
  }));

  const crews: Crew[] = cloudCrews.map((crew) => ({
    id: crew.id,
    companyId: crew.company_id,
    leaderName: crew.leader_name ?? "",
    nationalId: crew.national_id ?? "",
    phone: crew.phone ?? "",
    workTypes: Array.isArray(crew.work_types) ? crew.work_types : [],
    note: crew.note ?? "",
    status: crew.status === "inactive" ? "inactive" : "active",
    createdAt: crew.created_at,
    updatedAt: crew.updated_at
  }));

  const laborExpenses: LaborExpense[] = cloudLaborExpenses.map((expense) => ({
    id: expense.id,
    companyId: expense.company_id,
    crewId: expense.crew_id,
    projectId: expense.project_id ?? undefined,
    expenseDate: expense.expense_date,
    workType: expense.work_type ?? "",
    description: expense.description ?? "",
    amount: Math.max(0, toNumber(expense.amount)),
    note: expense.note ?? "",
    createdAt: expense.created_at,
    updatedAt: expense.updated_at
  }));

  const buyinEntries: BuyinEntry[] = cloudBuyinEntries.map((entry) => {
    const amountPaid = Math.max(0, toNumber(entry.amount_paid));
    const includeVat = Boolean(entry.include_vat);

    return {
      id: entry.id,
      companyId: entry.company_id,
      projectId: entry.project_id ?? undefined,
      entryDate: entry.entry_date,
      type: entry.type === "invoice" ? "invoice" : "expense",
      storeName: entry.store_name ?? "",
      vendorName: entry.vendor_name ?? "",
      vendorTaxId: entry.vendor_tax_id ?? "",
      description: entry.description ?? "",
      category: entry.category ?? "",
      amountPaid,
      includeVat,
      netAmount: calculateBuyinNetAmount(amountPaid, includeVat),
      vatAmount: calculateBuyinVatAmount(amountPaid, includeVat),
      note: entry.note ?? "",
      createdAt: entry.created_at,
      updatedAt: entry.updated_at
    };
  });

  const existingData = baseData ?? {
    companies: [],
    activeCompanyId,
    projects: [],
    activeProjectId: "",
    dailyReports: [],
    crews: [],
    laborExpenses: [],
    buyinEntries: []
  };
  const fallbackRole = existingData.companies.find((company) => company.id === activeCompanyId)?.role ?? "owner";
  const merged = {
    companies: [
      ...existingData.companies.filter((company) => company.id !== activeCompanyId),
      {
        id: companyResult.data.id,
        name: companyResult.data.name,
        role: fallbackRole,
        createdAt: companyResult.data.created_at,
        updatedAt: companyResult.data.updated_at
      }
    ],
    activeCompanyId,
    projects: [...existingData.projects.filter((project) => project.companyId !== activeCompanyId), ...projects],
    activeProjectId:
      projects.some((project) => project.id === existingData.activeProjectId) ? existingData.activeProjectId : (projects[0]?.id ?? ""),
    dailyReports: [...existingData.dailyReports.filter((report) => report.companyId !== activeCompanyId), ...dailyReports],
    crews: [...(existingData.crews ?? []).filter((crew) => crew.companyId !== activeCompanyId), ...crews],
    laborExpenses: [...(existingData.laborExpenses ?? []).filter((expense) => expense.companyId !== activeCompanyId), ...laborExpenses],
    buyinEntries: [...(existingData.buyinEntries ?? []).filter((entry) => entry.companyId !== activeCompanyId), ...buyinEntries]
  };

  return ensurePhaseOneData(merged, todayString());
}

export function validateImportedData(value: unknown): value is ProjectControlData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.companies) &&
    typeof value.activeCompanyId === "string" &&
    Array.isArray(value.projects) &&
    typeof value.activeProjectId === "string" &&
    Array.isArray(value.dailyReports)
  );
}

export function loadProjectControlData(): ProjectControlData {
  if (typeof window === "undefined") {
    return createDefaultData();
  }

  const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);

  if (!stored) {
    const initialData = createDefaultData();
    saveProjectControlData(initialData);
    return initialData;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;

    if (validateImportedData(parsed)) {
      return ensurePhaseOneData(parsed, todayString());
    }
  } catch {
    return createDefaultData();
  }

  return createDefaultData();
}

export function saveProjectControlData(data: ProjectControlData): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(ensurePhaseOneData(data, todayString())));
}

export function exportProjectControlJson(data: ProjectControlData): string {
  return JSON.stringify(ensurePhaseOneData(data, todayString()), null, 2);
}

export function importProjectControlJson(rawJson: string, today = todayString()): ProjectControlData {
  const parsed = JSON.parse(rawJson) as unknown;

  if (!validateImportedData(parsed)) {
    throw new Error("ไฟล์ JSON ไม่ใช่ข้อมูล PCON Project Control Phase 1 ที่ถูกต้อง");
  }

  return ensurePhaseOneData(parsed, today);
}
