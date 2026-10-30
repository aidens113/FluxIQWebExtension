# t795 / w1b-together-settled: a group of settled conditions is accounted for by each (Core)

## Outcome

**Partial.** The fix is in as briefed, with tests that failed before it and pass now. The whole RV directory passes (180 files, 1394 tests), `pnpm check` exits 0, the store yeses are still held and all four replays are unchanged.

**The required real-reply result is not met, and the briefed rule cannot meet it on this data.** Social 6b (T2 judges 0043-0046) and 6c (T2 judges 0042/0043) are still `unsure / exclusion_evidence_missing`, not the baseline `answers`. Each social group that is still held has a member that is **not a settled condition**: `posted is present` left no row out alone, so its account has no `leftOutSettled` and no `settledKind`. The yeses also never quote the request for it. Under "a group with any unsettled member still needs row naming", these groups stay held.

The data:

| Run / judge | Group still held | Member that is not settled |
| --- | --- | --- |
| 6b 0044, 0046 | `conditions 1 and 2 (group equals [...]; posted is present)`, 10 rows | condition 2 `posted is present`: alone 0, settled 0 |
| 6c 0042, 0043 | `conditions 2, 3 and 4 (posted is present; ...)`, 10 rows | condition 2 `posted is present`: alone 0, settled 0 |

The fix did take one group out of the hold. In 6c 0042, `conditions 3 and 4` (6 rows) is no longer held: both members are settled text tests, and the yes names and quotes each one.

## What changed and why

All paths are under `RV/request-rows/`.

- **`types.ts`**
  - New optional `settledMembers` on `AutomationStudioRequestRowsCondition`.
  - New type `AutomationStudioRequestRowsSettledMember` = `{ condition, names, kind, test }`.
- **`summary-reads.ts`**
  - While building a run read's own-row conditions, it records each settled condition by its number: its name, `settled.names`, `settled.kind` and its test.
  - A `leftOutTogether` group carries `settledMembers` only when **every** member number has such an entry.
  - The group itself still has no `settled`, so `left-out-accounted.ts` and every other reader see it as before.
  - Build-test groups never carry it, because a test's condition is never settled.
  - Header paragraph added (t795 w1b).
- **`unquoted-rows.ts`**
  - A group with `settledMembers` skips row-by-row naming.
  - Each member is checked by the settled rule (`settledMemberQuoted`): a sentence that itself quotes the request names the member by its `names`. No quote is lent.
  - F1(d) also applies per member: a quote whose own words name only another condition of the read does not count for that member.
  - An unaccounted member gives `{ condition: <member's name>, rows: <group's rows not in result>, bound: true, boundKind: <member's kind> }`.
  - Stored-elsewhere holds (t691) still apply to group rows.
  - `otherConditionQuote` now takes the tests (`mine`) rather than a condition.
  - `namesCondition` is shared with `boundUnquoted`, which behaves the same.
  - Own-row conditions are judged exactly as before. Header paragraph added.
- **Tests** (library catalog):
  - New fixture `tests/settled-together-fixture.ts`: condition 1 `reference is absent` (settled presence), condition 2 `format equals ["Book"]` (settled text), condition 3 `title not contains ["Atlas"]` (not settled). A group of [1,2] by default, or [1,3].
  - New `tests/settled-together.test.ts`:
    - **reads:** a [1,2] group carries both members, with their names, words, kind and wording; a [1,3] group carries none.
    - **brief (1):** a yes quoting the request for each condition is accepted, whether or not it names the group's row.
    - **brief (2):** with condition 2 unquoted, the yes is held twice: condition 2's own row (as before) and the group's row under condition 2, marked `bound`.
    - **F1(d) on a member:** condition 2's sentence quotes only condition 1's words. The group's row is held under condition 2, and condition 2's own row is not (alone rule unchanged).
    - **no lending:** a quote in the next sentence does not account for condition 2.
    - **brief (4):** a [1,3] group is held row by row though both settled conditions are quoted. It is accepted when the row is named beside a quote naming condition 1.
  - **Brief (3):** the existing wall-calendar together tests (`unquoted-rows.test.ts` F1 describe, `summary-together.test.ts`) are unchanged and pass. Their members 2 and 3 are not settled.

## Commands run and observed results

Everything ran from `fxwork/t795/!FluxIQ/packages/fluxiq` inside the shared `heavy-check.lock` loop, with the lock always released. Logs are in `SCR/t795-w1b/`, where `SCR` = `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad`.

- **Fail-first, on the original source:** `pnpm test .../request-rows/tests/settled-together.test.ts` gave `Tests 5 failed | 3 passed (8)`.
  - The 5 failures were the reads case and every settled-group case.
  - The 3 passes were the controls that expect today's behaviour: "carries none" and both [1,3] cases.
