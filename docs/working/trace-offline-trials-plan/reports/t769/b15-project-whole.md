# B15 project whole trials offline-first (worker-heavy), 2026-10-27/28

AS = `packages/fluxiq/src/programs/automation-studio/runtime/` in Core tree `fxwork/t769/!FluxIQ`, branch
`task/t769-p6-offline-trials-in-builds`. I ran no git command that changes state.

## Outcome

Partial. The D48 wiring is done and tested on both paths:
- A project build's whole port now carries `offlineFirst`.
- The supervisor's whole test keeps a recorded failure without touching the site.
- On the single-subflow builder path, the kept no reaches the builder: its gate stands it, the proposals learn it, and nothing completes on it.

Two defects remain on the single-subflow path. Both need a change to the subflow trial gate, which the brief says not to touch (open question 1). I stopped there, as the brief asks, and did not work around it.

## What changed and why

- **`AS service/project-build/whole-trials.ts`**
  - The offline-first factory is now built for every build, so the ledger (project build) branch attaches it too.
  - `offlineFirst` sits on the wrapped port next to `environmentKind` and `prepareStart`.
  - `spent()` is now the live spend plus the offline spend in both branches (before, only the candidate branch added the offline spend).
  - A kept answer never reaches the wrapped `run`, so nothing is written to the supervisor ledger or the acts record.
  - The header's "stays live (D40)" paragraph is replaced with D48.
  - `phase` was already passed by `service.ts:1585` (`repairBrief ? "repair" : "test"`), so no change was needed there.
- **`AS project-agents/supervisor/whole-trial.ts`** (needed; a real defect)
  - A kept answer (`checkedAgainst: "recorded_run"`) is still recorded as the Flow's latest finished test, so `lastOfFlow` stays correct.
  - It no longer counts as a measured time. It took about a second and touched no site, so it was replacing `latestMs` and the Flow's `ms`. The G2 out-of-time guard would then start a 4-minute live test with 3 minutes left.
  - `FlowTests.finished.ms` is now `number | undefined`. An unmeasured test keeps the Flow's earlier measure, and a Flow with none falls back to the build's latest site test.
  - Header paragraph added.
- **`AS project-agents/single-subflow/single-subflow-trial.ts`**
  - `answerOf` carries the whole gate's `checkedAgainst` (kept) or `offlineCheck` (ran live after the check) into `feedback.wholeTest`.
  - For a kept answer, the "This test ran the whole Flow from its start" sentence is replaced with `WORDS.kept` (from `flow-bootstrap/offline-first`) plus a new generic `WORDS.wholeTestKept`. The old sentence was false for a kept answer.
  - Header paragraph added.
- **`AS project-agents/single-subflow/whole-test-port.ts`**: unchanged. A kept answer passes through `port` like any trial, so `weighed`, then `tried`, already tells the proposals.
- **Tests**
  - `service/project-build/tests/project-build-offline-first.test.ts`:
    - The "absent on a project build" test is now "present on a project build too, beside its start hook and environment kind".
    - New describe "a project build's whole test, offline first (D48)": the real `AutomationStudioFlowCandidateTrialGate`, the project build's whole trials (with ledger) on the offline harness, and the build's one project reset with counted hook and reset.
    - Case 1, a live failure then the next revision: a kept failure with `checkedAgainst`, and an instruction that starts with `WORDS.kept`. There is no hook, reset, live command or live record, the ledger snapshot is unchanged, the spend is unchanged, the gate stands the result with the offline run id, and completion is refused. A retest of the same revision is then live, with no offline note (D41).
    - Case 2, an offline pass: the trial runs live in the same call, the evidence carries `offlineCheck.passed`, two judge calls are added for each yes (offline and live), and completion is ok.
  - `project-agents/supervisor/tests/whole-trial.test.ts`, new describe "a whole test answered from the recording":
    - Case 1, a real gate with a stub port that keeps a judged no: no hook, reset or ledger change; `wholeTrialFailed`; receipts `live-1` and `offline-run`; `lastOfFlow`; standing no; completion refused.
    - Case 2, a G2 timing case: after a kept answer, a third Flow and the kept Flow are both refused with `lastTestSeconds: 240`.
  - New `project-agents/single-subflow/tests/single-subflow-offline-first.test.ts` (2 tests). It runs the supervisor loop over `gatedSingleBuild`, with the whole port given a stub `offlineFirst`.
    - Case 1, a live no then a kept no:
      - the builder's evidence has `feedback.wholeTest.checkedAgainst` and the kept words, and only 1 whole trial ran;
      - the builder gate stands no and refuses completion;
      - `tried` is told `[{1,no},{2,no}]`, both receipts are recorded, and the outcome is `ended`.
    - Case 2, an offline pass: the builder's feedback has `wholeTest.offlineCheck.passed`, it completes on the live yes, and the outcome is `candidate`.
  - `project-agents/single-subflow/tests/gated-single-build.ts`: new optional `tried`, passed to `AutomationStudioProjectWholeTestPort` (test fixture only).

Folder counts: `project-build/tests` 24 (unchanged), `supervisor/tests` 25 (unchanged; extended an existing file), `single-subflow/tests` 11.

## Commands run and observed results

