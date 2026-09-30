# Run debug — `run-munpwa5r-e7aefe04` (live run 18)

Worker t174-w15, 2026-09-30. Read from the bundle at
`test-runs/instances/t174-slot-1/run-munpwa5r-e7aefe04`, its UI review
(`test-runs/instances/t174-slot-1/run-munpwa5r-e7aefe04.ui-review.local.json` and the PNG folder
`run-munpwa5r-e7aefe04.ui-review.local/`), and the launcher's full Lab stdout
(`live-run-18.full.log`, in the supervisor's scratchpad, not in the repository). No product code
changed. Privacy: only codes, counts, ids, node ids, durations, timestamps and FluxIQ's own UI
strings. Pages and controls are named by kind; no instruction text, page text, accessible names,
extracted values or provider bodies. Where the panel quotes a control name it is written
`"<control>"`.

---

## Header

- Run id: `run-munpwa5r-e7aefe04`
- Scenario / variant / task: `bigbox-retail` / none / `bigbox-retail-pickup-cart` (`form`,
  judged by playback goal `build-pickup-cart`). The instruction is 330 characters, sha256
  `8da0b9f6…3d43d3` (`snapshots/flow-lane.json` `task`), the same instruction as run 16.
- Repositories (`run.json`): facility `2d6d27f` (dirty), Core `4d126f6` (dirty), both the t174
  tree. The build carried t174's F5 (`step_only_arrives`). Whether F6 items 1 and 2 were in the
  dirty Core is not recorded in the bundle. t195's F1 (consent wall) and t193's F (per-store
  chooser buttons) were **not** in this tree. Chromium 134.0.6998.35, 1280×720, seed 239. Ports:
  scenario 60432, web 60433, gateway 60434.
- Lab span 06:21:38.808Z to 06:26:42.271Z (`summary.json`), `durationMs: 302703`. Dispatch
  06:21:58.361Z (`events.ndjson` seq 1); build loop 06:22:13.336Z to 06:25:56.996Z (223.7 s;
  `build.durationMs: 230326`); build settle 06:26:02.935Z (seq 2); runtime run 06:26:13.522Z to
  06:26:21.845Z; recovery 06:26:22.391Z to 06:26:27.743Z; repair settle 06:26:28.910Z (seq 3);
  error 06:26:28.966Z (seq 4).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. Authorized: `maxCalls: 64`,
  48k in / 8k out / 56k per call, $0.25 per call, $2 total.
- Calls, cost:
  - Build: **49 calls** (48 loop decisions + 1 unrecorded instruction-authority call),
    800,785 in / 4,896 out tokens, **$0.09009**, `budgetBreaches: 0`. The largest call had
    17,556 input tokens.
  - Repair: 2 calls (`runtime_diagnosis` gather, `runtime_patch` implement), **$0.08531**, of
    which **$0.08333 is a reservation charged for the patch call** (48,000 in / 8,000 out
    `"tokens": "reserved"`, nothing reported; `decision-trace.json`).
  - Result check: none (`verification.source: absent`). `evaluation.json` `llm.calls: 51`.
- Verdict: failed, `runtime.behavior`; Flow-reported `unexpected_state` /
  **`web.action.blocked_by_dialog`** (`events.ndjson` seq 4).
- **Stage reached: 6.** A Flow was created and ran; node 2 of 9 failed; recovery made 3
  interventions and no repair.
- Against run 16: 48 decisions (was 60), 49 build calls (61), $0.090 (0.114), 9 nodes (7), and
  the same failure at the same node, under the same dialog.

## Stage 1 — the instruction and the expected chain

- Instruction text withheld. Core read **2 instructed consequences**, `modify_existing` (switch
  the pickup store) and `create_new` (add two products to the cart, one of them in quantity
  two, each in a named size).
- A correct Flow (as in run 16's debug and t193's Stage 1): close the consent dialog; open the
  store chooser **and pick the instructed store**; reach the first product, choose its size,
  pickup and quantity, add to cart; reach the second product, choose its size and pickup, add to
  cart; no checkout.

## Stage 2 — exploration (the build)

From `logs/core.log` build-trace lines joined by iteration with `flow-lane.json`
`build.evidenceLoop.steps[]`. Draft ids `dN` number executed tool calls in order (including calls
answered from memory), Core's initial call as `d1`, and a rerun takes a new id. The numbering
checks out against every dry run: dry run 1 replays d2, d3, d7, d11, d13–d16 (the calls at 1, 2,
6, 10, 12–15); dry run 2 adds d20, d21, d24, d27, d30; dry run 3 replays d32; dry runs 4 and 5
replay d26 and d33.

| It | Decision | Call id | Node | Result / draft effect |
| --- | --- | --- | --- | --- |
| 0 | (Core's initial) | `initial.core.run_node` | snapshot | `web.action.rejected.not_at_start_location` (d1) |
| 1 | tool_call | `nav1` | `browser-navigate` | succeeded (d2 = **s1**) |
| 2 | tool_call | `dismiss1` | `dom-click` | **succeeded** (d3): the consent dialog's accept button. **Withdrawn at 40.** |
| 3 | tool_call | `store1` | `dom-click` | `target_unobserved` / `handle_not_in_packet` (d4) |
| 4–5 | tool_call ×2 | `obs2`, – | snapshot, from memory | (d5, d6) |
| 6 | tool_call | `store2` | `dom-click` | succeeded (d7 = **s2**, the header's pickup-store button, which opens the chooser) |
| 7–9 | tool_call ×3 | `store3`, –, – | snapshot, from memory ×2 | (d8–d10) |
| 10 | tool_call | `store4` | `dom-click` | succeeded (d11 = **s3**, a chooser's set-store button, list position 2 of 4) |
| 11 | tool_call | `store5` | snapshot | (d12) |
| 12 | tool_call | `store6` | `dom-click` | succeeded (d13 = **s4**, the header's store button again, now naming the store picked at 10) |
| 13 | tool_call | `store7` | `dom-click` | succeeded (d14 = **s5**, a set-store button, list position 1 of 4) |
| 14 | tool_call | `search1` | `dom-type` | succeeded (d15 = **s6**, the search field) |
| 15 | tool_call | `search2` | `dom-click` | succeeded (d16 = **s7**, the search button) |
| 16 | tool_call | `detect1` | `web.detect_repeating_structure` | `web.structure.detected` in 108 ms (d17) |
| 17 | tool_call | `extract1` | `dom-extract_list` | `web.inspect.succeeded` in 3017 ms (d18) |
| 18–22 | amend_draft ×5 | – | – | all on d18: amended (kept 8), amended (kept 8), `draft_unchanged` ×2, `draft_amendment_undone` (kept 9) |
| 23 | tool_call | `storecheck23` | snapshot | (d19) |
| 24 | amend_draft | – | – | d18 amended (kept 8) |
| **25** | **complete #1** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 1: reset, d2, **d3 `core.replay.unreproducible` (6537 ms)**, d7, d11, d13, d14, d15, d16 replayed |
| 26 | tool_call | `ptopen26` | `dom-click` | succeeded (d20, a result's product link) |
| 27 | tool_call | `nap250.27` | `dom-click` | succeeded (d21, a size option on the product page) |
| 28 | tool_call | `pt12.29` | `dom-click` | `web.action.rejected.target_not_found` in 5306 ms (d22) |
| 29 | tool_call | `napadd30` | `dom-click` | **`web.action.rejected.blocked_by_dialog`** in 4235 ms (d23): the product page's assistant card (see `07-mid-build-scenario.png`) |
| 30 | tool_call | `dismiss30` | `dom-click` | succeeded (d24, the card's close control) |
| 31 | tool_call | `cartcheck31` | snapshot | (d25) |
| 32 | tool_call | `napadd33` | `dom-click` | succeeded (d26 = **s8**, the product page's add-to-cart button; `pageState: unchanged`) |
| 33 | tool_call | `pt12add34` | `dom-click` | succeeded (d27, add-to-cart again) |
| 34–35 | tool_call ×2 | `cartcheck35`, – | snapshot, from memory | (d28, d29) |
| 36 | amend_draft (rerun) | `rerun.26` | `dom-click` | `draft_rerun` of d26 → succeeded (d30) |
| **37** | **complete #2** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 2: reset, d2, **d3 unreproducible (6489 ms)**, d7, d11, d13–d16 replayed, **d20 unreproducible (5854), d21 `core.replay.failed` (3281), d24 failed (2703), d27 unreproducible (5190), d30 unreproducible (5168)** |
| 38 | tool_call | `pt12add39` | `dom-click` | `target_not_found` in 5144 ms (d31) |
| 39 | tool_call | `pt12add40` | `dom-click` | succeeded (d32, a results list's add button, list position 2 of 5) |
| **40** | amend_draft | – | – | **withdrew d3, d20, d21, d24, d27, d30** (applied 6, kept 14): the consent dismissal, the product open, the size choice, the card close and both remaining add-to-cart presses |
| 41 | amend_draft | – | – | the same 6 plus d32: applied 6, refused 1 (d32), kept 8 (intent not traced) |
| **42** | **complete #3** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 3: reset, d2, d7, d11, d13–d16, d32, all replayed |
| 43 | amend_draft | – | – | d26, d27, d30: applied 1 (d26 is back in dry run 4), refused 2, kept 9 |
| 44 | amend_draft (rerun) | `rerun.32` | `dom-click` | `draft_rerun` of d32 → succeeded (d33 = **s9**) |
| 45 | amend_draft | – | – | d33: refused, `draft_unchanged` |
| **46** | **complete #4** | – | – | check **ok**; dry run 4: reset, d2, d7, d11, d13–d16 replayed, **d26 unreproducible (6201 ms)**, d33 replayed → **`llm_evidence_loop.dry_run_refused`** |
| **47** | **complete #5** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 5: same as 4, **d26 unreproducible (6187 ms)** |
| **48** | **complete #6** | – | – | check **ok, accepted**. **No dry run is logged for this completion**; the draft is revision 30, the same revision dry runs 4 and 5 found unreproducible at d26 |

Totals: 48 decisions = 30 tool_call (4 answered from memory) + 12 amend_draft (6 applied, 1 undone,
3 `draft_unchanged`, 2 reruns) + 6 complete. 33 tool calls (`toolCallCount: 33`): 18 `dom-click`
(14 succeeded, 4 rejected), 1 `dom-type`, 1 `browser-navigate`, 7 snapshots (6 ok), 1 list
extraction, 1 structure detection, 4 from memory.

- **Where decisions and time went without progress.** 5 of 6 completions were refused (4
  `instructed_act_missing`, 1 `dry_run_refused`). The 5 dry runs took 15.7, 38.0, 11.7, 17.3 and
  17.7 s: **100.4 s of the 223.7 s loop**. 7 replays were `unreproducible` at 5.2–6.5 s each.
  Three clicks were rejected after 4.2–5.3 s each. Six amendments (18–24) worked on the one list
  extraction d18, which never reached a dry run.
- **Did the draft grow?** Record count 1 → 21 (`draft.steps`); rendered size peaked at 3,954 of
  4,000 bytes (39). The draft's guidance shrank 1,052 → 618 → 154 bytes (30, 33); t193's cause E
  records this as by design. `withoutInput` rose 1 → 10 from 38. Kept steps: 8, 9, 8, 13, 14,
  then **8 after 41**, 9 at acceptance.
- The run ended at 48 of the 64-decision ceiling.

## Stage 3 — the proposed Flow

- Adaptation `adaptation.bootstrap.16e33432-8eca-467e-9b31-0b903dab2017`, `proposed`, Flow
  `flow.f93275b1-fa0c-493b-a377-84aac794dcb6`, `appliedMutationCount: 2`.
- Shape: 9 nodes, 1 `web.browser.navigate`, 7 `web.dom.click`, 1 `web.dom.type`, no extract node.
  Nodes `node.bootstrap.ab41f26639a29aae.main.s1`…`s9`:

| Node | Kind | Control (by kind) | From |
| --- | --- | --- | --- |
| s1 | navigate | start page | d2 |
| s2 | click | header store button (opens the chooser) | d7 |
| s3 | click | chooser set-store button, position 2 of 4 | d11 |
| s4 | click | header store button (opens the chooser again) | d13 |
| s5 | click | chooser set-store button, position 1 of 4 | d14 |
| s6 | type | search field (typed text withheld) | d15 |
| s7 | click | search button | d16 |
| s8 | click | product page add-to-cart button | d26 |
| s9 | click | results list add button, position 2 of 5 | d33 |

- Declared consequences: `s8` and `s9` claim `modify_existing`; `s1`–`s7` none. **`create_new`
  is claimed by no step**; the cross-check verdict is `undeclared` (`declared:
  [modify_existing]`, `undeclared: [create_new]`, `declaredNothing: 104` of 128).
- **What F5 changed, against run 16:** the store picks were **kept**. Run 16 withdrew every
  store click and accepted a Flow whose only store step opened the chooser. Here s3 and s5 are
  set-store presses, replayed successfully in all five dry runs. **Claimed: not shown.** Neither
  pick declares a consequence, and the trace does not say which step answered which act.
- **But the kept picks do not reach the instructed store.** s3 picks a store other than the
  starting one (the header after 10: `04-mid-build-scenario.png`). s5 then picks position 1,
  which puts the **starting store** back: the header shows the starting store after dry run 1
  (`07-mid-build-scenario.png`) and after dry run 5 (`14-mid-build-scenario.png`), both of
  which replayed s2–s5. Neither store is the instructed one. This matches t193 run 3 ("chose the
  wrong store twice").
- **What the Flow lacks:**
  - a consent-dialog dismissal (d3 was withdrawn at 40);
  - the instructed store;
  - a way to reach s8's product page. The product link d20 and size option d21 were withdrawn at
    40, so s8 follows the search results page, where dry runs 4 and 5 found it unreproducible;
  - any size or quantity choice.
  s9 presses the add button of the second search result. In `14-mid-build-scenario.png` that
  result is neither instructed product.
- **The dry run still does not start from playback's state.** Every reset kept the consent choice
  made at 2. No dialog appears after any reset (`07`, `11`, `12`, `14` scenario PNGs), while
  playback starts with it open (`15-flow-run-scenario.png`, `16-failure-scenario.png`). This is
  **why d3 was `unreproducible` in dry runs 1 and 2**: the replayed accept-button click found no
  dialog, and the model then withdrew d3 at 40. The resets also kept the cart. Its count rose
  from the seeded 1 to 3 (`11-mid-build-scenario.png`) and 4 (`12`, `14`), so exploration and
  dry-run presses changed the real cart.

## Stage 4 — playback

Runtime run `376ef90f-4b7b-4f6e-a3d9-4d56dabc816b`, route: subflow
`subflow.bootstrap.ab41f26639a29aae.main`, `fallbackUsed: true`, no rule, `stateObserved: false`.

| Attempt | Node | Started | ms | Status |
| --- | --- | --- | --- | --- |
| 0 | `main.s1` navigate | 06:26:15.397Z | 2191 | succeeded, `matched` |
| 1 | `main.s2` click | 06:26:18.727Z | 1948 | **failed `web.action.blocked_by_dialog`** (`unexpected_state`, stage `execution`, not retryable) |

- The click point 278,31 (the header store button, top left) landed on a layer that covers the
  target. The runtime described it as "a dialog is open over the page and asks for nothing only a
  person can give, so it has to be answered or closed". It absorbed `blocking_dialog` 4 times,
  waited 1350 ms and gave up. It did not close the dialog. Identical to run 16.
- Target resolution: extension `unresolved_no_candidates` (0 candidates); host resolution by
  selector, 4 candidates, best score 0.643, confidence 0.566 (the same figures as run 16).
- Evidence packets 5782, 5813, 5813, 5829 bytes, all truncated (budget invariant passed). Nodes
  s3–s9 never ran.

## Stage 5 — the answer

Not reached. No result check ran (`resultVerification: null`); `oracles.finalState: failed`,
`records: not_declared`.

## Stage 6 — recovery

`harnessRecovery`, `live-llm.json` `repair` and `decision-trace.json` `recoveryTrace`, recovery
06:26:22.391Z to 06:26:27.743Z (5.35 s):

| # | Intervention | Provider call | Outcome |
| --- | --- | --- | --- |
| 1 | `diagnosis` | none | `validationOk: false`, **`recovery.ladder_diagnosis_unanswered`** |
| 2 | `diagnosis` | `llm.runtime_diagnosis.28e224d2…` (gather), 5,515 in / 359 out | ok. `failureClass: unexpected_state`, `candidateKind: action_target_override`, `resolution: model_required`, `stillAchievable: yes`, `deterministicRecoveryPossible: yes` |
| – | `recovery_plan` | none | `steps: [request_patch]`, **`allowedPatchKinds: [temporary_target_override, temporary_wait_retry]`** |
| 3 | `runtime_patch` | `llm.runtime_patch.f5577059…` (implement), tokens not reported | **`llm.provider_output_invalid`**. Resolution `patch_failed`, `patchAttemptCount: 0`. Charged a 48,000 / 8,000-token reservation, $0.08333 |

- No adaptation, no change proposal, `refusalCode: null`, `permissionRequest: null`.
- Context sent: failure, expected/actual transition, flow graph, step parameters, state diff,
  failed target, recovery candidates. **Omitted for `byte_budget`: subflow, route context, recent
  nodes.** Run 16 included all three.
- Different from run 16: the patch call failed validation (`provider_output_invalid`) rather
  than being refused `target_unanchored`. Neither permitted patch kind can close a dialog, so the
  plan could not have repaired this failure either way.

## Causes

| # | Cause, precisely | Repo and file | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | **Playback died under the consent dialog.** The interference defence would not answer a consent wall, so s2 failed `web.action.blocked_by_dialog` after 4 absorbed attempts. This is run 16 cause 1 again. | extension `apps/extension/src/content/action-runtime/interference/{vocabulary.ts, way-out.ts, clear.ts}` (t195 tree) | **t195** (F1, its run 4) | Landed on dev after this run; live pending |
| 2 | **The dry-run reset keeps the consent choice (and the cart).** The replayed consent click therefore found no dialog: d3 was `core.replay.unreproducible` (6.5 s) in dry runs 1 and 2. The model then withdrew it at 40, and the accepted Flow cannot pass the dialog that playback starts with. This run shows the mechanism behind run 16 cause 2. | Core dry run (`runtime/flow-draft/dry-run.ts`, the `dryrun.N.reset` step), domain `src/runtime/llm-evidence/node-run/replay.ts` — NOT READ | **t174**: t193 records "dry run `core.replay.unreproducible`" as its cause D, owned by t174 (run 4, t174-w2) | Open; the mechanism is now evidenced |
| 3 | **The build accepted a Flow whose step failed the dry run.** Completion 48 was accepted with no dry run of its own, on draft revision 30. Dry runs 4 and 5 had both found s8 (d26) `unreproducible` on that revision, and completion 46 was refused `dry_run_refused` for it. | Core completion / dry-run gating (`runtime/llm/harness-options/bootstrap-completion.ts`, `runtime/flow-draft/dry-run.ts`) — NOT READ | none recorded by t193/t194/t195; nearest t174 (build acceptance) | Open (new) |
| 4 | **The kept store picks do not choose the instructed store.** Two picks, positions 2 then 1 of 4, switch to another store and back to the starting one. | extension `content/repeat-exemplars.ts`, domain `runtime/llm-evidence/look-alikes.ts` (t193 F); domain press result `runtime/llm-evidence/press.ts` (t193 F2) | **t193** (F, F2, its run 3, the same behaviour) | F fixed in t193 (unit), not in this tree; F2 a recommendation |
| 5 | **The instructed-acts check accepted with `create_new` claimed by no step**, and with no step declaring the store switch. Only the two add presses claim `modify_existing`. | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/check.ts` | **t174** (F6 item 3, assessed unsound without a domain per-step change class, `reports/t174-w13-act-claims.md`) | Open |
| 6 | **The amendment at 40 withdrew needed steps together**: the consent dismissal, the product open, the size choice, the card close and two add presses. s8 was then restored at 43 without the steps that reach its page. Nothing warned that a later step depends on a withdrawn step's page. Run 16 cause 4 again. | Core `runtime/llm/decision-handlers/amendment.ts` — NOT READ | none recorded; nearest t174 | Open |
| 7 | **Recovery cannot close a dialog, and the patch call failed**: the first diagnosis was unanswered with no call; the plan permitted only target override and wait-retry; the patch output was `llm.provider_output_invalid`. | Core recovery ladder, `runtime_patch` | t193's area (self-repair); not recorded in its log | Open |
| 8 | **A failed patch call is charged at its full reservation**: $0.08333 (48k/8k tokens `reserved`), which is 98% of the repair's reported cost and nearly the whole build's. | Core recovery LLM gate accounting — NOT READ | none recorded | Open (new) |
| 9 | **The diagnosis context loses the subflow, route context and recent nodes** to the 8,000-byte budget. | Core `runtime/recovery/{context.ts, context-summary.ts}` | **t194** (F4: lossless trims first) | Fixed in t194, merged in round 1, not in this tree |
| 10 | Decision efficiency: 5 of 6 completions refused, 100 s of dry runs, 4 answers from memory, 6 amendments on one extraction step, and 3 rejected clicks at 4–5 s each. | Core `runtime/llm/evidence-loop.ts`; `llm/evidence-loop/answered-request.ts` | t174 (run 13 cause C, run 16 cause 7); repeats: t193 cause C | Open |

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2 | Why completion 48 ran no dry run (reused, skipped, or not traced) | `progress-trace.ts` has no line for a dry run that is skipped or reused |
| 2 | Intent of each amendment (40 and 41 target the same 6 ids; 18–24 all target d18) | `progress-trace.ts` prints targets and counts only |
| 3 | Which step answered which act at 46 and 48, and which act 25, 37, 42 and 47 found missing | `progress-trace.ts` prints issue codes only |
| 3 | Whether the dry-run reset restores cookies, consent or cart. The pictures show that it does not; no field records it | no field in the dry-run trace |
| 4 | What the blocking layer was, as a code (it is only in the prose `actual`) | `failure` has no structured blocker kind |
| 2 | Which layer refused the click at 29 (`blocked_by_dialog` during the build) | build tool results carry the code only |
| 6 | Why the first diagnosis was unanswered with no provider call | `harnessRecovery.interventions[]` carries the code only |
| 6 | What was invalid in the patch output, and its real token use | `llm.provider_output_invalid` has no sub-reason; usage is `reserved`, not reported |
| UI | No picture between the failed click (06:26:20.7) and the repair settle (06:26:28.9), so whether the overlay showed repair is unknown | UI review cadence (moment 16 starts 06:26:28.978) |
| UI | Each PNG shows the state at the start of its 3 s overlay window, not at `moments[].at` (as in run 16) | UI review capture ordering or timestamping (Lab) |
| 1 | `activeTabUrl` (t185 row 1) | not recorded |

## UI review

Source: `run-munpwa5r-e7aefe04.ui-review.local.json`. It has 16 moments, 16 scenario and 16
panel pictures, `skipped: 0`, `skippedTicks: 0`, `failures: []`. The panel is `side-panel
(devtools target, type page)`, with `masked: 0` at every moment. The scenario tab was `inFront:
true` and the only entry in `frontTabs` at all 16. Overlay samples: 16 per moment, about 200 ms
apart, over 3 s.

### Screenshots opened (Read tool)

| PNG | What it shows |
| --- | --- |
| `run-munpwa5r-e7aefe04.ui-review.local/01-start-scenario.png` | Store home page with a centred **cookie-consent dialog** over it and the page's chat bubble bottom-right; cart count 1. No overlay (correct: before Core's first event). |
| `run-munpwa5r-e7aefe04.ui-review.local/01-start-panel.png` | Panel Simple tab: "Connected to FluxIQ", "Get set up" with **"Add an AI model key: To do"**, "RIGHT NOW: Nothing running", "What should FluxIQ do?". |
| `run-munpwa5r-e7aefe04.ui-review.local/03-mid-build-scenario.png` | Dialog still open (window start 06:22:18.4, before `dismiss1` ended at 06:22:21.4); overlay bottom-right "THINKING / Deciding the next step / Deciding the next step", over the page's chat bubble and a product card. |
| `run-munpwa5r-e7aefe04.ui-review.local/04-mid-build-scenario.png` | Dialog gone; header names a **different store** from the start (the pick at 10); overlay "THINKING / Deciding the next step" over a product card. |
| `run-munpwa5r-e7aefe04.ui-review.local/04-mid-build-panel.png` | **"RIGHT NOW: Done / Last step: Looked at the page"** while the build is deciding. |
| `run-munpwa5r-e7aefe04.ui-review.local/07-mid-build-scenario.png` | A product page after dry run 1: header shows the **starting store again**, a page assistant card bottom-right, and the overlay "EXPLORING / Using core.run_node" drawn **over the card's button**. |
| `run-munpwa5r-e7aefe04.ui-review.local/07-mid-build-panel.png` | "RIGHT NOW: FluxIQ is working / Clicking "<control>"" with Stop. |
| `run-munpwa5r-e7aefe04.ui-review.local/09-mid-build-panel.png` | "RIGHT NOW: FluxIQ is working / Clicking "<control>"" with Stop (during dry run 2). |
| `run-munpwa5r-e7aefe04.ui-review.local/11-mid-build-scenario.png` | Home page just after dry run 3's reset: no consent dialog, **cart count 3**, overlay "EXPLORING / Using core.run_node". |
| `run-munpwa5r-e7aefe04.ui-review.local/12-mid-build-scenario.png` | Home page during dry run 4's reset: no dialog, **cart count 4**, overlay "EXPLORING / Using core.run_node". |
| `run-munpwa5r-e7aefe04.ui-review.local/12-mid-build-panel.png` | "RIGHT NOW: FluxIQ is working / Opening a page" with Stop. The panel names the reset; the overlay says only "Using core.run_node". |
| `run-munpwa5r-e7aefe04.ui-review.local/14-mid-build-scenario.png` | Search results after dry run 5 (starting store in the header, cart 4); overlay **"VERIFYING / The proposed result passed its check / Completion check"**. |
| `run-munpwa5r-e7aefe04.ui-review.local/14-mid-build-panel.png` | "RIGHT NOW: Done / Last step: Clicked "<control>"". |
| `run-munpwa5r-e7aefe04.ui-review.local/15-flow-run-scenario.png` | Start page before playback's first node, **consent dialog open again**, cart 1; overlay "DONE / Build finished: a Flow is proposed / Build finished". |
| `run-munpwa5r-e7aefe04.ui-review.local/15-flow-run-panel.png` | Panel still "Done / Last step: Clicked "<control>"": nothing about the run that is starting. |
| `run-munpwa5r-e7aefe04.ui-review.local/16-failure-scenario.png` | Start page, **consent dialog still open** (the layer that blocked s2); overlay "FAILED / Run failed / Run failed". |
| `run-munpwa5r-e7aefe04.ui-review.local/16-failure-panel.png` | Panel **"RIGHT NOW: Done / Last step: Looked at the page"** after the run failed. |

### Overlay per moment

Rates are per second over the window of about 3.0 s. Phase changes count transitions of the phase
label between samples, including to or from absent. `textChanges`, `presenceToggles` and
`visibilityToggles` are as `summary.overlay` reports them.

| # | Label | Window start | Status | present/samples | textChanges | presenceToggles | visibilityToggles | Phase changes/s | Text changes/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | start | 06:21:58.378 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 2 | mid-build | 06:22:01.403 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 3 | mid-build | 06:22:18.389 | changed | 16/16 | 1 | 0 | 0 | 0.33 | 0.33 |
| 4 | mid-build | 06:22:38.462 | flickering | 16/16 | 3 | 0 | 0 | 1.00 | 1.00 |
| 5 | mid-build | 06:22:58.454 | changed | 16/16 | 2 | 0 | 0 | 0.33 | 0.66 |
| 6 | mid-build | 06:23:18.454 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 7 | mid-build | 06:23:38.465 | changed | 16/16 | 2 | 0 | 0 | 0.33 | 0.67 |
| 8 | mid-build | 06:23:58.482 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 9 | mid-build | 06:24:18.481 | changed | 14/16 | 0 | 1 | 1 | 1.00 | 0.00 |
| 10 | mid-build | 06:24:38.486 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 11 | mid-build | 06:24:58.509 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 12 | mid-build | 06:25:18.523 | flickering | 15/16 | 0 | 2 | 2 | 0.66 | 0.00 |
| 13 | mid-build | 06:25:38.581 | flickering | 15/16 | 0 | 2 | 2 | 0.66 | 0.00 |
| 14 | mid-build | 06:25:58.579 | changed | 16/16 | 1 | 0 | 0 | 0.33 | 0.33 |
| 15 | flow-run | 06:26:12.594 | changed | 16/16 | 2 | 0 | 0 | 0.33 | 0.67 |
| 16 | failure | 06:26:28.978 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |

Moment 9 went present, absent, present, absent (samples 3 and 16), which is 3 phase changes.
The summary counts 1 presence toggle for it.

Texts shown (phase | headline | sub-line):
- "Thinking | Deciding the next step | Deciding the next step"
- "Exploring | Using core.run_node | Using core.run_node"
- "Exploring | Using core.run_node: web.inspect.succeeded | Using core.run_node"
- "Exploring | Using core.run_node: web.action.rejected.target_not_found | Using core.run_node"
- **"Verifying | The proposed result passed its check | Completion check"** (new since run 16)
- "Done | Build finished: a Flow is proposed | Build finished"
- "Running | Run started | Run started"
- **"Running · Step 1 of 9 | Running step 1 of 9: node.bootstrap.ab41f26639a29aae.main.s1 |
  node.bootstrap.ab41f26639a29aae.main.s1"**
- "Failed | Run failed | Run failed"

Each rendering also carries "FluxIQ".

Panel RIGHT NOW texts: "Nothing running"; "Done / Last step: Looked at the page"; "FluxIQ is
working / Clicking "<control>"" with Stop; "FluxIQ is working / Opening a page" with Stop; "Done /
Last step: Clicked "<control>"".

Fidelity to Core's events, checked against `core.log`:
- Moment 3: Thinking until 06:22:19.589 (decide 2 ended 19.529), then Exploring from 19.831
  (`dismiss1` started 19.662).
- Moment 4: a single Exploring sample at 40.274 for `store5`, a 110 ms snapshot that ended at
  40.218.
- Moment 5: the `web.inspect.succeeded` result of `extract1` (ended 59.403) appeared at 59.475;
  Thinking followed at 59.664 (decide 18 started 59.472).
- Moment 7: `target_not_found` of `pt12.29` (ended 39.797) appeared at 39.874.
- Moments 12 and 13: the one-sample drop-outs at 06:25:19.724 and 06:25:39.589 follow the dry-run
  resets that ended at 19.587 and 39.502. Moment 9's drop-outs fall within dry run 2's page
  loads.
- Moment 14: "Verifying" was on screen from at least 06:25:58.579 to 06:26:01.387. The accepting
  check passed at 06:25:56.996; Done appeared at 06:26:01.583, before the Lab's settle event at
  06:26:02.935.
- Moment 15: Done until 06:26:13.395; Running at 06:26:13.613, after the runtime run started at
  06:26:13.522.

The overlay never showed a phase Core had not emitted. All five dry runs read "Exploring | Using
core.run_node" (moments 6, 9, 11–13).

### Overlay DOM state

- One host (`hostCount` 0 or 1), `display: block`, `visibility: visible`, `opacity: 1`,
  `inViewport: true` whenever present, `documentVisibility: visible` throughout.
- Attributes: `data-fluxiq-activity=""`, `aria-hidden="true"`, `inert=""`.
- Rect: x 947, y 620.36, 300 × 83.64; 300 × 102.48 at y 601.52 once the step line appears
  (moment 15).
- Absent at moments 1–2 (before the build loop started at 06:22:13.336). One-sample drop-outs on
  page loads at moments 9, 12 and 13. Present through all 16 samples of the failure moment.

### Panel

Side panel, verified open, Simple tab. The first screen is laid out as in runs 15 and 16:
- the status card;
- "Get set up" with **"Add an AI model key: To do"**;
- the RIGHT NOW card;
- "What should FluxIQ do?".

The panel PNGs opened (01, 04, 07, 09, 12, 14, 15, 16) show RIGHT NOW as follows:
- "Nothing running" at start.
- **"Done / Last step: Looked at the page" at moment 4, while the build was deciding.**
- "FluxIQ is working" with Stop at moments 7, 9 and 12.
- "Done / Last step: Clicked "<control>"" from the build's end through playback.
- **"Done / Last step: Looked at the page" after the failure.**

No chat, tool rows or Core turns are visible in any panel picture opened. Panels 02, 03, 05, 06,
08, 10, 11 and 13 were not opened.

### UI defects found

U1–U9 are the defects in `reports/t174-live-lane.md` "Runs 14-17".

| # | Defect | Recurs? | Evidence |
| --- | --- | --- | --- |
| U1 | **Raw ids in the overlay**: tool ids and result codes as headlines, and the internal node id as the step name ("Running step 1 of 9: node.bootstrap.ab41f26639a29aae.main.s1"). | recurs | `run-munpwa5r-e7aefe04.ui-review.local/07-mid-build-scenario.png`, `…/11-mid-build-scenario.png`; JSON moments 5, 7, 15 |
| U2 | **Headline repeated as the sub-line** ("Deciding the next step" ×2, "Using core.run_node" ×2, "Run failed" ×2). | recurs | `…/03-mid-build-scenario.png`, `…/16-failure-scenario.png` |
| U3 | **The overlay covers the page's bottom-right widgets**: chat bubble, product cards, and the assistant card's button. | recurs | `…/03-mid-build-scenario.png`, `…/07-mid-build-scenario.png` |
| U4 | **Panel RIGHT NOW contradicts the overlay**: "Done" mid-build, "Done" while the Flow starts, "Done" after the run failed. | recurs | `…/04-mid-build-panel.png` vs `…/04-mid-build-scenario.png`; `…/15-flow-run-panel.png`; `…/16-failure-panel.png` vs `…/16-failure-scenario.png` |
| U5 | **"Add an AI model key: To do"** during a live build. | recurs | every panel PNG opened, e.g. `…/01-start-panel.png` |
| U6 | Control name joined without a separator. | **not observed** in the panels opened (07 and 09 quote single-part names) | – |
| U7 | **Flicker**: up to 1.0 phase changes/s (moment 4: Exploring 11 ms after a tool ended, then a single-sample Exploring for a 110 ms tool). The overlay drops out for one sample on each dry-run page load. | recurs | JSON moments 4, 9, 12, 13 |
| U8 | **The failure gives no reason on screen**: the overlay says only "Run failed" and the panel says "Done", although Core knew a dialog blocked the step. The repair phase was not pictured. | recurs | `…/16-failure-scenario.png`, `…/16-failure-panel.png` |
| U9 | Nothing tells the person a robot check is waiting. | not applicable (no robot check in this run) | – |
| U10 | **Dry runs look like exploring.** Five dry runs (100 s) read "Exploring / Using core.run_node", with nothing saying FluxIQ is checking its draft from the start. The panel says "Opening a page" at a reset. | new | `…/11-mid-build-scenario.png`, `…/12-mid-build-scenario.png` vs `…/12-mid-build-panel.png` |
| U11 | **"The proposed result passed its check" is shown for about 4.6 s** for a Flow whose step s8 failed the two dry runs just before, and which then failed at step 2. The words repeat Core's completion check and overstate it. | new (minor) | `…/14-mid-build-scenario.png`; JSON moment 14 |

## t185 checklist

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Partly confirmed.** stderr `[lab] live panel: side-panel (verified open)`; `snapshots/live-panel.json` = `{"mode":"side-panel"}`; the panel page captured at all 16 moments; scenario tab `inFront: true`, only the scenario in `frontTabs` at every moment. **Beside the page on screen: no evidence** (separate captures). **`activeTabUrl`: no evidence.** | full log; `snapshots/live-panel.json`; UI review JSON |
| 2 | Overlay from real events | **Confirmed.** Absent before Core's first event (moments 1–2 end 06:22:04.4; loop start 06:22:13.336). Present in the top frame. `thinking`/`exploring` during the build, `verifying` at the accepting check, `done` at build settle, `running` with "Step 1 of 9" at playback, `failed` at settle. Every phase seen matches a `core.log` event in time (moments 3, 4, 5, 7, 14, 15). Repair phase: no picture (gap). | UI review JSON; `logs/core.log`; PNGs 03, 14, 15, 16 |
| 3 | No interference | **Partly confirmed.** Host marked `data-fluxiq-activity`, `aria-hidden`, `inert`. The playback refusal (s2) was the page's consent dialog at point 278,31, top left, **not** the overlay. The build-time `blocked_by_dialog` at 29 was followed by a successful close of a page control (30) and a successful add (32). That points to the page's assistant card, but the layer is not recorded (gap). Snapshots, blockers, interference sentences and `dom.mutation`: **no evidence** (not exported). | `flow-lane.json` `failure`; `core.log`; `07-mid-build-scenario.png` |
| 4 | Chat | **Contradicted for the header; no evidence for the rest.** RIGHT NOW said "Done" mid-build, at playback and after failure (U4). No tool/step rows, turns or typed instruction visible or sent. | `04-mid-build-panel.png`, `15-flow-run-panel.png`, `16-failure-panel.png` |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (273 lines, 265 build-trace) has no error, warn, outbound or `server.activity` line. `outbound` growth: not logged. | `logs/core.log` |
