import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "20260716_storage_security_hardening.sql");
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("Supabase storage security hardening migration", () => {
  it("uses security-definer membership helpers with a fixed search path", () => {
    expect(migrationSql).toContain("create or replace function public.is_active_company_member");
    expect(migrationSql).toContain("create or replace function public.has_project_section");
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = public");
    expect(migrationSql).toContain("(select auth.uid())");
  });

  it("adds named policies for company, project, BOQ, Daily Report, HR and BUYIN data", () => {
    for (const policy of [
      "create policy companies_member_select",
      "create policy projects_member_select",
      "create policy boq_categories_member_select",
      "create policy boq_items_member_select",
      "create policy daily_reports_member_select",
      "create policy daily_reports_member_write",
      "create policy daily_report_workers_member_write",
      "create policy daily_report_progress_member_write",
      "create policy hr_crews_member_select",
      "create policy hr_labor_expenses_member_select",
      "create policy buyin_entries_member_select"
    ]) {
      expect(migrationSql).toContain(policy);
    }
  });

  it("enforces RLS and least-privilege grants without public business writes", () => {
    expect(migrationSql).toContain("alter table public.company_members enable row level security");
    expect(migrationSql).toContain("alter table public.projects force row level security");
    expect(migrationSql).toContain("alter table public.daily_reports force row level security");
    expect(migrationSql).toContain("revoke all on public.projects from anon");
    expect(migrationSql).toContain("revoke all on public.daily_reports from anon");
    expect(migrationSql).toContain("grant select, insert, update, delete on public.projects to authenticated");
    expect(migrationSql).not.toContain("to public");
  });

  it("keeps future-table deletes owner/admin-only", () => {
    expect(migrationSql).toContain("create policy payment_milestones_owner_delete");
    expect(migrationSql).toContain("create policy project_timeline_events_owner_delete");
    expect(migrationSql).not.toContain("create policy payment_milestones_member_write\nfor all");
    expect(migrationSql).not.toContain("create policy project_timeline_events_member_write\nfor all");
  });

  it("adds company/project/report relationship guards for child rows", () => {
    expect(migrationSql).toContain("daily_reports_company_project_fk");
    expect(migrationSql).toContain("daily_report_workers_company_project_report_fk");
    expect(migrationSql).toContain("daily_report_progress_company_project_report_fk");
    expect(migrationSql).toContain("boq_items_company_project_category_fk");
  });

  it("is idempotent and reloads PostgREST after policy changes", () => {
    expect(migrationSql).toContain("drop policy if exists");
    expect(migrationSql).toContain("create index if not exists company_members_company_user_status_idx");
    expect(migrationSql).toContain("notify pgrst, 'reload schema'");
  });
});
