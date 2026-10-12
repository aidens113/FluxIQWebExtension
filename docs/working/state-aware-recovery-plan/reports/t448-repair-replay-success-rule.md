# t448: the repair replay's Flow-success rule

Worktree `C:/Users/osrs_/FluxStuff/fxwork/t448-repair-replay-success-rule`, branch
`task/t448-repair-replay-success-rule`. Nothing is committed.

## Outcome

Done. The Lab's rule was wrong, not the product. R4b's replay (run `8e6a87e3-7b8d-4acc-acab-170d0d6aff9c`) had one
attempt that was not `succeeded`. It was a press the page refused as busy, which the ladder retried once, and the
retry succeeded. The old rule checked every attempt, so that recovered retry failed the replay. The new rule checks
each step: a step counts as succeeded when its last attempt ended well.

## Evidence: the action that broke the rule

Source: the replay's runtime event chunks in the R4b workspace artifact store
(`.../t418-r4b-2/fluxiq-root/.fluxiq/artifacts/automation-studio/projects/e984838a-.../objects/sha256/56/f3/56f334d3...json`,
sequences 3-18). I read them with a scratch script and did not open any sqlite file.

- There are 14 action attempts. Thirteen read `succeeded` with route `success`: s1-s7 and s9-s13, where s3 and s5 are
  merges, plus the second attempt of s8.
- Attempt #8 is node `...main.s8` (`web.output.dom-click`): `status: "failed"`, `route: "failed"`.
  - Failure: `code: "web.action.rate_limited"`, `category: "action_failed"`, `retryable: true`,
    `stage: "execution"`, `effect: "unacted"`.
  - Message: "Action refused by the page for now: it said it was busy; it named no wait."
- Recovery record: `selectedKind: "retry_node"`, "has used 1 of 4 attempts".
- Attempt #9 is the same node s8: `status: "succeeded"`, `metadata.retry: { attemptNumber: 2, maxAttempts: 4,
  backoffMs: 250, rung: "retry_node" }`.
- Run status `succeeded`. No interventions. Every route is `success`, so there are no skips. The coupon was not
  skipped as `effect_holds` in this replay.

This is the brief's "rate-limited press that then succeeded" case. It is not a real failure: the act was unacted
(nothing landed), it was retried once, it succeeded, and the goal held.

## What changed and why

1. `packages/test-runner/src/flow-lane/repair/replay-repair.ts`
   - `flowSucceeded` now comes from the new private `flowShortfallOf(run)`, which checks three things in order:
     - Core's run status is not `succeeded` → `run_not_succeeded`.
     - Not every node ended well, by the lane's existing shared rule (`node-recovery.ts`,
       `everyNodeEndedSucceeded`) → `step_not_succeeded`. "Ended well" means the node's last attempt `succeeded`,
       or was `skipped`, or was cleared by a person.
     - Any attempt carries Core t444's `skipped: { reason: "target_absent", notDone: true }` → `act_not_done`.
   - Therefore all of these count as succeeded:
     - a step that succeeded only after retries;
     - an absent optional step (`target_absent`);
     - a state-routed or `effect_holds` step (`route: "state_routed"`, lane status `skipped`);
     - an `already_done` step (`route: "success"`, status `succeeded`);
     - a person-cleared step.
   - New optional closed field `flowShortfall` on `RepairReplay`, present only when `flowSucceeded` is false, so the
     bundle says why without anyone digging into the store.
   - `goalPassed` is unchanged.
2. `packages/test-runner/src/flow-lane/repair/prove-repair.ts`
   - The failure message names each failed question separately. The goal sentence is kept word for word ("N of M
     replay(s) did not reach the fixture's expected final state"), so the existing `run-repair-lane` tests still pin it.
   - A Flow shortfall now reads "N of M replay(s) ran a Flow that did not succeed (<shortfalls>)". R4b's message had
     said the final state was not reached when it had been.
   - `details.failedReplays[]` also carries `flowShortfall`.
3. `packages/test-runner/src/flow-lane/skipped-attempt.ts`
   - This file is outside the owned list, but the change was required. Core's run detail carries `notDone: true` on a
     `target_absent` skip (Core `runtime/service/summaries/skipped.ts:38`, `executor/state-routing/routed-attempt.ts:23`).
   - The lane's parser required exact keys, so it dropped that mark. A not-done act would then read as an ordinary
     skipped popup, and the new rule would have passed it.
   - The parser now accepts `notDone`, only as `true` and only on `target_absent`, and carries it on
     `PersistedFlowActionSkip`. The type gains one optional field and nothing else changes.
4. Tests:
   - `repair/tests/replay-repair.test.ts`: 6 new tests, run through the real run-detail reading path. They cover R4b's
     busy press then retry success; an absent popup, an `effect_holds` state route and an `already_done` step; a
     person-cleared step; a not-done act (`act_not_done`, with `goalPassed` still true); a last attempt that
     failed, timed out or was cancelled (`step_not_succeeded`); and a failed run (`run_not_succeeded`).
   - New `repair/tests/prove-repair.test.ts`: 3 tests on the verdict wording and details.
   - `tests/skipped-attempt.test.ts`: 1 new test. The `notDone` mark is kept only as `true` and only on
     `target_absent`, and the skip route still reads `skipped`.

## Commands run and observed results

- `pnpm --filter ./packages/test-runner build` (run twice; the second was after a lint fix). Output:
  "core-build: FluxIQ Core's build ... is current", then `{"build-cache":"build","step":"test-runner:build",...}`. No
  tsc errors.
- `node --test dist/flow-lane/repair/tests/replay-repair.test.js dist/flow-lane/repair/tests/prove-repair.test.js
  dist/flow-lane/repair/tests/run-repair-lane.test.js dist/flow-lane/tests/skipped-attempt.test.js
  dist/flow-lane/tests/node-recovery.test.js` → `# tests 48 # pass 48 # fail 0`.
