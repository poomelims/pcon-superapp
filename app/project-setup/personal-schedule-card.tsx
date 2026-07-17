"use client";

import { FormEvent, useEffect, useState } from "react";

import { type PersonalScheduleEvent } from "@/lib/personal-schedule";
import { sortWithCompare } from "@/lib/runtime-compat";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Notice = { type: "success" | "error" | "info"; text: string } | null;

type ScheduleResponse = {
  events?: PersonalScheduleEvent[];
  event?: PersonalScheduleEvent;
  error?: string;
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultStartTime(): string {
  return "08:30";
}

function dateOffset(baseDate: string, offsetDays: number): string {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);

  return date.toISOString().slice(0, 10);
}

function startOfWeekMonday(baseDate: string): string {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);

  return date.toISOString().slice(0, 10);
}

function buildWeekDays(anchorDate: string): string[] {
  const monday = startOfWeekMonday(anchorDate);

  return Array.from({ length: 7 }, (_, index) => dateOffset(monday, index));
}

function formatWeekRange(days: string[]): string {
  if (days.length === 0) {
    return "";
  }

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  return `${firstDay} - ${lastDay}`;
}

function eventsForDate(events: PersonalScheduleEvent[], date: string): PersonalScheduleEvent[] {
  return sortWithCompare(
    events.filter((event) => event.eventDate === date),
    (a, b) => a.startTime.localeCompare(b.startTime)
  );
}

function scheduleDateLabel(eventDate: string): string {
  const today = todayString();

  if (eventDate === today) {
    return "วันนี้";
  }

  if (eventDate < today) {
    return "บันทึกงานที่ทำ";
  }

  return "แผนล่วงหน้า";
}

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

  return data.session?.access_token ?? null;
}

async function readScheduleResponse(response: Response): Promise<ScheduleResponse> {
  const body = (await response.json().catch(() => ({}))) as ScheduleResponse;

  if (!response.ok) {
    throw new Error(body.error ?? "โหลดตารางส่วนตัวไม่สำเร็จ");
  }

  return body;
}

