# Run debug — `run-murwd8le-79e735a8`

Written after the run from its evidence only (worker t174-w80, no provider call, nothing run): the Lab bundle
`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-02/run-murwd8le-79e735a8/` (steps 0001-0085, `snapshots/flow-lane.json`,
`snapshots/live-llm.json`, `evaluation.json`, `entry.json`, `run.json`, `review/timeline.json`, two screenshots read for
facts only: `00014-…`, `00021-…`), the instance bundle `fxwork/t174/!FluxIQWebExtension/test-runs/instances/t174-slot-1/run-murwd8le-79e735a8/`
(`events.ndjson`, `logs/core.log`, `snapshots/decision-trace.json`, `snapshots/person-hand-offs.json`), the scenario
manifest and client (`apps/scenario-lab/src/scenarios/crossborder-marketplace/`), and the code named in the Causes
table in both trees. There is no Core work dir for this run under `t174-slot-1/.work/` (the newest is
`run-muqk4u32-0b36e58f`), so playback is read from `steps/0073-0085` and `flow-lane.json` `actions`, not from command
attempts. Stage 1 is reused verbatim from `run-muqk4u32-0b36e58f.md`: the instruction is unchanged.

---

## Header

- Run id: `run-murwd8le-79e735a8`. Lane A, round 1002-M, slot `t174-slot-1`, headed Chromium 134, started from the
  extension chat (side panel).
- Scenario / variant / task: `crossborder-marketplace` / no variant / `crossborder-marketplace-hub-to-cart`, seed 7342,
  judged by `playback-goal` `hub-in-cart` plus final state `NOTHING_BOUGHT`.
- Command (now recorded, `run.json` `invocation`): `scripts/lab/run-lab.mjs run crossborder-marketplace --live-llm
  --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow
  --instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens [screened] --llm-max-output-tokens
  [screened] --llm-max-total-tokens [screened] --llm-max-calls 48 --llm-cost-ceiling-usd 0.10`. The previous debug's
  "command not recorded" gap is closed.
- Trees: downstream `45965d7d` (dirty: one untracked report only), Core `424a70b3` (clean) (`run.json` `repositories`).
  F37 (press `changed` lines) and Core `532b541c` are in both trees; the live fixes t244/t246/t249/t250 are in.
- Date, provider, model: 2026-10-03 04:33:52 to 04:40:35 UTC (Lab folder dated 2026-10-02 local), DeepSeek
  `deepseek-flash`. Lab start to the chat instruction about 3.5 min (04:37:20.8); build 04:37:21.9 to 04:39:51.3 (150.8 s, `build.chat.secondsToEnding`);
  playback 04:39:52.0 to 04:40:21.1 (29 s); post-run result checks 04:40:22 to 04:40:28.
- Provider calls, tokens, cost: **27 calls, $0.057895**, 361,903 input / 4,120 output tokens (sum of every step's
  `meta.json`, grouped by `part`/`phase`/`taskKind`):

  | Phase (meta `part` / `phase`) | Calls | Steps | Input / output tokens | Cost (USD) |
  | --- | --- | --- | --- | --- |
  | Chat (`part` none, `panel_command`) | 1 | 0001 | 1,534 / 86 | 0.000300 |
  | Build decisions, round 0 (`creation` / `explore`) | 16 | 0003-0032 | 273,087 / 1,516 | 0.042538 |
  | Build-test judges (`creation` / `judge`) | 3 | 0046, 0047, 0069 | 11,964 / 1,162 | 0.002613 |
  | Build decisions, round 1 (`creation` / `repair`) | 4 | 0049-0055 | 62,906 / 393 | 0.010086 |
  | Instructed-consequence read (`creation` / `read`) | 1 | 0070 | 2,116 / 99 | 0.000340 |
  | Post-run result checks (`part` none, `judge`, `loop_verification`) | 2 | 0071, 0072 | 10,296 / 864 | 0.002018 |
  | **Total** | **27** | | **361,903 / 4,120** | **0.057895** |

  Reconciliation (question 6), every ledger agrees to the micro-dollar:
  - `entry.json` `costUsd` 0.057894804 = all 27 calls, chat included (the previous run's entry omitted the chat; this
    one does not).
  - `evaluation.json` `llm.calls` 27.
  - `flow-lane.json` `build.accounting` 24 calls, $0.05557662, 350,073 / 3,170 tokens = the 16 explore decisions + 3
    build-test judges + 4 round-1 decisions + the 0070 read (273,087+11,964+62,906+2,116 = 350,073 in; 1,516+1,162+393+99
    = 3,170 out). `build.loopProviderCalls` 20 = the 20 decision calls. The same figure is `events.ndjson` seq 16 and
    `decision-trace.json` adaptation accounting.
  - `live-llm.json` `runSpend.phases`: build 24 / $0.05557662, judge 2 / $0.002018208, chat 1 / $0.000299976,
    runtime 0; `runSpend.stepLog` 27 calls $0.057894804, `unattributed` 0. Its `repair` section (`purpose:
    explore_and_adapt`) holds the **same two calls as `judge`** (request ids `llm.loop_verification.5b21034e…` =
    0071 and `…25412bf9…` = 0072), and `events.ndjson` seq 19 calls them "The created Flow's repair attempt finished".
    They are the post-run result verification, not a repair (Causes 12).
  - Not reconciled: `live-llm.json` `observed.observedCalls` lists only the 20 loop decisions, each with
    `requestId: null`, `taskKind: null`, beside `unrecordedCalls: 4`, `perCallRecords: "not recorded"`; steps/ holds all
    27 (Instrumentation gaps).
  - Per-flow ceiling $0.10 (`perBuild.ceilingUsd`): build $0.0556, not over.
- Verdict as reported: **passed** (`entry.json`, `evaluation.json`), `oracleVerdict: passed`, `oracles.finalState:
  held`, `records: not_declared`. The product reported **unverified**: `resultVerification: unverified`,
  `reportedVerdict: unverified`, run status `succeeded`; `live-llm.json` `verification`: `basis: model_unconfirmed`,
  `code: core.result.refutation_unconfirmed`, `verdicts: [does_not_answer, unsure]`. One person hand-off:
  `traffic-screen` at stage `build` (during build test 2, step 0059), cleared via chat in 3.4 s
  (`person-hand-offs.json`).
- **Stage reached: 6 (judgement).** The Flow was proposed, playback ran every node with zero provider calls, the
  answer was right (all four facts held), and the system judged its own result: unverified, with no repair (none was
  due).

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

