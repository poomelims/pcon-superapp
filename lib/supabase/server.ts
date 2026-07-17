import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CloudSyncServerConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  syncToken: string;
};

function readTrimmedEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function isCloudSyncServerConfigured(): boolean {
  return Boolean(
    readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      readTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
      (readTrimmedEnv("SUPABASE_SERVICE_ROLE_KEY") || readTrimmedEnv("SUPABASE_SECRET_KEY")) &&
      readTrimmedEnv("PCON_CLOUD_SYNC_TOKEN")
  );
}

export function readCloudSyncServerConfig(): CloudSyncServerConfig {
  const supabaseUrl = readTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readTrimmedEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = readTrimmedEnv("SUPABASE_SERVICE_ROLE_KEY") || readTrimmedEnv("SUPABASE_SECRET_KEY");
  const syncToken = readTrimmedEnv("PCON_CLOUD_SYNC_TOKEN");
  const missing = [
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : "",
    !supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : "",
    !supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY หรือ SUPABASE_SECRET_KEY" : "",
    !syncToken ? "PCON_CLOUD_SYNC_TOKEN" : ""
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`ตั้งค่า Supabase server env ยังไม่ครบ: ${missing.join(", ")}`);
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    syncToken
  };
}

export function requireCloudSyncToken(token: string | null): void {
  const { syncToken } = readCloudSyncServerConfig();

  if (!token || token !== syncToken) {
    throw new Error("Cloud sync token ไม่ถูกต้อง");
  }
}

export function createSupabaseServerClient(): SupabaseClient {
  const { supabaseUrl, supabaseServiceRoleKey } = readCloudSyncServerConfig();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export function createSupabasePublicServerClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = readCloudSyncServerConfig();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
