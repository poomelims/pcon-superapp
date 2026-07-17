# PCON Phase 1.5 Field-first UX/UI Design

## Status

Design approved by the user. This document defines the next implementation phase only; it does not change the Phase 1 data model or expand the product scope.

## Goal

ทำให้ PCON Project Control ใช้งานหน้างานได้เร็วขึ้นบนมือถือ โดยให้ Daily Report เป็น workflow หลักแบบกรอกเร็วมือเดียว และให้ Dashboard, Project และ BOQ ใช้ visual hierarchy เดียวกันเพื่อช่วยตอบคำถามหน้างานได้ทันที

## Product decisions

- Phase 1.5 covers Daily Report Quick mode plus Dashboard/Project/BOQ polish.
- Daily Report is the first implementation priority, followed by Dashboard, then Project/BOQ.
- Dashboard opens with a Today Pulse view: workers, completed work, blockers, and next plan.
- Quick mode is the default Daily Report experience. Advanced detail remains available inside the same report rather than becoming a second data model.
- The visual direction is premium but practical: Sarabun, emerald primary color, quiet surfaces, soft shadows, clear status feedback, and restrained motion.
- Existing Project Control behavior remains authoritative when this design is ambiguous.

## Non-goals

- No login, role-system expansion, payment, timeline, AI, image-upload, client portal, or SaaS billing work.
- No new API routes or changes to existing API contracts.
- No Supabase schema or storage-payload migration.
- No new runtime or test packages.
- No redesign of HR, BUYIN, Auth, Cloud, or PDF beyond shared shell compatibility and their existing placement under More/tools.

## User context

Primary user: site supervisor or contractor standing on-site with one hand available and limited time. The user needs to answer, in this order:

1. วันนี้ทำอะไรไปแล้ว?
2. ช่างเข้าไซต์กี่คน?
3. มีปัญหาอะไรต้องตาม?
4. พรุ่งนี้ต้องทำอะไรต่อ?
5. BOQ และ project progress อยู่ที่เท่าไร?

Secondary users: office staff and project managers reviewing the same local workspace on tablet or desktop. They need the same data with more room for comparison, not a separate workflow.

## Experience architecture

### Shared shell

Desktop keeps the existing sidebar for real working modules. Mobile keeps a compact header with the current project switcher and bottom navigation for Dashboard, Project, Daily, and More. HR, BUYIN, Cloud, PDF, Auth, and workspace tools remain reachable from More without adding inactive or planned navigation items.

Every tab change and project switch must:

- close open mobile menus and project switchers;
- scroll the content container to its start;
- move focus to the existing workspace content heading/start boundary;
- keep the current project context visible after navigation.

The shell must support viewport widths from 360px upward without page-level horizontal overflow. Tap targets remain at least 44px.

### Dashboard: Today Pulse

The Dashboard answers the current-day questions before portfolio questions.

Order on mobile:

1. current project summary with weighted progress;
2. workers on site today;
3. completed work today;
4. blockers/problems;
5. next plan;
6. one primary action to create or continue today’s Daily Report.

On tablet and desktop, the same order is preserved in a two-column grid where the current project and primary action occupy the strongest visual position. Portfolio/project switching remains available but does not displace the current-day summary.

Empty state rules:

- no reports means numeric metrics render as `0`;
- no blockers means one neutral empty state, not a fake count derived from copy;
- no project means one create-project action and no fabricated progress;
- empty states use one concise explanation and one next action.

Dashboard cards use semantic labels and values. Color is supplemental: emerald for normal, amber for attention, red for required action/error, and slate/sky for neutral information.

### Daily Report: Quick mode

The default Daily Report opens on the selected report date and places focus on the first useful field. It is composed of four accordion sections:

1. **งานวันนี้** — summary, completed work, ongoing work;
2. **หน้างาน** — workers/team rows, site conditions, materials;
3. **ความคืบหน้า BOQ** — progress updates and checklist-linked items;
4. **แผน/หมายเหตุ** — problems, next plan, customer note, internal note.

Quick mode rules:

- keep the first screen short enough to begin typing without scrolling through history or PDF preview;
- show concise field labels and useful Thai examples rather than long instructional copy;
- open an accordion automatically when a checklist or progress action targets that section;
- preserve section state while editing the current report;
- keep Report History and PDF Preview closed until explicitly requested;
- keep create/edit/delete/export behavior unchanged.

Each section exposes a completion state: `ยังไม่เริ่ม`, `กำลังกรอก`, or `ครบแล้ว`. The state is derived from fields, not stored as a new schema field.

The mobile action area is one contextual sticky action bar. It must expose one Save action at a time and a clear status:

- `บันทึกรายงาน` when a new report is ready to save;
- `กำลังบันทึก…` while the local-first save is running;
- `บันทึกในเครื่องแล้ว` after local persistence succeeds;
- `บันทึกไม่สำเร็จ — ลองอีกครั้ง` after local persistence fails.

Cloud failure may add a secondary sync notice, but it must never replace the local success state with an error that implies data loss.

### Project and BOQ

Project opens with a concise summary header containing project name, status, weighted progress, contract/BOQ totals, and the primary Save Project action where permissions allow.

Project editing is grouped as:

- general project information;
- customer and site contact;
- budget and timeline;
- BOQ.

On mobile, BOQ rows become responsive cards. Each card keeps the item name, category, quantity/unit, unit price, item total, and progress visible without horizontal scrolling. Category totals, overall BOQ total, and weighted progress remain visible at the relevant section boundary and summary header.

Input guards remain unchanged in meaning:

- quantity and unit price are normalized to non-negative values;
- progress is clamped to 0–100;
- overall progress is 0 when the BOQ total is 0;
- project progress uses weighted item value, never a simple average.

