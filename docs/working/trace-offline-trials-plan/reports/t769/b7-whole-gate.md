# b7-whole-gate report (t769, worker-heavy)

AS = `packages/fluxiq/src/programs/automation-studio/runtime/` in Core tree `fxwork/t769/!FluxIQ`, branch
`task/t769-p6-offline-trials-in-builds`. No git command that changes state was run.

## Outcome

Done. The whole-candidate trial gate now asks a port's optional `offlineFirst` before any site action, once per
revision and digest. It keeps a failure the recording demonstrates and otherwise runs live in the same call. The
step log records an `NNNN-offline` step. A port without `offlineFirst` behaves exactly as before.

## What changed and why

- `AS flow-bootstrap/candidate/contracts.ts`: `offlineFirst?: AutomationStudioTrialOfflineFirst<AutomationStudioCandidateTrialRequest, AutomationStudioCandidateTrialResult> | undefined`
  added to `AutomationStudioCandidateTrialPort`, with a doc paragraph. The type is imported from `../offline-first/index.ts`.
- `AS flow-bootstrap/candidate/trial-gate.ts` (799 -> 773 lines):
  - A header paragraph for P6.
  - `test()`: right after the retest-limit check, and before admission, `prepareStart` and the reset, it asks
    `offlineFirst` when the port has it, `tried === 0`, and this key was not asked before.
    - On a `kept` answer, `offSite` skips admission, the hook, the reset and `trialRan`/`leftOnSite`. `asked` is the
      kept answer and counts as `tried + 1`. Everything after that is today's weighing: the standing-no weigh,
      `Stop.told`, kept conditions, earlier advice, the digest closed on a no, and `recordStop`. Per D43, a kept
      stop counts toward the same-failure rule. The instruction is prefixed with `said + " "`, and the evidence is
      spread with `checkedAgainst`.
    - On a `live` answer, it runs today's path, and the evidence is spread with `offlineCheck`. A `not_tried`
      note adds nothing (D46).
  - New private `offlineFirst()`:
    - It builds the same request `ask()` sends, without `startedWith`, because no reset has run yet.
    - It calls the port inside `automationStudioLlmStepLogOfflineTrial`, and `describe` is `step(answer).logged`.
    - If the call throws while the signal is aborted, the error propagates. Any other throw becomes a live
      `inconclusive` with `why: offline_first_failed.<error name>`, so no error text reaches the model.
    - It runs `automationStudioTrialOfflineFirstStep` on the answer. A kept result also goes through the gate's own
      result checks. If those checks fail, the trial runs live as `inconclusive` with the check's code.
  - `ask()`'s result validation moved, unchanged, into a module function `checkedAnswer()`, so the live and kept
    paths share it. There is a new local type `Asked`.
  - Added beyond the brief: a field `offlineAsked: Set<string>`. Without it, when the reset refuses the live trial
    after an offline pass or gap, `tried` stays 0 and the next call would ask offline again (and pay the judge
    again). With it, a revision and digest is asked offline at most once (D41).
  - `effectApplied: true` / `targetsUnchanged: false` are unchanged on a kept answer. I chose this deliberately:
    `llm/decision-handlers/refusal-run.ts:153` counts refused no-effect mutate calls, so changing them would alter
    the loop's behaviour.
- New `AS flow-bootstrap/candidate/trial-slow-down.ts`: the t485 slow-down helpers moved whole out of `trial-gate.ts`
  (`unhandledSlowDowns`, `slowDownInstruction`, `waitAfterOptional`, `objects`, `positive`, `seconds`, the
  wait/merge ids), exported as one frozen object `automationStudioCandidateTrialSlowDown { unhandled, instruction }`,
  the `trial-stop.ts` pattern. The move was needed because the gate was at 799/800 lines. `candidate/` now holds
  25 source files, which is the limit, so it has no room for another file. It is not added to the barrel; I don't
  own `index.ts`, and nothing outside the gate uses it.
