# Debug: run-mv7vl89u-917d62a6

- Instance: a8-slot-2, task `bigbox-retail-pickup-cart`, authoring mode `project` (A8 round 1 after t569,
  2026-10-14, pair Core `e56fec59`), lane tree `fxwork/t565`. Steps: `lab-runs/2026-10-14/run-mv7vl89u-917d62a6/steps/`.
- Verdict: failed, no Flow, $0.0785 billed.
- What happened: the supervisor wrote its plan on the first try (the t569 planning format works) and dispatched;
  builders made 38 successful actions and 9 observations, a few rejected actions (target unobserved, not found,
  covered, address not shown), three repeat refusals and one malformed provider reply. No builder submitted a
  subflow before the build ended `flow_bootstrap.run_budget_calls_exhausted` (64 calls), then
  `flow_bootstrap.post_provider_validation_failed`.
- Cause: the same as run-mv7vk3ol-9e11b266: builders had no call share, so the run-wide cap ended the build before a
  builder's own wrap-up could make it submit.
- Fix: task t570.
