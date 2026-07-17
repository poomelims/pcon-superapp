create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  display_name text,
  phone text,
  role text not null default 'viewer',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_role_check check (role in ('owner', 'admin', 'project_manager', 'site_supervisor', 'office_staff', 'worker', 'viewer')),
  constraint company_members_status_check check (status in ('active', 'invited', 'disabled')),
  constraint company_members_company_user_unique unique (company_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  status text default 'ดำเนินการ',
  owner text,
  team text[] not null default '{}',
  note text,
  cover_image jsonb,
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_line_id text,
  site_address text,
  site_contact text,
  main_contract numeric not null default 0,
  variation_order numeric not null default 0,
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boq_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boq_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid not null references public.boq_categories(id) on delete cascade,
  description text,
  quantity numeric not null default 0,
  unit text,
  unit_price numeric not null default 0,
  progress numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null,
  prepared_by text,
  prepared_by_phone text,
  summary text,
  completed_work text,
  ongoing_work text,
  problems text,
  materials text,
  next_plan text,
  customer_note text,
  internal_note text,
  problem_issues jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_report_workers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  crew_id uuid,
  name text,
  trade text,
  count numeric not null default 1,
  start_time time,
  end_time time,
  task_title text,
  task_status text not null default 'ดำเนินการ',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_report_workers_task_status_check check (task_status in ('ดำเนินการ', 'แก้ไข', 'เสร็จ'))
);

create table if not exists public.hr_crews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  leader_name text not null,
  national_id text,
  phone text,
  work_types text[] not null default '{}',
  note text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_crews_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.hr_labor_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  crew_id uuid not null references public.hr_crews(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  expense_date date not null,
  work_type text,
  description text not null default '',
  amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_labor_expenses_amount_non_negative_check check (amount >= 0)
);

create table if not exists public.buyin_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  entry_date date not null,
  type text not null,
  store_name text,
  vendor_name text,
  vendor_tax_id text,
  description text,
  category text,
  amount_paid numeric not null default 0,
  include_vat boolean not null default false,
  net_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyin_entries_type_check check (type in ('expense', 'invoice')),
  constraint buyin_entries_amount_paid_check check (amount_paid >= 0),
  constraint buyin_entries_net_amount_check check (net_amount >= 0),
  constraint buyin_entries_vat_amount_check check (vat_amount >= 0)
);

