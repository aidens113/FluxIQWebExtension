# r3-a-loop (Core, lane A loop fix and lane B no-op keep)

## Outcome

Done. The lane A loop fix that was left uncommitted is verified, extended and validated. Lane B's no-op `keep` answer is added. Nothing is committed. All edits are in `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ` under `R/llm/` (`R` = `packages/fluxiq/src/programs/automation-studio/runtime`).

## What changed and why

### (1) The lane A loop fix: each hunk judged against the intent

I checked the live evidence in `run-muwaobm2-882cadd9` (slot 2) myself. Decisions 0052/0060/0084 are A (rerun step 14 as the click, plus `add act a1.origin`). Decisions 0068/0076/0092 are B (the same rerun, plus `keep act a1.origin`). Their iterations are 18-23 with no other decision between them. Every rerun answer `0053`..`0093` reads `draft_rerun`, applied 1, no refusals. Every rerun call (`rerun.14.3`..`rerun.14.8`) ended `web.action.succeeded` with effectApplied true. So the shape is as the lead described.

| Hunk | Verdict | Why |
| --- | --- | --- |
| `decision-context/decision.ts`: amendment row gains `changed?` and `notRunAs?` | Kept | The row can now say whether the decision changed the draft, and that it was refused before it ran. |
| `decision-context/group.ts`: an amendment with `notRunAs`, or with `changed: "no"`, is role `refusal`, with code `notRunAs` or `unchanged` (never `applied`), and the `changed` cell is filled | Kept | This is the "history said applied" half of the loop. A toggle that was undone now reads `unchanged` rather than `applied`, which is true. |
| `decision-context/recorder.ts`: `settleAmendment(iteration, …)` adds the held-and-refused parts and sets `applied` and `changed` once the rerun has run. It keeps the signature and repeats as they were and touches only that iteration's amendment row | Kept | This is the "dropped the refusal" half. |
| `decision-handlers/amendment.ts`: computes the signature and draft key up front, and `amendmentBlocks` leads to `refusedUnrun` (history row `notRunAs`, a trace row, `refusedAgain` plus `RepeatStop`, and a `core.repeat_check` note) | Kept | This refuses the identical decision before any reset, replay or press, and counts it as no progress. `RepeatStop` calls `noProgress.stepped()`. |
| `amendment.ts`: a non-rerun row records `changed` (yes only when something applied and it was not undone) | Kept | |
| `amendment.ts`: `held.before = {signature, draft, observed}`. Settle compares the draft key and, when the rerun took its place, `observedBy` (resultCode, effectApplied, whether the page moved, never the digests). It then settles the history row, records `repeats.amended`, and returns `unchanged` | Kept | `observedBy` avoids the digest, which moved with every reload in the live run. |
| `amendment.ts`: also records a rerun that **ran and failed** on an unchanged draft as blocking (`failed: true`) | **Added by me** | A failed rerun sent straight again is already refused `changes_nothing` on the page it left (`evidence-loop/rerun-request.ts`, checked by test). But once any call reported another page, nothing caught it, and each resend cost another reset and replay. It is keyed on the draft, as a no-change rerun is. |
| `decision-handlers/refused-repeat.ts`: `automationStudioLlmEvidenceRerunChangedNothing` (`refusedAgain` + `RepeatStop` + redirect) | Kept | A rerun that changed nothing is a step without progress and one more refusal in the run. |
| `decision-handlers/types.ts`: `RerunHeld.before`, `RerunSettled` | Kept | |
| `evidence-loop.ts`: `settled?.row` spread, and `settled?.unchanged` leads to `RerunChangedNothing` instead of the progress branch | Kept | This is the "applied rerun counted as progress" half. |
| `evidence-loop.ts`: the loop-level `repeats.blocks` check is skipped for a rerun (`rerunning`) | Kept | A rerun runs from its step's own page, where the amendment handler already checked it. The loop was checking against the page the last press left. All tests pass with it. |
| `evidence-loop/rerun-input.ts`: a node change drops the old parameters | Kept | From `live-a-r2-fix-rerun-node.md`. Its tests fail without it (seen). |
| `repeat-guard/outcomes.ts`: `same_amendment`, `amended`, `amendmentBlocks`, an amendment key namespaced apart from call keys, and RETRY_LATER exempt | Kept | I added the `failed` input, `resultReason` and the `rerunFailed` flag on the outcome, plus their header sentence. |
| `repeat-guard/feedback.ts`: `AMENDMENT_INSTRUCTION` | Kept | I added `FAILED_AMENDMENT_INSTRUCTION`, used when `rerunFailed` is set, and `then.rerunFailed` in the note. |
| Tests in `decision-context/tests/{entry,recorder}.test.ts`, `repeat-guard/tests/outcomes.test.ts`, `evidence-loop/tests/{repeat-guard,rerun-input}.test.ts` | Kept | Nothing was removed. |

