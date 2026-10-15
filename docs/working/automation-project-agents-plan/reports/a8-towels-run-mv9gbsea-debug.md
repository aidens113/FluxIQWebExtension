# A8 wave 8 debug: bigbox-retail-pickup-towels, run-mv9gbsea-ae3c2fb8

Read-only. No commit, no live or Lab run, no provider call.
Pair: downstream `003c3353`, Core `be766f29` (after t629).
Evidence: run folder `fxwork/t563/!FluxIQWebExtension/test-runs/instances/a8-slot-1/run-mv9gbsea-ae3c2fb8/`,
steps `lab-runs/2026-10-15/run-mv9gbsea-ae3c2fb8/steps/`, oracle
`apps/scenario-lab/src/scenarios/bigbox-retail/manifest/expected-values.ts` (`PICKUP_TOWEL_RECORDS`),
`manifest/pickup-towels-workflow.ts` and `catalog/paper-towels.ts` in the t563 tree.

## Outcome

Done. The false yes is a filter-semantics miss, not a Core refutation. The Flow used the
site's "Pickup" (Fulfillment) and "Today" (Speed) facets to stand for the request's
"ready for pickup today". Those facets apply to a row independently, so two listings whose
own tile reads "Pickup tomorrow" and "Delivery today" passed both. The read had no condition
on the row's own pickup line. All three judges that looked at the accepted Flow said yes
without being asked to. No judge ever said no about the two extra rows. t629, t607, t515
and t628 did not take part: no "no" was refuted, re-asked or labelled anywhere in the run.

## 1. The 11 stored rows against the oracle's 9

The stored rows, quoted from the final verification request
(`0041-judge/request.txt`, `resultSummary.recordSets[0].sampleRows`), in order:

1. ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls ($8.97, 1.2 ¢/sheet, 4.6)
2. Loftwell Ultra Strong Paper Towels, 6 Double Rolls
3. **Softerra Pick-A-Sheet Paper Towels, 8 Triple Rolls ($19.97, 1.3 ¢/sheet, 4.7): EXTRA**
4. Loftwell Select-A-Size Paper Towels, 12 Double Rolls
5. Softerra Paper Towels, 6 Double Rolls
6. Hearthside Paper Towels, 12 Double Rolls
7. Softerra Pick-A-Sheet Paper Towels, 12 Triple Rolls
8. Kindleaf Unbleached Paper Towels, 4 Rolls
9. **Northmere Paper Towels, 12 Rolls ($13.97, $1.16/roll, 4.6): EXTRA**
10. ValueRidge Essentials Paper Towels Value Pack, 15 Rolls
11. Hearthside Select-A-Size Paper Towels, 8 Double Rolls

With rows 3 and 9 removed, the list is the oracle exactly, in the same order and with the
same values. The evaluation shows `matchedInAnyOrder: 9` and `presentFields 36/36`. The
positional `matchedRecords: 2` is only the shift caused by row 3.

**Why the two rows are wrong.** The catalog comment on both reads "home store has it
tomorrow, but delivers today, so 'Today' as a speed still lists it" (`catalog/paper-towels.ts`,
ids 433201876 and 470665371). The workflow manifest leaves them out by id as
`PICKUP_ONLY_TOMORROW`, and explains: "'Today' counts delivery too". The tiles say so
directly. The endView of `0026-tool-core.test_candidate/page.txt` shows Northmere as
`t1411 "Pickup tomorrow"` and `t1412 "Delivery today"`.

**Why the Flow kept them.** Revision 2 (`0023-decide`) narrows the results only with
`choose the Pickup fulfillment filter` and `choose the Today speed filter`. Its `where` has
five conditions: sponsored absent, name contains "Paper Towels", not Holder, not Dispenser,
and rating atLeast 4.5. None of them reads the tile's pickup line. The builder had that
column available. The structure detection at step 0014 offered
`"label": "text: 'Pickup today'", "coverage": 1` (key `div_css-0gz65eu_div_1`). The page it
detected on (step 0012) already showed two "Pickup tomorrow" tiles. The filter steps were
written straight into the candidate at step 0017 and never explored one by one.

