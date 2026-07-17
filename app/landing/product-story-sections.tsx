import { siteQuestions } from "./content";
import { LandingIcon } from "./landing-icons";

function ProjectModulePreview() {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
      <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-black text-slate-700">โครงการที่กำลังดำเนินการ</span><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-emerald-700">3 โครงการ</span></div>
      <div className="grid gap-2">
        {[{ name: "บ้านสุขุมวิท", progress: 68 }, { name: "บ้านสวนบางนา", progress: 42 }, { name: "รีโนเวตออฟฟิศ", progress: 78 }].map((item) => (
          <div key={item.name} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-[10px]"><span className="font-black text-slate-700">{item.name}</span><span className="font-black text-emerald-700">{item.progress}%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${item.progress}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BoqModulePreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1.35fr_repeat(3,0.7fr)] bg-emerald-950 px-3 py-2 text-[8px] font-black text-emerald-50"><span>หมวดงาน</span><span>น้ำหนัก</span><span>ผลงาน</span><span>ถ่วงน้ำหนัก</span></div>
      {[{ name: "โครงสร้าง", weight: "30%", actual: "85%", weighted: "25.5%" }, { name: "งานก่ออิฐ", weight: "20%", actual: "62%", weighted: "12.4%" }, { name: "งานระบบ", weight: "30%", actual: "55%", weighted: "16.5%" }, { name: "งานตกแต่ง", weight: "20%", actual: "40%", weighted: "8.0%" }].map((row) => (
        <div key={row.name} className="grid grid-cols-[1.35fr_repeat(3,0.7fr)] border-t border-slate-100 px-3 py-2.5 text-[9px] text-slate-600"><strong className="text-slate-800">{row.name}</strong><span>{row.weight}</span><span>{row.actual}</span><span className="font-black text-emerald-700">{row.weighted}</span></div>
      ))}
      <div className="flex items-center justify-between border-t border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[10px]"><strong>Weighted Progress</strong><strong className="text-emerald-800">62.4%</strong></div>
    </div>
  );
}

function DailyModulePreview() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2"><div><p className="text-[10px] font-black text-slate-800">Daily Report · วันนี้</p><p className="mt-0.5 text-[8px] text-slate-400">โครงการบ้านสุขุมวิท</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">บันทึกแล้ว</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-slate-50 p-2"><span className="block text-[8px] text-slate-400">ช่างวันนี้</span><strong className="mt-1 block text-sm text-slate-900">24</strong></div><div className="rounded-lg bg-slate-50 p-2"><span className="block text-[8px] text-slate-400">งานเสร็จ</span><strong className="mt-1 block text-sm text-slate-900">4</strong></div><div className="rounded-lg bg-amber-50 p-2"><span className="block text-[8px] text-amber-600">ปัญหา</span><strong className="mt-1 block text-sm text-amber-700">3</strong></div></div>
      <div className="mt-3 grid gap-2 text-[9px] leading-4 text-slate-600"><p className="rounded-lg bg-emerald-50 px-3 py-2"><strong className="text-emerald-800">งานเสร็จ:</strong> ติดตั้งโครงหลังคา</p><p className="rounded-lg bg-amber-50 px-3 py-2"><strong className="text-amber-800">ต้องตาม:</strong> วัสดุผนัง 1 รายการ</p></div>
    </div>
  );
}

const modules = [
  { title: "Project", description: "รวมทุกโครงการ ดูสถานะ ลูกค้า ทีม งบประมาณ และจุดที่ต้องติดตาม", icon: "folder" as const, preview: <ProjectModulePreview /> },
  { title: "BOQ & Weighted Progress", description: "คุมยอดหมวดงานและคำนวณความคืบหน้าจากมูลค่างานจริง ไม่ใช้ค่าเฉลี่ยธรรมดา", icon: "boq" as const, preview: <BoqModulePreview /> },
  { title: "Daily Report", description: "บันทึกงาน คน วัสดุ ปัญหา และแผนวันถัดไป พร้อมย้อนดูประวัติรายงาน", icon: "daily" as const, preview: <DailyModulePreview /> }
];

