# Run debug — run-mv0pa79q-ef91811b (lane C round 2, candidate mode, t274-slot-1)

Written in round 3 (2026-10-12 UTC) from the round 2 lead's findings in
`docs/working/mvp-final-month-plan/reports/lane-c-candidate.md` ("Round 2") and the UI review
`reports/lane-c-candidate-ui-r2.md`; the round 2 lead was stopped before writing this file. Evidence:
`test-runs/instances/t274-slot-1/run-mv0pa79q-ef91811b/` (`steps/`, `snapshots/`) and
`run-mv0pa79q-ef91811b.ui-review.local/`.

## Header

Lane C, task `everything-store-plus-earbuds-under-50`, candidate mode, flash, $0.10 ceiling, 48 calls. Tree at
downstream `eb2ffa12`, Core `dcaf8f9f`. Launched 08:24:46 UTC 2026-10-09, first call 08:29:06, ended 08:30:56.

## What happened

Explored well: Decline cookies (`t121`), Not now, search, read page 1 with a correct filter, Next page to pages 2-5
and read each (paging held past the broken page-2 Next). Never submitted a script: it believed every page had to be
read first. At 3 decisions left the wrap-up offered only `complete`; four completions were refused
`candidate.latest_submission_required`, the third identical one ended the build
`flow_bootstrap.evidence_repeat_without_progress`. No Flow, no trial, no judge, oracle not measured, no replay.

## Cost

23 calls, $0.086080 (build $0.085885 of $0.10): chat $0.000195, exploration $0.074295, refused completions $0.011590.
Launched in DeepSeek's peak (about double the uncached price of round 1).

## Causes (file:line as of round 2) and status on dev 2026-10-12

| # | Cause | File | On dev 2026-10-12 |
| --- | --- | --- | --- |
| R2-1 | Wrap-up offered no tools, withdrawing `core.submit_candidate` | Core `runtime/llm/evidence-loop.ts:641-642`, `loop-budget.ts:133-135` | Fixed (t383: candidate wrap-up from 5 decisions left keeps submit and test) |
| R2-2 | Completion refusal does not say nothing was submitted, nor name the submit tool | Core `runtime/flow-bootstrap/candidate/authoring-loop.ts:44` | Open: fixed in round 3 (see lane-c-round3.md) |
| R2-3 | Domain Lists line gives the legacy `amend_draft repeat` recipe; nothing says one page and one Next page are enough evidence | downstream `domain/src/runtime/llm-evidence/system-instructions/instructions.ts:53` | Open: fixed in round 3 |
| R2-4 | `core.submit_candidate` is `effect: "observe"`, so look withdrawal also withdraws it | Core `runtime/llm/decision-handlers/look-withdrawal.ts:85`, `authoring-loop.ts:36` | Open: fixed in round 3 |
| R2-5 | A build that never submitted ends "it kept trying without getting any further" | Core `service/candidate-failure/refusal-codes.ts`, `conversations/commands/progress.ts:163` | Open: fixed in round 3 |
| R2-6 | Model waste: `kind: callId`, repeated structure looks, one misshaped read | - | Model; Core's notes were correct |
| R2-7 | Page 1 filter had no accessory test | - | Model reasoning; judged by trial |

## UI

See `reports/lane-c-candidate-ui-r2.md`: the four refused completions show as "Checking whether the Flow is finished"
paragraphs with no refusal card; the ending gives no cause.
