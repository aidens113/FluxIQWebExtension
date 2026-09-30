# Run debug — `run-munu4b4y-4e15662e` (live run 22)

Worker t174-w20, 2026-09-30. Read from the bundle at
`test-runs/instances/t174-slot-1/run-munu4b4y-4e15662e`, its UI review
(`test-runs/instances/t174-slot-1/run-munu4b4y-4e15662e.ui-review.local.json` and the PNG folder
`run-munu4b4y-4e15662e.ui-review.local/`), the bundle's whole-window JPGs (`screenshots/`), and the
launcher's full Lab stdout (`live-run-22.full.log`, in the supervisor's scratchpad, not in the
repository). The scenario source under `apps/scenario-lab/src/scenarios/company-website/`, the extension's
in-page defence under `apps/extension/src/content/action-runtime/{recovery,interference}/`, the domain's
node run under `domain/src/runtime/llm-evidence/node-run/`, and Core's draft, dry run, routing and executor
under the t174 Core tree's `packages/fluxiq/src/programs/automation-studio/runtime/` were read, not
changed. No product code changed. Privacy: only codes, counts, ids, node ids, durations, timestamps and
FluxIQ's own UI strings. Pages, dialogs and controls are named by kind. The debug quotes no instruction
text, page text, accessible names, typed values or provider bodies. Model-authored call ids are not
quoted because they carry control words (cause 9).

**Two corrections to the brief.** (1) Playback did not fail three different clicks. It failed **one
node, `main.s2`, three times**: node attempts 1, 2 and 3, the last two on the `retry_node` rung
(`maxAttempts: 3`). (2) The Flow has **9 nodes, 8 of them actions**. The ninth, `s3`, is a
`builtin.control.merge`.

---

## Header

- Run id: `run-munu4b4y-4e15662e`
- Scenario / variant / task: `company-website` / none / `company-website-quote-request` (`form`,
  judged by playback goal `quote-request-received`). The instruction is 374 characters, sha256
  `579ed5af…b3d06e7c` (`snapshots/flow-lane.json` `task`).
- Repositories (`run.json`): facility `76e5e76` (dirty) and Core `e75dcf2` (clean), both the t174 tree
  on the round-1 merged build. Chromium 134.0.6998.35, 1280×720, seed 4519. Ports: scenario 62501,
  web 62502, gateway 62503. All 7 prelude build steps were `reused` from their stamps (full log,
  prelude total 23,229 ms).
- Lab span 08:19:51.802Z to 08:24:10.732Z (`summary.json`), `durationMs: 258227`
  (`evaluation.json`).
- Provider, model: DeepSeek `deepseek-flash`, profile `production`. Authorized: `maxCalls: 64`,
  48k in / 8k out / 56k per call, 25 s, $0.25 per call, $2 total.
- Calls, cost:
  - Build: **21 calls** (20 loop decisions + 1 unrecorded call), 247,115 in / 2,042 out tokens,
    **$0.03696**, `budgetBreaches: 0`. The largest recorded call had 13,718 input tokens
    (decision 19).
  - Repair: **12 calls**: `runtime_diagnosis` gather (5,203 in / 422 out), `runtime_diagnosis` plan
    (20,402 / 481), and 10 `evidence_tool_decision` exploration calls. Totals 156,397 / 2,003,
    **$0.02155**, all charged as `reported`.
  - Result check: none (`verification.source: absent`). `evaluation.json` `llm.calls: 33`.
- Verdict: failed, `runtime.behavior`. The Flow reported `target_not_found` /
  **`web.target.not_found`**, stage `target_resolution` (`events.ndjson` seq 18).
- **Stage reached: 6.** A Flow was created and ran. Node 1 succeeded, node 2 failed 3 times, and
  nodes 3–9 never ran. Recovery diagnosed and explored, then refused `llm.runtime_patch_goal_unachievable`.

## Timeline

| Time (UTC) | Event | Source |
| --- | --- | --- |
| 08:19:51.802 | Lab start | `summary.json` |
| 08:20:19.535 | Dispatch (`runtime.dispatch`) | `events.ndjson` seq 1 |
| 08:20:35.576 | Build loop start; Core's initial call refused `not_at_start_location` | `logs/core.log` |
| 08:20:39.620 | Consent wall still up after the navigate (picture 03) | UI review #3 |
| 08:20:41.691–08:20:46.824 | **d4, a click on a button, `web.action.rejected.target_not_found` in 5133 ms. Consent is answered during it** (see Stage 2) | `logs/core.log`, `flow-lane.json` step it3 |
| 08:20:48.070–08:20:49.715 | d5, the newsletter offer's decline control, succeeded (becomes **s2**) | `logs/core.log` |
| 08:21:05.717–08:21:08.449 | d11, the drawer's next-step button, `target_not_actionable` | `logs/core.log` |
| 08:21:18.134 | Completion #1, check ok | `logs/core.log` |
| 08:21:18.172–08:21:31.796 | Dry run 1 (13.6 s): **d5 `core.replay.unreproducible` (6156 ms)**, the rest replayed → `llm_evidence_loop.dry_run_refused` | `logs/core.log` |
| 08:21:34.434 / 08:21:35.514 | Amendments 17 (d5, d11, d15, d16: applied 1, refused 3) and 18 (d5: refused `already_so`) | `flow-lane.json` |
| 08:21:37.190–08:21:40.676 | d17, the step declared `send_or_publish`, succeeded (becomes s9) | `logs/core.log`, `live-llm.json` |
| 08:21:42.336 | Completion #2, check ok | `logs/core.log` |
| 08:21:42.353–08:21:58.058 | Dry run 2 (15.7 s): **d5 unreproducible (6148 ms)**, the rest replayed → **accepted** | `logs/core.log` |
| 08:22:09.406 | Build settle | `events.ndjson` seq 9 |
| 08:22:43.402 | Runtime run `d650494e-566a-4f5f-9422-0c4038a64c3d` starts | `decision-trace.json` |
| 08:22:50.668 | `main.s1` navigate (2192 ms, succeeded) | `flow-lane.json` `actions[0]` |
| 08:22:54.028 / 08:22:59.590 / 08:23:05.738 | `main.s2` attempts 1–3, each `web.target.not_found` (4236, 4072, 4143 ms) | `flow-lane.json` `actions[1..3]` |
| 08:23:11.019 | Runtime run ends `failed` | `decision-trace.json` |
| 08:23:13.441–08:23:54.039 | Recovery (40.6 s): diagnosis, plan, exploration (9 actions), refusal | `decision-trace.json` `recoveryState`, `logs/core.log` |
| 08:23:55.351 | Repair settle | `events.ndjson` seq 17 |
| 08:23:55.581 | Error event | `events.ndjson` seq 18 |
| 08:23:58.808 | Final capture | `events.ndjson` seq 19 |

