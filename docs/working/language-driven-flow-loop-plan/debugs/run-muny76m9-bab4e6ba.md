# Run debug — `run-muny76m9-bab4e6ba` (t193 run 10)

Brief debug, written after the fact from the run's artifacts by the t193 lead (2026-09-30). The run was launched by the lane's unattended relaunch loop (killed 2026-09-30); nobody debugged it at the time. Per-run analysis across runs 8-32: `reports/t193-wJ-armed-target-resolution.md` (target resolution) and `reports/t193-wK-repair-ladder.md` (the repair ladder).

## Header

- Run id: `run-muny76m9-bab4e6ba`
- Scenario / variant / task: bigbox-retail / `redesigned-buy-box` (armed after the build) / `bigbox-retail-pickup-cart-redesigned-after-creation`
- Command: the lane's old launcher (`live-run-b.sh`, now disabled) with `--llm-max-calls 64 --llm-max-cost-usd 0.25 --evidence events --replays 2`, instance t193-slot-2, headed
- Date, provider, model: 2026-09-30T10:14:04.362Z to 2026-09-30T10:25:07.878Z, deepseek, deepseek-flash
- Provider calls, tokens, cost: 49 calls (build loop 48), build 818018 in / 4855 out, **$0.0862**
- Verdict as reported: `failed` (runtime.behavior), "The Flow reported an unexpected target_not_found failure"; flowCreated true, reported failed, oracle failed
- **Stage reached: 6 (the Flow ran on the variant, failed, the ladder ran and gave up)**

## Stage 1 — the instruction and the expected chain

As in the lane report's Stage 1 section for this task (`reports/t193-live-self-repair.md`): switch the pickup store to Millbrook Crossing Supercenter first; add 2 x Select-A-Size Paper Towels 12 Double Rolls and 1 x Everyday Dinner Napkins 250 Count, both for pickup; keep the cart; no checkout. After the variant, Add to cart has lost its test id and moved into the buy box; Buy now stands in the sticky bar.

## Stage 2 — exploration

- 48 decisions, 34 tool calls, 182058 evidence bytes. Tools: core.run_node, web.detect_repeating_structure.
- Result codes over the loop (count): `web.action.succeeded` 15, `web.inspect.succeeded` 6, `llm_evidence_loop.draft_amended` 6, `llm_evidence_loop.draft_unchanged` 5, `web.action.rejected.target_unobserved` 4, `llm_evidence_loop.draft_rerun` 4, `llm_evidence_loop.already_answered` 3, `web.action.rejected.action_failed` 3, `web.action.rejected.not_at_start_location` 1, `web.structure.detected` 1, `bootstrap.instructed_act_missing` 1, `llm_evidence_loop.draft_amendment_undone` 1, `web.action.rejected.blocked_by_dialog` 1, `llm_evidence_loop.dry_run_refused` 1, `(decision)` 1.
- Completion checks (3): false (bootstrap.instructed_act_missing missing=a2:step_claimed_twice,a3:step_claimed_twice); true; true.
- Draft amendments (16): 4:drop,5:drop,10:drop,12:drop,13:drop,16:drop; 3:optional,11:optional; 3:keep,11:keep; 3:optional,11:drop,22:rerun; 22:repeat(over=22,through=22); 22:repeat(over=21); 22:rerun,24:keep; 25:repeat(over=24,through=25); ....
- Dry-run replays during the build: `core.replay.replayed` 11, `core.replay.unreproducible` 5, `core.replay.failed` 1. Each dry run starts from a reset and replays the draft from its first step.
- Per-turn rows: grouped here; the full per-decision trace is in `logs/core.log` (build trace) and `snapshots/flow-lane.json` `build.evidenceLoop.steps`.

## Stage 3 — the proposed Flow

- 5 nodes as authored (selectors and addresses withheld by the bundle):
  - s1 `web.browser.navigate` (address withheld)
  - s2 `web.dom.click` button "Accept all"
  - s3 `web.dom.click` button "Pickup or delivery?Carden Falls Supercenter" (in a shadow root)
  - s4 `web.dom.click` button "Added" (list 1/?)
  - s5 `web.dom.click` a "Options" (list 3/?)
- Divergences from Stage 1: s4 targets the home rail's button under its post-press label "Added" (list 1 of 8); nothing before it presses it, so at playback it reads "+ Add". No store switch (row 3).

## Stage 4 — replay

| Node | Attempt | Status | ms | Resolution |
| --- | --- | --- | --- | --- |
| s1 `web.browser.navigate` | 0 | succeeded | 2295 | - |
| s2 `web.dom.click` | 1 | succeeded | 822 | selector n=1 best=0.643 |
| s3 `web.dom.click` | 2 | succeeded | 1160 | selector n=4 best=0.643 |
| s4 `web.dom.click` | 3 | failed | 4675 | fingerprint n=13 best=undefined |
| s4 `web.dom.click` | 4 | failed | 4638 | fingerprint n=13 best=undefined |
| s4 `web.dom.click` | 5 | failed | 4580 | fingerprint n=13 best=undefined |
- Page packets marked truncated during playback: 12.
- First failure: `target_not_found` `web.target.not_found`: an element matching selector main > section:nth-of-type(2) > ul > li:nth-of-type(1) > button (refused button "+ Add" scoring -0.22), element fingerprint (refused button "+ Add" scoring -0.22), selector main > section:nth / nothing matched; 13 control(s) of the same family are on the page; best scored -0.12; the execution did not recover within its 5 attempts after absorbing target_absent, target_absent, target_absent, t.
- Provider calls during the Lab's `--replays`: none were run (the run failed before its repair was applied and replayed).

