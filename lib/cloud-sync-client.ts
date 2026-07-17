import { createCloudSafeSyncData, type CloudSyncPayload, type ProjectControlData, validateImportedData } from "@/lib/project-storage";
import { type CloudSyncHealthReport } from "@/lib/cloud-sync-diagnostics";
import { getSupabaseClient } from "@/lib/supabase/client";

type Fetcher = typeof fetch;
type TokenStorage = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;
type TokenPrompt = (message: string) => string | null;

type CloudPushResponse = {
  ok: true;
  payload: CloudSyncPayload;
};

type CloudPullResponse = {
  ok: true;
  data: ProjectControlData;
};

type CloudErrorResponse = {
  error?: string;
  status?: number;
};

type CloudHealthResponse = {
  ok: true;
  health: CloudSyncHealthReport;
};

const MAX_ERROR_BODY_LENGTH = 240;

export const CLOUD_SYNC_TOKEN_STORAGE_KEY = "pcon_cloud_sync_token";

function getBrowserStorage(): TokenStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function getBrowserPrompt(): TokenPrompt | null {
  return typeof window === "undefined" ? null : window.prompt.bind(window);
}

export function getOrRequestCloudSyncToken(options?: {
  storage?: TokenStorage | null;
  promptForToken?: TokenPrompt | null;
}): string | null {
  const storage = options?.storage ?? getBrowserStorage();
  const promptForToken = options?.promptForToken ?? getBrowserPrompt();
  const stored = storage?.getItem(CLOUD_SYNC_TOKEN_STORAGE_KEY)?.trim() ?? "";

  if (stored) {
    return stored;
  }

  const entered = promptForToken?.("กรอก PCON Cloud Sync Token")?.trim() ?? "";

  if (!entered) {
    return null;
  }

  storage?.setItem(CLOUD_SYNC_TOKEN_STORAGE_KEY, entered);
  return entered;
}

export function setCloudSyncToken(token: string, storage: TokenStorage | null = getBrowserStorage()): boolean {
  const trimmed = token.trim();

  if (!trimmed || !storage) {
    return false;
  }

  storage.setItem(CLOUD_SYNC_TOKEN_STORAGE_KEY, trimmed);
  return true;
}

export function clearCloudSyncToken(storage: TokenStorage | null = getBrowserStorage()): void {
  storage?.removeItem?.(CLOUD_SYNC_TOKEN_STORAGE_KEY);
}

export function getStoredCloudSyncToken(storage: TokenStorage | null = getBrowserStorage()): string | null {
  const stored = storage?.getItem(CLOUD_SYNC_TOKEN_STORAGE_KEY)?.trim() ?? "";
  return stored || null;
}

async function getMemberAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

  return data.session?.access_token ?? null;
}

async function buildCloudSyncHeaders(syncToken?: string | null, includeJson = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = includeJson ? { "content-type": "application/json" } : {};
  const memberToken = await getMemberAccessToken();

  if (memberToken) {
    headers.authorization = `Bearer ${memberToken}`;
    return headers;
  }

  const trimmedSyncToken = syncToken?.trim() ?? "";

  if (trimmedSyncToken) {
    headers["x-pcon-sync-token"] = trimmedSyncToken;
  }

  return headers;
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text().catch(() => "");
  const body = rawBody ? (safeJsonParse(rawBody) as unknown) : {};

  if (!response.ok) {
    const apiError =
      typeof body === "object" && body !== null && "error" in body && typeof (body as CloudErrorResponse).error === "string"
        ? (body as CloudErrorResponse)
        : null;
    const message =
      apiError
        ? formatApiError(apiError.error ?? "Cloud sync failed", apiError.status ?? response.status)
        : formatHttpError(response, rawBody);

    throw new Error(message);
  }

  return body as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function formatApiError(message: string, status: number): string {
  return status ? `${message} (HTTP ${status})` : message;
}

function formatHttpError(response: Response, rawBody: string): string {
  const statusText = response.statusText ? ` ${response.statusText}` : "";
  const compactBody = rawBody.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_BODY_LENGTH);

  return compactBody ? `Cloud sync failed (HTTP ${response.status}${statusText}): ${compactBody}` : `Cloud sync failed (HTTP ${response.status}${statusText})`;
}

export async function pushDataToCloudApi(
  data: ProjectControlData,
  syncToken?: string | null,
  fetcher: Fetcher = fetch
): Promise<CloudPushResponse> {
  const cloudSafeData = createCloudSafeSyncData(data);

  return readApiResponse<CloudPushResponse>(
    await fetcher("/api/cloud-sync/push", {
      method: "POST",
      headers: await buildCloudSyncHeaders(syncToken, true),
      body: JSON.stringify(cloudSafeData)
    })
  );
}

export async function loadDataFromCloudApi(
  companyId: string,
  syncToken?: string | null,
  fetcher: Fetcher = fetch
): Promise<ProjectControlData> {
  const response = await readApiResponse<CloudPullResponse>(
    await fetcher(`/api/cloud-sync/pull?companyId=${encodeURIComponent(companyId)}`, {
      method: "GET",
      headers: await buildCloudSyncHeaders(syncToken)
    })
  );

  if (!validateImportedData(response.data)) {
    throw new Error("ข้อมูล cloud ไม่ใช่ข้อมูล PCON Project Control ที่ถูกต้อง");
  }

  return response.data;
}

export async function loadCloudSyncHealthApi(
  syncToken?: string | null,
  fetcher: Fetcher = fetch
): Promise<CloudHealthResponse> {
  return readApiResponse<CloudHealthResponse>(
    await fetcher("/api/cloud-sync/health", {
      method: "GET",
      headers: await buildCloudSyncHeaders(syncToken)
    })
  );
}
