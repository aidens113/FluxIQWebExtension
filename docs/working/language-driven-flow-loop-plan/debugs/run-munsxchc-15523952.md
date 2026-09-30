# Run debug — `run-munsxchc-15523952` (lane D run 7)

Lane t195, slot-4. Written by worker t195-w11 from the bundle `test-runs/instances/t195-slot-4/run-munsxchc-15523952`
(flow-lane.json `build.evidenceLoop.steps`, live-llm.json, events.ndjson, logs/core.log `[FluxIQ build-trace]`,
15 screenshots), the local `provider-failures.local.json` (refusal codes only), the Lab UI review
(`run-munsxchc-15523952.ui-review.local.json`), the launcher log (scratchpad `t195-lab-social-network-feed-confirm-requests-074148.log`)
and lane shots `t195-shots/*-r7-*.png`. Privacy: codes, counts, ids, node ids, durations, control names; page values
only as fixture names already published. This run predates F13: its trace has decision kinds but not what an
amendment changed, which act a completion claimed, or why a claim was refused.

## Header

- Run id: `run-munsxchc-15523952`
- Scenario / variant / task: `social-network-feed` / none / `social-network-feed-confirm-requests`
- Command: `live-run-d.sh social-network-feed social-network-feed-confirm-requests` = `run-lab.mjs run --live-llm
  --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow`, tokens
  48000/8000/56000 per call, `--llm-max-calls 64`, `--llm-max-cost-usd 0.25`, headed, `FLUXIQ_BUILD_PROGRESS_TRACE=1`,
  `FLUXIQ_LAB_ALLOW_STALE_BUILD=1`. **The Lab reported the extension build one minute behind its source**
  (`apps/extension/src/content/extraction/field-reader.ts` newer than the output) and ran anyway (`stale-allowed`).
  Prelude 257 s (domain, extension and test-runner rebuilt).
- Date, provider, model: 2026-09-30, dispatch 07:51:35Z, build loop 07:52:05Z-07:54:27Z; DeepSeek `deepseek-flash`
- Provider calls, tokens, cost: 29 build calls (bound 64); 409,421 in / 4,500 out = 413,921 tokens; $0.0509
- Verdict as reported: failed, `runtime.behavior`: "FluxIQ did not build a Flow from the task's instruction
  (`flow_bootstrap.evidence_unusable_decision`)"; issue codes `bootstrap.instructed_act_missing`,
  `llm_evidence_loop.dry_run_refused`, `core.replay.unreproducible`, `core.replay.failed`. Build 153,027 ms; run 498 s.
- **Stage reached: 2.** Exploration ran; four completions were refused; no Flow was proposed.

## Stage 1 — the instruction and the expected chain

Copied verbatim from scratchpad `t195-stage1-confirm-requests.md` (written 05:12Z, before run 1):

- Instruction: `social-network-feed-confirm-requests` (`apps/scenario-lab/src/scenarios/social-network-feed/live-tasks.ts` CONFIRM_REQUESTS): confirm every friend request with at least five mutual friends, leave the rest, then a table name / mutualFriends of every request the list now shows as accepted, in list order, mutualFriends verbatim.
- Site facts (`content/requests.ts`, `client/requests-script.ts`): 8 requests; the Friends home shows only 4 behind a "See all", and the badge is stale at 4. Qualifying: amara-osei ("23 mutual friends"), jonas-weber ("Aisha Khan and 4 other mutual friends" = 5), lin-zhao ("11"), freya-holm ("5"). Not: tom.becker.9 (1), priya-nair (4, one short), diego-alvarez (no line), marta-kowalczyk (3). Confirm is rate limited to 3 per 15 s: the 4th press opens a "You're going too fast" alertdialog with a countdown; OK confirms nothing; "Try again" appears at 0 and confirms the refused request.
- Expected chain:
  1. Navigate to `friends/requests/` (all 8 cards), not the 4-card Friends home.
  2. A loop over request cards (or four explicit presses): read the mutual line, route on count >= 5 (the "X and 4 other" form counts as 5), press Confirm only on a qualifying card; skip the others without Delete.
  3. The fourth Confirm meets the rate limit: the Flow must wait out the countdown and press "Try again" (or OK, wait, press Confirm again) -- a mid-loop retry, not a failure and not a skipped card.
  4. Extract the accepted cards (status "Request accepted"): name and the verbatim mutual line, list order: Amara Osei, Jonas Weber, Lin Zhao, Freya Holm.
