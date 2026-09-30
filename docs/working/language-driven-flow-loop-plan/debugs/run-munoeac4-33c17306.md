# Run debug — `run-munoeac4-33c17306` (live run 15)

Worker t174-w12, 2026-09-29. Read from the bundle at
`test-runs/instances/t174-slot-1/run-munoeac4-33c17306`, its UI review
(`test-runs/instances/t174-slot-1/run-munoeac4-33c17306.ui-review.local.json` and the PNG folder
`run-munoeac4-33c17306.ui-review.local/`), and the launcher's full Lab stdout
(`live-run-15.full.log`, in the supervisor's scratchpad, not in the repository). No product code
changed. Privacy: this file carries only codes, counts, ids, node ids, durations, timestamps and
FluxIQ's own UI strings. Pages are named by kind only; no instruction text, page text, extracted
values or provider bodies.

---

## Header

- Run id: `run-munoeac4-33c17306`
- Scenario / variant / task: `crossborder-marketplace` / none / `crossborder-marketplace-hub-to-cart`
  (`form`, judged by playback goal `hub-in-cart`). The instruction is 219 characters, sha256
  `2e6f5e7d…a3a405` (`snapshots/flow-lane.json` `task`).
- Repositories (`run.json`): facility `2d6d27f` (dirty), Core `4d126f6` (clean). Chromium
  134.0.6998.35, 1280×720. Ports: scenario 59512 (from the authored node parameters' origin).
- Lab span 05:39:39.613Z to 05:43:57.907Z (`summary.json`), `durationMs: 257533`
  (`evaluation.json`). Build loop 05:40:15.463Z to 05:41:14.013Z (`build.durationMs: 67372`).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. Authorized (`live-llm.json`):
  `maxCalls: 64`, 48k in / 8k out / 56k per call, $0.25 per call, $2 total.
- Calls, cost, as reported:
  - Build: **15 calls** (14 loop decisions + 1 unrecorded instruction-authority call),
    175,902 in / 1,696 out tokens, **$0.02395**, `budgetBreaches: 0`.
  - Result check: 2 calls (`verification.recordedCalls: 2`), $0.00132, verdicts
    `does_not_answer` ×2.
  - Repair: 8 calls (1 `runtime_diagnosis` gather, 6 `evidence_tool_decision`, 1
    `runtime_diagnosis` plan), $0.00943.
  - `evaluation.json` `llm.calls: 23` = 15 + 8. **The result re-author loop's 26 decisions
    (core.log 05:41:52–05:43:02) are counted nowhere** (cause 3, gaps).
- Verdict: failed, `runtime.behavior`, Flow-reported `output_not_observed` /
  `core.result.does_not_answer_request` (`events.ndjson` seq 4, 05:43:33.010Z).
- **Stage reached: 6.** A Flow was created, ran, was refuted by the result check, re-authored
  (failed), diagnosed 3 times and refused at the exploration rung.

## Stage 1 — the instruction and the expected chain

- Instruction text withheld. Core read **2 instructed consequences**, `modify_existing` and
  `create_new` (`build.instructedConsequences[].consequence`).
- A correct Flow needs at least one mutating press for each consequence (add to cart, collect the
  store coupon), after reaching the item and choosing its options. The scenario manifest was not
  read (not named by the brief).

## Stage 2 — exploration (the build)

From `logs/core.log` build-trace lines joined by iteration with `flow-lane.json`
`build.evidenceLoop.steps[]`. Draft ids `dN` number executed tool calls in order, Core's initial
call as `d1`; the amendment targets check out against this numbering (10 targets d3/d4/d7/d8, all
navigations; 13 reruns d8).

| It | Decision | Call id | Node | Result / draft effect |
| --- | --- | --- | --- | --- |
| 0 | (Core's initial) | `initial.core.run_node` | `dom-capture_snapshot` | `web.action.rejected.not_at_start_location` (`start_location_not_reached`) |
| 1 | tool_call | `nav1` | `browser-navigate` | succeeded, `pageState: unchanged` (d2, kept to the end = **s1**) |
| 2–4 | tool_call ×3 | `nav2`–`nav4` | `browser-navigate` ×3 | succeeded, `pageState: changed` (d3–d5) |
| 5 | amend_draft | – | – | withdrew d5 (kept 3) |
| **6** | **complete #1** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 1: reset, d2, d3, d4, all `core.replay.replayed` (1285, 1043, 1283, 1290 ms) |
| 7–9 | tool_call ×3 | `nav5`–`nav7` | `browser-navigate` ×3 | succeeded (d6–d8) |
| 10 | amend_draft | – | – | withdrew d3, d4, d7, d8 (kept 2) |
| 11 | tool_call | `nav8` | `browser-navigate` | succeeded (d9) |
| 12 | amend_draft | – | – | withdrew d9, d6 (kept 1) |
| 13 | amend_draft (rerun) | `rerun.8` | `browser-navigate` | `llm_evidence_loop.draft_rerun`: d2 refused, d8 rerun → succeeded, `pageState: unchanged` (d10, kept = **s2**) |
| **14** | **complete #2** | – | – | **accepted** (`completion check ok=true`). Dry run 2: reset, d2, d10, all replayed (1283, 1030, 1270 ms) |

Totals: 14 decisions = 8 tool_call + 4 amend_draft (one a rerun) + 2 complete. 10 tool calls: 1
rejected snapshot and **9 `browser-navigate`, all succeeded**. `toolIds` is only `core.run_node`.

- **The build never looked at a page.** No snapshot succeeded, and no structure detection, click
  or type ran. Every decision was a navigation, an amendment or a completion.
- **The page became a bot challenge during the build.** The scenario screenshot of moment 4
  (state at about 05:40:43.8, right after dry run 1's reset and three replayed navigations
  ended at 05:40:43.764Z; `04-mid-build-scenario.png`, a search URL) and every later build
  screenshot
  (`05-`, `06-mid-build-scenario.png`) show a bot-challenge page instead of the store.
  Navigations at 7–13 still returned `web.action.succeeded` with
  `pageState: changed`; no result code names a challenge (gap).
- Kept steps: 3 after 5, 2 after 10, 1 after 12, 2 at acceptance; all navigations.

## Stage 3 — the proposed Flow

- Adaptation `adaptation.bootstrap.b16f7484-8a66-4e4b-a229-75211734efa2`, outcome `proposed`,
  Flow `flow.031bd0c8-c936-45dc-a43f-93c2e90a6b0e`, `appliedMutationCount: 2`.
- **Shape: 2 nodes, both `web.output.browser-navigate`** (`flowShape`, `authoredNodes`):
  - `node.bootstrap.b4211828ac499d89.main.s1`, url origin `127.0.0.1:59512`, path withheld;
  - `node.bootstrap.b4211828ac499d89.main.s2`, the same.
  The result check itself states both navigations went to the start URL.
- Declared consequences for `main.s1`/`main.s2`: `verb: open`, `effect: mutate`,
  `consequences: []`. Cross-check verdict `undeclared`: both instructed consequences undeclared,
  `declaredNothing: 21` of 21 actions.
- **Why #2 passed:** the instructed-acts check accepted a step that only arrives at the start page
  as the act. That is t174 F5 (`step_only_arrives`), re-tested in run 17. Which act was assigned
  to which step: NO EVIDENCE (gap).

## Stage 4 — playback

`flow-lane.json` `actions[]`, runtime run `52fde8e2-80ac-4901-a261-f2d3c982bf4d` (the repair
run id in `live-llm.json`):

| Attempt | Node | Started | ms | Status | Comparison |
| --- | --- | --- | --- | --- | --- |
| 0 | `main.s1` navigate | 05:41:37.506Z | 2266 | succeeded | matched |
| 1 | `main.s2` navigate | 05:41:41.012Z | 1484 | succeeded | matched |
| 2 | `main.s2` (the result check) | 05:41:42.496Z | 1188 | failed `core.result.does_not_answer_request`, stage `verification` | – |

All 4 evidence packets were truncated (`truncationCount: 4`; 5795, 5826, 5826, 3782 bytes).
No provider calls during playback itself.

## Stage 5 — the answer

`resultVerification: refuted`, basis `model`, 2 checks, both `does_not_answer`
(`llm.loop_verification.ded30036…`, `…53ff6237…`). The check's `actual` names only codes and
counts that are safe to repeat: 0 records across 0 record sets, and the steps were two
`web.output.browser-navigate`. `oracles.finalState: failed`, `records: not_declared`.

## Stage 6 — recovery

Three pieces, in order (`harnessRecovery`, `core.log`, `live-llm.json`):

1. **Result re-author** (`resultReauthor.routed: true`, node `main.s2`). A second evidence loop
   ran 05:41:52.483Z–05:43:02.893Z, **26 decisions**:
   - 1 `detect.list.1` structure detected; 2 `extract.list.1` inspect; 3 amend; 4 `nav.item.5`;
     **5–10 six `amend_draft` in a row**; 11 `nav.item.12`; 12 amend + `rerun.7`;
     13 `nav.item.14`; 14 `nav.search.15`; 15–17 amends (+ `rerun.9`); 18 amend + `rerun.11`.
   - **19–26: eight `complete` in a row, all refused `bootstrap.instructed_act_missing`**; only
     19 ran a dry run (reset + d12). 20–26 made no tool call between refusals.
   - Ended `flow_bootstrap.evidence_unusable_decision`, stage `provider_output_validation`,
     `applied: false`, no adaptation. No click or type ran in the whole loop.
   - The item-page screenshot during this loop (`10-flow-run-scenario.png`, window from 05:42:32) is the bot
     challenge again.
2. **Diagnosis and exploration** (the ladder). Interventions: 3 × `diagnosis`, all
   `validationOk: true`. Exploration loop 05:43:06.110Z–05:43:24.941Z (18,832 ms, 6 actions, 6
   provider calls): `web.recovery.inspect` ok; `navigate_in_scope` ok; `enter_field` ok;
   `web.recovery.press` **`web.action.rejected.no_progress`**; `navigate_in_scope` ok;
   `navigate_in_scope` **`no_progress`** (40 ms); complete.
3. **Refusal:** `llm.runtime_patch_goal_unachievable` at rung `exploration`
   (`events.ndjson` seq 3). No runtime patch attempted, no adaptation, no change proposal.
   `contextSections` omitted `expected_transition`, `actual_transition`, `state_diff`,
   `failed_target`, `recovery_candidates` (all `absent`).

## Causes

| # | Cause, precisely | Repo and file | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | **The instructed-acts check accepted a 2-navigation Flow** (both to the start URL) for an instruction with two mutating acts. | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/check.ts` | **t174** (F5 `step_only_arrives`) | Fixed in t174, re-test in run 17 |
| 2 | **The build acted blind and on a challenge page.** 9 navigations, no successful observation; from about 05:40:44 the scenario served a bot challenge, and navigations onto it still reported `web.action.succeeded`/`pageState: changed`. Nothing in the loop recognised the challenge, so decisions kept being spent on it. What triggers the challenge: NO EVIDENCE (manifest not read). | Core evidence loop (`runtime/llm/evidence-loop.ts`, no-observation guard); extension page classification (no challenge code) — NOT READ | none recorded by t193/t194/t195; supervisor to route | Open (new) |
| 3 | **Result re-author loop ran 26 uncounted provider decisions** and ended on 8 consecutive refused completions with no action between them, then `evidence_unusable_decision`. Its calls appear in no accounting (`llm.calls: 23`). | Core result re-author path (`resultReauthor`) — file NOT READ | t194 (t195's log routes `resultReauthor` to t194, unconfirmed) | Open (new) |
| 4 | **Exploration rung made one press and one navigation, both without progress** (`no_progress`) and declared the goal unachievable; the page it worked on turned into the challenge again (`13-flow-run-scenario.png`). | Core recovery exploration — NOT READ | t193's area (self-repair); not recorded in its log | Open |
| 5 | Call limit: not a cause here (15 build calls, authorized 64). Core's ignoring of the configured limit is **t193** cause B. | – | t193 | – |

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2, 6 | That the page was a bot challenge; only screenshots show it | no result or page-state code for a challenge page |
| 3 | Which act each step was assigned at acceptance | `progress-trace.ts` prints issue codes only |
| 6 | The re-author loop's provider calls, tokens and cost | not in `live-llm.json` `observed`, `repair` or `verification` |
| 6 | Which diagnosis rung each of the 3 interventions was | `harnessRecovery.interventions[]` has kind only |
| UI | Lab labels moments 8–13 `flow-run` although playback ended 05:41:43.7; they are repair | UI review moment labelling |
| UI | When each picture was taken. In every moment checked (3, 4, 7, 8 here; 3, 7, 10, 12 in run 16) the PNG's overlay text equals the **first** sample of the 3 s window, not the last, although `moments[].at` is stamped after the window. So a PNG shows the state at `overlay.startedAt`, about 3 s before `at`. | UI review capture ordering or timestamping (Lab) |
| UI | `activeTabUrl` (t185 row 1) | not recorded |

## UI review

Source: `run-munoeac4-33c17306.ui-review.local.json` (14 moments, 14 scenario + 14 panel
pictures, `skipped: 0`, `failures: []`, panel source `side-panel (devtools target, type page)`,
`masked: 0` everywhere). Overlay samples: 16 per moment, every 200 ms for 3 s, taken just
before the screenshot.

### Screenshots opened (Read tool)

| PNG | What it shows |
| --- | --- |
| `run-munoeac4-33c17306.ui-review.local/01-start-scenario.png` | Start page (store home) with the site's cookie-consent banner across the bottom. **No overlay** (correct: before Core's first event). |
| `run-munoeac4-33c17306.ui-review.local/01-start-panel.png` | Panel, Simple tab: "Connected to FluxIQ"; "Get set up" with "Add an AI model key" **To do**; "RIGHT NOW: Nothing running"; "What should FluxIQ do?". |
| `run-munoeac4-33c17306.ui-review.local/03-mid-build-scenario.png` | Search results page. Overlay bottom-right, "EXPLORING / Using core.run_node / Using core.run_node", **drawn over the consent banner's two buttons**. |
| `run-munoeac4-33c17306.ui-review.local/03-mid-build-panel.png` | "RIGHT NOW: FluxIQ is working / Opening a page" with a red Stop button. Matches the build. |
| `run-munoeac4-33c17306.ui-review.local/04-mid-build-scenario.png` | **Bot-challenge page**; overlay "THINKING / Deciding the next step / Deciding the next step". |
| `run-munoeac4-33c17306.ui-review.local/05-mid-build-scenario.png` | Same challenge page, same overlay text. |
| `run-munoeac4-33c17306.ui-review.local/06-mid-build-scenario.png` | Challenge page; overlay "DONE / Build finished: a Flow is proposed / Build finished". The build ended here. |
| `run-munoeac4-33c17306.ui-review.local/07-flow-run-scenario.png` | Start page with the consent banner before playback's first navigation; overlay "DONE / Build finished". The DOM samples turned "Running / Run started" 1.0 s into the window, so this picture matches the window's start, not `at` (see gaps). |
| `run-munoeac4-33c17306.ui-review.local/08-flow-run-scenario.png` | Search page with three page layers (notification prompt, a welcome-coupon modal, consent banner). Overlay **"REPAIRING / Repairing the Flow: the result check refuted its answer (attempt 1 of 3) / Result repair started"**, wrapping to 2 lines (height 102 px). |
| `run-munoeac4-33c17306.ui-review.local/08-flow-run-panel.png` | Panel says **"RIGHT NOW: Done / Last step: Looked at the page"** while the overlay says Repairing. |
| `run-munoeac4-33c17306.ui-review.local/09-flow-run-scenario.png` | Same layered search page; overlay back to generic "THINKING / Deciding the next step". |
| `run-munoeac4-33c17306.ui-review.local/10-flow-run-scenario.png` | Item URL showing the challenge page; overlay "EXPLORING / Using core.run_node". |
| `run-munoeac4-33c17306.ui-review.local/12-flow-run-scenario.png` | Start page, search box filled by recovery; overlay **"EXPLORING / Using web.recovery.enter_field"**, again over the consent buttons. |
| `run-munoeac4-33c17306.ui-review.local/13-flow-run-scenario.png` | Challenge page; overlay "FAILED / Run failed / Run failed". |
| `run-munoeac4-33c17306.ui-review.local/14-failure-scenario.png` | Challenge page, **no overlay**. |
| `run-munoeac4-33c17306.ui-review.local/14-failure-panel.png` | Panel "RIGHT NOW: **Done** / Last step: Looked at the page" after a failed run. |

### Overlay per moment (`summary.overlay`, `moments[].overlay.counts`)

Rates are per second over the 3.0 s sampling window. Phase changes count transitions of the
phase label (including to or from absent).

| # | Label | Window start | Status | present/samples | textChanges | presenceToggles | visibilityToggles | Phase changes/s | Text changes/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | start | 05:40:03 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 2 | mid-build | 05:40:06 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 3 | mid-build | 05:40:23 | changed | 16/16 | 2 | 0 | 0 | 0.33 | 0.66 |
| 4 | mid-build | 05:40:43 | changed | 15/16 | 1 | 0 | 0 | 0.66 | 0.33 |
| 5 | mid-build | 05:41:03 | flickering | 15/16 | 1 | 2 | 2 | 0.67 | 0.33 |
| 6 | mid-build | 05:41:23 | changed | 13/16 | 0 | 1 | 1 | 0.33 | 0.00 |
| 7 | flow-run | 05:41:32 | changed | 16/16 | 1 | 0 | 0 | 0.33 | 0.33 |
| 8 | flow-run | 05:41:52 | flickering | 16/16 | 5 | 0 | 0 | 1.00 | 1.66 |
| 9 | flow-run | 05:42:12 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 10 | flow-run | 05:42:32 | changed | 15/16 | 1 | 1 | 1 | 0.67 | 0.33 |
| 11 | flow-run | 05:42:52 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 12 | flow-run | 05:43:12 | changed | 16/16 | 2 | 0 | 0 | 0.67 | 0.67 |
| 13 | flow-run | 05:43:32 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 14 | failure | 05:43:35 | changed | 1/16 | 0 | 1 | 1 | 0.33 | 0.00 |

Texts shown (FluxIQ's own strings, phase | detail), in order of first appearance:
"Exploring | Using core.run_node", "Exploring | Using core.run_node: web.action.succeeded",
"Thinking | Deciding the next step", "Done | Build finished: a Flow is proposed",
"Running | Run started", "Repairing | Repairing the Flow: the result check refuted its answer
(attempt 1 of 3)" (sub-line "Result repair started"),
"Exploring | Using core.run_node: web.inspect.succeeded",
"Exploring | Using web.detect_repeating_structure",
"Exploring | Using web.detect_repeating_structure: web.structure.detected",
"Exploring | Using web.recovery.enter_field", "Exploring | Using web.recovery.press",
"Failed | Run failed". Each is rendered as phase, "FluxIQ", headline, then a sub-line that
repeats the headline (or a short form of it). No "Step N of M" was captured in this run (the
two-node playback fell between moments 7 and 8). Moment 8 is the busiest: 5 text changes in 3 s.

### Overlay DOM state

- One host (`hostCount` 0 or 1, never 2), in the scenario tab's top frame, `display: block`,
  `visibility: visible`, `opacity: 1`, `inViewport: true` in every present sample.
- Attributes: `data-fluxiq-activity=""`, `aria-hidden="true"`, `inert=""`.
- Rect: x 947, y 620.36, 300 × 83.64 on pages with a scrollbar; x 964 on the challenge page (no
  scrollbar); 300 × 102.48 at y 601.52 when the Repairing headline wraps to two lines.
- Absences: one sample at each navigation (moments 4, 5, 10), and it leaves the page about
  3 s after "Build finished" (moment 6, 13/16) and after "Run failed" (moment 14, 1/16).

### Panel

Side panel, verified open, Simple tab. The visible first screen never changes structure: status
card "Connected to FluxIQ / Working in: 127.0.0.1", "Get set up" (FluxIQ is running: Done; This
browser is approved: Done; **Add an AI model key: To do**, with "Add a key in FluxIQ"), the
"RIGHT NOW" card, and "What should FluxIQ do?" (Describe an automation / Show FluxIQ how). The
RIGHT NOW card read "Nothing running" at start, "FluxIQ is working / Opening a page" + Stop
during the build, then **"Done / Last step: Looked at the page" from the build's end through the
repair and after the failure**. No chat thread, tool rows or Core turns are visible in any panel
picture (the capture shows the panel's first screen only).

### UI defects found

| # | Defect | Evidence |
| --- | --- | --- |
| U1 | **Raw internal ids and codes in the overlay**: tool ids (`core.run_node`, `web.recovery.enter_field`, `web.detect_repeating_structure`) and result codes (`web.action.succeeded`, `web.structure.detected`) are shown to the user as the headline. | `run-munoeac4-33c17306.ui-review.local/03-mid-build-scenario.png`, `…/12-flow-run-scenario.png`; JSON moments 3, 8 |
| U2 | **Headline repeated as the sub-line** ("Deciding the next step" twice, "Run failed" twice, "Using core.run_node" twice). | `…/04-mid-build-scenario.png`, `…/13-flow-run-scenario.png` |
| U3 | **The overlay covers page controls bottom-right**: the consent banner's decline and accept buttons sit under it for the whole run. It is `inert` so pointer events pass, but a person cannot see or reach them. | `…/03-mid-build-scenario.png`, `…/07-flow-run-scenario.png`, `…/12-flow-run-scenario.png` |
| U4 | **Panel "RIGHT NOW" contradicts the overlay**: "Done / Last step: Looked at the page" while the overlay says Repairing, and "Done" after the run failed. | `…/08-flow-run-panel.png` vs `…/08-flow-run-scenario.png`; `…/14-failure-panel.png` |
| U5 | **"Add an AI model key: To do"** shown while live provider calls are being made. | every panel PNG, e.g. `…/03-mid-build-panel.png` |
| U6 | **Repair is indistinguishable from building**: "Repairing … (attempt 1 of 3)" is shown once, then the overlay falls back to the generic Thinking/Exploring for about 90 s of re-author and recovery; no later attempt number is shown. | `…/08-flow-run-scenario.png` then `…/09-flow-run-scenario.png`, `…/12-flow-run-scenario.png` |
| U7 | **The failure is not left on screen**: the overlay disappears about 3 s after "Run failed" and the panel says "Done", so nothing tells the user the run failed. | `…/14-failure-scenario.png`, `…/14-failure-panel.png` |
| U8 | **Overlay blinks out on every navigation** (one absent sample, 200 ms) and changes up to 5 times in 3 s during re-author (1.66 text changes/s). | JSON moments 4, 5, 8, 10 |
| U9 | **No signal that the page is a bot challenge**: the overlay reads "Deciding the next step" over a challenge page for most of the run. | `…/04-mid-build-scenario.png`, `…/05-mid-build-scenario.png`, `…/10-flow-run-scenario.png` |

## t185 checklist

Rows from `docs/working/live-activity-chat-plan.md`, "Next: what the live lane's next run must
confirm".

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Partly confirmed.** stderr `[lab] live panel: side-panel (verified open)`; `snapshots/live-panel.json` = `{"mode":"side-panel"}`. The panel page was captured at every moment (`side-panel (devtools target, type page)`), and the scenario tab was `inFront: true` with only the scenario URL in `frontTabs`. **On screen beside the page: no evidence** (separate captures, not a window picture). **`activeTabUrl`: no evidence** (not recorded). | full log; `snapshots/live-panel.json`; UI review JSON |
| 2 | Overlay from real events | **Confirmed, with gaps.** Absent at moments 1–2 (before loop start 05:40:15.463Z); host in the top frame; `thinking`/`exploring` during the build, `running` ("Run started") at playback, `done` at build settle, `failed` at settle. **No "Step N of M" was captured** in this run. It showed "Repairing", which is not in the row's list but was emitted by Core. | UI review JSON moments 1–14; PNGs 03, 06, 07, 08, 13 |
| 3 | No interference | **Partly confirmed.** Host carries `data-fluxiq-activity`, `aria-hidden`, `inert`. No action was refused at the bottom-right corner (no click or type ran in playback; recovery's refused press was `no_progress`). DOM snapshots, blockers, interference sentences and `dom.mutation`: **no evidence** (not exported). Visually the overlay hides page controls (U3). | UI review JSON; `flow-lane.json` actions; `core.log` 05:43:17 |
| 4 | Chat | **Contradicted for the header; no evidence for the rest.** The RIGHT NOW card said "Done" through repair and after failure (U4). Tool/step rows, interleaving and a typed instruction: not visible in any panel picture, none sent. | `08-flow-run-panel.png`, `14-failure-panel.png` |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (183 lines) has no error, warn, outbound or `server.activity` line. Session `outbound` growth: not logged. | `logs/core.log` |
