"use client";

import { PconReferenceMark } from "../components/pcon-reference-mark";
import type { MobilePrimaryTab, MobileWorkspaceTabId } from "@/lib/project-control/mobile-shell";

export { PconReferenceMark };

type MobileIconName = MobilePrimaryTab["icon"] | "menu" | "chevron" | "close";

export function MobileShellIcon({ name, className = "" }: { name: MobileIconName; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true
  };

  if (name === "dashboard") {
    return <svg {...props}><path d="M3.5 11.5 12 4l8.5 7.5" /><path d="M5.5 10.5V20h5v-5.5h3V20h5v-9.5" /></svg>;
  }
  if (name === "daily") {
    return <svg {...props}><rect x="5" y="3.5" width="14" height="17" rx="1.8" /><path d="M8.5 7.5h7" /><path d="M8.5 11.5h7" /><path d="M8.5 15.5h4.5" /></svg>;
  }
  if (name === "project") {
    return <svg {...props}><path d="M3.5 7.5h6l1.7 2H20.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19Z" /></svg>;
  }
  if (name === "menu") {
    return <svg {...props}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
  }
  if (name === "close") {
    return <svg {...props}><path d="m6 6 12 12" /><path d="M18 6 6 18" /></svg>;
  }
  return <svg {...props}><path d="m7.5 9.5 4.5 4 4.5-4" /></svg>;
}

export function MobileReferenceTabs({
  tabs,
  activeTab,
  onNavigate
}: {
  tabs: MobilePrimaryTab[];
  activeTab: MobileWorkspaceTabId;
  onNavigate: (tabId: MobilePrimaryTab["id"]) => void;
}) {
  return (
    <nav data-mobile-reference-tabs aria-label="เมนูหลัก" className="-mx-4 mt-3 grid grid-cols-3 border-t border-slate-100 bg-white md:hidden">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-14 min-w-0 items-center justify-center gap-1.5 px-1 text-[12px] font-bold transition ${
              active ? "text-emerald-600" : "text-slate-500"
            }`}
            onClick={() => onNavigate(tab.id)}
          >
            <MobileShellIcon name={tab.icon} className="h-5 w-5" />
            <span className="min-w-0 truncate">{tab.label}</span>
            {active ? <span className="absolute inset-x-4 bottom-0 h-0.5 bg-emerald-600" /> : null}
          </button>
        );
      })}
    </nav>
  );
}
