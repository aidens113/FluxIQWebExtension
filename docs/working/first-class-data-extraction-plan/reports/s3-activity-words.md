# S3 activity words: the chat's words for page passes

## Outcome

Done. Every task (1), (2), (3) has a fail-first test that failed before the change and passes after.

## What changed and why

All paths are in Core `C:/Users/osrs_/FluxStuff/fxwork/t291/!FluxIQ`, with R = `packages/fluxiq/src/programs/automation-studio/runtime`.

- **New `R/activity/loop/`** (one export per file, with a barrel):
  - `loops.ts`: finds each Flow's do-while loops. A loop's members are the nodes reached from the Repeat's `body` route that can come back to the Repeat. Steps after the loop (reached by `ended` or `done`) are not members.
  - `reads.ts`: says whether a node reads, based on the generic verb its definition id names, using the same table as the wording. A loop whose pass contains a read calls its pass a "page". Any other loop calls it a "pass".
  - `pass.ts`: the pass a node runs as. It is the `pass` output of the loop's last Repeat attempt on `body`, read from the run's attempts, so a resumed run keeps counting.
  - `pass-words.ts`: the step words: "Reading page N" for a read, otherwise "<action> on page N" or "<action> (pass N)". A step with no action gets "Running step N of M on page N".
  - `ended.ts`: says the loop's end once, as a `note` row on the Repeat with `Node: builtin.control.repeat`. "The list ended after N pages" is said when a member succeeds on a route that leads only out of the loop (`ended`). "The loop stopped at its most passes (N pages)" is said when the Repeat leaves on `done`. Loops that read no list say "passes" instead.
  - `words.ts`: `automationStudioActivityLoopWords(flow)` returns `{ passOf, settled }`. It is the single object the executor holds.
  - `types.ts`, `index.ts`.
- `R/activity/step/started.ts`: takes an optional `pass` and applies the pass words to the label and the detail title.
- `R/activity/index.ts`: exports `automationStudioActivityLoopWords` and the type `AutomationStudioActivityLoopPass`.
- `R/executor/graph-run.ts` changes only the activity call sites (+3 lines, now 785 lines):
  - builds `loopWords` beside `stepNumbers`;
  - passes `pass: loopWords.passOf(currentNode.id, attempts)` to `emitAutomationStudioActivityStep`;
  - calls `loopWords.settled(attempt, attempts)` right after the attempt is pushed.
- `R/activity/decision-answer/edit-words.ts`: reads `while` and `most`. A do-while amendment now reads 'made "X" through "Y" repeat while "Y" works', or 'made "Y" repeat while it works' when the span is one step. When `most` is set, it adds ", at most N times". Repeat-over wording is unchanged.
- `R/activity/decision-answer/index.ts`: also exports `automationStudioActivityDraftEditWords`. The structure audit refused the test's direct file import.
- `packages/fluxiq/src/ui/activity-action/action-of.ts`: `CORE_NODE_KINDS` gains `["builtin.control.repeat", "repeat"]`.
- Tests:
  - `R/executor/tests/step-count-activity.test.ts`: new describe "the words a paging loop says". It runs a hand-built do-while Flow through the real executor (no new file; that folder is at 25).
  - `R/activity/tests/decision-words.test.ts`: new describe for do-while edit words.
  - `src/ui/activity-action/tests/action-of.test.ts`: adds the `builtin.control.repeat` case.
  - New `R/activity/loop/tests/loop.test.ts` (6 tests): membership, non-paging "pass" words, "1 page" singular, nothing said for a failed step, a step outside the loop, or a loopless Flow.

**Decision on pass 1:** the read says "Reading page 1". The cards then count up from the first page, so a person sees paging start rather than "Reading the list" turning into "Reading page 2". Other members also say "on page 1" for the same reason. A read step's authored label still travels in `step.label`, but the title becomes "Reading page N". The brief asked for exactly this, and the card's target still shows the label.

## Exact sentences for a 5-page loop