- `node --test dist/flow-lane/tests/*.test.js dist/flow-lane/repair/tests/*.test.js` (the shared parser's whole
  directory, plus repair) → `# tests 350 # pass 350 # fail 0`.
- After the final rebuild: `node --test dist/flow-lane/repair/tests/*.test.js dist/flow-lane/tests/skipped-attempt.test.js`
  → `# tests 63 # pass 63 # fail 0`. All 14 tests in replay-repair and prove-repair are listed `ok`.
- `node scripts/structure-audit.mjs`
  - First run: FAIL `[statement-packing]` on prove-repair.test.ts line 25. I fixed it.
  - Rerun: `structure-audit: passed (184 warning(s), 646 baselined).`

## Not verified

- No Lab or provider run, as the brief says. The fix has not been checked against a live R4b replay.
- `pnpm check` and the full test-runner suite were not run. That includes `existing-fluxiq-control` and the lab-runs
  playback-step tests, which also read `PersistedFlowActionSkip`. They only gain an optional field. The
  `src/tests/existing-fluxiq-control.test.ts` file was not in the run because it lives under `dist/tests`, which I did
  not glob.
- I did not check the replay's step s8 against the Flow to name its control.

## Open questions or contradictions found

- A person-cleared step counts as succeeded because the shared `everyNodeEndedSucceeded` rule counts it. The brief did
  not list that case. The supervisor may want a replay to treat it as not deterministic.
- In a looped node, an earlier row's failed attempt followed by a later row's success is read as recovered, because
  the rule takes the node's last attempt. Core's run status still has to be `succeeded`, so a row that truly failed
  should end the run failed. `act_not_done` is checked on every attempt, so a not-done row is never hidden this way.
- `write-playback-steps.ts` still words a not-done skip as "a sometimes-present step not on the page". It could add
  "so it was not done". I left it out of scope.
