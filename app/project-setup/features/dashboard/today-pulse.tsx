"use client";

import type { DashboardTodayPulse } from "@/lib/project-control/dashboard-today-view-model";
import { Button, Card, StatusFeedback } from "../shared/ui";

export function TodayPulse({
  pulse,
  onOpenDailyReport,
  onOpenProject
}: {
  pulse: DashboardTodayPulse;
  onOpenDailyReport: () => void;
  onOpenProject: () => void;
}) {
  const isEmpty = pulse.reportState === "empty";
  const values = [
    { label: "คนเข้าไซต์", value: pulse.workers, testId: "dashboard-today-workers" },
    { label: "งานเสร็จ", value: pulse.completedWork, testId: "dashboard-today-completed" },
    { label: "ปัญหาต้องตาม", value: pulse.blockers.length, testId: "dashboard-today-blockers" }
  ];

  return (
    <div data-testid="dashboard-today-pulse-legacy">
      <Card className="min-w-0 bg-[linear-gradient(150deg,rgba(236,253,245,0.82),rgba(255,255,255,0.98))]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Today Pulse</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">คำตอบหน้างานวันนี้</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">สรุปจาก Daily Report ของโปรเจกต์ที่เลือก</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">
          {isEmpty ? "ยังไม่มีรายงานวันนี้" : "อัปเดตแล้ว"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {values.map((item) => (
          <div key={item.testId} className="min-w-0 rounded-2xl border border-emerald-100 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500">{item.label}</p>
            <p data-testid={`${item.testId}-desktop`} className="mt-2 text-3xl font-black leading-none tracking-tight text-slate-950">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-slate-500">Blockers ที่ต้องตาม</p>
            <span className="text-xs font-black text-slate-400">{pulse.blockers.length} รายการ</span>
          </div>
          {pulse.blockers.length > 0 ? (
            <ul className="mt-2 grid gap-2 text-sm font-semibold leading-6 text-slate-700">
              {pulse.blockers.slice(0, 3).map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-700">ยังไม่มีปัญหาที่ต้องติดตาม</p>
          )}
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">แผนถัดไป</p>
          <p data-testid="dashboard-today-next-plan-desktop" className="mt-2 break-words text-sm font-semibold leading-6 text-slate-700">
            {pulse.nextPlan || "ยังไม่มีแผนถัดไป"}
          </p>
        </div>
      </div>

      {isEmpty ? (
        <StatusFeedback tone="info" className="mt-3">
          ยังไม่มี Daily Report ที่บันทึกสำหรับโปรเจกต์นี้ เริ่มรายงานวันนี้เพื่อให้ Dashboard แสดงข้อมูลหน้างานจริง
        </StatusFeedback>
      ) : null}

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <Button data-testid="dashboard-today-open-report" onClick={onOpenDailyReport} className="min-w-0 flex-1 whitespace-normal sm:flex-none">
          เปิด Daily Report วันนี้
        </Button>
        <Button data-testid="dashboard-today-open-project" variant="secondary" onClick={onOpenProject} className="min-w-0 flex-1 whitespace-normal sm:flex-none">
          ดูรายละเอียดโครงการ
        </Button>
      </div>
      </Card>
    </div>
  );
}
