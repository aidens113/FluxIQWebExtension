# t267 S5 records: lane A call rows, reported spend, facility.contract; lane C w82 ending, w74 try rework

## Outcome

Done. All five items are ported onto current dev in `task/t267-adaptation-loop-unblock`. One lane A hunk was dropped on purpose (runner-wiring tests; see below). Every test named in the brief passes, and the test-runner and test-contracts typechecks pass.

## What changed and why

`T` = `packages/test-runner/src`.

### 1. Lane A: call rows (ported)
- `T/live-llm/call-rows.ts` and `T/live-llm/tests/call-rows.test.ts` are new files, copied from lane A with CRLF converted to LF. The content is unchanged.
- `T/live-llm/live-llm-run.ts` was merged by hand, because t262 and t267 S1 had moved the base. It has the `stepLogObservedCalls` import, and `writeSnapshot` computes `stepCalls` after `spend` and spreads `...stepCalls` into `observed`, before `calls`, `totalEstimatedCostUsd`, `phases` and `perBuild`. Those four stay the run's totals.
- The doc comment is reflowed: the rows come from the step log. Lane A's single line was over 150 columns.
- The `LiveLlmRun` methods the test uses all still exist on dev with the same signatures: `buildAuthorizer`, `readStepLogFrom` and `settleBuild`.

### 2. Lane A: reported spend (ported)
- `scripts/lab/live-campaign/row/reported-spend.mjs` and its test got lane A's diff unchanged, through `git apply` with the CRs stripped. Dev had not touched either file since the base.
- What the brief calls `spendSource: "run"` is the `source: "run"` field of `reportedSpend`'s result, so it needed no extra field.

### 3. Lane A: facility.contract (ported, one test hunk dropped)
- `packages/test-contracts/src/evaluation.ts`: `facility.contract` is added to `failureCategories`, with its doc comment.
- `T/existing-fluxiq-control.ts`: `contractRefusal` is added, and `automationStudioCall` uses `.catch(contractRefusal)`, so a 400 becomes `facility.contract` and every other status keeps its category.
- `T/tests/existing-fluxiq-control.test.ts`: lane A's test is ported, plus the `RunnerFailure` import.
- `packages/test-contracts/tests/evaluation-contracts.test.mjs`: one assertion added, saying that an evaluation with `failureCategory: "facility.contract"` validates. Lane A had no contract-level test of the new value.
- **Dropped:** both of lane A's `T/run-evaluation/tests/runner-wiring.test.ts` hunks. Neither tests the 400. They are source assertions on `run-scenario.ts`:
  - closing the other fixture tabs before playback;
  - `stoppedLane` handed to the observation.

  Dev's `run-scenario.ts` contains neither string (grep count 0 for each), and `run-scenario.ts` is on my must-not-touch list. Porting the hunks would add two failing tests. They belong with whoever ports lane A's `run-scenario.ts` and `flow-lane/lane-observation.ts` changes.
- **Exhaustive lists over the categories.** I grepped `failureCategories`, `environment.missing` and `fixture.invalid` across `packages/`, `apps/` and `scripts/`.
  - These are open membership checks, which accept the new value through the array: `test-contracts/src/evaluation-validation.ts:53`, `T/bench/evaluate-run.ts:248` and `T/run-evaluation/run-outcome.ts:76`. `T/failure.ts` aliases `RunnerFailureCategory = FailureCategory`.
  - One hand-written subset exists outside my files: `T/demo-operation-status.ts:52`, `runnerFailureCodes`. It is not exhaustive (it already omits `fixture.invalid`, `extension.*` and others). A demo-preparation failure in `facility.contract` would not be listed there, and would be sanitized like any other unlisted category. **Not edited (not my file).** Whoever owns it should decide whether to add `facility.contract`.
  - I found no switch over the categories.

### 4. Lane C w82: re-author record (ported, ending reconciled with Core)
- `T/live-llm/reauthor-record.ts` changes:
  - New `ending: LiveLlmReauthorEnding | null` per attempt, keeping closed words and counts only and never `message` or `notDone`.
  - New `callsFrom: "loop_decisions"`, from `evidenceLoop.decisionCount` when there is no loop call count. It applies on the no-adaptation path, the adaptation-unreadable path and the adaptation-without-count path, as in lane C.
  - New exported type `LiveLlmReauthorEnding`, added to `T/live-llm/index.ts`.
- **Ending vocabulary reconciliation**, against Core `flow-bootstrap/generation-failure/build-ending.ts` in `fxwork/t267/!FluxIQ` (HEAD `e5ed05d8`):
  - Kinds, `bound` values, `tried.tested`, `stops[].stopped` and `noRoute.kind` are identical to lane C's lists. t264 changed none of these words.
  - Two rules of Core's parser that lane C did not follow are now applied:
    - (a) `bound` exists only on `budget_exhausted`. On any other kind it is dropped.
    - (b) `tried.noRoute` is allowed only per kind: `not_doable` takes `judged_unachievable`, `no_progress` or `repeated_unchanged`; `not_finished` takes `no_progress` or `repeated_unchanged`; other kinds take none. Anything else is dropped.
  - Lane C's leniency is kept: an unknown stop word is dropped, not treated as voiding the ending. An unknown kind, or a malformed count or `tested`, still gives `ending: null`.
