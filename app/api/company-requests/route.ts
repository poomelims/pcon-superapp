import { NextResponse } from "next/server";

import { validateCompanyRequestInput } from "@/lib/auth-platform";
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
    return jsonError("ข้อมูลคำขอไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  try {
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }

    const parsed = validateCompanyRequestInput({
      companyName: typeof body.companyName === "string" ? body.companyName : "",
      requesterEmail: userData.user.email ?? "",
      companyTaxId: typeof body.companyTaxId === "string" ? body.companyTaxId : "",
      contactName: typeof body.contactName === "string" ? body.contactName : "",
      contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : "",
      contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : userData.user.email ?? "",
      note: typeof body.note === "string" ? body.note : ""
    });

    const { data, error } = await client
      .from("company_registration_requests")
      .insert({
        requester_user_id: userData.user.id,
        requester_email: parsed.requesterEmail,
        company_name: parsed.companyName,
        company_tax_id: parsed.companyTaxId,
        contact_name: parsed.contactName,
        contact_phone: parsed.contactPhone,
        contact_email: parsed.contactEmail,
        note: parsed.note,
        status: "pending"
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, request: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "ส่งคำขอสร้างบริษัทไม่สำเร็จ", 400);
  }
}
