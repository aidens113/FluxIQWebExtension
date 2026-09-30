# Run debug — `run-munymcpf-93148576` (t193 run 11)

Brief debug, written after the fact from the run's artifacts by the t193 lead (2026-09-30). The run was launched by the lane's unattended relaunch loop (killed 2026-09-30); nobody debugged it at the time. Per-run analysis across runs 8-32: `reports/t193-wJ-armed-target-resolution.md` (target resolution) and `reports/t193-wK-repair-ladder.md` (the repair ladder).

## Header

- Run id: `run-munymcpf-93148576`
- Scenario / variant / task: bigbox-retail / `redesigned-buy-box` (armed after the build) / `bigbox-retail-pickup-cart-redesigned-after-creation`
- Command: the lane's old launcher (`live-run-b.sh`, now disabled) with `--llm-max-calls 64 --llm-max-cost-usd 0.25 --evidence events --replays 2`, instance t193-slot-2, headed
- Date, provider, model: 2026-09-30T10:25:52.094Z to 2026-09-30T10:30:31.079Z, deepseek, deepseek-flash
- Provider calls, tokens, cost: 33 calls (build loop 32), build 533124 in / 3392 out, **$0.0638**
- Verdict as reported: `failed` (runtime.behavior), "The Flow reported an unexpected target_ambiguous failure"; flowCreated true, reported failed, oracle failed
- **Stage reached: 6**

## Stage 1 — the instruction and the expected chain

As in the lane report's Stage 1 section for this task (`reports/t193-live-self-repair.md`): switch the pickup store to Millbrook Crossing Supercenter first; add 2 x Select-A-Size Paper Towels 12 Double Rolls and 1 x Everyday Dinner Napkins 250 Count, both for pickup; keep the cart; no checkout. After the variant, Add to cart has lost its test id and moved into the buy box; Buy now stands in the sticky bar.

## Stage 2 — exploration

- 32 decisions, 29 tool calls, 186960 evidence bytes. Tools: core.run_node, web.detect_repeating_structure.
- Result codes over the loop (count): `web.action.succeeded` 16, `web.inspect.succeeded` 5, `web.action.rejected.action_failed` 4, `llm_evidence_loop.draft_rerun` 2, `web.action.rejected.not_at_start_location` 1, `web.action.rejected.target_unobserved` 1, `web.structure.detected` 1, `web.action.rejected.blocked_by_dialog` 1, `llm_evidence_loop.draft_unchanged` 1, `llm_evidence_loop.dry_run_refused` 1, `llm_evidence_loop.draft_amended` 1, `(decision)` 1.
- Completion checks (2): true; true.
- Draft amendments (4): 11:rerun; 23:rerun; 27:keep; 3:optional,21:optional.
- Dry-run replays during the build: `core.replay.replayed` 28, `core.replay.unreproducible` 2, `core.replay.failed` 2. Each dry run starts from a reset and replays the draft from its first step.
- Per-turn rows: grouped here; the full per-decision trace is in `logs/core.log` (build trace) and `snapshots/flow-lane.json` `build.evidenceLoop.steps`.

## Stage 3 — the proposed Flow

- 15 nodes as authored (selectors and addresses withheld by the bundle):
  - s1 `web.browser.navigate` (address withheld)
  - s2 `web.dom.click` button "Accept all"
  - s4 `web.dom.click` button "Pickup or delivery?Carden Falls Supercenter" (in a shadow root)
  - s5 `web.dom.click` button "Pickup or delivery?Millbrook Crossing Supercenter" (in a shadow root)
  - s6 `web.dom.type` input "Search"
  - s7 `web.dom.type` input "Search"
  - s8 `web.browser.navigate` (address withheld)
  - s9 `web.dom.click` div "250 Count$6.48"
  - s10 `web.dom.click` div "×" (in a shadow root)
  - s12 `web.dom.click` button "Add to cart"
  - s13 `web.dom.type` input "Search"
  - s14 `web.browser.navigate` (address withheld)
  - s15 `web.browser.navigate` (address withheld)
  - s16 `web.dom.click` div "12 Double Rolls$16.47"
  - s17 `web.dom.click` button "Add to cart"
- Divergences from Stage 1: s5 presses the chip under its post-switch name; the "Set as my store" press is missing.

## Stage 4 — replay

| Node | Attempt | Status | ms | Resolution |
| --- | --- | --- | --- | --- |
| s1 `web.browser.navigate` | 0 | succeeded | 2318 | - |
| s2 `web.dom.click` | 1 | succeeded | 914 | selector n=1 best=0.643 |
| s3 `builtin.control.merge` | 2 | succeeded | 0 | - |
| s4 `web.dom.click` | 3 | succeeded | 1225 | selector n=4 best=0.643 |
| s5 `web.dom.click` | 4 | failed | 395 | selector n=4 best=undefined |
- Page packets marked truncated during playback: 8.
- First failure: `target_ambiguous` `web.target.ambiguous`: one element matching selector button in the shadow root of body > div > header > div > vr-fulfillment-picker / 4 elements matched: button "Pickup or delivery?Carden Falls Supercen" (0.36), button "Set as my store" (-0.12), button "Set as my store" (-0.12), button "Set as my store" (-0.12).
- Provider calls during the Lab's `--replays`: none were run (the run failed before its repair was applied and replayed).