create table if not exists public.daily_report_progress_updates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  category_id uuid references public.boq_categories(id) on delete set null,
  item_id uuid references public.boq_items(id) on delete set null,
  title text,
  previous_progress numeric not null default 0,
  new_progress numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_milestones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text,
  amount numeric not null default 0,
  due_date date,
  status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_timeline_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text,
  description text,
  event_date date,
  status text default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  start_time time not null,
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility upgrades for databases that already had Phase 1 tables before
-- Daily Report structured issues/photos and worker task fields were added.
alter table public.companies add column if not exists slug text;
alter table public.companies add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table public.companies add column if not exists created_at timestamptz not null default now();
alter table public.companies add column if not exists updated_at timestamptz not null default now();
alter table public.company_members add column if not exists login_id text;
alter table public.company_members add column if not exists auth_user_id text;
alter table public.company_members add column if not exists auth_email text;
alter table public.company_members add column if not exists display_name text;
alter table public.company_members add column if not exists phone text;
alter table public.company_members add column if not exists access_sections text[] not null default '{}';
alter table public.company_members add column if not exists project_ids text[] not null default '{}';
alter table public.company_members add column if not exists status text not null default 'active';
alter table public.projects add column if not exists owner text;
alter table public.projects add column if not exists team text[] not null default '{}';
alter table public.projects add column if not exists note text;
alter table public.projects add column if not exists cover_image jsonb;
alter table public.projects add column if not exists customer_name text;
alter table public.projects add column if not exists customer_phone text;
alter table public.projects add column if not exists customer_email text;
alter table public.projects add column if not exists customer_line_id text;
alter table public.projects add column if not exists site_address text;
alter table public.projects add column if not exists site_contact text;
alter table public.projects add column if not exists main_contract numeric not null default 0;
alter table public.projects add column if not exists variation_order numeric not null default 0;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists due_date date;
alter table public.boq_items add column if not exists name text not null default '';
alter table public.boq_items add column if not exists progress numeric not null default 0;
alter table public.daily_reports add column if not exists prepared_by text;
alter table public.daily_reports add column if not exists prepared_by_phone text;
alter table public.daily_reports add column if not exists completed_work text;
alter table public.daily_reports add column if not exists ongoing_work text;
alter table public.daily_reports add column if not exists problems text;
alter table public.daily_reports add column if not exists materials text;
alter table public.daily_reports add column if not exists next_plan text;
alter table public.daily_reports add column if not exists customer_note text;
alter table public.daily_reports add column if not exists internal_note text;
alter table public.daily_reports add column if not exists problem_issues jsonb not null default '[]'::jsonb;
alter table public.daily_reports add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.daily_report_workers add column if not exists name text;
alter table public.daily_report_workers add column if not exists crew_id uuid;
alter table public.daily_report_workers add column if not exists trade text;
alter table public.daily_report_workers add column if not exists count numeric not null default 1;
alter table public.daily_report_workers add column if not exists start_time time;
alter table public.daily_report_workers add column if not exists end_time time;
alter table public.daily_report_workers add column if not exists task_title text;
alter table public.daily_report_workers add column if not exists task_status text not null default 'ดำเนินการ';
alter table public.daily_report_workers add column if not exists note text;
alter table public.daily_report_progress_updates add column if not exists category_id text;
alter table public.daily_report_progress_updates add column if not exists item_id text;
alter table public.daily_report_progress_updates add column if not exists title text;
alter table public.daily_report_progress_updates add column if not exists previous_progress numeric not null default 0;
alter table public.daily_report_progress_updates add column if not exists new_progress numeric not null default 0;
alter table public.daily_report_progress_updates add column if not exists note text;
alter table public.personal_schedule_events add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.personal_schedule_events add column if not exists event_date date;
alter table public.personal_schedule_events add column if not exists start_time time;
alter table public.personal_schedule_events add column if not exists title text;
alter table public.personal_schedule_events add column if not exists detail text not null default '';
alter table public.hr_crews add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.hr_crews add column if not exists leader_name text;
alter table public.hr_crews add column if not exists national_id text;
alter table public.hr_crews add column if not exists phone text;
alter table public.hr_crews add column if not exists work_types text[] not null default '{}';
alter table public.hr_crews add column if not exists note text;
alter table public.hr_crews add column if not exists status text not null default 'active';
alter table public.hr_crews add column if not exists created_at timestamptz not null default now();
alter table public.hr_crews add column if not exists updated_at timestamptz not null default now();
alter table public.hr_labor_expenses add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.hr_labor_expenses add column if not exists crew_id uuid references public.hr_crews(id) on delete cascade;
alter table public.hr_labor_expenses add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.hr_labor_expenses add column if not exists expense_date date;
alter table public.hr_labor_expenses add column if not exists work_type text;
alter table public.hr_labor_expenses add column if not exists description text not null default '';
alter table public.hr_labor_expenses add column if not exists amount numeric not null default 0;
alter table public.hr_labor_expenses add column if not exists note text;
alter table public.hr_labor_expenses add column if not exists created_at timestamptz not null default now();
alter table public.hr_labor_expenses add column if not exists updated_at timestamptz not null default now();
alter table public.buyin_entries add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.buyin_entries add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.buyin_entries add column if not exists entry_date date;
alter table public.buyin_entries add column if not exists type text;
alter table public.buyin_entries add column if not exists store_name text;
alter table public.buyin_entries add column if not exists vendor_name text;
alter table public.buyin_entries add column if not exists vendor_tax_id text;
alter table public.buyin_entries add column if not exists description text;
alter table public.buyin_entries add column if not exists category text;
alter table public.buyin_entries add column if not exists amount_paid numeric not null default 0;
alter table public.buyin_entries add column if not exists include_vat boolean not null default false;
alter table public.buyin_entries add column if not exists net_amount numeric not null default 0;
alter table public.buyin_entries add column if not exists vat_amount numeric not null default 0;
alter table public.buyin_entries add column if not exists note text;
alter table public.buyin_entries add column if not exists created_at timestamptz not null default now();
alter table public.buyin_entries add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_report_workers_task_status_check'
      and conrelid = 'public.daily_report_workers'::regclass
  ) then
    alter table public.daily_report_workers
      add constraint daily_report_workers_task_status_check check (task_status in ('ดำเนินการ', 'แก้ไข', 'เสร็จ'));
  end if;
end;
$$;

create index if not exists company_members_company_id_idx on public.company_members(company_id);
create index if not exists company_members_user_id_idx on public.company_members(user_id);
create unique index if not exists company_members_login_id_unique_idx on public.company_members(login_id) where login_id is not null;
create index if not exists company_members_auth_user_id_idx on public.company_members(auth_user_id);
create index if not exists company_members_project_ids_idx on public.company_members using gin(project_ids);
create index if not exists company_members_role_idx on public.company_members(role);

