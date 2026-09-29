# Lane debug: run-mulxsbyy-d4d4c7a1 (crossborder-marketplace-hub-to-cart)

Worker lane t172, debug only, no product code changed.

## Outcome

**Failed at build: no Flow was written.** The model tried to finish three times
and Core refused each attempt with a different gate: start location not reached
(#24), dry run not clean (#27), and completion profile limit exceeded (#41). The
last refusal came on the forced final decision, when the token budget allowed
exactly one more call, so there was no turn left to correct it. Nothing ran, so
there was nothing to judge or repair.

| Field | Value |
| --- | --- |
| Task | `crossborder-marketplace-hub-to-cart`: three Voltbay USB-C hubs from Voltbay Official Store, Space Grey, 7-in-1, shipped from Spain, into the cart; collect the store coupon; buy nothing |
| Worktree / commits | `F:\fxwork\t172-live-lane-hard-sites` @ 260a4e17, Core @ 717f035 via `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` (Core `dev` is at 8b56084) |
| Build | `failed`, 41 provider calls, 501,724 tokens, **$0.062 of $0.25**, 176 s |
| Failure | `flow_bootstrap.evidence_iteration_limit`, last issue `bootstrap.completion_profile_limit_exceeded` |
| Draft at the end | 17 listed steps; `keptStepCount` was 4 at the last amendment (#36) |
| Verdict | `failed`, `runtime.behavior` |

## Iteration walk (`snapshots/live-llm.json`)

| # | +s | Tool | Result | Draft rev / steps | Note |
| --- | --- | --- | --- | --- | --- |
| 0 | 0.0 | run_node (inspect) | `inspect.succeeded` | 0 | |
| 1 | 4.3 | run_node `dom-click` | `target_not_a_handle` | 0 to 1 | Invented locator |
| 2 | 9.4 | run_node | `action.succeeded`, page changed | 1 to 2 | |
| 3 | 12.1 | detect_repeating_structure | `structure.detected` | 2 | |
| 4-5 | 16.1-20.4 | run_node | `action.succeeded` x2, page changed | 2 to 4 | Search |
| 6 | 22.9 | run_node (inspect) | `inspect.succeeded` | 4 | |
| 7 | 27.1 | run_node `dom-click` | `rejected.target_not_found` | 4 to 5 | |
| 8 | 29.9 | detect_repeating_structure | `structure.detected` | 5 | |
| 9 | 32.5 | detect_repeating_structure | `already_answered` | 5 | |
| 10 | 39.8 | run_node (inspect) | `inspect.succeeded`, page changed | 5 to 6 | |
| 11 | 42.6 | amend_draft (rerun d8) | `draft_rerun`, then `action.succeeded`, page changed | 6 to 8 | |
| 12-15 | 46.7-54.8 | amend_draft | **d12 amended, amended, amended, then `draft_unchanged`**; kept count 4, 5, 4, 4 | 8 to 11 | Keep/drop flip-flop on one step, four turns |
| 16 | 58.5 | run_node `dom-click` | `target_unobserved` / **`handle_not_in_packet`** | 11 to 12 | Named a handle the page packet does not hold |
| 17 | 61.3 | run_node `dom-click` | `answered_the_same_again` | 12 to 13 | Same call again |
| 18-19 | 64.1-66.9 | amend_draft | amended (3), amended (1) | 13 to 15 | |
| 20 | 70.0 | amend_draft (rerun d12) | rerun, `dom-click` `answered_the_same_again` | 15 to 17 | Third time |
| 21 | 77.7 | detect_repeating_structure | `page_is_not_the_content` | 17 | Item page, correctly |
| 22-23 | 80.7-83.5 | amend_draft | 1 applied / 3 refused, then 0 / 4 refused | 17 to 18 | |
| 24 | 86.0 | **completion 1 refused** | `bootstrap.cannot_reach_start_location` | 18 | Kept draft had no step going to the start location (`reachability/check.ts:57-95`) |
| 25 | 91.0 | run_node | `action.succeeded`, page changed | 18 to 19 | |
| 26 | 94.1 | amend_draft | 2 applied, 5 refused | 19 to 20 | |
| 27 | 107.3 | **completion 2 refused** | `llm_evidence_loop.dry_run_refused` | 20 | Draft did not replay clean (`flow-draft/dry-run.ts`) |
| 28 | 110.8 | amend_draft (rerun d17) | rerun, `action.succeeded`, page changed | 20 to 22 | |
| 29-30 | 116.1-118.9 | amend_draft | 1 applied each, 1 and 5 refused | 22 to 24 | |
| 31 | 122.0 | amend_draft (rerun d11) | rerun `dom-extract_list`: **`output_not_observed` / `list_never_appeared`** | 24 to 26 | A read of a list that is not there |
| 32-34 | 135.8-142.1 | decision_unusable | **`llm_output.invalid_evidence_decision` x3 in a row** | 26 | No usage recorded for these three |
| 35 | 149.0 | run_node | `action.succeeded` | 26 to 27 | |
| 36 | 152.0 | amend_draft | 3 applied, 3 refused | 27 to 28 | |
| 37 | 156.4 | run_node | `action.succeeded`, page changed | 28 to 29 | |
| 38 | 159.1 | detect_repeating_structure | `handle_not_in_packet` | 29 | |
| 39-40 | 164.2-169.2 | run_node | `action.succeeded` x2, page changed | 29 to 31 | |
| 41 | 173.3 | **completion 3 refused** (final decision) | `bootstrap.completion_profile_limit_exceeded` | 31 / 17 | Loop ends |

Totals over 41 decisions: 16 amendments (8 of them carrying refused targets),
10 applied actions (counting reruns), 6 refused node runs, 3 malformed
decisions, 3 refused completions.

## Divergence point and causes

The build did reach the item page and acted on it (#21 onward is the listing,
where `detect_repeating_structure` correctly says it is not a list page). It
diverged in how it tried to finish. Every completion was refused for a
different reason, one reason per attempt, and the third refusal came when the
budget allowed no further decision.

### Cause 1 (new): the final forced completion was refused by an unnamed profile limit

- The token budget made #41 the last decision. Before it, 489,854 tokens were
  spent over 37 reported decisions (about 13,239 each), and the 3
  unusable replies with no usage count against the budget as well. So
  600,000 - 489,854 - 4 x 13,239 = 57,190, which leaves room for exactly one
  more 56,000-token reservation (`!FluxIQ/.../runtime/llm/loop-budget.ts`). The
  loop then offers only `complete` ("This is your last decision").
- That completion was refused by `isAutomationStudioEvidenceFlowBootstrapResultWithinLimits`
  (`!FluxIQ/.../llm/harness-options/bootstrap-completion.ts:190-191`,
  `flow-bootstrap/plan/evidence-schema.ts:92-104`) against
  `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_LIMITS`
  (`flow-bootstrap/plan/limits.ts:22-32`): summary at most 240 characters,
  result at most 12,000 bytes, at most 16 nodes and 24 edges per subflow, at
  most 16 parameters per node. The issue carries only the code and the path
  `result`, so neither the model nor this debug can tell which limit was
  exceeded. Since the kept draft was small (4 kept steps at #36, plus the
  applied actions at #37, #39 and #40), the 16-node cap is the least likely.
  The summary length, the result bytes, or the model's own reply plan (used
  whenever a proposed draft step is not writable, `bootstrap-completion.ts:166-170`)
  are the candidates.
- Two failures compound: a refusal that does not say which limit, and a final
  decision that leaves no turn to act on any refusal at all. As in run 2, the
  exhausted build writes nothing (`!FluxIQ/.../llm/evidence-loop.ts:353-365`).

### Cause 2 (new): completion gates refuse one problem per attempt

Three attempts, three different gates: reachability (#24), dry run (#27),
profile limits (#41). Each refusal is correct on its own, but the model learns
one problem per completion, and each attempt costs a decision plus the
amendments that answer it. A completion that reported every failing gate at
once would have given the model all three problems at #24, with 17 decisions
still in hand.

### Cause 3 (known): draft churn and stalled repeats

16 of 41 decisions were amendments. #12-15 flip the same step (d12) back and
forth four times. #16, #17, #20 repeat one refused click three times
(`handle_not_in_packet`, then `answered_the_same_again` twice). #32-34 are
three malformed decisions in a row. This run predates Core 8b56084's stall
redirect.

### Cause 4 (likely, related to run 1's shadow-DOM cause): the store coupon is not in the packet

The instruction asks to collect the store's coupon. Its "Get coupons" button is
inside `fb-store-coupon`'s open shadow root
(`apps/scenario-lab/src/scenarios/crossborder-marketplace/client/item-script.ts:160-191`),
and the snapshot never enters shadow roots
(`apps/extension/src/content/dom-snapshot.ts:254`). The model's repeated click
on a handle "not in packet" at #16, #17 and #20, while on the item page, fits a
model trying to press a control it was never given. The bundle does not record
the handle it named, so this is likely, not proven. The first claim also always
fails with "Network busy, please try again" by design (`manifest/steps.ts:58-61`),
so even a visible button needs a second press.

## Ranked for fixers

1. **Cause 1**: name the exceeded limit in the refusal, and never let the
   forced final decision be refused without a Flow being written (write the
   proposable steps, as for run 2).
2. **Cause 2**: run every completion gate on each attempt and return all
   failures together.
3. Cause 4 (shadow DOM in the snapshot) is shared with runs 1 and 3.
4. Cause 3 is the known stall. Re-measure on Core 8b56084.

## Not verified

- Which profile limit #41 exceeded (see cause 1).
- Which step failed the dry run at #27.
- The handle named at #16, #17 and #20, and so whether it was the shadow-DOM
  coupon. The bundle keeps codes only, and the Lab deletes the run root with
  Core's store (`packages/test-runner/src/run-scenario.ts:600-602`).
- Whether the variant choices, quantity and cart add ever succeeded on the page.
