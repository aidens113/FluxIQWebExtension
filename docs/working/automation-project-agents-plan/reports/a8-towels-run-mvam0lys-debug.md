# A8 frozen pair 8: debug of candidate towels `run-mvam0lys-2d3eb090` (read-only)

Run: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mvam0lys-2d3eb090`, task
`bigbox-retail-pickup-towels`, mode `candidate`, lane `fxwork/t567` (downstream
`2d32847e`, Core `f7a0c4d1`; `fxwork/t567/!FluxIQ` is at `f7a0c4d1` and clean).
Debugger: worker, read-only. No source was changed.

## Outcome

Done. The build had the right Flow at revision 3, about 2.5 minutes in, and lost it.

**Cause: general, not task-specific.** Trial 0042 (revision 3) stored exactly the
oracle's 9 rows, in order. That Flow applies the Retailer, Speed and rating facets
and has 5 conditions, which is the same shape as the scenario's own reference
workflow. Both judge calls said no, and both were wrong. Core refuted one call
completely and the other only in part. The part left standing was a sentence that
names no defect: it says the "4 & up" facet is broader than the request but that
condition 3 removes the extra rows. Core measured that facet as removing no row
(16 results before, 16 after), but the measured-step rule will not read a sentence
that also names a condition. Under the t501 rule, a partly standing no keeps the
verdict at no, so the exact revision was banned.

Everything after that point followed refuted or unrefutable judge advice:

- Revision 6 dropped the sponsored condition after the kept-condition gate's single refusal had been used up.
- Revision 7 dropped two name conditions that kept a holder out only when both applied.
- Revision 8 dropped the Retailer facet, so nothing in the Flow tests the "ValueRidge sells itself" clause any more.

The run then spent its last three trials judging revision 8 unsure, and the build
ran out of its time allowance (533 s; code `flow_bootstrap.evidence_iteration_limit`,
time limit reached).

**Q1: was t663 behind the unsure trials?** No. All three unsure trials (0068, 0072,
0081) stored exactly the oracle's 9 rows, in order. None was held by t663:

- Each one's code is `candidate.trial_unconfirmed`, which means the two judge calls disagreed (one yes, one no).
- `exclusion_evidence_missing`, `yesUnconfirmed` and the kept-row hold appear nowhere in the run.

So there is no t663 regression. Revision 8 being unsure was the right outcome even
though its rows match:

- No step or condition in revision 8 reads who sells an item, and listing tiles do not show a seller.
- The rows are right only because of how the fixture is built: its marketplace listings are shipped-only and never offer pickup (`catalog/build-product.ts`, `shippedOnly`).
- The judge calls that said no on the seller clause (0075, 0082) were right.

The first no on trial 0068 (0069) was false: it called two stored rows dropped. Core
missed that because of a gap in how it splits a sentence into clauses (cause C
below).

**Q2: were the two kept-condition refusals right?** Yes, both:

- At 0046, Core refused dropping condition 1 (`sponsored is absent`). In revision 3 it left out 4 rows by itself, and every one was another copy of a row in the result.
- At 0048, Core refused dropping condition 2 (`pickup contains "Pickup today"`). It left out 2 rows by itself, "Softerra Pick-A-Sheet Paper Towels, 8 Triple Rolls" and "Northmere Paper Towels, 12 Rolls". Core read "Pickup tomorrow" on both, which fails the request's own words. These are exactly the two item ids the oracle excludes as tomorrow-only.

**t663 and t664:**

- t663 never fired, and correctly: every yes was over rows that carry every asked-for column and name the item.
- t664 (the playback hold) was never reached, because the build never finished.

## What changed and why

Nothing changed: the brief is read-only, and this report is its only write.

### Trial by trial

Oracle: `PICKUP_TOWEL_RECORDS`, 9 rows (`apps/scenario-lab/src/scenarios/bigbox-retail/manifest/expected-values.ts`).

| Trial (rev) | Stored vs oracle | Verdict | Was the verdict right? What decided it |
| --- | --- | --- | --- |
| 0032 (r1) | none | execution_failed | Right. The first step navigated to the real domain `https://www.valueridge.com/...` and the host permission refused it (`web.browser.permission_denied`). Cost 4.5 s. A model slip specific to this task; no fix needed. |
| 0036 (r2) | 9 oracle rows + extra "Loftwell Countertop Paper Towel Holder, Bamboo" | no | Right. Both calls named the holder. |
| 0042 (r3) | **exactly the oracle, in order** | no | **Wrong.** 0043 called "ValueRidge Essentials Select-A-Size ... 6 Double Rolls" and "Hearthside Select-A-Size ... 8 Double Rolls" left out; both are stored. 0044 called "Pickup today" narrower than "ready for pickup today". Core refuted 0044 completely and 0043 in part; 0043's "4 & up" sentence stood (cause B). The verdict stayed no and the revision was banned. |
| (submits 0046-0054) | | | 0046 and 0048 refused, rightly. 0050 `unchanged_after_no` and 0052 repeat-refused, both right (a resubmit of banned revision 3). 0054 (r6) dropped condition 1 again and was accepted: the gate refuses only once per condition (cause D). |
| 0056 (r6) | same 9 labels, but rows 2 and 3 swapped (the stored "Loftwell Select-A-Size ... 12 Double Rolls" is its sponsored copy, which came first) | no | Right verdict: a sponsored listing was stored, and the order is not Best match. The calls' stated reasons were partly false. 0058 said the result "includes" two holders; none is stored, and Core matched one quoted holder to the stored "ValueRidge Essentials Paper Towels Value Pack" because the two share the start of their names (cause G). |
| 0062 (r7) | 9 oracle rows + the Countertop holder | no | Right verdict. Revision 7 had dropped name conditions 3 and 4 on 0057's advice: they "alone rejected 0 rows". They kept the holder out only when both applied (cause E). The call that named the holder (0063) had that sentence past the 500-character clip, so Core labelled the whole reading "contradicted by Core's record" (cause A). 0064's misreading stood unlabelled and was shown first: it claims the Retailer facet keeps only listings "branded ValueRidge". The builder followed it at 0065 (cause F). |
| 0068 (r8) | exactly the oracle | unsure | Right outcome, for the seller reason. 0069 said no, calling the same two stored rows "dropped" by condition 1. Core missed it (cause C) and labelled the reading only part-contradicted, over a row it had correctly said was right to leave out. 0070 said yes. |
| 0072 (r8) | exactly the oracle | unsure | Right. 0073's no was refuted completely and asked again; the re-ask (0075) said no on the untested seller clause, which Core cannot refute and which is right. 0074 said yes. |
| 0081 (r8) | exactly the oracle | unsure, retests used up | Right. 0082 said no on the seller clause; 0083 said yes. The build ended on its duration allowance two decisions later. |

