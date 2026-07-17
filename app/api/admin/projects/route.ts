import { NextResponse } from "next/server";

import { resolveAdminTargetCompanyId } from "@/lib/admin-scope";
import { canManageMembers, findActiveMemberByUserId } from "@/lib/admin-members";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

export async function GET(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return jsonError("กรุณา Login ก่อน", 401);
  }

  try {
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }

    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get("companyId");
    const member = await findActiveMemberByUserId(client, userData.user.id, requestedCompanyId?.trim() || undefined);
    if (!canManageMembers(member)) {
      return jsonError("ไม่มีสิทธิ์ดูรายการ Project", 403);
    }

    const companyId = resolveAdminTargetCompanyId(requestedCompanyId, member!.companyId);
    const { data, error } = await client
      .from("projects")
      .select("id, name, company_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ projects: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "โหลด Project ไม่สำเร็จ";
    return jsonError(message, message.includes("สิทธิ์") ? 403 : 500);
  }
}
