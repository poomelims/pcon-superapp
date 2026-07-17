import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("AUTH-1 source guardrails", () => {
  it("keeps public auth pages and server API routes in place", () => {
    const routes = [
      ["app", "login", "page.tsx"],
      ["app", "register", "page.tsx"],
      ["app", "verify-email", "page.tsx"],
      ["app", "onboarding", "page.tsx"],
      ["app", "api", "auth", "profile", "route.ts"],
      ["app", "api", "auth", "session-status", "route.ts"],
      ["app", "api", "company-requests", "route.ts"],
      ["app", "api", "company-requests", "me", "route.ts"],
      ["app", "api", "company-codes", "redeem", "route.ts"],
      ["app", "api", "admin", "platform", "route.ts"],
      ["app", "api", "admin", "company-requests", "[id]", "approve", "route.ts"],
      ["app", "api", "admin", "company-requests", "[id]", "reject", "route.ts"],
      ["app", "api", "admin", "company-codes", "route.ts"]
    ];

    for (const route of routes) {
      expect(existsSync(join(process.cwd(), ...route)), route.join("/")).toBe(true);
    }
  });

  it("adds AUTH-1 Supabase schema without unsafe public write policies", () => {
    const schema = read("supabase", "auth-1-schema.sql");

    for (const table of [
      "profiles",
      "platform_admins",
      "company_registration_requests",
      "company_codes",
      "company_code_redemptions"
    ]) {
      expect(schema).toContain(`public.${table}`);
      expect(schema).toContain(`alter table public.${table} enable row level security`);
    }

    expect(schema).toContain("admin_code text unique");
    expect(schema).toContain("status text not null default 'pending'");
    expect(schema).toContain("code text unique not null");
    expect(schema).toContain("notify pgrst, 'reload schema'");
    expect(schema).not.toContain("create policy public_write");
    expect(schema).not.toContain("to public");
  });

  it("keeps service role server-only and does not hardcode admin001 password", () => {
    const client = read("lib", "supabase", "client.ts");
    const server = read("lib", "supabase", "server.ts");
    const login = read("app", "login", "page.tsx");
    const register = read("app", "register", "page.tsx");

    expect(client).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(client).not.toContain("SUPABASE_SECRET_KEY");
    expect(server).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(server).toContain("SUPABASE_SECRET_KEY");
    expect(login).not.toContain("admin001");
    expect(register).not.toContain("admin001");
    expect(`${login}\n${register}`).not.toContain("service_role");
  });

});
