# A8 debug: bigbox-retail pickup-towels (project mode), run-mv96rz6d-745e2940

This was a read-only debug. Nothing was committed, no Lab or live run was started and no provider was called. Pair: downstream `9f362856`, Core `72487d26` (t565 tree).
Evidence: `lab-runs/2026-10-14/run-mv96rz6d-745e2940/steps/` (the step numbers below are its folders) and `fxwork/t565/!FluxIQWebExtension/test-runs/instances/a8-slot-2/run-mv96rz6d-745e2940/` (summary.json, evaluation.json).

## Outcome

The cause is found. **The build had the exact right answer at step 0051, its 2nd trial, about $0.05 into the run. Core's verification gate would not confirm it,** and everything after that step was regression driven by wrong judge readings.

- Revision 2 of `find_paper_towels` stored exactly the oracle's 9 rows, in the oracle's order, with the same name, price, unitPrice and rating. Its trial ended `unsure` (`candidate.trial_unconfirmed`). Core refuted both "no" judgements. All four re-asks then answered yes, but the per-row quote gate held each yes, because none of them named, one by one, the 9 rows that a **text** condition (`pickup contains "Pickup today"`) alone left out.
- The same exact Flow was re-tested at step 0073 and ended `unsure` again for the same reason.
- The builder then followed wrong judge advice: it filtered by brand instead of seller, and it dropped the 4 & up filter. It ran out of allowance. Three repair briefs never got back to the right answer.
- At step 0161 the supervisor ended with `complete` / `ended: partial`. The Lab recorded `lab.chat_build_failed` (evaluation `runtime.behavior`, `flowCreated: false`). The run made 162 steps and 92 LLM calls and spent $0.176 of $0.25.

## How far it got

| Stage | Steps | Result |
| --- | --- | --- |
| Plan | 0006 `project.write_plan` | ok. One part `p1`, one subflow `find_paper_towels` (not callable), `lastingActs: []`, `notAsked` cart/store/sign-in. |
| Build, brief-1 | 0008 dispatch, steps 0009-0084 | `partial`, `llm_budget.run_cost_limit`. Allowance $0.1147, spent $0.0962, 46 calls, 5 revisions, 5 trials (no, unsure, no, unsure, no). |
| Repair, brief-2 | 0086, steps 0087-0101 | `blocked`, `flow_bootstrap.evidence_repeat_without_progress` (`llm_evidence_loop.repeat_refused` 3 in a row). Allowance $0.0547, spent $0.0120, 7 calls. |
| Repair, brief-3 | 0103, steps 0104-0135 | `partial`, `llm_budget.run_cost_limit`. Allowance $0.0483, spent $0.0354, 18 calls. Trials: no (0122), unsure (0132). |
| Repair, brief-4 | 0137, steps 0138-0160 | `partial`, `llm_budget.run_cost_limit`. Allowance $0.0303, spent $0.0227, 13 calls. Trials: no (0148, 19 rows), no (0158, 18 rows). |
| Assembly / whole test | none | Never reached, because no proposal passed its trial. |
| End | 0161 supervisor `complete` | "ended": "partial": "No proposal passed its trial, so no Flow could be assembled and tested." Lab: `lab.chat_build_failed`. |

## Filter controls: found, and chosen correctly

- **The page view showed `group=` for every facet** (step 0017): `t427 checkbox "Paper Towels (28)" unchecked group="Department"`, `t435 "Pickup (20)" group="Fulfillment"`, `t446 "Today (16)" group="Speed"`, `t454 "ValueRidge (23)" group="Retailer"`, `t477 "ValueRidge Essentials (5)" group="Brand"`, `t482 "4 & up (32)" group="Customer Rating"`.
- **The model picked the right members.** Revision 1 (0029) used Retailer `t454` (not Brand `t477`, which shares the word ValueRidge), Speed `t446` and Rating `t482`. Revision 2 (0049) added Department "Paper Towels" (`t981`, the same box re-printed). It never ticked Fulfillment "Pickup". Instead the read carried the condition `pickup contains "Pickup today"`, which is stricter and more correct, because the site's "Today" counts delivery too. Sponsored rows were left out with `sponsored is absent`, and ratings with `rating atLeast 4.5`.
- **It never exercised the filters or Next while exploring.** It wrote them from handles it had never pressed. In every trial the Flow's `web.output.dom-next_page` followed the site's **Next arrow, which drops every filter** (`pages/results-pagination.ts`). Pages 2 and 3 were read from the unfiltered search: the end view is `URL ~?q=paper%20towels&page=3` with `t67 checkbox "ValueRidge (23)" unchecked group="Retailer"` (0052 request, lines 1207-1265). Every trial reports `pagesRead: 3, itemsSeen: 41`.
- Revision 2 still came out exact by luck of the data. The qualifying rows on the unfiltered pages 2 and 3 were exactly the remaining filtered ones, because the pickup, rating and sponsored conditions removed the marketplace and tomorrow-only items.
- **This is the cause the candidate-mode run shares.** `a8-towels-run-mv96rz68-debug.md` attributes 6 of its 8 extra rows to the same filter-dropping Next. Here the read's own pickup condition masked the defect in the stored rows. It did not mask it in the judges' evidence: the end view showing Retailer unchecked fed the "not ValueRidge-sold" readings below.

