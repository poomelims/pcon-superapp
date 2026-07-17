"use client";

import { usePathname } from "next/navigation";

export function GlobalScrollControls() {
  const pathname = usePathname();
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

  if (pathname === "/") {
    return null;
  }

  const buttonClassName =
    "grid h-10 w-10 place-items-center rounded-full border border-emerald-100 bg-white/95 text-base font-black text-emerald-800 shadow-[0_14px_30px_rgba(15,23,42,0.16)] backdrop-blur transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:h-12 sm:w-12 sm:text-xl";

  return (
    <div
      className="fixed bottom-6 right-24 z-30 hidden gap-2 lg:grid"
      aria-label="Page scroll controls"
    >
      <button
        type="button"
        aria-label="ขึ้นบนสุด"
        title="ขึ้นบนสุด"
        className={buttonClassName}
        onClick={scrollToTop}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="ลงล่างสุด"
        title="ลงล่างสุด"
        className={buttonClassName}
        onClick={scrollToBottom}
      >
        ↓
      </button>
    </div>
  );
}
