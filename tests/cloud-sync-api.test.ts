import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  secretKey: process.env.SUPABASE_SECRET_KEY,
  syncToken: process.env.PCON_CLOUD_SYNC_TOKEN
};

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.anonKey;
  process.env.SUPABASE_SECRET_KEY = originalEnv.secretKey;
  process.env.PCON_CLOUD_SYNC_TOKEN = originalEnv.syncToken;
  vi.resetModules();
});

describe("cloud sync server safety", () => {
  it("rejects requests without the configured sync token", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";

    const { requireCloudSyncToken } = await import("@/lib/supabase/server");

    expect(() => requireCloudSyncToken(null)).toThrow("Cloud sync token ไม่ถูกต้อง");
    expect(() => requireCloudSyncToken("wrong-token")).toThrow("Cloud sync token ไม่ถูกต้อง");
    expect(() => requireCloudSyncToken("expected-token")).not.toThrow();
  });

  it("reports missing server env without exposing secrets", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.PCON_CLOUD_SYNC_TOKEN;

    const { readCloudSyncServerConfig } = await import("@/lib/supabase/server");

    expect(() => readCloudSyncServerConfig()).toThrow(
      "ตั้งค่า Supabase server env ยังไม่ครบ: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY หรือ SUPABASE_SECRET_KEY, PCON_CLOUD_SYNC_TOKEN"
    );
  });
});

