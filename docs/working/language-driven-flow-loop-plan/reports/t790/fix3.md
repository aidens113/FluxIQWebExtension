# t790 fix3: an `asked_missing` defect is located only through the column its one condition tested

## Outcome

Done. Take a row that a read left out by one condition alone, where Core knows which column that condition tests. An `asked_missing` defect about that row is now located only if it quotes that column. If it quotes any other column, it is not located, so the no is re-asked as today, and Core's finding names the condition, its wording, its column and the column the defect quoted. All 240 tests in `located-defects/tests`, `agreement/tests` and `refuted-no/tests` pass. No existing expectation changed.

## What changed and why

Paths are under `$RV/located-defects/`.

- **`untested-column.ts` (new).** Exports `automationStudioResultAskedUntestedColumn(defect, label, quoted, summary)`.
  - It looks at every read and condition whose `leftOutOnlyByThis` names the row, matched the same way t785's `tested-value-only.ts` matches.
  - It returns `undefined`, so the defect is handled as today, in any of these cases:
    - a `leftOutTogether` set names the row (several conditions left it out);
    - the row is in no condition's `leftOutOnlyByThis`;
    - Core cannot tell some such condition's tested column;
    - the defect's column is the tested column of any such condition. Columns are compared as F1's `sameColumn` compares them.
  - Otherwise it returns the finding. With one condition the finding reads: `Core's record of "Ann Lee" was left out only by condition 1 (club equals ["A Club", "B Club"]), which tests "club"; the defect quotes "posted", which condition 1 did not test, so it does not show why condition 1 should keep that row. Quote that row's own value in "club".` There is a plural form for a row that several reads each left out by a different single condition.
  - The last sentence tells a re-ask how a true defect is grounded. It is generic, like t771's "name the column and quote that row's own value in it".
- **How Core knows the tested column.**
  - First choice is the authored condition, read from `flowShape` (any relation, negated or not): `automationStudioResultReadConditionColumn` gives its `field`, or the declared column its `read` matches. This column is used only if the condition's wording names it as a whole word. The wording names a column only after it has passed the screens (`read-account/condition.ts`), so Core never says a denied key.
  - Otherwise Core uses the column the row is said with (`label — column: value`, via `tested-cell.ts`). The sender writes that as the column the condition tested, and it is already screened.
  - Otherwise the column is unknown, and the defect is held to the row's cells as before.
- **`condition-authored.ts` (new).** Exports `automationStudioResultReadAuthoredCondition(flowShape, read, number)`: the authored condition N of the read's step, plus the step's declared `fields`. It is the lookup that `condition-equals.ts` already did (step by node and definition, `where` read through `automationStudioStoredListItems` so a lost item yields nothing, item `number - 1`), moved into its own file so the new column reader and F1 share it instead of duplicating it.
- **`condition-equals.ts`.** Now calls `condition-authored.ts`. Its behaviour is unchanged; the `not` check and the relation and value checks are as before. The header note is updated.
- **`located-defects.ts`.** The left-out branch is now `askedCellNotFound ?? automationStudioResultAskedUntestedColumn ?? automationStudioResultAskedTestedValueOnly`.
  - The new check comes after `askedCellNotFound`, so the existing findings ("holds X in col, not Y", "names no column and value") keep their wording and priority.
  - It comes before F1. The two cannot both fire: F1 needs the same column, the new check needs a different one.
- **`index.ts`.** Exports the two new files and adds a t790 paragraph to the header, citing `run-mvswewhy-e4e469d4`.
- **`tests/untested-column.test.ts` (new).** Uses the existing club-posts fixture. A helper in the test adds `posted` and sets Ann Lee's cells to `{club: "C Club", posted: "3 May"}`; the fixture's defaults are unchanged. Five cases:
  1. `asked_missing` with column `posted` and value "3 May", under `MEMBER_REQUEST`: not located. The exact finding names condition 1 and its wording, and says it tests "club".
  2. The same row quoted by column `club` with value "C Club", under `NAMED_CLUBS_REQUEST`, which says that value: located.
  3. The tested column quoted with its own value, on a condition that is not an F1 `equals` list (`{field: "club", not: true, equals: "C Club"}`): located. The same summary quoted by `posted`: not located.
  4. With no authored step but the row said `Ann Lee — club: C Club`: the column is taken from the said form. `posted` is not located and `club` is located.
  5. With no authored step and a bare label, Core cannot tell the column, and the `posted` defect is located through its cell as before. This also shows that case 1 would have been located before this change.

