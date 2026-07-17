"use client";

import type React from "react";
import type { DailyQuickSectionStatus } from "@/lib/project-control/daily-report-quick-view-model";
import { AccordionToggle } from "../shared/ui";

const statusLabels: Record<DailyQuickSectionStatus, string> = {
  empty: "ยังไม่เริ่ม",
  "in-progress": "กำลังกรอก",
  complete: "ครบแล้ว"
};

export function DailyQuickSection({
  id,
  number,
  title,
  status,
  statusLabel,
  expanded,
  onToggle,
  controls,
  anchorId,
  children
}: {
  id: string;
  number: number;
  title: string;
  status: DailyQuickSectionStatus;
  statusLabel: string;
  expanded: boolean;
  onToggle: () => void;
  controls: string;
  anchorId?: string;
  children: React.ReactNode;
}) {
  const contentId = `${id}-content`;

  const toneClasses = {
    complete: "bg-emerald-600 text-white",
    "in-progress": "bg-amber-500 text-white",
    empty: "bg-slate-300 text-white"
  } as const;

  return (
    <section id={id} data-daily-quick-section={id} data-daily-report-anchor={anchorId} className="min-w-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)] sm:rounded-[20px]">
      <div className="flex min-w-0 items-center gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-black sm:ml-1 sm:h-11 sm:w-11">
          <span className={ `grid h-7 w-7 place-items-center rounded-full ${toneClasses[status]}` } data-daily-reference-section-number={number}>
            {number}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <AccordionToggle
            expanded={expanded}
            label={title}
            controls={controls}
            onClick={onToggle}
            className="rounded-none px-0 py-2.5 hover:bg-transparent"
          />
        </div>
        <span
          data-daily-quick-status={status}
          className={`mr-2 shrink-0 text-[10px] font-black sm:mr-3 sm:text-[11px] ${
            status === "complete" ? "text-emerald-600" : status === "in-progress" ? "text-amber-600" : "text-slate-400"
          }`}
        >
          {statusLabel || statusLabels[status]}
        </span>
      </div>
      <div id={contentId} aria-hidden={!expanded} className={`${expanded ? "block" : "hidden"} min-w-0 xl:block`}>
        {children}
      </div>
    </section>
  );
}
