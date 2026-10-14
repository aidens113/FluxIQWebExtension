# A8 round three: bigbox-retail-pickup-towels (project) run-mv8p37k8-f1a90624 debug

Read-only. No model provider was called and no Lab was run. The run's pair: Core dev `8d6239a8`, downstream lane tree
`fxwork/t565` (source read there and at downstream dev; the cited lines are the same in both).

## Outcome

The build was **one fact away from passing**. The page view did not show it, and that, not the guard, is the cause.
Trials of revisions 3 and 4 stored **exactly the oracle's 9 rows, in order, with the right values**. They never
passed because the request says "that ValueRidge sells itself rather than a marketplace seller", the results tiles
print no seller, and nothing in the Flow addressed that clause. The site does say it, through a sidebar filter group
headed **Retailer** with one option, "ValueRidge". But the compact page view drops every `<legend>`, so the model saw
an unlabelled `checkbox "ValueRidge (23)"` sitting just above the Brand options (Hearthside, Kindleaf, ... ValueRidge
Essentials). It never recognised that checkbox as the seller filter. It then spent its remaining calls looking for a
seller field on each row, tried a per-product-page loop it could not write validly, and was stopped for resubmitting
the same invalid script. The judges that answered no were right by their own rule. The guards were right.

## Timeline (UTC, 2026-10-14)

| Step | Time | What happened |
| --- | --- | --- |
| 1-6 | 22:45:20-29 | The supervisor read the task, ran one `find_on_page "Search"`, and wrote a one-part, one-subflow plan (`paper_towel_table`, parts [p1], four goal facts, `lastingActs: []`). |
| 8 | 22:45:31 | Dispatched build brief-1: $0.120 allowance, 64 iterations, 116 calls. |
| 9 | 22:45:31 | Phase start: arrived at the site root with the consent dialog over it. The store shown was "Carden Falls Supercenter", the home store. |
| 10-19 | | The builder closed the consent dialog, the email offer and the chat overlay (one type was refused as `target_covered`), then searched "paper towels". |
| 20-39 | | It detected the results list, mapped fields `sponsored`, `pickup` and `seller`, and read the list. **`seller` was mapped to the same selector as `pickup`** (`div_css-0gz65eu_div_1`). The tiles have no seller text. |
| 41 | 22:46:24 | rev 1 refused: `record_output.replace_in_repeat`. A correct refusal; it was fixed in one call. |
| 43-45 | 22:46:30 | **Trial 1 (rev 2)**: no seller condition and no type condition. 10 rows: the 9 oracle rows plus "Loftwell Countertop Paper Towel Holder, Bamboo". Verdict **no**. |
| 49-51 | 22:47:23 | **Trial 2 (rev 3)**: added the name conditions (contains "Paper Towels", not "Holder", not "Dispenser"). **9 rows = the oracle, exactly.** Judges: no / yes / recheck yes. Verdict **unsure**. |
| 56-58 | 22:48:22 | **Trial 3 (rev 4)**: added `seller contains "Pickup today"`, a condition that tests nothing, since `seller` reads the pickup text. 9 rows = oracle. Judges: no / yes. Verdict **unsure**. |
| 61-86 | | Looked for a seller field: describe and detect on rows (one `target_unobserved` refusal and its repeat refusal), opened a product page, and found `p "Sold and shipped by ValueRidge"`. Asked `find_on_page "Sold and shipped by"` **seven times in all** (steps 82-107); every repeat was answered `already_answered`. |
| 88 | 22:49:48 | **Trial 4 (rev 4 retested)**: 9 rows = oracle. Judges: no / no. Verdict **no**. |
| 96-98 | 22:50:46 | **Trial 5 (rev 5)**: `seller contains "ValueRidge"`, which matches the product name. 2 rows. Verdict **no**. |
| 110 | 22:51:49 | rev 6 = rev 4 again. Refused: `candidate.unchanged_after_no` (correct). |
| 112-122 | 22:51:54-22:52:13 | rev 7/8: a per-row product-page loop. Refused `evidence_completion_plan_invalid:8e68ad27`: `flow_script.repeat_not_after_its_source` (the row loop was nested in the page loop) and `web.output.dom-extract` given `recordOutput`, a parameter it does not take, plus an invalid `extract`. One `describe_nodes`, then **the same script word for word** submitted four times (115, 117, 119, 121). The first was checked and refused again; the other three were refused `repeat_refused (failed)`. Third in a row: `flow_bootstrap.evidence_repeat_without_progress`. Builder returned **partial**: 62 calls, $0.0598. |
| 123-124 | 22:52:15 | The supervisor dispatched a repair carrying **trial 5's receipt** (the 2-row trial, the worst of the five). |
| 125-163 | 22:52:15-22:53:19 | The repair moved between the search page and one product page, asking "Sold by" / "seller" / "Sold by ValueRidge" (one `already_answered`). It never submitted. Three identical navigations to the product page were refused `repeat_refused (same_result)`. Repair **blocked**: 19 calls, $0.0107. |
| 164 | 22:53:19 | The supervisor ended the build honestly. Total $0.074 of $0.25. |