### Where the time went

Total 533 s, from build start at 06:58:12 to the end at 07:07:06:

- **Exploration and the first submit:** about 76 s.
- **Eight trials:** about 397 s, of which 4.5 s was trial 1. The others took 49-59 s each, judge calls included.
- **Refused or unchanged submits:** about 32 s (0045-0055 and 0076-0080).
- **After the banned exact revision:** from 07:01:40 on, about 5.4 minutes and five trials were spent recovering a Flow the build already had.

### Causes, by owning module, with the fix and the test that proves it

**A. Core weighs a judge's reading after cutting it to 500 characters (general).**

- **Where:** `llm/harness/provider-result.ts:167-172` (`readDiagnosisText`) hands every consumer the clipped text, and `refuted-no/weigh.ts` weighs only the first roughly 489 characters.
- **What happened:** 0063's true reason was cut: "the read kept ... 'Loftwell Countertop Paper Towel Holder, Bamboo' ... is in the stored rows". Core refuted the visible half and marked the reading "contradicted by Core's record", so it refuted text it never read.
- **Proof:** a replay through Core's own functions with the same clipping reproduced every live label. Without clipping, the labels differ.
- **Fix:** keep the judge's full text beside the clipped one (for example `judgement.observedWhole` and `adviceWhole`), and weigh the full text in `weigh.ts`. At minimum, a clipped reading must never be wholly refuted, because its unread part stands.
- **Test:** a new `refuted-no/tests/clipped-reading.test.ts`. A no whose first 480 characters hold only refuted claims, and whose text past 500 says a stored row is the wrong kind, must weigh `wholly: false`. The agreement must label it "contradicts part", not "contradicted".
- **Caution:** ship together with C. Without clipping, 0043's condition-1 sentence is no longer refuted, because the "4.5+" written after the Hearthside label blocks the row match.

