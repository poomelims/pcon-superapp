import { countCompletedWork, splitDashboardEntries } from "./dashboard-selectors";
import type { DailyReport, DailyWorker } from "./types";

export type DashboardTodayPulse = {
  workers: number;
  completedWork: number;
  blockers: string[];
  nextPlan: string;
  reportState: "empty" | "draft" | "saved";
};

function validUpdatedAt(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function selectLatestTodayReport(reports: DailyReport[], today: string): DailyReport | null {
  let latest: DailyReport | null = null;
  let latestTimestamp: number | null = null;

  for (const report of reports) {
    if (report.reportDate !== today) {
      continue;
    }

    const candidateTimestamp = validUpdatedAt(report.updatedAt);
    if (!latest) {
      latest = report;
      latestTimestamp = candidateTimestamp;
      continue;
    }

    if (candidateTimestamp !== null && (latestTimestamp === null || candidateTimestamp > latestTimestamp)) {
      latest = report;
      latestTimestamp = candidateTimestamp;
    }
  }

  return latest;
}

function isMeaningfulWorker(worker: DailyWorker): boolean {
  return Boolean(
    worker.name.trim() ||
      worker.crewId?.trim() ||
      worker.taskTitle.trim() ||
      worker.note.trim() ||
      (worker.trade.trim() && worker.trade.trim() !== "ทั่วไป")
  );
}

function countMeaningfulWorkers(workers: DailyWorker[]): number {
  return workers.reduce((total, worker) => {
    if (!isMeaningfulWorker(worker)) {
      return total;
    }

    const count = Number(worker.count);
    return Number.isFinite(count) && count > 0 ? total + count : total;
  }, 0);
}

function selectBlockerLines(report: DailyReport): string[] {
  const structured = report.problemIssues
    .map((issue) => {
      const title = issue.title.trim();
      const detail = issue.detail.trim();
      return title && detail ? `${title}: ${detail}` : title || detail;
    })
    .filter(Boolean);

  return structured.length > 0 ? structured : splitDashboardEntries(report.problems);
}

export function selectDashboardTodayPulse(reports: DailyReport[], today: string): DashboardTodayPulse {
  const report = selectLatestTodayReport(reports, today);

  if (!report) {
    return {
      workers: 0,
      completedWork: 0,
      blockers: [],
      nextPlan: "",
      reportState: "empty"
    };
  }

  return {
    workers: countMeaningfulWorkers(report.workers),
    completedWork: countCompletedWork(report),
    blockers: selectBlockerLines(report),
    nextPlan: report.nextPlan.trim(),
    reportState: "saved"
  };
}
