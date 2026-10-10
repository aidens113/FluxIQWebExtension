# t392 K: service-level proofs of in-run repair, the rewritten representation tests, and counting repaired true failures

Worker report for task t392, unit K (state-aware recovery plan C6 steps 8-9, "What counts as a true failure").
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`. Nothing is committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done**, with one product defect found and named rather than fixed (outside my files).

- Both `representation.test.ts` cases are rewritten onto the in-run path and pass, for both representations.
- There are 7 new end-to-end proofs through the real `AutomationStudioService`, using a scripted model and a fake host. One of them pins the defect below as an expected failure.
- The counts now include repaired true failures, and there is a new `repairedInRun` field.
- The brief's checks pass: 38 test files and 236 tests, `tsc` clean, structure audit passed.

**Defect: a deliberate stop calls the model.** The case is an authored failed edge to an End with `resultStatus: failed`. The End's own failed attempt is classified as a new true failure, and the model is asked to fix the End.
- Where: `AS/runtime/executor/step-loop/failed-attempt.ts:191-193`, the "Nothing took the run on" branch.
- Not my file (H's area). Details are under Open questions.

**Outside my brief: 42 tests fail in `AS/runtime/tests/service-adaptation/**`** (13 files, not mine). They assert the old detached rerun on adapting runs that now repair in place. Listed below.

## What changed and why

### 1. `AS/runtime/tests/service-flows/tests/representation.test.ts`

The two cases "seeds a rerun from the failed attempt ..." are replaced by "tries an in-run fix on the run's own inputs, while the saved trace withholds them" (routed, and legacy single graph).

**The scripted model's answer.** It returns one `replace_unit` of `gate`, whose step is `builtin.math.divide` with `consequences: []`. The fix's trial runs in the held run on the values it holds:
- 6 / 3 gives `result: 2`;
- `[withheld]` would read as 0 and fail.

So a succeeded trial with `outputs.result: 2` proves the trial ran on the real inputs.

**Asserted:**
- The run is `succeeded`, with exactly one `runtime_patch` call.
- The model's request does not contain the synthetic note.
- The failed `gate` attempt carries `repair.outcome: "held"`, and the trial attempt is the divide.
- `trace.repairs` equals that repair id.
- There is no `adaptiveRetry` and no `runtimePatchAttempts`.
- Both attempts' read-back inputs are `[withheld]`.
- `filesHolding` is empty: the note appears in no file on disk, including the adaptation and proposal records.

**Graph change.** `gate` now has a `gate -> end` edge, and the disconnected `divide` node is gone. Before, a held fix at `gate` succeeded but the run then failed with "completed without an outgoing edge". The graph helpers are used only by this describe.

The describe was renamed from "live-patch reruns" to "in-run repair and run inputs". A `requests` array records the provider calls.

### 2. New `AS/runtime/tests/in-run-repair/tests/service-proofs.test.ts` (7 tests)

**The harness:**
- A real `AutomationStudioService`.
- A native node package with one `example.press` step. This is the fake host's act: a control fails N times or always, and every press is recorded.
- A `hostRuntime` with `fact-evaluation` (every fact `true`) and `action-dispatch`. A fix that writes steps is refused without `action-dispatch` ("Runtime patch requires host capability action-dispatch").
- A scripted repair model that counts its requests.
- A judge on a fixed schedule (every run), under a standing authorization.
- Every Flow is routed: Router fallback to a primary Subflow.

**E2b's fixture does not fit here.** `in-run-repair-fixture.ts` binds the session's ports directly, without the service, and these proofs go through the service's own wiring. The file header says so.

**What calls no model:**
1. Retries: `broken` fails twice (retryable), then works.
   - Presses: `open, broken×3, finish`.
   - 0 calls.
   - Counts `{ retries: 2, plannedFails: 0, trueFailures: 0, repairedInRun: 0 }`.
2. An authored failed edge to `fallback`:
   - 0 calls;
   - no `repair` on the attempt;
   - `plannedFails: 1`.
3. An On Fail handler (`builtin.control.handler`, event `fail`, scope `broken`, a `when` fact the host holds; body presses `dismiss`; Handler End `resolve`):
   - 0 calls;
   - handler disposition `resolve`;
   - `plannedFails: 1`.
4. `it.fails`: an authored failed edge to an End with `resultStatus: failed` should make 0 calls.
   - It is marked as an expected failure because of the defect above. I confirmed once without `.fails` that it fails exactly at `expect(found.requests).toEqual([])`, with one request made.
   - When the executor is fixed this test starts failing, and `.fails` must be removed.

**A true failure:**

5. One call, and the run carries on and succeeds.
   - Presses: `open, broken, fixed, finish`. The trial is the next press, and nothing repeats.
   - The failed attempt has `repair.outcome: "held"`, and `trace.repairs` equals `[repairId]`.
   - There is no `adaptiveRetry` and `runtimePatchAttempts` is empty.
   - **Pending until the judged end:**
     - the judge saw the stored `broken` node still pressing `broken` (`storedAtJudgement` equals `["broken"]`);
     - after the run, the stored node presses `fixed`;
     - the adaptation is `applied` with `applyAt: "judged_whole_run"` and `judgedRunId` set to the run.
   - The receipt is `overlaid` / `replace_unit`, carrying the same repair id.
   - Counts `{ retries: 0, plannedFails: 0, trueFailures: 1, repairedInRun: 1 }`.
6. A fix whose trial fails is dropped. The run fails after one call.
   - Presses: `open, broken, still-broken`.
   - The repair outcomes are `held`, then `dropped`.
   - There is no `trace.repairs`, and the incident ends `true_failure`.
   - `llmGate.code` is `llm.gate.repaired_in_run`: no detached call follows.
   - The stored Flow is unchanged and the adaptation is not `applied`.
   - Counts `{ 0, 0, trueFailures: 1, repairedInRun: 0 }`.

**The detached path:**

7. An Outcome-uncertain stop. The step has `declaredConsequences: ["places the order"]`, and its failure is `ambiguous_or_unknown` with `effect: "ambiguous"`, so its effect check answers `unknown`.
   - Pressed once, with no in-run ask: no `repair` and no `inRunRepairs`.
   - Then exactly one detached call, a `runtime_diagnosis`.
   - `llmGate.patchSkippedCode` is `llm.runtime_patch_policy_allows_no_kind`.
   - There are no `runtimePatchAttempts` and no `adaptiveRetry`.

### 3. Is the detached path still reachable?

**The detached after-run recovery: yes.** It is the annotation in `recovery/annotation/annotate.ts`, called from `service.ts`. Test 7 is the one condition I kept, and it was observed through the service.
- It runs for an adapting run that ended failed without the executor asking at its failing step.
- In the case I proved, an Outcome-uncertain stop, it makes one diagnosis call and requests no patch. So nothing re-runs.

**The detached rerun (`adaptive-retry.ts` resume): not reached by any run I could build.** It needs an auto-applied receipt with `retryOriginalAction: true` and a vouched trial. Only an adapting run produces one, and an adapting run is exactly the run that gets `repairIncident`. After an in-run ask, the annotation skips the incident (`repair` on the attempt, or the ledger), which I observed in tests 6 and 4.

Reading the code, the remaining routes into it are runs that end failed without the executor asking:
- a run paused (`runControl.heldBy`) at the moment of the true failure;
- a true failure after an uncertain act anywhere in the run, for example a parent's Call Subflow failing after its child stopped uncertain (E2a test 6);
- a permission-category failure. I probed `blocked_by_capability_or_policy` and `external_side_effect_denied` through the service: the annotation refuses both with `llm.gate.manual_intervention` and 0 calls, so these do not reach it.

I could not build a deterministic service run that reaches the resume. No resume test is kept, and the code is not deleted.

The `diagnose_and_adapt` lane gets no callback, but its target override is proposed "without executing it" (the existing `runtime-patches.test.ts`), so it does not resume either.

### 4. Counts

**`AS/model/flow-adaptation.ts`.** `AutomationStudioFlowRunFailureCounts` gained `repairedInRun: number`, and its doc comment says how it is counted. This is the counts type only.

**`AS/runtime/service/summaries/failure-counts.ts`.** The signature is now `automationStudioRunFailureCounts(incidents, repairs?)`.
- `repairedInRun` is the number of distinct ids in the root trace's `repairs`: the in-run fixes still held at the end, one per incident.
- `trueFailures` is the incidents that ended `true_failure` plus `repairedInRun`.
- `retries` and `plannedFails` are unchanged.

**Why this differs from "incidents with `trueFailure: true`".** The incident record says nothing about a repair, and a held repair's incident ends however its trial ends, usually `passed`.
- A child frame's true failure that its Call Subflow node's own On Fail path then handled also keeps the sticky `trueFailure` mark, and ends `planned_fail`. Plan C6 calls that a planned fail of the parent.
- Counting the mark would count that incident as both a planned fail and a true failure.
- The rule I used gives the same answer as counting the mark in every other case: unrepaired true failures end `true_failure`, and repaired ones are held.

**`AS/runtime/service/summaries/conversions.ts`.** Both call sites now pass `session.trace?.repairs`.

**`AS/runtime/service/summaries/tests/failure-counts.test.ts`, 5 tests.** The first two use E2a's executor fixtures (`in-run-repair-fixtures.ts`) for real traces.
1. The existing `retryPlannedTrue` case now expects `repairedInRun: 0`.
2. A held repair: the incident is `{ trueFailure: true, ending: "passed" }` and counts `trueFailures: 1, repairedInRun: 1`.
3. A dropped repair counts `trueFailures: 1, repairedInRun: 0`.
4. Stored-trace hygiene: duplicate, empty and non-string repair ids, and a non-array `repairs`.
5. A child's true failure handled by the parent counts as a planned fail only.

### 5. `AS/runtime/service/runtime-session/tests/in-run-repair.test.ts` (E2b's test, in my owned path)

It began failing during my run because worker I moved `inRunRepair` out of `metadata` and into a typed packet slot, `request.context.inRunRepair`. In the slot, `unit` is `{ kind, id }` and the old unit detail sits under `contract`.

I updated the one assertion:
- `metadata` no longer has `inRunRepair`;
- `context.inRunRepair` matches the unit, contract, incident, recoveries and acts.

If I changes the slot again, this assertion follows it.

### Statement packing

Every new or changed line keeps one statement per line, and `--rule statement-packing` passes.

## Commands run and observed results

All were run in `packages/fluxiq` unless noted.

**The brief's directories:**
- Command: `npx vitest run AS/runtime/tests/service-flows AS/runtime/tests/in-run-repair AS/runtime/service/summaries AS/runtime/service/runtime-session`.
- Final run: `Test Files 38 passed (38)`, `Tests 236 passed (236)`.
- An earlier run of the same command gave `1 failed | 235 passed`: the runtime-session `in-run-repair.test.ts` slot change, fixed above.

**Individual runs:**
- `representation.test.ts`: before my change, `2 failed | 8 passed (10)` (the two cases). Final: `10 passed (10)`.
- `service-proofs.test.ts`: `7 passed (7)`, the `it.fails` case included.
- The same file with `.fails` removed, run once and then reverted: it failed at `service-proofs.test.ts:266` (`expect(found.requests).toEqual([])`, received one request).
- `failure-counts.test.ts`: `5 passed (5)`.

**Typecheck.** `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` printed no output and exited 0. The `run-flow.ts` error E2a and E2b reported is gone, fixed by someone else.

**Structure audit** (Core root):
- `node scripts/structure-audit.mjs 2>&1 | tail -1`: `structure-audit: passed (315 warning(s), 1160 baselined).`
- `--rule statement-packing`: `passed (0 warning(s), 452 baselined)`.
- The only advisory warning on a file I touched is `representation.test.ts` at 538 lines. It was already over the 400-line advisory limit at 519.

**Read-only survey of neighbouring suites (not my files).** I ran `npx vitest run` over the following, with a JSON reporter:
- `AS/runtime/tests/service-adaptation`
- `refuted-result`
- `session-recovery`
- `live-patch.test.ts`
- `live-patch-target-override.test.ts`
- `adaptive-orchestrator.test.ts`
- `intervention-mode.test.ts`
- `policy-action-target-repair.test.ts`

Result: **42 failed of 238**, all in `service-adaptation/tests/`. Failing per file:

| File | Failing |
| --- | --- |
| `adaptive-loop` | 2/2 |
| `adaptive-retry-resume` | 2/2 |
| `caller-paid-result-check` | 3/8 |
| `iterating-recovery` | 1/3 |
| `judged-promotion` | 6/6 |
| `judged-run-evidence` | 3/3 |
| `llm-diagnosis` | 4/8 |
| `llm-run-caller` | 1/5 |
| `recovery-trace` | 4/4 |
| `retry-result-verification` | 1/1 |
| `run-consequence-permission` | 2/2 |
| `unattended-repair-authority` | 8/11 |
| `unattended-retry-verification` | 5/8 |

Typical messages show the in-run path taking over:
- `expected [ 'runtime_patch' ] to deeply equal [ 'runtime_diagnosis', ... ]`;
- `expected { ... } to match object { adaptiveRetry: ... }`;
- `expected 'succeeded' to be 'failed'`;
- `llmGate ... repairAuthority` missing.

The survey ran before my counts change, which these files do not read: only `failure-counts.ts` and its test name the fields.

**Probes.** These were temporary tests, since deleted (`k-probe.test.ts`):
- The deliberate stop: one `runtime_patch` request, made for the End node `stop` (incident 2, `trueFailure: true`).
- The permission categories: 0 calls (`llm.gate.manual_intervention`).
- The Outcome-uncertain stop: one `runtime_diagnosis` call.

## Not verified

- No live browser or Lab run. Every model is scripted.
- **The detached resume.** I did not reach it through the service. The routes in section 3 come from reading the code: a pause at the failing step, or a true failure after an uncertain act in a child frame.
- **A part repair, or a repair inside a Call Subflow child, through the service.** That includes whether `trace.repairs` carries a child-frame repair at the root. E2a says `run.lifecycle.repairs` is run-wide and read at the root, but I did not exercise it.
- **The counts for a held fix whose trial then takes a planned path**, for example a `replace_unit` with `failedEdgeTo`. That incident ends `planned_fail` and its repair stays held, so it counts as both `plannedFails` and `trueFailures`/`repairedInRun`. The trace cannot tell it apart from a parent-handled child. See Open questions 3.
- I ran no full package suite, per the narrow-checks rule.

## Open questions or contradictions found

1. **Product defect: a deliberate stop asks the model** (`AS/runtime/executor/step-loop/failed-attempt.ts:191-193`; H's area).
   - The failed edge itself is stamped `planned_fail`, at :205-210.
   - The End it leads to then produces a failed attempt. That attempt reaches the same function, has no failed edge, and goes through the "Nothing took the run on" branch with `onFail: []`. So the classifier answers `true_failure`, a second incident opens, and `automationStudioStepRepairIncident` asks the model to fix the End.
   - Plan C6 says a failed edge that leads to an End with `resultStatus: failed` "ends the run with its authored reason" and is never a model call.
   - The counts are also wrong for it: one `planned_fail` plus one `true_failure`.
   - Fix there: treat a failed attempt of `builtin.control.end` with `parameterValues.resultStatus === "failed"` as a deliberate stop. That means verdict `deliberate_stop`, no seam call, and no new true-failure incident. Then remove `.fails` from the test "takes an authored failed edge to a failed End ..." in `AS/runtime/tests/in-run-repair/tests/service-proofs.test.ts`.
2. **42 failing service-adaptation tests** (not mine; listed above). They test the detached diagnosis -> patch -> resume on adapting runs, which now repair in place with one `runtime_patch` call and no `runtime_diagnosis`. Each needs rewriting onto the in-run path, or a condition that still reaches the detached path. The supervisor should assign them; they are not in any unit's ownership I know of.
3. **Exact counts need one executor field.** For example, the trace's incident record could carry the repair: `repairId?` on `AutomationStudioIncidentTraceRecord` (`AS/runtime/executor/contracts.ts`), written by `executor/step-loop/lifecycle-trace.ts`. Then `failure-counts.ts` could count per incident. That would separate a repaired true failure whose trial took a planned path from a child failure the parent handled. Until then, `repairedInRun` reads `trace.repairs`.
4. **Documentation.** `docs/architecture/automation-studio.md` describes `failureCounts` (E2b) and does not yet list `repairedInRun`, or that `trueFailures` includes repaired ones. That file is outside my ownership.
5. **A fix that writes steps needs the host to declare `action-dispatch`** (`live-patch.ts:692`). Over the web host that presumably holds. A host without it gets `none` with "Runtime patch requires host capability action-dispatch", after the model call was already paid for. The request could check this before asking.
