# PCON Hybrid Test Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace brittle Project Setup source-text assertions with unit and Playwright behavioral coverage while retaining only narrow architecture, security, schema, CSS, and PDF-rendering source contracts.

**Architecture:** Move component-local decisions into small typed selectors or policies that are consumed by production views and imported directly by Vitest. Cover user-visible integration through the existing Playwright suite, then delete aggregate source reading and narrow the remaining static contracts to individual files.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, TypeScript 5.9, Vitest 4.1, Playwright 1.61, system Google Chrome.

## Global Constraints

- Do not add runtime or test packages.
- Do not change `pcon_project_setup_data`, JSON import/export format, API routes, or Supabase schema.
- Project edits remain immediately local; Daily Report history still requires explicit Save.
- BOQ progress remains weighted by item value.
- Cloud failure must never block or remove the local save.
- Preserve HR, BUYIN, Auth, Cloud, and PDF behavior.
- Do not create a Git commit automatically; replace commit steps with a status/diff checkpoint.
- Use failing tests before every production extraction or behavior change.

---

### Task 1: Dashboard dates and company-scoped project selection

**Files:**
- Create: `lib/project-control/dashboard-view-model.ts`
- Modify: `lib/project-sorting.ts`
- Modify: `app/project-setup/features/dashboard/dashboard-view.tsx`
- Modify: `app/project-setup/workspace.tsx`
- Create: `tests/dashboard-view-model.test.ts`
- Modify: `tests/project-sorting.test.ts`

**Interfaces:**
- Produces: `formatDashboardShortDate(value?: string | null): string`
- Produces: `formatDashboardDateSpan(startDate?: string | null, dueDate?: string | null): string`
- Produces: `filterProjectsByCompany(projects: Project[], companyId: string): Project[]`
- Consumes: existing `Project` type and existing dashboard selectors.

- [ ] **Step 1: Write failing date-format tests**

```ts
import { describe, expect, it } from "vitest";
import {
  formatDashboardDateSpan,
  formatDashboardShortDate
} from "@/lib/project-control/dashboard-view-model";

describe("dashboard view model", () => {
  it("formats compact project dates without inventing missing values", () => {
    expect(formatDashboardShortDate("2026-07-15")).toBe("7/15");
    expect(formatDashboardShortDate(null)).toBe("-");
    expect(formatDashboardShortDate("legacy-date")).toBe("legacy-date");
    expect(formatDashboardDateSpan("2026-07-01", "2026-07-31")).toBe("7/1-7/31");
    expect(formatDashboardDateSpan(undefined, "2026-07-31")).toBe("7/31");
    expect(formatDashboardDateSpan(undefined, undefined)).toBe("-");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx vitest run tests/dashboard-view-model.test.ts`

Expected: FAIL because `lib/project-control/dashboard-view-model.ts` does not exist.

- [ ] **Step 3: Implement the minimal date view model**

```ts
export function formatDashboardShortDate(value?: string | null): string {
  if (!value) return "-";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}`;
}