## 2. Every judge call, and whether Core touched a "no"

There were 18 calls: 1 chat, 12 decide and 5 judge. There was no re-ask call.
`grep -ril "refut|reask"` over every step file and the run folder found nothing.

| Step | Revision | Answer | What it said |
| --- | --- | --- | --- |
| 0021 | 1 (16 rows) | no, 0.6 | Named holders and dispensers and rows rated 4.3, 4.2, 4.4 and 4.1. Did not name Softerra 8 Triple or Northmere. |
| 0022 | 1 | no, 0.6 | Same as 0021. Trial 0020 returned `candidate.trial_no`. These were correct nos, left standing. |
| 0027 | 2 (accepted, 11 rows) | yes, 0.7 | "the request asks for products 'that my store can have ready for pickup today' — the Today speed filter is the request's own clause, so that is fine." |
| 0028 | 2 | yes, 0.9 | "The filters applied before the read (ValueRidge retailer, Pickup, Today) match the request's own clauses". |
| 0041 | final run verification | yes, 0.7 | "Filters match request clauses: ValueRidge retailer, Pickup, Today ... No required row shown missing." |

Trial 0026 returned `"verdict": "yes"`, with feedback "The trial was judged twice to do what
the instruction asks." Step 0029 completed revision 2.

**Did t629 cause this?** No. `missing-claim.ts` (t607/t629), `value-claim.ts` (t629), and the
t515 and t628 paths all act only on a judge's "no". The accepted Flow received no "no" at
all. The only nos (0021, 0022) were on revision 1 and stood. None of them named an extra row.

The judges had the evidence and missed it:

- In 0027 and 0028, the startView at request line 254 shows Softerra 8 Triple `t196 "Pickup tomorrow"`.
- In 0027 and 0028, the endView at line 1229 shows Northmere `t135 "Pickup tomorrow"`.
- In 0041, the endView at line 1024 shows Northmere `t135 "Pickup tomorrow"`.

The stored rows carry no pickup column, so a judge could only catch this by matching a row
label to a line of a page view by hand.

## 3. Did Next behave?

Yes. Step 0038 `web.dom.next_page` returned `"actual": "moved by following"`. That is
`follow-next.ts` following the numbered page after the current one, which keeps every
filter. It landed on `...facet=retailer_type:ValueRidge||fulfillment_method:Pickup||fulfillment_speed:Today&page=2`.
The site's own "Next page" arrow would have dropped the facets
(`~?q=paper%20towels&page=2`).

Step 0040 returned `"ended: control_absent"`. The read account records `pagesRead: 2`,
`stop: ended` and `keptPerPage: [8, 3]`, with no truncation. The authored next selector,
`nav > a:nth-of-type(4)`, is positional, but the follow-the-numbered-page logic made the
move correct.

## 4. Root causes and the smallest structural fix

**Root cause A (builder).** The Flow treated two independent site facets, whose words
together look like one clause of the request, as that clause. Each facet held on these rows
for a different reason: Pickup was offered at all, and Today applied to delivery. The read
had no row-level check of the clause.

**Root cause B (judge and Core evidence).** Two things combined:

- The judge instruction says "A step whose words keep exactly what a clause of the request
  asks for ... is correct" (`runtime/llm/diagnosis-instructions.ts`,
  `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`).
- The `narrowedBefore` guidance (t482) and the trial feedback's `BEFORE_READ` sentence
  (`runtime/service/candidate-trial/reads.ts:40`) cover only a step that keeps *less* than
  the request asks.

Nothing covers a narrowing step that keeps *more* than the clause. Nothing Core measured put
a kept row's own contrary words in front of the judge either. So a filter that looks like it
says the clause was taken as proof.

