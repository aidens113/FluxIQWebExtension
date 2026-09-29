# In-flight audit, 2026-09-28 crash (inflight-audit-0928)

Worker report. This was a read-only audit: nothing was edited except this file. I compared each interrupted worker's stated plan with what is on `dev`: Core `F:\!FluxIQ` at e82089f and downstream `F:\!FluxIQWebExtension` at acc4648a.

## Outcome

Done. Two results need attention before any gate is trusted:

1. **Downstream `dev` does not compile.** `domain/src/runtime/llm-evidence/structure/packet.ts:127` fails with TS2345, because `present<>` now requires the new optional `dedupe` and `sort` keys. This is the only type error, and it breaks the domain, extension and extension-test type checks. Any `pnpm check` or `pnpm build` running now will fail on it.
2. **Core has 3 stale unit tests.** `e82089f` added fields and changed a behaviour without updating their expectations (details below). `packages/fluxiq` `tsc --noEmit` exits 0.

## Per-item classification

| Item | Repo | Status | Summary |
| --- | --- | --- | --- |
| completion-and-budget | Core | **Partial** | Defects 1, 2, 3 and 5 are in code and wired. Defect 3's resumable incomplete-draft record is missing. Defect 4 (the Lab's grant) is not started. 3 stale tests |
| repair-acts-on-verifier | Core | **Done** | Main work is in c25c0fb. The grant-purpose gate removal is in e82089f and complete: its 150 focused tests pass |
| extract-dedupe-sort | domain + ext | **Partial (read side only), breaks compile** | Parsing, schema and validation are done. No dispatch, no execution, no tests |
| in-place-effect-shadow | ext | **Not started** | `in-place-effect.ts` is unchanged since 273543e3 |
| content-specs-gate | ext | **Partial** | The spec wording and the singular "attempt" are done. Post-change validation and the "gate" are not done |
| capability-contracts | Core apps/web | **Partial** | The harness is written and runs: 19 of 54 fail. No capability fixes have been made |
| ext-ui-split | ext | **Superseded, nothing to land** | The popup-local tree (`popup/app/`) is not on `dev`. Workstream A (`ext-ws-a.md`, DONE) is what shipped as `apps/extension/src/panel/` |
| lab-selector-sync | ext test-runner | **Not started** | Findings only. The stale selectors are still in 25 files under `packages/test-runner/src` |

### completion-and-budget (Core)

**Present and wired:**

- **Instructed acts.** `flow-bootstrap/instructed-acts/*` is called from `llm/harness-options/bootstrap-completion.ts:275`. `service.ts:1583` passes `instructionText` and `draftSteps`, and `plan/evidence-schema.ts` has the `acts` field.
- **All gates at once, with the limit named.** `bootstrap-completion.ts:223` calls `profile-limits.ts` with `draft` or `reply`. A draft plan is held to 64 nodes; a reply plan is held to 16 (`plan/limits.ts:7,29`). `llm/evidence-loop/completion-attempt.ts` runs the dry run on every attempt.
- **Wrap-up.** `loop-budget.ts` sets `WRAP_UP_DECISIONS = 3` and adds `limitedBy`.
- **Exhaustion record.** It carries `budgetBound` and `outstandingIssueCodes`, and the diagnostic parses `budgetBound`.
- **Amendment refusals.** `amendmentRefusals` flat codes are written on steps (`flow-bootstrap/evidence-loop-steps.ts`).
- **Resume.** `llm/evidence-loop/resume.ts` and the `draft.resume` path in `evidence-loop.ts:507-514` exist.

**Missing:**

