import { NextResponse } from "next/server";

import { redeemCompanyCode } from "@/lib/auth-platform";
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

    const code = typeof body.code === "string" ? body.code : "";
    if (!code.trim()) {
      return jsonError("กรุณาใส่รหัสบริษัท", 400);
    }

    const result = await redeemCompanyCode(client, {
      code,
      userId: userData.user.id,
      email: userData.user.email ?? "",
      displayName: typeof userData.user.user_metadata?.display_name === "string" ? userData.user.user_metadata.display_name : "",
      phone: typeof userData.user.user_metadata?.phone === "string" ? userData.user.user_metadata.phone : ""
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "เข้าร่วมบริษัทไม่สำเร็จ", 400);
  }
}
