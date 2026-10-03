# Run debug — `run-muqk4u32-0b36e58f`

Written after the run from its evidence only (worker t174-w70, no provider call): the Lab bundle
`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqk4u32-0b36e58f/`, the instance bundle and Core command attempts under
`fxwork/t174/!FluxIQWebExtension/test-runs/instances/t174-slot-1/`, and the scenario manifest
`apps/scenario-lab/src/scenarios/crossborder-marketplace/manifest/`. Stage 1 was written from the instruction and the
manifest before the step folders were read.

---

## Header

- Run id: `run-muqk4u32-0b36e58f`. Lane A run 44 (the run after `run-muqiho5c-e830ce01`), slot `t174-slot-1`, headed
  Chromium 134, started from the extension chat.
- Scenario / variant / task: `crossborder-marketplace` / no variant / `crossborder-marketplace-hub-to-cart`, seed 7342.
- Command: `NO EVIDENCE:` `run.json` and `entry.json` record the task (`crossborder-marketplace/crossborder-marketplace-hub-to-cart`),
  pid 29572 and instance, but not the command line that started the Lab.
- Trees: downstream `3963eabe` (dirty), Core `eed0cc34` (dirty) (`run.json` `repositories`). F37
  (`72b36aff`, press result `changed` lines) and Core `532b541c` (a `remembered` replay reads done) both landed
  **after** this run and were not in it.
- Date, provider, model: 2026-10-02 06:03:38 to 06:11:25 UTC (467 s; build 06:07:24 to 06:10:46, 203 s), DeepSeek,
  `deepseek-flash`.
- Provider calls, tokens, cost: **25 calls, $0.061715**, 391,703 input / 2,801 output tokens (sum of each step's `meta.json`).

  | Phase | Calls | Steps | Input / output tokens | Cost (USD) |
  | --- | --- | --- | --- | --- |
  | Chat (panel command) | 1 | 0001 | 1,495 / 71 | 0.000346 |
  | Build decisions (iterations 1-21) | 21 | 0003-0058 | 379,670 / 1,927 | 0.058335 |
  | Instructed acts (consequence reading) | 1 | 0072 | 2,088 / 102 | 0.000335 |
  | Judge (build-test verification) | 1 | 0071 | 3,696 / 377 | 0.001448 |
  | Recovery (runtime diagnosis, harness intervention) | 1 | 0073 | 4,754 / 324 | 0.001251 |
  | **Total** | **25** | | **391,703 / 2,801** | **0.061715** |

  The ledgers disagree by which calls they count: `entry.json` `costUsd` 0.061369 is the total without the chat call;
  `flow-lane.json` `build.accounting` 0.060119 / `build.providerCalls` 23 is the build decisions, the instructed-acts
  call and the build judge; `evaluation.json` `llm.calls` 24 is everything but the chat call. No recovery patch was
  attempted, so recovery spent only the diagnosis.
- Verdict as reported: **failed**, `runtime.behavior`, "The created Flow ran, but the scenario's playback goal did not
  hold afterwards (facts not held: cart-count, cart-line)". The product itself reported **passed** (`reportedVerdict`,
  `resultVerification: confirmed`, chat card "Test run · Passed: the result was judged to answer the request").
- **Stage reached: 4 (replay).** A Flow was proposed, its build test replayed every step, and playback ran all 12 nodes
  with one absorbed retry; the answer (stage 5) was wrong: the cart stayed at `Cart (0)`.

## Stage 1 — the instruction and the expected chain

- The instruction, verbatim: "On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my
  cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do
  not buy anything."
- The node chain a correct Flow must have, written before looking at the run:
  1. Navigate to the storefront start.
  2. Dismiss the "Welcome back" coupon popup (optional: may be absent).
  3. Type "Voltbay USB-C hub" into the search field and submit.
  4. Open the Voltbay Official Store listing (opens a new tab).
  5. Dismiss the consent banner (optional).
  6. **Make sure** Space Grey is the chosen colour: press it only when it is not already chosen. A press of an option
     already chosen may un-choose it.
  7. Choose 7-in-1.
  8. Choose Spain as ships-from.
  9. Press Get coupons (the page may answer "busy"; retry).
  10. Set the quantity to 3.
  11. Press Add to cart, and read what the page answers (a cart count change, or a validation notice).
  12. Stop. No checkout, no Buy now.