- A wrong answer that looks right: 3 rows (the 4th confirm refused silently and the run moved on); Priya Nair confirmed (4 read as >=5 or "Aisha Khan and 4 other" miscounted either way); only the 4 home cards considered; mutualFriends normalised to a number; a Delete pressed on a non-qualifying card.

## Stage 2 — exploration

One row per model turn (29 decisions: 9 `tool_call`, 16 `amend_draft`, 4 `complete`). "What it was asked" is the
newest thing the loop put in front of the model; the loop's full context is not in the bundle.

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 1 | instruction + first look | tool_call | browser-navigate; call `nav.start` | web.action.succeeded effect=true page unobserved |
| 2 | next decision | tool_call | dom-click; call `dismiss.cookies` | web.action.succeeded effect=true page changed |
| 3 | next decision | tool_call | browser-navigate; call `open.friend-requests` | web.action.succeeded effect=true page changed |
| 4 | next decision | tool_call | detect_repeating_structure; call `detect.requests` | web.structure.detected page unchanged |
| 5 | next decision | tool_call | dom-extract_list; call `extract.requests` | web.inspect.succeeded page changed |
| 6 | next decision | amend_draft | dom-extract_list; call `rerun.6` | draft_rerun applied 1 refused 0 kept 4; web.inspect.succeeded page unchanged |
| 7 | next decision | amend_draft | dom-extract_list; call `rerun.7` | draft_rerun applied 1 refused 0 kept 4; web.inspect.succeeded page unchanged |
| 8 | next decision | amend_draft | change not traced (pre-F13) | draft_unchanged applied 0 refused 1 kept 4 |
| 9 | amendment feedback | amend_draft | dom-extract_list; call `rerun.8` | draft_rerun applied 1 refused 0 kept 4; web.inspect.succeeded page unchanged |
| 10 | next decision | tool_call | dom-click; call `dismiss.notifications` | web.action.succeeded effect=true page changed |
| 11 | next decision | amend_draft | dom-extract_list; call `rerun.9` | draft_rerun applied 2 refused 0 kept 4; web.inspect.succeeded page unchanged |
| 12 | next decision | amend_draft | dom-extract_list; call `rerun.11` | draft_rerun applied 1 refused 0 kept 4; web.inspect.succeeded page unchanged |
| 13 | next decision | amend_draft | dom-extract_list; call `rerun.12` | draft_rerun applied 1 refused 0 kept 4; web.inspect.succeeded page unchanged |
| 14 | next decision | amend_draft | dom-extract_list; call `rerun.13` | draft_rerun applied 1 refused 0 kept 4; web.inspect.succeeded page unchanged |
| 15 | next decision | amend_draft | change not traced (pre-F13) | draft_unchanged applied 0 refused 1 kept 4 |
| 16 | amendment feedback | amend_draft | dom-extract_list; call `rerun.14` | draft_rerun applied 1 refused 0 kept 4; web.inspect.succeeded page unchanged |
| 17 | next decision | tool_call | dom-click; call `confirm.first` | web.action.succeeded effect=true page changed |
| 18 | next decision | amend_draft | dom-extract_list; call `rerun.15` | draft_rerun applied 2 refused 0 kept 4; web.inspect.succeeded page changed |
| 19 | next decision | amend_draft | change not traced (pre-F13) | draft_amended applied 1 refused 1 kept 5 |
| 20 | next decision | amend_draft | change not traced (pre-F13) | draft_unchanged applied 0 refused 1 kept 5 [16:no_such_position:web.output.dom-click] |
| 21 | amendment feedback | amend_draft | change not traced (pre-F13) | draft_unchanged applied 0 refused 1 kept 5 [16:no_such_position:web.output.dom-click] |
| 22 | amendment feedback | complete | complete (claims not traced) | refused bootstrap.instructed_act_missing; dry run: replayed replayed unreproducible replayed failed replayed |
| 23 | refusal feedback: bootstrap.instructed_act_missing | amend_draft | change not traced (pre-F13) | draft_unchanged applied 0 refused 1 kept 5 [16:no_such_position:web.output.dom-click] |
| 24 | amendment feedback | amend_draft | change not traced (pre-F13) | draft_unchanged applied 0 refused 1 kept 5 [16:no_such_position:web.output.dom-click] |
| 25 | amendment feedback | tool_call | dom-click; call `confirm.repeat.25` | web.action.rejected.target_unobserved / handle_not_in_packet effect=false page unchanged |
| 26 | next decision | complete | complete (claims not traced) | refused bootstrap.instructed_act_missing; dry run: replayed replayed unreproducible replayed failed replayed |
| 27 | refusal feedback: bootstrap.instructed_act_missing | complete | complete (claims not traced) | refused bootstrap.instructed_act_missing; dry run: replayed replayed unreproducible replayed failed replayed |
| 28 | refusal feedback: bootstrap.instructed_act_missing | tool_call | dom-click; call `confirm.anchor.28` | web.action.rejected.target_unobserved / handle_not_in_packet effect=false page unchanged |
| 29 | next decision | complete | complete (claims not traced) | refused bootstrap.instructed_act_missing; dry run: replayed replayed unreproducible replayed failed replayed |

