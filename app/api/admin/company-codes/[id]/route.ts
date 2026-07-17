import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth-platform";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { id } = await params;
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }
    await requirePlatformAdmin(client, userData.user.id);

    const status = body.status === "inactive" || body.status === "expired" ? body.status : "active";
    const { data, error } = await client.from("company_codes").update({ status }).eq("id", id).select("*").single();
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, code: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "อัปเดตรหัสบริษัทไม่สำเร็จ", 400);
  }
}
