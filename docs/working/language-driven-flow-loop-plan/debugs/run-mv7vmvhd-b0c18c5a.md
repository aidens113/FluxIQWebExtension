# Debug: run-mv7vmvhd-b0c18c5a

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `project` (A8 round 1 after t569,
  2026-10-14, pair Core `e56fec59`), lane tree `fxwork/t566`. Steps: `lab-runs/2026-10-14/run-mv7vmvhd-b0c18c5a/steps/`.
- Verdict: failed, no Flow, $0.0776 billed.
- What happened: the supervisor planned and dispatched; a builder built the `confirm_requests` subflow (its read saw
  8 rows and kept 4 by the mutual-friends condition), submitted it and tested it five times: four answered
  `subflow.trial_not_judged` ("The checks did not provide the required exclusion evidence, so the result remains
  unconfirmed"), the fifth `subflow.trial_yes`. The build then ended `flow_bootstrap.run_budget_calls_exhausted`
  before assembly and the whole trial, then `flow_bootstrap.post_provider_validation_failed`.
- Cause: (1) the call share problem of run-mv7vk3ol-9e11b266; (2) the subflow trial does not give its judge the
  row-local exclusion evidence the whole-candidate trial gives (t525), so a correct subflow is left unjudged at random
  and each retest spends a trial and its judges.
- Fix: task t570 (call shares, Core-sized briefs, permitted acts from parts, interface lines; the subflow trial reuses
  the candidate trial's exclusion evidence).
