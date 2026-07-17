import Link from "next/link";

import { audiences, trustPoints } from "./content";
import { LandingIcon } from "./landing-icons";

function DailyPhonePreview() {
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[38px] border-[8px] border-slate-950 bg-white p-3 shadow-[0_30px_70px_rgba(15,23,42,0.24)]">
      <div className="mx-auto h-1.5 w-16 rounded-full bg-slate-900" />
      <div className="mt-4 flex items-center justify-between"><div><p className="text-[10px] font-black text-slate-900">Daily Report</p><p className="text-[8px] text-slate-400">โครงการบ้านสุขุมวิท</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700">วันนี้</span></div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center"><div className="rounded-lg bg-emerald-50 p-2"><strong className="block text-sm text-slate-900">24</strong><span className="text-[7px] text-slate-500">คนเข้าไซต์</span></div><div className="rounded-lg bg-emerald-50 p-2"><strong className="block text-sm text-slate-900">4</strong><span className="text-[7px] text-slate-500">งานเสร็จ</span></div><div className="rounded-lg bg-amber-50 p-2"><strong className="block text-sm text-amber-700">3</strong><span className="text-[7px] text-amber-600">ต้องตาม</span></div></div>
      <div className="mt-3 grid gap-2">{["สรุปงานวันนี้", "งานที่ทำเสร็จ", "ปัญหา / Blocker", "แผนงานพรุ่งนี้"].map((label, index) => <div key={label} className={`rounded-xl border px-3 py-3 text-[9px] font-bold ${index === 2 ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"}`}><span className="flex items-center justify-between"><span>{label}</span><span aria-hidden="true">›</span></span>{index === 0 ? <span className="mt-2 block h-1.5 w-4/5 rounded-full bg-slate-100" /> : null}</div>)}</div>
      <div className="mt-3 grid min-h-11 place-items-center rounded-xl bg-emerald-800 text-[10px] font-black text-white">บันทึกรายงาน</div>
    </div>
  );
}

export function MobileFirstSection() {
  const benefits = [
    { title: "ออกแบบเพื่อมือถือ", detail: "ปุ่มใหญ่ อ่านง่าย และเริ่มกรอกได้ทันที", icon: "mobile" as const },
    { title: "กลับมาทำงานต่อได้", detail: "ข้อมูลในเครื่องยังอยู่หลัง Refresh", icon: "refresh" as const },
    { title: "สำรองและย้ายข้อมูล", detail: "Import / Export ด้วยไฟล์ JSON", icon: "transfer" as const }
  ];

  return (
    <section className="bg-white">
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-10 lg:py-24">
        <DailyPhonePreview />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Field first</p>
          <h2 className="font-heading mt-3 max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">สร้างมาเพื่อหน้างาน ไม่ใช่แค่โต๊ะทำงาน</h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">PCON ลดขั้นตอนที่ไม่จำเป็น ให้ผู้ควบคุมไซต์บันทึกสิ่งสำคัญได้เร็ว และให้ออฟฟิศเห็นข้อมูลชุดเดียวกัน</p>
          <div className="mt-8 grid gap-3">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-[#fbfdfc] p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><LandingIcon name={benefit.icon} className="h-5 w-5" /></span>
                <div><h3 className="text-base font-black text-slate-900">{benefit.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{benefit.detail}</p></div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AudienceSection() {
  return (
    <section id="audience" className="scroll-mt-24 border-y border-slate-200 bg-[#f5f7f4]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Built for real teams</p><h2 className="font-heading mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">เหมาะกับทีมที่ต้องคุมงานจริงทุกวัน</h2></div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[28px] border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((audience) => (
            <article key={audience.title} className="bg-white p-6 text-center transition duration-200 hover:bg-emerald-50/60">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><LandingIcon name={audience.icon} className="h-7 w-7" /></span>
              <h3 className="font-heading mt-5 text-lg font-semibold text-slate-950">{audience.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{audience.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Trust by behavior</p><h2 className="font-heading mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">เรียบง่าย แต่เชื่อถือได้</h2></div><p className="max-w-xl text-base leading-8 text-slate-600">ความมั่นใจมาจากสิ่งที่ระบบทำได้จริง ไม่ใช่คำโฆษณาหรือสถิติที่ตรวจสอบไม่ได้</p></div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {trustPoints.map((point) => (
            <article key={point.title} className="border-l-4 border-emerald-500 bg-emerald-50/55 p-5">
              <LandingIcon name={point.icon} className="h-6 w-6 text-emerald-700" />
              <h3 className="mt-4 text-base font-black text-slate-900">{point.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{point.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="bg-emerald-950 text-white">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center px-4 py-16 text-center sm:px-6 lg:px-10 lg:py-20">
        <LandingIcon name="shield" className="h-10 w-10 text-emerald-300" />
        <h2 className="font-heading mt-5 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">พร้อมเห็นทุกไซต์ให้ชัดขึ้นหรือยัง?</h2>
        <p className="mt-4 text-base leading-8 text-emerald-50/75">เริ่มจัดการ Project, BOQ และ Daily Report ในที่เดียว</p>
        <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
          <Link href="/register" className="grid min-h-12 place-items-center rounded-2xl bg-white px-5 font-black text-emerald-900 shadow-[0_14px_30px_rgba(0,0,0,0.15)] transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-50">เริ่มใช้งาน PCON</Link>
          <Link href="/login" className="grid min-h-12 place-items-center rounded-2xl border border-white/25 px-5 font-black text-white transition duration-200 hover:bg-white/10">เข้าสู่ระบบ</Link>
        </div>
      </div>
    </section>
  );
}