- What a wrong answer that looks right would look like here: every node "succeeded" and every act is marked done, but
  the cart is empty because an option was toggled off or Add to cart was refused with a notice; or Buy now pressed in
  place of Add to cart. Goal facts (`manifest/facts.ts`): `cart-line` = "Voltbay Official Store · Voltbay USB C Hub …
  · Space Grey · 7-in-1 · Ships from Spain · × 3", `store-coupons` = the Voltbay Official Store coupon, and the final
  state `cart-count` = "Cart (3)", `orders-shipped` = "Orders to be shipped (0)".

## Stage 2 — exploration

One row per model call, in order. Tool results are Core's answers to the call before them.

| # | Step | Cost | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 0001 | 0.000346 | Chat: route the typed instruction | `flow.createHere` with the instruction verbatim | — | Build started ("Doing "Create an automation here"", `00003-…jpg`) |
| — | 0002 | — | (no model) F31 opening arrival | — | `browser-navigate` `…/scenarios/crossborder-marketplace/` | succeeded; page covered by `t476` (welcome popup) |
| 1 | 0003 | 0.003870 | Next step on the start page (12,799 tokens in) | "Dismissing the cookie banner and welcome popup, then searching" | `dom-click` `t475` (callId dismiss.cookie) | `target_covered`: covered by `t476`, `closeWith` `t478`,`t488`, "make this same call again, unchanged" |
| 2 | 0005 | 0.003257 | Same, after the refusal | Close the welcome popup with its own × | `dom-click` `t478` | succeeded, control "×" |
| 3 | 0007 | 0.002644 | Next step | Search for the hub | `dom-type` `t489` text "Voltbay USB-C hub", submit | succeeded, search results |
| 4 | 0009 | 0.002699 | Next step | Open the Voltbay Official Store listing | `dom-click` `t648` | succeeded, new tab `item/1005008123450` (F20). **The item page arrives with `t939 "Space Grey"`, `t941 clickable "Space Grey" marked`, `t951 "4-in-1" marked`, `t958 "China" marked`** |
| 5 | 0011 | 0.002538 | Next step on the item | "dismiss the cookie layer, then select Space Grey, 7-in-1 and Spain…" | `dom-click` `t1041` | succeeded, control "Reject non-essential" |
| 6 | 0013 | 0.002466 | Next step; the page still shows `t941 … "Space Grey" marked` | "Selecting the Space Grey, 7-in-1, Spain variant" | `dom-click` `t941` | succeeded, `pageChanged`, control "Space Grey", "landed on img, inside the target". **The press un-chose the colour**: `t939 "Space Grey"` is gone and `t941` lost `marked`. The result said only `ok`/`pageChanged`/control; nothing named the change |
| 7 | 0015 | 0.002360 | Next step | Choose 7-in-1 | `dom-click` `t952`, add, act `a1.version` | succeeded; `t952 "7-in-1" marked` |
| 8 | 0017 | 0.002325 | Next step | Choose Spain | `dom-click` `t959`, add, act **`a1`** (the cart act itself) | succeeded; `t959 "Spain" marked`, "Ships from Spain" |
| 9 | 0019 | 0.002330 | Next step | amend_draft: add step 7 (the Space Grey press) as act `a1.colour` | `{"step":7,"change":"add","act":"a1.colour"}` | applied; the draft now calls colour done by the press that un-chose it |
| 10 | 0020 | 0.001660 | Next step | Collect the coupon | `dom-click` `t935`, add, act `a2` | `action_failed` (page: "Network busy, please try again", `00006-…jpg`). The result carried only `code: action_failed`, no `busy` wording |
| 11 | 0022 | 0.002372 | Same, after the failure | Retry the coupon press | `dom-click` `t935`, add, act `a2` | succeeded; `t1084 "Coupon collected…"` |
| 12 | 0024 | 0.002448 | Next step | Quantity 3 | `dom-type` `t965` text "3", add, act `a1.quantity` | succeeded, field holds "3" |
| 13 | 0026 | 0.002529 | Next step; `t1009 "Add to cart" covered-by t1034` (the store chat widget) | "Adding the cart step … with Space Grey, 7-in-1, Spain and quantity 3 already set" | `dom-click` `t1009`, add, act `a1` | succeeded: "the page ignored the first press, so it was pressed once more; … recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog". **The page after it shows `t968 "Please select a Color."` and `t885 "0 Cart"`** |
| 14 | 0028 | 0.002592 | Next step (18,754 tokens in) | complete: "All acts are done … selects Space Grey 7-in-1 from Spain … adds to cart" | complete | Dry run 1 (0029-0037): reset, step 1 replayed, then steps 6-13 **unreproducible** (`target_not_found`): the test stayed on the home page because steps 3-5 (×, search, open listing) were never added (disposition `taken`) |
| 15 | 0038 | 0.003419 | Dry-run refusal with per-step codes and instruction "the steps before it no longer reach that page" | "re-run the item-page steps from the search results page" | amend_draft `{"step":6,"change":"rerun","input":{"target":{"handle":"t1041"}}}` | Reset to the item page, then `target_unobserved` (`handle_not_in_packet` `t1041`) |
| 16 | 0041 | 0.002860 | Same | "re-run the consent dismissal on the item page" | `dom-click` `t1005` (a covering layer with no words) | succeeded, "the page ignored the first press, so it was pressed once more"; not added. Page now shows Space Grey `marked` again (fresh page) |
| 17 | 0043 | 0.002650 | Same | complete, draft unchanged | complete | Dry run 2 (0044-0052): identical to dry run 1, steps 6-13 unreproducible |
| 18 | 0053 | 0.003647 | Dry-run refusal (`again`) | "mark the remembered consent dismissal optional" | amend_draft step 6 optional | applied |
| 19 | 0054 | 0.001714 | Same | "re-add the search and item-opening steps" | amend_draft step 4 keep, step 5 keep | applied (step 3 "×" also replayed in the next dry run, so it was kept with them) |
| 20 | 0055 | 0.001707 | Same | "re-run the search and item-open steps" | amend_draft step 4 rerun (same text), step 5 rerun | Reset to the home page, then `target_unobserved` `t489` (`handle_not_in_packet`) |
| 21 | 0058 | 0.006249 | Same (23,571 tokens in) | complete: "search…, open…, collect its coupon, choose Space Grey, 7-in-1, … Spain, set quantity 3 and add to cart" | complete | Dry run 3 (0059-0070): 1, 4, 5, 7, 8, 9, 12, 13 replayed; 3, 6, 11 remembered. **Passed** |
| 22 | 0072 | 0.000335 | Instructed consequences | `create_new` "put three … in my cart"; `modify_existing` "Collect that store's coupon" | — | Recorded; the chat later asked "Apply it as it stands?" (`00017-…jpg`) |

