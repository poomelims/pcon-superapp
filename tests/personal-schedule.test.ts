import { afterEach, describe, expect, it, vi } from "vitest";

const scheduleRow = {
  id: "event-1",
  user_id: "user-1",
  event_date: "2026-05-12",
  start_time: "08:30",
  title: "Site Walk",
  detail: "ตรวจหน้างาน",
  created_at: "2026-05-12T01:00:00.000Z",
  updated_at: "2026-05-12T01:00:00.000Z"
};

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/supabase/server");
});

describe("personal schedule helpers", () => {
  it("normalizes input and sorts events by date and time", async () => {
    const { normalizeScheduleInput, sortPersonalScheduleEvents } = await import("@/lib/personal-schedule");

    expect(
      normalizeScheduleInput({
        eventDate: "2026-05-12",
        startTime: "8:5",
        title: "  Site Walk  ",
        detail: "  ตรวจหน้างาน  "
      })
    ).toEqual({
      eventDate: "2026-05-12",
      startTime: "08:05",
      title: "Site Walk",
      detail: "ตรวจหน้างาน"
    });

    expect(
      sortPersonalScheduleEvents([
        {
          id: "late",
          userId: "user-1",
          eventDate: "2026-05-12",
          startTime: "14:00",
          title: "Late",
          detail: "",
          createdAt: "2026-05-12T01:00:00.000Z",
          updatedAt: "2026-05-12T01:00:00.000Z"
        },
        {
          id: "early",
          userId: "user-1",
          eventDate: "2026-05-12",
          startTime: "08:30",
          title: "Early",
          detail: "",
          createdAt: "2026-05-12T01:00:00.000Z",
          updatedAt: "2026-05-12T01:00:00.000Z"
        }
      ])
    ).toMatchObject([{ id: "early" }, { id: "late" }]);
  });

  it("rejects empty titles and invalid dates", async () => {
    const { normalizeScheduleInput } = await import("@/lib/personal-schedule");

    expect(() => normalizeScheduleInput({ eventDate: "2026-5-1", startTime: "08:30", title: "Walk" })).toThrow("วันที่ไม่ถูกต้อง");
    expect(() => normalizeScheduleInput({ eventDate: "2026-05-12", startTime: "08:30", title: "   " })).toThrow("กรุณาระบุหัวข้อตาราง");
  });
});

describe("personal schedule API", () => {
  it("requires a logged-in bearer session", async () => {
    const { GET } = await import("@/app/api/personal-schedule/route");

    const response = await GET(new Request("https://pcon.test/api/personal-schedule"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("กรุณา Login ก่อนใช้ตารางส่วนตัว");
  });

  it("loads only the current user's schedule events", async () => {
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({ data: [scheduleRow], error: null });
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
      },
      from: vi.fn(() => ({ select, eq, order }))
    };

    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return { ...actual, createSupabaseServerClient: () => client };
    });

    const { GET } = await import("@/app/api/personal-schedule/route");
    const response = await GET(
      new Request("https://pcon.test/api/personal-schedule?date=2026-05-12", {
        headers: { authorization: "Bearer user-token" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(client.auth.getUser).toHaveBeenCalledWith("user-token");
    expect(client.from).toHaveBeenCalledWith("personal_schedule_events");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(eq).toHaveBeenCalledWith("event_date", "2026-05-12");
    expect(body.events[0]).toMatchObject({ id: "event-1", userId: "user-1", title: "Site Walk" });
  });

  it("creates, updates, and deletes events under the current user id", async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: scheduleRow, error: null });
    const updateSingle = vi.fn().mockResolvedValue({ data: { ...scheduleRow, title: "Updated" }, error: null });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const updateSelect = vi.fn(() => ({ single: updateSingle }));
    const updateEq = vi.fn();
    const deleteEq = vi.fn();
    const insert = vi.fn(() => ({ select: insertSelect }));
    const update = vi.fn(() => {
      const query = {
        eq: updateEq,
        select: updateSelect
      };
      updateEq.mockReturnValue(query);
      return query;
    });
    const deleteQuery = {
      eq: deleteEq
    };
    deleteEq.mockReturnValue(deleteQuery);
    const deleteFromSchedule = vi.fn(() => deleteQuery);
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
      },
      from: vi.fn(() => ({
        insert,
        update,
        delete: deleteFromSchedule
      }))
    };

    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return { ...actual, createSupabaseServerClient: () => client };
    });

    const { DELETE, PATCH, POST } = await import("@/app/api/personal-schedule/route");

    const createResponse = await POST(
      new Request("https://pcon.test/api/personal-schedule", {
        method: "POST",
        headers: { authorization: "Bearer user-token", "content-type": "application/json" },
        body: JSON.stringify({ eventDate: "2026-05-12", startTime: "08:30", title: "Site Walk", detail: "ตรวจหน้างาน" })
      })
    );
    const updateResponse = await PATCH(
      new Request("https://pcon.test/api/personal-schedule", {
        method: "PATCH",
        headers: { authorization: "Bearer user-token", "content-type": "application/json" },
        body: JSON.stringify({ id: "event-1", eventDate: "2026-05-12", startTime: "09:00", title: "Updated", detail: "" })
      })
    );
    const deleteResponse = await DELETE(
      new Request("https://pcon.test/api/personal-schedule?id=event-1", {
        method: "DELETE",
        headers: { authorization: "Bearer user-token" }
      })
    );

    expect(createResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(client.auth.getUser).toHaveBeenCalledWith("user-token");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        event_date: "2026-05-12",
        start_time: "08:30",
        title: "Site Walk"
      })
    );
    expect(updateEq).toHaveBeenCalledWith("id", "event-1");
    expect(updateEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(deleteEq).toHaveBeenCalledWith("id", "event-1");
    expect(deleteEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("falls back to user-owned auth metadata when the personal schedule table is missing", async () => {
    const missingTableError = {
      message: "Could not find the table 'public.personal_schedule_events' in the schema cache"
    };
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: missingTableError });
    const insertSelect = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                app_metadata: {
                  role: "authenticated",
                  pcon_personal_schedule_events: [
                    {
                      id: "existing-event",
                      userId: "user-1",
                      eventDate: "2026-05-13",
                      startTime: "04:00",
                      title: "site walk",
                      detail: "ตรวจงานวอลเปเปอร์",
                      createdAt: "2026-05-13T01:00:00.000Z",
                      updatedAt: "2026-05-13T01:00:00.000Z"
                    }
                  ]
                }
              }
            },
            error: null
          }),
          updateUserById: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
        }
      },
      from: vi.fn(() => ({ insert }))
    };

    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return { ...actual, createSupabaseServerClient: () => client };
    });

    const { POST } = await import("@/app/api/personal-schedule/route");
    const response = await POST(
      new Request("https://pcon.test/api/personal-schedule", {
        method: "POST",
        headers: { authorization: "Bearer user-token", "content-type": "application/json" },
        body: JSON.stringify({ eventDate: "2026-05-14", startTime: "10:00", title: "วางแผนงานล่วงหน้า", detail: "เตรียมทีมติดตั้ง" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.event).toMatchObject({
      userId: "user-1",
      eventDate: "2026-05-14",
      startTime: "10:00",
      title: "วางแผนงานล่วงหน้า"
    });
    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          role: "authenticated",
          pcon_personal_schedule_events: expect.arrayContaining([
            expect.objectContaining({ id: "existing-event" }),
            expect.objectContaining({ title: "วางแผนงานล่วงหน้า" })
          ])
        })
      })
    );
  });
});
