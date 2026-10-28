# t771: build-test grounding, then the lead's re-scope (A to D)

## Outcome

Done. All work is in the Core tree `fxwork/t771/!FluxIQ`; there are no downstream code changes.

- The original premise did not hold for the round-6 runs. The scoped build-test record gap was still
  real, and I fixed it (items 1 to 4).
- I then did the lead's re-scope, A to D. All of it is inside `result-verification/**`, plus the
  judge's instruction text and its prompt pins.

## Findings: why round 6 said "judged unknown"

These findings came before the re-scope and agree with the lead's debug note at
`fxwork/t566/.../debugs/run-mvrj7qg8-c20c132e.md`.

- **No judge said "unknown", and Core gave no such verdict.**
  - All four round-6 runs ended with Core's t753 told-draft sentence ("I kept what I wrote as a
    draft…"). That sentence names no verdict.
  - The Lab's `chatDraftVerdict` (`packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`)
    cannot match it, so it defaults to `unknown`.
  - The lead says t773 owns this.
- **Slot 3 (social) never used a build-test record.**
  - Every judge request (0044 to 0096) was a run summary with `sampleRows`. None had `buildTest`.
  - Project-build subflow and whole trials judge real trial runs (`service/project-build/subflow-trials.ts`
    and `whole-trials.ts` → `automationStudioBuildTestJudge` over a run summary).
  - The subflow tests went: 0041, 0049, 0059 and 0092 judged no (grounded); 0067 unsure (a split);
    0075 unsure (both nos refused).
  - The build ended because its briefs ran out of money.
  - The real Core defects there are the lead's A to D.
- **The act runs (slots 1, 2 and 4) are not explained by build-test grounding either.**
  - Their judges also read run summaries. Slot 1's 0047 was a grounded no; slot 2's subflow tests
    said yes.
  - What blocked them was mostly `candidate.trial_reset_required` / `project.trial_reset_required`
    ("acts in place"; slot 4 hit it 13 times), `candidate.trial_step_unwitnessed` and
    `candidate.execution_incomplete`.
  - Those are the reset and trial gates, which belong to t772 and t769.
- **Where the build-test gap is real.** Only the single-Flow build loop
  (`service/flow-bootstrap-commands/build-judge.ts`) judges a `buildTest` account. Its record held no
  stored rows. The act steps were already carried there by t766 (`act-steps.ts`).

## What changed and why

### Items 1 to 4 (build-test record)

- `refuted-no/record.ts`: Core's no-record now holds each label of a build test's answer
  (`buildTest.stores[].answer.labels`, never `(withheld)`) as a stored row.
  - A kept row of a test is now located (item 1).
  - A row the test's answer holds is never located missing (item 2).
  - `storedWhole` already returns false when a test has stores, so the trial gates are unaffected.
- Item 3: through the build-test judge, a located kept-row no is now `verdict: "no"` with observed
  and advice (repair feedback). Before, it was `unknown`.
- Item 4: same shape with a made-up timetable. A lesson of a course the person is not enrolled in,
  held in the answer, gives a grounded no. The same claim against an answer without that row is
  `unknown` (`unsupportedNo`).

### A: a missing-row claim is held to the row's own cells

Change in `located-defects/located-defects.ts`, plus the new `located-defects/row-cells.ts`.

- **Naming a row.** `rowsNamed` now names a row by one of:
  - its whole label;
  - Core's id for it;
  - its whole label first, then a separator and more words. Those words tell apart rows that share
    the label, by a cell they name.

  It never names a row through a label found later in its words; the old
  `automationStudioResultSentenceRows` fallback is gone. This fixes "<author> — <group>, …" being
  told it "is a row the result holds".
- **The cell check.** An `asked_missing` defect for a row a read saw is located only where all of
  these hold:
  - it gives a `column` and a `value`;
  - Core's cells for that row (the read's `leftOutCells`, a left-out-together set's `cells`, or the
    tested value in `label — column: value`) hold that value, equal or containing it;
  - or, where Core holds no cell of that column (a build test's rows, older records), the row's own
    label contains the value.

  Otherwise the defect is not located and Core says why.
- **Unchanged.** A claim about rows a read never read ("rows not read") is still located when a
  read's own account says its list goes on.

### B: left-out rows reach the judge with their cells

- The new `left-out-cells/` (`automationStudioResultReadLeftOutCells`) screens every declared column
  of each left-out row:
  - a denied or credential-shaped column is dropped;
  - a credential- or locator-shaped value is shown as `(withheld)`;
  - an empty cell is kept.
- Contracts:
  - `AutomationStudioResultReadCondition.leftOutCells`, aligned with `leftOutOnlyByThis`;
  - `AutomationStudioResultLeftOutTogether.cells`.
- Filled in by `read-account/accounts.ts` and `together-rows.ts`, and carried through loop passes by
  `looped-account.ts`.
- The source rows were already in Core's run record (`service/summaries/extraction-summary.ts` keeps
  every column). No domain change was needed.