create index if not exists projects_company_id_idx on public.projects(company_id);

create index if not exists boq_categories_company_id_idx on public.boq_categories(company_id);
create index if not exists boq_categories_project_id_idx on public.boq_categories(project_id);

create index if not exists boq_items_company_id_idx on public.boq_items(company_id);
create index if not exists boq_items_project_id_idx on public.boq_items(project_id);
create index if not exists boq_items_category_id_idx on public.boq_items(category_id);

create index if not exists daily_reports_company_id_idx on public.daily_reports(company_id);
create index if not exists daily_reports_project_id_idx on public.daily_reports(project_id);
create index if not exists daily_reports_report_date_idx on public.daily_reports(report_date);

create index if not exists daily_report_workers_company_id_idx on public.daily_report_workers(company_id);
create index if not exists daily_report_workers_project_id_idx on public.daily_report_workers(project_id);
create index if not exists daily_report_workers_report_id_idx on public.daily_report_workers(report_id);
create index if not exists daily_report_workers_crew_id_idx on public.daily_report_workers(crew_id);

create index if not exists hr_crews_company_id_idx on public.hr_crews(company_id);
create index if not exists hr_crews_status_idx on public.hr_crews(status);

create index if not exists hr_labor_expenses_company_id_idx on public.hr_labor_expenses(company_id);
create index if not exists hr_labor_expenses_crew_id_idx on public.hr_labor_expenses(crew_id);
create index if not exists hr_labor_expenses_project_id_idx on public.hr_labor_expenses(project_id);
create index if not exists hr_labor_expenses_expense_date_idx on public.hr_labor_expenses(expense_date);

create index if not exists buyin_entries_company_id_idx on public.buyin_entries(company_id);
create index if not exists buyin_entries_project_id_idx on public.buyin_entries(project_id);
create index if not exists buyin_entries_entry_date_idx on public.buyin_entries(entry_date);
create index if not exists buyin_entries_type_idx on public.buyin_entries(type);
create index if not exists buyin_entries_vendor_name_idx on public.buyin_entries(vendor_name);
create index if not exists buyin_entries_store_name_idx on public.buyin_entries(store_name);
create index if not exists buyin_entries_vendor_tax_id_idx on public.buyin_entries(vendor_tax_id);

create index if not exists daily_report_progress_updates_company_id_idx on public.daily_report_progress_updates(company_id);
create index if not exists daily_report_progress_updates_project_id_idx on public.daily_report_progress_updates(project_id);
create index if not exists daily_report_progress_updates_report_id_idx on public.daily_report_progress_updates(report_id);

create index if not exists payment_milestones_company_id_idx on public.payment_milestones(company_id);
create index if not exists payment_milestones_project_id_idx on public.payment_milestones(project_id);

create index if not exists project_timeline_events_company_id_idx on public.project_timeline_events(company_id);
create index if not exists project_timeline_events_project_id_idx on public.project_timeline_events(project_id);
create index if not exists personal_schedule_events_user_date_time_idx on public.personal_schedule_events(user_id, event_date, start_time);

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at before update on public.companies for each row execute function public.set_updated_at();

drop trigger if exists set_company_members_updated_at on public.company_members;
create trigger set_company_members_updated_at before update on public.company_members for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists set_boq_categories_updated_at on public.boq_categories;
create trigger set_boq_categories_updated_at before update on public.boq_categories for each row execute function public.set_updated_at();

drop trigger if exists set_boq_items_updated_at on public.boq_items;
create trigger set_boq_items_updated_at before update on public.boq_items for each row execute function public.set_updated_at();

drop trigger if exists set_daily_reports_updated_at on public.daily_reports;
create trigger set_daily_reports_updated_at before update on public.daily_reports for each row execute function public.set_updated_at();

drop trigger if exists set_daily_report_workers_updated_at on public.daily_report_workers;
create trigger set_daily_report_workers_updated_at before update on public.daily_report_workers for each row execute function public.set_updated_at();

drop trigger if exists set_hr_crews_updated_at on public.hr_crews;
create trigger set_hr_crews_updated_at before update on public.hr_crews for each row execute function public.set_updated_at();

drop trigger if exists set_hr_labor_expenses_updated_at on public.hr_labor_expenses;
create trigger set_hr_labor_expenses_updated_at before update on public.hr_labor_expenses for each row execute function public.set_updated_at();

drop trigger if exists set_buyin_entries_updated_at on public.buyin_entries;
create trigger set_buyin_entries_updated_at before update on public.buyin_entries for each row execute function public.set_updated_at();