## Judges, trial by trial

The oracle answer (`expected-values.ts` `PICKUP_TOWEL_RECORDS`) holds 9 rows, and includes Loftwell, Softerra, Hearthside and Kindleaf products, which ValueRidge sells as the retailer.

| Trial | Stored | Judge calls | Right? |
| --- | --- | --- | --- |
| 0031 rev 1 (no Department filter) | 10 = the 9 expected + "Loftwell Countertop Paper Towel Holder, Bamboo" | 0032 no: "Kept rows include non-ValueRidge brands (Loftwell..., Softerra..., Hearthside..., Kindleaf...), which the request excludes as not sold by ValueRidge itself". 0033 no: the holder "is a paper towel holder, not a pack of paper towels". | **0032 wrong** (it took brand for seller). **0033 right.** The verdict no is right, but 0032's advice ("a seller/brand field equals ValueRidge") planted the brand error. |
| 0051 rev 2 | **9, exact** | 0052 no and 0053 no: condition 1 "dropped six rows the request asks for". Those six are sponsored copies of products whose organic listing **is** stored. Core refuted both ("...is in the stored rows"). Re-asks: 0054 yes (0.9), then the quote recheck 0055 yes (0.9); 0056 yes, then the quote recheck 0057 yes (0.9). All four were held by the quote gate. Verdict **unsure**. | **0052/0053 wrong. 0054-0057 right. The gate was wrong to withhold confirmation.** |
| 0061 rev 3 (facets dropped, `name contains "ValueRidge"`) | 2 | 0062/0063 no: condition 5 "alone left out 7 qualifying rows". | Right. |
| 0073 rev 2 re-tested | 9, exact | 0074 no, 0075 no (refuted). Re-ask 0076 no that stood: "step s9 filtered to '4 & up (32)', a 4-stars-and-up bound, not the request's 4.5". Re-ask 0077 yes, then quote recheck 0078 yes, held. **unsure**. | **0076 wrong**: "4 & up" keeps more than 4.5, and the prompt flags only steps that keep *less*. 0077/0078 right. |
| 0082 rev 5 (no 4 & up) | 9, exact | 0083 no: "Kindleaf Unbleached ... is not a ValueRidge-sold item, and the read did not preserve Best match order". 0084 no: "includes sponsored rows ... omits ... ValueRidge Essentials Select-A-Size". Core's `checked` marks 0084's reading "the check misread". | **Both wrong.** 0083's brand-for-seller claim was left standing, so the verdict was no. |
| 0122 brief-3 rev 2 | 9, exact | 0123 no: "Loftwell Ultra Strong ... and Hearthside Select-A-Size ... missing" (refuted, they are stored). 0124 no: "brands other than ValueRidge. The endView shows the Retailer 'ValueRidge (23)' checkbox unchecked". | **Both wrong about the result.** 0124 saw a true symptom (Next dropped the filter) and drew the brand conclusion from it. It stood, so the verdict was no. |
| 0132 brief-3 rev 3 (no sponsored condition) | 9, but Select-A-Size before Ultra Strong | 0133 yes, then quote recheck 0134 yes, held (as "could not be told"). 0135 no. **unsure**. | The order is wrong against the oracle, because a sponsored copy came first. That made "no" right in substance, but 0135 gave a different reason, and its advice ("keep only rating atLeast 4.5") was wrong and misled brief-4. |
| 0148 / 0158 brief-4 | 19 / 18 | All no. | Right (holder, tomorrow-only and sponsored rows got in). |

Exactly correct results were therefore stored five times (0051, 0073, 0082, 0122, and 0132 except for order). None was confirmed.

## Root causes

### 1. Core: the quote gate does not settle text-condition rows Core itself read (primary)

`result-verification/value-readings/settled-rows.ts` settles only numeric bounds and presence tests: "a row of a text condition is not settled, and is still quoted for row by row".

Condition 2 (`pickup contains "Pickup today"`) left out 9 rows. Each had a witness in `leftOutObservations` (`value: Pickup tomorrow`, `Shipping, arrives Mon, Sep 28`, `Delivery tomorrow`), which is exactly what the condition fails on. The yes answers quoted the request once ("ready for pickup today") and did not list the 9 labels, several of which share long prefixes. The gate held the yes in 0054, 0055, 0056, 0057, 0077, 0078, 0133 and 0134.

In `refuted-no/reask.ts`, a re-ask that "did not come back usable" counts for nothing, and "it is never a yes", so both trials of the exact Flow ended `unsure`. This is the same failure t574 and t599 fixed for bounds and presence tests, now on a text test.

