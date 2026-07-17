import type { DailyReport, DailyWorkItem, DailyWorkItemStatus } from "./types";

type DailyWorkItemSource = {
  id: string;
  completedWork?: unknown;
  ongoingWork?: unknown;
  workItems?: unknown;
};

function splitLegacyWorkText(value: unknown): string[] {
  return typeof value === "string"
    ? value
        .split(/\r?\n|•|,|;/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function normalizeStatus(value: unknown): DailyWorkItemStatus | null {
  return value === "completed" || value === "ongoing" ? value : null;
}

function sanitizeWorkItems(reportId: string, value: unknown): DailyWorkItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const status = normalizeStatus(record.status);

    if (!title || !status) {
      return [];
    }

    return [{
      id: typeof record.id === "string" && record.id.trim() ? record.id : `${reportId}-work-${status}-${index + 1}`,
      title,
      status
    }];
  });
}

export function normalizeDailyWorkItems(source: DailyWorkItemSource): DailyWorkItem[] {
  const explicitItems = sanitizeWorkItems(source.id, source.workItems);

  const hasLegacyContent = splitLegacyWorkText(source.completedWork).length > 0 || splitLegacyWorkText(source.ongoingWork).length > 0;

  if (explicitItems !== null && (explicitItems.length > 0 || !hasLegacyContent)) {
    return explicitItems;
  }

  const completed = splitLegacyWorkText(source.completedWork).map((title, index) => ({
    id: `${source.id}-work-completed-${index + 1}`,
    title,
    status: "completed" as const
  }));
  const ongoing = splitLegacyWorkText(source.ongoingWork).map((title, index) => ({
    id: `${source.id}-work-ongoing-${index + 1}`,
    title,
    status: "ongoing" as const
  }));

  return [...completed, ...ongoing];
}

export function serializeDailyWorkItems(items: DailyWorkItem[]): Pick<DailyReport, "completedWork" | "ongoingWork"> {
  const normalized = sanitizeWorkItems("report", items) ?? [];

  return {
    completedWork: normalized.filter((item) => item.status === "completed").map((item) => item.title).join("\n"),
    ongoingWork: normalized.filter((item) => item.status === "ongoing").map((item) => item.title).join("\n")
  };
}

export function selectDailyWorkItems(report: DailyWorkItemSource): DailyWorkItem[] {
  return normalizeDailyWorkItems(report);
}

export function selectDailyWorkText(report: DailyWorkItemSource, status: DailyWorkItemStatus): string {
  return selectDailyWorkItems(report)
    .filter((item) => item.status === status)
    .map((item) => item.title)
    .join("\n");
}

export function withDailyWorkItems(report: DailyReport, items: DailyWorkItem[]): DailyReport {
  const workItems = sanitizeWorkItems(report.id, items) ?? [];

  return {
    ...report,
    workItems,
    ...serializeDailyWorkItems(workItems)
  };
}
