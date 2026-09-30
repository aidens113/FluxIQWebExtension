# Run debug — `run-muntmwvx-0d53884a` (live run 20)

Worker t174-w18, 2026-09-30. Read from the bundle at
`test-runs/instances/t174-slot-1/run-muntmwvx-0d53884a`, its UI review
(`test-runs/instances/t174-slot-1/run-muntmwvx-0d53884a.ui-review.local.json` and the PNG folder
`run-muntmwvx-0d53884a.ui-review.local/`), the bundle's whole-window JPGs (`screenshots/`), and the
launcher's full Lab stdout (`live-run-20.full.log`, in the supervisor's scratchpad, not in the
repository). The scenario source under `apps/scenario-lab/src/scenarios/bigbox-retail/` and the
extension's interference defence under `apps/extension/src/content/action-runtime/interference/` were
read, not changed. No product code changed. Privacy: only codes, counts, ids, node ids, durations,
timestamps and FluxIQ's own UI strings. Pages, dialogs and controls are named by kind; no instruction
text, page text, accessible names, store or product names, extracted values or provider bodies.
Model-authored call ids are not quoted, because they carry instruction words (cause 10).

---

## Header

- Run id: `run-muntmwvx-0d53884a`
- Scenario / variant / task: `bigbox-retail` / none / `bigbox-retail-pickup-cart` (`form`,
  judged by playback goal `build-pickup-cart`). The instruction is 330 characters, sha256
  `8da0b9f6…3d43d3` (`snapshots/flow-lane.json` `task`), the same instruction as runs 16 and 18.
- Repositories (`run.json`): facility `76e5e76` (dirty), Core `e75dcf2` (clean), both the t174 tree
  on the round-1 merged build. Chromium 134.0.6998.35, 1280×720, seed 239. Ports: scenario 62076,
  web 62077, gateway 62078. Every prelude build step was `reused` from its stamp (full log).
- Lab span 08:06:20.171Z to 08:11:21.224Z (`summary.json`), `durationMs: 300140`
  (`evaluation.json`).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. Authorized: `maxCalls: 64`,
  48k in / 8k out / 56k per call, $0.25 per call, $2 total.
- Calls, cost:
  - Build: **32 calls** (31 loop decisions + 1 unrecorded call), 506,217 in / 3,302 out tokens,
    **$0.06344**, `budgetBreaches: 0`. The largest call had 17,496 input tokens (decision 23).
  - Repair: 2 calls (`runtime_diagnosis` gather 4,630 / 378; `runtime_patch` implement 5,590 / 184),
    **$0.00329**, both charged as `reported`. Run 18's full-reservation charge (its cause 8) did
    **not** recur.
  - Result check: none (`verification.source: absent`). `evaluation.json` `llm.calls: 34`.
- Verdict: failed, `runtime.behavior`; Flow-reported `unexpected_state` /
  **`web.action.blocked_by_dialog`** (`events.ndjson` seq 20).
- **Stage reached: 6.** A Flow was created and ran; 11 steps succeeded and node 12 of 16 failed;
  recovery made 3 interventions and no repair.
- Against run 18: 31 decisions (was 48), 32 build calls (49), $0.063 (0.090), 16 nodes (9), and the
  failure moved from node 2 (consent wall) to node 12 (a different layer, see below).

## Timeline

| Time (UTC) | Event | Source |
| --- | --- | --- |
| 08:06:20.171 | Lab start | `summary.json` |
| 08:06:55.235 | Dispatch (`runtime.dispatch`) | `events.ndjson` seq 1 |
| 08:07:12.227 | Build loop start; Core's initial call refused `not_at_start_location` | `logs/core.log` |
| 08:07:13.648–08:08:14.137 | Exploration, decisions 1–21 | `logs/core.log` |
| 08:08:15.827 | Completion #1 (decision 22), check ok | `logs/core.log` |
| 08:08:15.875–08:08:53.321 | Dry run 1 (37.4 s) → `llm_evidence_loop.dry_run_refused` | `logs/core.log` |
| 08:08:56.590 | Completion #2 (24), refused `bootstrap.instructed_act_missing` | `logs/core.log` |
| 08:08:56.610–08:09:25.680 | Dry run 2 (29.1 s), run **after** the refusal | `logs/core.log` |
| 08:09:35.015 | Completion #3 (30), refused `bootstrap.instructed_act_missing`, no dry run | `logs/core.log` |
| 08:09:36.862 | Completion #4 (31), check ok, **accepted with no dry run** | `logs/core.log` |
| 08:09:54.362 | Build settle | `events.ndjson` seq 13 |
| 08:10:19.258 | Runtime run `17b72cad-24b5-4bdc-ba76-c8c6410ed940` starts | `decision-trace.json` |
| 08:10:25.123 | `main.s1` navigate | `run.json` `actions` |
| 08:10:42.475–08:10:44.328 | `main.s12` click fails `web.action.blocked_by_dialog` | `flow-lane.json` `actions[11]` |
| 08:10:45.484 | Runtime run ends `failed` | `decision-trace.json` |
| 08:10:49.983–08:10:58.033 | Recovery (8.05 s) | `decision-trace.json` `recoveryState` |
| 08:11:03.656 | Repair settle | `events.ndjson` seq 19 |
| 08:11:04.350 | Error event | `events.ndjson` seq 20 |
| 08:11:08.105 | Final capture | `events.ndjson` seq 21 |

Build loop 144.6 s (loop start to acceptance); `build.durationMs: 162195`.

## Stage 1 — the instruction and the expected chain

- Instruction text withheld. Core read **2 instructed consequences**, `modify_existing` (switch the
  pickup store) and `create_new` (add two products to the cart, the first in quantity two, each in a
  named size, both for pickup).
