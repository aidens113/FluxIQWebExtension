# Debug: run-mv85un8j-beb734f5

- Instance: a8-slot-1, task `crossborder-marketplace-hub-to-cart`, authoring mode `project` (A8 round one, launch 6,
  2026-10-14, pair downstream `6fbf6b6f` / Core `2db229e9`, 250-call cap), lane tree `fxwork/t563`.
  Steps: `lab-runs/2026-10-14/run-mv85un8j-beb734f5/steps/` (75).
- Verdict: failed (`facility.contract`) after the build succeeded: Flow created, $0.0276 billed.
- What happened: the supervisor planned one subflow `add_hubs`; its builder got a proposal accepted in 15 calls
  ($0.014) and its subflow trial answered yes; assembly; the whole test was held for the trial's cart line
  (`project.trial_reset_required`); a reset brief undid it in 15 calls ($0.009); the whole test answered yes and the
  Flow was created. Before playback the Lab wrote the Flow's settings and Core refused them:
  `update-flow-settings (400): LLM execution limit is invalid.`, so no oracle ran.
- Cause (cross-repo contract): Core capped a Flow's settings at 64 calls in two places while the Lab, after t576,
  pins Core's 250 run backstop. The first full project-mode build to pass its judged run.
- Fix: Core t583 (both caps read `AUTOMATION_STUDIO_LLM_RUN_CALL_BACKSTOP`) and a downstream pin test (Lab cap ==
  Core backstop). The Lab still reports this failure only as `unclassified` at `scenario.execute`, though Core's error
  text was in the run's events (follow-up: the Lab's failure message drops Core's error text).