- Tests:
  - `tests/reauthor-record.test.ts`: lane C's run-musp39u8 test is ported without the `try: 2` input (Core writes none now), plus one test for the per-kind rules.
  - `tests/run-spend.test.ts` and `tests/live-llm-run.test.ts`: fixtures updated with `try: null, ending: null`.

### 5. C w74 rework: `try` derived in the Lab record
Lane C read Core's `try` field. Current Core (t262) writes none, so `try` is derived.

**Confirmed from Core source:** both routes write `brief`, and both build their brief once before `automationStudioReauthorBuild`, then record the same brief record on every build.
- Refuted-result route: `refuted-result-port.ts:92-101` writes `brief: briefRecord(refuted, brief)` and `attempt: refuted.current.attempt`. The record holds `instructionId`, `chars`, `findingCodes`, `fixLines`, `advised` and `earlierAttempts`.
- Failed-step route: `step-failure-port.ts:63-67` writes `brief: briefRecord`, which is `{ ...decision.record, instructionId, chars }`, and records no `attempt`.
- The rebuild is `reauthor-build.ts:136-142` and `automaticRequestRetry` at `:146-165`.
- **Caveat:** `instructionId` is a constant for each route: `core.result_repair.brief` (`brief.ts:54`) and `core.step_failure_repair.brief` (`step-failure-brief.ts:34`). Keying on it alone cannot tell a rebuild from a second, separate failed-step re-author later in the run.

**The rule, documented in the `reauthor-record.ts` header:**
1. An entry with no `brief.instructionId` gets `try: null`. Examples: a refusal, a ladder fallback entry, or a Core older than the brief record.
2. Otherwise the entry gets `try: 2` exactly when the entry before it meets all of these:
   - it is a try 1;
   - its brief record is equal by value, compared with keys sorted;
   - its `attempt` is the same (both absent on the failed-step route);
   - it failed with no `adaptationId`, at `stage: "provider_request"`, with `retryable: true`.
3. Any other entry with a brief gets `try: 1`.

The failure condition is the coarse form of Core's `automaticRequestRetry`: the same stage and retryable gate, without the per-code invocation and response checks. It is what tells a rebuild apart on the failed-step route. There is no try 3.

Tests in `tests/reauthor-record.test.ts`:
- a refuted-route rebuild over two attempts, including a brief whose keys are in a different order;
- the failed-step route, including a later re-author on the same constant brief id, no try 3, and a no-brief entry;
- the negative cases: a different brief, a different attempt, and a previous failure that is not retryable.

## Commands run and observed results

- `node .../scratchpad/t267-s1/run-subset.mjs <abs packages/test-runner> t267-s5-rec src/tests/existing-fluxiq-control.test.ts src/live-llm/tests/*.test.ts` (19 entries), then `node --test <19 bundles>` printed `# tests 165 # pass 165 # fail 0 # cancelled 0`.
  - My first attempt also listed `src/run-evaluation/tests/runner-wiring.test.ts`. The bundle failed with `Could not resolve "chromium-bidi/lib/cjs/bidiMapper/BidiMapper"` (playwright reached through `run-scenario.ts`; bundled alone it also exits 1). The paths file was left empty, so `node --test` with no arguments ran the package's raw `.ts` tests: 2235 tests, 300 failed. Those failures come from the empty path list, not from this change. I left runner-wiring out of the rerun because I did not change it.
- `node --test scripts/lab/live-campaign/row/tests/reported-spend.test.mjs` (repo root) printed `# tests 5 # pass 5 # fail 0`.
- `packages/test-contracts`:
  - `pnpm.cmd run check` printed `test-contracts:check ... build`, exit 0.
  - `pnpm.cmd run test` (builds `dist`, then `node --test tests/*.test.mjs`, which includes `evaluation-contracts.test.mjs`) printed `# tests 161 # pass 161 # fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/test-runner check` exited 0. The build cache noted "inputs changed while it ran (packages/test-runner)" because other workers were editing.
- `file` on all 14 owned files showed 0 with CRLF. `git diff --ignore-cr-at-eol --stat` on them shows 12 modified files, 308+/20-, plus the 2 new call-rows files.
- Deleted `packages/test-runner/.test-build-scratch/t267-s5-rec`.

## Not verified

- No live run. The call rows, `loop_decisions`, `ending` and the derived `try` are checked against fixtures, not a real `live-llm.json` or run detail.
- `runner-wiring.test.ts` was not run, because this script cannot bundle it.
- I did not run the structure audit.

## Open questions or contradictions found

- The lane A `runner-wiring.test.ts` hunks were dropped. They test `run-scenario.ts` behaviour (tab closing, `stoppedLane`) that is not on dev. They must travel with that port.
- `T/demo-operation-status.ts` `runnerFailureCodes` does not list `facility.contract`. Its owner should decide whether it should.
- `run-spend.ts` `perBuild.builds` still does not carry `try`, so a rebuild and its first build look the same there. Lane C w82 raised the same point. It was not in scope.