**B. A sentence blaming a step Core measured as removing no row stands when it also names a condition (general, the root cause).**

- **Where:** `refuted-no/unseen-row-claim.ts:218` refuses any sentence that names a condition; then `weigh.ts:133` lets it stand on `NEGATIVE` ("excludes", "not").
- **What happened:** 0043's sentence was: "But the '4 & up' rating filter (…s10) keeps 4.0-4.4 items the request excludes, and the read's condition 3 correctly drops them; conversely the site filter's count (16) is not the request's cohort." Step s10 chose "4 & up" in "Customer Rating", `addedChoice: true`, 16 results before and 16 after. Core measured that it removed, and so added, no row, which means nothing it "keeps" can be wrong.
- **Fix:** weigh the "is it standing" test per clause, not per sentence. Cut at "; " and ", and " outside quotes, using `automationStudioResultRowClauses`' splitter. A clause naming only steps Core measured as removing no row, and blaming them, is refuted by `automationStudioResultNarrowingStepClaim`. A clause that names a condition with no negative word ("condition 3 correctly drops them") is not a reason. A clause naming nothing ("the count is not the cohort") rests on its neighbours. With this fix, 0043 and 0044 would both have been wholly refuted, so both would have been asked once more (`agreement.ts:762`) instead of the no standing.
- **Test:** `refuted-no/tests/narrowing-step-clause.test.ts`, with a generic site. The sentence "But the 'X & up' filter (<node>) keeps items the request excludes, and the read's condition 3 correctly drops them" is refuted when that step measured 16 to 16 with an added choice, and stands when it measured 32 to 23.

**C. A "left out" claim about stored rows goes unread when one clause of the sentence names no row (general).**

- **Where:** `refuted-no/missing-claim.ts:134-135`. `storedOnly` requires every `left_out_by` clause to name a stored row.
- **What happened:** 0069's sentence was "condition 1 dropped rows that are …: eg <stored A> (…) and <stored B> (…) — these are …". Its colon-ended lead clause names no row, so nothing was refuted, and the no stood as a reason over trial 0068. 0043 has the same shape when read unclipped: a trailing clause "; the request only says to leave out …" names no row.
- **Second gap:** `named-rows.ts:120-127` (`valuesAgree`) checks the text all the way to the next mention, so a number in the judge's own reason ("4.5+") un-names a row the judge spelled in full.
- **Fix:** in `storedOnly`, consider only `left_out_by` clauses that name a row or an unmatched quote, and require at least one. Apply `valuesAgree` only to a mention that names a row by a prefix of its label, never to one that spells the whole label.
- **Tests:** in `refuted-no/tests/missing-claim-copy.test.ts`, the colon form and the trailing-clause form are refuted with "another copy of it was kept", and the same sentence over a left-out row Core did not settle stands. In the named-rows tests, a whole label followed by "— both are …, 4.5+ …" still names its stored row.

**D. The kept-condition gate refuses only once, even when the reading being followed was refuted on that very condition (general; a design decision).**

