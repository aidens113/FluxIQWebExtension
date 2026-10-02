# t174-w62: skip an absent sometimes-present step (Core `R/executor`)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ` (uncommitted). `R/` = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done, with one deviation from the brief's path. The module is `R/executor/step-skip/absent-step.ts` with a barrel
`R/executor/step-skip/index.ts`, not `R/executor/absent-step.ts`. `R/executor/` already held 25 source files, which
is the structure audit's hard limit. A 26th file failed `node scripts/structure-audit.mjs` with
`FAIL [directory-files] .../runtime/executor/: 26 source files exceeds the 25-file limit`. The subdirectory keeps the
module inside executor and passes the audit.

## What changed and why

- **`R/executor/step-skip/absent-step.ts`** (new). It has one export, `automationStudioAbsentStepSkip(flow, node, attempt)`,
  which returns the edge to follow or `undefined`.
  - **Absent** means `attempt.status === "failed"` and `failure.category === "target_not_found"`.
  - **Sometimes-present** means either:
    - the build's optional shape: a `failed` edge into a `builtin.control.merge` that the node's `success` edge
      (`chooseAutomationStudioEdge`) also enters. It returns that `failed` edge.
    - `metadata.sometimesPresent === true`. It returns the `failed` edge when the node has the shape, otherwise its
      `success` edge.
  - A node marked only by metadata that has no `success` edge returns `undefined`, so it keeps the ladder.
- **`R/executor/step-skip/index.ts`** (new): the barrel.
- **`R/executor/graph-run.ts`** (772 to 789 lines; the hard limit is 800).
  - **Failed branch:** before the fault assessment, the "Recovery started" emission and the ladder, it calls the skip
    check. On a skip:
    - The attempt is rewritten to `status: "succeeded"`, `route: "skipped"`, `skipped: { reason: "target_absent", code: failure.code }`.
    - `failure`, `fault` and `message` are removed. No `recoveryDecision` is set.
    - No `recordDefendedFault` runs, no budget is spent and no wait happens.
    - It emits one activity: `phase: "running"`, `detail: { kind: "step", title: <sentence>, status: "succeeded", ref: nodeId }`.
    - It moves to the edge's target with `recordRegionTransition`, then `continue`s.
  - **Pre-observation:** after the readiness gate, if `readiness.satisfied === false` and `checkedConditionCount > 0`,
    it builds an undispatched failed attempt (`target_not_found`, code `executor.ready_state.not_shown`). If the skip
    check accepts it, that attempt replaces the dispatch, so there are zero dispatches. The failed branch then skips it
    the same way.
  - **Why it requires `checkedConditionCount > 0`:** a gate that judged nothing says nothing about the page. Downstream
    `domain/src/runtime/expectation/evaluate.ts:104,202` reports 0 when it could not evaluate, and Core's
    `ladder-run.ts` catch path returns 0 as well.
- **`R/executor/contracts.ts`:** added `skipped?: { reason: "target_absent"; code: string }` to `AutomationStudioNodeAttemptTrace`, with documentation.
- **`R/executor/index.ts`:** re-exports `automationStudioAbsentStepSkip`.
- **`R/activity/wording/action.ts`:** `automationStudioActivityAction` takes an optional `notShown`, and with it always
  returns a sentence. It names the control first, then the authored label, then "a step":
  - `Skipped “Not now”: it was not shown`
  - `Skipped “<label>”: what it acts on was not shown`
  - `Skipped a step: what it acts on was not shown`

  I used the existing export because graph-run reaches wording only through `R/activity/index.ts` and
  `R/activity/wording/index.ts`, which I may not edit. A deep import past a barrel is ratcheted by the audit's
  `imports` rule. The uncommitted F36 visible-text change already in this file was left as it was.
