# Run debug — `run-musp4h2f-72e8ed99`

t193 lane B, round 1003, run 1, slot-2. Task `bigbox-retail-pickup-cart-store-remembered-after-creation`, variant
`store-remembered`, built from the extension chat. Written by worker t193-1003-w1 (read-only except this file and
`reports/t193-1003-w1-debug-run1.md`).

Sources and short names:
- `S/` = `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-03/run-musp4h2f-72e8ed99/steps/` (199 folders, `index.md`).
- `B/` = the same bundle's root (`summary.json`, `evaluation.json`, `run.json`, `snapshots/flow-lane.json`,
  `snapshots/live-llm.json`, `logs/core.log`).
- `I/` = `test-runs/instances/t193-slot-2/run-musp4h2f-72e8ed99/` (`events.ndjson`).
- `UI/` = `test-runs/instances/t193-slot-2/run-musp4h2f-72e8ed99.ui-review.local/` (40 PNGs, 20 moments) and its `.json`.
- `DD0`-`DD3` = `test-runs/instances/t193-slot-2/decision-dumps/build-2026-10-03T18-03-48-053Z-9204.jsonl` (round 0),
  `…18-05-00-612Z…` (round 1), `…18-07-12-770Z…` (round 2), `…18-08-34-896Z…` (round 3).
