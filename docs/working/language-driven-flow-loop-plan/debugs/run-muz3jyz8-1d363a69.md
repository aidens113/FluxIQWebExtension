# Run debug — run-muz3jyz8-1d363a69 (lane A round 7, qualifying run 2 in candidate mode, t342-slot-2)

Written after the run (2026-10-08 ~05:50 UTC). It was launched at 05:29:09 under round 7's expectations
(`run-muz3cqdh-927fd2f1.md`, "Expectations"): same product pair (Core 97772aeb, downstream 61add9df), same command,
instance, slot and workspace. No separate expectations file was written before launch: the launch window closed at
05:40.

**Supervision note.** The lead's step watcher attached to qualifying run 1's folder, because the new run's folder did
not exist yet when it first looked. This run was followed through its campaign log, not step by step. It stayed
within its ceiling and ended on its own.

## Result

**Failed.** Verdict `runtime.behavior` (`lab.chat_build_failed`). Issues:
`flow_bootstrap.evidence_repeat_without_progress` and `candidate.trial_execution_failed`. No Flow was created; the
oracle was not measured.

- Guard admitted at 05:29:22 (fingerprint `sha256:563e825a...`, the same as run 1).
- 30 calls, $0.033156:
  - chat: 1, $0.000071;
  - exploration: 5 runs, 3 describes and 2 finds ($0.012669);
  - submissions: 7, $0.008076;
  - trial requests: 6, $0.005866;
  - completion attempts: 6, $0.006474;
  - judges: 0.
- Build $0.033085.
- No Lab process was left running.

Six trials, all `start: "reset"`:

- **Revisions:** 1, 1 (re-test), 2, 3, 4 and 7.
- **Every trial did all the real work:**
  - the coupon succeeded after 2 attempts;
  - `dom-check` Space Grey, 7-in-1 and Spain succeeded;
  - quantity typed;
  - Add to cart succeeded.
- **Every trial then failed on the model's own last step:**
  - revision 1 waited for `wait_for_text "added to cart"`; the toast reads "Added to cart!" and is gone;
  - revisions 2-7 waited for `"Cart (3)"`, text that exists only in the closed mini-cart panel;
  - each timed out after 4 attempts.
- At 0039 the model wrote "the failing wait step is unnecessary, so I resubmit the Flow without it", but the script it
  sent still had the wait.
- **Completions:**
  - 0041 and 0043 were refused `candidate.trial_required`: revision 5 was never tested.
  - 0053-0059 were refused `candidate.trial_execution_failed`: revision 7.
  - Then the no-progress guard ended the build.
- **Ending (plain and honest):** "it kept trying without getting any further ... test-run from the start 6 times, and
  the last test run did not get to the end".

## Causes

**Q1: a fragile, model-invented confirmation step decides the trial.**

- The script's final `wait_for_text` is the model's own self-check. The text it picked, "Cart (3)", exists only inside
  the collapsed mini-cart (fixture `apps/scenario-lab/src/scenarios/crossborder-marketplace/markup/flyouts.ts:23`, `data-testid="mini-cart-count"`, and the cart page, `markup/cart.ts:25`).
- The trial feedback says only "the text did not appear before the timeout". It does not say that the text is on the
  page but hidden, or what the page shows where the model looked.
- Run 1 passed with an always-true "cart"; run 2 failed with a hidden one. The products' real work was identical and
  correct in all 8 trials.
- Fixes:
  - for a failed `wait_for_text`/assert, the trial feedback names whether the text is present but hidden (and in which
    control) or absent, and gives the nearest visible text: Core `runtime/service/candidate-trial/feedback.ts` and the
    domain's wait result `failure.actual`;
  - and/or tell the model not to add a confirmation wait, since the build-test judge checks the end state from the
    trial's evidence (candidate guidance, Core `flow-bootstrap/plan/flow-script-format.ts`).
  - A design decision: should a candidate whose every act succeeded go to the judge despite a failed self-check? Today
    no judge sees it.
- Verified by the lead from the six trial records and the scripts.

**Q2: the model claimed a change it did not make.** At 0039 the summary says the wait was dropped; the script kept
it. This is a model error, not a system defect. Nothing to change beyond Q1.

Not run: replay (no Flow).
