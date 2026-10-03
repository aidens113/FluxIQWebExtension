# Run debug — `run-murzln6g-11debe1d`

t193 lane B, round 1002-M, run 2, slot-2. Task `bigbox-retail-pickup-cart-store-remembered-after-creation`, variant
`store-remembered`, built from the extension chat. Debugged from the bundle
`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-02/run-murzln6g-11debe1d/` (`B/`) and the Lab instance folder
`test-runs/instances/t193-slot-2/run-murzln6g-11debe1d/` (`I/`). Other sources: the UI review
`test-runs/instances/t193-slot-2/run-murzln6g-11debe1d.ui-review.local/` (`UI/`, 18 PNGs, 9 moments) with its `.json`,
the bundle's own checkpoint pictures `B/screenshots/00001`-`00016`, and the decision dump
`test-runs/instances/t193-slot-2/decision-dumps/build-2026-10-03T06-06-29-889Z-13084.jsonl` (`DD`, 200 lines). `S/` =
`B/steps/`. `R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

Source as it stood for the run (`B/run.json` `repositories`): downstream `45965d7d` dirty and Core `424a70b3` dirty. The
dirty lists are fixes A, B, C, D, E, F' and G (Core: `flow-draft/interruption.ts`, `routing.ts`, `verify-only.ts`,
`instructed-acts/choice-order.ts`, `node-tools/dry-run-gate.ts`, `replay-draft.ts`; downstream: `actionability.ts`,
`codes.ts`, `refusal.ts`, `scroll-follower.ts`, `ui-review/count-overlay-changes.ts`). Since the run, other workers
have changed Core `unfinished-build/budget-exhausted.ts`, `not-done.ts`, `create-here.ts` and downstream
`node-run/run.ts` (fixes H and I, in progress). Those four were clean at run time, so this file cites them as
`git show HEAD:…`.

**What decided this run, in one line:** the fixes worked, and the build still ran out of money. The test passed
because fix A excused the failure of step 15. The judge was asked twice and said "no" both times, correctly. A repair
round was then refused: the purse had $0.0111 left, and it holds $0.019 for a decision plus judging, priced at the
reply caps. Real calls of that kind cost about $0.005. Exploration spent $0.0436 of its $0.0863 on 14 wasted
decisions (Stage 2). The draft was wrong in the same two ways as run 1:
- The towel "+" (d16) comes after the towel Add to cart (d12).
- The napkin act a3 was named on a press of the shipping-only "250 Count (3-Pack)" link (d19). No step adds napkins
  and no step chooses 250 Count.

The model was told about the quantity order eight times (F', `afterActSaid` in `S/0041`-`S/0054`) and never acted on
it.

## Header

- Run id: `run-murzln6g-11debe1d`. No runtime run (`flow-lane.json` `runtimeRunId: null`, `stoppedAt: build`,
  `authoredNodes: null`, `actions: []`). The Flow `flow.d174d6c4-d693-448d-a100-571b65e63ead` was created empty,
  with the instruction saved on it (`B/evaluation.json` `flowCreated: false`, i.e. no steps were put into it).
- Scenario / variant / task: `bigbox-retail` / `store-remembered` / `bigbox-retail-pickup-cart-store-remembered-after-creation`.
  Task kind `form`, judgeBy `playback-goal`, seed 239 (`B/run.json`).
- Command: as in `reports/t193-lead-1002M.md` "Command", with `--instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation`.
  `I/snapshots/live-llm.json` `authorized` agrees: maxCalls 64, maxEstimatedCostUsd 0.1, output cap 8000, timeout 25 s.
  Headed Chromium 134.0.6998.35, 1280x720, side panel (`B/run.json` `environment`; `UI/*-panel.png` source "side-panel").
  Ports: scenario 52153, web 52154, gateway 52155 (`I/logs/core.log` l.2, l.7). `processExits` lists `scenario-lab: 1` and
  `fluxiq-web: 1`, which is teardown after the failure.
- Date, provider, model: 2026-10-03 06:04:23–06:08:48Z on the Lab clock (2026-10-02 23:04 local). The build ran
  06:06:29.889 (`core.log` "loop start") to 06:08:44.5 (ending). DeepSeek `deepseek-flash`, priced at $0.006/M cache-hit
  input, $0.30/M miss and $1.20/M output (`R/llm/deepseek/pricing.ts` l.46).
- Provider calls, tokens, cost: **34 calls, $0.088887084** (`live-llm.json` `observed.calls` 34 and `totalEstimatedCostUsd`;
  this equals the sum of `S/*/meta.json` `costUsd`). The total splits as follows:
  - Chat interpreter `S/0001`: 1 call, $0.000316, 1,557 in (896 hit) / 94 out.
  - Exploration: 30 decisions `S/0003`-`S/0054` (iterations 1-30), **$0.086255**. Input 614,279 tokens, of which 344,704
    were cache hits (**56.1 %**); 2,762 out. That is $0.00288 a decision.
  - Instructed-consequences read `S/0015` (phase `read`, iteration 1 of its own loop): 1 call, $0.000380, 2,129 in / 129 out.
    It answered `modify_existing` for the store switch and `create_new` for the adds.
  - Judge `S/0069` and `S/0070` (`taskKind loop_verification`): 2 calls, $0.001936, 9,484 in (6,656 hit) / 873 out.
  - Whole run: 627,449 in, 353,664 hits (56.4 %), 3,858 out.
  - `live-llm.json` books $0.088571 as `phases.build` with `calls: 30`, and `phases.judge: null`. The cost includes the read
    and both judge calls; the count does not. `stepLog.unattributed` is 3 calls at $0 (see gaps).
- Verdict as reported: `failed`, `runtime.behavior`; `productFailure: flow_lane.flow_not_built`, `lab.chat_build_failed`,
  issue code `flow_bootstrap.evidence_budget_exhausted` (`I/events.ndjson` seq 15; `B/summary.json` `firstFailure`). FluxIQ's
  ending, in full from `UI/09-failure-panel.png` and `B/screenshots/00016`, is quoted in the UI review below. The Lab's copies
  cut it at "…was not…".
- **Stage reached: 6.** A draft was authored (stage 3). The build test from the start passed with one excused failure
  (stage 4). The build judge ran twice and said no (stage 6). No repair round ran, so no Flow was proposed, played back
  or answered. The store-remembered playback and t243 routing were **never reached**: no `routed`, `effect_holds`,
  `guard_stopped` or `no_match` rows in `S/`.

## Stage 1 — the instruction and the expected chain

Copied from `reports/t193-lead-1002M.md`, "Stage 1, written before the first run", as in run 1's debug.

- The instruction, verbatim (`S/0001` `decision.json`): "Switch my pickup store to Millbrook Crossing Supercenter, then
  add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the
  ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is already in my cart
  as it is, and do not check out."
- The node chain a correct Flow must have (the build runs on the base site):
  1. Answer the consent banner and the email offer if shown (sometimes present).
  2. Open the store chooser and press Set as my store on Millbrook Crossing Supercenter; the page reloads. This comes
     first: the 12-roll pack cannot be picked up at Carden Falls.
  3. Reach the Select-A-Size Paper Towels product page (search or listing); choose "12 Double Rolls", Pickup, quantity
     2 (+ once); close the support card if open; press Add to cart (the first press after a load only wakes the page).
  4. Reach the Everyday Dinner Napkins page; choose "250 Count", Pickup, quantity 1; Add to cart.
  5. No checkout. Final mini cart: store Millbrook Crossing, the soap kept, 2 x towels 12 Double Rolls pickup,
     1 x napkins 250 Count pickup, "4 items · Subtotal $43.39".

  A build or re-author finishes only on a judged yes about the Flow as it finally stands (t244), after one whole-Flow
  run from its start.

  Store-remembered row: after the build, the site remembers Millbrook, so Millbrook's card in the picker reads "Your
  store" and has no Set as my store button. Playback must reach the store step, find it cannot run, and route by page
  state (t243) past it to the search, with no failure, no repair and no second press of anything. The final cart is the
  same. The Lab's `steps/` rows should show the routing (`routed`, `effect_holds`, `guard_stopped` or `no_match`).
- What a wrong answer that looks right would look like here: towels added before the store switch (delivery); one towel
  pack; Buy now instead of Add to cart; on the store-remembered row, a run that "passes" by repair rather than by routing,
  or a store step that reports success without pressing anything and without a routing record.
  - **This run's draft is the "one towel pack" answer** (+ after Add to cart), plus no napkins at all. The judge caught
    both. The ending still told the person "5 of the 6 things you asked worked" (UI review).

## Stage 2 — exploration

One row per model turn: build `part creation`, round 0, `phase explore` unless noted. Cost is `meta.json` `costUsd`.
"In/hit" is `usage.inputTokens` / `cacheHitInputTokens`. Draft step numbers (dN) are those of the `core.flow_draft` entry in
`S/0054/request.txt`. Core's answers are quoted from the next request (`core.amendment_check.N`, `core.no_progress.N`,
`core.repeat_check.N`, `core.evidence_history`). **W** marks a wasted decision, with why.

| # | What it was asked | What it decided | Action and parameters | Result | In/hit, cost |
| --- | --- | --- | --- | --- | --- |
| 0001 | chat interpreter | `flow.createHere` | instruction as above | build started | 1,557/896, $0.000316 |
| 0002 | — (free opening) | — | navigate `~/` | ok; d1 (kept). Page: consent `t313`/`t314` covering | — |
| 0003 | decide 1 | "dismiss the privacy consent dialog" | click `t319` "Reject all", add | ok; d2 (kept; host `interruption:true`, `DD` l.5) | 12,208/1,152, $0.003428 |
| 0005 | 2 | open store picker | click `t7`, no add | `target_covered` `covered_by_layer` by `t313` (sign-up popup that opened after the consent); d3 `did_not_work` | 13,006/5,248, $0.002456 |
| 0007 | 3 | close sign-up popup | click `t332` "No thanks" | ok; d4 (kept; `interruption:true`, `DD` l.19) | 14,120/3,072, $0.003435 |
| 0009 | 4 | open store picker | click `t7`, add, act a1 | ok; d5 (kept; the a1 naming moved to d7 later) | 14,644/6,528, $0.002592 |
| 0011 | 5 | set Millbrook | click `t354` "Set as my store" with **`consequences` inside `parameters`**, act a1, no add | **`invalid_input` `missing_input_keys`** (`S/0012`: `instead [node, parameters, consequences]`, `undeclaredParameters [consequences]`); d6 `did_not_work`. **W1**: format error | 15,806/7,040, $0.002786 |
| 0013 | 6 | same, corrected | click `t354`, `consequences [modify_existing]`, add, act a1 | ok, page reloaded; d7, **a1 done: 7** (host also marked it `interruption:true`, `DD` l.39) | 16,386/11,136, $0.001769 |
| 0015 | read 1 (own loop) | record instructed consequences | complete: `modify_existing` "Switch my pickup store…", `create_new` "add two packs …" | used by G's verify rule | 2,129/1,408, $0.000380 |
| 0016 | 7 | search towels | type `t11` "ValueRidge Essentials Select-A-Size Paper Towels", submit | ok; d8 (kept) | 16,913/7,680, $0.002953 |
| 0018 | 8 | open product | click `t446` "…Paper Towels, 6 Double Rolls" | ok, `/ip/…/418830127`; d9 (kept) | 17,267/8,960, $0.002655 |
| 0020 | 9 | "select the 12 Double Rolls size and set quantity to 2, then add to cart" | click `t667` "12 Double Rolls$16.47", add, act a2.size | ok, `?variant=5510202`; d10, **a2.size done: 10** | 18,192/9,600, $0.002759 |
| 0022 | 10 | "Closing the chat layer covering the page" | click `t1086` "×" (support card, `vr-assist`; `t1084` covered 6 elements, `S/0021`) | ok; d11 (taken) | 19,293/10,368, $0.002842 |
| 0024 | 11 | "Adding the paper towel quantity step and the dinner napkin search to the Flow" | amend: keep 10 act a2.size; drop 11 | keep refused `act_already_named` (a2.size was already named by `S/0020`); **drop 11 applied** (`core.amendment_check.11` `applied: 1`). The support card "×" is out of the Flow. The summary says nothing the amendment did. | 20,105/11,136, $0.002850 |
| 0025 | 12 | "Adding the paper towel quantity step…" | amend: keep 10 act a2.size | refused `act_already_named`, `next`: "a2.size done … Still not done: a2, a2.quantity, a3, a3.size" (`S/0025` l.844-857); `stepsWithoutProgress 1`. **W2**: resent a refused amendment | 20,510/14,720, $0.001905 |
| 0026 | 13 | same | keep 10 a2.size; drop 11 | refused, `repeated: true`; `stepsWithoutProgress 2`. **W3** | 20,582/14,720, $0.001929 |
| 0027 | 14 | same | keep 10 a2.size; add 10 a2.size | both refused `act_already_named` (repeated), plus `already_out` for a drop the history shows; 3. **W4** | 20,679/14,720, $0.001970 |
| 0028 | 15 | same | keep 10 a2.size; drop 11; keep 9; keep 8 | all refused (`act_already_named`, `already_out`, `already_in_flow` ×2); 4. `core.no_progress.15`: "Your next step is the one that does a2: run it and add it with act a2". **W5** | 20,753/14,720, $0.002005 |
| 0029 | 16 | "Adding the 12 Double Rolls paper towels to the cart now, then I'll set quantity to two" | click `t1067` "Add to cart", `[modify_existing]`, add, act a2 | ok, "the page ignored the first press, so it was pressed once more"; drawer `t1093` "✓ Added to cart" / **"Qty 1 · Pickup"** (`S/0030`); d12, **a2 done: 12**. The quantity was still 1. | 21,177/14,720, $0.002156 |
| 0031 | 17 | "Adding the paper towel quantity of two to the cart" | amend: repeat 12 over 12, act a2.quantity | refused `over_not_before` (`core.amendment_check.17`). **W6**: repeat is for list rows; same idea as run 1 `S/0031` | 22,482/11,904, $0.003331 |
| 0032 | 18 | "searching for … Napkins 250 Count" | type `t856` "ValueRidge Everyday Dinner Napkins 250 Count", submit | `target_covered` by the added-to-cart drawer, which `S/0030`'s page named (`COVERING t1092 covers 15 · t1093 covers 36`; `t856 … covered-by t1092`). d13 `did_not_work`. **W7**: pressed under a layer it had been shown | 22,260/12,544, $0.003118 |
| 0034 | 19 | "Closing the added-to-cart panel" | click `t1096` "×" with `consequences` inside `parameters` | **`missing_input_keys`** (`S/0035`); d14 `did_not_work`. Cache hit collapsed (3,328): `web.output.dom-type`'s definition was inserted into `describedNodes` mid-prompt (user l.172) after `S/0033`. **W8** | 22,891/3,328, **$0.005996** |
| 0036 | 20 | same | identical input to 0034 | **`repeat_refused`**, not run (`core.repeat_check.20`; history row 20 `unusable`). `core.no_progress.19` said a2.quantity is next. **W9** | 23,381/17,024, $0.002117 |
| 0037 | 21 | same, corrected | click `t1096`, `consequences []`, no add | ok; d15 (kept later as the path to d16; host `interruption:true`, `DD` l.125) | 23,660/17,408, $0.002084 |
| 0039 | 22 | "set the paper towel quantity to 2 using the + control …, then add it to the cart" | click `t928` "+", `consequences` both inside `parameters` and beside it, add, act a2.quantity | ok, quantity 1 → 2; d16, **a2.quantity done: 16, `afterAct: 12`**. The extra `parameters.consequences` stays in the stored step (`S/0066` call). No second Add to cart followed. | 23,258/14,080, $0.002978 |
| 0041 | 23 | first request carrying F' `afterActSaid` ("a2.quantity is made by step 16, after step 12 does a2 … Make the choice before the step that does a2, or do a2 again after it") | search napkins | type `t856` same query, submit | ok; d17 (kept). Results: "…250 Count (3-Pack)" `t1210` and its sponsored copy `t1230`, both $24.99 "Shipping"; "ValueRidge Everyday Dinner Napkins, 100 Count" `t1253` under "Popular in your area" (`S/0042/page.txt` l.44-68) | 23,503/14,336, $0.002962 |
| 0043 | 24 | "Opening the … 250 Count product page" | click `t1210` with `consequences` inside `parameters`, add | **`missing_input_keys`** (`S/0044`); d18 `did_not_work`. **W10** | 24,141/14,720, $0.003020 |
| 0045 | 25 | same | click `t1210`, `consequences []`, add, **act a3** | ok, `/ip/…-3-pack/482214100`: "Sold and shipped by Northgate Wholesale", **Pickup "Not available"**, Delivery "Not available" (`S/0046/page.txt` l.38-46). **a3 done** on a link press (later d19). Core accepted it, as in run 1 (C1). | 24,353/17,664, $0.002227 |
| 0047 | 26 | "the 250 Count (3-Pack) is not available for pickup, so I search for the single 250 Count napkin pack" | type `t1376` same query, submit (from the 3-Pack page) | ok, after the robot check that cleared itself (`S/0048` 10,561 ms; `UI/06-mid-build-scenario.png`); same results; d21 (taken). **W11**: same query, same results | 24,995/15,104, $0.003195 |
| 0049 | 27 | "landed on a 3-Pack … search again" | type `t1151` same query, submit | ok, same results; d22 (taken). **W12**. `t1253` "100 Count" was on the page each time and never opened. | 25,746/15,872, $0.003194 |
| 0051 | 28 | "Adding the napkin product page step … then I'll select the 250 Count size" | amend: keep 19 act a3 | refused `act_already_named`, `next`: "a3 done … Still not done: a3.size". `core.no_progress.28`: "Your next step is the one that does a3.size". **W13** | 26,207/16,640, $0.003049 |
| 0052 | 29 | "Adding the 250 Count napkin variant selection step so the napkin act is complete" | amend: rerun 19 with `{target: t1210}`, act a3 | applied (`rerun: 19`); `S/0053` re-pressed the same 3-Pack link, ok. The rerun is d19; the original press is d20, dropped. Nothing chose 250 Count. Cache hit collapsed (3,584): the observe tools were withdrawn from the prompt at user l.231. **W14**: same target, same act; its summary is false | 23,309/3,584, **$0.006029** |
| 0054 | 30 | `decisionsLeft 1`, `costLeftUsd 0.0155`: "only complete is offered" | **complete**: "Sets pickup store …, then adds two … 12 Double Rolls and one … 250 Count to the cart for pickup" | completion check `ok=true issues=-` (`core.log` l.113) with a3.size `todo: no_step_added`; **test ran** | 22,452/14,976, $0.002466 |
| 0055-0068 | test (no provider) | — | reset, then dryrun 1,2,4,5,7,8,9,10,12,15,16,17,19 | passed: step 15 `failed` and excused (Stage 4) | — |
| 0069 | judge, call 1 | `answersRequest: no`, confidence 0.6 | — | Stage 6 | 4,742/2,048, $0.001330 |
| 0070 | judge, call 2 (identical request) | `answersRequest: no`, confidence 0.9 | — | Stage 6 | 4,742/4,608, $0.000605 |

**Wasted decisions: 14 of 30, $0.043644 of the $0.086255 exploration.**
- Format: W1, W8, W10 (`missing_input_keys`) and W9 (the identical resend, refused by the repeat guard). $0.013919.
- Repeated refused amendment: W2-W5. $0.007809.
- Detours: W6 (`repeat 12 over 12`), W7 (searching under the drawer), W11-W12 (same search twice more), W13 (re-naming
  a3), W14 (rerun of the same press). $0.021916.

Had those $0.0436 not been spent, the purse would have held about $0.055 after the judge, enough for the $0.019 hold.

- Repeats, and what the loop believed was progress:
  - **a2.size, five times.** `S/0024`-`S/0028` each sent "keep 10 act a2.size". `S/0028` sent it twice in one decision. Core's
    first answer (to `S/0024`) was right and plain: `act_already_named`, a2.size done, what is still to do. The model's
    summaries said "Adding the paper towel quantity step", which none of these did. That suggests it meant a2.quantity and
    wrote a2.size. `no_progress` (`S/0029` request) moved it on, to a2.
  - **The quantity, again after the add.** a2 was done at d12 with "Qty 1". The model tried `repeat 12 over 12` (W6), then
    pressed "+" (d16) after the add. From `S/0041` on, every request carried F' `afterActSaid`. That makes eight model
    requests, `S/0041`-`S/0054`, and the model never dropped d12 or re-added after d16.
  - **The napkins.** Three searches for the same query (`S/0041`, `S/0047`, `S/0049`) and two presses of the same 3-Pack
    link (`S/0045`, and the rerun `S/0053`). The model said twice that the 3-Pack has no pickup (`S/0047`, `S/0049`). It
    never opened "100 Count" (`t1253`), whose product page offers 250 Count. The repeat guard did not refuse the searches:
    each ran from a different page.
- Rejections and refusals received, and whether each said enough to route around:
  - `target_covered` (`S/0006`, `S/0033`): said enough (closeWith named). The model closed the drawer after one more format
    error.
  - `missing_input_keys` (`S/0012`, `S/0035`, `S/0044`): said enough (`instead: node, parameters, consequences`;
    `undeclaredParameters: consequences`). The model fixed it on the next turn twice, and the third time (`S/0036`) only
    after a `repeat_refused`. Same mistake three times in one build; run 1 had one.
  - `act_already_named` (`S/0025`…, `S/0052`): said enough, and plainly, including what is still to do.
  - `over_not_before` (`S/0032`): said enough.
  - `repeat_refused` (`S/0037` request): said enough.
  - `no_progress` (`S/0029`, `S/0036`, `S/0039`, `S/0052` requests): each named the next missing act correctly. The model
    obeyed for a2 and a2.quantity; for a3.size it answered with a rerun of a link press.
  - F' `afterActSaid` (`S/0041`-`S/0054`): plain and correct, and ignored.
- Where the context was evicted or truncated: nowhere (`truncated: false` on every page view, `B/evaluation.json`
  `truncationCount 0`). Input grew from 12,208 to 26,207 tokens a decision. The cache-hit share collapsed three times:
  - `S/0003`: the first decision.
  - `S/0034`: a node definition was inserted mid-prompt.
  - `S/0052`: the observe tools were withdrawn.

  The two mid-build collapses cost about $0.008 more than a normal turn.
- Lasting effects on the site during the build:
  - The store was set to Millbrook (`S/0014`).
  - The support card's dismissal (`S/0023`) is remembered by the site, as in run 1.
  - One towel pack was added (`S/0030`). The header reads "🛒 1 $3.97" until the next navigation, then "🛒 2 $20.44"
    (`S/0042`).

## Stage 3 — the proposed Flow

No Flow was proposed. The draft at completion (`S/0054` `core.flow_draft`; `live-llm.json` `incompleteDraft.steps: 13`) holds
13 Flow steps (`inResult: true`). Its parameters are those the test ran (`S/0056`-`S/0068` `call.json`).

- Node list as authored:
  1. d1 `web.output.browser-navigate` `{url: ~/}`
  2. d2 `web.output.dom-click` `{element: button "Reject all", selector body > div:nth-of-type(3) > div > button:nth-of-type(2)}`; host `interruption`
  3. d4 `web.output.dom-click` `{element: a "No thanks", selector body > div:nth-of-type(3) > a}`; host `interruption`
  4. d5 `web.output.dom-click` `{element: button "Pickup or delivery?Carden Falls Supercenter", selector button, shadowHosts [body > div > header > div > vr-fulfillment-picker]}`
  5. d7 `web.output.dom-click` `{element: button "Set as my store", selector div > ul > li:nth-of-type(3) > button, listPosition 3/4, record.text "Millbrook Crossing Supercenter88 Ferris Rd…"}`, consequences `[modify_existing]`, act a1; host `interruption` too (`DD` l.39)
  6. d8 `web.output.dom-type` `{text "ValueRidge Essentials Select-A-Size Paper Towels", submit true, selector input[name="q"]}`
  7. d9 `web.output.dom-click` `{element: a "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls", selector main > div > section > div:nth-of-type(3) > div:nth-of-type(1) > a:nth-of-type(1)}`
  8. d10 `web.output.dom-click` `{element: div visibleText "12 Double Rolls$16.47", selector main > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(4) > div:nth-of-type(2)}`, act a2.size
  9. d12 `web.output.dom-click` `{element: button "Add to cart", selector [data-testid="atc"]}`, `[modify_existing]`, act a2
  10. d15 `web.output.dom-click` `{element: div visibleText "×", selector body > aside > div > div}` (added-to-cart drawer close); host `interruption` (`DD` l.125)
  11. d16 `web.output.dom-click` `{element: span visibleText "+", selector main > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(5) > div:nth-of-type(2) > span:nth-of-type(3), consequences [modify_existing] (stray, inside parameters)}`, `[modify_existing]`, act a2.quantity
  12. d17 `web.output.dom-type` `{text "ValueRidge Everyday Dinner Napkins 250 Count", submit true, selector input[name="q"]}`
  13. d19 `web.output.dom-click` `{element: a "ValueRidge Everyday Dinner Napkins, 250 Count (3-Pack)", selector main > div > section > div:nth-of-type(3) > div:nth-of-type(1) > a}`, `consequences []`, act **a3**

  Not in the Flow:
  - `did_not_work`: d3, d6, d13, d14, d18.
  - Dropped: d11 (support card "×", by `S/0024`) and d20 (the original 3-Pack press, replaced by the rerun).
  - Taken: d21 and d22.

  The judge saw these 13 as `s1`-`s16`, with three `builtin.control.merge` nodes after the optional steps (`S/0069`
  `flowShape`).
- Divergences from the stage 1 chain, one line each:
  - **Towel quantity after the add** (chain step 3). d16 "+" follows d12 Add to cart, so each run adds one pack. Core
    flagged it (`afterAct: 12`) and did not refuse, as F' intends.
  - **No napkin Add to cart** (chain step 4). d19 is a link press carrying a3 ("add … to my cart").
  - **No 250 Count choice.** a3.size `todo: no_step_added`. Unlike run 1, Core did not let the model name a3.size on
    the link (`S/0052` request).
  - **Wrong napkin product.** "250 Count (3-Pack)" (the non-sponsored copy this time) is Northgate Wholesale,
    shipping only, so "for pickup" cannot be met on it.
  - **No support card "×"** in the Flow (d11 dropped). On a site that has not remembered the dismissal, the card covers
    six controls 3 s after load (`S/0021` `t1084 covers 6`). Whether it covers Add to cart was not checked.
  - d15, the drawer "×", sits between the add and the "+". It is correct for the build's page; in a test that does not
    press d12 it can never run (Stage 4).
  - No Pickup choice on the towels. Pickup was the default at Millbrook ("Qty 1 · Pickup", `S/0030`), so this is
    acceptable.
  - Store switch first (d5, d7): correct.
- For each divergence:
  - Quantity after the add: **could not express it, then ignored the remedy.** No amendment moves a step. The remedy
    Core named needs two moves, drop d12 and press Add to cart again after d16. The model made neither in eight
    decisions.
  - a3 on a link press: **misread the grammar, and Core let it through** (run 1's C1, still open).
  - Wrong product: **misread the page.** "Pickup Not available" was read twice, and "100 Count" never tried.

## Stage 4 — replay

The build test from the start (`dryrun.1.*`, `S/0055`-`S/0068`), run at 06:08:02.751-06:08:38.784 (`core.log` l.114-141). The
codes are `result.json` `code` and `said`. No retries, and no recovery ladder (build tests have none).

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| reset `~/` | yes | `replayed`, "the page was put back" (location only) | 1270 ms | 0 | — |
| d1 navigate `~/` | yes | `replayed` | 2260 ms | 0 | — |
| d2 Reject all | no | **`remembered`**: "the step's target is gone from the page it acted on, which is how a site that remembers the step looks" | 6388 ms | 0 | — |
| d4 No thanks | no | `remembered` | 5334 ms | 0 | — |
| d5 store chooser | yes | `replayed` | 959 ms | 0 | — |
| d7 Set as my store (a1) | no | **`present`** (`replay: verify`): "the step's target is gone … how its effect already in place looks; it was not run", `found: missing`. Millbrook reads "Your store" (`S/0060/result.json` page `t1567`). | 7285 ms | 0 | — |
| d8 search towels | yes | `replayed` | 467 ms | 0 | — |
| d9 open towels | yes | `replayed` | 1472 ms | 0 | — |
| d10 12 Double Rolls (a2.size) | yes | `replayed` | 1430 ms | 0 | — |
| d12 Add to cart (a2) | no | **`verified`** (`replay: verify`): "the step's target is on the page, visible and enabled; it was not run" | 2177 ms | 0 | — |
| **d15 drawer "×"** | **no** | **`failed`, "the step did not run (target_not_found)"**. **Excused** (see below). | 2201 ms | 0 | none (fix A) |
| d16 "+" (a2.quantity) | no | `verified` | 1179 ms | 0 | — |
| d17 search napkins | yes | `replayed` | 1392 ms | 0 | — |
| d19 3-Pack link (a3) | no | **`verified`**: the link was found visible; the page was never opened | 2161 ms | 0 | — |

- **Why step 15 failed, and why it was excused.**
  - The drawer "×" belongs to the added-to-cart drawer, which opens only after an add.
  - G withheld d12 (`verified`, not pressed), so no drawer opened. The page view at `S/0065` shows no `aside` drawer, and
    the cart still reads "🛒 2 $20.44".
  - The host had marked d15 `interruption: true` (`DD` l.125). With fix A, an interruption step is conditional in the
    test as it is in the Flow writer (`R/flow-draft/interruption.ts`, `routing.ts`, both in the run's dirty list). So its
    `target_not_found` did not refuse the test.
  - This is **not** run 1's failing step: the support card "×" was dropped from the draft by `S/0024`. A is exercised
    here on a step that G's verify rule made unreachable.
- Any node that reported success while doing nothing:
  - Six of the 13 steps were not pressed: d2, d4 (`remembered`), d7 (`present`), d12, d16, d19 (`verified`). For d2, d4
    and d7 that is correct on a remembering site.
  - d12 and d16 were not pressed **by design** (G): each declared `modify_existing` or carries an act.
  - d19 declared `[]`, and was verified because it carries a3. The test therefore never reached the napkin page, where
    "Pickup Not available" would have shown. The judge was told "outcome: verified … claims a3" for a link.
  - The chat cards say "Done" for all six (UI review U2).
- Provider calls during replay: zero (no `S/` decide row between `S/0054` and `S/0069`).
- Lasting effects of the test: none. The cart was "🛒 2 $20.44" before the test (`S/0050`, `S/0057` page) and after it
  (`UI/09-failure-scenario.png`, `B/screenshots/00016`). Run 1's tests had added two packs; **G did what it was for.**

## Stage 5 — the answer

- Records expected vs returned: none expected (task kind `form`). None returned: no Flow ran (`flow-lane.json` `actions: []`,
  `B/evaluation.json` `oracleVerdict: null`).
- Fields compared, matched, mismatched: none. The playback-goal oracle never ran because no Flow was built.
- Every mismatch, observed value beside expected. There was no oracle, so this is the site as the run left it, from the
  page header and screenshots:
  - Store: Millbrook Crossing Supercenter. Matches.
  - Cart: **"🛒 2 $20.44"**, against the expected "4 items · Subtotal $43.39". That is the soap ($3.97) plus one towels
    12 Double Rolls pack ($16.47) from the build (`S/0030`), and no napkins.
  - Towels 12 Double Rolls ×2 pickup: the Flow would add ×1 per run (d16 after d12).
  - Napkins 250 Count ×1 pickup: **absent.** No step adds them, and the product d19 opens cannot be picked up.
  - No checkout: yes.
- If the comparison was count-only, say so: no comparison ran.

## Stage 6 — judgement and repair

- Did the system judge its own result, and what did it conclude: **yes, twice, and correctly "no".**
  - **Why two calls.** `R/result-verification/verify.ts` l.8-14: "Anything but `yes` is asked once more, with the same
    evidence". A `no` or `unknown` at temperature 0 was measured to flip on identical rows, and only two agreeing `no`s
    fail. `S/0069` and `S/0070` requests are byte-identical (`diff` empty). The second call was 95 % cache hit
    (4,608/4,742) and cost $0.000605. The pair settles in `agreement.ts` l.59-76 as `does_not_answer`, `calls: 2`. The
    first call's diagnosis is kept and the second's is not merged.
  - **`S/0069`** (confidence 0.6), in full:
    - Summary: "The build test shows the Flow does not carry out the instructions. The store switch (step 7) is present,
      and the paper towels size choice (step 10) and add (step 12) are verified, but the quantity of two is made by step
      16 after the add in step 12, so the cart line already added is not increased to two. The napkins add (step 19) is
      verified but no step selects the 250 Count size, and the target it acts on is the 3-Pack listing, not the 250 Count
      size. Step 15 (clicking ×) failed. The Flow also never confirms pickup fulfillment for the added items."
    - `expected`: "Switch pickup store to Millbrook Crossing Supercenter; add two packs … 12 Double Rolls … and one pack …
      250 Count …, both for pickup; keep existing cart; no checkout."
    - `observed`: "Step 7 store switch present. Step 10 selects 12 Double Rolls and step 12 adds towels, but quantity two is
      set by step 16 after the add, so the added line is not two. Step 19 adds napkins but no step selects the 250 Count
      size and it targets the 3-Pack listing. Step 15 (×) failed. No pickup confirmation step."
    - `changed`: "Move the quantity choice before the add: make step 16 (span +) run before step 12, or re-add after step 16
      and name that step for a2. Add a step to select the 250 Count size before step 19, and change step 19's target from
      the 3-Pack listing to the 250 Count item. Add a step to set pickup fulfillment for both items."
    - `stillAchievable yes`, `deterministicRecoveryPossible yes`, **`answersRequest no`**, `explorationNeeded false`,
      `patchNeeded true`.
  - **`S/0070`** (confidence 0.9):
    - Summary: the same quantity finding, and "the napkin item is only opened (step 19) with no step that adds it to the
      cart or selects the 250 Count size".
    - `changed`: "… Add a step after step 19 to select the 250 Count size and a step to click Add to cart for the napkins
      (a3.size has no_step_added). Fix or remove the failed step 15."
    - **`answersRequest no`**.
  - Accuracy of the two calls:
    - Right on the quantity order. That finding is F' `afterActSaid`, given to the judge in `buildTest.checklist`.
    - Right that no step chooses 250 Count, and right on the 3-Pack target.
    - Wrong in `S/0069`, the call that is kept: "the napkins add (step 19) is verified" and "Step 19 adds napkins". The
      test only found a link. `S/0070` had it right.
    - Spurious in `S/0069`: "no pickup confirmation step". Pickup was the default, and the instruction needs no step for
      it.
    - "Change step 19's target … to the 250 Count item" names a listing that does not exist. 250 Count is a size on
      the 100 Count product's page.
    - "Fix or remove the failed step 15" (`S/0070`) steers at a step that was excused and is correct.
  - **What the judge was not told.** Its `buildTest` lists step 15 as `outcome: failed`, with no word that it was excused
    or optional (`S/0069` request). The settled reason Core attached, and the card shows, is "The result was judged not to
    answer the request …, twice and with the same evidence, **although every step of the run succeeded**"
    (`agreement.ts` l.73). It is a fixed sentence, and false here.
- If the answer was wrong, did a repair trigger automatically: **no**, because the purse could not fund a round.
  - After a judged no, `R/flow-bootstrap/unfinished-build/phases.ts` l.404 calls `exhaustedForNextRound()` (l.374-379)
    before any repair.
  - The need is `nextRoundHold` (l.437-440): `holds.decisionUsd + holds.judgeUsd`. These are the purse's
    `lastProjectedCostUsd` after the last decision (l.293-294) and after the judge (l.314-315). Each is a call priced at
    its reply cap.
  - The purse arithmetic, from the ending and `live-llm.json`:
    - Ceiling: $0.10 (`authorized.maxEstimatedCostUsd`).
    - Spent: $0.088887, the run's whole `totalEstimatedCostUsd`. The purse counts the chat call too: the `S/0054`
      request's `costLeftUsd 0.0155` equals 0.10 − 0.084485, the spend before `S/0054` with the chat call included. The
      ending's "$0.089" is this figure rounded.
    - Left: 0.10 − 0.088887 = **$0.011113** ("$0.011").
    - Held: **$0.019** ("its next decision and the judging of its Flow could cost up to $0.019").
    - $0.0111 + ε < $0.019, so the bound is `cost` (`exhaustedBound` l.517), and the build ended `budget_exhausted`.
  - What the $0.019 is made of. The components are not logged. An estimate from the rates:
    - A decision at the 8,000-token output cap: 8,000 × $1.20/M = $0.0096, plus about 22.5k input at miss price, $0.0067.
      That is about $0.0163.
    - The judge at its 2,000-token cap (`max_tokens: 2000`, `S/0069` request): $0.0024, plus 4,742 × $0.30/M = $0.0014.
      That is about $0.0038.
    - Sum: about $0.020, close to the $0.019 shown.
  - What such a round really costs: this build's decisions output at most 117 tokens, and cost $0.0018-0.0060, median
    about $0.0028. Judging cost $0.0019 for both calls. So one decision plus judging is about $0.005, a quarter of the
    hold.
  - The hold also prices one judge call, while a `no` costs two.
- What context would the repair have received: none was assembled; nothing ran.
- Was the repair persisted, and did the re-run use it: nothing was persisted. The Flow
  `flow.d174d6c4-…` is empty, with the instruction saved on it (`create-here.ts` l.57 at HEAD; ending, UI review). The
  ending also says "The Flow so far was kept, and building again carries on from it" (U6).

## UI review (screenshots)

Paths are under `UI/` (9 moments, panel plus scenario) and `B/screenshots/`. Overlay data is
`run-murzln6g-11debe1d.ui-review.local.json` `moments[].overlay`. Every PNG was viewed.

- `01` (06:06:26): the panel reads "Loading the conversation…". The page shows the consent dialog and the "Chat with
  us" pill. No overlay; correct.
- `02` (06:06:30):
  - **The person's turn is now in the stream** (a bubble with the instruction), which is an improvement on run 1.
  - **The same instruction is still in the composer**, so the person sees it twice while "Sending your message" shows.
    Downstream `apps/extension/src/panel/chat/` composer.
  - The scenario picture shows **no overlay**, although 9 of the moment's 16 samples, the last 9, were present at
    x16,y638 ("Building your Flow | Opening where the Flow starts"). Not explained; the Lab's picture and its samples
    disagree.
- `03` (06:06:50):
  - **"Click · Set as my store / Didn't work: it wasn't on the page"** is the `S/0012` `missing_input_keys` refusal. The
    button was on the page. Run 1's C13, still open: Core `src/ui/activity-action/failure-reason.ts`.
  - The overlay is bottom-left over the product cards, with the store picker open. Fine.
- `04` (06:07:10):
  - The header "Updating the draft Flow — Adding the paper towel quantity step and the dinner napkin search to the Flow,
    then I'll add the napkin size and cart steps" is `S/0024`. That amendment dropped the support card "×" and had a
    refused re-naming. **The chat repeats the model's claim, not what happened** (U9).
  - The overlay, by contrast, said it right during this moment: "That step already does that; and that step is already
    out of the Flow, so this was not done: …".
  - Card target "12 Double Rolls$16.47" glues the price to the label (run 1's C15).
  - Scenario: the overlay sits **mid-left over the product image** (y=318.5), as on every product page this run (`04`,
    `05`, `08`). It sits at y=638 on home and search. The page is scrolled 26 px sideways, with a horizontal scrollbar.
    The `S/0065` view says "scrolled to x=26".
- `05` (06:07:30):
  - "Type · Search / Didn't work: a popup or banner on the page was covering it" (`S/0033`) is correct.
  - "Click · × / Didn't work: it wasn't on the page" (`S/0035`) is the `missing_input_keys` wording defect again.
  - **A header with no card**: "Clicking “×” — Closing the added-to-cart panel so I can search for … and add one pack."
    That is `S/0036`, refused by the repeat guard and never run. The person cannot tell it was refused (U8).
  - The header cart reads "1 $3.97" although a towel pack was added at `S/0030`. The site refreshes the header only on
    navigation; that is site behaviour, not FluxIQ.
- `06` (06:07:50):
  - "Clicking “ValueRidge Everyday Dinner Napkins, 250 Count (3-Pack)” — Opening the … 250 Count product page to add one
    pack for pickup", "Done". **The chat repeats a false claim:** that page has no pickup.
  - The next header correctly says the 3-Pack is not available for pickup.
  - Scenario: the robot check "Robot or human? … check your browser again automatically in 3 seconds"; the overlay keeps
    showing "Typing …".
  - Samples: the document changed during the window (`documentOrigin` 1791007662125.9 → 1791007670175.4 between 2202 and
    2401 ms) with the overlay present in every sample, so `pageLoads` stayed 0 (see fix E below).
- `07` (06:08:10):
  - **"Test run · Passed" is shown before the test's steps**, followed by "Test run · /scenarios/bigbox-retail Done" and
    "Test run · Reject all Working on it". It is not a test result. It is the **completion check**:
    - Core `R/activity/observer.ts` l.165-167 emits `detail: {kind: "check", title: "Completion check", status:
      "succeeded"}`, with the label "The proposed Flow’s plan checks out; it still has to run cleanly".
    - Core `src/ui/activity-action/action-of.ts` l.129 maps every check that is not a result check to kind `test`, so
      the card reads "Test run".
    - Downstream `apps/extension/src/panel/chat/stream/step/card-words.ts` l.53 says "Passed" for a done check.
    - The label that would have said "it still has to run cleanly" is not on the card.
    - The person reads that the test passed at 06:08:02, 36 s before the test finished.
  - The header above it, "Checking the Flow is finished — Completing now: the Flow sets the Millbrook Crossing store,
    adds two 12 Double Rolls paper towel packs and one 250 Count napkin pack for pickup", repeats the model's false
    completion summary.
  - The header before that, "Updating the draft Flow — Adding the 250 Count napkin variant selection step …", is
    `S/0052`, which re-pressed the 3-Pack link.
  - Scenario: home page, overlay "Trying the Flow from the start: clicking “Reject all”", cart "2 $20.44".
- `08` (06:08:30): test cards "Reject all Done", "No thanks Done", "Set as my store Done", "Search Done". **Three of these
  were not pressed** (`remembered`, `remembered`, `present`), and "Done" says nothing of that (U2). The overlay is again
  mid-left over the product image.
- `B/screenshots/00012` (06:08:38): "Test run · Add to cart Done" and "Test run · + Done", both `verified`, not pressed.
  **"Test run · × / Didn't work: it didn't work the same way again"** in red, with no word that it was excused or
  optional (U3). It "didn't work the same way" because the drawer never opened; the step itself is fine.
- `B/screenshots/00013` (06:08:44, "instruction ended" checkpoint):
  - "Judging the Flow — The Flow was tested from its start. Judging what the test did against what you asked."
  - **An empty "Check result" card with no outcome**, then a second "Check result" card: "Didn't pass: the result was
    judged not to answer the request the Flow was built for, twice and with the same evidence, **although every step of
    the run succeeded**. What it found: Step 7 store switch present. Step 10 selects 12 Double Rolls and step 12 adds
    towels, but quantity two is set by step 16 after the add … Step 19 adds napkins … Step 15 (×) failed. No pickup
    confirmation step. What to change: Move the quantity choice before the add …".
  - The text contradicts itself ("every step … succeeded" … "Step 15 (×) failed"), and it shows the first judge call's
    two errors ("Step 19 adds napkins", the pickup step).
  - The empty card exists because the start event is titled "Result check started" and the end event "Result check"
    (`R/result-verification/verify.ts` l.138 and l.158). Cards are keyed by `check:${title}` (`src/ui/activity-action/key.ts`
    l.23), so the two never join (U4).
- `09` (06:08:47) and `B/screenshots/00016`:
  - **D works:** the panel followed to the end and shows FluxIQ's ending.
  - The ending, in full: "The build stopped at its spending limit of $0.10 before the Flow was finished: it had spent
    $0.089 ($0.000 of it by earlier builds of this Flow), which left $0.011, too little for another round: its next
    decision and the judging of its Flow could cost up to $0.019. 5 of the 6 things you asked worked when the Flow was run
    from its start; still to do: "in the 250 Count size": nothing I tried did it. The Flow (13 steps) ran from its start,
    but what it did was judged not to be what you asked. I explored live once over 30 decisions, and what held it up was
    that the Flow it said was ready was not judged to do what you asked. The Flow so far was kept, and building again
    carries on from it, with $0.011 left of this Flow's $0.10. What is left: the Flow "Switch my pickup store to Millbrook
    Crossing Supercenter, then add two packs...", empty, with what you asked saved on it, so it can be built again."
  - Defects in it:
    - "kept … carries on from it" against "empty" (lead's R2-C3).
    - "5 of the 6 things you asked worked" right after the judge said no. With G, `verified` and `present` count as
      worked (`not-done.ts` l.164-167 at HEAD, `judgement.proven`). The napkin "add" that "worked" is a link found
      visible.
    - "($0.000 of it by earlier builds of this Flow)" says nothing a person needs.
    - "The Flow (13 steps) ran from its start", although six of its steps were not pressed.
    - It never says the cart was changed: one towel pack was added by the build.
  - Overlay: the scenario picture shows "Building your Flow / The result doesn't answer the request". The samples then
    turn to "Build failed | Build stopped: a budget ran out" (`00016`). That names no budget, as in run 1.
  - Cart "2 $20.44": the test added nothing.

## Fixes since run 1, as they behaved here

| Fix | Intended | In this run | Verdict |
| --- | --- | --- | --- |
| A | Interruption steps are conditional in the test, as in the Flow | d15 (`interruption:true`, `DD` l.125) failed `target_not_found` (`S/0065`), the test passed and the judge ran | Worked. It covered a failure caused by G (d12 not pressed, so no drawer). The judge and the card were not told the failure was excused. |
| B | A completion on an unchanged, refused draft is refused without re-testing | One completion only, and its test passed | **Not exercised** |
| C | A target present but not rendered is handled as not shown | No `not_actionable` anywhere in `S/` | **Not exercised** |
| D | The panel keeps following unless the person scrolls | `09`, `00012`, `00013`, `00016` all show the newest content | Worked |
| E | A one-sample overlay gap across a document swap is a page load, not flicker | No moment flickering; `pageLoads 0` everywhere. But no moment had an absent sample at all, and `06` spanned a document swap with the overlay present throughout | **Not exercised**. "0 page loads" means no gap, not no page load. |
| F' | The model and the judge are told when a choice comes after its act | `afterActSaid` in `S/0041`-`S/0054` and in the judge's checklist; `S/0069` quotes it | Worked for the judge; the model ignored it 8 times |
| G | Act and lasting-effect steps are checked, not pressed, in the test | d12, d16, d19 `verified`, d7 `present`; cart unchanged at "2 $20.44" | Worked. Side effects: d15 unreachable (above), and the test never opened the napkin page (d19) |

## Lead's "Run 2" claims, checked

- "$0.0889 (32 calls)": **the cost is right, the count is wrong.** There were **34 calls**: 1 chat, 30 exploration
  decisions, 1 consequence read, 2 judge (`live-llm.json` `observed.calls`; `S/` meta).
- "Stage reached 6 (test passed, judge said no; the purse ran out before a repair round; no Flow)": right.
- A, G, F', D: right as stated (table above). A's step is not the step that failed in run 1. G's "napkin act" that was
  `verified` is a link press.
- E, "0 page loads in the samples": literally true, and misleading. Moment 6 has a document swap that the counter does
  not count, because the overlay never went absent.
- "The judge (`S/0069`, `answersRequest: no`) was right: quantity after the add, no 250 Count choice, the 3-Pack target":
  right on those three. `S/0069` also wrongly says step 19 adds napkins and asks for a pickup step. The verdict that
  failed the run is the pair `S/0069` + `S/0070`, not `S/0069` alone.
- "$0.011 of the purse, against $0.019 held for a decision plus a judgement": right (ending). The two parts are not
  logged anywhere.
- "Exploration took 30 decisions and $0.085": 30 is right; the cost is **$0.0863**.
- R2-C1, "Three of about fifteen action calls were refused `missing_input_keys` … one resend was also refused by the
  repeat guard": three refusals is right (`S/0012`, `S/0035`, `S/0044`), as is the repeat refusal (`S/0036`→`S/0037`
  request). The run had **20** model-chosen action calls that ran, not about fifteen. The four decisions cost $0.0139.
  `S/0039` wrote `consequences` in both places and was accepted, so the stray key is now stored in d16's parameters.
- R2-C2, "the same refused amendment … five times, `S/0024`-`0028`, after Core's first answer": five sends, but the
  first (`S/0024`) came **before** any answer and also applied a drop. There were **four** after the first answer, $0.0078
  ($0.0107 counting `S/0024`); the lead says about $0.009.
- R2-C3: right, and the cited lines are right at HEAD (`create-here.ts` l.57, `not-done.ts` l.167).
- "R2-C1 and R2-C2 are about 7 of the 30 decisions": **8** (`S/0011`, `0034`, `0036`, `0043`; `S/0025`-`0028`). All waste
  together is **14 decisions, $0.0436** (Stage 2).

## Causes

| # | Cause, precisely | Stage | Evidence | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | **The purse holds a repair round at reply caps**: a decision at 8,000 output tokens (~$0.016) plus one judge call at 2,000 (~$0.004), about $0.019. A real decision plus judging cost ~$0.005 in this run. With $0.0111 left, a judged-wrong Flow got no repair, although its judge gave a precise one. | 6 | ending; `live-llm.json`; `S/*/meta.json` outputs ≤117 tokens; `phases.ts` l.293-315, l.437-440, l.517 | Core `R/flow-bootstrap/unfinished-build/phases.ts`; the purse's `lastProjectedCostUsd` | **Open.** Hold at a cap sized for the call (an evidence decision's reply is under 300 tokens), or at the observed maximum with a margin. A `no` also needs two judge calls, not one. | — |
| C2 | **14 of 30 decisions wasted, $0.0436**: `consequences` inside `parameters` ×3 plus a resend (H), the same refused amendment ×4, `repeat 12 over 12`, a search under a layer the page view named, the same search twice more, a rerun of the same press. | 2 | Stage 2 W1-W14 | Model; domain `node-run/run.ts` l.296 (HEAD) for the format refusal | H for the format errors (in progress). The rest: **open** (model). | — |
| C3 | **The quantity choice after its act (d16 after d12) was never corrected.** F' told the model in 8 requests. No amendment moves a step, and the remedy needs a drop plus a new press. | 2/3 | `S/0041`-`S/0054` `afterActSaid`; d12, d16 | Core `R/flow-bootstrap/instructed-acts/choice-order.ts` (information only); amendment grammar `R/flow-draft/amendment.ts` | **Open.** Offer a `move` amendment, or let the test press the choice before the act. | — |
| C4 | **Act a3 ("add … to my cart") was named on a link press** (d19, "250 Count (3-Pack)"). Core accepted it, G then `verified` the link as the act, and the ending counted it as "worked". | 2/3/4 | `S/0045` act a3; `S/0068`; ending "5 of the 6" | Core `R/flow-draft/amendment.ts`, `R/llm/decision-handlers/` (act naming) | **Open** (run 1's C1). | — |
| C5 | The model chose the shipping-only 3-Pack and never opened "100 Count" (`t1253`), which offers 250 Count. | 2 | `S/0042/page.txt` l.44-68; `S/0046/page.txt` l.38-46 | Model | **Open** (run 1's C3). | — |
| C6 | **An excused failure is reported as a failure, and then as no failure.** The judge's `buildTest` says step 15 `failed`, with no excused or optional mark, and `S/0070` asks to "fix or remove" it. The verdict reason says "although every step of the run succeeded". The card says "Didn't work". | 4/6 | `S/0069` request `buildTest`; `agreement.ts` l.73; `B/screenshots/00012`, `00013` | Core `R/llm/node-tools/replay-draft.ts` (build-test account), `R/result-verification/agreement.ts` | **Open.** Mark the step `excused (optional; its layer did not appear)` everywhere, and drop the fixed clause. | — |
| C7 | **G makes a step that depends on an act's effect unreachable in the test.** d12 is not pressed, so the drawer it opens never appears, and d15 fails. Only A excused it, because d15 happened to be an interruption. A step such as "View cart" or a drawer quantity would refuse the test. | 4 | `S/0064`, `S/0065` | Core `R/flow-draft/verify-only.ts` with `interruption.ts` | **Open.** After a verified act, a step whose target is absent and which acts only on what the act would have opened should be `verified`-by-skip, said as such. | — |
| C8 | G verifies act-carrying presses that declared `[]` (d19, a link). So the test stops short of the page the act needs, and the judge reads "verified … claims a3". | 4/6 | `S/0068`; `S/0069` request | Core `R/flow-draft/verify-only.ts` | **Open.** Withhold only steps with a declared lasting effect; a navigation can run. | — |
| C9 | UI: **"Test run · Passed" is the completion check**, shown before the test's steps. The label that says it "still has to run cleanly" is dropped. | UI | `UI/07-mid-build-panel.png` | Core `src/ui/activity-action/action-of.ts` l.129, `R/activity/observer.ts` l.165-167; downstream `panel/chat/stream/step/card-words.ts` l.53 | **Open.** Give the completion check its own kind ("Plan check · OK"), never "Test run". | — |
| C10 | UI: test cards say "Done" for steps not pressed (`remembered`, `present`, `verified`), and "Didn't work: it didn't work the same way again" for the excused step. | UI | `UI/08-mid-build-panel.png`, `B/screenshots/00012` | Core `R/activity/wording/` (test-step outcome); downstream `card-words.ts` | **Open.** "Checked, not pressed", "Already done on the site", "Skipped: optional". | — |
| C11 | UI: an empty "Check result" card precedes the real one, because the start and end events carry different titles. | UI | `B/screenshots/00013` | Core `R/result-verification/verify.ts` l.138, l.158; `src/ui/activity-action/key.ts` l.23 | **Open.** | — |
| C12 | UI: a `missing_input_keys` refusal reads "Didn't work: it wasn't on the page". | UI | `UI/03`, `UI/05` | Core `src/ui/activity-action/failure-reason.ts` l.15 | **Open** (run 1's C13). | — |
| C13 | UI: a decision refused before it ran (`repeat_refused`) shows a header and no card. | UI | `UI/05-mid-build-panel.png`; `S/0036` | downstream `panel/chat/stream/step/messages.ts` (a decision with no tool), Core activity for `unusable` decisions | **Open.** | — |
| C14 | UI: the chat repeats the model's claims as fact: amendment summaries (`S/0024`, `S/0052`), the 3-Pack "for pickup" (`S/0045`), and the completion summary. | UI | `UI/04`, `UI/06`, `UI/07` | Core `R/activity/wording/` (decision headers) | **Open** (run 1's C14). | — |
| C15 | UI: the ending contradicts itself (kept vs empty) and the judge ("5 of the 6 … worked"); "ran from its start" with 6 of 13 steps not pressed. | UI | `UI/09`, `00016` | Core `conversations/commands/create-here.ts` l.57, `unfinished-build/not-done.ts` l.164-167, `budget-exhausted.ts` (HEAD) | I (in progress) | — |
| C16 | UI polish carried over: the instruction stays in the composer after sending (`02`); the overlay sits over the product image on product pages (`04`, `05`, `08`); a price is glued to its label; "a budget ran out" names nothing. | UI | listed | downstream `panel/chat/` composer, overlay `status-pill.ts`; Core `R/activity/wording/` | **Open** (run 1's C15). | — |
| C17 | The host again marks the store choice "Set as my store" `interruption:true`. | 2 | `DD` l.39 | downstream `domain/src/runtime/llm-evidence/node-run/press-effect/answered-layer.ts` | **Open** (run 1's C10, risk). | — |
| C18 | Two mid-build cache collapses, about $0.008 extra. A node definition was inserted into `describedNodes` mid-prompt after a refused `dom-type` (`S/0034`). The observe tools were withdrawn by `no_progress` (`S/0052`). | 2 | `S/0032`→`S/0034` diff at user l.172; `S/0051`→`S/0052` diff at l.231 | Core `R/llm/` prompt assembly | **Open.** Append, do not insert; keep the tools list stable and refuse at call time. | — |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 6 | The purse's decision and judge holds that make up "$0.019" are in no log. `core.log` stops at the last test step, and the decision dump has no judge or purse event. | Core `R/flow-bootstrap/unfinished-build/phases.ts` (no build-trace line for `exhaustedForNextRound`); decision-dump writer |
| 6 | The judge verdict, its two calls and the round ending are not in `core.log` build-trace or the decision dump. They are readable only from `S/0069`, `S/0070` and the ending. | Core build-trace / `FLUXIQ_BUILD_DECISION_DUMP` writer |
| all | `live-llm.json` books the judge's two calls and the consequence read inside `phases.build` cost, with `calls: 30` and `phases.judge: null`; `stepLog.unattributed` 3 calls at $0. `instructedConsequences: null` although `S/0015` read them. | Lab `live-llm.json` writer (`packages/test-runner`); Core `phases.ts` `judgeAccounting` (spend with no call) |
| all | FluxIQ's ending is cut at "…was not…" in `events.ndjson`, `summary.json` and `flow-lane.json`. The full text exists only in screenshots. | Lab failure-message truncation (`packages/test-runner`) |
| 2 | Amendment decisions (`S/0024`-`S/0028`, `S/0031`, `S/0051`, `S/0052`) and the repeat-refused call (`S/0036`) still have no result folder; Core's answer is only in the next request. | Core `R/llm/step-log/` |
| 4 | The test rows do not say a failed step was excused; whether d15 was excused is inferred from the test passing and `DD` l.125. | Core `R/llm/node-tools/replay-draft.ts` |
| 4 | Verified rows (`S/0064`, `S/0066`, `S/0068`) keep no page view (`screenshot.skipped.txt`, `result.json` has no `page`). | Core `replay-draft.ts` result shape |
| UI | Overlay samples now carry `documentOrigin`, so a document swap is visible, but `pageLoads` counts only a swap with an absent gap. A swap with the overlay present (moment 6) is not counted or reported. No per-sample URL. | downstream `packages/test-runner/src/run-scenario/ui-review/count-overlay-changes.ts`, `read-overlay-sample.ts` |
| UI | Moment 2's picture shows no overlay while its samples say present; the recorder does not say when the picture was taken relative to the samples. | downstream `ui-review/recorder.ts` |
