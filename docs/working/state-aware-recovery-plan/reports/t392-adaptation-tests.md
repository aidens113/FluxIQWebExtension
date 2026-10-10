# t392 R2: the after-run repair tests move onto in-run repair, a held fix is validated, and the architecture doc is corrected

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`. Nothing is committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done, with three findings for the lead.**

- The brief's validation set passes: `Test Files 269 passed (269)`, `Tests 2291 passed | 1 skipped (2292)`. That is all 18 of R1's failures.
- tsc is clean. The structure audit and its docs-links rule pass.
- Item 1 is built and tested. A held fix whose re-attempt matched what its step declares moves from `testing` to `validated`. It is still saved only after the judged end.
- Two product defects outside my files turned up (Open questions 1 and 2). Each is pinned by one `it.fails` test that fails exactly on the defect line, so it flips when the defect is fixed. I did not fix them.
- The brief's premise for Group C was right for one of its two tests only. `adaptive-loop` :83 could not pass on item 1 alone, because its fix targets a node that is not the failing unit. I rewrote it (table, row 1).

## What changed and why

### 1. A held fix is validated (lead's decision on R1's open question 2)

**New `AS/runtime/service/runtime-adaptation/held-fix-validation.ts`** (103 lines), exported through the directory barrel:

- `validateAutomationStudioHeldInRunRepairs` moves each held fix whose trial passed from `testing` to `validated`. It appends the re-attempt as a `trial` validation result: `status: "succeeded"`, `basis: ["in_run_trial"]`, this run's id.
  - It leaves alone anything not `testing`.
  - It touches neither the approval decision nor the verification metadata. Saving is still the judged settle's job.
  - A store that went away leaves the rest unvalidated and does not throw. Any other store error throws.
- `automationStudioRunInRunRepairAdaptationIds` moved here from `judged-promotion.ts`. Its behaviour is unchanged, and the new file uses it.

**How "passed its trial" is read.** `trace.repairs` alone is not enough. The executor marks a repair `held` when it overlays the fix, before the re-attempt runs (`executor/step-loop/incident-repair.ts:181`). Only a re-attempt that fails the same incident drops it (`:197`). So a run cancelled, or stopped uncertain, during the re-attempt still lists the repair. A fix counts as having passed when all of these hold:

- its repair id is in `trace.repairs`;
- the attempt carrying that id is found;
- a later attempt of the same node, in the same frame, has `status: "succeeded"`;
- that attempt's comparison is `matched` against something the node declares: outputs, effects, a route or a state. The `expectedStatus` every step carries does not count.

A child frame's attempts are searched through its Call Subflow attempt's `childTrace`.

**One refinement of the lead's rule, and why.** A held fix whose step declares nothing to match stays `testing`. The detached path does the same: a trial with no evidence is `unverifiable` and stays `testing`, and t267 makes the judged run its evidence. If such a fix were validated, `judged-run-evidence` would change, including a case that passes today. Its "stays unapplied, with no evidence recorded, when that whole run is refuted" asserts that `validationResults` is empty. A dropped fix stays `testing`, as the brief asks.

**Wiring** (`judged-promotion.ts`, `settleAutomationStudioRunJudgedPromotions`):

- Validation runs at the run's settle, before the promotion settle, whether or not the run may promote. The detached path also validates a passed trial regardless of promotion.
- A run with no held repair, or one that threw (`reason`), still reads nothing. The t258 "reads nothing for a run whose context cannot promote" test passes unchanged.
- A non-promoting run whose record cannot be read returns its session unchanged. It does not write the promotion's store note.
- The header comment says all this.

**Tests: new `runtime-adaptation/tests/held-fix-validation.test.ts`, 11 cases.**

- Validated, with the trial recorded.
- Dropped stays `testing`.
- Nothing declared stays `testing`.
- The run stopped before the re-attempt succeeded.
- Another frame's same-named node is not read as the trial.
- A child frame's re-attempt is read through its Call Subflow attempt.
- A change no longer `testing` is untouched.
- Store gone versus a store error.
- Receipt matching.
- A non-promoting run's settle validates and applies nothing.
- A run that threw reads nothing.

At service level, `adaptive-loop` :79, `adaptive-retry-resume` and `judged-promotion` "stays unapplied when nothing judged" assert the `validated` status. The `judged-run-evidence` cases assert the evidence list stays exactly the judged run.

### 2. Group A: onto the in-run path

**No service-level run can both fail to hold and still be patched and resumed, so no Group A test could stay on the detached path:**

- `heldBy()` is non-null only while the run sits held at a checkpoint (`run-control/run-controller.ts:139`), never at the moment a step truly fails. So "a pause at the failure" cannot be produced.
- An uncertain stop is never patched (`tests/in-run-repair/tests/service-proofs.test.ts:336`).
- "No callback" exists only for runs that do not invoke the model, do not create adaptations, are dry runs, or are the `diagnosis_only` / `diagnose_and_adapt` lanes. None of those applies or resumes a fix.

The detached mechanism stays covered where it is decided:

- `service/adaptations/tests/adaptive-retry.test.ts`: `:20` resumes at the trial's node; `:31` refuses an unvouched verdict with its code; `:55` refuses to restart a completed trial.
- `service/runtime-adaptation/tests/repair-rerun.test.ts`: `:126` resumes on the candidate; `:214` adopts a trial that ran to the end.

This is said in `adaptive-retry-resume.test.ts`'s header.

**Gates kept, each with an in-run assertion:**

- the standing authorization: unattended-repair-authority and unattended-retry-verification;
- the caller's key for repair checks: caller-paid;
- the `after_repair` result check;
- the judged-run gate on saving: judged-promotion, judged-run-evidence, adaptive-loop;
- the verification refusal: adaptive-retry-resume case 2 keeps the fix unsaved without a judged run, and the detached `check_unknown` refusal stays covered by `adaptive-retry.test.ts:31`.

### 3. Group B: receipts from `metadata.inRunRepairs`

The receipt does not carry the same fields as a detached one. It has none of `resumable`, `notResumableCode`, `resumeFrom`, `restoredExpectedState` or `verification`, and `retryOriginalAction` is `false`. Those are detached-trial concepts.

- Where a test asserted them, the in-run equivalents are asserted instead.
- The verification moved to the adaptation's `metadata.verification` (`unverifiable`, `in_run_trial`, `awaitsJudgedRun`).
- "The run carried on" is now the receipt's `repairId` in `trace.repairs`.
- `approvalDecision` reads the same.

### 4. Group C, D and representation

- Group C:
  - `judged-promotion` "stays unapplied when nothing judged" passes on item 1 with no change.
  - `adaptive-loop` :83 did not pass on item 1 (see Outcome; table, row 1).
- Group D: the explore_and_adapt row now ends `+in_run_repair`. The diagnose_and_adapt row keeps the old version: that intent is a proposal run with no callback (`in-run-repair.ts:92`), so it never holds. A blanket append would have broken it.
- `representation.test.ts` :398 and :399 are changed exactly as R1's report gave them.

### 5. Docs (`docs/architecture/automation-studio.md`)

**"The run session supplies the callback" is rewritten** (now five steps):

1. the one after-run pipeline (`annotation/annotate.ts` with `annotation/in-run.ts`), with its gates, diagnosis, plan, exploration and patch;
2. the typed `inRunRepair` slot, on the patch request only;
3. the permission ask in the run's thread;
4. one purse per run;
5. the checks before overlay, including the target-evidence check, and the records: the gate, interventions, ids, `recoveryTrace` and `permissionRequest` on the run detail.

**New paragraphs:**

- "A deliberate stop never calls the model": `llm.gate.deliberate_stop`.
- "A held fix is validated, and saved only after a judged whole run". It also says a run whose fix held is judged under `after_repair`.

**"The detached path is for a run that could not hold"** now lists the executor's actual refusals from `mayAsk`. It also covers the in-run record already being on the detail, and the fault carry-through.

**Failure counts:** `repairedInRun` is named beside `failureCounts` (around line 972).

Nothing else in the file was touched. It already carried uncommitted changes from earlier units.

### Every changed expectation

All test paths are under `AS/runtime/tests/`. "Pinned" means the test is `it.fails` with a comment naming the defect.

| # | File:line | Before -> after | Plan clause |
| --- | --- | --- | --- |
| 1 | `service-adaptation/tests/adaptive-loop.test.ts:79` (was :83) | Scenario: a builtin `divide` fails and the fix is a wait-retry on `constant`, a node off the path. Now `drift` fails and the fix is a wait-retry on `drift`, using the second case's node, hoisted into `driftRuntime()`. `patch.targetId` changes from `constant` to `drift`. The decision's `confidence` changes from `provisional` to `unverified`, and its `reason` from "trial succeeded" to the judged-run-evidence reason (`JUDGED_RUN_REASON`). New: `validationResults: [in_run_trial]`. The stored drift has no `retryCount` (was: stored `constant` unchanged). The receipt moves from `runtimePatchAttempts` to `inRunRepairs`. Status `validated`, `not_judged`, autoApply and metrics are unchanged. | C6 step 8: the re-attempt is of the failing unit, and the decision is made at the overlay, before the trial ("saved only after the run's judged end"). C12: one unit. |
| 2 | `service-adaptation/tests/adaptive-loop.test.ts:209-212` | `adaptiveRetry {attempted, succeeded, candidateAdaptationIds}` becomes no `adaptiveRetry`, plus an `inRunRepairs` receipt carrying `trace.repairs[0]` and the adaptation id. The `adaptiveMetrics` assertion is removed here and pinned in row 9. | C6 step 8 |
| 3 | `service-adaptation/tests/adaptive-retry-resume.test.ts:150` | "continues at the node the trial reached" becomes "carries on at the failing step with the fix held". `calls.charge === 1` is kept. `adaptiveRetry` and `runtimePatchAttempts {resumable, resumeFrom}` become: no `adaptiveRetry`; attempts start, charge, drift failed (held), drift succeeded, end; and an `inRunRepairs` receipt. | C6 step 8 ("the run simply continues") |
| 4 | `service-adaptation/tests/adaptive-retry-resume.test.ts:172` | "refuses to continue past a repair the verdict did not vouch for" (status `failed`, `check_unknown`) becomes "keeps a held fix whose step's expected state no host evaluated unsaved until a judged run vouches for it". The run succeeds and charges once. The receipt reads `not_judged`, the fix is not applied, and its verification is `in_run_trial` / `awaitsJudgedRun`. The detached refusal stays covered by `adaptive-retry.test.ts:31`. See Open question 3. | C6 step 8, plus the existing judged-promotion gate |
| 5 | `service-adaptation/tests/caller-paid-result-check.test.ts:218-224` | Name: "repaired by its resumed retry" becomes "repaired at its failing step". `adaptiveRetry` becomes held, via `trace.repairs` and `inRunRepairs`. The key and `after_repair` assertions are unchanged. | C6 step 8 |
| 6 | `service-adaptation/tests/iterating-recovery.test.ts:84` | The fourth `promptVersion` gains `+in_run_repair` for `explore_and_adapt` only. | C6 step 8 (I's slot marks the version), brief item 5 |
| 7 | `service-adaptation/tests/judged-promotion.test.ts:196-212` | `adaptiveRetry` becomes no `adaptiveRetry`, an `inRunRepairs` receipt, and attempts `[start, extract, drift, drift, end]`. The receipt moves from `runtimePatchAttempts` to `inRunRepairs`. The `adaptiveMetrics` line moves to row 9. | C6 step 8 |
| 8 | `service-adaptation/tests/judged-promotion.test.ts:267-283` | Name: "a trial that ran the Flow to its end" becomes "a held fix's re-attempt that ran the Flow to its end". `adaptiveRetry {trialCompleted}` becomes an `inRunRepairs` receipt. The `completedTrace` check moves from `runtimePatchAttempts` to `inRunRepairs`. Attempts `[drift failed, drift succeeded]`, applied, and the stored value 2 are unchanged. | C6 step 8 |
| 9 | `service-adaptation/tests/judged-promotion.test.ts:225` (new, pinned) | Asserts `adaptiveMetrics {durableBehaviorChanged: true, adaptationApplyCount: 1, deterministicSuccessAfterAdaptation: true}` and `summary.durableBehaviorChanged: true` for a kept in-run fix. Today it fails on the metrics line. | C6 step 8 (the fix is saved after the judged end, so behaviour changed) |
| 10 | `service-adaptation/tests/judged-run-evidence.test.ts:202-218` | Receipt `runtimePatchAttempts[0] {resumable: false, notResumableCode, verification, restoredExpectedState, retryOriginalAction: true}` becomes `inRunRepairs[0] {outcome: "overlaid", retryOriginalAction: false, approvalDecision}`, with the verification on the adaptation (`in_run_trial`, `awaitsJudgedRun`). `adaptiveRetry` becomes no `adaptiveRetry`, with the receipt's `repairId` in `trace.repairs`. The evidence `[judged_whole_run]` and applied are unchanged. | C6 step 8; t267 is unchanged |
| 11 | `service-adaptation/tests/judged-run-evidence.test.ts:237-252` | The same as row 10 for the retry-in-trial case. `reAimedPresses [false, true]` is unchanged. | C6 step 8; C6 "every node retries" |
| 12 | `service-adaptation/tests/retry-result-verification.test.ts:125` (pinned) | "judged against the Flow the retry ran" (`[..., "repaired"]`) becomes "judged against the Flow with the fix held, not the stored one or the one held from before the repair": node ids `[start, extract, drift, end]` and the drift step carrying `retryCount: 2`. Today it fails on the `retryCount` line. | C6 step 8 (brief's own example) |
| 13 | `service-adaptation/tests/unattended-repair-authority.test.ts:300-302` | `adaptiveRetry {attemptCount: 1}` becomes held, via `trace.repairs` and `inRunRepairs`. The standing calls, redemptions, `after_repair` and `confirmed` assertions are unchanged. | C6 step 8 |
| 14 | `service-adaptation/tests/unattended-retry-verification.test.ts:288` | `adaptiveRetry` becomes held. | C6 step 8 |
| 15 | `service-adaptation/tests/unattended-retry-verification.test.ts:310-318` | `runtimePatchAttempts[0].approvalDecision` becomes `inRunRepairs[0].approvalDecision`, with the same `{mode: auto, autoApply, requiresManualApproval: false}`. `adaptiveRetry {attempted}` becomes `trace.repairs` length 1. | C6 step 8 |
| 16 | `service-adaptation/tests/unattended-retry-verification.test.ts:348` | `adaptiveRetry` becomes held. The expired-authorization refusal is unchanged. | C6 step 8 |
| 17 | `service-flows/tests/representation.test.ts:398` | `["runtime_patch"]` becomes `["runtime_diagnosis", "runtime_patch"]`. | C6 step 8 ("today's diagnosis -> patch") |
| 18 | `service-flows/tests/representation.test.ts:399` | `JSON.stringify(requests[0])` becomes `JSON.stringify(requests)`. | Same, so every request is checked for the note |

Comments only, with no expectation changed: `judged-promotion.test.ts` header, and `unattended-repair-authority` :290 ("retry's" becomes "repaired run's").

## Commands run and observed results

All run in `packages/fluxiq` unless noted. AS stands for `src/programs/automation-studio/runtime` in the paths below.

- Baseline, `npx vitest run AS/tests/service-adaptation AS/tests/service-flows`: `Tests 18 failed | 147 passed (165)`. These were R1's 16 plus the 2 representation cases.
- Item 1:
  - `npx vitest run .../runtime-adaptation/tests/held-fix-validation.test.ts .../judged-promotion.test.ts`: `Tests 37 passed (37)`.
  - A probe showed the adaptive-retry-resume adaptation as `status: "validated"`, with `validationResults: [{ kind: "trial", basis: ["in_run_trial"] }]`.
- Pinned tests, checked with `.fails` removed in temporary copies (deleted afterwards):
  - retry-result-verification fails at `expected { expectedOutputs: { done: true } } to match object { retryCount: 2 }`. The node-id assertion before it passes.
  - judged-promotion :225 fails at `adaptiveMetrics ... durableBehaviorChanged: true`; the received values were `false` / `0`. The `applied` assertion before it passes.
- `npx vitest run AS/tests/service-adaptation`: `Test Files 22 passed (22)`, `Tests 101 passed (101)`.
- The brief's set, final run, `npx vitest run AS/tests/service-adaptation AS/tests/in-run-repair AS/tests/service-flows AS/service AS/recovery AS/executor`: `Test Files 269 passed (269)`, `Tests 2291 passed | 1 skipped (2292)`.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`: no output, which means clean.
- At the Core root:
  - `node scripts/structure-audit.mjs 2>&1 | tail -1`: `structure-audit: passed (317 warning(s), 1160 baselined).`
    - The first run failed on my new test file: `as-never` at :160 and `statement-packing` at 60, 151, 155, 156. Both are fixed.
    - It also said "3 baseline entries can be lowered", as in R1's run.
  - `node scripts/structure-audit.mjs --rule docs-links | tail -1`: `structure-audit: passed (0 warning(s), 0 baselined).`
