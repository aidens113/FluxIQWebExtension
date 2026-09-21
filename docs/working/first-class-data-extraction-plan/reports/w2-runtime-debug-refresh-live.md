# Runtime Debug Refresh Live

Status: Complete; pre-fix reproduced and post-fix production path passed
Updated: 2026-09-20
Owner: `w2-runtime-debug-refresh-live`

## Scope and isolation

- Paired task worktrees: `F:\fxwork\t030\!FluxIQWebExtension` and
  `F:\fxwork\t030\!FluxIQ` on `task/t030-runtime-debug-refresh`.
- Live work uses a disposable run root below
  `F:\fxlab-runs\t030-runtime-debug-refresh-live`; the user store and browser
  profiles are out of scope.
- The production panel, unpacked Chrome extension, and Scenario Lab
  `product-catalog` path are the validation target.
- No product source has been edited. The first boundary is a live reproduction
  of the stale post-run Runtime Debug state.

## Findings and validation

### Pre-fix production reproduction

The real production journey ran against the isolated pre-fix pair on panel
port `3386` and gateway port `4956`, using an unpacked Chrome extension and the
Scenario Lab `product-catalog` page. It passed every data boundary before the
UI refresh boundary:

| Boundary | Observed |
| --- | --- |
| Picker proposal | 8 items |
| Recorded extraction | 8 captured records |
| Panel-started Flow | `succeeded` |
| Durable dataset | 8 stored rows |
| Record oracle | passed |
| Runtime Debug after completion, without reload/reopen | `0 runs` |
| Completed run id in already-open detail | visible |
| Dataset controls | absent |

This reproduces the reported defect through the production panel rather than a
component test. No product source had been edited when it ran.

### Root cause and narrow fix

Runtime Debug had two independent stale caches. `FlowRunView` rendered its
header count only from the project-summary `runtimeSessions` prop, although its
own run command did not refresh that summary. It also focused the new run as
soon as it was queued. Once focused, `RunHistory` stopped subscribing to
`runtime-run.changed`, while `RunActionLogView` loaded detail only when the
project id or run id changed. The terminal mutation therefore named the same
selected run but refreshed neither its detail nor its datasets.

The fix keeps mounted-view run ids in the header count until the outer summary
catches up. The run-history mutation subscription now remains active in both
list and selected-log views; a change for the selected run advances a local
revision key and reloads only that run detail. Changes for other runs still
refresh only the list. Focus and visibility refresh the currently visible
surface as before.

### Post-fix production proof

The same production path ran in a second fresh isolated store/profile on panel
port `3387` and gateway port `4957`. The panel was not reloaded and Runtime
Debug was not reopened after playback.

| Boundary | Observed |
| --- | --- |
| Picker proposal | 8 items |
| Recorded extraction | 8 captured records |
| Panel-started Flow | `succeeded` |
| Durable dataset | 8 stored rows |
| Record oracle | passed |
| Runtime Debug count | `1 run` |
| Completed run | visible |
| Dataset control | visible, 8 rows |
| Dataset preview | all 8 rows rendered |
| Export controls | CSV and JSON visible |

The live driver asserted these boundaries before any focused unit-test or build
validation was started.

## Focused validation

- Runtime Debug interaction files: 2 files, 8 tests passed. The new coverage
  proves a locally started run increments the mounted view before project
  summary hydration, and a terminal mutation reloads the already-selected run
  detail so its dataset appears.
- `pnpm --filter @fluxiq/web check`: passed.
- `pnpm --filter @fluxiq/web build`: passed; the optimized Next production
  build compiled, type-checked, generated all 16 static pages, and completed.
- `pnpm structure:check`: passed with existing baseline/advisory warnings and
  no violation.
- One initial focused assertion failed only because React split the dataset
  button's text into four children; the rendered succeeded detail already
  contained the eight-row dataset. The assertion was corrected to join button
  text and the two-file focused run then passed 8/8.

## Handoff

- Core product edits are limited to Runtime Debug's mounted run count and
  selected-run mutation refresh, plus focused tests.
- Downstream changes are limited to this report; the live driver and all run
  artifacts are ignored and disposable.
- No t027/t029 worktree, shared `dev`, user `.fluxiq`, user browser profile,
  commit, merge, or push was touched.
