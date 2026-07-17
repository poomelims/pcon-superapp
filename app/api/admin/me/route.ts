import { NextResponse } from "next/server";

import { canManageMembers, findActiveMemberByUserId } from "@/lib/admin-members";
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
    return NextResponse.json({ member: null, canManageMembers: false });
  }

  try {
    const client = createSupabaseServerClient();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }

    const user = data.user;
    const member = await findActiveMemberByUserId(client, user.id);
    const profileResult = await client.from("profiles").select("phone").eq("id", user.id).maybeSingle();

    if (profileResult.error && !isOptionalProfileUnavailable(profileResult.error)) {
      throw new Error(profileResult.error.message);
    }

    const memberPhone = member?.phone?.trim() ?? "";
    const profilePhone = typeof profileResult.data?.phone === "string" ? profileResult.data.phone.trim() : "";
    const metadataPhone = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone.trim() : "";
    const phone = memberPhone || profilePhone || metadataPhone;

    return NextResponse.json({
      member: member ? { ...member, phone } : null,
      canManageMembers: canManageMembers(member)
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "โหลดสิทธิ์ไม่สำเร็จ", 500);
  }
}
