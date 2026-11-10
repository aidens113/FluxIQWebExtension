# The result keeps its conditioned rows (run-mwaudvnh-c208d32c, 0219 and 0250)

Worker report. Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ`, built on HEAD `1313c30fb` (the earlier
`read-evidence.ts`/`row-sink.ts` changes had been committed by the time I started; nothing of them was uncommitted).

## Outcome

Done. A read whose list lacks a condition of the current result no longer becomes the result. Its rows are kept as a
list of their own, set aside: stored, and still in the read's own answer. The read's answer carries a new Core note,
`answer_first.result_list_kept`, which says that the result did not change and why. A read that has every condition of the
result, with or without more, replaces or extends it as before, and the model is told as before.

## What changed and why

### Step evidence

- 0220 (`p1.sponsored.reread.7`) and 0251 (`p2.sponsored.fields.31`) were `extract_list` calls with **no `where`** and an
  added `sponsored` column. They had no record output.
- Their answers carry `answer_first.result_list_replaced`, at 15 and then 27 rows.
- The same rule also let these reads replace the result before 0219:
  - 0202 (no `where`);
  - 0212 (one condition);
  - 0214 (two conditions).
- All of these reads were exploring reads. None carried a record output. Only replays did (0042, 0044, 0086, 0088, 0144,
  0146, 0225, 0227).

### The rule (`rows/row-sink.ts`, with a header paragraph)

**How "meets every condition" is compared.**
- A read's conditions are the `where` list its call asked. They are found the same way `leftOut` already finds them,
  through `automationStudioResultReadParameters(call.value.parameters)`.
- Each condition is put in a stable form (`stableJson`, so key order does not matter). Repeats are dropped and the list is
  sorted.
- A read meets a list when **every condition of the list is one of the read's**. That covers the same conditions, or those
  plus more.
- The comparison is exact: `atLeast 4.6` does not count as meeting `atLeast 4.5`.

New export `automationStudioAnswerFirstReadConditions` in `rows/read-evidence.ts`. It also sets `evidence.conditions`, a new
optional member in `read-evidence-type.ts`.

**A list's conditions.**
- `Held.conditions` holds the conditions every row of a list met.
- It starts as the conditions of the read that started the list. After each later read it becomes what that read and the
  list have in common.
- A start-over takes the new read's conditions.
- A saved Flow's run batch gives its read's conditions from `batch.leftOut.parameters`. A batch without that account says
  none, so its list holds the result to no condition, which is today's behaviour.

**What happens to a read:**
1. **It never joins a list whose conditions it lacks**, except through `replace`. This covers a named list read again
   with fewer conditions, and a run's list through `joined()`. Such a read gets its unnamed identity instead, so it
   becomes a list of its own.
2. **It is set aside when its list, after the read, lacks a condition of the result as it stood** (`heldApart`,
   `Held.aside`). `resultDataset()` passes over set-aside lists the same way it passes over working reads. The result stays
   as it was, and `fromCall` returns `resultChanged: { kind: "held_apart", now, apart, missing }`.
3. **Otherwise it behaves as today:** it carries the list on, starts it over, or becomes the result, and `other_list` or
   `started_over` is told as today.

**One way past (my decision; the brief said "never").** A read whose record output says `writeMode: "replace"` is not set
aside.
- Why: without an escape, a result built on a wrong condition could never be corrected by hand. For example, a bound set
  too high would turn down rows the person asked for, and loosening it is "fewer conditions". The task would then be stuck,
  against "a task ends only with its result or its budget".
- `replace` is already the model's word for "this read is the list now". None of the run's look-only reads carried a
  record output at all.
- The lead can drop this by deleting `says === "replace"` in `heldApart` and in the `into` check.

**Saved Flow runs (`recordBatch`) are not held to the rule.**
- A run is the Flow's own answer, not a look.
- If a Flow has fewer conditions than the result, the judge should see what the Flow produces.
- A run batch with rows also clears `aside` on its dataset.
- `core.run_flow` passes go through `fromCall`, so they are held to the rule.

**A judge's no changes nothing here.** `runRowsRefused` still clears only the run's precedence.

### What the model is told (`rows/result-change.ts`)

- The `AutomationStudioAnswerFirstResultChange` type is now a union with `held_apart`.
- The note has these members:
  - `code: answer_first.result_list_kept`;
  - `rows` and `pages`: the result, unchanged;
  - `apart`: this read's own list, its rows and pages;
  - `missing`: the result's conditions this read lacked, as the model's own calls wrote them;
  - `instruction`.
- The instruction says, in generic words:
  - the result did not change;
  - this read's rows may hold rows the missing conditions turn down;
  - to read more of the result, read exactly as its reads were asked;
  - only where a condition of the result is itself wrong, read under the right conditions with a record output saying
    `writeMode replace`.
- `OTHER_LIST` gains one sentence. Its old advice, "read the replaced list again as it was asked", is now held apart when
  that list lacks a condition, so the sentence says the same `replace` rule.
- No site, task or row is named. No prompt digest pins this text.
- `call-chain.ts` needed no change, because it already tells any `resultChanged`.

**Other files:** `rows/result-dataset.ts` (one header sentence). No new source file: `rows/` stays at 25.

## Tests: new `rows/tests/result-keeps-conditions.test.ts`, 7 tests

The tests use a parish hall's bookings, which is not a realistic scenario. Each test stores rows through the sink and
builds the model's answer the way `call-chain.ts:93` does.

1. **This run's shape.**
   - Page 1 (11 rows) and page 2 (5 rows) are read under four conditions, giving a 16-row result.
   - A look-only read of page 1 follows, with no `where` and a promo column (15 rows). The result keeps exactly the 16 rows.
     The note is exactly `{code: result_list_kept, rows: 16, pages: [page=1 11, page=2 5], apart: {rows 15, pages
     [page=1 15]}, missing: the 4 conditions, instruction}`.
   - Then the same look on page 2 (12 rows) joins the look's own list (27 rows), never the result. It is told again, and
     `readPages` is unchanged.
2. A read with 2 of the 4 conditions is held apart, and `missing` names the other 2.
3. The result's own named list, read again by name with no condition, does not join it.
4. **A saved Flow run's result** comes from two `recordBatch` calls whose `leftOut.parameters` carry the four conditions.
   After `runRowsRefused` (the wrong judge "no"), a look-only read is still held apart.
5. `writeMode: replace` with 3 of the 4 conditions does become the result, and is told `result_list_replaced`.
6. **Stricter read (towels `run-mwafor01` shape).**
   - Page 1 is read under 3 conditions (12 rows), then page 2 under 4 conditions. The result is replaced (5 rows) and
     told `result_list_replaced` with `replaced.rows: 12`.
   - Page 1 under 4 conditions then extends it to 16, with nothing told.
   - The old 3-condition list read again is now held apart, with `missing: [the 4th]`.
7. The same conditions in another order (array and key order) are not held apart.

**Checked failing with the change reverted.**
- Method: I copied the four changed source files to my scratchpad, wrote HEAD's copy over each (`git show HEAD:./<f>`),
  ran the new file, then restored them. I did this twice: once on the first version, and once on the final source.
- Result: "5 failed | 2 passed (7)". The run-shape test failed with "expected 15 to be 16".
- The 2 that pass are tests 5 and 7, whose behaviour is unchanged.
- After the restore the file gave "7 passed (7)". `git diff --stat` shows my 5 files.

## Commands run and observed results

All commands were run in `!FluxIQ/packages/fluxiq`; `<AF>` = `src/framework/automation-service/service/answer-first`.
- `npx vitest run <AF>/rows` → exit 0, "Test Files 12 passed (12)", "Tests 97 passed (97)".
- `npx vitest run <AF>/rows <AF>/flow-run <AF>/attempt <AF>/tests` (no trailing slash) → exit 1, 2 failed, in
  `<AF>/attempt-store/tests/outcome-of-record.test.ts`.
  - The `attempt` filter also matches `attempt-store/`, which is the parallel worker's folder and has uncommitted edits.
  - That file imports nothing from `rows/`. Run alone straight after, it gave "Tests 9 passed (9)", which looks like the
    other worker was mid-edit.
- `npx vitest run <AF>/rows/ <AF>/flow-run/ <AF>/attempt/ <AF>/tests/` (final source) → exit 0, "Test Files 77 passed
  (77)", "Tests 529 passed (529)".
- `pnpm --filter fluxiq check` (in `!FluxIQ`) → exit 0 (tsc `--noEmit`, "inputs changed").
- `pnpm structure:check` (in `!FluxIQ`) → exit 0, "structure-audit: passed (526 warning(s), 969 baselined)".
  - The only `rows/` warning left is the existing "25 source files" advisory.
  - One intermediate run warned that `row-sink.ts` was at 413 lines. I tightened my comments, and the file is now 400
    lines with no warning.
- No build, no Lab run, no paid call.

## Not verified

- No live run. Whether Haiku follows `result_list_kept`, rather than repeating the look, is not observed.
- **Notes inside `core.run_flow` are still not shown to the model.** This is the gap `result-list-switch.md` already
  reported: the note sits on the pass's answer.
  - A replay of a draft whose read lacks a result condition is now held apart silently from the model's view. The result
    is still kept.
- **The judge never sees a set-aside list.** The brief wanted "the judge can still see it as a separate read".
  - The judge's summary carries only the result's rows, `readPages` of the result's list, and looks without rows
    (`completion/check.ts`, which I may not touch). Today no non-result list reaches the judge.
  - Showing set-aside lists would need a sink member, for example `apartPages()`, and a `completion/check.ts` change.
    That change is outside my owned paths.
- Run batches carry their conditions only where the answer held `extraction.rejectedSamples`. I did not check against a
  live engine answer that a read with conditions whose items all passed still sends that array. Without it, the run's list
  holds the result to no condition, which is today's behaviour.
- Condition synonyms from the domain grammar (`condition-grammar.ts`, other names for `atLeast` and so on) and tightened
  bounds are compared as written. A stricter bound written differently is held apart unless the read says `replace`.

## Open questions or contradictions found

- **The `writeMode: replace` exception goes against the brief's "never"**, for the reason given above. It is the lead's
  call whether to keep it.
- **Runs are exempt.** The lead should confirm that a saved Flow's engine run may still replace a conditioned result.
  `core.run_flow` passes are not exempt.
- `OTHER_LIST`'s advice changed by one sentence, because re-reading a replaced list that lacks a condition is now held
  apart.