export function formatDashboardDateSpan(startDate?: string | null, dueDate?: string | null): string {
  const start = formatDashboardShortDate(startDate);
  const due = formatDashboardShortDate(dueDate);
  if (start === "-" && due === "-") return "-";
  if (start === "-") return due;
  if (due === "-") return start;
  return `${start}-${due}`;
}
```

Import these functions in `dashboard-view.tsx` and delete the private duplicates.

- [ ] **Step 4: Write the failing company-filter test**

Add to `tests/project-sorting.test.ts`:

```ts
it("returns only projects belonging to the active company", () => {
  const first = createProject("company-a", "A");
  const second = createProject("company-b", "B");

  expect(filterProjectsByCompany([first, second], "company-a")).toEqual([first]);
});
```

- [ ] **Step 5: Run the focused test and confirm RED**

Run: `npx vitest run tests/project-sorting.test.ts`

Expected: FAIL because `filterProjectsByCompany` is not exported.

- [ ] **Step 6: Implement and consume the company filter**

```ts
export function filterProjectsByCompany(projects: Project[], companyId: string): Project[] {
  return projects.filter((project) => project.companyId === companyId);
}
```

Use this function for `allCompanyProjects` in `workspace.tsx`; derive active/success lists from the already company-scoped array.

- [ ] **Step 7: Verify GREEN and inspect the diff**

Run: `npx vitest run tests/dashboard-view-model.test.ts tests/project-sorting.test.ts tests/dashboard-selectors.test.ts`

Expected: all focused tests PASS.

Run: `git diff -- lib/project-control/dashboard-view-model.ts lib/project-sorting.ts app/project-setup/features/dashboard/dashboard-view.tsx app/project-setup/workspace.tsx tests/dashboard-view-model.test.ts tests/project-sorting.test.ts`

No commit is created.

---

### Task 2: Daily Report date selection and create-versus-edit mode

**Files:**
- Create: `lib/project-control/daily-report-selection.ts`
- Modify: `app/project-setup/workspace.tsx`
- Modify: `app/project-setup/features/daily-report/daily-report-view.tsx`
- Create: `tests/daily-report-selection.test.ts`

**Interfaces:**
- Produces: `resolveDailyReportDateSelection(reports: DailyReport[], reportDate: string): DailyReportDateSelection`
- Produces: `DailyReportDateSelection = { mode: "create" | "edit"; savedReport: DailyReport | null; previousReport: DailyReport | null }`
- Consumes: reports already scoped by `selectProjectReportHistory`.

- [ ] **Step 1: Write the failing selection tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveDailyReportDateSelection } from "@/lib/project-control/daily-report-selection";
import { createEmptyDailyReport, createProject } from "@/lib/project-storage";

describe("daily report date selection", () => {
  const project = createProject("company-1", "Site A");

  function report(id: string, reportDate: string) {
    return { ...createEmptyDailyReport(project), id, reportDate, updatedAt: `${reportDate}T12:00:00.000Z` };
  }

  it("loads the saved report and its closest prior report for edit mode", () => {
    const result = resolveDailyReportDateSelection(
      [report("new", "2026-07-15"), report("old", "2026-07-14")],
      "2026-07-15"
    );

    expect(result.mode).toBe("edit");
    expect(result.savedReport?.id).toBe("new");
    expect(result.previousReport?.id).toBe("old");
  });

  it("returns create mode with the closest prior report for a new date", () => {
    const result = resolveDailyReportDateSelection(
      [report("future", "2026-07-16"), report("old", "2026-07-14")],
      "2026-07-15"
    );

    expect(result.mode).toBe("create");
    expect(result.savedReport).toBeNull();
    expect(result.previousReport?.id).toBe("old");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx vitest run tests/daily-report-selection.test.ts`

Expected: FAIL because the selection module does not exist.

- [ ] **Step 3: Implement the selector**

```ts
import { sortWithCompare } from "@/lib/runtime-compat";
import type { DailyReport } from "@/lib/project-control/types";

export type DailyReportDateSelection = {
  mode: "create" | "edit";
  savedReport: DailyReport | null;
  previousReport: DailyReport | null;
};

export function resolveDailyReportDateSelection(
  reports: DailyReport[],
  reportDate: string
): DailyReportDateSelection {
  const savedReport = reports.find((report) => report.reportDate === reportDate) ?? null;
  const previousReport = sortWithCompare(
    reports.filter((report) => report.id !== savedReport?.id && report.reportDate < reportDate),
    (a, b) => b.reportDate.localeCompare(a.reportDate) || b.updatedAt.localeCompare(a.updatedAt)
  )[0] ?? null;

  return { mode: savedReport ? "edit" : "create", savedReport, previousReport };
}
```

- [ ] **Step 4: Replace duplicate workspace selection logic**

In `changeDailyReportDate`, call:

```ts
const { savedReport, previousReport } = resolveDailyReportDateSelection(activeReports, reportDate);
```

Use `previousReport` for canonical BOQ progress and keep all current notices, PDF closing, and draft cloning unchanged.

- [ ] **Step 5: Verify GREEN and regression coverage**

Run: `npx vitest run tests/daily-report-selection.test.ts tests/project-control-boundaries.test.ts tests/daily-report-progress.test.ts`

Expected: all focused tests PASS.

Run: `git diff -- lib/project-control/daily-report-selection.ts app/project-setup/workspace.tsx tests/daily-report-selection.test.ts`

No commit is created.

---

### Task 3: Local-first cloud workflow and HR crew removal policy

**Files:**
- Create: `lib/project-control/workspace-policies.ts`
- Modify: `app/project-setup/workspace.tsx`
- Create: `tests/workspace-policies.test.ts`

**Interfaces:**
- Produces: `runLocalFirstCloudSync(actions: { saveLocal: () => void; pushCloud: () => Promise<unknown> }): Promise<void>`
- Produces: `applyCrewRemovalPolicy(data: ProjectControlData, crewId: string, updatedAt: string): ProjectControlData`
- Consumes: existing Project Control data without changing its schema.

- [ ] **Step 1: Write failing local-first and crew-history tests**

