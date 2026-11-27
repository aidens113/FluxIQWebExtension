# run-mwz29d50-c3a32a9c: why the saved cart read found nothing, and why attempt 3 did not replay cleanly

This is a worker report and a diagnosis only. No code was changed, no live or paid run was made, and no git command was
used. Debug file: `docs/working/language-driven-flow-loop-plan/debugs/run-mwz29d50-c3a32a9c.md`.

Paths:

- Core paths are under `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ/packages/fluxiq/src/`, the shared Core at `f0b7d9f76`
  (fluxiq 0.54.35), which the run built from;
- extension, domain and test-runner paths are in the lane tree `C:/Users/osrs_/FluxStuff/fxwork/t1015-paid-bigbox/`
  (at `9309043f8`);
- step numbers are folders under `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-27/run-mwz29d50-c3a32a9c/steps/`;
- "trace" means the table `client_gateway_trace_events` in `.../.attempt-work/run-mwz29d50-c3a32a9c/fluxiq-root/.fluxiq/artifacts/automation-studio/projects/506ef250-.../project.sqlite`.
  Results are in `client_gateway_trace_chunks`, stored as raw deflate. Times are UTC.
- "task memory" and "answer attempts" mean rows of `automation.state` in `.../fluxiq-root/.fluxiq/global.sqlite`. The secret
  tables were not read.

## Outcome

Done.

- **The saved read is fine. It ran on the wrong page.** Attempt 2's replay never reached the cart. The "View cart" press
  failed and was then passed over, so the cart read ran on the product page.
- **The cause is `engine/automation/state-routing/not-arisen.ts:59-69`.** Since t1073 (Core `edea71f29`, `decision.ts:185-203`),
  it treats a drawer's "View cart" as a step whose state "never arose". It skips that step along its success edge
  (`decision.ts:113-114`) without noticing that the step's own effect is moving to the cart, which the read needs.
- **Attempt 3 was stopped by the judge, not the read.** Its replay reached the cart and read 2 rows.
  - The Flow had no judged whole run (`flow_not_proven`), so a judge was asked.
  - Asked on its own, with no decider conversation, the judge sees no page text. It could not see "4.5 stars" or "Pickup
    today", answered `unknown`, and the attempt repaired.
  - The repair was then discarded (`better-flow.ts:41`), so attempt 4 repeated attempt 3.
- **The harness missed both.**
  - Its scripted attempt 1 adds from the results card and uses the header cart link, so no drawer link is ever passed over.
  - Its judge always says yes.

The brief's premise "attempt 2's replay ran every click, the cart link included" does not hold. Two presses were not made:

- Add to cart was not pressed, rightly, as already done (0042).
- The cart link ("View cart") failed `web.target.not_found` (0043).

## 1. Why the saved cart read observed no output on attempt 2

### The read as attempt 1 saved it, and as attempt 2 sent it

Attempt 1's live read (call c11, step 0026; trace 14:14:18.594) and attempt 2's replay read (trace 14:15:02.163,
14:15:12.914, 14:15:24.384, 14:15:36.786) carry the same `extractList`:

- the item `main > div:nth-of-type(1) > div > section > div.css-1wnozeo`;
- the same ten fields with the same selectors (`item`, `price`, `quantity`, `url`, `lines`, `text`, `text_2`, `button`,
  `button_2`, `strong_currency_amount`);
- `askedFields: ["item","price","quantity"]`.

The replay adds only `answer: "kept"` and `timeoutMs: 10000`. The list key is `list.00234cc3b485c00862a0418757ae`, and its
place is `offset=0`.

**The same read worked on the cart.** Attempt 3's replay sent it unchanged at 14:16:47.066 (step 0078) and got 2 rows, and
so did attempt 4 at 14:18:22 (0115).

**So the suspects are cleared.** t1077's badge columns and text joins, t1079's identity keys, t1074's re-read replacement
and t1080's page window did not change this read's fields, keys or place.

### The page attempt 2 saw

