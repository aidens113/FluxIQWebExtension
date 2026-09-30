# Run debug — `run-muo2b224-aa7f6336` (t193 run 31)

Brief debug, written after the fact from the run's artifacts by the t193 lead (2026-09-30). The run was launched by the lane's unattended relaunch loop (killed 2026-09-30); nobody debugged it at the time. Per-run analysis across runs 8-32: `reports/t193-wJ-armed-target-resolution.md` (target resolution) and `reports/t193-wK-repair-ladder.md` (the repair ladder).

## Header

- Run id: `run-muo2b224-aa7f6336`
- Scenario / variant / task: bigbox-retail / `redesigned-buy-box` (armed after the build) / `bigbox-retail-pickup-cart-redesigned-after-creation`
- Command: the lane's old launcher (`live-run-b.sh`, now disabled) with `--llm-max-calls 64 --llm-max-cost-usd 0.25 --evidence events --replays 2`, instance t193-slot-2, headed
- Date, provider, model: 2026-09-30T12:09:03.536Z to 2026-09-30T12:13:24.093Z, deepseek, deepseek-flash
- Provider calls, tokens, cost: 42 calls (build loop 41), build 698371 in / 4652 out, **$0.0825**
- Verdict as reported: `failed` (runtime.behavior), "The created Flow ran, but the scenario's playback goal did not hold afterwards"; flowCreated true, reported failed, oracle failed
- **Stage reached: 5 (all 16 actions ran; the goal did not hold; no judgement)**

## Stage 1 — the instruction and the expected chain

As in the lane report's Stage 1 section for this task (`reports/t193-live-self-repair.md`): switch the pickup store to Millbrook Crossing Supercenter first; add 2 x Select-A-Size Paper Towels 12 Double Rolls and 1 x Everyday Dinner Napkins 250 Count, both for pickup; keep the cart; no checkout. After the variant, Add to cart has lost its test id and moved into the buy box; Buy now stands in the sticky bar.

## Stage 2 — exploration

- 41 decisions, 35 tool calls, 183458 evidence bytes. Tools: core.run_node, web.detect_repeating_structure.
- Result codes over the loop (count): `web.action.succeeded` 24, `llm_evidence_loop.draft_rerun` 5, `llm_evidence_loop.draft_amended` 4, `web.inspect.succeeded` 2, `web.action.rejected.action_failed` 2, `web.structure.detected` 2, `web.action.rejected.target_not_found` 2, `web.action.rejected.not_at_start_location` 1, `web.action.rejected.target_unobserved` 1, `web.action.rejected.blocked_by_dialog` 1, `bootstrap.instructed_act_missing` 1, `llm_evidence_loop.draft_unchanged` 1, `(decision)` 1.
- Completion checks (2): false (bootstrap.instructed_act_missing missing=a3:step_only_arrives); true.
- Draft amendments (10): 10:rerun; 11:rerun; 21:rerun; 25:drop,24:drop,23:drop; 26:rerun; 29:rerun; 3:optional,19:optional,27:keep,30:keep; 30:drop,29:drop,27:keep; ....
- Dry-run replays during the build: `core.replay.replayed` 27, `core.replay.unreproducible` 2, `core.replay.failed` 2. Each dry run starts from a reset and replays the draft from its first step.
- Per-turn rows: grouped here; the full per-decision trace is in `logs/core.log` (build trace) and `snapshots/flow-lane.json` `build.evidenceLoop.steps`.

## Stage 3 — the proposed Flow

- 14 nodes as authored (selectors and addresses withheld by the bundle):
  - s1 `web.browser.navigate` (address withheld)
  - s2 `web.dom.click` button "Accept all"
  - s4 `web.dom.wait_for_text` text "null"
  - s5 `web.dom.click` button "Pickup or delivery?Carden Falls Supercenter" (in a shadow root)
  - s6 `web.dom.type` input "Search"
  - s7 `web.dom.type` input "Search"
  - s8 `web.browser.navigate` (address withheld)
  - s9 `web.browser.navigate` (address withheld)
  - s10 `web.browser.navigate` (address withheld)
  - s11 `web.dom.click` div "×" (in a shadow root)
  - s13 `web.dom.click` button "Pickup or delivery?Millbrook Crossing Supercenter" (in a shadow root)
  - s14 `web.dom.click` button "Add to cart"
  - s15 `web.browser.navigate` (address withheld)
  - s16 `web.dom.click` button "+ Add"
- Divergences from Stage 1: No store step (the chip reads Carden Falls at the end, screenshot 00019).

## Stage 4 — replay

