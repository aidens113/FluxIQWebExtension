# A8 wave 6 debug: bigbox-retail-pickup-towels, project mode, `run-mv9a4aj0-f9a81d13`

Read-only debug. Pair: downstream `0638d45f`, Core `95cc9a7d` (after t622, t623 and t624). Steps are under
`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mv9a4aj0-f9a81d13/steps/`. The comparison run is the
passing candidate run `run-mv9a48dc-36fe30e6`. No live run, Lab run or provider call was made.

## Outcome

The whole test's no (0086) was **correct**. The assembled Flow stored the 9 rows the oracle expects, in the
oracle's order, plus one extra row: `Loftwell Countertop Paper Towel Holder, Bamboo`. The oracle compares
counts (9 expected, 10 stored), so it would have failed this answer too.

The subflow trial's yes (0079) was **wrong**. It ran the same Flow and stored the same 10 rows. Its yes came
from a Core re-ask (t515, "unstated exclusion") that turned a correct no into a yes. Earlier, revision 4
(0063) had stored exactly the oracle's 9 rows. It was judged unsure, and the builder was then steered off it
by a no that Core's own record contradicts but that Core did not weigh. The two failures already known (repair
refused on `selector` keys from t622, and t623's "All" option) only stopped the recovery. They are not why the
answer was wrong.

## What changed and why

Only this report was written. No code was changed.

### (1) The whole test against the oracle

The oracle (`apps/scenario-lab/src/scenarios/bigbox-retail/manifest/expected-values.ts`,
`PICKUP_TOWEL_RECORDS`) expects 9 rows. Its script ticks Department "Paper Towels", which is what leaves
holders and dispensers out.

The rows stored at 0086 (judge request 0087, `sampleRows`), in stored order:

1. ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls (expected)
2. Loftwell Ultra Strong Paper Towels, 6 Double Rolls (expected)
3. Loftwell Select-A-Size Paper Towels, 12 Double Rolls (expected)
4. Softerra Paper Towels, 6 Double Rolls (expected)
5. Hearthside Paper Towels, 12 Double Rolls (expected)
6. Softerra Pick-A-Sheet Paper Towels, 12 Triple Rolls (expected)
7. Kindleaf Unbleached Paper Towels, 4 Rolls (expected)
8. ValueRidge Essentials Paper Towels Value Pack, 15 Rolls (expected)
9. **Loftwell Countertop Paper Towel Holder, Bamboo, $12.97, 4.6, no unitPrice (EXTRA)**
10. Hearthside Select-A-Size Paper Towels, 8 Double Rolls (expected)

The order of the 9 expected rows matches the oracle exactly. The read saw 29 items over 2 pages and kept 10.
Paging "ended". Nothing in any step mentions `page_fault`.

The Flow's steps were: search for "paper towels", tick the facet "ValueRidge (23)", then read with three
conditions (sponsored is absent; pickup contains "Pickup today"; rating at least 4.5). There was no Department
facet and no condition on the item's name.

What each judge call said:

- **0087 (no, confidence 0.6).** It names the holder correctly: "stored rows include non-paper-towel items:
  'Loftwell Countertop Paper Towel Holder, Bamboo' (a holder...)". It also makes a **false** claim about order:
  "the stored rows are not in Best match order: ... 'ValueRidge Essentials Select-A-Size ... 6 Double Rolls'
  and 'Loftwell Ultra Strong ...', which are page-2 items, before page-1 items". The stored order is the
  oracle's order. The judge appears to have confused the sponsored copies (page 1 items 2 and 11, page 2 items
  2 and 11) with the kept rows.
- **0088 (no, confidence 0.6).** Correct: "'Loftwell Countertop Paper Towel Holder, Bamboo' ($12.97, 4.6),
  which is a holder, not a pack of paper towels". The advice is to add a condition that keeps only packs of
  paper towels.

**t624 appeared in both forms.**

- Text settling: every condition carries `leftOutSettled` and a `settled:` line. Condition 2 is the text
  condition: "the read found pickup ... and Core tested that value against condition 2 ... as written: each
  fails it".
- Also-in-result marking: condition 1 carries `leftOutAlsoInResult` (the four sponsored copies) and its
  `alsoInResult` line. Core's `checked` (0086 result) also says "(also in the result)".

**A new defect in Core's `checked`.** The 0086 result has this line:

> "Loftwell Countertop Paper Towel Holder, Bamboo is in the result, although the check calls it left out: the
> check misread which rows were left out; advice resting on that reading is not supported."

The judge never said the holder was left out. Its summary sentence names the kept holder and then two other
rows that "were seen and only excluded by rating". `request-rows/checked-rows.ts` gives that sentence's
left-out word to every row the sentence names. As a result, Core labelled correct advice "not supported".

### (2) Why the subflow trial said yes and the whole test said no

It was not a different start, not paging, not t623's `page_fault`, not a predecessor and not an arrival
difference. Both runs had `start: "reset"`, `startHook: "ran"`, `arrival: "loaded"` and the same start URL.
Both read 29 items over 2 pages, the list ended, and both kept the same 10 rows. The steps are identical: the
whole test is revision 6 with the router's call around it.