- `R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

**What the run ran.** `B/run.json`: downstream `45bd6232` (dirty only by the lead's report), Core `6beae684` clean.
Core's `dist` was built at 17:45Z (`dist/…/action-permissions.js`, `summary.js`, `progress.js` mtimes 10:45 PDT),
before the run (17:58Z-18:09Z). Since the run, someone else has edited Core's working tree:
`action-permissions.ts`, `verify-only.ts`, `summary.ts`, `observation.ts`, `progress.ts`, `not-finished.ts`,
`judgement.ts`, `contracts.ts` and their tests (`git status`, sources modified 18:17Z and later). Those edits are the
in-flight fixes for findings A-C below and were **not** in the run. This file therefore cites Core as
`git show HEAD:…`.

**What decided this run, in one line:** the test pressed "Add to cart" for real every time it ran, because only the
store act a1 was recognised as lasting (finding A). So the person's cart went from 1 item to 13. Then the last judge
pair split (no, yes) over a towel quantity that the domain had observed and Core never sent (finding B). Core then
ended the build saying "the judge still could not judge it", although the round before had been judged `no`
(finding C).

---

## Header

- Run id: `run-musp4h2f-72e8ed99`
- Scenario / variant / task: `bigbox-retail` / `store-remembered` / `bigbox-retail-pickup-cart-store-remembered-after-creation` (lane `flow`, build entry `chat`).
- Command: from `reports/t193-lead-1003.md`:

      FLUXIQ_LAB_INSTANCE=t193-slot-2 FLUXIQ_BUILD_PROGRESS_TRACE=1 FLUXIQ_LAB_KEEP_RUN_STATE=1 \
      FLUXIQ_BUILD_DECISION_DUMP=<tree>/test-runs/instances/t193-slot-2/decision-dumps \
      node scripts/lab/run-lab.mjs run bigbox-retail --live-llm --llm-profile production --llm-provider deepseek \
        --llm-model deepseek-flash --llm-task create-flow \
        --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation --llm-max-input-tokens 992000 \
        --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 64 --llm-cost-ceiling-usd 0.10 \
        --evidence events

  `B/run.json` `invocation.args` matches this, with the token limits screened.
- Date, provider, model: 2026-10-03, 17:58:52Z to 18:09:36Z (the build itself ran 18:03:45Z-18:09:32Z, 346.7 s). DeepSeek `deepseek-flash`, Chrome 134, headed.
- Provider calls, tokens, cost: 68 calls, $0.091990 (`B/snapshots/live-llm.json` `runSpend`). By phase:
  - build: 60 calls, $0.087412;
  - judge: 6 calls, $0.004238;
  - instruction read: 1 call, $0.000192;
  - chat: 1 call, $0.000147.

  Build accounting, judge and read included: 1,349,809 input tokens, 8,357 output, $0.091842.

  Per round (step-log `meta.json` sums):

  | Round | Decisions | Cost | Judge calls |
  | --- | --- | --- | --- |
  | 0, exploration | 15 | $0.020596 | not judged |
  | 1, repair | 32 | $0.046296 | 0129/0130, $0.001326 |
  | 2, repair | 9 | $0.013140 | 0171/0172, $0.001499 |
  | 3, repair | 4 | $0.007380 | 0198/0199, $0.001413 |

  The instruction read 0033 ($0.000192) falls in round 0, before its test. The ceiling was $0.10, so about $0.008 was
  left.
- Verdict as reported: `failed`, `runtime.behavior`, `lab.chat_build_failed` with issue code `flow_bootstrap.build_not_finished` (`B/evaluation.json`, `B/snapshots/flow-lane.json`). FluxIQ said: "I have not finished this Flow yet: the last 2 repairs made no measurable progress, each on the round before it: no more of the 6 things you asked had a step (6, as before); the judge still could not judge it. … I tried 4 times live -- exploring, then 3 repairs after testing what I had -- over 60 decisions. The Flow so far was kept as a draft …"
- **Stage reached:** 6, judgement and repair. The Flow was tested and judged three times and repaired three times. Stage 5 (the answer) was wrong at every test, because the person's cart ended at 13 items, not 4. The store-remembered playback, which would exercise t243 routing, never ran because no Flow was created.

## Stage 1 — the instruction and the expected chain

Copied from `reports/t193-lead-1003.md`, "Stage 1, written before the first run". That section is itself unchanged
from `t193-lead-1002M.md` "Stage 1".

- The instruction, verbatim (`S/0001` response): "Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out."
- The node chain a correct Flow must have, written before looking at the run:
  1. Answer the layers that are only sometimes present: consent, sign-up popup, chat bubble.
  2. Open the store chooser, then press Set as my store on Millbrook. The page reloads. This comes first because the 12-roll pack is not stocked at Carden Falls.
  3. Towels page: choose 12 Double Rolls, choose Pickup, set quantity 2 before Add to cart, then Add to cart.
  4. Napkins page, reached through the "100 Count" family, which offers 250 Count: choose 250 Count, choose Pickup, quantity 1, then Add to cart.
  5. No checkout.
- Final mini cart: Millbrook, the soap kept, "4 items · Subtotal $43.39". Store-remembered playback: the store step
  finds no Set as my store on Millbrook ("Your store") and routes by page state (t243), with no repair and no second
  press.
- What a wrong answer that looks right would look like here:
  - the napkins "250 Count (3-Pack)" added, which ships only;
  - the towel quantity left at 1, or "+" pressed after Add to cart;
  - the cart grown by the build's own tests;
  - a Flow judged on a cart count that earlier test runs had inflated.

## Stage 2 — exploration

The table has one row for each model turn, 62 in all: the chat read, 60 decisions and the instruction read. "Asked"
is the round and iteration and what the request showed. Answers to refused amendments are quoted in the
"Rejections" list after the table. Cart lines (`🛒 N $X`) are from the page views (`page.txt`).

**Round 0, exploration** (`part creation`, 15 decisions, $0.020596). It stopped `unusable_decisions`
(`DD1` `core.resumed.0` `stopped`).

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0001 | chat: the person's message (panel command) | create a Flow here | `flow.createHere` with the instruction verbatim | build began (chat `became: build`, `resultTurn 3`) |
| 0003 | r0 it1: home page; consent dialog t314 and sign-up popup t313 covering; 🛒 1 $3.97; store Carden Falls | dismiss consent | `dom-click {target: t319}` "Reject all", `[]` | succeeded, consent gone (`S/0004`) |
| 0005 | it2 | open store chooser | `dom-click t7` | **refused** `target_covered` (t313; closeWith t317, t332): "Nothing was done. The layer in instead covers the target: press one of closeWith to close it, then make this same call again, unchanged." Enough: the next call closed it. |
| 0007 | it3 | close sign-up popup | `dom-click t332` "No thanks" | succeeded |
| 0009 | it4 | open chooser | `dom-click t7` | succeeded, stores listed |
| 0011 | it5 | set Millbrook | `dom-click t354` "Set as my store", `add`, `act a1` | succeeded, page reloaded; header "Millbrook Crossing Supercenter" (`S/0012`) |
| 0013 | it6 | search towels | `dom-type t11` "ValueRidge Essentials Select-A-Size Paper Towels", submit | succeeded → `/search?q=…` |
| 0015 | it7 | open product | `dom-click t446` (link "…, 6 Double Rolls") | succeeded → `/ip/…/418830127` |
| 0017 | it8 | choose size | `dom-click t667` "12 Double Rolls", `add`, `act a2.size` | succeeded → `?variant=5510202` |
| 0019 | it9 | close chat bubble | `dom-click t1091` "×" | succeeded (`S/0020`) |
| 0021 | it10 | amend: "Adding the paper towel quantity and the dinner napkin product to the Flow" | `keep 9 act a2.size`; `drop 10`; `bind 9 {target: {$input: paperTowelVariant, test: {handle: t667}}}` | `S/0022` partly_applied: drop 10 applied; 9 `act_already_named`; 9 `bind_new_key` (parameter `target`) |
| 0023 | it11 | amend | `bind 9 target {$input paperTowelVariant, test "12 Double Rolls"}`; `repeat 9 over 9` | `S/0024` refused: `bind_new_key`, `over_not_before` |
| 0025 | it12 | amend | `keep 9`; `drop 10` | `S/0026` refused: `already_in_flow`, `already_out` |
| 0027 | it13 | amend | `bind 9 target (handle t667)`; `drop 10` | `S/0028` refused: `bind_new_key` (repeated), `already_out` (repeated) |
| 0029 | it14 | amend | `keep 9`; `drop 10` | `S/0030` refused, both repeated |
| 0031 | it15 | amend | `keep 9 act a2.size`; `drop 10` | `S/0032` refused: `act_already_named`, `already_out`. This was the third decision in a row whose every amendment had been refused the same way before (0028, 0030, 0032; `maxRefusedInARow 3`, `R/llm/decision-handlers/amendment.ts` l.107-115), so the round stopped `unusable_decisions` |
| 0033 | instruction read (`phase read`), lazily before round 0's test | complete | `instructed`: `modify_existing` "Switch my pickup store to Millbrook Crossing Supercenter"; `create_new` "add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart" | these two quotes are what `instructedLastingActs` matched against (finding A) |

Round 0's test is `S/0034`-`0042` (Stage 4). It was not judged, because a round that stopped before completion gets
a test only.

**Round 1, repair of the unfinished draft** (32 decisions, $0.046296). It was shown `stopped: unusable_decisions`,
`actsDone 2`, `actsTodo [a2, a2.quantity, a3, a3.size]`.

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0044 | r1 it1: towels page where the test left it (Core looked first, `S/0043`) | look | `dom-capture_snapshot {}` | unchanged; `core.request_check.1` `looked_again_unchanged` |
| 0046 | it2 | amend: "Adding the quantity step (two packs) and the add-to-cart press …" | `keep 8 act a2.size`; `drop 9`; `drop 10` | `S/0047` partly_applied: 2 drops applied (targeted d9-d11); 8 `act_already_named` |
| 0048 | it3 | set quantity | `dom-click t933` "+", `add`, `act a2.quantity` | succeeded; `t932 "2" was "1"` |
| 0050 | it4 | amend | `keep 11 act a2.quantity` | `S/0051` refused `act_already_named` |
| 0052 | it5 | amend | `add 11 act a2.quantity` | `S/0053` refused, repeated |
| 0054 | it6 | add towels | `dom-click t1072` "Add to cart", `add`, `act a2` | succeeded ("the page ignored the first press, so it was pressed once more"); drawer "✓ Added to cart … 12 Double Rolls … Qty 2 · Pickup". **Cart +2 towels.** |
| 0056 | it7 | search napkins | `dom-type t861` | **refused** `target_covered` (drawer t1109; closeWith t1113, t1117). Enough. |
| 0058 | it8 | close drawer | `dom-click t1117` "Continue shopping" | succeeded |
| 0060 | it9 | search napkins | `dom-type t861` "ValueRidge Everyday Dinner Napkins", submit, `add` | succeeded; a robot check "cleared by itself after 9205 ms, untouched"; 🛒 3 $36.91 |
| 0062 | it10 | open napkins | `dom-click t1265` (link "…, 250 Count (3-Pack)") | succeeded → the 3-Pack page, where pickup is not available |
| 0064 | it11 | look for single pack | `dom-type t1430` "ValueRidge Everyday Dinner Napkins 250 Count", submit | succeeded |
| 0066 | it12 | amend | `add 16 act a3.size`; `add 17 act a3` | `S/0067` applied. By `DD1` it15, a3 is named on step 17, a dom-type **Search**, and a3.size on step 18, also a Search (C4). |
| 0068 | it13 | search again | `dom-type t1620` same text | succeeded, `pageChanged false` |
| 0070 | it14 | amend | `add 18 act a3.size`; `add 19 act a3` | `S/0071` partly_applied: 19 `no_such_step` |
| 0072 | it15 | amend | `drop 18`; `rerun 17 {text …250 Count, target t1620}`; `add 17 act a3` | `S/0073` "applied" (`draft_rerun`, d18). The rerun was then refused: `S/0074` `repeat_refused` `changed_nothing`, same as call `searchnapkins4`. |
| 0075 | it16 | open 3-Pack | `dom-click t1679` | succeeded |
| 0077 | it17 | look | `web.find_on_page "250 Count"` | 13 matches; only the 3-Pack is ValueRidge |
| 0079 | it18 | amend | `rerun 18 {text …, t1430}`; `drop 18`; `add 19 act a3.size to 18`; `add 19 act a3 to 19`; `bind 11 {target: t933}` | `S/0080` partly_applied (rerun d19; 11 `bind_new_key` target). Core reran from its place: `S/0081` reset, `0082` 3-Pack link, `0083` dom-type t1430. |
| 0084 | it19 | amend | `keep 18 act a3.size` | `S/0085` refused `act_already_named` |
| 0086 | it20 | amend | `keep 18 act a3` | `S/0087` ignored `draft_amendment_undone` |
| 0088 | it21 | amend | `keep 18 act a3` | `S/0089` refused `act_already_named` |
| 0090 | it22 | amend | same | `S/0091` refused, repeated |
| 0092 | it23 | look | `find_on_page "250 Count"` | 20 matches; 3-Pack, Loftwell and Softerra only |
| 0094 | it24 | look | `find_on_page "Options"` | 2 matches: t1721 li "…Dinner Napkins, 100 Count", t1739 link "Options" (not followed) |
| 0096 | it25 | amend | `keep 18 act a3` | `S/0097` refused, repeated |
| 0098 | it26 | look | `find_on_page "Add to cart"` | 0 matches (on the search page) |
| 0100 | it27 | look | `find_on_page "ValueRidge Everyday Dinner Napkins"` | 15 matches, the 100 Count among them |
| 0102 | it28 | amend: "only sold as a 3-Pack, so I'll add that product" | `rerun 18 {target: t1679} act a3` | `S/0103` applied (`draft_rerun` d20); `S/0104` ran the link → 3-Pack page. By `DD1` it29, **a3 and a3.size sit on the 3-Pack link press** (C4). |
| 0105 | it29 | write add | `core.run_node {node dom-click, parameters {target t1589, consequences []}, write true}`, `act a3`. `consequences` is misplaced inside `parameters`. | `S/0106` `written` (not run). By `DD1` it30, a3 moved to the written step 27. |
| 0107 | it30 | amend | `add 27 act a3` | `S/0108` refused `act_already_named` |
| 0109 | it31 | amend | `keep 27 act a3` | `S/0110` refused, repeated |
| 0111 | it32 | complete: "… adds two 12 Double Rolls … and one 250 Count … for pickup …" | complete | completion check `ok` (`DD1` `check`). Test `S/0112`-`0128`; judges 0129/0130 no, no. |

**Round 2, repair after `judged_wrong`** (9 decisions, $0.013140). It was shown judge 0129's observed and advice:
"Napkins added are the 250 Count (3-Pack) … only Shipping … change [steps 16, 18] to select the 250 Count
single-pack … that offers pickup".

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0132 | r2 it1: 3-Pack page, drawer "Qty 1 · Shipping" open; 🛒 5 $69.85 (before reload) | look | `find_on_page "ValueRidge Everyday Dinner Napkins"` | 15 matches, among them the cart line "1 × … (3-Pack) · Shipping" (not rendered) |
| 0134 | it2 | search | `dom-type t1430` "…250 Count" | **refused** `target_covered` (t1950; closeWith t1954, t1958). Enough. |
| 0136 | it3 | close drawer | `dom-click {target t1954, consequences []}` "×" | succeeded |
| 0138 | it4 | search | `dom-type t1430` "…250 Count" | succeeded; 🛒 6 $94.84 |
| 0140 | it5 | open 100 Count | `dom-click t1722` | succeeded → `/ip/valueridge-everyday-dinner-napkins/418831402` |
| 0142 | it6 | choose 250 Count | `dom-click t2062` "250 Count", `add`, `act a3.size` | succeeded → `?variant=5530102`; Pickup available |
| 0144 | it7 | write add | `dom-click {target t2380, consequences []}`, `write true`, `act a3` | `S/0145` written (not run) |
| 0146 | it8 | amend | `add 24 act a3` | `S/0147` refused `act_already_named` |
| 0148 | it9 | complete | complete | test `S/0149`-`0170`; judges 0171/0172 no, no |

Round 2 did not drop the 3-Pack path: steps 12-16, of which 16 is the 3-Pack's written Add to cart. Step 16 lost act
a3 when a3 moved to 24 and stayed in the Flow without an act (`DD2` last `core.flow_draft`).

**Round 3, repair after `judged_wrong`** (4 decisions, $0.007380). It was shown judge 0171: "Remove or replace steps
12–16 …".

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 0174 | r3 it1: napkins 250 Count page; 🛒 9 $152.77 | amend | `drop 12`, `drop 13`, `drop 14`, `drop 15`, `drop 16` | `S/0175` applied 5 (d16, d17, d18, d27, d28) |
| 0176 | it2 | look | `dom-capture_snapshot` | unchanged (`core.request_check.2`) |
| 0178 | it3 | amend | the same five drops | `S/0179` refused `already_out` ×5 |
| 0180 | it4: `core.budget.4` "Only a few decisions are left, so new tools are no longer offered" (`tools: []`) | complete | complete | test `S/0181`-`0197`; judges 0198 no, 0199 yes |

- **Repeats, and what the loop believed was progress:**
  - Round 0, 0021-0031: six amend decisions, $0.0068, spent trying to bind a press's `target` to an input and
    re-sending `keep 9` / `drop 10`. The model's summaries said it was "Adding the paper towel quantity and the dinner
    napkin product to the Flow". It believed amendments could add steps it had never run. Nothing in them did.
  - Round 1, 0084-0097: six decisions trying to name a3 or a3.size on step 18 again, while the checklist already
    showed both done. The model was looking for a pickup single pack it never found in round 1. The "Options" link on
    the 100 Count (0094) was the way, and it was not followed.
  - Round 3, 0178: re-sent the five drops that 0174 had already applied.
  - The loop counted round 1 as progress (`finished_and_judged`, because round 0 was not judged). It did not count
    round 2 or round 3.
- **Rejections and refusals received, and whether each said enough to route around.** The answer texts below are the
  ones the next decision was shown (`DD0`-`DD3` `core.amendment_check.*`, `core.repeat_check.15`).
  - `bind_new_key` (0022, 0024, 0028; 0080). The answer: "bind lifts a value the step already has into a binding; it
    never adds one. parameter names a key the step has no value at: name a parameter it already has, as the draft
    shows it, or rerun the step with the new parameter first." **Not enough, and misleading.** The draft the model was
    shown lists step 9 with `parameters: {target: {handle: t667}}` (`S/0023` request l.1127). The bind check compares
    against `step.ranWith ?? step.input` (`git show HEAD:R/flow-draft/amendment.ts` l.464), which is the resolved
    `selector`/`element`, so `target` is "a key the step has no value at". The model was told to name a parameter "as
    the draft shows it", and that is exactly what it had done. Neither the answer nor the overlay ("That step has no
    such value to make vary") says that a press has no value to vary.
  - `over_not_before` (0024). The answer: "repeat goes on the act that is done to each row … over names that listing,
    and it must come before the act …". It was accurate. The model had sent `repeat 9 over 9` meaning "quantity two",
    a misuse that no answer could route.
  - `already_in_flow` (0026, 0030): "That step is already in the Flow (inResult: true) … do not keep it again. Run
    what the Flow still lacks, or complete."
  - `already_out` (0026, 0028, 0030, 0032, 0179): "That step is already out of the Flow (inResult: false), so
    dropping it again changes nothing. Leave it, or keep it to put it back."
  - Both are accurate, but neither carries a `next` naming the acts still to do, as `act_already_named` does. From 13
    on, "Every refusal marked repeated … stop sending it" was shown. The model kept sending them.
  - `act_already_named` (0022, 0032, 0047, 0051, 0053, 0085, 0089, 0091, 0097, 0108, 0110, 0147). The answer: "That
    step already names that act … If the acts checklist shows the act done, nothing is left to do for it …" plus
    `next`, for example "The acts checklist shows a3 done, so nothing is left to do for it: do not name it again.
    Nothing on the checklist is still to do: complete when the Flow does what the person asked." This is enough
    about the refusal. The model's real gap, a pickup-eligible 250 Count, was not something the refusal could answer.
  - `no_such_step` (0071): "There is no step at that number. Step numbers are the ones the draft entry shows …" with
    `positions [1…18]`. Enough.
  - `draft_amendment_undone` (0087): "These amendments put the draft back exactly as it stood at iteration
    sameDraftAsIteration … Decide once whether the step belongs in the Flow and leave it". Enough.
  - `repeat_refused` `changed_nothing` (0074, from the rerun in 0072): "You already made this exact call -- the same
    tool with the same input -- on this exact page, and it did not work then … Do something different instead …"
    Enough: 0075 did something different. However, answer folder `S/0073` records that same decision as `applied`
    with `rerunStepId d18`; only `S/0074` says the rerun did not run.
  - `target_covered` (0006, 0057, 0135): enough each time.
  - The round 0 stop (0032) came after an answer the model never saw, because the round ended.
- **Where the context was evicted or truncated, if anywhere:** no page view was `truncated`. Earlier views were
  replaced by `supersededBy`, as designed. The prompt grew to about 27k input tokens (0109). There were four cache
  collapses (C18), each from a prompt change mid-history:
  - 0005→0007: describedNodes `web.output.dom-click` inserted at user l.152 after 0006's `target_covered`.
  - 0056→0058: `web.output.dom-type` definition inserted at l.202 after 0057.
  - 0176→0178: `core.route_state.15` inserted before the initial page at l.444.
  - 0178→0180: tools withdrawn, `tools: []` at l.261.

  Cache hits lost: 2,304, 6,144, 5,376 and 7,168, about $0.0031 at the run's fitted rates ($0.003/M cached,
  $0.15/M uncached, $0.60/M output; the fit reproduces 0005, 0130 and 0180 exactly).

## Stage 3 — the proposed Flow

The Flow was proposed four times. The node list of each test, with real parameters (from the test `call.json`), is:

**Test 0 (`S/0034`-`0042`, round 0's unfinished draft, 8 steps):**
1. `browser-navigate {url: http://127.0.0.1:58390/scenarios/bigbox-retail/}`
2. `dom-click {selector: "body > div:nth-of-type(3) > div > button:nth-of-type(2)", element: button "Reject all"}`
3. `dom-click {selector: "body > div:nth-of-type(3) > a", a "No thanks"}`
4. `dom-click {selector: "button", button "Pickup or delivery?Carden Falls Supercenter", shadowHosts ["body > div > header > div > vr-fulfillment-picker"]}`
5. `dom-click {selector: "div > ul > li:nth-of-type(3) > button", "Set as my store", listPosition 3/4, record "Millbrook Crossing Supercenter88 Ferris Rd …"}`. Act **a1**.
6. `dom-type {text: "ValueRidge Essentials Select-A-Size Paper Towels", submit: true, selector: input[name="q"]}`
7. `dom-click {selector: "main > div > section > div:nth-of-type(3) > div:nth-of-type(1) > a:nth-of-type(1)", a "…Paper Towels, 6 Double Rolls"}`
8. `dom-click {selector: "main > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(4) > div:nth-of-type(2)", div "12 Double Rolls$16.47"}`. Choice **a2.size**.

**Test 1 (`S/0112`-`0128`, 16 steps):** steps 1-8 as above, then:

9. `dom-click {selector "…div:nth-of-type(5) > div:nth-of-type(2) > span:nth-of-type(3)", span "+"}`. Choice **a2.quantity**.
10. `dom-click {selector: [data-testid="atc"], button "Add to cart"}`. Act **a2**.
11. `dom-click {selector: "body > aside > button", "Continue shopping"}`
12. `dom-type {text: "ValueRidge Everyday Dinner Napkins", submit, input[name="q"]}`
13. `dom-click {selector "…div:nth-of-type(3) > div:nth-of-type(2) > a", a "…Dinner Napkins, 250 Count (3-Pack)"}`
14. `dom-type {text: "ValueRidge Everyday Dinner Napkins 250 Count", submit}`
15. `dom-click {selector "…div:nth-of-type(3) > div:nth-of-type(1) > a", a "…250 Count (3-Pack)"}`. Choice **a3.size**, on a link.
16. `dom-click {[data-testid="atc"], "Add to cart"}` (written, never run in exploration). Act **a3**.

**Test 2 (`S/0149`-`0170`, 21 steps):** test 1's 16 steps, with step 16 now carrying no act, then:

17. `dom-click {selector: "body > aside > div > div", div "×"}` (closes the 3-Pack drawer; interruption, optional)
18. `dom-type {text: "…Napkins 250 Count", submit}`
19. `dom-click {selector: "main > section > ul > li:nth-of-type(1) > a:nth-of-type(1)", a "ValueRidge Everyday Dinner Napkins, 100 Count", listPosition 1/5}`
20. `dom-click {selector "…div:nth-of-type(4) > div:nth-of-type(2)", div "250 Count$6.48"}`. Choice **a3.size**.
21. `dom-click {[data-testid="atc"], "Add to cart"}` (written). Act **a3**.

**Test 3 (`S/0181`-`0197`, 16 steps, the final draft):** steps 1-11 and 17-21 of test 2. Steps 12-16 were dropped by
0174. The final flowShape is the one judge 0198 was sent (`S/0198` request l.118-330): s1 navigate, s2 Reject all,
s3 merge, s4 No thanks, s5 merge, s6 chooser, s7 Set as my store, s8 type, s9 6 Double Rolls link, s10 "12 Double
Rolls$16.47", s11 "+", s12 Add to cart, s13 Continue shopping, s14 merge, s15 "×", s16 merge, s17 type, s18 100 Count
link, s19 "250 Count$6.48", s20 Add to cart. Merges follow only s2, s4, s13 and s15. **s7 is not optional.**
`B/snapshots/flow-lane.json` `flowShape` is `null`.

- Divergences from the stage 1 chain, one line each, naming the node:
  - Final s12 (Add to cart, a2) and s20 (Add to cart, a3): right as nodes. No step chooses Pickup, but Pickup was the
    default on both pages ("Qty 2 · Pickup", "Qty 1 · Pickup"), so this is not wrong here.
  - Final s11 "+" is a single press that relies on the default quantity being 1. It is right on this page, and
    nothing in the test showed the judge that it was (Stage 6).
  - Test 1 steps 13/15/16, the "250 Count (3-Pack)" link plus Add to cart, choose a shipping-only item instead of the
    single 250 Count reached through the 100 Count family.
  - Test 2 steps 12-16 are a second napkin path kept beside the corrected one (17-21). The 3-Pack is still added.
  - Final s15 "×" closes a drawer that only the dropped 3-Pack add opened. It always fails and is always excused.
  - Act a3.size sat on a link press (test 1, step 15), and a3 sat on a search-type step (round 1 it15) and then on
    that link (it29). See C4.
- For each divergence: misread the page / misread the grammar / could not express it:
  - 3-Pack: misread the page. The model's own summaries in 0064, 0068 and 0077 say "pickup not available", and in
    0102 it chose the 3-Pack anyway. The checklist could not have caught it, because "both for pickup" produced no
    choice: `automationStudioInstructedActs` gives a2 only quantity and variant, and a3 only variant (Cause 9).
  - Second napkin path: misread the grammar. Round 2's prompt said "correct or replace the step that does the wrong
    thing", and the model added steps instead of replacing them.
  - The "×" left behind: could not express it. A drop does not take with it the steps that acted on what the dropped
    step opened.
  - Acts on a link or a search: misread the grammar, and Core accepted it.

## Stage 4 — replay

Provider calls during replay: zero. No `decide` folder falls inside any test range. Durations are from `meta.json`
`ms`. Every test began with `replay reset` ("the page was put back", about 1.28 s). The reset does not restore the
site's cart or store. Lasting steps were checked only where `call.json` has `replay: "verify"`; everywhere else it is
`"step"`, a real press.

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| navigate (all four tests) | replayed | home page | 2.24-2.27 s | 0 | — |
| Reject all (all four) | `remembered`, target gone | — | 6.47-6.66 s | 0 | remembered (consent remembered by the site) |
| No thanks (all four) | `remembered` | — | 5.43-5.59 s | 0 | remembered |
| store chooser (all four) | replayed | "Stores near Millbrook" listed | 2.19-2.52 s | 0 | — |
| Set as my store, a1 (all four) | `verify` → `present`, `found: missing` | not pressed | 6.22-6.33 s | 0 | verify-only (a1 lasting) |
| type towels, 6 Double Rolls link, 12 Double Rolls (all four) | replayed | towels page, variant | 1.59-1.85 s each | 0 | — |
| "+", a2.quantity (tests 1-3) | replayed | `t932 "2" was "1"` (`S/0121`, `0158`, `0190`) | 2.09-2.28 s | 0 | — |
| **Add to cart, a2 (tests 1-3)** | **replayed, pressed for real** | "✓ Added to cart … 12 Double Rolls, Qty 2 · Pickup" (`S/0122`, `0159`, `0191`) | 2.94-3.07 s | 0 | none. It should have been verify-only (finding A). |
| Continue shopping (tests 1-3) | replayed | drawer closed | 2.39-2.45 s | 0 | — |
| type napkins / 3-Pack link / type 250 Count / 3-Pack link (tests 1-2) | replayed | 3-Pack page | 1.59-1.71 s each | 0 | — |
| **Add to cart, 3-Pack (test 1 as a3; test 2 with no act)** | **replayed, pressed** | "… 250 Count (3-Pack) Qty 1 · Shipping" (`S/0128`, `0165`) | 2.97 s, 2.89 s | 0 | none |
| "×", 3-Pack drawer (test 2) | replayed | drawer closed (`S/0166`) | 2.36 s | 0 | — |
| "×" (test 3) | **failed** `target_not_found` (`S/0193`, ran on the towels page) | — | 1.30 s | 0 | excused optional (interruption) |
| type 250 Count / 100 Count link / "250 Count$6.48" (tests 2-3) | replayed | single 250 Count page | 1.53-1.63 s each | 0 | — |
| **Add to cart, a3 (tests 2-3)** | **replayed, pressed** | "… 250 Count, Qty 1 · Pickup" (`S/0170`, `0197`) | 2.95 s, 2.92 s | 0 | none |

- Any node that reported success while doing nothing: none. The reverse happened instead: three Add to cart nodes did
  something lasting in every test that should only have checked them.
- Provider calls during replay (expected: zero): zero.

## Stage 5 — the answer

There are no records. The answer is the person's cart. The table below follows the header mini cart (`🛒 N $X`)
across the run. The site updates the header only when a page loads, so a press is seen at the next load.

| After step | 🛒 shown | Change | Attributed to | Item |
| --- | --- | --- | --- | --- |
| 0002 (start) | 1 $3.97 | — | already in cart | ValueRidge Ultra Dish Soap, 24 fl oz ($3.97 on the home page, `S/0002` l.78-81). Kept: the count never fell. |
| 0012 | 1 $3.97 | store → Millbrook Crossing | exploration press 0011 (t354) | — |
| 0055 → seen 0061 | 3 $36.91 | +2 × $16.47 | **exploration press** 0054 (Add to cart t1072) | Towels 12 Double Rolls, Qty 2 · Pickup |
| 0122 → seen 0131 | 5 $69.85 | +2 × $16.47 | **test 1 replay** of Add to cart, a2 | Towels 12 DR, Qty 2 · Pickup |
| 0128 → seen 0139 | 6 $94.84 | +1 × $24.99 | **test 1 replay** of the written 3-Pack Add to cart, a3 | Napkins 250 Count (3-Pack), Qty 1 · **Shipping** |
| 0145 | — | none | written, never run | — |
| 0159 | (8 $127.78, not seen alone) | +2 × $16.47 | **test 2 replay**, a2 | Towels 12 DR, Qty 2 · Pickup |
| 0165 → seen 0173 | 9 $152.77 | +1 × $24.99 | **test 2 replay**, 3-Pack (no act) | Napkins 3-Pack, **Shipping** |
| 0170 → seen 0183 | 10 $159.25 | +1 × $6.48 | **test 2 replay**, a3 | Napkins 250 Count, Qty 1 · Pickup |
| 0191 → seen 0198 endView | 12 $192.19 | +2 × $16.47 | **test 3 replay**, a2 | Towels 12 DR, Qty 2 · Pickup |
| 0197 | (13 $198.67, inferred) | +1 × $6.48 | **test 3 replay**, a3 | Napkins 250 Count, Qty 1 · Pickup |

- Records expected vs returned: expected Millbrook; the soap kept; 2 × towels 12 Double Rolls, pickup; 1 × napkins
  250 Count, pickup; "4 items $43.39". Returned, inferred: Millbrook; the soap kept; **8** × towels 12 DR, pickup;
  **2** × napkins 250 Count (3-Pack), **shipping**; **2** × napkins 250 Count, pickup; **13 items $198.67**. The
  arithmetic is 3.97 + 8 × 16.47 + 2 × 24.99 + 2 × 6.48 = 198.67.
- Fields compared, matched, mismatched:
  - store: matched;
  - soap kept: matched (inferred from the count);
  - towel variant and fulfilment: matched;
  - towel count: mismatched, 8 against 2;
  - napkin variant: mismatched, 2 three-packs extra;
  - napkin count: mismatched, 2 against 1;
  - total: mismatched.
- Every mismatch, observed value beside expected:
  - towels 8 against 2: one exploration press plus three test presses;
  - 3-Pack 2 against 0: test 1 and test 2 presses of a step the model had written;
  - napkins 250 Count 2 against 1: test 2 and test 3;
  - total $198.67 against $43.39.
- If the comparison was count-only, say so: the Lab compared nothing, because no Flow was created and
  `oracleVerdict` is `null`. The figures above come from page views. **NO EVIDENCE:** the final cart, after 0197, was
  never viewed. It needed a cart-page read, or a header read after a reload, at the end of the build.

## Stage 6 — judgement and repair

- **Did the system judge its own result, and what did it conclude.** Round 0's test was not judged, because the round
  stopped unfinished. There were three judged tests, each asked twice (`R/result-verification/agreement.ts` at HEAD):

| Pair | Verdicts | What it saw | Why |
| --- | --- | --- | --- |
| 0129 / 0130 (test 1) | no (0.7) / no (0.6), refuted | endView: the 3-Pack page with the drawer "Qty 1 · Shipping", Pickup "Not available"; flowShape with 16 steps | Correct: the napkins are a 3-Pack and ship. 0130 also said "the cart shows 5 items $69.85, which is consistent with keeping it". That count was already inflated by the test's own towel press. |
| 0171 / 0172 (test 2) | no (0.6) / no (0.6), refuted | endView: the single 250 Count page, "Qty 1 · Pickup", 🛒 9 $152.77 | Correct: the 3-Pack path (steps 12-16) is still in the Flow. 0171 used "9 items / $152.77" as its evidence that "the extra 3-Pack remains", reading a cart that three tests had inflated. |
| 0198 / 0199 (test 3) | **no (0.6) / yes (0.9)**, `model_disagreed` → `unknown` | the same request: 0199 hit the cache for 7,552 of 7,771 tokens. buildTest step 9 "+" is shown with `outcome: replayed` and **no `observed`**. Step 10 Add to cart is the same. The endView, after step 21, is the napkin page and drawer only, with 🛒 12 $192.19. | 0198: "step 9 clicked '+' once, which raises the quantity from the default 1 to 2 only if the default was 1, and the test gives no observation of the resulting quantity" → no. 0199 took "+ once (quantity 2)" on trust → yes. The domain had observed both facts: `S/0190` `changed ["t932 \"2\" was \"1\""]` and `S/0191` `"t1115 \"Qty 2 · Pickup\" appeared"`. Core's summary sent neither (finding B). |

- **If the answer was wrong, did a repair trigger automatically.** Yes, three times:
  - Round 1 opened because round 0 stopped unfinished.
  - Round 2 opened on judged_wrong.
  - Round 3 opened on judged_wrong. Round 2 had made no measured progress over round 1, so the second round was
    bought by the rule "one more round after a judge who said no, still achievable or unsure, and named the fix"
    (`R/flow-bootstrap/unfinished-build/phases.ts` l.507).
  - After round 3 the build ended `not_finished`. Round 3 against round 2 was again no progress, and two in a row end
    the build (finding C).
  - No repair ever saw that the cart was polluted. The judges never named the duplicates.
- **What context did the repair receive.**
  - Present: the Flow with its steps, acts, `does` and inResult (`core.flow_draft`); the judge's
    expected/observed/advice (`core.resumed.judgement.judge`); the page where the test left it; the decision history
    (`core.evidence_history`); the budget.
  - Partly present: the failure record. `findings: []` in both judgements, so the codes the progress measure
    compares were empty.
  - Absent: each test step's own outcome and observation. Nor were the repairs told that the test had pressed Add to
    cart again, so they did not know the cart had grown.
- **Was the repair persisted, and did the re-run use it.**
  - Within the build, yes: each round's amendments were in the next test. Round 3's drops are visible in test 3.
  - Across builds: the draft was kept as an incomplete draft (`flow-lane.json` `incompleteDraft {revision 1,
    steps 16}`, "building again carries on from it"). No Flow was created and nothing was re-run.

**Lead findings, checked.**

- **(A) CONFIRMED, with a correction to the mechanism.**
  - The run used `instructedLastingActs` at HEAD (`git show HEAD:R/flow-bootstrap/action-permissions.ts` l.249-256,
    the same code as the 17:45Z `dist`). It keeps an act only if its folded quote contains, or is contained in, a
    quote from the instruction read.
  - Read 0033 returned two quotes. The second is the whole joined clause: "add two packs … in the 12 Double Rolls
    size and one pack … in the 250 Count size to my cart".
  - The checklist's split acts (`S/0003` request l.446-482) are a2 "add two packs … in the 12 Double Rolls size **to
    my cart, both for pickup**" and a3 "**add one pack** … in the 250 Count size to my cart, both for pickup".
  - Neither of the two quotes contains the other. This is not only because of the ", both for pickup" tail: the split
    re-attaches "to my cart" after each object (a2), and gives each its own verb (a3's "add one pack" against the
    read's "and one pack"). So even without the tail, neither would match. a1 matched ("Switch my pickup store …"),
    so the store alone was checked.
  - Running `automationStudioInstructedActs` from `dist` on this instruction gives a2 and a3 `kind: "add_to"`. HEAD
    ignores the kind. The uncommitted working tree adds `LASTING_KINDS` (add_to, save, claim, move, submit), but that
    was not in the run.
  - Effect: `call.json` of `S/0122`, `0128`, `0159`, `0165`, `0170`, `0191` and `0197` has `replay: "step"`. Each of
    those steps pressed for real (Stage 5).
- **(B) CONFIRMED.**
  - `S/0190` `result.json` has `changed: ["t932 \"2\" was \"1\""]`.
  - At HEAD, `R/result-verification/build-test/summary.ts` l.200 sets
    `observing = observe && input.report && (step.effect !== "mutate" || checked)`. A replayed changing step that was
    not checked therefore gets no `observed` (l.203, l.217).
  - In `S/0198` request l.418-425, step 9 has `claims [a2.quantity]`, `outcome: replayed` and no `observed`.
  - Judge 0198 said: "the '+' press is the only quantity step and its result is unverified".
  - The same rule also hid step 10's "Qty 2 · Pickup" (`S/0191`), which would have settled the question on its own.
- **(C) CONFIRMED, with one correction: the split was round 3's (0198/0199), not round 2's.** Round 2's pair,
  0171/0172, was no/no.
  - The two judged-no rounds have `findings: []` (`DD2`/`DD3` `core.resumed`), and acts done stayed at 6 and 6.
  - `progress.ts` at HEAD counts `judged_after_unjudged` only when the round before was not `no` (l.51). A
    `no` → `unknown` (model_disagreed) change matches no measure in l.44-64.
  - `not-finished.ts` at HEAD l.92 returns "the judge still could not judge it" whenever the last verdict is not `no`,
    whatever the verdict before. Round 2 had been judged `no`, so "still" is false.
  - Also l.46: "What the judge says is left to change" is said only for a `no`. The person was therefore not told
    the open doubt, the towel quantity.

## Carry-in causes against this run

| Cause | Status here | Evidence |
| --- | --- | --- |
| C4, an act named on a link press | **recurred** | Round 1 it15 (`DD1`): a3 on step 17, a dom-type "Search", and a3.size on step 18, also a "Search", after 0066/0067 `applied`. At it29: a3 and a3.size both on step 18, the "250 Count (3-Pack)" link press (0102/0103). The model moved a3 to the written Add to cart in 0105. a3.size stayed on the link through test 1. |
| R2-C8, G checks a last-step link carrying an act instead of following it | **not seen** | No step other than the store was in verify mode (finding A). The last step of every test was Add to cart, replayed. |
| R2-C9, a step acting on what a checked act opened | **not seen (masked by A)** | Add to cart was never checked, so step 11 "Continue shopping" (s13) always had its drawer. A related failure did occur: test 3's "×" (s15) acted on a drawer only a dropped step opened. It failed `target_not_found` and was excused optional (`S/0193`). Once A is fixed, s13 is interruption-marked (merge s14) and would be excused the same way. Unverified. |
| C13, a refused decision shows a header and no card | **recurred** | `S/0074` appears as the header "Didn't run the step again — It already ran exactly this way and changed nothing, so this was not done: adding the napkin product page step for act a3 …" with no card (`UI/08-mid-build-panel.png`). Every refused amendment shows "Didn't change the Flow — …" with no card (`UI/04`, `05`, `09`, `10`, `14`). |
| C14, the chat repeats the model's claims as fact | **recurred** | "Updating the draft Flow — Adding the paper towel quantity and the dinner napkin product to the Flow, then finishing the cart build." (`UI/04`, decision 0021, which added nothing). "Checking the Flow is finished — The napkin act a3 is already done by step 27" (`UI/10`), where step 27 was written and never run. Every refusal line ends "so this was not done: <the model's summary>". |
| C16, instruction left in the composer, overlay over the product image, price glued to its label | **recurred, all three** | The instruction is still in the composer while "Sending your message" (`UI/02-mid-build-panel.png`); it is cleared by `03`. The overlay covers the product image (`UI/04-mid-build-scenario.png`; overlay rect y 318.5-327 on product pages at moments 4, 6, 11, 13, 16, 18). Glued labels: "12 Double Rolls$16.47", "250 Count$6.48", "Pickup or delivery?Carden Falls Supercenter" (`UI/03`, `16`, `19` panels; overlay moments 11, 13, 16). |
| C17, "Set as my store" marked `interruption` | **recurred, without harm in this run** | `DD0` l.33: `"control":"Set as my store","interruption":true`. The final flowShape (`S/0198` request) has no merge after s7, so s7 is required, not optional. |
| C18, mid-build cache collapses | **recurred** | Four collapses, about $0.0031 (Stage 2, last bullet). |

## UI review (screenshots)

The protocol asks for a ChatGPT-like stream, an overlay visible whenever FluxIQ works, and stable, polished status
text. The `.json` gives 20 moments, each with `takenAt`, `windowMs` and `overlaySamples`. `pageLoads` total 3
(moments 1, 3, 8), and `pageLoadGaps` are all 0.

| # | Defect | Screenshot |
| --- | --- | --- |
| D1 | The instruction stays in the composer while the chat says "Sending your message" (C16). | `02-mid-build-panel.png` |
| D2 | Refused amendments appear as a bold header plus engine prose with no card: "Didn't change the Flow — That step is already in the Flow; and that step is already out of the Flow, so this was not done: …" (C13). | `04`, `05`, `09`, `10`, `14` `-mid-build-panel.png` |
| D3 | The refused repeat 0074 appears as a header with no card ("Didn't run the step again"). It quotes the previous amend decision's summary as the thing not done (C13). | `08-mid-build-panel.png` |
| D4 | Amendment headers state the model's plan as done (C14): "Updating the draft Flow — Adding the quantity step (two packs) and the add-to-cart press …" (`06`); "Checking the Flow is finished — … its Add to cart step is written …" (`14`). | `04`, `06`, `10`, `14` panels |
| D5 | The overlay sits over the product image on every product page (C16). | `04-mid-build-scenario.png`; overlay rects at moments 4, 6, 11, 13, 16, 18 |
| D6 | The overlay status shows truncated refusal prose: "That step has no such value to make vary; and a repeat goes on what is done to each item, after the list it repeats over, so this was not done: adding the pape…" (moment 4); "It already ran exactly this way and changed nothing, so this was not done: …" (moment 8). The status text is neither stable nor polished. | `04-mid-build-scenario.png`; `.json` moments 4 and 8 |
| D7 | Labels are glued to prices: "12 Double Rolls$16.47", "250 Count$6.48", "Pickup or delivery?Carden Falls Supercenter" (C16). | `03`, `16`, `19` panels |
| D8 | Test cards are truncated before the words that tell them apart. "Testing: Type · "ValueRidge Everyday D…" and "Testing: Click · ValueRidge Everyday Di…" appear twice each and look identical, although one is the 3-Pack and one the single pack. | `12-mid-build-panel.png`, `16-mid-build-panel.png` |
| D9 | The test presses Add to cart on the person's real cart, showing "Testing: Click · Add to cart · Done", with no word that the cart grew. The site's drawer reads "Qty 1 · Shipping". The person's cart went from 1 to 13 items in silence. | `12-mid-build-panel.png`, `12-mid-build-scenario.png`, `20-failure-scenario.png` |
| D10 | The judge-split card ends "… and the run is not marked as failed for it." It sits directly above an ending that says the build was not finished, which contradicts it. The ending also does not name the doubt (the towel quantity). | `20-failure-panel.png` |
| D11 | The ending says "the judge still could not judge it", although the round before was judged no (finding C). | `20-failure-panel.png` |
| D12 | "Repairing the Flow — Repairing the Flow live: 4 of the things you asked are still to do." The words are doubled, and it calls the continuation of an unfinished exploration a repair. | `06-mid-build-panel.png` |
| D13 | The overlay lags the page: "Store chooser is open; I'll press "Set as my store" for Mi…" while the page already shows Millbrook set and the chooser closed. | `03-mid-build-scenario.png` |
| D14 | The overlay was absent for 7 of 16 samples at the first build moment ("Opening where the Flow starts"). | `.json` moment 2 (`presentSamples 9/16`); `02-mid-build-scenario.png` |

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | **Finding A.** `instructedLastingActs` keeps an act only when its folded quote is a substring of a read quote, or contains one. The checklist's split acts (a2 "…12 Double Rolls size to my cart, both for pickup", a3 "add one pack …") never match the read's joined `create_new` quote. Only a1 was lasting, so the a2/a3 Add to cart steps were pressed in tests 1-3 (`S/0122`, `0128`, `0159`, `0165`, `0170`, `0191`, `0197`) and the cart went to 13 items, $198.67. | Core `R/flow-bootstrap/action-permissions.ts` l.249-256 (HEAD) | Treat an act as lasting by its parsed `kind` (`add_to`, `save`, `claim`, `move`, `submit`), as the uncommitted working tree does. When matching by quote, match each split act's object words, not substrings. Add a test with this instruction: a2 and a3 must be lasting. | t193 (in flight in Core's working tree) |
| 2 | The judges read a cart count inflated by earlier tests (0130 "5 items … consistent with keeping it"; 0171 "9 items / $152.77"). A test reset restores the page, not the site's cart, and nothing tells the judge which counts its own tests produced. | Core `R/result-verification/build-test/summary.ts` (endView with no note) | Mainly removed by cause 1. In addition, when a lasting-kind step was replayed rather than checked, say so in buildTest ("pressed again in this test"), so a judge does not read the count as the person's. | — |
| 3 | **Finding B.** A replayed changing step that was not checked gets no `observed`, so the domain's `changed` lines ("t932 "2" was "1"" at `S/0190`; "Qty 2 · Pickup" at `S/0191`) never reached judge 0198. The pair split no/yes. | Core `R/result-verification/build-test/summary.ts` l.200-217 (HEAD) | For every replayed step that claims an act or choice, send its screened `changed` lines as `observed`. | t193 (in flight) |
| 4 | **Finding C.** No progress measure covers `no` → `unknown`(model_disagreed), so round 3 counted as standing still and ended the build. The ending says "the judge still could not judge it" after a `no`, and gives "what is left" only for a `no`. | Core `R/flow-bootstrap/unfinished-build/progress.ts` l.44-64, `not-finished.ts` l.46 and l.91-92 (HEAD) | Add the measure (`judge_no_longer_refutes`, in flight). Word the split as "one check said it does, one said it does not: <the no's observed>". Give the doubting judge's reading as what is left. | t193 (in flight) |
| 5 | `bind` on a press's `target` is refused `bind_new_key`, because the check compares against `ranWith` (selector/element) while the draft shows the model `parameters.target`. The answer tells it to "name a parameter it already has, as the draft shows it", which it had. Round 0 spent 0021-0031 ($0.0068) and ended `unusable_decisions`. | Core `R/flow-draft/amendment.ts` l.464 and l.512-523; `R/llm/draft-amendment-feedback.ts` l.91; `R/activity/wording/draft-edit-refused.ts` l.24 | Use a distinct refusal for a press target: "a press has no value to vary; its control is found by its words. Bind only a value a step typed or chose. Leave this step as it is and go on with <todo acts>". | — |
| 6 | The `already_in_flow`, `already_out` and `bind_*` answers carry no `next` listing the acts still to do, unlike `act_already_named`. The model re-sent keep/drop three times and stalled round 0. | Core `R/llm/draft-amendment-feedback.ts` (refusal `next`) | Give every all-refused amend answer the same `next` ("Still not done on the checklist: a2, a2.quantity, a3, a3.size. Go on with those."). | — |
| 7 | C4: Core accepted act a3 on a dom-type search (round 1 it15) and act a3 plus a3.size on a link press (it29). The checklist showed a3 "done" on a navigation, and the model's `act_already_named` refusals followed from it. | Core `R/flow-draft/act-claim.ts`, `R/flow-draft/amendment.ts` (act on add/keep/rerun) | Refuse an `add_to` act, or its choice, on a step whose `does` is a navigation (a link press, or a search submit) with an answer naming the press that adds. | — |
| 8 | When act a3 moved from the 3-Pack's written Add to cart (step 16 in test 2) to the new one (step 21), the old press stayed in the Flow with no act and was pressed in test 2 (`S/0165`). | Core `R/flow-draft/act-claim.ts` (moving an act) | When an act moves off a lasting-kind press, tell the model the press now does no act and ask it to drop or keep it. Better still, drop it unless it is kept. | — |
| 9 | "both for pickup" produced no choice, so the checklist never asked for a pickup step. The shipping-only 3-Pack satisfied a3.size, and the model completed on it. | Core `R/flow-bootstrap/instructed-acts/instruction-acts.ts` (choices parsed: quantity, variant) | Parse "for pickup / delivery / shipping" (and "both for …" distributed over the objects) as a `fulfillment` choice on each `add_to` act. | — |
| 10 | Dropping steps 12-16 left step 17 "×" (closing the 3-Pack drawer) in the Flow. It now always fails and is excused. | Core `R/flow-draft/amendment.ts` (drop) | When a drop removes the step that opened a layer, offer to drop the steps that act inside that layer. | — |
| 11 | C17: the domain marks the store choice "Set as my store" `interruption: true` (`DD0` l.33). It was harmless here: s7 is not optional in the flowShape. | downstream `domain/src/runtime/llm-evidence/node-run/press-effect/answered-layer.ts` | Never mark a press that changes a stored setting (a store, a filter) as answering a layer. | open (run 1's C10) |
| 12 | C18: describedNodes definitions are inserted mid-prompt after a refused call (0007, 0058), a route_state entry is inserted before the initial page (0178), and the tools are withdrawn (`tools: []`, 0180). Cache hits lost cost about $0.0031. | Core `R/llm/` prompt assembly | Append node definitions and route state after the history. Keep the tools list stable, and refuse at call time. | open |
| 13 | `consequences` was misplaced inside `parameters` (0105, 0136, 0142, 0144) and accepted silently. The written Add to cart steps carry no top-level declaration (`declaredConsequences: null` in `flow-lane.json`). **PLAUSIBLE**: not traced to the gate. | Core `R/llm/node-tools/` (core.run_node input check) | Refuse, or lift, a `consequences` key found under `parameters`, and tell the model. | — |
| 14 | UI: C13/C14 headers without cards that repeat the model's claims; status text carrying refusal prose (D2-D4, D6). | downstream `apps/extension/…/panel/chat/stream/step/messages.ts`; Core `R/activity/wording/` (`draft-edit-refused.ts`, decision headers) | Show refusals as a card that names the decision kind and the plain reason. Never append the model's summary as the thing "not done". Keep the overlay to the phase plus the current action. | open |
| 15 | UI: overlay over the product image, the instruction left in the composer while sending, glued labels (D1, D5, D7). | downstream overlay `status-pill.ts`, panel composer; the label text from the domain's `does` | Anchor the overlay to a corner clear of `main` media. Clear the composer on send. Join a control's text runs with a space. | open (C16) |
| 16 | UI: test cards truncated before their distinguishing words, and real cart presses shown as plain "Done" (D8, D9). | downstream `panel/chat/stream/step/card-words.ts` | Truncate from the middle, so the item stays visible. Mark a replayed lasting act "added to your cart again". After cause 1 this should not occur. | — |
| 17 | UI: the split card says "the run is not marked as failed" above a failed ending (D10). | Core `R/activity/` (result-check wording) | Inside a build, say "the judges disagreed; the build cannot finish on that". | — |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 6 | The structured ending: `kind not_finished`, `notDone`, and `tried.stops` for each round (unusable_decisions, judged_wrong, judged_wrong, then the model_disagreed `unknown`). Only the message is recorded, and it is whole, in `I/events.ndjson` seq 29, `B/summary.json` `firstFailure` and `B/snapshots/flow-lane.json` `failure.message`. Per-round stops came only from the decision dumps' `core.resumed`. Round 3's final verdict (`unknown`, model_disagreed) appears nowhere except the chat card. | downstream Lab flow-lane writer (`build.failure` keeps `code`/`issueCodes`, not the ending object) |
| 3 | The kept draft's Flow: `flow-lane.json` `flowShape: null` and `incompleteDraft {revision 1, steps 16}`. The final node list was read from judge 0198's request. | downstream Lab flow-lane writer |
| 5 | The person's final cart after the last test press (`S/0197`). There was no page view afterwards; the endView header predates the press. | Lab (no end-of-build cart read) |
| 2 | Answer folder `S/0073` says `applied` (`draft_rerun`) for decision 0072, whose rerun was refused as `S/0074`. The two must be read together. | Core step log (`NNNN-answer-*` folder for a held rerun) |

Checked and present (t255/t257/t259):
- the judge booked apart: `live-llm.json` `runSpend.phases.judge` 6 calls $0.004238112, `read` 1 call
  $0.000192108, `build` 60 calls $0.087412194;
- an answer folder for every amendment: 24 amend decisions, 24 `answer-amend_draft` folders, plus `0074` for the
  refused repeat;
- UI-review `pageLoads` and `pageLoadGaps` per moment, and `takenAt`, `windowMs` and `overlaySamples` on every
  picture;
- `instructedConsequences` filled (`instructedConsequencesFrom: step_log`).
