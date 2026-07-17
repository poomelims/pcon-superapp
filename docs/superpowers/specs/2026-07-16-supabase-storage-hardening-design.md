# Supabase Storage Hardening Design

**Date:** 2026-07-16
**Status:** Approved by user

## Context

PCON currently uses a local-first workspace. Browser edits are written to `pcon_project_setup_data` first, then the workspace can push or pull a company snapshot through server routes. The server uses a Supabase secret/service key so browser code never receives an elevated key. The database schema already contains company-scoped tables, foreign keys, constraints, indexes, triggers, and RLS enablement.

The audit found four production gaps:

- Business tables have RLS enabled but no company/member policies; the SQL file only documents future policy direction.
- Sync writes each table sequentially, so a mid-sync failure can leave a partial cloud snapshot and there is no bounded retry for transient failures.
- The sync contract intentionally strips local base64 media, but the contract does not make the limitation visible as a first-class capability and `prepared_by_phone` is currently omitted from payload/load mapping.
- The workspace has no Supabase variables in `.env.local`, so live project verification cannot run from this checkout.

## Goals

- Preserve local-first save behavior, existing localStorage key, JSON import/export, permissions, and user-facing Project/Daily Report/HR/BUYIN flows.
- Enforce company and project isolation at the database and server authorization layers.
- Make push/pull deterministic, bounded, observable, and safe when cloud access fails.
- Preserve old cloud rows and text-ID compatibility paths without destructive migration.
- Add regression tests that prove payload completeness, scope filtering, RLS policy contracts, and local fallback.

## Non-goals

- Do not switch to cloud-first writes or silently introduce background sync.
- Do not expose `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Do not migrate report/project media to Supabase Storage in this change; existing media remains local and cloud payloads remain media-safe.
- Do not change Supabase table names, storage keys, JSON import/export shape, BOQ weighted-progress logic, HR withholding, or BUYIN VAT calculations.

## Approved architecture

### Save flow

```text
user action
  -> validate business data
  -> save localStorage (authoritative offline snapshot)
  -> push server API
       -> authenticate sync token or Supabase member session
       -> validate company/project scope
       -> upsert parent rows before child rows
       -> reconcile deletes only for owner/admin full-company access
  -> success notice or retryable cloud error while local data remains available
```

Load Cloud keeps the existing safety rule: when local work exists, save/push the local snapshot first; only then replace the active company slice with the cloud snapshot and persist it locally.

### Security boundary

- Browser uses only the public Supabase URL/anon key for Auth session handling.
- `/api/cloud-sync/*` uses the server-only secret/service key and performs member authorization before reading or writing data.
- Database RLS policies are added for authenticated direct access as defense in depth. Policies use an indexed active `company_members` lookup and `(select auth.uid())`.
- Owner/admin can operate on all company records. Non-admin members are limited to assigned project IDs, with HR access only when their access sections permit it. HR national IDs remain protected from broad public access.

### Sync reliability

- Keep table-level batch upserts and parent-before-child ordering.
- Add a small bounded retry helper for network/5xx/429-style transient failures only; validation, permission, FK, and schema errors fail immediately with the existing actionable messages.
- Keep delete reconciliation opt-in through `canDeleteMissingRows`; scoped member sync remains upsert-only.
- Add payload validation for same-company and parent-child references before issuing writes.
- Make the cloud contract round-trip `prepared_by_phone`; keep local media stripped and test that no `data:image` value crosses the API.

### Schema migration

Add an idempotent migration file separate from the original bootstrap schema. It will:

- create helper functions for active company membership and project access with a fixed `search_path`;
- drop/recreate named policies for the company-scoped core tables;
- grant only the required table operations to `authenticated` and keep service-role access server-only;
- add missing composite indexes used by policy predicates and child lookups;
- preserve existing UUID/text compatibility migrations and never drop/truncate rows.

## Error and UX behavior

- A successful local save is never rolled back because cloud sync failed.
- Retryable cloud failures show a concise retry action through the existing notice/menu flow; the retry uses the same snapshot and does not duplicate a save.
- Permission/schema/FK failures retain current Thai guidance and do not retry automatically.
- Health diagnostics report configuration, table reachability, and policy/scope status without returning secrets or customer data.

## Verification strategy

- Unit tests cover retry classification, payload round-trip, scope filtering, company isolation, parent-child validation, and local-first fallback.
- Source/schema contract tests verify named policies, grants, helper functions, and migration ordering.
- Existing full test, e2e, lint, typecheck, and build commands remain required.
- Live Supabase health/push/pull smoke testing is conditional on the user supplying valid environment variables; absence of credentials is reported rather than bypassed.