```ts
import { describe, expect, it } from "vitest";
import {
  applyCrewRemovalPolicy,
  runLocalFirstCloudSync
} from "@/lib/project-control/workspace-policies";
import {
  createDefaultData,
  createCrew,
  createLaborExpense
} from "@/lib/project-storage";

describe("workspace policies", () => {
  it("persists locally before cloud push and keeps the local save on failure", async () => {
    const order: string[] = [];
    const cloudError = new Error("offline");

    await expect(runLocalFirstCloudSync({
      saveLocal: () => order.push("local"),
      pushCloud: async () => {
        order.push("cloud");
        throw cloudError;
      }
    })).rejects.toBe(cloudError);

    expect(order).toEqual(["local", "cloud"]);
  });

  it("deactivates a referenced crew without deleting historical links", () => {
    const data = createDefaultData();
    const crew = createCrew(data.activeCompanyId);
    const expense = createLaborExpense(data.activeCompanyId, { crewId: crew.id });
    const snapshot = { ...data, crews: [crew], laborExpenses: [expense] };

    const result = applyCrewRemovalPolicy(snapshot, crew.id, "2026-07-15T12:00:00.000Z");

    expect(result.crews[0]).toMatchObject({ id: crew.id, status: "inactive" });
    expect(result.laborExpenses[0].crewId).toBe(crew.id);
  });

  it("removes an unreferenced crew", () => {
    const data = createDefaultData();
    const crew = createCrew(data.activeCompanyId);
    const result = applyCrewRemovalPolicy({ ...data, crews: [crew] }, crew.id, "2026-07-15T12:00:00.000Z");

    expect(result.crews).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx vitest run tests/workspace-policies.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement the policies**

```ts
import type { ProjectControlData } from "@/lib/project-control/types";

export async function runLocalFirstCloudSync(actions: {
  saveLocal: () => void;
  pushCloud: () => Promise<unknown>;
}): Promise<void> {
  actions.saveLocal();
  await actions.pushCloud();
}

export function applyCrewRemovalPolicy(
  data: ProjectControlData,
  crewId: string,
  updatedAt: string
): ProjectControlData {
  const hasHistory =
    data.laborExpenses.some((expense) => expense.crewId === crewId) ||
    data.dailyReports.some((report) => report.workers.some((worker) => worker.crewId === crewId));

  return {
    ...data,
    crews: hasHistory
      ? data.crews.map((crew) => crew.id === crewId ? { ...crew, status: "inactive" as const, updatedAt } : crew)
      : data.crews.filter((crew) => crew.id !== crewId)
  };
}
```

- [ ] **Step 4: Consume the policies in production**

Use `runLocalFirstCloudSync` inside `syncWorkspaceSnapshotToCloud`, `handleSave`, and `saveDailyReport` with the existing `saveLocalData` and `pushDataToCloudApi` closures. Keep the current loading flags, success/error messages, and `finally` blocks.

Replace the body of `deleteCrew` data selection with:

```ts
const nextData = applyCrewRemovalPolicy(data, crewId, new Date().toISOString());
updateDataAndSyncCloud(nextData, {
  syncing: "บันทึก HR ในเครื่องแล้ว กำลัง Sync Cloud...",
  success: "บันทึก HR แล้ว และ Sync Cloud สำเร็จ",
  failure: "Sync HR Cloud ไม่สำเร็จ"
});
```

- [ ] **Step 5: Verify GREEN and local-first regressions**

Run: `npx vitest run tests/workspace-policies.test.ts tests/cloud-sync-client.test.ts tests/project-storage.test.ts tests/hr-calculations.test.ts tests/buyin-calculations.test.ts`

Expected: all focused tests PASS and the rejected cloud promise still occurs after the local action.

Run: `git diff -- lib/project-control/workspace-policies.ts app/project-setup/workspace.tsx tests/workspace-policies.test.ts`

No commit is created.

---

### Task 4: Playwright coverage for visible Project Setup behavior

**Files:**
- Create: `e2e/project-control-behavior.spec.ts`
- Modify: `e2e/project-control-core.spec.ts` only if setup helpers are deduplicated without changing assertions.

**Interfaces:**
- Consumes: semantic buttons, labels, notices, localStorage persistence, and `/api/cloud-sync/push` route.
- Produces: browser coverage for zero state, navigation focus, report mode/history, More modules, scroll controls, and local-first cloud failure.

- [ ] **Step 1: Add the failing Dashboard and navigation test**

```ts
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.name !== "__pcon_behavior_e2e_ready__") {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.name = "__pcon_behavior_e2e_ready__";
    }
  });
});

