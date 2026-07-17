"use client";

import type React from "react";

import { MobileShellIcon } from "../../mobile-shell-ui";
import { Button, StatusFeedback } from "./ui";

export type DesktopSummaryTone = "emerald" | "amber" | "slate" | "danger";

export type DesktopSummaryItem = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: DesktopSummaryTone;
};

const valueToneClasses: Record<DesktopSummaryTone, string> = {
  emerald: "text-emerald-700",
  amber: "text-amber-600",
  slate: "text-slate-950",
  danger: "text-red-700"
};

function dataAttribute(name?: string): Record<string, string> {
  return name ? { [name]: "true" } : {};
}

export function DesktopModuleHeader({
  title,
  context,
  detail,
  action,
  attribute
}: {
  title: string;
  context?: string;
  detail?: string;
  action?: React.ReactNode;
  attribute?: string;
}) {
  return (
    <header {...dataAttribute(attribute)} className="flex min-w-0 items-start justify-between gap-5">
      <div className="min-w-0">
        <h1 className="text-[1.8rem] font-bold leading-tight tracking-[-0.025em] text-slate-950">{title}</h1>
        {context ? <p className="mt-1 text-sm font-semibold text-slate-700">{context}</p> : null}
        {detail ? <p className="mt-1 truncate text-xs font-medium text-slate-500">{detail}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{action}</div> : null}
    </header>
  );
}

export function DesktopSummaryStrip({
  items,
  attribute,
  className = ""
}: {
  items: DesktopSummaryItem[];
  attribute?: string;
  className?: string;
}) {
  return (
    <section
      {...dataAttribute(attribute)}
      className={`grid min-w-0 grid-cols-3 overflow-hidden rounded-[14px] border border-slate-200 bg-white ${className}`}
    >
      {items.slice(0, 3).map((item, index) => {
        const tone = item.tone ?? "emerald";
        return (
          <div key={item.label} className={`min-w-0 px-4 py-4 ${index > 0 ? "border-l border-slate-200" : ""}`}>
            <p className="truncate text-xs font-semibold text-slate-500">{item.label}</p>
            <p className={`mt-2 truncate text-[1.55rem] font-bold leading-none tracking-[-0.02em] ${valueToneClasses[tone]}`} title={typeof item.value === "string" ? item.value : undefined}>
              {item.value}
            </p>
            {item.hint ? <p className="mt-2 truncate text-xs font-medium text-slate-400">{item.hint}</p> : null}
          </div>
        );
      })}
    </section>
  );
}

export function DesktopSectionCard({
  children,
  title,
  detail,
  action,
  attribute,
  className = ""
}: {
  children: React.ReactNode;
  title?: string;
  detail?: string;
  action?: React.ReactNode;
  attribute?: string;
  className?: string;
}) {
  return (
    <section {...dataAttribute(attribute)} className={`min-w-0 rounded-[14px] border border-slate-200 bg-white p-5 ${className}`}>
      {title || detail || action ? (
        <div className="mb-4 flex min-w-0 items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            {title ? <h2 className="truncate text-base font-bold text-slate-950">{title}</h2> : null}
            {detail ? <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DesktopActionBar({
  children,
  feedback,
  attribute,
  className = ""
}: {
  children: React.ReactNode;
  feedback?: { tone: "success" | "error"; label: string } | null;
  attribute?: string;
  className?: string;
}) {
  return (
    <section {...dataAttribute(attribute)} aria-label="การทำงาน" className={`flex min-w-0 items-center justify-between gap-4 rounded-[14px] border border-slate-200 bg-white px-4 py-3 ${className}`}>
      {feedback ? <StatusFeedback tone={feedback.tone} className="px-3 py-2 text-xs">{feedback.label}</StatusFeedback> : <span />}
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{children}</div>
    </section>
  );
}

export function DesktopToolMenu({ label = "เครื่องมือ", children }: { label?: string; children: React.ReactNode }) {
  return (
    <details data-desktop-tools-menu className="relative min-w-0">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <MobileShellIcon name="chevron" className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid min-w-56 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.14)]">
        {children}
      </div>
    </details>
  );
}

export function DesktopCompactRow({
  title,
  detail,
  value,
  onClick,
  children
}: {
  title: string;
  detail?: string;
  value?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const content = (
    <div className="flex min-h-12 min-w-0 items-center gap-3 px-3 py-2 text-left">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
        {detail ? <p className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-500">{detail}</p> : null}
      </div>
      {value ? <span className="shrink-0 text-sm font-bold text-emerald-700">{value}</span> : null}
      {children}
      {onClick ? <MobileShellIcon name="chevron" className="h-4 w-4 shrink-0 -rotate-90 text-slate-500" /> : null}
    </div>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className="w-full rounded-lg border border-slate-200 bg-white transition hover:border-emerald-300 hover:bg-emerald-50/40">
      {content}
    </button>
  ) : (
    <div className="rounded-lg border border-slate-200 bg-white">{content}</div>
  );
}

export function DesktopEmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
      <p>{children}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function DesktopSecondaryButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="secondary" className="min-h-10 rounded-lg px-3 text-sm" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
