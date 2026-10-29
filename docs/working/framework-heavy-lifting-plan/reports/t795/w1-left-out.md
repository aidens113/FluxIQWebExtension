# t795 / w1-left-out: every left-out row needs a stated exclusion (Core, P5)

## Outcome

Done, with one open item for the supervisor. All four brief items are implemented, and the regression tests failed first and pass now. On the real run, revision 1 holds, revision 3 fails and revision 5 fails, and the three accepted yeses (0125, 0127, 0137) are now held. `pnpm check` exited 0.

The open item: one test in the acceptance set fails, `left-out-naming-the-item.test.ts > run mux6naez`. The cause is not my code. The verify.ts wiring in this tree (another worker's) now gives a Core no without asking any judge, because the `columns` and `repeated` facts fail on that fixture. My fact gives no fact there, because "every pair" is not an every-result request. Evidence is under "Commands run" below.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/` (RV).

- **`computed-facts/left-out-accounted.ts`** (the stub, now filled; export name and signature kept). It only runs where `automationStudioRequestAsksEveryResult(requestText)` is true. It reads every left-out row, whether one condition or a together group left it out, through `automationStudioRequestRowsReads(summary, false, { together: true })`, so both senders are covered. A row whose label is also in the result is skipped. Each condition that left the row out is placed in one of three states:
  - **stated**, in either of two ways:
    - t660 `automationStudioResultRequestExclusionTest`, given that row's witness. This covers presence tests that keep rows lacking a value, and negated literal text tests.
    - A positive condition whose own words, apart from the answer's columns, are all said by the request, along with all its numbers.
  - **unstated**: the whole wording is known, the condition tests by something, and none of its own words, its numbers or the row's witness words are in the request. Searched words and list words do not count.
  - **undecided**: anything else. Examples are a build test's field-only condition, withheld wording, or text the request says without an exclusion cue ("including reference copies").

  A row counts as stated if any of its conditions is stated, and as unstated only if all of them are. Any unstated row gives a `fails` fact with one `asked_missing` defect per row:
  - the row is Core's label;
  - the column is the tested column, where every condition that left the row out agrees on one;
  - `requestWords` is the shortest part of the request that, read on its own, still reads as asking for every result, e.g. "collect every search result on the first page".

  If every row is stated the fact `holds`. Otherwise there is no fact. The sentences use generic words.
- **`request-rows/condition-words.ts`** (new, exported through the barrel): `automationStudioRequestConditionWords(test)` returns the words a condition tests by (subject, tested text, the value its read found), its numbers, and `whole`. Both the fact and F1(d) use it.
- **`request-rows/types.ts`**: three new optional fields on a condition: `tests`, `together` and `witnesses`. Reads get optional `tests` (every condition of the read), and there is a new `AutomationStudioRequestRowsTest` type (`{ number?, wording?, field? }`).
- **`request-rows/summary-reads.ts`** (F1 a): with `{ together: true }`, each `leftOutTogether` set becomes one unsettled condition, for a run's account and for a build test's `readRows` alike:
  - It is named `conditions 3 and 4 (<w3>; <w4>)`, using the fields on a build test.
  - It sets `testedLabel: false` and `together: true`, and keeps the rows' labels.

  Every condition now carries its `tests`, and a run's condition also carries the witnesses from `leftOutObservations`. Processing conditions carry `tests` too.
- **`request-rows/unquoted-rows.ts`** (F1 a + d): it reads reads with `{ together: true }`, so together rows are held to t515's rule. For a together group, a quote whose own words name another condition of the read and none of the group's does not account for the group's rows, whether it sits in the row's own sentence or is lent from the sentence beside it.
- **`request-rows/request-wording.ts`** (F2): `searchedWords` now intersects every run inside each label's phrases that is itself a request phrase (`phrases.isPhrase`), instead of matching exact phrase keys.
- **Tests (library catalog):**
  - `request-rows/tests/wall-calendar-fixture.ts` (new fixture);
  - debug test 1 → `request-rows/tests/unquoted-rows.test.ts`, new describe: semicolon form, comma form, judge's own reason, stated control, and a shared quote that is held even though the request states the exclusion;
  - debug test 2 → `request-rows/tests/summary-together.test.ts`: default reading unchanged, run group, build-test group, t691 stored elsewhere;
  - debug test 3 → `request-rows/tests/searched-words.test.ts`: "Hook Rack for Garden Tools" gives searched `garden tool`;
  - `computed-facts/tests/left-out-accounted.test.ts`: together rows by unstated conditions fail; a stated presence exclusion holds; a together group holds when the request states one of its conditions; an unstated `isbn is present` fails with column isbn; "Find garden gloves" gives no fact; "including reference copies" gives no fact; a build test gives no fact; a left-out copy of a kept row is not weighed.

Two choices narrowed the brief. Both were needed to keep existing tests passing without touching must-not-touch paths:
1. **Together groups are opt-in** (`options.together`). With them on by default, refuted-no's no-record (`refuted-no/record.ts`, which I may not edit) counted the together rows as left-out rows, so its t665 `unnamed` handling changed and `refuted-no/tests/together-rows.test.ts` failed. Now only the yes guard and the fact read them. The no-checks, the flags and refuted-no read reads exactly as before.
2. **F1(d) applies only to together groups**, which is how the brief words it ("does not account for this group"). The debug's wording ("this condition's rows") would apply it to every condition. That contradicts the existing t574 test "takes a quote in the sentence beside the rows", where one exclusion's quote, lent from the next sentence, accounts for two rows.

## Commands run and observed results

All vitest and tsc runs went through the shared lock. Every run was from `C:/Users/osrs_/FluxStuff/fxwork/t795/!FluxIQ/packages/fluxiq`.

- **Fail-first**, on the original code (only the new test files and a type-only `types.ts` edit present): `pnpm test .../request-rows/tests/unquoted-rows.test.ts .../request-rows/tests/summary-together.test.ts .../request-rows/tests/searched-words.test.ts .../computed-facts/tests/left-out-accounted.test.ts`
  - Result: `Test Files 4 failed (4)`, `Tests 13 failed | 23 passed (36)`.
  - The 13 failures were every new F1, F2 and fact case. The controls, the "no fact" cases and the existing tests passed.
- **First acceptance run** (together groups on by default, (d) on every condition): `Tests 3 failed | 547 passed (550)`. The failures were `refuted-no/tests/together-rows.test.ts` (t665 `unnamed`), `unquoted-rows.test.ts` (the t574 lending test) and the mux6naez one. That led to the two narrowing choices above.
- **Final acceptance**: `pnpm test src/.../request-rows src/.../computed-facts src/.../value-readings src/.../read-account src/.../refuted-no` → `Test Files 1 failed | 74 passed (75)`, `Tests 1 failed | 550 passed (551)`.
  - The failure is `left-out-naming-the-item.test.ts > run mux6naez ...: expected 0 to be greater than 0` (no judge call made).
  - Cause, probed with `node --experimental-transform-types` running `automationStudioResultComputedFacts` on that fixture: `[{"kind":"columns","status":"fails","said":"No stored column is price, rating, which the request names." ...}, {"kind":"repeated","status":"fails", ...}]`, and `automationStudioResultLeftOutAccountedFact` → `[]`.
  - verify.ts lines 280-284 in this tree turn any failing fact into a Core no with no judge call.
- **`pnpm check`** (tsc) → `exit 0`.
- **Real run `run-mvtdoyf3-47ffaac1`**: the probe is `scratchpad/t795-w1/probe-fact.mts`. Each trial was read from its first judge's copy of the summary:
  - Revision 1 (trials 0025, 0033, 0040): `holds`, "...each of the 3 rows... condition 1 (sponsored is absent), by the request's "sponsored"".
  - Revision 3 (trials 0061, 0080): `fails`, with 3 `asked_missing` defects (Ear Tips, Brightaisle Basics Sport, Oakhaven Sound Grove), column `brand`, requestWords "collect every search result on the first page".
  - Revision 5 (trial 0120 and playback 0136): `fails`, with 1 defect (the Replacement Ear Tips row), column `name`, from `conditions 3 and 4 (name not contains ["Ear Tips"]; name not contains ["Replacement"])`.
  - Yeses 0125, 0127 and 0137: each is held for `conditions 3 and 4 (...)` (before the change, none was held).
  - F2 on 0043: `ownWords("Search the store for wireless earbuds")` = `["store"]` (before, `["store","wireless","earbud"]`).

The full outputs are in `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/`: `t795-w1-failfirst.txt`, `t795-w1-accept.txt`, `t795-w1-accept2.txt`, `t795-w1-check.txt` and `t795-w1/probe-fact.out`.

## Not verified

- The structure audit was not run; the brief did not name it.
- The judge prompt sentence in `llm/diagnosis-instructions.ts` (the debug's F1 extra: add `leftOutTogether` rows to "Hold every row ...") was not changed, because `llm/**` is must-not-touch.
- No end-to-end check that verify.ts passes my `holds` sentence to the judge as intended; verify.ts is another worker's code.
- The build-test path never produces this fact: `readRows` names conditions by field key only, so every build-test condition is undecided. This is by design, not an oversight.

## Open questions or contradictions found

1. **mux6naez test** (above): the `columns` and `repeated` facts fail on that fixture and short-circuit the judge. The owners of those facts, or of verify.ts, should decide whether the fixture or the facts are wrong.
2. **The debug's F1(d) as written contradicts t574's lending test.** I applied (d) to together groups only. Applying it to every condition would need a decision to retire that t574 case.
3. **Together groups are opt-in.** The no-checks (`checked-rows.ts`, refuted-no's record) still do not see together rows as one of a read's conditions, and refuted-no names them through its own t665 path. Widening that would need edits in `refuted-no/`, which is must-not-touch.
4. **Risk in the "holds by own words" rule** for positive conditions: a request that names a word only to include something ("every result, including gift sets") could make a `name contains "gift"` condition hold. I kept that rule because the brief asked for it, but narrowed it: answer-column words do not count, every own word and number must be said, and negated and lacking tests are excluded.

   On the other side, the unstated test counts the answer's column words as said. That keeps false fails rare, but it means a condition on a column that the request lists among its output columns gives no fact rather than a fail.
5. `refuted-no/request-exclusion-test.ts` and `read-account/together-rows.ts` were not changed.
