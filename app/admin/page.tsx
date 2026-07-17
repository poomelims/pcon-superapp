"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ACCESS_SECTION_LABELS, ACCESS_SECTIONS, DEFAULT_ROLE_ACCESS, MEMBER_ROLES, type AccessSection, type MemberRole } from "@/lib/access-control";
import { getSupabaseClient } from "@/lib/supabase/client";

type Notice = { type: "success" | "error" | "info"; text: string } | null;

type AdminMember = {
  id: string;
  companyId: string;
  loginId: string;
  displayName: string;
  phone: string;
  role: MemberRole;
  accessSections: AccessSection[];
  projectIds: string[];
  status: "active" | "disabled" | "invited";
};

type AdminProject = {
  id: string;
  name: string;
};

type AdminCompany = {
  id: string;
  name: string;
};

type PlatformDashboard = {
  summary: {
    pendingRequests: number;
    approvedCompanies: number;
    totalUsers: number;
    activeCodes: number;
  };
  requests: Array<{
    id: string;
    company_name: string;
    requester_email: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    status: string;
    created_at: string;
  }>;
  companies: Array<{ id: string; name: string; status: string | null; owner_user_id: string | null; created_at: string }>;
  users: Array<{ id: string; email: string | null; display_name: string | null; phone: string | null; status: string | null; created_at: string }>;
  codes: Array<{ id: string; company_id: string; code: string; default_role: string; status: string; used_count: number; max_uses: number | null }>;
};

const defaultCompanyId = "local-company-owner";