drop trigger if exists set_daily_report_progress_updates_updated_at on public.daily_report_progress_updates;
create trigger set_daily_report_progress_updates_updated_at before update on public.daily_report_progress_updates for each row execute function public.set_updated_at();

drop trigger if exists set_payment_milestones_updated_at on public.payment_milestones;
create trigger set_payment_milestones_updated_at before update on public.payment_milestones for each row execute function public.set_updated_at();

drop trigger if exists set_project_timeline_events_updated_at on public.project_timeline_events;
create trigger set_project_timeline_events_updated_at before update on public.project_timeline_events for each row execute function public.set_updated_at();

drop trigger if exists set_personal_schedule_events_updated_at on public.personal_schedule_events;
create trigger set_personal_schedule_events_updated_at before update on public.personal_schedule_events for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.projects enable row level security;
alter table public.boq_categories enable row level security;
alter table public.boq_items enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_report_workers enable row level security;
alter table public.hr_crews enable row level security;
alter table public.hr_labor_expenses enable row level security;
alter table public.buyin_entries enable row level security;
alter table public.daily_report_progress_updates enable row level security;
alter table public.payment_milestones enable row level security;
alter table public.project_timeline_events enable row level security;
alter table public.personal_schedule_events enable row level security;

drop policy if exists personal_schedule_events_select_own on public.personal_schedule_events;
create policy personal_schedule_events_select_own
on public.personal_schedule_events
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists personal_schedule_events_insert_own on public.personal_schedule_events;
create policy personal_schedule_events_insert_own
on public.personal_schedule_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists personal_schedule_events_update_own on public.personal_schedule_events;
create policy personal_schedule_events_update_own
on public.personal_schedule_events
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists personal_schedule_events_delete_own on public.personal_schedule_events;
create policy personal_schedule_events_delete_own
on public.personal_schedule_events
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.personal_schedule_events to authenticated;

notify pgrst, 'reload schema';

comment on table public.companies is 'Future Phase 3+ access should require a matching active company_members row for auth.uid().';
comment on table public.company_members is 'Source of truth for owner/admin/project_manager/site_supervisor/office_staff/worker/viewer membership.';
comment on table public.projects is 'All business records are company-scoped. Production RLS should join company_members by company_id and auth.uid().';
comment on table public.daily_reports is 'Daily Report is the heart of PCON. Production RLS should allow active members and later role-based write restrictions.';
comment on table public.hr_crews is 'HR-1 crew leader/payment receiver registry. Contains personal national_id data; Future policy: allow access through public.company_members by company_id and role.';
comment on table public.hr_labor_expenses is 'HR-1 labor expense records. Keep expenses out of Daily Report; Future policy: allow access through public.company_members by company_id and role.';
comment on table public.buyin_entries is 'BUYIN-1 purchasing and vendor invoice records. Keep BUYIN accounting data out of Daily Report; Future policy: allow access through public.company_members by company_id and role.';
comment on table public.personal_schedule_events is 'PCON v1.1 personal user-owned schedule items. These are not company, project, or Daily Report records.';
comment on table public.payment_milestones is 'Future accounting foundation. Keep records company-scoped and project-scoped before adding invoice/payment screens.';
comment on table public.project_timeline_events is 'Future planning foundation. Keep company_id/project_id boundaries compatible with later HR scheduling and accounting reports.';

comment on column public.daily_reports.problem_issues is 'Phase 1/2 compatibility payload for structured problem cards and per-issue photo metadata.';
comment on column public.daily_reports.photos is 'Phase 1/2 compatibility payload for local-first report photos. Consider Supabase Storage in later phases.';
comment on column public.hr_crews.national_id is 'Personal data. Mask in UI lists and restrict with company_members RLS before production cloud sync.';

-- RLS direction for production:
-- 1. A user can access a company only if there is an active row in public.company_members
--    where company_members.company_id = target company id
--    and company_members.user_id = auth.uid()
--    and company_members.status = 'active'.
-- 2. owner has full access, admin manages company data, project_manager manages projects and reports,
--    site_supervisor manages daily reports/progress, viewer is read-only.
-- 3. Do not use raw_user_meta_data / user_metadata in authorization decisions.
-- 4. Do not expose service_role to the frontend. Use anon key only in client code.
-- 5. No permissive public write policies are created here on purpose.
-- 6. Future HR/accounting tables should include company_id, optional project_id, created_by,
--    updated_by, created_at, updated_at, and RLS based on active company_members.