## Stage 5 — the answer

- Oracle: `failed` ({"records":"not_declared","finalState":"failed"}). The task is judged on the playback goal (store, towels 12 Double Rolls x2, napkins 250 Count x1, soap kept); the bundle states the goal's pass or fail, not the cart line by line, so the field comparison is not reached: the Flow failed before its last step.

## Stage 6 — judgement and repair

- Ladder: interventions ["diagnosis:false:recovery.ladder_diagnosis_unanswered","diagnosis:true","runtime_patch:true"]; runtime patches 1; adaptations []; ended `-` at rung -.
- Context given: failure, expected_transition, actual_transition, flow_graph, step_parameters; dropped for the 8,000-byte budget: state_diff, failed_target, recovery_candidates, subflow, route_context, recent_nodes.
- Result check: null.
- Why the repair did not produce a working Flow: diagnosis yes/yes/F/T (0.72), then a target override the domain refused `target_unanchored`; nothing executed; no re-author.
- Persisted: nothing (no adaptation id, no change proposal).

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The store switch is not in the Flow: the "Set as my store" click answered `web.action.rejected.action_failed` while it switched the store and reloaded the page, and a refused step carries `replay: undefined`, so it was dropped (wJ cause 1) | domain `runtime/llm-evidence/node-run/run.ts:357-375, 541-551` | keep a navigating press whose own answer was lost to the reload (wJ P1) | recorded by t174 (run 6), no live owner |
| 2 | The header chip was recorded in its post-switch state ("Pickup or delivery?Millbrook Crossing Supercenter"); playback starts at the reset store, Carden Falls, so the recorded name contradicts the page (wJ cause 1, chip form) | build (recording); follows from row 1 | row 1's fix | recorded by t174, no live owner |
| 3 | One uncorroborated leader (the chip at 0.36 against three "Set as my store" at -0.12) is thrown as `TARGET_AMBIGUOUS`, not as not found | extension `content/action-runtime/resolve-target.ts:347` | wJ P2 (label only), after t174's N1 | t193, not fixed |
| 4 | The only patch proposed, a target override, was refused at preflight `target_unanchored`: the recorded target was the post-switch chip or span, which no control on the page is equivalent to | domain `runtime/llm-evidence/target/equivalence.ts:80,89,148-157` | correct by design; C2 re-authors instead | t193 |
| 5 | A failed step the patch ladder could not fix was never re-authored: the re-author route takes only a completed run refuted `does_not_answer_request` (wK C2) | Core `recovery/refuted-result/reauthor.ts:79-90`, `service/runtime-adaptation/refuted-result-port.ts:113-117`, `result-verification/run-outcome.ts` | C2, a failed step is re-authored, applied and re-run (wL) | t193: validated locally, not live |
| 6 | The recovery context dropped `failed_target` and `recovery_candidates` for its 8,000-byte budget, and playback page packets were `truncated: true` at 6,000 bytes: the model was not shown the whole page or the failed target | Core `recovery/context.ts:261`; extension capture / domain packet budget | remove the caps | owned by t200 |
| 7 | Every completion's dry run reset the page and replayed the draft from its first step, from the build's own state (store already switched, cart already changed), mid-build | Core `flow-draft/dry-run.ts`, `llm/node-tools/dry-run-gate.ts` | - | owned by t196 |
| 8 | Every ladder that selected its model rung records a `diagnosis` intervention with `validation.ok: false` (`recovery.ladder_diagnosis_unanswered`), which reads as a failed call (wK K7) | Core `service/summaries/conversions.ts:293,311` | K7, recorded as informational `recovery.ladder_model_rung_selected` (wM) | t193: validated locally |

## UI review

Screenshots opened by the lead for this series: run 27 `run-muo1la5v-d4eeb7e1/screenshots/00030` (during the re-author: the panel and overlay say "Running your Flow · Step 10 of 10 · Deciding the next step" while the repair is building; the store chooser is open; the chip reads Millbrook) and run 31 `run-muo2b224-aa7f6336/screenshots/00019` (end: "Run failed"; an unanswered "The instruction asks for create_new, and none of this run's 90 actions said it would cause that; 69 of them said they would cause nothing lasting. Apply it as it stands? Yes / No"; chip Carden Falls). Opened by worker wJ: run 11 `munymcpf/00004`, run 17 `munzutb0/00003`, run 21 `muo0ks69/00019`, run 24 `muo12lnk/00016`, run 32 `muo2gyob/00016`. This run's own screenshots were not all opened; runs 10-32 ran the same extension build (the UI before t191 round 2), and the defects seen are the same in every opened capture: the Simple/Advanced toggle; a split panel with a "Get set up" card above the chat; "To do: Add an AI model key" while a keyed build runs; raw internal wording ("Using core.run_node", `create_new`); a repair shown as "Running your Flow" with a step count past the Flow's length; a Yes/No question nobody answers left on screen at the end. The on-page overlay is visible at bottom left while working.
