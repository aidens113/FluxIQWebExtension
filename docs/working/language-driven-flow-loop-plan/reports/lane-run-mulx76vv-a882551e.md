# Lane debug: run-mulx76vv-a882551e (bigbox-retail-pickup-cart)

Worker lane t172, debug only, no product code changed.

## Outcome

**Failed at build: no Flow was written.** The loop spent 32 decisions (9 of
them applied a real effect on the page) and never completed. It ended with
`flow_bootstrap.evidence_iteration_limit` because the run's token budget ran
out, not the call count. Nothing ran, so there was nothing to judge or repair.

| Field | Value |
| --- | --- |
| Task | `bigbox-retail-pickup-cart`: switch pickup store to Millbrook Crossing, add 2 x 12 Double Rolls towels and 1 x 250 Count napkins for pickup, keep the cart, do not check out |
| Worktree / commits | `F:\fxwork\t172-live-lane-hard-sites` @ 260a4e17, Core `F:\fxwork\!FluxIQ` @ 717f035 (see Setup) |
| Provider | deepseek / deepseek-flash, production profile |
| Build | `failed`, 32 provider calls, 527,633 tokens, **$0.0606 of the $0.25 cost cap**, 170 s |
| Failure | `flow_bootstrap.evidence_iteration_limit`, stage `provider_output_validation`, retryable |
| Draft at the end | 12 steps, 3,617 of 4,000 bytes |
| Verdict | `failed`, `runtime.behavior` |

## Setup (not product results)

- First launch refused before running: Core's `dev` had moved to 8b56084 ("A
  stalled evidence loop is redirected long before it runs out"), so the Lab
  reported the shared Core as one commit behind. The brief pins this lane to
  Core 717f035 with extension 260a4e17, so the run used
  `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`. **This run's stall findings predate
  8b56084.**
- Second launch: `tsc -p tsconfig.json` in `packages/test-contracts` died with
  exit 3221225477 (0xC0000005, access violation) and was reported as
  `environment.missing`. That is a native crash, the same family as run 1's two
  Turbopack crashes, and consistent with the machine's faulty RAM. The third
  launch ran normally.

## Iteration walk (`snapshots/live-llm.json`)