- **Where:** `standing-no/kept-condition-drop.ts:35` (`refused`): "Core refuses this once, not twice".
- **What happened:** 0054 dropped condition 1 because "the sponsored-absent condition drops real products". That is 0043's claim, which Core had already refuted on that condition's own rows. The cost was revision 6 and trial 0056.
- **Proposed fix:** keep refusing while every no that asked to change the condition was refuted on that condition's rows. Keep the one-time override only where an unrefuted reason names the condition. This changes t641's "a hint the model can override, never a block", so the supervisor should decide it.
- **Test:** a kept condition whose only critics were refuted is refused again on resend; one with a standing critic is accepted on resend.

**E. Conditions that left a row out only together are not kept (general).**

- **What happened:** in revision 6, name conditions 3 (`contains "Paper Towels"`) and 4 (`not contains "Holder"`) each left out 0 rows by themselves. Together they kept "Loftwell Countertop Paper Towel Holder, Bamboo" out. 0057 advised removing both because they "alone rejected 0 rows". The gate keeps only conditions that leave rows out by themselves (`standing-no/kept-conditions.ts`), revision 7 dropped both, the holder came back, and trial 0062 was spent.
- **Fix:** where the read names its together rows (t655, `together`), keep a set of conditions whose every together row Core accounts for. Here that means a member tests the request's own words and Core read a value that fails them ("paper towels"), or the row is also in the result. `kept-condition-drop.ts` then refuses a plan that drops every member of such a set.
- **Test:** a together set {3,4} whose row fails condition 3's request words: dropping both is refused, dropping one is accepted.

**F. A no that blames a facet whose chosen option is in the request's own words is followed unweighed (general).**

- **What happened:** 0064 claims the Retailer facet (s8, chose "ValueRidge" in "Retailer", 32 results to 23) keeps only listings "branded ValueRidge". Core cannot refute this: 9 rows were removed that no read saw, and so 0064 rightly stood. But the option is in the request's own words ("that ValueRidge sells itself"), which is the test t655 already applies to an unsure call's doubt (`unsure-doubts/narrowing.ts`). The builder removed the facet, and nothing in the Flow has tested the seller clause since.
- **Fix:** extend the t655 narrowing re-ask to a no that blames only such steps, asking it once more with the request's words and the options the step left out (here none). This only re-asks; it never refutes, because Core did not measure the removed rows. Also add a kept-step hint (`standing-no/kept-steps.ts`, beside the kept conditions): dropping a facet whose chosen option passes the request-text test is refused once, naming the request clause no other step or condition reads.
- **Test:** a no blaming only a step that chose a request-words option is marked `about: "narrowing"` and re-asked. A plan dropping that step after such a no gets the hint once.

**G. A quote of a row that is not stored matched a stored row by a shared name prefix (general, secondary).**

- **What happened:** 0058's quote "ValueRidge Essentials Paper Towel Holder, Brushed Steel" was named as the stored "ValueRidge Essentials Paper Towels Value Pack, 15 Rolls". The naming pools (`refuted-no/record.ts:111`) hold read labels and stored labels, but not the rows the read left out together, so the prefix that distinguishes them is too short.
- **Fix:** add `togetherLabels` and the seen labels to the pools.
- **Test:** a stored "<Brand> Line Paper Towels Value Pack" beside a together-left-out "<Brand> Line Paper Towel Holder": a quote of the holder names no stored row.

**Not a Core defect:** trial 1's real-domain navigation (task-specific model slip, 4.5 s). The "ran out of time" wording is also correct: it is the duration allowance `BUDGET_WORDS.duration` (`conversations/commands/progress.ts`).

## Commands run and observed results

