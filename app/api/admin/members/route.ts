import { NextResponse } from "next/server";

import { DEFAULT_ROLE_ACCESS, loginIdToInternalEmail } from "@/lib/access-control";
import { resolveAdminTargetCompanyId } from "@/lib/admin-scope";
import {
  buildMemberInsert,
  canManageMembers,
  countCompanyMembers,
  findActiveMemberByUserId,
  listMembers,
  requireSetupToken,
  requireValidMemberInput
} from "@/lib/admin-members";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

async function requireAdminMember(request: Request, requestedCompanyId?: string | null) {
  const token = bearerToken(request);

  if (!token) {
    throw new Error("กรุณา Login ก่อน");
  }

  const client = createSupabaseServerClient();
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Session ไม่ถูกต้อง");
  }

  const member = await findActiveMemberByUserId(client, data.user.id, requestedCompanyId?.trim() || undefined);

  if (!canManageMembers(member)) {
    throw new Error("ไม่มีสิทธิ์จัดการสมาชิก");
  }

  return { client, member: member!, userId: data.user.id };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get("companyId");
    const { client, member } = await requireAdminMember(request, requestedCompanyId);
    const companyId = resolveAdminTargetCompanyId(searchParams.get("companyId"), member.companyId);

    return NextResponse.json({ members: await listMembers(client, companyId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "โหลดสมาชิกไม่สำเร็จ";
    return jsonError(message, message.includes("สิทธิ์") ? 403 : 401);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("ข้อมูลสมาชิกไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  try {
    const client = createSupabaseServerClient();
    const requestedCompanyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : "";
    const bootstrapRequested = Boolean(body.bootstrap);
    let admin = bootstrapRequested ? null : await requireAdminMember(request, requestedCompanyId || undefined);
    let companyId = admin
      ? resolveAdminTargetCompanyId(requestedCompanyId || undefined, admin.member.companyId)
      : requestedCompanyId || "local-company-owner";
    const memberCount = await countCompanyMembers(client, companyId);
    const isBootstrap = bootstrapRequested && memberCount === 0;
    const roleInput = isBootstrap ? "owner" : typeof body.role === "string" ? body.role : "viewer";
    const parsed = requireValidMemberInput({
      loginId: typeof body.loginId === "string" ? body.loginId : "",
      password: typeof body.password === "string" ? body.password : "",
      displayName: typeof body.displayName === "string" ? body.displayName : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      role: roleInput,
      accessSections: isBootstrap ? DEFAULT_ROLE_ACCESS.owner : body.accessSections,
      projectIds: body.projectIds
    });

    if (isBootstrap) {
      requireSetupToken(typeof body.setupToken === "string" ? body.setupToken : undefined);
    } else if (!admin) {
      admin = await requireAdminMember(request, requestedCompanyId || undefined);
      companyId = resolveAdminTargetCompanyId(requestedCompanyId || undefined, admin.member.companyId);
    }

    const authEmail = loginIdToInternalEmail(parsed.loginId);
    const { data: createdUser, error: createError } = await client.auth.admin.createUser({
      email: authEmail,
      password: typeof body.password === "string" ? body.password : "",
      email_confirm: true,
      user_metadata: {
        login_id: parsed.loginId,
        display_name: parsed.displayName,
        phone: parsed.phone
      }
    });

    if (createError || !createdUser.user) {
      throw new Error(createError?.message ?? "สร้าง Auth user ไม่สำเร็จ");
    }

    const { data, error } = await client
      .from("company_members")
      .insert(
        buildMemberInsert({
          companyId,
          loginId: parsed.loginId,
          authUserId: createdUser.user.id,
          displayName: parsed.displayName,
          phone: parsed.phone,
          role: parsed.role,
          accessSections: parsed.accessSections,
          projectIds: parsed.projectIds
        })
      )
      .select("id, company_id, login_id, auth_user_id, auth_email, display_name, email, phone, role, access_sections, project_ids, status, created_at, updated_at")
      .single();

    if (error) {
      await client.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined);
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, member: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "สร้างสมาชิกไม่สำเร็จ", 400);
  }
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("ข้อมูลสมาชิกไม่ใช่ JSON ที่ถูกต้อง", 400);
  }

  try {
    const requestedCompanyId = typeof body.companyId === "string" ? body.companyId : undefined;
    const { client, member: adminMember, userId } = await requireAdminMember(request, requestedCompanyId);
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return jsonError("ไม่พบ member id", 400);
    }

    const parsed = requireValidMemberInput({
      loginId: typeof body.loginId === "string" ? body.loginId : "MEMBER",
      displayName: typeof body.displayName === "string" ? body.displayName : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      role: typeof body.role === "string" ? body.role : "viewer",
      accessSections: body.accessSections,
      projectIds: body.projectIds
    });

    const { data: existing, error: existingError } = await client
      .from("company_members")
      .select("auth_user_id")
      .eq("id", id)
      .eq("company_id", adminMember.companyId)
      .single();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (body.password && typeof body.password === "string" && existing?.auth_user_id) {
      if (body.password.length < 6) {
        return jsonError("Password ต้องมีอย่างน้อย 6 ตัวอักษร", 400);
      }

      const { error: passwordError } = await client.auth.admin.updateUserById(existing.auth_user_id, {
        password: body.password
      });

      if (passwordError) {
        throw new Error(passwordError.message);
      }
    }

    const nextStatus = body.status === "disabled" ? "disabled" : "active";
    const { data, error } = await client
      .from("company_members")
      .update({
        display_name: parsed.displayName,
        phone: parsed.phone,
        role: parsed.role,
        access_sections: parsed.accessSections,
        project_ids: parsed.projectIds,
        status: existing?.auth_user_id === userId ? "active" : nextStatus
      })
      .eq("id", id)
      .eq("company_id", adminMember.companyId)
      .select("id, company_id, login_id, auth_user_id, auth_email, display_name, email, phone, role, access_sections, project_ids, status, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, member: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "อัปเดตสมาชิกไม่สำเร็จ", 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get("companyId");
    const { client, member: adminMember, userId } = await requireAdminMember(request, requestedCompanyId);
    const id = searchParams.get("id");

    if (!id) {
      return jsonError("ไม่พบ member id", 400);
    }

    const { data: member, error: loadError } = await client
      .from("company_members")
      .select("auth_user_id")
      .eq("id", id)
      .eq("company_id", adminMember.companyId)
      .single();

    if (loadError) {
      throw new Error(loadError.message);
    }

    if (member.auth_user_id === userId) {
      return jsonError("ไม่สามารถลบ ID ที่กำลังใช้งานอยู่ได้", 400);
    }

    const { error } = await client
      .from("company_members")
      .update({ status: "disabled" })
      .eq("id", id)
      .eq("company_id", adminMember.companyId);

    if (error) {
      throw new Error(error.message);
    }

    if (member.auth_user_id) {
      const { error: deleteError } = await client.auth.admin.deleteUser(member.auth_user_id);
      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "ลบสมาชิกไม่สำเร็จ", 400);
  }
}
