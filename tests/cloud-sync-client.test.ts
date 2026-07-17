import { afterEach, describe, expect, it, vi } from "vitest";

import { createProject, type ProjectControlData } from "@/lib/project-storage";

const project = createProject("company-1", "บ้านตัวอย่าง");
const data: ProjectControlData = {
  companies: [
    {
      id: "company-1",
      name: "บริษัทของฉัน",
      role: "owner",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z"
    }
  ],
  activeCompanyId: "company-1",
  projects: [project],
  activeProjectId: project.id,
  dailyReports: [],
  crews: [],
  laborExpenses: [],
  buyinEntries: []
};

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/supabase/client");
  vi.clearAllMocks();
});

describe("cloud sync browser API client", () => {
  it("reuses a saved sync token before asking again", async () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(" saved-token "),
      setItem: vi.fn()
    };
    const promptForToken = vi.fn();

    const { getOrRequestCloudSyncToken } = await import("@/lib/cloud-sync-client");
    const token = getOrRequestCloudSyncToken({ storage, promptForToken });

    expect(token).toBe("saved-token");
    expect(promptForToken).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("stores a newly entered sync token", async () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn()
    };
    const promptForToken = vi.fn().mockReturnValue(" new-token ");

    const { CLOUD_SYNC_TOKEN_STORAGE_KEY, getOrRequestCloudSyncToken } = await import("@/lib/cloud-sync-client");
    const token = getOrRequestCloudSyncToken({ storage, promptForToken });

    expect(token).toBe("new-token");
    expect(storage.setItem).toHaveBeenCalledWith(CLOUD_SYNC_TOKEN_STORAGE_KEY, "new-token");
  });

  it("lets the UI explicitly save or clear the sync token", async () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    const { CLOUD_SYNC_TOKEN_STORAGE_KEY, clearCloudSyncToken, setCloudSyncToken } = await import("@/lib/cloud-sync-client");

    expect(setCloudSyncToken(" saved-from-ui ", storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(CLOUD_SYNC_TOKEN_STORAGE_KEY, "saved-from-ui");

    expect(setCloudSyncToken("   ", storage)).toBe(false);

    clearCloudSyncToken(storage);
    expect(storage.removeItem).toHaveBeenCalledWith(CLOUD_SYNC_TOKEN_STORAGE_KEY);
  });

  it("pushes data through the API route with the sync token header", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, payload: { company: { id: "company-1" } } }), {
        status: 200
      })
    );

    const { pushDataToCloudApi } = await import("@/lib/cloud-sync-client");
    const result = await pushDataToCloudApi(data, "sync-token", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/cloud-sync/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pcon-sync-token": "sync-token"
      },
      body: JSON.stringify(data)
    });
    expect(result.payload.company.id).toBe("company-1");
  });

  it("strips local base64 media before sending the request body to avoid serverless payload limits", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, payload: { company: { id: "company-1" } } }), {
        status: 200
      })
    );
    const mediaData: ProjectControlData = {
      ...data,
      projects: [
        {
          ...project,
          coverImage: {
            id: "cover-1",
            name: "cover.jpg",
            dataUrl: "data:image/jpeg;base64,cover"
          }
        }
      ],
      dailyReports: [
        {
          id: "report-1",
          companyId: "company-1",
          projectId: project.id,
          reportDate: "2026-05-10",
          preparedBy: "ภูมิใจ",
          preparedByPhone: "",
          summary: "งานวันนี้",
          workItems: [],
          completedWork: "",
          ongoingWork: "",
          problems: "",
          materials: "",
          nextPlan: "",
          customerNote: "",
          internalNote: "",
          workers: [],
          progressUpdates: [],
          problemIssues: [
            {
              id: "issue-1",
              title: "ปัญหา",
              detail: "รายละเอียด",
              photos: [{ id: "issue-photo-1", name: "issue.jpg", dataUrl: "data:image/jpeg;base64,issue" }]
            }
          ],
          photos: [{ id: "site-photo-1", name: "site.jpg", dataUrl: "data:image/jpeg;base64,site" }],
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z"
        }
      ]
    };

    const { pushDataToCloudApi } = await import("@/lib/cloud-sync-client");
    await pushDataToCloudApi(mediaData, "sync-token", fetcher);

    const sentBody = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as ProjectControlData;
    expect(sentBody.projects[0].coverImage).toBeNull();
    expect(sentBody.dailyReports[0].photos).toEqual([]);
    expect(sentBody.dailyReports[0].problemIssues[0].photos).toEqual([]);
    expect(String(fetcher.mock.calls[0][1]?.body)).not.toContain("data:image/jpeg;base64");
  });

  it("can push with the logged-in member session instead of a local sync token", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, payload: { company: { id: "company-1" } } }), {
        status: 200
      })
    );
    const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: "member-access-token" } } });

    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseClient: () => ({ auth: { getSession } })
    }));

    const { pushDataToCloudApi } = await import("@/lib/cloud-sync-client");
    const result = await pushDataToCloudApi(data, null, fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/cloud-sync/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer member-access-token"
      },
      body: JSON.stringify(data)
    });
    expect(result.payload.company.id).toBe("company-1");
  });

  it("prefers the logged-in member session over a saved sync token so stale tokens do not cause 401", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, payload: { company: { id: "company-1" } } }), {
        status: 200
      })
    );
    const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: "member-access-token" } } });

    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseClient: () => ({ auth: { getSession } })
    }));

    const { pushDataToCloudApi } = await import("@/lib/cloud-sync-client");
    await pushDataToCloudApi(data, "stale-or-wrong-sync-token", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/cloud-sync/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer member-access-token"
      },
      body: JSON.stringify(data)
    });
    expect(JSON.stringify(fetcher.mock.calls[0][1]?.headers)).not.toContain("x-pcon-sync-token");
  });

  it("loads company data through the API route with the sync token header", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data }), {
        status: 200
      })
    );

    const { loadDataFromCloudApi } = await import("@/lib/cloud-sync-client");
    const result = await loadDataFromCloudApi("company-1", "sync-token", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/cloud-sync/pull?companyId=company-1", {
      method: "GET",
      headers: {
        "x-pcon-sync-token": "sync-token"
      }
    });
    expect(result.activeCompanyId).toBe("company-1");
  });

  it("surfaces API errors without losing local data", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Cloud sync token ไม่ถูกต้อง", status: 401 }), {
        status: 401
      })
    );

    const { pushDataToCloudApi } = await import("@/lib/cloud-sync-client");

    await expect(pushDataToCloudApi(data, "wrong-token", fetcher)).rejects.toThrow("Cloud sync token ไม่ถูกต้อง (HTTP 401)");
  });

  it("includes HTTP status and a short response body when the API does not return JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error"
      })
    );

    const { pushDataToCloudApi } = await import("@/lib/cloud-sync-client");

    await expect(pushDataToCloudApi(data, "sync-token", fetcher)).rejects.toThrow(
      "Cloud sync failed (HTTP 500 Internal Server Error): Internal Server Error"
    );
  });
});
