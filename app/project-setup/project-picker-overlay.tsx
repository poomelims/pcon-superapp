"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { calculateWeightedProgress } from "@/lib/project-calculations";
import type { Project } from "@/lib/project-storage";

export type ProjectPickerVariant = "mobile-top-sheet" | "desktop-popover";

export type ProjectPickerOverlayProps = {
  open: boolean;
  variant: ProjectPickerVariant;
  projects: Project[];
  activeProjectId: string;
  query: string;
  anchor: HTMLElement | null;
  onQueryChange: (query: string) => void;
  onSelect: (projectId: string) => void;
  onClose: () => void;
};

type OverlayPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function projectMatchesQuery(project: Project, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");

  if (!normalizedQuery) {
    return true;
  }

  return [project.name, project.status, project.customer.name, project.customer.siteAddress]
    .some((value) => value.toLocaleLowerCase("th-TH").includes(normalizedQuery));
}

function calculateOverlayPosition(anchor: HTMLElement, variant: ProjectPickerVariant): OverlayPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gutter = 12;
  const top = Math.min(rect.bottom + 8, viewportHeight - 220);
  const width = variant === "mobile-top-sheet"
    ? viewportWidth - gutter * 2
    : Math.min(440, viewportWidth - gutter * 2);
  const left = variant === "mobile-top-sheet"
    ? gutter
    : Math.min(Math.max(gutter, rect.right - width), viewportWidth - width - gutter);

  return {
    left,
    top,
    width,
    maxHeight: Math.max(200, Math.min(Math.round(viewportHeight * 0.7), viewportHeight - top - gutter))
  };
}

export function ProjectPickerOverlay({
  open,
  variant,
  projects,
  activeProjectId,
  query,
  anchor,
  onQueryChange,
  onSelect,
  onClose
}: ProjectPickerOverlayProps) {
  const panelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredProjects = useMemo(
    () => projects.filter((project) => projectMatchesQuery(project, query)),
    [projects, query]
  );

  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) {
      return;
    }

    const panel = panelRef.current;
    const updatePosition = () => {
      const position = calculateOverlayPosition(anchor, variant);
      panel.style.left = `${position.left}px`;
      panel.style.top = `${position.top}px`;
      panel.style.width = `${position.width}px`;
      panel.style.maxHeight = `${position.maxHeight}px`;
      panel.style.visibility = "visible";
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, open, variant]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (variant === "mobile-top-sheet") {
        searchRef.current?.focus();
      }
    });
    const previousBodyOverflow = document.body.style.overflow;

    if (variant === "mobile-top-sheet") {
      document.body.style.overflow = "hidden";
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        anchor?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (variant === "desktop-popover" && !panelRef.current?.contains(target) && !anchor?.contains(target)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [anchor, onClose, open, variant]);

  if (!open || !anchor || typeof document === "undefined") {
    return null;
  }

  const panel = (
    <section
      ref={panelRef}
      id={`project-picker-${variant}`}
      data-project-picker-overlay={variant}
      role="dialog"
      aria-modal={variant === "mobile-top-sheet" ? "true" : undefined}
      aria-label="เลือกโปรเจกต์"
      className="fixed z-[71] flex flex-col overflow-hidden rounded-[22px] border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] motion-safe:animate-[pcon-project-picker-down_160ms_ease-out]"
      style={{ visibility: "hidden" }}
    >
      <div className="border-b border-slate-100 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-black text-slate-950">เลือกโปรเจกต์</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{filteredProjects.length} จาก {projects.length} โปรเจกต์</p>
          </div>
          <button
            type="button"
            aria-label="ปิดตัวเลือกโปรเจกต์"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-xl text-slate-600"
            onClick={() => {
              onClose();
              anchor?.focus();
            }}
          >
            ×
          </button>
        </div>
        {variant === "mobile-top-sheet" ? (
          <label className="mt-3 grid gap-1 text-xs font-bold text-slate-600">
            ค้นหาโปรเจกต์
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="min-h-11 rounded-xl border border-emerald-100 bg-slate-50 px-3 text-base font-semibold text-slate-950 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              placeholder="ชื่อโปรเจกต์ ลูกค้า หรือสถานที่"
            />
          </label>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto overscroll-contain p-2">
        {projects.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-bold text-slate-500">ยังไม่มีโปรเจกต์</p>
        ) : filteredProjects.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-3 py-4 text-sm font-bold text-slate-500">ไม่พบโปรเจกต์ที่ค้นหา</p>
        ) : (
          filteredProjects.map((project) => {
            const active = project.id === activeProjectId;
            return (
              <button
                key={project.id}
                type="button"
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/70"
                }`}
                onClick={() => onSelect(project.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{project.name || "ยังไม่มีชื่อโปรเจกต์"}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-500">
                      {project.status || "ยังไม่ระบุสถานะ"}{project.customer.name ? ` • ${project.customer.name}` : ""}
                    </p>
                    {project.customer.siteAddress ? <p className="mt-1 truncate text-xs text-slate-500">{project.customer.siteAddress}</p> : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
                    {Math.round(calculateWeightedProgress(project))}%
                  </span>
                </div>
                <p className="mt-2 text-right text-xs font-bold text-emerald-700">{active ? "เปิดอยู่ตอนนี้" : "เลือกโปรเจกต์"}</p>
              </button>
            );
          })
        )}
      </div>
    </section>
  );

  return (
    <>
      {variant === "mobile-top-sheet"
        ? createPortal(<button type="button" aria-label="ปิดตัวเลือกโปรเจกต์" className="fixed inset-0 z-[70] cursor-default bg-slate-950/25 backdrop-blur-[1px]" onClick={onClose} />, document.body)
        : null}
      {createPortal(panel, document.body)}
    </>
  );
}
