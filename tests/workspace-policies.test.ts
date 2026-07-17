import { describe, expect, it } from "vitest";

import {
  applyCrewRemovalPolicy,
  runLocalFirstCloudSync
} from "@/lib/project-control/workspace-policies";
import {
  createBlankDailyReportDraft,
  createCrew,
  createDefaultDailyWorker,
  createDefaultData,
  createLaborExpense,
  createProject
} from "@/lib/project-storage";

describe("workspace policies", () => {
  it("persists locally before cloud push and keeps the local save on failure", async () => {
    const order: string[] = [];
    const cloudError = new Error("offline");

    await expect(runLocalFirstCloudSync({
      saveLocal: () => order.push("local"),
      pushCloud: async () => {
        order.push("cloud");
        throw cloudError;
      }
    })).rejects.toBe(cloudError);

    expect(order).toEqual(["local", "cloud"]);
  });

  it("distinguishes a local persistence failure and skips the cloud push", async () => {
    const localError = new Error("storage quota exceeded");
    let cloudPushStarted = false;

    await expect(runLocalFirstCloudSync({
      saveLocal: () => {
        throw localError;
      },
      pushCloud: async () => {
        cloudPushStarted = true;
      }
    })).rejects.toMatchObject({
      name: "LocalPersistenceError",
      cause: localError
    });

    expect(cloudPushStarted).toBe(false);
  });

  it("deactivates a referenced crew without deleting historical links", () => {
    const data = createDefaultData();
    const crew = createCrew(data.activeCompanyId);
    const expense = createLaborExpense(data.activeCompanyId, { crewId: crew.id });
    const snapshot = { ...data, crews: [crew], laborExpenses: [expense] };

    const result = applyCrewRemovalPolicy(snapshot, crew.id, "2026-07-15T12:00:00.000Z");

    expect(result.crews[0]).toMatchObject({ id: crew.id, status: "inactive" });
    expect(result.laborExpenses[0].crewId).toBe(crew.id);
  });

  it("deactivates a crew referenced only by Daily Report worker history", () => {
    const data = createDefaultData();
    const project = createProject(data.activeCompanyId);
    const crew = createCrew(data.activeCompanyId);
    const worker = { ...createDefaultDailyWorker(), crewId: crew.id };
    const report = { ...createBlankDailyReportDraft(project), workers: [worker] };
    const snapshot = {
      ...data,
      projects: [project],
      activeProjectId: project.id,
      crews: [crew],
      dailyReports: [report]
    };

    const result = applyCrewRemovalPolicy(snapshot, crew.id, "2026-07-15T12:00:00.000Z");

    expect(result.crews[0]).toMatchObject({ id: crew.id, status: "inactive" });
    expect(result.dailyReports[0].workers[0].crewId).toBe(crew.id);
  });

  it("removes an unreferenced crew", () => {
    const data = createDefaultData();
    const crew = createCrew(data.activeCompanyId);
    const result = applyCrewRemovalPolicy({ ...data, crews: [crew] }, crew.id, "2026-07-15T12:00:00.000Z");

    expect(result.crews).toEqual([]);
  });
});
