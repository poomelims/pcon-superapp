import { NextResponse } from "next/server";

import { assignCreatedProjectsToMember, authorizeCloudSyncRequest } from "@/lib/cloud-sync-auth";
import { validateImportedData, syncDataToSupabaseWithClient } from "@/lib/project-storage";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message, status }, { status });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

function validateCompanyReferences(data: {
  activeCompanyId: string;
  companies: Array<{ id: string }>;
  projects: Array<{ companyId: string }>;
}): void {
  if (data.companies.length === 0 && !data.activeCompanyId) {
    return;
  }

  const companyIds = new Set(data.companies.map((company) => company.id));

  if (!companyIds.has(data.activeCompanyId)) {
    throw new Error("ข้อมูล sync ไม่มี active company ที่ใช้งานอยู่");
  }

  for (const project of data.projects) {
    if (!companyIds.has(project.companyId)) {
      throw new Error("ข้อมูล sync มี project ที่ไม่อยู่ใน company list หรือสิทธิ์บริษัทไม่ตรง");
    }
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("ข้อมูล sync ไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  if (!validateImportedData(body)) {
    return jsonError("ข้อมูล sync ไม่ใช่ข้อมูล PCON Project Control ที่ถูกต้อง", 400);
  }

  try {
    validateCompanyReferences(body);
    const requestedProjectIds = body.projects.filter((project) => project.companyId === body.activeCompanyId).map((project) => project.id);
    const access = await authorizeCloudSyncRequest(request, {
      companyId: body.activeCompanyId,
      requestedProjectIds
    });
    const syncOptions = {
      allowedProjectIds: access.allowedProjectIds,
      canDeleteMissingRows: access.canDeleteMissingRows,
      includeCompanyHr: access.includeCompanyHr
    } as {
      allowedProjectIds: string[] | undefined;
      canDeleteMissingRows: boolean;
      includeCompanyHr: boolean;
      allowedSections?: string[];
    };
    if (access.allowedSections) {
      syncOptions.allowedSections = access.allowedSections;
    }
    const payload = await syncDataToSupabaseWithClient(access.client, body, syncOptions);
    if (access.member) {
      await assignCreatedProjectsToMember(access.client, access.member, access.projectIdsToAssign);
    }
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    const message = getErrorMessage(error, "Cloud sync failed");
    const status = message.includes("ไม่ถูกต้อง") || message.includes("Session") ? 401 : message.includes("สิทธิ์") ? 403 : 500;
    console.error("cloud-sync push failed", { status, message });
    return jsonError(message, status);
  }
}
