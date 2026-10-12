# t392 R1: in-run repair runs today's diagnosis -> patch pipeline; a deliberate stop never calls the model

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`. Nothing is committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Partial.** The brief's own work is done, and its checks pass:

- The in-run repair now runs the after-run recovery pipeline, with all its gates. E2b's separate request path is deleted, so there is one pipeline.
- A deliberate stop never calls the model, in the run or after it.
- The four named files pass (19/19). Only one expectation changed (below).
- The datasets wiring test now passes.
- tsc is clean and the structure audit passes.

What stays red:

- **16 tests in nine `service-adaptation` files.** Each cause is listed below. Most assert the detached resume (`adaptiveRetry`), which the plan now keeps only for runs that cannot hold in place.
- **The two `service-flows/tests/representation.test.ts` cases** (not my file). They need a two-line change, given below. I verified it on a temporary copy, and all 10 cases passed.

## What changed and why

### 1. One pipeline (C6 step 8)

**`AS/runtime/recovery/annotation/annotate.ts`** (the after-run pipeline) takes a new optional input, `inRun` (`annotation/in-run.ts`). It has three fields, one for each difference the brief allows:

- **`slot`**: I's typed `inRunRepair` packet slot. It goes on the `runtime_patch` call only. The plan is built with `inRunRepair: true`, so it offers `add_handler` and `replace_unit` beside today's kinds. The re-plan after exploration does the same (`replan.ts` gained `inRunRepair`).
- **`apply`**: replaces `applyAutomationStudioRuntimeRecoveryPatches` (trial on a clone, then resume). It overlays the patches on the held run. The executor's re-attempt is the trial.
- **`purse`**: one run-level purse, `{ budget, ledger }`. Every incident in the run draws on it, so "one atomic call budget" holds across incidents as well as across diagnosis and patch.

Everything else is today's code, run unchanged while the run is held:

- the invocation gate (including `manual_intervention` for a graph failure);
- the training-mode and budget refusals;
- provider resolution, including the throw intervention and the missing-provider intervention;
- the standing (unattended) authority;
- failure-evidence capture, including the malformed-evidence stop before any call;
- the diagnosis at `gather` and the deterministic plan;
- exploration, with the permission ask in the run's thread;
- the patch at `implement`;
- the permission gate and `permission_required`;
- interventions, `llmGate` and `recoveryTrace`.

**`AS/runtime/service/runtime-session/in-run-repair.ts`** (rewritten). `repairIncident` now does the following, in order:

1. Asks the ledger once per incident.
2. Reads the part graph and builds the unit contract.
3. Calls `annotateAutomationStudioRunDetailWithRuntimeLlm`. It passes the run-so-far detail, `runtimeFlow` (the held graph), `failedTraceAttempt` and the run's graph options, plus `inRun`.
4. Keeps the pipeline's record on the ledger: interventions, adaptation and proposal ids, `llmGate`, `recoveryTrace`, `permissionRequest` and `runtimePatchAttempts`.
5. Returns the overlay, or `none`. The reason for `none` comes from the gate: `patchHeldCode`, then `patchSkippedCode`, then `code`, with its sentence.

E2b's applier is kept: the kind and unit checks, the permission gate, the preflight through `prepareAutomationStudioInRunRepair`, `recordFix`, the receipts and the part graphs. A refused answer is now also recorded as one not-run attempt (`executed: false`, `retryOriginalAction: false`, `code`, `issues`), the way the after-run applier records every patch that never ran. The audit also refused an empty return from a `catch`.

**Removed duplicates:**

- `AS/runtime/recovery/in-run-repair/request.ts` is deleted, with `requestAutomationStudioInRunRepair`, its purse type and its refusal codes.
- `automationStudioInRunRepairPatchKinds` is gone from `recovery/plan.ts`.
- The slot is built by a new `recovery/in-run-repair/slot.ts` (`automationStudioInRunRepairSlot`).
- The target-override evidence check moved out of `patches.ts` into `annotation/target-evidence-check.ts`. Both appliers use it, so an in-run target override is now also judged against the explored packets the patch request carried, not only the failure packet.

**The run detail** (`service/runtime-adaptation/context.ts`, `contracts.ts`). `runtimeRunDetailWithAdaptationContext` adds the following to the detail:

- each in-run recovery's interventions, so usage rolls into the summary when it is saved;
- its adaptation and proposal ids;
- the latest `llmGate`, `recoveryTrace` and `permissionRequest`;
- every recovery's `runtimePatchAttempts`.

The ledger view gained `recoveries()` and `fault()`.

**Early refusals** moved out of `annotate.ts`, into a new `annotation/early-refusal.ts`. `annotate.ts` had reached 802 lines, past the 800 limit; it is now 753. The behaviour is the same, with three changes:

- An incident the run already asked about returns the detail unchanged when the in-run record is already on it. `llm.gate.repaired_in_run` is now only the fallback.
- If the held recovery threw (a read it deliberately does not catch, such as the run's thread), the after-run step throws that fault again. The run session then ends the run on it, as before E2b. This is what fixed the datasets test: the executor reads a throw from `repairIncident` as `none`, so the store-loss throw never reached `endAutomationStudioRuntimeSessionAfterThrow`, and `projectStoreUnavailable` was never written.
- A run whose newest unresolved failure is an End's failed attempt gets `llm.gate.deliberate_stop`, and no model is asked (see section 2).

**Judging a run whose fix held** (`AS/runtime/service.ts`, wiring, same line, 4360 lines before and after). `verifyRunResult` now re-decides the result check with `automationStudioRepairedRunResultCheck` when `session.trace.repairs` is non-empty. Before, only the detached resume was judged "as repaired". A run whose in-run fix held was therefore left `unverified` under a sparse schedule, so its fix could never be saved.

The `bindAutomationStudioInRunRepair` call (same line) now also passes `...runLlm`, `authorizedExternalSideEffects` and `useReusableContext`.

### 2. Deliberate stop (C6, "What counts as a true failure")

**`AS/runtime/executor/step-loop/failed-attempt.ts`.** A failed attempt of an End with `resultStatus: "failed"` now returns at the top of `automationStudioStepFailedAttempt`. That is before the effect check, the ladder, On Retry, On Fail, any incident, or the repair call. The run ends with the End's authored `message`, else the attempt's message. The existing `failedRouteNode` check uses the same predicate, `isDeliberateStop`.

**After the run.** The new `llm.gate.deliberate_stop` refusal in `early-refusal.ts` covers the detached recovery, which otherwise diagnosed the End's failed attempt.

**K's test.** `.fails` is removed from K's pinned test in `tests/in-run-repair/tests/service-proofs.test.ts`. It now passes, and it also asserts:

- the incidents are exactly `["planned_fail"]`;
- `llmGate.code` is `llm.gate.deliberate_stop`.

### Changed test expectations, with the clause behind each

| File | Change | Plan clause |
| --- | --- | --- |
| `tests/service-adaptation/tests/recovery-trace.test.ts:113` (one of the four) | The patch prompt version is `...runtime-patch.v1+stage.implement+in_run_repair`. | C6 step 8: the request carries the incident's unit; I's slot marks the version. |
| `tests/in-run-repair/tests/service-proofs.test.ts` (true failure, held and dropped) | Calls are `["runtime_diagnosis","runtime_patch"]`, not `["runtime_patch"]`. | C6 step 8, "today's diagnosis -> patch request". |
| `tests/in-run-repair/tests/service-proofs.test.ts` (dropped) | `llmGate` is the in-run recovery's own (`invoked: true`), and both versioned interventions are on the detail, not `llm.gate.repaired_in_run`. | C6 step 8 plus brief item 1 (the gates' and usage records). |
| `tests/in-run-repair/tests/service-proofs.test.ts` (deliberate stop) | `.fails` removed, and the incident and gate asserted. | C6, "a deliberate stop ... never a model call". |
| `service/runtime-session/tests/in-run-repair.test.ts` | Diagnosis then patch. The second incident past the ceiling now gets a diagnosis refused by the shared ledger (`llm_budget.run_cost_limit`), not E2b's pre-call sentence. New: the recovery record, the not-run receipt for a refused fix, and the fault carry-through. | C6 step 8 and C7 (one run budget). |
| `service/runtime-session/tests/in-run-repair-fixture.ts` | The scripted model also answers the diagnosis and any exploration decision. | Same. |
| `recovery/in-run-repair/tests/request-slot.test.ts` | Now drives the slot through `repairIncident`: the slot is on the patch request only, and the diagnosis carries none. Handler and part ids are tested through `automationStudioInRunRepairSlot`. | C6 step 8. |

`llm-diagnosis.test.ts`, `llm-run-caller.test.ts` and `run-consequence-permission.test.ts` pass unchanged.

## Commands run and observed results

All were run in `packages/fluxiq` unless noted.

- `npx vitest run` on the four named files: `Tests 19 passed (19)`.
- The brief's set, final run: `npx vitest run AS/runtime/tests/service-adaptation AS/runtime/tests/in-run-repair AS/runtime/tests/service-flows AS/runtime/service AS/runtime/recovery AS/runtime/executor`. It printed `Test Files 10 failed | 258 passed (268)`, `Tests 18 failed | 2261 passed | 1 skipped (2280)`. The 18 are the 16 and 2 listed below.
  - Before my work, the same failures stood at 42 in `service-adaptation`, plus 1 in datasets, plus the in-run tests.
- `service/datasets/tests/service-wiring.test.ts` with `service/runtime-session`: `Tests 93 passed (93)`.
- `tests/in-run-repair`: `Tests 7 passed (7)`. `service/runtime-session/tests/in-run-repair.test.ts`: `7 passed (7)`.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`, final run: no output (clean).
- At the Core root:
  - `node scripts/structure-audit.mjs 2>&1 | tail -1`: `structure-audit: passed (315 warning(s), 1160 baselined).` It also printed "3 baseline entries can be lowered".
  - `--rule statement-packing`: `passed (0 warning(s), 452 baselined)`, with "2 baseline entries can be lowered".
  - An intermediate audit run failed once, on `failure-as-empty` in `in-run-repair.ts:196`. That is fixed (the not-run receipt above).
