import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("phase login auth flow", () => {
  it("adds an email/password login page without server secrets", () => {
    const loginPage = readFileSync(join(process.cwd(), "app", "login", "page.tsx"), "utf8");
    const loginRoute = readFileSync(join(process.cwd(), "app", "api", "auth", "id-login", "route.ts"), "utf8");

    expect(loginPage).toContain("signInWithPassword");
    expect(loginPage).toContain("/api/auth/session-status");
    expect(loginPage).toContain("clearLocalDevSession");
    expect(loginRoute).toContain("validateLocalDevLogin");
    expect(loginRoute).toContain("localDevSession");
    expect(loginPage).not.toContain("resetPasswordForEmail");
    expect(loginPage).not.toContain("SUPABASE_SECRET_KEY");
    expect(loginPage).not.toContain("service_role");
  });

  it("shows auth status on the project workspace", () => {
    const authStatus = readFileSync(join(process.cwd(), "app", "project-setup", "auth-status.tsx"), "utf8");
    const memberAccess = readFileSync(join(process.cwd(), "app", "project-setup", "use-member-access.ts"), "utf8");

    expect(authStatus).toContain("onAuthStateChange");
    expect(authStatus).toContain("signOut");
    expect(authStatus).toContain("clearLocalDevSession");
    expect(authStatus).toContain('window.location.assign("/login")');
    expect(memberAccess).toContain("loadLocalDevSession");
    expect(memberAccess).toContain("setHasSession(true)");
  });

  it("exposes current user phone for Daily Report PDF reporter data", () => {
    const memberAccess = readFileSync(join(process.cwd(), "app", "project-setup", "use-member-access.ts"), "utf8");
    const adminMeRoute = readFileSync(join(process.cwd(), "app", "api", "admin", "me", "route.ts"), "utf8");

    expect(memberAccess).toContain("phone?: string");
    expect(memberAccess).toContain("const [phone, setPhone]");
    expect(memberAccess).toContain("setPhone(result.member?.phone ?? null)");
    expect(memberAccess).toContain("phone,");
    expect(adminMeRoute).toContain('from("profiles").select("phone")');
    expect(adminMeRoute).toContain("user.user_metadata?.phone");
    expect(adminMeRoute).toContain("member: member ? { ...member, phone } : null");
  });

});
