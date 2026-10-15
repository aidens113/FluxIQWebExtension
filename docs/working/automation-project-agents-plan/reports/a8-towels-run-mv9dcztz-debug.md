# A8 wave 7 debug: `run-mv9dcztz-f16d6b5a` (bigbox-retail-pickup-towels, candidate)

Read-only debug. No live or Lab run, no provider call, no commit.
Pair: downstream `e9c2b5f5` / Core `48b45401`. Comparison: wave 6 pass `run-mv9a48dc-36fe30e6` (Core `95cc9a7d`).
Steps: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mv9dcztz-f16d6b5a/steps/`.

## Outcome

The build reached the exact answer (all 9 oracle rows in oracle order) at **revision 7** and got no further. It was tested twice, and three of its four judge calls said no on the same false reading: rows that show "Pickup tomorrow" / "Delivery tomorrow" / shipping only, which the read had correctly left out, were called rows the request asks for, with "ready for pickup today" read as "store pickup availability, not the literal 'Pickup today'". The first test was split yes/no, so it came back unsure. The retest got two nos, which banned the exact revision (`candidate.unchanged_after_no`, steps 74 and 82). The builder then had to change a correct Flow: revision 8 put the rows in the wrong order and revision 9 kept a towel holder. Time ran out on revision 9's unsure result.

The cause is in Core, not the web domain and not the Lab. Core's no-refutation check (t607 `refuted-no/missing-claim.ts`) cannot refute this kind of no, for two reasons: (a) its "missing" pattern does not match the judges' wording ("missing qualifying rows ...", "Missing qualifying rows: ..."), and (b) where a sentence names the condition, it is exempt as "a dispute of the condition" (`disputesCondition`), even when the condition tests the request's own words, here "pickup today", and Core itself read a failing value on every row the no names. t628 did not cause this. The judge requests are the same as wave 6's, and wave 6 passed by luck (see section 2).

## 1. The nine test runs

Oracle (`apps/scenario-lab/src/scenarios/bigbox-retail/manifest/expected-values.ts`, `PICKUP_TOWEL_RECORDS`): 9 rows, VR-SAS-6DR, Loftwell Ultra 6DR, Loftwell SAS 12DR, Softerra 6DR, Hearthside 12DR, Softerra PAS 12TR, Kindleaf 4R, VR Value 15R, Hearthside SAS 8DR. Order numbers below are oracle positions.

| # | Test step (rev) | Narrowing / conditions | Stored vs oracle | Judge calls -> outcome |
|---|---|---|---|---|
| 1 | 0022 (r1) | facets ValueRidge, Today, 4&up; sponsored absent, rating>=4.5 | 12 rows: all 9 + Softerra PAS 8TR and Northmere 12R (both "Pickup tomorrow") + Loftwell holder | 0023 no, 0024 no, 0025 no (refuted-no re-ask), 0026 no -> `trial_judged_no`. Correct no. (Call 1 also said sponsored copies should be kept, which is wrong, but the verdict was right.) |
| 2 | 0032 (r3) | same facets; rating, name contains "Paper Towels", not "Holder" | 12: 9 + PAS 8TR, Northmere 12R, Tidemark 12 Mega (sponsored, ship only) | 0033 no, 0034 no. Correct. |
| 3 | 0038 (r4) | no facets; + retailer contains "ValueRidge", pickup contains "Pickup today" | 0 (retailer field read "Pickup today" on every row, a field selector the model wrote) | 0039 no, 0040 no. Correct. |
| 4 | 0054 (r5) | no facets; rating, name, Holder, pickup | the 9 oracle rows, **order 1,3,2,5,4,6,9,7,8**: no sponsored condition, so the dedupe kept the earlier sponsored copies | 0055 no, 0056 no. The verdict is right (the request asks for Best match order without sponsored listings), but the reason given was "no condition restricts to ValueRidge-sold". |
| 5 | 0060 (r6) | + sponsored absent, name contains "ValueRidge" (judge advice at 0055/0056: "e.g. name contains ValueRidge") | 2 rows | 0061 no, 0062 no. Correct. |
| 6 | **0066 (r7)** | facet ValueRidge; rating, name, Holder, pickup contains "Pickup today", sponsored absent | **exact: 9 rows, oracle order** | **0067 yes, 0068 no** -> `candidate.trial_unconfirmed` (retestsLeft 2) |
| 7 | **0070 (r7, retest, decided at 0069)** | same | **exact** | **0071 no, 0072 no** -> `trial_judged_no`; resubmits refused `candidate.unchanged_after_no` at 0074 |
| 8 | 0078 (r8) | facet ValueRidge; sponsored condition dropped (0075) | 9 rows, order 1,3,2,4..9 | 0079 no, 0080 no. Right verdict, wrong reasons: call 1 "faceted order, not Best match"; call 2 "Softerra PAS 8TR (4.7, Pickup today) ... despite their pickup value being 'Pickup today'", which is false: Core read "Pickup tomorrow". 0082 `unchanged_after_no` again. |
| 9 | 0086 (r9) | no facets; rating, pickup, sponsored (name/Holder dropped at 0083) | 10 rows: 9 + Loftwell holder | 0087 no (pickup misreading again), 0088 unknown -> `trial_unconfirmed`; then time ran out |

The false reading, quoted:
- 0068: "missing qualifying rows including ValueRidge Essentials Paper Towels, 1 Roll (4.5, pickup tomorrow), Northmere Paper Towels, 12 Rolls (4.6, pickup tomorrow) ... Relax condition 4 ... so it accepts the store's pickup availability rather than the literal "Pickup today" string".
- 0071: "Missing qualifying rows: Softerra Pick-A-Sheet Paper Towels, 8 Triple Rolls; ... Condition 4 ... and condition 5 ... left them out."
- 0072: "condition 4 ... dropped 8 rows including ValueRidge Essentials Paper Towels, 1 Roll (4.5, Pickup tomorrow) ... although the request only requires pickup today availability".
- The no at 0068 even names its own witness values ("pickup tomorrow"). Every one of these rows is in condition 4's `leftOutSettled` in the request ("each fails it, so Core settled these rows").

## 2. Correct and held unconfirmed: by which rule, and did t628 cause it?

Yes, revision 7 was correct. It was held twice, by two rules:

1. Step 0066: Core `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/agreement.ts`, `agree()`, the `first.verdict === "answers"` / `second.verdict === "does_not_answer"` branch, which returns `unsettled(..., "model_disagreed", codes.disagree, ...)` plus `refutedMark(input, [2])`. There was no re-ask:
   - `refutedMark` found no refutation. `refuted-no/weigh.ts` reads 0068's sentences, and `missing-claim.ts`'s `MISSING` does not match "missing qualifying rows including ...", so the sentence makes no claim. It names left-out rows and contains "missing" (`NEGATIVE`), so it stands. I probed the actual functions on the judges' sentences with node: every one returned `undefined`. The one sentence that matched ("were dropped by condition 4", in 0080's wording) returned `{"refuted":false}`, because `SPEAKS_OF_A_CONDITION` sets `disputesCondition`.
   - The t515 unstated-exclusion re-ask (`reaskUnstatedExclusion`) had no exclusion cue to find in 0068's advice ("Relax condition 4 ... ensure the read's page-2 pass ...").
2. Step 0070: two nos -> `trial_judged_no`. Neither no was refuted, for the same reason, so `refutedMark` with calls `[1,2]` marked nothing. Then Core's candidate gate (`candidate.unchanged_after_no`) refused the identical revision at 0074 and 0082, so the builder had to change a correct Flow.

**t628 did not cause it.** The wave 6 final judge request (wave 6 step 0059 and its re-ask 0061) and wave 7 step 0068 have byte-identical system prompts (17366 chars, no diff lines). Their user content differs only in condition order and numbering (sponsored is condition 1 in wave 6 and condition 5 here), step labels, ids and the dataset id. t628 changed only the handling after the calls (`unstatedExclusion` with `namedStoredLabels`, recheck wording, unsure-and-no weighing, `checked-rows.ts`), and none of those branches was reachable here: 0068's advice holds no exclusion cue, and neither split was unsure-and-no.

**Wave 6 passed by luck.** Its judges made the same misreading: wave 6 step 0059 said no, "Condition 5 (pickup contains "Pickup today") dropped 8 rows whose pickup was "Pickup tomorrow" ...". Step 0060 said yes. The t515 unstated-exclusion re-ask fired only because the no's advice happened to add "Also verify condition 4 ... actually excludes the holder row" (wave 6 0061 `recheck:` "advised leaving out rows by words the request never states as an exclusion: "excludes the holder row, since the endView…""). The re-ask came back yes. Wave 6's earlier exact revision (wave 6 0040, judges 0041 and 0042) was also judged no/no, on a seller misreading. So the same pair is about a coin flip on the exact answer, under either Core.

## 3. Did Next behave (t623, t626)?

Yes.
- Every trial's paging ended `stop: ended` with consistent counts: 2 pages, 22 seen (3 facets); 2 pages, 29 seen (ValueRidge facet); 3 pages, 41 seen (no facet).
- Each faceted trial's page after the trial is page 2 with every facet kept (e.g. 0066: `?q=paper+towels&facet=retailer_type:ValueRidge&page=2`, "13–23 of 23 results"), so the page number was followed rather than the filter-dropping arrow.
- The candidate's Next is `web.output.dom-next_page` with `nextPage: extraction.1` (0020 call).
- No `page_fault` appears anywhere in the steps.
- The Sort select's default "Best match" was not treated as an applied filter: there is no drop-filters warning, and nothing stopped the paging.
- The exploration itself never pressed Next (steps 0002–0018); it went straight to `submit_candidate` after `detect_repeating_structure`, which the prompt allows.

## 4. Root cause and the smallest structural fix

**Root cause (Core, result verification).** The judge prompt already tells the model that condition 4's left-out rows are settled. A no that disputes such a condition is still exempt from Core's refutation, even when:
- the condition is a positive text test whose words appear word for word in the request ("Pickup today" against "... ready for **pickup today** ..."), and
- Core read a value failing it on every row the no names.

On top of that, the attributive wording "missing <rows>" is not read as a missing claim at all. One misreading by the model then counts as a valid no, and two of them ban a correct revision.

**Fix (Core, `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`):**
1. `refuted-no/types.ts` and `refuted-no/record.ts`: give each `leftOut` row `quotesRequest: boolean`. It is true when its condition is a positive text test (contains, equals, startsWith; not negated) whose tested text `wording.says()` finds word for word in the request (`request-rows/request-wording.ts` already provides `says`), and the request puts no negation or exclusion cue just before it ("not", "rather than", "leave out", "except").
2. `refuted-no/missing-claim.ts`:
   - Widen `MISSING` to the attributive forms ("missing <noun>", "Missing ...:").
   - Where `disputesCondition` holds, still refute when every named left-out row is `settled && quotesRequest`. The finding: "condition N tests the request's own words "<text>", and Core read "<witness>" on that row".
   - Keep the exemption for a condition whose words the request does not state.
3. Optionally, a small `refuted-no/value-claim.ts`: a sentence that gives a named settled row a tested value different from Core's witness ("despite their pickup value being "Pickup today"", step 0080) is refuted.
4. With those in place, the existing `refutedMark` and `refuted-no/reask.ts` path does the rest. Step 0066's yes plus a refuted no re-asks the no. Step 0070's two refuted nos are both re-asked, and a no that is still refuted counts as unsure, not no, so `candidate.unchanged_after_no` no longer bans a correct revision.
5. Optional prompt side, generic: in `value-readings/settled-rows.ts`, when the condition's text is the request's own words, say so in `settled` (quote the request's phrase), so the yes has its quote and the no sees the clause.
6. Tests go in `refuted-no/tests/` and `tests/agreement.test.ts`. Use a fixture of a different kind of site, for example a library request "available to borrow today" against "Available tomorrow" witnesses. Never towels, pickup or this site.

**Secondary, not root:**
- Judge advice "e.g. name contains "ValueRidge"" (0055/0056) produced revision 6's 2-row regression. That is a brand-versus-seller misreading by the model and needs no new rule.
- Revision 4's retailer field selector read the pickup text, a selector the model wrote.
- No Lab defect was found.

## Commands run and observed results

- Listed and read the run folder, `steps/index.md`, every test step's `result.json`, every judge's `decision.json`, and the request text of 0055, 0067, 0068 and 0071.
- Node script (scratchpad `judges.js`): compared each judge request's `sampleRows` with the oracle. Steps 0067, 0068, 0071 and 0072 matched exactly; 0055, 0056, 0079 and 0080 had the same set in a different order; the others are as tabled.
- Diffed wave 6 0047 against wave 7 0068 (ids normalised): the system prompt is identical, and the user content differs only in condition order and numbering, step labels, ids and dataset id. Wave 6 0059 against 0061: only the added `recheck:` line.
- Node probe of `sentences.ts`, `condition-wording.ts` and `missing-claim.ts` on the judges' sentences: `undefined` ×5 and `{"refuted":false}` ×1 (output quoted in section 2). I ran it as a temporary file `zz-probe-a8w7.mts` inside Core's `refuted-no/` folder and deleted it straight after. Core `git status --short` is clean.
- `git show 349246f2` (t628) on `agreement.ts` and `unstated-exclusions.ts`, read.

## Not verified

- Whether the Lab's expected-dataset check compares row order. I did not trace the evaluator. The instruction itself asks for Best match order, which is the basis for calling trials 4 and 8 wrong.
- Exactly how the run ran out of time (the 895 s duration and the deadline source). I did not trace it.
- The proposed fix is not implemented or tested. Whether the re-asked judges would then say yes is a model outcome.
- `value-readings/settled-rows.ts` was not read; the optional prompt-side point rests on its output as quoted in the judge requests.

## Open questions or contradictions found

- The `missing-claim.ts` header says a dispute of a condition is "the judge's to weigh". This run shows that exemption also covers conditions that only restate the request's own words. The fix narrows the exemption rather than removing it.
- The `candidate.unchanged_after_no` gate turns two unrefuted nos on a correct revision into a forced regression. It is worth deciding whether a no whose rows are all Core-settled should be able to trigger that gate at all.