| Node | Attempt | Status | ms | Resolution |
| --- | --- | --- | --- | --- |
| s1 `web.browser.navigate` | 0 | succeeded | 2206 | - |
| s2 `web.dom.click` | 1 | succeeded | 695 | selector n=1 best=0.643 |
| s3 `builtin.control.merge` | 2 | succeeded | 0 | - |
| s4 `web.dom.wait_for_text` | 3 | succeeded | 211 | - |
| s5 `web.dom.click` | 4 | succeeded | 1254 | selector n=4 best=0.643 |
| s6 `web.dom.type` | 5 | succeeded | 227 | selector n=1 best=1 |
| s7 `web.dom.type` | 6 | succeeded | 261 | selector n=1 best=1 |
| s8 `web.browser.navigate` | 7 | succeeded | 1367 | - |
| s9 `web.browser.navigate` | 8 | succeeded | 1122 | - |
| s10 `web.browser.navigate` | 9 | succeeded | 1371 | - |
| s11 `web.dom.click` | 10 | succeeded | 1685 | selector n=1 best=0.643 |
| s12 `builtin.control.merge` | 11 | succeeded | 0 | - |
| s13 `web.dom.click` | 12 | succeeded | 953 | selector n=4 best=0.643 |
| s14 `web.dom.click` | 13 | succeeded | 978 | scored-candidate n=7 best=0.643 |
| s15 `web.browser.navigate` | 14 | succeeded | 1335 | - |
| s16 `web.dom.click` | 15 | succeeded | 968 | selector n=1 best=0.643 |
- Page packets marked truncated during playback: 28.
- First failure: none recorded.
- Provider calls during the Lab's `--replays`: none were run (the run failed before its repair was applied and replayed).

## Stage 5 — the answer

- Oracle: `failed` ({"records":"not_declared","finalState":"failed"}). The task is judged on the playback goal (store, towels 12 Double Rolls x2, napkins 250 Count x1, soap kept); the bundle states the goal's pass or fail, not the cart line by line, so the field comparison is the playback goal failed (`finalState: failed`); the result check never gave a verdict (below).

## Stage 6 — judgement and repair

- Ladder: interventions ["diagnosis:false:llm.provider_result_summary_invalid"]; runtime patches 0; adaptations []; ended `-` at rung -.
- Context given: ; dropped for the 8,000-byte budget: none.
- Result check: "refuted".
- Why the repair did not produce a working Flow: no repair was entered: the result check's request was refused before sending (`llm.provider_result_summary_invalid`, `llm/harness/request-evidence-check.ts:43,115-122`), the verdict was `core.result.verdict_unavailable`, and only a refutation enters the repair (wK C8).
- Persisted: nothing (no adaptation id, no change proposal).

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The store switch is not in the Flow: the "Set as my store" click answered `web.action.rejected.action_failed` while it switched the store and reloaded the page, and a refused step carries `replay: undefined`, so it was dropped (wJ cause 1) | domain `runtime/llm-evidence/node-run/run.ts:357-375, 541-551` | keep a navigating press whose own answer was lost to the reload (wJ P1) | recorded by t174 (run 6), no live owner |
| 2 | The result check refused its own summary before sending, so the run was never judged and no repair was entered (which of credential-shaped content, a denied key or the byte limit tripped is not recorded) | Core `llm/harness/request-evidence-check.ts:43,115-122` | - | t194 (the judge) |
| 3 | The recovery context dropped `failed_target` and `recovery_candidates` for its 8,000-byte budget, and playback page packets were `truncated: true` at 6,000 bytes: the model was not shown the whole page or the failed target | Core `recovery/context.ts:261`; extension capture / domain packet budget | remove the caps | owned by t200 |
| 4 | Every completion's dry run reset the page and replayed the draft from its first step, from the build's own state (store already switched, cart already changed), mid-build | Core `flow-draft/dry-run.ts`, `llm/node-tools/dry-run-gate.ts` | - | owned by t196 |
| 5 | The draft is a transcript of the steps taken: failed attempts amended to `optional` and kept, repeated presses kept, rather than an authored Flow | Core draft authoring (`flow-draft/**`, evidence loop) | - | owned by t196 |

## UI review

Screenshots opened by the lead for this series: run 27 `run-muo1la5v-d4eeb7e1/screenshots/00030` (during the re-author: the panel and overlay say "Running your Flow · Step 10 of 10 · Deciding the next step" while the repair is building; the store chooser is open; the chip reads Millbrook) and run 31 `run-muo2b224-aa7f6336/screenshots/00019` (end: "Run failed"; an unanswered "The instruction asks for create_new, and none of this run's 90 actions said it would cause that; 69 of them said they would cause nothing lasting. Apply it as it stands? Yes / No"; chip Carden Falls). Opened by worker wJ: run 11 `munymcpf/00004`, run 17 `munzutb0/00003`, run 21 `muo0ks69/00019`, run 24 `muo12lnk/00016`, run 32 `muo2gyob/00016`. This run's own screenshots were not all opened; runs 10-32 ran the same extension build (the UI before t191 round 2), and the defects seen are the same in every opened capture: the Simple/Advanced toggle; a split panel with a "Get set up" card above the chat; "To do: Add an AI model key" while a keyed build runs; raw internal wording ("Using core.run_node", `create_new`); a repair shown as "Running your Flow" with a step count past the Flow's length; a Yes/No question nobody answers left on screen at the end. The on-page overlay is visible at bottom left while working.
