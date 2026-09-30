# Run debug — `run-munmmj5n-52d8a67d` (live run 13)

Worker t174-w10, 2026-09-29. Read from the bundle at
`test-runs/instances/t174-slot-1/run-munmmj5n-52d8a67d` in the t174 worktree and from the
launcher's full Lab stdout (`live-run-13.full.log`, in the supervisor's scratchpad, not in the
repository). No product code changed. Privacy: this file carries only codes, counts, ids,
node ids, durations and timestamps. It contains no page text, extracted values, instruction
text or provider bodies.

---

## Header

- Run id: `run-munmmj5n-52d8a67d`
- Scenario / variant / task: `crossborder-marketplace` / none / `crossborder-marketplace-hub-to-cart`
  (`form`, judged by playback goal `hub-in-cart`; `flow-lane.json` `task`). The instruction is
  219 characters, sha256 `2e6f5e7d…a3a405`.
- Repositories (`run.json`): facility `2d6d27f` (dirty), Core `4d126f6` (clean). Chromium
  134.0.6998.35, 1280×720.
- Command: NO EVIDENCE (`run.json` does not record it). The full log shows the extension
  build was reported `stale` ("104 minute(s) behind", newest source `shared/protocol.ts`) and
  run under `FLUXIQ_LAB_ALLOW_STALE_BUILD=1`, and then the Lab rebuilt the e2e-chromium
  extension itself (`extension build: e2e-chromium: verified 22 files`).
- Time span: Lab 04:50:05.054Z to 04:53:43.912Z (`summary.json`), build loop 04:50:20.572Z to
  about 04:53:38.9Z (`flow-lane.json` `build.durationMs: 202708`).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. The authorized limits
  recorded in `live-llm.json` were `maxCalls: 48`, $0.25 per call and $2 total.
- Calls, tokens, cost: **63 calls**, which is 62 loop decisions plus 1 additional call
  (`additionalProviderCallCount: 1`, the instruction-authority call, which `live-llm.json`
  lists as `unrecordedCalls: 1`). 851,076 input tokens, 7,109 output tokens, $0.1085.
  `budgetBreaches: 0` in Core's accounting. The largest single call had 14,303 input tokens.
- Verdict as reported: failed, `performance.budget`, "63 provider call(s) against --llm-max-calls
  48" (`evaluation.json`, `events.ndjson` seq 3). The failure was raised **after** the build
  settled (seq 2, 04:53:42.112Z) and before playback.
- **Stage reached: 3 (a Flow was proposed).** Completion was accepted at iteration 62, and
  `flow.c689bea0-…` with `adaptation.bootstrap.89f3d318-0425-47bf-b896-4614f41474d9`
  (status `proposed`, `decision-trace.json`) was created. No Flow ran (`runs: 0`,
  `actions: []`), and nothing was answered or judged.

## Stage 1 — the instruction and the expected chain

- The instruction text is withheld under the privacy rule. Core read **2 instructed
  consequences** from it, `modify_existing` and `create_new` (`flow-lane.json`
  `build.instructedConsequences[].consequence`).
- The node chain a correct Flow needs, from the scenario manifest: NOT READ, because the
  brief does not name the scenario's files. At minimum, the Flow needs one mutating step for
  each of the two instructed consequences (goal `hub-in-cart`).

## Stage 2 — exploration

From the `[FluxIQ build-trace]` lines in `logs/core.log`, joined by iteration with
`flow-lane.json` `build.evidenceLoop.steps[]` (node id, `progress`, `draft`, `draftChange`).
Draft step ids `dN` number the executed tool calls in order, with Core's initial call as `d1`.
This numbering checks out: dry run 1 replays `d2`/`d6` = `nav.start`/`nav.search`, and the
amendment at 13 targets `d11`–`d13` = the three calls at iterations 10–12.