- **The incomplete-draft record.** The module `flow-bootstrap/incomplete-draft/` does not exist. The requirement: an exhausted build writes its best draft as a versioned `incomplete` record, and a continuation build seeds from it with `draft.seed` and `draft.resume`. No caller ever sets `draft.resume`, so the resume path is dead code. `service.ts` still drops the failed loop's `steps`. Four doc comments point at the missing module: `llm/evidence-loop/resume.ts:7`, `llm/evidence-loop/exhaustion.ts` (`outstandingIssueCodes`), `llm/loop-configuration.ts:217`, `flow-bootstrap/generation-failure/diagnostic.ts:98` and `flow-bootstrap/instructed-acts/index.ts:6`.
- **Defect 4, the token budget.** The Lab's creation grant is unchanged: `packages/test-runner/src/live-llm/execution-grant.ts`, last changed in f0be23f2.
- **No tests** cover the wrap-up, the resume entry, `completion-attempt.ts`, `limitedBy` or `amendmentRefusals`. The only new coverage of these is `budgetBound` in `diagnostics.test.ts`.
- **Stale tests.** The code is newer than these expectations:
  - `flow-bootstrap/tests/evidence-loop-steps.test.ts`, "carries every refused amendment…": it does not expect the new `amendmentRefusals` field.
  - `llm/tests/loop-budget.test.ts`, "is the fewest decisions any bound allows…": it does not expect `limitedBy`.
  - `llm/tests/unusable-decision.test.ts:352`: it expects `a.issue,b.issue,a.issue`, but `completion-attempt.ts` now de-duplicates issue codes to `a.issue,b.issue`. The supervisor should decide whether the de-duplication is intended; it looks intended.

### repair-acts-on-verifier (Core)

Done:

- **c25c0fb** contains the brief, the history, the multi-attempt repair, `draft-screen`, `request-refusal` and the closed codes.
- **e82089f** removes the purpose gate. It covers `refuted-result-port.ts`, `generation-request.ts` (the `runOwnedRepair` option, which is true only from `service.ts:2641`) and `service.ts:1489`, and adds tests. `execution_grant_purpose_invalid` is still used by the grant-refusal mapping, so it does not dangle.
- **Outstanding from its report, not in this brief's scope:** the Lab does not read `resultReauthor.degraded`, `attempts` or the brief record, and there has been no live run.

### extract-dedupe-sort (domain; the extension half was never begun)

**Present:**

- `domain/src/actions/extraction/order-request.ts`, which is new and exported from the barrel.
- The `dedupe` and `sort` types and constants in `request.ts`.
- The `extractList` schema properties in `schema.ts`.
- The read with drop-and-name in `read-request.ts`.
- `invalid_dedupe` and `invalid_sort` in `output-nodes/extract-list/issues.ts`.

**Missing:**

- **Compile fix.** Add `dedupe: undefined, sort: undefined` to the `present<>` object at `domain/src/runtime/llm-evidence/structure/packet.ts:127`. There may be other `present<WebAutomationExtractListRequest>` sites; tsc reports only this one.
- **Execution.** Nothing in `apps/extension/src` reads `request.dedupe` or `request.sort`. `content/extraction/list-reader.ts` (the `extractList` export) must apply `where`, then dedupe, then sort, then `maxItems`, and report the unreadable-value count. **Until then a model or repair that writes dedupe or sort is accepted and silently ignored.** That is worse than a refusal, because the repair loop will see an unchanged answer and stop with `not_converging`.
- **The handle form.** The comment in `request.ts` says the node carries `dedupe` and `sort` beside `extractList` and that `output-nodes/extract-list/dispatch.ts` folds them in. Neither `dispatch.ts` nor `parameters.ts` has them, so a detected-list handle request cannot carry them at all.
- **Catalog text.** `output-nodes/extract-list/catalog-text.ts` does not tell the model about the new parameters.
- **Tests.** There are no tests for `order-request.ts` and none for `read-request` dedupe or sort. `domain/src/actions/extraction/tests/read-request.test.ts:135` pins the request keys and still passes only because no dedupe or sort is supplied.
- **The report file.** It is still all "(pending)".

### in-place-effect-shadow (extension)

Not started. The target file `apps/extension/src/content/action-runtime/in-place-effect.ts` is unchanged:

- The watch observes only `document.documentElement` (lines 84-86).
- `renderedText` reads only `document.body.innerText` (lines 177-180).
- The comment at lines 38-39 still says shadow roots are not seen.

Helpers to reuse: `content/shadow-dom/composed-roots.ts` (`openRootsWithin`) and `content/shadow-dom/composed-tree.ts`.