The difference is how the judging was settled:

- Whole test: two calls, both no, so the verdict is no.
- Subflow trial 0079 (revision 6):
  - 0080 said yes. It missed the kept holder: "all ValueRidge-sold paper towel packs".
  - 0081 said no, correctly naming the holder. Its advice: "keeping only rows whose name is a pack of paper
    towels (exclude holders, dispensers and accessories)".
  - That is a split. In `agreement.ts`, `reaskUnstatedExclusion` marks "exclude holders, dispensers and
    accessories" as an exclusion "the request never states", because none of those words is in the request
    (`request-rows/unstated-exclusions.ts`). It then asks call 2 again with this recheck (diff of 0082 against
    0081):

    > "recheck: ... that answer advised leaving out rows by words the request never states as an exclusion:
    > "exclude holders, dispensers and accessories". A request excludes only what its own words state ...
    > answer no over a row the result keeps only where words of the request exclude it, quoting them."

  - 0082 said yes, and admits why: "The result does include non-paper-towel items (Loftwell Countertop Paper
    Towel Holder, Bamboo; ...), but the request's own words state no exclusion for holders, dispensers or
    accessories, so those rows are not ones the request excludes".
  - Two yeses: "The trial was judged twice to do what the instruction asks." The brief returned done on that
    receipt (0008).

So the t515 re-ask treats narrowing to the request's own item ("every pack of paper towels") as an added
exclusion. Its recheck wording forbids exactly the reasoning that is right here.

How the subflow got to revision 6:

| Revision (step) | Stored | Verdict | Why |
| --- | --- | --- | --- |
| 1 (0035) | nothing | execution failed | |
| 2 (0039) | 10 incl. holder | no | correct |
| 3 (0057) | 10 incl. holder | no | correct |
| 4 (0063) | **exactly the oracle's 9** | **unsure** | see below |
| 5 (0069) | the 9 again, s9 facet removed | no | see below |
| 6 (0079) | 10 incl. holder | yes | the t515 flip above |

Revision 4 had facet s9 plus `name contains "Paper Towels"`. Its two calls:

- **0064, unknown.** A dedupe doubt: "two genuinely different products that share all six values collapse".
  It cites the two "Hearthside Select-A-Size ... 8 Double Rolls" tiles, "same href". Core's record refutes
  this: `processing.duplicates: 0`, and the second copy is the sponsored one, listed under condition 1's
  `leftOutAlsoInResult`.
- **0065, no.** It claims "s9 ... keeps only ValueRidge-brand items" and that "Hearthside Paper Towels, 12
  Double Rolls; Softerra Paper Towels, 6 Double Rolls ... are absent as non-sponsored rows". Both rows are
  **stored** rows of that result.

Core settled the pair through the last branch of `agree()` (`model_unconfirmed`). That branch applies no
`refutedMark` and no `contradictedUnsure` for a non-paging doubt. It handed 0065's reading to the builder
unlabelled, as `unconfirmedReading`. The builder followed it at 0066: "The Retailer facet keeps only
ValueRidge-brand items, so I will drop it".

Revision 5 then lost the seller narrowing, and both calls said no for that reason. 0070 also falsely claimed
"Kindleaf Compostable Paper Towels, 2 Rolls" was left out only by condition 4. Core's record lists only the
holder there, but Core did not mark the claim. 0070 advised "drop condition 4". The builder did that at 0076,
the holder came back, and the t515 re-ask passed it.

### (3) What differs from the candidate pass (`run-mv9a48dc-36fe30e6`)

The passing Flow (trial 0046, final run 0051-0058) had:

- facet "ValueRidge-sold";
- read conditions: sponsored absent, rating at least 4.5, `name contains "Paper Towels"`,
  `name not contains "Holder"`, pickup contains "Pickup today";
- 9 rows, which the oracle matched 9/9.

That is the same shape as this run's revision 4, plus the explicit Holder exclusion.

The candidate never met the two traps:

- While the holder was stored (0020, 0026), both calls said no, so no t515 split re-ask happened.
- By the time the yes was reached, t624's `applied-exclusions.ts` saw "not contains Holder" already applied,
  so no advice was marked.
- Its split at 0047-0049 was a degenerate second reply (0048, 34,924 chars), not a disputed no.

The project builder found the right answer too (revision 4). It was talked out of it by an unweighed, refuted
no, and then a wrong answer was confirmed by the t515 re-ask. The other differences are cosmetic: the
candidate navigated straight to the results URL, and the project typed the search.

### (4) Root causes beyond the two known ones

All of these are in Core, in `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`.
None is a Lab defect: the Lab's oracle and its whole-test verdict agree.

**R1 (decisive). The t515 unstated-exclusion re-ask flips a correct no to yes.** It reads a narrowing to the
request's own item as an added exclusion, and the recheck forbids the judge from citing the request's words
for what it asks for. Smallest structural fix:

- (a) In `agreement.ts` `unstatedExclusion`, do not mark an exclusion whose own words are words of the label of
  a stored row the no's reading names. If the advice's "holders" is in the stored "... Holder, Bamboo", the no
  is saying what that row *is*. Whether the request asks for that kind of row is the judge's call; a word list
  cannot settle it. Pass `input.summary` through to get the stored labels. The t515 origin case ("excluding
  accessories such as <row>") still marks, because "accessories" is not in that row's label.
- (b) Make `exclusionRecheckWords` symmetric. A kept row may be answered no where the judge quotes words of the
  request that it fails: words that exclude it, *or* the words naming what the request asks for, which the
  row is not.

Both changes are generic, and neither names a site or task. Tests go in `tests/agreement.test.ts` and
`request-rows/tests/unstated-exclusions.test.ts`.

**R2. A split of unsure and no is not weighed against Core's record.** The bare no's reading is forwarded to
the builder.

- In `agree()`'s final branch, apply `refutedMark(input, [the no's call])`. Label the reading t501-style where
  the t607 checks refute it. Here `refuted-no/missing-claim.ts` refutes "are absent" over two stored rows.
- Extend `contradictedUnsure` beyond paging doubts to dedupe-collapse doubts. When `processing.duplicates` is
  0 and the named row is in a condition's `leftOutAlsoInResult`, the record contradicts the doubt, and the
  re-ask path exists already. `refuted-no/duplicate-claim.ts` holds the matching logic.

The tests are in `tests/agreement.test.ts`. Caveat: under t607's "every named reason refuted" rule, 0065's s9
"brand" claim may still stand. So the minimum gain is that the refuted sentence is labelled in the reading the
builder gets.

**R3. `checked-rows.ts` calls a correct judge "misread".** A sentence that names a kept row and then rows Core
really left out gives the left-out word to all of them. Fix in `request-rows/checked-rows.ts`: if a sentence
names any row that a condition of the read left out, its left-out word belongs to that row, and no stored row
named in the same sentence is reported misread. Test in `request-rows/tests/checked-rows.test.ts`.

**R4 (minor). False order claims on a double no go unchecked when nothing sorted the read.** 0087's "not in
Best match order" ran through the planner's repair reason (0089: "the stored order is the loop's page order")
and the amended plan (0101, part p2 goal fact "rows are in Best match order"). The order check
(`value-readings/order-claim.ts`, t511) only weighs columns with a `sortRead`.

A possible extension: a read that sorts nothing keeps the site's order. A claim that stored rows are out of
page order can be checked against `keptPerPage` and the pass order in `processing.passes`. Lower priority.

**Not a root cause, but it cost the recovery.** The amended plan's first brief got an allowance of $0.034
(0103). It stopped partial after 10 calls (`llm_budget.run_cost_limit`), which blocked the second brief. That
plan's search subflow also contained the read (node s10). This follows from the earlier spend, not from a new
defect.

## Commands run and observed results

- `python .../a8-summary.py run-mv9a4aj0-f9a81d13`: printed the plan, dispatch, assemble and test lines as in
  the brief (0008 done on revision 6; 0086 no; 0090, 0095 and 0098 refused with `evidence_denied_key`; 0103
  partial and blocked).
- I read these steps' `result.json` and the judge `request.txt` / `response.txt`: 0035, 0039, 0057, 0063, 0069,
  0079, 0086, 0087, 0088, and judges 0040-0082. I also read decides 0066, 0072, 0076, 0078, 0089 and 0100.
- A diff of 0081's and 0082's judge requests showed the only addition is the t515 `recheck:` line.
- I compared against the candidate run's steps 0020, 0026, 0034, 0040, 0046 and 0047-0049, and its
  evaluation (`expectedRecords 9, matchedRecords 9`).
- I read Core source at `95cc9a7d` in `C:/Users/osrs_/FluxStuff/fxwork/t565/!FluxIQ`:
  `result-verification/agreement.ts`, `request-rows/unstated-exclusions.ts`, `request-rows/checked-rows.ts`
  and `refuted-no/missing-claim.ts`.
- `grep page_fault` over every step's JSON found nothing.

## Not verified

- I did not run the Lab oracle on the stored 10 rows. The fail verdict is inferred from the expected-dataset
  count (9) against the 10 stored.
- I did not run the t607 weigh functions on 0065's text, so I have not confirmed whether 0065 would be fully
  refuted, or only labelled, under R2.
- The rule in R1(a) is a proposal and has no tests. I did not check whether the t515 origin run's advice
  wording contains a word of the named row's label.
- I did not trace how `unconfirmedReading` is chosen in the `model_unconfirmed` branch, beyond observing
  0063's output.

## Open questions or contradictions found

- 0082 shows the t515 recheck makes a judge say yes while admitting that non-paper-towel items are stored. The
  recheck's rule ("A request excludes only what its own words state") is wrong for item-kind narrowing.
  Decide whether to change the rule (R1a), the wording (R1b), or both.
- Revision 5 (no s9 facet) still stored the oracle's 9 rows, so on this site the seller facet changes nothing
  for these rows. The double no on revision 5 ("no step tests the seller") is still a defensible reading of
  the request.
