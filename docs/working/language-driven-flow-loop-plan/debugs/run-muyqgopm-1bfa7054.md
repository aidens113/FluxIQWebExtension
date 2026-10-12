# Run debug — run-muyqgopm-1bfa7054 (lane A round 3, first live candidate-mode build, t342-slot-2)

Written as `run-pending-t342-slot-2-a-r3.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-07 ~23:25 UTC, off-peak until 01:00 UTC).

## Header

Lane A, t342 round 3: the first live build in candidate authoring mode. Task `crossborder-marketplace-hub-to-cart`
(judged by playback goal `hub-in-cart`). Instance `t342-slot-2`, slot 2 (kept since 19:54 UTC), persistent workspace
`t342-a`; the chat build makes a new run-owned project there. Tree `fxwork/t342/!FluxIQWebExtension` at 1d3731f7
(contains dev 7cc511ed), Core `fxwork/t342/!FluxIQ` at 1b9f15f7 (= Core dev), both clean. No `STOP-balance`, no
override files. Core libraries reused or restored and `pnpm build` exit 0 at 23:21 UTC.

Previous lane A run on this instance: round 2 `run-muylu4pp-f9cb2121` (legacy; failed honestly, $0.056718, 38 calls;
causes C1 `act` on a rerun dropped, C2 preset Space Grey has no "already chosen" state and a re-added toggle half
stands, C3 quantity claim not checked against the value, C4 edits the language lacks).

## Expectations (written before launch)

Instruction, verbatim (219 characters, sha256 `2e6f5e7d...a405`):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the
> 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Command (`--max-attempts 1`, so no second paid attempt):

```text
FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 --authoring-mode candidate -- --target persistent-isolated --workspace t342-a
```

Dry runs (23:22-23:23 UTC): the campaign printed one spawned command, with `--authoring-mode candidate`. That command
with `--dry-run` exited 0: `status ready`, `providerCallCount 0`, created-flow, chat entry, persistent-isolated,
deepseek-flash, `coreAuthoringMode` candidate, `candidateTrial {trialRunner: true, startReset: true, source:
lab-plan}`, maxCalls 48, $0.10, `permittedConsequences []`, instruction sha256 `2e6f5e7d...a405`, `coreWeb` key
`2f8c1d76...` not cached.

What a correct candidate does: navigate to the start page; dismiss the welcome popup and consent layer (optional
steps); search and open the Voltbay Official Store item; leave Space Grey alone (preselected; a press un-chooses it);
choose 7-in-1 and Spain; collect the store coupon; set quantity 3 (type into the quantity field, or press "+" twice);
press Add to cart once; never Buy now.

Exact oracle facts (unchanged): cart line Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, × 3; Voltbay
coupon collected; `Cart (3)`; `Orders to be shipped (0)`; nothing bought.

New in candidate mode, each to be checked in the debug:

- K1 the submit tool's description carries the Flow script format and an act-on-one-item example (t339 U1).
- K2 `core.test_candidate` runs the exact latest revision and digest once, through the normal runtime, after the start
  hook reset (`/__control/reset`, 204); the trial record names the reset receipt, steps run and the execution result.
- K3 the build-test judge sees only trial evidence (no exploration leftovers); a yes needs the confirmed second
  verdict; completion needs a yes on the exact latest revision and digest.
- K4 a yes candidate becomes a proposed adaptation (`candidateTrial` audit detail), the chat applies it (U3) and says
  the automation is ready; the Lab then resets, plays the saved Flow, checks the private oracle, and the Flow's
  playback starts on its own tab (t347).
- K5 the saved instruction is the person's own words (t349), not a paraphrase.
- K6 chat and overlay fixes (t350): replays folded, a real Stop button from "Starting…", stable overlay placement, one
  verb per act, click cards with a target, no truncated short labels.
- K7 loops: lane A needs none; a loop in this candidate would be a mistake.
- K8 churn counts: submissions refused, trials repeated, completions refused.
- Round 2's traps, to watch under candidate mode: the Space Grey toggle (C2), a quantity claimed on one "+" press (C3),
  Add to cart missing from the Flow (C1's effect).

Cost: under $0.10 for the build, at most 48 calls; trials spend no model calls except their judges.

UI checkpoints: U1 start; U2 one message per step with its reason, candidate submission and trial cards in plain words
(new); U3 overlay from the send, stable; U4 no step numbers, node names, "candidate", "digest", "revision" or
"verdict" in the person's words; U5 ending whole and plain; U6 playback cards if reached.

Replays (only on an oracle pass with the product's acceptance): one `lab replay` with zero calls, then a second
candidate creation run on the same pair. If the run fails: debug and stop, no further paid run.

## Result (written by the t342 lane lead from the run folder, 2026-10-07 ~23:50 UTC)

**Failed before the first candidate was submitted.** Verdict `runtime.behavior` (`lab.chat_build_failed`), issue
`flow_bootstrap.unexpected_error`. No candidate was recorded and no trial ran. The oracle was not measured.

- Launched 23:22:51 UTC (guard `admitted`, fingerprint `sha256:86071cf0...`). The chat send happened shortly after the
  panel opened at 23:24:51. The build ended at 23:25:43.6, after 54 s.
- 18 provider calls, $0.020980 in total: chat $0.000334 (1 call), exploration $0.020646 (17 decisions).
- The build record carries no accounting, and the Lab's per-build spend reads $0 (C3).
- No Lab process was left running (checked; the only matches were the lead's own shells).

What happened:

- 0002-0034: a clean exploration of 16 decisions.
  - It closed the welcome popup and the consent layer, after one `repeat_refused` at 0006.
  - It searched and opened the Voltbay Official Store item.
  - It pressed "Silver" by mistake at 0017, which un-chose Space Grey, and Space Grey again at 0019, which re-chose it.
  - It chose 7-in-1, collected the coupon (a busy page at 0028, done at 0030) and chose Spain.
  - It typed 3 into the quantity field (0034 shows the quantity at 3).
- 0035: the model's 17th decision was a complete `core.submit_candidate` call with an 8-step script. But its `kind`
  was written as `"callId"` instead of `"tool_call"`, and the `callId` field was left out. HTTP 200,
  `finishReason: stop`.
- Core's log: `decide throw iteration=17 ... AutomationStudioLlmUnusableDecisionError ...
  issues=llm_output.invalid_evidence_decision`, then `build throw`.
- The chat said: "The AI model's reply couldn't be read or used. Asking it again; the build stops if its replies keep
  being unusable." It was followed at once by: "stopped because the build failed: the model could not be reached, or
  did not answer."

Checks from Expectations:

- K1 format: seen. The submit tool's `flow` input carries the Flow script format; `core.test_candidate` was offered.
- K2-K4 (trial, judge, promotion, apply, playback on the Flow's own tab): not reached.
- K5 own words: seen. 0001 passed the person's instruction verbatim, and the Flow is named from it.
- K6 UI: the Stop button is a real button from the first moment; the overlay stays at the bottom left and is stable.
  Click cards and overlay lines still name no control. Details below.
- K7 loops: the unsent script has none.
- K8 churn: 0 submissions refused, 0 trials, 0 completions refused; 1 refused repeat call (0006).
- Round 2's traps, as they would have stood had the script been tried:
  - Space Grey: the script presses Space Grey (t959) on a fresh page, which un-chooses the preset colour (round 2 C2).
  - Quantity: typed as 3 into the field, so round 2's C3 shape is avoided.
  - Add to cart: present in the script.
  - The script opens the item URL directly and dismisses none of the layers covering Add to cart (`COVERING ... t1052`
    on every item view).
  - Untested; a trial and its judge would have had to catch these.

### Causes

**C1: in candidate mode one unusable model reply ends the build.**

- The legacy loop refuses an unusable decision with feedback and asks again, up to `maxConsecutive`
  (`runtime/service.ts:1596`, `unusableDecisions: { maxConsecutive, stalled }`). The candidate branch's
  loop options (`runtime/service.ts:1565`, passed to `generateAutomationStudioFlowCandidateDraft`) set
  `propagateDecisionErrors: true` without `unusableDecisions`. The first `AutomationStudioLlmUnusableDecisionError`
  therefore propagates and ends the build (`llm/evidence-loop.ts:660-690`).
- The chat's "Asking it again" line shows the activity layer expected the retry.
- Fix: give the candidate loop the same `unusableDecisions` setting, with a stalled ending that keeps the draft. Owner:
  Core `runtime/service.ts` candidate branch, or `flow-bootstrap/candidate/authoring-loop.ts` if the setting belongs to
  the candidate loop. Write the failing test first: a candidate loop whose model answers one decision with `kind:
  "callId"` must ask again and accept the next valid submission.
- The schema the model saw was correct (`kind` const `tool_call`, `callId` required). The slip is flash's, inside a
  long script answer.

**C2: the person is told the model could not be reached when it answered.**

- The legacy branch moves the failure stage to `provider_output_validation` once a decision comes back
  (`runtime/service.ts:1633`). The candidate branch only sets it from its `progress` callback
  (`runtime/service.ts:1574`), so an unusable reply ends at stage `provider_request`.
- `conversations/commands/progress.ts:103` words that stage as "the model could not be reached, or did not answer".
  The right words are those for `provider_output_validation`: "the model's answer could not be used".
- Fix: in the candidate branch, set the stage to `provider_output_validation` when a decision returns, as legacy does.

**C3: a failed candidate build reports no spend.**

- `snapshots/flow-lane.json` has `build.accounting: null` and `providerInvocation: "unknown"`, and
  `snapshots/live-llm.json` has `perBuild ... estimatedCostUsd: 0`. The ledger's `maxBuildCostUsd` is 0.
- Yet the step logs sum to $0.020646 for the build's 17 decisions, and the run total ($0.020980) is right.
- The candidate failure path passes on only the `failureAccounting` that `progress` set
  (`runtime/service.ts:1574`). On this throw that is empty, so the per-build ceiling check and the spend reports see
  $0.
- Fix: carry the loop's accounting on the candidate failure, as legacy's `loopAccounting` does.

### UI review (5 moments, all reviewed by the lead)

- 01-02: the instruction appears as the user's bubble. The intro is plain: "working out its steps by trying them on the
  page you had open and then test-running the whole Flow once from the start". "Stop build" is a real button with an
  icon (t350 D9 fixed).
- 03-04:
  - Click cards read "Click · Working on it" with no control named; the overlay says "Clicking on the page" (D4 and
    round 4's rerun-line item, still open on this path).
  - The round-4 sentence "Reading your instruction gave no answer for "put three ...", "Collect that store's coupon
    ..." so the build's tests check the steps that do them rather than do them again" is back, and in candidate mode
    it is confusing.
  - The overlay is placed stably at the bottom left (D11 improved). Moment 4's "flickering" is a real sequence (busy,
    then retry), counted as a revisit.
- 05: contradictory: "Asking it again" and then "stopped ... could not be reached" (C1, C2). The Flow is named with
  the instruction's first 70 characters, which is long.

Not run: the replay and the second candidate run (no pass). No relaunch.
