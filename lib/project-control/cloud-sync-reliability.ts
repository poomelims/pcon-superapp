import type { CloudSyncPayload } from "@/lib/project-control/storage-core";

export type CloudRetryOptions = {
  attempts?: number;
  delayMs?: number;
  /**
   * Network failures are only retried for reads or writes that are safe to
   * repeat. Callers must opt in explicitly because a lost response can mean
   * that a non-idempotent operation already committed remotely.
   */
  idempotent?: boolean;
};

export function isTransientCloudSyncError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("http 429") ||
    message.includes("http 500") ||
    message.includes("http 502") ||
    message.includes("http 503") ||
    message.includes("http 504")
  );
}

export async function retryTransientCloudOperation<T>(
  operation: () => Promise<T>,
  options: CloudRetryOptions = {}
): Promise<T> {
  if (options.idempotent !== true) {
    return operation();
  }

  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 3));
  const delayMs = Math.max(0, options.delayMs ?? 250);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts || !isTransientCloudSyncError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Cloud sync failed");
}

function requireCompanyId(row: { company_id: string }, companyId: string, label: string): void {
  if (row.company_id !== companyId) {
    throw new Error(`Cloud payload ${label} อ้างอิง company ไม่ตรงกับบริษัทที่กำลัง sync`);
  }
}

function requireProjectId(projectIds: Set<string>, projectId: string | null, label: string): void {
  if (!projectId || !projectIds.has(projectId)) {
    throw new Error(`Cloud payload ${label} อ้างอิง project ที่ไม่มีอยู่ใน payload`);
  }
}

function assertUniqueIds<T extends { id: string }>(rows: T[], label: string): void {
  const ids = new Set<string>();

  for (const row of rows) {
    if (!/^[A-Za-z0-9_-]+$/.test(row.id)) {
      throw new Error(`Cloud payload ${label} id ไม่ปลอดภัย: ${row.id}`);
    }

    if (ids.has(row.id)) {
      throw new Error(`Cloud payload ${label} มี id ซ้ำ: ${row.id}`);
    }

    ids.add(row.id);
  }
}

export type CloudPayloadValidationOptions = {
  allowMissingCrewReferences?: boolean;
};

export function validateCloudSyncPayloadIntegrity(
  payload: CloudSyncPayload,
  options: CloudPayloadValidationOptions = {}
): void {
  const companyId = payload.company.id;
  const projectIds = new Set(payload.projects.map((project) => project.id));
  const categoryProjectIds = new Map(payload.boqCategories.map((category) => [category.id, category.project_id]));
  const itemProjectIds = new Map(payload.boqItems.map((item) => [item.id, item.project_id]));
  const reportProjectIds = new Map(payload.dailyReports.map((report) => [report.id, report.project_id]));
  const crewIds = new Set(payload.hrCrews.map((crew) => crew.id));

  assertUniqueIds(payload.projects, "project");
  assertUniqueIds(payload.boqCategories, "BOQ category");
  assertUniqueIds(payload.boqItems, "BOQ item");
  assertUniqueIds(payload.dailyReports, "Daily Report");
  assertUniqueIds(payload.dailyReportWorkers, "Daily Report worker");
  assertUniqueIds(payload.dailyReportProgressUpdates, "Daily Report progress update");
  assertUniqueIds(payload.hrCrews, "HR crew");
  assertUniqueIds(payload.hrLaborExpenses, "HR labor expense");
  assertUniqueIds(payload.buyinEntries, "BUYIN entry");

  for (const project of payload.projects) {
    requireCompanyId(project, companyId, "project");
  }

  for (const category of payload.boqCategories) {
    requireCompanyId(category, companyId, "BOQ category");
    requireProjectId(projectIds, category.project_id, "BOQ category");
  }

  for (const item of payload.boqItems) {
    requireCompanyId(item, companyId, "BOQ item");
    requireProjectId(projectIds, item.project_id, "BOQ item");

    if (categoryProjectIds.get(item.category_id) !== item.project_id) {
      throw new Error("Cloud payload BOQ item อ้างอิง category คนละ project");
    }
  }

  for (const report of payload.dailyReports) {
    requireCompanyId(report, companyId, "Daily Report");
    requireProjectId(projectIds, report.project_id, "Daily Report");
  }

  for (const worker of payload.dailyReportWorkers) {
    requireCompanyId(worker, companyId, "Daily Report worker");
    requireProjectId(projectIds, worker.project_id, "Daily Report worker");

    if (!reportProjectIds.has(worker.report_id)) {
      throw new Error("Cloud payload Daily Report worker อ้างอิง report ที่ไม่มีอยู่ใน payload");
    }

    if (reportProjectIds.get(worker.report_id) !== worker.project_id) {
      throw new Error("Cloud payload Daily Report worker อ้างอิง report คนละ project");
    }

    if (worker.crew_id && !crewIds.has(worker.crew_id) && !options.allowMissingCrewReferences) {
      throw new Error("Cloud payload Daily Report worker อ้างอิง crew ที่ไม่มีอยู่ใน payload");
    }
  }

  for (const update of payload.dailyReportProgressUpdates) {
    requireCompanyId(update, companyId, "Daily Report progress update");
    requireProjectId(projectIds, update.project_id, "Daily Report progress update");

    if (!reportProjectIds.has(update.report_id)) {
      throw new Error("Cloud payload progress update อ้างอิง report ที่ไม่มีอยู่ใน payload");
    }

    if (reportProjectIds.get(update.report_id) !== update.project_id) {
      throw new Error("Cloud payload progress update อ้างอิง report คนละ project");
    }

    const categoryProjectId = update.category_id ? categoryProjectIds.get(update.category_id) : undefined;
    if (categoryProjectId && categoryProjectId !== update.project_id) {
      throw new Error("Cloud payload progress update อ้างอิง category คนละ project");
    }

    const itemProjectId = update.item_id ? itemProjectIds.get(update.item_id) : undefined;
    if (itemProjectId && itemProjectId !== update.project_id) {
      throw new Error("Cloud payload progress update อ้างอิง item คนละ project");
    }
  }

  for (const crew of payload.hrCrews) {
    requireCompanyId(crew, companyId, "HR crew");
  }

  for (const expense of payload.hrLaborExpenses) {
    requireCompanyId(expense, companyId, "HR labor expense");

    if (!crewIds.has(expense.crew_id)) {
      throw new Error("Cloud payload HR labor expense อ้างอิง crew ที่ไม่มีอยู่ใน payload");
    }

    if (expense.project_id) {
      requireProjectId(projectIds, expense.project_id, "HR labor expense");
    }
  }

  for (const entry of payload.buyinEntries) {
    requireCompanyId(entry, companyId, "BUYIN entry");

    if (entry.project_id) {
      requireProjectId(projectIds, entry.project_id, "BUYIN entry");
    }
  }
}
