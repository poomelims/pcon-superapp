import { NextResponse } from "next/server";

import { findActiveMemberByUserId } from "@/lib/admin-members";
import { loadDataFromSupabaseWithClient } from "@/lib/project-storage";
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

    const member = await findActiveMemberByUserId(client, userData.user.id);
    if (!member) {
      return jsonError("ID นี้ยังไม่ได้รับสิทธิ์เข้า workspace", 403);
    }

    const projectIds =
      member.role === "owner" || member.role === "admin"
        ? member.projectIds.length > 0
          ? member.projectIds
          : undefined
        : member.projectIds;
    const includeCompanyHr = member.role === "owner" || member.role === "admin" || member.accessSections.includes("hr");
    const data = await loadDataFromSupabaseWithClient(client, member.companyId, undefined, {
      allowedProjectIds: projectIds,
      includeCompanyHr,
      allowedSections: member.role === "owner" || member.role === "admin" ? undefined : member.accessSections
    });

    return NextResponse.json({
      member,
      projectIds,
      data
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "โหลด workspace ไม่สำเร็จ", 500);
  }
}
