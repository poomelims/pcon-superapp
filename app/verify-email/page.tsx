"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase/client";

type Notice = { type: "success" | "error" | "info"; text: string } | null;

export default function VerifyEmailPage() {
  const initialEmail = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return new URLSearchParams(window.location.search).get("email") ?? "";
  }, []);
  const [email, setEmail] = useState(initialEmail);
  const [notice, setNotice] = useState<Notice>({ type: "info", text: "กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      setNotice({ type: "error", text: "ยังไม่ได้ตั้งค่า Supabase public env" });
      return;
    }
    if (!email.trim()) {
      setNotice({ type: "error", text: "กรุณากรอกอีเมล" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/onboarding` }
      });
      if (error) {
        throw error;
      }
      setNotice({ type: "success", text: "ส่งอีเมลยืนยันอีกครั้งแล้ว" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "ส่งอีเมลยืนยันไม่สำเร็จ" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#eef5ef] px-5 py-8 text-slate-950">
      <section className="w-full max-w-xl rounded-[32px] border border-emerald-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Email Verification</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">ยืนยันอีเมล</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">กรุณายืนยันอีเมลของคุณก่อนใช้งานระบบ หากยังไม่ได้รับอีเมลสามารถส่งใหม่ได้</p>

        {notice ? (
          <div className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${notice.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {notice.text}
          </div>
        ) : null}

        <form className="mt-6 grid gap-3" onSubmit={resend}>
          <input
            type="email"
            className="min-h-12 rounded-2xl border border-slate-200 px-4"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@gmail.com"
          />
          <button disabled={isSubmitting} className="min-h-12 rounded-2xl bg-emerald-800 px-4 font-black text-white disabled:bg-slate-300">
            {isSubmitting ? "Please wait..." : "ส่งอีเมลยืนยันอีกครั้ง"}
          </button>
        </form>

        <div className="mt-5 flex gap-3 text-sm font-black text-emerald-800">
          <Link href="/login">กลับไป Login</Link>
          <Link href="/onboarding">ไป Onboarding</Link>
        </div>
      </section>
    </main>
  );
}
