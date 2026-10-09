# t375 w1: retry-aware change verdict (Core)

Tree: Core `fxwork/t375/!FluxIQ`, branch `task/t375-adaptation-unblock`. `R/` = `packages/fluxiq/src/programs/automation-studio/runtime/`. Nothing was committed.

## Outcome

Done. A changed node that fails and then passes on its automatic retry is no longer `contradicted`. The trial and the replay now mark an attempt `retried` when a later attempt of the same node names it in `retry.previousAttemptId`, and the verdict skips those attempts in every per-node check and in downstream assertions. A failure with no retry after it still fails, and a node whose retries are all used up is still `contradicted`.

On the S2 harness, a re-aimed press that misses once in its trial now gives `unverifiable` / `no_evidence`, with `awaitsJudgedRun: true` and `retryOriginalAction: true`. The run then carries on, and after a judged `answers` the change auto-promotes and is applied. Before this change the same run gave `contradicted` / `check_failed`.

## What changed and why

1. `R/flow-change/contracts.ts:166-173`: `AutomationStudioChangeVerdictAttempt.retried?: true`. Its doc says a later automatic retry of the same node replaced this attempt, so the verdict reads that retry instead. The doc for the `changed_node_succeeded` check kind now also says it skips replaced attempts.
2. `R/flow-change/attempt-projection.ts:50-73`: new `automationStudioRetriedAttemptIds(attempts)`, exported through the `flow-change` barrel. It returns the ids that a later attempt of the same node names as `retry.previousAttemptId`.
   - A link to another node's attempt is ignored.
   - So is a link to an attempt that has not run yet.
   - An unrelated attempt in between, such as a cleared interference, does not break the link.
3. `R/flow-change/trial.ts:87,166,192` (`verdictAttempt`) and `R/adaptation-confidence/replay.ts:145,199,217` (`replayAttempt`) both compute that set once per trace and mark the attempts in it `retried: true`. A trial and a replay therefore answer the question the same way.
4. `R/flow-change/verdict.ts`:
   - The header documents the rule.
   - Per-node checks read only the attempts left standing (`:53`). Those checks are changed node, expected state, expected route, expected outputs and records.
   - `downstreamAssertionChecks` skips retried assertion attempts (`:201`).
   - `firstChangedIndex`, `reachedChangedNodeIds` and `continuationCheck` still read every attempt as it ran.
   - New fail-closed guard: a changed node with no attempt left standing returns `changed_node_succeeded: unknown` (`changed_node_incomplete`), never a pass. Only a direct caller marking every attempt retried can cause this, but without the guard it would have read as a vacuous pass.
5. Tests:
   - `R/flow-change/tests/verdict.test.ts`: new describe "change verdict: automatic retries", 8 cases.
   - `R/flow-change/tests/attempt-projection.test.ts`: 4 helper cases.
   - `R/flow-change/tests/trial.test.ts`: 4 cases. They use a real `builtin.policy.action` and an effect dispatcher that fails the first N dispatches with a retryable timeout. The executor itself makes the retries and the `retry.previousAttemptId` links, and the test asserts on those links.
   - `R/adaptation-confidence/tests/replay.test.ts`: 3 cases on real-shaped traces with `retry.previousAttemptId`.
   - `R/tests/service-adaptation/tests/judged-run-evidence.test.ts`: 1 new end-to-end case. The harness gains a `reAimedFailsOnce` option, under which the first press at the replacement target returns a retryable failure record, `{ category: "target_not_found", stage: "target_resolution", retryable: true }`.
     - That record is needed. A press failure with no record is never retried: the defensive assessment (`R/executor/defensive/assess.ts`) refuses to repeat an act whose effect is uncertain.
     - The record is what a web domain reports for a target that is missing before anything was pressed.
     - The case asserts the trial's presses at the replacement target were `[false, true]`, the receipt matches S2 (`unverifiable`, `no_evidence`, `awaitsJudgedRun`, `retryOriginalAction`, `applyAt: judged_whole_run`), the run succeeded with a judged `answers`, the stored target was replaced, and the adaptation is `applied` with the `judged_whole_run` trial result.
6. Generated: `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` were regenerated with `node scripts/docs-reference.mjs` because `docs:check` reported them stale. The diff is only the new export row and the edited check-kind doc.

### Tests failing before the change

These are observed results, not inferences.
- Run of the new tests with the helper and contract field present but `verdict.ts`, `trial.ts` and `replay.ts` unchanged: 11 failed and 103 passed.
  - verdict: 6 failed (every new case except the two guards).
  - trial: 3 failed (all except "retries were all spent").
  - replay: 2 failed (all except "no retry followed").
- End-to-end case with only `verdict.ts` restored to `HEAD` (`git show HEAD:...`), then put back: 1 failed. The receipt read `verification.status: "contradicted"` and `notResumableCode: "check_failed"`.
- Cases that passed before as well, by design:
  - Guards that pin existing behaviour: verdict "retries were all spent", verdict "last attempt failed", trial "retries were all spent", replay "no retry followed".
  - Helper cases: before the change the export did not exist at all, and they were added together with it.