- Repeats, and what the loop believed was progress: two completions (0028, 0043) with the same draft gave two identical
  dry runs ($0.0027 and about 50 s of replay wasted). The model believed rerunning the consent step (0038, 0041) would
  "re-anchor" the item-page steps; the dry-run instruction said the earlier steps no longer reach the page, which it
  only acted on at 0054. Two reruns (0038 step 6, 0055 step 4) were sent after a reset with handles from an older page
  and were refused `target_unobserved`.
- Rejections and refusals received, and whether each said enough to route around:
  - 0004 `target_covered`: yes; it named the layer and its own closers; the model used `t478` next.
  - 0021 `action_failed`: barely; the code carried no "busy" wording, but the model read the page notice and retried.
  - Dry-run refusals 1 and 2: enough in words ("unreproducible: … the steps before it no longer reach that page"), but
    the per-step list showed only steps 1 and 6-13, so the missing steps 3-5 had to be inferred from the draft's
    `disposition: taken`.
  - 0040 and 0057 `target_unobserved` (`handle_not_in_packet`): enough to stop, not to recover (no current handle
    offered).
  - **No refusal at all** for the two results that mattered: the Space Grey press at 0014 and the Add to cart at 0027
    both answered `succeeded`.
- Where the context was evicted or truncated, if anywhere: none recorded (`truncated: false` on every page; evidence
  `truncationCount` 0). The request grew from 50,137 chars (0003) to 90,945 (0058). The "Please select a Color." line
  was present in the evidence (one line among about 115) but nothing pointed at it.