- New test `AS flow-bootstrap/candidate/tests/offline-trial/tests/offline-first-gate.test.ts` (11 tests). The folder
  had 1 file and now has 2. The cases:
  - T18 kept no: no admission, hook, reset or `leftOnSite`; `checkedAgainst`; the instruction starts with
    `WORDS.kept`; the digest is closed; one trial is counted; retest and completion are refused.
  - A kept stop, then a live retest (offline not asked again); the same stop live closes the revision (D43).
  - Offline pass: the order is offline, admit, hook, reset, trial; the live yes is kept with
    `offlineCheck.passed`; completion is ok.
  - Offline pass followed by a live no: completion is refused.
  - A gap runs live in the same call with the step and its words; the retest is live without asking offline again.
  - A kept yes is refused and runs live as `inconclusive`/`offline_kept_yes`.
  - `not_tried` adds no evidence.
  - A throw runs live as `inconclusive`, with no error text in the evidence. An abort propagates, and no hook,
    reset or trial runs.
  - After a reset refusal, offline is not asked again.
  - Without `offlineFirst`: unchanged.
  - The step log writes `0001-offline` (kept_no, 4/4 counts, no feedback text) and `0002-offline` (gap, gapStep 3)
    before `0003-reset`.

## Commands run and observed results

2026-10-27 (all from Core `packages/fluxiq` unless stated):
- Tests first, before any source edit: `pnpm test src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/offline-trial`
  -> `Test Files  1 failed | 1 passed (2)`, `Tests  10 failed | 5 passed (15)`, `[vitest-groups] failed: parallel (exit 1)`.
  The one new test that passed was the no-`offlineFirst` case, as expected.
- After the implementation: `pnpm test src/programs/automation-studio/runtime/flow-bootstrap/candidate` ->
  `Test Files  31 passed (31)`, `Tests  216 passed (216)`, `[vitest-groups] all groups passed: parallel, real-sql`.
  I ran it again after fixing the test's types and packed statement, with the same three lines.
- First `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` -> exit 2:
  - Two errors in my test (`members` was typed `JsonObject`). I fixed them.
  - The others were in another worker's in-progress `service/offline-first/tests/*.test.ts`: TS2307 `'../index.ts'`
    not found, and TS7006 implicit any. I noted them and did not fix them.
  - Rerun -> exit 0, no output.
- From Core root, `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"`:
  - First run: 1 FAIL, `[statement-packing]` at line 179 of my test. I fixed it.
  - Rerun -> `structure-audit: passed (443 warning(s), 1152 baselined).`
  - Warnings on my files: `candidate/` has 25 source files (limit 25); `trial-gate.ts` is 773 lines (advisory 400,
    limit 800).

UNIT READY: AS flow-bootstrap/candidate/contracts.ts, AS flow-bootstrap/candidate/trial-gate.ts,
AS flow-bootstrap/candidate/trial-slow-down.ts, AS flow-bootstrap/candidate/tests/offline-trial/tests/offline-first-gate.test.ts

## Not verified

- Nothing in production attaches `offlineFirst` yet. That wiring is in `service/project-build/whole-trials.ts`
  (another brief). The gate was exercised only with fake ports.
- No full suites, no live or paid runs, no model calls. The subflow gate (B8) was not looked at.
- I did not check the behaviour of a kept answer whose `standingNo` contradicts an earlier standing no. It goes
  through the same `standingNos.weigh` as a live answer, so I expect it to become unsure and not closed, but no
  test covers it.

## Open questions or contradictions found

1. `offlineAsked`, described above, is stricter than the brief's literal `tried === 0`. It closes a re-ask loop
   after a reset refusal. A consequence: the live trial that finally runs after such a refusal carries no
   `offlineCheck` note.
2. `candidate/` is now full (25/25 source files). The next feature there must group files into a subdirectory first.
3. A kept answer still reports `effectApplied: true, targetsUnchanged: false`, the same as a live trial. That is
   less accurate, since nothing touched the site, but it keeps the loop's refusal-run counting unchanged. Decide
   whether you want `targetsUnchanged: true` on a kept answer.
