# Report: s2-words (read-list redesign S2, what the model is taught)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ`, branch `task/t283-read-list-s2-loop`. No commits.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. The schema now declares `while` and `most`. Both draft tellings, the routing line and the dry-run words now
describe the do-while in generic words. "Goes on the act, never on the listing" now applies only to a repeat over a
listing. The fail-first tests failed before the change and pass after it. Every pinned test I found passes, and the
seven-step answerability draft measures 4,992 of its 5,000 bytes.

## What changed and why

### `R/flow-draft/amendment/schema.ts` (bytes are source bytes)

- New property `while` (+187): `{ type: "integer", minimum: 1, description: "repeat only, never with over: the span's
  last step; the span runs, then again while that step succeeds; through defaults to it." }`.
- New property `most` (+125): `{ type: "integer", minimum: 1, maximum: 500, description: "repeat with while only: the
  most passes, default 50." }`.
- `change`, repeat clause (+52).
  - Before: "repeat: do this step, through the one given by through, once for each row the step given by over
    produced, or while that step keeps succeeding."
  - After: "... or while that step keeps succeeding, or, with while, again while its last step succeeds."
- `change`, the reconciled rule (+13).
  - Before: "The repeat goes on the act, never on the listing itself; each pass acts on its own row."
  - After: "A repeat over a listing goes on the act, never on the listing itself; each pass acts on its own row."
- `change`, new sentence after "Drop any other step that does the same act to a single row." (+201): "To go through a
  list that continues -- the step that reads it, then the step that moves it on -- repeat on the read with while naming
  that step: each pass reads once, and the Flow keeps each row once."

### `R/flow-draft/entry.ts`

**`routingLine`.** It imports `automationStudioFlowDraftRepeatIsWhile` from `./routing.ts`. A do-while now reads
`repeats through step N while it succeeds`, plus `, at most M passes` when `most` is present. The over form keeps its
line, and the type narrowing on that line should clear the fluxiq:check error at old line 274. I did not run the
check (see Not verified).

**`DRAFT_INSTRUCTION` (transcript telling), +97.** This telling has no byte budget.
- Before: "... then put repeat on that act with over the listing step: the repeat goes on the act, never on the
  listing, and the Flow does the rest, so never act on the others yourself."
- After: "... then put repeat on that act with over the listing: a repeat over a listing goes on the act, never on the
  listing, so never act on the others yourself. A list that continues: repeat on the read with while naming the step
  that moves it on; the Flow keeps each row once."
- To keep the addition short, I dropped "step" after "the listing" and the clause "and the Flow does the rest". No
  test pinned either.

**`AUTHORED_INSTRUCTION` (authored telling), +64.** The answerability budget measures this telling.
- Before: "The repeat goes on the press, never on the listing, and a listing that already keeps the right rows is not
  run again. For an act with a lasting effect on the items a loop keeps, write it rather than doing it to one real
  item, so the build changes nothing the Flow should not."
- After: "A repeat over a listing goes on the press, never on it, and a listing that already keeps the right rows is
  not run again. A list that continues: repeat on the read with while the step that moves it on; the Flow keeps each
  row once. For an act with a lasting effect on the items a loop keeps, write it rather than doing it to one real
  item."
- To fit the 5,000-byte budget, I dropped the explanatory clause ", so the build changes nothing the Flow should not"
  (unpinned). I also shortened "never on the listing" to "never on it".
- The "second copy" rule is unchanged: with the do-while shape it no longer conflicts (design (g)).

### `R/flow-draft/dry-run.ts`, the repeat sentence (+111)

- Before: "... or, over a check, once each time the check held. passes says ..."
- After: "... or, over a check, once each time the check held, or, with while, once per pass, until its last step
  answered that it ended or the loop reached its most passes. passes says ..."

### `R/flow-draft/excused.ts`

Unchanged. Its `repeat` reason ("once per row of what it repeats over, or while a check holds") is still true. Under
C1 another worker stops excusing do-while members, so this reason is never given for them.

### Tests

**Fail-first tests**
- `R/flow-draft/amendment/tests/apply.test.ts`, new describe "the do-while repeat the schema teaches":
  - it checks the bounds of `while` (an integer, minimum 1, no maximum) and of `most` (an integer, 1 to 500);
  - it checks the new sentences in the `change` description;
  - it checks that the new words contain none of "page", "Next", "pagination" or "scroll".
- `R/flow-draft/tests/entry.test.ts`, new describe "a repeat that runs while its last step succeeds, in the draft
  entry":
  - it checks the exact `runs` line with and without `most`;
  - it checks the continuing-list words in both tellings.

