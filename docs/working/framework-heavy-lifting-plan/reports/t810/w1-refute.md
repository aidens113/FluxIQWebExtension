# Report: t810/w1-refute (worker-heavy)

Core tree `fxwork/t810/!FluxIQ`, RV = `packages/fluxiq/src/programs/automation-studio/runtime/result-verification`.
Nothing committed.

## Outcome

Partial. The change is complete, and `pnpm check` exit 0. The RV test run has 3 failures, all in
`RV/tests/reask-route/tests/lone-yes-route.test.ts`, which is outside my ownership. Those tests pin the old outcome for
exactly the shape this task changes. A one-argument fix is given under "Open questions", item 1, and was verified by a
probe.

A no whose every defect row Core's record of that row refutes is no longer left `unverified`:

- It is re-asked once with Core's evidence, the rows reversed, and the converse question.
- If every call's latest answer is then a wholly refuted no, or a yes whose citations are not refuted, the verdict is
  `answers`. The code is `noRefutedByRecord` when no yes came; otherwise it is the yes's own code. `refutedRows` is
  recorded either way.

## What changed and why

### Refutation (RV/located-defects/)

- `row-refuted.ts` (new) holds `automationStudioResultDefectRowRefuted`, the rule. It applies to `asked_missing` and
  `kept_not_asked` defects only.
  - `outside_mark`. All of the following hold:
    - the defect is `asked_missing`;
    - the row is a left-out row, not a stored one;
    - every record of the row Core holds carries an `outside` mark;
    - the defect's `requestWords` pass the own-set guard.

    The quote is `"<said>"` plus ` for "<entity>"` when an entity is present.
  - The own-set guard is private and documented in the file header. It requires a first-person word (i, me, my, mine,
    myself, we, us, our, ours, ourselves; an apostrophe counts as a word break, so "I'm" counts) and no negation (not,
    no, never, none, nor, neither, without, except, excluding, unless, cannot, or any `n't`).
  - `cell_differs`. The defect gives a column and a value. Every candidate record has a cell in that column, and that
    cell:
    - is not empty;
    - after normalising, is not equal to the value, does not contain it, and is not contained by it.

    Candidates are left-out records for `asked_missing` and stored rows for `kept_not_asked`. Column resolution is the
    same as `askedCellNotFound` (exact match, else a unique near match). Containment ignores length, so it is
    conservative toward not refuting. The quote is `column: "cell"`.
  - The finding wording for `cell_differs` is the same as the existing `askedCellNotFound` sentence ("Core's record of X
    holds "c" in "col", not "v"."). The existing t771 test pins that wording.
- `row-cells.ts`:
  - Adds `AutomationStudioResultLeftOutRowRecord` (`{cells, marks}`) and `automationStudioResultLeftOutRowRecords`. These
    read a condition's `leftOutMarks` and a together set's `marks`, aligned with the rows.
  - `automationStudioResultLeftOutRowCells` is now derived from the records, so its behaviour is unchanged.
  - A row's marks stay with its cells, so when rows that share a label are told apart by their cells ("Marcus Reid —
    ..., posted: ..."), each keeps its own marks.
- `located-defects.ts`:
  - `rowsNamed` and `named` now carry records.
  - `notFound` checks the refutation right after the row is found (after the request-words check, before the
    kind-specific checks).
  - `automationStudioResultDefectsLocated` returns an optional `refuted: [{defect, evidence, quote}]`. It is absent when
    empty so existing `toEqual` tests and callers stay unchanged. A refuted defect is never located; its finding goes
    into `findings`.
  - A row named with a contradicted value is still found by its other cells through the existing `told` filter (the
    Marcus Reid shape). The test covers this.
- `index.ts`: header paragraph, plus the export of `row-refuted.ts`.

### Recheck (RV/refuted-no/)

- `refuted-rows-recheck.ts` (new) holds `automationStudioResultRefutedRowsRecheck(rows)`.
- The recheck starts with Core's generic words: the converse ("start from those rows, not from the request"), and that
  an item offering the person entry to a set is one the person is not in. These words contain no social, group or join
  vocabulary; a test asserts this.
- After the marker `Core's record of those rows:` comes one line per row, in the reverse of the no's order.
- `index.ts` exports it and has a header line.

### Re-ask and outcome (RV/agreement/unsupported-no.ts)

This extends the t752 stage. It is not a parallel path.

- `supportOf` also returns `refuted` and `wholly`. `wholly` means at least one defect, and every defect refuted; it is
  never true for a no with an unlocated, unrefuted defect.
- In the re-ask loop, a no that is wholly refuted gets the row recheck instead of the generic recheck, and its call is
  marked `rowAsked`.
- Refuted rows from every no weighed, before and after the re-ask, are collected into `refutedRows`, deduped by
  call, row, kind and evidence.
- `byRowRecord` runs after the loop, only when some call was `rowAsked`:
  1. If any re-ask came back unusable, it returns undefined and the existing rules apply ("as today"; the outcome is
     unsure in the tests).
  2. If any re-ask is a citation-refuted yes, the outcome is unsure, `model_unconfirmed`, `yesCitationRefuted`, and
     carries `yesCitations` and `refutedRows`. A citation-refuted yes is either code `yesCitationRefuted` or verdict
     `answers` with a non-empty `yesCitations.refuted`. Both are handled because the verdict reader's side belongs to
     another worker.
  3. If every call's latest answer is a usable model yes or a wholly refuted model no, the outcome is `answers`:
     - with a usable yes (a re-asked yes is preferred), it is that yes with `verdicts`, `calls` and `refutedRows`;
     - with no yes, it is a new verification: `answers`, basis `model`, `noRefutedByRecord`, Core's reason,
       `refutedRows`.
  4. Otherwise it returns undefined and the existing weighing applies. A re-ask no with a located, unrefuted defect
     stands. An unsupported no goes to `refutationUnsupported` or the lone-yes confirm, as before.
- Gates are unchanged:
  - A double no, or a split, as t752 already gated them.
  - Any supported no at the start means nothing is asked.
  - t607's `refutationContradicted` outcome never reaches this stage, because the gate refuses it.
- Header docs are in `unsupported-no.ts` and `agreement/index.ts`.

### verify.ts

- A header paragraph only. No code change was needed:
  - the re-ask goes through the existing `ask` (purse and `verificationReask` mark);
  - `held()` stays outermost;
  - a failing computed fact still returns before any judge.

### Decisions to note

- **Placement.** `agreement/` was at 25 files (the limit), so the outcome lives in `unsupported-no.ts`, now 327 lines.
  `refuted-no/` is now at 25. `located-defects/` is at 13.
- **`standingNo`.** It is not carried on an `answers` reached this way, because no no stood. A gate that keeps a build's
  trials therefore gets no standing-no record from it.
- **No confirming ask.** A split's original yes beside a wholly refuted re-asked no is answers directly. The t771
  lone-yes confirming ask is not made, because Core holds positive evidence against the no.
- **Concern not carried.** A refuted no's concern is not carried as the yes's advice, unlike t752's "concern" carry.

## Commands run and observed results

- `pnpm exec vitest run .../located-defects`, after one fix round: "Tests 52 passed (52)".
  - The first run had 7 failures. Four were caused by the new `refuted: []` breaking existing `toEqual`, fixed by making
    the field absent when empty. One was the t771 finding wording, fixed by reusing it. Two were my own expectations: a
    row that is not refuted is located as before in this fixture.
- `pnpm exec vitest run .../tests/reask-route/tests/refuted-rows-route.test.ts`: "Tests 10 passed (10)".
- `pnpm exec vitest run .../agreement/tests/refuted-rows.test.ts .../refuted-no/tests/refuted-rows-recheck.test.ts`:
  "Tests 7 passed (7)".
- **Fail-first.** I disabled the row path in `unsupported-no.ts` (two `false as boolean` swaps), ran the route test,
  then restored the file and confirmed it by `diff` ("restored-identical"). Result: "2 failed | 8 passed". The failures
  were (a) "same no again ... answers" and (b) "re-ask's yes beside a no still wholly refuted".
- `L=.../heavy-check.lock; until mkdir $L ...; pnpm check; rmdir $L`, run from `packages/fluxiq`: exit 0.
  - Output: `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; ...","ms":62414}`,
    then `exit=0`.
  - The run waited on the lock about 60 minutes behind t804's e2e runs.
- `pnpm test src/programs/automation-studio/runtime/result-verification`, under the lock: exit 1.
  - Main group: "Test Files 1 failed | 189 passed (190)", "Tests 3 failed | 1440 passed (1443)".
  - Second group: "Test Files 1 passed (1)", "Tests 3 passed (3)".
  - The 3 failures are all in `tests/reask-route/tests/lone-yes-route.test.ts` (t771):
    - "a lone yes beside nos Core refused every one of > is asked once more, and a second yes stands as yes". The
      confirming ask count is 0, not 1; the verdict is still answers.
    - "... > stays unsure where the confirming ask does not say yes ...". The outcome is now answers.
    - "a double no Core refused every defect of > is unsure, asks no confirming call ...". The outcome is now answers
      (`noRefutedByRecord`).
  - Cause: the t771 fixture (`located-defects/tests/club-notices-fixture.ts`, `INVENTED_CLUB_NO`) is the Marcus Reid
    shape. The no names "Ann Lee — Chess Club, 6 March 2027" with club "Chess Club", but the row's own `club` cell is
    "Ann Lee". `cell_differs` now refutes it, so the no is wholly refuted and takes the new path. This is the behaviour
    the brief asks for.
- **Probe (deleted afterwards).** I copied `lone-yes-route.test.ts` to a temporary
  `t810-w1-lone-yes-probe.test.ts` with only `noticeRunSummary()` changed to `noticeRunSummary("")`. An empty club cell
  leaves the no unsupported but not refuted, so it still exercises t771's lone-yes mechanism. Result: "Tests 3 passed
  (3)". The probe file was then removed.
- I added the t771 shape with the new outcome to my own route test, "answers t771's double no over a row given a club
  its own cell does not hold". `refuted-rows-route.test.ts` then gave "Tests 11 passed (11)". This last test edit was
  not covered by the `pnpm check` run (vitest does not typecheck). It uses only already-typed imports.

## Not verified

- **The cited-yes worker's verdict reader.** It is not exercised end to end. Its state is handled both ways through a
  stub `ask` (`agreement/tests/refuted-rows.test.ts`).
- **The client's real marks.** No real `leftOutMarks` from the client were used. The fixture is hand-built in the
  contract's shape.
- **A replay of run-mvud43a2.** I did not replay the real judge replies. The fixture mirrors the case's shape.
- **The 0065/0066 re-ask shape.** Three outside-marked rows plus a `wrong_value` on a left-out row. The `wrong_value`
  defect is neither located ("is no row the result holds") nor refutable by either kind, so that no is not wholly
  refuted, and the outcome would be the existing `refutationUnsupported` unsure. See the open questions.
- No model calls and no live runs.
- The structure audit was not run.

## Open questions or contradictions found

0. **The t771 lone-yes tests pin the superseded outcome (blocking the clean RV run).** These are in
   `RV/tests/reask-route/tests/lone-yes-route.test.ts`, which I may not edit. The suggested fix is one argument at
   line 44: `summary: noticeRunSummary()` becomes `summary: noticeRunSummary("")`.
   - This keeps t771's lone-yes mechanism under test, now on a no that is unsupported but not refuted. The probe passed
     3/3.
   - Update its header to say the invented-club shape is now refuted by the row's cell (t810), and covered by
     `refuted-rows-route.test.ts`.
   - Alternatively, the lead can give me that file.
1. **A `wrong_value` on a row the result does not hold.** In the case's re-asks (0065/0066), the judges recast the
   Marcus Reid claim as `wrong_value` on a left-out row. Core's record already says that row is not in the result, but
   the contract's `refutedRows.kind` is only `asked_missing | kept_not_asked`, and the evidence is only `outside_mark |
   cell_differs`. If the lead wants such a no to count as wholly refuted, the contract needs a kind, for example
   `wrong_value` with evidence `not_kept`.
2. **`standingNo` on a `noRefutedByRecord` answers.** It is deliberately not carried. Please confirm the trial-keeping
   gate should see none.
3. **Basis `model` for `noRefutedByRecord`.** No model said yes; Core judged that no no stands. `core_observation` was
   the alternative. I chose `model` because models were asked and their objections were refuted.

## Doc notes for llm-flow-bootstrap.md (for the lead to apply)

Under "Computed-first judging" / P5b, after the t752 "no naming no defect Core can find" paragraph:

> **A no naming only rows Core's record of each refutes does not stand (t810).** Core refutes a defect row by its own
> record of that row: an `asked_missing` left-out row every record of which carries the client's `outside` mark (an item
> that offered the person entry to a set, so the person is not in it), when the defect quotes first-person request words
> that negate nothing (`outside_mark`); or a row whose own cell in the named column is not empty and neither is, holds,
> nor is held by the value claimed (`cell_differs`). A refuted defect is never located
> (`result-verification/located-defects/row-refuted.ts`). In the t752 re-ask, a no whose every defect is refuted is asked
> once with Core's evidence for each row, the rows reversed and the converse question
> (`refuted-no/refuted-rows-recheck.ts`), never the generic recheck. Then, if every call's latest answer is a wholly
> refuted no or a yes citing nothing Core refutes, the verdict is `answers`: the yes's own, or
> `core.result.no_refuted_by_record` when no yes came. Either way the rows are recorded as `refutedRows`. A re-ask yes
> citing a cell Core refutes is unsure (`core.result.yes_citation_refuted`). A re-ask no naming a defect Core finds, or a
> re-ask that did not come back usable, is weighed as before. A computed fact that fails stays a Core no, and the
> requested-output hold stays last.

## Follow-up

The supervisor's follow-up had three items: implement `not_kept` with the extended contract, confirm their fix to
`lone-yes-route.test.ts` line 44, and re-run against W3's real verdict reader.

### What changed

- **`located-defects/row-refuted.ts`** adds the `not_kept` evidence. It applies to a `wrong_value` or `kept_not_asked`
  defect, a claim about a kept row, whose row Core finds only as a row a read left out (no stored row).
  - The quote is `left out by condition N (wording)`. For rows left out together it is
    `left out by conditions N and M together`.
  - The finding keeps the old prefix: `"<row>" is no row the result holds: a read saw it, and it was left out, by
    condition N (...), so no claim about a kept row holds of it.`
  - A `wrong_value` on a stored row is still never refuted by its row.
- **`located-defects/row-cells.ts`**:
  - Each left-out record carries `leftBy`, the condition that left it out, named as every line names it, or
    "conditions N and M together".
  - A record is now kept for every left-out row of a read account, even one with no cells and no marks, so `not_kept`
    can quote its condition.
  - `automationStudioResultLeftOutRowCells` and `cellsOf` still filter to non-empty cells.
- **`refuted-no/refuted-rows-recheck.ts`** gives `not_kept` its own line: `- "<row>": the result does not hold it; it
  was left out by condition N (...).`
- **`agreement/unsupported-no.ts`**:
  - `recordRows` now records `wrong_value` too.
  - `wholly` already counted every refuted defect, so a no with 3 `outside_mark` `asked_missing` rows and 1 `not_kept`
    `wrong_value` row is wholly refuted. Tested.
  - The reason text and the header now name the `not_kept` kind.
- **`located-defects/index.ts`**: one header line for `not_kept`.
- **Tests**:
  - `row-refuted.test.ts` adds a `not_kept` case for both kinds.
  - `circle-board-fixture.ts` adds `RECAST_NO`, the 0065/0066 shape: two outside-marked rows called missing by
    `access`, and a `wrong_value` on the member's own note. It also adds `citingYes(author)`.
  - `refuted-rows-route.test.ts` adds four cases:
    - `RECAST_NO` on every call gives `answers` with `noRefutedByRecord`, and `refutedRows` holds a `not_kept`
      `wrong_value` row;
    - first `REFUTED_NO`, then `RECAST_NO` on the re-ask, gives `answers`;
    - through the real reader, a re-ask yes whose `checked` cites stored cells Core holds gives `answers`, code
      `answers`, `yesCitations {cited: 2, refuted: []}`;
    - through the real reader, a re-ask yes citing `Poetry Circle / author / Ann Lee` (the stored cell is Dana Ortiz)
      gives unsure, `model_unconfirmed`, `yesCitationRefuted`, one refuted citation, and does not fail the run.
- I made no change to `lone-yes-route.test.ts`; the supervisor's line-44 fix is in place.

### Commands run and observed results

- `pnpm exec vitest run` over the route test, `located-defects/`, the recheck test and the agreement test: "Test Files
  12 passed (12)", "Tests 75 passed (75)".
- `pnpm check`, run from `packages/fluxiq` under the lock at 23:25: exit 0. This was a cache reuse:
  `{"build-cache":"reuse","step":"fluxiq:check","reason":"inputs and outputs match the stamp","ms":515,"source":"stamp"}`.
  Some earlier run had already type-checked these same inputs (all my edits included) and passed. It was not a fresh
  `tsc` run started by me.
- `pnpm test src/programs/automation-studio/runtime/result-verification`, a separate statement under the same lock:
  exit 0, with W3's real reader and no stub.
  - Main group: "Test Files 191 passed (191)", "Tests 1451 passed (1451)".
  - Second group: "Test Files 1 passed (1)", "Tests 3 passed (3)".
  - The three t771 `lone-yes-route` failures from the first round now pass with the supervisor's line-44 fix.

### Not verified (follow-up)

- No replay of run-mvud43a2's real 0063 to 0066 replies; I used fixtures of that shape.
- No real client `leftOutMarks`.
- No structure audit, no model calls, no live run.

### Notes

- **`not_kept` wording.** The quote names the condition as Core's account words it, e.g. `left out by condition 1
  (access startsWith ["For members of"])`. A row named both alone and together quotes both, joined by " or ".
- **Records with no cells.** Every left-out row of a read account now yields a record. This can only add `not_kept`
  refutations: `outside_mark` needs a mark on every record, and `cell_differs` reads only non-empty cells. The full RV
  run confirms no other outcome moved.

Outcome: Done
Changed: RV/located-defects/row-refuted.ts, RV/located-defects/row-cells.ts, RV/located-defects/located-defects.ts, RV/located-defects/index.ts, RV/refuted-no/refuted-rows-recheck.ts, RV/refuted-no/index.ts, RV/agreement/unsupported-no.ts, RV/agreement/index.ts, RV/verify.ts (header); tests RV/located-defects/tests/{circle-board-fixture.ts,row-refuted.test.ts}, RV/refuted-no/tests/refuted-rows-recheck.test.ts, RV/agreement/tests/refuted-rows.test.ts, RV/tests/reask-route/tests/refuted-rows-route.test.ts
Validation: `pnpm check` -> exit 0 (build-cache reuse, "inputs and outputs match the stamp"); `pnpm test src/programs/automation-studio/runtime/result-verification` -> exit 0, "Tests 1451 passed (1451)" + "Tests 3 passed (3)"
Not verified: replay of run-mvud43a2's real replies; real client marks; structure audit; no model calls
Report: C:/Users/osrs_/FluxStuff/fxwork/t810/!FluxIQWebExtension/docs/working/framework-heavy-lifting-plan/reports/t810/w1-refute.md
Notes: not_kept covers the 0065/0066 re-ask shape. With 3 outside_mark rows and 1 not_kept wrong_value, the no is wholly refuted and the verdict is answers (`noRefutedByRecord`).
A re-ask yes through the real reader: citing cells Core holds gives answers; citing a cell Core does not hold gives unsure `yesCitationRefuted`.
standingNo is not carried on noRefutedByRecord answers.

## Follow-up 2 (stopped)

The supervisor stopped the work. Every run of mine had finished before the stop, and my command removed the
heavy-check lock it created. The lock present afterwards belongs to someone else and was left alone. Files are left as
they are.

### Cause: found, and it is the replay harness, not the marks or the row lookup

The supervisor's suspicions were checked and ruled out:

- **Rows and marks are found.** My probe (`SCR/w1-probe/probe.mts`) builds the summary and injects the marks exactly as
  `replay.mts` does.
  - For 0055 and for 0056, Core finds both Rosa Delgado and Idris Bello, named "label — group — date".
  - Each has one record, carrying its cells, the "Join group" mark and `leftBy` condition 3.
  - `refuted` lists both rows as `outside_mark`. Nothing is located. Both nos are wholly refuted.
- **No second read account.** The summary has one read account. The block at lines ~227-242 of `request.txt` is the
  record set's `processing.conditions`, whose `leftOutOnlyByThis` lists are all empty.

The actual cause is in how W5's harness serves replies:

- **The trace.** My trace (`SCR/w1-probe/trace.mts`) runs `verify`, prints every recheck, and serves recorded replies in
  step order.
  - It shows the row path does run: calls 3 to 5 carry the new row recheck.
  - `replay.mts` matches a re-ask to a recorded reply by its first 60 characters. My row recheck and the t752 generic
    recheck share those 60 characters ("This same evidence was judged before, and that answer said the result "). So
    the harness served 0057, 0058 and 0059, which in the real run answered the t752 recheck, to a question they never
    saw.
- **What those replies did.**
  - 0057's yes was read as held (unsure) and 0058 answered its follow-up.
  - 0059 is a no that adds two Kettle & Crumb rows quoting "on or after Saturday 19 September 2026". That quote has no
    first person, so the guard correctly does not refute them.
  - The outcome therefore fell to the existing rule: unsure, `refutation_unsupported`.
- **With a true repeat.** Serving 0055 and 0056 again to the re-asks gives `answers model
  core.result.no_refuted_by_record`, with `refutedRows` holding both rows as `outside_mark`.
- **Fix for the harness, not Core.** Treat a recheck containing "because of the rows it named" as unrecorded, and serve
  it with `--reask=repeat`, or match on a longer prefix. I did not edit W5's files.

### What I changed

1. **`refutedRows` stays on every outcome reached after a row re-ask** (`agreement/unsupported-no.ts`, `rowsKept`).
   Before, the existing-rule outcomes dropped it, which is why W5 saw `refutedRows: null` and could not tell whether the
   path had run.
2. **The supervisor's principle, in its safe form** (`located-defects/row-refuted.ts`, `row-cells.ts`).
   - Records now carry `marksRead` (whether the read sent a marks list at all).
   - An unmarked record whose read sent no marks, and whose cells equal a marked record's, is the same item seen by
     another read, so it no longer blocks `outside_mark`.
   - A record the client read and found no offer on (a `null` inside a marks list) still blocks. So does an unmarked
     record that may be another item.
   - I did not adopt the general form ("a record the client could not mark never blocks"). The marks reader
     (`left-out-cells/left-out-marks.ts`) leaves the list out entirely when no row on a read has a mark, so a missing
     list can also mean "read, no offer".
   - This was not the cause in mvswewhy.
3. **Tests.**
   - `row-refuted.test.ts`: the same item by cells from a second read with no marks is refuted; an unmarked record with
     other cells is not.
   - `refuted-rows-route.test.ts`:
     - a held re-ask yes leaves the outcome unsure, with `refutedRows` kept;
     - the "no stands" case keeps `refutedRows`.

### What I ran and saw

- `pnpm exec vitest run` over `refuted-rows-route.test.ts` and `located-defects/`, before the lock: "Test Files 10
  passed (10)", "Tests 71 passed (71)".
- Under the lock, as separate statements, from `packages/fluxiq`, starting 03:06:
  - **`pnpm check`: exit 1.** It was a fresh build, not a cache reuse
    (`{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; the command failed with exit code 1 ..."}`). The
    error is in my new test:
    `located-defects/tests/row-refuted.test.ts(70,78): error TS2375: ... condition: string | undefined ... not
    assignable to type 'AutomationStudioResultReadCondition' with 'exactOptionalPropertyTypes: true'`.
    - The fix is one line in `secondRead`: write `condition: first.conditions![0]!.condition!`.
    - It is not applied, because of the stop. Production code is not implicated: the error is in test code only.
  - **`pnpm test src/programs/automation-studio/runtime/result-verification`: exit 0.** "Test Files 191 passed (191)",
    "Tests 1454 passed (1454)"; second group "Test Files 1 passed (1)", "Tests 3 passed (3)". Vitest does not typecheck.
  - **Replay of mvswewhy 0055** (`--reask=repeat --marks=marks-social-real.json --only=0055`): exit 0.
    - `refutedRows:` both rows as `outside_mark` (Rosa Delgado, Idris Bello).
    - `outcome: verdict=unsure basis=model_unconfirmed code=core.result.refutation_unsupported`
    - Calls 3 to 5 were served `same-kind(wording differs)` from 0057 (yes), 0058 (yes) and 0059 (no). This is the
      harness artefact above.
  - **Replay of mvud43a2 0063** (same flags, `--only=0063`): exit 0.
    - `refutedRows:` Marcus Reid as `cell_differs` (`group: "Marcus Reid"`); Rosa Delgado as `outside_mark`; and the
      others.
    - `outcome: verdict=answers basis=model code=core.result.no_refuted_by_record`
    - Calls 3 and 4 were served from 0065 (no) and 0066 (no). Those are the real re-asks, including the `not_kept`
      wrong value.
- **Probe-only runs**, using W5's replay files read-only and Core's modules: `probe.mts` for 0055 and 0056, and
  `trace.mts` for 0055,0056,0057,0058,0059 and for 0055,0056,0055,0056. Results are above.

### Left behind

- **Stray files in W5's directory.** The replay writes its JSON next to `replay.mts`, so
  `replay-mvswewhy-reask-repeat-marks-w1probe2.json` and `replay-mvud43a2-reask-repeat-marks-w1probe2.json` are in
  `SCR/` (W5's dir). They are left as they are, per the stop. The earlier `w1probe` JSON was moved into `SCR/w1-probe/`.
- **My files**: `SCR/w1-probe/probe.mts`, `trace.mts` and `accept2.txt` (the full acceptance output).

Outcome: Partial
Changed: RV/located-defects/row-refuted.ts, RV/located-defects/row-cells.ts, RV/agreement/unsupported-no.ts; tests RV/located-defects/tests/row-refuted.test.ts, RV/tests/reask-route/tests/refuted-rows-route.test.ts (earlier rounds: as in the sections above)
Validation: `pnpm check` -> exit 1, TS2375 at located-defects/tests/row-refuted.test.ts(70,78) (my new test; one-line fix not applied, stopped); `pnpm test src/programs/automation-studio/runtime/result-verification` -> exit 0, "Tests 1454 passed (1454)" + "Tests 3 passed (3)"; replay mvswewhy 0055 -> unsure refutation_unsupported, refutedRows 2x outside_mark (harness served the t752 replies); replay mvud43a2 0063 -> answers no_refuted_by_record
Not verified: pnpm check green after the test fix; fail-first of the same-item test; mvswewhy with a harness that does not reuse the t752 replies (shown only by my trace: answers no_refuted_by_record when the nos repeat)
Report: C:/Users/osrs_/FluxStuff/fxwork/t810/!FluxIQWebExtension/docs/working/framework-heavy-lifting-plan/reports/t810/w1-refute.md
Notes: The mvswewhy cause is the replay harness, not Core: its 60-character "same-kind" match served the t752 recheck's recorded replies to the new row recheck.
The typecheck fails on my new test only. Fix: `condition: first.conditions![0]!.condition!` in secondRead.
Two w1probe2 JSONs remain in W5's dir.
