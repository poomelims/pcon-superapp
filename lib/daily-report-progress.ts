import { clampProgress } from "@/lib/project-calculations";
import type { DailyProgressUpdate, DailyReport, Project } from "@/lib/project-storage";
import { createId } from "@/lib/project-storage";

function progressKey(categoryId?: string, itemId?: string): string {
  return categoryId && itemId ? `${categoryId}:${itemId}` : "";
}

function boqProgressTitle(categoryName: string, itemDescription: string): string {
  return `${categoryName} / ${itemDescription || "BOQ item"}`;
}

export function syncDailyProgressUpdatesWithBoq(project: Project, progressUpdates: DailyProgressUpdate[]): DailyProgressUpdate[] {
  return createCanonicalDailyProgressUpdates(project, progressUpdates);
}

export function fillMissingBoqProgressUpdates(project: Project, progressUpdates: DailyProgressUpdate[]): DailyProgressUpdate[] {
  return createCanonicalDailyProgressUpdates(project, progressUpdates);
}

export function createCanonicalDailyProgressUpdates(
  project: Project,
  currentUpdates: DailyProgressUpdate[],
  previousReport?: DailyReport | null
): DailyProgressUpdate[] {
  const latestCurrentUpdateByKey = latestProgressUpdateByKey(currentUpdates);
  const latestPreviousUpdateByKey = latestProgressUpdateByKey(previousReport?.progressUpdates ?? []);
  const canonicalUpdates: DailyProgressUpdate[] = [];

  for (const category of project.boq) {
    for (const item of category.items) {
      const key = progressKey(category.id, item.id);
      const currentUpdate = latestCurrentUpdateByKey.get(key);
      const previousUpdate = latestPreviousUpdateByKey.get(key);
      const previousProgress = clampProgress(previousUpdate?.newProgress ?? item.progress);
      const newProgress = clampProgress(currentUpdate?.newProgress ?? previousProgress);

      canonicalUpdates.push({
        id: currentUpdate?.id ?? createId(),
        categoryId: category.id,
        itemId: item.id,
        title: boqProgressTitle(category.name, item.description),
        previousProgress,
        newProgress,
        note: currentUpdate?.note ?? ""
      });
    }
  }

  return canonicalUpdates;
}

function latestProgressUpdateByKey(progressUpdates: DailyProgressUpdate[]): Map<string, DailyProgressUpdate> {
  const updatesByKey = new Map<string, DailyProgressUpdate>();

  for (const update of progressUpdates) {
    const linkedKey = progressKey(update.categoryId, update.itemId);

    if (linkedKey) {
      updatesByKey.set(linkedKey, update);
    }
  }

  return updatesByKey;
}

export function applyDailyProgressUpdatesToProject(project: Project, progressUpdates: DailyProgressUpdate[]): Project {
  const progressByKey = new Map<string, number>();

  for (const update of progressUpdates) {
    const key = progressKey(update.categoryId, update.itemId);

    if (key) {
      progressByKey.set(key, clampProgress(update.newProgress));
    }
  }

  return {
    ...project,
    boq: project.boq.map((category) => ({
      ...category,
      items: category.items.map((item) => {
        const nextProgress = progressByKey.get(progressKey(category.id, item.id));

        return nextProgress === undefined ? item : { ...item, progress: nextProgress };
      })
    }))
  };
}

export function createDailyReportPdfSnapshot(
  project: Project,
  report: DailyReport,
  previousReport?: DailyReport | null
): { project: Project; report: DailyReport } {
  const progressUpdates = createCanonicalDailyProgressUpdates(project, report.progressUpdates, previousReport);

  return {
    project: applyDailyProgressUpdatesToProject(project, progressUpdates),
    report: {
      ...report,
      progressUpdates
    }
  };
}
