# Debug: run-mv85xmgq-8a6a6f43

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `project` (A8 round one, launch 6,
  2026-10-14, pair downstream `6fbf6b6f` / Core `2db229e9`), lane tree `fxwork/t566`. Full analysis:
  `automation-project-agents-plan/reports/a8-social-run-mv85xmgq-debug.md`.
- Verdict: failed, no Flow, $0.040 billed, 139 steps; the candidate was never tested.
- What happened: `confirm_requests` came back done with a passing subflow trial; the whole test answered
  `project.trial_reset_required`; two reset briefs tried to build instead of undoing and were stopped by the repeat and
  wrong-target guards (one confirmed a request the person excluded).
- Cause (product defects, Core): the supervisor's whole test demands a model reset before its gate runs and its gate is
  built without the start hook candidate mode and builder trials use, while this site has no control that undoes a
  confirmed request; and a reset brief's model gets the build instruction, seeing the acts to undo only after a refused
  completion.
- Fix: Core t586 (the whole test uses the trial gate with the start hook; a reset brief only for what the hook leaves),
  t585 (a reset brief's model is given its acts to undo from its first decision). Not done: a hard refusal of new
  lasting acts during a reset, which would restrict actions beyond the user's permission rule (open question for the
  user).
