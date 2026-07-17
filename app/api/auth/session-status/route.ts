import { NextResponse } from "next/server";

import { isPlatformAdmin } from "@/lib/auth-platform";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

const optionalProfileUnavailableCodes = new Set(["PGRST205", "42P01", "42703"]);

function isOptionalProfileUnavailable(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message ?? "";

  return (
    Boolean(candidate.code && optionalProfileUnavailableCodes.has(candidate.code)) ||
    message.includes("profiles") ||
    message.includes("schema cache")
  );
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ user: null, profile: null, memberships: [], isPlatformAdmin: false, emailVerified: false });
  }

  try {
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }

    const user = userData.user;
    const [profileResult, memberResult, adminResult] = await Promise.all([
      client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      client
        .from("company_members")
        .select("id, company_id, user_id, auth_user_id, email, auth_email, display_name, role, status, access_sections, project_ids")
        .or(`user_id.eq.${user.id},auth_user_id.eq.${user.id}`)
        .eq("status", "active"),
      isPlatformAdmin(client, user.id)
    ]);

    if (profileResult.error && !isOptionalProfileUnavailable(profileResult.error)) {
      throw new Error(profileResult.error.message);
    }

    if (memberResult.error) {
      throw new Error(memberResult.error.message);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at
      },
      profile: profileResult.error ? null : (profileResult.data ?? null),
      memberships: memberResult.data ?? [],
      isPlatformAdmin: adminResult,
      emailVerified: Boolean(user.email_confirmed_at)
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "โหลดสถานะบัญชีไม่สำเร็จ", 500);
  }
}