function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary: "bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-300",
    secondary: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
  };

  return (
    <button
      {...props}
      className={`min-h-11 rounded-2xl px-4 text-sm font-black shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition focus:outline-none focus:ring-2 focus:ring-slate-200 ${variants[variant]} ${className}`}
    />
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-100 ${props.className ?? ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-100 ${props.className ?? ""}`}
    />
  );
}

function sectionDefaults(role: MemberRole): AccessSection[] {
  return DEFAULT_ROLE_ACCESS[role];
}

const quickFunctionSections: AccessSection[] = ["hr", "buyin"];

function FunctionAccessToggles({
  accessSections,
  onToggle,
  disabled = false
}: {
  accessSections: AccessSection[];
  onToggle: (section: AccessSection) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Function Access</p>
          <p className="mt-1 text-xs font-bold text-emerald-900">เลือกให้ user ใช้ HR / BUYIN ได้โดยตรง</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
          {quickFunctionSections.map((section) => {
            const active = accessSections.includes(section);
            const tone = section === "hr" ? "emerald" : section === "buyin" ? "teal" : "slate";

            return (
              <button
                key={section}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(section)}
                className={`min-h-10 rounded-2xl border px-4 text-xs font-black transition disabled:opacity-50 ${
                  active
                    ? tone === "emerald"
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-teal-700 bg-teal-700 text-white"
                    : "border-white bg-white text-slate-700 hover:border-emerald-200"
                }`}
              >
                {active ? "เปิด" : "ปิด"} {ACCESS_SECTION_LABELS[section]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [role, setRole] = useState<MemberRole>("site_supervisor");
  const [accessSections, setAccessSections] = useState<AccessSection[]>(sectionDefaults("site_supervisor"));
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [setupToken, setSetupToken] = useState("");
  const [platformData, setPlatformData] = useState<PlatformDashboard | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{ title: string; rows: Array<[string, string]> } | null>(null);

  const hasMembers = members.length > 0;
  const isBootstrap = !isLoading && !canManage && !hasMembers;

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

    return data.session?.access_token
      ? {
          authorization: `Bearer ${data.session.access_token}`
        }
      : {};
  }, []);

  const apiFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = await authHeaders();

    return fetch(path, {
      ...init,
      headers: {
        ...headers,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init.headers as Record<string, string> | undefined))
      }
    });
  }, [authHeaders]);

  const loadMembersForCompany = useCallback(async (requestedCompanyId: string) => {
    setIsLoading(true);

    try {
      const meResponse = await apiFetch("/api/admin/me");
      const me = (await meResponse.json().catch(() => ({}))) as { canManageMembers?: boolean };
      setCanManage(Boolean(me.canManageMembers));

      if (me.canManageMembers) {
        const companiesResponse = await apiFetch("/api/admin/companies");
        const companiesResult = (await companiesResponse.json().catch(() => ({}))) as { companies?: AdminCompany[]; error?: string };

        if (!companiesResponse.ok) {
          throw new Error(companiesResult.error ?? "โหลดบริษัทไม่สำเร็จ");
        }

        const loadedCompanies = companiesResult.companies ?? [];
        const nextCompanyId =
          requestedCompanyId && loadedCompanies.some((company) => company.id === requestedCompanyId)
            ? requestedCompanyId
            : loadedCompanies[0]?.id ?? defaultCompanyId;

        setCompanies(loadedCompanies);
        setSelectedCompanyId(nextCompanyId);

        const response = await apiFetch(`/api/admin/members?companyId=${encodeURIComponent(nextCompanyId)}`);
        const result = (await response.json().catch(() => ({}))) as { members?: AdminMember[]; error?: string };
        const projectsResponse = await apiFetch(`/api/admin/projects?companyId=${encodeURIComponent(nextCompanyId)}`);
        const projectsResult = (await projectsResponse.json().catch(() => ({}))) as { projects?: AdminProject[]; error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "โหลดสมาชิกไม่สำเร็จ");
        }

        if (!projectsResponse.ok) {
          throw new Error(projectsResult.error ?? "โหลด Project ไม่สำเร็จ");
        }

        setMembers(result.members ?? []);
        setProjects(projectsResult.projects ?? []);
      } else {
        setCompanies([]);
        setMembers([]);
        setProjects([]);
      }
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "โหลด Admin ไม่สำเร็จ" });
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  const loadPlatformDashboard = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/platform");
      const result = (await response.json().catch(() => ({}))) as PlatformDashboard & { error?: string };

      if (!response.ok) {
        return;
      }

      setPlatformData(result);
    } catch {
      setPlatformData(null);
    }
  }, [apiFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMembersForCompany(defaultCompanyId);
      void loadPlatformDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadMembersForCompany, loadPlatformDashboard]);

  async function approveRequest(requestId: string) {
    setIsSaving(true);
    setNotice({ type: "info", text: "กำลังอนุมัติบริษัท..." });

    try {
      const response = await apiFetch(`/api/admin/company-requests/${encodeURIComponent(requestId)}/approve`, { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "อนุมัติบริษัทไม่สำเร็จ");
      }
      setNotice({ type: "success", text: "อนุมัติบริษัทแล้ว และสร้างรหัสบริษัทแล้ว" });
      await loadPlatformDashboard();
      await loadMembersForCompany(selectedCompanyId);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "อนุมัติบริษัทไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  }

  async function rejectRequest(requestId: string) {
    const reviewNote = window.prompt("เหตุผลที่ปฏิเสธ optional") ?? "";
    setIsSaving(true);

    try {
      const response = await apiFetch(`/api/admin/company-requests/${encodeURIComponent(requestId)}/reject`, {
        method: "POST",
        body: JSON.stringify({ reviewNote })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "ปฏิเสธคำขอไม่สำเร็จ");
      }
      setNotice({ type: "success", text: "ปฏิเสธคำขอแล้ว" });
      await loadPlatformDashboard();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "ปฏิเสธคำขอไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  }

  async function generateCode(companyId: string) {
    setIsSaving(true);

    try {
      const response = await apiFetch("/api/admin/company-codes", {
        method: "POST",
        body: JSON.stringify({ companyId, defaultRole: "site_supervisor" })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "สร้างรหัสบริษัทไม่สำเร็จ");
      }
      setNotice({ type: "success", text: "สร้างรหัสบริษัทแล้ว" });
      await loadPlatformDashboard();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "สร้างรหัสบริษัทไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSection(section: AccessSection) {
    setAccessSections((current) =>
      current.includes(section) ? current.filter((entry) => entry !== section) : [...current, section]
    );
  }

  function toggleProject(projectId: string) {
    setProjectIds((current) =>
      current.includes(projectId) ? current.filter((entry) => entry !== projectId) : [...current, projectId]
    );
  }

  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice({ type: "info", text: "กำลังสร้างบริษัท..." });

    try {
      const response = await apiFetch("/api/admin/companies", {
        method: "POST",
        body: JSON.stringify({ name: newCompanyName })
      });
      const result = (await response.json().catch(() => ({}))) as { company?: AdminCompany; error?: string };

      if (!response.ok || !result.company) {
        throw new Error(result.error ?? "สร้างบริษัทไม่สำเร็จ");
      }

      setNewCompanyName("");
      setSelectedCompanyId(result.company.id);
      setNotice({ type: "success", text: `สร้างบริษัท ${result.company.name} แล้ว เลือกบริษัทนี้เพื่อเพิ่มพนักงานได้เลย` });
      await loadMembersForCompany(result.company.id);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "สร้างบริษัทไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice({ type: "info", text: isBootstrap ? "กำลังสร้าง Owner ID แรก..." : "กำลังสร้าง ID ใหม่..." });

    try {
      const response = await apiFetch("/api/admin/members", {
        method: "POST",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          loginId,
          password,
          displayName,
          phone: contactPhone,
          role,
          accessSections,
          projectIds,
          bootstrap: isBootstrap,
          setupToken: isBootstrap ? setupToken : undefined
        })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "สร้างสมาชิกไม่สำเร็จ");
      }

      setLoginId("");
      setPassword("");
      setDisplayName("");
      setContactPhone("");
      setSetupToken("");
      setProjectIds([]);
      setNotice({ type: "success", text: isBootstrap ? "สร้าง Owner ID แรกแล้ว ใช้ ID นี้ login ได้เลย" : "สร้าง ID สมาชิกแล้ว" });
      await loadMembersForCompany(selectedCompanyId);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "สร้างสมาชิกไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  }

  async function updateMember(member: AdminMember, patch: Partial<AdminMember> & { password?: string }) {
    setIsSaving(true);

    try {
      const response = await apiFetch("/api/admin/members", {
        method: "PATCH",
        body: JSON.stringify({
          id: member.id,
          companyId: selectedCompanyId,
          loginId: member.loginId,
          displayName: patch.displayName ?? member.displayName,
          phone: patch.phone ?? member.phone,
          role: patch.role ?? member.role,
          accessSections: patch.accessSections ?? member.accessSections,
          projectIds: patch.projectIds ?? member.projectIds,
          status: patch.status ?? member.status,
          password: patch.password
        })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "อัปเดตสมาชิกไม่สำเร็จ");
      }

      setNotice({ type: "success", text: "อัปเดตสมาชิกแล้ว" });
      await loadMembersForCompany(selectedCompanyId);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "อัปเดตสมาชิกไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMember(member: AdminMember) {
    if (!window.confirm(`ลบ/ปิดใช้งาน ID ${member.loginId}?`)) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await apiFetch(`/api/admin/members?id=${encodeURIComponent(member.id)}&companyId=${encodeURIComponent(selectedCompanyId)}`, {
        method: "DELETE"
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "ลบสมาชิกไม่สำเร็จ");
      }

      setNotice({ type: "success", text: "ลบ/ปิดใช้งานสมาชิกแล้ว" });
      await loadMembersForCompany(selectedCompanyId);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "ลบสมาชิกไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  }

  const noticeClasses = useMemo(() => {
    if (notice?.type === "success") {
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }
    if (notice?.type === "error") {
      return "border-red-200 bg-red-50 text-red-700";
    }
    return "border-sky-200 bg-sky-50 text-sky-800";
  }, [notice?.type]);

  const selectedCompanyName = companies.find((company) => company.id === selectedCompanyId)?.name ?? "บริษัทที่เลือก";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-[28px] bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Admin</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">ID & Access Control</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              เพิ่ม ลบ และกำหนดว่าแต่ละ Login ID เข้าใช้งานส่วนไหนของเว็บได้บ้าง
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/login" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10">
              Login
            </Link>
            <Link href="/project-setup" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10">
              Project
            </Link>
          </div>
        </header>

        {notice ? <div className={`mt-5 rounded-2xl border p-4 text-sm font-black ${noticeClasses}`}>{notice.text}</div> : null}

        {isBootstrap ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            ยังไม่มี Owner ID ในระบบ ให้สร้าง ID แรกโดยใช้ setup token ค่าเดียวกับ `PCON_CLOUD_SYNC_TOKEN`
          </div>
        ) : !canManage && !isLoading ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            ต้อง login ด้วย ID ที่มีสิทธิ์ Admin ก่อนจึงจะจัดการสมาชิกได้
          </div>
        ) : null}

        {platformData ? (
          <section className="mt-5 rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Platform Admin Dashboard</p>
                <h2 className="mt-1 text-2xl font-black">admin001 approval / company code</h2>
              </div>
              <Button type="button" variant="secondary" onClick={() => void loadPlatformDashboard()} disabled={isSaving}>
                Refresh Platform
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-black text-emerald-700">Pending requests</p>
                <p className="mt-2 text-3xl font-black">{platformData.summary.pendingRequests}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">Approved companies</p>
                <p className="mt-2 text-3xl font-black">{platformData.summary.approvedCompanies}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">Total users</p>
                <p className="mt-2 text-3xl font-black">{platformData.summary.totalUsers}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-black text-emerald-700">Active codes</p>
                <p className="mt-2 text-3xl font-black">{platformData.summary.activeCodes}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-lg font-black">Pending Company Requests</h3>
                <div className="mt-3 grid gap-2">
                  {platformData.requests.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-bold text-slate-500">ไม่มีคำขอใหม่</p>
                  ) : (
                    platformData.requests.map((request) => (
                      <article key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() =>
                            setSelectedDetail({
                              title: request.company_name,
                              rows: [
                                ["Requester", request.requester_email ?? "-"],
                                ["Contact", request.contact_name ?? "-"],
                                ["Phone", request.contact_phone ?? "-"],
                                ["Status", request.status]
                              ]
                            })
                          }
                        >
                          <p className="font-black">{request.company_name}</p>
                          <p className="text-sm font-bold text-slate-500">{request.requester_email}</p>
                        </button>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {request.status === "pending" ? (
                            <>
                              <Button type="button" onClick={() => void approveRequest(request.id)} disabled={isSaving}>
                                อนุมัติบริษัท
                              </Button>
                              <Button type="button" variant="danger" onClick={() => void rejectRequest(request.id)} disabled={isSaving}>
                                Reject
                              </Button>
                            </>
                          ) : (
                            <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600">{request.status}</span>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-lg font-black">Detail Panel</h3>
                {selectedDetail ? (
                  <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xl font-black">{selectedDetail.title}</p>
                    <div className="mt-3 grid gap-2 text-sm font-bold">
                      {selectedDetail.rows.map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3 rounded-xl bg-white px-3 py-2">
                          <span className="text-slate-500">{label}</span>
                          <span className="text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-bold text-slate-500">
                    Click user, company, or request to see details
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-black">Companies</h3>
                <div className="mt-3 grid gap-2">
                  {platformData.companies.map((company) => (
                    <article key={company.id} className="rounded-2xl bg-slate-50 p-3">
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() =>
                          setSelectedDetail({
                            title: company.name,
                            rows: [
                              ["Company ID", company.id],
                              ["Owner", company.owner_user_id ?? "-"],
                              ["Status", company.status ?? "-"]
                            ]
                          })
                        }
                      >
                        <p className="font-black">{company.name}</p>
                        <p className="truncate text-xs font-bold text-slate-500">{company.id}</p>
                      </button>
                      <Button type="button" variant="secondary" className="mt-2" onClick={() => void generateCode(company.id)} disabled={isSaving}>
                        สร้างรหัสบริษัท
                      </Button>
                    </article>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-black">Company Codes</h3>
                <div className="mt-3 grid gap-2">
                  {platformData.codes.map((code) => (
                    <button
                      key={code.id}
                      type="button"
                      className="rounded-2xl bg-emerald-50 p-3 text-left"
                      onClick={() =>
                        setSelectedDetail({
                          title: code.code,
                          rows: [
                            ["Company", code.company_id],
                            ["Role", code.default_role],
                            ["Status", code.status],
                            ["Uses", `${code.used_count}/${code.max_uses ?? "∞"}`]
                          ]
                        })
                      }
                    >
                      <p className="font-black text-emerald-900">{code.code}</p>
                      <p className="text-xs font-bold text-emerald-700">{code.status}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-black">Users</h3>
                <div className="mt-3 grid gap-2">
                  {platformData.users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="rounded-2xl bg-slate-50 p-3 text-left"
                      onClick={() =>
                        setSelectedDetail({
                          title: user.display_name ?? user.email ?? user.id,
                          rows: [
                            ["Email", user.email ?? "-"],
                            ["Phone", user.phone ?? "-"],
                            ["Status", user.status ?? "-"],
                            ["User ID", user.id]
                          ]
                        })
                      }
                    >
                      <p className="font-black">{user.display_name ?? user.email ?? "User"}</p>
                      <p className="truncate text-xs font-bold text-slate-500">{user.email}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="grid gap-3">
              <div>
                <p className="text-sm font-black text-slate-500">Company Workspace</p>
                <h2 className="text-xl font-black">เลือกบริษัท</h2>
              </div>
              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                บริษัทสำหรับการสร้าง user
                <Select
                  value={selectedCompanyId}
                  onChange={(event) => {
                    const nextCompanyId = event.target.value;
                    setSelectedCompanyId(nextCompanyId);
                    setProjectIds([]);
                    void loadMembersForCompany(nextCompanyId);
                  }}
                  disabled={!canManage || companies.length === 0}
                >
                  {companies.length === 0 ? <option value={defaultCompanyId}>ยังไม่มีบริษัทบน Cloud</option> : null}
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </Select>
              </label>
              <form className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3" onSubmit={handleCreateCompany}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">สร้างบริษัทใหม่</p>
                <TextInput value={newCompanyName} onChange={(event) => setNewCompanyName(event.target.value)} placeholder="นาราโรจน์" />
                <Button type="submit" variant="secondary" disabled={isSaving || !canManage || !newCompanyName.trim()}>
                  สร้างบริษัท
                </Button>
              </form>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
            <h2 className="text-xl font-black">เพิ่ม Login ID</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">เพิ่มพนักงานเข้า: {selectedCompanyName}</p>
            <form className="mt-4 grid gap-3" onSubmit={handleCreateMember}>
              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                Login ID
                <TextInput value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="SITE-A01" />
              </label>
              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                Password
                <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" />
              </label>
              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                Display Name
                <TextInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="หัวหน้าช่าง A" />
              </label>
              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                เบอร์ติดต่อ
                <TextInput value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="081-234-5678" />
              </label>
              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                Role
                <Select
                  value={role}
                  onChange={(event) => {
                    const nextRole = event.target.value as MemberRole;
                    setRole(nextRole);
                    setAccessSections(sectionDefaults(nextRole));
                  }}
                >
                  {MEMBER_ROLES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </Select>
              </label>
              {isBootstrap ? (
                <label className="grid gap-1.5 text-sm font-black text-slate-700">
                  Setup Token
                  <TextInput type="password" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} placeholder="PCON_CLOUD_SYNC_TOKEN" />
                </label>
              ) : null}
              <FunctionAccessToggles accessSections={accessSections} onToggle={toggleSection} disabled={isSaving || (!isBootstrap && !canManage)} />
              <div>
                <p className="text-sm font-black text-slate-700">Access Sections</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ACCESS_SECTIONS.map((section) => (
                    <label key={section} className="flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 px-3 text-xs font-black text-slate-700">
                      <input type="checkbox" checked={accessSections.includes(section)} onChange={() => toggleSection(section)} />
                      {ACCESS_SECTION_LABELS[section]}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-black text-slate-700">Project Access</p>
                <div className="mt-2 grid gap-2">
                  {projects.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                      ยังไม่มี Project บน Cloud ให้เลือก
                    </div>
                  ) : (
                    projects.map((project) => (
                      <label key={project.id} className="flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 px-3 text-xs font-black text-slate-700">
                        <input type="checkbox" checked={projectIds.includes(project.id)} onChange={() => toggleProject(project.id)} />
                        {project.name || project.id}
                      </label>
                    ))
                  )}
                </div>
              </div>
              <Button type="submit" disabled={isSaving || (!isBootstrap && !canManage)}>
                {isSaving ? "Saving..." : isBootstrap ? "Create First Owner ID" : "Create Member ID"}
              </Button>
            </form>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black">สมาชิกทั้งหมด</h2>
              <Button type="button" variant="secondary" onClick={() => void loadMembersForCompany(selectedCompanyId)} disabled={isLoading}>
                Refresh
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">Loading...</div>
              ) : members.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                  ยังไม่มีสมาชิก
                </div>
              ) : (
                members.map((member) => (
                  <MemberCard key={member.id} member={member} projects={projects} onUpdate={updateMember} onDelete={deleteMember} disabled={isSaving || !canManage} />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MemberCard({
  member,
  projects,
  onUpdate,
  onDelete,
  disabled
}: {
  member: AdminMember;
  projects: AdminProject[];
  onUpdate: (member: AdminMember, patch: Partial<AdminMember> & { password?: string }) => Promise<void>;
  onDelete: (member: AdminMember) => Promise<void>;
  disabled: boolean;
}) {
  const [displayName, setDisplayName] = useState(member.displayName);
  const [phone, setPhone] = useState(member.phone);
  const [role, setRole] = useState<MemberRole>(member.role);
  const [status, setStatus] = useState(member.status);
  const [accessSections, setAccessSections] = useState<AccessSection[]>(member.accessSections);
  const [projectIds, setProjectIds] = useState<string[]>(member.projectIds);
  const [password, setPassword] = useState("");

  function toggleSection(section: AccessSection) {
    setAccessSections((current) =>
      current.includes(section) ? current.filter((entry) => entry !== section) : [...current, section]
    );
  }

  function toggleProject(projectId: string) {
    setProjectIds((current) =>
      current.includes(projectId) ? current.filter((entry) => entry !== projectId) : [...current, projectId]
    );
  }

  return (
    <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 lg:grid-cols-[0.85fr_1fr_1fr_1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Login ID</p>
          <p className="mt-1 text-lg font-black text-slate-950">{member.loginId}</p>
        </div>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          Name
          <TextInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          เบอร์ติดต่อ
          <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="081-234-5678" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          Reset Password
          <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="เว้นว่างถ้าไม่เปลี่ยน" />
        </label>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          Role
          <Select value={role} onChange={(event) => setRole(event.target.value as MemberRole)}>
            {MEMBER_ROLES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          Status
          <Select value={status} onChange={(event) => setStatus(event.target.value as AdminMember["status"])}>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </Select>
        </label>
      </div>
      <div className="mt-3">
        <FunctionAccessToggles accessSections={accessSections} onToggle={toggleSection} disabled={disabled} />
      </div>
      <div className="mt-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Access Sections</p>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {ACCESS_SECTIONS.map((section) => (
            <label key={section} className="flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">
              <input type="checkbox" checked={accessSections.includes(section)} onChange={() => toggleSection(section)} />
              {ACCESS_SECTION_LABELS[section]}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Project Access</p>
        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-xs font-bold text-slate-500">
              ยังไม่มี Project บน Cloud
            </div>
          ) : (
            projects.map((project) => (
              <label key={project.id} className="flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">
                <input type="checkbox" checked={projectIds.includes(project.id)} onChange={() => toggleProject(project.id)} />
                {project.name || project.id}
              </label>
            ))
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={disabled}
          onClick={() => onUpdate(member, { displayName, phone, role, status, accessSections, projectIds, password: password || undefined })}
        >
          Save
        </Button>
        <Button type="button" variant="danger" disabled={disabled} onClick={() => onDelete(member)}>
          Delete
        </Button>
      </div>
    </article>
  );
}
