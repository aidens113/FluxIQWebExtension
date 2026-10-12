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

The Lab's rule, not the product (t448, report `state-aware-recovery-plan/reports/t448-repair-replay-success-rule.md`).
In replay `8e6a87e3-…` attempt #8 (node s8, a press) was refused by the page as busy (`web.action.rate_limited`,
nothing landed) and its automatic retry (#9) succeeded: the user's rule that one too-early attempt never fails a step.
The old rule failed the replay on that recovered attempt. t448 (merged `6669025f`): a replay's Flow succeeded when the
run succeeded, every step's last attempt ended well, no step was cleared by a person, and no skipped step is marked
not done (t444). The product behaviour of this run passed.

## UI review

Chat flow as in R4a; no new wording defects seen in the step log summaries. The final judge notes the cart badge still
reads "0 Cart" on the item page (site behaviour, not a Flow step).

## Next

Rerun R4b once on the synced tree for a clean verdict under the corrected rule.
