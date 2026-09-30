# Run debug — `run-muo1ni63-3e0aa746` (lane D, bigbox pickup-order)

Worker t195-w17c, 2026-09-30, after the fact (unattended relaunch loop; never debugged). Read from
`test-runs/instances/t195-slot-4/run-muo1ni63-3e0aa746/` (summary, run, evaluation, events, `snapshots/flow-lane.json`,
`live-llm.json`, `decision-trace.json`, `person-hand-offs.json`, `logs/core.log` build-trace, screenshots 00001,
00007, 00015). Nothing re-run.

## Header

- Run id: `run-muo1ni63-3e0aa746`. Facility `46076bba` (dirty), Core `f4feb028` (dirty), extension `340ef24d`,
  `t195-slot-4`, seed 239.
- Scenario / variant / task: `bigbox-retail` / none / `bigbox-retail-pickup-order` (sha256 `231af963…`).
- Command: NO EVIDENCE (relaunch loop). `permittedConsequences: []`; hand-offs: none.
- Date, provider, model: 2026-09-30; Lab 11:50:44–11:53:43Z; loop 11:51:01.9–11:53:37Z (155,983 ms); DeepSeek
  `deepseek-flash`, `production`.
- Provider calls, tokens, cost: **41** of 64; 689,903 in / 4,603 out; **$0.0702** (`observed.totalEstimatedCostUsd`
  0.070170).
- Verdict as reported: Lab `failed`, `runtime.behavior`: "FluxIQ did not build a Flow from the task's instruction
  (`flow_bootstrap.evidence_repeat_without_progress`)", stage `provider_output_validation`, HTTP 400.
  `permissionRequest: null`.
- **Honest verdict: `failed`.** No ask was ever raised; Place order never pressed. `flowCreated: false`.
- **Stage reached: 2.**

## Stage 1 — the instruction and the expected chain

As `run-munovwp3-d898de74.md` Stage 1 (same sha256); right ending the ask at Place order.

## Stage 2 — exploration

41 decisions, 34 tool calls; call ids `-`.

| Iterations | What happened |
| --- | --- |
| 0–14 | navigate, consent, search; clicks 4, 6, 11, 12, 14 `action_failed`, 13 `handle_not_in_packet`; clicks 7–9 succeed (cart); navigate 10 |
| 15 | drop of the four failed clicks, all refused `did_not_work` |
| 16 | complete `->d10,->d12,->d14,->d14,->d14` refused `cannot_answer_instruction`, `a2:step_changed_nothing`; dry run 1 (reset + 8, 23.9 s: #3, #7, #8 `unreproducible`, #6 `failed`) |
| 17–25 | snapshot; clicks 18, 19, 21 `action_failed`, 22 `handle_not_in_packet`; click 20 succeeds; checkout reached (00007, 11:52:26: every contact field empty, card payment selected); type 25 `target_not_a_handle` |
| 26 | complete `a1>d9,a2>d10` refused `cannot_answer_instruction`; dry run 2 (reset + 9, 25.1 s, same failures) |
| **27–29** | `19:keep` refused `already_in_flow`; then **drop of d3, d4, d6, d8, d9, d10, d11, d19 — eight applied, one step kept** (the navigate); `2:keep` refused |
| 30–34 | structure detected; structure refused `page_moved_since_packet`; completion `->d19,->d19,->d24,->d19` refused (`a1:step_not_kept`); dry run 3 (reset + 1, 2.3 s); snapshot; completion `a1>d2,a2>d2` refused `step_only_arrives` ×2 |
| 35–41 | `dom-type` 35 `target_not_a_handle`, then **the same type five times, refused `answered_the_same_again`** (36–40); `dom-extract_list` 41 `list_never_appeared` (11.3 s). The loop stopped: `evidence_repeat_without_progress` |

- Repeats: the identical type sent six times; the loop believed each re-send was a new attempt.
- Rejections: `target_not_a_handle` and `answered_the_same_again` did not say which handle to use; the model never
  took a snapshot between them.
- Truncation: instruction 1,051 → 177 B from 15; up to 19 inputs withheld. **Owned by t200.**

## Stage 3 — the proposed Flow

- None. After iteration 28 the draft kept only `d2` (the navigate): the model threw away the search, the add to cart
  and the cart steps it had proved, then tried to continue from a checkout page the draft could no longer reach.
- Divergence from the stage 1 chain: everything after the navigate. Classification: misread the grammar (a `drop` of
  proved steps to "start clean" loses them; nothing warned it that the Flow would then only arrive).

## Stage 4 — replay

No Flow. Three dry runs from a reset (23.9, 25.1, 2.3 s); the last replayed the reset and the one kept step (00015
shows the home page at the end). Provider calls during replay: 0.

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| (none) | no | no Flow | – | – | – |

## Stage 5 — the answer

None (`extraction: null`). Nothing compared.

## Stage 6 — judgement and repair

- The build judged nothing; the repeat guard ended it with 23 calls, $0.18 and ~380 s of the 540 s bound left. No
  repair path exists from `evidence_repeat_without_progress`.
- Lifecycle: (a) **violated** — dry runs from a reset (t196); the build also returned to the start mid-build (00015).
  (b) not reached. (c) **violated**: the build gave up while ways remained (snapshot, then type into a named handle;
  restore the dropped steps).

## UI review

| Screenshot | Finding |
| --- | --- |
| `screenshots/00001-4afaa8f80062.jpg` (first) | Consent wall; "Loading the conversation…"; Simple/Advanced; setup card; no user turn |
| `00007-b6f6cedaf75b.jpg` (middle) | Checkout with empty fields; chat "Building your Flow / Deciding the next step / 24 steps so far · 1 failed"; overlay visible "Building your Flow / Deciding the next step" |
| `00015-641e852defb1.jpg` (last) | Home page; header and overlay "Build failed / Build failed"; chat only "Worked for 1m 1s · 24 steps · 3 failed" — **no sentence saying why it failed or what to do**; 1 m 1 s against a 2 m 36 s build |

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | At 28 the model dropped eight proved steps (d3–d19), leaving only the navigate; the draft could no longer reach the checkout it was on | model; Core `R/flow-draft/amendment.ts` (drop applies without a warning) | refuse, or warn on, a drop that leaves the kept draft unable to reach the current page | open (new here) |
| 2 | The same `dom-type` re-sent five times after `target_not_a_handle`; no snapshot between | model; domain refusal text | the refusal names the handle rule and suggests a fresh look; the loop forces a snapshot after a handle refusal | open |
| 3 | Build ended by the repeat guard with budget left and no correction path | Core evidence loop no-progress | as `run-muog33va-96469cb2` cause 8 (a stalled build has no path to correction) | t195 |
| 4 | Dry runs from a reset | Core `dry-run-gate.ts` | owned by t196 | t196 |
| 5 | Draft cap (instruction 177 B, 19 withheld) | Core `loop-configuration.ts:355` | owned by t200 | t200 |
| 6 | UI: failure without a reason or next step; undercount | extension | as `run-muog33va-96469cb2` cause 10 | t191 |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | Which field the six types targeted, and the handle they named | Core build-trace (content-free) |
| 3 | The draft before and after the drop at 28 | `flow-lane.json` counts only |
