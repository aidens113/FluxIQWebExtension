# Run debug — `run-muntc23v-7fcc4110`

t194 lane C, run 5. Same task and Stage 1 as `run-munnhi5q-4867dabe.md`. Written after the fact (brief t194-d56) from the kept bundle, the kept workspace and the Lab log. The cause of the store refusals was found by `reports/t194-w10-origin-pace.md`; this debug places it in the run and says where and why the build stopped.

## Header

- Run id: `run-muntc23v-7fcc4110`
- Scenario / variant / task: `everything-store` / none / `everything-store-plus-earbuds-under-50` (workflow `plus-under-fifty`, expected dataset `extract-plus-under-fifty`, 13 records)
- Command: lane C live-run script on slot-3, instance `t194-slot-3`, headed, side panel verified open; full Lab log `scratchpad/t194/run05.log` (session `eb370cd2`).
- Date, provider, model: 2026-09-30. Prelude 07:47 to 07:57:53 UTC (615,521 ms; every package rebuilt, the extension alone 332,405 ms). Scenario 07:57:53 to 08:07:08 UTC (553,942 ms). Build loop 08:02:24.994 to 08:06:54.642 (275,086 ms). DeepSeek `deepseek-flash`, profile `production`, 48-call cap.
- Provider calls, tokens, cost: 39 calls (all in the build loop), 523,571 in + 8,994 out = 532,565 tokens. **Cost USD 0.061516** (`snapshots/live-llm.json` `observed.totalEstimatedCostUsd` 0.061516067999999986). `perCallRecords: "not recorded"`, `unrecordedCalls: 5`.
- Verdict as reported: `failed`, `runtime.behavior`; `flowCreated: false`; `oracleVerdict: null`, `reportedVerdict: null`; `facilityFailure: {boundary: "finalized-bundle", stage: "scenario.execute", reason: "unclassified"}`; first failure (event 22): "FluxIQ did not build a Flow from the task's instruction (flow_bootstrap.evidence_unusable_decision)", stage `provider_output_validation`, HTTP 400, `issueCodes: ["llm_evidence_loop.dry_run_refused", "core.replay.reset_failed"]`.
- **Stage reached: 2** (exploration). The loop reached an accepted completion check (Stage 3's door) ten times, but no draft ever passed its dry run, so no Flow was proposed. Stages 3 to 6 did not happen.

### Where and why it stopped, and whose defect it is

1. **The store's limiter refused the build's own reruns.** Each `rerun.N` of the extract step is a reset navigation plus four `next` loads, about 11 s, with 1.3 to 3 s of model time between them (`logs/core.log`). The store refuses a load when five were served in the 8 s before it (`everything-store/state/throttle.ts:16-21`, per w10). The UI review shows the "Sorry, you're going a little too fast" 429 page at 08:03:49 (moment 07, inside `rerun.10`), 08:04:49 (moment 10, inside `rerun.13`) and 08:05:29 (moment 12, inside `rerun.17`, the 27.5 s rerun).
2. **The third refusal flagged the session** (`route.ts:36-45`, per w10). From 08:05:49 (moment 13) every load of the store is the robot check ("Enter the characters you see below"), to the end of the run (moments 13 to 17, final screenshot).
3. **Every dry run then failed at its reset.** The model's first completion was accepted by the completion check at 08:05:47 (`completion check ok=true`). The dry run's reset navigates to where the draft's first step started; it landed on the robot check, and the domain answered `core.replay.reset_failed` ("the page could not be put back"). That happened ten times (`dryrun.1.reset` to `dryrun.10.reset`, 08:05:47 to 08:06:54, about 1.0 to 1.3 s each). The one navigate the model made itself (`nav4`, 08:06:36) answered `web.action.rejected.needs_person`.
4. **The no-progress guard ended the loop.** Iterations 34 to 37 and 39 were refusals with the same issue set (`dry_run_refused` + `reset_failed`), so `unusableDecisions.stalled` (Core `llm/evidence-loop.ts:367-380`) raised `flow_bootstrap.evidence_unusable_decision` at iteration 39 with 9 of 48 calls unspent.

So the stop is a **product defect**, not a Lab one. FluxIQ paced nothing, so its own reruns got the session flagged (w10). Its dry-run reset did not say the page needed a person (fixed later in `0faee6e6`, see Causes 2). The Lab's only defect here is the label. `packages/test-runner/src/run-scenario.ts:505-507` projects **any** error as a facility failure when `flowObservation?.reportedVerdict == null`, so a product build failure raised as `RunnerFailure("runtime.behavior")` is also stamped `facilityFailure: scenario.execute/unclassified`. The Lab ran correctly. The store behaved as designed: its 429 and robot check are the scenario's deliberate traps.

## Stage 1 — the instruction and the expected chain

- The instruction, verbatim: Find every pair of wireless earbuds in the store's search results that is Brightaisle Plus eligible, rated 4.0 or higher and priced under $50, going through every page of results. Leave out sponsored placements and accessories such as ear tips or charging cases, list each pair only once even if it turns up on two pages, and keep the order the search results show them in, with columns name, price, rating and url.
- The node chain a correct Flow must have (as written for run 1, before any run was read):
  1. Navigate to the store and clear its interruptions (deal dialog "Not now", cookie banner) and the first-search browser check ("Continue shopping") if shown, as an optional step.
  2. Search `wireless earbuds` through the header field and submit.
  3. Optionally narrow with the store's filters (Brightaisle Plus; max price 49.99). Not "4 Stars & Up" alone, and not "$25 to $50".
  4. Let the four lazy results per page load.
  5. Extract organic cards only (`data-ad-id` absent, no sponsored carousel), fields name, price, rating, url, keeping: earbuds, not accessories (ear tips, a charging case sold alone; a pair named "... with Wireless Charging Case" is earbuds); Plus; printed rating >= 4.0; price < $50.00.
  6. Traverse every results page by Next, **paced so the store does not answer 429**, stopping when a page adds nothing new.
  7. Dedupe by url, keeping the first occurrence and the results order.
  8. Core judges the dataset; a wrong one is re-authored, persisted and re-run.
- What a wrong answer that looks right would look like here: a tidy four-column table holding sponsored cards, ear tips or a charging case, a 3.8/3.9, the $50.00 pair, a page-boundary repeat, or only page one; or one dropping the under-$25 pairs or the "with Wireless Charging Case" earbuds; or the right rows out of order.

## Stage 2 — exploration

From `provider-failures.local.json` (`payload.diagnostic.evidenceLoop.steps`, 39 decisions, 21 tool calls, 117,896 evidence bytes) joined to `logs/core.log` (call ids, times). Times are UTC, loop start 08:02:24.994.

| # | Time | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- | --- |
| 0 | 08:02:25 | (initial observation) | — | `capture_snapshot` | `not_at_start_location` |
| 1 | 08:02:27 | next step | tool | `nav1`: navigate (url: NO EVIDENCE) | succeeded, 3,514 ms, 5,888 B |
| 2 | 08:02:32 | next step | tool | `nav2`: navigate | succeeded, 2,395 ms; draft 1 step |
| 3 | 08:02:35 | next step | tool | `click-continue`: click (the "Continue shopping" browser check) | succeeded, 1,746 ms |
| 4 | 08:02:38 | next step | tool | `detect1`: `web.detect_repeating_structure` | `web.structure.detected`, 608 ms, 3,776 B |
| 5 | 08:02:41 | next step | tool | `extract1`: extract_list | `web.inspect.succeeded`, 6,942 ms, 8,698 B |
| 6 | 08:02:51 | next step | amend: rerun d6 | `rerun.6` | inspect succeeded, **23,171 ms**, 3,785 B; `inputTooLarge: 1` |
| 7 | 08:03:14 | next step | unusable | — | `llm.provider_malformed_response` |
| 8 | 08:03:19 | next step | amend: rerun d7 | `rerun.7` | succeeded, 11,081 ms |
| 9 | 08:03:32 | next step | amend: rerun d8 | `rerun.8` | succeeded, 11,075 ms |
| 10 | 08:03:46 | next step | tool | `rerun.10` | succeeded, 11,192 ms; **429 page on screen at 08:03:49** |
| 11 | 08:03:58 | next step | amend d10 (not rerun) | — | `draft_amended` |
| 12 | 08:04:02 | next step | amend: rerun d9 | `rerun.9` | succeeded, 11,085 ms |
| 13 | 08:04:16 | next step | amend: rerun d11 | `rerun.11` | succeeded, 11,069 ms |
| 14 | 08:04:30 | next step | amend: rerun d12 | `rerun.12` | succeeded, 11,118 ms |
| 15-16 | 08:04:41-46 | next step | unusable x2 | — | `llm.provider_malformed_response` |
| 17 | 08:04:48 | next step | amend: rerun d13 | `rerun.13` | succeeded, 11,051 ms; **429 on screen at 08:04:49** |
| 18 | 08:05:01 | next step | tool | `nav3`: navigate | succeeded, 2,777 ms, 6,766 B |
| 19 | 08:05:05 | next step | tool | `detect2` | detected, 541 ms |
| 20 | 08:05:08 | next step | tool | `extract2` | succeeded, 6,549 ms, 8,827 B |
| 21 | 08:05:18 | next step | amend: rerun d17 | `rerun.17` | succeeded, **27,454 ms**; **429 at 08:05:29, robot check from 08:05:49** |
| 22 | 08:05:47 | next step | complete | completion check ok; `dryrun.1.reset` | `core.replay.reset_failed` -> `dry_run_refused`; draft 15 steps, `instructionBytes` 1,019 -> 772 |
| 23 | 08:05:50 | next step | unusable | — | malformed |
| 24 | 08:05:52 | next step | complete | `dryrun.2.reset` | `reset_failed` |
| 25 | 08:05:54 | next step | amend d4 | — | `draft_amended` |
| 26 | 08:05:56 | next step | complete | `dryrun.3.reset` | `reset_failed` |
| 27 | 08:05:58 | next step | amend d14, d18 (2 applied) | — | `draft_amended` |
| 28 | 08:06:00 | next step | complete | completion check **refused** `bootstrap.cannot_answer_instruction` (no record producer); `dryrun.4.reset` | `reset_failed` |
| 29 | 08:06:03 | next step | amend: rerun d18 | `rerun.18` | succeeded, 12,124 ms, 4,647 B |
| 30 | 08:06:18 | next step | unusable | — | malformed; `instructionBytes` now 177 |
| 31 | 08:06:21 | next step | amend: rerun d19 | `rerun.19` | succeeded, 11,108 ms |
| 32 | 08:06:33 | next step | complete | `dryrun.5.reset` | `reset_failed` |
| 33 | 08:06:36 | next step | tool | `nav4`: navigate | **`web.action.rejected.needs_person`**, 3,429 ms |
| 34-37 | 08:06:41-49 | next step | complete x4 | `dryrun.6` to `dryrun.9` `.reset` | `reset_failed` each |
| 38 | 08:06:51 | next step | amend d20 | — | refused `20:already_in_flow:web.output.dom-extract_list` |
| 39 | 08:06:53 | next step | complete | `dryrun.10.reset` | `reset_failed`; loop stalls -> `flow_bootstrap.evidence_unusable_decision` (08:06:54.707) |

- The parameters of every call, and what each extract returned (rows, pages, stop), are **NO EVIDENCE**: the step records carry tool id, call id, result code, byte counts and draft counters, not arguments or results.
- **Repeats, and what the loop believed was progress:** eleven extract reruns (d6 to d19) in 3 min 30 s. Each one counted as `draftState: changed` (a new draft revision), so the no-progress guard never fired while they burned the store's load allowance. **The model could not see its own extract argument:** `draft.inputTooLarge` rose from 1 to 13, because `flow-draft/entry.ts:80` (`MAX_STEP_INPUT_BYTES = 512`) hides any step argument over 512 bytes, and an `extract_list` with fields, `where`, `paginate` and `dedupe` is over that. The line tells the model to rerun "with a corrected argument", which is what it kept doing. The guidance also shrank to fit (`instructionBytes` 1,019 -> 772 -> 177).
- **Rejections and refusals received, and whether each said enough to route around:**
  - `dry_run_refused` with `core.replay.reset_failed`, ten times. The reset's text was "the page could not be put back", which does not say that a robot check was the reason. That could not be routed around, and a person had to clear the check. The domain answered without `personNeeded` then; fixed in `0faee6e6` (after this run).
  - `web.action.rejected.needs_person` once (`nav4`). This did say it, and the model still completed four more times.
  - `bootstrap.cannot_answer_instruction` once, after the model withdrew its extract steps (iteration 27).
  - Eight `llm.provider_malformed_response`.
- **Where the context was evicted or truncated:** the step-argument cap above; the draft instruction trimmed to 177 bytes by iteration 30; draft 3,965 of 4,000 bytes at the end.

## Stage 3 — the proposed Flow

- Node list as authored, with each node's real parameters: **none; no Flow was proposed.** The saved Flow source has `"nodes": []`; the kept `project.sqlite` has no `graph_nodes` rows. The loop's `incompleteDraft` is `{revision: 1, steps: 5}`: counts only, **NO EVIDENCE** of those steps' parameters.
- Divergences from the stage 1 chain: not answerable (NO EVIDENCE). From the call ids, the explored chain was navigate, navigate, Continue shopping, detect, extract (paginating). It had no cookie or deal-dialog dismissal and no pacing.
- For each divergence: not answerable.

## Stage 4 — replay

Not reached: no Flow. The only replays were the build's ten dry runs, and each stopped at its reset.

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| dry-run reset (x10) | yes | `core.replay.reset_failed` | 1,026 to 1,320 ms | none | none |

- Any node that reported success while doing nothing: none observed. Eleven reruns reported `web.inspect.succeeded`. Whether they read 429 pages is **NO EVIDENCE**, because the rows, pages and stop of each read are not in the bundle.
- Provider calls during replay: 0 (no replay).

## Stage 5 — the answer

- Records expected vs returned: 13 expected, none returned (`extraction: null`).
- Fields compared, matched, mismatched: none.
- Every mismatch: not applicable.
- Count-only: no comparison happened at all.

## Stage 6 — judgement and repair

- Did the system judge its own result: no; there was no result.
- Repair triggered: no. `harnessRecovery: null`; `decision-trace.json` has no runs and no adaptations.
- Repair context: not applicable.
- Persisted / re-run: not applicable.

## UI review (`run-muntc23v-7fcc4110.ui-review.local/`, 17 moments, 08:02:08 to 08:06:58)

- **01 to 03 (08:02:08 to 08:02:29):** no on-page overlay (`absent`, 0/16) during the first 20 s of the build. Moment 03 is `about:blank`. Panel 01: "What can FluxIQ do for you? Loading the conversation..."; the instruction never appears as a user turn in the chat at any moment.
- **04 to 17:** the overlay is present and visible (16/16) from 08:02:49. Its text is raw tool ids and codes: "Using core.run_node", "Using core.run_node: web.inspect.succeeded", "Using web.detect_repeating_structure". Moments 13 and 16 are `flickering` (3 and 2 text changes in 3 s; 16 has 2 presence toggles).
- **07, 10, 12:** the site shows "Sorry, you're going a little too fast", and the overlay says "Building your Flow / Deciding the next step". **13 to 17:** the site shows the robot check, and the overlay still says "Building your Flow". FluxIQ never tells the person that the site is refusing it or that a check needs them.
- **17 failure:** the overlay reads "Build failed / Build failed" (title repeated as detail). Panel: "Build failed · Worked for 1m 6s · 23 steps · 2 failed", collapsed, with no reason and no next step. **"1m 6s" is wrong:** the build loop ran 4 min 30 s.
- Every panel frame: the "Get set up" card says **"Add an AI model key: To do"** while a keyed build runs (false claim, same as run 4). The chat is a status block and a collapsed step count, not a message stream.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | No per-origin pace on page loads FluxIQ causes. Eleven extract reruns (reset navigation + four `next` loads each, about 11 s apart) put a sixth load into the store's 5-per-8-s window. 429 at 08:03:49, 08:04:49 and 08:05:29; the third refusal flagged the session | extension `content/extraction/pagination.ts` `followNext`/`visitNumberedPage`, `runtime/action-runner.ts:68-94` | **Existing:** worker `background/page-pace/` (`OriginPace`, 2.5 s spacing, 8.5 s after a refusal, cooled to 8 s), `reports/t194-w10-origin-pace.md`; in tree (WIP `518e38fe`), not yet live-validated | t194-w10 |
| 2 | A dry-run reset that landed on the robot check answered `core.replay.reset_failed` "the page could not be put back", with no `personNeeded`. The model kept completing into the same refusal, and the build ended `evidence_unusable_decision` instead of pausing for the person | downstream `domain/src/runtime/llm-evidence/node-run/replay.ts` `resetPage` | **Existing:** `0faee6e6` (2026-09-30 08:54 UTC, after this run): `webActionNeedsPerson(result) ? withPersonNeeded(failed)` (`replay.ts:131-134`) | t194 |
| 3 | The model cannot see its own extract argument: `MAX_STEP_INPUT_BYTES = 512` hides it (`inputTooLarge` 1 -> 13), and the line says to rerun with a corrected argument. That drove eleven reruns, which spent the store's load allowance (cause 1) | Core `runtime/flow-draft/entry.ts:80, :252` | **Proposed:** show an `extract_list` argument in a compact form (fields by name, `where` tests, `paginate`, `dedupe`) instead of hiding it, and stop suggesting a rerun when the step already succeeded | t194 (open) |
| 4 | The Lab stamps a product build failure as a facility failure: `if (flowObservation?.reportedVerdict == null) facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.execute")` also fires for `RunnerFailure("runtime.behavior")`, giving `scenario.execute/unclassified` | downstream `packages/test-runner/src/run-scenario.ts:505-507` | **Proposed:** skip the projection when the error is a `RunnerFailure` of a product category (`runtime.behavior`, `recording.contract`), with a test | t194 (open) |
| 5 | The overlay and panel show raw tool ids and result codes, repeat "Build failed", misreport the build time, never say the site needs a person, and the setup card claims no AI key | extension overlay and side-panel status | Sent to the UI lane (t191) as in run 4; the needs-person state follows from cause 2 | t191 |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | The arguments of every decision and what each extract returned (rows, pages, stop, refused pages) | Core closed step record `flow-bootstrap/evidence-loop-steps.ts`; Lab `flowLaneSnapshot` |
| 2 | Dry-run reset calls are absent from the step list; only the build trace in `core.log` shows them | Core `llm/node-tools/replay-draft.ts` (reset result not appended to the trace) |
| 2 | The store's 429s and the flag are not recorded anywhere except screenshots (`scenario-lab.log` has 2 lines) | Scenario Lab everything-store `route.ts` / throttle: no refusal event to the bundle |
| 3 | The incomplete draft is counts only (`{revision 1, steps 5}`) | Core `flow-bootstrap/incomplete-draft/keeper.ts` |
| header | `perCallRecords: "not recorded"`, 5 unrecorded calls | Lab live-LLM accounting |
| header | Facility failure mislabel (cause 4) | `packages/test-runner/src/run-scenario.ts:505` |
