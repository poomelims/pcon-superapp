import { NextResponse } from "next/server";

import {
  buildPersonalScheduleInsert,
  buildPersonalScheduleUpdate,
  type PersonalScheduleEvent,
  type PersonalScheduleInput,
  normalizeScheduleInput,
  normalizeScheduleRow,
  sortPersonalScheduleEvents,
  type PersonalScheduleRow
} from "@/lib/personal-schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

const PERSONAL_SCHEDULE_METADATA_KEY = "pcon_personal_schedule_events";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function createScheduleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `schedule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isMissingPersonalScheduleTableError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message ?? "";

  return (
    message.includes("personal_schedule_events") &&
    (message.includes("schema cache") || message.includes("does not exist") || message.includes("relation"))
  );
}

function normalizeMetadataEvent(value: unknown, userId: string): PersonalScheduleEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = stringField(value.id);
  const eventDate = stringField(value.eventDate);
  const startTime = stringField(value.startTime).slice(0, 5);
  const title = stringField(value.title);
  const createdAt = stringField(value.createdAt);
  const updatedAt = stringField(value.updatedAt);

  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^\d{2}:\d{2}$/.test(startTime) || !title || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    userId,
    eventDate,
    startTime,
    title,
    detail: stringField(value.detail),
    createdAt,
    updatedAt
  };
}

async function readMetadataScheduleState(
  client: ReturnType<typeof createSupabaseServerClient>,
  userId: string
): Promise<{ appMetadata: Record<string, unknown>; events: PersonalScheduleEvent[] }> {
  const { data, error } = await client.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new Error(`โหลดตารางส่วนตัวสำรองไม่สำเร็จ: ${error?.message ?? "ไม่พบ user"}`);
  }

  const appMetadata = isRecord(data.user.app_metadata) ? data.user.app_metadata : {};
  const rawEvents = appMetadata[PERSONAL_SCHEDULE_METADATA_KEY];
  const events = Array.isArray(rawEvents)
    ? sortPersonalScheduleEvents(rawEvents.map((entry) => normalizeMetadataEvent(entry, userId)).filter((entry): entry is PersonalScheduleEvent => Boolean(entry)))
    : [];

  return { appMetadata, events };
}

async function writeMetadataScheduleEvents(
  client: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  appMetadata: Record<string, unknown>,
  events: PersonalScheduleEvent[]
): Promise<void> {
  const { error } = await client.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...appMetadata,
      [PERSONAL_SCHEDULE_METADATA_KEY]: sortPersonalScheduleEvents(events)
    }
  });

  if (error) {
    throw new Error(`บันทึกตารางส่วนตัวสำรองไม่สำเร็จ: ${error.message}`);
  }
}

function buildMetadataEvent(userId: string, input: PersonalScheduleInput, existing?: PersonalScheduleEvent): PersonalScheduleEvent {
  const now = new Date().toISOString();

  return {
    id: existing?.id ?? createScheduleId(),
    userId,
    eventDate: input.eventDate,
    startTime: input.startTime,
    title: input.title,
    detail: input.detail,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

async function loadMetadataEvents(client: ReturnType<typeof createSupabaseServerClient>, userId: string, date?: string) {
  const { events } = await readMetadataScheduleState(client, userId);
  return date ? events.filter((event) => event.eventDate === date) : events;
}

async function createMetadataEvent(client: ReturnType<typeof createSupabaseServerClient>, userId: string, input: PersonalScheduleInput) {
  const { appMetadata, events } = await readMetadataScheduleState(client, userId);
  const event = buildMetadataEvent(userId, input);
  await writeMetadataScheduleEvents(client, userId, appMetadata, [...events, event]);
  return event;
}

async function updateMetadataEvent(client: ReturnType<typeof createSupabaseServerClient>, userId: string, id: string, input: PersonalScheduleInput) {
  const { appMetadata, events } = await readMetadataScheduleState(client, userId);
  const existing = events.find((event) => event.id === id);

  if (!existing) {
    throw new Error("ไม่พบรายการตารางส่วนตัว");
  }

  const event = buildMetadataEvent(userId, input, existing);
  await writeMetadataScheduleEvents(
    client,
    userId,
    appMetadata,
    events.map((item) => (item.id === id ? event : item))
  );
  return event;
}

async function deleteMetadataEvent(client: ReturnType<typeof createSupabaseServerClient>, userId: string, id: string) {
  const { appMetadata, events } = await readMetadataScheduleState(client, userId);
  await writeMetadataScheduleEvents(
    client,
    userId,
    appMetadata,
    events.filter((event) => event.id !== id)
  );
}

async function requireUserId(request: Request): Promise<{ client: ReturnType<typeof createSupabaseServerClient>; userId: string } | Response> {
  const token = bearerToken(request);

  if (!token) {
    return jsonError("กรุณา Login ก่อนใช้ตารางส่วนตัว", 401);
  }

  const client = createSupabaseServerClient();
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return jsonError("Session ไม่ถูกต้อง", 401);
  }

  return { client, userId: data.user.id };
}

function scheduleIdFromBody(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof (value as { id?: unknown }).id !== "string") {
    throw new Error("ไม่พบ schedule id");
  }

  const id = (value as { id: string }).id.trim();

  if (!id) {
    throw new Error("ไม่พบ schedule id");
  }

  return id;
}

export async function GET(request: Request) {
  const access = await requireUserId(request);
  if (access instanceof Response) {
    return access;
  }

  const date = new URL(request.url).searchParams.get("date")?.trim();
  let query = access.client
    .from("personal_schedule_events")
    .select("*")
    .eq("user_id", access.userId);

  if (date) {
    query = query.eq("event_date", date);
  }

  const result = await query.order("start_time", { ascending: true });

  if (result.error) {
    if (isMissingPersonalScheduleTableError(result.error)) {
      const events = await loadMetadataEvents(access.client, access.userId, date);
      return NextResponse.json({ ok: true, events, storage: "auth_metadata" });
    }

    return jsonError(`โหลดตารางส่วนตัวไม่สำเร็จ: ${result.error.message}`, 500);
  }

  const events = sortPersonalScheduleEvents(((result.data ?? []) as PersonalScheduleRow[]).map(normalizeScheduleRow));

  return NextResponse.json({ ok: true, events });
}

export async function POST(request: Request) {
  const access = await requireUserId(request);
  if (access instanceof Response) {
    return access;
  }

  try {
    const input = normalizeScheduleInput(await request.json());
    const result = await access.client
      .from("personal_schedule_events")
      .insert(buildPersonalScheduleInsert(access.userId, input))
      .select("*")
      .single<PersonalScheduleRow>();

    if (result.error || !result.data) {
      if (isMissingPersonalScheduleTableError(result.error)) {
        const event = await createMetadataEvent(access.client, access.userId, input);
        return NextResponse.json({ ok: true, event, storage: "auth_metadata" });
      }

      return jsonError(`บันทึกตารางส่วนตัวไม่สำเร็จ: ${result.error?.message ?? "ไม่พบข้อมูลที่บันทึก"}`, 500);
    }

    return NextResponse.json({ ok: true, event: normalizeScheduleRow(result.data) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "ข้อมูลตารางไม่ถูกต้อง", 400);
  }
}

export async function PATCH(request: Request) {
  const access = await requireUserId(request);
  if (access instanceof Response) {
    return access;
  }

  try {
    const body = (await request.json()) as unknown;
    const id = scheduleIdFromBody(body);
    const input = normalizeScheduleInput(body);
    const result = await access.client
      .from("personal_schedule_events")
      .update(buildPersonalScheduleUpdate(input))
      .eq("id", id)
      .eq("user_id", access.userId)
      .select("*")
      .single<PersonalScheduleRow>();

    if (result.error || !result.data) {
      if (isMissingPersonalScheduleTableError(result.error)) {
        const event = await updateMetadataEvent(access.client, access.userId, id, input);
        return NextResponse.json({ ok: true, event, storage: "auth_metadata" });
      }

      return jsonError(`แก้ไขตารางส่วนตัวไม่สำเร็จ: ${result.error?.message ?? "ไม่พบรายการ"}`, 500);
    }

    return NextResponse.json({ ok: true, event: normalizeScheduleRow(result.data) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "ข้อมูลตารางไม่ถูกต้อง", 400);
  }
}

export async function DELETE(request: Request) {
  const access = await requireUserId(request);
  if (access instanceof Response) {
    return access;
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";

  if (!id) {
    return jsonError("ไม่พบ schedule id", 400);
  }

  const result = await access.client
    .from("personal_schedule_events")
    .delete()
    .eq("id", id)
    .eq("user_id", access.userId);

  if (result.error) {
    if (isMissingPersonalScheduleTableError(result.error)) {
      await deleteMetadataEvent(access.client, access.userId, id);
      return NextResponse.json({ ok: true, storage: "auth_metadata" });
    }

    return jsonError(`ลบตารางส่วนตัวไม่สำเร็จ: ${result.error.message}`, 500);
  }

  return NextResponse.json({ ok: true });
}
