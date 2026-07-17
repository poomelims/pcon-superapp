"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PconReferenceMark } from "../components/pcon-reference-mark";
import { landingNavItems } from "./content";

export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-950/8 bg-white/95 shadow-[0_6px_22px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="relative mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-xl pr-2 text-slate-950" aria-label="PCON Project Control หน้าแรก">
          <PconReferenceMark className="h-9 w-9 shrink-0" />
          <span className="leading-none">
            <span className="font-heading block text-[17px] font-semibold tracking-[-0.02em]">PCON</span>
            <span className="mt-1 block text-[9px] font-bold tracking-[0.13em] text-slate-500">PROJECT CONTROL</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="เมนู Landing Page">
          {landingNavItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 transition duration-200 hover:bg-emerald-50 hover:text-emerald-800">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-emerald-800 transition duration-200 hover:bg-emerald-50">
            เข้าสู่ระบบ
          </Link>
          <Link href="/register" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(6,95,70,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-900">
            เริ่มใช้งานฟรี
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          data-testid="landing-mobile-menu-button"
          aria-label={isMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={isMenuOpen}
          aria-controls="landing-mobile-menu"
          className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm lg:hidden"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span className="relative block h-5 w-6" aria-hidden="true">
            <span className={`absolute left-0 top-0.5 h-0.5 w-6 rounded bg-current transition duration-200 ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`absolute left-0 top-2.5 h-0.5 w-6 rounded bg-current transition duration-200 ${isMenuOpen ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 top-[18px] h-0.5 w-6 rounded bg-current transition duration-200 ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </span>
        </button>

        <nav
          id="landing-mobile-menu"
          data-testid="landing-mobile-menu"
          aria-label="เมนู Landing Page บนมือถือ"
          className={`${isMenuOpen ? "grid" : "hidden"} absolute inset-x-4 top-[calc(100%+8px)] gap-2 rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.15)] lg:hidden`}
        >
          {landingNavItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMenu} className="flex min-h-11 items-center rounded-xl px-4 text-base font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800">
              {item.label}
            </Link>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <Link href="/login" onClick={closeMenu} className="grid min-h-11 place-items-center rounded-xl border border-emerald-100 text-sm font-bold text-emerald-800">
              เข้าสู่ระบบ
            </Link>
            <Link href="/register" onClick={closeMenu} className="grid min-h-11 place-items-center rounded-xl bg-emerald-800 px-3 text-center text-sm font-bold text-white">
              เริ่มใช้งานฟรี
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
