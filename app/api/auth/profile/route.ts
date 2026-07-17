import { NextResponse } from "next/server";

import { sanitizeEmail } from "@/lib/auth-platform";
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
    return jsonError("ข้อมูล profile ไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  try {
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }

    const email = sanitizeEmail(userData.user.email ?? "");
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim() : null;

    const { data, error } = await client
      .from("profiles")
      .upsert(
        {
          id: userData.user.id,
          email,
          username,
          display_name: displayName || userData.user.user_metadata?.display_name || email,
          phone,
          status: "active"
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, profile: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "บันทึก profile ไม่สำเร็จ", 500);
  }
}
