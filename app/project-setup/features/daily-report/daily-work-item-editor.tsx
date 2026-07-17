"use client";

import { useState } from "react";

import type { DailyWorkItem, DailyWorkItemStatus } from "@/lib/project-control/types";
import { MobileShellIcon } from "../../mobile-shell-ui";

export function DailyWorkItemEditor({
  items,
  onAdd,
  onToggleStatus,
  onUpdateTitle,
  onDelete
}: {
  items: DailyWorkItem[];
  onAdd: (title: string, status: DailyWorkItemStatus) => void;
  onToggleStatus: (itemId: string) => void;
  onUpdateTitle: (itemId: string, title: string) => void;
  onDelete: (itemId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState<DailyWorkItemStatus>("ongoing");
  const completedItems = items.filter((item) => item.status === "completed");
  const ongoingItems = items.filter((item) => item.status === "ongoing");

  function submitNewItem() {
    const title = newTitle.trim();
    if (!title) return;
    onAdd(title, newStatus);
    setNewTitle("");
  }

  function renderRows(rows: DailyWorkItem[], status: DailyWorkItemStatus) {
    if (rows.length === 0) {
      return <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs font-semibold text-slate-400">ยังไม่มีรายการ</p>;
    }

    return rows.map((item) => {
      const expanded = expandedItemId === item.id;

      return (
        <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex min-h-12 items-center gap-3 px-3">
            <input
              type="checkbox"
              checked={status === "completed"}
              aria-label={`เปลี่ยนสถานะ ${item.title}`}
              className="h-5 w-5 shrink-0 accent-emerald-600"
              onChange={() => onToggleStatus(item.id)}
            />
            <button
              type="button"
              className="min-w-0 flex-1 py-3 text-left text-sm font-semibold text-slate-800"
              onClick={() => setExpandedItemId(expanded ? null : item.id)}
            >
              <span className="line-clamp-2">{item.title}</span>
            </button>
            <MobileShellIcon name="chevron" className={`h-5 w-5 shrink-0 -rotate-90 text-slate-600 transition ${expanded ? "rotate-90" : ""}`} />
          </div>
          {expanded ? (
            <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-3">
              <input
                value={item.title}
                aria-label="แก้ไขชื่องาน"
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => onUpdateTitle(item.id, event.target.value)}
              />
              <button type="button" className="min-h-10 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-red-600" onClick={() => onDelete(item.id)}>
                ลบรายการ
              </button>
            </div>
          ) : null}
        </div>
      );
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-sm font-black text-slate-800">งานที่เสร็จ</p>
        {renderRows(completedItems, "completed")}
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-black text-slate-800">งานที่กำลังทำ</p>
        {renderRows(ongoingItems, "ongoing")}
      </div>
      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-black text-slate-800">เพิ่มงาน</p>
        <input
          value={newTitle}
          placeholder="ระบุงานที่ทำ"
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitNewItem();
            }
          }}
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select value={newStatus} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" onChange={(event) => setNewStatus(event.target.value as DailyWorkItemStatus)}>
            <option value="ongoing">กำลังทำ</option>
            <option value="completed">เสร็จแล้ว</option>
          </select>
          <button type="button" className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white" onClick={submitNewItem}>
            + เพิ่มงาน
          </button>
        </div>
      </div>
    </div>
  );
}
