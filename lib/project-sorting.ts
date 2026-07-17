import { calculateWeightedProgress } from "@/lib/project-calculations";
import type { Project } from "@/lib/project-storage";

const DONE_PROJECT_STATUS = "จบงานแล้ว";
const WAITING_PROJECT_STATUSES = new Set(["รอเริ่มงาน", "รอดำเนินการ"]);

function dateRank(dateValue: string | undefined): number {
  const trimmed = dateValue?.trim() ?? "";
  return trimmed ? Date.parse(`${trimmed}T00:00:00`) : Number.POSITIVE_INFINITY;
}

function hasReachedStartDate(project: Project, today: string): boolean {
  const startRank = dateRank(project.timeline.startDate);
  if (!Number.isFinite(startRank)) {
    return false;
  }

  return startRank <= dateRank(today);
}

function projectStartRank(project: Project, today: string): number {
  if (WAITING_PROJECT_STATUSES.has(project.status)) {
    return 2;
  }

  return hasReachedStartDate(project, today) ? 0 : 1;
}

export function isSuccessProject(project: Project): boolean {
  return project.status === DONE_PROJECT_STATUS;
}

export function filterProjectsByCompany(projects: Project[], companyId: string): Project[] {
  return projects.filter((project) => project.companyId === companyId);
}

export function sortProjectsForDisplay(projects: Project[], today: string): Project[] {
  return [...projects].sort((a, b) => {
    const notStartedRankA = projectStartRank(a, today);
    const notStartedRankB = projectStartRank(b, today);

    if (notStartedRankA !== notStartedRankB) {
      return notStartedRankA - notStartedRankB;
    }

    const progressDiff = calculateWeightedProgress(b) - calculateWeightedProgress(a);
    if (progressDiff !== 0) {
      return progressDiff;
    }

    const startDiff = dateRank(a.timeline.startDate) - dateRank(b.timeline.startDate);
    if (startDiff !== 0) {
      return startDiff;
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function filterActiveProjectsForDisplay(projects: Project[], today: string): Project[] {
  return sortProjectsForDisplay(
    projects.filter((project) => !isSuccessProject(project)),
    today
  );
}

export function filterSuccessProjectsForDisplay(projects: Project[]): Project[] {
  return [...projects]
    .filter(isSuccessProject)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