test("shows real zero values and resets focus when navigating", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();

  const completed = page.getByText("งานที่เสร็จวันนี้", { exact: true }).locator("xpath=ancestor::section[1]");
  const workers = page.getByText("แรงงานวันนี้", { exact: true }).locator("xpath=ancestor::section[1]");
  await expect(completed).toContainText("0");
  await expect(workers).toContainText("0");
  await expect(page.getByText("ยังไม่มีปัญหาที่ต้องติดตาม", { exact: true })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("tabindex"))).toBe("-1");
});
```

- [ ] **Step 2: Run the focused E2E test and confirm its current status**

Run: `npx playwright test e2e/project-control-behavior.spec.ts --grep "real zero values"`

Expected before final selector/test-ID adjustment: FAIL if focus or a semantic container is not observable. The failure must be on the intended behavior, not on server startup.

- [ ] **Step 3: Add report mode/history and More-module smoke tests**

```ts
test("switches between create and edit report history states", async ({ page }) => {
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByRole("button", { name: "Daily Report", exact: true }).click();
  await expect(page.getByText("Creating new report", { exact: true })).toBeVisible();
  await page.getByLabel("สรุปงานวันนี้").fill("Behavioral history test");
  await page.getByRole("button", { name: "Save Report", exact: true }).click();
  await expect(page.getByText("Editing saved report", { exact: true })).toBeVisible();
  await expect(page.getByLabel("เลือกวันที่มีรายงาน")).not.toHaveValue("");
});