## Visual system

The existing Sarabun font and green brand identity remain. Shared tokens should be expressed through the existing global styles and reusable UI primitives rather than scattered one-off values.

Token intent:

- primary: emerald for navigation, positive state, and primary actions;
- surfaces: white, soft green, soft slate, and muted neutral panels;
- feedback: emerald success, amber attention, red error, sky informational;
- radius: 16–24px for cards and controls;
- shadow: soft elevation only where it improves grouping or sticky controls;
- spacing: 8px base rhythm with larger section gaps for scanability;
- focus: visible emerald focus ring with sufficient contrast;
- motion: short transitions, disabled or reduced under `prefers-reduced-motion`.

Do not use color as the only status signal. Pair status colors with text, labels, or icons. Avoid decorative animation, dense gradients, and tiny secondary controls.

## Component and code boundaries

`app/project-setup/workspace.tsx` remains the state orchestration boundary. It owns navigation, active project state, existing handlers, permissions, local/cloud status, and focus/scroll coordination. It should not gain new large view implementations.

Feature components remain under:

- `app/project-setup/features/daily-report/` for Quick mode sections and report actions;
- `app/project-setup/features/dashboard/` for Today Pulse and empty states;
- `app/project-setup/features/project/` for summary, project fields, and BOQ cards;
- `app/project-setup/features/shared/` for primitives already shared by these features.

Pure calculations or derived UI decisions belong under `lib/project-control/` and must be imported by production consumers and unit tests. Candidate boundaries include Quick section completion, Today Pulse view models, and save-status mapping. No helper may expose test-only state or duplicate storage behavior.

The existing selectors and policies remain the source of truth:

- `dashboard-selectors.ts` for dashboard metrics;
- `daily-report-selectors.ts` and `daily-report-selection.ts` for project/date history;
- `workspace-policies.ts` for local-first persistence and crew-history-safe removal;
- `project-calculations.ts` for BOQ totals and weighted progress;
- `project-storage.ts` as the compatibility facade.

## Data and error flow

The data flow remains:

```text
localStorage
  -> normalizer
  -> company/project selectors
  -> feature view model
  -> user interaction
  -> local-first save policy
  -> optional Cloud push
```

Project edits continue to save locally immediately through the existing update path. Daily Report continues to require explicit Save to create or update history. Local persistence errors must be distinguished from Cloud errors. If local persistence fails, Cloud push must not run and the UI must not claim the data is safe. If Cloud fails after local persistence, the UI must confirm local persistence and report the sync issue separately.

## Accessibility and responsive acceptance

- supports 360×800, 390×844, 768px, and 1440px verification;
- no page-level horizontal overflow;
- all controls have at least 44px touch area;
- every input has an accessible label;
- accordion controls expose expanded/collapsed state and work with keyboard;
- focus remains visible after navigation and save errors;
- sticky controls never cover the last form field or report history content;
- reduced-motion users receive no required animated transition;
- headings retain meaningful semantic levels; tests must not change heading semantics just to make selectors pass.

## Testing strategy

### Unit and contract tests

Add or update focused tests for:

- Quick Report section completion and automatic section targeting;
- Today Pulse metrics and zero-state values;
- Dashboard date and company scoping;
- BOQ weighted progress, zero-total handling, and negative-input guards;
- local-first save status and cloud/local error separation;
- legacy JSON round-trip and storage-key compatibility.

Retain source inspection only for architecture, security, schema/data compatibility, global CSS, and PDF/rendering boundaries. Do not assert responsive utility strings, visible copy, or aggregated workspace source as a substitute for behavior.

### Playwright behavior

Add visible interaction coverage for:

- starting a Quick Daily Report, opening a targeted accordion, Save, edit, and history state;
- Dashboard Today Pulse zero state and navigation focus;
- Project and BOQ responsive card flow with weighted progress;
- switching between two projects and verifying active context;
- local persistence after refresh and deterministic Cloud failure;
- no overflow and sticky action-bar visibility at target widths;
- PDF preview/history remain on-demand.

## Implementation sequence

1. Add or refine shared tokens and interaction primitives without changing data contracts.
2. Implement Daily Report Quick mode and sticky save state with focused unit tests and mobile E2E.
3. Implement Dashboard Today Pulse composition and zero-state copy with selector tests and desktop/mobile E2E.
4. Implement Project/BOQ responsive summary/card polish with weighted-progress and overflow coverage.
5. Run the full verification suite, perform a visual/accessibility acceptance pass, and update the implementation plan and review evidence.

Each step must remain independently testable. If a visual change reveals a behavioral regression, fix the smallest responsible feature boundary rather than rebuilding the workspace.

## Acceptance criteria

- A site supervisor can start a Daily Report and reach the first useful field without navigating through history or PDF UI.
- A new Daily Report can be saved from one contextual mobile action bar and clearly reports local-save/sync status.
- Dashboard first view answers today’s workers, completed work, blockers, and next plan questions with real values or one clear empty state.
- Project and BOQ are readable at 360px without horizontal scrolling, show weighted progress, and reject negative numeric inputs.
- Existing project switching, refresh persistence, JSON import/export, Daily Report CRUD/history, permissions, HR, BUYIN, Auth, Cloud, and PDF behavior remain intact.
- No fake controls, placeholder counts, duplicated mobile Save actions, or content hidden behind sticky controls are introduced.
- `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, and `npm run build` pass before completion.

## Compatibility and rollout

No migration is required. The implementation should be additive and reversible by feature boundary. If a new view model is wrong, production consumers can fall back to the existing selector output without changing stored data. No Git commit is created automatically; the repository currently has no tracked `HEAD`, so scope review remains filesystem- and test-evidence based.