| It | Decision | Call id | Node | Result / draft effect |
| --- | --- | --- | --- | --- |
| 0 | (Core's initial) | `initial.core.run_node` | `dom-capture_snapshot` | `web.action.rejected.not_at_start_location` (`start_location_not_reached`). The tab was **not** on the start page. |
| 1 | tool_call | `nav.start` | `browser-navigate` | succeeded (d2, kept) |
| 2 | tool_call | `search.voltbay` | `dom-type` | `web.action.rejected.target_unobserved` (`target_not_a_handle`) |
| 3–4 | tool_call ×2 | `snap.home`, `detect.home` | snapshot, `web.detect_repeating_structure` | inspect / structure detected |
| 5 | tool_call | `nav.search` | `browser-navigate` | succeeded (d6, kept). The search was done by URL, not by typing. |
| 6–9 | tool_call ×4 | `snap.search`, `detect.search`, `detect.search2`, (none) | snapshot, detect ×2 | detect repeated 3×. At 9 the loop answered from memory (`llm_evidence_loop.already_answered`) |
| 10 | tool_call | `click.voltbay-item` | `dom-click` | succeeded. **The only successful click of the build.** |
| 11–12 | tool_call ×2 | `nav.back-search`, `nav.item-page` | `browser-navigate` ×2 | succeeded |
| 13–14 | amend_draft ×2 | – | – | 13 withdrew d11–d13 (kept 2). 14 targeted the same 3 again, all refused (`draft_unchanged`) |
| **15** | **complete #1** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 1: reset, d2, d6, all `core.replay.replayed` |
| 16–42 | tool_call ×23, amend_draft ×4 | `nav.voltbay-item` … `nav.voltbay-item21`, `snap.item`, `snap.item2` | `browser-navigate` ×21, snapshot ×2 | every navigate `web.action.succeeded`, `effectApplied: true`. Amendments at 21, 24, 32 and 41 each withdrew the navigations run since the previous one (d16/d18; d14/d19/d20; d21–d27; d28–d35), so the kept count went 3, 2, 2, 2 |
| 43–48 | amend_draft ×6 | – | – | 43 withdrew d36. 44 targeted d2/d6, refused. 45 withdrew d2/d6 (kept 0). 46 targeted 16 withdrawn ids, all refused. 47 targeted 7, all refused. 48 restored d36 (kept 1) |
| 49 | tool_call | `addtocart.voltbay50` | `dom-click` | `web.action.rejected.target_unobserved` (`target_not_a_handle`). **The only add-to-cart attempt.** It was never retried as a click. |
| 50 | tool_call | `snap.voltbay51` | snapshot | inspect succeeded |
| **51** | **complete #2** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 2: reset, d36, replayed |
| 52–56 | tool_call ×5 | `nav.voltbay-item53` … `57` | `browser-navigate` ×5 | succeeded (d39–d43) |
| **57** | **complete #3** | – | – | **refused `bootstrap.instructed_act_missing`**. Dry run 3: reset, d36, d39–d43, all replayed |
| 58 | tool_call | `nav.voltbay-item58` | `browser-navigate` | succeeded (d44) |
| 59 | amend_draft | – | – | withdrew d43/d44 (kept 5) |
| 60–61 | tool_call ×2 | `nav.voltbay-item61`, `62` | `browser-navigate` ×2 | succeeded (d45, d46) |
| **62** | **complete #4** | – | – | **accepted** (`completion check ok=true`). Dry run 4: reset, d36, d39–d42, d45, d46, all 8 replayed |

Totals: 62 decisions = 45 tool_call + 13 amend_draft (9 `draft_amended`, 4 `draft_unchanged`)
+ 4 complete. The 46 tool calls, counting Core's initial call, were 33 `browser-navigate`
(all succeeded), 2 `dom-click` (1 succeeded, 1 rejected), 1 `dom-type` (rejected), 6
snapshots (1 rejected at start) and 4 structure detections (1 answered from memory).

- **Where decisions were spent without progress.**
  - Iterations 16–42 used **27 decisions** on 21 navigations to the item page (the call ids
    `nav.voltbay-item`…`21`), 2 snapshots and 4 amendments. Each amendment withdrew the
    navigations made since the previous one. None of these iterations produced a kept step
    that survived: the kept count stayed at 2 or 3. The build also did not move on to act.
    No click, type or add-to-cart ran in these iterations. The brief calls them "presses",
    but the trace records every one as `web.output.browser-navigate`, not `dom-click`.
  - Iterations 43–48 were **6 `amend_draft` in a row**, 3 of them `draft_unchanged` (they
    targeted ids already withdrawn: 2, 16 and 7 refused). Net effect: d2/d6 (start and
    search) were withdrawn, and d36 was withdrawn and then restored.
  - **Three `instructed_act_missing` refusals** (15, 51, 57), each followed by a dry run of
    navigations only, so 3 decisions and 3 dry runs of 3, 2 and 7 replays.
  - The run ended at 62, two short of the 64-iteration ceiling
    (`runtime/loop-limits/evidence-loop.ts:28` `maxIterations: 64`).
- **Repeated node.** `web.output.browser-navigate` ran 33 times, 21 of them in 16–42 alone.
  `web.detect_repeating_structure` ran 3 times in 4 decisions (7–9), and the 4th was answered
  from memory. `browser-navigate` reported `pageState: unchanged` at iterations 1, 20, 34, 35,
  37, 52 and 61, so a repeat navigation to the page it was already on still counted as
  `draftState: changed` and `effectApplied: true`.
- **Did the draft grow?** The record count grew steadily, from 1 at iteration 2 to 36 at 62
  (`draft.steps`). Its rendered size reached its 4,000-byte budget by about iteration 25 and
  stayed at 3.8–4.0 KB until the end (`draft.bytes`/`budget`). What the model was shown
  (`draftShown`) is NO EVIDENCE. **Kept** steps did not grow: 2 from 13 to 42, 0 after 45,
  1 after 48, 7 at acceptance. All 7 were navigations.
- **Rejections.** `target_unobserved`/`target_not_a_handle` twice: the search typing at 2,
  routed around by navigating to the search URL, and add-to-cart at 49, followed by a
  snapshot and then a completion instead of a retry. So the code did not lead to a corrected
  click.

## Stage 3 — the proposed Flow

- Completion checks (`logs/core.log`): #1 at 04:50:56.156Z, #2 at 04:52:42.417Z and #3 at
  04:53:05.102Z were refused `bootstrap.instructed_act_missing`. #4 at 04:53:29.451Z was
  accepted (`issues=-`).
- Plans proposed at each completion (`flow-lane.json` `build.declaredConsequences`, the
  `main.sN` refs): #1 had 2 steps, #2 had 1, #3 had 6 and #4 had 7. Every `main.sN` is
  declared `actionKind: flow_step`, `verb: open`, `effect: mutate`, `controlKind: control`,
  `consequences: []`.
- **The accepted plan's shape:** 7 steps = draft d36, d39, d40, d41, d42, d45 and d46. Every
  one is a `web.output.browser-navigate` (iterations 42, 52–55, 60, 61). It contains **no
  click, no add-to-cart and no coupon step**. The start navigation (d2) and search (d6) had
  been withdrawn at 45.
- **Which act the refusals named and why #4 passed:** NO EVIDENCE. The trace prints issue
  codes only. The plan that passed has the same kind of steps (navigations only) as #3, which
  was refused, plus d45/d46 and minus d43. A hypothesis that the bundle cannot settle: the
  instructed-acts check matched a navigation step to an act (as run `muncqlr0` showed, it
  verifies only "kept + mutating + unclaimed", and it assigns leftover claims in order).
  Either way, it accepted a Flow that visibly has no cart or coupon click.
- Consequence cross-check: verdict `undeclared`. Of 70 actions, `declaredNothing: 70`, and
  both instructed consequences are undeclared (`consequenceCrossCheck`).
- Classification: **did not act**. Exploration reached the item page and never completed a
  mutating click there. Completion was reached by navigations alone.
- Node parameters (the navigation targets): withheld, and not in the bundle.

## Stage 4 — replay

No Flow run. The four dry runs are the only replays, and every step was `core.replay.replayed`:

| Dry run | Steps replayed | Durations (ms) |
| --- | --- | --- |
| 1 (after #1) | reset, d2, d6 | 1019, 1031, 1263 |
| 2 (after #2) | reset, d36 | 1013, 1016 |
| 3 (after #3) | reset, d36, d39–d43 | 1262, 1015, 1017, 1265, 1265, 1016, 1266 |
| 4 (after #4, accepted) | reset, d36, d39–d42, d45, d46 | 1276, 1026, 1035, 1274, 1285, 1030, 1271, 1274 |

Provider calls during replay: none.

## Stage 5 — the answer

Not reached. The Lab failed the run `performance.budget` at 04:53:42.130Z, 18 ms after the
build settled, so the accepted Flow never ran and no cart facts were read.

## Stage 6 — judgement and repair

Not reached. There was no playback, verification, repair or persistence beyond the
`proposed` adaptation.

## t185 checklist

Rows from `docs/working/live-activity-chat-plan.md`, "Next: what the live lane's next run must
confirm".

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Partly confirmed.** Confirmed: stderr `[lab] live panel: side-panel (verified open)` (full log). Confirmed: `snapshots/live-panel.json` = `{"mode":"side-panel"}`, the same mode. Confirmed: a side-panel page was created and observed at 9063 ms and paired (`connect.done` in the `pairing` state at 9485 ms, `approve.done` at 9622 ms). **`activeTabUrl`: no evidence.** It appears in no bundle file and not in the full log. Indirect: iteration 0 was refused `not_at_start_location` and `nav.start` then succeeded, so the build's tab was drivable but not already on the scenario at start. On screen beside the page: no evidence (no screenshots). | full log; `snapshots/live-panel.json`; `extension-start.local.json`; `logs/core.log` it 0–1 |
| 2 | Overlay from real events | No evidence; UI review capture added for the next run (t174-w9). Screenshots were suppressed (`screenshotSuppressed: capture-unavailable`, `screenshotCount: 0`). | `events.ndjson`, `summary.json` |
| 3 | No interference | No evidence for the overlay host in snapshots, blockers or mutations (none exported). Indirect: neither rejection (it 2 and it 49, `target_not_a_handle`) names a bottom-right-corner target, and that cannot be checked without the target. UI review capture added for the next run (t174-w9). | `flow-lane.json` steps 2, 49 |
| 4 | Chat | No evidence; UI review capture added for the next run (t174-w9). No typed instruction was sent in this run. | – |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (266 lines) has no line matching error, warn, outbound, `server.activity` or reject outside the build trace. The only gateway line is the WebSocket bind. Session `outbound` growth: no evidence, because it is not logged. | `logs/core.log` |

## Causes

| # | Cause, precisely | Repo and file | Fix | Status |
| --- | --- | --- | --- | --- |
| 1 | **Call-limit gap.** The Flow's configured `llmExecutionSettings.maxCalls: 48` (written by the runner) is not enforced by Core since t186 removed grants. Core's session-key resolver returns no `maxCallsPerRun`, so the loop is bounded only by the 64-iteration ceiling. The build made 63 calls, and the Lab's post-settle budget check then failed a run whose build had succeeded. Core's own accounting reports `budgetBreaches: 0`. | Core `runtime/llm/session-key-provider.ts` (no `maxCallsPerRun`), `runtime/loop-limits/evidence-loop.ts:28`. Facility `packages/test-runner/src/live-llm/flow-settings.ts` (writes 48). | Enforce the configured `maxCalls` as a plain configured limit in Core's loop (not a grant), or make the Lab's `--llm-max-calls` agree with what Core enforces. | Open. Routed to the supervisor; t186's area. |
| 2 | **Decision efficiency.** 27 decisions (16–42) re-navigated to the same item page and withdrew the result each time. 6 amendments in a row (43–48), 3 of them no-ops on already-withdrawn ids. 3 refused completions. The only add-to-cart click (49) was rejected `target_not_a_handle` and never retried, so 62 decisions produced no mutating click. | Core `runtime/llm/evidence-loop.ts` (no-progress guard: a navigation with `pageState: unchanged` still counts as `draftState: changed`; an amend that targets withdrawn ids is not treated as no progress) | Count a same-URL navigation with `pageState: unchanged`, and an amendment refused in full, as no progress, so the redirect fires. After a `target_not_a_handle` rejection on a click, push the model to re-observe and retry the click rather than complete. | Open (new) |
| 3 | **The instructed-acts check accepted a navigation-only Flow** (#4, 7 `browser-navigate` steps) for an instruction with two mutating acts, while refusing #3 of the same shape. | Core `runtime/flow-bootstrap/instructed-acts/check.ts` (in-order fallback assignment; see run `muncqlr0` cause 4) | Same fix as `muncqlr0` cause 4: a claim must name its act, and a navigation cannot satisfy an add/collect act. | Open (by elimination; which act passed is not traced) |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | What each `amend_draft` intended (withdraw vs restore). Only target ids and counts are traced. | Core `runtime/llm/evidence-loop/progress-trace.ts` |
| 2 | What the model was shown of a draft at its 4,000-byte budget (`draftShown`, eviction) | not in `flow-lane.json` steps |
| 3 | Which act `instructed_act_missing` named at 15/51/57, and which step each act was assigned at 62 | `progress-trace.ts` prints issue codes only (`missingActs[].id/reason` and assignments are code-shaped and safe to print) |
| 1 | `activeTabUrl` of the paired extension (t185 row 1) | not recorded by the Lab in the bundle or stderr |
| 2–5 | Overlay, panel and chat appearance | no screenshots (`capture-unavailable`); UI review capture added in t174-w9 |
| header | The Lab command line | `run.json` |
