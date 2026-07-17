-- PCON Supabase storage security hardening for the standard UUID schema.
--
-- Run after project-control-schema.sql. This migration is idempotent, keeps
-- existing rows, and is intentionally separate from the text-ID compatibility
-- patch. Service-role/secret-key server requests continue to bypass RLS; the
-- policies below protect authenticated direct access as defense in depth.

create or replace function public.is_active_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members as member
    where member.company_id = target_company_id
      and (
        member.user_id = (select auth.uid())
        or member.auth_user_id = (select auth.uid())::text
      )
      and member.status = 'active'
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, target_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members as member
    where member.company_id = target_company_id
      and (
        member.user_id = (select auth.uid())
        or member.auth_user_id = (select auth.uid())::text
      )
      and member.status = 'active'
      and member.role = any(target_roles)
  );
$$;

create or replace function public.has_company_section(target_company_id uuid, target_section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members as member
    where member.company_id = target_company_id
      and (
        member.user_id = (select auth.uid())
        or member.auth_user_id = (select auth.uid())::text
      )
      and member.status = 'active'
      and (
        member.role in ('owner', 'admin')
        or target_section = any(member.access_sections)
      )
  );
$$;

create or replace function public.has_project_section(
  target_company_id uuid,
  target_project_id uuid,
  target_section text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members as member
    where member.company_id = target_company_id
      and (
        member.user_id = (select auth.uid())
        or member.auth_user_id = (select auth.uid())::text
      )
      and member.status = 'active'
      and (
        member.role in ('owner', 'admin')
        or (
          target_project_id::text = any(member.project_ids)
          and target_section = any(member.access_sections)
        )
      )
  );
$$;

revoke all on function public.is_active_company_member(uuid) from public;
revoke all on function public.has_company_role(uuid, text[]) from public;
revoke all on function public.has_company_section(uuid, text) from public;
revoke all on function public.has_project_section(uuid, uuid, text) from public;
grant execute on function public.is_active_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, text[]) to authenticated;
grant execute on function public.has_company_section(uuid, text) to authenticated;
grant execute on function public.has_project_section(uuid, uuid, text) to authenticated;

create index if not exists company_members_company_user_status_idx
  on public.company_members(company_id, user_id, status);
create index if not exists company_members_company_auth_user_status_idx
  on public.company_members(company_id, auth_user_id, status);
create index if not exists company_members_project_ids_gin_idx
  on public.company_members using gin(project_ids);
create index if not exists projects_company_id_id_idx
  on public.projects(company_id, id);
create index if not exists boq_categories_company_project_idx
  on public.boq_categories(company_id, project_id);
create index if not exists boq_items_company_project_idx
  on public.boq_items(company_id, project_id);
create index if not exists daily_reports_company_project_idx
  on public.daily_reports(company_id, project_id);
create index if not exists daily_report_workers_company_report_idx
  on public.daily_report_workers(company_id, report_id);
create index if not exists daily_report_progress_company_report_idx
  on public.daily_report_progress_updates(company_id, report_id);
create index if not exists hr_crews_company_status_idx
  on public.hr_crews(company_id, status);
create index if not exists hr_labor_expenses_company_project_idx
  on public.hr_labor_expenses(company_id, project_id);
create index if not exists buyin_entries_company_project_idx
  on public.buyin_entries(company_id, project_id);

-- Existing primary keys guarantee uniqueness for each id. These composite
-- unique indexes let PostgreSQL enforce company/parent consistency without
-- rewriting or deleting legacy rows. NOT VALID keeps this migration safe for
-- an existing database while enforcing the relationship for new writes.
create unique index if not exists projects_company_id_id_unique_idx
  on public.projects(company_id, id);
create unique index if not exists boq_categories_company_project_id_unique_idx
  on public.boq_categories(company_id, project_id, id);
create unique index if not exists daily_reports_company_project_id_unique_idx
  on public.daily_reports(company_id, project_id, id);
