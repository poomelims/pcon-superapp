import { NextResponse } from "next/server";

import { createSupabaseServerClient, requireCloudSyncToken } from "@/lib/supabase/server";

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
    return jsonError("ข้อมูล bootstrap ไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  try {
    requireCloudSyncToken(typeof body.setupToken === "string" ? body.setupToken : null);
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }

    const { count, error: countError } = await client.from("platform_admins").select("id", { count: "exact", head: true });
    if (countError) {
      throw new Error(countError.message);
    }
    if ((count ?? 0) > 0) {
      return jsonError("มี Platform Admin อยู่แล้ว", 400);
    }

    const { data, error } = await client
      .from("platform_admins")
      .insert({
        user_id: userData.user.id,
        admin_code: "admin001",
        role: "super_admin",
        status: "active"
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, admin: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "สร้าง admin001 ไม่สำเร็จ", 400);
  }
}
