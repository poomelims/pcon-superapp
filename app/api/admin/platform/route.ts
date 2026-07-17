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

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return jsonError("กรุณา Login ก่อน", 401);
  }

  try {
    const client = createSupabaseServerClient();
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError("Session ไม่ถูกต้อง", 401);
    }

    await requirePlatformAdmin(client, userData.user.id);

    const [requests, companies, codes, members, profiles] = await Promise.all([
      client.from("company_registration_requests").select("*").order("created_at", { ascending: false }),
      client.from("companies").select("*").order("created_at", { ascending: false }),
      client.from("company_codes").select("*").order("created_at", { ascending: false }),
      client.from("company_members").select("*").order("created_at", { ascending: false }),
      client.from("profiles").select("*").order("created_at", { ascending: false })
    ]);

    for (const result of [requests, companies, codes, members, profiles]) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    return NextResponse.json({
      requests: requests.data ?? [],
      companies: companies.data ?? [],
      codes: codes.data ?? [],
      members: members.data ?? [],
      users: profiles.data ?? [],
      summary: {
        pendingRequests: (requests.data ?? []).filter((entry) => entry.status === "pending").length,
        approvedCompanies: (companies.data ?? []).filter((entry) => entry.status !== "archived").length,
        totalUsers: (profiles.data ?? []).length,
        activeCodes: (codes.data ?? []).filter((entry) => entry.status === "active").length
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "โหลด Platform Admin ไม่สำเร็จ", 403);
  }
}