The client's answer to the first replay read (trace chunk, 14:15:12.300) says:

- the URL was `.../ip/valueridge-essentials-paper-towels-1-roll/418830166`, the product page;
- validation: `0 records from 1 page; the item selector named nothing on the page, so the list never appeared, after waiting 10000ms`.

The repair's opening look (0049 `page.txt`) shows the same product page.

### Why the run was still on the product page

Attempt 1's path, from its pages:

- **0016:** the product page; `t1583 button "Add to cart"`.
- **0018:** after Add to cart, the page grows a panel:
  `COVERING t1608 covers 15 · t1609 "Customers also bought" complementary`, `t1611 "✓ Added to cart"`, and
  `t1615 link "View cart" same href as t1389`.
  - The fixture builds this panel only when the product page's Add to cart succeeds
    (`apps/scenario-lab/src/scenarios/bigbox-retail/client/product-script.ts:76-91`).
  - t1389 is the header link `🛒 2 $5.25 /scenarios/bigbox-retail/cart`.
- **0020:** call c9 pressed t1615. The command (trace 14:14:03.873) targets `body > aside > a`, `accessibleName: "View cart"`,
  `context.landmark: "complementary"`. It carries no `href`, because a packet element's saved identity drops it on purpose
  (`domain/src/runtime/llm-evidence/packet-fingerprint/from-packet.ts:62`).
- **The saved step.** Task memory saves this step as `d10`, position 10, with:
  - `routeSignatures.before.path d8ebc739` (the product page) and `after.path 53622792` (the cart);
  - `stateBefore web-state.v7:156538:9878f947`, and a different `stateAfter`.

  So Core knows this step moves the page to another address.

Attempt 2's replay (the commands sent, from the trace):

1. **14:14:55.772:** press the "ValueRidge Essentials Paper Towels, 1 Roll" link. It reached the product page.
2. **14:14:57.166 and 14:14:57.275:** snapshots only, and **no press**. Step s11 (Add to cart) was answered by the run gate as already
   done: answer attempts record `action: {skipped: "already_done"}`
   (`framework/automation-service/service/answer-first/run-acts/run-gate.ts:23-32`, `:272-278`). This is correct: the
   cart already held the roll, and pressing again is the double add that t1075 stopped.
3. **14:14:57.406:** press "View cart". It failed: `No target resolved from selector body > aside > a, element fingerprint, ...`.
   The panel never opened, because nothing was added.
4. **State routing.** The answer attempts record `outcome: "succeeded, route skipped, passed over"` and
   `skipped: {reason: "target_absent", code: "executor.state.not_arisen"}`.
5. **14:15:02 to 14:15:36:** the read, four times, on the product page. Then the saved Flow's run stopped (note 0048).

### The change and the line

- **`engine/automation/state-routing/not-arisen.ts:59-69`** (`automationStudioStateNotArisenWayOn`) passes over a step whose
  target is missing when its way in did not act this run. It returns the step's own `success` edge (`:68`).
  - Its header (`:13-16`) says such a step "answered a state this run never reached: it is not needed".
  - Its list of what it never passes over (`:34-39`) names lasting acts and reads. It does not name a step whose own effect
    is navigation to another page.
  - "View cart" is exactly that: the drawer was its way in, and the cart was where it went. Passing it over drops both.
- **It is called from `engine/automation/state-routing/decision.ts:113-114`**, unless `followOnLasts` says the step lasts.
- **t1073 (Core `edea71f29`, 2026-11-26) rewrote `followOnLasts` (`decision.ts:185-203`).**
  - Before t1073, every web click was floored `commit`, so "View cart" counted as lasting and was never passed over. The
    replay would have stopped on it with `target_not_found`, and the attempt would have explored.
  - t1073's comment names this step: "that floor said a drawer's "View cart" lasts, and the rule written for exactly that
    step never applied. A press that declares no consequence, claims no act and has done none is a navigation."
  - The code now knows the step is a navigation. Then, because it is "only" a navigation, it is passed over.
  - So t1073 did not create the gap in not-arisen. It is what first sent a navigating step into it in a live run.