## Stage 3 — the proposed Flow

- Node list as authored (`snapshots/flow-lane.json` `authoredNodes`, with selectors from the build test 0059-0070):

  | Node | Definition | Parameters |
  | --- | --- | --- |
  | s1 | `web.output.browser-navigate` | url `http://127.0.0.1:49637/scenarios/crossborder-marketplace/` (withheld in the snapshot), newTab false |
  | s2 | `web.output.dom-click` | div "×", selector `body > div:nth-of-type(4) > div > div:nth-of-type(1)` |
  | s3 | `web.output.dom-type` | input "Autumn Mega Sale: up to 70% off" `#fbofx0n4`, text "Voltbay USB-C hub", submit true |
  | s4 | `web.output.dom-click` | a "Voltbay USB C Hub Multiport Adapter …", `main > div > section > div:nth-of-type(2) > div:nth-of-type(4) > div > a` |
  | s5 | `web.output.dom-click` (optional) | div "Reject non-essential", `body > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(2)` |
  | s6 | `builtin.control.merge` | joins s5's success and skip |
  | s7 | `web.output.dom-click` | div accessibleName "Space Grey", `main > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1)` |
  | s8 | `web.output.dom-click` | div "7-in-1", `… > div:nth-of-type(4) > div:nth-of-type(2) > div:nth-of-type(2)` |
  | s9 | `web.output.dom-click` | div "Spain", `#fbqexb15 > div:nth-of-type(2) > div:nth-of-type(2)` |
  | s10 | `web.output.dom-click` | div "Get coupons" in shadow host `fb-store-coupon` |
  | s11 | `web.output.dom-type` | input (no name), `… > div:nth-of-type(6) > div:nth-of-type(2) > input`, text "3" |
  | s12 | `web.output.dom-click` | div "Add to cart", `[data-testid="add-to-cart"]` |

  12 nodes, 11 actions (1 navigate, 8 clicks, 2 types), no extraction. Routing: one subflow, no rules
  (`route.fallbackUsed: true`, `stateObserved: false`).
- Divergences from the stage 1 chain, one line each, naming the node:
  - **s7** presses Space Grey unconditionally. The colour arrives chosen on every fresh item page (`t941 … marked` at
    0010, 0012 and 0042), so s7 always un-chooses it. Stage 1 step 6 needs "only if not chosen" or no press.
  - s2 (welcome ×) is not optional although it is a popup; it passed only because the dry run read it `remembered`.
  - s12 has nothing after it that reads the page's answer; the Flow cannot tell "Please select a Color." from a cart
    change.
- For each divergence:
  - s7: **misread the page** (the model did not see `marked` on the option it pressed, and after the press did not see
    `t939` go and `marked` drop) and **could not express it** (no grammar for "press only if not already chosen" short
    of an `only_if` on a check it never ran).
  - s2 not optional: misread the grammar (the draft instruction says popups are optional; the model marked only s5).
  - s12 unread answer: misread the page at 0027 (`t968 "Please select a Color."` was on the page it was shown).

## Stage 4 — replay

