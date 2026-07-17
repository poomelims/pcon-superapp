"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { validateRegisterInput } from "@/lib/auth-platform";
import { getSupabaseClient } from "@/lib/supabase/client";

type Notice = { type: "success" | "error" | "info"; text: string } | null;

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const parsed = validateRegisterInput({ email, password, confirmPassword, displayName, phone });
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("ยังไม่ได้ตั้งค่า Supabase public env สำหรับ Register");
      }

      const { error } = await supabase.auth.signUp({
        email: parsed.email,
        password: parsed.password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            display_name: parsed.displayName,
            phone: parsed.phone
          }
        }
      });

      if (error) {
        throw error;
      }

      setNotice({ type: "success", text: "สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลก่อนเข้าใช้งาน" });
      window.setTimeout(() => {
        window.location.assign(`/verify-email?email=${encodeURIComponent(parsed.email)}`);
      }, 600);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "สมัครสมาชิกไม่สำเร็จ" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef5ef] px-5 py-8 text-slate-950">
      <section className="mx-auto max-w-2xl rounded-[32px] border border-emerald-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Create Account</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">สมัครสมาชิก</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">ใช้ Gmail หรืออีเมลธุรกิจของคุณ ระบบจะส่งอีเมลยืนยันก่อนเริ่มใช้งาน</p>

        {notice ? (
          <div
            className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${
              notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            Email
            <input className="min-h-12 rounded-2xl border border-slate-200 px-4" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            ชื่อผู้ใช้งาน
            <input className="min-h-12 rounded-2xl border border-slate-200 px-4" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            เบอร์โทร optional
            <input className="min-h-12 rounded-2xl border border-slate-200 px-4" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            Password
            <input className="min-h-12 rounded-2xl border border-slate-200 px-4" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            Confirm Password
            <input
              className="min-h-12 rounded-2xl border border-slate-200 px-4"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button disabled={isSubmitting} className="min-h-12 rounded-2xl bg-emerald-800 px-4 font-black text-white disabled:bg-slate-300">
            {isSubmitting ? "Please wait..." : "สมัครสมาชิก"}
          </button>
        </form>

        <Link href="/login" className="mt-5 inline-block text-sm font-black text-emerald-800 hover:underline">
          มีบัญชีแล้ว เข้าสู่ระบบ
        </Link>
      </section>
    </main>
  );
}