## Stage 5 — the answer

- Oracle: `failed` ({"records":"not_declared","finalState":"failed"}). The task is judged on the playback goal (store, towels 12 Double Rolls x2, napkins 250 Count x1, soap kept); the bundle states the goal's pass or fail, not the cart line by line, so the field comparison is not reached: the Flow failed before its last step.

## Stage 6 — judgement and repair

- Ladder: interventions ["diagnosis:false:recovery.ladder_diagnosis_unanswered","diagnosis:true"]; runtime patches 0; adaptations []; ended `llm.runtime_patch_goal_unachievable` at rung exploration.
- Context given: failure, expected_transition, actual_transition, flow_graph, step_parameters; dropped for the 8,000-byte budget: state_diff, failed_target, recovery_candidates, recovered_failures, subflow, route_context, recent_nodes.
- Result check: null.
- Why the repair did not produce a working Flow: the ladder diagnosed no/no/T/F (0.72), explored 5 calls, re-planned unchanged, and ended `goal_unachievable`; no re-author existed for a failed step.
- Persisted: nothing (no adaptation id, no change proposal).

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | A control whose label is its state was recorded after its state changed: the rail button reads "Added" only after a press (`client/shell-script.ts:160`); "+ Add" is vetoed at -0.22 (wJ cause 3) | build recording; extension `content/identity/stable-name.ts:92` | - | t174 (build) |
| 2 | The diagnosis answered stillAchievable no (the recorded target is gone), exploration found no way, and the re-plan kept its decision: `llm.runtime_patch_goal_unachievable` at rung exploration; only a re-author could add the missing step (wK C4) | Core `recovery/plan.ts:195-197`, `recovery/annotation/replan.ts` | C2 | t193 |
| 3 | The store switch is not in the Flow: the "Set as my store" click answered `web.action.rejected.action_failed` while it switched the store and reloaded the page, and a refused step carries `replay: undefined`, so it was dropped (wJ cause 1) | domain `runtime/llm-evidence/node-run/run.ts:357-375, 541-551` | keep a navigating press whose own answer was lost to the reload (wJ P1) | recorded by t174 (run 6), no live owner |
| 4 | A failed step the patch ladder could not fix was never re-authored: the re-author route takes only a completed run refuted `does_not_answer_request` (wK C2) | Core `recovery/refuted-result/reauthor.ts:79-90`, `service/runtime-adaptation/refuted-result-port.ts:113-117`, `result-verification/run-outcome.ts` | C2, a failed step is re-authored, applied and re-run (wL) | t193: validated locally, not live |
| 5 | The recovery context dropped `failed_target` and `recovery_candidates` for its 8,000-byte budget, and playback page packets were `truncated: true` at 6,000 bytes: the model was not shown the whole page or the failed target | Core `recovery/context.ts:261`; extension capture / domain packet budget | remove the caps | owned by t200 |
| 6 | Every completion's dry run reset the page and replayed the draft from its first step, from the build's own state (store already switched, cart already changed), mid-build | Core `flow-draft/dry-run.ts`, `llm/node-tools/dry-run-gate.ts` | - | owned by t196 |
| 7 | Every ladder that selected its model rung records a `diagnosis` intervention with `validation.ok: false` (`recovery.ladder_diagnosis_unanswered`), which reads as a failed call (wK K7) | Core `service/summaries/conversions.ts:293,311` | K7, recorded as informational `recovery.ladder_model_rung_selected` (wM) | t193: validated locally |

## UI review

Screenshots opened by the lead for this series: run 27 `run-muo1la5v-d4eeb7e1/screenshots/00030` (during the re-author: the panel and overlay say "Running your Flow · Step 10 of 10 · Deciding the next step" while the repair is building; the store chooser is open; the chip reads Millbrook) and run 31 `run-muo2b224-aa7f6336/screenshots/00019` (end: "Run failed"; an unanswered "The instruction asks for create_new, and none of this run's 90 actions said it would cause that; 69 of them said they would cause nothing lasting. Apply it as it stands? Yes / No"; chip Carden Falls). Opened by worker wJ: run 11 `munymcpf/00004`, run 17 `munzutb0/00003`, run 21 `muo0ks69/00019`, run 24 `muo12lnk/00016`, run 32 `muo2gyob/00016`. This run's own screenshots were not all opened; runs 10-32 ran the same extension build (the UI before t191 round 2), and the defects seen are the same in every opened capture: the Simple/Advanced toggle; a split panel with a "Get set up" card above the chat; "To do: Add an AI model key" while a keyed build runs; raw internal wording ("Using core.run_node", `create_new`); a repair shown as "Running your Flow" with a step count past the Flow's length; a Yes/No question nobody answers left on screen at the end. The on-page overlay is visible at bottom left while working.
