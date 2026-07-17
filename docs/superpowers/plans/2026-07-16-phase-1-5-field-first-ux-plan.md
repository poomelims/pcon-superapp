# PCON Phase 1.5 Field-first UX/UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Daily Report fast to start and save on a one-handed mobile workflow, then align Dashboard, Project, and BOQ around the same today-first visual hierarchy without changing existing data contracts.

**Architecture:** Keep `app/project-setup/workspace.tsx` as state orchestration and move derived UI decisions into pure `lib/project-control` view models. Compose focused feature components under the existing Dashboard, Daily Report, Project, and shared UI boundaries. Preserve the existing local-first repository/policy path and use Playwright for visible behavior instead of source-text assertions.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, TypeScript, Tailwind CSS, Vitest 4.1, Playwright 1.61, existing Sarabun font and shared UI primitives.

## Global Constraints

- No new runtime or test packages.
- Do not change `ProjectControlData`, `Project`, `DailyReport`, `pcon_project_setup_data`, JSON import/export, API routes, Supabase schema, or cloud payloads.
- Project edits remain local immediately; Daily Report history still requires explicit Save.
- BOQ progress remains weighted by item value and is clamped to 0–100 with non-negative quantity/unit price.
- Cloud failure must never block or remove a successful local save.
- Preserve HR, BUYIN, Auth, Cloud, and PDF behavior and their More/tools placement.
- Support 360px and wider viewports with no page-level horizontal overflow and 44px minimum tap targets.
- Respect `prefers-reduced-motion`, visible focus, semantic headings, and accessible labels.
- Use `apply_patch` for edits. Do not stage or commit; the repository has no tracked `HEAD` and the user explicitly requested no automatic commit.
- Before each production extraction, write the failing focused test and confirm RED.

---

### Task 1: Shared field-first tokens and interaction primitives

**Files:**
- Modify: `app/globals.css`
- Modify: `app/project-setup/features/shared/ui.tsx`
- Modify: `tests/global-font-scale-source.test.ts`
- Create: `tests/shared-ui-primitives.test.ts`
- Create: `e2e/project-control-visual-behavior.spec.ts`

**Interfaces:**
- Preserve existing `Button`, `Field`, `TextInput`, `TextArea`, `Select`, `ProgressBar`, and `Card` exports.
- Add only reusable presentational primitives needed by later tasks:
  - `StatusFeedback({ tone, children })`
  - `AccordionToggle({ expanded, label, onClick, controls })`
  - `StickyActionBar({ children, status })`
- These primitives accept semantic labels and className extension but contain no storage or navigation logic.

- [ ] **Step 1: Write failing primitive contract tests**

Add Node-compatible tests using `renderToStaticMarkup` from `react-dom/server` and `React.createElement` (the existing Vitest config runs `tests/**/*.test.ts`). Verify:

```ts
const accordion = renderToStaticMarkup(
  React.createElement(AccordionToggle, { expanded: false, label: "งานวันนี้", controls: "daily-work", onClick: () => undefined })
);
expect(accordion).toContain('aria-expanded="false"');
expect(accordion).toContain('aria-controls="daily-work"');

const feedback = renderToStaticMarkup(
  React.createElement(StatusFeedback, { tone: "error" }, "บันทึกไม่สำเร็จ")
);
expect(feedback).toContain('role="status"');
expect(feedback).toContain("บันทึกไม่สำเร็จ");
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run tests/shared-ui-primitives.test.ts`

Expected: FAIL because the new primitives are not exported.

- [ ] **Step 3: Add tokens and minimal primitives**

Extend existing variables in `app/globals.css` for surface, feedback, radius, spacing, focus, and reduced-motion usage. Keep the existing color values as the baseline; do not introduce a second theme.

Implement the primitives in `features/shared/ui.tsx` with native button semantics, `role="status"` for feedback, and a sticky container that adds bottom safe-area padding without changing page layout ownership.

- [ ] **Step 4: Run focused tests and inspect responsive behavior**

Run:

```powershell
npx vitest run tests/shared-ui-primitives.test.ts tests/global-font-scale-source.test.ts
npx playwright test e2e/project-control-visual-behavior.spec.ts --grep "focus|tap|reduced|overflow"
```

Expected: focused unit tests pass; the browser check confirms visible focus, no page overflow, and 44px action targets at 360px and 390px.

- [ ] **Step 5: Status checkpoint**

Run `git status --short`. Do not stage or commit. Record the focused result in the task report.

---

### Task 2: Daily Report Quick mode view model

**Files:**
- Create: `lib/project-control/daily-report-quick-view-model.ts`
- Create: `tests/daily-report-quick-view-model.test.ts`
- Modify: `app/project-setup/features/daily-report/daily-report-view.tsx`

