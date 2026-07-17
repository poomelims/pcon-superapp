"use client";

import type React from "react";

import type { MobileModuleSectionMeta } from "@/lib/project-control/mobile-module-ui";
import { MobileShellIcon } from "../../mobile-shell-ui";
import { Button, StatusFeedback } from "./ui";

export function MobileModuleHeader({
  title,
  context,
  detail,
  action
}: {
  title: string;
  context?: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-black leading-tight tracking-tight text-slate-950">{title}</h1>
        {context ? <p className="mt-2 truncate text-base font-black text-slate-800">{context}</p> : null}
        {detail ? <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{detail}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function MobileSummaryStrip({
  items
}: {
  items: Array<{ label: string; value: React.ReactNode; hint?: string; tone?: "emerald" | "amber" | "slate" }>;
}) {
  return (
    <section className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-white px-1 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.07)]">
      {items.slice(0, 3).map((item, index) => (
        <div key={item.label} className={`min-w-0 px-2 text-center ${index < 2 ? "border-r border-slate-100" : ""}`}>
          <p className="line-clamp-2 min-h-7 text-[10px] font-semibold leading-3.5 text-slate-400">{item.label}</p>
          <p className={`mt-1 truncate text-base font-black ${item.tone === "amber" ? "text-amber-600" : item.tone === "slate" ? "text-slate-900" : "text-emerald-600"}`}>
            {item.value}
          </p>
          {item.hint ? <p className="truncate text-[9px] text-slate-400">{item.hint}</p> : null}
        </div>
      ))}
    </section>
  );
}

export function MobileNumberedSection({
  meta,
  expanded,
  onToggle,
  children,
  action
}: {
  meta: MobileModuleSectionMeta;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const contentId = `mobile-module-${meta.id}-content`;
  const toneClass = meta.tone === "complete" ? "bg-emerald-600" : meta.tone === "in-progress" ? "bg-amber-500" : "bg-slate-300";

  return (
    <section data-mobile-numbered-section={meta.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
      <div className="flex min-h-14 items-center gap-2 px-2">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black text-white ${toneClass}`}>{meta.number}</span>
        <button type="button" aria-expanded={expanded} aria-controls={contentId} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left" onClick={onToggle}>
          <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-800">{meta.title}</span>
          <span className={`shrink-0 text-[10px] font-black ${meta.tone === "complete" ? "text-emerald-600" : meta.tone === "in-progress" ? "text-amber-600" : "text-slate-400"}`}>{meta.statusLabel}</span>
          <MobileShellIcon name="chevron" className={`h-5 w-5 shrink-0 text-slate-600 transition ${expanded ? "rotate-180" : ""}`} />
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div id={contentId} className={expanded ? "block border-t border-slate-100" : "hidden"}>{children}</div>
    </section>
  );
}

export function MobileCompactRow({ title, detail, detailTestId, value, onClick, children }: { title: string; detail?: string; detailTestId?: string; value?: React.ReactNode; onClick?: () => void; children?: React.ReactNode }) {
  const content = (
    <div className="flex min-h-14 w-full min-w-0 items-center gap-3 px-3 py-2 text-left">
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-800">{title}</p>{detail ? <p data-testid={detailTestId} className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{detail}</p> : null}</div>
      {value ? <div className="shrink-0 text-xs font-black text-emerald-700">{value}</div> : null}
      {children}
      {onClick ? <MobileShellIcon name="chevron" className="h-5 w-5 shrink-0 -rotate-90 text-slate-500" /> : null}
    </div>
  );
  return onClick ? <button type="button" onClick={onClick} className="w-full rounded-xl border border-slate-200 bg-white">{content}</button> : <div className="rounded-xl border border-slate-200 bg-white">{content}</div>;
}

export function MobileEmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">{children}</div>;
}

export function MobileContextActionBar({ label, ariaLabel, disabled, busy, feedback, onClick }: { label: string; ariaLabel?: string; disabled?: boolean; busy?: boolean; feedback?: { tone: "success" | "error"; label: string } | null; onClick: () => unknown | Promise<unknown> }) {
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 md:hidden">
      <div className="pointer-events-auto grid gap-2 rounded-[20px] border border-slate-200 bg-white/96 p-2 shadow-[0_14px_34px_rgba(15,23,42,0.18)] backdrop-blur">
        {feedback ? <StatusFeedback tone={feedback.tone} className="px-3 py-2 text-xs">{feedback.label}</StatusFeedback> : null}
        <Button type="button" aria-label={ariaLabel ?? label} disabled={disabled || busy} onClick={() => { void onClick(); }} className="w-full rounded-xl bg-emerald-600 py-3 text-base shadow-[0_8px_18px_rgba(5,150,105,0.24)] hover:bg-emerald-700">
          {busy ? "กำลังบันทึก..." : label}
        </Button>
      </div>
    </div>
  );
}
