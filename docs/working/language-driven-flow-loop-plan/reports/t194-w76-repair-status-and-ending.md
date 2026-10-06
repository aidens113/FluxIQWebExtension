# t194-w76: status during a repair, and a failed run's ending

## Outcome

Done. U2 and U3 are both fixed where they start. Tests were written first, failed for the expected reason, and now pass.

## What changed and why

### U2: "Step 5 of 5" stayed up through a four-minute re-author

- **Cause.** The pacer (`apps/extension/src/background/activity/pacer.ts`, `displayFor`) carries a run's last step across every later event of the same unit, so the count does not flicker between step events. The refuted-result re-author emits into the run's own unit (`run:<id>`) and never reports a step of its own. So "Step 5 of 5" was carried for the whole repair. The overlay (`overlay-view.ts`) and the panel live line (`live-line-model.ts`) both render `ActivityDisplay.step`, so they repeated it together.
- **Fix, in the pacer's source of truth.**
  - `background/activity/unit-situation.ts`: `UnitState` gains `rebuilding`. It becomes true when Core opens a repair of the Flow itself: a `repairing` row titled "Result repair started", or a label starting "Repairing the Flow" (both come from Core `recovery/refuted-result/repair.ts:159`). It becomes false when the run reports its next step, which is the repaired Flow's re-run.
  - `pacer.ts`: the previous step is not carried while `unit.rebuilding` is true.
  - A run recovering from one failed step ("Recovering from a failed step", `activity/step/recovering.ts`) still keeps that step's number.
- Panel and overlay still read the same `ActivityDisplay`, so they cannot disagree.

### U3: a bare "Run failed"

- **Cause.** Core `R/activity/run.ts:32` (and the status map above it) emitted the fixed label "Run failed" with no text. The facts were on the run's record but never read:
  - `resultVerification`: the verdict, the code `core.result.does_not_answer_request`, and an observation starting "13 records stored".
  - `resultRepair`: per-attempt `totalRecordCount`, `phase`, `outcome` (`not_rerun` in this run), and `stopped`.
  - `resultReauthor.code`: `flow_bootstrap.evidence_budget_exhausted`.

  I confirmed these in the run's stored record under `.work/run-musp39u8-9ac026ab/fluxiq-root`. The repair marker is only on the run detail, not on the returned session.
- **Fix.**
  - New `R/activity/wording/run-ending.ts`, `automationStudioActivityRunEnding(record)`, exported from `wording/index.ts`. It is pure and produces one sentence with no ids, at most 148 characters, so "Run failed: " plus the sentence fits the 160-character label limit. For the evidence run it says: "It returned 13 rows, but the check found they don't answer what you asked, and the fix ran out of room before it finished."
    - It also covers: 1 row, 0 rows, a check that could not decide ("couldn't confirm"), no count available, and every repair ending (`rerun_failed`, `unverified`, `stopped` as `attempts_exhausted` or `not_converging`, `not_rerun`, and unsettled).
    - It returns undefined for a run that did not fail at its result check. That row stays "Run failed".
  - `R/activity/run.ts`: `withAutomationStudioRunActivity` takes an optional third argument, `{ readRecord(session) }`.
    - For a failed session, the sentence comes from the session's own metadata, then from the record if one can be read. A read that throws leaves the session's answer and never fails the run.
    - The row keeps `detail.title: "Run failed"`, so Core UI and web tests that key on the title are unchanged. The sentence goes in `label` ("Run failed: …"), which the overlay and live line show, and in `detail.text`, which the chat shows as "Run failed — …". Both say the same words.
    - Also restructured: the thrown-run path no longer shares the try with the settle path.
