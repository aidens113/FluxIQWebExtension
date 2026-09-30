# Run debug — `run-muoga8at-123533a4` (lane A run 34)

Written by the t174 lead from the bundle `test-runs/instances/t174-slot-1/run-muoga8at-123533a4`, its
`logs/core.log` build trace, `snapshots/{flow-lane,live-llm}.json` and the 17 UI-review moments beside it. The Core
workspace (`.work/<runId>`) was deleted by the Lab at run end, which is gap G1 below.

## Header

- Run id: `run-muoga8at-123533a4`
- Scenario / variant / task: bigbox-retail / none / bigbox-retail-pickup-cart
- Command: `scratchpad/t174-live-run-a.sh bigbox-retail bigbox-retail-pickup-cart` (the command in the lane report, Session 3), instance t174-slot-1, headed
- Date, provider, model: 2026-09-30 18:35-18:50 UTC, deepseek, deepseek-flash, production profile
- Provider calls, tokens, cost: 64 calls (all build), 1,055,489 in / 7,360 out, $0.1173
- Verdict as reported: `failed`, `runtime.behavior`: "FluxIQ did not build a Flow from the task's instruction (flow_bootstrap.evidence_unusable_decision)"; `flowCreated: false`
- **Stage reached:** 2, exploration. No Flow was proposed.
- Code under test: P1 A (unshown addresses refused) and P1 B (quantity and size as their own requirements), the first live run of both.

## Stage 1 — the instruction and the expected chain

Written by the lane lead before reading anything the run produced.

