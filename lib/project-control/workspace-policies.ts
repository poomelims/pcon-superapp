import type { ProjectControlData } from "@/lib/project-control/types";

export class LocalPersistenceError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "Local persistence failed");
    this.name = "LocalPersistenceError";
    this.cause = cause;
  }
}

export async function runLocalFirstCloudSync(actions: {
  saveLocal: () => void;
  pushCloud: () => Promise<unknown>;
}): Promise<void> {
  try {
    actions.saveLocal();
  } catch (error) {
    throw new LocalPersistenceError(error);
  }

  await actions.pushCloud();
}

export function applyCrewRemovalPolicy(
  data: ProjectControlData,
  crewId: string,
  updatedAt: string
): ProjectControlData {
  const hasHistory =
    data.laborExpenses.some((expense) => expense.crewId === crewId) ||
    data.dailyReports.some((report) => report.workers.some((worker) => worker.crewId === crewId));

  return {
    ...data,
    crews: hasHistory
      ? data.crews.map((crew) =>
          crew.id === crewId ? { ...crew, status: "inactive" as const, updatedAt } : crew
        )
      : data.crews.filter((crew) => crew.id !== crewId)
  };
}
