import { findActiveMemberByUserId, type AdminMember } from "@/lib/admin-members";
import { retryTransientCloudOperation } from "@/lib/project-control/cloud-sync-reliability";
import { createSupabaseServerClient, requireCloudSyncToken } from "@/lib/supabase/server";
import { type SupabaseClient } from "@supabase/supabase-js";

type CloudSyncAccess =
  | {
      client: SupabaseClient;
      member: null;
      allowedProjectIds: undefined;
      allowedSections: undefined;
      projectIdsToAssign: undefined;
      includeCompanyHr: true;
      canDeleteMissingRows: true;
    }
  | {
      client: SupabaseClient;
      member: AdminMember;
      allowedProjectIds: string[] | undefined;
      allowedSections: string[] | undefined;
      projectIdsToAssign: string[] | undefined;
      includeCompanyHr: boolean;
      canDeleteMissingRows: boolean;
    };

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

type ProjectScope = {
  allowedProjectIds: string[] | undefined;
  projectIdsToAssign: string[] | undefined;
};

function uniqueProjectIds(projectIds: string[] | undefined): string[] {
  return Array.from(new Set((projectIds ?? []).map((projectId) => projectId.trim()).filter(Boolean)));
}

async function existingProjectIdsForCompany(client: SupabaseClient, companyId: string, projectIds: string[]): Promise<Set<string>> {
  if (projectIds.length === 0) {
    return new Set();
  }

  const { data, error } = await client
    .from("projects")
    .select("id")
    .eq("company_id", companyId)
    .in("id", projectIds);

  if (error) {
    throw new Error(`ตรวจสอบสิทธิ์ project ไม่สำเร็จ: ${error.message}`);
  }

  return new Set(((data ?? []) as Array<{ id: string | null }>).map((row) => row.id).filter((id): id is string => Boolean(id)));
}

async function resolveMemberProjectScope(
  client: SupabaseClient,
  member: AdminMember,
  requestedProjectIds?: string[]
): Promise<ProjectScope> {
  if (member.role === "owner" || member.role === "admin") {
    return {
      allowedProjectIds: member.projectIds.length > 0 ? member.projectIds : undefined,
      projectIdsToAssign: undefined
    };
  }

  const assignedProjectIds = uniqueProjectIds(member.projectIds);
  const requestedIds = uniqueProjectIds(requestedProjectIds);

  if (requestedIds.length === 0) {
    return {
      allowedProjectIds: assignedProjectIds,
      projectIdsToAssign: undefined
    };
  }

  const assignedProjectIdSet = new Set(assignedProjectIds);
  const unassignedRequestedIds = requestedIds.filter((projectId) => !assignedProjectIdSet.has(projectId));
  const existingUnassignedIds = await existingProjectIdsForCompany(client, member.companyId, unassignedRequestedIds);
  const allowedRequestedIds = requestedIds.filter((projectId) => !existingUnassignedIds.has(projectId));
  const newRequestedIds = unassignedRequestedIds.filter((projectId) => !existingUnassignedIds.has(projectId));
  const expandedProjectIds = uniqueProjectIds([...assignedProjectIds, ...newRequestedIds]);

  return {
    allowedProjectIds: allowedRequestedIds,
    projectIdsToAssign: expandedProjectIds.length > assignedProjectIds.length ? expandedProjectIds : undefined
  };
}

export async function assignCreatedProjectsToMember(
  client: SupabaseClient,
  member: AdminMember,
  projectIdsToAssign: string[] | undefined
): Promise<void> {
  if (!projectIdsToAssign || projectIdsToAssign.length === 0 || member.role === "owner" || member.role === "admin") {
    return;
  }

  await retryTransientCloudOperation(
    async () => {
      const { error } = await client
        .from("company_members")
        .update({ project_ids: projectIdsToAssign })
        .eq("id", member.id);

      if (error) {
        throw new Error(`อัปเดตสิทธิ์ project ของสมาชิกไม่สำเร็จ: ${error.message}`);
      }
    },
    { idempotent: true }
  );
}

export async function authorizeCloudSyncRequest(
  request: Request,
  options: {
    companyId?: string;
    requestedProjectIds?: string[];
  } = {}
): Promise<CloudSyncAccess> {
  const client = createSupabaseServerClient();
  const syncToken = request.headers.get("x-pcon-sync-token");

  if (syncToken) {
    requireCloudSyncToken(syncToken);
    return {
      client,
      member: null,
      allowedProjectIds: undefined,
      allowedSections: undefined,
      projectIdsToAssign: undefined,
      includeCompanyHr: true,
      canDeleteMissingRows: true
    };
  }

  const token = bearerToken(request);

  if (!token) {
    throw new Error("Cloud sync token ไม่ถูกต้อง");
  }

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Session ไม่ถูกต้อง");
  }

  const member = await findActiveMemberByUserId(client, data.user.id, options.companyId);

  if (!member) {
    throw new Error("ID นี้ยังไม่ได้รับสิทธิ์เข้า workspace");
  }

  if (options.companyId && member.companyId !== options.companyId) {
    throw new Error("ID นี้ไม่มีสิทธิ์ sync บริษัทนี้");
  }

  const projectScope = await resolveMemberProjectScope(client, member, options.requestedProjectIds);
  const includeCompanyHr = member.role === "owner" || member.role === "admin" || member.accessSections.includes("hr");

  return {
    client,
    member,
    allowedProjectIds: projectScope.allowedProjectIds,
    allowedSections: member.role === "owner" || member.role === "admin" ? undefined : member.accessSections,
    projectIdsToAssign: projectScope.projectIdsToAssign,
    includeCompanyHr,
    canDeleteMissingRows: member.role === "owner" || member.role === "admin"
  };
}