## (1) The task and the plan

- Task `bigbox-retail-pickup-towels` (`apps/scenario-lab/src/scenarios/bigbox-retail/live-tasks.ts:3,27`), judged
  by the expected dataset `extract-pickup-towels`. The oracle is `PICKUP_TOWEL_RECORDS`
  (`manifest/expected-values.ts:13-23`), 9 rows. The recording workflow (`manifest/pickup-towels-workflow.ts`) ticks
  Department=Paper Towels, **Retailer=ValueRidge**, Fulfillment=Pickup, Speed=Today and 4 & up. It then reads with
  an "not an ad, bar 90-100%, not the two tomorrow-only ids" selector and follows the page number after the current
  one. A bot check on the third results load is part of the task.
- The catalog (`catalog/paper-towels.ts`) has 32 listings and 9 ads, which is the 41 rows the reads saw. Every
  marketplace listing ships only (`shippedOnly`), so on this site "Pickup today" implies a ValueRidge seller. The
  tiles never print a seller (`listing/tile.ts`). Only the Retailer facet (`search/facet-groups.ts`,
  `retailer_type`) and the product page ("Sold and shipped by ...") say who sells an item.
- **The plan fits.** One part, one subflow. Its four goal facts restate the request faithfully. `lastingActs: []` is
  right. One small risk: `notAsked` says "do not change ... the pickup or delivery setting". A filter is not a
  setting, but those words could make a builder wary of the Fulfillment and Speed filters. Not shown to have mattered.

## (2) What the builder tried, what repeated, and whether the guard was right

- Its strategy was to read every page unfiltered and keep rows with conditions on the read. That is a legitimate
  strategy, and it reached the oracle by trial 2. The one clause it could not express was the seller.
- Its seller work never became valid. It mapped `seller` onto the pickup line (rev 2-4). It then tested the name for
  "ValueRidge" (rev 5), and finally wrote a per-row detail loop inside the paging loop (rev 7/8), which Core's script
  format refuses.
- Repeats:
  - `find_on_page "Sold and shipped by"` seven times, answered `already_answered` each time after the first.
  - One identical invalid script, sent four times.
  - In the repair, the same navigation, landing on the same page, several times.
- **Guard verdict: right on every refusal.** The return named the calls exactly as they happened: `submit_subflow
  repeat_refused (failed)` x3, `plan_invalid:8e68ad27` x2, `unchanged_after_no`, `find_on_page already_answered`,
  `find_on_page succeeded`. The repair's three `same_result` refusals were identical navigations from the same page,
  whose earlier copy (step 142) had landed on the same page as step 134. Each refusal told the model exactly what to
  change. The model kept resending regardless.
- Other refusals:
  - `replace_in_repeat`: right.
  - `unchanged_after_no`: right.
  - `repeat_not_after_its_source`: right as a rule. Its text ("Name a listing the Flow runs once, before this span")
    gave no workable route for "check each kept row's own page across a paged list"; see Open questions.
  - The `bootstrap.unknown_parameter` issues for `recordOutput` on `dom-extract` carried an empty `message`. Only the
    first carried `accepted.parameters`. A small Core feedback gap.

## (3) Trials and judge verdicts against the oracle

| Trial | Rev | Stored | vs oracle | Judges | Verdict | Verdict right? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 10 | 9 oracle + the holder (VR-sold, pickup today, 4.6, dept "Paper Towel Holders") | no / no | no | **Right** (the holder is not a pack of paper towels). Call 2's reasoning was wrong: it called Loftwell, Softerra, Hearthside and Kindleaf "non-ValueRidge brands", but brand is not seller. |
| 2 | 3 | 9 | **exact** | no / yes / recheck yes | unsure | Right by the judge instruction, wrong by the oracle. Call 1's no cites the instruction's own rule: answer no for "a Flow with no step that could have narrowed or filtered what the request asked to narrow" (Core `runtime/llm/diagnosis-instructions.ts:116`). The two yeses waved off the missing seller clause as a "latent risk", which that rule forbids. |
| 3 | 4 | 9 | **exact** | no / yes | unsure | Same. Call 1 correctly saw that condition 7 named `seller` tests the pickup text. |
| 4 | 4 (retest) | 9 | **exact** | no / no | no | Right by the rule. |
| 5 | 5 | 2 | 7 oracle rows lost to `seller contains "ValueRidge"` on the name | no / no | no | **Right.** Call 2 misnamed two rows: it called "... 12 Double Rolls (2-Pack)" and "... 1 Roll" ValueRidge-sold. The 2-Pack is a marketplace listing, and the 1 Roll is a tomorrow-pickup listing that condition 2 had already rejected. |

