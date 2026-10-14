# Debug: run-mv8mebid-84ada5bd

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `project` (A8 pair 2, wave 1,
  2026-10-14, pair downstream `4084cb98` / Core `30dceb9e`), lane tree `fxwork/t566`.
  Steps: `lab-runs/2026-10-14/run-mv8mebid-84ada5bd/steps/` (83).
- Verdict: failed, no Flow, $0.034 billed.
- What happened: `confirm_requests` and `report_accepted` came back done with passing trials (t599 and t601 worked);
  assembly; the whole test answered yes. Its steps show the site asked the run to slow down and Core's runtime recovered
  on its own; following the user's rule for interruptions, the supervisor sent a repair of `confirm_requests` naming that
  whole test, and Core refused it four times (`project.failing_receipt_passed`, t595), so the build ended without a Flow.
- Cause (product defect, Core): t595's rule that a repair names a failing trial clashes with the user's rule that an
  interruption in a test run becomes a branch; a passing trial with a runtime recovery is something to repair.
- Fix: Core t603 (such a repair is admitted and its builder sees the interruption; failing that, the passing whole test
  stands), merged after pair 2's candidate wave.