| # | +s | Tool | Result | Draft rev / steps | Note |
| --- | --- | --- | --- | --- | --- |
| 0 | 0.0 | run_node (inspect) | `inspect.succeeded` | 0 / - | Start page |
| 1 | 5.8 | run_node | `action.succeeded`, page changed | 0 to 1 / 1 | |
| 2 | 9.9 | run_node (inspect) | `inspect.succeeded` | 1 | |
| 3-4 | 13.7-17.8 | run_node | **`already_answered` x2** | 1 | Stall |
| 5 | 23.3 | run_node | `action.succeeded`, page changed | 1 to 2 | |
| 6 | 28.3 | run_node | `action.succeeded`, page changed | 2 to 3 | |
| 7 | 31.9 | run_node (inspect) | `inspect.succeeded` | 3 | |
| 8 | 35.9 | detect_repeating_structure | `structure.detected` | 3 | Results list |
| 9 | 40.9 | run_node `dom-click` | `rejected.target_not_found` | 3 to 4 | Handle no longer on the page |
| 10 | 44.8 | run_node `dom-type` | `target_unobserved` / `target_not_a_handle` | 4 to 5 | Invented locator (same as run 1 #2) |
| 11 | 48.5 | amend_draft (rerun d6) | `draft_rerun`, then `action.succeeded`, page unchanged | 5 to 7 | |
| 12 | 57.0 | run_node | `action.succeeded`, page changed | 7 to 8 / 6 | |
| 13 | 62.1 | amend_draft | `draft_amended`: 2 applied, 1 refused (`already_so`, step 6) | 8 to 9 / 7 | Only refusal reason that survives (see cause 3) |
| 14 | 72.1 | run_node (inspect) | `inspect.succeeded` | 9 | |
| 15 | 79.8 | detect_repeating_structure | `structure.detected` | 9 | |
| 16 | 86.2 | run_node | `action.succeeded`, page changed | 9 to 10 | |
| 17 | 92.5 | amend_draft | 2 applied, 3 refused; targets d6, d10-d13 | 10 to 11 / 8 | |
| 18 | 98.8 | run_node (inspect) | `inspect.succeeded` | 11 | |
| 19 | 104.0 | amend_draft | **`draft_unchanged`, 0 applied, 5 refused**, same targets as #17 | 11 | Re-sent an amendment already applied |
| 20 | 108.7 | run_node | `already_answered` | 11 | |
| 21 | 113.0 | amend_draft | **`draft_unchanged`, 5 refused**, identical to #19 | 11 | |
| 22 | 116.9 | run_node | `already_answered` | 11 | |
| 23 | 122.7 | run_node | `action.succeeded`, page changed | 11 to 12 | |
| 24 | 128.6 | run_node | `action.succeeded`, page unchanged | 12 to 13 / 9 | |
| 25 | 132.2 | detect_repeating_structure | `structure.detected` | 13 | |
| 26 | 135.8 | amend_draft | 3 applied, 5 refused; targets d6, d10-d13, d16, d20, d21 | 13 to 14 / 10 | Old targets carried along again |
| 27 | 142.7 | run_node (inspect) | `inspect.succeeded`, **page changed** | 14 to 15 | The page changed on its own (the assistant pop-up opens about 8 s after load) |
| 28 | 147.5 | run_node (inspect) | `inspect.succeeded` | 15 / 11 | |
| 29 | 151.3 | run_node | `already_answered` | 15 | |
| 30 | 155.2 | decision_unusable | `bootstrap.cannot_reach_start_location` | 15 | **The one completion attempt, refused by Core**: the kept draft had no step going to the start location (`!FluxIQ/.../flow-bootstrap/reachability/check.ts:57-95`), so amendments had dropped the navigation |
| 31 | 163.2 | run_node | `action.succeeded`, page changed | 15 to 16 | |
| 32 | 167.6 | amend_draft | `draft_unchanged`, 4 refused (d2, d7, d23, d26) | 16 / 12 | Last decision; loop ends |

Totals: 9 effect-applying actions, 7 inspects, 3 structure detections, 7
amendments (3 of them changed nothing), 5 `already_answered`, 2 refused
actions, and **1 completion attempt (#30), refused**.

## Divergence point and causes

The build never diverged on one bad step. It spent its turns rebuilding the draft
instead of completing it. From #17 on, 10 of 16 decisions changed neither the
page nor the draft. The model tried `complete` only once, at #30, and Core
refused it because the amendments had dropped the step that navigates to the
start location. Two decisions later the budget was gone.

### Cause 1 (known): stalled loop, `already_answered` and `draft_unchanged`

#3-4, #19-22, #29, #32: the model re-sent requests the loop had already
answered, and re-sent an amendment list that was already applied (#19 and #21
are identical, 5 of 5 refused). The loop labels each repeat
(`!FluxIQ/.../runtime/llm/evidence-loop.ts:704-707` for `already_answered`,
`:656-667` for amendments) but, at 717f035, nothing redirects the model until
`maxStepsWithoutProgress` (24) runs out. Core 8b56084, which this run did not
include, targets exactly this.

### Cause 2 (new): the run token budget, not cost, ended a build with a 12-step draft, and the draft was thrown away

- **The token budget bound first.** Each decision re-sent about 16.5k input
  tokens. After 32 decisions, 527,633 were spent, and the remaining allowance,
  600,000 - 527,633 - 1 x 16,488 = about 55,879, was below the 56,000 set aside
  per decision. So `automationStudioLlmEvidenceLoopRemaining` reported no
  decisions left (`!FluxIQ/.../runtime/llm/loop-budget.ts`, the
  `tokensLeft < perDecision` test), and the loop ended with
  `exhausted(...)` (`evidence-loop.ts:353-365`). Cost was $0.06 of $0.25. The
  48-call grant was never reached. With these per-decision sizes, a
  `--llm-max-run-tokens 600000` grant is effectively a 34-decision cap. The
  recorded script for this task alone is 30 steps
  (`bigbox-retail/manifest/primary-workflow.ts:15-45`: store switch, two
  searches, two variants, quantity, closing the assistant, and each Add to cart
  pressed twice because the first press only wakes the page). So the grant
  is tight for this task even with no stall.
- **An exhausted loop writes nothing.** The ending counts `proposableSteps` but
  returns a failure, and no Flow is written from the 12-step draft
  (`evidence-loop.ts:353-365`). That discards every action the build had
  already proved, and leaves the repair loop nothing to improve. It runs against
  the "minimal parameters first, repair improves" rule.

### Cause 3 (new, instrumentation): amendment refusal reasons are dropped from the bundle

Core writes each refused amendment with its reason (`amendmentsRefused: [{step,
reason}]`, `!FluxIQ/.../flow-bootstrap/evidence-loop-steps.ts:132,212`).
The Lab's projection drops it: `publishableScalarList` discards every object
member of an array, and nested objects are rejected
(`packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts:68,84-89`).
The only copy that keeps it, `provider-failures.local.json`, is cut at 8,000
characters, before iteration 14. So the reasons for 17 of the 18 refused
amendments in this run are lost, and "no_such_step", "run_by_the_loop" and
"already_so" (`!FluxIQ/.../flow-draft/amendment.ts:95`) cannot be told apart.
The same projection records `nodeId` only on refused rows, so which node each
of the 9 successful actions ran is not in the bundle either.

### Cause 4 (known pattern): invented locators

#10: `dom-type` with no handle, refused `target_not_a_handle`
(`domain/src/runtime/llm-evidence/node-run/run.ts:228-232`). One turn, the
same as run 1 #2 and #4.

## Ranked for fixers

1. **Cause 1**, the stall. It burned at least 10 decisions. Re-measure on Core
   8b56084 before changing anything else.
2. **Cause 2**, an exhausted build writes nothing, and a token grant sized
   below the task. A Flow from the proposable steps would have given the repair
   loop something to work on.
3. **Cause 3**, refusal reasons and node ids missing from the bundle. Without
   them this debug cannot say what the draft held or why 18 amendments were
   refused.

## Not verified

- What any action did on the page: which store was chosen, what reached the
  cart. The Lab deletes the run root, including Core's store, for clone-target
  runs (`packages/test-runner/src/run-scenario.ts:600-602`,
  `coordinator.ts:242-246`), and the bundle keeps codes only.
- Which amendment dropped the navigation step that #30's refusal names (the
  refusal reasons after #13 are lost, see cause 3).
- The exact `bound` of the exhaustion (`budget`, `tool_calls`, or `iterations`).
  It is in Core's diagnostic but not in `live-llm.json`, and the
  provider-failures copy is truncated. The token arithmetic above is computed,
  not read.