### C: nothing from an ungrounded no is carried on

- `agreement/unsupported-no.ts`: a `refutationUnsupported` outcome's `unconfirmedReading` now holds
  only `expected` and `recordContradicts`. `recordContradicts` is kept because it is Core's own fact
  and the t641/t652 trial gates read it. The labelled observed and advice prose of refused nos is
  gone.
- `standing-no/earlier-advice.ts`: later judges are told the advice of trials judged **no** only.
  A trial judged unsure stood on no grounded no.

### D: a lone yes beside fully refused nos gets one confirming call

- `unsupported-no.ts`: when every no was refused after its re-ask and a model yes remains, the yes
  gets one more call (`CONFIRM_LONE_YES`), in the refused no's slot.
- A second yes is agreed as two yeses. Any other answer leaves the outcome unsure.

### Model-facing text

- `llm/diagnosis-instructions.ts`:
  - the `leftOutOnlyByThis` sentence now names `leftOutCells`;
  - the defects sentence now asks for a row by Core's id or its whole label, and, for a left-out row,
    the column and the row's own value in it.
- Re-ask words: `unsupported-no.ts` `recheckWords`, and the new `CONFIRM_LONE_YES`.
- Pins: `system-prompt-pins.json` changed by 2 lines (both verification pins); the `DEFECTS`
  constant and the pin history note were updated.
- All wording is generic.

### Docs

- `docs/architecture/automation-studio/llm-flow-bootstrap.md`, "grounded defects" section.
- `docs:reference` regenerated, both copies.

### Tests

New, all with generic data:

- `located-defects/tests/build-test-answer.test.ts` (+ fixture)
- `tests/reask-route/tests/build-test-answer-route.test.ts`
- `located-defects/tests/asked-cells.test.ts` (+ `club-notices-fixture.ts`): the slot-3 shape —
  a friend's own post given a group, a fabricated "Cy Park — Chess Club" beside a stored "Chess Club"
- `read-account/tests/left-out-cells.test.ts`
- `tests/reask-route/tests/lone-yes-route.test.ts`
- a new case in `standing-no/tests/earlier-advice.test.ts`

Updated to the new contract (no assertion was weakened against a wrong answer):

- **Mocks of a true missing row now give column and value:** `judge-rows`, `references-route`,
  `record`, `label-condition-replay`, `located-defects`.
- **`request-words-route`, unread title:** Core never read that row's availability, so the claim is
  now `unknown`. Before, it was a no.
- **Prose-carrying expectations now expect no prose** (and still assert `recordContradicts`):
  `judge`, `partly-refuted-route`, `split-partly-refuted-route`, `unsupported-no-route`,
  `kept-condition-drop` (candidate and subflow).
- **Call counts went from 4 to 5 because of D's confirming call:** `narrowing-no-route`,
  `split-partly-refuted-route`, `candidate-trial/run`. `kept-condition-after-split` now scripts its
  fifth call as a no, so its split stays unsure.
- **Cells now appear in exact-equality expectations:** `alone-rows`, `looped-read`,
  `together-rows`, `extraction-summary-together`.

UNIT READY (Core, packages/fluxiq): all files in `git status` of `fxwork/t771/!FluxIQ`. Listed in
**Changed** below.

## Commands run and observed results

Each test group ran from `packages/fluxiq` with `pnpm test <paths>` (grouped runner).

**Before any production change**, the build-test tests alone:

- Command: `pnpm test located-defects/tests/build-test-answer.test.ts build-test/tests/judge-grounded-no.test.ts`
- Result: `Test Files 2 failed (2)` / `Tests 5 failed | 4 passed (9)`.
- The failures were the kept row located, the missing-held refusal and the judge verdict "no". This
  is the "fails on dev" proof for items 1 to 4.

**result-verification + llm/deepseek + llm/verification-defects + llm/harness/tests (final)**

- parallel: `Test Files 190 passed (190)` / `Tests 1558 passed (1558)`
- real-sql: `Test Files 1 passed (1)` / `Tests 3 passed (3)`

**Batch 1:** flow-bootstrap/candidate, flow-bootstrap/subflow-candidate, service/project-build,
project-agents, service/candidate-trial, service/subflow-trial, service/summaries.

