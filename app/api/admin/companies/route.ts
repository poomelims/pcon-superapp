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

async function requireAdminClient(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    throw new Error("กรุณา Login ก่อน");
  }

  const client = createSupabaseServerClient();
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Session ไม่ถูกต้อง");
  }

  const member = await findActiveMemberByUserId(client, data.user.id);

  if (!canManageMembers(member)) {
    throw new Error("ไม่มีสิทธิ์จัดการบริษัท");
  }

  return client;
}

export async function GET(request: Request) {
  try {
    const client = await requireAdminClient(request);
    const { data, error } = await client.from("companies").select("id, name, slug, created_at").order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ companies: data ?? [] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "โหลดบริษัทไม่สำเร็จ", 401);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("ข้อมูลบริษัทไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return jsonError("กรุณาระบุชื่อบริษัท", 400);
  }

  try {
    const client = await requireAdminClient(request);
    const { data, error } = await client.from("companies").insert({ name }).select("id, name, slug, created_at").single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, company: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "สร้างบริษัทไม่สำเร็จ", 400);
  }
}
