# Debug: run-mvswhobv-5eb308c0 (adaptation gate round 1, crossborder basket-redesign, Step A)

Status: FAILED, no Flow saved. Read-only diagnosis (brief D-gate-cb-1, 2026-10-28). No source edit, build, test, Lab run,
model call or git command. Page text below is limited to control names and cart line text needed to show a step.

**Short version.** The build was refused at the trial door every time. Its cart step was refused
`candidate.trial_step_unwitnessed` 11 times out of 11, each in about 5 ms, and no trial ever ran. On crossborder, the
add-to-cart's effect shows on `/cart`. That page is an empty-state panel before the first add, and after it the cart
lines are styled `<div>`s with no list or table role. The domain only turns semantic lists or tables with at least one
row into reset collections, so no cart read ever issued a destination ref. Core's admission has no other witness for
a creation whose effect shows on another page. So the refusal's instruction ("press that control once ... naming as
resetDestination the ref of the list where its effect would show") could not be met, yet it said
`canMeet: "another_page"`. The only ref it offered, `destination-1` (the home page's 14 items), was read in another
browser tab and can never witness a press on the item tab. Exploration accepted that ref on presses with no word
that it witnessed nothing. The model spent $0.199 of the $0.25 purse looking for a witness that could not exist, and
left 4 hubs of the wrong variant in the cart.

## The run

- Task `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation`, variant `basket-redesign`, armed after the
  build (`variantArmedAfterBuild: true`, `live-tasks.ts:103`), so Step A builds on the unchanged site. Instance
  `gate-cb`, lane tree `fxwork/t719`, downstream `85f7d050`, Core `4e2e411c`. DeepSeek flash, temperature 0, $0.25 purse.
- Instruction (0002): "put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the
  7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything."
- Timeline (`logs/core.log`, `events.ndjson`): chat sent 02:10:23, build 02:10:24 to 02:21:07 (642.6 s), ending
  `build throw ... code=flow_bootstrap.post_provider_validation_failed`. Issue codes on the Lab failure (seq 50):
  `project.build_blocked`, `project.build_ending_told`. There was one person hand-off (traffic-screen, cleared in
  3.7 s, seq 23, step 0131). The launcher log shows no balance error or provider fault, and `live-guard` recorded
  $0.199265904 with `buildsOverCeiling: 0`.
- Lab observation: `flowCreated: false`, oracle and reported verdict null, 144 calls.

### Cost and calls by phase (sum of `steps/*/meta.json` `costUsd`)

| Phase | Calls | Cost |
| --- | --- | --- |
| chat routing (0001) | 1 | $0.0003 |
| supervisor (plan, 4 dispatches, 3 looks, 2 completes) | 10 | $0.0120 |
| brief-1 (0007-0049) | 21 | $0.0290 |
| brief-2 (0052-0120) | 34 | $0.0422 |
| brief-3 (0129-0213) | 42 | $0.0650 |
| brief-4 (0218-0289) | 36 | $0.0508 |
| **total** | **144** | **$0.1993** (80% of the purse; $0.051 left) |

There was no trial spend: every `core.test_subflow` was refused before running.

## 1. How far it got

**Plan (0003-0006).** There was one subflow, `add_hub_to_cart`, carrying two parts:

- p1 (cart): effect `change/adds/3`, lasting `create_new`;
- p2 (coupon): effect `change/adds/1`, lasting `create_new`.

notAsked had four entries, buying among them. The plan was accepted as written.

**Brief-1 (0007-0049).**

- 0009: rejected cookies. This read issued the build's only ref, `"resetDestinations": {"collections": [{"ref": "destination-1", "count": 14}]}`. That is the home page, in tab `319446218`.
- 0011-0013: searched and opened the item. **The search result opens the item in a new tab** (`tab:319446219` from 0013).
- 0015 and 0017: closed the chat and the notification prompt.
- **0021: clicked "Get coupons" with `consequences: []`.** The page answered "Coupon collected. It will be applied at checkout." This was a real lasting act, declared as none.
- 0023: submission refused, `candidate.way_out_refused` (an optional step that "presses "Get coupons", which takes what that offers") plus `bootstrap.instructed_act_only_optional`. The refusal was correct.
- 0025: revision 2 accepted. The builder had never pressed Add to cart while exploring.
- **0027: first trial refused `candidate.trial_step_unwitnessed`, `canMeet: "another_page"`, steps 6 (coupon) and 11 (add to cart):** "Nothing names where this step's change would show: no list it would show in was read complete ... Refs already issued for lists read complete: destination-1 (14 items at .../crossborder-marketplace/)".
- 0029-0043: chased the witness:
  - 0033: pressed coupon "Collected" with `resetDestination: destination-1`, which was `effectUncertain`;
  - 0035: read `/cart` ("Your cart is empty");
  - 0039: ran `detect_repeating_structure` on the cart badge, which read the item's option chips;
  - 0045-0049: three `llm_evidence_loop.repeat_refused (same_result)` navigations, and the builder was stopped.

**Brief-2 (0052-0120).**

- 0057-0061: chose 7-in-1, Space Grey and Spain.
- 0064: revision 1 accepted. **The coupon step was now `consequences: none` and not optional**, and that was accepted.
- 0066: trial refused, step 7 (add to cart) unwitnessed.
- 0078: read `/cart`, still empty (`itemCount 1` on the empty-state panel).
- 0080: Add to cart with `resetDestination: destination-1`, refused `target_unobserved` (a stale item handle used on the cart page).
- **0086: Add to cart with `resetDestination: destination-1` succeeded with no note** ("Added to cart!"). It came after re-navigating at 0084, so the chips had reset: the cart line reads "Space Grey · 4-in-1 · Ships from China" (0088, `Cart (1)`).
- 0110: `detect_repeating_structure` on the cart lines (`Cart (1)`, div rows), with no ref issued.
- 0106-0120: six `repeat_refused`, and the builder was stopped.

**Supervisor (0121-0128).** Used its 3 looks with `find_on_page` on the cart, then sent dispatch 3 with an excerpt.

**Brief-3 (0129-0213).**

- 0131: the traffic-screen hand-off.
- 0133-0153: chose the options and quantity 3. There was no add.
- 0155: revision 1. 0157: trial refused, step 7.
- 0165: re-navigated to the item. **0167: Add to cart (destination-1) succeeded with no note.**
- 0168: the builder said "Resubmit the hub subflow with the witnessed add-to-cart press and the cart list as its reset destination". It believed the witness existed.
- 0169: `flow_bootstrap.evidence_completion_plan_invalid`. 0171: revision 3.
- 0173: trial refused, step 7.
- 0175: Add to cart again. 0177 and 0179: `candidate.unchanged_submission`. 0181: trial refused.
- 0185: cart `Cart (3)`, all 4-in-1 China. 0191: revision 6. 0193: refused.
- 0195 and 0203: stale handles.
- 0199-0201: repeat refused.
- 0205: refused. 0207: unchanged.
- 0211: Add to cart under `undoes: act-21`, refused `candidate.undo_unproved` (`consequence_not_inverse`).
- 0213: refused.

**Ending, first try (0214-0217).** The supervisor tried `complete` (partial) at 0214 and was refused
`project.completion_repair_first` (0215). It sent dispatch 4 (0217).

**Brief-4 (0218-0289).**

- 0246: revision 1, with the coupon now `modify_existing`.
- 0248: refused, steps 5 (coupon) and 7.
- 0256: Add to cart (destination-1) succeeded with no note, giving cart `Cart (4)` (0260).
- 0264: `evidence_completion_plan_invalid`. 0266: revision 3. 0268: refused.
- 0270: coupon on "Collected" (`effectUncertain`).
- 0286: revision 4. 0288: refused.
- 0289 `complete` `blocked`: "their change shows only in the cart list at /scenarios/crossborder-marketplace/cart, which no complete read was accepted as a destination ref, and further exploring is withheld."

**Ending (0290).** The supervisor's `complete` was `blocked`. Core said the Flow "has no steps yet" (seq 50).

Trials: 11 asked (0027, 0066, 0157, 0173, 0181, 0193, 0205, 0213, 0248, 0268, 0288). None ran, offline or live, and
none had a verdict. There were no resets, and the one undo (0211) was refused.

Lasting acts left on the site:

- the coupon collected (0021);
- 4 × "Space Grey · 4-in-1 · Ships from China" in the cart (0086, 0167, 0175, 0256), which is the wrong variant.

## 2. The cause

**First wrong step: 0027, and really every trial. A refusal that no call could ever meet, presented as one the model
could meet.** The chain:

1. **Domain: the cart is never a reset collection.** `webResetCollections`
   (`domain/src/runtime/llm-evidence/control-spot/collection.ts`) only reads containers with role `list`, `table` or
   `grid` whose items are `listitem` or `row`. A native list must also satisfy `nativeWhole`:
   `list.listWayOn === "none" && rows.length > 0`. Crossborder's cart (`apps/scenario-lab/src/scenarios/crossborder-
   marketplace/markup/cart.ts`, `renderCartPage`):
   - before the first add, it is an empty-state panel ("Your cart is empty"), which holds no container and no row;
   - after an add, it draws `<div class="cartStore"><b>store</b><div class="cartLine">...` with no list semantics.

   The same capture holds both shapes (`detect_repeating_structure` at 0078 found the empty panel, and at 0110 the div
   lines), but neither yields `collections`. So `create-baselines.ts` `observed` never recorded a cart original, and no
   cart read ever printed `resetDestinations`. 0009 is the only receipt in the whole run. For comparison, bigbox's cart
   is a `<ul>`/`<li>` list (`bigbox-retail/pages/cart-page.ts`). That cart is witnessable whenever it holds an item.
   The site is not at fault here: div-built carts are what real marketplaces ship.
2. **Core: no other witness exists for this step.** The admission is
   `flow-bootstrap/reset-admission/admission.ts` `automationStudioSiteResetAdmission`. For a creation pressed on the
   item page whose effect shows on `/cart`, each route fails:
   - `destination` needs an issued ref of the same `resource`;
   - `own_list` would need the control to sit inside a list read complete;
   - `control` needs exactly `modify_existing` plus a stateful control;
   - `repeats` needs an explored act that was itself witnessed.

   The step door (`site-reset/project-reset.ts` `admitted`) therefore refused every trial unrun.
3. **Core: the refusal and its ref list misled the model.**
   - `admitted` always answers `canMeet: "another_page"` with `WORDS.stepWitnessRequired(issued())`
     (`site-reset/words.ts:171`). It never checks whether a ref is reachable for that step.
   - `issuedRefs()` (`create-baselines.ts`) lists `destination-1`. That ref was read in tab `319446218`, and
     `resetResource` is a "Trusted session+tab identity" (`domain/.../sanitize.ts`). The item opens in a new tab
     (0013), and each brief opened another (`tab:...219` to `...222`). `destination()` requires
     `original.resource === control.resource`, so destination-1 could never witness this press. It was still advertised
     on every refusal (34 times).
4. **Core: the exploration door silently drops a ref that witnesses nothing.** `create-baselines.ts` `check` admits
   the press (t775, rule 5 "the exploration door admits it with none"), and `destination()` returns undefined for the
   resource mismatch. The result at 0086, 0167, 0175 and 0256 carries no note at all (keys: `addable, changed,
   control, ...`). So at 0168 the builder believed it had "the witnessed add-to-cart press". Only failed calls got a
   `resetDestinationNote`, as at 0080 and 0195.

**The model's share (secondary, not the cause).**

- Brief-1 submitted without exploring the add.
- 0021 collected the coupon while declaring `consequences: []`. The later scripts declared the coupon
  `consequences: none`, which Core accepts when the step is not optional: under-declaring a lasting act passes.
- Each witness press followed a re-navigation that reset the chips, so 4 wrong-variant hubs went into the cart.
- The done-when checks were weak (`text t880 contains "Cart"`, `"Added to cart"`).

None of this changes the outcome. With a perfect builder, the add-to-cart step was still unwitnessable.

**Task and fixture.** The task can be done: a person opens the item, picks the chips, sets quantity 3, presses Add to
cart and Get coupons. The wording is unambiguous. This is not a task or fixture defect, and not the Lab: the hand-off
was real and cleared, and there was no provider or balance fault. Machine load played no part.

**Today's merges.**

- **t775** (minimal-reset judging) is the **exposure**, not the root. Before it, the exploration door refused the
  unwitnessed press itself (`reset_witness_required`, as in job-board `run-mvrj7qg9-b6dc94f6` 0041). That would also
  have blocked this build, but earlier, more cheaply, and with no wrong items in the cart. t775 moved the refusal to
  trial time and kept the step door's demand. Since then the builder can make the lasting act freely and learns at
  the trial that it can never be judged. It also made the silent drop in point 4 possible.
- The root (point 1 plus the admission's routes) dates from **t751 R3** (10-27 17:06).
- **t786** (stale-target re-acquire) did not take part: it covers plan steps at runtime, and the stale handles at
  0080, 0195, 0203 and 0282 are exploration handles from a page the model had left, correctly refused.
- **t787** (layer handlers, toggles learned from trials, per-pass witnesses, `contradicted`), **t785**, **t783**
  (settle wording, seen only in the notes on failed presses) and **t781** were never reached, because no trial ran.

**The next blocker, once the cart is fixed (prediction, not observed).** Exploration collected the coupon at 0021,
and the fixture has no way to give it back (`client/item-script.ts`, `StoreCoupon`). So a live trial starts with p2
already done.

- With p2 planned as `change/adds/1`, the change-judged proof cannot show an add (it would be `unchanged` or
  `contradicted`).
- Planned as `end_state`, p2 is `carried` only when that same step was seen doing it earlier in the build.

## 3. The fix

Fixes 1 to 3 are needed for this build to finish. Fix 4 is a judgement call.

1. **Core plus domain: a page-level destination for a creation.** This fix is a judgement call on design.
   - Core `flow-bootstrap/site-reset/create-baselines.ts` `observed`: record a page original from `read.scope` and
     `read.subjects` for every same-resource read at its own URL, whether or not it holds a semantic list. That
     includes an empty-state page. Issue a `destination-N` receipt for it.
   - `reset-admission/admission.ts` rule 4: an identified creation naming that ref is witnessed when its subject was
     absent from the page's subjects before the act.
   - `trial-change/witnesses.ts`, `readings.ts` and `delta.ts`: add a `page` witness kind that reads the subject's
     presence again, and counts from the page's `values` (t772) for a quantity.
   - The domain already returns `scope` and `subjects` (`start-state/observe.ts`). Check that the cart line's link to
     `~/item/1005008123450` carries the same subject token as the item page's subject (`sanitize.ts` `subjects` /
     `pageSubject`), and add it there if not.

   This is generic: any list or empty state on a page, nothing about carts.

   With it, brief-1 would have read the empty `/cart` at 0029/0035 in tab 219, been issued a ref, and pressed Add to
   cart once naming it. The trial would then run, be judged on cart 0 to 3, and finish well inside the purse. A
   narrower domain-only alternative (counting non-semantic repeated rows in `collection.ts`) would not cover the
   empty-state start, so it is not enough on its own.
2. **Core: tell the truth in the refusal.**
   - In `site-reset/project-reset.ts` `admitted`, answer `canMeet: "no_call"` (with words to end honestly, or with
     fix 1's page ref) when nothing in the step's control resource can issue a ref.
   - Filter `issuedRefs()` in `create-baselines.ts` and `WORDS.stepWitnessRequired` in `site-reset/words.ts` to refs
     of the step's resource, so a ref read in another tab is never offered.
   - Run the same admission at `core.submit_subflow` so the unmeetable step is named at submission, not after
     $0.15 of hunting.
3. **Core: never drop a named ref silently.** In the exploration door (`create-baselines.ts` `check` and the ledger
   path that calls it), when `reference` is issued but `destination()` answers none, put a note on the result. The
   note says the ref was read on another page or tab, cannot show this press's change, and that the press has no
   witness.
4. **Judgement call: run the trial anyway, judged by the end view.** Under the 2026-10-27 rule, a reversible step
   with no witness of any kind could be trialled and judged by the end view, the done-when check and the
   before-state's page lines, instead of being refused unrun. Its act would be recorded as on the site (t775's
   exploration treatment). This would relax t751 R3, whose reason ("every later trial was refused") t775 already
   removed. It needs the supervisor's call, and it is what would cover the coupon in a shadow-root `<div>`, which no
   witness can read.

   On the plan side (judgement call), a one-time claim such as a coupon reads better as `effect: end_state` than
   `change/adds/1`. Planner guidance could say so generically, without naming this site.

**Regression tests.**

- Core `reset-admission/tests/` (admission): a creation naming a page ref whose earlier read lacked its subject is
  admitted `via: "destination"`; with the subject already present it is refused; a ref from another resource is
  refused or noted.
- Core `site-reset/tests/` (project-reset and create-baselines):
  - a step whose resource has no reachable ref gets `canMeet: "no_call"`;
  - `issuedRefs` filtered by resource;
  - the exploration press with an unreaching ref returns the note.
- Domain `start-state/tests/` (observe): a div-row cart and an empty-state page both answer `scope` and `subjects`,
  and a line's subject token equals the item page's subject token.
- Downstream provider-free browser path (`apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/`): from an
  empty cart, the add-to-cart press gets a destination receipt from `/cart`. Fixture-only: no model guidance changes.

## 4. UI (`run-mvswhobv-5eb308c0.ui-review.local/`, 35 moments)

- Mid-build chat (`20-mid-build-panel.png`) shows each step with its reason, as required. The reasons are the model's
  own summaries and leak Core internals, with broken grammar: "Read the cart page completely so the add-to-cart press
  has a witnessed destination, then send it again the subflow naming it", "...with that reset ref". Nothing told the
  person why it kept going back and forth between the item and the cart.
- The ending (`35-failure-panel.png`) is wrong on facts:
  - "the store coupon was not collected": it was, at 0021, and the item page shows "Collected" in
    `35-failure-scenario.png`;
  - "it holds one Voltbay USB-C hub": the cart holds 4 (badge "4", line quantity 4, subtotal 49,96 €, 0280).
- The ending says Core's part vaguely ("clicked "Add to cart", and nothing read afterwards could show whether they
  changed anything; check them if you need the site exactly as it was"). It never says that Core refused every test,
  or that 4 wrong-variant hubs are now in the cart.
- The scenario toast reads "Build failed — FluxIQ could not finish the Flow: the hub was never confirmed...".
- The ending text is the supervisor's unchecked claim (0290). The cart and coupon state Core itself read (0280, the
  shadow-root "Collected") should ground it. That is the same class as t774's "show what really happened".

## Not verified

- Fix 1 is not built or tested. I have not checked that the cart line's subject token equals the item page's
  (`sanitize.ts` subject rules not traced to the end).
- Before t751, crossborder hub-to-cart passed (October 13). I did not look for a crossborder hub-to-cart run between
  t751 and t775.
- I did not read the `contradicted` and `carried` code paths for the coupon prediction.
- I did not inspect the empty-state panel's full capture, so I have not confirmed `listWayOn` on it.
