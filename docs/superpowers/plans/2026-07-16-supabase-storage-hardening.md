# Supabase Storage Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PCON Supabase storage and sync production-safer while preserving local-first behavior, existing permissions, and all current workspace flows.

**Architecture:** Keep `pcon_project_setup_data` as the local offline snapshot and retain `/api/cloud-sync/push`, `/pull`, and `/health` as the server boundary. Add defense-in-depth database RLS, explicit payload integrity checks, bounded transient retry, and a complete scalar-field round trip without introducing automatic background sync or media Storage migration.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase JS v2, PostgreSQL SQL migrations, Vitest, Playwright.

## Global Constraints

- Preserve local-first save order: localStorage write must happen before cloud push.
- Keep storage key `pcon_project_setup_data` and existing JSON import/export compatibility.
- Do not expose service-role/secret keys to browser code.
- Do not change `ProjectControlData`, BOQ weighted progress, HR withholding, or BUYIN VAT business calculations.
- Do not migrate images to Supabase Storage in this plan; cloud payloads must remain free of base64 media.
- Do not drop, truncate, reset, or destructively rewrite existing Supabase rows.
- Keep scoped member sync upsert-only and full delete reconciliation restricted to Owner/Admin.
- Use `Asia/Bangkok` for existing date behavior and retain existing Thai error guidance.

---

### Task 1: Establish cloud contract regression tests

**Files:**
- Modify: `tests/project-storage.test.ts`
- Modify: `tests/cloud-sync-api.test.ts`
- Create: `tests/cloud-sync-reliability.test.ts`

**Interfaces:**
- Consumes: existing `createCloudSyncPayload`, `loadDataFromSupabaseWithClient`, and `runLocalFirstCloudSync` APIs.
- Produces: failing tests for `prepared_by_phone` round-trip, company/project reference validation, transient retry policy, and local-first failure behavior.

- [ ] **Step 1: Write the failing tests**

Add tests with these exact expectations:

```ts
it("round-trips the Daily Report prepared phone through the cloud payload", () => {
  const payload = createCloudSyncPayload(buildSyncData({ dailyReports: [{ ...buildPriorReport(), preparedByPhone: "081-222-3333" }] }));
  expect(payload.dailyReports[0].prepared_by_phone).toBe("081-222-3333");
});

it("rejects a payload row that references a project from another company", () => {
  expect(() => validateCloudSyncPayloadIntegrity({
    ...createCloudSyncPayload(buildSyncData()),
    dailyReports: [{ ...createCloudSyncPayload(buildSyncData()).dailyReports[0], company_id: "company-other" }]
  })).toThrow("company");
});

it("retries transient cloud failures and stops on a permanent failure", async () => {
  const operation = vi.fn()
    .mockRejectedValueOnce(new Error("fetch failed"))
    .mockResolvedValueOnce("ok");
  await expect(retryTransientCloudOperation(operation, { attempts: 2, delayMs: 0 })).resolves.toBe("ok");
  expect(operation).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/project-storage.test.ts tests/cloud-sync-reliability.test.ts`

Expected: FAIL because `prepared_by_phone`, `validateCloudSyncPayloadIntegrity`, and `retryTransientCloudOperation` are not implemented yet.

- [ ] **Step 3: Confirm the failure is feature-related**

Read the failure output and ensure there is no import/path typo. Do not change production code during this step.

- [ ] **Step 4: Leave the test files as the executable contract**

Keep assertions focused on observable payload/sync behavior; do not assert internal helper implementation details.

---

### Task 2: Add payload integrity and retry primitives

**Files:**
- Modify: `lib/project-control/storage-core.ts`
- Create: `lib/project-control/cloud-sync-reliability.ts`
- Modify: `lib/project-storage.ts` only if it is the public barrel for the new helper exports
- Test: `tests/cloud-sync-reliability.test.ts`, `tests/project-storage.test.ts`

**Interfaces:**
- Consumes: `CloudSyncPayload`, `SupabaseClient`, and existing `normalizeSupabaseErrorMessage` behavior.
- Produces: `validateCloudSyncPayloadIntegrity(payload): void`, `isTransientCloudSyncError(error): boolean`, and `retryTransientCloudOperation(operation, options?): Promise<T>`.

- [ ] **Step 1: Implement only the minimal retry helper**

Create:

```ts
export type CloudRetryOptions = { attempts?: number; delayMs?: number };

export function isTransientCloudSyncError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("fetch failed") || message.includes("network") || message.includes("timeout") || message.includes("http 429") || message.includes("http 5");
}

export async function retryTransientCloudOperation<T>(operation: () => Promise<T>, options: CloudRetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 3));
  const delayMs = Math.max(0, options.delayMs ?? 250);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransientCloudSyncError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Cloud sync failed");
}
```

- [ ] **Step 2: Add payload integrity validation**

Validate that all payload rows use `payload.company.id`, every project uses that company, every project-scoped child references a project in the payload, report workers/progress updates reference a report in the payload, and HR expenses reference an HR crew in the payload. Throw an actionable error before any Supabase write.

