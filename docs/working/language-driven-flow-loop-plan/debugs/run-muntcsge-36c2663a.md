# Run debug — `run-muntcsge-36c2663a` (live run 19)

Worker t174-w17, 2026-09-30. Read from the bundle at
`test-runs/instances/t174-slot-1/run-muntcsge-36c2663a`, its UI review
(`test-runs/instances/t174-slot-1/run-muntcsge-36c2663a.ui-review.local.json` and the PNG folder
`run-muntcsge-36c2663a.ui-review.local/`), the bundle's own window screenshots
(`screenshots/000NN-*.jpg`), and the launcher's full Lab stdout (`live-run-19.full.log`, in the
supervisor's scratchpad, not in the repository). No product code changed. Privacy: only codes,
counts, ids, node ids, durations, timestamps and FluxIQ's own UI strings. Pages are named by kind
(home page, search results page, item page, robot-check page); no instruction text, page text,
addresses, extracted values or provider bodies.

---

## Header

- Run id: `run-muntcsge-36c2663a`
- Scenario / variant / task: `crossborder-marketplace` / none /
  `crossborder-marketplace-hub-to-cart` (`form`, judged by playback goal `hub-in-cart`). The
  instruction is 219 characters, sha256 `2e6f5e7d…a3a405` (`snapshots/flow-lane.json` `task`),
  the same instruction as runs 15 and 17.
- Build: the first run on the round-1 merged build (t174 F5-F8, t193, t195, t196, t191 round 1).
  Repositories (`run.json`): facility `76e5e76` (dirty), Core `e75dcf2` (clean), both the t174
  tree. Chromium 134.0.6998.35, 1280×720, seed 7342. Ports: scenario 61816, web 61817, gateway
  61818. The Lab's prelude rebuilt five packages in 532.5 s before the run (full log).
- Timeline (UTC):
  - Lab start 07:58:27.864Z (`summary.json`). The extension's worker was announced at +230.7 s,
    connect and approve done at +232.0 s (`extension-start.local.json`). What ran in the 230 s
    before is not timed (gap).
  - Dispatch 08:02:20.684Z (`events.ndjson` seq 1).
  - Build loop 08:02:36.837Z to 08:05:34.310Z (177.5 s; `build.durationMs: 180881`).
  - Core's refusal recorded 08:05:34.330Z (`provider-failures.local.json`); build settle
    08:05:34.502Z (seq 14); error 08:05:34.664Z (seq 15); final picture 08:05:37.858Z (seq 17).
  - Lab end 08:05:41.897Z, `durationMs: 432876`.
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. Authorized: `maxCalls: 64`,
  48k in / 8k out / 56k per call, $0.25 per call, $2 total.
- Calls, cost: **29 calls = 29 loop decisions**, 419,361 in / 3,460 out tokens (289,920 of the
  input tokens were cache hits), **$0.04472**, `budgetBreaches: 0`, `unrecordedCalls: 0`. The
  largest call had 15,483 input tokens. No result check and no repair ran.
- Verdict: failed, `runtime.behavior`, `flowCreated: false`. Core ended the build
  **`flow_bootstrap.evidence_repeat_without_progress`** (stage `provider_output_validation`, HTTP
  400, `retryable: false`). `evaluation.json` `facilityFailure`: boundary `finalized-bundle`, stage
  `scenario.execute`, reason `unclassified`. A Flow record `flow.e94681c6-74b8-493c-ac72-5ab86c2479c6`
  exists with no runs and no adaptations (`decision-trace.json`).
- **Stage reached: 2.** No Flow was proposed.
- Against run 17 (same task, before F7): 10 navigations (was 11), 0 presses (0), 9 refused
  completions (8, all in a row there), ended `evidence_repeat_without_progress` (was
  `evidence_unusable_decision`). Against run 15: 9 navigations, 0 presses, but run 15's
  navigation-only Flow was accepted (before F5).

## Stage 1 — the instruction and the expected chain

- Instruction text withheld. `build.instructedConsequences` is **null**: a failed build does not
  record which acts Core read (gap). Run 15, on the same instruction, recorded `modify_existing`
  and `create_new`. Every completion here was refused `bootstrap.instructed_act_missing`, so Core
  did read at least one act that no step answered.
