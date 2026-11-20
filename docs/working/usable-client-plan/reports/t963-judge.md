# t963: the judge sees the whole run (worker report)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t963/!FluxIQ` (branch `task/t963-judge-whole-run`). Nothing committed.

## Outcome

Done, including the lead's four follow-ups (see "Follow-up" below): saved Flow runs and carried-on attempts are now in the trail, the calibration is in every judge's system instruction, and a throwaway look no longer resets the same-evidence refusal. No model calls were made.

**Important finding about attempt 3.** Its judges were right to refuse it. The saved Flow that attempt 3 replayed has no date-sort step:

- It navigates to the unsorted job list and reads it.
- Its rows come out in this order: Pinecrest (2 days), Marlowe (5), Oakridge (10), Quillmark (10), Halvard (2), Saltmarsh (8), Parsec (12). That is not newest first.
- The order the yes judges accepted in attempts 1 and 2 was Pinecrest, Halvard, Marlowe, Saltmarsh, Oakridge, Quillmark, Parsec.

So "same rows yes in 1-2, no in 3" is the same set of rows in a different, wrong order. The defect is in the saved Flow: it was written before the exploration found the sort. It is not in the judge. Details are under "Follow-up".

The sections below "Follow-up" describe the first pass.

## Follow-up (lead's message: replay, carry-on, system prompt, digest)

### 1. Saved Flow runs feed the trail

- **Port.** `flow-run/ports.ts` gains `trail?: { viewKeys?; add(steps) }`.
- **Run.** After the engine returns, `flow-run/flow-run.ts` hands every traced step on through `automationStudioResultTrailOfAttempts`, child Flow steps included.
  - Each step carries its definition, its label, its node's parameters (`asked`), its status, route and failure (`outcome`), and its outputs, message, change lines and the view after it (`found`).
  - This is best-effort: a failure in it never changes the run's own answer.
- **Wiring.** `attempt/flow-stage.ts` passes `trail` with the domain's `observedStateKeys`, and pushes onto `run.trail`.
- **Source widened.** `run-trail/of/attempts.ts` now reads the engine trace's own `definitionId`, the node's `parameterValues` (falling back to `inputs`), `message`, `failure.code` and `childTrace`.

### 2. Carried-on attempts keep their whole trail

- **Holder.** New `answer-first/trail/held.ts` (`automationStudioAnswerFirstTrailsOf`) holds each attempt's trail in memory per service, keyed by attempt id, up to 32 attempts. It follows the same pattern as `witnesses/before-readings.ts`.
  - A carry-on keeps its id, so it gets the same array back, with everything from before the resume.
  - A person's Run again starts an empty trail, since it is judged on its own change.
  - If Core restarted, a carried-on attempt has nothing held. It then starts with Core's entry `core.earlier_calls_not_held`, which says those calls are not held and that what they produced is in the final data. Nothing is made up.
- **Wiring.** `attempt/run-attempt.ts` takes its trail from the holder. `attempt/state.ts` holds `trail` on the run, and the call chain and the Flow stage both add to it.

### 3. Calibration in the system instructions

- **Text.** `runtime/llm/diagnosis-instructions.ts` has a new `AUTOMATION_STUDIO_RESULT_TRAIL_CALIBRATION_INSTRUCTION`, in generic words ("target", not site). It says the same things as the trail note.
- **Placement.** It is appended to the finished-run, build-test and Flow-less judge instructions. It sits after the part a run may override, so a run's own `judge.verification` wording never drops it.
- **Tests and snapshots.**
  - The judge and verification system-prompt snapshots were updated. The only change is the appended sentence; byte counts confirm it.
  - `tests/flow-less-diagnosis.test.ts` used to pin the run and test instructions by digest. It now pins them with the calibration removed, and checks that both end with the calibration.
  - The build-test route sentence test now expects the calibration right after the route sentence.
  - The new calibration cases live in `tests/flow-less-diagnosis.test.ts`. A separate file would have pushed `llm/tests` past its 25-file limit.

### 4. Same-evidence digest

- **Change.** `flow-less/summary-digest.ts` leaves `trail` out of the digest.
- **Why that still catches new evidence.** What in the trail bears on the result reaches the digest through the result itself:
  - the rows and their order;
  - `readPages`, each read's conditions, where it read and what it left out;
  - the acts, the end view and the witnesses;
  - `looked`, every look after the first act.
