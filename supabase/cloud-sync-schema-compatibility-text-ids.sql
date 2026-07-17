-- PCON Cloud Sync compatibility patch for existing databases that use text IDs.
-- Use this when companies.id is text and a uuid foreign-key patch fails with:
-- "foreign key constraint ... cannot be implemented ... uuid and text".
--
-- Safe behavior:
-- - No DROP
-- - No TRUNCATE/RESET
-- - No unsafe public write policies
-- - Keeps app/local IDs as text so existing PCON cloud rows remain compatible

alter table public.company_members add column if not exists phone text;

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
alter table public.daily_report_workers add column if not exists crew_id text;
alter table public.daily_report_workers add column if not exists trade text;
alter table public.daily_report_workers add column if not exists count numeric not null default 1;
alter table public.daily_report_workers add column if not exists start_time time;
alter table public.daily_report_workers add column if not exists end_time time;
alter table public.daily_report_workers add column if not exists task_title text;
alter table public.daily_report_workers add column if not exists task_status text not null default 'ดำเนินการ';
alter table public.daily_report_workers add column if not exists note text;

create table if not exists public.hr_crews (
  id text primary key,
  company_id text not null,
  leader_name text not null default '',
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
  id text primary key,
  company_id text not null,
  crew_id text not null,
  project_id text,
  expense_date date not null default current_date,
  work_type text,
  description text not null default '',
  amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_labor_expenses_amount_non_negative_check check (amount >= 0)
);

create table if not exists public.buyin_entries (
  id text primary key,
  company_id text not null,
  project_id text,
  entry_date date not null default current_date,
  type text not null default 'expense',
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

alter table public.hr_crews add column if not exists company_id text;
alter table public.hr_crews add column if not exists leader_name text;
alter table public.hr_crews add column if not exists national_id text;
alter table public.hr_crews add column if not exists phone text;
alter table public.hr_crews add column if not exists work_types text[] not null default '{}';
alter table public.hr_crews add column if not exists note text;
alter table public.hr_crews add column if not exists status text not null default 'active';
alter table public.hr_crews add column if not exists created_at timestamptz not null default now();
alter table public.hr_crews add column if not exists updated_at timestamptz not null default now();

alter table public.hr_labor_expenses add column if not exists company_id text;
alter table public.hr_labor_expenses add column if not exists crew_id text;
alter table public.hr_labor_expenses add column if not exists project_id text;
alter table public.hr_labor_expenses add column if not exists expense_date date;
alter table public.hr_labor_expenses add column if not exists work_type text;
alter table public.hr_labor_expenses add column if not exists description text not null default '';
alter table public.hr_labor_expenses add column if not exists amount numeric not null default 0;
alter table public.hr_labor_expenses add column if not exists note text;
alter table public.hr_labor_expenses add column if not exists created_at timestamptz not null default now();
alter table public.hr_labor_expenses add column if not exists updated_at timestamptz not null default now();

alter table public.buyin_entries add column if not exists company_id text;
alter table public.buyin_entries add column if not exists project_id text;
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

alter table public.hr_crews enable row level security;
alter table public.hr_labor_expenses enable row level security;
alter table public.buyin_entries enable row level security;

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

comment on table public.hr_crews is 'HR-1 crew registry for PCON local-first cloud sync. Uses text IDs for compatibility with existing cloud data.';
comment on table public.hr_labor_expenses is 'HR-1 labor expenses for PCON local-first cloud sync. Uses text IDs for compatibility with existing cloud data.';
comment on table public.buyin_entries is 'BUYIN-1 purchasing and vendor invoice records for PCON local-first cloud sync. Uses text IDs for compatibility with existing cloud data.';

notify pgrst, 'reload schema';