create unique index if not exists hr_crews_company_id_unique_idx
  on public.hr_crews(company_id, id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'boq_categories_company_project_fk') then
    alter table public.boq_categories
      add constraint boq_categories_company_project_fk
      foreign key (company_id, project_id)
      references public.projects(company_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'boq_items_company_project_fk') then
    alter table public.boq_items
      add constraint boq_items_company_project_fk
      foreign key (company_id, project_id)
      references public.projects(company_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'boq_items_company_project_category_fk') then
    alter table public.boq_items
      add constraint boq_items_company_project_category_fk
      foreign key (company_id, project_id, category_id)
      references public.boq_categories(company_id, project_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'daily_reports_company_project_fk') then
    alter table public.daily_reports
      add constraint daily_reports_company_project_fk
      foreign key (company_id, project_id)
      references public.projects(company_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'daily_report_workers_company_project_report_fk') then
    alter table public.daily_report_workers
      add constraint daily_report_workers_company_project_report_fk
      foreign key (company_id, project_id, report_id)
      references public.daily_reports(company_id, project_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'daily_report_progress_company_project_report_fk') then
    alter table public.daily_report_progress_updates
      add constraint daily_report_progress_company_project_report_fk
      foreign key (company_id, project_id, report_id)
      references public.daily_reports(company_id, project_id, id)
      on delete cascade
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'hr_labor_expenses_company_crew_fk') then
    alter table public.hr_labor_expenses
      add constraint hr_labor_expenses_company_crew_fk
      foreign key (company_id, crew_id)
      references public.hr_crews(company_id, id)
      on delete cascade
      not valid;
  end if;
end;
$$;

alter table public.companies enable row level security;
-- Keep this table enabled even when the migration is applied to a legacy
-- database that did not enable RLS in its original schema. Do not FORCE RLS
-- here: the security-definer membership helpers intentionally read this
-- table to evaluate the caller's membership without recursive policy checks.
alter table public.company_members enable row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.boq_categories enable row level security;
alter table public.boq_categories force row level security;
alter table public.boq_items enable row level security;
alter table public.boq_items force row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_reports force row level security;
alter table public.daily_report_workers enable row level security;
alter table public.daily_report_workers force row level security;
alter table public.daily_report_progress_updates enable row level security;
alter table public.daily_report_progress_updates force row level security;
alter table public.hr_crews enable row level security;
alter table public.hr_crews force row level security;
alter table public.hr_labor_expenses enable row level security;
alter table public.hr_labor_expenses force row level security;
alter table public.buyin_entries enable row level security;
alter table public.buyin_entries force row level security;
alter table public.payment_milestones enable row level security;
alter table public.payment_milestones force row level security;
alter table public.project_timeline_events enable row level security;
alter table public.project_timeline_events force row level security;

revoke all on public.companies from anon;
revoke all on public.company_members from anon;
revoke all on public.projects from anon;
revoke all on public.boq_categories from anon;
revoke all on public.boq_items from anon;
revoke all on public.daily_reports from anon;
revoke all on public.daily_report_workers from anon;
revoke all on public.daily_report_progress_updates from anon;
revoke all on public.hr_crews from anon;
revoke all on public.hr_labor_expenses from anon;
revoke all on public.buyin_entries from anon;
revoke all on public.payment_milestones from anon;
revoke all on public.project_timeline_events from anon;

grant select, insert, update, delete on public.companies to authenticated;
grant select, update on public.company_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.boq_categories to authenticated;
grant select, insert, update, delete on public.boq_items to authenticated;
grant select, insert, update, delete on public.daily_reports to authenticated;
grant select, insert, update, delete on public.daily_report_workers to authenticated;
grant select, insert, update, delete on public.daily_report_progress_updates to authenticated;
grant select, insert, update, delete on public.hr_crews to authenticated;
grant select, insert, update, delete on public.hr_labor_expenses to authenticated;
grant select, insert, update, delete on public.buyin_entries to authenticated;
grant select, insert, update, delete on public.payment_milestones to authenticated;
grant select, insert, update, delete on public.project_timeline_events to authenticated;

drop policy if exists companies_member_select on public.companies;
create policy companies_member_select
on public.companies
for select to authenticated
using (public.is_active_company_member(id));

drop policy if exists companies_admin_update on public.companies;
create policy companies_admin_update
on public.companies
for update to authenticated
using (public.has_company_role(id, array['owner', 'admin']::text[]))
with check (public.has_company_role(id, array['owner', 'admin']::text[]));

drop policy if exists company_members_self_or_admin_select on public.company_members;
create policy company_members_self_or_admin_select
on public.company_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or auth_user_id = (select auth.uid())::text
  or public.has_company_role(company_id, array['owner', 'admin']::text[])
);