- parallel: `Test Files 5 failed | 192 passed (197)` / `Tests 5 failed | 1303 passed (1308)`.
  The 5 were the contract-change tests listed above. I updated them; see the rerun below.
- real-sql: `Test Files 10 passed (10)` / `Tests 54 passed (54)`

**Batch 2:** service/flow-bootstrap-commands, tests/service-bootstrap, tests/deepseek-bootstrap,
tests/service-adaptation, tests/refuted-result.

- parallel: `Test Files 22 passed (22)` / `Tests 138 passed (138)`
- real-sql: `Test Files 62 passed (62)` / `Tests 306 passed (306)`

**Rerun of the edited files.** Paths: candidate kept-condition, subflow kept-condition-drop,
candidate-trial run, extraction-summary-together, and result-verification located-defects,
read-account, tests/reask-route, refuted-no and build-test.

- parallel: `Test Files 76 passed (76)` / `Tests 550 passed (550)`
- real-sql: `Test Files 1 passed (1)` / `Tests 3 passed (3)`

**Fails on dev for A to D.**

- Method:
  - I copied my 12 changed production files and 2 new ones to the scratchpad;
  - wrote dev's versions back with `git show HEAD:<file> > <file>` and removed the new ones;
  - ran the 6 new test files;
  - then restored my versions.
- Against dev: `Test Files 6 failed (6)` / `Tests 14 failed | 11 passed (25)`. The left-out-cells
  file failed to import a module dev does not have.
- After restoring: `Test Files 6 passed (6)` / `Tests 30 passed (30)`.

**Checks**

- `pnpm check` (packages/fluxiq): tsc printed no errors. The first run caught one test type error
  (`exactOptionalPropertyTypes`), which I fixed.
- `pnpm structure:check` (Core root): `structure-audit: passed (443 warning(s), 1152 baselined)`.
  Earlier runs failed the 25-file and depth limits, so I moved the cells screen to
  `result-verification/left-out-cells/` and the route test to `tests/reask-route/tests/`.
- `pnpm docs:reference`: wrote both references (4143 public declarations).
- `pnpm docs:check`: `structure-audit: passed (0 warning(s), 0 baselined)` and "Deterministic
  framework reference is current."

## Not verified

- No live or paid run and no model call. Not checked:
  - that a real judge gives `column`/`value` for `asked_missing`;
  - that it reads `leftOutCells`;
  - that the confirming call behaves as designed with a real model.
- No full suites. Downstream domain and extension packages were not built or tested.
  - Downstream tests that mock `asked_missing` without column/value, or that expect unconfirmed
    reading prose, may now fail. t766's carried-repair tests use `act_wrong` and should be
    unaffected, but I did not run them.
- Request size: left-out cells enlarge the judge packet. Slot 3 had 59 rows seen and about 51 left
  out, times 7 columns. The no-caps rule applies, and I did not measure the size.
- I did not re-run the slot-3 packets through the new code. The provider-free tests reproduce the
  shapes with generic data.

## Open questions or contradictions found

1. **The brief's premise.**
   - The round-6 "unknown" is a Lab misreading (t773).
   - The build-test record gap did not occur in any round-6 run.
   - The act runs failed at the reset and witness gates (t772, t769), not at judging.
2. **Files I edited in another lane's directories.** These are test-only edits forced by the new
   contract, in `flow-bootstrap/candidate/tests/kept-condition/*`,
   `flow-bootstrap/subflow-candidate/tests/kept-condition-drop.test.ts` and
   `service/candidate-trial/tests/run.test.ts`, which sit in t769's directories. They may conflict
   with t769's branch.
3. **How I read C.**
   - Removed: prose from unsupported-no outcomes, and earlier advice from unsure trials.
   - Kept:
     - a grounded no's prose. Its defects were located; I did not filter its `defects` list.
     - the prose on other unsure paths, such as a no beside an `unknown` (t296).
     - a yes's `answeredReading`.
   - Not done: "say so where a later revision went back on that advice".
4. **A's label fallback.**
   - Any true value works: a cell value, or text inside the label. Core checks that the judge's
     premise about the row is true, not that it is the reason the request asks for the row.
   - Because of that, a judge could ground a claim with an irrelevant true value (for example the
     author's name).
   - The lead's design accepts this; tightening it would need Core to know which columns define the
     set.
5. **Not carried by A.** "Rows not read" claims are still located from the paging record alone,
   without cells. A's wording would make them unsure. I kept them because they are not the slot-3
   failure.