export function PersonalScheduleCard() {
  const [events, setEvents] = useState<PersonalScheduleEvent[]>([]);
  const [eventDate, setEventDate] = useState(todayString());
  const [startTime, setStartTime] = useState(defaultStartTime());
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [isSaving, setIsSaving] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(!isSupabaseConfigured);
  const [isWeekCalendarOpen, setIsWeekCalendarOpen] = useState(false);
  const [weekAnchorDate, setWeekAnchorDate] = useState(todayString());
  const [weekEvents, setWeekEvents] = useState<PersonalScheduleEvent[]>([]);
  const [isWeekLoading, setIsWeekLoading] = useState(false);

  async function loadEvents(targetDate = eventDate) {
    if (!isSupabaseConfigured) {
      setNeedsLogin(true);
      setIsLoading(false);
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      setNeedsLogin(true);
      setIsLoading(false);
      return;
    }

    setNeedsLogin(false);
    setIsLoading(true);

    try {
      const body = await readScheduleResponse(
        await fetch(`/api/personal-schedule?date=${encodeURIComponent(targetDate)}`, {
          headers: { authorization: `Bearer ${token}` }
        })
      );
      setEvents(body.events ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "โหลดตารางส่วนตัวไม่สำเร็จ" });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadWeekEvents() {
    if (!isSupabaseConfigured) {
      setNeedsLogin(true);
      setIsWeekLoading(false);
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      setNeedsLogin(true);
      setIsWeekLoading(false);
      return;
    }

    setNeedsLogin(false);
    setIsWeekLoading(true);

    try {
      const body = await readScheduleResponse(
        await fetch("/api/personal-schedule", {
          headers: { authorization: `Bearer ${token}` }
        })
      );
      setWeekEvents(body.events ?? []);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "โหลดปฏิทินไม่สำเร็จ" });
    } finally {
      setIsWeekLoading(false);
    }
  }

  function openWeekCalendar() {
    setWeekAnchorDate(todayString());
    setIsWeekCalendarOpen(true);
    void loadWeekEvents();
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadEvents(eventDate);
    }, 0);

    const supabase = getSupabaseClient();
    const { data: listener } =
      supabase?.auth.onAuthStateChange(() => {
        void loadEvents(eventDate);
      }) ?? { data: null };

    return () => {
      window.clearTimeout(loadTimer);
      listener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventDate]);

  function resetForm() {
    setStartTime(defaultStartTime());
    setTitle("");
    setDetail("");
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = await getAccessToken();
    if (!token) {
      setNeedsLogin(true);
      setNotice({ type: "error", text: "กรุณา Login ก่อนบันทึกตารางส่วนตัว" });
      return;
    }

    if (!title.trim()) {
      setNotice({ type: "error", text: "กรุณาระบุหัวข้อตาราง" });
      return;
    }

    setIsSaving(true);

    try {
      const body = {
        id: editingId ?? undefined,
        eventDate,
        startTime,
        title,
        detail
      };
      const response = await readScheduleResponse(
        await fetch("/api/personal-schedule", {
          method: editingId ? "PATCH" : "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(body)
        })
      );

      if (response.event) {
        const savedEvent = response.event;

        setEvents((current) => {
          const next = editingId
            ? current.map((item) => (item.id === savedEvent.id ? savedEvent : item))
            : [...current, savedEvent];

          return sortWithCompare(next, (a, b) => `${a.eventDate} ${a.startTime}`.localeCompare(`${b.eventDate} ${b.startTime}`));
        });
        setWeekEvents((current) => {
          const withoutSavedEvent = current.filter((item) => item.id !== savedEvent.id);

          return sortWithCompare(
            [...withoutSavedEvent, savedEvent],
            (a, b) => `${a.eventDate} ${a.startTime}`.localeCompare(`${b.eventDate} ${b.startTime}`)
          );
        });
      }

      setNotice({ type: "success", text: editingId ? "แก้ไขตารางส่วนตัวแล้ว" : "บันทึกตารางส่วนตัวแล้ว" });
      resetForm();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "บันทึกตารางส่วนตัวไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    const token = await getAccessToken();
    if (!token) {
      setNeedsLogin(true);
      setNotice({ type: "error", text: "กรุณา Login ก่อนลบตารางส่วนตัว" });
      return;
    }

    try {
      await readScheduleResponse(
        await fetch(`/api/personal-schedule?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` }
        })
      );
      setEvents((current) => current.filter((item) => item.id !== id));
      setWeekEvents((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        resetForm();
      }
      setNotice({ type: "success", text: "ลบตารางส่วนตัวแล้ว" });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "ลบตารางส่วนตัวไม่สำเร็จ" });
    }
  }

  function editEvent(event: PersonalScheduleEvent) {
    setEditingId(event.id);
    setEventDate(event.eventDate);
    setStartTime(event.startTime);
    setTitle(event.title);
    setDetail(event.detail);
  }

  const weekDays = buildWeekDays(weekAnchorDate);
  const todayEvents = eventsForDate(weekEvents, todayString());
  const thaiWeekLabels = ["จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์"];

  return (
    <>
      <section className="rounded-[28px] border border-emerald-100/80 bg-white/95 p-5 shadow-[0_18px_50px_rgba(20,83,45,0.07)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">Daily Calendar</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">ตารางส่วนตัว</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">จดบันทึกงานที่ทำ และวางแผนงานล่วงหน้า</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
              User Cloud
            </span>
            <button
              type="button"
              className="min-h-10 rounded-2xl border border-emerald-100 bg-white px-4 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:text-slate-400"
              disabled={needsLogin}
              onClick={openWeekCalendar}
            >
              ดูปฏิทิน
            </button>
          </div>
        </div>

        {needsLogin ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold leading-6 text-amber-800">
            กรุณา Login ก่อนใช้ตารางส่วนตัว ระบบนี้บันทึกแยกตาม user และ sync ผ่าน Cloud เท่านั้น
          </div>
        ) : (
          <>
            <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="min-h-10 rounded-2xl border border-emerald-100 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:bg-emerald-50"
                  onClick={() => setEventDate(dateOffset(eventDate, -1))}
                >
                  เมื่อวาน
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 text-xs font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                  onClick={() => setEventDate(todayString())}
                >
                  วันนี้
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-2xl border border-emerald-100 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:bg-emerald-50"
                  onClick={() => setEventDate(dateOffset(eventDate, 1))}
                >
                  พรุ่งนี้
                </button>
              </div>
              <div className="grid grid-cols-[1fr_112px] gap-2">
                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="min-h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="min-h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="หัวข้อ เช่น Site Walk"
                className="min-h-11 rounded-2xl border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="รายละเอียดสั้น ๆ"
                className="min-h-20 rounded-2xl border border-emerald-100 bg-white px-3 py-2 text-sm leading-6 text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-11 rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(22,101,52,0.12)] transition hover:bg-emerald-800 disabled:bg-emerald-200"
                >
                  {isSaving ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-2xl border border-emerald-100 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:bg-emerald-50"
                  onClick={resetForm}
                >
                  Clear
                </button>
              </div>
            </form>

            {notice ? (
              <div
                className={`mt-4 rounded-2xl border px-3 py-2 text-xs font-bold ${
                  notice.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : notice.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-sky-200 bg-sky-50 text-sky-800"
                }`}
              >
                {notice.text}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              {isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">Loading schedule...</div>
              ) : events.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold leading-6 text-slate-500">
                  ยังไม่มีตารางส่วนตัวของวันนี้
                </div>
              ) : (
                events.map((item) => (
                  <div key={item.id} className="grid grid-cols-[56px_1fr] gap-3">
                    <div className="text-sm font-black text-slate-400">{item.startTime}</div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-black text-slate-900">{item.title}</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-emerald-700 shadow-sm">
                          {scheduleDateLabel(item.eventDate)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-500">{item.detail || "ไม่มีรายละเอียด"}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="min-h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                          onClick={() => editEvent(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="min-h-9 rounded-xl bg-red-600 px-3 text-xs font-black text-white transition hover:bg-red-700"
                          onClick={() => void deleteEvent(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>

      {isWeekCalendarOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,0.24)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Daily Calendar</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">งานวันนี้</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{todayString()}</p>
              </div>
              <button
                type="button"
                className="min-h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => setIsWeekCalendarOpen(false)}
              >
                ปิด
              </button>
            </div>

            <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
              {isWeekLoading ? (
                <p className="text-sm font-bold text-emerald-800">Loading weekly calendar...</p>
              ) : todayEvents.length === 0 ? (
                <p className="text-sm font-bold text-slate-500">ยังไม่มีงานวันนี้</p>
              ) : (
                <div className="grid gap-2">
                  {todayEvents.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-slate-950">{item.title}</p>
                        <span className="text-xs font-black text-emerald-700">{item.startTime}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-500">{item.detail || "ไม่มีรายละเอียด"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h4 className="text-xl font-black text-slate-950">ปฏิทินรายสัปดาห์</h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">{formatWeekRange(weekDays)}</p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4">
                <button
                  type="button"
                  className="min-h-10 rounded-2xl border border-emerald-100 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:bg-emerald-50"
                  onClick={() => setWeekAnchorDate(dateOffset(weekAnchorDate, -7))}
                >
                  สัปดาห์ก่อน
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 text-xs font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                  onClick={() => setWeekAnchorDate(todayString())}
                >
                  สัปดาห์นี้
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-2xl border border-emerald-100 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:bg-emerald-50"
                  onClick={() => setWeekAnchorDate(dateOffset(weekAnchorDate, 7))}
                >
                  สัปดาห์ถัดไป
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-2xl bg-slate-900 px-3 text-xs font-black text-white shadow-sm transition hover:bg-slate-800"
                  onClick={() => setIsWeekCalendarOpen(false)}
                >
                  ปิด
                </button>
              </div>
            </div>

            <div className="mt-4 hidden grid-cols-7 overflow-hidden rounded-3xl border border-slate-200 lg:grid">
              {weekDays.map((day, index) => {
                const dayEvents = eventsForDate(weekEvents, day);

                return (
                  <div key={day} className="min-h-56 border-r border-slate-200 bg-white p-3 last:border-r-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-950">{thaiWeekLabels[index]}</p>
                        <p className="text-xs font-bold text-slate-400">{day}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">{dayEvents.length} งาน</span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {dayEvents.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-400">ยังไม่มีงาน</p>
                      ) : (
                        dayEvents.map((item) => (
                          <div key={item.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-black text-emerald-700">{item.startTime}</p>
                            <p className="mt-1 text-xs font-black leading-5 text-slate-900">{item.title}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 lg:hidden">
              {weekDays.map((day, index) => {
                const dayEvents = eventsForDate(weekEvents, day);

                return (
                  <div key={day} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-950">{thaiWeekLabels[index]}</p>
                        <p className="text-xs font-bold text-slate-400">{day}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">{dayEvents.length} งาน</span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {dayEvents.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-400">ยังไม่มีงาน</p>
                      ) : (
                        dayEvents.map((item) => (
                          <div key={item.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-xs font-black text-emerald-700">{item.startTime}</p>
                            <p className="mt-1 text-sm font-black leading-5 text-slate-900">{item.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail || "ไม่มีรายละเอียด"}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
