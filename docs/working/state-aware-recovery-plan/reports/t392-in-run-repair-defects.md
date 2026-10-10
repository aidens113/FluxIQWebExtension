# t392 R3: four in-run repair defects fixed (C6 steps 8-9, C12)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`. Nothing is committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done.**

- The brief's validation set passes: `Test Files 273 passed (273)`, `Tests 2321 passed | 1 skipped (2322)`.
- No `.fails` is left in those directories.
- tsc is clean.
- The structure audit passes with 317 warnings, the same count as R2.
- `service.ts` still has 4360 lines. The edit stayed on its existing packed line, so the packed-line count did not go up.

## What changed and why

### 1. A repaired run is judged against the Flow it ran

**New `AS/runtime/service/runtime-session/held-repair-verification.ts`**, exporting `automationStudioHeldRepairVerification`:

- A run whose trace kept no repair gets its request back unchanged.
- A run that kept a repair gets two things:
  - the repaired run's result check (this moved out of `service.ts`, unchanged);
  - the passed Flow, with the nodes and edges of the **last kept overlay made in the root frame** (`framePath.length <= 1`).
- "Kept" means the repair id is in `trace.repairs`. A dropped fix is never chosen. Each overlay is built on the graph its frame was running, so the last kept one already carries the kept fixes before it. When a fix is dropped, the executor puts back the graph that came before it.
- The passed Flow is kept when no kept fix was made in the root frame, when the overlay is for another `flowId`, or when there is no ledger. A fix made in a called part's frame changes that part, not the graph being verified.

**Where the graphs come from: the ledger.**

- `AutomationStudioInRunRepairLedger` gained `keepOverlay` and `overlays()`. `overlays()` is also on `AutomationStudioInRunRepairLedgerView` in `runtime-adaptation/contracts.ts`.
- `in-run-repair.ts` records `{ repairId, framePath, graph }` whenever it hands the executor an overlay.

**Wiring in `service.ts`:** only the `verifyRunResult` call changed. It now calls `verifyAutomationStudioRuntimeSessionResult(automationStudioHeldRepairVerification({ request, ledger: adaptationContext?.inRunRepairs, check: runResultCheck }))`. The name was added to the existing runtime-session import line, and the inline comment was updated.

**Test:** `.fails` is removed from `retry-result-verification.test.ts`, and it passes. I put the old line back temporarily to confirm it is a real check: the test then failed with `expected { expectedOutputs: { done: true } } to match object { retryCount: 2 }`. I restored the line afterwards.

### 2. A kept in-run fix counts as a durable change

**Both readers now read `inRunRepairs` beside `runtimePatchAttempts`, with the same predicate.** That predicate is `automationStudioDecisionAppliedAutomatically`: `autoApply` is true and `applied` is not false. An unattended fix therefore counts only once the judged settle writes `applied: true` on its receipt, which is how detached receipts are counted.

- **`durable-behavior/durable-behavior-changed.ts`** (`runtimePatchApplied`) feeds `summary.durableBehaviorChanged`.
- **`adaptiveRuntimeMetricsFromRunDetail`** sets `durableBehaviorChanged` and `adaptationApplyCount`.
  - `deterministicSuccessAfterAdaptation` is also true when the run succeeded with `failureCounts.repairedInRun > 0`. That count comes from `trace.repairs`.
  - **The function moved** from `summaries/conversions.ts` into a new `summaries/adaptive-metrics.ts`. It is exported through the barrel, and `run-detail-writer.ts` imports it from there. Without the move, `conversions.ts` would have grown to 416 lines and added one file-lines warning. It is now 383.

**Tests:**

- `.fails` is removed from `judged-promotion.test.ts:225`, and it passes. Its comment now names `adaptive-metrics.ts`.
- New cases in `durable-behavior/tests/durable-behavior-changed.test.ts`: an in-run receipt counts only once its judged end kept it.
- New cases in `service/summaries/tests/conversions.test.ts`:
  - the metrics and summary for an in-run receipt, waiting and kept;
  - no success after adaptation for a run that kept no fix, or a failed run.