Playback from Core's command attempts (`test-runs/instances/t174-slot-1/.work/run-muqk4u32-0b36e58f/fluxiq-root/.fluxiq/artifacts/runtime/command-attempts/`,
12 attempts) and `steps/0074-0085`. Runtime run `51c254dc-7234-4b21-bce4-8b9b75a7c97d`.

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| s1 | navigate `…/scenarios/[withheld]/` (attempt d5397d1f) | "Navigation completed", tab moved from the item page | 2,362 ms | 0 | — |
| s2 | click "×" (ba3527ed) | landed 828,243; popup present and closed | 681 ms | 0 | — |
| s3 | type "Voltbay USB-C hub" + Enter (4d06afe5) | form submitted | 655 ms | 0 | — |
| s4 | click listing (871b4773) | new tab `item/1005008123450` | 1,717 ms | 0 | — |
| s5 | click "Reject non-essential" (5e43598a) | landed 1046,645; consent present and closed | 665 ms | 0 | — |
| s6 | merge | — | 0 ms | 0 | — |
| s7 | click "Space Grey" (eeda8e68) | "landed on img, inside the target"; **un-chose the colour** (`00020-…jpg`: "Color:" with no value) | 959 ms | 0 | — |
| s8 | click "7-in-1" (a3dddb8f) | chosen | 955 ms | 0 | — |
| s9 | click "Spain" (ba9e4423) | chosen ("Ships From: Spain") | 975 ms | 0 | — |
| s10 | click "Get coupons" (ae4dd0a0) | `web.action.rate_limited`: "the page answered … that it was busy", effect `unacted` | 1,130 ms | 1 | Core retry ("Trying the step again", recoveredFailures) |
| s10 | click "Get coupons" (0bc44b50) | landed 849,361; coupon collected | 1,364 ms | — | — |
| s11 | type "3" (82366197) | field holds "3" | 137 ms | 0 | — |
| s12 | click "Add to cart" (510cd51a) | "the page ignored the first press, so it was pressed once more; … recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog"; page shows **"Please select a Color."** (`00022-…jpg`), cart unchanged | 2,308 ms | 1 (inside the command) | extension click rung (second press + dialog close) |

- Any node that reported success while doing nothing: **s7** (succeeded, and undid a chosen option) and **s12**
  (succeeded; the page refused the add with a validation notice, which the click read as "ignored the first press" and
  pressed again into the same refusal). Both were also "replayed" in dry run 3 (0065, 0070), which checks that a step
  runs, not what it leaves.
- Provider calls during replay (expected: zero): **zero**. The one call after playback (0073) is the harness's runtime
  diagnosis, not a replay call.

## Stage 5 — the answer

- Records expected vs returned: none declared (`oracles.records: not_declared`); this task is judged on page facts.
- Fields compared, matched, mismatched: four facts. Held: `store-coupons` (the coupon) and `orders-shipped` (nothing
  bought). Not held: `cart-count`, `cart-line`.
- Every mismatch, observed value beside expected:
  - `cart-count` (`mini-cart-count`, text): expected `Cart (3)`, observed `Cart (0)`.
  - `cart-line` (`mini-cart-line`, text): expected `Voltbay Official Store · Voltbay USB C Hub Multiport Adapter Type C
    to HDMI 4K 60Hz USB 3.0 PD 100W SD TF Card Reader Docking Station for Laptop Tablet · Space Grey · 7-in-1 · Ships
    from Spain · × 3`, observed `null` (no line).
  - Why: Add to cart (s12) requires a colour. s7 pressed Space Grey, which the item page had already chosen, so it
    became un-chosen; the page answered the add with `t968 "Please select a Color."` and added nothing. The same
    sequence happened in exploration (0014 then 0027) and was the model's evidence for the Flow. 7-in-1, Spain,
    quantity 3 and the coupon were all correct.
- If the comparison was count-only, say so: it was not; each fact is compared on its full text.

## Stage 6 — judgement and repair

- Did the system judge its own result, and what did it conclude: yes, twice, both wrong.
  - Build-test verification (0071, $0.001448, confidence 0.72): "The Flow appears to do everything the instructions
    ask … No change needed", `answersRequest: yes`. Its context (6,528 chars) was the step list (`flowShape`,
    `buildTest`) and record counts: **no page after the test**, no "Please select a Color.", no cart count, no
    `marked` state. Recorded `resultVerification: confirmed`.
  - Runtime diagnosis after playback (0073, $0.001251, confidence 0.75): "All steps succeeded … No change needed",
    `patchNeeded: false`. Its context was `recentActions` (12 entries, about 250 chars each): actions and statuses only,
    again no page state.
- If the answer was wrong, did a repair trigger automatically: a harness intervention ran (`harnessRecovery.attempted:
  true`, one `diagnosis`), but it concluded no patch, so `runtimePatchAttempts` is empty and no adaptation was made.
- What context did the repair receive:
  - Present: the conversation's instruction, the Flow's steps with action types and statuses (and the build test's
    replay codes for 0071).
  - Absent: the page as it was when it went wrong (the final page with "Please select a Color.", `0 Cart`, the colour
    un-chosen); per-step parameters beyond the control words; any per-step page change; the goal facts.
  - The failing node in place: not identified, since nothing failed by the system's own reading.
