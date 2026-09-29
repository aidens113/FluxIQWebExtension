# Lane debug: run-mum0ke7z-940cbd27 (bigbox-retail-pickup-cart), round 2

Worker lane t172, round 2, debug only, no product code changed.

**Verdict: no Flow was written. The build again ran out of its token budget,
after four refused completions, the last on the forced final decision. The stall
guard did not turn this into a Flow.**

## Answers to the brief

| Question | Answer |
| --- | --- |
| Was a Flow written? | **No.** The build ended `flow_bootstrap.evidence_iteration_limit` (issue `bootstrap.completion_profile_limit_exceeded`) after 34 decisions. |
| Did it run? | **No.** There was no Flow. |
| Was the answer right? | **Not judged.** There was no Flow to run. |
| Was a repair triggered, and what did it do? | **No repair.** A failed build writes nothing (`!FluxIQ/.../runtime/llm/evidence-loop.ts:360-375` at 8b56084), so nothing reached a run, a verifier or a re-author. |
| Did the targeted fix (8b56084, the stall guard) work? | **Not enough to matter for this task.** About 17 of 34 decisions still changed nothing. The guard never stopped the loop, because progress kept breaking the count before 8. The model tried to finish **4 times** (#24, #29, #32, #34) against **1** in round 1, which fits the redirect "keeps naming the last completion refusal until the model tries to finish again". But the redirect text is not in the bundle, so that it fired is inferred, not observed. Tokens and outcome were almost unchanged: 506,666 against 527,633, and no Flow either time. |
| Next wall | **The evidence-completion profile limit refuses a Flow this task needs, and does not say which limit.** `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/bootstrap-completion.ts:190-191` checks `flow-bootstrap/plan/evidence-schema.ts:92-104` against `flow-bootstrap/plan/limits.ts:29` (`maxNodesPerSubflow: 16`). The recorded script for this task needs 20 action nodes (see cause 1). The runner-up wall, cause 2: a working click on the store-change link is reported as failed, because its effect happens in shadow DOM (`apps/extension/src/content/action-runtime/in-place-effect.ts:38-39,177-180`). |

## Run facts

| Field | Value |
| --- | --- |
| Command | `node scripts/lab/run-lab.mjs run bigbox-retail --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task bigbox-retail-pickup-cart --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-calls 48 --llm-max-run-tokens 600000 --llm-max-cost-usd 0.25` with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` |
| Worktree / Core | `F:\fxwork\t172-live-lane-hard-sites` @ bf5227dc; shared Core `F:\fxwork\!FluxIQ` @ 8b56084 (built; `dev` is at d67bdfa, a panel-routing change) |
| Build | `failed`, 34 provider calls, 506,666 tokens, **$0.056 of $0.25**, 217 s |
| Failure | `flow_bootstrap.evidence_iteration_limit`, stage `provider_output_validation`, HTTP 400, `issueCodes: ["bootstrap.completion_profile_limit_exceeded"]` |
| Draft at the end | 15 steps, 3,641 of 4,000 bytes |
| Verdict | `failed` / `runtime.behavior`; `facilityFailure.reason: unclassified` at `scenario.execute`, which is how the Lab records a build that wrote no Flow |

Setup: none of the round 2 setup failures touched this run. After the crash
that interrupted the session, I checked the run directory and every lane
report for NUL bytes: 41 files, none. No Lab process was left.

## Iteration walk (`snapshots/live-llm.json`)

| # | +s | Tool | Result | Draft rev / steps | Note |
| --- | --- | --- | --- | --- | --- |
| 0 | 0.0 | run_node (inspect) | `inspect.succeeded` | 0 | Start page |
| 1 | 3.8 | run_node `dom-click` | `target_unobserved` / `target_not_a_handle` | 0 to 1 | Invented locator |
| 2 | 8.6 | run_node | `action.succeeded`, page changed | 1 to 2 / 1 | |
| 3 | 12.6 | run_node `dom-click` | `target_unobserved` / `handle_not_in_packet` | 2 to 3 | Invented handle |
| 4-5 | 16.6-20.8 | run_node `dom-click` | same refusal, **`answered_the_same_again`** x2 | 3 to 5 | Repeat marker (domain 1fb57cbc) visible |
| 6 | 24.8 | run_node (inspect) | `inspect.succeeded` | 5 | |
| 7 | 31.8 | amend_draft | 4 applied (d2, d4-d6) | 5 to 6 | Drops the refused clicks |
| 8 | 36.3 | amend_draft | `draft_unchanged`, 1 refused (d3) | 6 | |
| 9 | 56.2 | run_node | `action.succeeded`, page changed | 6 to 7 | |
| 10 | 67.4 | amend_draft | `draft_unchanged` (d3 again) | 7 | Same amendment as #8 |
| 11 | 73.3 | run_node | `action.succeeded`, page changed | 7 to 8 | |
| 12 | 76.8 | amend_draft | `draft_unchanged`, 3 refused (d3, d8, d9) | 8 | |
| 13 | 81.6 | run_node | `action.succeeded`, page changed | 8 to 9 | |
| 14-15 | 84.9-88.1 | amend_draft (d10) x2 | applied, then `draft_unchanged` | 9 to 10 | |
| 16 | 92.8 | run_node | `action.succeeded`, page changed | 10 to 11 | |
| 17 | 95.2 | amend_draft (d10) | applied | 11 to 12 | |
| 18 | 104.5 | run_node `dom-click` | **`rejected.output_not_observed`**, page changed | 12 to 13 | See cause 2 |
| 19 | 107.9 | - | `llm_output.invalid_evidence_decision` | 13 | Unusable reply |
| 20 | 111.3 | amend_draft (rerun d11) | `draft_rerun`, then `action.succeeded`, page changed | 13 to 15 | |
| 21 | 115.8 | amend_draft (d12) | applied | 15 to 16 / 11 | |
| 22-23 | 118.8-121.9 | amend_draft x2 | `draft_unchanged`, 5 then 2 refused | 16 | |
| 24 | 125.2 | `complete` | **refused `bootstrap.completion_profile_limit_exceeded`** | 16 / 11 | Completion 1; draft 3,891 bytes |
| 25 | 128.1 | amend_draft | `draft_unchanged` (d11, d12), identical to #23 | 16 | |
| 26 | 139.3 | run_node `dom-click` | **`output_not_observed`**, page **changed** | 16 to 17 | Most likely the store-change link (cause 2) |
| 27-28 | 148.9-159.6 | run_node `dom-click` | `output_not_observed`, page unchanged, `answered_the_same_again` x2 | 17 to 19 / 13 | The same press twice more, about 10 s each |
| 29 | 165.3 | `complete` | **refused `bootstrap.cannot_reach_start_location`** | 19 / 14 | Completion 2: no step reaches the start (as round 1 #30) |
| 30 | 170.9 | run_node | `action.succeeded`, page changed | 19 to 20 | |
| 31 | 178.9 | amend_draft (d14-d16) | 3 applied | 20 to 21 / 15 | |
| 32 | 196.7 | `complete` | **refused at the dry run** | 21 / 15 | Completion 3; draft 3,986 of 4,000 bytes |
| 33 | 207.6 | - | `llm_output.invalid_evidence_decision` | 21 | Unusable reply |
| 34 | 214.2 | `complete` (forced final decision) | **refused `bootstrap.completion_profile_limit_exceeded`** | 21 / 15 | Completion 4; the loop ends |

Totals: 7 effect-applying actions, 6 refused clicks (2 invented targets, 4
`output_not_observed`), 13 amendments (7 changed nothing), 4 completion
attempts, all refused, and 2 unusable replies.

## Round 1 against round 2 (same task, same limits)

| | Round 1 `run-mulx76vv` (Core 717f035) | Round 2 (Core 8b56084) |
| --- | --- | --- |
| Decisions / tokens / cost | 32 / 527,633 / $0.061 | 34 / 506,666 / $0.056 |
| Effect-applying actions | 9 | 7 |
| Decisions that changed nothing | 10 of the last 16 | about 17 of 34 |
| Completion attempts | 1 (#30, cannot reach start) | 4 (profile, cannot reach start, dry run, profile) |
| End | budget exhausted, 12-step draft, nothing written | budget exhausted, 15-step draft, nothing written |

## Divergence point and causes

The build never had a Flow Core would accept. Twice it offered one that
failed the profile limit (#24, #34). Once it offered one with no step reaching
the start location (#29), and once one that failed its dry run (#32). In
between, it lost four turns to a click that had worked (#18, #26-28), and
seven to amendments that changed nothing.

### Cause 1 (seen in round 1, now the main cause): the evidence profile refuses a Flow this task needs, without naming the limit

The completion is refused by one boolean,
`isAutomationStudioEvidenceFlowBootstrapResultWithinLimits`
(`!FluxIQ/.../flow-bootstrap/plan/evidence-schema.ts:92-104`), with one
issue, `bootstrap.completion_profile_limit_exceeded`, at path `result`
(`llm/harness-options/bootstrap-completion.ts:190-191`). It does not say
whether the summary length, the 12,000 result bytes, the 4 subflows, the 16
nodes or 24 edges per subflow, or the 16 parameters per node was exceeded.

The task's recorded script (`apps/scenario-lab/src/scenarios/bigbox-retail/manifest/primary-workflow.ts:15-38`
with `opening-steps.ts:8-26`) has **19 clicks, types and presses**:
consent, decline offer, store chip, choose Millbrook, type and submit
twice, open two listings, choose 12 Double Rolls, "+", close the assistant,
wake plus add twice, continue shopping, choose 250 Count. With the start
navigate, that makes **20 action nodes**, before any merge nodes Core adds
(the everything-store Flow in round 2 had 2 merges for 7 actions). Against
`maxNodesPerSubflow: 16` (`flow-bootstrap/plan/limits.ts:29`), **a
single-subflow Flow that did this whole task could not pass**. It would
have to be split across subflows, and the refusal gives the model no reason
to do that. The model cannot fix what it is not told, so it re-submitted.
Round 1's crossborder run (`lane-run-mulxsbyy-d4d4c7a1.md`) ended on the
same refusal with a 17-step draft.

This is computed, not read. The refused plan and the failing limit are not
in the bundle, and `provider-failures.local.json` is cut at 8,000
characters, before the ending's `bound`, `completionAttempts` and
`proposableSteps`.

### Cause 2 (new): a working click is reported as failed when its effect happens in shadow DOM

A click on a link whose navigation the page cancels passes only if the
address or the page's rendered text changes within 5 s
(`apps/extension/src/content/actions/click.ts:117-136`). The watch reads
`document.body.innerText` (`action-runtime/in-place-effect.ts:177-180`) and
says itself that "one inside a shadow root ... [is] not seen, and such a
click still fails" (`:38-39`). On the product page, the "Change store" link
cancels its navigation and un-hides the flyout inside
`vr-fulfillment-picker`'s open shadow root
(`bigbox-retail/client/product-script.ts:73`, `client/shell-script.ts:92-111`,
`shell/store-picker.ts:14`). So the picker opens and the click is reported
`output_not_observed`.

#26 fits exactly: page changed (the evidence packet saw the flyout), click
refused. #27 and #28 then press again, the flyout is already open, the page
is unchanged, and the click is refused again, about 10 s each. **The node
targets are not in the bundle, so which link #18 and #26-28 pressed is
inferred.** The other cancelling links on the page ("Add to list" shows a
toast; "No thanks" removes a card) change the light DOM and would pass.

This belongs to the same family as round 1's shadow-DOM cause, but it is
not in `dom-snapshot.ts`: it is the click's post-condition. It turns a
success into a refusal the model then chases.

### Cause 3 (seen in round 1): a build that runs out writes nothing

With about 15.8k tokens per decision, 34 decisions leave 45,834 tokens,
below the 56,000 per-decision reservation, so #34 was the forced final
decision (`evidence-loop.ts:703`). The loop failed with 15 draft steps and
wrote none of them (`evidence-loop.ts:360-375`). Round 1 was the same, with
12 steps.

### Cause 4 (seen in round 1): the draft loses the step to the start location

#29 is refused `bootstrap.cannot_reach_start_location`, the same as round
1 #30. Amendments dropped the navigation that the reachability check needs.
Which amendment did it cannot be told, because refusal reasons are dropped
from the bundle (round 1 cause 3, `lane-run-mulx76vv-a882551e.md`).

### Cause 5 (minor): invented locators and repeated amendments

#1, #3-5: `target_not_a_handle` and `handle_not_in_packet`, then the same
refusal twice more, now marked `answered_the_same_again`, which is visible
and working. #8, #10, #12: the same refused amendment on d3, three times.
#22-25: four no-progress decisions in a row. The redirect threshold is 3
(`loop-limits/evidence-loop.ts:109`), so the redirect should have fired
there.

## Ranked for fixers

1. **Cause 1.** Name the failing limit and its value in the refusal, and
   either raise `maxNodesPerSubflow` for evidence completions to what real
   tasks need, or split a long draft into subflows automatically. Right now
   a correct build of this task cannot complete.
2. **Cause 2.** Let the in-place watch see open shadow roots (observe them,
   and read their rendered text), so a link that opens a shadow-DOM panel
   passes.
3. **Cause 3.** Write the proposable steps when the budget ends, so the
   repair loop has something to improve.

## Not verified

- Which profile limit was exceeded at #24 and #34 (computed, see cause 1).
- Which element #18 and #26-28 clicked (inferred, see cause 2).
- Whether the stall redirect was sent at #22-25. Nothing in the bundle
  records it.
- The exhaustion `bound` (read as `budget` from the arithmetic and the
  forced-final completion, not from the diagnostic, which is truncated).
- What reached the cart or which store was set. The Lab deletes the run root
  with Core's store, and the bundle keeps codes only.