- A correct Flow (run 15's Stage 1) reaches the item, chooses its options, and makes at least one
  mutating press for each consequence (add to cart, and the second mutating act). It needs at
  least one press. This build made none.

## Stage 2 — exploration (the build)

From `logs/core.log` build-trace lines joined by iteration with `flow-lane.json`
`build.evidenceLoop.steps[]`. Draft ids `dN` number executed tool calls in order, with Core's
initial call as `d1` and a call answered from memory counted. The numbering checks out against
every dry run: dry runs 1-3 replay d2, d3, d4, d6, d9; dry run 4 replays d2; dry run 5 replays d2,
d11, d12, d14, d15; dry run 6 replays d2, d11. Structure detections (d5, d7), the answer from
memory (d8) and the three `needs_person` navigations (d10, d13, d16) are never replayed.

| It | Decision | Call id | Node | Result / draft effect |
| --- | --- | --- | --- | --- |
| 0 | (Core's initial) | `initial.core.run_node` | `web.output.dom-capture_snapshot` | `web.action.rejected.not_at_start_location` (`start_location_not_reached`) (d1) |
| 1 | tool_call | `nav1` | `web.output.browser-navigate` | succeeded, 2478 ms (d2, the start navigation, kept to the end) |
| 2 | tool_call | `nav2` | `browser-navigate` | succeeded, 2670 ms (d3) |
| 3 | tool_call | `nav3` | `browser-navigate` | succeeded, 2354 ms (d4). The search results page follows (moment 4, bundle `00004`) |
| 4 | tool_call | `det1` | `web.detect_repeating_structure` | `web.structure.detected`, 641 ms (d5) |
| 5 | tool_call | `ext1` | `web.output.dom-extract_list` | `web.inspect.succeeded`, 3973 ms (d6) |
| 6 | tool_call | `det2` | `web.detect_repeating_structure` | `web.structure.detected`, 852 ms (d7) |
| 7 | tool_call | – | `web.detect_repeating_structure` | `llm_evidence_loop.already_answered` (d8, from memory) |
| 8 | tool_call | `ext2` | `dom-extract_list` | `web.inspect.succeeded`, 2654 ms (d9) |
| **9** | tool_call | `nav4` | `browser-navigate` | **`web.action.rejected.needs_person`**, 2308 ms, `effectApplied: false` (d10): the first robot check |
| **10** | **complete #1** | – | – | **refused `instructed_act_missing`**. Dry run 1 (27.7 s): reset 1275 ms, d2 replayed, **d3 `core.replay.failed` (2318), d4 failed (2049)**, d6 replayed **10012 ms**, d9 replayed **11060 ms** |
| **11** | **complete #2** | – | – | refused, same. Dry run 2 (27.7 s): identical results (d3 2308, d4 2061 failed; d6 10015, d9 11020 replayed) |
| **12** | **complete #3** | – | – | refused, same. Dry run 3 (27.8 s): identical (d3 2320, d4 2057 failed; d6 10015, d9 11023 replayed) |
| 13 | amend_draft | – | – | **withdrew d3, d4, d6, d9** (applied 4, kept 1: d2). Both search navigations and both list reads are gone |
| 14 | amend_draft | – | – | d2, d3, d4, d6, d9, d10: refused 6, `draft_unchanged` |
| **15** | **complete #4** | – | – | refused, same. Dry run 4 (2.3 s): reset, d2 replayed |
| 16 | tool_call | `nav5` | `browser-navigate` | succeeded, 3484 ms (d11, kept to the end) |
| 17 | tool_call | `nav6` | `browser-navigate` | succeeded, 2571 ms (d12) |
| **18** | tool_call | `nav7` | `browser-navigate` | **`needs_person`**, 2387 ms (d13): the second robot check |
| 19 | tool_call | `nav8` | `browser-navigate` | succeeded, 2396 ms (d14). **An item page** (bundle `00012`, 08:05:06.8); no press followed |
| 20 | tool_call | `nav9` | `browser-navigate` | succeeded, 2217 ms (d15) |
| **21** | **complete #5** | – | – | refused, same. Dry run 5 (6.6 s): reset, d2, d11, d12, d14, d15, all replayed in 1.0-1.3 s |
| 22 | amend_draft | – | – | withdrew d12, d14, d15 (applied 3, kept 2: d2, d11) |
| **23** | **complete #6** | – | – | refused, same. Dry run 6 (3.3 s): reset, d2, d11 replayed |
| **24** | tool_call | `nav10` | `browser-navigate` | **`needs_person`**, 3526 ms (d16): the third robot check |
| **25** | **complete #7** | – | – | refused, same. **No dry run** |
| 26 | amend_draft | – | – | d2, d11: refused 2, `draft_unchanged`, kept 2 |
| **27** | **complete #8** | – | – | refused, same. No dry run |
| **28** | **complete #9** | – | – | refused, same. No dry run |
| 29 | amend_draft | – | – | d2, d11 again: refused 2, `draft_unchanged`. **The no-progress guard ends the build** (`evidence_repeat_without_progress`) |

Totals: 29 decisions = 15 tool_call (1 answered from memory) + 5 amend_draft (2 applied, 3
`draft_unchanged`) + 9 complete. 15 executed tool calls (`toolCallCount: 15`): **10
`browser-navigate` (7 succeeded, 3 `needs_person`)**, 2 `detect_repeating_structure`, 2
`dom-extract_list`. **No click, press, type or snapshot was ever attempted**, and
`toolIds` holds only `core.run_node` and `web.detect_repeating_structure`.

- **Where decisions and time went without progress.**
  - The 6 dry runs took 27.7, 27.7, 27.8, 2.3, 6.6 and 3.3 s: **95.5 s of the 177.5 s loop
    (54%)**. Each ran after a completion check that had already refused (`completion check
    ok=false`, then `dryrun.N.reset` in the same millisecond).
  - The six list-read replays in dry runs 1-3 took **63.1 s** (10.0-11.1 s each) and reported
    `core.replay.replayed`. The scenario tab showed the **robot-check page** during them: bundle
    `00005` (08:03:19.6, inside `dryrun.1.6`), `00007` (08:03:50.5, inside `dryrun.2.6`) and
    `00009` (08:04:21.3, inside `dryrun.3.6`). A list read on a robot-check page counted as
    replayed.
  - The two search navigations d3 and d4 failed replay in all three dry runs (2.0-2.3 s each). The
    failure carries no reason (gap). They failed while the check was up and after the first
    `needs_person`, consistent with the scenario serving the check on repeated search loads
    (`reports/robot-check-behaviour.md`), but not proven.
  - Decisions took 47.1 s in all (29 calls, 1.1-2.7 s each); tool calls 130.2 s (44 including
    replays).
- **What F7 changed (its first live run).** The three navigations onto the robot check now return
  `web.action.rejected.needs_person` with `effectApplied: false`, where run 17's returned
  `web.action.succeeded`. The code reached the model, but nothing paused to ask a person: after
  the first check at 9, the model issued 6 more navigations, and 2 of them landed on the check
  again (18, 24). F7's stated effect "stops re-navigating into it" is not borne out. The fix log
  row names the code `web.intervention.required`; the trace shows `needs_person`.
- **Did the draft grow?** The draft record count went 1 → 12 (`draft.steps`). Rendered size
  peaked at 3,962 of 4,000 bytes (19). The draft guidance fell 1,019 → 177 bytes at 20 (by
  design, t193 cause E). Kept steps: 1 after 13, 2 after 22, and **2 at the end (d2 and d11, two
  navigations)**. `answerability.recordProducerPresent` was true at 10-12 and false from 15, after
  13 withdrew both list reads.
- The run ended at 29 of the 64-decision ceiling, on the no-progress guard, not the budget.

## Stage 3 — the proposed Flow

None. `adaptationId: null`, `flowShape: null`, `authoredNodes: null`. The final draft
(revision 14) held two navigations (d2, d11) and no act of any kind. `declaredConsequences` and
`consequenceCrossCheck` are null.

## Stage 4 — playback

Not reached (`runtimeRunId: null`, `actions: []`).

## Stage 5 — the answer

Not reached (`resultVerification: null`, `oracleVerdict: null`).

## Stage 6 — recovery

Not reached (`harnessRecovery: null`, `harnessActivations: 0`, `interventions: 0`).

## Causes

Fix logs read before naming an owner: `fxwork/t193/…/reports/t193-live-self-repair.md`,
`fxwork/t194/…/reports/t194-live-judge-answer.md`, `fxwork/t195/…/reports/t195-live-control-flow.md`.

| # | Cause, precisely | Repo and file | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | **The robot check was never answered.** Navigations at 9, 18 and 24 landed on the robot-check page and returned `web.action.rejected.needs_person` (F7). Nothing paused the build to ask the person. The model kept navigating (6 more navigations after the first check), and the check was still on screen at the end (`12-failure-scenario.png`, bundle `00015`). The same check broke the dry runs: d3 and d4 failed replay in dry runs 1-3, amendment 13 withdrew them with both list reads, and the draft never recovered its search path. | extension F7 (`content/action-runtime/challenge-evidence.ts`, `runtime/landed-challenge.ts`); Core build loop has no handling for the code (`reports/robot-check-behaviour.md`) — Core NOT READ | **t197** (pause and ask the person; the Lab plays the person) | Open. F7's code is live-confirmed; the loop's response is t197's |
| 2 | **A list read replays as success on the robot-check page.** d6 and d9 were `core.replay.replayed` after 10.0-11.1 s each in dry runs 1-3 (63.1 s in all) while the tab showed the check (bundle `00005`, `00007`, `00009`). F7 covers navigations only; `robot-check-behaviour.md` already notes that a click landing on a check still reports success. | domain `runtime/llm-evidence/node-run/replay.ts`, extension list extraction — NOT READ | **t197** (check detection beyond navigation), with t174 for the dry run | Open (new) |
| 3 | **Navigate-only exploration, recurring.** 10 navigations, 2 structure detections, 2 list reads, 0 presses. At 19 the model reached an item page by navigation and pressed nothing. **Recurring:** run 13 cause B (a navigation-only accepted plan), run 15 (9 navigations, 0 presses), run 17 (11 navigations, 0 presses). **New in this run:** the model did look, with 2 detections and 2 list reads, and F5 held, so no navigation-only Flow was accepted. No fix in t193-t195 covers it: t193 A is `dom-select` against a button, t193 C is repeated answered requests, and t195 F2 and F14 are per-item wording. | Core evidence-loop decision instruction and tool offer (`runtime/llm/evidence-loop.ts`) — NOT READ | **t174** (run 17 row: "the model's navigate-only exploration stays open") | Open, recurring (third crossborder run) |
| 4 | **Nine refused completions, then the no-progress stop.** Completions 25, 27 and 28 came with no action between them, and amendments 26 and 29 repeated the same refused targets (d2, d11). The guard ended the build at 29. Given no progress, the stop is correct; the loss is the 9 completion calls and 3 refused amendments. Which act each refusal found missing is not traced (gap). | Core `llm/evidence-loop/answered-request.ts` and the no-progress guard | **t174** (run 13 cause C, run 16 cause 7); t193 cause C routes repeats to t189's area | Open |
| 5 | **Dry runs spent on drafts already refused.** All 6 dry runs followed a failed completion check: 95.5 s, 54% of the loop. Completions 25, 27 and 28 ran none, and the trace does not say why. | Core `flow-draft/dry-run.ts`, `llm/node-tools/dry-run-gate.ts` — NOT READ | none recorded; t174 N1 routes the dry-run gate to t189 | Open (new observation, efficiency) |
| 6 | Call limit, cost: not causes (29 of 64 calls, $0.045, 0 breaches). | – | – | – |

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 1 | Which instructed acts Core read (`instructedConsequences: null` on a failed build), and whether an instruction-authority call ran (calls 29 = decisions 29; runs 15 and 18 each had one extra unrecorded call) | failed-build record; `live-llm.json` `observed` |
| 2 | Which act each of the 9 refusals found missing, what each amendment meant to change, and what each completion claimed. **t195's F13 trace fields (`missing=`, `acts=`, `amend=`) are absent from this build**: `progress-trace.ts` in Core `e75dcf2` has none of them, although t195's round-1 file list names `progress-trace.ts` | Core `llm/evidence-loop/progress-trace.ts` (t174 tree) |
| 2 | Why d3 and d4 failed replay (`core.replay.failed` has no reason, not even "robot check") | dry-run trace |
| 2 | What the d6 and d9 replays read on the robot-check page (rows kept), and why each took 10-11 s | dry-run trace |
| 2 | Which page kind each navigation reached (only the screenshots show it) | build tool results carry no page kind |
| 2 | Why completions 25, 27 and 28 ran no dry run (t174 N1's reuse gap again) | `progress-trace.ts` has no line for a dry run that is skipped or reused |
| End | A no-progress stop is labelled stage `provider_output_validation`, HTTP 400, although the provider's output validated | Core generation-failure stage mapping |
| Header | 230.7 s from Lab start to the extension worker's announcement; `core-web-build.log` has no timestamps | Lab start trace |
| UI | Each PNG shows the state at its window's start (`overlay.startedAt`), not at `moments[].at`. It recurs here: the PNGs of moments 3, 6, 10 and 11 match their first sample | UI review capture ordering (Lab) |
| UI | What the panel's "N steps so far · M failed" and "Worked for 49s" count | panel counter source, not in any artifact |
| 1 | `activeTabUrl` (t185 row 1) | not recorded |

## UI review

Source: `run-muntcsge-36c2663a.ui-review.local.json`. It has 12 moments, 12 scenario and 12 panel
pictures, `skipped: []`, `skippedTicks: 0`, `failures: []`. The panel is `side-panel (devtools
target, type page)`, `masked: 0` at every moment. The scenario tab was `inFront: true` and the
only entry in `frontTabs` at all 12. Overlay samples: 16 per moment, about 200 ms apart, over 3 s.
For the first time the bundle also carries 15 window screenshots (13 distinct, 2 duplicates) that
show the page and the side panel together.

### Screenshots opened (Read tool)

| PNG | What it shows |
| --- | --- |
| `run-muntcsge-36c2663a.ui-review.local/01-start-scenario.png` | Home page with the site's cookie-consent banner across the bottom. No overlay (correct: before Core's first event). |
| `run-muntcsge-36c2663a.ui-review.local/01-start-panel.png` | Panel Simple tab: "Connected to FluxIQ / Working in: 127.0.0.1"; "Get set up" with **"Add an AI model key: To do"**; **new activity area**: header "FluxIQ" with a Page / Full / Small / Off switch, "What can FluxIQ do for you?", "Describe what you want done, in your own words. FluxIQ builds it and shows its work here.", input "Ask FluxIQ to do something...". **No RIGHT NOW card.** |
| `…/03-mid-build-scenario.png` | Home page with the site's welcome-coupon modal and the consent banner. Overlay **bottom-left**, "Building your Flow / Using core.run_node", over the left end of the banner's text. |
| `…/03-mid-build-panel.png` | Header "FluxIQ · Building your Flow"; entry "Building your Flow / Using core.run_node: web.action.succeeded / 4 steps so far". |
| `…/04-mid-build-scenario.png` | Search results page under the coupon modal, a notification prompt top-left and the consent banner. Overlay "Building your Flow / Deciding the next step", bottom-left. |
| `…/06-mid-build-scenario.png` | **Robot-check page** (after dry run 1). Overlay "Building your Flow / Deciding the next step". |
| `…/06-mid-build-panel.png` | "Building your Flow / Deciding the next step / 18 steps so far · 1 failed". |
| `…/10-mid-build-scenario.png` | **Robot-check page** right after the second `needs_person` (08:05:00.5). Overlay "Building your Flow / **Using core.run_node: web.action.rejected.nee…**", cut off with an ellipsis. |
| `…/10-mid-build-panel.png` | "Building your Flow / Using core.run_node: web.action.rejected.needs_person / 27 steps so far · 3 failed". Nothing asks the person to act. |
| `…/11-mid-build-scenario.png` | Home page during dry run 6; overlay "Building your Flow / Using core.run_node" over the banner's text. |
| `…/11-mid-build-panel.png` | "Building your Flow / Using core.run_node / **26 steps so far · 4 failed**". |
| `…/12-failure-scenario.png` | **Robot-check page, unanswered**; overlay "✕ Build failed / Build failed". |
| `…/12-failure-panel.png` | Header "FluxIQ · Build failed"; entry "**Worked for 49s · 25 steps · 7 failed**" in red. |
| `run-muntcsge-36c2663a/screenshots/00004-a307ed96a42e.jpg` | Window at 08:03:04.3: search results with the coupon modal; the side panel is open beside the page, reading "Building your Flow / Using core.run_node / 10 steps so far". |
| `…/screenshots/00005-35ebe10161a2.jpg` | 08:03:19.6, inside `dryrun.1.6`: **robot-check page**; panel "17 steps so far · 1 failed". |
| `…/screenshots/00007-8f6bd5caf645.jpg` | 08:03:50.5, inside `dryrun.2.6`: robot-check page; panel "24 steps so far · 2 failed". |
| `…/screenshots/00009-618e5f7f95ab.jpg` | 08:04:21.3, inside `dryrun.3.6`: robot-check page; panel "27 steps so far · 3 failed". |
| `…/screenshots/00011-d66eb106d589.jpg` | 08:04:51.6: home page; panel "**28 steps so far · 4 failed**". |
| `…/screenshots/00012-83ed574cea04.jpg` | 08:05:06.8, after `nav8`: **an item page**; overlay and panel "Deciding the next step", panel "27 steps so far · 3 failed". |
| `…/screenshots/00013-d4a37cbafbea.jpg` | 08:05:22.0: home page; panel "26 steps so far · **3 failed**" (1.2 s after moment 11 showed 4). |
| `…/screenshots/00015-caf6ebb1d2e1.jpg` | 08:05:37.9, final: robot-check page, overlay "Build failed / Build failed", panel "Build failed / Worked for 49s · 25 steps · 7 failed". |

### Overlay per moment

Rates are per second over the window of about 3.0 s. Phase changes count transitions of the phase
label between samples, including to or from absent. `textChanges`, `presenceToggles` and
`visibilityToggles` are as `summary.overlay` reports them.

| # | Label | Window start | Status | present/samples | textChanges | presenceToggles | visibilityToggles | Phase changes/s | Text changes/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | start | 08:02:19.907 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 2 | mid-build | 08:02:22.941 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 3 | mid-build | 08:02:40.700 | flickering | 16/16 | 3 | 0 | 0 | 0.00 | 0.99 |
| 4 | mid-build | 08:03:00.701 | changed | 16/16 | 1 | 0 | 0 | 0.00 | 0.33 |
| 5 | mid-build | 08:03:20.720 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 6 | mid-build | 08:03:40.734 | changed | 15/16 | 2 | 0 | 0 | 0.66 | 0.66 |
| 7 | mid-build | 08:04:00.777 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 8 | mid-build | 08:04:20.761 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 9 | mid-build | 08:04:40.785 | changed | 16/16 | 1 | 0 | 0 | 0.00 | 0.33 |
| 10 | mid-build | 08:05:00.782 | flickering | 15/16 | 2 | 2 | 2 | 0.67 | 0.67 |
| 11 | mid-build | 08:05:20.790 | changed | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 12 | failure | 08:05:34.680 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |

Moment 6's one absent sample (08:03:43.135) is counted as 0 presence toggles by the summary,
although it is present, absent, present. Moment 10's is counted as 2.

**Status-change rate.** At most 3 text changes in 3.0 s (0.99 per second, moment 3). The phase
label is always "Building your Flow" during the build, so the phase changes only through a
drop-out (0.66 per second at moments 6 and 10).

**Pacing.** Every text that changed was held for at least about 1.2 s. The sampled gaps between
successive changes are all about 1.20 s (moment 3: 0.404 → 1.606 → 2.807 s; moment 10: 1.011 →
2.214 s; moment 11: 1.804 → 3.003 s). At 200 ms sampling that means no text stayed under
1.0 s. The price is lag. Against `core.log`:
- Moment 3: `nav1` ended 40.952 and its result showed at 41.104. Decision 2 began at 40.957, but
  "Deciding the next step" first showed at 42.306, **1.35 s late**. `nav2` began at 42.910 and
  "Using" showed at 43.507.
- Moment 6: completion 11 was refused at 41.854. **"Checking the proposed result" showed from
  41.935 to 42.946, after the refusal.** The overlay dropped at 43.135, at the end of dry run 2's
  reset, then showed "Using" at 43.339.
- Moment 9: decision 13 began at 40.011 and "Deciding" showed at 41.238 (1.23 s).
- Moment 10: the `needs_person` result (00.513) was shown until at least 01.584. Decision 19
  (from 00.516) showed at 01.793 (1.28 s). The overlay dropped at 02.183 on `nav8`'s page load.
  "Deciding" showed 02.389-02.791, after that decision had ended at 02.130. "Using" showed at
  02.996.
- Moment 11: `dryrun.6.2`'s result (21.400) was never shown. `dryrun.6.11`'s result (22.432)
  showed at 22.594, and decision 24 (22.435) showed at 23.793 (1.36 s).
- Moment 12: "Build failed" from the first sample, 0.18 s after the settle event.

The overlay never showed a state Core had not emitted, but it can show one that Core has already
left, for up to about 1.4 s.

Texts shown (FluxIQ's own strings, title | detail):
- "Building your Flow | Using core.run_node"
- "Building your Flow | Using core.run_node: web.action.succeeded"
- "Building your Flow | Deciding the next step"
- "Building your Flow | Checking the proposed result" (new)
- "Building your Flow | Using core.run_node: core.replay.replayed"
- "Building your Flow | Using core.run_node: web.action.rejected.needs_person" (cut to
  "…web.action.rejected.nee…" on screen)
- "Build failed | Build failed"

Panel texts: "What can FluxIQ do for you?"; "FluxIQ · Building your Flow"; the entry "Building your
Flow" with the same detail line as the overlay and "N steps so far[ · M failed]"; "FluxIQ · Build
failed"; "Worked for 49s · 25 steps · 7 failed".

### Overlay DOM state

- One host (`hostCount` 0 or 1), `display: block`, `visibility: visible`, `opacity: 1`,
  `inViewport: true` whenever present, `documentVisibility: visible` throughout.
- Attributes: `data-fluxiq-activity=""`, `aria-hidden="true"`, `inert=""` (unchanged).
- **Rect: x 16, y 650, 300 × 54 in every present sample.** Runs 15-18 had x 947 (964 without a
  scrollbar), y 620.36, 300 × 83.64, and 102.48 tall when wrapped. The box is now two lines (title,
  detail) and never wraps; a long detail is cut with an ellipsis.
- Absent at moments 1-2 (their windows end at 08:02:25.95, before loop start 08:02:36.837). One
  absent sample each at moments 6 and 10, on page loads. **Present through all 16 samples of the
  failure moment**, and still on screen in the final window picture (08:05:37.9, 3.4 s after
  settle).

### What t191 round 1 changed, against runs 15-18

- **Position:** bottom-right (x 947) → **bottom-left (x 16, y 650)**. It no longer sits on the
  consent banner's buttons or a chat bubble, which are on the right. It now covers the left end
  of the consent banner's text (moments 3, 4, 11). No control was under it in the pictures opened.
- **Pacing:** each text is now held for at least about 1.2 s. Before, a tool that ran for 110 ms
  could show for a single sample (run 18, moment 4). The maximum rate is 0.99 text changes per
  second: runs 15-18 peaked at 1.66 (run 15, moment 8) and 1.0 (run 18, moment 4). By count, U7's
  ceiling of 1.0 per second is met, not lowered. The cost is a lag of up to 1.36 s behind Core.
  Drop-outs on page loads remain.
- **Wording:** a single title "Building your Flow" replaces the phase words
  (Thinking / Exploring / Verifying / Done). "The proposed result passed its check" is gone;
  "Checking the proposed result" takes its place.
- **Panel:** the RIGHT NOW card is gone. An activity area with the same title and detail as the
  overlay, a step counter and a Page / Full / Small / Off switch replaces it.

### How the robot check looks to a person

- **On the page:** the robot-check page fills the tab (moments 6, 10 and 12; bundle `00005`,
  `00007`, `00009` and `00015`). The overlay reads "Building your Flow / Using core.run_node:
  web.action.rejected.nee…" for about 1-1.3 s after each `needs_person`, then "Deciding the next
  step" or "Using core.run_node" while FluxIQ keeps navigating. Nothing on the page says a
  person's answer is needed.
- **In the panel:** the same raw code, "Using core.run_node: web.action.rejected.needs_person",
  and a "failed" count. No prompt, question or button asks the person to answer the check.
- **At the end:** "Build failed" in the overlay and the panel, over a check that is still waiting.
  The panel's "7 failed" is the only hint, and it does not name the check.

### Panel

Side panel, verified open, Simple tab. First screen: the status card, "Get set up" with **"Add an
AI model key: To do"**, then the new activity area. The panel's title and detail matched the
overlay's at every moment opened (3, 6, 10, 11, 12) and in every window picture. The step counter
does not only rise:
- steps: 4 (08:02:40.7) → 10 → 17 → 18 → 24 → 27 → **28** (08:04:51.6) → 27 (08:05:00.8) → 27 →
  26 (08:05:20.8) → 26 → **25** at the end;
- failed: 1 (08:03:19.6) → 1 → 2 → 3 → **4** → 3 → 3 → **4** (08:05:20.8) → **3** (08:05:22.0) →
  **7** at the end;
- "Worked for 49s", for a build loop of 177.5 s (193.8 s from dispatch to settle). The sum of
  decision time is 47.1 s; whether the counter measures that is not recorded.

Rows behind the entry's ">" were not opened (the capture shows the first screen only). Panels 02,
04, 05 and 07-09 were not opened.

### UI defects found

U1-U11 are the defects in `reports/t174-live-lane.md` ("Runs 14-17" and run 18's rows).

| # | Defect | This run | Evidence |
| --- | --- | --- | --- |
| U1 | Raw tool ids and result codes shown to the person | **recurs** ("Using core.run_node", `web.action.succeeded`, `core.replay.replayed`, `web.action.rejected.needs_person`). Node ids in playback: not seen (no playback) | `…/03-mid-build-panel.png`, `…/10-mid-build-scenario.png`, `…/10-mid-build-panel.png` |
| U2 | Headline repeated as the sub-line | **partly fixed**: build lines differ (title, then detail); **recurs at failure** ("Build failed / Build failed") | `…/12-failure-scenario.png` |
| U3 | Overlay covers page controls bottom-right | **changed**: moved bottom-left, off the consent buttons; now over the left end of the consent banner's text | `…/03-mid-build-scenario.png`, `…/11-mid-build-scenario.png` |
| U4 | Panel RIGHT NOW contradicts the overlay | **fixed (not seen)**: the card is gone, and the panel's activity entry matched the overlay at every moment opened | `…/06-mid-build-panel.png` vs `…/06-mid-build-scenario.png`; `…/12-failure-panel.png` |
| U5 | "Add an AI model key: To do" during a live build | **recurs** | every panel PNG, e.g. `…/10-mid-build-panel.png` |
| U6 | Control name joined without a separator | **not seen** (no click ran) | – |
| U7 | Flicker up to 1.0 changes per second; drop-outs on navigation | **partly fixed**: paced (each text held ≥ about 1.2 s), peak 0.99 per second; drop-outs recur (moments 6, 10); new lag up to 1.36 s | JSON moments 3, 6, 10, 11 |
| U8 | A failure gives no reason and is not left on screen | **partly fixed**: "Build failed" stays (16/16, and in the final picture) and the panel agrees; **no reason is given** (not the robot check, not "no progress") | `…/12-failure-scenario.png`, `…/12-failure-panel.png`, bundle `00015` |
| U9 | Nothing tells the person a robot check is waiting | **recurs**: only the raw `needs_person` code, cut off in the overlay | `…/10-mid-build-scenario.png`, `…/10-mid-build-panel.png`, `…/12-failure-scenario.png` |
| U10 | Dry runs look like exploring | **recurs**: 95.5 s of dry runs read "Building your Flow / Using core.run_node" and "…: core.replay.replayed" | JSON moments 5, 7, 8, 11; `…/11-mid-build-scenario.png` |
| U11 | "The proposed result passed its check" overstates | **not seen** (string gone). Its successor "Checking the proposed result" showed for 1.0 s **after** the check had refused (moment 6) | JSON moment 6 |
| U12 | **New.** The panel's step and failure counters go backwards (28 → 25 steps; failed 4 → 3 → 4 → 3 → 7), and "Worked for 49s" is shown for a 177.5 s build | new | `…/11-mid-build-panel.png` vs bundle `00013`; bundle `00011`; `…/12-failure-panel.png` |
| U13 | **New (minor).** The 300 px overlay cuts a long detail with an ellipsis, so the one line about the robot check reads "…web.action.rejected.nee…" | new | `…/10-mid-build-scenario.png` |

## t185 checklist

Rows from `docs/working/live-activity-chat-plan.md`, "Next: what the live lane's next run must
confirm".

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Confirmed, except `activeTabUrl`.** stderr `[lab] live panel: side-panel (verified open)`; `snapshots/live-panel.json` = `{"mode":"side-panel"}`; the panel page captured at all 12 moments; the scenario tab `inFront: true`, alone in `frontTabs` at every moment. **Beside the page on screen: confirmed for the first time** by the bundle's window screenshots (e.g. `00004`, `00012`, `00015`), which show the side panel docked beside the scenario tab. `activeTabUrl`: no evidence. | full log; `snapshots/live-panel.json`; UI review JSON; `screenshots/` |
| 2 | Overlay from real events | **Confirmed.** Absent before Core's first event (moments 1-2 end 08:02:25.95; loop start 08:02:36.837). Present in the top frame through the build, and "Build failed" at settle. Every text seen matches a `core.log` event, lagging it by up to 1.36 s (moments 3, 6, 9, 10, 11). "Running" / "Step N of M": not applicable (no playback). | UI review JSON; `logs/core.log`; PNGs 03, 06, 10, 12 |
| 3 | No interference | **Partly confirmed.** Host marked `data-fluxiq-activity`, `aria-hidden`, `inert`. No click or type ran, so nothing could be refused by the overlay. The three refusals were `needs_person`, on navigations. The overlay sits over banner text, not a control, in the pictures opened. Snapshots, blockers, interference sentences and `dom.mutation`: **no evidence** (not exported). | `flow-lane.json` steps; `core.log`; `03-`, `11-mid-build-scenario.png` |
| 4 | Chat | **Header confirmed (U4 not seen); rows not seen.** The activity header and entry agreed with the overlay at every moment opened, including failure. Step rows behind ">" were not opened; no typed instruction is visible (input empty). The counter misbehaves (U12). | `03-`, `06-`, `10-`, `11-`, `12-*-panel.png`; bundle `00011`, `00013` |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (164 lines, 156 build-trace) has no error, warn, outbound or `server.activity` line. `outbound` growth: not logged. | `logs/core.log` |
