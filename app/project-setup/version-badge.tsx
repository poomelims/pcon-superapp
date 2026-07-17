"use client";

export function VersionBadge({ version, releaseNote }: { version: string; releaseNote: string }) {
  return (
    <div
      className="min-w-0 max-w-full truncate whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm"
      title={releaseNote}
    >
      PCON v{version}
    </div>
  );
}
