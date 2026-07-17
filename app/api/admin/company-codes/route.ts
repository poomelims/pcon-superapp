import { NextResponse } from "next/server";

import { createCompanyCode, requirePlatformAdmin } from "@/lib/auth-platform";
import { isMemberRole } from "@/lib/access-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return jsonError("กรุณา Login ก่อน", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("ข้อมูลรหัสบริษัทไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  try {
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }
    await requirePlatformAdmin(client, userData.user.id);

    const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
    if (!companyId) {
      return jsonError("กรุณาเลือกบริษัท", 400);
    }

    const defaultRole = isMemberRole(body.defaultRole) ? body.defaultRole : "site_supervisor";
    const code = await createCompanyCode(client, {
      companyId,
      createdBy: userData.user.id,
      defaultRole,
      maxUses: typeof body.maxUses === "number" ? body.maxUses : null,
      expiresAt: typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null
    });

    return NextResponse.json({ ok: true, code });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "สร้างรหัสบริษัทไม่สำเร็จ", 400);
  }
}