### content-specs-gate (extension)

**Present:**

- The recovery-account wording in `e2e/content/tests/{waits,actions,check-assert}.spec.ts` and `shadow-roots/tests/shadow-root-waits.spec.ts`.
- The singular "attempt" in `src/content/action-runtime/recovery/account.ts`, with a pinning row in `recovery/tests/record.test.ts`.
- Nothing in `apps/extension` still expects "within its 1 attempts".

**Missing:**

- **Post-change runs.** Neither `test:content` nor the extension unit tests have been run since the change.
- **The gate.** `test:content` is in none of `check`, `test` or CI (`.github/workflows/testing-facility.yml` never invokes it). The brief text for "gated" was not found in any working document, so its intended form is unknown.

### capability-contracts (Core `apps/web`)

**Present:** `conversation/capabilities/tests/core-contract{,-arguments,-world}.ts`. Running the test file gives `Tests 19 failed | 35 passed (54)`. The report's "What changed" is still pending. The failures fall into three groups.

**Capability defects**, which match the report's reading-based suspicions:

- **`version.publish`, `version.deprecate`, `project.create`, `project.rename`, `recording.note` (×2), `recording.rename`.** Each requires `authorizationPin` without asking first, so it never reaches Core. Files: `catalog/versions.ts`, `catalog/projects.ts`, `catalog/recordings.ts`.
- **`permission.revokeClient`.** It sends a PIN that Core never reads. File: `catalog/running.ts`.
- **`permission.check`.** It sends no `keyId`, and Core answers "An enabled LLM key is required." File: `catalog/running.ts`.
- **`route.delete`.** Core refuses with "Route rule ID is required." and never reads `routeId`. File: `catalog/settings.ts`.
- **`flow.instruct`.** Core refuses with "Instruction title and body are required." and never reads `text`. File: `catalog/flows.ts`.
- **Aggregates.** These also fail: "reaches every endpoint…", "asks for a PIN exactly where Core requires one", and "declares a PIN argument only where it asks first".

**Likely gaps in the harness's world, not in the capabilities:**

- **`flow.build`, `flow.explore`, `permission.allowModelRun`.** Each fails with "Flow bootstrap generation runtime is unavailable." The world registers no bootstrap generation runtime (`api/handlers/llm-generation.ts:183`).
- **`flow.describe`.** The seeded Flow has a Router.
- **`subflow.delete`.** The seeded route references the part being deleted.

Each of these needs either a world fix in `tests/core-contract-world.ts` or an `EXPECTED_REFUSALS` entry.

### lab-selector-sync (extension `packages/test-runner`)

Not started; no file was edited. The stale strings are still present: "Runtime Debug", "Build Flow from instructions", "Authorize and Save", "Router: ", "Loading projects", and the old section labels. They appear in these `packages/test-runner/src` files:

- `demo-llm-create-ui/{build-flow-ui,explore-proposal-ui,apply-proposal-ui,flow-settings-ui}.ts`
- `demo-llm-blank-workspace.ts`
- `demo-workspace/{adaptation-ui,diagnosis-ui,panel-navigation,panel-run,subflow-authoring,workspace-lanes}.ts`
- `ui-e2e/assertions/{adaptations,runtime-debug,runtime-debug-facts}.ts`
- `ui-e2e/journeys/{dataset-panel,failure-log,failure-presentation,panel-rerun}.ts`
- the matching `tests/*.test.ts`

The report's findings table is the specification, written against Core c25c0fb.

## Round-2 causes mapped to code

