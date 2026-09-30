# t189-wC: before/after tests on windows rebuilt from the recorded runs

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t189/!FluxIQ`, branch `task/t189-decision-context`.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Partial. `recorded-windows.test.ts` is rewritten as before/after tests on the three replays: 20 tests, 17 pass.

The 3 failures are source defects, not test defects. As the brief directs, I did not weaken those assertions and did not touch source.
- Two defects are one cause: the recorder counts an answered request across attempt epochs. So `sameAs` is 2 instead of 5 or 13, and the note says "8th time" at decision 15.
- The third: a refused initial look is folded as a plain call, so run 4 loses that refusal at decision 47.

The evidence for each is under "Open questions" below.

## What changed and why

- **`R/llm/decision-context/tests/recorded-runs.ts`.** One change to the driver. A `complete` decision now sends `{summary: "Recorded run <name>."}` where it used to send `"... completion at decision <n>."`.
  - Why: the old text differed at every decision, so no two completions could ever be the same decision. That made assertion 4 (crossborder 12/13 caught as identical) impossible to reach.
  - The completed result was never logged, so this is a choice. It is documented beside the code.
  - A completion against a changed draft is still a new attempt, because the recorder keys on draft revision too.
  - All data and fidelity choices are unchanged. Part (a) still matches all three logs.
- **`R/llm/decision-context/tests/recorded-windows.test.ts`** (rewritten):
  - **(a)** The three replay-matches-log tests are kept. The run-6 defect test is flipped: with `pastLog`, the replay now matches the log, asks decision 38, and ends `llm_evidence_loop.invalid_decision`. The `draft-shown` fix is applied.
  - **(b)** An `OLD` table quotes wA's old-code numbers for each chosen decision: entries, bytes, pages, notes, note bytes, and notes lost. The source is cited in comments.
    - One test prints the before/after table with `console.table`. It also prints a `RECORDED-BEFORE-AFTER` JSON line.
    - One test per chosen decision checks assertion 6.
  - **(c)** One describe per assertion, 1 to 5.

## Before/after table (default 5,800-byte pages, 2,000-byte detections)

The columns:
- **old**: wA's numbers on the old code.
- **window**: the current window without `core.evidence_history`.
- **after**: everything shown now.

"notes" means `core.request_check`, `core.no_progress`, `core.completion_check` and `core.dry_run` entries in the window.

| run | at | old entries | old B | old pages | old notes (B) | old lost | window entries | window B | window pages | window notes (B) | history B (form) | after entries | after B |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bigbox-run6 | 15 | 10 | 23,892 | 3 | 4 (2,619) | 3 | 7 | 21,923 | 3 | 2 (1,621) | 1,727 (full) | 8 | 23,726 |
| bigbox-run6 | 22 | 18 | 23,919 | 2 | 13 (8,398) | 5 | 7 | 21,948 | 3 | 2 (1,642) | 1,849 (full) | 8 | 23,873 |
| bigbox-run6 | 26 | 13 | 23,800 | 2 | 8 (7,434) | 12 | 8 | 20,102 | 2 | 4 (5,128) | 2,673 (full) | 9 | 22,851 |
| bigbox-run6 | 37 | 10 | 23,909 | 2 | 5 (6,089) | 16 | 7 | 18,925 | 2 | 3 (2,929) | 3,609 (full) | 8 | 22,610 |
| crossborder | 13 | 8 | 19,586 | 3 | 2 (2,056) | 0 | 7 | 19,060 | 3 | 2 (2,335) | 1,687 (full) | 8 | 20,823 |
| crossborder | 14 | 9 | 21,131 | 3 | 3 (3,601) | 0 | 7 | 19,095 | 3 | 2 (2,370) | 1,692 (full) | 8 | 20,863 |
| everything-store-run4 | 30 | 9 | 23,046 | 3 | 3 (3,270) | 0 | 7 | 20,626 | 3 | 2 (3,047) | 3,064 (full) | 8 | 23,766 |
| everything-store-run4 | 47 | 9 | 23,899 | 3 | 3 (4,305) | 3 | 8 | 18,760 | 4 | 2 (2,330) | 3,963 (codes rung, 13 folded) | 9 | 22,799 |

"history B" is the bytes of the value. The entry, including its `callId` and `toolId` wrapper, is slightly larger. For example, run 4 at 47 is a 4,039-byte entry holding a 3,963-byte value.

## Assertion results

1. **Run 6, answered repeats.** Partly holds.
   - **Holds:**
     - 6-9 is one `answered` row, answered by `snap3`. 14-20 is one row, answered by `snap-store-list`.
     - Every note carries `answeredAt` (5 and 13), `lastActionBefore` (open-store-picker@4 and pick-millbrook@12), `pageUnchanged: true`, and "no action has run since".
     - The redirect arrives at the second answer from one result. The first redirect is `core.no_progress.7` in 6-9 (old: `.8`) and `core.no_progress.15` in 14-20 (old: `.16`). History `redirects` = `[7,8,9,15,16,17,18,19,20]`.
   - **FAILS: `sameAs` is 2 for both rows, where 5 and 13 are expected.**
   - **FAILS: `timesAsked` and `askedAt` count every identical snapshot since decision 2.** At the 14-20 run the note should say `timesAsked 2, askedAt [13,14]`. It says:
     - `core.request_check.14`: `timesAsked 8, askedAt [2,5,6,7,8,9,13,14]`, "This is the 8th time you have asked it (askedAt); it will get this same answer until an action runs".
     - `core.request_check.20`: "14th time".
     - Actions ran at 3 and 10-12, so the note contradicts its own "no action has run since".
     - In the 6-9 run, `.6` says `timesAsked 3, askedAt [2,5,6]`.
2. **Run 6 decision 22.** Holds.
   - The window has exactly one `core.request_check` (`.20`) and one `core.no_progress` (`.20`), 1,642 bytes in all. Before: 7 and 6, 8,398 bytes.
   - Pages went from 2 (pick-millbrook, snap-store-list) to 3 (open-store-picker-2 is back).
3. **Run 6 decision 37.** Holds.
   - Completions 22 and 26 are distinct rows.
     - 22 has codes `[cannot_reach_start_location, completion_profile_limit_exceeded, core.replay.unreproducible, llm_evidence_loop.dry_run_refused]` and `dryRun [[4,"unreproducible"],[11,"unreproducible"]]`.
     - 26 has `bootstrap.instructed_act_missing` and `dryRun "clean"`.
   - Amendment 21 has `withdrewChanged [12]`.
   - `dryrun.1.4` and `core.dry_run.1` are gone.
4. **Crossborder 13-14.** Holds, after the driver change above.
   - `core.completion_check.13` carries `sameAsIteration 12, timesSent 2`. `.12` carries neither.
   - Only `.13` is in the window at 14.
   - The history has one completion row at `[12,13]`.
5. **Run 4 decision 47.** Holds.
   - Completion rows 40, 44 and 46 are present. Before, 40 and 44 were gone with no trace.
   - `core.dry_run.1` and `dryrun.1.3` are gone.
   - `cartextract5`, the newest page, is shown.
6. **Every chosen decision.** Mostly holds.
   - The shown total is at most 24,000 plus separators everywhere; the maximum is 23,873 at run 6 decision 22.
   - The history value is at most 4,000 bytes everywhere; the maximum is 3,963 at run 4 decision 47.
   - Every refusal so far has a row at 7 of 8 decisions.
   - **FAILS at run 4 decision 47:** the refused initial look at iteration 0 (`web.action.rejected.not_at_start_location`) is folded into the range row `["0-7","calls",8,5]`, so it has no row.

## Commands run and observed results

All `vitest` and `tsc` commands ran from `packages/fluxiq`; the structure audit ran from the Core root.

- `npx vitest run src/programs/automation-studio/runtime/llm/decision-context/tests/recorded-windows.test.ts` (before editing, on the old test file): `Tests 9 failed | 3 passed (12)`.
  - The old pins no longer match, as expected.
  - The old defect test failed with "promise resolved instead of rejecting", which means the fix is in.
- A throwaway dump test, `tests/zz-t189-wC-scratch.test.ts`, wrote every window to the scratchpad. It has since been deleted.
- `npx vitest run src/programs/automation-studio/runtime/llm/decision-context`: `Test Files 1 failed | 5 passed (6)`, `Tests 3 failed | 43 passed (46)`. The three failures:
  - `bigbox-run6: the answered repeats are caught and shown > each run of answers from one result is one history row pointing at the call it repeats`: `- "sameAs": 5 / + "sameAs": 2`, and `- "sameAs": 13 / + "sameAs": 2`.
  - `... > the note after each repeat says how often, since when, and that nothing has run since`: `core.request_check.6: expected { ok: false, …(11) } to match object { answeredByCallId: 'snap3', …(5) }`, because `timesAsked` and `askedAt` differ.
  - `every chosen decision, before and after > everything-store-run4 decision 47: ...`: `refusals with no row at decision 47: expected [ +0 ] to deeply equal []`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t189-wC tsc" npx tsc --noEmit -p tsconfig.json`: `[heavy] t189-wC tsc holds b1`, no diagnostics, exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (198 warning(s), 355 baselined).`
  - The only decision-context line is the advisory `recorded-runs.ts: 677 lines is past the 400-line advisory threshold`.
  - It also printed "1 baseline entries can be lowered", as it did for wB1 and wB3.

## Not verified

- No Lab or browser run, per the brief. All numbers are replay numbers, with fixed page sizes.
- I did not run the full llm suite or `pnpm check`.

## Open questions or contradictions found

1. **Source defect: answered repeats are counted across epochs** (`R/llm/decision-context/recorder.ts`, `decisionKey`, lines 77-80).
   - What goes wrong: any decision other than a completion is keyed on its signature alone. The signature is the canonical JSON of the request, with no attempt epoch and no answering call.
   - How run 6 hits it: every snapshot sends the same request. That is the replay's fidelity choice 4, and it is realistic, because a snapshot has no parameters. So snap2 (2), snap3 (5), snap-store-list (13) and all eleven answers share one key.
   - Consequences:
     - `firstSeenAt` is 2 for every one of them, so the history shows `sameAs 2`.
     - The executed looks at 5 and 13 get `sameAs 2`, which makes their role "other" rather than plain.
     - The note's `timesAsked` and `askedAt` come from the same repeat (`decision-handlers/answered-request.ts:41`), so the note tells the model it is on its "8th" to "14th" ask and that "it will get this same answer until an action runs". Actions did run in between.
   - Suggested fix: count an answered row's repeat from its answering call.
     - Key by signature plus `answeredByCallId`, and count the executed call once.
     - Or reset the key when the loop executes the request again.
   - The early-redirect count (`answered-request.ts:70`) already filters by `answeredByCallId`, which is why the redirect assertion passes.
2. **Source defect: a refused initial look folds** (`R/llm/decision-context/group.ts`, `case "look"`).
   - What goes wrong: a `look` row is always `role: "plain"`, even when its result code is a refusal. wB3 records a failed initial look as `look` carrying its failure code.
   - Run 4's initial look is `web.action.rejected.not_at_start_location`. On the codes rung at decision 47, it folds into `"0-7"`.
   - Suggested fix: give a look with a refusal or failure code the `refusal` role.
3. **Driver change.** The single-summary completion is the only change to `recorded-runs.ts`. The supervisor should accept or reject it as a fidelity choice. Without it, assertion 4 cannot hold with any source.
4. **Observation, not asserted.** At decision 37, `core.request_check.20` and `core.no_progress.20` (1,642 bytes) are still in the window, 17 decisions after the repeats stopped.
   - The cause: a note is superseded only by a newer note of the same tool id.
   - The history already carries both facts, so a follow-up could retire such notes once an action has run since.
