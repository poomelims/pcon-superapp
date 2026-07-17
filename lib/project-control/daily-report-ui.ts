import type { DailyQuickSection, DailyQuickSectionStatus } from "./daily-report-quick-view-model";

export type DailyReferenceSectionMeta = {
  id: DailyQuickSection;
  number: number;
  title: string;
  statusLabel: string;
  tone: "complete" | "in-progress" | "empty";
};

const dailyReferenceSections: Array<{ id: DailyQuickSection; number: number; title: string }> = [
  { id: "work", number: 1, title: "งานวันนี้" },
  { id: "site", number: 2, title: "คนและวัสดุ" },
  { id: "progress", number: 3, title: "ความคืบหน้า BOQ" },
  { id: "plan", number: 4, title: "แผนงานวันพรุ่งนี้" },
  { id: "problems", number: 5, title: "ปัญหาและอุปสรรค" },
  { id: "photos", number: 6, title: "รูปงานประจำวัน" }
];

export function getDailyReferenceSections() {
  return dailyReferenceSections.map((section) => ({ ...section }));
}

export function getDailyReferenceSectionMeta(
  id: DailyQuickSection,
  status: DailyQuickSectionStatus,
  completedCount: number,
  totalCount: number
): DailyReferenceSectionMeta {
  const section = dailyReferenceSections.find((candidate) => candidate.id === id) ?? dailyReferenceSections[0];
  const safeTotal = Math.max(0, totalCount);
  const safeCompleted = Math.min(safeTotal, Math.max(0, completedCount));
  const isComplete = status === "complete";
  const statusLabel = isComplete
    ? `${safeTotal}/${safeTotal} เสร็จสมบูรณ์`
    : safeTotal > 0
      ? `${safeCompleted}/${safeTotal} ไม่สมบูรณ์`
      : "ยังไม่เริ่ม";

  return {
    ...section,
    statusLabel,
    tone: status
  };
}

export function formatThaiReportDate(reportDate: string) {
  const date = new Date(`${reportDate}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) {
    return { dateLabel: reportDate, weekdayLabel: "" };
  }

  return {
    dateLabel: new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Bangkok"
    }).format(date),
    weekdayLabel: new Intl.DateTimeFormat("th-TH", {
      weekday: "long",
      timeZone: "Asia/Bangkok"
    }).format(date)
  };
}
