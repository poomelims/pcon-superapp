import { sortWithCompare } from "@/lib/runtime-compat";

export type PersonalScheduleEvent = {
  id: string;
  userId: string;
  eventDate: string;
  startTime: string;
  title: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonalScheduleRow = {
  id: string;
  user_id: string;
  event_date: string;
  start_time: string;
  title: string | null;
  detail: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonalScheduleInput = {
  eventDate: string;
  startTime: string;
  title: string;
  detail: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("วันที่ไม่ถูกต้อง");
  }

  return value;
}

function normalizeTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2})$/);

  if (!match) {
    throw new Error("เวลาไม่ถูกต้อง");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("เวลาไม่ถูกต้อง");
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizeScheduleInput(value: unknown): PersonalScheduleInput {
  if (!isRecord(value)) {
    throw new Error("ข้อมูลตารางไม่ถูกต้อง");
  }

  const title = stringField(value.title);

  if (!title) {
    throw new Error("กรุณาระบุหัวข้อตาราง");
  }

  return {
    eventDate: normalizeDate(stringField(value.eventDate)),
    startTime: normalizeTime(stringField(value.startTime)),
    title: title.slice(0, 120),
    detail: stringField(value.detail).slice(0, 500)
  };
}

export function normalizeScheduleRow(row: PersonalScheduleRow): PersonalScheduleEvent {
  return {
    id: row.id,
    userId: row.user_id,
    eventDate: row.event_date,
    startTime: row.start_time.slice(0, 5),
    title: row.title ?? "",
    detail: row.detail ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function sortPersonalScheduleEvents(events: PersonalScheduleEvent[]): PersonalScheduleEvent[] {
  return sortWithCompare(events, (a, b) => `${a.eventDate} ${a.startTime}`.localeCompare(`${b.eventDate} ${b.startTime}`));
}

export function buildPersonalScheduleInsert(userId: string, input: PersonalScheduleInput) {
  return {
    user_id: userId,
    event_date: input.eventDate,
    start_time: input.startTime,
    title: input.title,
    detail: input.detail
  };
}

export function buildPersonalScheduleUpdate(input: PersonalScheduleInput) {
  return {
    event_date: input.eventDate,
    start_time: input.startTime,
    title: input.title,
    detail: input.detail
  };
}