- Was the repair persisted, and did the re-run use it: no repair was made; nothing was persisted.

## UI review

Screenshots under `screenshots/` (Lab bundle) and the local UI review `t174-slot-1/run-muqk4u32-0b36e58f.ui-review.local/`.

- **The build chat reads well** (`00006-6bb96b731423.jpg`): headings carry the model's reason ("Clicking "Spain" —
  Selecting Spain as the ship-from option…") with cards "Click · Spain · Done". The coupon failure card reads "Didn't
  work: the step wasn't accepted" while the page plainly says "Network busy, please try again".
- **The colour state is visible in every item-page screenshot and nothing in the panel mentions it**: "Color:" with no
  value beside "Specification: 7-in-1" and "Ships From: Spain" (`00006-…`, `00016-…`, `00020-…`), and "Please select a
  Color." under the quantity (`00017-…`, `00022-…`).
- **A `remembered` replay reads as a failure** (`00008-c986f5378e73.jpg`, `00012-e3d59e3c064d.jpg`,
  `00016-9537324001c4.jpg`): "Test run · Reject non-essential · Didn't work: it didn't work the same way again" in dry
  run 3, where Core marked it `core.replay.remembered` (held). Fixed after this run by Core `532b541c`
  (`ui/activity-action/replay-failing.ts`).
- **The dry run's reset card reads "Test run · Passed"** (`00008-…`, `00012-…`) as its first card, before any step ran,
  then "Test run · Done" for the navigation.
- **Unreproducible steps say only "it didn't work the same way again"** (`00008-…`): nothing says the test never
  reached the item page.
- **"Test run · Space Grey · Done"** in dry run 3 (`00016-…`) while the page beside it shows no colour chosen.
- **The end of the build asks a jargon question** (`00017-21807cd7251c.jpg`): "The instruction asks for modify_existing
  and create_new, and none of this run's 72 actions said it would cause that; 72 of them said they would cause nothing
  lasting. Apply it as it stands? Yes / No". It exposes internal consequence codes and counts replays as "actions".
  `NO EVIDENCE:` of how it was answered; playback started 2 s later.
- **Playback cards** (`00020-a25f64da8b90.jpg`, `00022-956e048b51ee.jpg`): "Join paths · Done" for the merge node;
  "Type · the page" for the quantity field, which has no accessible name (F36 not yet in this tree); "Recovery started
  / Trying the step again" around the coupon retry reads well; the final card "Test run · Passed: the result was judged
  to answer the request" contradicts the empty cart and the red notice on the page beside it.