One row per model call, in order. Tool results are Core's answers to the call before them (the step after it).

| # | Step | Cost | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 0001 | 0.000300 | Chat: route the typed instruction | `flow.createHere`, name "Add 3 Voltbay USB-C hubs to cart" | — | Build started |
| — | 0002 | — | (no model) opening arrival | — | `browser-navigate` `…/scenarios/crossborder-marketplace/` | succeeded; `COVERING t467 consent`, welcome popup `t476` up |
| 1 | 0003 | 0.003662 | First decision (12,958 tokens in) | "Dismissing the cookie banner…, then I will search" | `dom-click` `t474` ("Reject non-essential"), add | 0004 `target_covered`, instead `t476`, `closeWith` `t478`,`t488`, "make this same call again, unchanged" |
| 2 | 0005 | 0.003595 | After the refusal | "Closing the cookie banner with its own ×" (it was the welcome popup's ×) | `dom-click` `t478` | 0006 succeeded; changed: "Welcome back, Mara!" and 5 coupon lines gone. The consent press was never made again; the banner stayed (`route_state.3` on the results page still lists "Reject non-essential / Accept all"), harmlessly |
| 3 | 0007 | 0.002773 | Next step | Search | `dom-type` `t489` "Voltbay USB-C hub", submit | 0008 succeeded, results page |
| 4 | 0009 | 0.002659 | Next step | Open the Voltbay listing | `dom-click` `t648`, add | 0010 new tab `item/1005008123450`. **Arrives with `t941 clickable "Space Grey" marked`**, `t951 "4-in-1" marked`, `t958 "China" marked`, quantity `="1"`, `t1009 "Add to cart" covered-by t1034` |
| 5 | 0011 | 0.002634 | Next step | "dismiss the cookie layer, then select Space Grey, 7-in-1 and Spain" | `dom-click` `t1042` ("Accept all") | 0012 succeeded; changed: the two consent lines gone. **`t941 … marked` still shown** |
| 6 | 0013 | 0.002596 | Next step; page shows `t941 "Space Grey" marked`; system prompt: "An option already marked … is chosen: leave it, as pressing it again can undo it" | "Selecting the Space Grey, 7-in-1, Spain variants" | `dom-click` `t941`, add, act `a1.colour` | 0014 succeeded; **changed: `t939 "Space Grey" gone`, `t941 "Space Grey" no longer marked`**, "186 pieces available" gone, "12,49 €" gone. F37 named the un-choosing exactly |
| 7 | 0015 | 0.002489 | Next step (0014's change lines in front of it) | "Selecting the 7-in-1 specification and Spain…" | `dom-click` `t952`, add, act `a1.version` | 0016 `t952 "7-in-1" now marked` |
| 8 | 0017 | 0.002435 | Next step | Spain | `dom-click` `t959`, add | 0018 `t959 "Spain" now marked`, "Ships from Spain" |
| 9 | 0019 | 0.002456 | Next step | Collect the coupon | `dom-click` `t935`, add, act `a2` | 0020 `refused_by_page`, `reason: page_busy_try_later` (page `t936 "Network busy, please try again"`) |
| 10 | 0021 | 0.002450 | After the refusal | Retry the coupon | `dom-click` `t935`, add, act `a2` | 0022 changed: `t936` gone, `t1084 "Coupon collected…" appeared`; `t935 "Collected"` |
| 11 | 0023 | 0.002539 | Next step | Quantity 3 | `dom-type` `t965` "3" (page line `t965 field "Quantity"`) | 0024 "the field holds "3""; **the result carries no `control`** (Causes 5) |
| 12 | 0025 | 0.002595 | Next step | Add step 12 as `a1.quantity` | amend_draft `{"step":12,"change":"add","act":"a1.quantity"}` | applied |
| 13 | 0026 | 0.001709 | Next step | "quantity 3, **Space Grey**, 7-in-1 and Spain are already chosen" (false since 0014) | `dom-click` `t1009`, add, act `a1` | 0027 `refused_by_page`, `reason: page_needs_something_first`; page `t968 "Please select a Color."` |
| 14 | 0028 | 0.002601 | After the refusal | "refused because no Color was selected; I re-select Space Grey" | `dom-click` `t941` (no add) | 0029 changed: `t939 "Space Grey" appeared`, `t941 "Space Grey" now marked`, prices, "and 5 more changes". Core then kept this press as draft step 14 without an add (opener rule, Causes 2) |
| 15 | 0030 | 0.002661 | Next step | Add to cart | `dom-click` `t1009`, add, act `a1` | 0031 changed: `t1090 "Added to cart!" appeared` (the same view still shows `t885 "0 Cart"`; the flyout refreshes after) |
| 16 | 0032 | 0.002684 | Next step (20,193 tokens in) | complete: "picks Space Grey 7-in-1 shipped from Spain, collects the store coupon, sets quantity to 3 and adds it to the cart" | complete | Build test 1 (0033-0045), then judges 0046 (no) and 0047 (yes) |
| 17 | 0049 | 0.003169 | `core.resumed` `judged_wrong`, judge verdict `unknown` ("the two checks … disagreed"); page = where test 1 left it: `t885 "3 Cart"`, `t1102 field "Quantity" ="3"`, **`t968 "You have reached the purchase limit for this item."`** | "steps 6-12 were run on stale handles; I re-observe the item page" | `dom-capture_snapshot` | 0050: a page byte-identical to Core's automatic look 0048 |
| 18 | 0051 | 0.002563 | Next step | "verify the cart holds three before finishing" | `browser-navigate` `…/cart` (not added; disposition `taken`) | 0052 `Cart (3)`, line "Space Grey · 7-in-1 · Ships from Spain": exploration's add, not the test's |
| 19 | 0053 | 0.002137 | Next step | "Checking the cart page…" | `dom-capture_snapshot` | 0054: byte-identical to 0052's page |
| 20 | 0055 | 0.002217 | Next step | complete: "The cart already holds 3 …" | complete, Flow steps 1-12 unchanged | Build test 2 (0056-0068, person check at 0059), judge 0069 (yes) |
| 21 | 0070 | 0.000340 | Instructed consequences (empty `tools`, empty `evidence`) | `create_new` "put three … in my cart"; `modify_existing` "Collect that store's coupon…" | — | `consequenceCrossCheck` `undeclared`: 65 actions, all declared nothing |

- Repeats, and what the loop believed was progress:
  - Space Grey was pressed twice (0013 off, 0028 on); the second press was a repair of the first, and both stayed in
    the Flow (s8, s13).
  - The coupon was pressed twice (0019 busy, 0021 collected): a correct retry.
  - Round 1 (0049-0055) believed checking the cart was progress. It re-looked at a page Core had just shown (0050 =
    0048) and re-looked at a page its navigation had just returned (0054 = 0052), then completed with the Flow
    unchanged. $0.010086 and the repeat of test 2 + judge 0069 bought nothing (Causes 6, 11).
- Rejections and refusals received, and whether each said enough to route around:
  - 0004 `target_covered`: yes, it named the layer and its closers; the model closed it, but never made the
    consent press again as told.
  - 0020 `refused_by_page` / `page_busy_try_later`: enough (the model retried); the notice's words are not quoted in
    the result, only on the page.
  - 0027 `refused_by_page` / `page_needs_something_first`: enough; the model found `t968 "Please select a Color."` on the
    page and fixed the colour. The previous run's cause 3 (refusal read as success) is **fixed** here.
  - No refusal at all for the two results that mattered in the tests (Stage 4).
- Where the context was evicted or truncated, if anywhere: none (`truncated: false` everywhere, `truncationCount` 0).
  Requests grew from 57,372 chars (0003) to 91,490 (0032); round 1 restarted at 71,187. One truncation of a different
  kind: 0029's change list ends "and 5 more changes".

## Stage 3 — the proposed Flow

- Node list as authored (`flow-lane.json` `authoredNodes`, selectors from build test 2 `call.json` 0057-0068, which match
  playback `call.json` 0073-0085 node for node):

  | Node | Definition | Parameters |
  | --- | --- | --- |
  | s1 | `web.output.browser-navigate` | url `http://127.0.0.1:51423/scenarios/crossborder-marketplace/` (withheld in the snapshot), newTab false |
  | s2 | `web.output.dom-click` (optional) | div "×", `body > div:nth-of-type(4) > div > div:nth-of-type(1)` |
  | s3 | `builtin.control.merge` | mergeMode first: joins s2's success and skip |
  | s4 | `web.output.dom-type` | input "Autumn Mega Sale: up to 70% off" `#fbofx0n4`, text "Voltbay USB-C hub", submit true |
  | s5 | `web.output.dom-click` | a (listing title), `main > div > section > div:nth-of-type(2) > div:nth-of-type(4) > div > a` |
  | s6 | `web.output.dom-click` (optional) | div "Accept all", `body > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(3)` |
  | s7 | `builtin.control.merge` | joins s6's success and skip |
  | s8 | `web.output.dom-click` | div accessibleName "Space Grey", `main > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1)` |
  | s9 | `web.output.dom-click` | div "7-in-1", `… > div:nth-of-type(4) > div:nth-of-type(2) > div:nth-of-type(2)` |
  | s10 | `web.output.dom-click` | div "Spain", `#fbqexb15 > div:nth-of-type(2) > div:nth-of-type(2)` |
  | s11 | `web.output.dom-click` | div "Get coupons" in shadow host `fb-store-coupon`, `div:nth-of-type(1) > div:nth-of-type(2)` |
  | s12 | `web.output.dom-type` | **input with no name**, `… > div:nth-of-type(6) > div:nth-of-type(2) > input`, text "3", submit false |
  | s13 | `web.output.dom-click` | div accessibleName "Space Grey", the same selector as s8 |
  | s14 | `web.output.dom-click` | div "Add to cart", `[data-testid="add-to-cart"]` |

  14 nodes, 12 actions (1 navigate, 9 clicks, 2 types), 2 merges, no extraction. Routing: one subflow, no rules
  (`route.fallbackUsed: true`, `stateObserved: false`, `statePaths: []`).
- Divergences from the stage 1 chain, one line each, naming the node:
  - **s8 and s13: Space Grey pressed twice.** The colour arrives chosen (0010, 0012), so s8 un-chooses it and s13
    chooses it again. Stage 1 step 6 wants no press at all here. The pair works only because the two presses cancel; a
    page that arrives without the colour chosen (another seed, a remembered choice) would end un-chosen and the add
    refused.
  - s12 is a nameless input: the Flow cannot say it is the quantity field, and two judges held that against it
    (0046, 0071).
  - s14 has nothing after it that reads the page's answer; the build tests never read it either (Stage 4).
  - s2 and s6 are optional (merges s3, s7): correct, though the draft the model saw never marked them (Core did).
- For each divergence:
  - s8/s13: **misread the page** at 0013 (pressed an option shown `marked`, against the system prompt's "Choices" line)
    and **ignored the change lines** at 0015 and 0026, recovering only after the page refused at 0027. Core then could
    not express "drop both halves of a cancelling pair": the opener rule kept the second press and nothing removed the
    first (Causes 1, 2).
  - s12: **could not express it**: the result never carried the field's name, so neither the draft nor the node had
    one (Causes 5).
  - s14: not a model divergence; the test's replay does not read page answers (Causes 4).

## Stage 4 — replay

Two kinds of replay ran: two build tests during the build (Core's dry run, no fixture reset), and the playback the
Lab judges (after `resetScenarioLab`, `packages/test-runner/src/flow-lane/creation/lane.ts:346`).

**Build tests.** Test 1 (0033-0045) and test 2 (0056-0068) ran the same 12 steps: `replayed` for 1, 4, 5, 7(s8), 8,
9, 12, 14(s13), 15(s14); `remembered` for the × (0035, 0058), Accept all (0038, 0061) and **Get coupons (0042,
0065)**: the coupon was still collected from exploration, so the tests never pressed it. Both tests pressed Add to
cart (0045, 0068) on a cart exploration had already filled; the page refused both with `t968 "You have reached the
purchase limit for this item."` (the page test 1 left: steps 0048/0049; the page test 2 left: screenshot `00014-…`,
beside the panel card "Test run · Add to cart · Done"). Both results read `core.replay.replayed`, "the step ran again".
Test 2's search step (0059) met the traffic screen; the Lab cleared it as the person (`personCompletedCheck: true`).

**Playback** (`steps/0073-0085`, `flow-lane.json` `actions`, runtime run `68fb3a07-6c3b-462f-bbeb-b497538567a6`):

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| s1 | navigate (0073) | "Navigation completed", tab moved from the item page | 2,358 ms | 0 | — |
| s2 | click "×" (0074) | landed 828,243 on the target (popup present after the reset) | 712 ms | 0 | — |
| s3 | merge | — | 0 ms | 0 | — |
| s4 | type "Voltbay USB-C hub" + Enter (0075) | form submitted | 676 ms | 0 | — |
| s5 | click listing (0076) | new tab `item/1005008123450` | 1,757 ms | 0 | — |
| s6 | click "Accept all" (0077) | landed 1189,645 | 667 ms | 0 | — |
| s7 | merge | — | 1 ms | 0 | — |
| s8 | click "Space Grey" (0078) | "landed on img, inside the target"; by inference **un-chose** the colour (see s13) | 970 ms | 0 | — |
| s9 | click "7-in-1" (0079) | landed 548,361 | 949 ms | 0 | — |
| s10 | click "Spain" (0080) | landed 544,360 | 984 ms | 0 | — |
| s11 | click "Get coupons" (0081) | `web.action.rate_limited`, "it said it was busy; it named no wait", effect `unacted` | 1,099 ms | 1 | Core `retry_node` (attempt 2 of 3, backoff 250 ms) |
| s11 | click "Get coupons" (0082) | landed 849,361; coupon collected (final fact) | 1,351 ms | — | — |
| s12 | type "3" (0083) | "the field holds "3"" | 139 ms | 0 | — |
| s13 | click "Space Grey" (0084) | "landed on img, inside the target"; re-chose the colour | 971 ms | 0 | — |
| s14 | click "Add to cart" (0085) | "landed on the target; the execution recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog …, waiting 150 ms" | 1,456 ms | 1 (inside the command) | extension click rung (dialog closed, which one is not named) |

- Any node that reported success while doing nothing: in playback, none by outcome: all four facts held, so the
  add worked. s8 reported success while undoing a choice, rescued by s13 (inferred: the cart line reads Space Grey and
  the add was not refused, which is only consistent with s8 off, s13 on). In the build tests: **s14 (0045, 0068)
  reported `replayed` while the page refused it**, and Get coupons was never exercised (so its busy-and-retry path ran
  for the first time in playback).
- Provider calls during replay (expected: zero): **zero** (`live-llm.json` `runtime.calls: 0`). The two calls after
  playback (0071, 0072) are the result verification.

## Stage 5 — the answer

- Records expected vs returned: none declared (`oracles.records: not_declared`); this task is judged on page facts.
- Fields compared, matched, mismatched: four facts, all held (`oracles.finalState: held`): `cart-count`,
  `orders-shipped` (`NOTHING_BOUGHT`) and `cart-line`, `store-coupons` (`HUB_IN_CART`), via
  `finalStateFacts` (`packages/test-runner/src/lane-rules/final-state-facts.ts:15`) and `findScenarioPageWithExpectedState`
  (`run-scenario.ts:748`).
- Every fact, observed value beside expected (question 1):

  | Fact (subject) | Expected | Observed |
  | --- | --- | --- |
  | `cart-count` (`mini-cart-count`) | `Cart (3)` | **`NO EVIDENCE:` of the text.** Held by the oracle's equality test, so equal to the expected by definition; not recorded |
  | `cart-line` (`mini-cart-line`) | `Voltbay Official Store · Voltbay USB C Hub Multiport Adapter Type C to HDMI 4K 60Hz USB 3.0 PD 100W SD TF Card Reader Docking Station for Laptop Tablet · Space Grey · 7-in-1 · Ships from Spain · × 3` (`cartLineText()`) | `NO EVIDENCE:` held, not recorded |
  | `store-coupons` (`store-coupons`) | `Store coupons: Voltbay Official Store 2,00 € off orders over 25,00 €` (`officialCouponText()`) | `NO EVIDENCE:` held, not recorded. Screenshot `00021-…` shows the widget reading "Collected" |
  | `orders-shipped` (`orders-summary`) | `Orders to be shipped (0)` | `NO EVIDENCE:` held, not recorded |

  **Where the Lab records per-fact values: nowhere on a pass.** `judgeFinalState` returns `{ held: true, unheldFacts:
  [] }` the moment the page matches (`packages/test-runner/src/run-scenario.ts:338`), and only a failed final state
  carries `unheldFacts` with observed values (`flow-lane/creation/oracles.ts:42`). `evaluation.json`, `flow-lane.json`
  and `events.ndjson` hold no fact value. That is an instrumentation gap: a pass cannot be checked against its values,
  only trusted.
- If the comparison was count-only, say so: it was not; each fact is compared on its full text. The gap is that the
  observed text is thrown away on success.

## Stage 6 — judgement and repair

- Did the system judge its own result, and what did it conclude: yes, five judge calls.
  - Build test 1: **0046** (`answersRequest: no`, confidence 0.6): "the quantity step types 3 into a bare input with no
    evidence it is the quantity field … The store identity … is never verified"; **0047** (`yes`, 0.6, same evidence):
    "No change needed". Core's agreement rule (`result-verification/agreement.ts`) records `no` then `yes` as
    `model_disagreed`; the build reads any non-`yes` as a round judged wrong
    (`flow-bootstrap/unfinished-build/phases.ts:323-328`), so round 1 started (`core.resumed`, `stopped:
    judged_wrong`, `judge.verdict: unknown`).
  - Build test 2: **0069** (`yes`, 0.7, `patchNeeded: true`): the Flow covers every clause; "Step 11 re-clicks Space
    Grey after the quantity was set, which could deselect the variant … Remove or reorder step 11". The premise
    ("the variant was already selected at step 6") is false: step 6 un-chose it, and removing step 11 would break the
    Flow. A first `yes` stands without a second call, and `phases.ts:323` finishes the build on `yes` with
    `flowSignature === standing`; `patchNeeded` is not consulted. The advice was ignored, which here was luck.
  - Post-run: **0071** (`no`, 0.6): "the quantity typed as 3 is not shown to have been committed before Add to cart …
    the cart may hold one unit rather than three", advice: add an Enter/blur and a check between s12 and s14;
    **0072** (`unknown`, 0.6): "no step confirms cart contents or coupon collection; no record set stored". Recorded as
    `model_unconfirmed` / `core.result.refutation_unconfirmed` ("not proof the run failed, so the result is unverified
    and the run keeps the status its steps earned", `agreement.ts`). Both called the playback "a build test".
- Question 3, why "unverified" although Core said succeeded: the playback succeeded and the result check never
  confirmed it. Only an explicit `yes` verifies (`result-verification/verdict.ts`); two answers that never said `yes` and
  never agreed on `no` leave a run unverified without failing it. Neither check could have confirmed it: their context
  (0071 request) was `recentActions` (15 status rows), `resultSummary` with zero record sets and a `flowShape` **in
  lexical node order** (`s1, s10, s11, s12, s13, s14, s2, … s9`), and no page: not `Cart (3)`, not "Collected", not the
  quantity field's name. 0071 and 0072 are the two result-check calls, logged in steps/ as `0071-judge` and
  `0072-judge` (`taskKind: loop_verification`, `part: null`, `metadata.source: verifyAutomationStudioRunResult`). They
  are the same two calls the Lab reports as `harnessRecovery.interventions` (2 × `diagnosis`) and as a "repair
  attempt": Core records each verification call as a run intervention (`result-verification/verify.ts:141-151`), and the
  Lab's reader keeps only `kind` (`packages/test-runner/src/flow-lane/harness-recovery.ts`, `readHarnessRecovery`). **No
  diagnosis or recovery ran on this run**; nothing is missing from steps/, but three Lab ledgers name it wrongly
  (Causes 12).
- If the answer was wrong, did a repair trigger automatically: the answer was right; no repair was due and none ran
  (`runtimePatchAttempts: []`, `adaptationIds: []`, `refusalCode: null`). 0071's `patchNeeded: true` did not trigger
  one because an unconfirmed result is not a refutation.
- What context did the repair receive: no repair ran. For the build's round 1, the context (0049 request) was: the
  instruction, the draft with its acts checklist, the decision history, `core.resumed` (judge verdict `unknown`, the
  disagreement sentence), the route-state rows, and the page as test 1 left it, which held the answer the test's
  Add to cart got (`t968 "You have reached the purchase limit for this item."`). Absent: any per-step page change from
  the tests, and anything saying the test's add was refused.
- Was the repair persisted, and did the re-run use it: not applicable.

### Questions 2 and 4, answered

- **t244, part runs.** `core.run_flow` was offered in every decision's tool list (0003, 0032, 0049, 0055) and never
  called: the decision history rows, the step folders and `core.log` hold only `core.run_node`, `amend_draft` and
  `complete`. No `tool-core.run_flow` folder exists because no call was made.
- **t244, the round 0048-0055 changed nothing in the Flow.** The draft's steps 1-12 are identical before (0049) and after
  (0055); round 1 added three looks and a `taken` cart navigation (draft steps 13-16, `inResult: false`). Test 2 ran
  the same 12 steps as test 1.
- **t244, finished on a judged yes about the Flow as it stands: yes.** 0069 judged test 2, whose 12 steps match the
  playback's node for node (selectors compared, 0057-0068 against 0073-0085; the coupon's extra row is the retry), and
  `phases.ts:323` requires `verdict === "yes" && verdict.flowSignature === standing`. Nothing changed the Flow after
  0069: 0070 is the instructed-consequence read and no amend followed. Caveat: the yes carried `patchNeeded: true` and a
  wrong premise.
- **t249, runtime patch:** none tried, none gated (`runtimePatchAttempts: []`, `llmGate` refusal codes null). Nothing
  refuted the playback, so the "patch only after a whole judged run" rule was not exercised.
- **t243/t250, state routing:** no rows. No `skipped` or `stateRouting` on any playback action, no `routed`,
  `effect_holds`, `guard_stopped` or `no_match` anywhere in the bundle, `route.stateObserved: false`. No step was
  unavailable (the coupon's busy answer was a refusal handled by `retry_node`), so the runtime never consulted state.
  Not exercised; not a gap.
- **Double acts.**
  - **Add to cart, three presses into the person's cart during the build:** 0031 (added), 0045 (test 1) and 0068 (test 2),
    the last two refused only by the fixture's purchase limit. Each test repeats the act because the step declared
    `consequences: []`, so decision D1's verify-instead-of-run never applied (Causes 3). On a site without a cap the
    cart would hold 9 before playback.
  - **Space Grey, toggled twice in every run of the Flow:** exploration 0014/0029, test 1 0039/0044, test 2 0062/0067,
    playback 0078/0084.
  - **Coupon:** pressed twice in exploration (0020 busy, 0022) and in playback (0081 busy, 0082): correct retries after a
    refusal; never pressed in the tests (`remembered`).
  - **Add to cart in playback:** one node, two presses inside the command ("recovered on attempt 2 after absorbing
    blocking_dialog"); the cart shows 3, so one add took.
  - Quantity typed once per run.

### Question 5, prior lane A causes rechecked

- **Space Grey pressed while already marked: yes**, at 0013, with `t941 clickable "Space Grey" marked` on the page
  (0012) and the system prompt's "Choices" line in that very request (`0013-decide/request.txt`, "Choices. An option already
  marked … leave it"). Repeated by s8 in both tests and playback.
- **Did each press result name the page changes (F37): yes for every exploration press that stayed on its page**: 0006
  (6 lines), 0012 (2), 0014 (4, including `no longer marked`), 0016 (3), 0018 (4), 0022 (2), 0024 (1), 0029 (8 + "and 5
  more"), 0031 (1). Navigations (0008, 0010) carry none, correctly. Refusals (0004, 0020, 0027) carry none and no notice
  words. **Build-test and playback results carry no change lines at all.** The model ignored 0014's lines until a refusal
  forced it.
- **Was the Add to cart answer read:** in exploration, yes both times (0027 refusal read at 0028; 0031 "Added to cart!").
  In the tests, **no**: 0045 and 0068 read `replayed` while the page said "You have reached the purchase limit for this
  item." In playback, not read by anything but the final oracle.
- **Were popups optional: yes.** s2 (×) and s6 (Accept all) are followed by merges s3 and s7; both ran in playback
  because the reset brought both layers back. The draft shown to the model (0032, 0055) never showed them as optional.

### Is it a pass? The supervisor's three checks (lead, verified on the evidence)

1. **Started by typing into the real extension chat: yes.** `flow-lane.json` `buildEntry: "chat"`, `build.chat`
   `panelInput: "view-dom"`, person turn 1, answer turn 2, `became: "build"`, `ending: "created"`. `events.ndjson`
   seq 2-3 "The extension's chat: instruction sent / answered". `run.json` `invocation` has no `--direct-api-build`
   (which would have failed the run `fixture.invalid`). `--llm-profile lab-create-flow` is the live campaign's default
   label (`scripts/lab/live-campaign/lab-run/profiles.mjs`). On the `lab run` path the profile id is only recorded in
   the plan and the evaluation (`test-runner/src/commands.ts` `llmOptions` → `live-llm-plan.ts:134`). Nothing branches
   on its value; only the `demo:llm:*` commands read the names `production`/`conservative` (`demo-llm-profile.ts`). So
   `lab-create-flow` and `production` launch identically from the chat.
2. **The judge answered yes about the Flow as it finally stands: yes.** 0069 `answersRequest: yes`. Core finishes a
   build only on `verdict === "yes" && verdict.flowSignature === standing` (`unfinished-build/phases.ts:321-324`).
   Otherwise it returns `judged_wrong` and opens another round with a `core.resumed` decision; none follows 0069 (next:
   0070, the instructed read, then playback). Test 2's steps (0057-0068), which 0069 judged, match the playback's
   node for node (selectors compared), and no amendment came after 0069. **Gap:** the bundle does not record the
   judged signature or the finishing verdict itself (`build.outcome: "proposed"` only), so this is proved from the
   code path and the step sequence, not from a record (Instrumentation gaps).
3. **The playback produced the expected result: yes.** `oracles.finalState: held`: `judgeFinalState` returns held
   only when `findScenarioPageWithExpectedState` finds a page where every fact (`cart-count`, `orders-shipped`,
   `cart-line`, `store-coupons`) equals its full expected text. Screenshot `00021-…` independently shows Space Grey,
   7-in-1, Ships From Spain, quantity 3, total 68,97 € (3 × 22,99 €) and the coupon "Collected"; the cart badge is
   behind the panel. The observed fact texts were not recorded on a pass (Cause 13, fixed by t174-w84).

The one ask (`traffic-screen`, during build test 2) was a robot check that the Lab's person cleared from the chat. It was not a
permission stop. **Verdict: a pass on the product's result,** behind the UI defects below and with the product's own
post-run check reporting "unverified" (Causes 5, 7).

## UI review

From t174-w81 (`reports/t174-w81-ui-murwd8le.md`, every screenshot opened). Screenshots are under the Lab bundle's
`screenshots/`, and the overlay pictures under `t174-slot-1/run-murwd8le-79e735a8.ui-review.local/`.

- **D1 (worst). The verdict contradicts the page.** `00019-…`, `00021-…`, `12-end-panel.png`: an orphan grey "Check
  result" card, then red "Check result · Didn't pass", while the overlay shows a green "Run finished". The page shows
  Space Grey / 7-in-1 / Spain / qty 3. The run was really "unverified" and met the task. Owners: EXT
  `panel/chat/stream/step/card-words.ts`, Core `result-verification/check-activity.ts`.
- **D2. The playback step counter advances on a retry (recurring).** Overlay moment 11 and `00018-…`: "Step 11 of 14
  … Get coupons" → retry → "Step 12 of 14 … Get coupons"; quantity (node 12) then reads "Step 13 of 14". Core
  `executor/graph-run.ts`.
- **D3. Internal wording is shown to the person.** `00010-…`, `07-mid-build-panel.png`: "the model judged that it does
  not answer … keeps the status its steps earned"; "Repairing the Flow — The Flow was not judged to do what you asked:
  The two checks of this result disagreed…"; "steps 6…12 were run on stale handles; I re-observe" (the raw model
  reason as the status and overlay text).
- **D4. Test cards.** Both tests open with "Test run · Passed" before any step (recurring), and step cards read "Test run ·
  /scenarios/crossborder-mark…", "Test run · Autumn Mega Sale: up to 70…" (the placeholder, not the typed text) and
  "Test run · Done" (`00008`, `00011`, `00014`, step 0045/0068 pictures).
- **D5. Generic cards.** "Type · Done" / "Typing into the page" (the quantity field had no name, Cause 5), "Look · Done",
  "Join paths · Done", and a bare "Recovery started" line (`00010`, `00011`, `00017`, `00018`, `00019`).
- **D6. The consequence cross-check.** `00015`: a prose warning ("…but nothing FluxIQ did while building this Flow said it
  would") right after "Passed", with nothing to act on. No codes and no "Apply it as it stands?" question this time.
- **D7. The person check.** `00012`: "complete the check on this page" never says it is a robot check. After Continue,
  the press is echoed three times, and the overlay keeps "Waiting for you: answer in the FluxIQ panel".
- **D8. A busy refusal reads "the page turned it down"** (`00006`); in playback "Click · Get coupons — Didn't work"
  shows no reason at all (`00018`).
- **D9.** The first reply is `Doing "Create an automation here".`. The build summary shows the full loopback URL and says
  "Say "run it"" while the Flow is already running (`00003`, `00017`).
- **D10.** The status row and overlay are stale: "…clicking "Add to cart" — done" while the chat says "Judging the Flow…" (step
  0068). The overlay says "Fixing your Flow / The result answers the request" during the cross-check (`00015`).
- **Overlay.** Present and polished through most moments. Moment 7: the overlay unmounted for about 200 ms (on the
  same-tab navigation to `/cart`). Moment 8: absent from the sampled tab after the person check (a new item tab was
  driven; the Lab also sampled a background tab with the same URL). `00004`: clipped at the right edge behind the
  panel. Moment 3 is a wait-text revisit, which is expected.
- **What looks right.** Build cards name the target with the model's reason as heading ("Clicking "Spain" —
  Selecting Spain…" → "Click · Spain · Done"). The "Deciding the next step" wait, the ChatGPT-like layout with the
  composer pinned, and "Check result · Passed: the result was judged to answer the request" (`00015`) all read well.
  The playback retry heading reads "Trying the step again" with a plain reason.

## Causes

"Located" means the file and function were read in this debug; "inferred" means the location follows from the evidence
but the code path was not read.

| # | Cause, precisely | Repo and file | Fix | Located / inferred |
| --- | --- | --- | --- | --- |
| 1 | **The model pressed Space Grey while it was shown `marked` (0013)** although the system prompt says to leave a marked option, then ignored 0014's `t941 "Space Grey" no longer marked` at 0015 and claimed "Space Grey … already chosen" at 0026. Only the 0027 refusal brought it back. Nothing below the prompt stops a press on a marked option. | downstream `domain/src/runtime/llm-evidence/node-run/run.ts` (before-action checks, beside `covered-target.ts`) | Refuse a press on an option the view shows `marked`/`selected`/`checked` before acting, as `target_covered` does: `already_chosen`, "nothing was done; this option is already chosen" | inferred (the prompt line is in the 0013 request; the guard's home is inferred) |
| 2 | **Core kept the second Space Grey press (draft step 14) without an add, and nothing dropped the cancelling pair.** The opener walk stops at the nearest kept step, so the detour test (`withoutDetours`) never compares step 14's change (`now marked`) with kept step 7's (`no longer marked`). The Flow ships s8 + s13, which cancel. | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/path-to-step.ts` (`automationStudioFlowDraftPathToStep`), `flow-draft/opener.ts` | When a step's change lines reverse a kept step's on the same control, tell the model (or drop both) instead of keeping the reverse as an opener | located |
| 3 | **Each build test re-pressed Add to cart on the person's cart** (0045, 0068): the step declared `consequences: []`, so D1's verify-instead-of-run did not apply; the fixture's purchase limit refused both. The instructed consequences (`create_new` for the cart act, `modify_existing` for the coupon) are read only after the build ends (0070), lazily from the cross-check, so they could not mark the act's step as lasting; the cross-check's `undeclared` verdict (65 of 65 actions declared nothing) was neither asked of the person (`asks.other: 0`) nor acted on. | Core `runtime/flow-draft/verify-only.ts` (declaration-driven rule), `runtime/service/flow-bootstrap-commands/permission-outcome.ts` (`instructed()` after `crossCheck()`) | Read instructed consequences before exploration, and treat a step that claims an act whose instructed consequence lasts as verify-only in the dry run, whatever it declared | located |
| 4 | **The build test reports `replayed` for a press the page refused.** 0045/0068: "the step ran again" while the page answered "You have reached the purchase limit for this item."; test results carry no change lines and no refusal reading, which exploration has (0027 `refused_by_page`). | Core `runtime/flow-draft/dry-run.ts`; downstream `domain/src/runtime/llm-evidence/node-run/replay.ts`, `replay-answer.ts` | Give a replayed press the same reading as an exploration press: F37 change lines and the refusal check, so a refused add reads `refused`, not `replayed` | inferred |
| 5 | **The quantity step lost its name.** The page line was `t965 field "Quantity"`, but 0024's result has no `control`, the draft's `does` is `{}`, and node s12 is `{tagName: "input"}`. Judges 0046 and 0071 both refuted on that ("bare input … not identified as the quantity field"; "not shown to have been committed"), which caused the round-1 repair and the unverified result. | downstream `domain/src/runtime/llm-evidence/node-run/observed-control.ts` (`webObservedControl`: `element.name ?? element.text`) | Name the control with the words the view line printed (the field's label), and carry that name into the node's element identity | located the function; inferred that the view's label is not in `element.name` |
| 6 | **A judge flip bought a repair round that changed nothing.** 0046 `no` / 0047 `yes` → `model_disagreed` → `judged_wrong` → round 1 (4 decisions $0.010086), test 2 (39 s, incl. a person check) and judge 0069 ($0.001030): $0.011630 with 0047, 20% of the run, for an identical Flow. Finishing then depended on a third call landing on `yes`. | Core `runtime/flow-bootstrap/unfinished-build/phases.ts:308-328`, `runtime/result-verification/agreement.ts` | A round that completes with the same `flowSignature` it was sent back with should not be re-tested and re-judged as if it were new; fix the judges' context (7) so the flip has less to flip on | located |
| 7 | **Every judge judged without the page.** Build-test judges (0046, 0047, 0069): `flowShape` + `buildTest.steps` outcome words, nothing about the page after the test (which showed the purchase-limit refusal). Post-run checks (0071, 0072): 15 status rows + `flowShape`. None saw `Cart (3)`, "Collected" or the field's label; 0071 invented an uncommitted quantity, 0069 a pre-selected colour. | Core `runtime/result-verification/build-test/summary.ts`, `build-test/observation.ts`, `result-summary.ts` (`summarizeAutomationStudioRunResult`), `run-outcome.ts` | Give each judge the compact view of the page the run ended on and each step's change lines | located (context read from the requests; summary builders read) |
| 8 | **The post-run check's `flowShape` is in lexical node order** (`s1, s10, s11, s12, s13, s14, s2, s3, … s9`), so the judge reads Add to cart before the search. The build-test judge's is in order. | Core `runtime/result-verification/run-outcome.ts:489` (`flowNodes: input.flow.nodes` as stored) | Order the nodes by the graph's execution order before summarising | located (call site); the store's ordering is inferred |
| 9 | **The post-run check called the playback "a build test"** (0071, 0072 summaries). Its system prompt carries the "When resultSummary.buildTest is present …" paragraph although `buildTest` is absent. | Core loop-verification prompt (`automation-studio.loop-verification.v1`) | Send the build-test paragraph only with a `buildTest` | inferred (prompt text read in the 0071 request; its file was not located) |
| 10 | **A `yes` with `patchNeeded: true` and wrong advice finished the build** (0069: "Remove or reorder step 11"; removing it would leave the colour un-chosen). `phases.ts:323` reads only `verdict` and `flowSignature`. Harmless here; a later re-author that trusted the advice would break the Flow. | Core `runtime/flow-bootstrap/unfinished-build/phases.ts:323` | Record a yes's advice as unconfirmed, never as a repair directive; fix 7 so the premise is checkable | located |
| 11 | **Round 1's model took exploration's cart as proof of the Flow** (0051-0055: "The cart already holds 3"), while the page the test left said the test's add was refused. It also re-looked twice at pages it already had (0050 = 0048 byte for byte; 0054 = 0052): $0.005306. | model; Core resume instruction (`llm/evidence-loop/resume.ts`), evidence loop look handling | Say in `core.resumed` which test steps the page refused; answer a look at an unchanged page from memory, as `core.recall_result` does | inferred |
| 12 | **The Lab calls the post-run result checks a "repair".** `events.ndjson` seq 19 "The created Flow's repair attempt finished"; `live-llm.json` `repair` (`purpose: explore_and_adapt`); `harnessRecovery.interventions` 2 × `diagnosis` and `harnessActivations: 2`. Core marks them `metadata.source: verifyAutomationStudioRunResult`; the reader drops it. This is why the brief saw "diagnosis on a run that succeeded". | downstream `packages/test-runner/src/run-scenario.ts:408` (`settleRun` label), `packages/test-runner/src/flow-lane/harness-recovery.ts` (`readHarnessRecovery`), `packages/test-runner/src/live-llm/live-llm-run.ts` (`settleRepair`) | Split verification interventions from recovery ones by `metadata.source`; label the event "The created Flow's result was checked" | located |
| 13 | **Per-fact values are discarded on a pass.** | downstream `packages/test-runner/src/run-scenario.ts:338` (`judgeFinalState`) | Return every fact's observed text, held or not, into `flow-lane.json` `oracles` | located |
| 14 | **Refusals do not quote the notice.** 0020 `{reason: page_busy_try_later}`, 0027 `{reason: page_needs_something_first}`; "Network busy…" and "Please select a Color." are only on the page. Playback's 0081 does say "busy". | downstream `domain/src/runtime/llm-evidence/node-run/run.ts` (the `web-llm-tool-result.v1` refusal) | Carry the notice line (`t968 "Please select a Color."`) in `detail` | inferred |
| 15 | **Each test opens another item tab and nothing closes them**: four Voltbay item tabs by test 2 (`00014-…`), five scenario tabs at the end (`00021-…`). | Core `runtime/flow-draft/dry-run.ts` reset (navigation only) and the new-tab listing step | Close tabs the previous replay opened when resetting | inferred |
| 16 | **Wording.** The panel shows "Check result · Didn't pass" for an unverified result whose run succeeded (`00021-…`); test 2 runs under "Fixing your Flow" though round 1 fixed nothing (`00014-…`); 0005's summary calls the welcome popup "the cookie banner"; the 0070 read says "before any page evidence exists" after 68 steps, and its step folder is named `decide`; the playback Add to cart says "closing 1 dialog" without naming it. Screenshots are t174-w81's to review. | Core UI activity cards; Core instructed-read task (posed as an `evidence_tool_decision` with empty tools) | Card: "Not confirmed" for `unsure`; heading: "Testing the Flow again"; name the dialog closed | inferred |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 5 | The observed text of each goal fact on a pass | `packages/test-runner/src/run-scenario.ts:338` returns `{ held: true, unheldFacts: [] }` |
| 4 | What each build-test step left on the page (change lines, the page's answer); only `remembered` steps carry a page | Core `runtime/flow-draft/dry-run.ts` / downstream `node-run/replay.ts` |
| 4 | Playback's page after each node (byte counts only, `evidencePackets`) and which dialog the Add to cart closed | test-runner flow-lane `actions[].evidencePackets`; extension click result text |
| 6 | Which interventions were recovery and which were result checks | `packages/test-runner/src/flow-lane/harness-recovery.ts` keeps `kind` only, drops `metadata.source` |
| Header | Per-call request ids and task kinds in `live-llm.json` `observed.observedCalls` (20 rows, all `null`; `unrecordedCalls: 4`; `perCallRecords: "not recorded"`) although steps/ holds all 27 | `packages/test-runner/src/live-llm/live-llm-run.ts` |
| Header | Chronological step order: playback 0073-0085 (04:39:53-04:40:19) is numbered after the result checks 0071-0072 (04:40:22-28) | `packages/test-runner/src/lab-runs/write-playback-steps.ts` (playback written after the run; inferred) |
| 2 | Whether a step is optional, in the draft the model reads (s2/s6 became optional without the draft ever showing it) | Core draft serialization (`runtime/flow-draft/step.ts`), inferred |
| 4 | Core command attempts for this run (no `.work/run-murwd8le-79e735a8` under `t174-slot-1`) | instance work-dir retention, inferred |
| 6 | The build's finishing verdict and whether its `flowSignature` matched the standing Flow (proved here from the code path only) | Core `unfinished-build/phases.ts` returns `judged` on the finished result, but the proposal does not persist it; `flow-lane.json` `build` has `outcome` only |

## Fixes landed on the lane tree (lead t174-lead-1002M; no rerun, round held)

Each fix has a failing-first test and narrow checks; details in `reports/t174-lead-1002M.md` and the worker reports.

| Cause | Fix | Where |
| --- | --- | --- |
| 1 | A press that un-chooses (or chooses) its own control says so in one sentence, ahead of the change list (information, never a refusal) | domain `node-run/press-effect/choice.ts` (w82) |
| 3 | The dry run verifies, never re-runs, a changing step that claims an act whose instructed consequence lasts, whatever it declared. The one instructed read happens at the first test and is shared with the cross-check | Core `flow-draft/verify-only.ts`, `flow-bootstrap/action-permissions.ts`, wired through `llm/node-tools/*`, `evidence-loop.ts`, `service.ts` (w83, w89) |
| 4 | A test replay of an in-place step is read before and after: it carries change lines, and a page refusal quotes the notice | domain `node-run/replay.ts`, `replay-answer.ts` (w82); capture pins 2/2 (w91) |
| 5 | A control is named by its view-line words (the field's label); the node's identity keeps it as `label` | domain `node-run/observed-control.ts` (w82) |
| 7 | Judges get the page the run or test ended on (`endView`) | Core `result-verification/*`, `service/end-view/*`, `build-judge.ts` (w87, w89) |
| 8, 9 | Post-run `flowShape` in run order; the build-test paragraph only with a `buildTest` | Core `run-outcome.ts`, `diagnosis-instructions.ts`, `deepseek/system-prompt.ts` (w87) |
| 12, 13 | Result checks are filed apart from recovery; every fact's value is recorded on a pass | test-runner, test-contracts (w84, w91, lead) |
| 14 | Refusals quote the page's notice | domain `node-run/press-effect/notice.ts` (w82) |
| UI D1, D4, D5, D8 | "Not confirmed" for an unverified check, one settling check card, test cards name the action, Look names its target, no Join paths card, busy wording, playback failure reason | Core `ui/activity-action/*`, `check-activity.ts`, `executor/graph-run.ts`; EXT `panel/chat/stream/step/*` (w85, w90) |
| UI D2, D4, D5 | Step number is the node's place and a retry keeps it; no "Test run · Passed" before a test; no bare "Recovery started" | Core `runtime/activity/step/*`, `observer.ts`, `graph-run.ts` (w88, w90) |
| UI D3 | Plain wording for the disagreement and the resume heading | Core `agreement.ts`, `unfinished-build/not-done.ts` (w87) |
| UI D7, D10, overlay | Waiting headline cleared on answer, one echo; headline follows the newest phase; no unmount on same-tab navigation; drawn on the tab in front; not clipped behind the panel | EXT `background/activity/*`, `content/activity-overlay/*`, `ask-copy.ts`, `background/connection.ts` (w86, w91) |

Open: 2 (cancelling pair kept), 6, 10, 11, 15, D6, D9; the judged signature is not persisted (gap above).