drop policy if exists company_members_admin_update on public.company_members;
create policy company_members_admin_update
on public.company_members
for update to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]))
with check (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists projects_member_select on public.projects;
create policy projects_member_select
on public.projects
for select to authenticated
using (public.has_project_section(company_id, id, 'project'));

drop policy if exists projects_member_insert on public.projects;
create policy projects_member_insert
on public.projects
for insert to authenticated
with check (public.has_company_section(company_id, 'project'));

drop policy if exists projects_member_update on public.projects;
create policy projects_member_update
on public.projects
for update to authenticated
using (public.has_project_section(company_id, id, 'project'))
with check (public.has_project_section(company_id, id, 'project'));

drop policy if exists projects_owner_delete on public.projects;
create policy projects_owner_delete
on public.projects
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists boq_categories_member_select on public.boq_categories;
create policy boq_categories_member_select
on public.boq_categories
for select to authenticated
using (public.has_project_section(company_id, project_id, 'boq'));

drop policy if exists boq_categories_member_write on public.boq_categories;
create policy boq_categories_member_write
on public.boq_categories
for insert to authenticated
with check (public.has_project_section(company_id, project_id, 'boq'));

drop policy if exists boq_categories_member_update on public.boq_categories;
create policy boq_categories_member_update
on public.boq_categories
for update to authenticated
using (public.has_project_section(company_id, project_id, 'boq'))
with check (public.has_project_section(company_id, project_id, 'boq'));

drop policy if exists boq_categories_owner_delete on public.boq_categories;
create policy boq_categories_owner_delete
on public.boq_categories
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists boq_items_member_select on public.boq_items;
create policy boq_items_member_select
on public.boq_items
for select to authenticated
using (public.has_project_section(company_id, project_id, 'boq'));

drop policy if exists boq_items_member_write on public.boq_items;
create policy boq_items_member_write
on public.boq_items
for insert to authenticated
with check (public.has_project_section(company_id, project_id, 'boq'));

drop policy if exists boq_items_member_update on public.boq_items;
create policy boq_items_member_update
on public.boq_items
for update to authenticated
using (public.has_project_section(company_id, project_id, 'boq'))
with check (public.has_project_section(company_id, project_id, 'boq'));

drop policy if exists boq_items_owner_delete on public.boq_items;
create policy boq_items_owner_delete
on public.boq_items
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists daily_reports_member_select on public.daily_reports;
create policy daily_reports_member_select
on public.daily_reports
for select to authenticated
using (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_reports_member_write on public.daily_reports;
create policy daily_reports_member_write
on public.daily_reports
for insert to authenticated
with check (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_reports_member_update on public.daily_reports;
create policy daily_reports_member_update
on public.daily_reports
for update to authenticated
using (public.has_project_section(company_id, project_id, 'daily_report'))
with check (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_reports_owner_delete on public.daily_reports;
create policy daily_reports_owner_delete
on public.daily_reports
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists daily_report_workers_member_select on public.daily_report_workers;
create policy daily_report_workers_member_select
on public.daily_report_workers
for select to authenticated
using (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_report_workers_member_write on public.daily_report_workers;
create policy daily_report_workers_member_write
on public.daily_report_workers
for insert to authenticated
with check (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_report_workers_member_update on public.daily_report_workers;
create policy daily_report_workers_member_update
on public.daily_report_workers
for update to authenticated
using (public.has_project_section(company_id, project_id, 'daily_report'))
with check (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_report_workers_owner_delete on public.daily_report_workers;
create policy daily_report_workers_owner_delete
on public.daily_report_workers
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists daily_report_progress_member_select on public.daily_report_progress_updates;
create policy daily_report_progress_member_select
on public.daily_report_progress_updates
for select to authenticated
using (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_report_progress_member_write on public.daily_report_progress_updates;
create policy daily_report_progress_member_write
on public.daily_report_progress_updates
for insert to authenticated
with check (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_report_progress_member_update on public.daily_report_progress_updates;
create policy daily_report_progress_member_update
on public.daily_report_progress_updates
for update to authenticated
using (public.has_project_section(company_id, project_id, 'daily_report'))
with check (public.has_project_section(company_id, project_id, 'daily_report'));

drop policy if exists daily_report_progress_owner_delete on public.daily_report_progress_updates;
create policy daily_report_progress_owner_delete
on public.daily_report_progress_updates
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists hr_crews_member_select on public.hr_crews;
create policy hr_crews_member_select
on public.hr_crews
for select to authenticated
using (public.has_company_section(company_id, 'hr'));

drop policy if exists hr_crews_member_write on public.hr_crews;
create policy hr_crews_member_write
on public.hr_crews
for insert to authenticated
with check (public.has_company_section(company_id, 'hr'));

drop policy if exists hr_crews_member_update on public.hr_crews;
create policy hr_crews_member_update
on public.hr_crews
for update to authenticated
using (public.has_company_section(company_id, 'hr'))
with check (public.has_company_section(company_id, 'hr'));

drop policy if exists hr_crews_owner_delete on public.hr_crews;
create policy hr_crews_owner_delete
on public.hr_crews
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists hr_labor_expenses_member_select on public.hr_labor_expenses;
create policy hr_labor_expenses_member_select
on public.hr_labor_expenses
for select to authenticated
using (
  public.has_company_section(company_id, 'hr')
  and (project_id is null or public.has_project_section(company_id, project_id, 'hr'))
);

drop policy if exists hr_labor_expenses_member_write on public.hr_labor_expenses;
create policy hr_labor_expenses_member_write
on public.hr_labor_expenses
for insert to authenticated
with check (
  public.has_company_section(company_id, 'hr')
  and (project_id is null or public.has_project_section(company_id, project_id, 'hr'))
);

drop policy if exists hr_labor_expenses_member_update on public.hr_labor_expenses;
create policy hr_labor_expenses_member_update
on public.hr_labor_expenses
for update to authenticated
using (
  public.has_company_section(company_id, 'hr')
  and (project_id is null or public.has_project_section(company_id, project_id, 'hr'))
)
with check (
  public.has_company_section(company_id, 'hr')
  and (project_id is null or public.has_project_section(company_id, project_id, 'hr'))
);

drop policy if exists hr_labor_expenses_owner_delete on public.hr_labor_expenses;
create policy hr_labor_expenses_owner_delete
on public.hr_labor_expenses
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists buyin_entries_member_select on public.buyin_entries;
create policy buyin_entries_member_select
on public.buyin_entries
for select to authenticated
using (
  public.has_company_section(company_id, 'buyin')
  and (project_id is null or public.has_project_section(company_id, project_id, 'buyin'))
);

drop policy if exists buyin_entries_member_write on public.buyin_entries;
create policy buyin_entries_member_write
on public.buyin_entries
for insert to authenticated
with check (
  public.has_company_section(company_id, 'buyin')
  and (project_id is null or public.has_project_section(company_id, project_id, 'buyin'))
);

drop policy if exists buyin_entries_member_update on public.buyin_entries;
create policy buyin_entries_member_update
on public.buyin_entries
for update to authenticated
using (
  public.has_company_section(company_id, 'buyin')
  and (project_id is null or public.has_project_section(company_id, project_id, 'buyin'))
)
with check (
  public.has_company_section(company_id, 'buyin')
  and (project_id is null or public.has_project_section(company_id, project_id, 'buyin'))
);

drop policy if exists buyin_entries_owner_delete on public.buyin_entries;
create policy buyin_entries_owner_delete
on public.buyin_entries
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists payment_milestones_member_select on public.payment_milestones;
create policy payment_milestones_member_select
on public.payment_milestones
for select to authenticated
using (public.has_project_section(company_id, project_id, 'project'));

drop policy if exists payment_milestones_member_write on public.payment_milestones;
create policy payment_milestones_member_write
on public.payment_milestones
for insert to authenticated
with check (public.has_project_section(company_id, project_id, 'project'));

drop policy if exists payment_milestones_member_update on public.payment_milestones;
create policy payment_milestones_member_update
on public.payment_milestones
for update to authenticated
using (public.has_project_section(company_id, project_id, 'project'))
with check (public.has_project_section(company_id, project_id, 'project'));

drop policy if exists payment_milestones_owner_delete on public.payment_milestones;
create policy payment_milestones_owner_delete
on public.payment_milestones
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

drop policy if exists project_timeline_events_member_select on public.project_timeline_events;
create policy project_timeline_events_member_select
on public.project_timeline_events
for select to authenticated
using (public.has_project_section(company_id, project_id, 'project'));

drop policy if exists project_timeline_events_member_write on public.project_timeline_events;
create policy project_timeline_events_member_write
on public.project_timeline_events
for insert to authenticated
with check (public.has_project_section(company_id, project_id, 'project'));

drop policy if exists project_timeline_events_member_update on public.project_timeline_events;
create policy project_timeline_events_member_update
on public.project_timeline_events
for update to authenticated
using (public.has_project_section(company_id, project_id, 'project'))
with check (public.has_project_section(company_id, project_id, 'project'));

drop policy if exists project_timeline_events_owner_delete on public.project_timeline_events;
create policy project_timeline_events_owner_delete
on public.project_timeline_events
for delete to authenticated
using (public.has_company_role(company_id, array['owner', 'admin']::text[]));

notify pgrst, 'reload schema';
