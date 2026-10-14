# Debug: run-mv7vk3ol-9e11b266

- Instance: a8-slot-1, task `crossborder-marketplace-hub-to-cart`, authoring mode `project` (A8 round 1 after t569,
  2026-10-14, pair Core `e56fec59`), lane tree `fxwork/t563`. Steps: `lab-runs/2026-10-14/run-mv7vk3ol-9e11b266/steps/`.
- Verdict: failed, no Flow, $0.0720 billed, 123 steps logged.
- What happened: the supervisor read the task and wrote its plan on the third try (two decisions refused
  `llm_output.unexpected_field`, an extra key the model then dropped), dispatched briefs (refused three times
  `project.brief_act_not_asked`, twice `project.allowance_unavailable`), and builders brief-1, brief-3, brief-4, brief-5
  explored and acted with bounded context (about 19k input tokens per builder decision). brief-3 completed its
  add_to_cart subflow. brief-4's submission was refused `subflow.interface_input_mismatch` (its part declared no
  `itemUrl` input the plan gives it). The build ended `flow_bootstrap.run_budget_calls_exhausted` (the Lab's 64-call
  cap) while brief-5 was exploring, then `flow_bootstrap.post_provider_validation_failed` / `project.build_partial`.
- Cause (product, mode `project`): allowances reserve dollars but not calls, so builders share the run's 64 calls with
  no share each and the supervisor; the supervisor also spent calls guessing permitted acts and allowance sizes that
  Core can derive, and a builder was not shown its part's interface lines.
- Fix: task t570 (call shares, Core-sized briefs, permitted acts from parts, interface lines in the brief).