Build loop: 82.5 s from loop start to the end of dry run 2. `build.durationMs: 93138`.

## Stage 1 — the instruction and the expected chain

- Instruction text withheld. Core read **1 instructed consequence**, `send_or_publish` (send a quote
  request).
- A correct Flow, derived from the scenario source (`client/shell-script.ts`,
  `pages/quote-drawer.ts`, `client/quote-script.ts`, `manifest.ts` `playbackGoal`):
  1. Open the home page. A fresh visitor meets a **consent wall** that covers the whole viewport
     (`pages/shell.ts:105-108`, `position:fixed; inset:0`).
  2. Answer the consent wall.
  3. **Dismiss the newsletter offer if it opens.** The offer is a modal that opens **4 s after consent
     is answered**, once per visitor, until someone dismisses it (`client/shell-script.ts:11`, `:46`,
     `:50-53`, `:141`; `pages/shell.ts:39`). This step is conditional by nature.
  4. Open the quote drawer.
  5. Fill step 1's four fields.
  6. **Close the chat greeting card.** It opens 1.8 s after every page load in the bottom-right corner
     (`client/shell-script.ts:13`, `:92`), and the drawer's footer next-step button sits exactly under
     it (`pages/quote-drawer.ts:30`, the file's own comment).
  7. Go on to step 2. Choose the service from a list built of `div`s, enter the details, and set the
     contact preference (it starts on another value). Then go to the next step.
  8. On step 3, set the marketing box (it starts ticked) and tick privacy.
  9. Send, then pass the human check (`client/quote-script.ts:70-87`).
  10. Reach the confirmation page.

## Stage 2 — exploration (the build)

Draft ids `dN` number the loop's recorded tool calls in order, with Core's initial call as `d1`. The
numbering checks against both dry runs: dry run 1 replays d2 and d5–d10, and dry run 2 replays d2,
d5–d10 and d17.

| It | Decision | Node | Result / draft effect |
| --- | --- | --- | --- |
| 0 | (Core's initial) | snapshot | `web.action.rejected.not_at_start_location` (d1) |
| 1 | tool_call | `browser-navigate` | succeeded (d2 = **s1**) |
| 2 | tool_call | `dom-click` | `web.action.rejected.target_unobserved` / `target_not_a_handle` in 73 ms (d3) |
| **3** | tool_call | `dom-click` (a button) | **`web.action.rejected.target_not_found` in 5133 ms (d4)**, `pageState: changed`, `effectApplied: false`. **Consent is answered during this call** (below) |
| 4 | tool_call | `dom-click` (a span) | succeeded in 1645 ms (d5 = **s2**, the newsletter offer's decline control) |
| 5 | tool_call | `dom-click` | succeeded (d6 = **s4**, the quote opener button; opens the drawer) |
| 6–9 | tool_call ×4 | `dom-type` | succeeded (d7–d10 = **s5–s8**, drawer step 1's four fields; values withheld) |
| **10** | tool_call | `dom-click` | **`web.action.rejected.target_not_actionable` in 2732 ms (d11)**: the drawer's next-step button, under the chat greeting card |
| 11–12 | tool_call ×2 | snapshot | `web.inspect.succeeded` (d12, d13) |
| 13 | tool_call | – | `llm_evidence_loop.already_answered` (d14, no tool ran) |
| 14 | tool_call | `dom-click` | `target_unobserved` / `handle_not_in_packet` in 95 ms (d15) |
| 15 | amend_draft | – | rerun d11 (applied 1) → `target_unobserved` / `answered_the_same_again` (d16) |
| **16** | **complete #1** | – | check ok. Dry run 1: reset, d2 replayed, **d5 `core.replay.unreproducible` (6156 ms)**, d6–d10 replayed → **`llm_evidence_loop.dry_run_refused`** |
| 17 | amend_draft | – | targeted d5, d11, d15, d16: **applied 1** (d5), refused 3 |
| 18 | amend_draft | – | targeted d5: refused **`already_so`** (the same statement again) |
| 19 | tool_call | `dom-click` | succeeded in 3486 ms (d17 = **s9**, a button with the quote opener's accessible name, declared `send_or_publish`) |
| **20** | **complete #2** | – | check ok. Dry run 2: reset, d2, **d5 unreproducible (6148 ms)**, d6–d10, d17 replayed → **accepted** |

Totals: 20 decisions = 15 tool_call + 3 amend_draft + 2 complete. There were 17 recorded calls
(`toolCallCount: 17`): 8 `dom-click` (3 succeeded, 5 refused), 4 `dom-type` (all succeeded),
1 `browser-navigate`, 3 snapshots (2 ok, Core's initial refused) and 1 `already_answered`.

- **Consent was answered inside d4, a call reported as refused.** Picture `03-mid-build-scenario.png`
  (08:20:39.6) shows the consent wall up. Between it and d5 the only calls are d3 (73 ms, refused
  before dispatch) and d4 (08:20:41.691–46.824). d5 pressed the newsletter offer's decline at
  08:20:48.07–49.72, and the offer opens only 4 s after consent is answered
  (`client/shell-script.ts:46`, `:53`). So consent was answered in the first part of d4. Core recorded
  `pageState: changed` for that iteration. The domain nevertheless reported d4 as
  `effectApplied: false` and not replayable (cause 1).
  Which in-page mechanism answered it is **not recorded**. It was either d4's own click on a consent
  control, or the interference defence pressing the wall's decline control after a blocked click (t195
  F1), leaving d4's target gone (`target_absent` to the end of its in-page budget). The 5133 ms
  duration matches the second; the extension's recovery account for d4 is not exported (gap).
- **Where time went without progress.** The two dry runs took 29.3 s of the 82.5 s loop, and d5's
  `unreproducible` cost 6.15 s in each. Three calls went to the covered next-step button (d11, d15, d16),
  and two snapshots plus one `already_answered` added nothing.
- **Draft size**: 1,359 → 3,912 of 4,000 bytes (it15); 3,856 at completion #2.
  `instructionBytes` stayed at 1,019.

## Stage 3 — the proposed Flow

- Adaptation `adaptation.bootstrap.711dc333-7477-4ec7-9435-d16b45f67469` was `proposed`, then `applied`
  (`decision-trace.json`). Flow `flow.e9040d05-cf36-440e-a37e-570948dab47d`,
  `appliedMutationCount: 2`. Route: subflow `subflow.bootstrap.6807300d697cdf44.main` (fallback, no
  rule, `stateObserved: false`).
- Shape: **9 nodes, 8 action nodes**: 1 `web.browser.navigate`, 3 `web.dom.click`, 4 `web.dom.type`,
  and 1 `builtin.control.merge`. No extract node. Nodes
  `node.bootstrap.6807300d697cdf44.main.s1`…`s9`. Parameters are withheld (selectors, URL, typed
  text).

| Node | Definition id | Control (by kind) | From | Target shape |
| --- | --- | --- | --- | --- |
| s1 | `web.output.browser-navigate` | home page | d2 | URL (withheld) |
| s2 | `web.output.dom-click` | **newsletter offer's decline control** (a `span` styled as a link) | d5 | `element.{tagName: span, visibleText}` + a structural selector (withheld in `authoredNodes`; see below) + a fingerprint |
| s3 | `builtin.control.merge` | – | – | the join Core derives after a routed step (`authoring/draft-routing.ts:111-128`) |
| s4 | `web.output.dom-click` | quote opener button | d6 | `element.{tagName: button, accessibleName}` + selector |
| s5–s8 | `web.output.dom-type` | drawer step 1's four text inputs | d7–d10 | `element.{tagName: input, accessibleName, context.formId}` + selector; text withheld |
| s9 | `web.output.dom-click` | a button with **the same accessible name as s4** | d17 | `element.{tagName: button, accessibleName}` + selector + `expectedState` (one `text` condition, `mode: any`) |

- **s2's target is bound to the build's layers.** Its structural selector, visible in
  `failure.expected`, runs `body` → third `div` child → `div` → third `p` → `span`. On the build's page
  the third `div` under `body` was the offer's scrim: the page wrapper came first, the chat host second
  (`client/shell-script.ts:88`), and the offer was appended third (`:68`), with the consent host
  already removed. On a fresh visitor's page, the consent host is the second `div` and the chat host
  the third. Even an open offer would then be the fourth.
- **s3 is a join**, so d5 carried a routing statement. Amendment 17 applied exactly one change (d5), and
  18 was refused `already_so` for d5. Whether that statement was `optional` or `only_if` is not recorded
  (no `amend=` field in this build's trace; the edges are not in the bundle).
- **What the Flow lacks:**
  - an answer to the consent wall, which the build did inside the refused d4 (cause 1);
  - a close of the chat greeting card, and both next-step presses;
  - all of step 2 (service, details, contact preference) and step 3 (marketing box, privacy);
  - the send and the human check.
  - s9 presses a button named like the drawer's opener and sends nothing, but it is declared
    `send_or_publish`. The consequence cross-check reads `agreed` (declared `[send_or_publish]`,
    `declaredNothing: 39` of 42) because it compares declarations, not effects (cause 6).

## Stage 4 — playback

Runtime run `d650494e-566a-4f5f-9422-0c4038a64c3d`, 08:22:43.402Z to 08:23:11.019Z.

| Attempt | Node | Started | ms | Status | Resolution |
| --- | --- | --- | --- | --- | --- |
| 0 | `main.s1` navigate | 08:22:50.668Z | 2192 | succeeded, `matched` | – |
| 1 | `main.s2` click | 08:22:54.028Z | 4236 | **failed `web.target.not_found`** (`target_not_found`, stage `target_resolution`, retryable) | extension `unresolved_no_candidates` (0); host `fingerprint` (0) |
| 2 | `main.s2` click | 08:22:59.590Z | 4072 | failed, same | retry 2 of 3, backoff 250 ms, rung `retry_node` |
| 3 | `main.s2` click | 08:23:05.738Z | 4143 | failed, same | retry 3 of 3, backoff 1000 ms, rung `retry_node` |

- Each attempt's in-page account is `target_absent` absorbed 5 times, 3750 ms waited, with "0
  control(s) of the same family are on the page". The offer was not in the page at all, so this was
  not a selector that missed a present element.
- **The page throughout:** the home page with the **consent wall up** and the chat greeting card
  bottom-right. No newsletter offer and no drawer (`09-flow-run-scenario.png` 08:22:37.9,
  `10-flow-run-scenario.png` 08:22:57.7, `11-flow-run-scenario.png` 08:23:17.7,
  `screenshots/00013-4b3d4b639b1f.jpg` 08:23:05.4).
- Evidence packets: 8, 5,781–5,902 bytes, all truncated (budget invariant passed). Nodes s3–s9 never
  ran.

## Root cause of the not-found clicks

**s2's target does not exist on a fresh visitor's page until consent is answered. The Flow does not
answer consent, because the build answered it inside a step reported as refused, and a refused step
cannot be part of a Flow.**

1. **What s2 needs.** The newsletter offer, and so its decline control, is created only by
   `openNewsletter()`. It is scheduled only when consent is answered (`client/shell-script.ts:46`), or
   at load when consent is already answered (`:30`, `:141`). It runs 4 s later (`:11`, `:53`), and
   only while the visitor has not dismissed it (`pages/shell.ts:39`, `state.ts:39`). A fresh visitor
   starts with `consent: "pending"` and the offer not dismissed (`state.ts:8-9`).
2. **Why the Flow has no consent step.** In the build, consent was answered during d4. d4 ended
   `web.action.rejected.target_not_found`. The domain reports every refusal as
   `effectApplied: false` and `replay: undefined`, whatever the attempt did to the page
   (`domain/src/runtime/llm-evidence/node-run/run.ts:485`, the `toolExecution(…, false, …)` in
   `refusal()`, `:465-500`). Its own comment at `:481-482` says "a command that failed may still have
   moved something". Core's draft admits only steps with `effectApplied !== false`
   (Core `runtime/flow-draft/step.ts:186`). So the page change Core observed (`pageState: changed`,
   iteration 3) reached neither the draft nor the Flow. d5, which depends on it, did.
3. **Why playback could not recover it.** On a fresh visitor, s2's click finds no target:
   `target_absent`. The in-page defence clears layers only for `blocking_dialog` and
   `obstructed_target` (`apps/extension/src/content/action-runtime/recovery/fault.ts:176-178`), so it
   never pressed the consent wall's decline control (t195 F1), the offer never opened, and all 3 × 5
   attempts found nothing.
4. **Whether the dry run passed these clicks.** **No.** d5 was `core.replay.unreproducible` in both dry
   runs (6156 and 6148 ms). Dry run 1 was refused for it. Dry run 2 was accepted with it still
   failing, because an `unreproducible` step already put to the model no longer blocks, and a step
   marked conditional never blocks (Core `runtime/flow-draft/dry-run.ts:164-165`, `:181-182`).
   **Why the dry run and playback differ:** the dry run's reset kept the build's scenario state, with
   consent answered and the offer dismissed. `05-mid-build-scenario.png` (08:21:19.6, just after dry
   run 1's reset) shows the home page with no consent wall, and d6 replayed in 934 ms with nothing in
   its way. So in the dry run the offer could not reopen (d5 unreproducible) and the later steps met no
   wall. Playback started as a fresh visitor with the wall up (`09-flow-run-scenario.png`), where the
   offer can only appear after an answer the Flow does not contain. The dry run therefore proved
   s4–s9 against a state playback never has, and it tolerated s2 rather than proving it.
5. **Why the run stopped at s2 instead of taking s2's `failed` route.** This is read from source and
   was not traced live; whether s2's routing was `optional` is not recorded. If it was `optional`,
   `draft-routing.ts:111-114` gives s2 a `failed` edge into the merge s3. The executor follows that
   edge after the ladder only when the ladder selects it as `deterministic_path`
   (`executor/graph-run.ts:608`). The ladder offers it only while `maxRecoveryAttemptsPerSubflow` is
   not spent (`executor/recovery-ladder.ts:82`), and that budget counts every earlier attempt carrying
   a `recoveryDecision` (`executor/recovery-budget.ts:12`). `graph-run.ts:580` stamps one on every
   failed attempt, including the node's own retries. The budget defaults to 2 (`model/flows.ts:258`),
   and the same object's `maxRetriesPerAction: 2` is what gave `maxAttempts: 3` here
   (`executor/retry-policy.ts:13-16`). So by s2's third attempt its own two retries had spent the
   budget. `deterministic_path` was withdrawn, the continuation rule stopped the run because a click
   mutates (`executor/defensive/continuation.ts:109`), and `optional` never reaches the node's
   metadata that `continuation.ts:97` reads. The file's own comment at `recovery-budget.ts:7-10` says
   a retried attempt must not spend the subflow and reroute budgets, but only `failedAttemptsForAction`
   (`:11`) filters `!attempt.retry`.

**Owning file and line:** `domain/src/runtime/llm-evidence/node-run/run.ts:485`. A refusal is reported
`effectApplied: false` with no replay even when the attempt changed the page, so a precondition the
build established (the consent answer) is lost, and a Flow is built whose s2 depends on it.
Contributing: `apps/extension/src/content/action-runtime/recovery/fault.ts:176-178` (no layer clearing
on `target_absent`), Core `runtime/executor/recovery-budget.ts:12` (a node's retries withdraw its own
authored failed route), and the dry run's state-keeping reset (cause 4).

**Proposed fix (not implemented):**
- **A (domain, the owner).** When a refused attempt's in-page account shows it cleared a layer
  (`dismissed > 0`), or when the page state changed across a refused call, return the clearing as its
  own proposable, replayable draft statement. That would be a click on the layer's way-out control,
  resolved against the layer, marked conditional (`optional`) so a Flow on a visitor without the wall
  carries on. Alternatively, return `effectApplied: true` with a replay for the part that happened. Then
  the build's Flow would carry "answer the consent wall if present" before s2.
- **B (extension, t195's area).** On `target_absent`, when a blocking layer covers the viewport probes,
  let the defence press that layer's allow-listed way out (the same decline-first rule as F1) once
  before the next re-resolution. A target that can only appear behind or after such a wall then gets
  its chance. With B alone, playback's s2 would have declined consent on attempt 1, and the offer would
  have opened in time for attempt 2 or 3.
- **C (Core, t195's routing area).** In `recovery-budget.ts:12`, exclude attempts with `retry` (or
  attempts of the same node) from `recoveryAttemptsForSubflow`, as the comment at `:7-10` already
  promises. Also stamp `optional: true` on the node in `draft-routing.ts:113`, so `continuation.ts:97`
  carries on even when the ladder does not select the edge. Either change makes an optional s2 skip
  rather than end the run.
- **D (Core, t174).** Make the dry-run reset start from a fresh visitor (cause 4), so a missing
  precondition shows as `failed` before acceptance.
- None of A–D makes this Flow pass the goal: see causes 5 and 6.

## Harness interventions

- **Scenario reset between build and playback.** The build left consent answered and the offer
  dismissed. Playback began with the wall up (pictures 09–11), so the scenario state was back at the
  seeded visitor. Where the Lab does this was not read. The dry-run resets did not do it (picture 05).
- **Applying the Flow.** No question was put to the person: the cross-check verdict was `agreed` and
  `permissionRequest: null`, and the Lab applied the adaptation (`appliedMutationCount: 2`).
- **Send without asking.** The build pressed d17, which it declared `send_or_publish`, with no permission
  request, because the instruction asked for a send. t195's F10 (ask for every send, even an instructed
  one) is **not in this Core tree**: its sentence appears nowhere under the t174 Core `src/`, and it
  appears in the t195 Core `runtime/action-permissions/request.ts`. The press sent nothing (cause 6).
- **Harness activations: 2** (`evaluation.json`): the two `diagnosis` interventions below.

## Stage 5 — the answer

Not reached. No result check ran (`resultVerification: null`); `oracles.finalState: failed`,
`records: not_declared`.

## Stage 6 — recovery

`harnessRecovery`, `live-llm.json` `repair` and `decision-trace.json` `recoveryTrace`. Recovery ran
08:23:13.441Z to 08:23:54.039Z (40.6 s).

| # | Intervention | Provider call | Outcome |
| --- | --- | --- | --- |
| 1 | `diagnosis` | none | `validationOk: false`, **`recovery.ladder_diagnosis_unanswered`** |
| 2 | `diagnosis` | `llm.runtime_diagnosis.e3887f1b…` (gather), 5,203 in / 422 out | ok. `failureClass: target_not_found`, `candidateKind: action_target_override`, `resolution: model_required`, **`requiredPriorAction: none`**, **`stillAchievable: no`**, `deterministicRecoveryPossible: unknown`, confidence 0.6 |
| – | `recovery_plan` | `llm.runtime_diagnosis.c1ff5891…` (plan), 20,402 / 481 | `steps: [explore]`, `allowedPatchKinds: [temporary_target_override, temporary_wait_retry]`, replanned, `replanChangedDecision: false` |
| – | exploration | 10 `evidence_tool_decision` calls | `evidence_gathered`, 9 actions (all observed, 0 refused), 52,665 evidence bytes, 31,349 ms |
| – | resolution | none | **skipped `llm.runtime_patch_goal_unachievable`** (rung `exploration`). No adaptation, no change proposal, `patchAttemptCount: 0` |

- **What the exploration did** (`logs/core.log`, 08:23:19.414–08:23:50.762; controls by kind):
  1. `web.recovery.inspect`.
  2. A press on the consent wall's decline control: **`target_not_found` in 5207 ms, yet consent was
     answered.** The offer's decline succeeded at 08:23:26.99–28.77, which needs consent answered at
     least 4 s earlier. This is the d4 pattern again.
  3. A press on the offer's decline: succeeded.
  4. A press on the quote opener: succeeded.
  5. Four `web.recovery.enter_field`: succeeded.
  6. A press on the next-step button: **`target_not_actionable` in 2816 ms**, under the chat greeting card, as in
     the build.
  7. `amend_draft`, then `complete`.

  The exploration found the missing precondition by itself and then hit the same wall as the build.
- The diagnosis said `requiredPriorAction: none` for a failure whose fix is exactly a prior action
  (answer the consent wall), and `stillAchievable: no` before exploring. Neither permitted patch kind
  can add a step.
- **Context sent:** `failure`, `expected_transition`, `actual_transition` and **`flow_graph`** (one more
  than run 20). Omitted for `byte_budget`: `step_parameters`, `state_diff`, `failed_target`,
  `recovery_candidates`, `recovered_failures`, `subflow`, `route_context`, `recent_nodes`. t194's F4 is
  not in this tree: `runtime/recovery/context-budget/` is absent from the t174 Core.

## Causes

| # | Cause, precisely | Repo and file | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | **A refused step's real page change is dropped, and the Flow keeps a step that depends on it.** d4 answered the consent wall and was reported `target_not_found`. The domain reports every refusal `effectApplied: false`, `replay: undefined`, and Core admits no such step, so the Flow has no consent answer while s2 (the offer's decline) needs one. **The root cause of the not-found clicks.** | domain `runtime/llm-evidence/node-run/run.ts:465-500` (`:485`); Core `runtime/flow-draft/step.ts:186` | none in t193–t195; nearest **t174** (lane owns the create-and-run loop) | Open (new) |
| 2 | **The in-page defence never clears a covering wall when the target is absent.** It intervenes only on `blocking_dialog` / `obstructed_target`, so in playback nothing declined consent, and the offer s2 needs never opened. | extension `apps/extension/src/content/action-runtime/recovery/fault.ts:176-178` | **t195** (owns `interference/`, F1 decline-first) | Open (new) |
| 3 | **A node's own retries withdraw its authored failed route.** `recoveryAttemptsForSubflow` counts retried attempts, since each carries a `recoveryDecision` stamped at `graph-run.ts:580`. With the default of 2, the third attempt loses `deterministic_path`, and the run stops on the continuation rule for a mutating click. `optional` is not stamped on the node, so `continuation.ts:97` cannot see it. Applies if s2 was `optional` (not recorded). | Core `runtime/executor/recovery-budget.ts:12` (comment `:7-10`), `recovery-ladder.ts:82`, `graph-run.ts:608-629`, `defensive/continuation.ts:97,109`, `flow-bootstrap/authoring/draft-routing.ts:113`, `model/flows.ts:258` | **t195** (routing and retry) | Open (new). Read from source, not traced |
| 4 | **The dry-run reset keeps scenario state** (consent answered, offer dismissed: picture 05), so d5 was `unreproducible` in both dry runs and was tolerated. s4–s9 were proven against a state playback never starts from. Run 20 cause 3; t193 cause D. | Core `runtime/flow-draft/dry-run.ts` (verdict `:155-183`); domain `runtime/llm-evidence/node-run/replay.ts` — NOT READ | **t174** | Open, repeats |
| 5 | **The drawer's next-step button is under the chat greeting card** (bottom-right, about x 924–1264, y 552–704). The build's d11, d15 and d16 were refused, and recovery's next-step press too. The defence's seven probes miss the corner. Run 20 cause 1, a different corner layer on another scenario. | extension `interference/overlays.ts:50` (`PROBE_FRACTIONS`), `:85`; scenario `pages/quote-drawer.ts:30` | nearest **t195** (as run 20 cause 1) | Open, repeats. Inferred from source and pictures 04, 08, 12 |
| 6 | **Accepted with the instructed act unmet.** s9 presses a button named like the opener, declared `send_or_publish`, and sends nothing. Steps 2–3, the send and the human check are absent. Both completion checks passed and the cross-check said `agreed` on a declaration. | Core `runtime/flow-bootstrap/instructed-acts/check.ts` (t195's note: `:74-87`) | **t174** (t195's "owned elsewhere" list) | Open, repeats |
| 7 | **Recovery found the fix and could not apply it**: diagnosis 1 unanswered with no call; diagnosis 2 said `requiredPriorAction: none`, `stillAchievable: no`; exploration answered consent and passed the offer, then stopped at the covered next-step button; the patch kinds cannot add a step; refused `goal_unachievable`. Run 20 cause 7 pattern. | Core recovery ladder, `runtime_diagnosis` | **t193** (self-repair) | Open, repeats |
| 8 | **Diagnosis context lost the failed target and the step parameters** for `byte_budget`. t194's F4 is not in this tree. | Core `runtime/recovery/{context.ts, context-summary.ts}`; F4 in `fxwork/t194/!FluxIQ/…/runtime/recovery/context-budget/` | **t194** (F4) | Fixed in t194, **not in this tree** |
| 9 | **Privacy in the bundle and trace.** `flow-lane.json` and `live-llm.json` carry an instruction excerpt verbatim (`build.instructedConsequences[].quote`). `flow-lane.json` `authoredNodes[].parameters.element` carries page strings (visible text, accessible names). `failure.expected` carries the selector that `authoredNodes` withholds. `logs/core.log` call ids are model-authored and name controls. The redaction attestation passed (it screens secrets, not these). | Lab flow-lane export; Core `runtime/llm/evidence-loop/progress-trace.ts` (`callId=`) | **t174** (run 20 cause 10) | Open, repeats and widens |
| 10 | **Send gate**: the build pressed a step it declared `send_or_publish` with no permission request, because it was instructed. The agreed rule is to ask every time. | Core `runtime/action-permissions/{gate.ts, request.ts}` | **t195** (F10) | Fixed in t195, **not in this tree** |
| 11 | Decision efficiency: 29.3 s of 82.5 s in dry runs; d5 `unreproducible` 6.15 s ×2; 3 calls on a covered control (d11, d15, d16); 2 snapshots and 1 `already_answered` with no progress. | Core `runtime/llm/evidence-loop.ts` | t174 (run 18 cause 10) | Open |

Positive, for the record:
- The build stopped short of the send: nothing was sent (`quotes` untouched; no confirmation page).
- The repair's cost is `reported`, not reserved.
- The diagnosis kept `flow_graph`.
- The failure overlay now stays on screen (see UI review).

## Instrumentation gaps

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2 | What d3 and d4 targeted, and d4's in-page account (absorbed faults, `dismissed` count): whether the click or the defence answered consent | `flow-lane.json` steps carry `resultCode` / `resultReason` only; the extension's recovery account for build calls is not exported |
| 2 | Which routing amendment 17 gave d5 (`optional` or `only_if`) | no `amend=` field in `logs/core.log` (t195's F13 format is not in this build) |
| 3 | The Flow's edges, the merge's inputs, and node metadata (`optional`, `onFailure`) | the bundle exports `authoredNodes` without edges or metadata |
| 3 | What the dry-run reset restores (cookies, server state, consent) | no field in the dry-run trace; inferred from picture 05 and replay codes |
| 4 | Each attempt's `recoveryDecision` (candidates, selected kind, `budgetExhausted` message) and the run's stop message | not in `flow-lane.json` `actions[]` or `decision-trace.json`; cause 3 cannot be confirmed from the bundle |
| 4 | Where the Lab resets the scenario to a fresh visitor before playback | not read; no event marks it |
| 6 | The controls the exploration pressed, except through model-authored call ids | `recoveryTrace` has counts only; `toolDetail: not-published` |
| UI | The whole-window JPGs (`screenshots/00013-*.jpg`) show the side panel covering the right part of the emulated page: the consent wall's buttons and the greeting card are behind it | Lab viewport emulation versus the window's page width (run 20 gap) |
| UI | Why the overlay was absent at moment 8 (08:22:19.7), between build settle and "Flow ready" (08:22:37.9) | not traced |
| 1 | `activeTabUrl` (t185 row 1) | not recorded |

## UI review

Source: `run-munu4b4y-4e15662e.ui-review.local.json`. It has 13 moments, 13 scenario and 13 panel
pictures, `skipped: []`, `skippedTicks: 0` and `failures: []`. The panel is `side-panel (devtools
target, type page)`, `masked: 0` at every moment. The scenario tab was `inFront: true` and the only
entry in `frontTabs` at all 13. Overlay samples: 16 per moment, about 200 ms apart, over about 3 s.

### Screenshots opened (Read tool)

| PNG / JPG | What it shows |
| --- | --- |
| `run-munu4b4y-4e15662e.ui-review.local/01-start-scenario.png` | Home page with the **consent wall** across the bottom and the page dimmed; the chat pill bottom-right. No overlay (correct: before Core's first event). |
| `run-munu4b4y-4e15662e.ui-review.local/03-mid-build-scenario.png` | 08:20:39.6, after the navigate: consent wall still up, **chat greeting card** open bottom-right; overlay bottom-left "Building your Flow / Using core.run_node: web.action.succeeded". |
| `run-munu4b4y-4e15662e.ui-review.local/04-mid-build-scenario.png` | 08:20:59.6: consent gone, the **quote drawer open on step 1** with two fields filled; the greeting card covers the drawer's footer (where the next-step button is). Overlay "Deciding the next step". |
| `run-munu4b4y-4e15662e.ui-review.local/04-mid-build-panel.png` | Header "FluxIQ · Building your Flow"; turn "Building your Flow / Deciding the next step / 10 steps so far". "Add an AI model key: To do". |
| `run-munu4b4y-4e15662e.ui-review.local/05-mid-build-scenario.png` | 08:21:19.6, just after dry run 1's reset: home page, **no consent wall**, no offer, no drawer: the reset kept the consent answer. Overlay "Using core.run_node". |
| `run-munu4b4y-4e15662e.ui-review.local/07-mid-build-scenario.png` | 08:21:59.6, end of dry run 2: drawer step 1 filled, greeting card over the footer; overlay "Using core.run_node: core.replay.replayed". |
| `run-munu4b4y-4e15662e.ui-review.local/08-mid-build-scenario.png` | 08:22:19.7: the same drawer state; no overlay. |
| `run-munu4b4y-4e15662e.ui-review.local/09-flow-run-scenario.png` | 08:22:37.9, playback start: **consent wall up again** (fresh visitor); overlay "Flow ready / Build finished: a Flow is proposed". |
| `run-munu4b4y-4e15662e.ui-review.local/09-flow-run-panel.png` | Header "FluxIQ · Flow ready"; "Worked for 56s · 27 steps". |
| `run-munu4b4y-4e15662e.ui-review.local/10-flow-run-scenario.png` | 08:22:57.7, s2 running: consent wall and greeting card, **no offer**; overlay "Running your Flow · Step 2 of 9 / Running step 2 of 9: node.bootstrap.6807300…" cut with an ellipsis. |
| `run-munu4b4y-4e15662e.ui-review.local/11-flow-run-scenario.png` | 08:23:17.7, recovery: consent wall still up; overlay "Step 4 of 9 / Recovering from a failed step: node.bootstrap…". |
| `run-munu4b4y-4e15662e.ui-review.local/11-flow-run-panel.png` | Header "Running your Flow"; turn "Running your Flow Step 4 of 9 / Recovering from a failed step: node.bootstrap.6807300d697cdf44.main.s2", "24 steps so far", "3 steps so far". |
| `run-munu4b4y-4e15662e.ui-review.local/12-flow-run-scenario.png` | 08:23:37.7, exploration: consent answered, drawer open on step 1, greeting card over the footer; overlay "Step 4 of 9 / Using web.recovery.enter_field". |
| `run-munu4b4y-4e15662e.ui-review.local/13-failure-scenario.png` | Home page, no consent wall, greeting card open; overlay **"Run failed / Run failed"**. |
| `run-munu4b4y-4e15662e.ui-review.local/13-failure-panel.png` | Header "Run failed" (matches); "Worked for 24s · 13 steps"; "Worked for 1m 11s · 14 steps · 1 failed" in red. No failure reason. |
| `run-munu4b4y-4e15662e/screenshots/00013-4b3d4b639b1f.jpg` | Whole window at 08:23:05.4, during s2's third attempt: the side panel beside the page ("Running your Flow Step 3 of 9 / Recovering from a failed step: node.bootstrap.6807300d697cdf44.main.s2", "25 steps so far", "3 steps so far"); the page's right part, including the wall's buttons and the greeting card, is behind the panel. |

### Overlay per moment

Window about 3.0 s. Phase changes count transitions of the overlay's `phaseName` between samples,
including to or from absent. `textChanges`, `presenceToggles` and `visibilityToggles` are as
`summary.overlay` reports them.

| # | Label | Window start | Status | present/samples | textChanges | presenceToggles | visibilityToggles | Phase changes/s | Text changes/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | start | 08:20:17.914 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 2 | mid-build | 08:20:20.932 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 3 | mid-build | 08:20:39.620 | changed | 16/16 | 2 | 0 | 0 | 0.00 | 0.66 |
| 4 | mid-build | 08:20:59.611 | flickering | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 5 | mid-build | 08:21:19.624 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 6 | mid-build | 08:21:39.624 | flickering | 15/16 | 2 | 2 | 2 | 0.67 | 0.67 |
| 7 | mid-build | 08:21:59.649 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 8 | mid-build | 08:22:19.697 | absent | 0/16 | 0 | 0 | 0 | 0.00 | 0.00 |
| 9 | flow-run | 08:22:37.719 | changed | 15/16 | 0 | 1 | 1 | 0.33 | 0.00 |
| 10 | flow-run | 08:22:57.700 | changed | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 11 | flow-run | 08:23:17.717 | changed | 16/16 | 2 | 0 | 0 | 0.00 | 0.67 |
| 12 | flow-run | 08:23:37.737 | flickering | 16/16 | 2 | 0 | 0 | 0.00 | 0.66 |
| 13 | failure | 08:23:55.594 | stable | 16/16 | 0 | 0 | 0 | 0.00 | 0.00 |

**Overlay rate:** the peak is 0.67 phase changes/s and 0.67 text changes/s. The only phase change
during the build is a one-sample drop-out at 08:21:42.424 (moment 6), during dry run 2's reset page
load (42.353–43.391).

Texts shown (phase | headline | detail):
- "Building your Flow | Using core.run_node", "… | Using core.run_node: web.action.succeeded",
  "… | Using core.run_node: core.replay.replayed", "… | Deciding the next step"
- "Flow ready | Build finished: a Flow is proposed"
- "Running your Flow | Step N of 9 | Running step N of 9: node.bootstrap.6807300d697cdf44.main.s2"
  (N = 2 and 3, **both for s2**)
- "Running your Flow | Step N of 9 | Recovering from a failed step: node.bootstrap.6807300d697cdf44.main.s2" (N = 2, 4)
- "Running your Flow | Step 4 of 9 | Using web.recovery.inspect / web.recovery.press / web.recovery.enter_field"
- "Run failed | Run failed"

Fidelity to Core's events, checked against `core.log` and `flow-lane.json` (each text is held about
1.2 s, so it trails its event):
- Moment 3: "…: web.action.succeeded" at 39.620 for the navigate that ended 39.270. "Using
  core.run_node" at 40.624 is d3 (40.411–40.484, refused), with nothing saying it was refused.
  "Deciding" at 41.910 (decision 3 from 40.485).
- Moment 4: "Deciding" 59.611 (decision 8 from 58.805); "Using" 00.412 (d9 from 00.104); "Deciding"
  01.620 (01.355).
- Moment 6: "Using core.run_node" 39.624 is **d17, the step declared `send_or_publish`**
  (37.190–40.676), shown like any other step. "…succeeded" 40.851. "Deciding" 42.041. Completion #2's
  check (42.353) was never shown; the hold and the drop-out swallowed it.
- Moment 7: "…: core.replay.replayed" 59.649 (dry run 2 ended 58.058).
- Moment 10: "Step 2 of 9 / Running step 2" 57.700 (attempt 1, 54.028–58.264). "Recovering" 59.314.
  "Step 3 of 9 / Running step 3 of 9: …s2" 00.701 is **attempt 2 of the same node** (from 59.590).
- Moment 11: "Recovering" 17.717 (recovery from 13.441); "web.recovery.inspect" 19.534 (19.415);
  "web.recovery.press" 20.720 (20.606).
- Moment 12: "enter_field" 37.737 (36.422–37.816); "Deciding" 38.742 (37.817).
- Moment 13: "Run failed" at 55.594 (error event 55.581), **present for all 16 samples**.

The overlay never showed a phase Core had not emitted.

### Overlay DOM state

- One host (`hostCount` 1 when present), `display: block`, `visibility: visible`, `opacity: 1`,
  `inViewport: true` and `documentVisibility: visible` throughout.
- Attributes: `data-fluxiq-activity=""`, `aria-hidden="true"`, `inert=""`.
- Rect: **x 16, y 650, 300 × 54**, bottom-left, at every present sample. It sits over the consent
  wall's empty lower-left and the first service tile's text. It covers no control the Flow or the
  exploration used.
- Absent at moments 1–2 (before the loop started at 08:20:35.576) and at moment 8.

### Panel

Side panel, verified open, Simple tab: the status card, "Get set up" with **"Add an AI model key:
To do"**, and the chat area with a header line ("FluxIQ · <phase>"), turns and a composer. The header
reads "Building your Flow", "Flow ready", "Running your Flow" and "Run failed" at the matching moments.
No question was asked this run. Panels 01–03, 05–08, 10 and 12 were not opened.

### UI defects (U1–U13 from `reports/t174-live-lane.md`, U14–U15 from run 20's debug)

| # | Defect | This run | Evidence |
| --- | --- | --- | --- |
| U1 | Raw tool ids, result codes and node ids shown to the person | **recurs** ("Using core.run_node: core.replay.replayed", "Using web.recovery.press", "node.bootstrap.6807300d697cdf44.main.s2" in overlay and panel) | `10-flow-run-scenario.png`, `11-flow-run-panel.png`, `12-flow-run-scenario.png` |
| U2 | Headline repeated as the detail line | **recurs at failure only** ("Run failed / Run failed") | `13-failure-scenario.png` |
| U3 | Overlay covers the page's bottom-right controls | **fixed** (bottom-left; over no control used) | all scenario PNGs opened |
| U4 | Panel says "Done" mid-build, at playback, after failure | **fixed** (header matches the overlay at every moment opened) | `04-mid-build-panel.png`, `09-flow-run-panel.png`, `11-flow-run-panel.png`, `13-failure-panel.png` |
| U5 | "Add an AI model key: To do" during a live build | **recurs** | every panel PNG opened |
| U6 | Control name joined without a separator | not seen (no "Clicking" line in the panels opened) | – |
| U7 | Flicker and page-load drop-outs | **partly fixed**: peak 0.67/s; one drop-out on a dry-run reset | JSON moment 6 |
| U8 | Repair looks like building; failure not left on screen | **mostly fixed**: repair is shown ("Recovering…", "Using web.recovery.*"), and "Run failed" stayed the whole 3 s window (run 20: gone after 1.2 s). Still no failure reason in overlay or panel | `11-flow-run-scenario.png`, `13-failure-scenario.png`, `13-failure-panel.png` |
| U9 | Nothing tells the person a robot check is waiting | not applicable (the human check was never reached) | – |
| U10 | Dry runs look like exploring | **recurs** ("Using core.run_node: core.replay.replayed") | JSON moment 7, `07-mid-build-scenario.png` |
| U11 | "The proposed result passed its check" overstates the check | **not seen as such**; "Flow ready / Build finished: a Flow is proposed" was shown for a Flow whose s2 had failed to replay in both dry runs | `09-flow-run-scenario.png` |
| U12 | Panel counters go backwards; "Worked for" understates the build | **recurs (probable)**: "Worked for 56s · 27 steps" at Flow ready for a 93 s build with 17 calls; at failure the rows read "24s · 13 steps" and "1m 11s · 14 steps · 1 failed" | `09-flow-run-panel.png`, `13-failure-panel.png` |
| U13 | Overlay detail line cut with an ellipsis | **recurs** | `10-flow-run-scenario.png`, `11-flow-run-scenario.png` |
| U14 | A question stays open after it stopped mattering | not applicable (no question this run) | – |
| U15 | "Checking the proposed result" shown for a refused check | not seen (no sampled window covered a completion) | – |
| new U16 | **The step counter counts attempts, not nodes.** "Step 2 of 9", then "Step 3 of 9 / Running step 3 of 9: …main.s2", then "Step 4 of 9" during recovery, all for the Flow's second node, in both overlay and panel | new | JSON moment 10, `11-flow-run-panel.png`, `screenshots/00013-*.jpg` |
| new U17 | **A step declared to send is shown as ordinary work** ("Using core.run_node"); nothing tells the person the build pressed a send | new (minor) | JSON moment 6 |

## t185 checklist

| # | Item | Status | Artifact |
| --- | --- | --- | --- |
| 1 | Live panel | **Confirmed**, beside the page: stderr `[lab] live panel: side-panel (verified open)`; `snapshots/live-panel.json` = `{"mode":"side-panel"}`; the panel captured at all 13 moments; the whole-window JPG shows it docked beside the page. Scenario tab `inFront: true` and the only `frontTabs` entry at every moment. **`activeTabUrl`: no evidence.** | full log; `snapshots/live-panel.json`; `screenshots/00013-*.jpg`; UI review JSON |
| 2 | Overlay from real events | **Confirmed.** Absent before Core's first event (moments 1–2; loop start 08:20:35.576). Every text seen matches a `core.log` or runtime event, trailing by the hold (moments 3, 4, 6, 7, 10–13). Repair and exploration are pictured. Completion #2's check was never displayed. Moment 8's absence (between build settle and "Flow ready") is not explained. | UI review JSON; `logs/core.log`; PNGs 03, 09–13 |
| 3 | No interference | **Confirmed for the overlay.** Host marked `data-fluxiq-activity`, `aria-hidden`, `inert`; rect bottom-left (x 16–316, y 650–704), away from every control used. The failure was a target absent from the page, not an overlay. Snapshots, interference sentences and `dom.mutation`: **no evidence** (not exported). | UI review JSON; `flow-lane.json` `failure` |
| 4 | Chat | **Partly confirmed.** Turns "Building your Flow … N steps so far", "Running your Flow Step N of 9 …", and "Worked for …" rows. Against: no failure reason; counters disagree with the build (U12); the step number counts attempts (U16). The typed instruction as a person's turn: **not seen** in the panels opened. | `04-mid-build-panel.png`, `09-flow-run-panel.png`, `11-flow-run-panel.png`, `13-failure-panel.png` |
| 5 | Core: no gateway errors from `server.activity` | **Confirmed for what the log shows.** `logs/core.log` (156 lines, 148 build-trace) has no error, warn, `outbound` or `server.activity` line. `outbound` growth: not logged. | `logs/core.log` |