**Fix.** In `settled-rows.ts`, also settle a row of a text condition (`contains`, `startsWith`, `endsWith`, `matches`, or a string `equals`, possibly negated) when its aligned witness has `state: "present"` and a `value` for which `automationStudioRecordConditionHolds(condition, value)` is false. Use the same sentence: a yes quotes once, in a sentence naming the condition, the request's words for it. `request-rows/unquoted-rows.ts` already honours `leftOutSettled`. Add tests in `value-readings/tests/`.

Caveat: a text condition can encode the request wrongly (revision 3's `name contains "ValueRidge"`). The quote-once check, plus showing the judge each row's tested value, is what still guards that. This is the same trust t574 gives bounds.

### 2. Core: the judge is not told that a left-out row is also stored

Condition 1's `leftOutOnlyByThis` listed six product labels whose sponsored copy was left out while their organic copy was stored (0052 request, lines 435-445). Judges 0052, 0053, 0084 and 0123 read these as products the Flow dropped. Core already knows this, because `request-rows/checked-rows.ts:120` appends " (also in the result)", but only to its after-the-fact `checked` notes and never to the evidence the judge reads.

**Fix.** Where the judge's read account says the left-out rows (`request-rows/summary-reads.ts`, or `summary-with-row-ids.ts`), mark each row whose label equals a stored row's label (the same `inResult` set). One way is a separate `leftOutAlsoStored` list with the sentence "another listing of this item was kept and is in the stored rows". This would have removed the two refuted nos on every exact trial, and 0084's standing no.

### 3. Web domain: `next_page` follows a Next arrow that drops the list's filters (shared with run-mv96rz68)

`apps/extension/src/content/extraction/page-advance/follow-next.ts` swaps Next for the pager's following page only when Next leads back to this page or has no address. Here Next had an address that kept `q` and `page` and dropped `facet`. The move reports success (`moved by next`), pages 2 and 3 are unfiltered, and Core's `narrowedBefore` still says the filters narrowed the read. The judges then saw an end view with every facet unchecked, which is where 0124's and 0083's "not ValueRidge-sold" came from.

**Fix (site-independent).** When Next has an address, and the pager shows a following numbered control whose address keeps query parameters of the current page that Next's address drops, follow the numbered control (`by: "following"`). Add the comparison as a helper under `extraction/pager-reading/`, with tests in `page-advance/tests/`. Optionally, have the `moved` answer report which address parameters a move dropped, so Core's read account can say that the narrowing no longer held after pass N.

### 4. Model errors with no product fix proposed

- Brand taken for seller: 0032, 0083, 0124. Partly fed by cause 3; the tiles carry no seller words.
- "4 & up" read as narrower than 4.5: 0076.
- Brief-2's repair submitted handles that do not exist on the page (`t4`, `t6`, `t7`, `t8`, refused at 0089 `web.handle.unknown`) while on the home page. It then repeated the same navigation until `repeat_refused` ×3 ended it. The guards worked as designed.

No guidance mirroring this task is proposed. Causes 1 and 2 would have confirmed step 0051 even with these model errors present.

### Lab

No Lab defect found. The oracle, the variant and the budget accounting behaved as specified. The per-brief allowances shrank from $0.115 to $0.055, $0.048 and $0.030, and $0.074 was held back for assembly and the whole test, which were never reached.

## What changed and why

Nothing in the product changed. This report is the only file written. Scratch scripts are in the session scratchpad (`w6d-*`).

## Commands run and observed results

- `python a8-summary.py run-mv96rz6d-745e2940` printed the 4 dispatches and their outcomes, as in the table above.
- Python scripts (`-I`) over `steps/*/call.json`, `result.json`, `decision.json`, `response.txt` and the judge `request.txt` files extracted the Flow scripts, the trial feedback, the stored rows, and each judge's answer and recheck words. The quotes above come from them.
- grep over the Core source (`settled-rows.ts`, `reask.ts`, `checked-rows.ts`, `feedback.ts`) and the extension source (`follow-next.ts`, `numbered-page.ts`, `step-page.ts`), and over the scenario (`results-pagination.ts`, `pickup-towels-workflow.ts`, `expected-values.ts`, `live-tasks.ts`).

## Not verified

- I did not run the oracle comparison. That revision 2 would pass is inferred: the stored names, prices, unitPrices and ratings are equal to `PICKUP_TOWEL_RECORDS` in order. I did not check how a numeric `rating` (valueType number) is rendered against the oracle's string "4.6".
- Which call in each trial was held by the quote gate is inferred from the order of the steps and the recheck words ("Your affirmative judgement lacked required exclusion evidence"). I did not trace it through Core's code path.
- None of the fixes was prototyped or tested.

## Open questions or contradictions found

- Core's `narrowedBefore` and `pagingNote` tell judges to trust Core's page record ("a judge's reading that says otherwise about pages is mistaken"). In this run the page record was technically true but semantically false: the 3 pages read were not the filtered list. Cause 3's fix, or a "narrowing lost after pass N" signal, removes the contradiction.
- Brief-3 rev 3 (0132) had the right rows in the wrong order. No judge or Core check compares order with "in the order the results show them".
