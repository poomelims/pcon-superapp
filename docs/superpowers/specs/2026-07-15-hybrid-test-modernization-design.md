# PCON Hybrid Test Modernization Design

## Objective

Reduce brittle source-text assertions while preserving the safeguards that protect PCON's local-first architecture, cloud boundaries, and security configuration. Tests should primarily describe observable business behavior and user workflows without changing production behavior, storage schema, API routes, or dependencies.

## Scope

This work covers the existing source-oriented tests under `tests/`, the Project Setup test source aggregator, and the existing Playwright core workflow. It prioritizes Project, BOQ, Daily Report, Dashboard, HR, and BUYIN behavior that can be exercised through pure functions or the browser.

The work does not add a component-testing package, change `pcon_project_setup_data`, alter Supabase schema or policies, redesign UI, expand Phase 1 features, or require a live cloud backend.

## Test Classification

### Convert to unit or contract tests

Assertions about calculations, filtering, sorting, permissions, save-state decisions, date formatting, active-company scoping, report history, and snapshot selection should import and exercise real exported functions. Existing functions in `lib/` remain the preferred test surface. A small pure selector or view-model helper may be extracted only when behavior currently exists solely inside a React component.

The main conversion targets are behavioral assertions currently located in:

- `daily-report-ui-refresh-source.test.ts`
- `daily-report-cloud-history-source.test.ts`
- `data-audit-source.test.ts`
- `project-save-cloud-source.test.ts`
- `project-action-permissions-source.test.ts`
- `hr-phase-source.test.ts`
- `hr-buyin-cloud-save-source.test.ts`
- `buyin-source.test.ts`

### Convert to Playwright E2E

Assertions that describe visible interaction should use the running application and semantic locators. Coverage should include:

- tab navigation and the fixed four-item mobile navigation;
- project switching and active-project context;
- scroll reset and focus movement after navigation;
- one contextual Daily Report save action on mobile;
- report history selection and create-versus-edit state;
- PDF preview loading only after it is requested;
- responsive overflow and critical controls at 360, 390, 768, and 1440 pixel widths;
- Dashboard zero-state values without fallback-generated counts.

Tests must use roles, labels, test IDs, and user-visible values. They must not assert Tailwind class strings.

### Retain as narrow source contracts

Static source inspection remains appropriate where runtime behavior cannot directly prove the invariant or would require a live privileged backend. Retained contracts are limited to:

- explicit dynamic import boundaries and the thin route wrapper;
- server-only Supabase/service-role handling and absence of hardcoded credentials;
- required API route and schema declarations;
- global CSS primitives that have no runtime semantic equivalent;
- absence of fake controls such as `href="#"` and empty click handlers;
- PDF export slicing markers whose primary contract is passed to the rendering library.

Retained source tests must read only the smallest relevant file. They must not concatenate all Project Setup feature sources.

## Architecture

Business behavior remains in or moves to focused modules under `lib/` or a feature-local `*-selectors.ts` file. React views consume these pure functions. Unit tests import those functions directly, and Playwright covers integration between views, persistence, and browser interaction.

`tests/project-setup-source.ts` will be removed after no test depends on the aggregate. Feature-boundary tests may continue reading specific files because their subject is the source boundary itself.

No production helper will expose test-only state. Any extracted function must have a real runtime consumer and a typed input/output contract.

## Data and Compatibility

All tests use the existing `ProjectControlData`, `Project`, and `DailyReport` types. Fixtures must include `companyId` and `projectId` and must pass through the existing normalization and repository APIs where persistence is involved.

The following compatibility requirements remain unchanged:

- localStorage key: `pcon_project_setup_data`;
- legacy JSON import/export round trip;
- immediate local persistence for Project edits;
- explicit Save for Daily Report history creation and edits;
- weighted BOQ progress calculation;
- Cloud unavailability never blocks the local workflow.

## Error Handling and Test Isolation

Unit tests use deterministic dates and explicit fixtures. Playwright clears localStorage before each scenario and never depends on test order. Cloud-facing decisions are tested through pure functions or existing API contracts; no privileged credentials are written into tests.

If modernization exposes a production regression, the failing behavioral test is retained, the smallest production fix is made, and the complete existing suite is rerun. Refactoring alone must not alter user-visible copy or persisted data.

## Acceptance Criteria

- No behavioral test asserts responsive utility-class strings or searches the aggregated Project Setup source.
- `tests/project-setup-source.ts` is removed.
- Source inspection remains only for the narrow architecture, security, schema, or rendering-library contracts defined above.
- Core Project/BOQ/Daily Report E2E coverage continues to pass.
- New Dashboard zero-state, navigation/focus, history state, and PDF-on-demand behavior is covered at the appropriate unit or E2E layer.
- No new runtime or test package is added.
- `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- No Git commit is created automatically.

## Implementation Order

1. Inventory and classify every assertion that consumes `readProjectSetupSource`.
2. Add failing unit tests for pure behavioral contracts and extract minimal runtime selectors where required.
3. Add failing Playwright scenarios for visible behavior not already covered.
4. Remove superseded source assertions after their replacements pass.
5. Narrow retained source contracts to individual files and remove the aggregate source reader.
6. Run full verification and compare test coverage against this specification.