- `wc -l AS/runtime/service.ts`: 4360, the same as E2b reported.
- **Probes**, temporary and deleted:
  - A store-loss run: before the fault carry-through, the attempt's repair reason read "The fix could not be asked for: ... pool is closing", and there was no `projectStoreUnavailable`.
  - A copy of `representation.test.ts` with the two-line change below: `10 passed (10)`.

## The 16 that still fail (nine files), with causes

**A. They assert the detached resume, which an adapting run no longer takes** (plan C6 step 8: "it stays only for runs that cannot hold in place"). The in-run fix holds in place, so there is no `adaptiveRetry` and the run succeeds at the failing step. Each needs rewriting onto the in-run path, or onto a run that cannot hold.

- `adaptive-loop` "completes an adaptive runtime loop..." (:209)
- `adaptive-retry-resume` both cases (:147 `adaptiveRetry`; :170 expects `failed`, but the held fix succeeds)
- `caller-paid-result-check` "judges a run repaired by its resumed retry..." (:222)
- `judged-promotion` "is not applied while..." (:199) and "judges a trial that ran the Flow to its end..." (:250)
- `retry-result-verification` (:209)
- `unattended-repair-authority` "obtains a model, repairs itself, retries..." (:300)
- `unattended-retry-verification` "is judged under the Flow's standing authorization..." (:288) and "refuses cleanly when the standing authorization has expired..." (:344)

