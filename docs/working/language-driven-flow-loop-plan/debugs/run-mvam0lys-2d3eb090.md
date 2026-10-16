# Debug: run-mvam0lys-2d3eb090

- Instance: a8-slot-4, task `bigbox-retail-pickup-towels`, authoring mode `candidate` (A8 wave 42, 2026-10-16, frozen pair 8, downstream `2d32847e` / Core `f7a0c4d1`, round 1), lane tree `fxwork/t567`.
  Steps: 84.
- Verdict: **failed** (`lab.chat_build_failed`): out of time after 8 trials; $0.125 of $0.25 (higher rate).
- Cause (general; t663 not involved, t664 not reached): revision 3 (trial 0042) stored exactly the oracle's rows, but
  one no stood on a sentence blaming the "4 & up" filter, which Core measured as removing no row, because the step
  check skips a sentence that also names a condition; Core weighed judge text clipped at 500 characters (0063
  mislabelled) and missed a false "dropped" claim in a colon clause (0069); later revisions followed refuted advice.
  The unsure trials stored the right rows on a one-yes-one-no split; both kept-condition refusals were right. Full
  chain: `docs/working/automation-project-agents-plan/reports/a8-towels-run-mvam0lys-debug.md`.
- Fixes (built during the pair, merged after it): the full judge text weighed, step blame checked clause by clause,
  colon clauses and spelled labels read, conditions that leave rows out only together kept, a filter whose option is in
  the request re-asked, together rows in the row pools.
