-- PCON AUTH-1: Supabase email/password, onboarding, platform admin, company requests, and company codes.
-- Safe patch: no drop/reset and no permissive public write policies.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  display_name text,
  phone text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_status_check check (status in ('active', 'disabled'))
);

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_code text unique,
  role text not null default 'super_admin',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admins_status_check check (status in ('active', 'disabled'))
);

create table if not exists public.company_registration_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text,
  company_name text not null,
  company_tax_id text,
  contact_name text,
  contact_phone text,
  contact_email text,
  note text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  approved_company_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_registration_requests_status_check check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.company_codes (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  code text unique not null,
  default_role text not null default 'site_supervisor',
  status text not null default 'active',
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_codes_default_role_check check (default_role in ('owner', 'admin', 'project_manager', 'site_supervisor', 'office_staff', 'worker', 'viewer')),
  constraint company_codes_status_check check (status in ('active', 'inactive', 'expired')),
  constraint company_codes_used_count_check check (used_count >= 0)
);

create table if not exists public.company_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  company_code_id uuid not null references public.company_codes(id) on delete cascade,
  company_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  constraint company_code_redemptions_code_user_unique unique (company_code_id, user_id)
);

alter table public.companies add column if not exists tax_id text;
alter table public.companies add column if not exists contact_name text;
alter table public.companies add column if not exists contact_email text;
alter table public.companies add column if not exists contact_phone text;
alter table public.companies add column if not exists status text not null default 'active';
alter table public.company_members add column if not exists auth_user_id text;
alter table public.company_members add column if not exists auth_email text;
alter table public.company_members add column if not exists phone text;
alter table public.company_members add column if not exists access_sections text[] not null default '{}';
alter table public.company_members add column if not exists project_ids text[] not null default '{}';

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists platform_admins_user_id_idx on public.platform_admins(user_id);
create index if not exists platform_admins_admin_code_idx on public.platform_admins(admin_code);
create index if not exists company_registration_requests_status_idx on public.company_registration_requests(status);
create index if not exists company_registration_requests_requester_user_id_idx on public.company_registration_requests(requester_user_id);
create index if not exists company_codes_company_id_idx on public.company_codes(company_id);
create index if not exists company_codes_code_idx on public.company_codes(code);
create index if not exists company_codes_status_idx on public.company_codes(status);
create index if not exists company_code_redemptions_user_id_idx on public.company_code_redemptions(user_id);

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.company_registration_requests enable row level security;
alter table public.company_codes enable row level security;
alter table public.company_code_redemptions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists company_registration_requests_insert_own on public.company_registration_requests;
create policy company_registration_requests_insert_own on public.company_registration_requests for insert to authenticated with check ((select auth.uid()) = requester_user_id);

drop policy if exists company_registration_requests_select_own on public.company_registration_requests;
create policy company_registration_requests_select_own on public.company_registration_requests for select to authenticated using ((select auth.uid()) = requester_user_id);

comment on table public.platform_admins is 'AUTH-1 platform admin registry. admin001 is represented by admin_code and user_id, never by a frontend password.';
comment on table public.company_codes is 'AUTH-1 join codes. Users redeem via server API; do not expose all codes publicly.';
comment on table public.company_registration_requests is 'AUTH-1 onboarding requests waiting for platform admin approval.';

notify pgrst, 'reload schema';
