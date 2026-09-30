# Run debug — `run-munyt4jo-dc4e704a` (t193 run 12)

Brief debug, written after the fact from the run's artifacts by the t193 lead (2026-09-30). The run was launched by the lane's unattended relaunch loop (killed 2026-09-30); nobody debugged it at the time. Per-run analysis across runs 8-32: `reports/t193-wJ-armed-target-resolution.md` (target resolution) and `reports/t193-wK-repair-ladder.md` (the repair ladder).

## Header

- Run id: `run-munyt4jo-dc4e704a`
- Scenario / variant / task: bigbox-retail / `redesigned-buy-box` (armed after the build) / `bigbox-retail-pickup-cart-redesigned-after-creation`
- Command: the lane's old launcher (`live-run-b.sh`, now disabled) with `--llm-max-calls 64 --llm-max-cost-usd 0.25 --evidence events --replays 2`, instance t193-slot-2, headed
- Date, provider, model: 2026-09-30T10:31:08.108Z to 2026-09-30T10:35:52.888Z, deepseek, deepseek-flash
- Provider calls, tokens, cost: 50 calls (build loop 49), build 797395 in / 4773 out, **$0.0825**
- Verdict as reported: `failed` (runtime.behavior), "The Flow reported an unexpected output_not_observed failure"; flowCreated true, reported failed, oracle failed
- **Stage reached: 6 (ran to the end, refuted, repair attempted)**

## Stage 1 — the instruction and the expected chain

As in the lane report's Stage 1 section for this task (`reports/t193-live-self-repair.md`): switch the pickup store to Millbrook Crossing Supercenter first; add 2 x Select-A-Size Paper Towels 12 Double Rolls and 1 x Everyday Dinner Napkins 250 Count, both for pickup; keep the cart; no checkout. After the variant, Add to cart has lost its test id and moved into the buy box; Buy now stands in the sticky bar.

## Stage 2 — exploration

- 49 decisions, 33 tool calls, 175256 evidence bytes. Tools: core.run_node.
- Result codes over the loop (count): `web.action.succeeded` 15, `web.inspect.succeeded` 6, `llm_evidence_loop.draft_amended` 6, `llm_evidence_loop.draft_unchanged` 6, `llm_evidence_loop.already_answered` 5, `web.action.rejected.target_unobserved` 3, `web.action.rejected.action_failed` 3, `llm_evidence_loop.draft_rerun` 3, `bootstrap.instructed_act_missing` 2, `web.action.rejected.not_at_start_location` 1, `llm_output.invalid_evidence_decision` 1, `llm_evidence_loop.draft_amendment_undone` 1, `(decision)` 1.
- Completion checks (3): false (bootstrap.instructed_act_missing missing=a2:step_claimed_twice,a3:step_claimed_twice); false (bootstrap.instructed_act_missing missing=a2:no_such_step,a3:no_such_step); true.
- Draft amendments (29): 3:optional,11:optional; 11:drop,3:drop,19:rerun; 22:drop; 21:repeat(over=21,through=21); 21:repeat(over=19); 21:rerun,22:keep; 9:keep,22:keep,26:keep; 26:rerun; ....
- Dry-run replays during the build: `core.replay.replayed` 12, `core.replay.unreproducible` 1, `core.replay.failed` 1. Each dry run starts from a reset and replays the draft from its first step.
- Per-turn rows: grouped here; the full per-decision trace is in `logs/core.log` (build trace) and `snapshots/flow-lane.json` `build.evidenceLoop.steps`.

## Stage 3 — the proposed Flow

- 5 nodes as authored (selectors and addresses withheld by the bundle):
  - s1 `web.browser.navigate` (address withheld)
  - s2 `web.dom.click` button "Pickup or delivery?Carden Falls Supercenter" (in a shadow root)
  - s3 `web.dom.click` button "+ Add" (list 1/8)
  - s4 `web.dom.click` button "+ Add" (list 4/4)
  - s5 `web.dom.click` button "+ Add" (list 1/8)
- Divergences from Stage 1: No store step; the "+ Add" presses are chosen by list position, not by the named products.

## Stage 4 — replay

| Node | Attempt | Status | ms | Resolution |
| --- | --- | --- | --- | --- |
| s1 `web.browser.navigate` | 0 | succeeded | 2154 | - |
| s2 `web.dom.click` | 1 | succeeded | 1402 | selector n=4 best=0.643 |
| s3 `web.dom.click` | 2 | succeeded | 1356 | selector n=1 best=0.643 |
| s4 `web.dom.click` | 3 | succeeded | 1112 | selector n=1 best=0.611 |
| s5 `web.dom.click` | 4 | succeeded | 1061 | selector n=1 best=0.611 |
| s5 `web.dom.click` | 5 | failed | 1128 | - |
- Page packets marked truncated during playback: 10.
- First failure: `output_not_observed` `core.result.does_not_answer_request`: A result that answers the request: Switch pickup store to Millbrook Crossing Supercenter, then add 2 packs ValueRidge Essentials Select-A-Size Paper Towels (12 Double Rolls) and 1 pack ValueRidge Everyday Dinner Napkins  / 0 records stored, across 0 record sets; the Flow's steps were web.output.browser-navigate, web.output.dom-click, web.output.dom-click, web.output.dom-click, web.output.dom-click. The check observed: s.
- Provider calls during the Lab's `--replays`: none were run (the run failed before its repair was applied and replayed).

