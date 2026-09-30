# Run debug — `run-munq51ik-a7ebd077` (lane D run 6)

Lane t195, slot-4. Read by the lead from the bundle
`test-runs/instances/t195-slot-4/run-munq51ik-a7ebd077` (flow-lane.json, extraction-mismatches.json,
logs/core.log build trace), the launcher's full log (scratchpad `t195-lab-social-network-feed-confirm-requests-*.log`)
and 12 screenshots (`t195-shots/*-r6-*.png`). Privacy: codes, counts, node ids, control names; the only page values
are the ones `extraction-mismatches.json` already publishes (fixture names and mutual-friend lines).

## Header

- Run id: `run-munq51ik-a7ebd077`
- Scenario / variant / task: `social-network-feed` / none / `social-network-feed-confirm-requests`
- Command: `live-run-d.sh social-network-feed social-network-feed-confirm-requests` (headed, deepseek-flash, production,
  `--llm-max-calls 64`, $0.25 per call)
- Trees: t195 working trees with F0-F9 applied (F7 partly: w8 in progress); Core rebuilt before the run
- Date, provider, model: 2026-09-30 06:32:46Z build start, playback 06:38:10Z; DeepSeek `deepseek-flash`
- Provider calls: 64 build calls (the Lab's bound), 321 s build; repair: 2 diagnoses
- Verdict as reported: failed, `runtime.behavior`; the Flow reported `action_failed` / `web.action.rate_limited`
- **Stage reached: 6.** A 11-node Flow with a For Each was built, ran four passes, was judged, and repair was refused
  (`llm.runtime_patch_diagnosis_asked_for_none`).

## Stage 1 — the instruction and the expected chain

Copied from scratchpad `t195-stage1-confirm-requests.md` (written 05:12Z, before run 1):
1. Navigate to `friends/requests/` (all 8 cards), not the 4-card Friends home.
2. A loop over request cards: route on mutual friends >= 5 ("Aisha Khan and 4 other" counts as 5), Confirm only
   those; no Delete.
3. The 4th Confirm meets the rate limit (3 per 15 s): wait out the countdown, then confirm it -- a mid-loop retry.
4. Extract the accepted cards: Amara Osei, Jonas Weber, Lin Zhao, Freya Holm, with mutualFriends verbatim.
Wrong answers that look right: 3 rows; Priya Nair (4) confirmed; only the 4 home cards considered.

## Stage 2 — exploration

- 63 decisions: 37 `tool_call`, 16 `amend_draft`, 10 `complete` (build trace `kind=` counts). Tool results: 12
  `web.structure.detected`, 7 `web.inspect.succeeded` (extraction reruns), 7 `web.action.succeeded`, 3
  `web.action.rejected.target_unobserved`, 1 `not_at_start_location` (Core's initial look).
- Iterations 6-19 were 14 `amend_draft` decisions around the extraction, each followed by a rerun (the same churn as
  run 2's iterations 12-26; reruns count as progress, `decision-handlers/amendment.ts:86,95`).
- Every one of the 10 completions passed `completion check ok=true`; 9 were then refused by the dry run: 46 steps
  `core.replay.replayed`, 17 `core.replay.unreproducible`, 11 `core.replay.failed` across the 10 dry runs. The 10th
  was accepted at the 64-call bound.
- The model **did say `repeat`** this time (F2's guidance): For Each `s5` over extraction `s3`, body `s6` (Confirm).
- `build.instructedConsequences`: `modify_existing` ("confirm everyone I have at least five mutual friends with");
  cross-check `agreed`; no permission request (none is due: confirming is not money, delete or send).

## Stage 3 — the proposed Flow

11 nodes: `s1`, `s2` navigate; `s3` extract_list (fields name, mutualFriends; **no `where`**); `s4` Merge;
`s5` For Each over `s3.records`; `s6` click Confirm (`listPosition 1 of 4`) as the loop body; after the loop `s8`
click "Close chat", `s9` click Confirm (`2 of 4`), `s10` extract_list, `s11` click Confirm (`3 of 4`).
Divergences from Stage 1:
- `s2` lands on the Friends home (`/friends/`, screenshot `063828-r6-t12-0.png`), which lists 4 of 8 requests
  behind "See all": the loop walks Tom Becker, Amara Osei, Priya Nair, Jonas Weber. Misread the page.
- `s3` has no `where`, so non-qualifying rows are confirmed. Could have expressed it (`where` with `atLeast: 5`; F8
  makes "Aisha Khan and 4 other" count 5) -- did not.
- `s9` and `s11` are leftover single Confirms pinned to list positions after the loop; `s8` closes a chat widget.
  Misread the grammar: steps it ran while exploring were kept instead of withdrawn once the loop covered them.
- `s10`, the read of the accepted cards, comes after those leftovers, so it never ran.

## Stage 4 — replay

| Node | Executed | Produced | Duration | Notes |
| --- | --- | --- | --- | --- |
| s1, s2 | yes | navigated | 2285, 1392 ms | |
| s3 | yes | 4 records, 1 page, list appeared after 947 ms | 1116 ms | Friends home |
| s5/s6 pass 1 | yes | Confirm, row 1 = Tom Becker (1 mutual): **a wrong consequential act** (his card reads "Re..." in screenshot t12) | 797 ms | host resolution `selector`, score 0.703 |
| s5/s6 pass 2 | yes | Confirm; the row is NO EVIDENCE (row 2 is Amara Osei) | 542 ms | |
| s5/s6 pass 3 | yes | Confirm; the row is NO EVIDENCE (row 3 is Priya Nair, 4 mutual: wrong if pressed) | 722 ms | |
| s5/s6 pass 4 | failed | `web.action.rate_limited`, `effect: unacted` | 140 ms | "answered the press 7 ms after it with a notice ... it named no wait"; Core retried twice (759, 331 ms), both refused |

- Four passes each succeeded or were refused by the site's rate limit, which only counts presses that confirmed something, so passes 1-3 each confirmed a request: the body did not press the same row twice (row 1's Confirm is gone after pass 1). That is F4/F5 working live. Which row each pass pressed is not in the bundle (gap below).
- The rate-limit detector (w8) fired correctly, but read no wait from "You can try again in 6 seconds."
  (visible in screenshot t12), so Core retried at its own short backoff inside the 15 s window. Provider calls
  during replay: 0.

## Stage 5 — the answer

The Flow's dataset is `s3`'s pre-loop listing: 4 records against the 4 expected; 2 matched in any order (Amara Osei,
Jonas Weber), 2 differ: position 2 expected Lin Zhao / "11 mutual friends", observed Priya Nair / "4 mutual friends";
position 3 expected Freya Holm / "5 mutual friends", observed Jonas Weber / "Aisha Khan and 4 other mutual friends".
Field-by-field comparison ran (not count-only).

## Stage 6 — judgement and repair

The run failed on the rate-limited node, so no answer judgement of the final read happened. Repair: diagnosis 1
`recovery.ladder_diagnosis_unanswered`, diagnosis 2 valid, then refused `llm.runtime_patch_diagnosis_asked_for_none`
at rung `plan`; `step_parameters`, `subflow`, `route_context`, `recent_nodes` omitted for `byte_budget` (same gap as
run 2, `recovery/context.ts:243`).

## UI review

- Page: correct site; at t12 the rate-limit dialog stands over the Friends home.
- Side panel: "RIGHT NOW: FluxIQ is working / Looking at the page" during playback (it was clicking, not looking);
  "Add an AI model key: To do" throughout a live build; not a chat stream. No on-page FluxIQ status overlay in any of
  the 12 screenshots. Owner: t191.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The rate-limit detector read no wait from "You can try again in <span>N</span> seconds.", so `retryAfterMs` was absent and Core's retries fell inside the 15 s window. | downstream `apps/extension/src/content/action-runtime/rate-limit-notice.ts` (w8, new) | read N from the dialog's whole text / its span; w8 told | t195 (F7, in progress) |
| 2 | The listing step is the Friends home (4 of 8), not the requests page: the model never pressed "See all"; nothing tells it a list shows only part of its items. | model decision; no Core guard | next run's evidence; candidate: the extraction reports `itemsSeen` vs a "See all"/count on the page | t195, open |
| 3 | No `where` on the listing, so the loop confirms every row, including two that do not qualify (wrong consequential acts). | model decision; extract_list catalog text `domain/src/output-nodes/extract-list/catalog-text.ts` | open: tell the model in the per-item repeat sentence that the listing must keep only the items to act on (F2 says it; not followed) | t195, open |
| 4 | Exploration steps covered by the loop (`s9`, `s11` single Confirms) and a chat close (`s8`) stay in the Flow after the loop, and the final read `s10` sits behind them. | Core `runtime/flow-draft/amendment.ts` / draft routing: nothing withdraws steps a `repeat` makes redundant | open | t195, open |
| 5 | 9 of 10 completions refused by the dry run (17 unreproducible, 11 failed replays), spending the build to its 64-call bound. | Core `runtime/flow-draft/dry-run.ts` | open (w1 cause 4 context) | t195, open |
| 6 | 14 extraction amendments + reruns counted as progress. | Core `decision-handlers/amendment.ts:86,95`, `evidence-loop.ts:559` | open | t174 (decision efficiency, its cause C) |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | What each of the 16 amendments changed (only kinds are traced) | Core `llm/evidence-loop/progress-trace.ts` |
| 4 | Which row each pass's Confirm resolved to by record (the trace carries host strategy and score only) | extension resolution result / flow-lane `actions[].hostTargetResolution` |
