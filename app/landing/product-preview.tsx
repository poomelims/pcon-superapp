import { LandingIcon } from "./landing-icons";

const progressRows = [
  { label: "โครงสร้าง", value: 85 },
  { label: "งานก่ออิฐ", value: 62 },
  { label: "งานระบบ", value: 55 },
  { label: "งานตกแต่ง", value: 40 }
];

export function ProductPreview({ compact = false }: { compact?: boolean }) {
  return (
    <section
      data-testid="landing-product-preview"
      aria-label="ภาพสาธิต Dashboard ของ PCON"
      className={`relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#064e3b,#047857)] p-2 shadow-[0_28px_70px_rgba(6,78,59,0.25)] sm:p-3 ${compact ? "max-w-sm" : ""}`}
    >
      <div className="overflow-hidden rounded-[21px] bg-[#f8faf9] ring-1 ring-white/25">
        <div className="flex min-h-12 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-800 text-white">
              <LandingIcon name="folder" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-black text-slate-900 sm:text-sm">โครงการบ้านสุขุมวิท</p>
              <p className="text-[8px] font-semibold text-slate-400 sm:text-[10px]">ภาพรวมวันนี้</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700 sm:text-[10px]">ข้อมูลตัวอย่าง</span>
        </div>

        <div className={`grid ${compact ? "grid-cols-1" : "sm:grid-cols-[88px_minmax(0,1fr)]"}`}>
          {!compact ? (
            <aside className="hidden border-r border-slate-200 bg-emerald-950 px-2 py-4 text-emerald-50 sm:block" aria-hidden="true">
              <p className="px-2 text-[9px] font-black tracking-[0.16em] text-emerald-200">PCON</p>
              <div className="mt-4 grid gap-2">
                {["ภาพรวม", "Project", "BOQ", "Daily"].map((item, index) => (
                  <div key={item} className={`rounded-lg px-2 py-2 text-[8px] font-bold ${index === 0 ? "bg-white/14 text-white" : "text-emerald-100/70"}`}>{item}</div>
                ))}
              </div>
            </aside>
          ) : null}

          <div className="min-w-0 p-2.5 sm:p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "ความคืบหน้า", value: "68%", icon: "progress" as const, tone: "emerald" },
                { label: "ช่างวันนี้", value: "24 คน", icon: "workers" as const, tone: "emerald" },
                { label: "เรื่องต้องตาม", value: "3 เรื่อง", icon: "alert" as const, tone: "amber" }
              ].map((metric) => (
                <div key={metric.label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 shadow-sm sm:px-3 sm:py-3">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[8px] font-bold leading-3 text-slate-500 sm:text-[10px]">{metric.label}</p>
                    <LandingIcon name={metric.icon} className={`hidden h-4 w-4 shrink-0 sm:block ${metric.tone === "amber" ? "text-amber-600" : "text-emerald-600"}`} />
                  </div>
                  <p className={`font-heading mt-1.5 truncate text-sm font-semibold sm:text-xl ${metric.tone === "amber" ? "text-amber-700" : "text-slate-950"}`}>{metric.value}</p>
                </div>
              ))}
            </div>

            <div className={`mt-2 grid gap-2 ${compact ? "grid-cols-1" : "md:grid-cols-[1fr_0.9fr]"}`}>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black text-slate-800 sm:text-xs">ความคืบหน้าตามหมวดงาน</p>
                  <span className="text-[9px] font-black text-emerald-700">Weighted 68%</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {progressRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[56px_1fr_25px] items-center gap-2 text-[8px] font-semibold text-slate-500 sm:grid-cols-[66px_1fr_28px] sm:text-[9px]">
                      <span>{row.label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${row.value}%` }} /></span>
                      <span className="text-right font-black text-slate-700">{row.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {!compact ? (
                <div className="hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:block">
                  <div className="flex items-center justify-between"><p className="text-[10px] font-black text-slate-800 sm:text-xs">แนวโน้ม Progress</p><span className="text-[9px] font-bold text-slate-400">8 สัปดาห์</span></div>
                  <svg viewBox="0 0 260 92" className="mt-2 h-[72px] w-full" aria-hidden="true">
                    <path d="M10 18H250M10 44H250M10 70H250" stroke="#e2e8f0" strokeWidth="1" />
                    <path d="M12 76C44 70 54 58 82 60S125 42 148 45s38-21 55-17 28-9 45-15" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
                    <path d="M12 82C47 77 57 68 84 69s43-12 66-9 36-15 55-12 28-9 43-17" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
                  </svg>
                </div>
              ) : null}
            </div>

            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[9px] leading-4 text-amber-900 sm:text-[10px]">
              <LandingIcon name="daily" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p><strong>Daily Report วันนี้:</strong> งานโครงหลังคาเสร็จแล้ว · รอวัสดุผนัง 1 รายการ</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