- **On-page overlay** (UI review moments 2-15): present and visible through the build and playback; moment 7 flagged
  `flickering` (3 text changes in 3 s, "Trying the Flow from the start: clicking "Add to cart" — it didn't work the
  same way again" → "Thinking about the next step" → "Clicking on the page"). "Clicking on the page" is the press of
  `t1005`, a layer with no words. In playback the counter advanced on the retry: "Running step 10 of 12: Clicking "Get
  coupons"" then "Running step 11 of 12: Clicking "Get coupons"" (moment 14), so the count no longer matches the node.
- The notification layer "Never miss a price drop" stayed open over the page for the whole playback and to the end
  (`00017-…`, `00022-…`); it covered nothing the Flow needed.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | **The press result at 0014 did not say what it changed.** Pressing `t941 "Space Grey" marked` removed `marked` from `t941` and removed `t939 "Space Grey"`; the result was `ok`, `pageChanged: true`, `control: "Space Grey"`, and the model carried on as though the colour were chosen (0019 added it as `a1.colour`). | downstream `domain/src/runtime/llm-evidence/node-run/outcome.ts` (built in `node-run/run.ts`) | F37: the result lists the changed lines by handle (`press-effect/page-changes.ts`, landed `72b36aff`, after this run) | t174 / F37 |
| 2 | **The model pressed an option already chosen.** The page it was shown at 0013 had `t941 clickable "Space Grey" marked`; the web instructions say nothing about not pressing a chosen option, which on this site toggles it off. | downstream web system instructions (t237, web-1/web-2/web-3), `domain/src/runtime/llm-evidence/` instructions | Instruction line: an option shown `marked` is already chosen; do not press it; check after a press that it is still marked | lane A (next fix) |
| 3 | **The Add to cart refusal was read as success.** The page answered with `t968 "Please select a Color."`; the click read it as "the page ignored the first press", pressed again and returned `succeeded`. The extension recognises a "busy" notice as a refusal (`web.action.rate_limited`), but not a form-validation notice next to the control. | downstream `apps/extension/src/content/actions/click.ts`, `apps/extension/src/content/action-runtime/rate-limit-notice.ts` | A press answered by a new alert/validation line near the control fails with the notice's words (`web.action.refused_by_page` or similar), never retried blindly | lane A (next fix) |
| 4 | **The act check marked `a1.colour` done** on step 7, the press that un-chose the colour, and `a1` done on Spain (0017) and on Add to cart; nothing compares the page with the act's value. | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/act-claim.ts` | Act-object binding (routed to lane D since run 40) | lane D |
| 5 | **The build test replays steps, not outcomes.** Dry run 3 replayed s7 and s12 as `core.replay.replayed`; it never checks that a choice is still chosen or that the add changed the cart. | Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/node-tools/replay-draft.ts`, `runtime/flow-draft/dry-run.ts` | The test's last page (and each step's `changed` lines from F37) goes to the judge; see 6 | lane D |
| 6 | **Both judges judged a step list with no page.** 0071's context was `flowShape` + `buildTest` (6.5k chars) and 0073's was `recentActions` (12 status lines); neither held the page after the run, so "Please select a Color." and `0 Cart` were never seen. | Core `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/summary.ts`, `build-test/observation.ts`; `runtime/llm/harness/context-packet.ts` | Give each judge the page the run ended on (the view's lines, compact) and the per-step changes | lane D |
| 7 | **Steps 3-5 (×, search, open listing) were never added**, so dry runs 1 and 2 ran step 6 on the home page; the model spent 0038, 0041 and 0043 rerunning the consent step and completing unchanged before keeping them at 0054. The dry-run step list omitted the steps that were not in the Flow, so the gap was not visible in the refusal itself. | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/dry-run.ts` (refusal wording), `flow-draft/opener.ts` (what is kept with a later step) | The refusal names the draft steps between the last replayed step and the first unreproducible one that are `taken` and not in the Flow ("steps 3-5 are not in the Flow; the test never reached …/item/…") | lane A / Core |
| 8 | **Reruns after a reset used handles from an older page** (0038 `t1041`, 0055 `t489`), refused `target_unobserved` with no current handle offered. | Core `runtime/flow-draft/amendment.ts` (rerun), downstream `domain/src/runtime/llm-evidence/node-run/run.ts` (handle lookup) | A rerun that keeps the step's `control` words resolves them on the page it was put back on, or the refusal offers the current handle | lane A |
| 9 | **UI: a `remembered` replay read "Didn't work"**; the reset reads "Test run · Passed"; the consequence question shows internal codes; the overlay step counter advances on a retry. | Core `packages/fluxiq/src/ui/activity-action/replay-failing.ts` (fixed `532b541c`); Core `runtime/activity/step.ts`; consequence prompt: `NO EVIDENCE:` of its owning file in this debug | Fixed (remembered); the rest open | lane A UI |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| Header | The command line that started the Lab | `run.json` / `entry.json` (test-runner) record task and pid only |
| Header | One cost ledger: `entry.json` omits the chat call, `flow-lane.json` `build.accounting` omits the chat and the runtime diagnosis, `evaluation.json` counts 24 calls | test-runner flow-lane accounting |
| 2 | Why steps 3 (×) and 6 (consent) became `kept` without an `add` from the model | the draft's step records carry `disposition` but not who set it (Core `flow-draft/step.ts`) |
| 2 | 0021 `action_failed` carried no reason, where playback's same refusal said `web.action.rate_limited` "busy" | downstream `domain/src/runtime/llm-evidence/node-run/outcome.ts` drops the failure's code/actual for a refused press |
| 4 | Playback's page after each node (only `afterAction` byte counts are kept, about 6-10 KB each) | test-runner flow-lane `actions[].evidencePackets` (bytes only) |
| 6 | How the "Apply it as it stands?" question was answered | not logged by the panel or `scenario-lab.log` |
