import { type SupabaseClient } from "@supabase/supabase-js";

import {
  type AccessSection,
  DEFAULT_ROLE_ACCESS,
  isMemberRole,
  isValidLoginId,
  loginIdToInternalEmail,
  type MemberRole,
  normalizeAccessSections,
  normalizeLoginId
} from "@/lib/access-control";
import { readCloudSyncServerConfig } from "@/lib/supabase/server";

export type AdminMember = {
  id: string;
  companyId: string;
  loginId: string;
  authUserId: string | null;
  authEmail: string | null;
  displayName: string;
  phone: string;
  role: MemberRole;
  accessSections: AccessSection[];
  projectIds: string[];
  status: "active" | "disabled" | "invited";
  createdAt: string | null;
  updatedAt: string | null;
};

type MemberRow = {
  id: string;
  company_id: string;
  user_id: string | null;
  login_id: string | null;
  auth_user_id: string | null;
  auth_email: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  access_sections: unknown;
  project_ids: unknown;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export function normalizeMemberRow(row: MemberRow): AdminMember {
  const role = isMemberRole(row.role) ? row.role : "viewer";

  return {
    id: row.id,
    companyId: row.company_id,
    loginId: row.login_id ?? "",
    authUserId: row.auth_user_id,
    authEmail: row.auth_email ?? row.email,
    displayName: row.display_name ?? row.login_id ?? row.email ?? "Member",
    phone: row.phone ?? "",
    role,
    accessSections: normalizeAccessSections(row.access_sections, role),
    projectIds: normalizeProjectIds(row.project_ids),
    status: row.status === "disabled" || row.status === "invited" ? row.status : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function normalizeProjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)));
}

export function requireValidMemberInput(input: {
  loginId: string;
  password?: string;
  displayName: string;
  phone?: string;
  role: string;
  accessSections: unknown;
  projectIds?: unknown;
}) {
  const loginId = normalizeLoginId(input.loginId);

  if (!isValidLoginId(loginId)) {
    throw new Error("Login ID ต้องเป็น A-Z, 0-9, _ หรือ - และยาว 3-32 ตัวอักษร");
  }

  if (input.password !== undefined && input.password.length < 6) {
    throw new Error("Password ต้องมีอย่างน้อย 6 ตัวอักษร");
  }

  const role = isMemberRole(input.role) ? input.role : "viewer";

  return {
    loginId,
    displayName: input.displayName.trim() || loginId,
    phone: input.phone?.trim() ?? "",
    role,
    accessSections: normalizeAccessSections(input.accessSections, role),
    projectIds: normalizeProjectIds(input.projectIds)
  };
}

export async function listMembers(client: SupabaseClient, companyId: string): Promise<AdminMember[]> {
  const { data, error } = await client
    .from("company_members")
    .select("id, company_id, user_id, login_id, auth_user_id, auth_email, display_name, email, phone, role, access_sections, project_ids, status, created_at, updated_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MemberRow[]).map(normalizeMemberRow);
}

export async function findActiveMemberByUserId(client: SupabaseClient, authUserId: string, companyId?: string): Promise<AdminMember | null> {
  const selectColumns = "id, company_id, user_id, login_id, auth_user_id, auth_email, display_name, email, phone, role, access_sections, project_ids, status, created_at, updated_at";

  async function findBy(column: "auth_user_id" | "user_id") {
    let query = client
      .from("company_members")
      .select(selectColumns)
      .eq(column, authUserId)
      .eq("status", "active");

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    return query.limit(1).maybeSingle();
  }

  const authLookup = await findBy("auth_user_id");
  if (authLookup.error) {
    throw new Error(authLookup.error.message);
  }

  if (authLookup.data) {
    return normalizeMemberRow(authLookup.data as MemberRow);
  }

  const legacyLookup = await findBy("user_id");
  if (legacyLookup.error) {
    throw new Error(legacyLookup.error.message);
  }

  return legacyLookup.data ? normalizeMemberRow(legacyLookup.data as MemberRow) : null;
}

export function canManageMembers(member: AdminMember | null): boolean {
  return Boolean(member && (member.role === "owner" || member.role === "admin") && member.accessSections.includes("admin"));
}

export async function countCompanyMembers(client: SupabaseClient, companyId: string): Promise<number> {
  const { count, error } = await client
    .from("company_members")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export function requireSetupToken(setupToken: string | undefined): void {
  const { syncToken } = readCloudSyncServerConfig();

  if (!setupToken || setupToken !== syncToken) {
    throw new Error("Setup token ไม่ถูกต้อง");
  }
}

export function buildMemberInsert(input: {
  companyId: string;
  loginId: string;
  authUserId: string;
  displayName: string;
  phone?: string;
  role: MemberRole;
  accessSections?: AccessSection[];
  projectIds?: string[];
}) {
  const accessSections = input.accessSections ?? DEFAULT_ROLE_ACCESS[input.role];
  const authEmail = loginIdToInternalEmail(input.loginId);

  return {
    company_id: input.companyId,
    user_id: input.authUserId,
    auth_user_id: input.authUserId,
    email: authEmail,
    auth_email: authEmail,
    login_id: input.loginId,
    display_name: input.displayName,
    phone: input.phone ?? "",
    role: input.role,
    status: "active",
    access_sections: accessSections,
    project_ids: input.projectIds ?? []
  };
}