## Stage 5 — the answer

- Oracle: `failed` ({"records":"not_declared","finalState":"failed"}). The task is judged on the playback goal (store, towels 12 Double Rolls x2, napkins 250 Count x1, soap kept); the bundle states the goal's pass or fail, not the cart line by line, so the field comparison is the result check refuted it `core.result.does_not_answer_request` (store not switched, wrong adds); the Lab bundle carries no line-by-line cart.

## Stage 6 — judgement and repair

- Ladder: interventions ["diagnosis:true","diagnosis:true","diagnosis:true","runtime_patch:false:llm_output.unexpected_field+llm_output.unsupported_runtime_patch"]; runtime patches 0; adaptations []; ended `-` at rung -.
- Context given: failure, flow_graph, step_parameters; dropped for the 8,000-byte budget: subflow, route_context, recent_nodes.
- Result check: "refuted".
- Why the repair did not produce a working Flow: the refuted route re-authored first (about 14 decisions, no adaptation), then the ladder: diagnosis, explore 6, a patch of an invented kind (`llm_output.unexpected_field`, `unsupported_runtime_patch`), `patch_failed`.
- Persisted: nothing (no adaptation id, no change proposal).

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The store switch is not in the Flow: the "Set as my store" click answered `web.action.rejected.action_failed` while it switched the store and reloaded the page, and a refused step carries `replay: undefined`, so it was dropped (wJ cause 1) | domain `runtime/llm-evidence/node-run/run.ts:357-375, 541-551` | keep a navigating press whose own answer was lost to the reload (wJ P1) | recorded by t174 (run 6), no live owner |
| 2 | The build added products by list position ("+ Add" item N of the rail) instead of the named towels and napkins | build loop | - | t174 (build) |
| 3 | The re-author built nothing: its completions were refused and it ended with no adaptation | Core re-author (`recovery/refuted-result/**`) | - | t194 (re-author) |
| 4 | The patch call was offered all five patch kinds and wrote one the plan refused (wK C3) | Core `recovery/annotation/annotate.ts:534-566`, `llm/harness/runtime-patch-schema.ts`, `llm/deepseek/output-schema.ts` | C3, the request and the schema carry only the plan's allowed kinds (wM) | t193: validated locally, not live |
| 5 | The recovery context dropped `failed_target` and `recovery_candidates` for its 8,000-byte budget, and playback page packets were `truncated: true` at 6,000 bytes: the model was not shown the whole page or the failed target | Core `recovery/context.ts:261`; extension capture / domain packet budget | remove the caps | owned by t200 |
| 6 | Every completion's dry run reset the page and replayed the draft from its first step, from the build's own state (store already switched, cart already changed), mid-build | Core `flow-draft/dry-run.ts`, `llm/node-tools/dry-run-gate.ts` | - | owned by t196 |
| 7 | The draft is a transcript of the steps taken: failed attempts amended to `optional` and kept, repeated presses kept, rather than an authored Flow | Core draft authoring (`flow-draft/**`, evidence loop) | - | owned by t196 |

## UI review

Screenshots opened by the lead for this series: run 27 `run-muo1la5v-d4eeb7e1/screenshots/00030` (during the re-author: the panel and overlay say "Running your Flow · Step 10 of 10 · Deciding the next step" while the repair is building; the store chooser is open; the chip reads Millbrook) and run 31 `run-muo2b224-aa7f6336/screenshots/00019` (end: "Run failed"; an unanswered "The instruction asks for create_new, and none of this run's 90 actions said it would cause that; 69 of them said they would cause nothing lasting. Apply it as it stands? Yes / No"; chip Carden Falls). Opened by worker wJ: run 11 `munymcpf/00004`, run 17 `munzutb0/00003`, run 21 `muo0ks69/00019`, run 24 `muo12lnk/00016`, run 32 `muo2gyob/00016`. This run's own screenshots were not all opened; runs 10-32 ran the same extension build (the UI before t191 round 2), and the defects seen are the same in every opened capture: the Simple/Advanced toggle; a split panel with a "Get set up" card above the chat; "To do: Add an AI model key" while a keyed build runs; raw internal wording ("Using core.run_node", `create_new`); a repair shown as "Running your Flow" with a step count past the Flow's length; a Yes/No question nobody answers left on screen at the end. The on-page overlay is visible at bottom left while working.
