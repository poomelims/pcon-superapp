import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.key;
  vi.resetModules();
});

describe("supabase client safety", () => {
  it("returns null and false when env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const mod = await import("@/lib/supabase/client");

    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.getSupabaseClient()).toBeNull();
  });
});