**B. They read the detached receipt in `runtimePatchAttempts`.** In-run fixes leave their receipt in `metadata.inRunRepairs` (E2b's design, kept).

- `judged-run-evidence` (:207 and :242) expect `runtimePatchAttempts[0]` with `resumable` / `notResumableCode`.
- `unattended-retry-verification` "carries no manual approval..." (:311) reads `runtimePatchAttempts[0].approvalDecision`. The same decision is in `inRunRepairs[0].approvalDecision`.

**C. The in-run adaptation stays `testing`, not `validated`.**

- `adaptive-loop` "allows a validated low-risk runtime adaptation unattended..." (:83)
- `judged-promotion` "stays unapplied when nothing judged the run..." (:238)

E2b records an in-run fix as `unverifiable` (`in_run_trial`, `awaitsJudgedRun`), and nothing moves it to `validated` when its trial holds. The detached path marked a passed trial `validated`. This is a real behaviour difference; see Open questions 2.

**D. The prompt version only** (`iterating-recovery` :79): the patch call's version now ends `+in_run_repair`. It is the same intended change as in `recovery-trace`. The fix is to append `+in_run_repair` to the fourth expected `promptVersion`.

**`service-flows/tests/representation.test.ts`** (both cases; not my file). Its scripted run now makes the diagnosis call first. Two lines need to change:

- `:398`: `toEqual(["runtime_patch"])` becomes `toEqual(["runtime_diagnosis", "runtime_patch"])`.
- `:399`: `JSON.stringify(requests[0])` becomes `JSON.stringify(requests)`, so every request is checked for the note.

## Not verified

- No live run and no real provider. Everything used scripted models.
- Exploration while held is exercised only by `run-consequence-permission` (a press that asks permission in the run's thread) and `iterating-recovery` (two gathers). I did not check that an exploration that acts on the page leaves the held continuation valid. The brief requires the same pipeline, so it now runs; E2b had skipped exploration for exactly that reason.
- In-run repair inside a child frame, and of a part, through the service.
- The full suites (`pnpm check`, `pnpm test`), per the twice-daily rule.
- I did not run `pnpm structure:baseline` (the "can be lowered" notes). `.structure-baseline.json` is not mine.

## Open questions or contradictions found

1. **Docs (not mine).** `docs/architecture/automation-studio.md` :1326-1345, steps 1-3 of "The run session supplies the callback", still describes E2b's design:
   - one `runtime_patch` request, with no diagnosis and no exploration;
   - `request.ts` and `automationStudioInRunRepairPatchKinds`;
   - `metadata.inRunRepair`;
   - "nobody is asked while the run is held".

   It should now say:
   - the callback runs the after-run pipeline (`annotation/annotate.ts` with `annotation/in-run.ts`): diagnosis, plan, exploration, patch;
   - the slot is the typed `inRunRepair` slot;
   - the permission ask goes to the run's thread;
   - one purse per run;
   - the gate and interventions join the run detail;
   - a deliberate stop is `llm.gate.deliberate_stop`.
2. **Should a held fix mark its adaptation `validated`?** The cause is C above. A natural place is the judged settle (`runtime-adaptation/judged-promotion.ts`, mine): when a receipt's `repairId` is in `session.trace.repairs`, move the adaptation from `testing` to `validated`. I did not do this because the brief did not ask for it. Tell me if you want it.
3. **Behaviour that is new in the run**, all of it the after-run pipeline's own:
   - More model calls per incident than E2b's one: a diagnosis, plus exploration and re-plan calls when the plan asks for them.
   - A fix that needs a permission now asks the person in the run's thread while the run is held. E2b had set `answerable: false`.
4. **The detached path stays only for a run that ended failed without the executor asking**: a pause at the failure, a true failure after an uncertain act, or a run with no callback. I deleted no detached code.