- **Which page was listed:** the Friend requests page with all 8 cards (`open.friend-requests` at iteration 3;
  screenshots 00008 07:53:09Z and lane shot `075347-r7-t5` show the page with the card grid). Correct page,
  unlike run 6.
- **A wrong consequential act during exploration:** `confirm.first` (iteration 17, `effectApplied=true`) accepted
  **Tom Becker** (1 mutual friend): screenshot 00008 shows his card as "Request accepted" and the page header dropping
  to "7 friend requests" (lane shot t5). It was the first card, not a qualifying one.
- **Whether `repeat` was stated:** NO EVIDENCE of the change word (pre-F13 trace). Four amendments on step 16
  (the Confirm click, `web.output.dom-click`) were refused `no_such_position` (iterations 20, 21, 23, 24). At run
  time `flow-draft/amendment.ts:228` returned `no_such_position` for a `repeat` whose `over` was at or after the
  step *or* whose `through` was before it, and `:159` for a `reorder` to a missing place, so these may have been
  mis-specified repeats. Two tool calls were *named* as repeats -- `confirm.repeat.25`, `confirm.anchor.28` -- and
  pressed nothing (`handle_not_in_packet`): the model tried to do the repetition by pressing, not by amending.
- **Whether a `where` was stated:** NO EVIDENCE: nine extraction reruns ran with new inputs that the trace does not
  carry, and none returned `conditions_kept_nothing`.
- Repeats, and what the loop believed was progress: 9 extraction reruns (iterations 6, 7, 9, 11-14, 16, 18), each a
  draft change and so progress (`llm/decision-handlers/amendment.ts:95` steps the no-progress count only when nothing
  applied and nothing reran). The four completions each replayed the same draft positions (reset, 2, 3, 4, 16, 17) and
  got the same answer: 3 `unreproducible` (6.7-7.0 s each time), 16 `failed`.
- Rejections and refusals received, and whether each said enough to route around: amendment refusals (from
  `provider-failures.local.json`): `8:already_in_flow`, `14:already_in_flow`, `17:already_in_flow` (extraction steps)
  and `16:no_such_position` x4 -- the last is ambiguous at run time (see above) and did not say which of `over` or
  `through` was wrong, so no, it did not. Completion refusals: `bootstrap.instructed_act_missing` x4; which act and
  which reason: NO EVIDENCE in the trace (F13 added `acts=` / `missing=` after this run); what the model was shown:
  NO EVIDENCE (the refusal feedback entry is not in the bundle). Tool refusals: `target_unobserved /
  handle_not_in_packet` x2 (named a handle it had not been shown).