- [ ] **Step 3: Run focused tests and verify GREEN**

Run: `npm test -- tests/project-storage.test.ts tests/cloud-sync-reliability.test.ts`

Expected: all focused tests pass.

- [ ] **Step 4: Refactor only after GREEN**

Keep the retry helper dependency-free and cap attempts at three; keep validation pure so it can be reused by API routes and unit tests.

---

### Task 3: Complete scalar payload round-trip and safe cloud filtering

**Files:**
- Modify: `lib/project-control/storage-core.ts:900-1100, 1450-1640`
- Modify: `tests/project-storage.test.ts`
- Modify: `tests/cloud-sync-client.test.ts` if request-body assertions need the new scalar field

**Interfaces:**
- Consumes: `DailyReport.preparedByPhone`, existing legacy `workItems` normalization, and media stripping behavior.
- Produces: cloud payload/load mapping that preserves scalar data and still excludes base64 media.

- [ ] **Step 1: Update the failing contract**

Change the existing assertion that expects no `prepared_by_phone` to assert the value is present, and add a loaded-row assertion that `preparedByPhone` equals the stored cloud value.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/project-storage.test.ts -t "prepared phone|cloud data"`

Expected: FAIL because the payload currently omits the column and load mapping resets it to an empty string.

- [ ] **Step 3: Implement the minimal mapping**

Add `prepared_by_phone: report.preparedByPhone` to `createCloudSyncPayload` and map `preparedByPhone: report.prepared_by_phone ?? ""` in `loadDataFromSupabaseWithClient`. Do not add media fields or change legacy checklist normalization.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- tests/project-storage.test.ts tests/cloud-sync-client.test.ts`

Expected: focused storage/cloud-client tests pass with no base64 media in request bodies.

---

### Task 4: Add idempotent Supabase RLS and privilege migration

**Files:**
- Create: `supabase/20260716_storage_security_hardening.sql`
- Modify: `tests/supabase-schema.test.ts`
- Create: `tests/supabase-security-migration.test.ts`

**Interfaces:**
- Consumes: `companies`, `company_members`, core project-scoped tables, and the existing server-only API boundary.
- Produces: named SQL helper functions, policies, grants, and indexes that can be run repeatedly without destructive changes.

- [ ] **Step 1: Write source-contract tests first**

Assert the migration contains:

```ts
expect(sql).toContain("create or replace function public.is_active_company_member");
expect(sql).toContain("security definer");
expect(sql).toContain("set search_path = public");
expect(sql).toContain("(select auth.uid())");
expect(sql).toContain("alter table public.projects force row level security");
expect(sql).toContain("create policy projects_member_select");
expect(sql).toContain("create policy daily_reports_member_write");
expect(sql).toContain("revoke all on public.company_members from anon");
expect(sql).toContain("notify pgrst, 'reload schema'");
```

- [ ] **Step 2: Run the migration contract test and verify RED**

Run: `npm test -- tests/supabase-security-migration.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Add idempotent helper functions and policies**

Create helper functions with `security definer`, fixed search path, and indexed lookups:

```sql
create or replace function public.is_active_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.company_members m
  where m.company_id = target_company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
); $$;
```

Add named select/insert/update/delete policies for company, project, BOQ, Daily Report, worker/progress, HR, and BUYIN tables. Use project membership checks for non-admin members and role/access-section checks for writes. Add `force row level security` to business tables, minimal `authenticated` grants, and indexes on `(company_id, user_id, status)` plus project scope lookups. Use `drop policy if exists` before each `create policy`; do not drop rows or tables.

- [ ] **Step 4: Run migration source tests and inspect SQL ordering**

Run: `npm test -- tests/supabase-schema.test.ts tests/supabase-security-migration.test.ts`

Expected: PASS; compatibility columns remain before comments and policy migration ends with schema reload.

---

### Task 5: Harden server authorization and sync execution

**Files:**
- Modify: `lib/cloud-sync-auth.ts`
- Modify: `lib/project-control/storage-core.ts`
- Modify: `app/api/cloud-sync/push/route.ts`
- Modify: `app/api/cloud-sync/pull/route.ts`
- Modify: `tests/cloud-sync-api.test.ts`
- Modify: `tests/project-storage.test.ts`

**Interfaces:**
- Consumes: payload integrity validator, retry helper, existing bearer/sync-token access object, and `canDeleteMissingRows` policy.
- Produces: server-enforced company/project scope before writes and bounded transient retry around individual batch operations.

- [ ] **Step 1: Add failing authorization tests**

Cover these exact behaviors:

```ts
it("rejects a push containing a project outside the requested company", async () => {
  // mock an authenticated member for company-1 and send a company-2 project
  expect(response.status).toBe(403);
});

