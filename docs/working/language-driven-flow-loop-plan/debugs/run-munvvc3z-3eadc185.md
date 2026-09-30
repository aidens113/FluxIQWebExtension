# Run debug — `run-munvvc3z-3eadc185` (live run 28)

Worker t174-w22, 2026-09-30. Read from the bundle at
`test-runs/instances/t174-slot-1/run-munvvc3z-3eadc185`, its UI review
(`test-runs/instances/t174-slot-1/run-munvvc3z-3eadc185.ui-review.local.json` and the PNG folder
`run-munvvc3z-3eadc185.ui-review.local/`), the bundle's whole-window JPGs (`screenshots/`), and the
launcher's full Lab stdout (`live-run-28.full.log`, in the supervisor's scratchpad, not in the
repository). The scenario source under `apps/scenario-lab/src/scenarios/bigbox-retail/`, the domain's
node-run and replay code under `domain/src/runtime/llm-evidence/node-run/`, and Core's
`runtime/flow-bootstrap/instructed-acts/`, `runtime/flow-draft/step.ts`,
`runtime/result-verification/verdict.ts` and `runtime/llm/harness/request-evidence-check.ts` were read,
not changed. No product code changed. Core's act reader was run once, read-only, on the task's own
instruction (Stage 3). Privacy: only codes, counts, ids, node ids, durations, timestamps and FluxIQ's
own UI strings. Stores, products, options and controls are named by kind or position; no instruction
text, page text, accessible names, product names, URL slugs, prices or provider bodies.

Names used below: **P1** is the first instructed product (item id `418830127`, three sizes), **P2** the
second (item id `418831402`, three sizes). The instruction asks for P1 in its second size, quantity two,
and P2 in its second size, quantity one, both for pickup, after switching to the store at list position
3 of 4 (store id `1187`).

---

## Header

- Run id: `run-munvvc3z-3eadc185`
- Scenario / variant / task: `bigbox-retail` / none / `bigbox-retail-pickup-cart` (`form`, judged by
  playback goal `build-pickup-cart`). The instruction is 330 characters, sha256 `8da0b9f6…3d43d3`
  (`snapshots/flow-lane.json` `task`), the same instruction as runs 16, 18 and 20.
- Repositories (`run.json`): facility `76e5e76` (dirty), Core `e75dcf2` (**dirty**; clean in run 20),
  both the t174 tree. Chromium 134.0.6998.35, 1280×720, seed 239. Ports: scenario 63961, web 63962,
  gateway 63963. Every prelude build step (7) was `reused` from its stamp; prelude 10,128 ms (full log).
- Lab span 09:08:52.375Z to 09:13:03.552Z (`summary.json`), `durationMs: 250712` (`evaluation.json`).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. Authorized: `maxCalls: 64`,
  48k in / 8k out / 56k per call, $0.25 per call, $2 total (`snapshots/live-llm.json`).
- Calls, cost:
  - Build: **33 calls** (32 loop decisions + 1 unrecorded), 530,991 in / 3,524 out tokens,
    **$0.06305**, `budgetBreaches: 0`. The largest call had 17,689 input tokens (decision 22).
  - Result check: 1 request, `llm.loop_verification.d2c4576d…`, **refused before it was sent**
    (`validationCodes: [llm.provider_result_summary_invalid]`, tokens null, $0).
  - Repair: none (`repair.observed.calls: 0`). `evaluation.json` `llm.calls: 33`.
- Verdict: failed, `runtime.behavior`; Flow-reported `unexpected_state` / **`flow_lane.result_refuted`**;
  `oracles.finalState: failed`, `records: not_declared` (`events.ndjson` seq 18).
- **Stage reached: 6.** A Flow was created and ran; **all 15 attempts succeeded**; the playback goal did
  not hold; Core's result check could not be sent and refuted by default; no repair ran
  (`unsettled: "recovery"`).
- Against run 20: 32 decisions (was 31), 33 build calls (32), $0.0630 (0.0634), 15 nodes / 12 action
  nodes (16 / 14). The failure moved from a blocked step (s12, support card) to a Flow that ran every
  step and changed nothing that the goal counts.

## Timeline

| Time (UTC) | Event | Source |
| --- | --- | --- |
| 09:08:52.375 | Lab start | `summary.json` |
| 09:09:17.636 | Dispatch (`runtime.dispatch`) | `events.ndjson` seq 1 |
| 09:09:33.037 | Build loop start; Core's initial call refused `not_at_start_location` (166 ms) | `logs/core.log` |
| 09:09:34.597–09:10:41.031 | Exploration, decisions 1–22 | `logs/core.log` |
| 09:10:42.798 | Completion #1 (decision 23), check ok | `logs/core.log` |
| 09:10:42.840–09:11:10.375 | Dry run 1 (27.5 s) → `llm_evidence_loop.dry_run_refused` | `logs/core.log`, `flow-lane.json` step 23 |
| 09:11:16.827 | Completion #2 (26), refused `bootstrap.instructed_act_missing` at 16.845 | `logs/core.log` |
| 09:11:16.845–09:11:44.340 | Dry run 2 (27.5 s), started **0 ms after** the refusal | `logs/core.log` |
| 09:11:54.632 | Completion #3 (32), check ok at 54.643, **accepted with no dry run** | `logs/core.log` |
| 09:11:59.891 | Build settle | `events.ndjson` seq 12 |
| 09:12:11.456 | Runtime run `e86f3a38-eb5a-4dee-961e-d64ffd9ae031` starts | `decision-trace.json` |
| 09:12:13.785 | `main.s1` navigate | `run.json` `actions` |
| 09:12:38.712–09:12:39.730 | `main.s15` click, the last node, succeeded | `flow-lane.json` `actions[14]` |
| 09:12:40.832 | Runtime run ends `failed` (result refuted) | `decision-trace.json` |
| 09:12:52.739 | Repair settle: `calls: 0, interventions: 1` | `events.ndjson` seq 17 |
| 09:12:52.950 | Error event: playback goal did not hold | `events.ndjson` seq 18 |
| 09:12:56.722 | Final capture | `events.ndjson` seq 19 |

Build loop 141.6 s (loop start to acceptance); `build.durationMs: 148289`.

## Stage 1 — the instruction, the goal's facts, and the expected chain

