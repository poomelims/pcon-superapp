import Link from "next/link";

import { PconReferenceMark } from "../components/pcon-reference-mark";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#071f1a] text-emerald-50/70">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="flex items-center gap-3"><PconReferenceMark className="h-9 w-9" /><div><p className="font-heading font-semibold leading-none text-white">PCON</p><p className="mt-1 text-[10px] font-bold tracking-[0.12em]">PROJECT CONTROL</p></div></div>
        <nav aria-label="เมนูส่วนท้าย" className="flex flex-wrap gap-x-5 text-sm font-bold">
          <Link href="#features" className="inline-flex min-h-11 items-center hover:text-white">ฟีเจอร์</Link>
          <Link href="#audience" className="inline-flex min-h-11 items-center hover:text-white">เหมาะกับใคร</Link>
          <Link href="/login" className="inline-flex min-h-11 items-center hover:text-white">เข้าสู่ระบบ</Link>
          <Link href="/register" className="inline-flex min-h-11 items-center hover:text-white">สมัครใช้งาน</Link>
        </nav>
        <p className="text-xs">© {new Date().getFullYear()} PCON Project Control</p>
      </div>
    </footer>
  );
}