### 3. C12: a repair changes only the incident's unit

**New `AS/runtime/service/runtime-session/in-run-repair-unit.ts`**, exporting `automationStudioInRunRepairUnitRefusal`. Its codes are `other_unit` and `patch_refused`.

**What it allows, by unit:**

- **A node unit:**
  - its own `temporary_target_override`, `temporary_wait_retry` or `replace_unit`;
  - an `add_handler` whose scope is `subflow` (the part the node runs in), or whose `nodeIds` are non-empty and every one is the failing node.
- **A handler or part unit:** a patch whose changed unit is that unit. An `add_handler` is refused, because the new handler is a unit of its own.

**When it runs, in `applyPatches`:**

- It runs twice.
  - Before the permission gate is asked, it reads what the patch says of itself. This replaces the old replace_unit-only check at `:241`.
  - After the preflight and overlay, it reads `overlay.changedUnit`. That catches a node inside a handler's body.
- Both checks run before `recordFix`, so a refused patch saves no adaptation and no review record.
- A refused patch returns no overlay to the executor, so there is no trial.
- The refusal is recorded as an `outcome: "none"` receipt with its code, and as a `runtimePatchAttempts` entry with `executed: false`.
- The "more than one unit" check at `:274` stays.

**Tests:**

- New `runtime-session/tests/in-run-repair-unit.test.ts`, 7 cases.
- New cases in `runtime-session/tests/in-run-repair.test.ts`:
  - a wait-retry on another node, and a handler scoped to another node, are both refused with `other_unit`. In both cases there is no adaptation, no proposal and no overlay on the ledger.
  - a wait-retry on the failing node is overlaid, and the ledger keeps its graph.
- New `runtime-session/tests/held-repair-verification.test.ts`, 5 cases.

### 4. A held fix is validated only on positive evidence

**`runtime-adaptation/held-fix-validation.ts`**: `matchedDeclared` became `provedDeclared`. The re-attempt must still have succeeded with a `matched` comparison, and then:

- **The node declares an expected state:** the fix is validated only if the re-attempt ran on a host that offers `expectation-evaluation`. The attempt's `hostCapabilities` shows this; the executor records it on every attempt (`executor/host-state.ts`).
- **No expected state is declared:** the fix is validated only if the node declares outputs and all were observed.
- **Anything else stays `testing`:** a match on the route alone, on effects alone, or on nothing. The run carries on with the fix held either way.

**Reading of the brief.** The brief says "expected state evaluated and held, *or* declared outputs observed". It also wants case 2 to stay `testing`, and case 2 declares both `expectedOutputs: { done: true }` (which is observed) and `expectedState: { settled: true }` (with no host). I read the plan's rule ("the node's expected state ... is true") as deciding whenever an expected state is declared. Outputs are positive evidence only when no expected state is declared.

**Docs and comments:** the header comments of `held-fix-validation.ts` and `judged-promotion.ts` say this.

**Tests:**

- `adaptive-retry-resume` case 2 now asserts `status: "testing"` and an empty `validationResults`, alongside the existing unverifiable verification. Its comment cites the plan's rule.
- New `held-fix-validation` cases:
  - host-evaluated expected state: validated;
  - expected state with no host, outputs observed: stays testing, unverifiable;
  - route only, or effects only, on a host: stays testing.

### 5. Statement packing

There are no packed statements in new code. The audit's `statement-packing` rule passes.

## Commands run and observed results

