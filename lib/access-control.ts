export const ACCESS_SECTIONS = [
  "dashboard",
  "project",
  "boq",
  "daily_report",
  "hr",
  "buyin",
  "cloud_sync",
  "import_export",
  "admin",
  "delete_project"
] as const;

export type AccessSection = (typeof ACCESS_SECTIONS)[number];

export const ACCESS_SECTION_LABELS: Record<AccessSection, string> = {
  dashboard: "Dashboard",
  project: "Project",
  boq: "BOQ",
  daily_report: "Daily Report",
  hr: "HR / ทีมช่าง",
  buyin: "BUYIN / จัดซื้อ",
  cloud_sync: "Cloud Sync",
  import_export: "Import / Export",
  admin: "Admin",
  delete_project: "Delete Project"
};

export const MEMBER_ROLES = ["owner", "admin", "project_manager", "site_supervisor", "office_staff", "worker", "viewer"] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export const DEFAULT_ROLE_ACCESS: Record<MemberRole, AccessSection[]> = {
  owner: [...ACCESS_SECTIONS],
  admin: [...ACCESS_SECTIONS],
  project_manager: ["dashboard", "project", "boq", "daily_report", "hr", "buyin", "cloud_sync", "import_export"],
  site_supervisor: ["dashboard", "project", "daily_report", "hr", "buyin"],
  office_staff: ["dashboard", "project", "boq", "hr", "buyin", "import_export"],
  worker: ["dashboard", "daily_report"],
  viewer: ["dashboard", "project", "boq", "daily_report"]
};

export function normalizeLoginId(loginId: string): string {
  return loginId.trim().toUpperCase().replace(/\s+/g, "-");
}

export function isValidLoginId(loginId: string): boolean {
  return /^[A-Z0-9_-]{3,32}$/.test(normalizeLoginId(loginId));
}

export function normalizeAccessSections(value: unknown, role: MemberRole = "viewer"): AccessSection[] {
  const fallback = DEFAULT_ROLE_ACCESS[role];

  if (role === "owner") {
    return [...fallback];
  }

  if (!Array.isArray(value)) {
    return fallback;
  }

  const sections = value.filter((entry): entry is AccessSection =>
    typeof entry === "string" && ACCESS_SECTIONS.includes(entry as AccessSection)
  );

  return sections.length > 0 ? Array.from(new Set(sections)) : fallback;
}

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && MEMBER_ROLES.includes(value as MemberRole);
}

export function loginIdToInternalEmail(loginId: string): string {
  return `${normalizeLoginId(loginId).toLowerCase()}@pcon.local`;
}