- Warnings: 317 against R1's 315. Two advisory warnings are mine:
  - `runtime-adaptation/tests/` reached 16 files;
  - `unattended-retry-verification.test.ts` is at 404 lines.

## Not verified

- No live run and no real provider; everything used scripted models.
- I did not see a child-frame held repair run through the service. Its trial reading is covered only by the unit test with a hand-built trace.
- Whether a host-evaluated expected state is distinguishable on the record: it is not, from the trace alone (Open question 3).
- The full suites (`pnpm check`, `pnpm test`), per the twice-daily rule.
- `pnpm structure:baseline`, not run. The baseline file is not mine.

## Open questions or contradictions found

1. **Defect: a repaired run is judged against the Flow from before the repair** (`AS/runtime/service.ts:2552`, `verifyRunResult` in the wiring line). It passes the verification the run's pre-repair Flow. Observed: the judged drift step had `{ expectedOutputs: { done: true } }` and no `retryCount`, while the run ran the overlaid step. So `resultSummary.flowShape`, and the Flow the judge is told about, describe a graph the run did not run. That matters most for `add_handler` and `replace_unit`, which change the shape.
   - Proposed fix: have the in-run ledger keep each held overlay's graph, keyed by `repairId`. Hand the verification the overlaid graph when `trace.repairs` is non-empty, beside the existing `automationStudioRepairedRunResultCheck` switch on the same line.
   - Pinned by `retry-result-verification.test.ts:125`.