All run in `packages/fluxiq` unless noted. R stands for `src/programs/automation-studio/runtime`.

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`: no output, which means clean.
  - Earlier runs reported TS2379 in my new `conversions.test.ts` case, because `approvalDecision` was typed `Record<string, unknown>`. I fixed it to `{ [key: string]: JsonValue }`.
- `npx vitest run` on the four directly affected files (retry-result-verification, judged-promotion, adaptive-retry-resume, held-fix-validation): `Tests 21 passed (21)`.
- `npx vitest run` on `R/service/runtime-session`, `held-fix-validation.test.ts`, `conversions.test.ts` and `R/durable-behavior`: `Test Files 18 passed (18)`, `Tests 144 passed (144)`. That was before I added the in-run-repair cases and moved the metrics; the full set below covers both.
- Negative check: with `heldFlow` forced to return `undefined`, `retry-result-verification.test.ts` gave `Tests 1 failed (1)`, `AssertionError: expected { expectedOutputs: { done: true } } to match object { retryCount: 2 }`. I restored the line, confirmed by grep.
- The brief's full set, final run, `npx vitest run R/tests/service-adaptation R/tests/in-run-repair R/tests/service-flows R/service R/recovery R/executor R/durable-behavior`: `Test Files 273 passed (273)`, `Tests 2321 passed | 1 skipped (2322)`.
- Grep for `it.fails`, `test.fails` and `.fails(` across those directories: no matches.
- At the Core root, `node scripts/structure-audit.mjs 2>&1 | tail -1`: `structure-audit: passed (317 warning(s), 1160 baselined).` It also printed "3 baseline entries can be lowered", as in R1 and R2.
  - Before the metrics move the count was 318: the extra warning was `conversions.ts` at 416 lines.
  - Advisory warnings on my files that were already there: `in-run-repair.ts` went from 401 to 409 lines; `runtime-session/` went from 18 to 20 files (already past 15).
- `wc -l AS/runtime/service.ts`: `4360`, unchanged.

## Not verified

- No live run and no real provider; every test used scripted models.
- I did not see a held fix in a child frame, or a kept part replacement, reach the verification through the service. The root-frame-only choice is covered by unit tests only.
- A host that declares `expectation-evaluation` but whose evaluator throws: the executor keeps the attempt's comparison, which was read from its route, so the fix would be validated. Telling "evaluated" apart from "evaluator threw" needs an executor marker on the comparison. `executor/transition-comparison.ts` is not in my files.
- The full suites (`pnpm check`, `pnpm test`), per the twice-daily rule.
- `pnpm structure:baseline`: not run. The baseline file is not mine.
- `docs/architecture/automation-studio.md`: not updated, because it is not in my files. Its "A held fix is validated ..." paragraph from R2 now needs the positive-evidence rule (item 4) and the unit rule (item 3).

## Open questions or contradictions found

1. **Reroute and step insert at the failing node are now refused in-run**, with `patch_refused`. I followed the brief's list (target override, wait-retry, replace_unit and a scoped handler).
   - The in-run plan still offers `temporary_reroute`, `temporary_action_sequence` and `temporary_recovery_subflow_call` for `recovery_path_or_reroute` failures (`recovery/plan.ts:105`). A model may spend a patch call on a kind that is always refused.
   - None of them could make the re-attempt of the failing node pass anyway: a reroute adds a success edge, inserted steps sit ahead of a node that is re-attempted by its id, and the overlay already refuses a recovery Subflow call.
   - Consider dropping them from `patchKindsForPlan` when `inRunRepair` is true. That file is outside my files.
2. **Item 4: expected state decides when it is declared.** I read the brief's "or" as two alternatives with the expected state taking priority, which is the only reading that keeps case 2 `testing`. Effects alone do not count as evidence. Loosen this if you meant otherwise.
3. **The handler scope rule is strict.** A `nodes` scope that names the failing node and also others is refused. I read "names that node" together with C12: widening a handler's scope is a separate repair.
4. **The verified graph is the Flow passed in, with the overlay's nodes and edges**, not the overlay document. This guards against a root graph prepared differently from `canonicalFlowDocument(...)`. It applies only when the `flowId`s match.
