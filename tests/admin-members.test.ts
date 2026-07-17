import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("admin-managed id/password access", () => {
  it("keeps the legacy ID login API server contract alongside AUTH-1", () => {
    const idLoginRoute = readFileSync(join(process.cwd(), "app", "api", "auth", "id-login", "route.ts"), "utf8");

    expect(idLoginRoute).toContain("validateLocalDevLogin");
    expect(idLoginRoute).toContain("signInWithPassword");
  });

  it("adds an admin page and server-only member APIs", () => {
    const membersRoute = readFileSync(join(process.cwd(), "app", "api", "admin", "members", "route.ts"), "utf8");
    const idLoginRoute = readFileSync(join(process.cwd(), "app", "api", "auth", "id-login", "route.ts"), "utf8");

    expect(membersRoute).toContain("auth.admin.createUser");
    expect(membersRoute).toContain("auth.admin.deleteUser");
    expect(idLoginRoute).toContain("signInWithPassword");
  });

  it("adds schema columns needed for member IDs and section access", () => {
    const schemaSql = readFileSync(join(process.cwd(), "supabase", "project-control-schema.sql"), "utf8");

    for (const column of ["login_id", "auth_user_id", "auth_email", "display_name", "phone", "access_sections", "project_ids", "status"]) {
      expect(schemaSql).toContain(`alter table public.company_members add column if not exists ${column}`);
    }
  });

  it("stores and edits a contact phone for each Login ID", () => {
    const membersRoute = readFileSync(join(process.cwd(), "app", "api", "admin", "members", "route.ts"), "utf8");
    const adminMembers = readFileSync(join(process.cwd(), "lib", "admin-members.ts"), "utf8");
    const adminMeRoute = readFileSync(join(process.cwd(), "app", "api", "admin", "me", "route.ts"), "utf8");

    expect(membersRoute).toContain('phone: typeof body.phone === "string" ? body.phone : ""');
    expect(membersRoute).toContain("phone: parsed.phone");
    expect(membersRoute).toContain("phone, role");
    expect(adminMembers).toContain("phone: string;");
    expect(adminMembers).toContain("phone: row.phone ?? \"\"");
    expect(adminMembers).toContain("phone: input.phone");
    expect(adminMeRoute).toContain("member?.phone?.trim()");
  });

  it("loads member workspace data from cloud for scoped members", () => {
    const workspaceRoute = readFileSync(join(process.cwd(), "app", "api", "member", "workspace", "route.ts"), "utf8");

    expect(workspaceRoute).toContain("projectIds");
    expect(workspaceRoute).toContain("loadDataFromSupabaseWithClient");
  });

  it("loads company HR cloud data automatically for HR-capable members", () => {
    const workspaceRoute = readFileSync(join(process.cwd(), "app", "api", "member", "workspace", "route.ts"), "utf8");

    expect(workspaceRoute).toContain("includeCompanyHr");
    expect(workspaceRoute).toContain('member.accessSections.includes("hr")');
    expect(workspaceRoute).toContain("loadDataFromSupabaseWithClient(client, member.companyId, undefined, {");
    expect(workspaceRoute).toContain("allowedProjectIds: projectIds");
    expect(workspaceRoute).toContain("includeCompanyHr");
  });

  it("keeps project access in the server member payload", () => {
    const membersRoute = readFileSync(join(process.cwd(), "app", "api", "admin", "members", "route.ts"), "utf8");

    expect(membersRoute).toContain("projectIds");
    expect(membersRoute).toContain("project_ids");
  });

  it("keeps company scoping in admin and member server routes", () => {
    const companiesRoute = readFileSync(join(process.cwd(), "app", "api", "admin", "companies", "route.ts"), "utf8");
    const membersRoute = readFileSync(join(process.cwd(), "app", "api", "admin", "members", "route.ts"), "utf8");
    const workspaceRoute = readFileSync(join(process.cwd(), "app", "api", "member", "workspace", "route.ts"), "utf8");

    expect(companiesRoute).toContain("from(\"companies\")");
    expect(companiesRoute).toContain("insert");
    expect(membersRoute).toContain("companyId");
    expect(workspaceRoute).toContain("member.companyId");
    expect(workspaceRoute).toContain("loadDataFromSupabaseWithClient(client, member.companyId");
  });

});
