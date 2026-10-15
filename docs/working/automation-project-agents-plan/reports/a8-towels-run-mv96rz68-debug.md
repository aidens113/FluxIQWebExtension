# A8 debug: bigbox-retail pickup-towels, run-mv96rz68-532f5e52

Read-only debug. No commit, no Lab or live run, no provider call. Pair: downstream `9f362856`, Core `72487d26` (t563 tree).
Evidence: `fxwork/t563/!FluxIQWebExtension/test-runs/instances/a8-slot-1/run-mv96rz68-532f5e52/` (evaluation.json, snapshots/flow-lane.json, snapshots/extraction-mismatches.json) and `lab-runs/2026-10-14/run-mv96rz68-532f5e52/steps/` (step numbers below are those folders).

## Outcome

The cause is found, and there are three causes. Most of the extra rows (6 of the 8) come from the Flow's Next page step. On the filtered first page it followed the site's Next arrow, which drops every filter. Pages 2 and 3 were therefore read from the unfiltered search, and `web.dom.next_page` still reported success ("moved by next to page 2"). The other 2 extra rows pass the site's Pickup and Today filters but cannot be picked up today. The "Today" filter also counts delivery today, and no read condition checked pickup on the row itself. Core accepted the result for two reasons. First, nothing in its structured evidence says the filters stopped holding after pass 1. Second, the judge prompt flags only a filter that keeps *less* than the request asks. The judges had the evidence in front of them: the end view showed every filter `unchecked`, the URL had no filters, and the tiles said "Pickup tomorrow". They answered yes anyway.

## What changed and why

Nothing in the product changed. This report is the only file written.

## Findings

### 1. The request, the 9 expected rows, the 17 stored rows

The instruction (live-tasks.ts `PICKUP_TOWELS`, step 0001) asks for paper towels "that ValueRidge sells itself rather than a marketplace seller, that my store can have ready for pickup today, and that is rated 4.5 stars or higher … leave out sponsored listings and list each product once, in the order the results show them under Best match".

The oracle (`manifest/expected-values.ts` `PICKUP_TOWEL_RECORDS`, selector notes in `pickup-towels-workflow.ts`) expects 9 rows across **two** filtered pages: ValueRidge Essentials Select-A-Size 6DR; Loftwell Ultra Strong 6DR; Loftwell Select-A-Size 12DR; Softerra 6DR; Hearthside 12DR; Softerra Pick-A-Sheet 12 Triple; Kindleaf Unbleached 4 Rolls; ValueRidge Essentials Value Pack 15 Rolls; Hearthside Select-A-Size 8DR. The workflow comment says why the site's filters alone are not enough: "'Today' counts delivery too … and the Next arrow would drop every filter, so the read follows the page number after the current one". The oracle also leaves out item ids 433201876 and 470665371 because they can be picked up only tomorrow.

The Flow stored 17 rows (step 0047 `recordSets[0].sampleRows`; processing: 20 collected, 3 duplicates, 17 kept). All 9 expected rows are among them (`matchedInAnyOrder: 9`). The 8 extra rows, checked against `catalog/paper-towels.ts`:

| Stored row | Pass / page | Why the request excludes it |
| --- | --- | --- |
| Softerra Pick-A-Sheet 8 Triple Rolls (433201876) | 1 (filtered) | Home store has it for pickup tomorrow only; the Today filter keeps it because delivery is today |
| Northmere 30 Rolls, Bulk | 2 (unfiltered) | Marketplace seller "Pinecrest Supply Co." |
| ValueRidge Essentials 1 Roll | 2 (unfiltered) | Pickup tomorrow at home store, delivery tomorrow |
| Hearthside 6 Mega Rolls | 2 (unfiltered) | `pickupAt("none")` |
| Northmere 12 Rolls (470665371) | 2 (unfiltered) | Pickup tomorrow at home store, delivery today. Same trap as the first row; the Today filter would keep it too |
| Tidemark 8 Double Rolls | 3 (unfiltered) | Pickup tomorrow, delivery tomorrow |
| Softerra Case of 24 Rolls | 3 (unfiltered) | Marketplace seller "Northgate Wholesale" |
| Loftwell 1 Roll | 3 (unfiltered) | Pickup tomorrow, delivery tomorrow |

