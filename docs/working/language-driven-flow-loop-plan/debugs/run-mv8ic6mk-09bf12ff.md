# Debug: run-mv8ic6mk-09bf12ff

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `project` (A8 round one, launch 8,
  2026-10-14, pair downstream `24dacba5` / Core `9b4c5a38`), lane tree `fxwork/t566`. Full analysis:
  `automation-project-agents-plan/reports/a8-social-run-mv8ic6mk-debug.md`.
- Verdict: failed, no Flow, $0.103 billed, 272 steps.
- What happened: `confirm_requests` came back done every time; `read_accepted` stored exactly the right four rows on
  every trial, yet came back partial four times; three amends chased the wrong cause; a reset and an honest ending.
- Cause (product defects, Core, mode `project`): (1) a builder whose trial had passed completed with its receipt plus
  `ended: partial`, refused four times as `subflow.ending_shape` without being told to send the receipt alone
  (`flow-bootstrap/subflow-candidate/builder-loop.ts:228-245`), so the passing proposal was reported partial; (2) a
  subflow trial runs its predecessor inside it, so the judge's quote check covers the predecessor's reads while the
  judge is given only this subflow's part (`service/project-build/subflow-trials.ts:101-110`,
  `result-verification/request-rows/unquoted-rows.ts:60-84`): `not_judged` three times; (3) t594's out-of-scope rule
  told judges to answer no to the predecessor's presses Core itself put in the trial
  (`service/project-build/task-checklist.ts:48-50`).
- Fix: one Core task after round two (to keep the comparison pair frozen); the candidate run of this task goes first.