- **Step index, `summary.json` and per-step `meta.json` timings, read with Python.** Build start 06:58:12; it ended at 07:07:06 with `build throw ms=533422 ... code=flow_bootstrap.evidence_iteration_limit` (`logs/core.log`).
- **`python -I scratchpad/towels-0lys/dump.py <run> trials.txt`.** For each trial: verdict, revision, code, conditions, narrowing, and the stored names (from the next judge request's `sampleRows`) compared with the oracle. Result as in the table: r3, r6 (order swapped) and r8 hold the oracle's 9 labels; r2 and r7 add the holder.
- **Search for `exclusion_evidence_missing`, `yesUnconfirmed` and `kept-without` across steps and logs.** No match.
- **`git log -1` in `fxwork/t567/!FluxIQ`.** `f7a0c4d1 docs: ledger t663 and t664`, 0 dirty files.
- **`node vite-node.mjs --root packages/fluxiq scratchpad/towels-0lys/weigh-clip.ts <run> <judge steps>`** (Core's own vite-node, Core `f7a0c4d1`). This replays `automationStudioResultNoRecord` and `automationStudioResultRefutedReading` on each judge's real `resultSummary` and its `observed`/`changed` text clipped to 500 characters. Observed: 0043 `WHOLLY=false`, with findings for VR Select-A-Size and Hearthside Select-A-Size ("another copy of it was kept") and the "4 & up" sentence standing. 0044 `WHOLLY=true`. 0063 `WHOLLY=true`. 0069 `WHOLLY=false`, with a Softerra finding only and the condition-1 sentence `claims=none`. 0073 `WHOLLY=true`. 0075 and 0082 `WHOLLY=false`, with no findings. All of these match the live labels.
- **The same replay without clipping (`weigh.ts`).** 0043's condition-1 sentence names only one stored row and makes no claim. This is how the clip was identified.
- **`debug.ts` on 0043 sentence 2 and 0058 sentence 0.** 0043: clauses `[left_out_by] <rows>`, then `[left_out_by] the request only says …` (no rows), and `missing: undefined`. 0058: the holder quote named "ValueRidge Essentials Paper Towels Value Pack, 15 Rolls".
- **`clauses.mts`** (`automationStudioResultRowClauses`) on 0043 and 0069. 0069's split is `[left_out_by] But condition 1 dropped rows … items:` followed by `[left_out_by] eg <A> … and <B> …`.

## Not verified

- I did not run any proposed fix. "0042 would have been asked again, and could then have passed" is reasoning from `agreement.ts:762` and the replay, not a measured result; a re-ask may still say no.
- The replay feeds Core the judge-facing `resultSummary` from the request. That it equals the summary the live verify used is an inference from every label matching, not a check.
- I did not check whether the Lab's expected-dataset comparison is order-sensitive. The rev 6 verdict is judged against the request's "in the order the results show them under Best match" and the stored sponsored copy.
- Whether `name contains "Paper Towels"` passes Core's request-text test (needed for E): I did not run it; the debug output did not show conditions 4 and 5.
- No UI or screenshot review.

## Open questions or contradictions found

1. **Yes calls ignore the seller clause.** Revision 8's yes calls (0070, 0074, 0083) never address "that ValueRidge sells itself", and nothing holds a yes for a request qualifier that no step, condition or column reads. t663 covers asked-for columns and the item phrase, not qualifiers. Should a yes be held where a request clause has no reader in the Flow? I did not propose it as a fix because I don't see a general measure that avoids matching words. Raising it because "never weaken what a yes must prove" seems to call for one.
2. **The t641 one-time override (D) is a stated design principle.** Changing it needs the supervisor's decision.
3. **A and C pull against each other.** Weighing the full text (A) without C would have left 0043 standing on its condition-1 sentence: the clip hid the "4.5+" and the trailing clause that block the refutation.
4. **The agreement orders unrefuted readings first** (`bothReadings`). In 0062 this put 0064's misreading ahead of 0063, whose real defect was clipped away. Once A is fixed, check that the builder sees the reading that names the stored wrong-kind row first.