## 2. What stopped attempt 3

It was not the read, and not "View cart" directly.

**The replay itself worked.**

- Attempt 3 replayed attempt 2's repaired Flow, whose bootstrap id is `d455e088f0e82b9b`: steps 1-10, step 15 (the header
  cart link) and read 18.
- "View cart" failed again at 0076 and was passed over as not arisen again.
- Step 15 (0077) then took the run to the cart, and the read (0078) returned 2 rows.

**The judge did not accept it.**

1. **Why a judge was asked.** Note 0079 says `deviated from the accepted run: flow_not_proven`, from
   `framework/automation-service/service/answer-first/completion/replay-stands.ts:67`.
   - Attempt 2's repair proved its Flow only from step 18 (0060: `core.run_flow {from: 18}`; 0061 `core.replay.replayed`).
     So no judged whole run stood behind it.
   - Attempt 1's Flow was not proven either. Attempt 2's record starts from it with `provenWhole: false`.
   - So by the rule "a finished Flow needs one judged whole run", the first replay of each new Flow is judged. **Attempt 2
     would have been judged too, even with a clean replay.**
2. **Why that judge could not say yes.**
   - **The judge of 0080 continues no decider.** Its `meta.json` says `continuation: {used: false, reason: "no_decision_in_this_attempt"}`,
     from `runtime/llm/anthropic/provider.ts:131`.
   - **Its evidence is the semantic trail with `captureOmitted: true` on every step, and no page text** (request 43,610 bytes).
     - Page views are added only on an unreadable re-ask: `runtime/result-verification/judge-evidence/summary.ts:159` keeps
       them, and only `unreadable-asks/note.ts:26-29` puts them in.
     - Even then they are only the end view and the before and after witnesses (`page-views.ts:42-69`). None of them is the
       product page.
   - **Missing words:**
     - "4.5 out of 5 Stars" appears 0 times in 0080, against 4 in 0030 and 0064.
     - "Pickup today" appears 0 times, against 14 in 0030 and 12 in 0064.
   - **0030, 0031 and 0064 said yes because they continued the decider's conversation** (`continues_the_decider`), which
     held those pages.
   - **Its answer:** `answersRequest: "unknown"`, "the Today speed filter and 4.5+ rating were not applied or checked in
     the trail". 0117 in attempt 4 says the same.
3. **What the repair saved, and why it was lost.**
   - Attempt 3's repair (0081-0099) re-searched with Pickup and Today and was judged yes twice (0100, 0101). Its Flow, saved
     at 14:18:05, is the task memory's `latest`.
   - `better-flow.ts:41` (`both confirmed: next if the kept one just broke on the site, else kept`) kept attempt 2's Flow as
     `best`. The kept Flow did not "break live": its replay reached the end.
   - `better-flow.ts:34` leaves `provenWhole` false unless a whole run of the same steps was judged yes.
   - So attempt 4 (0102-0115) replayed `d455e088f0e82b9b` again and met the same standalone `unknown` (0117).
   - Every later attempt would repeat this, spending about $0.30-0.60 each, and the Flow could never become proven.

The repair also left "View cart" (step 10) in the Flow beside its replacement, step 15. The model dropped only the failed
read 13 (0058). With F1 below, step 10 itself would reach the cart.

## 3. Why the harness did not catch it

Harness: `packages/test-runner/src/attempt-lane/scripted-model/scripts/bigbox-retail-new-store-cheapest-towels.ts` (t1076).

