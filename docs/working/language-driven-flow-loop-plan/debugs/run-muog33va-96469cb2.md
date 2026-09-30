# Run debug — `run-muog33va-96469cb2`

Worker t195-w15 (lane D, lead t195), 2026-09-30. Read from the bundle
`test-runs/instances/t195-slot-4/run-muog33va-96469cb2/` (summary, run, evaluation, events, `snapshots/flow-lane.json`,
`snapshots/live-llm.json`, `snapshots/decision-trace.json`, `provider-failures.local.json`, `logs/core.log` with the
`[FluxIQ build-trace]` lines, the 13 screenshots), the UI review beside it
(`run-muog33va-96469cb2.ui-review.local.json` and its PNG folder), and the Lab log
`scratchpad/t195-lab-social-network-feed-confirm-requests-183044.log`. Core references are to the t195 Core tree
`fxwork/t195/!FluxIQ` (commit `b6bf5eb0`, dirty), paths under `packages/fluxiq/src/programs/automation-studio/runtime/`
written `R/`. Nothing was re-run.

---

## Header

- Run id: `run-muog33va-96469cb2`
- Scenario / variant / task: `social-network-feed` / baseline (no variant) / `social-network-feed-confirm-requests`
  (workflow `confirm-requests`, `judgeBy: expected-dataset`, dataset `extract-confirmed`)
- Command: a live Lab run on instance `t195-slot-4` (lab slot 4), admitted by the live guard at 18:30:44Z (fingerprint
  `sha256:6e3502c7…`). NO EVIDENCE: the exact launcher command line is not in the bundle or the Lab log.
- Date, provider, model: 2026-09-30, 18:34:47Z to 18:38:05Z (build dispatched 18:35:15.857Z, loop 18:35:35.234Z to
  18:37:50.161Z); DeepSeek `deepseek-flash`, profile `production`.
- Provider calls, tokens, cost: 39 of 64 calls; 561,560 input + 5,121 output = 566,681 tokens; $0.061491408 of the
  $0.25 ceiling. Loop 141.7 s of the 540 s bound. Prelude builds 233 s (four rebuilt), not part of the run.
- Verdict as reported: `failed`, `runtime.behavior`: "FluxIQ did not build a Flow from the task's instruction
  (`flow_bootstrap.evidence_unusable_decision`)", stage `provider_output_validation`, HTTP 400, issue codes
  `[flow_draft.repeat_span_unknown]`, `retryable: false`, `flowCreated: false`. The incomplete draft was kept by Core
  (`incompleteDraft: {revision 1, steps 5}`).
- **Stage reached: 2 (exploration).** Nine completion attempts were made; every one was refused at plan assembly, so no
  proposal (stage 3) was ever accepted and nothing was replayed as a Flow.

## Stage 1 — the instruction and the expected chain

Written from `apps/scenario-lab/src/scenarios/social-network-feed/live-tasks.ts:5` alone, before reading the run.

- The instruction, verbatim: "Go through my friend requests and confirm everyone I have at least five mutual friends
  with, and leave every other request as it is. Then give me a table of every request the list now shows as accepted,
  in the order the list shows them, with columns name and mutualFriends, where mutualFriends is written exactly as
  their request shows it."
