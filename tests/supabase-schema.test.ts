import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schemaSql = readFileSync(join(process.cwd(), "supabase", "project-control-schema.sql"), "utf8");

describe("supabase schema compatibility", () => {
  it("adds daily report compatibility columns before commenting on them", () => {
    const addOwnerUserId = schemaSql.indexOf("alter table public.companies add column if not exists owner_user_id");
    const addProblemIssues = schemaSql.indexOf("alter table public.daily_reports add column if not exists problem_issues");
    const addPhotos = schemaSql.indexOf("alter table public.daily_reports add column if not exists photos");
    const addCoverImage = schemaSql.indexOf("alter table public.projects add column if not exists cover_image");
    const commentProblemIssues = schemaSql.indexOf("comment on column public.daily_reports.problem_issues");
    const commentPhotos = schemaSql.indexOf("comment on column public.daily_reports.photos");

    expect(addOwnerUserId).toBeGreaterThan(-1);
    expect(addProblemIssues).toBeGreaterThan(-1);
    expect(addPhotos).toBeGreaterThan(-1);
    expect(addCoverImage).toBeGreaterThan(-1);
    expect(addProblemIssues).toBeLessThan(commentProblemIssues);
    expect(addPhotos).toBeLessThan(commentPhotos);
  });

  it("keeps compatibility columns for every cloud sync payload field", () => {
    const requiredColumns = {
      projects: [
        "owner",
        "team",
        "note",
        "cover_image",
        "customer_name",
        "customer_phone",
        "customer_email",
        "customer_line_id",
        "site_address",
        "site_contact",
        "main_contract",
        "variation_order",
        "start_date",
        "due_date"
      ],
      boq_items: ["name", "progress"],
      daily_reports: [
        "prepared_by",
        "completed_work",
        "ongoing_work",
        "problems",
        "materials",
        "next_plan",
        "customer_note",
        "internal_note",
        "problem_issues",
        "photos"
      ],
      daily_report_workers: ["name", "crew_id", "trade", "count", "start_time", "end_time", "task_title", "task_status", "note"],
      daily_report_progress_updates: ["category_id", "item_id", "title", "previous_progress", "new_progress", "note"]
    };

    for (const [table, columns] of Object.entries(requiredColumns)) {
      for (const column of columns) {
        expect(schemaSql).toContain(`alter table public.${table} add column if not exists ${column}`);
      }
    }
  });

  it("documents the production schema-cache reload needed after compatibility DDL", () => {
    const addCrewId = schemaSql.indexOf("alter table public.daily_report_workers add column if not exists crew_id");
    const crewIdIndex = schemaSql.indexOf("daily_report_workers_crew_id_idx");
    const reloadSchema = schemaSql.indexOf("notify pgrst, 'reload schema'");

    expect(addCrewId).toBeGreaterThan(-1);
    expect(crewIdIndex).toBeGreaterThan(addCrewId);
    expect(reloadSchema).toBeGreaterThan(crewIdIndex);
  });

  it("adds a user-owned personal schedule table for v1.1", () => {
    expect(schemaSql).toContain("create table if not exists public.personal_schedule_events");
    expect(schemaSql).toContain("user_id uuid not null references auth.users(id) on delete cascade");
    expect(schemaSql).toContain("event_date date not null");
    expect(schemaSql).toContain("start_time time not null");
    expect(schemaSql).toContain("alter table public.personal_schedule_events enable row level security");
    expect(schemaSql).toContain("personal_schedule_events_user_date_time_idx");
    expect(schemaSql).toContain("personal_schedule_events_select_own");
    expect(schemaSql).toContain("personal_schedule_events_insert_own");
    expect(schemaSql).toContain("personal_schedule_events_update_own");
    expect(schemaSql).toContain("personal_schedule_events_delete_own");
    expect(schemaSql).toContain("(select auth.uid()) = user_id");
    expect(schemaSql).toContain("grant select, insert, update, delete on public.personal_schedule_events to authenticated");
    expect(schemaSql).toContain("notify pgrst, 'reload schema'");
  });

  it("adds HR crew and labor expense tables with RLS-ready constraints and indexes", () => {
    expect(schemaSql).toContain("create table if not exists public.hr_crews");
    expect(schemaSql).toContain("company_id uuid not null references public.companies(id) on delete cascade");
    expect(schemaSql).toContain("leader_name text not null");
    expect(schemaSql).toContain("national_id text");
    expect(schemaSql).toContain("work_types text[] not null default '{}'");
    expect(schemaSql).toContain("status text not null default 'active'");
    expect(schemaSql).toContain("create table if not exists public.hr_labor_expenses");
    expect(schemaSql).toContain("crew_id uuid not null references public.hr_crews(id) on delete cascade");
    expect(schemaSql).toContain("project_id uuid references public.projects(id) on delete set null");
    expect(schemaSql).toContain("expense_date date not null");
    expect(schemaSql).toContain("amount numeric not null default 0");
    expect(schemaSql).toContain("alter table public.hr_crews enable row level security");
    expect(schemaSql).toContain("alter table public.hr_labor_expenses enable row level security");
    expect(schemaSql).toContain("hr_crews_company_id_idx");
    expect(schemaSql).toContain("hr_labor_expenses_company_id_idx");
    expect(schemaSql).toContain("hr_labor_expenses_expense_date_idx");
    expect(schemaSql).toContain("Future policy: allow access through public.company_members by company_id");
    expect(schemaSql).not.toContain("create policy hr_crews_public_write");
    expect(schemaSql).not.toContain("create policy hr_labor_expenses_public_write");
  });

  it("adds BUYIN entries table with constraints, indexes, and RLS-ready comments", () => {
    expect(schemaSql).toContain("create table if not exists public.buyin_entries");
    expect(schemaSql).toContain("company_id uuid not null references public.companies(id) on delete cascade");
    expect(schemaSql).toContain("project_id uuid references public.projects(id) on delete set null");
    expect(schemaSql).toContain("entry_date date not null");
    expect(schemaSql).toContain("type text not null");
    expect(schemaSql).toContain("vendor_tax_id text");
    expect(schemaSql).toContain("amount_paid numeric not null default 0");
    expect(schemaSql).toContain("include_vat boolean not null default false");
    expect(schemaSql).toContain("constraint buyin_entries_type_check check (type in ('expense', 'invoice'))");
    expect(schemaSql).toContain("constraint buyin_entries_amount_paid_check check (amount_paid >= 0)");
    expect(schemaSql).toContain("buyin_entries_company_id_idx");
    expect(schemaSql).toContain("buyin_entries_entry_date_idx");
    expect(schemaSql).toContain("buyin_entries_vendor_tax_id_idx");
    expect(schemaSql).toContain("alter table public.buyin_entries enable row level security");
    expect(schemaSql).toContain("comment on table public.buyin_entries is 'BUYIN-1 purchasing and vendor invoice records");
    expect(schemaSql).not.toContain("create policy buyin_entries_public_write");
  });
});
