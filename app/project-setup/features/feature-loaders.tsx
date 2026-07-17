"use client";

import dynamic from "next/dynamic";

function FeatureLoading() {
  return <div className="min-h-48 animate-pulse rounded-[28px] border border-slate-200 bg-white/80" aria-label="กำลังโหลดส่วนงาน" />;
}

export const DashboardView = dynamic(() => import("./dashboard/dashboard-view").then((module) => module.DashboardView), { loading: FeatureLoading });
export const ProjectInfoView = dynamic(() => import("./project/project-view").then((module) => module.ProjectInfoView), { loading: FeatureLoading });
export const DailyReportView = dynamic(() => import("./daily-report/daily-report-view").then((module) => module.DailyReportView), { loading: FeatureLoading });
export const HrView = dynamic(() => import("./hr/hr-view").then((module) => module.HrView), { loading: FeatureLoading });
export const BuyinView = dynamic(() => import("./buyin/buyin-view").then((module) => module.BuyinView), { loading: FeatureLoading });
export const PrintDailyReportSheet = dynamic(() => import("./pdf/daily-report-sheet").then((module) => module.PrintDailyReportSheet), { loading: () => null });