| | Scripted attempt 1 | Live attempt 1 |
| --- | --- | --- |
| Filters | Department "Paper Towels", Speed "Today", sort `price_low` (`:60-63`) | Pickup only, sort "Price low to high" |
| Add | the results card's `button "+ Add"` (`:65`). The fixture only shows a toast (`client/shell-script.ts:162`): **no panel** | the product page's "Add to cart" (0018), which **opens the panel** |
| To the cart | the header link matching `link "[^"]*\d+ \$\d[^"]*"` (`:66`), present on every page | the panel's "View cart" (0020), present only after an add |
| Read fields | `item` = field named `link`, `quantity` = key ending `select_control`, `price` = field named `price` (`:79`) | `item` `div_css-0dlw299_a`, `price` `div_css-0dlw299_span_2_span_currency_amount`, `quantity` `..._select_control` (0026): **the same keys** |
| List | `extraction.N` from its own detection | handle `t1698`, binding `list.00234cc3...`: **the same list** |
| Judge | always `answersRequest: "yes"` (`:97`) | Sonnet on the evidence it is sent |

So the read and the list key do not differ in any way that matters. What differs is the path into the cart and the judge:

- **On replay, the harness has no follow-on step to pass over.** Its add is left alone as already done, and its cart link is
  on every page, so the replay never puts a navigation through not-arisen.
- **The harness judge cannot be starved of evidence.** Its attempt 2 had 1 call, the `flow_not_proven` judge, and it said
  yes whatever it was shown.

### How to extend the harness so that it reproduces this

1. **A product-page path.**
   - Add a second script beside the current one, registered in `scripts/index.ts`, for the same task. Keep the current path,
     since it covers the toast case.
   - After the sort, it opens the first qualifying listing by its words and checks the rating and "Pickup / Today" lines on
     the product page.
   - It presses `button "Add to cart"`, then the `link "View cart"` that follows `"✓ Added to cart"` in the page.
   - Then it detects and reads the cart as now.
   - All targets are found by their words, as the script already does.
   - **On current `dev`**, attempts 2-4 should end like this run's attempt 2: s11 `already_done`, then "View cart"
     `executor.state.not_arisen`, then the read failing `web.validation.output_not_observed` on the product page.
2. **An evidence-reading judge for the scripted lane** (`scripted-model/scripts/judgement.js`). Behind an option, it answers
   `unknown` unless the request it receives shows the conditions the task names on the chosen item:
   - here, a rating line of at least 4.5 and a pickup-today line;
   - in general, the words of the asked conditions, given by the script.

   On current `dev`, the `flow_not_proven` judge of attempt 2 should then answer `unknown`, as 0080 did. This is test data,
   not product guidance, so it does not teach to the test.
3. **Acceptance.** With F1 and F2 in place, the product-page script passes 4 of 4:
   - attempts 2-4 read 2 rows;
   - attempt 2's judge says yes on page text it was actually shown;
   - attempts 3-4 stand on their record with 0 calls.

## 4. Proposed root-cause fixes, with offline proofs on this recording

None of these raises or adds a limit, a retry count or a wait.

### F1: a step passed over as "not arisen" keeps its navigation (Core, `engine/automation/state-routing/`)

**Cause.** `not-arisen.ts:59-69` decides "not needed" from the way in alone. A step whose own recorded effect moved the page
to another address is needed for that move, even when the control it was written on never came.

**Change.**

1. When `automationStudioStateNotArisenWayOn` finds a way on, it also asks whether the passed-over step's recorded effect
   changed the page address. Its route signatures already say so (`before.path` differs from `after.path`), or, where the
   build kept it, its after location.
2. If not (a drawer's Close, a cover's dismiss), the decision stays as it is today.
3. If so, the run must still arrive at that address before going on:
   - **(a)** If the page is already there, it goes on.
   - **(b)** Otherwise it presses a visible link on the current page whose address resolves to the same one, preferring a
     stable landmark (banner or navigation) over a covering layer.
     - The page view already groups these: `same href as t1389`.
     - The comparison uses the normalised address. The link-normalisation item open in the ledger belongs with this.
   - **(c)** Otherwise it goes to the recorded address.
4. The destination is saved as the step's effect, beside `routeSignatures`, and never in its identity.
   `from-packet.ts:62` rightly keeps `href` out of identity.

A navigation done this way is no lasting act, so the double-add guards stand. The step's attempt says how the page was
reached, so `replay-stands.ts` can still tell "passed over as saved" from a routed step.