The extra rows do not come from duplicates or from a misread condition. The rating and sponsored conditions worked. The breakdown is:

- **6 rows: the filters were lost on pages 2 and 3.** Step 0042 (next_page) result: `"actual": "moved by next to page 2"`, `"url": ".../search?q=paper%20towels&page=2"`. The `facet=` parameter is gone. Before the move, step 0039 shows the address `...&facet=retailer_type%3AValueRidge%7C%7Cfulfillment_method%3APickup`. The end view in step 0047 shows `URL ~?q=paper%20towels&page=3` and `"25–32 of 32 results"` (32 is the unfiltered total). It also shows every filter `unchecked`, for example `t67 checkbox "ValueRidge (23)" unchecked group="Retailer"`. The read reported 3 pages and 41 items, where the oracle's filtered set has 2 pages. Per-pass kept/new rows: 8/8, 7/4, 5/5.
- **2 rows: a filter that keeps more than the request.** The Pickup and Today filters together are not the same as "my store can have ready for pickup today" (`search/facet-groups.ts:23-34`). The read had no field or condition for the tile's pickup text.
- **Department: not a cause.** The Flow did not tick the Department filter. Its name conditions (contains "Paper Towels", not "Holder") replaced it, and neither condition left out an expected row (`alone: 0`).

How the Next was chosen. The build never ran Next page or any filter while exploring (steps 0002–0012 are the consent banner, popups and search only). The next-page control came from `web.detect_repeating_structure` on the unfiltered 3-page result (step 0014, `"pagination": "next_link"`). The authored selector was `main > div > section > nav > a:nth-of-type(4)`, which on that page is the Next arrow. On the filtered 2-page result it matches nothing, so `nextControlOnPage` (`apps/extension/src/content/extraction/detect-pagination.ts:244-260`) fell back to the pager control labelled "Next page". On this site that is the arrow whose href holds only `q` and `page` (`pages/results-pagination.ts:19`). `followNext` (`page-advance/follow-next.ts`) checks only whether a Next leads back to the same page. It never checks whether the Next keeps the current address's query state. The numbered link "2", which keeps every filter, was on the page and was not used.

### 2. Did exploration see and choose the right filter controls?

Yes. The `group=` work from t605/t610 was present and was used. The build's page view in step 0017's request shows:
`t399 checkbox "ValueRidge (23)" unchecked group="Retailer"`, `t380 checkbox "Pickup (20)" unchecked group="Fulfillment"`, `t391 checkbox "Today (16)" unchecked group="Speed"`, `t427 checkbox "4 & up (32)" unchecked group="Customer Rating"`, and also `t372 "Paper Towels (28)" group="Department"`. The model's step 0017 submit names exactly t399, t380, t391 and t427, with labels like "choose the ValueRidge retailer filter" and "choose the Today speed filter". It skipped the Department filter and used name conditions instead.

However, the model never pressed these filters during exploration, and never ran Next page. It submitted them untried (step 0017) and went straight to a trial. Exploration therefore never showed the filtered result: not its "Pickup tomorrow" tiles, and not the Next arrow dropping the filters. The system prompt says "Exploring needs one page read and one Next page to know the loop works", but nothing enforces it.

In playback, the filter checks all ended checked (steps 0035–0040). The Today check's first attempts were `web.target.not_found` (0037) and `output_not_observed` (0038) while the robot check counted down, and it then succeeded (0039).

### 3. Why the judge answered yes

There were trial 1 (steps 0021–0023), trial 2 (steps 0028–0030) and the playback check (step 0047). Every call was shown the same kind of evidence:

- `reads[0].conditions` with per-condition `leftOutOnlyByThis`. Core settled the 8 sponsored rows (`leftOutSettled`, "the read found sponsored") and the 7 rows rated below 4.5 ("Core read rating as a number … each fails condition 2"). No row was stored unsettled, and Core settled nothing about the stored rows' pickup or seller.
- `narrowedBefore`: the steps s6–s9 with `control: "ValueRidge (23)" | "Pickup (20)" | "Today (16)" | "4 & up (32)"`, `effect: new_page`. This list is computed only before the read's *first* attempt (`Core result-verification/narrowed-before.ts`). Nothing says the steps stopped holding from pass 2 on.
- `paging: "Read every page (3) and the list ended"`.
- `endView`, which showed every filter `unchecked`, the unfiltered URL, "25–32 of 32 results", and stored rows with "Pickup tomorrow" (t195 Tidemark 8DR, t314 Loftwell 1 Roll) or shipping only (Softerra Case of 24, Northmere 30 Bulk).

