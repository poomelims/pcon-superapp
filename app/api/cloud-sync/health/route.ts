import { NextResponse } from "next/server";

import { authorizeCloudSyncRequest } from "@/lib/cloud-sync-auth";
import { runCloudSyncHealthCheck } from "@/lib/cloud-sync-diagnostics";
import { readCloudSyncServerConfig } from "@/lib/supabase/server";

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
  try {
    const access = await authorizeCloudSyncRequest(request);

    if (access.member && access.member.role !== "owner" && access.member.role !== "admin") {
      return jsonError("Cloud Sync diagnostics เฉพาะ Owner/Admin", 403);
    }

    const health = await runCloudSyncHealthCheck(access.client, readCloudSyncServerConfig());
    return NextResponse.json({ ok: true, health });
  } catch (error) {
    const message = getErrorMessage(error, "Cloud Sync diagnostics failed");
    const status = message.includes("ไม่ถูกต้อง") || message.includes("Session") ? 401 : message.includes("สิทธิ์") ? 403 : 500;
    console.error("cloud-sync health failed", { status, message });
    return jsonError(message, status);
  }
}
