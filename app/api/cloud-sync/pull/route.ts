import { NextResponse } from "next/server";

import { authorizeCloudSyncRequest } from "@/lib/cloud-sync-auth";
import { loadDataFromSupabaseWithClient } from "@/lib/project-storage";

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

export async function GET(request: Request) {
  const companyId = new URL(request.url).searchParams.get("companyId")?.trim() ?? "";

  if (!companyId) {
    return jsonError("กรุณาระบุ companyId สำหรับ Load Cloud", 400);
  }

  try {
    const access = await authorizeCloudSyncRequest(request, { companyId });
    const loadOptions = {
      allowedProjectIds: access.allowedProjectIds,
      includeCompanyHr: access.includeCompanyHr
    } as {
      allowedProjectIds: string[] | undefined;
      includeCompanyHr: boolean;
      allowedSections?: string[];
    };
    if (access.allowedSections) {
      loadOptions.allowedSections = access.allowedSections;
    }
    const data = await loadDataFromSupabaseWithClient(access.client, companyId, undefined, loadOptions);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = getErrorMessage(error, "Load Cloud failed");
    const status = message.includes("ไม่ถูกต้อง") || message.includes("Session") ? 401 : message.includes("สิทธิ์") ? 403 : 500;
    console.error("cloud-sync pull failed", { status, message });
    return jsonError(message, status);
  }
}