test("opens real HR and BUYIN modules from More on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "HR", exact: true }).click();
  await expect(page.getByRole("heading", { name: "HR / ทีมช่าง", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "เมนูเพิ่มเติม", exact: true }).click();
  await page.getByRole("button", { name: "BUYIN / จัดซื้อ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "BUYIN / จัดซื้อ", exact: true })).toBeVisible();
});
```

- [ ] **Step 4: Add local-first cloud failure coverage**

```ts
test("keeps the local Project save when cloud push fails", async ({ page }) => {
  await page.route("**/api/cloud-sync/push", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "offline" }) });
  });
  await page.goto("/project-setup");
  await page.getByRole("button", { name: "สร้างโปรเจกต์ใหม่", exact: true }).first().click();
  await page.getByLabel("ชื่อโปรเจกต์").fill("Local survives cloud failure");
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(page.getByText(/ข้อมูล local ยังปลอดภัย|Save Project ในเครื่องนี้แล้ว/).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await expect(page.getByLabel("ชื่อโปรเจกต์")).toHaveValue("Local survives cloud failure");
});
```

- [ ] **Step 5: Make only minimal observability fixes**

If a semantic locator is impossible, add a stable `data-testid` to the existing element; do not add test-only state or change copy. Examples allowed by this plan are `data-testid="workspace-content-start"` and `data-testid="dashboard-completed-count"`.

- [ ] **Step 6: Verify the complete browser suite**

Run: `npm run test:e2e`

Expected: all original 3 tests plus the new behavior tests PASS using system Chrome.

Run: `git diff -- e2e app/project-setup`

No commit is created.

---

### Task 5: Delete aggregate source reading and narrow retained static contracts

**Files:**
- Delete: `tests/project-setup-source.ts`
- Delete: `tests/daily-report-ui-refresh-source.test.ts`
- Delete: `tests/daily-report-cloud-history-source.test.ts`
- Delete: `tests/hr-phase-source.test.ts`
- Delete: `tests/hr-buyin-cloud-save-source.test.ts`
- Delete: `tests/buyin-source.test.ts`
- Delete: `tests/project-save-cloud-source.test.ts`
- Delete: `tests/project-action-permissions-source.test.ts`
- Delete: `tests/personal-schedule-card-source.test.ts`
- Delete: `tests/global-scroll-controls-source.test.ts`
- Delete: `tests/data-audit-source.test.ts`
- Modify: `tests/daily-report-pdf-layout-source.test.ts`
- Modify: `tests/auth-1-source.test.ts`
- Modify: `tests/cloud-sync-diagnostics-source.test.ts`
- Modify: `tests/project-setup-feature-boundaries.test.ts`

**Interfaces:**
- Consumes: replacement unit and Playwright tests from Tasks 1-4.
- Produces: source contracts limited to architecture, security, schema, global CSS, and PDF export integration.

- [ ] **Step 1: Prove replacement tests are GREEN before deletion**

Run:

```powershell
npx vitest run tests/dashboard-view-model.test.ts tests/dashboard-selectors.test.ts tests/project-sorting.test.ts tests/daily-report-selection.test.ts tests/daily-report-permissions.test.ts tests/project-action-permissions.test.ts tests/workspace-policies.test.ts tests/hr-calculations.test.ts tests/buyin-calculations.test.ts tests/project-storage.test.ts
npm run test:e2e
```

Expected: both commands PASS. Do not delete a source test if its replacement is red.

- [ ] **Step 2: Narrow PDF source reading to its real files**

Replace aggregate reading with:

```ts
const pdfViewSource = () => readFileSync(
  join(process.cwd(), "app", "project-setup", "features", "pdf", "daily-report-sheet.tsx"),
  "utf8"
);
const pdfExportSource = () => readFileSync(
  join(process.cwd(), "lib", "daily-report-pdf.ts"),
  "utf8"
);
```

Retain assertions only for no financial values, `data-pdf-section`, deterministic gallery markers, reporter/site-contact props, and export slicing markers. Remove Tailwind utility-class assertions already covered by Playwright preview/overflow tests.

- [ ] **Step 3: Narrow Auth and Cloud diagnostics contracts**

In `auth-1-source.test.ts`, retain only route existence, schema policy, server-only secret, and absence of hardcoded password assertions. Remove UI-copy/layout assertions.

In `cloud-sync-diagnostics-source.test.ts`, retain only API/client secret-boundary and read-only health endpoint assertions. Remove visual guide-panel assertions.

- [ ] **Step 4: Remove the dashboard class assertion from feature boundaries**

Delete the `keeps dashboard metadata readable at laptop widths` Tailwind-class test. Keep feature-file existence, explicit `next/dynamic` imports, thin workspace orchestration, and PDF on-demand module boundaries.

- [ ] **Step 5: Delete superseded behavioral source tests and aggregator**

Delete only the files listed in this task after Steps 1-4 pass. Do not delete `global-font-scale-source.test.ts`, the narrowed security/schema contracts, or feature-boundary contracts.

- [ ] **Step 6: Verify no aggregate imports or behavioral class assertions remain**

Run:

```powershell
rg -n "readProjectSetupSource|project-setup-source" tests
rg -n "sm:grid|xl:grid|rounded-\[|min-h-|max-w-" tests -g "*source*.test.ts"
```

Expected: first command returns no matches. The second returns no behavioral Tailwind assertions; any remaining match must be a documented global CSS or rendering-library contract.

- [ ] **Step 7: Run the unit suite after deletion**

Run: `npm test`

Expected: all remaining Vitest files and tests PASS with no missing imports.

Run: `git status --short`

No files are staged and no commit is created.

---

### Task 6: Full verification and acceptance audit

**Files:**
- Modify only files required to fix failures proven by the commands below.

**Interfaces:**
- Consumes: all outputs from Tasks 1-5.
- Produces: verification evidence for the approved specification.

- [ ] **Step 1: Run all automated checks fresh**

Run:

```powershell
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

Expected: every command exits `0`; Playwright covers 360, 390, 768, and 1440 pixel widths through the combined suite.

- [ ] **Step 2: Audit source-test scope**

Run:

```powershell
rg --files tests | rg "source\.test\.ts$"
rg -n "readFileSync" tests -g "*source*.test.ts"
```

Expected: remaining source tests map only to architecture, security, schema, global CSS, and PDF-rendering contracts, and each reads specific files rather than all Project Setup features.

- [ ] **Step 3: Audit compatibility and fake controls**

Run:

```powershell
rg -n "pcon_project_setup_data" lib tests
rg -n "href=[\"']#|onClick=\{\(\) => \{\}\}|Planned|Mock-up" app/project-setup -g "*.tsx"
```

Expected: storage key remains present; no fake controls or mock navigation markers are found.

- [ ] **Step 4: Review workspace changes without committing**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intended test-modernization, selector/policy, view-consumer, E2E, and documentation files are changed. Do not stage or commit.

- [ ] **Step 5: Report against every acceptance criterion**

Report exact test counts, E2E scenario count, lint/typecheck/build exit status, deleted source-test files, retained source-contract files, any production regression fixed, remaining certificate/audit risks, and the recommended next action.

## Execution status

- [x] Tasks 1-5 implemented and independently reviewed.
- [x] Task 6 verified with 39/39 Vitest files, 189/189 tests, 8/8 Playwright scenarios, lint, typecheck, and build passing.
- [x] Task 6 acceptance-gap re-review passed with 0 critical, important, or minor findings.