- Instruction text withheld. Core read **2 instructed consequences**, `modify_existing` (the store
  switch) and `create_new` (the two adds). Core's act reader read **3 acts** (Stage 3): `a1` `set`
  (switch), `a2` `add_to` (P1), `a3` `add_to` (P2).
- The goal (`manifest/manifest.ts:32-36`) is `PICKUP_CART_FACTS` (`manifest/expected-values.ts:38-44`),
  five mini-cart facts: `store-switched` (store line names the instructed store), `soap-kept` (the
  seeded line kept), `towels-added` (a line of P1 in its second size, quantity 2, pickup),
  `napkins-added` (a line of P2 in its second size, quantity 1, pickup), `nothing-else` (4 items and
  the goal's subtotal).
- A correct Flow (t193's Stage 1, `reports/t193-live-self-repair.md`, and the scenario's own recording,
  `manifest/primary-workflow.ts:15-39`): pass consent; open the store chooser and pick the instructed
  store **first** (P1's second size cannot be picked up at either starting-town store,
  `catalog/paper-towels.ts:29`); reach P1's page **through search or a listing**; choose its second size
  (a swatch, `primary-workflow.ts:23`); press the quantity **+** once (`:24`); close the support card
  (`:26`); press add-to-cart **twice** — the first press after a page load only wakes the page
  (`:27-28`, `client/shell-script.ts:29-30,45`, `client/product-script.ts:93`); reach P2's page, choose its
  second size (`:34`), press add-to-cart twice (`:35-36`); no checkout.
- Scenario facts that decide this run:
  - The product route ignores the slug and routes by the item id alone (`route.ts:14`, `:40-43`); a
    page opened without `?variant=` shows the product's **first** size (`catalog/find-product.ts:8`).
  - Quantity starts at 1 on every load (`client/product-script.ts:45`).
  - P2 is on the home page's pickup rail (`pages/home-page.ts:14`); P1 is on neither home rail
    (`:14-15`), so P1's page address is only shown on a results page.

## Stage 2 — exploration (the build)

From `logs/core.log` build-trace lines joined by iteration with `flow-lane.json`
`build.evidenceLoop.steps[]`, and the UI review's per-moment locations (origin and path only,
`ui-review/screen-location.ts`) and whole-window JPGs (full address bar). Draft ids are quoted only where
the trace itself names them (`targetedStepIds`, `rerun.N`); the amendment contents are not in this
build's trace (see Instrumentation gaps), so the table is by iteration.