**Offline proof on this recording.**

- **A state-routing unit test** under `engine/automation/state-routing/tests/`, using:
  - attempt 2's three nodes, as task memory holds them for `a0036f0c3f062adf` s11, s12 and s13;
  - s11's attempt: `succeeded`, `outputs.skipped: "already_done"`;
  - s12's failure `target_not_found`;
  - as the observed page, the snapshot inside the client's answer to the failed press (trace chunk at 14:15:01.883: the
    product page, holding `body > div > header ... a` with `href "/scenarios/bigbox-retail/cart"`).

  It asserts that the decision reaches the cart (presses that header link, or goes to `/scenarios/bigbox-retail/cart`)
  before s13. Today the test returns s12's success edge straight to s13.
- **The read half is already proven on this recording.** The identical read command returned 2 rows on the cart at
  14:16:47.066 and at 14:18:22.342. The cart captures stored at 14:14:04 and 14:14:05 (objects of 45,696 and 45,638 bytes,
  `Cart - ValueRidge`) can also be read through `domain/src/runtime/offline-reads/recorded-snapshot.ts`, for a check that
  needs no browser.
- **End to end, provider-free:** the product-page script from section 3, 4 of 4.

### F2: a judge asked on its own request sees the page text the result rests on (Core, `runtime/result-verification/judge-evidence/`)

**Cause.**

- A judge that continues the decider reads the pages in that conversation.
- A judge with no decision in its attempt, as on every replay, gets the semantic trail with `captureOmitted` and no page
  text.
- Page views go in only for an unreadable re-ask (`summary.ts:159`, `unreadable-asks/note.ts:26-29`), and then only the end
  and witness views (`page-views.ts:42-69`).
- So a replay can never be judged yes on any condition the Flow checks by looking rather than by filtering. Here those are
  the rating and same-day readiness on the product page.

**Change.**

- Every judge that does not continue a decider gets the page views now kept for re-asks.
- They also include the page each lasting act was pressed on, carried acts included. Here that is attempt 1's product page
  at its Add to cart press, which the carried-acts entries already name with `where`. On a replay, the page each step
  landed on is available too.
- Everything is shared within `AUTOMATION_STUDIO_LLM_PAGE_BUDGET_CHARS`, in that order, whole lines only, and says how many
  lines it left out, as `page-views.ts` already does.
- The deciding digest is unaffected, because the views are kept beside the summary.

**Offline proof on this recording.**

- **Deterministic, no model call.** Rebuild 0080's judge request from attempt 3's stored answer-attempt record (its trail
  entries and carried-acts entries), with the product page from attempt 1 (0018 `page.txt`) and the replay's own product
  snapshot (trace, around 14:16:4x). Assert that it now holds the lines `4.5 out of 5 Stars. 938 reviews` and the pickup
  "Today" line for the $1.28 roll, and that it stays within the page budget.
- **Provider-free:** the evidence-reading scripted judge from section 3 answers yes on that request and `unknown` on
  today's.
- **One real judge call** on the rebuilt request would settle it with Sonnet. That is paid, so it is the lead's decision.

### F3: a repair judged yes is not discarded for a kept Flow that was not (Core, `framework/automation-service/service/answer-first/task-memory/better-flow.ts`)

**Cause.**

- `better-flow.ts:41` keeps the old Flow whenever both are confirmed and the old one did not "break live".
- A kept Flow whose own judged whole run came back `unknown`, and needed a repair, has not stood. But it counts as unbroken,
  and `:34` never marks it proven.
- So attempt 4 ran it again, and each later attempt repeated attempt 3.

**Change.** A kept Flow whose judged whole run in this attempt did not come back yes is treated as not standing, as
`flowFailedLive` is now. A next Flow from the repair that was judged yes replaces it. F2 makes this rare, but it closes the
loop.

**Offline proof.** A unit test of `automationStudioAnswerFirstBetterFlow` with this run's two saved records:

- `best`, saved 14:16:29, `stepsDigest 02d89f44...`, `provenWhole: false`;
- `latest`, saved 14:18:05, `stepsDigest 5b601b29...`;
- `how` as attempt 3 had it.

Today it returns `best`. After the fix it returns `latest`.

### Secondary

`runtime/flow-authoring/draft/amendment/apply.ts:232-236` and `:259-266` check a `keep` or `result` for `second_copy`
against the steps as they stand. They do not account for a `drop` in the same decision. In 0058 the model sent
"keep 18, result 18, drop 13", and 0059 refused 18 as a copy of 13, the step being dropped, which had read nothing that
attempt. It cost no call here: the result still landed on 18 by the end. It belongs with the next amendment change.

## Commands run and observed results

All reads of the run were done on copies, with Python opened in isolated mode (`-I`):

- `find ... -name run-mwz29d50-c3a32a9c`: `lab-runs/2026-11-27/run-mwz29d50-c3a32a9c`.
- `steps/index.md`: 121 completed steps, ending at 0121 in attempt 4. `bigbox5.log` gave the costs: attempt 1 $0.6456 (17
  calls), attempt 2 $0.3090 (8), attempt 3 $0.5932 (12), attempt 4 $0.038 when stopped.
- The trace commands (`server.execute_action`, 175 rows) showed:
  - attempt 2 sent no Add to cart press;
  - "View cart" was sent at 14:14:57.406;
  - four `extract_list` commands followed, with selectors identical to 14:14:18.594 and to 14:16:47.066.
- The trace results (raw-deflate chunks) showed:
  - "View cart" answered `No target resolved from selector body > aside > a ...` on the product page;
  - the read answered `0 records ... the item selector named nothing on the page`.
- Answer attempts: s11 `skipped: already_done`; s12 `executor.state.not_arisen`; s13 four times `output_not_observed`;
  attempts 3 and 4 `replay: {stood: false, deviation: "flow_not_proven"}`.
- Task memory:
  - attempt 2's `startedFrom.provenWhole: false`;
  - `best` saved 14:16:29 and `latest` saved 14:18:05, both `label: confirmed, provenWhole: false`;
  - step `d10`'s route paths differ before and after.
- Judge requests: page-text counts as quoted in section 2; `continuation` flags from each judge's `meta.json`.
- The background `grep -r` I first started over the Core checkout timed out, and I stopped it (TaskStop). Nothing else
  was left running.

## Not verified

- I did not run the provider-free harness, so I did not observe its 4 of 4 myself. It is taken from the ledger and the
  brief.
- I did not write or run the proofs proposed in section 4. They are designs, each pinned to this recording's data.
- I did not check whether Sonnet would say yes with the F2 evidence; that needs a paid call.
- I did not check the oracle's verdict for each attempt. The brief says attempt 1 was right, and the cart rows match
  `qualification/new-store-cheapest-towels.ts`'s expected records.
- I did not read `doesAct`, `automationStudioAbsentStepSkip` or the route-signature hashing code. The claim that the step
  "moved the page" rests on its recorded `routeSignatures` paths and `stateBefore`/`stateAfter` differing, and on the
  cart URL after 0020.

## Open questions or contradictions found

- **The brief says attempt 2's replay "ran every click, the cart link included".** It did not. Add to cart was left alone
  (correctly), and "View cart" failed and was passed over.
- **`not-arisen.ts`'s header cites the "View cart" of the drawer an Add opens as the case it was written for.** That case
  needs the destination reached, not just the step skipped, so the rule's own example is the one it gets wrong once t1073
  lets it apply.
- **F2 is a design question for the lead.** It decides how much page text a replay judge may carry beside the trail, all
  within the existing page budget, and which views come first.
- **The first replay of every newly saved Flow is judged by design (`flow_not_proven`).** Until F2 lands, every live
  task whose conditions are checked by reading a page, rather than by a filter, will repair on that replay, as this one
  did. That matters for the other live tasks queued in Current State.