- **First acceptance run:** `pnpm test src/programs/automation-studio/runtime/result-verification` gave `Tests 1 failed | 1393 passed (1394)`.
  - The failure was my "no lending" test. Its lending sentence quoted "anything whose **format** …", and that quote writes the column name, so the sentence names condition 2 itself (t790).
  - I changed the test's quote to "not a printed book". No source change.
- **Final acceptance:**
  - `pnpm test src/programs/automation-studio/runtime/result-verification`: `Test Files 180 passed (180)`, `Tests 1394 passed (1394)`, rc 0 (`rv-tests2.txt`).
  - `pnpm check`: rc 0 (`check2.txt`).
- **Held probes** (`W6_CORE=t795 node --experimental-transform-types SCR/t795-w6/held-probe.mts <steps> …`, all rc 0):
  - **6b 0042-0046** (`held-6b.log`): 0044 and 0046 are held only for `conditions 1 and 2`, 10 rows. 0043 and 0045 are held for that group and also `bound` on condition 1. 0042 is a no. All the yeses are `unsure exclusion_evidence_missing`.
  - **6c 0042, 0043, 0058** (`held-6c.log`): 0042 and 0043 are now held only for `conditions 2, 3 and 4`, 10 rows. Before, 0042 was also held for `conditions 3 and 4`. Still `unsure exclusion_evidence_missing`.
  - **Store `run-mvtdoyf3` 0125, 0127, 0137** (`held-store2.log`): each is held only for `conditions 3 and 4 (name not contains ["Ear Tips"]; name not contains ["Replacement"])`, 1 row. This is the guard alone, as required. Neither member is settled.
- **Replays** (`W6_CORE=t795 node --experimental-transform-types SCR/t795-w6/replay.mts <steps> w1b-<label>`, all rc 0):
  - I compared each run's header, facts, outcome and calls lines with w6's `replay-<label>-t795.log`.
  - Social 6b, social 6c, store 1 (`run-mvswh11y`) and store 2 (`run-mvtdoyf3`) are all **identical**.
  - So the store outcomes are unchanged from w6-replays.md. The social T2 outcomes are also unchanged: 6b `unsure / refutation_unconfirmed`, 6c `unsure / verdict_unavailable`. Neither is back to the baseline `answers`.
- **Alternative-rule probe** (`SCR/t795-w1b/any-probe.mts`, reading only, `any-*.log`). It measures "a group is accounted for when **some** member is a settled condition that the settled rule accounts for", ignoring per-member F1(d):
  - 6b 0044 and 0046 would be accounted (condition 1 is settled and quoted). 0043 and 0045 would still be held by condition 1's own `bound` hold.
  - 6c 0042 and 0043 would be accounted (conditions 3 and 4 are settled and quoted).
  - Store 2 0125, 0127 and 0137 would still be held (members 3 and 4 are not settled).
  - Store 1 has no together groups, so it is unaffected.
  - Under that rule the guard would no longer hold 6b 0044/0046 or 6c 0042/0043, which are the replies the baseline takes, and the store holds would stand. A full replay under that rule was not run.

## Not verified

- No full `replay.mts` run under the "some member" rule. Its effect comes from the probe only, without per-member F1(d).
- I did not check the judge-facing wording of the new hold. `verdict/unquoted-line.ts` (not owned) words every `bound` entry as rows the condition "alone left out". For the group rows held under a member, that word "alone" is inaccurate. The action it asks for is right: quote the request in a sentence naming condition N.
- Structure audit not run (not named in the brief).

## Open questions or contradictions found

1. **The brief contradicts its own requirement.** "A group with any unsettled member still needs its rows named row by row" and test (2) ("missing the quote for one of them is held") cannot coexist with "social 6b 0038/0044/0046 and 6c 0038/0042 back to the baseline outcome". Both social groups contain `posted is present`, which settled nothing (no own rows) and which no yes quotes. The lead needs to choose one of:
   - **(a)** Keep this rule. The social builds stay unconfirmed on these replies.
   - **(b)** Accept a group when some member is a settled condition that the settled rule accounts for. The reasoning: the read put the row out for failing that member, and the request states it. The probe says this restores both social runs and keeps the store holds. Test (2) would then flip, and the "any unsettled member" clause would go.
   - **(c)** Scope F1 a to every-result requests (w6's other option).

   Under (b), the code change is small. `summary-reads.ts` would carry the settled members even when some members are unsettled, and `unquoted-rows.ts` would use `some` instead of `every`.
2. **The held entry is under the member's name, not the group's**, so the recheck tells the judge which condition to quote. Holding it under the group's name would ask the judge to name "conditions 1 and 2", and that does not match member 2's word runs (`condition 2`). A member that is also held for its own rows gets two `bound` lines for the same condition, one with its own rows and one with the group's rows. I did not merge them, because merging would change how own rows are reported.
3. **F1(d) applies to each member of a settled group, but not to a condition's own settled rows** (those are unchanged, per the brief). So a sentence that names condition 2 and quotes only condition 1's words accounts for condition 2's own rows but not for the group's rows. One of the new tests pins this down.