### Step 4: other readers that decide an outcome from `status === "failed"`

I grepped `R/` outside `executor/` and tests. None of these readers decides a trial, resume, promotion or replay outcome from raw attempt status:
- `confidence.ts`, `resume.ts` and `live-patch.ts:342` read verdict checks or results.
- `training-modes.ts:231` counts runs, not attempts.

Two readers outside the owned files may be retry-unaware. I did not edit them:
- `R/result-verification/read-account/loop-passes.ts:86-94` (`loopEnd`): any `failed` attempt after a read's last pass makes the loop end `"failed"`, even when its retry succeeded. This feeds the judge's account of a run's reading loop, not the trial verdict.
- `R/recovery/refuted-result/step-failure-target.ts:58`, used by `step-failure-decision.ts:106` and `result-verification/run-outcome.ts:418,421`: it takes the last `failed` or `unknown` attempt of a failed run as the step to re-author. That attempt can be a retried one when the run later failed for a reason that is not an attempt. Low risk, but it does not consult retry links.
- Already retry-aware, by "absorbed by a later success of its node": `R/recovery/unresolved-failed-attempt.ts:12`.
- Read failed attempts for diagnosis or model feedback only, not for an outcome: `R/recovery/context.ts:351,498`, `R/service/candidate-trial/check-step.ts:42` and `feedback.ts:94`.

### Step 5: how the `satisfied` rung appears in a trace (left unchanged)

`R/executor/graph-run.ts:645-651`. When the ladder chooses `skip_satisfied_node`, the failed attempt stays in the trace as follows:
- It keeps `status: "failed"` and its own failure route.
- It carries the `recoveryDecision` taken after the rung was used.
- No retry attempt follows, and nothing links to it.
- `recordDefendedFault(..., "continued")` is called, and the run continues down `success` via `routeOverride`. The next attempt is the success-edge target.

So in the verdict, a changed node that the ladder found already satisfied still reads `changed_node_succeeded: failed` and the trial is `contradicted`, and its continuation reads `not_applicable` (`changed_node_not_succeeded`). As briefed, I left this unchanged. Fixing it would need its own marker, for example from `recoveryDecision`.

## Commands run and observed results

All run from `fxwork/t375/!FluxIQ`, with `npx vitest` run from `packages/fluxiq`.
- New tests before the fix: `npx vitest run R/flow-change/tests/{verdict,attempt-projection,trial}.test.ts R/adaptation-confidence/tests/replay.test.ts` -> 3 files failed, 1 passed; 11 tests failed, 103 passed.
- After the fix: `npx vitest run R/flow-change/tests R/adaptation-confidence/tests` -> 7 files passed, 160 tests passed.
- End-to-end case with the original `verdict.ts`: `npx vitest run R/tests/service-adaptation/tests/judged-run-evidence.test.ts` -> 1 failed, 2 passed (`contradicted`/`check_failed`). With the fix: 3 passed.
- Brief's set: `npx vitest run R/flow-change/tests R/adaptation-confidence/tests R/tests/live-patch-target-override.test.ts R/tests/live-patch.test.ts R/tests/training-modes.test.ts R/service/adaptations/tests/adaptive-retry.test.ts R/tests/service-adaptation/tests/{judged-run-evidence,judged-promotion,promotion-tier,adaptive-loop}.test.ts` -> 15 files passed, 272 tests passed (26 s).
- `node scripts/build-cache/cli.mjs fluxiq:check` -> exit 0 (rebuilt: "inputs changed: packages/fluxiq").
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (290 warning(s), 710 baselined)", exit 0.
- First `pnpm.cmd docs:check` -> failed: "framework-reference.md is stale". After `node scripts/docs-reference.mjs` ("Wrote ... (3368 public declarations)"), `pnpm.cmd docs:check` -> "Deterministic framework reference is current.", exit 0.
- `npx biome lint` on the changed files -> biome's configuration ignores these paths ("No files were processed"), so it does not apply.

## Not verified

- No live, Lab, browser or provider run. Lane A's candidate-built Flow was not run against this change.
- The other worker's in-flight files (`run-flow.ts`, `durable-behavior/**`, `caller-paid-result-check.test.ts`) were in the tree during every run above. None of my runs failed. I did not run their tests.
- No full suites, as instructed.

## Open questions or contradictions found

- The `satisfied` rung (see Step 5) still reads as a changed-node failure in a trial or replay. A change whose node the ladder found already done is `contradicted`. That decision belongs to the supervisor.
- A re-aimed press is retried only if its failure carries a retryable record with an "unacted" effect, such as `target_not_found` or stage `target_resolution`. A domain that reports a press miss without a record gets no retry at all (`R/executor/defensive/assess.ts`), so this fix does not help it. d3 says Lane A's `s6` miss is `action_failed` and was retried, so the web domain does send a usable record there. That claim comes from d3; I did not re-check it.
- `loop-passes.ts:86-94` and `step-failure-target.ts:58` (Step 4) do not consult retry links. They need their own owner if they should.
