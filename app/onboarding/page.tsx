"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase/client";

type Notice = { type: "success" | "error" | "info"; text: string } | null;

export default function OnboardingPage() {
  const [notice, setNotice] = useState<Notice>(null);
  const [code, setCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [note, setNote] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session?.access_token) {
        window.location.assign("/login");
        return;
      }
      setToken(session.access_token);
      setContactEmail(session.user.email ?? "");

      const statusResponse = await fetch("/api/auth/session-status", {
        headers: { authorization: `Bearer ${session.access_token}` }
      });
      const status = (await statusResponse.json().catch(() => ({}))) as { emailVerified?: boolean; memberships?: unknown[] };
      if (!status.emailVerified) {
        window.location.assign(`/verify-email?email=${encodeURIComponent(session.user.email ?? "")}`);
      } else if (status.memberships && status.memberships.length > 0) {
        window.location.assign("/project-setup");
      }
    });
  }, []);

  async function joinCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setNotice({ type: "error", text: "กรุณา Login ก่อน" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/company-codes/redeem", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ code })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "เข้าร่วมบริษัทไม่สำเร็จ");
      }
      setNotice({ type: "success", text: "เข้าร่วมบริษัทสำเร็จ กำลังเปิด Dashboard..." });
      window.setTimeout(() => window.location.assign("/project-setup"), 400);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "เข้าร่วมบริษัทไม่สำเร็จ" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setNotice({ type: "error", text: "กรุณา Login ก่อน" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/company-requests", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ companyName, contactName, contactPhone, contactEmail, companyTaxId, note })
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "ส่งคำขอสร้างบริษัทไม่สำเร็จ");
      }
      setNotice({ type: "success", text: "คำขอสร้างบริษัทของคุณกำลังรอการอนุมัติจาก admin" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "ส่งคำขอสร้างบริษัทไม่สำเร็จ" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef5ef] px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Onboarding</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">เริ่มใช้งานบริษัท</h1>
          </div>
          <Link href="/login" className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-black text-emerald-800">
            Login
          </Link>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          พบข้อมูล Local Draft เดิม คุณสามารถ Export เก็บไว้ หรือ Sync เข้าบริษัทภายหลัง ข้อมูล local จะไม่ถูกลบอัตโนมัติ
        </div>

        {notice ? (
          <div className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${notice.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {notice.text}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <form className="rounded-[32px] border border-emerald-100 bg-white p-6 shadow-sm" onSubmit={joinCompany}>
            <h2 className="text-2xl font-black">เข้าร่วมบริษัทด้วยรหัส</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">กรอก Company Code ที่บริษัทให้มา เช่น PCON-8G4K-2M9Q</p>
            <input className="mt-5 min-h-12 w-full rounded-2xl border border-slate-200 px-4 font-black uppercase" value={code} onChange={(event) => setCode(event.target.value)} />
            <button disabled={isSubmitting} className="mt-4 min-h-12 w-full rounded-2xl bg-emerald-800 px-4 font-black text-white disabled:bg-slate-300">
              เข้าร่วมบริษัท
            </button>
          </form>

          <form className="rounded-[32px] border border-emerald-100 bg-white p-6 shadow-sm" onSubmit={requestCompany}>
            <h2 className="text-2xl font-black">ขอสร้างบริษัท</h2>
            <div className="mt-5 grid gap-3">
              <input className="min-h-12 rounded-2xl border border-slate-200 px-4" placeholder="ชื่อบริษัท" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
              <input className="min-h-12 rounded-2xl border border-slate-200 px-4" placeholder="ชื่อผู้ติดต่อ" value={contactName} onChange={(event) => setContactName(event.target.value)} />
              <input className="min-h-12 rounded-2xl border border-slate-200 px-4" placeholder="เบอร์โทร" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
              <input className="min-h-12 rounded-2xl border border-slate-200 px-4" placeholder="อีเมลติดต่อ" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              <input className="min-h-12 rounded-2xl border border-slate-200 px-4" placeholder="เลขผู้เสียภาษี optional" value={companyTaxId} onChange={(event) => setCompanyTaxId(event.target.value)} />
              <textarea className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3" placeholder="หมายเหตุ" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <button disabled={isSubmitting} className="mt-4 min-h-12 w-full rounded-2xl bg-slate-950 px-4 font-black text-white disabled:bg-slate-300">
              ส่งคำขอสร้างบริษัท
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