- A correct Flow (t193's Stage 1 for this task, `reports/t193-live-self-repair.md`): pass the consent
  dialog; open the store chooser and pick the instructed store **first**; reach the first product,
  choose its size, pickup and quantity two; **close the support card if it is open**; press the pinned
  add-to-cart button; reach the second product, choose its size and pickup, add to cart; no checkout.
  t193 names the support card as a step of the correct Flow because the scenario opens it on every
  product page (see "Which dialog blocked step 12").

## Stage 2 — exploration (the build)

From `logs/core.log` build-trace lines joined by iteration with `flow-lane.json`
`build.evidenceLoop.steps[]`. Draft ids `dN` number executed tool calls in order, Core's initial call
as `d1`. The numbering checks against both dry runs: dry run step `dryrun.1.N` replays `dN`, and dry
run 1 replays d2, d3, d7–d12, d14, d16, d18–d21.

| It | Decision | Node | Result / draft effect |
| --- | --- | --- | --- |
| 0 | (Core's initial) | snapshot | `web.action.rejected.not_at_start_location` (d1) |
| 1 | tool_call | `browser-navigate` | succeeded (d2 = **s1**) |
| 2 | tool_call | `dom-click` | succeeded (d3 = **s2**, the consent dialog's accept button) |
| 3 | tool_call | `dom-click` | `web.action.rejected.target_unobserved` / `handle_not_in_packet` in 179 ms (d4) |
| 4–5 | tool_call ×2 | snapshot ×2 | `web.inspect.succeeded` (d5, d6) |
| 6 | tool_call | `dom-click` | succeeded in 2577 ms (d7 = **s4**, the header's pickup-store button, opens the chooser) |
| 7 | tool_call | `dom-click` | succeeded in 2772 ms (d8 = **s5**, a chooser's set-store button, list position 3 of 4) |
| 8 | tool_call | `dom-type` | succeeded (d9 = **s7**, the search field; text withheld) |
| 9 | tool_call | `dom-click` | succeeded (d10 = **s8**, the search button) |
| 10 | tool_call | `dom-click` | succeeded (d11 = **s9**, a result's product link) |
| 11 | tool_call | `dom-click` | succeeded (d12 = **s10**, a size option on the product page) |
| **12** | tool_call | `dom-click` | **`web.action.rejected.blocked_by_dialog` in 3020 ms** (d13): the pinned add-to-cart button under the support card |
| 13 | tool_call | `dom-type` | succeeded (d14 = **s11**, the search field again, typed for the second product while still on the first product's page) |
| **14** | tool_call | `dom-click` | **succeeded in 2234 ms (d15): the support card's close control** |
| 15 | tool_call | `dom-click` | succeeded (d16 = **s12**, the pinned add-to-cart button; `pageState: unchanged`) |
| 16 | tool_call | `dom-click` | `target_unobserved` / `handle_not_in_packet` in 118 ms (d17) |
| **17** | amend_draft | – | targeted d17 and **d15**: applied 1, refused 1, kept 10. **d15 appears in no dry run and in no Flow node** |
| 18 | tool_call | `dom-click` | succeeded (d18 = **s13**, the search button) |
| 19 | tool_call | `dom-click` | succeeded (d19 = **s14**, the second product's link) |
| 20 | tool_call | `dom-click` | succeeded (d20 = **s15**, a size option) |
| 21 | tool_call | `dom-click` | succeeded (d21 = **s16**, add-to-cart; `pageState: unchanged`) |
| **22** | **complete #1** | – | check **ok**. Dry run 1: reset, d2 replayed, **d3 `core.replay.unreproducible` (6530 ms), d7 unreproducible (5454), d8 `core.replay.failed` (1270)**, d9, d10 replayed, **d11 unreproducible (5897), d12 failed (3293)**, d14 replayed, **d16 unreproducible (6345)**, d18–d21 replayed → **`llm_evidence_loop.dry_run_refused`** |
| 23 | amend_draft | – | targeted d3, d7, d8, d11, d12, d16: applied 6, kept 14 |
| **24** | **complete #2** | – | **refused `bootstrap.instructed_act_missing`** (`withoutInput: 2`). Dry run 2 still ran: reset, d2, **d3 unreproducible (6549 ms), d7 unreproducible (5503), d8 failed (1325)**, d9–d12, d14, d16, d18–d21 all replayed |
| 25 | amend_draft | – | d7, d11: applied 2 |
| 26 | amend_draft | – | d7, d12, d16: applied 2, refused 1 (`withoutInput: 1`) |
| 27–29 | amend_draft ×3 | – | d7, d11 each time: `llm_evidence_loop.draft_unchanged` (refused 2) |
| **30** | **complete #3** | – | **refused `bootstrap.instructed_act_missing`**, no dry run |
| **31** | **complete #4** | – | check **ok, accepted**. **No dry run** on draft revision 22; the last dry run (2) was on revision 20, before amendments 25 and 26 |

Totals: 31 decisions = 20 tool_call + 7 amend_draft (4 applied, 3 `draft_unchanged`) + 4 complete.
21 tool calls (`toolCallCount: 21`): 15 `dom-click` (12 succeeded, 3 rejected), 2 `dom-type`,
1 `browser-navigate`, 3 snapshots (2 ok, Core's initial refused).

- **Where decisions and time went without progress.** 3 of 4 completions were refused (1
  `dry_run_refused`, 2 `instructed_act_missing`). The 2 dry runs took 37.4 and 29.1 s: **66.5 s of the
  144.6 s loop**; dry run 2 ran after its completion had already been refused. 6 replays were
  `unreproducible` at 5.5–6.5 s each. Amendments 27–29 repeated the same targets with no change.
- **Why d3, d7 and d8 never replayed.** Both resets kept the consent choice made at 2 and the store
  set at 7 (the header names the instructed store after the reset, `13-flow-run-scenario.png` shows
  the playback state instead; see Stage 3). This is run 18's cause 2 again.
- **Draft size**: records 1 → 18; rendered size peaked at 3,991 of 4,000 bytes (24).
  `instructionBytes` fell 1,019 → 772 → 177 (20, 21), the draft guidance's three lengths (t193 E).

## Stage 3 — the proposed Flow

- Adaptation `adaptation.bootstrap.6bdda99f-7b25-4204-b804-8809c42e18b1`, `proposed` then `applied`
  (`decision-trace.json`), Flow `flow.848c1aef-03ff-4fb6-8c91-e3759af7dea1`, `appliedMutationCount: 2`.
- Shape: 16 nodes, 14 action nodes: 1 `web.browser.navigate`, 11 `web.dom.click`, 2 `web.dom.type`,
  and 2 `builtin.control.merge`; no extract node. Route: subflow
  `subflow.bootstrap.09f73b73c085cb90.main` (fallback, no rule, `stateObserved: false`). Nodes
  `node.bootstrap.09f73b73c085cb90.main.s1`…`s16`; parameters withheld (selectors, URL, typed text):

| Node | Definition id | Control (by kind) | From | Routing |
| --- | --- | --- | --- | --- |
| s1 | `web.output.browser-navigate` | start page | d2 | → s2 |
| s2 | `web.output.dom-click` | consent dialog's accept button | d3 | → s3 |
| s3 | `builtin.control.merge` | – | – | joins after s2 |
| s4 | `web.output.dom-click` | header store button (opens the chooser; shadow host 1) | d7 | → s5 |
| s5 | `web.output.dom-click` | chooser set-store button, position 3 of 4 (shadow host 1) | d8 | → s6 |
| s6 | `builtin.control.merge` | – | – | joins after s4–s5 |
| s7 | `web.output.dom-type` | search field | d9 | → s8 |
| s8 | `web.output.dom-click` | search button | d10 | → s9 |
| s9 | `web.output.dom-click` | first product's result link | d11 | → s10 |
| s10 | `web.output.dom-click` | size option | d12 | → s11 |
| s11 | `web.output.dom-type` | search field (second product's term) | d14 | → s12 |
| s12 | `web.output.dom-click` | pinned add-to-cart button | d16 | → s13 |
| s13 | `web.output.dom-click` | search button | d18 | → s14 |
| s14 | `web.output.dom-click` | second product's result link | d19 | → s15 |
| s15 | `web.output.dom-click` | size option | d20 | → s16 |
| s16 | `web.output.dom-click` | add-to-cart button | d21 | end |

  The graph's edges are not in the bundle. The two merges sit after the consent step and after the
  store steps, the three steps the dry runs found unreproducible; that they close conditional
  (optional) spans is inferred from their placement, not recorded. In playback every node ran in
  order s1…s12.
- Declared consequences: `modify_existing` only; the cross-check verdict is `undeclared`
  (`declared: [modify_existing]`, `undeclared: [create_new]`, `declaredNothing: 80` of 102). The
  panel asked the person about exactly this ("Apply it as it stands?"); the Lab applied it.
- **What improved against runs 16 and 18:**
  - **The store pick is right.** s5 picks list position 3 of 4, and the header names the instructed
    store after it, during the build (`04-mid-build-scenario.png`) and in playback
    (`13-flow-run-scenario.png`). t193's F (one listed button per store, with its card's words) is
    **live-confirmed** here.
  - **The consent step is kept** (s2), so playback passed the consent wall **by the Flow's own
    accept click**, not by t195's F1. F1's decline-first defence was **not exercised** in this run.
- **What the Flow still lacks:**
  - **a close of the support card** before s12 (d15 was taken out at 17);
  - a quantity step: the first product is instructed in quantity two and the Flow adds it once;
  - a pickup choice for either product (the product page may default to pickup; not verified);
  - `create_new` is claimed by no step.
  So even with the card closed, the final cart would not have met the goal.
- **The dry run could not have caught the missing close.** Pressing the card's close control sets
  the scenario's card state to dismissed on the server (`client/shell-script.ts:125`,
  `state/mutate-state.ts:45`), and the dry-run resets kept scenario state (the consent choice was
  kept: d3 unreproducible in both). So the card could not reappear in a dry run. Playback starts from
  the seeded state, where the card is pending (`state/initial-state.ts:15`), and
  `12-flow-run-scenario.png` shows that seeded state: consent dialog open, starting store, cart 1.

## Stage 4 — playback

Runtime run `17b72cad-24b5-4bdc-ba76-c8c6410ed940`, 08:10:19.258Z to 08:10:45.484Z.

| Attempt | Node | Started | ms | Status | Host resolution (candidates, best, confidence) |
| --- | --- | --- | --- | --- | --- |
| 0 | `main.s1` navigate | 08:10:25.123Z | 2269 | succeeded, `matched` | – |
| 1 | `main.s2` click | 08:10:28.578Z | 779 | succeeded | 1, 0.643, 0.566 |
| 2 | `main.s3` merge | 08:10:30.546Z | 0 | succeeded | – |
| 3 | `main.s4` click | 08:10:30.546Z | 1203 | succeeded | 4, 0.643, 0.566 |
| 4 | `main.s5` click | 08:10:32.928Z | 691 | succeeded | 1, 0.643, 0.566 |
| 5 | `main.s6` merge | 08:10:34.791Z | 0 | succeeded | – |
| 6 | `main.s7` type | 08:10:34.792Z | 339 | succeeded | 1, 1.0, 0.88 |
| 7 | `main.s8` click | 08:10:36.291Z | 426 | succeeded | 1, 0.76, 0.714 |
| 8 | `main.s9` click | 08:10:37.889Z | 295 | succeeded | 1, 0.643, 0.566 |
| 9 | `main.s10` click | 08:10:39.348Z | 605 | succeeded | 1, 0.643, 0.566 |
| 10 | `main.s11` type | 08:10:41.087Z | 246 | succeeded | 1, 1.0, 0.88 |
| 11 | `main.s12` click | 08:10:42.475Z | 1853 | **failed `web.action.blocked_by_dialog`** (`unexpected_state`, stage `execution`, not retryable) | 1, 1.0, 0.88 |

- Every step's extension-side resolution was `unresolved_no_candidates` (0 candidates); the host
  resolved each by selector.
- **s12's failure**: the click point 1129,668 (the pinned add-to-cart button, bottom right) landed on
  a layer covering the target. The runtime's own account: "a layer over the page" whose controls are a
  close glyph and a chat-open button; "a dialog is open over the page and asks for nothing only a
  person can give, so it has to be answered or closed". It absorbed `blocking_dialog` 4 times, waited
  1350 ms and gave up. It did not close the layer.
- Evidence packets 5582–5913 bytes, all 20 truncated (budget invariant passed). Nodes s13–s16 never
  ran.

## Which dialog blocked step 12

**The product page's proactive support-chat card: a virtual-assistant chat invitation (a promotion
kind of interruption), not consent, not a store confirmation, not a challenge. It has its own way
out: a close glyph in its top-right corner.** Its second control opens the chat; that is not a way
out.

Evidence:
- `flow-lane.json` `actions[11].failure.actual` names the covering layer's two controls (a close
  glyph and a chat-open button), the point 1129,668, and a layer the classifier read as a dialog that
  asks nothing only a person can give.
- `14-flow-run-scenario.png` (recovery, 08:10:53.9) and `15-failure-scenario.png` (08:11:04.4): the
  first product's page, the instructed store in the header, and a white card with a close glyph and
  one button over the bottom-right corner, covering the pinned add-to-cart button. No other layer is
  open. The FluxIQ overlay sits bottom-left and does not cover the card or the button.
- During the build, `05-mid-build-scenario.png` (08:07:55.3, just after d15) shows the same page with
  the card closed and only the small chat pill left; the pinned add-to-cart is uncovered.

The scenario source:
- `shell/support-chat.ts`: the support widget, in its own open shadow root under a custom element,
  on every page. The card is `position: fixed`, `right: 16px; bottom: 16px`, 360×210, `z-index: 910`.
  The file's own comment: on a product page it opens in that corner a few seconds after load, over
  the pinned add-to-cart, until someone closes it.
- `client/shell-script.ts:18`: `CHAT_CARD_DELAY_MS = 3_000`; `:134-136`: it opens only on a product
  page while the state's card is `pending` and the chat panel is closed; `:125`: the close glyph
  hides it and posts `dismiss-chat-card`.
- `state/initial-state.ts:15`: seeded `chatCard: "pending"`; `state/mutate-state.ts:45`: the
  mutation makes it `dismissed`, which then holds for the rest of that state's life.
- **When it appears here:** s9 opened the product page at 08:10:37.889 (295 ms); the card was due
  about 3 s after load, about 08:10:41.2. s10 (08:10:39.3) ran before it; s12 at 08:10:42.475 met it.
  In the build the same happened at decision 12 (page opened 08:07:41.1, press at 08:07:46.1).

**Why the runtime's defence did not close it** (read from source, not observed): the defence runs
one layer up from the refused click and no longer has the blocked point. It looks for layers with
`overlaysOverPage()` (`interference/overlays.ts`), which hit-tests seven fixed viewport points: the
centre and points at 8%, 25%, 75% and 92% along the middle lines. At 1280×720 those are (640,360),
(640,57), (640,662), (102,360), (1177,360), (640,180) and (640,540). The card spans about x 904–1264,
y 494–704. **No probe lands on it**, so no layer is found and nothing is pressed, although the close
glyph would match the allow-list (`vocabulary.ts` `CLOSE_GLYPH`, and `way-out.ts` descends into open
shadow roots). The classifier, which did get the point (`overlaysAt(blockedAt)`), found the layer
and named its controls. So the classifier and the clearer disagree about the same layer.

## Stage 5 — the answer

Not reached. No result check ran (`resultVerification: null`); `oracles.finalState: failed`,
`records: not_declared`.

## Stage 6 — recovery

`harnessRecovery`, `live-llm.json` `repair` and `decision-trace.json` `recoveryTrace`, recovery
08:10:49.983Z to 08:10:58.033Z (8.05 s):

| # | Intervention | Provider call | Outcome |
| --- | --- | --- | --- |
| 1 | `diagnosis` | none | `validationOk: false`, **`recovery.ladder_diagnosis_unanswered`** |
| 2 | `diagnosis` | `llm.runtime_diagnosis.66d61a29…` (gather), 4,630 in / 378 out | ok. `failureClass: unexpected_state`, `candidateKind: action_target_override`, `resolution: model_required`, `requiredPriorAction: none`, `stillAchievable: yes`, `deterministicRecoveryPossible: yes`, confidence 0.72 |
| – | `recovery_plan` | none | `steps: [request_patch]`, **`allowedPatchKinds: [temporary_target_override, temporary_wait_retry]`**; exploration `skipped` |
| 3 | `runtime_patch` | `llm.runtime_patch.f9f4c5de…` (implement), 5,590 in / 184 out | **`llm_output.unexpected_field`, `llm_output.unsupported_runtime_patch`, `llm_output.invalid_risk`**. Resolution `patch_failed`, `patchAttemptCount: 0` |

- No adaptation, no change proposal, `refusalCode: null`, `permissionRequest: null`.
- **Context sent: only `failure`, `expected_transition`, `actual_transition`.** Omitted for
  `byte_budget`: `flow_graph`, `step_parameters`, `state_diff`, `failed_target`,
  `recovery_candidates`, `subflow`, `route_context`, `recent_nodes`. That is **less than run 18**,
  which kept the flow graph, step parameters, state diff, failed target and candidates. t194's F4
  (lossless trims first) is not in the t174 Core tree this run used (cause 8).
- The diagnosis said `requiredPriorAction: none` for a failure whose fix is exactly a prior action
  (close the card). Neither permitted patch kind can close a layer; the model's patch was
  `unsupported_runtime_patch`, which fits an attempt at something the plan did not permit (content not
  recorded). As in run 18, the plan could not have repaired this failure.

## Causes

| # | Cause, precisely | Repo and file | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | **The interference defence cannot find a layer in a viewport corner.** `overlaysOverPage()` probes seven fixed points, none in the bottom-right corner, so the support card over s12's target was never found or pressed; s12 failed after 4 absorbed attempts. The classifier, which had the blocked point, found the same layer. | extension `apps/extension/src/content/action-runtime/interference/overlays.ts` (`PROBE_FRACTIONS`, `overlaysOverPage`); the point is dropped before `recovery/` (file comment) | none recorded in t193–t195; nearest **t195** (owns `interference/`: F1, F7) | Open (new). Mechanism read from source, not traced live |
| 2 | **The build removed the card close it had found.** d15 (close the card) succeeded at 14, made the next add-to-cart succeed at 15, and was taken out at amendment 17, before any dry run. Nothing links s12 to the step that uncovered it. Run 18 cause 6 pattern (an amendment withdraws a step a later step depends on). | Core `runtime/llm/decision-handlers/amendment.ts` — NOT READ; draft dependency tracking | none recorded; nearest **t174** | Open |
| 3 | **The dry-run reset keeps scenario state**: the consent choice (d3 unreproducible in both dry runs), the store (d7 unreproducible, d8 failed), and so also the card's dismissal. A missing card close can never show in a dry run, while playback starts from the seeded state. Run 18 cause 2. | Core dry run (`runtime/flow-draft/dry-run.ts`, `dryrun.N.reset`), domain `runtime/llm-evidence/node-run/replay.ts` — NOT READ | **t174** (t193 cause D; t194 names it t174's) | Open |
| 4 | **Accepted with no dry run of the accepted draft.** Completion 31 was accepted on revision 22; dry run 2 ran on revision 20, and amendments 25–26 changed it after. Run 18 cause 3 again. | Core `runtime/llm/harness-options/bootstrap-completion.ts`, `runtime/flow-draft/dry-run.ts` — NOT READ | **t174** (lane "New cause A", worker dispatched) | Open, repeats |
| 5 | **A dry run ran on a refused completion**: completion 24 was refused `instructed_act_missing` at 08:08:56.609, and dry run 2 (29.1 s) started 1 ms later. | Core completion / dry-run ordering — NOT READ | **t174** (run 19: 95.5 s of such dry runs) | Open, repeats |
| 6 | **The instructed-acts check accepted with `create_new` claimed by no step**, and with no quantity step for a quantity-two instruction. | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/check.ts` | **t174** (F6 item 3; t195 adds plural acts at `check.ts:74-87`) | Open |
| 7 | **Recovery cannot close a layer, and the patch failed validation**: diagnosis 1 unanswered with no call; diagnosis 2 said no prior action is needed; the plan permitted only target override and wait-retry; the patch was `unexpected_field` + `unsupported_runtime_patch` + `invalid_risk`. Run 18 cause 7 again. | Core recovery ladder, `runtime_patch` | t193's area (self-repair); not recorded in its log | Open, repeats |
| 8 | **The diagnosis context kept only 3 sections**: flow graph, step parameters, failed target and candidates were all dropped for `byte_budget`, fewer than run 18 kept. **t194's F4 is not in the Core this run used**: `runtime/recovery/context-budget/` exists in the t194 Core tree (`essential-sections.ts`, `fit.ts`, `lossless-levels.ts` and others) and is absent from the t174 Core tree (`run.json` `repositories.core.path`), and no lossless or trim code is under the t174 tree's `runtime/recovery/`. | Core `runtime/recovery/{context.ts, context-summary.ts}`; F4 in `fxwork/t194/!FluxIQ/.../runtime/recovery/context-budget/` | **t194** (F4, lossless trims first) | Fixed in t194 but **not in this tree**; the round-1 merge into the t174 Core should be checked |
| 9 | **The Flow lacks a quantity step and a pickup choice**, so it would not meet the goal even unblocked. | the build's decisions; check as cause 6 | **t174** | Open |
| 10 | **The build trace prints model-authored call ids verbatim**, and deepseek-flash writes instruction words (store and product names) into them. `logs/core.log` is in the evidence bundle. | Core `runtime/llm/evidence-loop/progress-trace.ts` (`callId=`) | **t174** (the build progress trace is t174's F0 fix) | Open (new, privacy) |
| 11 | Decision efficiency: 66.5 s of 144.6 s in dry runs, 6 unreproducible replays at 5.5–6.5 s, 3 `draft_unchanged` amendments in a row on the same targets, 2 `handle_not_in_packet` rejections. | Core `runtime/llm/evidence-loop.ts` | t174 (run 18 cause 10) | Open |

Positive, for the record: t193's F (per-store chooser buttons) is live-confirmed; the repair's cost is
reported, not reserved (run 18 cause 8 did not recur); t195's F1 was not reached (the Flow accepted
consent itself), so "F1 fixed the consent wall" remains unproven live on this task.

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2 | What each amendment did (17 took out d15, or not; what 23, 25, 26 made of d3, d7, d8, d11, d12, d16) | `logs/core.log` has no `amend=`, `acts=` or `missing=` fields (t195's F13 format is not in this build's output) |
| 2 | Which act completions 24 and 30 found missing | as above |
| 3 | The Flow's edges and the merges' branch conditions | the bundle exports nodes (`authoredNodes`) but not edges |
| 3 | Whether the dry-run reset restores cookies, consent, cart, store or widget state | no field in the dry-run trace; inferred from replay codes and pictures |
| 4 | How many layers each of the 4 absorbed attempts pressed, and which layers `overlaysOverPage()` found | `failure.actual` prose only; the recovery account carries counts that are not exported |
| 4 | The blocking layer's kind as a code | `failure` has no structured blocker kind (run 18 gap, repeats) |
| 6 | Why diagnosis 1 was unanswered with no provider call | `harnessRecovery.interventions[]` carries the code only |
| 6 | Which patch kind the model proposed (`unsupported_runtime_patch`) | validation codes only |
| UI | The Lab emulates a 1280×720 page, but the whole-window JPGs (`screenshots/00005-*.jpg`, `00017-*.jpg`) show the side panel covering the right part of that page. The pinned add-to-cart and the support card are not visible to a person watching; only the scenario PNG shows them | Lab viewport emulation versus the window's real page width |
| UI | The panel's "Worked for …" rows do not match the build (see U12) | panel turn accounting, not traced |
| 1 | `activeTabUrl` (t185 row 1) | not recorded |

## UI review

Source: `run-muntmwvx-0d53884a.ui-review.local.json`. It has 15 moments, 15 scenario and 15 panel
pictures, `skipped: []`, `skippedTicks: 0`, `failures: []`. The panel is `side-panel (devtools
target, type page)`, `masked: 0` at every moment. The scenario tab was `inFront: true` and the only
entry in `frontTabs` at all 15. Overlay samples: 16 per moment, about 200 ms apart, over about 3 s.

### Screenshots opened (Read tool)

| PNG / JPG | What it shows |
| --- | --- |
| `run-muntmwvx-0d53884a.ui-review.local/01-start-scenario.png` | Store home page, **consent dialog** centred, starting store in the header, cart 1, the chat pill bottom-right. No overlay (correct: before Core's first event). |
| `run-muntmwvx-0d53884a.ui-review.local/01-start-panel.png` | Panel Simple tab: "Connected to FluxIQ", "Get set up" with **"Add an AI model key: To do"**, and a new chat area: "What can FluxIQ do for you?" / "Loading the conversation..." with the composer "Ask FluxIQ to do something...". |
| `run-muntmwvx-0d53884a.ui-review.local/04-mid-build-scenario.png` | Home page, consent gone, header names the **instructed store** (after d8); overlay bottom-left "Building your Flow / Using core.run_node" over the first product tile's name. |
| `run-muntmwvx-0d53884a.ui-review.local/04-mid-build-panel.png` | Panel header "FluxIQ · Building your Flow"; turn "Building your Flow / Using core.run_node / 11 steps so far". Matches the overlay. |
| `run-muntmwvx-0d53884a.ui-review.local/05-mid-build-scenario.png` | First product page just after d15: card closed, pill showing, pinned add-to-cart uncovered; overlay "Building your Flow / Using core.run_node: web.action.succeeded" over the pinned bar's left end. |
| `run-muntmwvx-0d53884a.ui-review.local/12-flow-run-scenario.png` | Playback start state: **consent dialog open again, starting store, cart 1**; overlay "Flow ready / Build finished: a Flow is proposed". |
| `run-muntmwvx-0d53884a.ui-review.local/12-flow-run-panel.png` | Header "Flow ready"; "Worked for 58s · 26 steps · 2 failed"; the question "The instruction asks for create_new, and none of this run's 102 actions said it would cause that; 80 of them said they would cause nothing lasting. Apply it as it stands?" with **Yes / No**; "Worked for 1s · 1 step". |
| `run-muntmwvx-0d53884a.ui-review.local/13-flow-run-scenario.png` | Home page, consent passed by s2, instructed store in the header (s5); overlay "Running your Flow · Step 5 of 16 / Running step 5 of 16: node.bootstrap.09f73b…" **cut with an ellipsis**. |
| `run-muntmwvx-0d53884a.ui-review.local/14-flow-run-scenario.png` | First product page **with the support card open over the pinned add-to-cart** (the layer that blocked s12); overlay "Running your Flow · Step 12 of 16 / Recovering from a failed step: node.bootstrap…". |
| `run-muntmwvx-0d53884a.ui-review.local/14-flow-run-panel.png` | Header "Running your Flow"; the create_new question **still offering Yes / No**; "Running your Flow Step 12 of 16 / Recovering from a failed step: node.bootstrap.09f73b73c085cb90.main.s12"; "1 step so far", "13 steps so far". |
| `run-muntmwvx-0d53884a.ui-review.local/15-failure-scenario.png` | Same page, card still open; overlay **"Run failed / Run failed"**. |
| `run-muntmwvx-0d53884a.ui-review.local/15-failure-panel.png` | Header **"Run failed"** (matches); "Worked for 42s · 19 steps · 2 failed"; the question **still with Yes / No**; "Worked for 1s · 1 step"; "Worked for 40s · 14 steps · 1 failed". No reason for the failure. |
| `run-muntmwvx-0d53884a/screenshots/00005-073348c6bbae.jpg` | Whole window at 08:07:53.8: the side panel beside the page; the page is cut at the panel, so the right part of the emulated 1280-px page (buy box, pinned add-to-cart, card) is hidden. |
| `run-muntmwvx-0d53884a/screenshots/00017-5b2d0c5fe36a.jpg` | Whole window at 08:10:43.4, during s12: panel "Running your Flow Step 12 of 16 / Running step 12 of 16: node.bootstrap.09f73b73c085cb90.main.s12"; the card and the target are behind the panel, invisible to a person watching. |

### Overlay per moment

Window about 3.0 s. Phase changes count transitions of the overlay's `phaseName` between samples,
including to or from absent. `textChanges`, `presenceToggles` and `visibilityToggles` are as
`summary.overlay` reports them.

| # | Label | Window start | Status | present/samples | textChanges | presenceToggles | visibilityToggles | Phase changes/s | Text changes/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | start | 08:06:54.104 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 2 | mid-build | 08:06:57.122 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 3 | mid-build | 08:07:15.333 | changed | 16/16 | 2 | 0 | 0 | 0.00 | 0.66 |
| 4 | mid-build | 08:07:35.402 | flickering | 15/16 | 2 | 2 | 2 | 0.66 | 0.66 |
| 5 | mid-build | 08:07:55.316 | flickering | 16/16 | 3 | 0 | 0 | 0.00 | 1.00 |
| 6 | mid-build | 08:08:15.324 | flickering | 15/16 | 3 | 2 | 2 | 0.66 | 0.99 |
| 7 | mid-build | 08:08:35.364 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 8 | mid-build | 08:08:55.377 | changed | 16/16 | 2 | 0 | 0 | 0.00 | 0.66 |
| 9 | mid-build | 08:09:15.412 | flickering | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 10 | mid-build | 08:09:35.426 | changed | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 11 | mid-build | 08:09:55.415 | changed | 2/16 | 0 | 1 | 1 | 0.33 | 0.00 |
| 12 | flow-run | 08:10:13.886 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 13 | flow-run | 08:10:33.845 | flickering | 15/16 | 2 | 2 | 2 | 0.66 | 0.66 |
| 14 | flow-run | 08:10:53.881 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 15 | failure | 08:11:04.361 | changed | 6/16 | 0 | 1 | 1 | 0.33 | 0.00 |

Peak: 0.66 phase changes/s and 1.00 text changes/s (moment 5). Every phase change during the build
is a one-sample drop-out on a page load: moment 4 at 08:07:37.0 (the search click, 36.689–38.213),
moment 6 at 08:08:15.9 (dry run 1's reset from 15.875), moment 13 at 08:10:36.6 (s8's search click,
36.291–36.717).

Texts shown (phase | headline | detail):
- "Building your Flow | Using core.run_node" and "… | Using core.run_node: web.action.succeeded"
- "Building your Flow | Deciding the next step"
- "Building your Flow | Using core.run_node: core.replay.replayed" (dry runs)
- "Building your Flow | Checking the proposed result"
- "Building your Flow | The proposed result passed its check"
- "Flow ready | Build finished: a Flow is proposed"
- "Running your Flow | Step N of 16 | Running step N of 16: node.bootstrap.09f73b73c085cb90.main.sN"
  (N = 5, 6, 7 seen; 12 in the window JPG)
- **"Running your Flow | Step 12 of 16 | Recovering from a failed step: node.bootstrap.09f73b73c085cb90.main.s12"** (new: repair is shown)
- "Run failed | Run failed"

Fidelity to Core's events, checked against `core.log` (each text is held about 1.2 s, so it trails
the event by up to that):
- Moment 3: "…: web.action.succeeded" at 08:07:15.96 for the navigate that ended 16.069 (the ~0.1 s
  lead is clock skew between the Lab and Core logs); "Deciding" at 17.35 for decision 2 (started
  16.072).
- Moment 6: dry run 1 read "Using core.run_node" from 16.73 (reset 15.875–17.156) and
  "…: core.replay.replayed" at 18.36 (`dryrun.1.2` ended 18.182). **Completion #1's check (15.873,
  ok) was never shown**; the hold swallowed it.
- Moment 8: "Checking the proposed result" at 08:08:56.58 for completion #2, whose check was
  **refused** at 56.609; the overlay then showed dry run 2 as "Using core.run_node" (57.98), with
  nothing saying the check had failed.
- Moment 10: "Checking" at 35.43 (completion #3, refused 35.028), "Deciding" at 36.24 (decision 31,
  35.032), "The proposed result passed its check" at 37.65 (check ok 36.862).
- Moment 13: step 5 shown until 34.85 (s5 ended 33.619), step 6 (a merge) 34.85–36.05, step 7 from
  36.05 (s7 ran 34.792–35.131): trailing by the hold.
- Moment 14: "Recovering from a failed step" at 08:10:53.88, inside recovery (49.983–58.033).
- Moment 15: "Run failed" at 08:11:04.36, **gone after 1.2 s** (absent from 05.59).

The overlay never showed a phase Core had not emitted.

### Overlay DOM state

- One host (`hostCount` 1 when present), `display: block`, `visibility: visible`, `opacity: 1`,
  `inViewport: true`, `documentVisibility: visible` throughout.
- Attributes: `data-fluxiq-activity=""`, `aria-hidden="true"`, `inert=""`.
- **Rect: x 16, y 650, 300 × 54** (x 16, y 633 when the step line shows): **bottom-left**, moved from
  run 18's bottom-right (x 947). It no longer covers the chat widgets or the pinned add-to-cart; it
  covers the first product tile's text on the home page and the pinned bar's left end on a product
  page.
- Absent at moments 1–2 (before the loop started at 08:07:12.227).

### Panel

Side panel, verified open, Simple tab. The first screen is now: the status card; "Get set up" with
**"Add an AI model key: To do"**; and a chat area with a header line ("FluxIQ · <phase>"), turns,
and a composer. The RIGHT NOW card of runs 15–18 is not visible in any panel PNG opened. The header
line reads "Building your Flow", "Flow ready", "Running your Flow" and "Run failed" at the matching
moments. Panels 02, 03, 05–11 and 13 were not opened.

### UI defects (U1–U13 from `reports/t174-live-lane.md`)

| # | Defect | This run | Evidence |
| --- | --- | --- | --- |
| U1 | Raw tool ids, result codes and node ids shown to the person | **recurs** ("Using core.run_node: core.replay.replayed", "Running step 12 of 16: node.bootstrap…s12", and in the panel) | `13-flow-run-scenario.png`, `14-flow-run-panel.png`; JSON moments 6, 9, 13, 14 |
| U2 | Headline repeated as the detail line | **fixed except at failure** ("Run failed / Run failed") | `15-failure-scenario.png` |
| U3 | Overlay covers the page's bottom-right controls | **fixed** (now bottom-left); it covers bottom-left page text instead | `05-mid-build-scenario.png`, `14-flow-run-scenario.png` |
| U4 | Panel says "Done" mid-build, at playback, after failure | **fixed** (header matches the overlay at every moment opened) | `04-mid-build-panel.png`, `12-flow-run-panel.png`, `15-failure-panel.png` |
| U5 | "Add an AI model key: To do" during a live build | **recurs** | every panel PNG opened |
| U6 | Control name joined without a separator | **not seen** (no "Clicking" line in the panels opened) | – |
| U7 | Flicker and page-load drop-outs | **partly fixed**: peak 0.66 phase changes/s; one-sample drop-outs on page loads recur | JSON moments 4, 6, 13 |
| U8 | Repair looks like building; failure not left on screen | **partly fixed**: repair is shown ("Recovering from a failed step"); the failure gives no reason and the overlay is gone 1.2 s after "Run failed" | `14-flow-run-scenario.png`, `15-failure-scenario.png`, `15-failure-panel.png` |
| U9 | Nothing tells the person a robot check is waiting | not applicable (no robot check) | – |
| U10 | Dry runs look like exploring | **recurs** ("Using core.run_node: core.replay.replayed") | JSON moments 6, 9 |
| U11 | "The proposed result passed its check" overstates the check | **recurs**: shown for a draft revision no dry run replayed, whose Flow then failed | JSON moment 10 |
| U12 | Panel counters go backwards; "Worked for" understates the build | **recurs (probable)**: "Worked for 58s · 26 steps · 2 failed" at playback start for a 144.6 s loop of 21 tool calls; the top row later reads "Worked for 42s · 19 steps · 2 failed" (whether a different row scrolled in is not known) | `12-flow-run-panel.png`, `15-failure-panel.png` |
| U13 | Overlay detail line cut with an ellipsis | **recurs** | `13-flow-run-scenario.png`, `14-flow-run-scenario.png` |
| new U14 | **A question stays open after it stopped mattering**: "Apply it as it stands?" with Yes / No is shown at playback start, during recovery and after the failure, although the Flow was applied and ran. It also speaks in a code ("create_new"). | new | `12-flow-run-panel.png`, `14-flow-run-panel.png`, `15-failure-panel.png` |
| new U15 | **The overlay says "Checking the proposed result" for a check that was refused**, then shows the dry run that followed as ordinary work; a refused check is never shown as refused | new (minor) | JSON moments 8, 10 |

## t185 checklist

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Confirmed**, including beside the page: stderr `[lab] live panel: side-panel (verified open)`; `snapshots/live-panel.json` = `{"mode":"side-panel"}`; the panel captured at all 15 moments; the whole-window JPGs show the panel docked beside the page. Scenario tab `inFront: true`, only entry in `frontTabs` at every moment. **`activeTabUrl`: no evidence.** | full log; `snapshots/live-panel.json`; `screenshots/00005-*.jpg`, `00017-*.jpg`; UI review JSON |
| 2 | Overlay from real events | **Confirmed.** Absent before Core's first event (moments 1–2; loop start 08:07:12.227). Every phase seen matches a `core.log` or runtime event, trailing by the ~1.2 s hold (moments 3, 6, 8, 10, 13, 14, 15). Repair is now pictured (moment 14). Completion #1's check was never displayed (held over). | UI review JSON; `logs/core.log`; PNGs 13, 14, 15 |
| 3 | No interference | **Confirmed for the overlay; the page's own layer blocked.** Host marked `data-fluxiq-activity`, `aria-hidden`, `inert`; rect bottom-left (x 16–316), away from the blocked point 1129,668. The blocking layer was the site's support card, named in `failure.actual`. Snapshots, interference sentences and `dom.mutation`: **no evidence** (not exported). | `flow-lane.json` `actions[11].failure`; `14-flow-run-scenario.png` |
| 4 | Chat | **Partly confirmed.** The panel now has a chat area with a phase header, "Building your Flow" turns with step counts, and the create_new question. Against: the question stays open with live Yes / No after it was settled (U14); "Worked for" counts disagree with the build (U12); no failure reason. The typed instruction as a person's turn: **not seen** in the panels opened. | `04-mid-build-panel.png`, `12-flow-run-panel.png`, `14-flow-run-panel.png`, `15-failure-panel.png` |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (177 lines, 169 build-trace) has no error, warn, outbound or `server.activity` line. `outbound` growth: not logged. | `logs/core.log` |