**Interfaces:**

```ts
export type DailyQuickSection = "work" | "site" | "progress" | "plan";
export type DailyQuickSectionStatus = "empty" | "in-progress" | "complete";

export function getDailyQuickSectionStatus(
  report: DailyReport,
  section: DailyQuickSection
): DailyQuickSectionStatus;

export function resolveDailyQuickSection(
  checklistId?: DailyChecklistItemId | null
): DailyQuickSection;

export function getDailyReportSaveFeedback(
  state: "idle" | "saving" | "saved" | "error",
  isEditing: boolean
): { label: string; tone: "neutral" | "success" | "error"; actionLabel: string };
```

- [ ] **Step 1: Write failing view-model tests**

Cover exact field ownership:

```ts
expect(getDailyQuickSectionStatus(reportWith({ summary: "งานวันนี้" }), "work")).toBe("in-progress");
expect(getDailyQuickSectionStatus(reportWith({ summary: "งาน", completedWork: "เสร็จ", ongoingWork: "ต่อ" }), "work")).toBe("complete");
expect(resolveDailyQuickSection("completedWork")).toBe("work");
expect(getDailyReportSaveFeedback("saving", false)).toEqual({
  label: "กำลังบันทึก…",
  tone: "neutral",
  actionLabel: "กำลังบันทึก…"
});
```

Include empty workers/materials, problems/nextPlan, and edit-mode label cases. The model must not mutate the report or add a schema field.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/daily-report-quick-view-model.test.ts`

Expected: FAIL because the new module does not exist.

- [ ] **Step 3: Implement the pure model**

Use trimmed text, non-empty worker rows, material rows, and progress updates to derive the three statuses. A site section is complete when it has at least one meaningful worker, material, or photo signal; missing optional photos/materials do not block completion. A plan section is complete when `nextPlan` is present; no problems is valid, and missing customer/internal notes do not block completion. Map checklist IDs to the four sections with an explicit switch and a default of `work`. Map save state to the exact Thai labels above; use `actionLabel: "แก้ไขรายงาน"` when `state === "saved" && isEditing` and `actionLabel: "บันทึกรายงาน"` when creating.

- [ ] **Step 4: Run GREEN and regression tests**

Run: `npx vitest run tests/daily-report-quick-view-model.test.ts tests/daily-report-selection.test.ts tests/daily-report-checklist.test.ts`

Expected: all focused tests pass with no changes to existing report types.

- [ ] **Step 5: Status checkpoint**

Record the exported signatures and test result in `.superpowers/sdd/phase-1-5-task-2-report.md`. Do not commit.

---

### Task 3: Daily Report Quick layout and one contextual save bar

**Files:**
- Create: `app/project-setup/features/daily-report/daily-quick-section.tsx`
- Create: `app/project-setup/features/daily-report/daily-save-bar.tsx`
- Modify: `app/project-setup/features/daily-report/daily-report-view.tsx`
- Modify: `app/project-setup/workspace.tsx`
- Modify: `e2e/project-control-behavior.spec.ts`
- Modify: `e2e/project-control-core.spec.ts`

**Interfaces:**

```tsx
<DailyQuickSection
  id="daily-work"
  title="งานวันนี้"
  status={sectionStatus}
  expanded={activeSection === "work"}
  onToggle={() => setActiveSection("work")}
>
  {children}
</DailyQuickSection>

<DailySaveBar
  feedback={saveFeedback}
  disabled={isSaving}
  onSave={onSave}
  isEditing={isEditing}
