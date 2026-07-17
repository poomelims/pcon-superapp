import { DEFAULT_ROLE_ACCESS, normalizeLoginId, type AccessSection, type MemberRole } from "@/lib/access-control";

export const LOCAL_DEV_SESSION_STORAGE_KEY = "pcon_local_dev_auth_session";

export type LocalDevSession = {
  accessSections: AccessSection[];
  authMode: "local_dev";
  displayName: string;
  loginId: string;
  role: MemberRole;
};

function readTrimmedEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function readLocalDevCredentials(): { loginId: string; password: string } | null {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const loginId = normalizeLoginId(readTrimmedEnv("LOCAL_DEV_LOGIN_ID"));
  const password = readTrimmedEnv("LOCAL_DEV_PASSWORD");

  if (!loginId || !password) {
    return null;
  }

  return { loginId, password };
}

export function isLocalDevLoginConfigured(): boolean {
  return Boolean(readLocalDevCredentials());
}

export function createLocalDevSession(loginId = "PCONLOCAL"): LocalDevSession {
  const normalizedLoginId = normalizeLoginId(loginId);

  return {
    accessSections: [...DEFAULT_ROLE_ACCESS.owner],
    authMode: "local_dev",
    displayName: normalizedLoginId,
    loginId: normalizedLoginId,
    role: "owner"
  };
}

export function validateLocalDevLogin(loginId: string, password: string): LocalDevSession | null {
  const credentials = readLocalDevCredentials();

  if (!credentials) {
    return null;
  }

  if (normalizeLoginId(loginId) !== credentials.loginId || password !== credentials.password) {
    return null;
  }

  return createLocalDevSession(credentials.loginId);
}

export function isLocalDevSession(value: unknown): value is LocalDevSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LocalDevSession>;

  return (
    candidate.authMode === "local_dev" &&
    typeof candidate.loginId === "string" &&
    typeof candidate.displayName === "string" &&
    candidate.role === "owner" &&
    Array.isArray(candidate.accessSections)
  );
}

export function loadLocalDevSession(): LocalDevSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(LOCAL_DEV_SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;

    if (!isLocalDevSession(parsed)) {
      window.localStorage.removeItem(LOCAL_DEV_SESSION_STORAGE_KEY);
      return null;
    }

    return createLocalDevSession(parsed.loginId);
  } catch {
    window.localStorage.removeItem(LOCAL_DEV_SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveLocalDevSession(session: LocalDevSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_DEV_SESSION_STORAGE_KEY, JSON.stringify(createLocalDevSession(session.loginId)));
}

export function clearLocalDevSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LOCAL_DEV_SESSION_STORAGE_KEY);
}