- The node chain a correct Flow must have:
  1. `browser-navigate` to the start location (the Circleway home), because the Flow must reach its page itself.
  2. Reach the friend requests list: a click on Friends then Friend requests, or a navigate to the requests page.
     Dismiss anything covering it (a consent or notifications prompt) with the declining control, as an optional step.
  3. `dom-extract_list` of the pending request cards with the name and the mutual-friends line, `where` the mutual
     count is at least 5. The count has to be read from every form the line takes ("N mutual friends", "1 mutual
     friend", "Name and N other mutual friends" = N + 1, no line = 0).
  4. `dom-click` Confirm **in the row** being walked, `repeat` over step 3 (For Each), each pass on its own row; a
     rate-limit notice waited out and the press retried.
  5. `dom-extract_list` of the cards that now show the request as accepted, in list order, fields `name` and
     `mutualFriends` copied verbatim.
- What a wrong answer that looks right would look like here: a table of the accepted requests that includes someone
  under five (the first card, or a "4 mutual friends" card) because an exploration press confirmed them; a
  `mutualFriends` normalised to a number ("5") instead of the card's words; a missing person whose count is written
  as "Name and 4 other mutual friends"; or the right four names in the wrong order.

## Stage 2 — exploration

Step ids: a draft step's id is `d` + (iteration + 1). The steps that matter: `d2` navigate (nav1), `d3` click (nav2),
`d4` navigate (nav3), `d6` extract_list (ext1), reruns of it `d7`→`d8`→`d9`→`d10`→`d12`→`d13`→`d15`→`d17`, `d14` the
first Confirm press, `d16` its rerun. What each turn was asked is the same question every time (the next decision,
given the instruction, the evidence window and the draft); the per-turn prompt content is not in the bundle (NO
EVIDENCE, see the gaps). Parameters are the trace's closed words: step numbers, change words, `over`/`through`, node
ids and call ids. Costs are per decision call; rows marked "no call" are tool runs the loop made for a decision.

| # | iter | time (UTC) | What it decided (trace words) | Action and parameters | Result | Draft / page | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 18:35:37 | initial look | core.run_node dom-capture_snapshot | `web.action.rejected.not_at_start_location` / start_location_not_reached | r0→r0, page unobserved | no call |
| 1 | 1 | 18:35:42 | tool_call | core.run_node browser-navigate (callId nav1) | `web.action.succeeded` | r0→r1, page unobserved | $0.0020 |
| 2 | 2 | 18:35:45 | tool_call | core.run_node dom-click (callId nav2) | `web.action.succeeded` | r1→r2, page changed | $0.0028 |
| 3 | 3 | 18:35:49 | tool_call | core.run_node browser-navigate (callId nav3) | `web.action.succeeded` | r2→r3, page changed | $0.0012 |
| 4 | 4 | 18:35:51 | tool_call | web.detect_repeating_structure (callId det1) | `web.structure.detected` | r3→r3, page unchanged | $0.0017 |
| 5 | 5 | 18:35:55 | tool_call | core.run_node dom-extract_list (callId ext1) | `web.inspect.succeeded` | r3→r4, page changed | $0.0009 |
| 6 | 6 | 18:35:57 | amend_draft amend=6:rerun | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` applied 1/refused 0, kept 4, rerun d6 | r4→r5, page unobserved | $0.0023 |
| 7 | 6 | 18:35:59 | amend_draft amend=6:rerun | core.run_node dom-extract_list (callId rerun.6) | `web.inspect.succeeded` | r5→r6, page unchanged | no call |
| 8 | 7 | 18:36:01 | amend_draft amend=7:keep | core.decision_amend_draft | `llm_evidence_loop.draft_unchanged` refused 7:already_in_flow:extract_list applied 0/refused 1, kept 4 | r6→r6, page unobserved | $0.0014 |
| 9 | 8 | 18:36:03 | amend_draft amend=7:rerun | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` applied 1/refused 0, kept 4, rerun d7 | r6→r7, page unobserved | $0.0009 |
| 10 | 8 | 18:36:05 | amend_draft amend=7:rerun | core.run_node dom-extract_list (callId rerun.7) | `web.inspect.succeeded` | r7→r8, page unchanged | no call |
| 11 | 9 | 18:36:07 | amend_draft amend=8:rerun | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` applied 1/refused 0, kept 4, rerun d8 | r8→r9, page unobserved | $0.0018 |
| 12 | 9 | 18:36:09 | amend_draft amend=8:rerun | core.run_node dom-extract_list (callId rerun.8) | `web.inspect.succeeded` | r9→r10, page unchanged | no call |
| 13 | 10 | 18:36:11 | amend_draft amend=9:rerun | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` applied 1/refused 0, kept 4, rerun d9 | r10→r11, page unobserved | $0.0017 |
| 14 | 10 | 18:36:13 | amend_draft amend=9:rerun | core.run_node dom-extract_list (callId rerun.9) | `web.inspect.succeeded` | r11→r12, page unchanged | no call |
| 15 | 11 | 18:36:15 | tool_call | web.detect_repeating_structure (callId det2) | `web.action.rejected.target_unobserved` / handle_not_in_packet | r12→r12, page unchanged | $0.0016 |
| 16 | 12 | 18:36:16 | amend_draft amend=10:rerun | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` applied 1/refused 0, kept 4, rerun d10 | r12→r13, page unobserved | $0.0021 |
| 17 | 12 | 18:36:18 | amend_draft amend=10:rerun | core.run_node dom-extract_list (callId rerun.10) | `web.inspect.succeeded` | r13→r14, page unchanged | no call |
| 18 | 13 | 18:36:20 | amend_draft amend=12:rerun | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` applied 1/refused 0, kept 4, rerun d12 | r14→r15, page unobserved | $0.0027 |
| 19 | 13 | 18:36:22 | amend_draft amend=12:rerun | core.run_node dom-extract_list (callId rerun.12) | `web.inspect.succeeded` | r15→r16, page unchanged | no call |
| 20 | 14 | 18:36:27 | tool_call | core.run_node dom-click (callId -) | `web.action.succeeded` | r16→r17, page changed | $0.0017 |
| 21 | 15 | 18:36:28 | amend_draft amend=14:repeat(over=13,through=14) | core.decision_amend_draft | `llm_evidence_loop.draft_amended` applied 1/refused 0, kept 5 | r17→r18, page unobserved | $0.0016 |
| 22 | 16 | 18:36:30 | amend_draft amend=13:rerun,14:repeat(over=13) | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` refused 14:already_so:click applied 1/refused 1, kept 5, rerun d13 | r18→r19, page unobserved | $0.0018 |
| 23 | 16 | 18:36:33 | amend_draft amend=13:rerun,14:repeat(over=13) | core.run_node dom-extract_list (callId rerun.13) | `web.inspect.succeeded` | r19→r20, page changed | no call |
| 24 | 17 | 18:36:34 | amend_draft amend=14:repeat(over=13,through=14) | core.decision_amend_draft | `llm_evidence_loop.draft_unchanged` refused 14:not_a_kept_step:click applied 0/refused 1, kept 5 | r20→r20, page unobserved | $0.0016 |
| 25 | 18 | 18:36:36 | amend_draft amend=14:drop | core.decision_amend_draft | `llm_evidence_loop.draft_amended` applied 1/refused 0, kept 4 | r20→r21, page unobserved | $0.0017 |
| 26 | 19 | 18:36:38 | amend_draft amend=14:keep,14:repeat(over=13,through=14) | core.decision_amend_draft | `llm_evidence_loop.draft_amended` refused 14:not_a_kept_step:click applied 1/refused 1, kept 5 | r21→r22, page unobserved | $0.0007 |
| 27 | 20 | 18:36:39 | amend_draft amend=14:keep | core.decision_amend_draft | `llm_evidence_loop.draft_unchanged` refused 14:already_in_flow:click applied 0/refused 1, kept 5 | r22→r22, page unobserved | $0.0017 |
| 28 | 21 | 18:36:40 | amend_draft amend=14:rerun,14:repeat(over=15,through=14) | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` refused 14:over_not_before:click applied 1/refused 1, kept 5, rerun d14 | r22→r23, page unobserved | $0.0010 |
| 29 | 21 | 18:36:42 | amend_draft amend=14:rerun,14:repeat(over=15,through=14) | core.run_node dom-click (callId rerun.14) | `web.action.succeeded` | r23→r24, page changed | no call |
| 30 | 22 | 18:36:43 | amend_draft amend=16:repeat(over=15,through=16) | core.decision_amend_draft | `llm_evidence_loop.draft_amended` applied 1/refused 0, kept 5 | r24→r25, page unobserved | $0.0018 |
| 31 | 23 | 18:36:45 | amend_draft amend=15:rerun,16:repeat(over=15) | core.decision_amend_draft | `llm_evidence_loop.draft_rerun` refused 16:already_so:click applied 1/refused 1, kept 5, rerun d15 | r25→r26, page unobserved | $0.0010 |
| 32 | 23 | 18:36:48 | amend_draft amend=15:rerun,16:repeat(over=15) | core.run_node dom-extract_list (callId rerun.15) | `web.inspect.succeeded` | r26→r27, page changed | no call |
| 33 | 24 | 18:37:08 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0019 |
| 34 | 25 | 18:37:11 | tool_call | web.detect_repeating_structure (callId det3) | `web.structure.detected` | r27→r27, page unchanged | $0.0017 |
| 35 | 26 | 18:37:12 | tool_call | web.detect_repeating_structure (callId det4) | `web.action.rejected.target_unobserved` / handle_not_in_packet | r27→r27, page unchanged | $0.0013 |
| 36 | 27 | 18:37:14 | tool_call | web.detect_repeating_structure (callId det5) | `web.structure.detected` | r27→r27, page unchanged | $0.0010 |
| 37 | 28 | 18:37:33 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0014 |
| 38 | 29 | 18:37:36 | tool_call | web.detect_repeating_structure (callId det6) | `web.structure.detected` | r27→r27, page unchanged | $0.0014 |
| 39 | 30 | 18:37:37 | tool_call | web.detect_repeating_structure (callId det7) | `web.structure.detected` | r27→r27, page unchanged | $0.0024 |
| 40 | 31 | 18:37:39 | tool_call | web.detect_repeating_structure | `llm_evidence_loop.already_answered` | r27→r27, page unobserved | $0.0024 |
| 41 | 32 | 18:37:40 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0011 |
| 42 | 33 | 18:37:41 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0015 |
| 43 | 34 | 18:37:43 | tool_call | web.detect_repeating_structure | `llm_evidence_loop.already_answered` | r27→r27, page unobserved | $0.0011 |
| 44 | 35 | 18:37:44 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0016 |
| 45 | 36 | 18:37:46 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0015 |
| 46 | 37 | 18:37:47 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0012 |
| 47 | 38 | 18:37:48 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0012 |
| 48 | 39 | 18:37:50 | complete acts=->d16 | core.decision_unusable | `flow_draft.repeat_span_unknown` | r27→r27, page unobserved | $0.0012 |

Not rows of the trace, but tool calls the loop made (core.log): after the completions at iterations 24 and 28 the
dry-run gate replayed the draft, six `core.run_node` calls each (18:36:50.222-18:37:08.835 and 18:37:15.320-18:37:33.670,
18.6 s and 18.4 s): `replayed`, `replayed`, `unreproducible` (6.8 s), `replayed`, `unreproducible` (6.1 s), `replayed`.
Read as the reset plus the five kept steps `d2`, `d3`, `d4`, `d16`, `d17`, the unreproducible ones are `d3` (the click
on the home page) and `d16` (the Confirm pressed for Amara Osei). The mapping is inferred from the count and order;
the positions and node ids are not published (gap below). The completions at 32-39 replayed nothing: the gate judged
the refused draft again from those two replays (`R/llm/node-tools/dry-run-gate.ts:90-105`, F18) and, with `d3` asked
and `d16` inside a repeating span, passed it; only `flow_draft.repeat_span_unknown` stayed.

- **Repeats, and what the loop believed was progress.**
  - Iterations 6-13: the listing was rerun six times (`d6`→`d7`→`d8`→`d9`→`d10`→`d12`→`d13`), each answering
    8,753-8,773 bytes with the page unchanged. Each rerun is a draft change (`draftState: changed`), so the loop
    counted it as progress. The model was tuning the listing's `where`/fields; the inputs are not in the trace.
  - Iterations 15-23: the model tried to state the loop three ways and fell into the same trap twice (Q1 below).
  - Iterations 24-39: nine completions with the same claim (`acts=->d16`, one act claim on the Confirm) and the same
    refusal, broken only by seven `web.detect_repeating_structure` requests (five ran, one of them refused `handle_not_in_packet`; two
    answered from memory, `already_answered`). From iteration 32 the model sent the identical completion seven times out of
    eight decisions; it believed the draft was finished.
- **Rejections and refusals received, and whether each said enough to route around.**
  - Row 0, `not_at_start_location` / `start_location_not_reached`: enough; the model navigated at iteration 1 (Q2).
  - `7:already_in_flow`, `14:already_so`, `16:already_so`, `14:already_in_flow`: enough (the step was already so).
  - `14:not_a_kept_step` (iterations 17, 19): not enough. The refused statement was `repeat over 13 through 14`; the
    step out of the Flow was `d13` (withdrawn by the model's own `13:rerun` one decision earlier), but the feedback
    (`R/llm/draft-amendment-feedback.ts:56`) does not say which reference is out or why. Same defect as run 8's
    cause 3 (`run-muntfume-7f7d97fb`).
  - `14:over_not_before` (iteration 21): true but misleading. The listing `d15` was after the Confirm `d14` only
    because the rerun had appended it at the end; the feedback (`draft-amendment-feedback.ts:55`) never mentions
    `reorder`, so the model **pressed Confirm again for real** (`14:rerun`, Amara Osei accepted, screenshot 00007) to
    get an act after the listing.
  - `handle_not_in_packet` on `web.detect_repeating_structure` (iterations 11, 26): the model named an element
    handle that was not in the latest packet. Which handle, and whether a cap had dropped it: NO EVIDENCE.
  - `flow_draft.repeat_span_unknown` (iterations 24-39, nine times): not enough, and wrong. See Q1.
- **Where the context was evicted or truncated.** The draft shown to the model is held to 4,000 bytes
  (`R/llm/loop-configuration.ts:355`, `draftBytes`). It reached 3,918 bytes at iteration 9; from iteration 10 the draft's
  instruction text was cut from 1,051 to 177 bytes (`instructionBytes`), from iteration 13 step inputs were withheld
  (`withoutInput` 4, rising to 9), and from iteration 24 one input was shown only as `inputTooLarge`
  (`R/flow-draft/entry.ts:80`, `:114-183`). So while it authored and corrected the loop the model could not see the
  arguments of most of its own steps, including the listing's `where`. This is a cap on what the model is passed,
  **owned by t200**.

### Q1 — why `flow_draft.repeat_span_unknown` ended the build as `evidence_unusable_decision` (HTTP 400)

**It was refused back to the model as feedback, nine times. It became terminal because the model could not correct
it from what it was told, sent the same completion again, and the no-progress guard stopped the loop.**

1. **What the model sent.** Iteration 22: `{step: 16, change: "repeat", over: 15, through: 16}` (trace
   `amend=16:repeat(over=15,through=16)`), applied: `d16` (the Confirm) now read `{kind: repeat, over: "d15", through:
   "d16"}`, with `d15` the listing. Iteration 23: `[{step: 15, change: "rerun", input: …}, {step: 16, change: "repeat",
   over: 15}]`. The routing half was applied first and refused `already_so`
   (`R/llm/decision-handlers/amendment.ts:52`, non-rerun amendments applied before the rerun runs); then the loop ran
   the rerun and appended its result as `d17` at the **end** of the draft, and dropped `d15`
   (`R/llm/evidence-loop.ts:700` → `R/llm/evidence-loop/rerun-replacement.ts:22-24`). Nothing rewrote `d16`'s routing:
   it still said `over: "d15"`.
2. **What made the span "unknown".** At each completion the plan is assembled from the proposed steps only
   (`R/llm/harness-options/bootstrap-completion.ts:366`, `steps.filter(automationStudioFlowDraftStepIsProposed)`):
   `d2`, `d3`, `d4`, `d16`, `d17`. `routeAutomationStudioFlowDraftSteps` indexes only those
   (`R/flow-bootstrap/authoring/draft-routing.ts:85`); for `d16`, `byId.get("d15")` is undefined (`:178`), so `:182`
   returns `flow_draft.repeat_span_unknown`. The span was unknown because its **`over`** was gone, but the message is
   "Step 16 repeats through a step that is not in the Flow after it" — it names `through`, which was `d16` itself and
   present. The draft the model reads still printed "repeats through step 16, over step 15"
   (`R/flow-draft/entry.ts:316-324`), since `d15` was still listed (withdrawn), and the refusal's standing advice
   (`bootstrap-completion.ts:385`, `DRAFT_SCRIPT_NOTE`: "drop, exploratory, reorder, rerun") names no routing change.
   Even a correct re-statement could not work as the draft stood: `d17` came after `d16`, so `16:repeat(over=17)` is
   refused `over_not_before` (`R/flow-draft/amendment.ts:231`); only `reorder` of `d17` to before `d16` and then
   `repeat` would have. The model had walked into the identical trap at iterations 15-16 (`14:repeat(over=13)` then
   `13:rerun`).
3. **Which code made the refusal terminal.** A refused completion is an unusable decision
   (`R/llm/decision-handlers/completion.ts:65-76` → `context.unusable`). In `R/llm/evidence-loop.ts:353-367` the
   decision's issue set is compared with those seen since the last tool result: at iteration 32 it restarted the
   count at 1 (after det6 at 29 had cleared it); 33 stepped it to 2; the `already_answered` request at 34 to 3; the
   completions at 35-39 to 8, which is `maxStepsWithoutProgress` (8: `R/loop-limits/flow-bootstrap-evidence-loop.ts:145`,
   `R/loop-limits/evidence-loop.ts:85`). `noProgress.reached()` at `:360` then returned
   `unusableDecisions.stalled(...)` (`:367`), which `R/service.ts:1558` builds as `keeper.stalled(
   flowBootstrapEvidenceUnusableDecisionFailure(...))` (`R/flow-bootstrap/generation-failure/evidence-failure.ts:78-93`:
   `flow_bootstrap.evidence_unusable_decision`, stage `provider_output_validation`, `retryable: false`). The API
   answers any diagnosed bootstrap error `ok: false` (`api/handlers/llm-generation.ts:101-108`), which is the HTTP 400.
   The counts are inferred from the no-progress rules; the loop does not publish its step count per row.
4. **Proposed fix (not implemented).**
   - **Root, `R/llm/evidence-loop/rerun-replacement.ts`, the branch in `automationStudioLlmEvidenceRerunReplaced` after
     the proposable check (`:23`), before the drop at `:24`:** a rerun is the same step done again, so it must take the
     replaced step's place and names. Move the rerun to the replaced step's position (the `reorder` path of
     `R/flow-draft/amendment.ts`, `moveStep`), and rewrite every proposed step's routing reference to the replaced id
     (`automationStudioFlowDraftRoutingReferences`, `R/flow-draft/routing.ts:86`: `over`, `through`, `check`, `to`)
     to the rerun's id. Say so in the draft change the model is shown ("step 17 replaced step 15 at position 15; step
     16 now repeats over it"), so a model that meant a new, separate read learns it has to run one rather than rerun
     the loop's source. Test: `R/llm/evidence-loop/tests/`, a draft `[listing, press(repeat over listing)]`, rerun of
     the listing, then `routeAutomationStudioFlowDraftSteps` returns a For Each and no issue.
   - **The refusal, `R/flow-bootstrap/authoring/draft-routing.ts:182`:** split the one branch into three, each naming
     the reference and what to send: `over` not in the Flow ("step 16 repeats over step 15, which is out of the Flow:
     it was replaced by step 17 / dropped; send {step: 16, change: repeat, over: <listing>} with the listing before
     step 16, reordering it there if needed"), `through` not in the Flow, and `through` behind the step. Add the
     routing words to `DRAFT_SCRIPT_NOTE` (`bootstrap-completion.ts:385`).
   - **The guard (`evidence-loop.ts:360-367`) stays as it is.** With the two fixes above the refusal is either
     impossible or correctable; the guard is right to stop a model that sends one completion eight times.

### Q2 — why the first step was `web.action.rejected.not_at_start_location` / `start_location_not_reached`

By design, and it cost no provider call. Row 0 is the loop's free first look (`callId initial.core.run_node`,
`dom-capture_snapshot`), made before any decision. The domain refuses every non-navigation node in a build that was
given a `startLocation` until a navigation node has succeeded in that build, whatever the tab shows: the opening call
re-arms the build as "not arrived" (`domain/src/runtime/llm-evidence/node-run/run.ts:224-226`,
`node-run/arrival.ts:63`), `currentPage` hides the page until arrival (`run.ts:782`), and the refusal is built at
`run.ts:251`/`:274` → `:791` with `start_location_not_reached` (`node-run/start-location.ts:66`). The rule is t190-w4's
(run `run-muncqlr0-3348202b`: a Flow handed its page never records how to reach it). The Lab also blanks the scenario
tab before a build (`packages/test-runner/src/run-scenario.ts:304`), so the tab was `about:blank` anyway (screenshot
00002). The model navigated at iteration 1 and the build arrived. Not a defect.

## Stage 3 — the proposed Flow

- Node list as authored: no plan was ever accepted. The draft at every completion (kept, proposable, in draft order):
  1. `d2` `web.output.browser-navigate` (nav1) — to the start location, inferred from the arrival rule and screenshot
     00003 (Circleway home). Argument: NO EVIDENCE.
  2. `d3` `web.output.dom-click` (nav2) — on the home page; the page changed. Target: NO EVIDENCE (likely the Friends
     entry). Replayed `unreproducible` in both dry runs.
  3. `d4` `web.output.browser-navigate` (nav3) — to `/scenarios/social-network-feed/friends/requests/` (screenshot
     00004 URL). Argument otherwise NO EVIDENCE.
  4. `d16` `web.output.dom-click` — Confirm, the rerun of `d14`; pressed for Amara Osei (screenshot 00007). Routing
     `{repeat, over: d15, through: d16}`, with `d15` no longer in the Flow.
  5. `d17` `web.output.dom-extract_list` — the rerun of `d15`; its `where` and fields: NO EVIDENCE.
- Divergences from the stage 1 chain:
  - Stage-1 step 3 (the filtered listing before the act) is missing: the listing the loop named was withdrawn by the
    rerun, and its replacement `d17` sits after the act.
  - Stage-1 step 4: `d16` repeats over nothing; as a straight line it would press Confirm once, on a fixed card.
  - Stage-1 step 5: `d17` is the only read, so the model was using one listing both as the loop's source and as the
    answer; the Flow needs two reads.
  - `d3` then `d4`: a click and a navigate to reach one page; harmless but `d3` is not reproducible.
  - No dismissal step for the "Turn on notifications?" prompt (screenshots 00004-00005); it was dismissed during
    exploration by the interference defence (NO EVIDENCE of which step), so the Flow does not carry it.
- For each divergence: the listing/act order and the dangling `over` are **could not express it** — the model stated
  the loop correctly twice (iterations 15 and 22) and Core's own rerun unstated it both times. Using one read for two
  purposes is **misread the grammar** (`rerun` replaces; it does not add). The missing dismissal is a domain choice
  (the defence handles it at run time), not a divergence.

## Stage 4 — replay

No Flow was created, so nothing was played back (`flow-lane.json`: `runtimeRunId`, `status`, `actions` empty,
`stoppedAt: "build"`). The only replays were the two mid-build dry runs above.

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| (none) | no | no Flow | - | - | - |
| dry run 1 (after iteration 24), 6 calls | yes | reset, `d2` replayed, `d3` unreproducible, `d4` replayed, `d16` unreproducible, `d17` replayed (mapping inferred) | 18.6 s | none | none; refused, then judged by F18 |
| dry run 2 (after iteration 28), 6 calls | yes | identical outcomes | 18.4 s | none | none |

- Any node that reported success while doing nothing: NO EVIDENCE for the dry runs (per-position node ids and
  effects are not published). In exploration, none: every `web.action.succeeded` changed the page.
- Provider calls during replay (expected: zero): zero.

## Stage 5 — the answer

- Records expected vs returned: expected 4 (`manifest.ts:61`, `:192-194`: requests with `mutualCount >= 5` from
  `content/requests.ts:20-29`): Amara Osei "23 mutual friends", Jonas Weber "Aisha Khan and 4 other mutual friends",
  Lin Zhao "11 mutual friends", Freya Holm "5 mutual friends", in list order. Returned: none; no Flow ran.
- Fields compared, matched, mismatched: none compared.
- Every mismatch, observed value beside expected: no answer. The site state the run left behind is itself wrong:
  Tom Becker ("1 mutual friend") accepted, Amara Osei accepted, Jonas Weber, Lin Zhao and Freya Holm still pending
  (screenshots 00007, 00010-00013). A later correct Flow on this state would read Tom Becker as accepted.
- If the comparison was count-only: not applicable; the run did not reach an answer.

## Stage 6 — judgement and repair

- **Did the system judge its own result:** no. There was never a result. Each completion was refused by the plan
  assembler before any Flow existed; the answerability and act checks never saw an assembled plan.
- **Did a repair trigger:** no, and nothing in this path can trigger one:
  - The repair ladder (t193) is entered only by a Flow run that failed or was refuted; a build that ends
    `evidence_unusable_decision` has no Flow to run and no path into the ladder.
  - The build's own correction channel is the completion refusal. It fired nine times, but it named the wrong
    reference (Q1), and the model stopped amending after iteration 23; iterations 24-39 were only completions and
    structure detections.
  - The stall redirect (`R/llm/evidence-loop/stall-redirect.ts`) repeats the last issue code, which is the same
    misleading one.
  - Core kept the incomplete draft (`keeper.stalled`, `R/service.ts:1558`; `incompleteDraft {revision 1, steps 5}`), but
    only a later build of the same Flow resumes from it, and the Lab creates a new Flow per run.
- **What context the repair would have received:** none was built. For the in-loop correction the model had the
  conversation and the draft (inputs withheld, see stage 2), the refusal (wrong reference), and the page; it did not
  have the fact that its rerun had withdrawn `d15`, or which dry-run positions were unreproducible by node.
- **Was the repair persisted, did the re-run use it:** no repair; no re-run.
- **Judged against the user's build lifecycle.**
  - (a) *Live exploration while drafting, no replay from the first step and no return to the start during the
    build:* **violated.** Exploration was live (every action ran on the page as the model chose it), but the two dry
    runs at iterations 24 and 28 each replayed the draft from its first step after a reset to the start location: the
    page jumped to the home feed mid-build (screenshots 00008-00009, 18:37:03-18:37:19; UI-review moments 7-8 at the
    home URL). 37 s of the 142 s build. Mid-build replay and restart are a cause **owned by t196**. The reruns of a
    Confirm click (`14:rerun`, iteration 21) also re-executed a lasting act during the build.
  - (b) *Once the model says the Flow is ready, test it and judge its result:* **not reached.** The model said ready
    nine times; the Flow was never assembled, so never tested or judged.
  - (c) *Repair, finish, or declare not doable only if absolutely no way remains:* **violated — the build gave up
    while a way remained.** Core itself held everything needed to fix the draft (it knew `d17` replaced `d15`); the
    model had `reorder` and `repeat` available; 25 of 64 calls, $0.19 of $0.25 and 398 s of 540 s were left. The
    build ended on a correctable structural refusal it had caused. That is a defect: Q1's fix.

## UI review

Every bundle screenshot was opened; the UI-review PNGs `08-mid-build-panel.png` and `10-failure-panel.png` were also
opened. The t195 tree's extension predates t191 round 2, so several defects below are t191's known ones seen again.

| Screenshot | What it shows | Defect |
| --- | --- | --- |
| `screenshots/00001-f8a98ce7b2d2.jpg` (18:35:15, dispatch) | Site behind the Circleway cookie wall; panel "What can FluxIQ do for you? / Loading the conversation…"; Simple/Advanced toggle; status and "Get set up" cards above the chat; "Page \| Full \| Small \| Off" | t191 defects 1, 2, 6; "Loading the conversation…" while a build is being dispatched |
| `00002-51206fed56ff.jpg` (18:35:28) | Tab blanked by the Lab; card "Connected to FluxIQ — FluxIQ can't work on this page" while the chat says "Building your Flow / Building the Flow / 1 step so far"; no overlay | Contradictory status (t191 defect 3); "Building your Flow / Building the Flow" says the same thing twice; no user turn in the chat |
| `00003-1ced5bf8e41f.jpg` (18:35:44) | New tab on the home feed; overlay bottom-left "Building your Flow / Deciding the next step" covering the site's shortcut list ("Old Town Bakers' Circle") | Overlay covers site content (t191 defect 7, now on the left) |
| `00004-4ada49c6ca26.jpg` (18:36:01) | Friend requests with "Turn on notifications?" prompt; chat and overlay "Using core.run_node: web.inspect.succeeded" | Raw tool id and result code shown to a person (t191 defect 5) |
| `00005-a12e0a81c626.jpg` (18:36:16) | Same page; "Deciding the next step / 13 steps so far" | "Add an AI model key: To do" during a live build (t191 defect 9) |
| `00006-e6d513fee704.jpg` (18:36:31) | **Tom Becker (1 mutual friend) "Request accepted"**; chat "Using core.run_node / 17 steps so far" | A wrong lasting act, and the chat never told the person FluxIQ had confirmed someone; raw tool id |
| `00007-d75d09219eac.jpg` (18:36:48) | Tom Becker and Amara Osei accepted | Same: two confirmations, no chat message about either |
| `00008-ef9ede17cf6c.jpg` (18:37:03) | Page scrolled to "Friend requests / 6 friend requests" during dry run 1; "21 steps so far · 1 failed" | "1 failed" counts a refused completion as a failed step, unexplained |
| `00009-07639e716953.jpg` (18:37:19) | Page jumped to the home feed (dry run 2's reset) | The person sees the build leave the page mid-build (t196's cause, seen in the UI) |
| `00010-87d5e448a871.jpg`, `00011-004574d07c6c.jpg` (18:37:34-49) | Back on requests; "23 steps so far · 2 failed" then "24 steps so far · 7 failed" | Failure counter climbs by five in 15 s with no message saying why |
| `00012-cdcd85c118e4.jpg`, `00013-7ce0e424fc0c.jpg` (18:37:50-54) | Header "FluxIQ · Build failed"; chat only "Worked for 51s · 24 steps · 9 failed"; overlay "Build failed / Build failed" | Duration undercounts (51 s vs 142 s loop, 155 s from dispatch) and steps undercount (24 vs 39 decisions); no sentence saying why it failed or what the person can do; the "Building your Flow" turn is replaced rather than followed; overlay repeats its title as its detail |

Overlay (UI review, 16 samples per moment): absent at moments 1-3 (sample windows 18:35:14.9 to 18:35:38.9, the first 23 s of the build,
including the pre-loop phase); present and visible from moment 4 on; "flickering" at moment 8 (three texts in 3 s:
"Deciding the next step", "Using core.run_node", "Using core.run_node: core.replay.replayed"); texts include
"Using web.detect_repeating_structure". Chat standard: not ChatGPT-like — the person's instruction is never shown as
a user turn, the assistant turn is a status card with a disclosure, the chat shares the panel with setup cards, and
the failure has no explanation. The composer is at the bottom (the one part that meets the standard).

## Causes

Ownership checked against the t174, t193, t194 and t195 reports and debugs in their `fxwork` trees; the first lane to
record a cause owns it. `R/` is Core's `packages/fluxiq/src/programs/automation-studio/runtime/`.

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | A `rerun` appends its replacement at the end of the draft and drops the replaced step without carrying the routing that names it: `15:rerun` at iteration 23 turned `d16`'s `{repeat, over: d15}` into a reference to a withdrawn step and put the new listing `d17` after the act. The same happened at iterations 15-16 (`14:repeat(over=13)` then `13:rerun`). This is what ended the build. | Core `R/llm/evidence-loop/rerun-replacement.ts:22-24`, called at `R/llm/evidence-loop.ts:700`; routing half applied first at `R/llm/decision-handlers/amendment.ts:52` | Put the rerun at the replaced step's position and rewrite every `over`/`through`/`check`/`to` naming the replaced id to the rerun's id (`R/flow-draft/routing.ts:86`), and tell the model in the draft change. Test in `R/llm/evidence-loop/tests/`. | t195 (first recorded here; t193-wK C7 saw the same code in t194's re-author without a cause) |
| 2 | The refusal `flow_draft.repeat_span_unknown` names the wrong reference: "repeats through a step that is not in the Flow after it" when `through` (`d16`, the step itself) was present and `over` (`d15`) was missing. The draft line kept saying "over step 15" and the refusal's note (`DRAFT_SCRIPT_NOTE`) lists no routing change, so nine refusals never told the model what to amend. | Core `R/flow-bootstrap/authoring/draft-routing.ts:178-182`; `R/llm/harness-options/bootstrap-completion.ts:385`; `R/flow-draft/entry.ts:316-324` | Three branches at `:182` (over missing, through missing, through behind), each naming the step, why it is out (replaced by step N / dropped) and the amendment to send, `reorder` included; routing words added to `DRAFT_SCRIPT_NOTE`; `routingLine` marks a reference to a withdrawn step. | t195 |
| 3 | `not_a_kept_step` on `14:repeat(over=13,through=14)` (iterations 17, 19) did not say that `over` = 13 was the out-of-Flow reference, withdrawn by the model's own rerun. | Core `R/llm/draft-amendment-feedback.ts:56`; `R/flow-draft/amendment.ts:227` | Name the offending reference and why it is out (as run 8 cause 3). | t195, open (run 8 `run-muntfume-7f7d97fb` cause 3) |
| 4 | `over_not_before` (iteration 21) never mentions `reorder`, so to get the act after the listing the model reran the Confirm click and pressed Confirm for real a second time (Amara Osei accepted, screenshot 00007). | Core `R/llm/draft-amendment-feedback.ts:55`; `R/flow-draft/amendment.ts:231` | When `over` is after the step, the feedback says to `reorder` the listing to before the act, with the exact amendment; never suggests re-running an applied press. Pairs with the open proposal to refuse `rerun` of an applied consequential press. | t195 (feedback new here; refusing the rerun is run 8 cause 1, open) |
| 5 | Exploration pressed Confirm on the first card, Tom Becker ("1 mutual friend"), at iteration 14 (`d14`, call id "-"): a wrong lasting act the instruction said to leave alone, and the site state the run left behind is wrong. F14's wording is guidance only. | model decision; Core `R/flow-draft/amendment.ts:107` (wording) | Open candidate guard: refuse a consequential exploration press on a row the latest listing's `where` drops, or before any filtered listing exists. | t195, open (runs 7, 8, 9) |
| 6 | Two mid-build dry runs replayed the draft from its first step after a reset to the start location (18.6 s and 18.4 s; the page jumped to the home feed, screenshots 00008-00009), against the lifecycle's "no replay from the first step, no return to the start during the build". | Core `R/llm/evidence-loop/completion-attempt.ts:61`, `R/llm/node-tools/dry-run-gate.ts:107-117`, `R/llm/node-tools/replay-draft.ts` | Owned by t196 (the dry run, decision D1). | t196 |
| 7 | The draft the model reads is capped at 4,000 bytes: from iteration 10 the instruction in it was cut from 1,051 to 177 bytes, from iteration 13 up to 9 steps' inputs were withheld (`withoutInput`), and one input was shown only as `inputTooLarge`. The model authored and corrected the loop without seeing its own listing's `where`. | Core `R/llm/loop-configuration.ts:355` (`draftBytes`), `R/flow-draft/entry.ts:80`, `:114-183` | Owned by t200 (no limits on what the model is passed). | t200 |
| 8 | A build that stalls on a structural refusal Core could correct ends the whole build with budget left (25 calls, $0.19, 398 s): there is no path from `evidence_unusable_decision` to a deterministic correction, a continuation or the repair ladder. The kept incomplete draft is resumed only by a later build of the same Flow, which the Lab never makes. | Core `R/service.ts:1558` (`keeper.stalled`), `R/llm/evidence-loop.ts:360-367` | Cause 1's fix removes this instance. Generally: before `stalled` on a completion refusal whose issue Core can repair deterministically (a dangling routing reference), repair the draft and ask again. | t195 (first recorded here; the repair-ladder entry, if wanted, is t193's area) |
| 9 | `web.detect_repeating_structure` was refused `handle_not_in_packet` twice (iterations 11, 26): the model named a handle absent from the latest packet. Whether an element cap dropped it is not known. | domain `web.detect_repeating_structure` tool; packet caps | If a cap dropped it, t200; otherwise model decision. Needs the handle in the trace. | t200 if a cap (NO EVIDENCE) |
| 10 | UI: raw tool ids and result codes ("Using core.run_node: web.inspect.succeeded", "Using web.detect_repeating_structure", "core.replay.replayed") in chat and overlay; Simple/Advanced toggle; setup cards above the chat; "Add an AI model key: To do" while building; contradictory "can't work on this page" beside "Building"; overlay absent for the first 23 s of the build and flickering at moment 8; "Build failed / Build failed"; "Worked for 51s · 24 steps · 9 failed" for a 142 s build of 39 decisions; no user turn; no message when FluxIQ confirmed two people; no reason or next step on failure. | downstream extension side panel and on-page overlay | Open; most are t191 defects 1-9 seen again (the t195 tree predates t191 round 2). New here: no chat message for a lasting act done during the build, and no failure explanation. | t191 |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | The prompt and evidence each decision saw, and the refusal feedback text it was shown (only codes are published) | Core `R/llm/evidence-loop/trace.ts` rows carry codes only; the Lab keeps no decision content |
| 2 | Every `rerun` input (the listing's `where` and fields at `d7`-`d17`) and each click's target; the trace's `amend=` prints step numbers and change words only | Core `R/llm/evidence-loop/progress-trace.ts:84-91` (by design content-free) |
| 2 | The handle named in each `handle_not_in_packet` refusal, and whether a cap dropped it | domain detect-structure refusal; not in `flow-lane.json` |
| 2 | The no-progress step count per row (Q1's 1→8 is inferred from the rules) | Core `R/llm/evidence-loop/no-progress.ts` (count not published on rows) |
| 3 | The draft's steps with their arguments at the failed completion; the incomplete draft is stored in Core and deleted with the run's store | Core diagnostic `incompleteDraft` carries counts only (added by `keeper.stalled`, `R/service.ts:1558`); Lab store cleanup |
| 4 | Which draft position and node each dry-run call replayed, and why `d3` was unreproducible | Core `R/llm/node-tools/dry-run-gate.ts` verdict is shown to the model but not published on the trace (known: run 9 cause 4) |
| Header | The launcher command line | Lab log (`live-guard` line records task and fingerprint only) |
| UI | What the panel's "N steps · M failed" and "Worked for" count | panel counter source, not in any artifact (known from run-muntcsge) |
