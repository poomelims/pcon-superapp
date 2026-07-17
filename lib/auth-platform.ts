import { type SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_ROLE_ACCESS, isMemberRole, type MemberRole } from "@/lib/access-control";

const COMPANY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type PlatformAdminRow = {
  id: string;
  user_id: string;
  admin_code: string | null;
  role: string | null;
  status: string | null;
};

const platformAdminUnavailableCodes = new Set(["PGRST205", "42P01", "42703"]);

function isOptionalAuthTableUnavailable(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message ?? "";

  return (
    Boolean(candidate.code && platformAdminUnavailableCodes.has(candidate.code)) ||
    message.includes("platform_admins") ||
    message.includes("schema cache")
  );
}

export type CompanyCodeAvailability = {
  status: string;
  usedCount: number;
  maxUses?: number | null;
  expiresAt?: string | null;
};

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateRegisterInput(input: {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  phone?: string;
}) {
  const email = sanitizeEmail(input.email);
  const displayName = input.displayName.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("อีเมลไม่ถูกต้อง");
  }

  if (input.password.length < 6) {
    throw new Error("Password ต้องมีอย่างน้อย 6 ตัวอักษร");
  }

  if (input.password !== input.confirmPassword) {
    throw new Error("Password และ Confirm Password ไม่ตรงกัน");
  }

  if (!displayName) {
    throw new Error("กรุณาใส่ชื่อผู้ใช้งาน");
  }

  return {
    email,
    password: input.password,
    displayName,
    phone: input.phone?.trim() ?? ""
  };
}

export function validateCompanyRequestInput(input: {
  companyName: string;
  requesterEmail: string;
  companyTaxId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  note?: string;
}) {
  const companyName = input.companyName.trim();

  if (!companyName) {
    throw new Error("กรุณาระบุชื่อบริษัท");
  }

  return {
    companyName,
    requesterEmail: sanitizeEmail(input.requesterEmail),
    companyTaxId: input.companyTaxId?.trim() ?? "",
    contactName: input.contactName?.trim() ?? "",
    contactPhone: input.contactPhone?.trim() ?? "",
    contactEmail: sanitizeEmail(input.contactEmail || input.requesterEmail),
    note: input.note?.trim() ?? ""
  };
}

export function normalizeCompanyCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "").replace(/^PCON(?!-)/, "PCON-");
}

