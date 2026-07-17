import { NextResponse } from "next/server";

import { approveCompanyRequest, requirePlatformAdmin } from "@/lib/auth-platform";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = bearerToken(request);
  if (!token) {
    return jsonError("กรุณา Login ก่อน", 401);
  }

  try {
    const { id } = await params;
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }
    await requirePlatformAdmin(client, userData.user.id);
    const result = await approveCompanyRequest(client, id, userData.user.id);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "อนุมัติบริษัทไม่สำเร็จ", 400);
  }
}