/>
```

- [ ] **Step 1: Add failing Playwright behavior**

Extend the existing behavior spec with a mobile scenario that:

1. creates a project;
2. opens Daily Report;
3. verifies only the Quick section headings are visible before interaction;
4. fills `สรุปงานวันนี้`;
5. clicks the single `บันทึกรายงาน`/`Save Report` action;
6. verifies the saved state and edit-mode label after save;
7. verifies the last form control is not covered by the sticky bar.

Run: `npx playwright test e2e/project-control-behavior.spec.ts --grep "quick|save"`

Expected: FAIL because the current view still exposes the old dense layout/action placement.

- [ ] **Step 2: Implement accordion section shell**

Move only section framing into `daily-quick-section.tsx`. Keep existing field handlers, worker rows, checklist, media, progress, history, and PDF callbacks in `daily-report-view.tsx`. Use `aria-expanded`, `aria-controls`, a visible status label, and `hidden`/conditional content without unmounting data unexpectedly during edit.

- [ ] **Step 3: Implement one save bar**

Move the mobile Save action into `daily-save-bar.tsx` and pass the existing `onSave` handler. Reuse `getDailyReportSaveFeedback`; show Cloud sync notices separately. Keep desktop Save placement available only where the existing desktop workflow needs it, but ensure mobile has exactly one contextual Save action.

- [ ] **Step 4: Wire checklist targeting and focus**

Use `resolveDailyQuickSection` when a checklist item or progress action is selected. Map `sitePhotos`, `reportDate`, `summary`, `completedWork`, `ongoingWork`, `workers`, `materials`, `problems`, and `nextPlan` to the four valid section names. On section open, focus the first labeled input only when the user explicitly triggered the section; do not steal focus on initial render or while typing.

- [ ] **Step 5: Run focused E2E and unit regression**

Run:

```powershell
npx vitest run tests/daily-report-quick-view-model.test.ts tests/daily-report-selection.test.ts tests/workspace-policies.test.ts
npx playwright test e2e/project-control-behavior.spec.ts e2e/project-control-core.spec.ts --grep "Daily|daily|save|report|PDF"
```

Expected: Quick create/edit/history/delete, worker rows, progress updates, PDF on-demand, and local-first save behavior remain green.

- [ ] **Step 6: Status checkpoint**

Write `.superpowers/sdd/phase-1-5-task-3-report.md` with screenshots/viewport results if available, test output, and any non-gating Cloud warning. Do not commit.

---

### Task 4: Dashboard Today Pulse

**Files:**
- Create: `lib/project-control/dashboard-today-view-model.ts`
- Create: `tests/dashboard-today-view-model.test.ts`
- Create: `app/project-setup/features/dashboard/today-pulse.tsx`
- Modify: `app/project-setup/features/dashboard/dashboard-view.tsx`
- Modify: `app/project-setup/workspace.tsx`
- Modify: `e2e/project-control-behavior.spec.ts`

**Interfaces:**

```ts
export type DashboardTodayPulse = {
  workers: number;
  completedWork: number;
  blockers: string[];
  nextPlan: string;
  reportState: "empty" | "draft" | "saved";
};