| It | Decision | Node | Result / effect |
| --- | --- | --- | --- |
| 0 | (Core's initial) | snapshot | `web.action.rejected.not_at_start_location` |
| 1 | tool_call | `browser-navigate` | succeeded (start page) |
| 2 | tool_call | `dom-click` | succeeded (consent dialog's accept button) |
| 3 | tool_call | `dom-click` | `web.action.rejected.target_unobserved` / `handle_not_in_packet` (166 ms) |
| 4–5 | tool_call ×2 | snapshot ×2 | `web.inspect.succeeded` |
| 6 | tool_call | `dom-click` | succeeded, 2,647 ms (header store button, opens the chooser) |
| 7 | tool_call | `dom-click` | succeeded, 2,939 ms (a set-store button, list position 3 of 4: **the instructed store**) |
| 8 | tool_call | `dom-type` | succeeded (search field; P1's name and size; text withheld; `04-mid-build-scenario.png`) |
| 9 | tool_call | `dom-click` | succeeded, `pageState: changed` (search button). **Moment 4 (09:10:00.7) is still the home page with the typed text; no results page is at any sampled moment** |
| 10–11 | tool_call ×2 | `web.detect_repeating_structure` | `web.structure.detected` ×2, 1,796 bytes each — **on the home page** (moment 4 location) |
| 12 | tool_call | `browser-navigate` | succeeded (destination not sampled) |
| 13 | tool_call | `browser-navigate` | succeeded. JPG `00005` (09:10:17.0): **P2's own page**, first size |
| **14** | tool_call | `dom-click` | **`web.action.rejected.blocked_by_dialog`** (2,870 ms): add-to-cart under the support card |
| 15 | tool_call | `dom-click` | succeeded, `pageState: changed` (the support card's close glyph) |
| **16** | tool_call | `dom-click` | succeeded, **`pageState: unchanged`**: add-to-cart, **the wake-up press** |
| **17** | amend_draft | – | `draft_rerun` of `d15`, applied 1, kept 10; the re-run (`rerun.15`) succeeded, `pageState: changed`: **the build's one real add — P2, first size, qty 1, pickup.** Moment 6 (09:10:40.7): cart 2 lines |
| 18 | amend_draft | – | targeted d4, d15, d18: applied 1, refused 2, kept 10 |
| **19** | amend_draft | – | `draft_rerun` of `d14` (a navigate): succeeded |
| **20** | tool_call | `browser-navigate` | succeeded (`callId=rerun.13`). **Moment 6 (09:10:40.7) location: P1's slug with P2's item id** — the site shows P2 |
| 21 | amend_draft | – | targeted d20, d19, d18, d17, d16, d14: applied 4, refused 2, kept 7 |
| 22 | amend_draft | – | `draft_rerun` of `d15` again, targeted d16, d17, d19, d20, d15: applied 5, kept 11; the re-run add-to-cart succeeded, `pageState: changed`, **but added nothing**: it was the first press after the load at 20, and the cart still holds 2 lines at moment 10 |
| **23** | **complete #1** | – | check **ok**. Dry run 1 (13 replays): replayed, replayed, **unreproducible (6,524 ms), unreproducible (5,491)**, **failed (1,282)**, replayed ×3, **failed (3,794)**, replayed ×4 → **`llm_evidence_loop.dry_run_refused`** |
| 24 | amend_draft | – | targeted d3, d7, d8, d16: applied 3, refused 1 (`16:run_by_the_loop`); the re-run of d8 was `target_unobserved` / `handle_not_in_packet` |
| 25 | amend_draft | – | d8, d16: applied 2 (`withoutInput: 3`) |
| **26** | **complete #2** | – | **refused `bootstrap.instructed_act_missing`**. Dry run 2 ran anyway, the same 13-replay pattern as dry run 1 |
| 27 | amend_draft | – | d7: applied 1 |
| 28, 30, 31 | amend_draft ×3 | – | d7 each time: `llm_evidence_loop.draft_unchanged` (refused 1) |
| 29 | tool_call | snapshot | `web.inspect.succeeded` |
| **32** | **complete #3** | – | check **ok, accepted**. **No dry run** on draft revision 25; dry run 2 ran on revision 24, before amendment 27 |

Totals: 32 decisions = 18 tool_call + 11 amend_draft (8 applied, 3 `draft_unchanged`) + 3 complete.
23 tool calls (`toolCallCount: 23`): 11 `dom-click` (8 succeeded, 3 rejected), 5 `browser-navigate`,
1 `dom-type`, 4 snapshots (3 ok, Core's initial refused), 2 structure detections.

- **The build never opened P1's page.** Every product page it stood on at a sampled moment is P2:
  JPG `00005` (09:10:17, P2's own address), moments 5, 6, 9, 10 (P2's id; from moment 6 on, under P1's
  slug), and every one of those pictures shows P2 in its first size (`05`, `06`, `10-mid-build-scenario.png`).
  P1's address was never on a page the build is known to have read: search did not reach results (it 9)
  and P1 is on neither home rail. The address the Flow keeps for "P1" was composed by the model: P1's
  slug with P2's item id, which the site routes to P2 (`route.ts:14`).
- **The build pressed add-to-cart twice once, and kept it once.** The unchanged press at 16 woke the
  page; the re-run at 17 added. The Flow holds one add-to-cart node per product visit (Stage 3). Which
  amendment removed the second press is not in the trace (gap).
- **Nothing in the build chose a size or a quantity**: no click of a size swatch and no quantity press
  appears (11 clicks accounted for above: consent, rejected ×3, store ×2, search, card close, and
  add-to-cart ×3 — 16 the wake, 17 the add, 22 a re-run that only woke the page again).
- **Why the dry runs could not catch any of it.** (a) The reset is a navigation and keeps the site's
  server state (the replay module's own comment, `domain/.../node-run/replay.ts:9-17`): replays 3–4
  unreproducible fit the store already being set, as in runs 18 and 20. (b) A mutating step that runs
  replays as `core.replay.replayed` whatever it changed (`replay.ts:225-238`; only a reading step's
  collapse is judged). The cart stood at 2 lines at moments 6, 9 and 10 (09:10:40 to 09:12:00), across
  both dry runs, so no replayed press added anything, yet 9 of 13 replays per run answered `replayed`
  (2 unreproducible, 2 failed).
- **Where decisions and time went without progress.** The 2 dry runs took **55.0 s of the 141.6 s
  loop**; dry run 2 ran after its completion was refused. 4 unreproducible replays at 5.4–6.5 s each.
  Amendments 28, 30, 31 repeated d7 with no change.
- **Draft size**: records 1 → 17; rendered size peaked at 3,971 of 4,000 bytes (28–32).
  `instructionBytes` fell 1,019 → 772 → 177 (20, 21), the draft guidance's three lengths (t193 E).

## Stage 3 — the proposed Flow, and each requirement against it

- Adaptation `adaptation.bootstrap.5d26683c-de0d-43c3-88b6-2b546266b046`, `applied`
  (`decision-trace.json`), Flow `flow.a3751143-ded6-4a9e-a8b9-b711f6c7a8a2`, `appliedMutationCount: 2`.
- Shape: 15 nodes, 12 action nodes: 4 `web.browser.navigate`, 7 `web.dom.click`, 1 `web.dom.type`, and
  3 `builtin.control.merge`; no extract node. Route: subflow `subflow.bootstrap.969b849ac69ae839.main`
  (fallback, no rule, `stateObserved: false`). Parameters withheld (selectors, URLs, typed text); the
  table uses only the definition id and the target's shape (`authoredNodes`):

| Node | Definition id | Target's shape (by kind) | Build origin | Where it went in playback |
| --- | --- | --- | --- | --- |
| s1 | `web.output.browser-navigate` | start page | it 1 | home page, consent open (`11-flow-run-scenario.png`) |
| s2 | `web.output.dom-click` | `button`, consent dialog's accept | it 2 | consent passed |
| s3 | `builtin.control.merge` | – | – | joins after s2 |
| s4 | `web.output.dom-click` | `button`, header store button (shadow host 1) | it 6 | chooser opened (4 candidates) |
| s5 | `web.output.dom-click` | `button`, set-store, list position 3 of 4 (shadow host 1) | it 7 | **instructed store set** |
| s6 | `builtin.control.merge` | – | – | joins after s4–s5 |
| s7 | `web.output.dom-type` | `input`, search field | it 8 | typed |
| s8 | `web.output.dom-click` | `button`, search | it 9 | pressed |
| **s9** | `web.output.browser-navigate` | typed address | it 19/20 (re-pointed) | **P2's page, first size** (moment 12) |
| s10 | `web.output.dom-click` | `div`, close glyph (shadow host 1) | it 15/22 | support card closed (pill shows, `12`, `13`, `14` PNGs) |
| s11 | `builtin.control.merge` | – | – | joins after s10 |
| **s12** | `web.output.dom-click` | `button`, pinned add-to-cart | it 14/17 | **first press after s9's load: wake only** |
| s13 | `web.output.browser-navigate` | typed address | – | not sampled |
| **s14** | `web.output.browser-navigate` | typed address | – | **P2's page again, first size**, the same composed address as s9 (moment 13; JPG `00017` address bar, no query) |
| **s15** | `web.output.dom-click` | `button`, pinned add-to-cart | – | **first press after s14's load: wake only** |

  The build origin of s9–s15 is inferred from order and target shape; the amendments' contents are not
  recorded. The graph's edges are not in the bundle; the three merges closing conditional spans is
  inferred from their placement.

**Each instructed requirement against the Flow:**

| # | Requirement (by kind) | Flow node | Done in playback? | Evidence |
| --- | --- | --- | --- | --- |
| R1 | switch the pickup store (a1 `set`) | s4, s5 | **yes** | header names the instructed store (`12`, `13`, `14` PNGs) |
| R2 | reach P1's page | s9 | **no: wrong target** — a composed address (P1's slug, P2's id) opens P2 | moment 12 location; `12-flow-run-scenario.png` shows P2 |
| R3 | P1's second size | **none** | no | no size click in the build or the Flow |
| R4 | P1 quantity two | **none** | no | no quantity click; quantity is 1 on load (`product-script.ts:45`) |
| R5 | P1 for pickup | none (page default) | n/a (P1 never reached) | – |
| R6 | add P1 (a2 `add_to`) | s12 | **no**: one press after a load wakes the page and adds nothing | `shell-script.ts:45`, `product-script.ts:93`; no "added" panel, cart count 1 (`13`, `14` PNGs) |
| R7 | reach P2's page | s13/s14 | yes, by accident (the same composed address) | moment 13 |
| R8 | P2's second size | **none** | no: first size shown and selected | `14-failure-scenario.png` |
| R9 | P2 for pickup, quantity one | none (page defaults) | defaults would have held (pickup option pre-selected; quantity 1) | `14-failure-scenario.png` |
| R10 | add P2 (a3 `add_to`) | s15 | **no**: one press after s14's load, wake only | as R6 |
| R11 | keep the existing cart | no step removes | yes | cart count 1 = the seeded line |
| R12 | do not check out | no checkout step | yes | – |
| – | close the support card (a page obstacle, not instructed) | s10 | yes | pill shown, card gone |

- **Core's instructed-acts check, and what it could and could not refuse.** Run read-only on this task's
  instruction (scratch script, `node --experimental-strip-types` importing
  `instructed-acts/instruction-acts.ts`), the reader returns exactly three acts: `a1 set switch`,
  `a2 add_to add` (its quote holds P1's count "two", its size and "pickup"), `a3 add_to add` (its quote
  holds P2's size and "pickup"); none `plural`; "check out" is correctly dropped as negated. **Extraction
  was right.** The check (`check.ts:117-133`) then asks only that each act be claimed by a distinct step
  that exists, is kept, is a mutation that applied (`:127`, read from `effect` and `effectApplied`, not
  from the state digests), is not start-only, not optional, and repeats when plural. s5, s12 and s15 each
  pass that, and it cannot see which page a press was on, by its own design (`contracts.ts:16-24`,
  `check.ts:4-10`). **What it failed to extract**: the counted object's qualifiers. `coordinatedObjects`
  (`instruction-acts.ts:168-183`) splits the objects and keeps "two packs … in the <size> size" as quote
  text only; `:139-144` turns each object into one `add_to` act and nothing else. So "quantity two" (a2),
  "size" (a2, a3) are requirements no step is ever asked for, and a Flow with no size and no quantity
  press passed completion #3. The claims completion #3 made are not recorded (gap); a2 → s12 and
  a3 → s15 is the only assignment that passes, inferred.
- Declared consequences: `modify_existing` only; cross-check `undeclared` (`declared: [modify_existing]`,
  `undeclared: [create_new]`, `declaredNothing: 57` of 77). The panel asked about it ("Apply it as it
  stands?"); the Lab applied it. In hindsight the cross-check was right: nothing the Flow did creates.

## Stage 4 — playback

Runtime run `e86f3a38-eb5a-4dee-961e-d64ffd9ae031`, 09:12:11.456Z to 09:12:40.832Z.

| Attempt | Node | Started | ms | Status | Host resolution (candidates, best, confidence) |
| --- | --- | --- | --- | --- | --- |
| 0 | `main.s1` navigate | 09:12:13.785Z | 2213 | succeeded, `matched` | – |
| 1 | `main.s2` click | 09:12:17.174Z | 738 | succeeded | 1, 0.643, 0.566 |
| 2 | `main.s3` merge | 09:12:19.076Z | 1 | succeeded | – |
| 3 | `main.s4` click | 09:12:19.078Z | 1180 | succeeded | 4, 0.643, 0.566 |
| 4 | `main.s5` click | 09:12:21.413Z | 667 | succeeded | 1, 0.643, 0.566 |
| 5 | `main.s6` merge | 09:12:23.247Z | 0 | succeeded | – |
| 6 | `main.s7` type | 09:12:23.248Z | 294 | succeeded | 1, 1.0, 0.88 |
| 7 | `main.s8` click | 09:12:24.685Z | 409 | succeeded | 1, 0.76, 0.714 |
| 8 | `main.s9` navigate | 09:12:26.233Z | 1436 | succeeded, `matched` | – |
| 9 | `main.s10` click | 09:12:28.778Z | 1728 | succeeded | 1, 0.643, 0.566 |
| 10 | `main.s11` merge | 09:12:31.618Z | 0 | succeeded | – |
| 11 | `main.s12` click | 09:12:31.619Z | 1007 | succeeded (wake only) | 1, 1.0, 0.88 |
| 12 | `main.s13` navigate | 09:12:33.733Z | 1389 | succeeded, `matched` | – |
| 13 | `main.s14` navigate | 09:12:36.232Z | 1368 | succeeded, `matched` | – |
| 14 | `main.s15` click | 09:12:38.712Z | 1018 | succeeded (wake only) | 1, 1.0, 0.88 |

- Every step's extension-side resolution was `unresolved_no_candidates`; the host resolved each by
  selector. Every comparison `matched`. Evidence packets 5,583–5,913 bytes, all 24 truncated (budget
  invariant passed).
- s10 started 1.1 s after s9's load and took 1,728 ms; the support card opens 3 s after a product page
  loads (`shell-script.ts:18`). That the click waited for the card and closed it is inferred from the
  pill showing afterwards and s12 not being blocked; not traced.
- **Final state** (`14-failure-scenario.png`, 09:12:56.5; `13-flow-run-scenario.png`, 09:12:53.5; JPG
  `00017`, 09:12:52.7): P2's page in its first size, the instructed store in the header, cart count 1
  with the seeded subtotal, no "added" panel. The header was drawn by s14's load, after s12, and s15's
  success would have opened the panel (`product-script.ts:98`), so neither press added anything.

**Which facts failed (from the pictures and the source; the oracle's per-fact results are not exported):**

| Fact | Result | Why |
| --- | --- | --- |
| `store-switched` | holds | s5 set position 3 of 4; header names it |
| `soap-kept` | holds | nothing removed; cart count 1 is the seeded line |
| `towels-added` | **fails** | P1 never reached (s9 wrong target), no size, no quantity, and the one press only woke the page |
| `napkins-added` | **fails** | P2 reached but at its first size, and the one press only woke the page |
| `nothing-else` | **fails** | 1 item, not 4 |

Three of five facts failed. Even if each press had added, the cart would have held P2 in its first size
twice (s12 and s15 both on P2's page), and the goal would still fail on all three counts.

## Stage 5 — the answer

`resultVerification: refuted`, but **not by observation**. `live-llm.json` `verification`:
`source: run-detail`, `status: refuted`, **`basis: model_unavailable`**,
**`code: core.result.verdict_unavailable`**, `verdicts: [unsure]`. The one check request was refused
pre-flight `llm.provider_result_summary_invalid` (tokens null), by
`runtime/llm/harness/request-evidence-check.ts:43` → `sendableResultSummary` (`:115-122`), which fails on
any of four conditions (no declared keys, a credential, a declared key in the sampled rows, or over the
byte limit); which one is not recorded. `result-verification/verdict.ts:101-102` then fails the result as
`unsure`. So `flow_lane.result_refuted` is the correct outcome reached by default: Core never judged the
cart.

## Stage 6 — recovery

`harnessRecovery` (`flow-lane.json`): 1 intervention, kind `diagnosis`, `validationOk: false`,
`llm.provider_result_summary_invalid` — the refused result check above (its request id is the loop
verification's). `runtimePatchAttempts: []`, no adaptation, no change proposal, `refusalCode: null`.
Repair settle: `calls: 0, interventions: 1, $0`. `unsettled: "recovery"`. No diagnosis, re-author or patch
ran, so t194's re-author path and F4 (not in this tree) were not exercised.

## Causes

| # | Cause, precisely | Repo and file | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | **Wrong target: the Flow's "P1" navigation opens P2.** s9 and s14 carry an address the model composed (P1's slug, P2's item id); the site routes by id (`route.ts:14`), so both visits land on P2. The domain runs a same-origin navigation "as written" and checks only the origin (`node-run/run.ts:313-319`, `crossOrigin` `:669-676`), so an address no page ever showed the build is accepted, recorded and replayed. P1's address was never observable (search never reached results; P1 is on no home rail). | domain `domain/src/runtime/llm-evidence/node-run/run.ts:313-319` | **t174** (not recorded in t193–t195) | Open (new). Proposed fix A |
| 2 | **No size or quantity step, and the instructed-acts check cannot ask for one.** The reader keeps "two packs" and "in the <size> size" as quote text (`instruction-acts.ts:139-144`, `:168-183`); the check needs one kept mutating step per act (`check.ts:117-133`). So a Flow with no swatch press and no quantity press passed. Run 20 causes 6 and 9, repeating. | Core `runtime/flow-bootstrap/instructed-acts/{instruction-acts.ts, check.ts}` | **t174** (F6 item 3; t195 hands `check.ts` to t174) | Open, repeats. Proposed fix B |
| 3 | **One add-to-cart press per page load, which the site takes as a wake-up.** The build added only on its second press (16 unchanged, 17 changed) and the Flow kept one per visit, so both presses in playback added nothing. t195 F17 (`unchangedPress` hint: press again, keep both) and F19 (the click node's description) fix the model's side; **neither is in this tree** (`unchangedPress` and the F19 sentence are absent from `domain/.../node-run/run.ts` and `domain/src/actions/schemas.ts` here). | domain `node-run/run.ts`, `actions/schemas.ts` | **t195** (F17, F19) | Fixed in t195, **not in this tree** |
| 4 | **The dry run passes a press that changed nothing.** A mutating step that runs replays `core.replay.replayed` whatever it did (`replay.ts:225-238`); the cart did not change across both dry runs (moments 6, 9, 10) while 9 of 13 steps per run "replayed". A swallowed add, or an add on the wrong product, can never fail a dry run. | domain `domain/src/runtime/llm-evidence/node-run/replay.ts:225-238` | **t174** (the replay module; t193 cause D) | Open (new). Proposed fix C |
| 5 | **The dry-run reset keeps the site's state** (replays 3–4 unreproducible, the store kept). Run 18 cause 2, run 20 cause 3. | domain `node-run/replay.ts:9-17`, Core `flow-draft/dry-run.ts` | **t174** (t193 cause D) | Open, repeats |
| 6 | **Accepted with no dry run of the accepted draft**: completion #3 on revision 25; dry run 2 on revision 24; amendment 27 applied after. Run 18 cause 3, run 20 cause 4. | Core `llm/harness-options/bootstrap-completion.ts`, `llm/node-tools/dry-run-gate.ts` | **t174** | Open, repeats |
| 7 | **A dry run ran on a refused completion**: completion #2 refused at 09:11:16.845, dry run 2 (27.5 s) started the same millisecond. Run 20 cause 5. t195's F18 (dry-run gate) is not in this tree. | Core completion / dry-run ordering | **t174** (t195 F18 adjacent) | Open, repeats |
| 8 | **The result check was never sent, and the refutation is a default.** `llm.provider_result_summary_invalid` pre-flight (`request-evidence-check.ts:43`, `:115-122`), then `verdict.ts:101-102` fails as `unsure`/`model_unavailable`. No reason for the refusal is recorded, no re-author or repair follows. | Core `runtime/llm/harness/request-evidence-check.ts:115-122`; `runtime/result-verification/verdict.ts:101-102` | **t194** (judge lane; not in its fix log) | Open (new). Proposed fix D |
| 9 | **The build never reached a results page.** The search press at 9 left the home page (moment 4), then two structure detections ran on the home page and the build navigated by typed address instead. Why the search did not navigate is not traced. | build decisions; domain press result | t174 | Open, not traced |
| 10 | Decision efficiency: 55.0 s of 141.6 s in dry runs, 4 unreproducible replays at 5.4–6.5 s, 3 `draft_unchanged` amendments in a row on d7, 2 `handle_not_in_packet` rejections. | Core `llm/evidence-loop.ts` | t174 (run 20 cause 11) | Open, repeats |

**Owning cause.** The Flow ran every step because each step's own success is a landed click or a
loaded page. It missed the goal on acts never done (both sizes, P1's quantity, the second press), done
on the wrong target (s9: P2's page for P1's add), with nothing undone by a later navigate. The navigates
did matter in one way: each one reloads the page and re-arms the wake-up, so one press after one is
always swallowed. The instructed-acts check let the missing size and quantity through (cause 2). The
wrong target and the swallowed press are beyond what that check can see, by its own design, and are
caught nowhere else today: the navigation is not held to what the build observed (cause 1), and the dry
run does not judge a press by its effect (cause 4).

Positive, for the record: the store pick was right again (t193's F live-confirmed a second time); the
Flow closed the support card itself (s10), so run 20's blocker did not recur; consent was passed by the
Flow's own accept click; the build trace no longer prints model-authored call ids (44 `callId=-`, the
rest `initial.core.run_node` or `rerun.N`), so run 20's cause 10 is fixed in this build.

## Proposed fixes (not implemented)

- **A (cause 1).** domain `domain/src/runtime/llm-evidence/node-run/run.ts:313-319`: during a build, a
  same-origin `web.browser.navigate` may go only to the start location, the current page's address, or
  an address (path and query) that appeared in evidence the build was shown (a link target in a packet
  or a structure-detection row). Anything else is refused `address_unobserved`, with `instead` naming
  the press of the link that goes there. The observed addresses are a per-build fact, kept the way
  `node-run/arrival.ts` keeps arrival (a new `node-run/observed-addresses.ts`). Here it refuses the
  composed address at 19/20, and the model has to search. A test: a navigate to a slug/id pair no packet
  showed is refused; one to a shown listing link runs.
- **B (cause 2).** Core `instructed-acts/instruction-acts.ts:139-144`: when a counted object of `add_to` or
  `save` carries an unambiguous qualifier, read it into the act as `needs`: a count of two or more
  (`quantity`), and "in the <words> size|count|color|flavor" (`option`). `check.ts:117-133`: each need is
  answered by its own claim (`a2.quantity`, `a2.option`) naming a kept mutating step other than the act's
  own step and before it; otherwise `choice_not_named`, with a sentence telling the model to press the
  control that sets it. Keep the file's one-sided bias: "for pickup" is not a need (sites pre-select it).
  Here a2 needs a quantity and an option and a3 an option; completion #3 is refused.
- **C (cause 4).** domain `node-run/replay.ts:225-238`: a mutating step whose original run changed the
  page's state digest (`stateBefore` ≠ `stateAfter`, Core `flow-draft/step.ts:111-113`) and whose replay
  leaves it unchanged answers `core.replay.changed` ("the step ran and changed nothing where it changed
  the page"), as a reading step's collapse already does. Whether the replay request carries the
  original digests today was not checked; if not, the original run records it in `produced`
  (`replay.ts:74`). Here s12 and s15's replays change nothing and the dry run refuses.
- **D (cause 8), for t194.** Record which of `sendableResultSummary`'s four conditions failed
  (`request-evidence-check.ts:115-122`) as a closed code beside `llm.provider_result_summary_invalid`, and
  make a record-less (state-change) task's summary sendable, so the result check judges the cart.
- **Merge t195's F17, F18 and F19 into this tree** (cause 3, 7): validated there, absent here.

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2 | What each amendment did: which removed the second add press; which re-pointed s9/s14's address | `logs/core.log` has no `amend=`, `acts=` or `missing=` fields: t195's F13 is not in this tree |
| 2, 3 | Which steps completion #3 named for a1–a3; which act completion #2 found missing | as above |
| 2 | Why the search press at 9 did not reach a results page | the press result is not exported; no sample between 09:10:00.7 and 09:10:17 |
| 3 | The Flow's navigation addresses | withheld from `authoredNodes` (correctly); only the UI review's paths and the JPG address bar show them |
| 3 | The Flow's edges and the merges' branch conditions | the bundle exports nodes, not edges |
| 4 | Which facts failed | `oracles.finalState: failed` only; no per-fact result; the mini cart is a hover flyout never pictured |
| 4 | Whether an add press changed the site's state | no state digest is exported per playback attempt |
| 5 | Which condition refused the result summary | the code `llm.provider_result_summary_invalid` only |
| UI | The side panel covers the right of the emulated page in the whole-window JPGs (`00005`, `00017`): a person watching cannot see the size swatches, the buy box or add-to-cart | Lab viewport emulation against the window's page width (run 20 gap, repeats) |
| 1 | `activeTabUrl` (t185 row 1) | not recorded |

## UI review

Source: `run-munvvc3z-3eadc185.ui-review.local.json`. 14 moments, 14 scenario and 14 panel pictures,
`skipped: []`, `skippedTicks: 0`, `failures: []`. Panel `side-panel (devtools target, type page)`,
`masked: 0` at every moment. The scenario tab was `inFront: true` and the only entry in `frontTabs` at
all 14. Overlay samples: 16 per moment, 200 ms apart, over 3.0 s.

### Screenshots opened (Read tool)

| PNG / JPG | What it shows |
| --- | --- |
| `run-munvvc3z-3eadc185.ui-review.local/01-start-panel.png` | Panel Simple tab: "Connected to FluxIQ"; "Get set up" with **"Add an AI model key: To do"**; chat "What can FluxIQ do for you?" / "Loading the conversation..."; composer "Ask FluxIQ to do something...". |
| `run-munvvc3z-3eadc185.ui-review.local/04-mid-build-scenario.png` | Home page, consent gone, instructed store in the header and rail; the search field holds the typed term; **still the home page** after the search press; overlay bottom-left "Building your Flow / Deciding the next step". |
| `run-munvvc3z-3eadc185.ui-review.local/05-mid-build-scenario.png` | P2's page (moment 5, P2's own address) in its **first size**, cart count 1; support card closed, pill showing; overlay "Building your Flow / Deciding the next step". |
| `run-munvvc3z-3eadc185.ui-review.local/06-mid-build-scenario.png` | The same P2 page, now under P1's slug (moment 6 location), first size; **cart count 2** — the build's one add (P2, first size). |
| `run-munvvc3z-3eadc185.ui-review.local/10-mid-build-scenario.png` | The same P2 page, first size, cart 2, after both dry runs; overlay **"Building your Flow / The proposed result passed its check"**. |
| `run-munvvc3z-3eadc185.ui-review.local/10-mid-build-panel.png` | Header "Building your Flow"; "Worked for 56s · 27 steps · 1 failed"; the question "The instruction asks for create_new, and none of this run's 77 actions said it would cause that; 57 of them said they would cause nothing lasting. Apply it as it stands?" with **Yes / No**; turn "Building your Flow / The proposed result passed its check". |
| `run-munvvc3z-3eadc185.ui-review.local/11-flow-run-scenario.png` | Playback start: seeded state, **consent dialog open**, starting store, cart 1; overlay "Flow ready / Build finished: a Flow is proposed". |
| `run-munvvc3z-3eadc185.ui-review.local/12-flow-run-scenario.png` | During s12: **P2's page (reached by s9 as "P1"), first size**, instructed store, cart 1; overlay "Running your Flow · Step 10 of 15 / Running step 10 of 15: node.bootstrap.969b8..." **cut with an ellipsis**. |
| `run-munvvc3z-3eadc185.ui-review.local/12-flow-run-panel.png` | Header "Running your Flow"; the create_new question **still offering Yes / No**; "Running your Flow Step 10 of 15 / Running step 10 of 15: node.bootstrap.969b849ac69ae839.main.s10"; "1 step so far", "11 steps so far". |
| `run-munvvc3z-3eadc185.ui-review.local/13-flow-run-scenario.png` | After the run: P2's page, first size, cart 1, no "added" panel; overlay **"Run failed / Run failed"**. |
| `run-munvvc3z-3eadc185.ui-review.local/13-flow-run-panel.png` | Header **"Run failed"**; "Worked for 42s · 18 steps · 1 failed"; the question still with Yes / No; "Worked for 1s · 1 step"; "Worked for 34s · 18 steps · 1 failed". No reason, and nothing says every step succeeded but the goal did not hold. |
| `run-munvvc3z-3eadc185.ui-review.local/14-failure-scenario.png` | Final: P2's page, first size selected, pickup option pre-selected, instructed store, cart 1; no overlay. |
| `run-munvvc3z-3eadc185.ui-review.local/14-failure-panel.png` | Same as 13's panel: "Run failed", the stale question, the three "Worked for" rows. |
| `run-munvvc3z-3eadc185/screenshots/00005-9bf9be36b4b5.jpg` | Whole window at 09:10:17: address bar is P2's own address; panel "Building your Flow / Using core.run_node: web.action.rejected.blocked_by_dialog / 17 steps so far"; overlay "Using core.run_node: web.action.rejected.bloc..." cut; the panel hides the buy box. |
| `run-munvvc3z-3eadc185/screenshots/00017-cbde5feb7190.jpg` | Whole window at 09:12:52.7: address bar is the composed address (P1's slug, P2's id, **no query**); tab title is P2's; panel "Run failed"; the buy box and add-to-cart hidden behind the panel. |

### Overlay per moment

Phase changes count transitions of the overlay's `phaseName` between samples, including to or from
absent, over the 3.0 s window. `textChanges`, `presenceToggles` and `visibilityToggles` are as
`summary.overlay` reports them.

| # | Label | Window start | Status | present/samples | textChanges | presenceToggles | visibilityToggles | Phase changes/s | Text changes/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | start | 09:09:16.835 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 2 | mid-build | 09:09:19.851 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 3 | mid-build | 09:09:37.674 | flickering | 16/16 | 3 | 0 | 0 | 0.00 | 1.00 |
| 4 | mid-build | 09:09:57.706 | changed | 15/16 | 2 | 0 | 0 | 0.67 | 0.67 |
| 5 | mid-build | 09:10:17.705 | flickering | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 6 | mid-build | 09:10:37.717 | changed | 16/16 | 1 | 0 | 0 | 0.00 | 0.33 |
| 7 | mid-build | 09:10:57.736 | flickering | 14/16 | 2 | 2 | 2 | 0.67 | 0.67 |
| 8 | mid-build | 09:11:17.762 | flickering | 15/16 | 1 | 2 | 2 | 0.67 | 0.33 |
| 9 | mid-build | 09:11:37.770 | flickering | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 10 | mid-build | 09:11:57.752 | changed | 16/16 | 1 | 0 | 0 | 0.33 | 0.33 |
| 11 | flow-run | 09:12:10.497 | changed | 16/16 | 1 | 0 | 0 | 0.33 | 0.33 |
| 12 | flow-run | 09:12:30.573 | changed | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 13 | flow-run | 09:12:50.518 | changed | 6/16 | 0 | 1 | 1 | 0.33 | 0.00 |
| 14 | failure | 09:12:53.533 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |

Peak: 0.67 phase changes/s (moments 4, 7, 8) and 1.00 text changes/s (moment 3). Every build phase
change is a one-sample drop-out on a page load: moment 4 at 09:09:58.7 (the search press,
58.539–10:00.091), moment 7 at 09:10:59.7 (dry run 1's replays 6–7, 58.460–59.881), moment 8 at
09:11:18.2 (dry run 2's reset and first replays from 16.845).

Texts shown (phase | headline | detail):
- "Building your Flow | Using core.run_node" and "… | Using core.run_node: web.action.succeeded"
- "Building your Flow | Deciding the next step"
- "Building your Flow | Using core.run_node: web.action.rejected.blocked_by_dialog" (JPG `00005`)
- "Building your Flow | Using core.run_node: core.replay.unreproducible", "…: core.replay.replayed",
  "…: core.replay.failed" (dry runs)
- "Building your Flow | Checking the proposed result"
- "Building your Flow | The proposed result passed its check"
- "Flow ready | Build finished: a Flow is proposed"
- "Running your Flow | Run started"
- "Running your Flow | Step N of 15 | Running step N of 15: node.bootstrap.969b849ac69ae839.main.sN"
  (N = 10, 11, 12 seen)
- "Run failed | Run failed"

Fidelity to Core's events, checked against `core.log` and the runtime's attempt times (each text is held
about 1.2 s, so it trails the event by up to that):
- Moment 3: "…: web.action.succeeded" at 09:09:37.67 for the navigate that ended 36.943; "Deciding" at
  38.37 (decision 2, 36.947–38.284); "Using core.run_node" at 39.49 (tool start 38.284); "Deciding" at
  40.68 (decision 3 from 40.286).
- Moment 7: "…: core.replay.unreproducible" at 09:10:57.74 (replay 4 ended 57.176); "Using" at 58.55
  (replay 5 from 57.177); "…: core.replay.replayed" at 60.14 (replays 6–7 ended 58.641, 59.881).
- Moment 8: **"Checking the proposed result" at 09:11:17.76 for completion #2, whose check was refused
  at 16.845**; then "Using core.run_node" for dry run 2, nothing saying the check failed.
- Moment 9: "…: core.replay.failed" at 09:11:39.0 (replay 9 of dry run 2 ended 38.901).
- Moment 10: "The proposed result passed its check" at 09:11:57.75 (check ok 54.643), "Flow ready" at
  58.96.
- Moment 11: "Run started" at 09:12:11.51 (run started 11.456).
- Moment 12: step 10 at 30.57 (s10 28.778–30.506), step 11 at 31.78 (s11 31.618), step 12 at 33.00 (s12
  31.619–32.626): trailing by the hold.
- Moment 13: "Run failed" at 09:12:50.52, **gone 1.2 s later** (absent from 51.73; moment 14 absent).

No overlay text was seen without a matching Core or runtime event.

### Overlay DOM state

- One host (`hostCount` 1), `display: block`, `visibility: visible`, `opacity: 1`, `inViewport: true`,
  `documentVisibility: visible` whenever present.
- Attributes: `data-fluxiq-activity=""`, `aria-hidden="true"`, `inert=""`.
- **Rect: x 16, y 650, 300 × 54**, bottom-left, as in run 20. On a product page it covers the pinned
  bar's title at its left end (`12`, `13` PNGs), not add-to-cart (bottom-right).
- Absent at moments 1–2 (before the loop started at 09:09:33.037) and after 09:12:51.7.

### Panel

Side panel, verified open, Simple tab: status card, "Get set up" with "Add an AI model key: To do", and
a chat area with a header line "FluxIQ · <phase>" that read "Building your Flow", "Running your Flow"
and "Run failed" at the matching moments. The person's own instruction as a chat turn is not visible in
any panel opened (the top of the chat is scrolled to "Worked for" rows). Panels 02–09 and 11 were not
opened.

### UI defects (U1–U15)

| # | Defect | This run | Evidence |
| --- | --- | --- | --- |
| U1 | Raw tool ids, result codes and node ids shown to the person | **recurs** ("Using core.run_node: core.replay.unreproducible", "…: web.action.rejected.blocked_by_dialog", "Running step 10 of 15: node.bootstrap…s10") | `12-flow-run-scenario.png`, `12-flow-run-panel.png`, JPG `00005`; JSON moments 7, 9 |
| U2 | Headline repeated as the detail line | **recurs at failure only** ("Run failed / Run failed") | `13-flow-run-scenario.png` |
| U3 | Overlay covers the page's bottom-right controls | **fixed** (bottom-left); covers the pinned bar's title text | `12-flow-run-scenario.png` |
| U4 | Panel says "Done" mid-build, at playback, after failure | **fixed** (header matches the overlay at every moment opened) | `10-mid-build-panel.png`, `12-flow-run-panel.png`, `13-flow-run-panel.png` |
| U5 | "Add an AI model key: To do" during a live build | **recurs** | every panel PNG opened |
| U6 | Control name joined without a separator | **not seen** | – |
| U7 | Flicker and page-load drop-outs | **partly fixed**: peak 0.67 phase changes/s; one-sample drop-outs on page loads recur | JSON moments 4, 7, 8 |
| U8 | Failure not left on screen, no reason | **recurs, and worse**: every step succeeded and the goal missed, but the overlay says only "Run failed" for 1.2 s and the panel gives no reason | `13-flow-run-scenario.png`, `13-flow-run-panel.png` |
| U9 | Nothing tells the person a robot check is waiting | not applicable | – |
| U10 | Dry runs look like exploring | **recurs** ("Using core.run_node: core.replay.…") | JSON moments 7, 9 |
| U11 | "The proposed result passed its check" overstates the check | **recurs**: shown for a revision no dry run replayed, whose Flow then added nothing | `10-mid-build-scenario.png`, `10-mid-build-panel.png` |
| U12 | "Worked for" counters disagree with the build | **recurs**: "Worked for 56s · 27 steps · 1 failed" at build end for a 141.6 s loop of 23 tool calls with 3 rejected; later rows "42s · 18 steps" and "34s · 18 steps" | `10-mid-build-panel.png`, `13-flow-run-panel.png` |
| U13 | Overlay detail line cut with an ellipsis | **recurs** | `12-flow-run-scenario.png`, JPG `00005` |
| U14 | A question stays open after it stopped mattering, in a code ("create_new") | **recurs**: Yes / No at build end, during the run and after failure | `10-mid-build-panel.png`, `12-flow-run-panel.png`, `13-flow-run-panel.png` |
| U15 | "Checking the proposed result" shown for a refused check | **recurs** | JSON moment 8 |

## t185 checklist

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Confirmed**, including beside the page: `[lab] live panel: side-panel (verified open)`; `snapshots/live-panel.json` = `{"mode":"side-panel"}`; the panel captured at all 14 moments; the whole-window JPGs show it docked. Scenario tab `inFront: true`, only entry in `frontTabs` at every moment. **`activeTabUrl`: no evidence.** | full log; `snapshots/live-panel.json`; JPGs `00005`, `00017`; UI review JSON |
| 2 | Overlay from real events | **Confirmed.** Absent before Core's first event (moments 1–2; loop start 09:09:33.037). Every phase seen matches a `core.log` or runtime event, trailing by the ~1.2 s hold (moments 3, 7, 8, 9, 10, 11, 12, 13). A refused check is shown as "Checking" (U15). | UI review JSON; `logs/core.log`; PNGs 10, 12, 13 |
| 3 | No interference | **Confirmed for the overlay.** Host marked `data-fluxiq-activity`, `aria-hidden`, `inert`; rect bottom-left (x 16–316), away from every click point; all 15 attempts succeeded. Snapshots, interference sentences and `dom.mutation`: **no evidence** (not exported). | `flow-lane.json` `actions`; `12-flow-run-scenario.png` |
| 4 | Chat | **Partly confirmed.** Phase header, turns with step counts, the create_new question. Against: the question stays open (U14); counters disagree (U12); no failure reason, and no hint that the goal, not a step, failed (U8). The typed instruction as a person's turn: **not seen**. | `10-mid-build-panel.png`, `12-flow-run-panel.png`, `13-flow-run-panel.png` |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (174 lines, 166 build-trace) has no error, warn, outbound or `server.activity` line. `outbound` growth: not logged. | `logs/core.log` |
