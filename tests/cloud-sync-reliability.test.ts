import { describe, expect, it, vi } from "vitest";

import {
  createBlankDailyReportDraft,
  createCloudSyncPayload,
  createDefaultData,
  createProject,
  validateCloudSyncPayloadIntegrity,
  type ProjectControlData
} from "@/lib/project-storage";

function buildPayload() {
  const data = createDefaultData();
  const project = createProject(data.activeCompanyId, "โครงการทดสอบ");
  const report = createBlankDailyReportDraft(project);
  const snapshot: ProjectControlData = {
    ...data,
    projects: [project],
    activeProjectId: project.id,
    dailyReports: [{ ...report, preparedByPhone: "081-222-3333" }]
  };

  return createCloudSyncPayload(snapshot);
}

function buildPayloadWithWorker() {
  const payload = buildPayload();
  const report = payload.dailyReports[0];

  payload.dailyReportWorkers = [{
    id: "worker-1",
    company_id: payload.company.id,
    project_id: report.project_id,
    report_id: report.id,
    crew_id: "crew-1",
    name: "ช่างหนึ่ง",
    trade: "ทั่วไป",
    count: 1,
    start_time: "08:00",
    end_time: "17:00",
    task_title: "งานทดสอบ",
    task_status: "ดำเนินการ",
    note: "",
    created_at: report.created_at,
    updated_at: report.updated_at
  }];
  payload.hrCrews = [{
    id: "crew-1",
    company_id: payload.company.id,
    leader_name: "หัวหน้าช่าง",
    national_id: "",
    phone: "",
    work_types: ["ทั่วไป"],
    note: "",
    status: "active",
    created_at: report.created_at,
    updated_at: report.updated_at
  }];

  return payload;
}

describe("cloud sync reliability contracts", () => {
  it("rejects a payload row that references a project from another company", async () => {
    const storage = await import("@/lib/project-storage");
    const validator = (storage as typeof storage & { validateCloudSyncPayloadIntegrity?: (payload: unknown) => void })
      .validateCloudSyncPayloadIntegrity;

    expect(typeof validator).toBe("function");

    const payload = buildPayload();
    expect(() => validator?.({
      ...payload,
      dailyReports: [{ ...payload.dailyReports[0], company_id: "company-other" }]
    })).toThrow("company");
  });

  it("retries transient cloud failures and stops after the configured attempts", async () => {
    const storage = await import("@/lib/project-storage");
    const retry = (storage as typeof storage & {
      retryTransientCloudOperation?: <T>(
        operation: () => Promise<T>,
        options?: { attempts?: number; delayMs?: number; idempotent?: boolean }
      ) => Promise<T>;
    }).retryTransientCloudOperation;

    expect(typeof retry).toBe("function");

    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce("ok");

    await expect(retry?.(operation, { attempts: 2, delayMs: 0, idempotent: true })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry an ambiguous non-idempotent operation by default", async () => {
    const storage = await import("@/lib/project-storage");
    const retry = (storage as typeof storage & {
      retryTransientCloudOperation?: <T>(
        operation: () => Promise<T>,
        options?: { attempts?: number; delayMs?: number; idempotent?: boolean }
      ) => Promise<T>;
    }).retryTransientCloudOperation;

    expect(typeof retry).toBe("function");

    const operation = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

    await expect(retry?.(operation, { attempts: 3, delayMs: 0 })).rejects.toThrow("Failed to fetch");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not retry a permission failure", async () => {
    const storage = await import("@/lib/project-storage");
    const retry = (storage as typeof storage & {
      retryTransientCloudOperation?: <T>(
        operation: () => Promise<T>,
        options?: { attempts?: number; delayMs?: number; idempotent?: boolean }
      ) => Promise<T>;
    }).retryTransientCloudOperation;

    expect(typeof retry).toBe("function");

    const operation = vi.fn().mockRejectedValue(new Error("permission denied for table projects"));

    await expect(retry?.(operation, { attempts: 3, delayMs: 0 })).rejects.toThrow("permission denied");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("allows legacy progress references to BOQ rows deleted from the current payload", () => {
    const payload = buildPayload();
    payload.dailyReportProgressUpdates.push({
      id: "progress-legacy",
      company_id: payload.company.id,
      project_id: payload.projects[0].id,
      report_id: payload.dailyReports[0].id,
      category_id: "deleted-category",
      item_id: "deleted-item",
      title: "งานจากรายงานเก่า",
      previous_progress: 10,
      new_progress: 20,
      note: "BOQ เดิมถูกลบแล้ว",
      created_at: payload.dailyReports[0].created_at,
      updated_at: payload.dailyReports[0].updated_at
    });

    expect(() => validateCloudSyncPayloadIntegrity(payload)).not.toThrow();
  });

  it("rejects a worker whose report belongs to another project", () => {
    const payload = buildPayloadWithWorker();
    const otherProject = createProject(payload.company.id, "อีกโครงการ");

    expect(() => validateCloudSyncPayloadIntegrity({
      ...payload,
      projects: [...payload.projects, {
        ...payload.projects[0],
        id: otherProject.id,
        name: otherProject.name
      }],
      dailyReportWorkers: [{
        ...payload.dailyReportWorkers[0],
        project_id: otherProject.id
      }]
    })).toThrow("worker อ้างอิง report คนละ project");
  });

  it("rejects a worker that references a crew missing from the payload", () => {
    const payload = buildPayloadWithWorker();

    expect(() => validateCloudSyncPayloadIntegrity({
      ...payload,
      dailyReportWorkers: [{
        ...payload.dailyReportWorkers[0],
        crew_id: "crew-missing"
      }]
    })).toThrow("worker อ้างอิง crew");
  });

  it("rejects duplicate IDs within a cloud row collection", () => {
    const payload = buildPayload();

    expect(() => validateCloudSyncPayloadIntegrity({
      ...payload,
      projects: [payload.projects[0], { ...payload.projects[0], name: "ชื่อซ้ำ" }]
    })).toThrow("project มี id ซ้ำ");
  });

  it("rejects storage IDs that could escape a PostgREST id filter", () => {
    const payload = buildPayload();

    expect(() => validateCloudSyncPayloadIntegrity({
      ...payload,
      projects: [{ ...payload.projects[0], id: "project),(id.neq.company" }]
    })).toThrow("id ไม่ปลอดภัย");
  });
});
