import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");
const deploymentGuide = readFileSync(join(process.cwd(), "VERCEL_DEPLOYMENT.md"), "utf8");

describe("cloud sync diagnostics helpers", () => {
  it("classifies common cloud sync failures into safe Thai user guidance", async () => {
    const { formatCloudSyncErrorAdvice } = await import("@/lib/cloud-sync-diagnostics");

    expect(formatCloudSyncErrorAdvice("Cloud sync token ไม่ถูกต้อง (HTTP 401)")).toContain("Token/session ไม่ถูกต้อง");
    expect(formatCloudSyncErrorAdvice("ID นี้ไม่มีสิทธิ์ sync บริษัทนี้ (HTTP 403)")).toContain("สิทธิ์ member/company/project ไม่ตรง");
    expect(formatCloudSyncErrorAdvice("Could not find the table 'public.hr_crews' in the schema cache")).toContain("schema compatibility patch");
    expect(formatCloudSyncErrorAdvice("permission denied for table projects 42501")).toContain("Data API grants");
    expect(formatCloudSyncErrorAdvice("invalid input syntax for type uuid: \"project-local\"")).toContain("text-id compatibility patch");
    expect(formatCloudSyncErrorAdvice("Cloud sync failed (HTTP 503 Service Unavailable)")).toContain("ลอง Sync Cloud อีกครั้ง");
    expect(formatCloudSyncErrorAdvice("TypeError: fetch failed")).toContain("ลอง Sync Cloud อีกครั้ง");
    expect(formatCloudSyncErrorAdvice("TypeError: Failed to fetch")).toContain("ลอง Sync Cloud อีกครั้ง");
  });

  it("identifies server key kind without returning the key value", async () => {
    const { inferCloudSyncServerKeyKind } = await import("@/lib/cloud-sync-diagnostics");

    expect(inferCloudSyncServerKeyKind("sb_secret_test_123")).toBe("sb_secret");
    expect(inferCloudSyncServerKeyKind("sb_publishable_test_123")).toBe("publishable_key_not_allowed");
    expect(inferCloudSyncServerKeyKind("anon-test")).toBe("unknown");
  });

  it("documents both accepted server key names and the non-destructive migration order", () => {
    expect(envExample).toContain("SUPABASE_SECRET_KEY=");
    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(envExample).toContain("server-only");
    expect(deploymentGuide).toContain("supabase/20260716_storage_security_hardening.sql");
    expect(deploymentGuide).toContain("notify pgrst, 'reload schema'");
    expect(deploymentGuide).toContain("ไม่ลบ");
  });
});