export function QuestionsSection() {
  return (
    <section className="bg-emerald-950 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Daily clarity</p>
          <h2 className="font-heading mt-3 text-3xl font-semibold leading-tight sm:text-4xl">ทุกเช้า คุณควรรู้ว่าไซต์กำลังเป็นอย่างไร</h2>
          <p className="mt-4 text-base leading-7 text-emerald-50/75">เปลี่ยนคำถามที่ต้องโทรตาม ให้กลายเป็นข้อมูลที่เปิดดูและตัดสินใจได้ทันที</p>
        </div>
        <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-6">
          {siteQuestions.map((question) => (
            <article key={question.title} className="bg-emerald-950/92 p-5 transition duration-200 hover:bg-emerald-900">
              <LandingIcon name={question.icon} className="h-7 w-7 text-emerald-300" />
              <h3 className="mt-4 text-base font-black leading-6 text-white">{question.title}</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-50/65">{question.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CoreModulesSection() {
  return (
    <section id="features" className="scroll-mt-24 bg-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Core workspace</p>
          <h2 className="font-heading mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">เครื่องมือหลักที่ทีมก่อสร้างใช้ทุกวัน</h2>
          <p className="mt-4 text-base leading-8 text-slate-600">สามโมดูลทำงานต่อเนื่องกัน ตั้งแต่สร้างโครงการ คุมงบ ไปจนถึงรายงานสิ่งที่เกิดขึ้นจริงหน้างาน</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {modules.map((module) => (
            <article key={module.title} className="group flex min-w-0 flex-col rounded-[28px] border border-slate-200 bg-[#fbfdfc] p-4 shadow-[0_16px_45px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_55px_rgba(15,23,42,0.09)] sm:p-5">
              <div className="min-h-[230px]">{module.preview}</div>
              <div className="mt-6 flex items-start gap-4 px-1 pb-2">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><LandingIcon name={module.icon} className="h-6 w-6" /></span>
                <div><h3 className="font-heading text-xl font-semibold text-slate-950">{module.title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{module.description}</p></div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WorkflowSection() {
  const steps = [
    { number: "1", title: "สร้างโครงการ", detail: "ใส่ข้อมูลพื้นฐาน ทีม และ BOQ", icon: "folder" as const },
    { number: "2", title: "บันทึกทุกวัน", detail: "ทีมไซต์กรอก Daily Report บนมือถือ", icon: "mobile" as const },
    { number: "3", title: "เห็นภาพทันที", detail: "ผู้ดูแลติดตาม Progress คนงาน และปัญหา", icon: "progress" as const }
  ];

  return (
    <section id="workflow" className="scroll-mt-24 border-y border-emerald-950/8 bg-[#f3f8f4]">
      <div className="mx-auto w-full max-w-[1240px] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Simple workflow</p><h2 className="font-heading mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">จากหน้างานถึงภาพรวมผู้บริหารใน 3 ขั้นตอน</h2></div>
        <div className="relative mt-12 grid gap-6 md:grid-cols-3 md:gap-12">
          <div className="absolute left-[16%] right-[16%] top-10 hidden border-t border-dashed border-emerald-400 md:block" aria-hidden="true" />
          {steps.map((step) => (
            <article key={step.number} className="relative z-10 flex gap-4 rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm md:block md:border-0 md:bg-transparent md:p-0 md:text-center md:shadow-none">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-800 text-white shadow-[0_12px_26px_rgba(6,95,70,0.2)] md:mx-auto md:h-20 md:w-20 md:rounded-[24px]"><LandingIcon name={step.icon} className="h-7 w-7 md:h-8 md:w-8" /></div>
              <div className="min-w-0 md:mt-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">ขั้นตอน {step.number}</p><h3 className="font-heading mt-1 text-xl font-semibold text-slate-950">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