- The instruction, verbatim: "Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out."
- The node chain a correct Flow must have:
  1. Navigate to the start location (ValueRidge home). A cookie wall, if shown, is declined (by the interference defence, or an optional decline step).
  2. Open the store chooser (press the store chip or "change store").
  3. Press "Set as my store" in the Millbrook Crossing Supercenter card (not the current store's).
  4. Reach the Select-A-Size Paper Towels item: type the product name in search and submit, then press the result (or press a shown link). No invented item address.
  5. Choose the "12 Double Rolls" size (the option control), not the first size shown.
  6. Set the quantity to 2 (quantity control), or press add a second time if the site has no quantity control.
  7. Choose pickup fulfilment if the item page offers a choice.
  8. Press "Add to cart".
  9. Reach the Everyday Dinner Napkins item the same way (search and press).
  10. Choose "250 Count"; quantity stays 1; choose pickup.
  11. Press "Add to cart".
  12. No checkout step, and no step that touches the lines already in the cart.
- What a wrong answer that looks right would look like: both items in the cart but in the first (default) size and quantity 1 (run 28's shape); the store switched to the current store or not at all, with act 1 claimed by a navigation or a chooser-open; items added for delivery; existing cart lines moved to "Saved for later" by dry runs or by the Flow; a permission stop counted as a pass.

## Stage 2 — exploration

Loop 18:44:22 to about 18:49:25: 64 decisions, 39 tool calls. From the `flow-lane.json` steps and the build trace.
Parameters and page packets are screened in the bundle and the Core workspace is gone, so what each decision was
asked and each call's parameters are NO EVIDENCE for every row (gap G1). Node, result and reason are recorded.

| # | Decided | Node | Result | Reason / note |
| --- | --- | --- | --- | --- |
| 0 | (Core's free look) | capture | `not_at_start_location` | expected |
| 1 | tool | navigate | succeeded | start location |
| 2 | tool | click | succeeded | page changed (the consent wall is on screen at moment 3, 18:44:29) |
| 3 | tool | click | `target_unobserved` | `handle_not_in_packet` |
| 4 | tool | capture | inspect succeeded | |
| 5 | tool | click | succeeded | changed |
| 6 | tool | click | `action_failed` | changed |
| 7 | tool | click | succeeded | changed (the store chip reads Millbrook Crossing Supercenter by moment 4, 18:44:49) |
| 8 | tool | type | succeeded | |
| 9 | tool | click | `action_failed` | changed |
| 10 | amend `10:rerun` | click (rerun) | `action_failed` | `answered_the_same_again` |
| 11 | amend `10:drop,11:drop` | - | `draft_unchanged` | |
| 12 | tool | type | succeeded | |
| 13 | tool | click | `action_failed` after 10.5 s | moment 5 (18:45:09, `/search`) is a self-clearing robot check |
| 14, 15 | tool | type, type | succeeded | unchanged |
| 16 | tool | click | succeeded | changed |
| 17 | tool | type | succeeded | |
| 18 | amend `17:rerun` | click | `action_failed` | the draft's guidance was cut from 1,051 to 177 bytes here |
| 19 | tool | navigate | succeeded | |
| 20 | tool | type | succeeded | |
| 21 | tool | click | `action_failed` | 2 steps now shown without input |
| 22 | amend: drop 21, 20, 19, 18, 17, 15, 14, 12, 9 | - | amended | |
| 23 | amend `21:rerun` | click | `action_failed` | `answered_the_same_again` |
| 24 | complete, claims `->d6, ->d16` | - | refused | a2, a2.quantity, a2.size, a3.size `no_step_named` |
| 25 | amend `3:optional, 16:optional` | - | amended | |
| 26, 27 | tool | navigate x2 | succeeded | |
| 28 | tool | click | succeeded | |
| 29 | tool | navigate | succeeded | moment 8 (18:46:09): the napkins item page `/ip/valueridge-everyday-dinner-napkins/418831402` |
| 30 | tool | navigate | **`address_not_shown`** | P1 A refused it |
| 31 | tool | type | `target_unobserved` | `target_not_a_handle` |
| 32 | tool | navigate | succeeded | |
| 33 | tool | type | succeeded | |
| 34 | complete `a1>d25, a3.size>d25, a3>d16` | - | refused | the a2 group `no_step_named`; a3 `step_is_optional` |
| 35 | complete `a1>d25, a3>d16` | - | refused | the same, plus a3.size |
| 36 | amend `3:keep,16:keep` | - | amended | |
| 37 | tool | navigate | **`address_not_shown`** | |
| 38-40 | amend `16:keep` x3 | - | `draft_unchanged` x3 | |
| 41 | tool | navigate | succeeded | |
| 42 | tool | navigate | **`address_not_shown`** | |
| 43 | amend `16:keep` | - | `draft_unchanged` | |
| 44 | tool | navigate | **`address_not_shown`** | |
| 45-47 | amend `16:keep` x3 | - | `draft_unchanged` x3 | |
| 48 | complete `a1>d3, a2>d32, a3>d32` | - | refused | a2, a3 `step_only_arrives`; the choices `no_step_named` |
| 49 | amend `3:optional,16:optional,32:drop` | - | amended | |
| 50 | complete `a1>d25, a2>d30, a3>d30` | - | refused | the choices `no_step_named`; a3 `step_claimed_twice` |
| 51 | amend: keep 32, 30, 29, 26, 25, 24, 23, 16, 8, 6, 3, 2 | - | `draft_amendment_undone` | |
| 52 | tool | navigate | **`address_not_shown`** | |
| 53 | tool | click | succeeded | changed |
| 54 | tool | click | **`blocked_by_dialog`** | the page's "Val" assistant card over the item page's right column (moment 13, 18:47:49) |
| 55 | tool | click | succeeded | changed (250 Count shown selected at moment 13) |
| 56 | tool | click | `target_unobserved` | `handle_not_in_packet`; "Add to cart" (sticky bar) was never pressed |
| 57 | complete `a1>d2, a2>d30, a2.quantity>d30, a2.size>d30, a3>d30, a3.size>d30` | - | refused | a1 `step_only_arrives`; the choices `choice_is_the_act_step` / `step_claimed_twice` |
| 58 | complete `a1>d2, a2.quantity>d30, a2.size>d30, a3>d30, a3.size>d30` | - | refused | similar |
| 59-64 | complete x6 on a byte-identical draft (3,925 B, 36 steps without input) | - | refused x6 | the build ends `evidence_unusable_decision` |

- Repeats, and what the loop believed was progress: 13 amendments changed nothing (`16:keep` was sent 7 times and
  answered `draft_unchanged` each time), and the last 8 decisions were refused completions, 6 of them identical. 21 of
  64 decisions changed nothing. The loop's words said so each time (`draft_unchanged`, the completion's `sentAgain`),
  and no guard ended the build before its 64th decision.
- Rejections and refusals, and whether each said enough: `address_not_shown` x5 held, so no invented address was
  reached, which is the purpose of P1 A. The model answered each one with another address rather than pressing the
  link the refusal pointed at. The instructed-acts refusals named every missing requirement with a reason. The model
  could not act on them, because (a) it never reached the towels item, and (b) it could not see which step did what
  (below).
- Where the context was truncated: the draft entry holds 4,000 bytes. The steps shown without input rose from 2
  (iteration 21) to 36 of 37 (iteration 58). The draft's guidance was cut from 1,051 to 177 bytes at iteration 18.
  From 57 on, the model named one step, d30, for five requirements and the arrival d2 for the store switch.

## Stage 3 — the proposed Flow

- Node list as authored, with real parameters: none. No completion was accepted. The last draft held 37 steps.
- Divergences from the stage 1 chain: chain steps 4-8 (the towels item, its size, quantity, pickup and add) are
  absent, because the build never stood on the towels item page. Chain steps 9-11: the napkins item was reached by
  navigation and 250 Count was pressed, but "Add to cart" was not.
- Misread the page / the grammar / could not express it: NO EVIDENCE for the towels branch (G1). For the napkins add,
  the last press named a handle that was not in its packet (`handle_not_in_packet`, iteration 56). Whether "Add to
  cart" was in any packet is NO EVIDENCE (G1).

## Stage 4 — replay

Not reached. Dry runs ran on every completion attempt, by design (`llm/evidence-loop/completion-attempt.ts`): 7 of
them, about 25-30 s each. The 2 `core.replay.failed` steps are not identified (G1).

## Stage 5 — the answer

Not reached. The header cart read 1 item, $3.97 (the seeded line), at every moment from start to failure: nothing was
added during the build, and the seeded line was not moved.

## Stage 6 — judgement and repair

- Did the system judge its own result: there was no result. The build ended at its 64th decision with
  `flow_bootstrap.evidence_unusable_decision`.
- Did a repair trigger: no. Core's repair paths (runtime recovery, and the refuted-result re-author) start from a
  created Flow's run. A build that proposes nothing leaves nothing to repair, so none can trigger. This may be the run
  the supervisor's item 3 describes: the panel said "Worked for 48s · 28 steps · 8 failed" and then "Build failed",
  and no repair followed. The "48s" is false: the loop ran about 303 s (18:44:22 to 18:49:25). The missing repair
  follows from the failed build; the causes below are why the build failed.
- Repair context: not applicable.

## UI review (17 moments, `run-muoga8at-123533a4.ui-review.local/`)

- Page overlay: visible bottom-left from moment 3 on (16 of 16 samples), and never over the consent or chat controls
  this run. Its text is raw: "Using core.run_node", and at moment 13 "Using core.run_node: web.action.rejected.bloc…"
  (U1 raw ids, U13 cut off). It was "flickering" at moments 4, 8, 10, 12 and 13 (2-3 text changes per 3 s, and 2
  presence toggles at moment 8, across a navigation). At failure it read "Build failed / Build failed" (U2, the
  headline repeated).
- Side panel (the old UI; t191 round 2 is not merged into this tree yet): the Simple/Advanced toggle (t191 defect 1),
  status cards above the chat (defect 2), "Add an AI model key: To do" during a live build (defect 9, U5), the
  unlabelled "Page | Full | Small | Off" control (defect 6), "Using core.run_node" (defect 5), and "Worked for 48s"
  for a ~303 s build (U12). None of this is ChatGPT-quality. All of it is t191's, and its round 2 is being merged to
  dev now.
- The page's own "Val" assistant card covered the item page's size, pickup and quantity column (moment 13). The
  build's press there was `blocked_by_dialog`.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The draft entry is capped at 4,000 bytes. 36 of 37 steps were shown without their input and the draft's guidance was cut to 177 bytes, so the model could not tell which step set a size or pressed add. It claimed d30 for five requirements and the arrival d2 for the store switch (57, 58). | Core `flow-draft/entry.ts` (the draft entry budget), `llm/evidence-loop/draft-shown.ts` | Remove the cap and show every step with its input | **t200** (the user's no-caps order) |
| 2 | The build never reached the Select-A-Size Paper Towels item page. 7 presses ended `action_failed` (6, 9, 10, 13, 18, 21, 23), one after a self-clearing robot check on `/search`. Which controls, and what the search results' packets held, is NO EVIDENCE. Candidate: the result card sits past the packet's element cap (t200). | extension / domain, not established | Re-run with the run state kept (G1) | t174 (evidence); t200 if caps |
| 3 | The model answered `address_not_shown` with another unshown address 5 times instead of pressing a shown link. The addresses are NO EVIDENCE (screened). | domain `node-run/shown-addresses.ts` (the refusal's `instead`) | Read the kept run state next run; if the refusal lacks the link, name it | t174 |
| 4 | The napkins add was never pressed. The "Val" card covered the column (54, `blocked_by_dialog`), then the press at 56 named a handle that was not in its packet. The interference probes do not reach the card's corner. | extension `content/action-runtime/interference/overlays.ts` | t195's R1+R2 (validated on its branch, not on dev) | **t195** |
| 5 | 21 of 64 decisions changed nothing (13 no-op amendments and 8 refused completions, 6 of them identical), and nothing ended the build early. | Core `llm/evidence-loop` no-progress guard, answered-request | Recorded; t193's cause C covers repeats | t193 C / t189's area |
| 6 | Stage 6: no repair can follow a build that creates no Flow (see Stage 6). | - | Fixing causes 1-4 | - |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2, 3 (G1) | The model's parameters, the packets it was shown, and the draft's real inputs. The bundle screens them, and the Lab deleted `.work/<runId>` because the launcher did not set `FLUXIQ_LAB_KEEP_RUN_STATE=1` | the lane launcher (`scratchpad/t174-live-run-a.sh`); fixed for the next run |
| 2 | Why the loop ended is not in the build trace (there is no `loop end` line) | Core `llm/evidence-loop/progress-trace.ts` |
| 5 | The site's request log is empty (`scenario-lab.log` holds only its ready line), so cart changes are read from screenshots only | `apps/scenario-lab` server logging |