describe("cloud sync API routes", () => {
  it("health rejects anonymous requests without leaking env values", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";

    const { GET } = await import("@/app/api/cloud-sync/health/route");
    const response = await GET(new Request("https://pcon.test/api/cloud-sync/health"));
    const rawBody = await response.text();

    expect(response.status).toBe(401);
    expect(rawBody).toContain("Cloud sync token ไม่ถูกต้อง");
    expect(rawBody).not.toContain("expected-token");
    expect(rawBody).not.toContain("sb_secret_test");
    expect(rawBody).not.toContain("anon-test");
  });

  it("health only allows owner/admin members when not using the sync token", async () => {
    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-worker" } }, error: null })
      }
    };
    const member = {
      id: "member-worker",
      companyId: "company-1",
      loginId: "WORKER01",
      authUserId: "user-worker",
      authEmail: "worker01@pcon.local",
      displayName: "Worker 01",
      role: "worker",
      accessSections: ["dashboard", "daily_report"],
      projectIds: ["project-1"],
      status: "active",
      createdAt: null,
      updatedAt: null
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/admin-members", async () => {
      const actual = await vi.importActual<typeof import("@/lib/admin-members")>("@/lib/admin-members");
      return {
        ...actual,
        findActiveMemberByUserId: vi.fn().mockResolvedValue(member)
      };
    });

    const { GET } = await import("@/app/api/cloud-sync/health/route");
    const response = await GET(
      new Request("https://pcon.test/api/cloud-sync/health", {
        headers: { authorization: "Bearer worker-access-token" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Cloud Sync diagnostics เฉพาะ Owner/Admin");
  });

  it("health returns sanitized table diagnostics for a valid sync token", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    const serverClient = {
      from: vi.fn(() => query)
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });

    const { GET } = await import("@/app/api/cloud-sync/health/route");
    const response = await GET(
      new Request("https://pcon.test/api/cloud-sync/health", {
        headers: { "x-pcon-sync-token": "expected-token" }
      })
    );
    const body = await response.json();
    const rawBody = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.health.summary.status).toBe("ok");
    expect(body.health.serverKey.kind).toBe("sb_secret");
    expect(body.health.tables).toEqual(expect.arrayContaining([expect.objectContaining({ table: "projects", status: "ok" })]));
    expect(rawBody).not.toContain("expected-token");
    expect(rawBody).not.toContain("sb_secret_test");
    expect(rawBody).not.toContain("anon-test");
  });

  it("push rejects requests with a missing sync token", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";

    const { POST } = await import("@/app/api/cloud-sync/push/route");

    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        body: JSON.stringify({ companies: [], activeCompanyId: "", projects: [], activeProjectId: "", dailyReports: [] })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Cloud sync token ไม่ถูกต้อง");
    expect(body.status).toBe(401);
  });

  it("push uses the server Supabase client when token is valid", async () => {
    const serverClient = { from: vi.fn() };
    const payload = { company: { id: "company-1" } };
    const syncDataToSupabaseWithClient = vi.fn().mockResolvedValue(payload);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        syncDataToSupabaseWithClient
      };
    });

    const { POST } = await import("@/app/api/cloud-sync/push/route");
    const data = { companies: [], activeCompanyId: "", projects: [], activeProjectId: "", dailyReports: [] };
    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        headers: { "x-pcon-sync-token": "expected-token" },
        body: JSON.stringify(data)
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(syncDataToSupabaseWithClient).toHaveBeenCalledWith(serverClient, data, {
      allowedProjectIds: undefined,
      canDeleteMissingRows: true,
      includeCompanyHr: true
    });
    expect(body.payload).toEqual(payload);
  });

  it("push returns a message from non-Error Supabase failures instead of a generic failure", async () => {
    const serverClient = { from: vi.fn() };
    const syncDataToSupabaseWithClient = vi.fn().mockRejectedValue({ message: "บันทึก project ไม่สำเร็จ: invalid input syntax for type uuid" });

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        syncDataToSupabaseWithClient
      };
    });

    const { POST } = await import("@/app/api/cloud-sync/push/route");
    const data = { companies: [], activeCompanyId: "", projects: [], activeProjectId: "", dailyReports: [] };
    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        headers: { "x-pcon-sync-token": "expected-token" },
        body: JSON.stringify(data)
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("บันทึก project ไม่สำเร็จ: invalid input syntax for type uuid");
    expect(body.status).toBe(500);
  });

  it("rejects a push containing a project from another company before writing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";

    const { POST } = await import("@/app/api/cloud-sync/push/route");
    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        headers: {
          "x-pcon-sync-token": "expected-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          companies: [{ id: "company-1", name: "บริษัททดสอบ", role: "owner", createdAt: "", updatedAt: "" }],
          activeCompanyId: "company-1",
          activeProjectId: "project-2",
          projects: [{ id: "project-2", companyId: "company-2", name: "ข้อมูลข้ามบริษัท" }],
          dailyReports: [],
          crews: [],
          laborExpenses: [],
          buyinEntries: []
        })
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ status: 403 });
  });

  it("push accepts a logged-in project member without exposing the sync token", async () => {
    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
      }
    };
    const payload = { company: { id: "company-1" } };
    const syncDataToSupabaseWithClient = vi.fn().mockResolvedValue(payload);
    const member = {
      id: "member-1",
      companyId: "company-1",
      loginId: "SITE01",
      authUserId: "user-1",
      authEmail: "site01@pcon.local",
      displayName: "Site 01",
      role: "site_supervisor",
      accessSections: ["dashboard", "project", "daily_report", "cloud_sync"],
      projectIds: ["project-1"],
      status: "active",
      createdAt: null,
      updatedAt: null
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/admin-members", async () => {
      const actual = await vi.importActual<typeof import("@/lib/admin-members")>("@/lib/admin-members");
      return {
        ...actual,
        findActiveMemberByUserId: vi.fn().mockResolvedValue(member)
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        syncDataToSupabaseWithClient
      };
    });

    const { POST } = await import("@/app/api/cloud-sync/push/route");
    const data = {
      companies: [{ id: "company-1", name: "บริษัทของฉัน", role: "owner", createdAt: "2026-05-10", updatedAt: "2026-05-10" }],
      activeCompanyId: "company-1",
      projects: [
        {
          id: "project-1",
          companyId: "company-1",
          name: "Project",
          status: "ดำเนินการ",
          owner: "",
          team: [],
          note: "",
          coverImage: null,
          customer: { name: "", phone: "", email: "", lineId: "", siteAddress: "", siteContact: "" },
          budget: { mainContract: 0, variationOrder: 0 },
          timeline: { startDate: "", dueDate: "" },
          boq: [],
          createdAt: "2026-05-10",
          updatedAt: "2026-05-10"
        }
      ],
      activeProjectId: "project-1",
      dailyReports: []
    };
    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        headers: { authorization: "Bearer member-access-token" },
        body: JSON.stringify(data)
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(syncDataToSupabaseWithClient).toHaveBeenCalledWith(serverClient, data, {
      allowedProjectIds: ["project-1"],
      canDeleteMissingRows: false,
      includeCompanyHr: false,
      allowedSections: ["dashboard", "project", "daily_report", "cloud_sync"]
    });
    expect(body.payload).toEqual(payload);
  });

  it("push grants company HR sync to an HR member even when project scoped", async () => {
    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-hr" } }, error: null })
      }
    };
    const payload = { company: { id: "company-1" } };
    const syncDataToSupabaseWithClient = vi.fn().mockResolvedValue(payload);
    const member = {
      id: "member-hr",
      companyId: "company-1",
      loginId: "HR01",
      authUserId: "user-hr",
      authEmail: "hr01@pcon.local",
      displayName: "HR 01",
      role: "site_supervisor",
      accessSections: ["dashboard", "hr"],
      projectIds: [],
      status: "active",
      createdAt: null,
      updatedAt: null
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/admin-members", async () => {
      const actual = await vi.importActual<typeof import("@/lib/admin-members")>("@/lib/admin-members");
      return {
        ...actual,
        findActiveMemberByUserId: vi.fn().mockResolvedValue(member)
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        syncDataToSupabaseWithClient
      };
    });

    const { POST } = await import("@/app/api/cloud-sync/push/route");
    const data = {
      companies: [{ id: "company-1", name: "บริษัทของฉัน", role: "owner", createdAt: "2026-05-10", updatedAt: "2026-05-10" }],
      activeCompanyId: "company-1",
      projects: [],
      activeProjectId: "",
      dailyReports: [],
      crews: [
        {
          id: "crew-1",
          companyId: "company-1",
          leaderName: "ทีม HR",
          nationalId: "1101700234567",
          phone: "",
          workTypes: ["ทั่วไป"],
          note: "",
          status: "active",
          createdAt: "2026-05-10",
          updatedAt: "2026-05-10"
        }
      ],
      laborExpenses: [],
      buyinEntries: []
    };
    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        headers: { authorization: "Bearer hr-access-token" },
        body: JSON.stringify(data)
      })
    );

    expect(response.status).toBe(200);
    expect(syncDataToSupabaseWithClient).toHaveBeenCalledWith(serverClient, data, {
      allowedProjectIds: [],
      canDeleteMissingRows: false,
      includeCompanyHr: true,
      allowedSections: ["dashboard", "hr"]
    });
  });

  it("push lets any active assigned member save even without the cloud_sync section", async () => {
    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-worker" } }, error: null })
      }
    };
    const payload = { company: { id: "company-1" } };
    const syncDataToSupabaseWithClient = vi.fn().mockResolvedValue(payload);
    const member = {
      id: "member-worker",
      companyId: "company-1",
      loginId: "WORKER01",
      authUserId: "user-worker",
      authEmail: "worker01@pcon.local",
      displayName: "Worker 01",
      role: "worker",
      accessSections: ["dashboard", "daily_report"],
      projectIds: ["project-1"],
      status: "active",
      createdAt: null,
      updatedAt: null
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/admin-members", async () => {
      const actual = await vi.importActual<typeof import("@/lib/admin-members")>("@/lib/admin-members");
      return {
        ...actual,
        findActiveMemberByUserId: vi.fn().mockResolvedValue(member)
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        syncDataToSupabaseWithClient
      };
    });

    const { POST } = await import("@/app/api/cloud-sync/push/route");
    const data = {
      companies: [{ id: "company-1", name: "บริษัทของฉัน", role: "owner", createdAt: "2026-05-10", updatedAt: "2026-05-10" }],
      activeCompanyId: "company-1",
      projects: [
        {
          id: "project-1",
          companyId: "company-1",
          name: "Project",
          status: "ดำเนินการ",
          owner: "",
          team: [],
          note: "",
          coverImage: null,
          customer: { name: "", phone: "", email: "", lineId: "", siteAddress: "", siteContact: "" },
          budget: { mainContract: 0, variationOrder: 0 },
          timeline: { startDate: "", dueDate: "" },
          boq: [],
          createdAt: "2026-05-10",
          updatedAt: "2026-05-10"
        }
      ],
      activeProjectId: "project-1",
      dailyReports: []
    };
    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        headers: { authorization: "Bearer worker-access-token" },
        body: JSON.stringify(data)
      })
    );

    expect(response.status).toBe(200);
    expect(syncDataToSupabaseWithClient).toHaveBeenCalledWith(serverClient, data, {
      allowedProjectIds: ["project-1"],
      canDeleteMissingRows: false,
      includeCompanyHr: false,
      allowedSections: ["dashboard", "daily_report"]
    });
  });

  it("push lets an active member create a new project and keeps that project visible for later history", async () => {
    const existingProjectsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    const memberScopeQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-site" } }, error: null })
      },
      from: vi.fn((table: string) => {
        if (table === "projects") {
          return existingProjectsQuery;
        }

        if (table === "company_members") {
          return memberScopeQuery;
        }

        return {};
      })
    };
    const payload = { company: { id: "company-1" } };
    const syncDataToSupabaseWithClient = vi.fn().mockResolvedValue(payload);
    const member = {
      id: "member-site",
      companyId: "company-1",
      loginId: "SITE01",
      authUserId: "user-site",
      authEmail: "site01@pcon.local",
      displayName: "Site 01",
      role: "site_supervisor",
      accessSections: ["dashboard", "project", "daily_report"],
      projectIds: ["project-1"],
      status: "active",
      createdAt: null,
      updatedAt: null
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/admin-members", async () => {
      const actual = await vi.importActual<typeof import("@/lib/admin-members")>("@/lib/admin-members");
      return {
        ...actual,
        findActiveMemberByUserId: vi.fn().mockResolvedValue(member)
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        syncDataToSupabaseWithClient
      };
    });

    const { POST } = await import("@/app/api/cloud-sync/push/route");
    const data = {
      companies: [{ id: "company-1", name: "บริษัทของฉัน", role: "owner", createdAt: "2026-05-10", updatedAt: "2026-05-10" }],
      activeCompanyId: "company-1",
      projects: [
        {
          id: "project-1",
          companyId: "company-1",
          name: "Project",
          status: "ดำเนินการ",
          owner: "",
          team: [],
          note: "",
          coverImage: null,
          customer: { name: "", phone: "", email: "", lineId: "", siteAddress: "", siteContact: "" },
          budget: { mainContract: 0, variationOrder: 0 },
          timeline: { startDate: "", dueDate: "" },
          boq: [],
          createdAt: "2026-05-10",
          updatedAt: "2026-05-10"
        },
        {
          id: "project-new",
          companyId: "company-1",
          name: "New Member Project",
          status: "ดำเนินการ",
          owner: "",
          team: [],
          note: "",
          coverImage: null,
          customer: { name: "", phone: "", email: "", lineId: "", siteAddress: "", siteContact: "" },
          budget: { mainContract: 0, variationOrder: 0 },
          timeline: { startDate: "", dueDate: "" },
          boq: [],
          createdAt: "2026-05-10",
          updatedAt: "2026-05-10"
        }
      ],
      activeProjectId: "project-new",
      dailyReports: [
        {
          id: "report-new",
          companyId: "company-1",
          projectId: "project-new",
          reportDate: "2026-05-13",
          preparedBy: "Site 01",
          summary: "saved by member",
          completedWork: "",
          ongoingWork: "",
          problems: "",
          materials: "",
          nextPlan: "",
          customerNote: "",
          internalNote: "",
          workers: [],
          progressUpdates: [],
          problemIssues: [],
          photos: [],
          createdAt: "2026-05-13",
          updatedAt: "2026-05-13"
        }
      ]
    };
    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        headers: { authorization: "Bearer member-access-token" },
        body: JSON.stringify(data)
      })
    );

    expect(response.status).toBe(200);
    expect(syncDataToSupabaseWithClient).toHaveBeenCalledWith(serverClient, data, {
      allowedProjectIds: ["project-1", "project-new"],
      canDeleteMissingRows: false,
      includeCompanyHr: false,
      allowedSections: ["dashboard", "project", "daily_report"]
    });
    expect(memberScopeQuery.update).toHaveBeenCalledWith({ project_ids: ["project-1", "project-new"] });
  });

  it("push still saves assigned projects for a member even if stale unauthorized project ids are mixed in", async () => {
    const existingProjectsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ id: "project-2" }], error: null })
    };
    const memberScopeQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-site" } }, error: null })
      },
      from: vi.fn((table: string) => {
        if (table === "projects") {
          return existingProjectsQuery;
        }

        if (table === "company_members") {
          return memberScopeQuery;
        }

        return {};
      })
    };
    const payload = { company: { id: "company-1" } };
    const syncDataToSupabaseWithClient = vi.fn().mockResolvedValue(payload);
    const member = {
      id: "member-site",
      companyId: "company-1",
      loginId: "SITE01",
      authUserId: "user-site",
      authEmail: "site01@pcon.local",
      displayName: "Site 01",
      role: "site_supervisor",
      accessSections: ["dashboard", "project", "daily_report"],
      projectIds: ["project-1"],
      status: "active",
      createdAt: null,
      updatedAt: null
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/admin-members", async () => {
      const actual = await vi.importActual<typeof import("@/lib/admin-members")>("@/lib/admin-members");
      return {
        ...actual,
        findActiveMemberByUserId: vi.fn().mockResolvedValue(member)
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        syncDataToSupabaseWithClient
      };
    });

    const { POST } = await import("@/app/api/cloud-sync/push/route");
    const data = {
      companies: [{ id: "company-1", name: "บริษัทของฉัน", role: "owner", createdAt: "2026-05-10", updatedAt: "2026-05-10" }],
      activeCompanyId: "company-1",
      projects: [
        {
          id: "project-1",
          companyId: "company-1",
          name: "Assigned Project",
          status: "ดำเนินการ",
          owner: "",
          team: [],
          note: "",
          coverImage: null,
          customer: { name: "", phone: "", email: "", lineId: "", siteAddress: "", siteContact: "" },
          budget: { mainContract: 0, variationOrder: 0 },
          timeline: { startDate: "", dueDate: "" },
          boq: [],
          createdAt: "2026-05-10",
          updatedAt: "2026-05-10"
        },
        {
          id: "project-2",
          companyId: "company-1",
          name: "Unauthorized Existing Project",
          status: "ดำเนินการ",
          owner: "",
          team: [],
          note: "",
          coverImage: null,
          customer: { name: "", phone: "", email: "", lineId: "", siteAddress: "", siteContact: "" },
          budget: { mainContract: 0, variationOrder: 0 },
          timeline: { startDate: "", dueDate: "" },
          boq: [],
          createdAt: "2026-05-10",
          updatedAt: "2026-05-10"
        }
      ],
      activeProjectId: "project-1",
      dailyReports: []
    };
    const response = await POST(
      new Request("https://pcon.test/api/cloud-sync/push", {
        method: "POST",
        headers: { authorization: "Bearer member-access-token" },
        body: JSON.stringify(data)
      })
    );

    expect(response.status).toBe(200);
    expect(syncDataToSupabaseWithClient).toHaveBeenCalledWith(serverClient, data, {
      allowedProjectIds: ["project-1"],
      canDeleteMissingRows: false,
      includeCompanyHr: false,
      allowedSections: ["dashboard", "project", "daily_report"]
    });
    expect(memberScopeQuery.update).not.toHaveBeenCalled();
  });

  it("pull requires companyId and uses the server Supabase client", async () => {
    const serverClient = { from: vi.fn() };
    const loadedData = {
      companies: [{ id: "company-1", name: "บริษัทของฉัน", role: "owner", createdAt: "2026-05-10", updatedAt: "2026-05-10" }],
      activeCompanyId: "company-1",
      projects: [],
      activeProjectId: "",
      dailyReports: []
    };
    const loadDataFromSupabaseWithClient = vi.fn().mockResolvedValue(loadedData);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        loadDataFromSupabaseWithClient
      };
    });

    const { GET } = await import("@/app/api/cloud-sync/pull/route");
    const missingCompanyResponse = await GET(
      new Request("https://pcon.test/api/cloud-sync/pull", {
        headers: { "x-pcon-sync-token": "expected-token" }
      })
    );

    expect(missingCompanyResponse.status).toBe(400);

    const response = await GET(
      new Request("https://pcon.test/api/cloud-sync/pull?companyId=company-1", {
        headers: { "x-pcon-sync-token": "expected-token" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(loadDataFromSupabaseWithClient).toHaveBeenCalledWith(serverClient, "company-1", undefined, {
      allowedProjectIds: undefined,
      includeCompanyHr: true
    });
    expect(body.data).toEqual(loadedData);
  });

  it("pull grants company HR load to an HR member even with project scope", async () => {
    const serverClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-hr" } }, error: null })
      }
    };
    const loadedData = {
      companies: [{ id: "company-1", name: "บริษัทของฉัน", role: "owner", createdAt: "2026-05-10", updatedAt: "2026-05-10" }],
      activeCompanyId: "company-1",
      projects: [],
      activeProjectId: "",
      dailyReports: [],
      crews: [],
      laborExpenses: [],
      buyinEntries: []
    };
    const loadDataFromSupabaseWithClient = vi.fn().mockResolvedValue(loadedData);
    const member = {
      id: "member-hr",
      companyId: "company-1",
      loginId: "HR01",
      authUserId: "user-hr",
      authEmail: "hr01@pcon.local",
      displayName: "HR 01",
      role: "site_supervisor",
      accessSections: ["hr"],
      projectIds: [],
      status: "active",
      createdAt: null,
      updatedAt: null
    };

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.PCON_CLOUD_SYNC_TOKEN = "expected-token";
    vi.doMock("@/lib/supabase/server", async () => {
      const actual = await vi.importActual<typeof import("@/lib/supabase/server")>("@/lib/supabase/server");
      return {
        ...actual,
        createSupabaseServerClient: () => serverClient
      };
    });
    vi.doMock("@/lib/admin-members", async () => {
      const actual = await vi.importActual<typeof import("@/lib/admin-members")>("@/lib/admin-members");
      return {
        ...actual,
        findActiveMemberByUserId: vi.fn().mockResolvedValue(member)
      };
    });
    vi.doMock("@/lib/project-storage", async () => {
      const actual = await vi.importActual<typeof import("@/lib/project-storage")>("@/lib/project-storage");
      return {
        ...actual,
        loadDataFromSupabaseWithClient
      };
    });

    const { GET } = await import("@/app/api/cloud-sync/pull/route");
    const response = await GET(
      new Request("https://pcon.test/api/cloud-sync/pull?companyId=company-1", {
        headers: { authorization: "Bearer hr-access-token" }
      })
    );

    expect(response.status).toBe(200);
    expect(loadDataFromSupabaseWithClient).toHaveBeenCalledWith(serverClient, "company-1", undefined, {
      allowedProjectIds: [],
      includeCompanyHr: true,
      allowedSections: ["hr"]
    });
  });
});