- **The one call site, R/service.ts.** The text has to come from the run detail, and only the service can read it. The `withAutomationStudioRunActivity(...)` call in `runRuntimeSession` (end of the method, around line 2750) now passes `readRecord: (ended) => this.getFlowRunDetail(projectId, ended.runId)?.metadata`. The project DB is still held at that point, because `withAutomationStudioProjectDatabaseHeld` wraps the activity scope.
- **Extension.** No code change was needed for U3. I added tests that the new row reaches the overlay detail whole, under "Couldn't fix your Flow", and becomes the chat message "Run failed" with the sentence as its text. The sentence has no dotted id, so `humanOr`/`RAW_ID` keep it, and `isHeadlineEcho` does not drop it.

## Commands run and observed results

- **Core activity tests, before the fix:**
  - Command: in `packages/fluxiq`, `npx vitest run src/programs/automation-studio/runtime/activity`
  - Result: `Test Files 2 failed | 16 passed (18); Tests 2 failed | 158 passed (160)`. The run-ending module was missing, and the scope test received `"label": "Run failed"`.
- **Core activity tests, after:** the same command gave `Test Files 18 passed (18); Tests 167 passed (167)`.
- **Core activity and UI tests, final run:**
  - Command: `npx vitest run src/programs/automation-studio/runtime/activity src/ui/activity-action`
  - Result: `Test Files 26 passed (26); Tests 340 passed (340)`.
- **Extension tests, before the fix:**
  - Command: `node …/scratchpad/t194/narrow-tests.mjs "C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension/apps/extension" w76 background/activity`. The package root has to be an absolute path; a relative one throws in `createRequire`.
  - Result: `tests 67, pass 66, fail 1`. The new U2 test got `['Fixing your Flow', {count:5,index:5}]` where it expected `null`.
- **Extension tests, after:** the same command gave `tests 67, pass 67, fail 0`.
- **Extension tests, all owned directories:**
  - Command: the same runner with `background/activity panel/chat/stream/step panel/chat/view content/activity-overlay shared/activity`
  - Result: `narrow: 20 test files; tests 185; pass 185; fail 0`.
- **Core typecheck:**
  - Command: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194 w76 core tsc" npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq`
  - First run: exit 0, no errors.
  - Rerun after the final `run.ts` edit: exit 2, with one error in `R/llm/node-tools/tests/carried-as-stored.test.ts` (TS2345, `ranWith: undefined`). That file is untracked and belongs to another worker editing `R/llm`; it is not mine. No error was reported in any file I own.
- **Extension typecheck:** `npx tsc -p tsconfig.json --noEmit` in `apps/extension` exited 0 with no output.
- **Core structure audit** (`node scripts/structure-audit.mjs`):
  - First run: 1 FAIL `[failure-as-empty]` in `activity/run.ts`, for a catch that returned undefined.
  - After restructuring (the session's metadata answers first, and the record read's catch only leaves it standing): `structure-audit: passed (240 warning(s), 349 baselined)`.
- **Downstream structure audit:** `structure-audit: passed (164 warning(s), 118 baselined)`.

## Not verified

- No live browser run. I did not see the overlay or panel show the new ending or drop the step during a real re-author.
- Core was not rebuilt (`pnpm --filter fluxiq build`). The extension's tests and types do not consume the Core change, which only changes the text Core sends at runtime. A Lab run needs a rebuilt Core in the lane tree.
- The `R/service.ts` wiring has no test of its own: `getFlowRunDetail` really returning the `resultRepair` marker at that point. The `readRecord` contract is tested in `scope.test.ts`, and the record shape was confirmed from the stored run.
- Run failures that are not result-check failures, such as a step failing outright, still end on a bare "Run failed". `run-ending.ts` deliberately returns undefined for them.

## Open questions or contradictions found

- The step count is suppressed by matching Core's words: the title "Result repair started" or a label starting "Repairing the Flow". Core has no structured "repair of the Flow" field, the same way the pacer already keys on "Result check". A field on the `repairing` row would be sturdier, but that row is emitted in `R/recovery/refuted-result/repair.ts`, which I may not touch.
- The two "Checking the Flow is finished — Completing now: …" lines before "Run failed" in 35-failure-panel.png come from the re-author build's completion rows. This brief's fix does not change them.
