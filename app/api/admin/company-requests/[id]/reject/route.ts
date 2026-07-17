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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = bearerToken(request);
  if (!token) {
    return jsonError("กรุณา Login ก่อน", 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    const { id } = await params;
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }
    await requirePlatformAdmin(client, userData.user.id);

    const { data, error } = await client
      .from("company_registration_requests")
      .update({
        status: "rejected",
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
        review_note: typeof body.reviewNote === "string" ? body.reviewNote : ""
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, request: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "ปฏิเสธคำขอไม่สำเร็จ", 400);
  }
}