it("does not retry a permission or foreign-key error", async () => {
  const operation = vi.fn().mockRejectedValue(new Error("permission denied for table projects"));
  await expect(retryTransientCloudOperation(operation, { attempts: 3, delayMs: 0 })).rejects.toThrow("permission denied");
  expect(operation).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run focused API/storage tests and verify RED**

Run: `npm test -- tests/cloud-sync-api.test.ts tests/project-storage.test.ts -t "outside|permission|retry"`

Expected: FAIL for the new boundary behavior.

- [ ] **Step 3: Implement validation and retry at the server boundary**

In push route, derive `requestedProjectIds` only from rows belonging to `body.activeCompanyId`, reject mismatched company rows before authorization, and pass the authorized scope to `syncDataToSupabaseWithClient`. In the storage sync function, call `validateCloudSyncPayloadIntegrity` before the first upsert and wrap each batch operation with `retryTransientCloudOperation`. Keep permanent FK/schema/permission errors immediate. Preserve owner/admin delete reconciliation and non-admin upsert-only behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/cloud-sync-api.test.ts tests/project-storage.test.ts tests/cloud-sync-reliability.test.ts`

Expected: all focused tests pass, including existing call-order and scoped-member assertions.

---

### Task 6: Preserve client UX and expose retry-safe feedback

**Files:**
- Modify: `lib/cloud-sync-client.ts`
- Modify: `app/project-setup/workspace.tsx`
- Modify: `tests/cloud-sync-client.test.ts`
- Modify: `tests/workspace-policies.test.ts`

**Interfaces:**
- Consumes: existing `pushDataToCloudApi`, `loadDataFromCloudApi`, `runLocalFirstCloudSync`, and workspace notices.
- Produces: no duplicate save calls, local fallback on cloud error, and retry-safe cloud action behavior.

- [ ] **Step 1: Add interaction regression tests**

Assert that a cloud failure after local save keeps the local call first, and retrying the action invokes one push for one user action. Assert that payload media remains stripped and auth headers remain session-first.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/workspace-policies.test.ts tests/cloud-sync-client.test.ts`

Expected: any new retry/feedback assertions fail before implementation.

- [ ] **Step 3: Implement minimal feedback changes**

Keep `runLocalFirstCloudSync` as the orchestration point. Add an explicit retryable notice/action only where the current cloud error is transient; do not auto-run another save, clear local drafts, or move cloud tools out of the existing hamburger. Keep token storage unchanged and never include secrets in notices.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/workspace-policies.test.ts tests/cloud-sync-client.test.ts`

Expected: PASS with existing local-first order preserved.

---

### Task 7: Add deployment/runbook validation without reading secrets

**Files:**
- Modify: `.env.example`
- Modify: `docs/` cloud setup documentation identified by `rg -l "PCON_CLOUD_SYNC_TOKEN|SUPABASE_SECRET_KEY" docs VERCEL_DEPLOYMENT.md`
- Modify: `tests/cloud-sync-diagnostics.test.ts`

**Interfaces:**
- Consumes: `readCloudSyncServerConfig`, health diagnostics, and the new migration filename.
- Produces: explicit environment checklist and actionable setup instructions that never print secret values.

- [ ] **Step 1: Add a configuration contract test**

Assert that `.env.example` documents both accepted server key names (`SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY`), the migration path, and that service keys are server-only.

- [ ] **Step 2: Run the config test and verify RED**

Run: `npm test -- tests/cloud-sync-diagnostics.test.ts -t "env|migration"`

Expected: FAIL if any required documentation is absent.

- [ ] **Step 3: Update env/runbook documentation**

Document the four required values, SQL Editor migration order (`project-control-schema.sql` then the hardening migration; use the text-ID compatibility patch only for matching legacy text schemas), PostgREST reload, and non-destructive health/push/pull smoke test steps. State that values must not be committed or pasted into browser code.

- [ ] **Step 4: Run the focused diagnostics tests and verify GREEN**

Run: `npm test -- tests/cloud-sync-diagnostics.test.ts tests/cloud-sync-api.test.ts`

Expected: PASS without exposing any env value in response bodies or logs.

---

### Task 8: Full verification and browser regression pass

**Files:**
- Modify only if verification exposes a regression: relevant source/test files from Tasks 1–7
- Test: all existing test and e2e suites

**Interfaces:**
- Consumes: completed schema, server, storage, and client changes.
- Produces: verified local-first flow and a documented live-Supabase limitation if credentials remain absent.

- [ ] **Step 1: Run all automated checks**

Run:

```text
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

Expected: each command exits 0; report exact counts and any environment-related e2e limitation.

- [ ] **Step 2: Run responsive browser smoke checks**

Verify `/project-setup` at 360×800, 390×844, 430px, 768×1024, and desktop default: local save, cloud error notice, retry action, no horizontal overflow, and no console errors.

- [ ] **Step 3: Run safe live health check if credentials are configured**

Use `/api/cloud-sync/health` with the configured token/session only if the required env variables are present. Do not print token, URL query secrets, customer rows, or service key values. If absent, report “live Supabase smoke test not run: env not configured”.

- [ ] **Step 4: Inspect the final diff and requirement coverage**

Run `git diff --stat` and `git diff --check`; inspect changed files for accidental schema drops, public secret exposure, changed storage keys, and changed business calculations. Because this checkout has no valid HEAD, do not create a commit.