**Smallest structural fix (mechanical, cross-repo).**

1. Domain, `apps/extension/src/content/extraction/` (the extract_list read): for each kept
   row, also return the values of the detected text columns that the read does not store.
   These are the same per-item columns `detect_repeating_structure` reports, such as
   `div_css-0gz65eu_div_1`. Screen them with the existing evidence screen, as a
   condition's own read already is (`read-account/condition.ts`, `foundText`).
2. Core, new `runtime/result-verification/request-rows/kept-against-request-words.ts`,
   exported through `request-rows/index.ts` and carried by `result-summary.ts`:
   1. For each such column, find the values that run word for word in the request. Reuse
      `request-wording.ts` `says` and the cue screen from `refuted-no/request-text-test.ts`.
   2. When at least one kept row's value is one of these, name every other kept row whose
      value in the same column differs and is not said by the request. This is
      `keptAgainstRequestWords`, recording the row, the column, its value and the request
      phrase.
   3. Treat it the way `leftOutNamingTheItem` is treated: a yes that does not name each such
      row with a quote of the request words admitting it is not taken as a yes. Show the same
      list in the trial feedback (`candidate-trial/reads.ts`), so the builder adds a read
      condition `<column> contains "<request phrase>"`.

   With the condition added, t629's `request-text-test.ts` then recognises it as testing the
   request's own words and settles its left-out rows. That protects the exact answer from a
   false no.
3. A secondary, abstract converse of t482 in the judge instruction and in `BEFORE_READ`:
   "A step, or several steps, whose words look like a clause of the request can still keep
   rows the clause excludes, when each holds on the row for a different reason. The clause
   holds only where the row's own words say it."

   Any example must use another kind of site. Examples include a restaurant list filtered by
   "Dine-in" and "Open late", where "Open late" counts delivery hours, or a hotel list
   filtered by "Free cancellation" and "Pay later" for separate rooms. The example must never
   be a store, pickup, delivery or towels.

**No t629 over-reach.** No t629 rule fired, so there is nothing to narrow there.

## Commands run and observed results

- `cat evaluation.json`: `"oracleVerdict": "failed"`, `"reportedVerdict": "passed"`,
  `expectedRecords 9`, `observedRecords 11`, `matchedRecords 2`, `matchedInAnyOrder 9`.
- `cat steps/index.md`: 41 step folders and 18 LLM calls, matching the step kinds listed above.
- `sed`/`grep` over `0021`, `0022`, `0027`, `0028`, `0041` judge responses and requests:
  the verdicts and quotes above. `grep -c "Pickup tomorrow"` gives 3 in 0021 and 0027, and
  1 in 0041.
- `grep -ril "refut|reask"` over the step folders and the run folder: no matches.
- `0038`/`0040` next_page `result.json`: "moved by following", then "ended: control_absent".
- Read the Core modules `narrowed-before.ts`, `refuted-no/request-text-test.ts`,
  `missing-claim.ts`, `value-claim.ts`, the `read-account/condition.ts` header and
  `diagnosis-instructions.ts`. I read these to cite them; I did not change them.

## Not verified

- I did not prove that the domain extract result can carry unstored detected columns without
  a wire-protocol change. It probably needs one: the shared protocol types, the domain
  gateway mapping and the docs.
- I did not open the extension's extract code beyond grepping for `follow-next.ts`.
- I did not check what t515 and t628 do beyond their headers. They are no-handling paths and
  no "no" existed on the accepted Flow.

## Open questions or contradictions found

- Did the 12-call builder explore the filters at all? Steps 0002–0012 were dismissals and the
  search. The filter clicks appear first in the submitted candidate at step 0017. A rule that
  a filter is tried live before it is written into a Flow would have shown a filtered page
  with a "Pickup tomorrow" tile, but that is the builder's choice, not a Core check.
