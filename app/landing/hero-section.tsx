import Link from "next/link";

import { ProductPreview } from "./product-preview";

export function HeroSection() {
  return (
    <section id="overview" className="landing-drafting-grid scroll-mt-24 overflow-hidden border-b border-emerald-950/8 bg-[radial-gradient(circle_at_82%_14%,rgba(52,211,153,0.18),transparent_28%),linear-gradient(135deg,#fbfdfb,#eef5f0)]">
      <div className="mx-auto grid w-full max-w-[1440px] items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:px-10 lg:py-24 xl:gap-16">
        <div className="relative z-10 max-w-2xl">
          <p className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 sm:text-sm">
            <span className="h-0.5 w-8 rounded-full bg-emerald-500" aria-hidden="true" />
            สร้างเพื่อทีมก่อสร้างไทย
          </p>
          <h1 className="font-heading mt-6 text-[2.65rem] font-semibold leading-[1.12] tracking-[-0.035em] text-slate-950 sm:text-6xl lg:text-[4.25rem]">
            รู้ทุกไซต์
            <br />
            <span className="text-emerald-700">คุมทุกงาน</span>
            <br />
            จบในที่เดียว
          </h1>
          <p className="mt-6 max-w-xl text-base font-medium leading-8 text-slate-600 sm:text-lg sm:leading-9">
            PCON รวม Project, BOQ และ Daily Report ไว้ในระบบเดียว ให้ทีมหน้างานและออฟฟิศเห็นข้อมูลตรงกัน ตัดสินใจเร็วขึ้นทุกวัน
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-800 px-6 text-base font-black text-white shadow-[0_14px_30px_rgba(6,95,70,0.23)] transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-900">
              เริ่มใช้งานฟรี
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
            <Link href="#workflow" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-emerald-800/35 bg-white/90 px-6 text-base font-black text-emerald-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-white">
              ดูระบบทำงาน
              <span className="ml-2 grid h-6 w-6 place-items-center rounded-full border border-emerald-800/30 text-[10px]" aria-hidden="true">▶</span>
            </Link>
          </div>
          <p className="mt-5 text-sm font-semibold leading-6 text-slate-500">ใช้งานง่ายทั้งมือถือและคอมพิวเตอร์ · เริ่มจากงานจริงของทีมคุณ</p>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-3xl lg:max-w-none">
          <div className="absolute -inset-5 -z-10 rounded-[40px] bg-emerald-300/10 blur-2xl" aria-hidden="true" />
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