The brief's two rules are covered as follows:

- A true defect stays locatable by quoting the tested column's value: cases 2, 3 and 4.
- F1 still covers the case where that value is only an `equals` list's rejected value: `tested-value-only.test.ts` still passes unchanged.

## Commands run and observed results

All commands were run from `$CORE`.

- **Baseline, before any edit.** `pnpm --filter fluxiq exec vitest run <RV>/located-defects/tests <RV>/agreement/tests <RV>/refuted-no/tests`
  - First run: `Test Files 5 failed | 26 passed (31)`, `Tests 11 failed | 219 passed (230)`.
  - Second run, with `--reporter=json`, a minute later: `0 failed, 235 passed, 235 total, 31 files`.
  - The total rose by 5 between the runs, and the tree shows another worker's edits in `agreement/unsupported-no.ts` and `agreement/tests/membership-reask.test.ts`. So the first run's failures came from that concurrent edit, not from the baseline. I did not touch those files.
- **New test file.** `pnpm --filter fluxiq exec vitest run <RV>/located-defects/tests/untested-column.test.ts` -> `Test Files 1 passed (1)`, `Tests 5 passed (5)`.
- **Acceptance, after the change.** Same three directories, `--reporter=json` -> exit 0, `failed 0 passed 240 total 240 files 32`. That is 235 plus the 5 new tests.
- **Other files that build `asked_missing` defects.** `pnpm --filter fluxiq exec vitest run <RV>/build-test/tests/judge-rows.test.ts <RV>/standing-no-record/tests/label-condition-replay.test.ts <RV>/standing-no-record/tests/record.test.ts <RV>/tests/judge-sees-the-read.test.ts <RV>/tests/verdict.test.ts` -> `Test Files 5 passed (5)`, `Tests 73 passed (73)`.

## Not verified

- No typecheck was run; the brief leaves it to the supervisor. By reading the contracts, the fields the test mutates are mutable (`recordSets[].columns`, `sampleRows`, the conditions' `leftOutCells` and `leftOutOnlyByThis`), and `flowShape[].parameters` is optional, so `delete` is allowed.
- The structure audit was not run. New stems were chosen so no sibling prefix group reaches the audit's `prefixGroup: 3` (`condition-` now has 2 files, `untested-` has 1). Each file has one export, and the barrel is updated.
- The whole package suite and live runs were not run.
- New files are LF while their siblings are CRLF. `core.autocrlf` is `true`, so they normalise on commit.

## Open questions or contradictions found

1. **Presence conditions (judgement call for the lead).**
   - Suppose a row was left out alone by an `is present` or `is absent` test of a column. Its tested cell is usually empty.
   - `askedCellNotFound` refuses an empty value ("names no column and value"), and the new rule refuses every other column. So a true no about such a row can never be located: it ends unsure, never refuted.
   - This is the debug's stated trade-off, in its strongest form. Its own example (fix 4: a condition testing an audience mark) may well be a presence test.
   - I kept the rule as briefed. The alternative would be to exempt presence tests or to accept the request's own words, and either would reopen the false refutation the fix closes.
2. **Rows left out by several conditions together (`leftOutTogether`) are unchanged**, as briefed.
   - The same reasoning could apply: such a defect would be located only if it quotes one of those conditions' columns.
   - I did not extend it, for three reasons. A together set's conditions often test related columns. Ruling out every other column needs every member's column to be known. And `asked-cells.test.ts` deliberately locates Bo Kim, a together row, by `posted`.
3. **`kept_not_asked` and `wrong_value` are unchanged.** These are stored rows that no condition left out, so the reasoning does not plainly apply.
4. **Unknown tested column falls back to today's behaviour.** Examples: the club-notices fixture, whose step has no authored parameters and whose row is said by its label alone; a condition over a read that no column makes. That fixture's `clubLink is present` / `club "Chess Club"` case is the semantic shape the new rule targets, but Core lacks the structural column there, and the existing test still expects it located. In real runs the step's parameters are normally carried, so the new rule would apply.
5. **No caller outside `located-defects` needed a change.**