What each call answered:

- **Trial 1** (18 rows; the holder was still stored):
  - 0021 answered **yes**: "the narrowing steps keep exactly what the request states".
  - 0022 answered **no**, and actually saw the symptom: "rows whose availability is not pickup today (e.g. 'Tidemark Paper Towels, 12 Mega Rolls' shows Shipping only; 'Softerra Paper Towels, Case of 24 Rolls' shows Shipping only) … retailer and pickup-today are not enforced".
  - Core asked 0022 again (0023) under the t515 unstated-exclusion rule, because its advice said "exclude holders/dispensers". 0023 answered **no**, but about the holder only. The Shipping-only observation was lost.
  - Verdict unsure. The builder fixed only the holder (step 0024).
- **Trial 2** (17 rows):
  - 0028 answered **yes**.
  - 0029 answered **no**, but for a wrong reason: "condition 1 (sponsored is absent) dropped 8 rows that the request does not exclude". Core re-asked it (0030) with `recheck: … advised leaving out rows by words the request never states as an exclusion: "not contains Holder"`. That trigger misfired: 0029 had only said "Keep … condition 4 (name not contains Holder)", which keeps an existing condition rather than adding an exclusion.
  - 0030 answered **yes** (0.7): "the Flow applied the ValueRidge retailer filter and the Pickup and Today filters, which cover those clauses".
  - Two yeses gave `candidate.trial_yes` (step 0027: "The trial was judged twice to do what the instruction asks").
- **Playback check** 0047 answered a single **yes** (0.9), with `patchNeeded: false`: "The narrowing steps before the read (ValueRidge, Pickup, Today, 4 & up) match the request". Result `resultVerification: confirmed`, `reportedVerdict: passed`.

Rules that should have caught the extra rows:

1. **A filter that stops holding on later pages.** No rule covers it. Core has no fact for it, and the judge prompt's `narrowedBefore` paragraph ("The rows such a step removed on the site never reached the read …") assumes the narrowing holds on every pass. It also tells the judge not to judge paging from startView, and says nothing about an endView that contradicts `narrowedBefore`.
2. **A filter that keeps more than the request clause it stands for.** The `narrowedBefore` rule handles only "a step whose words keep less than the request asks". A filter with the same words as a request clause ("Today") is accepted on its label, and the yes is not required to show row-level evidence for that clause.

### 4. Root causes, classification and smallest structural fixes

**RC1: Web domain, product (primary, 6 of 8 rows).** `web.dom.next_page` follows a Next that leaves the narrowed list and reports success.
- Fix 1: in `apps/extension/src/content/extraction/detect-pagination.ts` (`nextControlOnPage`) and `page-advance/follow-next.ts`, treat a candidate as not leading forward *on the same list* when its link address removes or changes any query parameter of the current address other than the page parameter. Such a Next is handled like the "unaddressed" case already there: follow the pager's numbered following page (`numberedAfterCurrent` / `pager.following`) when its address keeps those parameters.
- Fix 2: when no candidate keeps them, fail the move with a new closed code (for example `web.pagination.narrowing_lost`) instead of `moved`.
- Fix 3: record the departing address in the move mark (`shared/extraction-continuation.ts` `PageMoveMark`), and have `page-advance/arrival.ts` refuse a landing whose query lost those parameters. This covers presses that carry no href.
- This rule is generic: a page move must keep everything that defines the list except the page number.
- Tests go in `apps/extension/src/content/extraction/tests/pagination.test.ts` (or `page-advance/tests/`), using a synthetic pager whose Next drops a filter parameter.