| Rank | Cause | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Stalled loops | **Partially fixed** | 8b56084 is the stall guard. e82089f adds the wrap-up (`llm/loop-budget.ts`, `WRAP_UP_DECISIONS = 3`) and the `outstanding` tracking (`llm/evidence-loop/no-progress.ts`). Not re-measured live |
| 2 | Completion ignores the instruction's lasting actions | **Fixed in code** | `flow-bootstrap/instructed-acts/`, wired at `bootstrap-completion.ts:275` and `service.ts:1583`. 40 unit tests pass. No live run |
| 3 | Profile limit unnamed; 16 nodes too few | **Fixed in code** | `flow-bootstrap/plan/profile-limits.ts`: `limitsExceeded` names each limit with its max and actual value, and a draft plan is held to the Flow limits (64 nodes, `plan/limits.ts:7`). Not proven on bigbox or crossborder |
| 4 | An exhausted build writes nothing | **Partial** | The loop can resume (`llm/evidence-loop/resume.ts`, `evidence-loop.ts:507`), and the exhaustion record counts proposable steps and outstanding codes. But there is no record store (`flow-bootstrap/incomplete-draft/` is missing), no `service.ts` write, and no caller of `draft.resume`. In practice it is still open |
| 5 | Shadow-DOM effects | **Partial** | The snapshot and press side landed in 89a2c2e0 and 7f90ddb5. The click post-condition, `action-runtime/in-place-effect.ts`, is still open |
| 6 | Re-author `unexpected_error` | **Fixed in code** | c25c0fb: `llm/harness/draft-screen.ts` fixes the denied-key cause, and `llm/harness/request-refusal.ts` plus `generation-failure/codes.ts` give closed codes. e82089f removes the purpose gate (`refuted-result-port.ts`, `generation-request.ts`). No live run |
| 7 | Extraction columns bound to the wrong controls; the instruction's column name not kept | **Open** | No commit in either repo addresses it. e7e48db9 (anchor text) is round-1 cause 4, not this. Dedupe and sort (above) do not touch it |
| 8 | The draft loses its step to the start location | **Open** | No Core commit touches `flow-bootstrap/reachability/` since 8b56084 |

## Remaining work, partitioned by file (brief-ready)

**A. Downstream compile fix (blocking; do first).** Owns `domain/src/runtime/llm-evidence/structure/packet.ts`. Add `dedupe: undefined, sort: undefined` to the `extractList` `present<>` at line 127. Check: `npx tsc --noEmit -p domain/tsconfig.json` returns 0 errors.

**B. Core stale tests.** Owns these three files:

- `llm/tests/loop-budget.test.ts`: add `limitedBy`.
- `flow-bootstrap/tests/evidence-loop-steps.test.ts`: add `amendmentRefusals`.
- `llm/tests/unusable-decision.test.ts:352`: expect `a.issue,b.issue`, if the supervisor confirms the de-duplication is intended.

Add tests for `completion-attempt.ts`, `resume.ts` and the wrap-up in new files under `llm/evidence-loop/tests/`.

**C. Core incomplete-draft record (cause 4).** Owns:

- new `flow-bootstrap/incomplete-draft/*` and its barrel
- `flow-bootstrap/index.ts`
- `runtime/service.ts`: stop dropping `steps` on exhaustion, write the record, and seed a continuation with `draft.seed` and `draft.resume`
- a Core store or model file for the record

This work is serial with any other `service.ts` edit.

**D. Lab creation grant (defect 4).** Owns `packages/test-runner/src/live-llm/execution-grant.ts` and its test. Size the tokens so that cost and the stall guard bind, not tokens.

**E. Dedupe/sort, domain half.** Owns:

- `domain/src/output-nodes/extract-list/{dispatch,parameters,catalog-text}.ts`, for node-level `dedupe` and `sort` beside a handle-form `extractList`
- new `domain/src/actions/extraction/tests/order-request.test.ts`
- `domain/src/actions/extraction/tests/read-request.test.ts`

This comes after A.

**F. Dedupe/sort, extension half.** Owns `apps/extension/src/content/extraction/list-reader.ts` (or a new `content/extraction/order-rows.ts`) and its `tests/`. Apply `where`, then dedupe, then sort, then `maxItems`, and report the count of unreadable sort values. This can run in parallel with E once A lands.

**G. In-place effect in shadow roots (cause 5, click half).** Owns `apps/extension/src/content/action-runtime/in-place-effect.ts` and `action-runtime/tests/in-place-effect*.test.ts`. Observe open shadow roots using `shadow-dom/composed-roots.ts`, and include their text.