**Pins updated by hand.** The test is itself the pin, and no regeneration script exists for any of these.
- `apply.test.ts`: "The repeat goes on the act, never on the listing itself" became "A repeat over a listing goes on
  the act, never on the listing itself".
- `entry.test.ts`: "The repeat goes on the press, never on the listing" became "A repeat over a listing goes on the
  press, never on it".
- `entry.test.ts`: "the repeat goes on the act, never on the listing" became "a repeat over a listing goes on the
  act, never on the listing".

**Assertion added.** `R/flow-draft/tests/dry-run.test.ts` now also asserts the do-while pass words (in the t252
test).

**Budget left unchanged.** `R/tests/deepseek-bootstrap/tests/answerability.test.ts` still holds the draft to 5,000
bytes. I fit the words to that budget and did not raise it.

## Commands run and observed results

All runs were from `.../!FluxIQ/packages/fluxiq`.

- **Baseline.**
  - Command: `npx vitest run` on `R/flow-draft/tests/entry.test.ts`, `R/flow-draft/tests/dry-run.test.ts`,
    `R/flow-draft/amendment/tests/apply.test.ts` and `R/tests/deepseek-bootstrap/tests/answerability.test.ts`.
  - Result: "Test Files 4 passed (4); Tests 108 passed (108)".
  - A temporary log line, since reverted, measured the answerability draft at
    `{"bytes":4928,"budget":5000,"steps":7,...}`.
- **Fail-first.**
  - Command: `npx vitest run` on the entry and apply tests.
  - Result: my four new tests failed, for example `Expected: "repeats through step 2 while it succeeds" Received:
    "repeats through step 2, over step a step no longer in the draft"`, `expected undefined to match object { type:
    'integer', minimum: 1 }`, and the authored instruction not containing "list that continues".
  - A fifth failure in the same run was "binding a step's arguments > refuses a row field inside a span that repeats
    while its last step succeeds". That test belongs to another worker (bind.ts), and it passed in later runs.
- **First full draft.** answerability failed with `"overBudget": true` at 5,114 bytes. I shortened the authored
  words and re-measured 4,992 bytes, `overBudget: false`. The temporary log line is reverted: `git diff --stat` on
  that file is empty.
- **Final run.**
  - Command: `npx vitest run` on the same four files.
  - Result: "Test Files 4 passed (4); Tests 113 passed (113)".
- **Broad run.**
  - Command: `npx vitest run` on the following:
    - `R/llm/harness/tests/run-size.test.ts`;
    - `R/llm/harness/tests/whole-context.test.ts`;
    - `R/llm/tests/context-window.test.ts`;
    - `R/llm/tests/provider-cache-prefix.test.ts`;
    - `R/llm/tests/evidence-loop.test.ts`;
    - `R/llm/deepseek/tests/request-body.test.ts`;
    - `R/llm/evidence-loop/tests/draft-shown.test.ts`;
    - `R/llm/tests/evidence-loop-draft-shown.test.ts`;
    - `R/tests/deepseek-recovery-requests.test.ts`;
    - `R/llm/evidence-loop/tests/rerun-input.test.ts`;
    - `R/flow-bootstrap/tests/evidence-loop-steps.test.ts`;
    - `R/llm/tests/draft-amendment-feedback.test.ts`;
    - `R/activity/tests/decision-words.test.ts`;
    - the directories `R/flow-bootstrap/unfinished-build/tests`, `R/tests/deepseek-bootstrap/tests` and
      `R/llm/decision-context/tests`.
  - Result: "Test Files 47 passed (47); Tests 483 passed (483)".

## Not verified

- I ran no typecheck (fluxiq:check, as the brief directs), so the `routingLine` narrowing and the fix for the error
  at :274 are reasoned but not compiled. vitest does not typecheck.
- I ran no structure audit, build, Lab or provider call.
- I did not run the whole package suite, only the files listed above.

## Open questions or contradictions found

- The answerability draft now has 8 bytes of headroom (4,992 of 5,000). Any further word in `AUTHORED_INSTRUCTION`
  will need an equal cut.
- `amendment/tests/apply.test.ts` is shared with the bind.ts worker, who also added a test to it. My addition is the
  appended describe block plus one pin line at about :180.
- `docs/reference/framework-reference.md:195` cites `schema.ts:12`. That line is unchanged.
- The `over` property's description still ends "Leave it out for the step before it". Read literally, that could
  suggest a default `over` when `while` is given. I left it alone, because the `while` description says "never with
  over" and `readAmendment` (C2) rejects the pair.