All from Core `packages/fluxiq` unless stated.
- 2026-10-27, tests first, before any source edit: `npx vitest run .../project-build/tests/project-build-offline-first.test.ts` -> `Tests 4 failed | 5 passed (9)`.
  - The project whole port's `offlineFirst` was undefined.
  - The supervisor whole tests had no offline evidence.
- After wiring `whole-trials.ts`, I re-ran the final 8 tests with the ledger-branch `offlineFirst` temporarily removed, then restored it:
  - without the wiring: `Tests 3 failed | 5 passed (8)`;
  - with it: `Tests 8 passed (8)`.
- About the "kept no" on the real project port: the harness's stub binding gives the build-test judge no stored rows.
  - A "no" with a defect -> `unsure` (Core cannot locate the defect).
  - A "no" without `defects` -> `not_judged` (reply unreadable).
  - So the real-port tests use a kept stop (`execution_failed`), and the kept judged no is covered at the supervisor with a stub port.
- `npx vitest run .../supervisor/tests/whole-trial.test.ts`, before the timing fix -> `Tests 1 failed | 18 passed (19)`. The timing test failed because the third Flow was started; the kept-no test already passed. After the fix -> `Tests 19 passed (19)`.
- `npx vitest run .../single-subflow/tests/single-subflow-offline-first.test.ts`, before the `answerOf` change -> `Tests 1 failed (1)`. The only diff was the missing `wholeTest.checkedAgainst`. After the change -> `Tests 1 passed (1)`, then 2/2 with the offline-pass case.
- The first structure audit gave 1 FAIL `[imports]`: the project-build test imported supervisor internals that are not in the supervisor barrel. I moved that bookkeeping to the supervisor test and used only barrels.
- 2026-10-28 final checks:
  - `pnpm test src/programs/automation-studio/runtime/service/project-build src/programs/automation-studio/runtime/project-agents` ->
    - parallel `Test Files 93 passed (93)`, `Tests 620 passed (620)`;
    - real-sql `Test Files 8 passed (8)`, `Tests 47 passed (47)`;
    - `[vitest-groups] all groups passed: parallel, real-sql`.
  - `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` -> no output, exit 0.
  - Core root `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"` -> `structure-audit: passed (444 warning(s), 1152 baselined).`

UNIT READY: AS service/project-build/whole-trials.ts, AS project-agents/supervisor/whole-trial.ts,
AS project-agents/single-subflow/single-subflow-trial.ts, AS service/project-build/tests/project-build-offline-first.test.ts,
AS project-agents/supervisor/tests/whole-trial.test.ts, AS project-agents/single-subflow/tests/single-subflow-offline-first.test.ts,
AS project-agents/single-subflow/tests/gated-single-build.ts

## Not verified

- No live, headed or paid runs, and no full suites.
- Not tested with the real project-build port:
  - a judged "no" kept offline (the harness cannot produce a confirmed no; see above);
  - a whole trial whose live run has lasting acts in the ledger before the kept answer. The ledger in the tests is empty throughout, so "untouched" is shown only as an unchanged snapshot.
- Repair-phase whole trials (`phase: "repair"`) were not exercised. The value is passed by `service.ts`.

## Open questions or contradictions found

1. **The single-subflow builder path still acts on the site before a kept answer, and the builder's evidence lacks a top-level `checkedAgainst`. Fixing this needs a gate change I did not make (t775 owns the subflow trial gate).**
   - Why: the builder's subflow gate gets `AutomationStudioProjectWholeTestPort.port`, which has no `offlineFirst`. So the offline check happens inside the supervisor's whole gate, after the builder gate has already run its admission, its start hook (`scoped.prepareStart`) and its project reset.
   - Effect: on this path a kept no still costs a start hook and a reset, contrary to "the offline check runs before ... the start hook and any reset".
   - Top-level `checkedAgainst` matters for two readers:
     - `flow-bootstrap/subflow-candidate/builder-loop.ts:355` runs `automationStudioCandidateTrialView`, which skips its after-trial page look only on `evidence.checkedAgainst`. A kept answer here therefore still sends the page-look `capture_snapshot`s (the B14 finding, on this path).
     - `activity/candidate/offline-words.ts` uses it for the chat words, so the chat says the test ran on the site.
   - I carried the fact as far as my files allow (`feedback.wholeTest.checkedAgainst` and the words).
   - Options for whoever owns the gate:
     - (a) The subflow gate lifts a port result's `checkedAgainst` to the top level and skips `leftOnSite`. This fixes the look and the chat words, but not the hook or reset that ran before.
     - (b) The whole-test port gets an offline-only `offlineFirst`. This needs the whole gate to offer an offline-only check, without a live run, that keeps its bookkeeping. Today `gate.test` always goes live after a non-kept answer.
   - I rejected an admission-refusal "probe" through `whole-trial.ts`, because it would be a new reset precondition.
2. A kept answer's receipt is a `candidate_trial` whose `receiptId` is the offline run's id. This is consistent with `gate.standing().trialRunId`, which the dispatch tool matches against for repair briefs (`dispatch-tool.ts:361-371`). Confirm that an offline run id in the build record's receipts is wanted.
3. B7's open question 3 still stands: the gate reports `effectApplied: true` for a kept answer.
