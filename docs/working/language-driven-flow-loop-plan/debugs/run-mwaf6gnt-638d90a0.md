# Debug: run-mwaf6gnt-638d90a0

Status: Passed, 4 of 4 attempts right. The live check of the robot-check pause, the state-routed steps, the judge's read pages and the cover attribution, on the task where the user watched the restart (run-mwa19obz-abd5d558).
Source: t885, Core 74949e67f (82780c6dd pause, 1c47ea562 state-routed steps, 74949e67f read pages), Extension 46876e60c (a01070f2b cover attribution + dev with t889's `--attempts N`).
Task: crossborder-marketplace-free-hubs-under-ten, unchanged, `--attempts 4` (one exploring attempt, three deterministic), visible browser.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result per attempt

| Attempt | Verdict | Path | Flow | Continuation | Calls (interp / judge / decisions) | Time | Cost | Robot checks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | right | explore | flow.efc11b55 | - | 33 (1 / 5 / 27) | 538 s | $1.5360 | 5, each paused and cleared in place |
| 2 | right | run_flow_then_explore | flow.efc11b55 | held (from 1) | 4 (1 / 1 / 2) | 72 s | $0.1517 | 1, paused and cleared in place |
| 3 | right | run_flow | flow.efc11b55 | held (from 2) | 2 (1 / 1 / 0) | 51 s | $0.0496 | 2, paused and cleared in place |
| 4 | right | run_flow | flow.efc11b55 | held (from 3) | 2 (1 / 1 / 0) | 45 s | $0.0447 | 1, paused and cleared in place |

Whole run $1.7820 (ledger), exit 0. The Lab printed "NOT DETERMINISTIC" because the replays made model calls: the 2 per replay (interpretation and judge) are expected until S6 and S9 land; attempt 2's 2 decisions are observation 2 below.

## The robot check

Nine checks in all, every one a pause in place: the attempt went `waiting_for_person`, the Lab cleared the check and answered in the chat, and the same attempt went on with its call count and steps continuing (attempt 1: 7, 10, 15, 19, 24 calls across its five checks), never a new attempt and never back to page 1. Attempt 1 met five checks in one attempt, past the old bound of three. The restart the user saw does not occur.

## Observations

1. **Attempt 1 is expensive ($1.54, 5 judges).** Judges 0039 and 0049 answered unknown: the rows were right, but only page 1 was read, so they could not rule out a qualifying hub on page 2 just over 9,87 €. That is a fair doubt. The model then read page 2, and that read held unfiltered rows (ads, paid shipping, a charger, out of price order), so judge 0056 said no (the page-2 read appears to have lost the filters, plausibly after a check reload). It recovered and judge 0071 said yes. Not traced: whether the page-2 read was taken on the unfiltered list after a check.
2. **Attempt 2's saved Flow stopped at step 10** (0073, `web.output.dom-next_page` `web.action.failed`, `outcome_uncertain`). The model amended the Flow (0075, `strands_a_step`) and completed; attempts 3 and 4 ran the amended Flow whole with no decisions. Whether a Next page with nothing after it should end a read loop by page state rather than fail is not traced.
3. Judge requests carry `readPages` and its sentence in the question; judges after the fix no longer cite "only the end page is shown".

## Next

Breadth at `--attempts 4`: bigbox on Haiku next.