- **Tests:**
  - **`R/executor/tests/optional-failed-route.test.ts`:**
    - The pinned row is now: one dispatch; attempts `search, check, join, read`; the check attempt is `succeeded` and
      `skipped` with no `recoveryDecision`, `failure` or `fault`; `trace.defence` is undefined.
    - With a zero subflow budget the run now succeeds.
    - New rows:
      - a straight-line absent node still retries (`retry_node` twice, 3 dispatches, every attempt failed, a `retry`
        pointer to the previous attempt);
      - `action_failed` on an optional node takes the ladder (`retry, retry, deterministic_path`);
      - `target_ambiguous` on an optional node takes the ladder (`deterministic_path`; today's ladder does not retry it);
      - an optional node that fails another way with a zero budget still fails;
      - the numbering rows are shrunk to 4 attempts, plus a row for retry numbering.
  - **`R/executor/tests/absent-step.test.ts`** (new):
    - no "Recovery started" or `repairing` row for a skip, and exactly one `step`/`succeeded` row with the skip sentence;
    - the label-only wording;
    - a straight-line node still emits recovery;
    - the metadata marker skips down `success`, and a non-`true` marker does not;
    - an unsatisfied `readyState` on an optional node skips with zero dispatches (code `executor.ready_state.not_shown`);
    - when `readyState` is met, or the gate judged nothing, the node is pressed once;
    - a straight-line node with an unmet `readyState` is still pressed.
  - **`R/activity/wording/tests/action.test.ts`:** three rows for `notShown`, including that a card reads the row as
    `done` with no `why`, and that an id-like name is never quoted.
- **`docs/architecture/automation-studio.md`:** in the "Router Runtime" section, one new paragraph, "A
  sometimes-present step that is not shown is skipped, not recovered", after the defensive-dispatch and ladder
  paragraphs.

## Commands run and observed results

All of these ran from `packages/fluxiq` unless stated.

**Failing first, on the old graph-run** (absent-step.ts present but unused):
`bash .../heavy.sh "t174-w62 vitest" pnpm exec vitest run .../executor/tests/optional-failed-route.test.ts .../executor/tests/absent-step.test.ts`
printed `Tests 11 failed | 10 passed (21)`.

- **optional-failed-route:** 5 failed.
  - The skip row failed at :80.
  - The zero-budget row failed with "expected 'failed' to be 'succeeded'".
  - Both numbering rows failed.
  - `target_ambiguous` failed because my assumption about the ladder was wrong: it received `['deterministic_path']`.
    I corrected the row to today's ladder. That was a test error, not new behaviour.
- **absent-step:** 6 failed. The activity row received "Recovering from a failed step: Close the offer" three times.
  The readiness rows failed because the old ladder pressed 3 times.

**After the change:**

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174-w62 vitest" pnpm exec vitest run src/programs/automation-studio/runtime/executor/tests src/programs/automation-studio/runtime/activity/wording/tests`
  printed `Test Files 22 passed (22)`, `Tests 319 passed (319)`. It ran twice, before and after the step-skip move, with
  the same result. This includes `ladder-run.test.ts`, `recovery-ladder.test.ts` and `graph-run.test.ts`, all unchanged.
- `bash .../heavy.sh "t174-w62 check" pnpm check`:
  - The first run exited 2 on type errors in my new test only (`exactOptionalPropertyTypes` on two helper return
    types). I fixed them.
  - The re-run exited 0, with no errors in any file, including the other worker's `R/llm` and `R/flow-draft`.
- `node scripts/structure-audit.mjs` at the Core root:
  - The first run printed the `directory-files` FAIL above.
  - After the move it printed `structure-audit: passed (217 warning(s), 349 baselined)`. The executor directory now
    warns at 25 files, which is advisory.

## Not verified

- No live Lab or browser run. The skip has not been seen in a real run, in the panel chat card, or in the downstream
  bundle.
- How the chat UI renders a `step` row with `status: "succeeded"` and a non-verb title ("Skipped …"). I checked only
  through `activityActionOf` in the wording test (`outcome: "done"`, `why: null`).
- The pre-observation path activates only when a node carries `readyState`. Per w60, no build writes one today, so in
  live runs only the failed-branch skip (one dispatch, including the host's own wait of up to 5 s) will occur.
- Case (2), a dismissal the model did not mark, needs a build to write `metadata.sometimesPresent`. Nothing writes it yet.

## Open questions or contradictions found

1. **The brief's path contradicts the audit.** `R/executor/absent-step.ts` would make 26 files where the limit is 25.
   I used `R/executor/step-skip/`. The supervisor should accept it, or choose another grouping.
2. **The run detail does not carry `skipped`.**
   - Core's `R/service/summaries/conversions.ts:157-210` (not mine) maps the trace attempt to the run-detail action
     attempt. It copies `status` (`succeeded`) and `route` (`skipped`), and drops `failure`, but it does not copy
     `skipped`.
   - Downstream `packages/test-runner/src/flow-lane/persisted-flow-run.ts` reads `status` (`:98`, `:574`) and
     `failure`, and never reads an action's route. A skip therefore reads there as an ordinary succeeded action, with
     no failure.
   - Nothing will misread it as a failure. But nothing can tell a skipped dismissal from a pressed one:
     `succeededActionCount` and the `actionAttempts.every(status === "succeeded")` judges in `demo-*` and
     `creation-lanes.ts` count it as succeeded, which matches the rule. The Lab cannot report "skipped" until
     conversions.ts copies `skipped`, or downstream reads `route === "skipped"`.
   - Suggested follow-up: copy `skipped` into the run-detail metadata in conversions.ts, and read it in
     `persisted-attempt.ts`.
3. **`transitionComparison` is left on the skipped attempt.** It was computed at dispatch, from the failed result.
   The brief asked only that `failure` be removed. If a downstream judge reads a mismatching comparison on a succeeded
   attempt as a problem, it should be dropped as well.