**RC2: Core result verification, product.** Core does not account for narrowing that a pass lost, so the yes was confirmed.
- Fix: carry a closed domain fact on each next-page outcome or read pass (for example `narrowingKept: false`, decided by the web domain as in RC1). Fold it into the read account (`Core runtime/result-verification/read-account/`, `narrowed-before.ts`, `runtime/service/candidate-trial/reads.ts`) as "steps s6–s9 no longer held from pass 2".
- Settle it in `verdict.ts`/`agreement.ts` the way paging records already are: a yes over a read with any pass run after narrowing was lost is not confirmed, and a repair directive (`repair-directive.ts`) names the next-page step.
- Once RC1 fails the move, this is defence in depth. It matters for sites where the URL does not carry the filter state.

**RC3: Core judging contract, product (2 of 8 rows; secondary).** A pre-read filter stands in for a request clause with no row-level evidence.
- Fix: make the `narrowedBefore` rule symmetric in `Core runtime/llm/diagnosis-instructions.ts` and its verdict guard. A yes must quote, for each narrowing step, the request's words that the step's control words state *exactly*. Where a request clause is covered only by a site filter, with no read condition or stored column for it, the yes is held unconfirmed (`yesUnconfirmed`, as t611 does for missing exclusion evidence). The builder then has to read and condition on the row's own value for that clause.
- The wording must stay generic, with filters, request clauses and rows, and must not mention pickup, today or this site.
- Weaker alternative: have `core.submit_candidate` refuse a candidate whose narrowing steps or next-page step were never run during exploration. Running them would have shown both defects before the trial.

**RC4: Core, product (contributing).** The t515 unstated-exclusion re-ask misfired on a no that only advised *keeping* an existing condition (0029 → 0030).
- Fix: in `Core runtime/result-verification/request-rows/unstated-exclusions.ts`, do not count a condition the Flow already has, cited in order to keep it.
- The outcome here would have been the same: 0029's reason was refuted by the settled sponsored rows (t607), and the trigger only changed which rule re-asked the call.

**Lab: no defect.** The oracle and verdict are correct (`oracleVerdict: failed`, `runtime.behavior`). A minor improvement: `extraction[].expectedPages` / `pagesFollowed` are null. Stating the expected 2 pages against the 3 read would have pointed at the paging straight away (`apps/scenario-lab` extraction expectation).

## Commands run and observed results

- Read `evaluation.json`: `oracleVerdict: failed`, `reportedVerdict: passed`, `expectedRecords 9 / observedRecords 17`, `collectedRecords 20`.
- Read `extraction-mismatches.json`: 8 `observed-not-expected` at positions 9–16, and 7 expected rows moved.
- Read `flow-lane.json`: `authoredNodes`, `candidate` (trial 1 `rejected`/`not_promoted`, trial 2 `yes`) and `extraction.reads` (kept 8/7/5).
- Read the playback step results 0035–0046 (call.json/result.json): the next_page URLs drop `facet`, and 0046 is `ended: control_absent`.
- Read decide steps 0003–0031 (response.txt), judge steps 0021–0023, 0028–0030 and 0047 (request.txt, response.txt, decision.json), and 0027 (test_candidate result).
- `diff` of the 0029 and 0030 judge requests: the only added line is `recheck: … "not contains Holder"`. The 0022 and 0023 requests differ the same way (`"exclude holders/dispensers"`).
- Grep of `catalog/paper-towels.ts` for each extra row's seller and pickup availability, and read of `results-pagination.ts`, `facet-groups.ts`, `follow-next.ts`, `detect-pagination.ts`, `arrival.ts`, and Core's `narrowed-before.ts` and `agreement.ts`.

## Not verified

- That page 1 of the playback read ran with all four filters applied. This is inferred from the check results (0035–0040 all ended checked) and from the page-1 rows matching expected rows 1–7 plus the one pickup-tomorrow item. The per-pass page address is not in the step files.
- That `a:nth-of-type(4)` matched nothing on the filtered page 1 and the labelled fallback was used. This is inferred from the pager markup (three anchors when there are 2 pages) and the landing URL, not from a trace field.
- No code was run. The proposed fixes are untested.

## Open questions or contradictions found

- `nextControlOnPage` prefers the *labelled* Next over the numbered following page when the authored selector fails. On sites where Next and the page numbers differ in which parameters they keep, the labelled one is the less faithful choice. Should the numbered following page win whenever both exist and their addresses differ?
- The system prompt says exploration needs one page read and one Next page, but this build submitted without running either, and nothing refused it. Is enforcing that rule wanted (RC3 alternative)?
