"use client";

import type React from "react";
import { clampProgress } from "@/lib/project-calculations";

const tapTargetClass = "min-h-[var(--pcon-tap-target)]";
const focusRingClass = "focus-visible:outline focus-visible:outline-emerald-500 focus-visible:outline-offset-2";

type FeedbackTone = "success" | "error" | "info";

const feedbackToneClasses: Record<FeedbackTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};

export function StatusFeedback({
  tone = "info",
  children,
  className = ""
}: {
  tone?: FeedbackTone;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 text-sm font-bold ${feedbackToneClasses[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

export function AccordionToggle({
  expanded,
  label,
  onClick,
  controls,
  className = ""
}: {
  expanded: boolean;
  label: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  controls: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={`${tapTargetClass} ${focusRingClass} flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-2 text-left text-sm font-black text-slate-800 transition hover:bg-emerald-50 ${className}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span aria-hidden="true" className={`shrink-0 text-lg leading-none transition-transform ${expanded ? "rotate-180" : ""}`}>
        ↓
      </span>
    </button>
  );
}

export function StickyActionBar({
  children,
  status,
  className = ""
}: {
  children?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="การทำงาน"
      className={`sticky bottom-0 z-30 -mx-3 mt-4 border-t border-slate-200/80 bg-white/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_32px_rgba(15,23,42,0.1)] backdrop-blur sm:-mx-4 sm:px-4 ${className}`}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{children}</div>
      {status ? (
        <p role="status" aria-live="polite" className="mt-2 text-right text-xs font-bold text-slate-500">
          {status}
        </p>
      ) : null}
    </section>
  );
}

export function ProgressBar({ value, tone = "emerald" }: { value: number; tone?: "emerald" | "amber" | "rose" }) {
  const color = tone === "amber" ? "bg-amber-500" : tone === "rose" ? "bg-rose-500" : "bg-emerald-600";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-50" aria-label={`progress ${value}%`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clampProgress(value)}%` }} />
    </div>
  );
}

export function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${tapTargetClass} ${focusRingClass} rounded-2xl border border-emerald-100 bg-white px-3 text-base text-slate-900 shadow-sm shadow-emerald-950/[0.03] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${
        props.className ?? ""
      }`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${tapTargetClass} ${focusRingClass} min-h-28 rounded-2xl border border-emerald-100 bg-white px-3 py-2 text-base leading-6 text-slate-900 shadow-sm shadow-emerald-950/[0.03] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${tapTargetClass} ${focusRingClass} rounded-2xl border border-emerald-100 bg-white px-3 text-base text-slate-900 shadow-sm shadow-emerald-950/[0.03] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "amber" | "danger" | "ghost";
}) {
  const variants = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-200",
    secondary: "border border-emerald-100 bg-white text-slate-800 hover:border-emerald-200 hover:bg-emerald-50 disabled:text-slate-400",
    amber: "bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-200",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
    ghost: "bg-transparent text-emerald-800 hover:bg-emerald-50 disabled:text-slate-400"
  };

  return (
    <button
      {...props}
      className={`${tapTargetClass} ${focusRingClass} rounded-2xl px-4 text-base font-bold shadow-[0_10px_24px_rgba(22,101,52,0.08)] transition focus:outline-none focus:ring-2 focus:ring-emerald-100 ${variants[variant]} ${className}`}
    />
  );
}
export function Card({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
}) {
  return (
    <section {...props} className={`w-full max-w-full min-w-0 overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.055)] ring-1 ring-white/70 transition-shadow sm:rounded-[24px] sm:p-5 ${className}`}>
      {children}
    </section>
  );
}
export function PlaceholderProjectVisual({
  label,
  compact = false,
  imageUrl,
  imageAlt
}: {
  label: string;
  compact?: boolean;
  imageUrl?: string | null;
  imageAlt?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[24px] ${
        compact ? "aspect-[4/3]" : "aspect-[16/10]"
      } bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.45),_transparent_35%),linear-gradient(145deg,#10233f_0%,#142f53_38%,#2a5b74_100%)]`}
    >
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imageAlt ?? label} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.46)_100%)]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgba(15,23,42,0.15)_100%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-[42%] bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.22)_30%,rgba(15,23,42,0.55)_100%)]" />
          <div className="absolute bottom-5 left-[10%] h-[42%] w-[30%] rounded-t-[18px] bg-[#1a2536]/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
          <div className="absolute bottom-5 left-[34%] h-[52%] w-[34%] rounded-t-[18px] bg-[#202f45]/95 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
          <div className="absolute bottom-5 right-[10%] h-[36%] w-[24%] rounded-t-[18px] bg-[#192638]/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
          <div className="absolute bottom-[28%] left-[38%] h-[16%] w-[12%] rounded bg-amber-200/90" />
          <div className="absolute bottom-[28%] left-[53%] h-[16%] w-[12%] rounded bg-amber-100/85" />
          <div className="absolute bottom-[12%] left-[14%] h-[12%] w-[12%] rounded bg-amber-100/80" />
          <div className="absolute bottom-[14%] right-[15%] h-[10%] w-[11%] rounded bg-amber-100/80" />
        </>
      )}
      <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/90 backdrop-blur">
        {label}
      </div>
    </div>
  );
}
export function SectionHeader({
  eyebrow,
  title,
  action
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-black text-emerald-700">{eyebrow}</p>
        <h3 className="mt-1 break-words text-xl font-black tracking-tight text-slate-950">{title}</h3>
      </div>
      {action ? <div className="flex max-w-full min-w-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 92,
  stroke = 9,
  tone = "blue"
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "blue" | "emerald" | "slate";
}) {
  const safeValue = clampProgress(value);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = tone === "emerald" ? "#16a34a" : tone === "slate" ? "#334155" : "#2563eb";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (safeValue / 100) * circumference}
        />
      </svg>
      <span className="absolute text-2xl font-black text-slate-950">{Math.round(safeValue)}%</span>
    </div>
  );
}

export function DashboardMetricTile({
  label,
  shortLabel,
  value,
  valueTitle,
  hint,
  tone = "blue"
}: {
  label: string;
  shortLabel?: string;
  value: string;
  valueTitle?: string;
  hint?: string;
  tone?: "blue" | "emerald" | "amber" | "slate";
}) {
  const toneClasses =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "slate"
          ? "bg-slate-100 text-slate-700"
          : "bg-blue-50 text-blue-700";

  return (
    <Card className="h-full min-h-[148px]">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <p className="min-h-[2.5rem] min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-600">{label}</p>
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black ${toneClasses}`}>
            {(shortLabel || label).slice(0, 1)}
          </div>
        </div>
        <div className="mt-auto pt-4">
          <p title={valueTitle} className="truncate text-[1.68rem] font-black leading-none tracking-tight text-slate-950 sm:text-[2rem]">
            {value}
          </p>
          <div className="mt-3 min-h-[2.5rem]">{hint ? <p className="text-sm font-medium leading-5 text-slate-500">{hint}</p> : null}</div>
        </div>
      </div>
    </Card>
  );
}

export function MiniStatCard({
  label,
  value,
  hint,
  tone = "emerald"
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "emerald" | "amber" | "rose" | "slate";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "rose"
        ? "bg-red-50 text-red-700"
        : tone === "slate"
          ? "bg-slate-100 text-slate-700"
          : "bg-emerald-50 text-emerald-700";

  return (
    <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/[0.03]">
      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${toneClass}`}>{label}</div>
      <p className="mt-3 text-2xl font-black leading-none text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">{hint}</p>
    </div>
  );
}