The Flow is: type into Search, Merge, Repeat, read the list, click Next (`ended` on the 5th press), exit Merge, then "Save the rows".

```
Running step 1 of 5: Typing into “Search”
Running step 2 of 5                                      (the Repeat, x5)
Running step 3 of 5: Reading page 1 ... Reading page 5
Running step 4 of 5: Clicking “Next” on page 1 ... on page 5
The list ended after 5 pages                             (once; note row on the Repeat)
Running step 5 of 5: Save the rows
```

With `most: 2` and a Next that never ends, the run reads pages 1 and 2, the Repeat card shows a third time, then "The loop stopped at its most passes (2 pages)", then "Running step 5 of 5: Save the rows".

A check confirms that no said sentence matches `builtin|web\.output|paginate|repeat\b`.

## Commands run and observed results

Fail-first, run from `packages/fluxiq`:

```
npx vitest run <step-count-activity, decision-words, action-of tests> --testTimeout=120000
```

4 failed, 113 passed:

- `action-of`: expected `[ 'repeat', ... ]`, got `[ 'other', '', 'working', '' ]`.
- `decision-words`: expected `... repeat while "Next" works`, got `... repeat over "Search"`.
- `step-count-activity`: both new tests failed. The old run said "Running step 3 of 5: Reading the list" and "Running step 4 of 5: Clicking “Next”" five times each, with no end sentence.

After the change, the same three files gave 117 passed.

Final run, from `packages/fluxiq`, with exactly 41 files: every `tests/*.test.ts` under `R/activity/`, the executor tests `absent-step`, `ask-activity`, `cleared-wait-activity`, `failed-step-reason`, `state-routing-run`, `step-count-activity` and `step-counter`, all of `src/ui/activity-action/tests/`, and `R/flow-bootstrap/authoring/tests/repeat-loop.test.ts`:

- run 1: `Test Files 41 passed (41)`, `Tests 496 passed (496)`
- run 2: `Test Files 41 passed (41)`, `Tests 496 passed (496)`

Core root:

- `node scripts/build-cache/cli.mjs structure-audit:check`: `structure-audit: passed (276 warning(s), 349 baselined).` Before the barrel fix it failed once, on the `decision-words.test.ts` import.
- `node scripts/build-cache/cli.mjs fluxiq:check`: exit 2, with 2 errors, both in files I do not own. These are other workers' edits in progress, and I did not fix them:
  - `R/result-verification/read-account/tests/looped-read.test.ts(112,21)` TS2352
  - `R/result-verification/tests/repair-directive.test.ts(282,38)` TS2379

  An earlier run showed `R/flow-bootstrap/unfinished-build/tests/judged-wrong-rows.test.ts(35,136)` TS2353 instead of the second. No error is in any file I changed.

## Not verified

- No Lab, browser or extension rendering. I did not look at how the extension's chat renders the `note` row titled "The list ended after 5 pages". `activityActionOf` reads it as a `repeat` card with outcome done, because it carries `Node: builtin.control.repeat`.
- The second `attempts.push` in `graph-run.ts` (~line 596, an attempt cleared after recovery) does not call `settled`. A step that leaves the loop on `ended` only after a recovery would not say the end. I left that call site alone to keep the edit to the two named sites.
- Nested loops: membership is "reachable from body and can return to the Repeat". With an inner do-while inside an outer loop, steps after the inner loop can also reach the inner Repeat again through the outer loop. They would then count as inner members and name the inner loop's pass. No test covers this.
- Edit-words for `most` without `while`, which S2's validation refuses, is not handled specially.

## Open questions or contradictions found

- The Repeat node's own card is still a bare "Running step 2 of 5", once per pass plus once at `done`. It runs before it knows whether it starts a pass or ends the loop, so a "Starting page N" title would be wrong on its last arrival. Options are to hide it as the Merge is hidden, or to word it after the attempt. That is a design call for the supervisor.
- `src/ui/activity-action/action-of.ts` is 437 lines. It was already past the 400-line advisory threshold, and this change added 2 lines.
