import { NextResponse } from "next/server";

import { loginIdToInternalEmail, normalizeLoginId } from "@/lib/access-control";
import { validateLocalDevLogin } from "@/lib/local-dev-auth";
import { createSupabasePublicServerClient, createSupabaseServerClient, isCloudSyncServerConfigured } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("ข้อมูล login ไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  const payload = body as { loginId?: unknown; password?: unknown };
  const loginId = typeof payload.loginId === "string" ? normalizeLoginId(payload.loginId) : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!loginId || !password) {
    return jsonError("กรุณากรอก ID และ password", 400);
  }

  try {
    if (!isCloudSyncServerConfigured()) {
      const localDevSession = validateLocalDevLogin(loginId, password);

      if (!localDevSession) {
        return jsonError("ID หรือ password ไม่ถูกต้อง", 401);
      }

      return NextResponse.json({
        ok: true,
        localDevSession
      });
    }

    const adminClient = createSupabaseServerClient();
    const { data: member, error: memberError } = await adminClient
      .from("company_members")
      .select("auth_email, status")
      .eq("login_id", loginId)
      .eq("status", "active")
      .maybeSingle();

    if (memberError) {
      throw memberError;
    }

    if (!member?.auth_email) {
      return jsonError("ID หรือ password ไม่ถูกต้อง", 401);
    }

    const authClient = createSupabasePublicServerClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email: member.auth_email || loginIdToInternalEmail(loginId),
      password
    });

    if (error || !data.session) {
      return jsonError("ID หรือ password ไม่ถูกต้อง", 401);
    }

    return NextResponse.json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Login ไม่สำเร็จ", 500);
  }
}