- Where the context was evicted or truncated, if anywhere: NO EVIDENCE of eviction: `evaluation.json`
  `truncationCount` 0; evidence 170,562 bytes; which entries were superseded is not recorded.
- **Why the build stopped:** the no-progress guard (`AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_STEPS_WITHOUT_PROGRESS`
  = 8, `loop-limits/evidence-loop.ts:85`, applied as `maxConsecutiveUnusableDecisions` by
  `loop-limits/flow-bootstrap-evidence-loop.ts:147`) was reached on the unusable completion at iteration 29:
  `llm/evidence-loop.ts:360` fails, `:367` calls `unusableDecisions.stalled`, which `service.ts:1555` turns into
  `flowBootstrapEvidenceUnusableDecisionFailure` (`flow-bootstrap/generation-failure/evidence-failure.ts:79-93`).
  Reconstruction (the count itself is not in the bundle): the refusal at 22 restarted the count at 1
  (`evidence-loop.ts:358`); 23, 24 (amendments that changed nothing, `decision-handlers/amendment.ts:96`), 25 (a press
  that pressed nothing), 26, 27 (same issues, `evidence-loop.ts:357`), 28, 29 -> 8. Not the call bound (29 of 64).

## Stage 3 — the proposed Flow

- Node list as authored, with each node's real parameters: no Flow was proposed. The last draft (`incompleteDraft`
  revision 1, 5 kept steps at iteration 19) replayed as draft positions 2, 3, 4, 16, 17 after the reset; position 16
  is the Confirm click (`web.output.dom-click`, from the refusal rows). The node at each other position and every
  parameter: NO EVIDENCE (the draft's content is not in the bundle; `answerability` says a record producer and a
  record store were present).
- Divergences from the stage 1 chain, one line each, naming the node:
  - Step 2 (loop over the cards, route on count >= 5): absent; a single Confirm (position 16) pinned to one card.
  - Step 3 (rate-limit retry): never reached.
  - Step 4 (read of accepted cards): NO EVIDENCE whether position 17 is that read.
  - Exploration confirmed Tom Becker (1 mutual), a card the instruction leaves alone.
- For each divergence: the single Confirm -- could not express it (the repeat attempts were refused with an ambiguous
  `no_such_position`, and pressing "repeat" as a tool call pressed nothing); Tom Becker -- misread the grammar
  (explored the act on the first card instead of a qualifying one; nothing told it the exploration press must go on a
  row it would keep).

## Stage 4 — replay

Not reached: no Flow. The dry runs (build-time replays of the draft) are recorded in Stage 2.

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| - | not reached | - | - | - | - |

- Any node that reported success while doing nothing: not reached.
- Provider calls during replay (expected: zero): not reached.

## Stage 5 — the answer

- Records expected vs returned: not reached (no Flow ran; `extraction` null).
- Fields compared, matched, mismatched: not reached.
- Every mismatch, observed value beside expected: not reached.
- If the comparison was count-only, say so: not reached.

## Stage 6 — judgement and repair

- Did the system judge its own result, and what did it conclude: no result to judge.
- If the answer was wrong, did a repair trigger automatically: no (build failure; `recoveredFailures` empty).
- What context did the repair receive: none (no repair).
- Was the repair persisted, and did the re-run use it: no.

## UI review

- Page: correct site, Friend requests page; Tom Becker's card "Request accepted" from 07:53:09Z. At 07:54:20Z (lane
  shot t6) the page is the feed home: the dry run's reset navigation, visible to a person as the page jumping away.
- Side panel: "Building your Flow / Using core.run_node / 19 steps so far" (raw tool id), then "Using core.run_node:
  core.replay.unreproducible / 23 steps so far · 2 failed" (a result code shown to a person); "Add an AI model key: To
  do" throughout a live build. End: "Build failed / Worked for 1m 2s · 28 steps · 4 failed" -- the build loop ran
  142 s and has 39 rows, so the panel's duration and step count both undercount.
