"use client";

import dynamic from "next/dynamic";

const ProjectControlWorkspace = dynamic(
  () => import("./workspace").then((module) => module.ProjectControlWorkspace),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-[#eef2ec] px-4 text-slate-900">
        <div className="w-full max-w-sm rounded-[28px] border border-white/80 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.1)]">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-emerald-100" aria-hidden="true" />
          <p className="mt-4 text-sm font-black text-emerald-800">กำลังเปิด PCON Workspace</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">กำลังโหลดข้อมูล Project, BOQ และ Daily Report จากเครื่องนี้</p>
        </div>
      </main>
    )
  }
);

export function ProjectControlWorkspaceLoader() {
  return <ProjectControlWorkspace />;
}
