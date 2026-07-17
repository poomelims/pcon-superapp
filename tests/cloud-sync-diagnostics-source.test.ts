import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const clientSource = () => readFileSync(join(process.cwd(), "lib", "cloud-sync-client.ts"), "utf8");
const routeSource = () => readFileSync(join(process.cwd(), "app", "api", "cloud-sync", "health", "route.ts"), "utf8");

describe("cloud sync diagnostics source guardrails", () => {
  it("adds a read-only health API and browser client without exposing secrets", () => {
    const route = routeSource();
    const client = clientSource();
    const forbiddenWriteMethods = ["POST", "PUT", "PATCH", "DELETE"];

    expect(route).toContain("export async function GET");
    for (const method of forbiddenWriteMethods) {
      expect(route).not.toMatch(new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`));
      expect(route).not.toMatch(new RegExp(`export\\s+const\\s+${method}\\b`));
    }
    expect(route).toContain("runCloudSyncHealthCheck");
    expect(route).not.toContain("syncToken:");
    expect(route).not.toContain("supabaseServiceRoleKey");
    expect(client).toContain("loadCloudSyncHealthApi");
    expect(client).toContain("/api/cloud-sync/health");
    expect(client).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(client).not.toContain("SUPABASE_SECRET_KEY");
    expect(client).not.toContain("PCON_CLOUD_SYNC_TOKEN");
  });
});