export function selectDashboardTodayPulse(
  reports: DailyReport[],
  today: string
): DashboardTodayPulse;
```

- [ ] **Step 1: Write failing selector tests**

Cover no report, one report with workers/completed/problems/next plan, and multiple reports where the latest updated report for the day wins. Expected no-report result:

```ts
expect(selectDashboardTodayPulse([], "2026-07-16")).toEqual({
  workers: 0,
  completedWork: 0,
  blockers: [],
  nextPlan: "",
  reportState: "empty"
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/dashboard-today-view-model.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the selector**

Filter by `reportDate === today`, choose the latest `updatedAt`, count only normalized worker rows, derive completed-work count from the existing dashboard selector semantics, preserve blockers as trimmed strings, and keep missing next plan as `""`. Do not derive counts from empty-state text.

- [ ] **Step 4: Compose Today Pulse**

Create `TodayPulse` as a presentational component receiving the typed model, current project summary, and callbacks for Daily/Project navigation. Use the shared metric/status primitives and stable test IDs for values, not CSS selectors or copy-based selectors.

- [ ] **Step 5: Run behavior regression**

Run:

```powershell
npx vitest run tests/dashboard-today-view-model.test.ts tests/dashboard-selectors.test.ts tests/project-sorting.test.ts
npx playwright test e2e/project-control-behavior.spec.ts --grep "zero|Dashboard|today|focus"
```

Expected: zero-state values are `0`, blocker empty state is singular, navigation resets focus/scroll, and project/company scoping remains intact.

- [ ] **Step 6: Status checkpoint**

Write `.superpowers/sdd/phase-1-5-task-4-report.md` and record the responsive viewport checks. Do not commit.

---

### Task 5: Project and BOQ responsive cards

**Files:**
- Create: `app/project-setup/features/project/boq-item-card.tsx`
- Create: `tests/boq-item-card.test.ts`
- Modify: `app/project-setup/features/project/project-view.tsx`
- Modify: `app/project-setup/features/shared/ui.tsx`
- Modify: `e2e/project-control-core.spec.ts`
- Modify: `e2e/project-control-behavior.spec.ts`

**Interfaces:**

```tsx
<BoqItemCard
  categoryName={category.name}
  item={item}
  canDelete={canDeleteBoq}
  onChange={(patch) => updateBoqItem(category.id, item.id, patch)}
  onDelete={() => deleteBoqItem(category.id, item.id)}
/>
```

- [ ] **Step 1: Add failing responsive card test**

Use `renderToStaticMarkup` from `react-dom/server` with `React.createElement` to render a BOQ item with quantity `2`, unit price `1000`, and progress `50`. Assert accessible labels for item, quantity, unit price, and progress; assert the computed item total and progress are visible.

Run: `npx vitest run tests/boq-item-card.test.ts`

Expected: FAIL because the card component does not exist.

- [ ] **Step 2: Implement the card**

Move only item-row presentation into `boq-item-card.tsx`. Keep `updateBoqItem`, `deleteBoqItem`, numeric normalization, permission checks, and category totals in existing consumers/calculation modules. Use a single-column mobile layout that becomes a compact grid at tablet/desktop widths; never require horizontal scrolling.

- [ ] **Step 3: Keep totals and weighted progress visible**

Use existing `calculateItemTotal`, `calculateCategoryTotal`, `calculateOverallBoqTotal`, and `calculateWeightedProgress`. Add a compact summary row at the BOQ section boundary; do not duplicate calculation formulas in JSX.

- [ ] **Step 4: Add browser acceptance coverage**

Extend the core scenario to verify negative numeric inputs normalize to zero, weighted progress remains `33.3%` for the unequal-value fixture, and the item card remains readable at 360px and 768px. Verify the Project Save action remains available once and permissions remain enforced.

- [ ] **Step 5: Run focused regression**

Run:

```powershell
npx vitest run tests/boq-item-card.test.ts tests/project-calculations.test.ts tests/project-action-permissions.test.ts
npx playwright test e2e/project-control-core.spec.ts e2e/project-control-behavior.spec.ts --grep "BOQ|weighted|overflow|Project"
```

Expected: Project CRUD, BOQ category/item CRUD, weighted progress, negative guards, and responsive checks pass.

- [ ] **Step 6: Status checkpoint**

Write `.superpowers/sdd/phase-1-5-task-5-report.md` with the exact viewport and test results. Do not commit.

---

### Task 6: Shell focus, accessibility, and final visual acceptance

**Files:**
- Modify: `app/project-setup/workspace.tsx`
- Modify: `app/project-setup/features/shared/ui.tsx`
- Modify: `app/project-setup/features/feature-loaders.tsx`
- Modify: `e2e/project-control-core.spec.ts`
- Modify: `e2e/project-control-behavior.spec.ts`
- Create: `tests/phase-1-5-acceptance-contract.test.ts`

**Interfaces:**
- Preserve `navigateToTab`, existing focus boundary test ID, active project switcher, dynamic feature loader exports, and existing permission resolver signatures.
- Add no public route or storage interface.

- [ ] **Step 1: Add failing acceptance checks**

Add a narrow contract test for the shared shell that verifies feature loaders still expose Dashboard, Project, Daily Report, HR, BUYIN, and PDF boundaries. Add Playwright assertions for:

- no duplicate mobile Save action;
- last Daily Report field is visible above sticky controls;
- menu closes after tab/project navigation;
- reduced-motion media query does not leave content hidden.

- [ ] **Step 2: Run RED for new behavior**

Run: `npx vitest run tests/phase-1-5-acceptance-contract.test.ts` and the focused Playwright grep. Record the current failure before changing shell code.

- [ ] **Step 3: Implement smallest shell fixes**

Close menus in the existing navigation/project-switch handlers, preserve focus reset, add safe-area/bottom padding to the action bar, and ensure dynamic loaders remain lazy. Do not rewrite the route or alter tab permissions.

- [ ] **Step 4: Run all acceptance checks**

Run:

```powershell
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

Expected: all commands exit 0; all existing and new tests pass; build generates the same route set without new dependencies.

- [ ] **Step 5: Manual visual review**

Run the dev server and inspect Dashboard, Daily Report, Project, BOQ, More, HR, BUYIN, and PDF at 360×800, 390×844, 768px, and 1440px. Check one-handed reach, focus order, sticky-bar clearance, empty states, and reduced-motion behavior. Record any issue before completion.

- [ ] **Step 6: Final evidence and no-commit checkpoint**

Write `.superpowers/sdd/phase-1-5-final-report.md` with audited files, exact commands/results, screenshots or viewport notes, residual risks, and the final review link. Run `git status --short`, `git diff --stat`, and `git rev-parse --verify HEAD`; do not stage or commit.

---

## Self-review checklist

- [x] Every task has explicit files, interfaces, failing-test step, implementation step, and verification command.
- [x] All requirements from the approved Phase 1.5 design map to Tasks 1–6.
- [x] No task changes storage schema, JSON format, API routes, Supabase schema, or package dependencies.
- [x] Existing selectors, calculations, permissions, dynamic loaders, and local-first policy remain the source of truth.
- [x] Behavioral verification uses semantic Playwright interaction; source inspection remains limited to narrow contracts.
- [x] No placeholders or vague “handle edge cases” instructions remain.

## Execution note

This plan is intentionally staged so Daily Report can be reviewed and tested before Dashboard and Project/BOQ changes. Every task ends with a status checkpoint rather than a Git commit because the repository has no tracked `HEAD` and the user requested no automatic commit.
