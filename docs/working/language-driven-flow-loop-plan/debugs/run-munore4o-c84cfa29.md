# Run debug — `run-munore4o-c84cfa29` (live run 16)

Worker t174-w12, 2026-09-29. Read from the bundle at
`test-runs/instances/t174-slot-1/run-munore4o-c84cfa29`, its UI review
(`test-runs/instances/t174-slot-1/run-munore4o-c84cfa29.ui-review.local.json` and the PNG folder
`run-munore4o-c84cfa29.ui-review.local/`), and the launcher's full Lab stdout
(`live-run-16.full.log`, in the supervisor's scratchpad, not in the repository). No product code
changed. Privacy: only codes, counts, ids, node ids, durations, timestamps and FluxIQ's own UI
strings. Pages and controls are named by kind; no instruction text, page text, accessible names,
extracted values or provider bodies.

---

## Header

- Run id: `run-munore4o-c84cfa29`
- Scenario / variant / task: `bigbox-retail` / none / `bigbox-retail-pickup-cart` (`form`,
  judged by playback goal `build-pickup-cart`). The instruction is 330 characters, sha256
  `8da0b9f6…3d43d3` (`snapshots/flow-lane.json` `task`).
- Repositories (`run.json`): facility `2d6d27f` (dirty), Core `4d126f6` (**dirty**; it was clean
  in run 15). Chromium 134.0.6998.35, 1280×720. Ports: scenario 59820, web 59821, gateway 59822.
- Lab span 05:49:51.056Z to 05:53:40.461Z (`summary.json`), `durationMs: 229028`. Dispatch
  05:50:13.766Z, build loop 05:50:32.171Z to 05:53:09.655Z (`build.durationMs: 163796`), build
  settle 05:53:13.720Z.
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. Authorized: `maxCalls: 64`,
  48k in / 8k out / 56k per call, $0.25 per call, $2 total.
- Calls, cost:
  - Build: **61 calls** (60 loop decisions + 1 unrecorded instruction-authority call),
    1,020,664 in / 5,613 out tokens, **$0.11405**, `budgetBreaches: 0`. The largest call had
    18,198 input tokens.
  - Repair: 2 calls (`runtime_diagnosis` gather, `runtime_patch` implement), $0.00384.
  - Result check: none (`verification.source: absent`). `evaluation.json` `llm.calls: 63`.
- Verdict: failed, `runtime.behavior`; Flow-reported `unexpected_state` /
  **`web.action.blocked_by_dialog`** (`events.ndjson` seq 4, 05:53:33.164Z).
- **Stage reached: 6.** A Flow was created and ran; node 2 of 7 failed; recovery made 3
  interventions and no repair.

## Stage 1 — the instruction and the expected chain

- Instruction text withheld. Core read **2 instructed consequences**, `modify_existing` (switch
  the pickup store) and `create_new` (add two products to the cart).
- A correct Flow (t193's report, "Stage 1" for the redesigned variant of this task, same unarmed
  site): close the consent dialog; open the store chooser **and pick the target store**; reach
  the first product, choose its size, pickup and quantity, add to cart; reach the second
  product, choose its size and pickup, add to cart; no checkout.

## Stage 2 — exploration (the build)

From `logs/core.log` build-trace lines joined by iteration with `flow-lane.json`
`build.evidenceLoop.steps[]`. Draft ids `dN` number executed tool calls in order (including
calls answered from memory), Core's initial call as `d1`. The numbering checks out: every id
withdrawn at 41 is a successful click, the ids refused at 34 are the four rejected clicks, and
dry run 2 replays d2, d39, d42, d43, d47, d48, d49 = the calls at 1, 47, 50, 51, 55, 56, 57.

| It | Decision | Call id | Node | Result / draft effect |
| --- | --- | --- | --- | --- |
| 0 | (Core's initial) | `initial.core.run_node` | snapshot | `web.action.rejected.not_at_start_location` |
| 1 | tool_call | `nav1` | `browser-navigate` | succeeded (d2, kept = **s1**) |
| 2 | tool_call | `dismiss1` | `dom-click` | `target_unobserved` / `target_not_a_handle` (d3) |
| 3 | tool_call | `dismiss2` | `dom-click` | **succeeded** (d4): the consent dialog was closed (it is gone in the next picture). **Withdrawn at 41.** |
| 4–6 | tool_call ×3 | `store1`–`store3` | `dom-click` | rejected `handle_not_in_packet`, then `answered_the_same_again` ×2 (d5–d7) |
| 7–11 | tool_call ×5 | `obs1`, –, –, `obs2`, – | snapshot ×2, answered from memory ×3 | (d8–d12) |
| 12 | tool_call | `store4` | `dom-click` | succeeded (d13) |
| 13 | tool_call | `obs3` | snapshot | (d14) |
| 14–15 | tool_call ×2 | `store5`, `store6` | `dom-click` | succeeded (d15, d16) |
| 16 | tool_call | `store7` | snapshot | (d17) |
| 17 | amend_draft | – | – | withdrew d15, d16 (kept 3) |
| 18–19 | tool_call ×2 | `store8`, – | snapshot, from memory | (d18, d19) |
| 20 | amend_draft | – | – | d15, d16 again: refused ×2, `draft_unchanged` |
| 21 | tool_call | – | from memory | (d20) |
| 22–25 | tool_call ×4 | `detect1`–`detect4` | `web.detect_repeating_structure` | detected, **rejected `handle_no_longer_on_page` (5281 ms)**, detected, **rejected the same (5280 ms)** (d21–d24) |
| 26–27 | tool_call ×2 | `store9`, `store10` | `dom-click` | succeeded (d25, d26) |
| 28 | tool_call | `detect5` | detect | detected (d27) |
| 29 | amend_draft | – | – | withdrew d25, d26 (kept 3) |
| 30–31 | tool_call ×2 | `store11`, `store12` | `dom-click` | succeeded (d28, d29) |
| 32 | tool_call | `detect6` | detect | detected (d30) |
| 33 | tool_call | `store13` | `dom-click` | succeeded (d31) |
| 34 | amend_draft | – | – | d3, d5, d6, d7 (the rejected clicks): refused ×4 (kept 6) |
| 35 | tool_call | `store14` | `dom-click` | succeeded (d32) |
| 36 | tool_call | `store15` | snapshot | (d33) |
| 37 | tool_call | `search1` | `dom-type` | `target_unobserved` / `target_not_a_handle` (d34) |
| 38 | amend_draft | – | – | d15, d16, d25, d26 (already withdrawn): refused ×4 (kept 7) |
| 39–40 | tool_call ×2 | `snap16`, – | snapshot, from memory | (d35, d36) |
| **41** | amend_draft | – | – | **withdrew d4, d13, d28, d29, d31, d32** (applied 6, **kept 1**): the consent dismissal and every remaining store click |
| 42 | amend_draft | – | – | the same 6 ids again, `draft_amended`, applied 6, kept 1 (intent not traced) |
| **43** | **complete #1** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 1: reset, d2 (1027, 1016 ms) |
| 44 | tool_call | `snap17` | snapshot | (d37) |
| 45 | amend_draft | – | – | d2: refused, `draft_unchanged` |
| 46 | tool_call | `snap18` | snapshot | (d38) |
| 47 | tool_call | `store47` | `dom-click` | succeeded (d39 = **s2**, the header's pickup-store button, which opens the chooser) |
| 48–49 | tool_call ×2 | `snap49`, – | snapshot, from memory | (d40, d41) |
| 50 | tool_call | `type51` | `dom-type` | succeeded (d42 = **s3**, the search field) |
| 51 | tool_call | `search52` | `dom-click` | succeeded (d43 = **s4**, the search button) |
| 52–54 | tool_call ×3 | `snap53`, –, – | snapshot, from memory ×2 | (d44–d46) |
| 55 | tool_call | `addpt1` | `dom-click` | succeeded (d47 = **s5**, a result's add button, list position 2 of 5) |
| 56 | tool_call | `napkin1` | `dom-click` | succeeded (d48 = **s6**, a result's options link, list position 1 of 5) |
| 57 | tool_call | `napkin2` | `dom-click` | succeeded (d49 = **s7**, the product page's add-to-cart button) |
| 58 | amend_draft (rerun) | `rerun.21` | detect | `draft_rerun` of d21 → **`web.action.rejected.invalid_input` (`unexpected_input_keys`)** in 1 ms |
| 59 | amend_draft | – | – | d49: refused, `draft_unchanged` (kept 7) |
| **60** | **complete #2** | – | – | **accepted**. Dry run 2: reset, d2, d39, d42, d43, d47, d48, d49, all `core.replay.replayed` (1270, 1019, 1499, 1189, 1245, 1414, 1122, 1439 ms) |

Totals: 60 decisions = 48 tool_call (9 answered from memory) + 10 amend_draft (4 applied, 5
`draft_unchanged`, 1 rerun) + 2 complete. 50 tool calls: 19 `dom-click` (15 succeeded, 4
rejected), 2 `dom-type` (1 each), 1 `browser-navigate`, 12 snapshots (11 ok), 7 structure
detections (4 detected, 2 `handle_no_longer_on_page`, 1 `invalid_input`), 9 from memory.

- **Where decisions were spent without progress.** 9 successful store-chooser clicks (12–35)
  were all withdrawn (17, 29, 41), so the store switch was explored four times and kept zero
  times. 9 decisions were answered from memory. 5 amendments were refused in full, 2 of them on
  ids already withdrawn (20, 38). 2 structure detections took 5.28 s each to be refused.
- **Did the draft grow?** Record count 1 → 22 (`draft.steps`); rendered size hit 3,995 of 4,000
  bytes by 57 (`draft.bytes`/`budget`). The instruction share of the draft shrank 1,052 → 618 → 154
  bytes (38, 51). Kept steps: 3, 6, 7, then **1 after 41**, then 7 at acceptance.
- The run ended at 60 of the 64-iteration ceiling.

## Stage 3 — the proposed Flow

- Adaptation `adaptation.bootstrap.71713d73-1fd9-4feb-b7c8-b797e36c184a`, `proposed`, Flow
  `flow.ca9d0a65-07e8-45e3-aacd-14b538cc52c5`, `appliedMutationCount: 2`.
- Shape: 7 nodes, 1 `web.browser.navigate`, 5 `web.dom.click`, 1 `web.dom.type`, no extract
  node. Nodes `node.bootstrap.016ceaa64a9d7f26.main.s1`…`s7` as mapped above (selectors and
  typed text withheld in the bundle).
- Declared consequences (`declaredConsequences` 20–26): `s2`, `s5`, `s6`, `s7` claim
  `modify_existing`; `s1`, `s3`, `s4` none. **`create_new` is claimed by no step**; the
  cross-check verdict is `undeclared` (`declared: [modify_existing]`, `undeclared: [create_new]`,
  `declaredNothing: 23` of 35).
- **What the Flow lacks:** a consent-dialog dismissal (d4 withdrawn at 41), **a store pick**
  (s2 only opens the chooser; every pick click was withdrawn), and, as far as node kinds show,
  any size, pickup or quantity choice. The instructed-acts check still accepted it, with the
  chooser-opening click and the add-to-cart presses standing for "modify existing".
- **The dry run passed a Flow that cannot run from a fresh start.** Dry run 2 replayed s2 with no
  dialog in the way: the build's reset keeps the consent choice made at 3 (after the reset at
  05:52:18 no dialog appears, `10-mid-build-scenario.png`), while playback starts with the dialog
  open (`12-flow-run-scenario.png`, `13-failure-scenario.png`).

## Stage 4 — playback

Runtime run `5b8d1bba-f5fd-45c4-b2f2-bcb67ac59ce7`, route: subflow
`subflow.bootstrap.016ceaa64a9d7f26.main`, `fallbackUsed: true`, no rule.

| Attempt | Node | Started | ms | Status |
| --- | --- | --- | --- | --- |
| 0 | `main.s1` navigate | 05:53:21.470Z | 2183 | succeeded, `matched` |
| 1 | `main.s2` click | 05:53:24.761Z | 1810 | **failed `web.action.blocked_by_dialog`** (`unexpected_state`, stage `execution`, not retryable) |

- The click point landed on a page layer that covers the target. The runtime classified it as "a
  dialog is open over the page and asks for nothing only a person can give, so it has to be
  answered or closed", absorbed `blocking_dialog` 4 times with 1350 ms of waiting, and gave up. It
  did not close the dialog.
- Target resolution: extension `unresolved_no_candidates` (0 candidates); host resolution by
  selector, 4 candidates, best score 0.643, confidence 0.566.
- Evidence packets 5783, 5813, 5813, 5829 bytes, all truncated. Nodes s3–s7 never ran.

## Stage 5 — the answer

Not reached. No result check ran (`resultVerification: null`); `oracles.finalState: failed`,
`records: not_declared`.

## Stage 6 — recovery

`harnessRecovery` and `live-llm.json` `repair`, settled 05:53:33.109Z:

| # | Intervention | Provider call | Outcome |
| --- | --- | --- | --- |
| 1 | `diagnosis` | none | `validationOk: false`, **`recovery.ladder_diagnosis_unanswered`** |
| 2 | `diagnosis` | `llm.runtime_diagnosis.5c28300e…` (gather), 5,543 in / 336 out | ok |
| 3 | `runtime_patch` | `llm.runtime_patch.8614ea61…` (implement), 6,514 in / 227 out | ok as output, but the attempt was a **`temporary_target_override`**, `preflightOk: false`, **`runtime_patch.target_override_rejected` / `…target_unanchored`**, not executed |

- No adaptation, no change proposal, `permissionOutcome: not_asked`, `refusalCode: null`.
- Context sent: failure, expected/actual transition, flow graph, step parameters, state diff,
  failed target, recovery candidates, subflow, route context, recent nodes. The repair tried to
  re-point the click instead of closing the dialog.

## Causes

| # | Cause, precisely | Repo and file | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | **Playback died under the consent dialog.** The runtime's interference defence would not answer a consent wall, classifying it as needing a person, so s2 failed `web.action.blocked_by_dialog` after 4 absorbed attempts. | extension `apps/extension/src/content/action-runtime/interference/{vocabulary.ts, way-out.ts}` (t195 tree) | **t195** (F1, from its run 4 `run-munoa86g-150fb0d9`, the same dialog on this scenario) | Fixed in t195 (unit), live pending |
| 2 | **The dry run does not start from playback's state.** Its reset kept the consent choice, so dry run 2 replayed s2 unobstructed and the build accepted a Flow whose dismissal step had been withdrawn at 41. | Core dry run (`runtime/flow-draft/dry-run.ts`, the `dryrun.N.reset` step) — NOT READ | none recorded by t193/t194/t195; supervisor to route | Open (new) |
| 3 | **The instructed-acts check accepted a Flow without the store pick and with `create_new` claimed by no step**: a chooser-opening click and add-to-cart presses counted as `modify_existing`. t174 F5 (`step_only_arrives`) covers navigations only, not a click that opens a chooser. | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/check.ts` | **t174** (instructed-acts check, per t195's "owned elsewhere") | Open for this shape |
| 4 | **Amendment at 41 withdrew needed steps**: the consent dismissal and every store click in one move, leaving 1 kept step; nothing warned that a withdrawn step changed page state later steps depend on. | Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/amendment.ts` — NOT READ | none recorded; nearest t174 (build efficiency, run 13 cause 2) | Open (new) |
| 5 | **Rerun of a structure detection fails on its own inputs**: `rerun.21` → `web.action.rejected.invalid_input` / `unexpected_input_keys` in 1 ms. | Core amendment rerun path for non-`core.run_node` tools — NOT READ | none recorded | Open (new) |
| 6 | **Recovery did not consider closing the dialog**: the first diagnosis was unanswered without a call, and the patch was a target override refused `target_unanchored`. | Core recovery ladder / `runtime_patch` | t193's area (self-repair); not recorded in its log | Open |
| 7 | Decision efficiency (9 withdrawn store clicks, 9 answers from memory, 5 fully refused amendments, 60 of 64 decisions). | Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts` | t174 (run 13 cause 2) | Open |

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2 | Intent of each amendment (41 and 42 target the same 6 ids and both report `applied 6`) | `progress-trace.ts` prints targets and counts only |
| 3 | Which step satisfied which act at 60, and which act 43 found missing | `progress-trace.ts` prints issue codes only |
| 3 | Whether the dry-run reset restores cookies / consent state | no field in the dry-run trace |
| 4 | What the blocking layer was, as a code (it is only in the prose `actual`) | `failure` has no structured blocker kind |
| 6 | Why the first diagnosis was unanswered with no provider call | `harnessRecovery.interventions[]` carries the code only |
| UI | No picture between the failed click (05:53:26.6) and the repair settle (05:53:33.1), so whether the overlay showed Repairing is unknown | UI review cadence (20 s) |
| UI | Each PNG shows the state at the start of its 3 s overlay window, not at `moments[].at` (moments 3, 7, 10, 12 checked) | UI review capture ordering or timestamping (Lab) |
| 1 | `activeTabUrl` (t185 row 1) | not recorded |

## UI review

Source: `run-munore4o-c84cfa29.ui-review.local.json` (13 moments, 13 scenario + 13 panel
pictures, `skipped: 0`, `failures: []`, panel `side-panel (devtools target, type page)`,
`masked: 0`). Overlay samples: 16 per moment, 200 ms apart, over 3 s.

### Screenshots opened (Read tool)

| PNG | What it shows |
| --- | --- |
| `run-munore4o-c84cfa29.ui-review.local/01-start-scenario.png` | Store home page with a centred **cookie-consent dialog** over it and the page's own chat bubble bottom-right. No overlay (correct: before Core's first event at 05:50:32). |
| `run-munore4o-c84cfa29.ui-review.local/01-start-panel.png` | Panel Simple tab: "Connected to FluxIQ", "Get set up" with **"Add an AI model key: To do"**, "RIGHT NOW: Nothing running", "What should FluxIQ do?". |
| `run-munore4o-c84cfa29.ui-review.local/03-mid-build-scenario.png` | Same page, dialog still open; overlay bottom-right "THINKING / Deciding the next step / Deciding the next step", overlapping the page's chat bubble and a product card. |
| `run-munore4o-c84cfa29.ui-review.local/03-mid-build-panel.png` | **"RIGHT NOW: Done / Last step: Looked at the page"** while the build is running. |
| `run-munore4o-c84cfa29.ui-review.local/07-mid-build-scenario.png` | Dialog gone; the header shows a different pickup store than at start; overlay "EXPLORING / Using core.run_node / Using core.run_node". |
| `run-munore4o-c84cfa29.ui-review.local/07-mid-build-panel.png` | "RIGHT NOW: FluxIQ is working / Clicking "…"" with Stop. The quoted control name is the store button's two text parts **run together without a space**. |
| `run-munore4o-c84cfa29.ui-review.local/10-mid-build-scenario.png` | A product page after dry run 1's reset: original store in the header, **no consent dialog**, and a page assistant card bottom-right; the overlay "EXPLORING / Using core.run_node" is drawn **on top of the card's button**. |
| `run-munore4o-c84cfa29.ui-review.local/11-mid-build-panel.png` | "RIGHT NOW: Done / Last step: Clicked "<control>"" as the build settles. |
| `run-munore4o-c84cfa29.ui-review.local/12-flow-run-scenario.png` | Start page before playback's first node, **consent dialog open again**; overlay "DONE / Build finished: a Flow is proposed / Build finished". |
| `run-munore4o-c84cfa29.ui-review.local/12-flow-run-panel.png` | Panel still "Done / Last step: Clicked "<control>"": nothing about the run that is starting. |
| `run-munore4o-c84cfa29.ui-review.local/13-failure-scenario.png` | Start page, **consent dialog still open** (the layer that blocked s2); overlay "FAILED / Run failed / Run failed". |
| `run-munore4o-c84cfa29.ui-review.local/13-failure-panel.png` | Panel **"RIGHT NOW: Done / Last step: Looked at the page"** after the run failed. |

### Overlay per moment

Rates per second over the 3.0 s window; phase changes count transitions of the phase label,
including to or from absent.

| # | Label | Window start | Status | present/samples | textChanges | presenceToggles | visibilityToggles | Phase changes/s | Text changes/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | start | 05:50:13 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 2 | mid-build | 05:50:16 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 3 | mid-build | 05:50:33 | flickering | 15/16 | 1 | 2 | 2 | 0.66 | 0.33 |
| 4 | mid-build | 05:50:53 | flickering | 16/16 | 2 | 0 | 0 | 0.66 | 0.66 |
| 5 | mid-build | 05:51:13 | flickering | 16/16 | 2 | 0 | 0 | 0.67 | 0.67 |
| 6 | mid-build | 05:51:33 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 7 | mid-build | 05:51:53 | changed | 16/16 | 2 | 0 | 0 | 0.33 | 0.66 |
| 8 | mid-build | 05:52:13 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 9 | mid-build | 05:52:33 | changed | 16/16 | 1 | 0 | 0 | 0.33 | 0.33 |
| 10 | mid-build | 05:52:53 | flickering | 16/16 | 3 | 0 | 0 | 1.00 | 1.00 |
| 11 | mid-build | 05:53:13 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 12 | flow-run | 05:53:18 | changed | 16/16 | 2 | 0 | 0 | 0.33 | 0.66 |
| 13 | failure | 05:53:33 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |

Texts shown (phase | headline): "Thinking | Deciding the next step", "Exploring | Using
core.run_node", "Exploring | Using core.run_node: web.action.succeeded", "Exploring | Using
web.detect_repeating_structure", "Exploring | Using web.detect_repeating_structure:
web.action.rejected.invalid_input", "Done | Build finished: a Flow is proposed", "Running | Run
started", **"Running · Step 1 of 7 | Running step 1 of 7:
node.bootstrap.016ceaa64a9d7f26.main.s1"**, "Failed | Run failed". Each rendering is phase,
"FluxIQ", headline and a sub-line repeating the headline (or its short form).

Fidelity to Core's events, checked against `core.log`: moment 3 read Thinking during decide 1,
vanished for one sample while `nav1` loaded the page, then Exploring until `nav1` ended at
05:50:36.839; moment 10 showed the 1 ms `rerun.21` rejection within 200 ms and Thinking for
decides 58 and 59. The overlay never showed a phase Core had not emitted. In moment 4 an Exploring
phase from a 148 ms tool call was visible in exactly one sample.

### Overlay DOM state

- One host (`hostCount` 0 or 1), top frame, `display: block`, `visibility: visible`,
  `opacity: 1`, `inViewport: true` whenever present.
- Attributes: `data-fluxiq-activity=""`, `aria-hidden="true"`, `inert=""`.
- Rect: x 947, y 620.36, 300 × 83.64; 300 × 102.48 at y 601.52 once the step line appears
  (moment 12).
- Absent at moments 1–2 (before the build), and for one sample during the first navigation
  (moment 3). Present through all 16 samples of the failure moment.

### Panel

Side panel, verified open, Simple tab; same first-screen layout as run 15: status card, "Get
set up" with **"Add an AI model key: To do"**, the RIGHT NOW card and "What should FluxIQ do?".
RIGHT NOW read "Nothing running" at start, **"Done / Last step: Looked at the page" at moment 3
while the build was deciding**, "FluxIQ is working / Clicking "…"" with Stop at moment 7, then
"Done / Last step: Clicked "…"" from the build's end through playback, and **"Done / Last step:
Looked at the page" after the failure**. No chat, tool rows or Core turns are visible in any
panel picture.

### UI defects found

| # | Defect | Evidence |
| --- | --- | --- |
| U1 | **Raw ids in the overlay**: tool ids and result codes as headlines, and **the internal node id as the step name** ("Running step 1 of 7: node.bootstrap.016ceaa64a9d7f26.main.s1"). | `run-munore4o-c84cfa29.ui-review.local/07-mid-build-scenario.png`, `…/10-mid-build-scenario.png`; JSON moments 10 and 12 |
| U2 | **Headline repeated as the sub-line** ("Deciding the next step" ×2, "Run failed" ×2). | `…/03-mid-build-scenario.png`, `…/13-failure-scenario.png` |
| U3 | **The overlay covers the page's own bottom-right widgets** (chat bubble, an assistant card and its button, product cards). | `…/03-mid-build-scenario.png`, `…/10-mid-build-scenario.png` |
| U4 | **Panel RIGHT NOW contradicts the overlay**: "Done" mid-build, "Done" while the Flow is starting, "Done" after the run failed. | `…/03-mid-build-panel.png` vs `…/03-mid-build-scenario.png`; `…/12-flow-run-panel.png`; `…/13-failure-panel.png` vs `…/13-failure-scenario.png` |
| U5 | **"Add an AI model key: To do"** during a live build. | every panel PNG, e.g. `…/01-start-panel.png` |
| U6 | **Control name joined without a separator** in the panel's step line ("Clicking "…"", two text nodes run together). | `…/07-mid-build-panel.png` |
| U7 | **Flicker**: 5 of 13 moments are `flickering`; up to 1.0 phase changes/s (moment 10); single-sample phases from sub-200 ms tool calls; a one-sample disappearance on navigation. | JSON moments 3, 4, 5, 10 |
| U8 | **The failure gives no reason on screen**: the overlay says only "Run failed" and the panel says "Done", although Core knew the step was blocked by a dialog. | `…/13-failure-scenario.png`, `…/13-failure-panel.png` |

## t185 checklist

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Partly confirmed.** stderr `[lab] live panel: side-panel (verified open)`; `snapshots/live-panel.json` = `{"mode":"side-panel"}`; the panel page captured at all 13 moments; scenario tab `inFront: true`, only the scenario in `frontTabs`. **Beside the page on screen: no evidence** (separate captures). **`activeTabUrl`: no evidence.** | full log; `snapshots/live-panel.json`; UI review JSON |
| 2 | Overlay from real events | **Confirmed.** Absent before Core's first event (moments 1–2, loop start 05:50:32.171Z); top frame; `thinking`/`exploring` during the build; `running` with "Step 1 of 7" at playback; `done` at build settle and `failed` at settle; every phase seen matches a `core.log` event in time (moments 3, 10). Repair phase: no picture (gap). | UI review JSON; `logs/core.log`; PNGs 03, 12, 13 |
| 3 | No interference | **Partly confirmed.** Host marked `data-fluxiq-activity`, `aria-hidden`, `inert`. The one refused action (s2) was blocked by the page's consent dialog at point 278,31, top-left, **not** the overlay; no action was refused bottom-right. Snapshots, blockers, interference sentences and `dom.mutation`: **no evidence** (not exported). | `flow-lane.json` `failure`; UI review JSON |
| 4 | Chat | **Contradicted for the header; no evidence for the rest.** RIGHT NOW said "Done" mid-build and after failure (U4). No tool/step rows, turns or typed instruction visible or sent. | `03-mid-build-panel.png`, `13-failure-panel.png` |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (233 lines) has no error, warn, outbound or `server.activity` line. `outbound` growth: not logged. | `logs/core.log` |
