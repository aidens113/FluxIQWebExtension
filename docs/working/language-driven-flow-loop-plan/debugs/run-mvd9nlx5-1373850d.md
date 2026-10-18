# Debug: run-mvd9nlx5-1373850d

- Instance: bf-slot-1, task `local-classifieds-test-ride-question` (a send at the permission point `Send`),
  authoring mode `project` (2026-10-18 UTC, downstream `48cdbfee` / Core `c1ed1bdd`), lane tree `fxwork/t563`.
  Steps: 257. LLM calls: 131.
- Verdict: **failed** (`runtime.behavior`): no Flow; the supervisor ended `partial` ("nothing was sent to any seller
  and nothing on the site was changed") at $0.089 of $0.25.
- How far it got: one subflow (find_and_message). Brief-1 searched, filtered and read the road bikes (the read saw 4
  rows, kept 3, condition `Sponsored` absent rejected 1), and its whole tests (it is a one-part plan, so the test is
  the judged run) ended `execution_failed` at step 14 "read the seller's name" (`web.dom-extract`, target bound to the
  text "Tomasz Wrona"): `web.target.not_found` after 4 attempts (submit 0145 lastTrial). It then resubmitted the
  same candidate (`candidate.unchanged_submission`) until repeat refusals stopped it (0147-0151). Repair brief-2 was
  stopped by three repeats of `web.detect_repeating_structure` refused `target_unobserved` / `handle_not_in_packet`
  (0250-0256). No permission ask was recorded (`permissionAnswers` none): no trial reached Send.
- Why it failed: NOT fully debugged (the session was wrapped up). Known: the seller-name read's target, found during
  exploration on the listing page, was not on the page the trial reached at step 14. Not established: whether the
  trial was on a different listing or page state than exploration (reset start, results order), or whether the
  element's identity (a name-text-bound target) does not survive a reload. Next step: compare step 14's trial page
  view with the exploration page view where the target was saved.
- UI review: not done for this run.
- Next: open; no rerun until the cause above is established.