- **Effect.** A throwaway look between two identical completions is refused as the same evidence, with no judge call, and `refusedAgain` climbs, so t962's loop handling can catch it. A read that changes the rows is judged again, and the judge then sees the whole trail.
- **Test.** `completion/tests/trail-digest.test.ts` covers both cases.

### Replay proof (J3, extended)

- **Fixture:** `run-trail/tests/fixtures/run-mwo3dp11-replay.json`. It is rebuilt from the run's step files:
  - the 29 engine steps of attempt 3's saved Flow run (0239-0267: node, definition and status, in run order);
  - the saved steps' parameters, recorded as `held` on the attempt's next call (0269);
  - the page the run left (0269's own answer).

  The step files record no per-step view, so only the page left is given as a view.
- **Assertions:** the judge's input now carries:
  - all 29 steps in order, with their definitions and statuses;
  - five reads, each with its conditions, including `{"field":"easily","is":"present"}`;
  - the closing next-page step;
  - no step asking for a sort, and the navigate before the first read going to `/jobs` with no sort;
  - the page left at `URL ~?page=5`, showing `"relevance"`, with the `date` sort as an unchosen link.

  With this trail, the judges of attempt 3 would see that the replay never sorted.
- **Engine test:** `flow-run/tests/trail.test.ts` runs a real Flow on the real engine and store, with no model. The trail gets the read first, with its stored rows' reference (`loans`, 3 records), then one renewal per row, each with its outcome. With no trail given, the run is unchanged.
- **Holder test:** `answer-first/trail/tests/held.test.ts` checks that a carry-on keeps the trail, that Run again and a new attempt start empty, and that the not-held entry appears.

## What changed and why

### The evidence (run-mwo3dp11-a47a032d)

- All 19 judge calls were `loop_verification` completion checks.
- Each check saw seven rows, one end page and the reads' labels. None saw the calls the attempt made.
- **Attempt 1 (steps 0123-0181).** The attempt pressed the site's date sort (0125, `?sort=date`). It read pages 1-5. Its last next-page press (0181) answered `ended: control_absent`.
- **Attempt 3 (0236 on).** This attempt ran the saved Flow through the Flow run stage (`flow-*` step files). That Flow has no sort step, so its reads were on the unsorted list. Judges 0331-0510 said "no date sort is recorded", which was correct (see Outcome).
- **Missing tag.** The "Easily apply" tag showed beside every kept row on the read pages, but no table column held it.

### J1: one trail builder, attached to all three judges

New module `packages/fluxiq/src/runtime/result-verification/run-trail/`:

- **`contracts/run-trail.ts`** defines the trail:
  - `AutomationStudioResultTrailStep` has the fields `did`, `on`, `asked`, `outcome`, `where` and `found`.
  - Shown to the judge as `{ note, entries: [{ n, ... }] }`.
  - The names deliberately avoid the word "step". The Flow-less judge is held to say nothing of steps (`flow-less/tests/judge.test.ts`).
- **`run-trail/trail.ts`** (`automationStudioResultRunTrail`) is the one builder.
  - It numbers the entries, screens them and attaches the note.
  - Nothing is capped.
- **`run-trail/screen.ts`** screens one member at a time:
  - A denied key or a credential-shaped string becomes `[withheld]` and sets `withheld`.
  - Locator runs are rewritten without setting `withheld`. Otherwise every list read would mark the summary withheld because of its selectors.
  - For determinism, it drops numbers under keys ending `At` or `Ms`, and strings shaped like UUIDs.
- **`run-trail/of/{call,attempts,observations}.ts`** are the three sources:
  - an attempt's calls, from the call value plus the domain's whole answer;
  - a finished run's traced attempts: node definition, status/route, outputs, diff lines, and the view after, by view keys;
  - a build test's observations, with each evidence object whole, page included.
- **`run-trail/fitting.ts`** gives shorter forms for the run and trial judges. They are used only when a request does not fit the window. Order of summarising: start view, end view, each entry's `found` oldest first, then each `asked`. Rows and outcomes are never summarised.

Wiring:

- **Completion:**
  - `answer-first/attempt/call-chain.ts`: new `trailed` hook. Every call that reached the domain is handed on, in order, through `automationStudioResultTrailStepOfCall`. `on` comes from the domain's `describeCall`.
  - `attempt/run-attempt.ts` collects the steps and passes `trail: () => trail` to the completion check.
  - `completion/check.ts` puts `trail` on the summary.
  - `flow-less/types.ts` and `judged-summary.ts` send it, last, as `trail`.
  - The 6-look cap (`LOOKS_SHOWN`) in `completion/check.ts` is removed.
- **Run verification:**
  - `result-summary.ts` adds `trail` from `sessionAttempts`.
  - `verify.ts` now passes `resultSummaryFitting: automationStudioResultTrailFitting(judged)`.
- **Trials:** `build-test/summary.ts` adds `trail` from `report.observations`.
- **Change-line cap removed:** `build-test/change-lines.ts` no longer cuts to 3 lines of 160 characters. Every line is sent whole, in the same order. `changedNotShown` is now only the domain's own count of lines it left out.
- **Window fitting** (`flow-less/window-fitting.ts`) now summarises in this order:
  1. witnesses
  2. end view
  3. answer text
  4. looked
  5. readPages
  6. trail entries' `asked`, oldest first
  7. trail entries' `found`, oldest first
  8. acts
  9. rows

  Previously the order was looks, then pages, then acts, then answer, then rows.

### J2: recalibrated instructions

- **New `run-trail/note.ts`** (`AUTOMATION_STUDIO_RESULT_TRAIL_NOTE`). It goes out with every trail, so all three judges read the same rules:
  - Judge from the trail plus the final data. The site's own sort, filter and search count, as do the page each row came from, the read's conditions, and where paging ended.
  - A condition the trail shows held is met without a column for it. Never require a field the person did not ask for as a column.
  - An order is met by the order of a site list the trail shows was sorted that way.
  - All pages count as read once the next-page control answered that there is no further page.
  - Answer no only on a concrete contradiction or a named, unsupported item or condition. Answer unknown only when nothing bears on a named part. "A doubt that the trail answers is neither."
- **`flow-less/question.ts`** now introduces the trail.
  - It replaces "How it was done is not in question" with a description of the trail.
  - It replaces the yes/no/unknown sentence with the calibrated one: "no only on a concrete contradiction", "unknown only when nothing in this evidence bears on a part", and "a condition the trail shows held is met even where no column of the rows says it".
  - The judged-summary snapshot was updated to match.
- **Generic:** the text names no site, task, product or answer. A test checks this.
- **Determinism:** the request is built only from Core's records, in call order. Volatile members are dropped. A test builds it twice and checks the bytes are identical.
- **Lab oracles:** none were touched.

### J3: provider-free proof

- **Fixture:** `run-trail/tests/fixtures/run-mwo3dp11-calls.json` (201 KB). It holds steps 0122-0182 of the run (24 calls), each with its recorded `call.json` input and `result.json` answer. A scratch script extracted them.
- **`run-trail/tests/run-mwo3dp11-trail.test.ts`** sends those calls through `automationStudioResultTrailStepOfCall` and `automationStudioFlowLessJudgedSummary`, then asserts that the judge input carries:
  - **The date sort:** the dom-click whose `where` ends `?sort=date`, with `found.control === "date"`. Every read after it was made on a `sort=date` address (at least 5 reads).
  - **The end of paging:** the last entry is the next-page press at `sort=date&page=5`. Its `found` contains "The list has no next page." and `"route":"ended"`. Pages 2-5 were each reached by a next-page press.
  - **The tag:** for each of the 7 kept rows (title plus company), every page view in the trail that shows that item has `"Easily apply"` inside the item's block. Each such page is on the sorted list.
  - **Determinism:** the request is byte-identical across two builds, with no `startedAt`/`finishedAt`/`actedAt` and no UUID.
  - **Fitting order:** end view and answer text are summarised before any trail entry, and trail entries before rows. Within the trail, `asked` goes before `found`, oldest first.
- **Model-text check (same file):** the note and the Flow-less question match none of the following:
  - the ten scenario names or their words;
  - the existing site and Lab-task word lists from `flow-less/tests/judge.test.ts`;
  - this run's own words (rolefinch, easily, remote, uk, salary, posting, newest, title, engineer, careers).
- **`run-trail/tests/trail-sources.test.ts`** covers:
  - the screen: denied key, credential, and dropped times and ids;
  - the run trail from traced attempts, and on `summarizeAutomationStudioRunResult`;
  - the trial trail with each page whole;
  - the order of the shorter forms in `fitting.ts`.
- **`attempt/tests/call-chain.test.ts`** has a new case: every call that reached the domain is trailed in order with its whole answer. A refused reset and a repeated act refused by the gate are not trailed.

### Tests changed to the new rule

- **`completion/tests/looked-evidence.test.ts`:** every distinct look is shown, not the latest 6.
- **`build-test/tests/change-lines.test.ts`:** all lines are shown, and there is no `changedNotShown` from Core's own cap.
- **`build-test/tests/request-size.test.ts`:** the 14,000-character bound now applies to the per-step account (`buildTest.steps`), not the whole request. A new assertion checks that the trail carries every page the test saw, whole and in order: `\nURL ` appears once for the end view plus once per observation page.

## Commands run and observed results

All vitest runs used `node node_modules/vitest/vitest.mjs run --root <packages/fluxiq> <files>`, through `heavy-slot.mjs`, in batches of at most 50 files.

| Run | What it covered | Result |
| --- | --- | --- |
| First pass, batch A | 50 files: `result-verification/tests` and `flow-less` | 2 files failed, 4 tests (snapshot, plus "says nothing of a Flow, its steps") |
| First pass, batch B | 47 files: build-test, agreement, run-trail, completion, plus 3 attempt tests | 3 files failed, 5 tests (change-lines ×2, request-size ×2, looked-evidence ×1) |
| Fixes | Renamed `steps`/`step` to `entries`/`n`, reworded "each step" in the question, updated the three tests above | — |
| Snapshot update | `-u src/runtime/result-verification/flow-less/tests/default-question.test.ts` | `Snapshots 2 updated`, `Tests 3 passed (3)`; the diff is the question line only |
| Rerun of 9 changed/failing files | | `Test Files 9 passed (9)`, `Tests 87 passed (87)` |
| Batch C | 44 files: read-account, request-rows | `Test Files 44 passed (44)`, `Tests 320 passed (320)` |
| Batch A, rerun | 50 files | `Test Files 50 passed (50)`, `Tests 548 passed (548)` |
| Batch D | 47 files: refuted-no, value-readings, located-defects, computed-facts | `Test Files 47 passed (47)`, `Tests 340 passed (340)` |
| Batch E | 43 files: the remaining result-verification folders | `Test Files 43 passed (43)`, `Tests 257 passed (257)` |
| Batch B, rerun | 47 files: build-test, agreement, run-trail (both new tests), completion (9), attempt call-chain, looked and judge-token-limits; started 17:14, after the structure fixes | `Test Files 47 passed (47)`, `Tests 309 passed (309)` |

In total, 231 test files (every `runtime/result-verification` test, the completion folder, and three attempt tests) all pass on the final tree.

Other checks:

- **Targeted typecheck:** `node <Core>/node_modules/typescript/bin/tsc -p packages/fluxiq/tsconfig.t963-scratch.json`. The scratch config extends the package tsconfig, with `files` set to the changed sources and the new or changed tests. It printed no errors and the slot wrapper exited 0. The scratch tsconfig was deleted afterwards.
- **Structure audit:** `node scripts/structure-audit.mjs` in Core.
  - The first run found 4 violations: an `as never` cast, imports reaching past barrels, and an `of-` filename prefix.
  - After the fixes it reported `structure-audit: passed (557 warning(s), 911 baselined).` None of the warnings is new to a file I added. The `directory-files` advisories on existing directories remain.

### Follow-up checks (final tree)

All vitest runs used `node node_modules/vitest/vitest.mjs run --root <packages/fluxiq> <files>`, through `heavy-slot.mjs`, in batches of at most 50 files.

| Batch | What it covered | Result |
| --- | --- | --- |
| F | 34 files: flow-run, trail, 7 attempt tests, 4 llm prompt tests, prompt-text | 33 passed, 218 tests. One file, `trail-calibration.test.ts`, failed to load because I moved it into `flow-less-diagnosis.test.ts` mid-run to keep `llm/tests` within its 25-file limit |
| Rerun after that move | 6 files: `flow-less-diagnosis`, `diagnosis-channel`, `default-wording`, `prompt-text`, `flow-run/tests/trail`, `flow-run/tests/flow-run` | `Test Files 6 passed (6)`, `Tests 99 passed (99)` |
| G | 36 files: answer-first `tests/` and `carry-on/` | `Test Files 36 passed (36)`, `Tests 286 passed (286)` |
| A | 50 files | `Test Files 50 passed (50)`, `Tests 548 passed (548)` |
| B | 46 files: run-trail with 11 replay and attempt-1 tests, trail-sources, completion with trail-digest | `Test Files 46 passed (46)`, `Tests 309 passed (309)` |
| C | 44 files | `Test Files 44 passed (44)`, `Tests 320 passed (320)` |
| D | 47 files | `Test Files 47 passed (47)`, `Tests 340 passed (340)` |
| E | 43 files | `Test Files 43 passed (43)`, `Tests 257 passed (257)` |

Snapshot updates:

- `-u src/runtime/llm/provider-task/tests/default-wording.test.ts` gave `Snapshots 4 updated`, `Tests 6 passed`.
- The diff is the appended calibration only. The `+` lines with it stripped are 26,302 bytes against 26,300 for the `-` lines; the 2-byte difference is one leading space on each of the two lines.

Other checks:

- **Targeted `tsc`** over all changed sources and tests, using a scratch tsconfig that was deleted afterwards: no output, exit 0.
- **`node scripts/structure-audit.mjs`:**
  - The first run found 4 violations: `llm/tests` at 26 files, a `` regex inside a template literal (a real bug in my new test, now `String.raw`), and an empty-looking `catch` comment.
  - After the fixes: `structure-audit: passed (557 warning(s), 911 baselined).`

## Not verified

- **No paid replay was run,** as the brief directed. Whether the recalibrated judge actually says yes on these rows is untested until the lead runs it.
- **The replay's views between steps.** The step files of a saved Flow's run record no per-step view, so the replay proof gives only the page the run left. In a live run, `afterAction.summary` carries each step's view, but no live run has exercised it yet.
- **Carried-on attempts after a Core restart:** the trail is held in memory only, deliberately, because it holds page text, as the before readings do. After a restart the judge is told the earlier calls are not held, rather than shown them.
- **Request size:**
  - Attempt 1 of this run made 103 tool calls, about 580K characters with page views. That is roughly 190K estimated tokens, which is near or past a 200K window. Window fitting would then summarise the oldest entries' findings.
  - Judge cost per call will rise. At the observed rate (9,549 input tokens for $0.0025), that is roughly $0.02-0.05 per completion check.
  - I did not measure a real request through `sized-request.ts`.
- **The same-evidence rule in a live loop:** t962's loop handling is not exercised here. Only the check's own count (`refusedAgain`) is tested.
- **The system text's older sentence** "Where what was asked cannot be judged from what is here, the answer is unknown, never yes" stays. The calibration that follows it narrows "cannot be judged" to "nothing in the trail or the final data bears on it".
- **Package-wide typecheck and full suites:** not run, as directed.

## Open questions or contradictions found

1. **Paths outside the named list.** The brief names `runtime/result-verification/**` and `completion/**`. Feeding the completion trail required editing `answer-first/attempt/call-chain.ts`, `attempt/run-attempt.ts` and `attempt/tests/call-chain.test.ts`. None of them is on the must-not-touch list.
2. **request-size test.** `build-test/tests/request-size.test.ts` encoded the earlier rule that a trial judge gets "one page view in the whole request" (t195-w28a). The user's 2026-11-19 rule overrides it, so the test now bounds only the per-step account. The lead may want to confirm this reading.
3. **t905 overlap.** `flow-less/question.ts`, `window-fitting.ts`, `judged-summary.ts`, `result-summary.ts`, `verify.ts`, `build-test/summary.ts` and now `flow-run/{ports,flow-run}.ts` are all edited here. Whichever of t905 and t963 merges second resolves the conflict, as the brief said.
4. **Attempt 3's saved Flow lacks the date sort.** Its `held` steps are: home, cookie, three filter presses, navigate `/jobs`, read, next-page. That Flow was saved from the exploration before the sort was found, and later attempts replay a result in the wrong order. This belongs to the Flow-saving or repair lane, not to the judge, and the judge would now see it.
