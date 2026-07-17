"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { clearLocalDevSession, loadLocalDevSession } from "@/lib/local-dev-auth";
import { getSupabaseClient, isLocalDevBypassEnabled } from "@/lib/supabase/client";

type Notice = { type: "success" | "error" | "info"; text: string } | null;

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-12 rounded-2xl bg-emerald-800 px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(6,95,70,0.18)] transition hover:bg-emerald-900 disabled:bg-slate-300 ${props.className ?? ""}`}
    />
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [localSessionLoginId, setLocalSessionLoginId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : loadLocalDevSession()?.loginId ?? null
  );

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function routeAfterLogin(accessToken: string) {
    const response = await fetch("/api/auth/session-status", {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    const status = (await response.json().catch(() => ({}))) as {
      error?: string;
      emailVerified?: boolean;
      memberships?: unknown[];
      isPlatformAdmin?: boolean;
    };

    if (!response.ok) {
      throw new Error(status.error ? `ตรวจสอบสถานะบัญชีไม่สำเร็จ: ${status.error}` : "ตรวจสอบสถานะบัญชีไม่สำเร็จ");
    }

    if (!status.emailVerified) {
      window.location.assign(`/verify-email?email=${encodeURIComponent(email)}`);
      return;
    }

    if (!status.isPlatformAdmin && (!status.memberships || status.memberships.length === 0)) {
      window.location.assign("/onboarding");
      return;
    }

    window.location.assign("/project-setup");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setNotice({ type: "error", text: "กรุณากรอกอีเมลและรหัสผ่าน" });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setNotice({ type: "error", text: "ยังไม่ได้ตั้งค่า Supabase public env สำหรับ Login" });
      return;
    }

    setIsSubmitting(true);
    setNotice({ type: "info", text: "กำลังเข้าสู่ระบบ..." });

    try {
      clearLocalDevSession();
      setLocalSessionLoginId(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        const message = error.message.toLowerCase().includes("email not confirmed")
          ? "บัญชียังไม่ได้ยืนยันอีเมล"
          : "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        throw new Error(message);
      }

      if (!data.session?.access_token) {
        throw new Error("Login ไม่สำเร็จ");
      }

      setNotice({ type: "success", text: "เข้าสู่ระบบสำเร็จ" });
      await routeAfterLogin(data.session.access_token);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Login ไม่สำเร็จ" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    clearLocalDevSession();
    setSessionEmail(null);
    setLocalSessionLoginId(null);
    setNotice({ type: "success", text: "ออกจากระบบแล้ว" });
  }

  function handleLocalBypass() {
    window.location.assign("/project-setup");
  }

  return (
    <main className="min-h-screen bg-[#eef5ef] px-5 py-8 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[32px] bg-emerald-950 p-7 text-white shadow-[0_24px_70px_rgba(6,78,59,0.25)]">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-xl font-black text-emerald-900">PC</div>
          <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-5xl">PCON Project Control</h1>
          <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-emerald-50">
            เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน เพื่อใช้งานบริษัท โปรเจกต์ Daily Report, HR และ BUYIN บน Cloud อย่างปลอดภัย
          </p>
          <div className="mt-8 grid gap-3 text-sm font-bold text-emerald-50">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Supabase Auth เป็นผู้จัดการ password</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">ยืนยันอีเมลก่อนเข้า workspace</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">ไม่มี service role key ใน frontend</div>
          </div>
        </section>

        <section className="rounded-[32px] border border-emerald-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Email Login</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">เข้าสู่ระบบ</h2>
            </div>
            <div className="flex gap-2">
              <Link href="/register" className="rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-black text-emerald-800 shadow-sm hover:bg-emerald-50">
                สมัครสมาชิก
              </Link>
              <Link href="/admin" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
                Admin
              </Link>
            </div>
          </div>

          {sessionEmail || localSessionLoginId ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              Logged in {sessionEmail || localSessionLoginId}
            </div>
          ) : null}

          {isLocalDevBypassEnabled ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-bold">Local Dev Bypass สำหรับเครื่อง dev เมื่อยังไม่ได้ตั้งค่า Supabase</p>
                <button type="button" className="min-h-11 rounded-2xl border border-amber-200 bg-white px-4 font-black" onClick={handleLocalBypass}>
                  เข้า local workspace
                </button>
              </div>
            </div>
          ) : null}

          {notice ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : notice.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-sky-200 bg-sky-50 text-sky-800"
              }`}
            >
              {notice.text}
            </div>
          ) : null}

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-12 rounded-2xl border border-slate-200 px-4 text-base font-semibold text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                placeholder="you@gmail.com"
                autoComplete="email"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-12 rounded-2xl border border-slate-200 px-4 text-base font-semibold text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                placeholder="รหัสผ่าน"
                autoComplete="current-password"
              />
            </label>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : "Login"}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/verify-email" className="text-emerald-800 hover:underline">
              ยืนยันอีเมล / ส่งใหม่
            </Link>
            <Link href="/onboarding" className="text-emerald-800 hover:underline">
              เข้าร่วมบริษัท
            </Link>
          </div>

          {sessionEmail || localSessionLoginId ? (
            <button type="button" className="mt-3 min-h-12 w-full rounded-2xl border border-slate-200 font-black" onClick={handleSignOut}>
              Sign Out
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