- On-page overlay (UI review, 11 moments): absent at moments 1-3 (first seen 07:52:18Z, 13 s into the build), then
  present, "flickering" at moments 7-8 (2 presence toggles each). Texts: "Building your Flow | Using core.run_node"
  (60 samples), "| Deciding the next step" (23), "| Using core.run_node: web.inspect.succeeded" (12), "| Checking the
  proposed result" (11), "| Using core.run_node: core.replay.replayed" (2), "| ...: web.action.succeeded" (1); at the
  end "Build failed | Build failed" (the same words twice).
- Permission requests: none (`permissionRequest` null; confirming is not money, delete or send).

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 1 | Exploration pressed Confirm on the first card (Tom Becker, 1 mutual) before any filtered listing: a wrong consequential act during the build. Nothing requires an exploration press of a plural act to go on a row the instruction selects. | model decision; Core schema text `flow-draft/amendment.ts:107` (F2 wording, since extended post-run: "do the act to one row it kept") | open: the extended wording is guidance only; candidate guard: refuse a consequential exploration press on a row the latest listing's `where` drops | t195, open |
| 2 | The model could not express the loop: four amendments on the Confirm (step 16) refused `no_such_position`, which at run time covered both `repeat` faults and a bad `reorder`; two presses named `confirm.repeat.25` / `confirm.anchor.28` pressed nothing. | Core `flow-draft/amendment.ts:228` (run time) | F16 (`over_not_before` split, `amendment.ts:231-232` now) and F15 (`llm/harness-options/repeat-suggestion.ts`, the amendment written out), both after this run | t195 F15, F16 |
| 3 | Four completion refusals `bootstrap.instructed_act_missing` with no act or reason in the trace, so neither the lead nor this debug can say what was claimed. | Core `llm/evidence-loop/progress-trace.ts` | F13 (`amend=`, `acts=`, `missing=`), after this run | t195 F13 (done) |
| 4 | Each refused completion was dry-run anyway, over the same draft, with the same result (position 3 `unreproducible` in 6.7-7.0 s; position 16, the pinned Confirm, `failed` once its card was accepted): 4 x ~14.5 s = 58 s of a 142 s build. | Core `llm/evidence-loop/completion-attempt.ts:61` (the dry run runs whatever the check at `:47-49` said; codes merged at `:68`), `flow-draft/dry-run.ts` | open: skip the dry run when the act check already refused and the draft is unchanged since the last dry run | t195, open |
| 5 | The build ended on the no-progress guard (8) at an unusable completion, reported as `evidence_unusable_decision`, after 29 of 64 calls. | Core `llm/evidence-loop.ts:357-367`, `service.ts:1555` | working as designed once 2-4 are fixed | - |
| 6 | The Lab ran against an extension build older than its source (`stale-allowed`). | lane launcher `live-run-d.sh` (`FLUXIQ_LAB_ALLOW_STALE_BUILD=1`) | lane decision; the extraction reader under it (`field-reader.ts`) was one minute newer | t195 lead |
| 7 | Side panel and overlay show raw tool ids and result codes ("core.run_node", "core.replay.unreproducible"), "Add an AI model key: To do" during a live build, a duplicated "Build failed \| Build failed", and a duration/step count that undercount (62 s / 28 vs 142 s / 39). | downstream extension panel and overlay | open | t191 |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | What each of the 16 amendments changed (change words, `over` / `through`) | Core `llm/evidence-loop/progress-trace.ts` (fixed by F13 after this run) |
| 2 | Which act each completion claimed and why it was refused | same (F13) |
| 2 | Refusal reasons `already_in_flow` (iterations 8, 15, 19) reached only `provider-failures.local.json`; flow-lane rows show `refusedCount 1` and no reason | downstream `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts:51` (allow-list lacked `did_not_work`, `already_in_flow`, `already_out`) with `:206` / `:218` dropping the whole list on one unlisted reason; fixed in the working tree, uncommitted |
| 2 | The no-progress count at each decision (reconstructed above, not recorded) | Core `llm/evidence-loop.ts` trace rows |
| 2 | What refusal feedback the model was shown | Core evidence entries are not published |
| 3 | The draft's steps and parameters at each completion | Core `flow-bootstrap/incomplete-draft/` keeps only a pointer in the bundle |