export function createCompanyCodeValue(randomBytes: (length: number) => Uint8Array = crypto.getRandomValues.bind(crypto)): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (byte) => COMPANY_CODE_ALPHABET[byte % COMPANY_CODE_ALPHABET.length] ?? "A").join("");
  return `PCON-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function isCompanyCodeUsable(code: CompanyCodeAvailability, now = new Date()): { ok: true } | { ok: false; message: string } {
  if (code.status !== "active") {
    return { ok: false, message: "รหัสบริษัทไม่พร้อมใช้งาน" };
  }

  if (code.expiresAt && new Date(code.expiresAt).getTime() < now.getTime()) {
    return { ok: false, message: "รหัสบริษัทหมดอายุ" };
  }

  if (typeof code.maxUses === "number" && code.maxUses > 0 && code.usedCount >= code.maxUses) {
    return { ok: false, message: "รหัสบริษัทถูกใช้ครบแล้ว" };
  }

  return { ok: true };
}

export async function isPlatformAdmin(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from("platform_admins")
    .select("id, user_id, admin_code, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isOptionalAuthTableUnavailable(error)) {
      return false;
    }

    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function requirePlatformAdmin(client: SupabaseClient, userId: string): Promise<void> {
  if (!(await isPlatformAdmin(client, userId))) {
    throw new Error("คุณไม่มีสิทธิ์เข้าหน้า Admin");
  }
}

export async function createCompanyCode(
  client: SupabaseClient,
  input: {
    companyId: string;
    createdBy: string;
    defaultRole?: MemberRole;
    maxUses?: number | null;
    expiresAt?: string | null;
  }
) {
  const defaultRole = input.defaultRole && isMemberRole(input.defaultRole) ? input.defaultRole : "site_supervisor";
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createCompanyCodeValue();
    const { data, error } = await client
      .from("company_codes")
      .insert({
        company_id: input.companyId,
        code,
        default_role: defaultRole,
        status: "active",
        max_uses: input.maxUses ?? null,
        expires_at: input.expiresAt ?? null,
        created_by: input.createdBy
      })
      .select("*")
      .single();

    if (!error) {
      return data;
    }

    lastError = error.message;
    if (!error.message.toLowerCase().includes("duplicate")) {
      break;
    }
  }

  throw new Error(lastError ?? "สร้างรหัสบริษัทไม่สำเร็จ");
}

export async function approveCompanyRequest(client: SupabaseClient, requestId: string, reviewerUserId: string) {
  const { data: request, error: requestError } = await client
    .from("company_registration_requests")
    .select("*")
    .eq("id", requestId)
    .eq("status", "pending")
    .maybeSingle();

  if (requestError) {
    throw new Error(requestError.message);
  }

  if (!request) {
    throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
  }

  const { data: company, error: companyError } = await client
    .from("companies")
    .insert({
      name: request.company_name,
      tax_id: request.company_tax_id,
      contact_name: request.contact_name,
      contact_email: request.contact_email,
      contact_phone: request.contact_phone,
      owner_user_id: request.requester_user_id,
      status: "active"
    })
    .select("*")
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message ?? "สร้างบริษัทไม่สำเร็จ");
  }

  const displayName = request.contact_name || request.requester_email || "Owner";
  const { error: memberError } = await client.from("company_members").upsert(
    {
      company_id: company.id,
      user_id: request.requester_user_id,
      auth_user_id: request.requester_user_id,
      email: request.requester_email,
      auth_email: request.requester_email,
      display_name: displayName,
      phone: request.contact_phone,
      role: "owner",
      status: "active",
      access_sections: DEFAULT_ROLE_ACCESS.owner,
      project_ids: []
    },
    { onConflict: "company_id,user_id" }
  );

  if (memberError) {
    throw new Error(memberError.message);
  }

  const code = await createCompanyCode(client, {
    companyId: String(company.id),
    createdBy: reviewerUserId,
    defaultRole: "site_supervisor"
  });

  const { error: updateError } = await client
    .from("company_registration_requests")
    .update({
      status: "approved",
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
      approved_company_id: company.id
    })
    .eq("id", requestId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { company, code };
}

export async function redeemCompanyCode(
  client: SupabaseClient,
  input: {
    code: string;
    userId: string;
    email: string;
    displayName?: string;
    phone?: string;
  }
) {
  const normalizedCode = normalizeCompanyCode(input.code);
  const { data: codeRow, error: codeError } = await client.from("company_codes").select("*").eq("code", normalizedCode).maybeSingle();

  if (codeError) {
    throw new Error(codeError.message);
  }

  if (!codeRow) {
    throw new Error("รหัสบริษัทไม่ถูกต้อง");
  }

  const usable = isCompanyCodeUsable({
    status: codeRow.status,
    usedCount: Number(codeRow.used_count ?? 0),
    maxUses: codeRow.max_uses,
    expiresAt: codeRow.expires_at
  });

  if (!usable.ok) {
    throw new Error(usable.message);
  }

  const codeDefaultRole = codeRow.default_role as unknown;
  const role: MemberRole = isMemberRole(codeDefaultRole) ? codeDefaultRole : "site_supervisor";
  const { data: member, error: memberError } = await client
    .from("company_members")
    .upsert(
      {
        company_id: codeRow.company_id,
        user_id: input.userId,
        auth_user_id: input.userId,
        email: input.email,
        auth_email: input.email,
        display_name: input.displayName || input.email,
        phone: input.phone ?? "",
        role,
        status: "active",
        access_sections: DEFAULT_ROLE_ACCESS[role],
        project_ids: []
      },
      { onConflict: "company_id,user_id" }
    )
    .select("*")
    .single();

  if (memberError) {
    throw new Error(memberError.message);
  }

  await client.from("company_code_redemptions").upsert(
    {
      company_code_id: codeRow.id,
      company_id: codeRow.company_id,
      user_id: input.userId
    },
    { onConflict: "company_code_id,user_id" }
  );
  await client
    .from("company_codes")
    .update({ used_count: Number(codeRow.used_count ?? 0) + 1 })
    .eq("id", codeRow.id);

  return { member, companyId: codeRow.company_id };
}