t599 worked as designed. The 6 rows left out by condition 1 (the ads that duplicate listings) and condition 3's two
rows (4.3, 4.4) came as `leftOutSettled`. Condition 2's 12 rows came with `[row XXXXXX]` ids. No judge was confused
by settled rows or ids. The judges' failure was never about the rows. It was about a request clause with no step
behind it, and the judges answered that question correctly when they answered no.

## (4) Phase start and the store

- t593 left every phase on the right page.
  - The builder arrived at the site root, freshly loaded, with the consent dialog showing (step 9).
  - Every trial reports `start: reset`, `startHook: ran`, `arrival: loaded`, and stands on the build's start location.
  - The repair arrived the same way (step 125).
  - Nothing lasting was done, and `lastingActsInPlace: 0`.
- The store was Carden Falls Supercenter (id 2291), the home store, which is what "my store" means. Nothing changed
  it. The tile text "Pickup today" / "Pickup tomorrow" is computed for that store. Both tomorrow-only listings
  (Softerra 8 Triple Rolls, Northmere 12 Rolls) were correctly rejected by `pickup contains "Pickup today"`. Because
  the read tested the printed pickup line, it avoided the Speed=Today trap the workflow comment describes: Today
  also counts delivery. The store choice did not interfere with this task.
- The bot check never showed in any captured page. Trials read pages 1-3 cleanly. Not verified whether the
  check fired and passed by itself during a paging wait (see Not verified).

## (5) Single-agent candidate build of this task

There are no earlier runs of this task under `lab-runs/` (the index lists only this run and the next one). The
candidate-mode run `run-mv8pwn3z-f5a56606` (same lane, started 23:05:05Z) was **still running** when I read it, at
77 step folders:

- **Same arc.** Trial 1 kept 10 rows (no). Trial 2 used name startsWith "ValueRidge" and kept 2 (no). Trial 3 kept 9
  (unsure). Trial 4 kept 9 (no).
- **Then it found the filter by luck.** At step 54 it ran `describe_element` on the bare `checkbox "ValueRidge (23)"`.
  The answer carried `value="retailer_type:ValueRidge"` (step 55), the only place the word "retailer" reached it.
  Even that answer's context shows `heading="Filters"` and no legend.
- At step 69 it ticked the box. Rev 6, "filters to ValueRidge-sold paper towels via the site's retailer facet", was
  under test at step 76. Its verdict was not yet written.
- This independently confirms the root cause. The seller clause is answerable only through the Retailer filter, and
  the model learns what that filter is only if a raw attribute happens to spell it.

## Root causes

1. **The page view drops `<legend>` text (downstream domain plus extension).** On the extension side,
   `describeElement` gives a legend `text` = its direct words (`apps/extension/src/content/describe-element.ts:89-95`)
   and an accessible name from content: `legend` is in `NAME_FROM_CONTENT_TAGS`
   (`apps/extension/src/content/identity/accessible-name.ts:38-41`). No `ownText` is set, because a legend is neither
   semantic nor interactable. On the domain side:
   - `sanitizedEvidenceElement` drops `text` when it equals the name: `const text = rawText === name ? undefined :
     rawText;` (`domain/src/runtime/llm-evidence/elements.ts:205`).
   - `webLlmViewTraits` then takes the element's own words from `ownText ?? text ?? (semantic ? name : undefined)`
     (`domain/src/runtime/llm-evidence/page-view/element/traits.ts:79`). `legend` is not in `SEMANTIC_TAGS` (`:58`),
     so the legend has no words and no line.

   The same holds for `caption`, and for any name-from-content element whose text is its whole name and that is
   neither a control nor a semantic tag. The screenshot shows Department, Fulfillment, Speed, Retailer, Brand and
   Customer Rating headings. The page view shows none of them.
2. **The legend a control sits under is collected but never published (downstream domain).** The extension records
   `context.fieldsetLegend` on every control inside a fieldset (`apps/extension/src/content/identity/context.ts:80,
   115-118`). The domain's model-facing placement keeps only form, landmark, heading, item and cell
   (`domain/src/runtime/llm-evidence/elements.ts:466-481`). So neither the view line nor `describe_element` can say
   "this checkbox is under Retailer". (Targets keep it for resolution: `domain/src/output-nodes/targets/targets.ts:344`.)
