# run-mv4i1cls-463e4b5c: paid proof R4b relaunch; in-run repair held, the Lab's replay rule failed the run

Launched 2026-10-12 00:13 UTC by the supervisor from `fxwork/t418` (instance `t418-proofs`, workspace `t418-r4b-2`;
downstream `8f35c592`, Core `01621c94`, both at `dev`, rebuilt; t436-t447 in). Supervised live to its end with polled
reads. Gate before launch: provider-free recovery matrix, all 14 cases passed. Verdict recorded **failed**
(`runtime.behavior`); $0.0320 for the whole Flow against $0.10.

## What happened

- Build (00:14:01-00:15:15, 13 decisions, 73 s): the first submit was accepted (both earlier runs had one or two
  refused for unresolved parameters: t442 held live); trial passed first time; Flow applied.
- After the basket redesign the Flow ran: the saved "Add to cart" failed its first attempt and 3 retries
  (`web.target.not_found`); the model was called once to diagnose and once to patch (`temporary_target_override` onto
  the renamed "Add to basket", accepted by t446's rule); the run carried on, pressed it once and met the task's
  judgement ("answersRequest: yes": Space Grey, 7-in-1, Spain, quantity 3, coupon collected, nothing bought). This is
  the user's in-run repair rule working end to end: model only on a true failure, at the failing step, run carries on.
- The Lab then applied the repair and replayed once (run `8e6a87e3-…`): status succeeded, no model call, no harness
  activation, goal passed, but `flowSucceeded` false because the Lab requires every action's status to be
  `succeeded` (`packages/test-runner/src/flow-lane/repair/replay-repair.ts:131`), so the run is marked failed ("The
  applied repair did not hold").

## Defect

Under investigation (t448, report `state-aware-recovery-plan/reports/t448-repair-replay-success-rule.md`): which replay
action was not `succeeded`, and whether it was a step correctly not acted on (skipped as already done, option already
chosen, optional interruption absent) or a real failure.

## UI review

Chat flow as in R4a; no new wording defects seen in the step log summaries. The final judge notes the cart badge still
reads "0 Cart" on the item page (site behaviour, not a Flow step).

## Next

Close t448; if the rule was wrong, R4b's product behaviour passed and the proof is rerun once for a clean verdict.