2. **Defect: a kept in-run fix is not counted as a durable change.** Proposed fix: read both `runtimePatchAttempts` and `inRunRepairs` in both places, and set `deterministicSuccessAfterAdaptation` to true also when the run succeeded with `trace.repairs` non-empty. Pinned by `judged-promotion.test.ts:225`. The two places:
   - `AS/runtime/service/summaries/conversions.ts:33-35` (`adaptiveRuntimeMetricsFromRunDetail`): `durableBehaviorChanged` and `adaptationApplyCount` read only `runtimePatchAttempts`, and `deterministicSuccessAfterAdaptation` (`:44`) reads only `adaptiveRetry`.
   - `AS/runtime/durable-behavior/durable-behavior-changed.ts:31` (`runtimePatchApplied`): it reads only `runtimePatchAttempts`, so `summary.durableBehaviorChanged` is false for an applied in-run fix.
3. **Unevaluated expected state in the trial.** Plan C6 step 8 says the fix holds when "the node's expected state ... is `true`", and C9 says `unknown` never satisfies a guard. The re-attempt is an ordinary attempt, though. With no host evaluator, the executor reads expected state from the attempt's own route (`AS/runtime/executor/transition-comparison.ts:266-273`, long-standing, for every step), so the re-attempt is `matched` and the run carries on. The detached verdict refused the same case (`check_unknown`).
   - I treated the executor's reading as the in-run trial's, and asserted only that the fix is not saved without a judged run (table, row 4). I also count such a fix as validated.
   - Decide whether a held overlay's re-attempt should be stricter than an ordinary step. If so, the change belongs in `executor/step-loop/incident-repair.ts`, which would drop the overlay when a declared expected state was not host-evaluated.
4. **Defect, minor: an in-run fix to another node is overlaid.** `AS/runtime/service/runtime-session/in-run-repair.ts:241` checks the unit only for `replace_unit`, and `:267-268` only between patches. So a node-scoped patch on a node other than the incident's unit is accepted. Observed in R1's version of `adaptive-loop` :83: unit `divide`, `changedUnit: constant`. The fix was overlaid, the re-attempt of `divide` failed, and the fix was dropped. C12 says "Core refuses any change to another unit's compiled graph".
   - Proposed fix: at `:267`, also refuse with `other_unit` when `!sameUnit(changed, request.unit)` for a node-unit request. Check first whether `temporary_reroute` must stay allowed to touch edges out of the failing node.
5. **The brief's Group C premise.** `adaptive-loop` :83 failed for the reason in item 4 and because its decision is made before the re-attempt, not because the status stayed `testing`. It needed a scenario rewrite (table, row 1).
6. **Item 1 refinement.** "Held" is read as "the re-attempt matched something declared", not only "the id is in `trace.repairs`", for the reasons in section 1. Undo it if you want the plain rule. `judged-run-evidence`'s refuted case would then need its "no evidence recorded" expectation changed.