New tests (`evidence-loop/tests/repeat-guard.test.ts`; the folder is at its 25-file budget, so I extended this file and trimmed it to 399 lines):
- "never loops": A and B alternate without end (the 0052/0060-0092 shape, never completing), with no stall configured. Expected: `repeat_without_progress`, at most 3 presses, at most 6 decisions.
- "refuses unrun the identical decision whose rerun did not work on this same draft, even after a look moved the page": exactly 1 press, and the note has `then.outcome: same_amendment, rerunFailed: true`. `itemPage` gained a failing `gone` handle and a `look` tool.

Note: Current State names `evidence-loop/tests/rerun-no-change.test.ts`. It does not exist. Those tests are the "a rerun that changed nothing, sent again" block in `repeat-guard.test.ts`.

### (2) Lane B no-op `keep`

`decision-handlers/amendment.ts`: `keepOnly` is true when there is no rerun, nothing applied (or the edits were undone), and every amendment is a `keep` naming a step that was `kept` before the decision. In that case `tell` puts `KEEP_ADDS_NOTHING_INSTRUCTION` at the front of the `core.amendment_check` instruction and sets `keepAddsNothing: true`. The sentence says that keep adds nothing, that a step joins the Flow only by running it, and that an owed act or choice is done by running, on the page that shows its control, the call that does it, with add and act naming it.

The decision already counts as no progress: its non-repeated refusals go to `noProgress.stepped()`, and all-repeated ones go to `RepeatStop`. The test asserts `stepsWithoutProgress: 1`. The shape is decisions 0029/0031/0035: keep 11 act a2.size, keep 10, keep 8, keep 7 act a1.

New test file: `decision-handlers/tests/keep-adds-nothing.test.ts` (6 files in that folder now). It covers the positive case and two negatives: keep beside a drop that landed, and keep of step 9, which does not exist.

Change suggested for r3-d (I did not make it): the keep sentence belongs in `R/llm/draft-amendment-feedback.ts`, as an `onlyKeep` input to `automationStudioLlmEvidenceDraftAmendmentFeedback`. I added it in the handler because that file is r3-d's.

## Commands run and observed results

All tests were run from `packages/fluxiq` with `npx vitest run <exact paths>`.
- Baseline before any edit, on the five required dirs: 44 files and 372 tests passed.
- Fail-first, the lead's fix: I reverted the 10 source files to HEAD and kept the test edits (diff restored byte-identical, checked with `cmp`). `repeat-guard.test.ts`, `entry.test.ts` and `rerun-input.test.ts` then gave 7 failed and 32 passed. Before the fix, the A/B shape resolved `{ ok: true }` (it ran every rerun and completed) rather than stalling.
- Fail-first, my additions, with the new branch disabled:
  - Failed-rerun test: `expected 2 to be 1` (presses).
  - `keepOnly` forced false: `expected { ok: false, …(8) } to match object …`.
- Full revert at the end (all 10 sources at HEAD, final tests): 7 failed and 10 passed, including "never loops" and the keep test. Sources restored byte-identical.
- Final runs, twice, on `R/llm/{evidence-loop,repeat-guard,decision-context,decision-handlers,evidence-progress}/tests`: each gave "Test Files 45 passed (45), Tests 376 passed (376)".
- Extra check: `R/llm/tests`, `R/llm/harness-options/tests`, `R/tests/service-adaptation/tests/judged-reauthor.test.ts`, `R/tests/service-bootstrap/tests/adaptation.test.ts` and `src/ui/activity-action/tests/action-of.test.ts` gave 41 files and 691 tests passed.
- Core root:
  - `node scripts/build-cache/cli.mjs fluxiq:check` exited 0 (it rebuilt, "inputs changed").
  - `node scripts/build-cache/cli.mjs structure-audit:check` exited 0 with "structure-audit: passed (263 warning(s), 349 baselined)". An earlier run showed 264 because `repeat-guard.test.ts` was at 401 lines; I trimmed it to 399.
  - `pnpm.cmd build` exited 0 (fluxiq:build and web:build rebuilt).
- Line endings: my Python edits had left 3 files as LF. I normalised those, plus `rerun-input.ts`, `rerun-input.test.ts` and the new test, to CRLF to match the tree. `git ls-files --eol` now shows every changed file as `w/crlf`, `i/lf`.

## Not verified

- No live run, Lab or provider call (forbidden by the brief). Whether the model reads the keep sentence and the `same_amendment` note as intended is unproven.
- `observedBy` assumes a reproducible rerun reports the same resultCode, effectApplied and whether the page moved. That held for `rerun.14.3`..`.8` in the live run, but a site whose press sometimes moves the page and sometimes does not would read as changed. That errs on the side of letting it run.
- No downstream package checks; the brief lists no downstream change.

## Open questions or contradictions found

- The brief says "must reach the no-progress limit". The loop now stops on the refused-in-a-row limit (3, `MAX_REFUSED_REPEATS_IN_A_ROW`). That counter's `RepeatStop` also steps `stepsWithoutProgress` and ends on `noProgress.reached()` (default 8) when the run is broken up by other decisions. The tests assert the ending code `repeat_without_progress` and the press count, not which of the two counters fired.
- A rerun that changed nothing is the first refusal in its run (`refusedAgain`), even though nothing refused it. It is counted that way on purpose, so A, A, B, B stops at the 4th decision; live, the same pattern ran to the purse.