3. **Consequence for the build.** The request's seller clause had no route the model could see. Judges correctly
   refused a Flow with no step for that clause, so a correct 9-row result could not pass. The builder could not
   resolve it and looped until the repeat guard stopped it.
4. **Secondary (Core, supervisor).** The repair brief carried the latest failing receipt (trial 5, 2 rows) rather
   than the closest one (trials 2-4, oracle-exact, unsure). The repair therefore started from the worst evidence,
   and it re-explored instead of revising. It would not have passed without root cause 1 either way.

## Recommended fixes (none mirrors this site, task or products in model guidance)

1. **Domain page view: give a legend its line.** Either keep `text` for elements whose name comes from their own
   content (compare against an authored name only), or treat `legend` and `caption` as semantic text in
   `traits.ts:58`. Add a page-view test with a generic fieldset ("Size" with options), plus an end-to-end view test
   asserting the legend line appears before its options.
2. **Domain evidence: publish the group a control belongs to.** Carry `context.fieldsetLegend` (screened) into
   `elementPlacement` as a `group` field. Print it on `describe_element` and on `find_on_page` lines, e.g.
   `checkbox "Large (4)" group="Size"`. Wire it through the protocol types, the gateway mapping and the page-evidence
   doc per AGENTS.md. Fixes 1 and 2 are the structural fix: a site's own filters say what they filter.
3. **Core builder guidance, generic.** When a condition in the request is not printed on the list rows, look for the
   site's own filter or option whose group says that condition before reading each item's page. A filter whose words
   are exactly the request's clause is a correct narrowing step; the judge instruction already says so. Example
   shape: a library catalogue's "Format: Audiobook" filter. Do not use a store, seller or pickup example.
4. **Core supervisor repairs (t595 follow-up).** When choosing `failingReceipt`, prefer the trial closest to a pass
   (unsure over no, the most rows kept that passed the most conditions), or pass the closest trial alongside the
   latest one.
5. **Core feedback.** Give `bootstrap.unknown_parameter` issues a `message`. Make `repeat_not_after_its_source` say
   what a per-row loop over a paged list should look like, if the format supports one (see Open questions).

## Commands run and observed results

- Bash reads of `steps/*/{meta,call,result,decision}.json`, `request.txt` and `response.txt` for steps 1-164, and of
  `steps/index.md`, `summary.json` and the Lab log tail. Verdict `failed`, `lab.chat_build_failed`, $0.074138 of
  $0.25.
- `node` one-liners to list each decision's tool, input and flow `where`, and each trial's verdict and rows. Results
  are in the tables above.
- `md5sum` of the rev-7/8 scripts (steps 111, 115, 117, 119, 121). 111 differs from 115 only by a `target: t1853`
  line. 115-121 are identical (`0f4faef6...`).
- `grep` for "Retailer" or "Customer Rating" across every step file of the run: **no match**. The screenshot
  `0019-tool-core.run_node/screenshot.jpg` shows the legends drawn.
- `git grep` at Core `8d6239a8` for the judge rule (`runtime/llm/diagnosis-instructions.ts:116`) and the unsure
  agreement (`runtime/result-verification/agreement.ts:118,128,312`).
- Line checks in `fxwork/t565` (the lane tree that ran): `elements.ts:205`, `elements.ts:466`, `traits.ts:58`,
  `traits.ts:79` and `context.ts:80,115` are as cited.

## Not verified

- The legend-drop mechanism was traced in source, not reproduced in a browser or a unit test. A `caption` is
  inferred to be affected the same way.
- Whether the bot check fired during trial paging and passed by itself inside a wait. No captured view shows it.
- The candidate run `run-mv8pwn3z-f5a56606` was in flight: rev 6 (with the Retailer filter) had no verdict yet.
- Whether Core's script format can express "open each kept row's page across a paged list" in any valid form.

## Open questions or contradictions found

- The two judge calls on one trial often split on whether an unaddressed request clause is a "latent risk" (yes) or
  a missing step (no). The instruction says it is a no. The yes calls (steps 53, 54, 60) went against it. The
  agreement logic correctly turned the split into unsure, but a stronger pin on that rule would cut retest spend.
- The builder retested rev 4 after an unsure whose feedback named the subflow, which the gate's text discourages
  ("test this revision again if the feedback says nothing about the subflow itself"). It cost one trial ($0.003) and
  changed nothing.