**H. Content specs, validation and gate.** Owns `apps/extension/package.json` or root `package.json` or `.github/workflows/testing-facility.yml`, whichever the gate lives in. Run `pnpm --filter @fluxiq-web-extension/extension test:content` and the extension unit tests. Wire `test:content` into a gate. The supervisor must decide where.

**I. Chat capability contracts (Core `apps/web`, crosses repos).** Owns:

- `conversation/capabilities/catalog/{versions,projects,recordings,running,settings,flows}.ts`, for the PIN and ask-first defaults, `keyId`, `routeId`→rule id, and `text`→title/body
- `tests/core-contract-world.ts`, for the bootstrap runtime and seed fixes, or `EXPECTED_REFUSALS` in `core-contract.test.ts`

Check: `npx vitest run src/features/automation-studio/conversation/capabilities/tests/core-contract.test.ts` in `F:\!FluxIQ\apps\web`.

**J. Lab selector sync.** Owns the 25 `packages/test-runner/src` files listed above. This can be split into two briefs: `demo-llm-create-ui/` plus `demo-llm-blank-workspace.ts`, and `demo-workspace/` plus `ui-e2e/`.

**K. Open causes 7 and 8.** These need a diagnosis brief first:

- Cause 7: extraction column binding in the extension, `content/extraction/infer-fields.ts` and the field reader.
- Cause 8: Core `flow-bootstrap/reachability/check.ts`.

## Commands run and observed results

**Core `packages/fluxiq`:**

- Focused vitest over instructed-acts, profile-limits, bootstrap-completion, generation-request, refuted-result-port, reauthor-service and diagnostics: `Test Files 8 passed (8)`, `Tests 150 passed (150)`.
- `npx vitest run runtime/llm/tests runtime/llm/evidence-loop runtime/flow-bootstrap/tests runtime/flow-bootstrap/plan`: `3 failed | 600 passed (603)`. These are the 3 stale tests above.
- `npx vitest run runtime/{llm,flow-bootstrap,flow-draft,service,result-verification,recovery}`: `Test Files 5 failed | 164 passed (169)`, `Tests 5 failed | 2150 passed | 1 skipped (2156)`. The 3 stale tests, plus 2 that timed out at 15 s under load (`flow-run-detail-reader.test.ts` and `run-detail-preservation.test.ts`).
- Those 2 rerun alone: `Test Files 2 passed (2)`, `Tests 7 passed (7)`.
- `npx tsc --noEmit -p tsconfig.json`: exit 0.

**Core `apps/web`:** `npx vitest run .../capabilities/tests/core-contract.test.ts`: `Tests 19 failed | 35 passed (54)`, the same result on both of two runs.

**Downstream type checks:**

- `npx tsc --noEmit -p domain/tsconfig.json`: 1 error, TS2345 at `packet.ts(127,66)` (missing `sort`, `dedupe`).
- `apps/extension`, `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json`: the same single error.

**Searches:**

- Grep for "within its 1 attempts" in `apps/extension`: no matches.
- Grep for the stale Lab selectors: 25 source files.

## Not verified

- No pnpm check, test or build, and no Playwright content specs; the brief forbade them. No domain or extension unit-test runs (they need the test build).
- No live runs. Every "fixed in code" above is unit-level only.
- No Core `apps/web` tsc, and no structure audit in either repo.
- My sorting of the capability-contract failures into capability defects and world gaps comes from reading the error text, not from fixing them.
- Whether any other `present<WebAutomationExtractListRequest>` site exists besides `packet.ts`. tsc reports only one.

## Open questions or contradictions found

- **The `completion-attempt.ts` issue-code de-duplication.** It breaks `unusable-decision.test.ts:352`. Is that intended?
- **"Gated" in content-specs-gate.** The brief's text is not in any working document, so what it meant is unknown.
- **The contradiction in `request.ts`.** Its comment claims a node-level `dedupe`/`sort` that `dispatch.ts` folds in, and neither exists. The schema also puts them inside `extractList`. Pick one shape before E and F are briefed.
- **ext-ui-split.** Its report still reads "Pending". It should be marked superseded or closed, since nothing of it is on `dev`.
