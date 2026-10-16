# Debug: run-mvac0ddx-f52ba929

- Instance: a8-slot-2, task `bigbox-retail-pickup-cart`, authoring mode `candidate` (A8 wave 32, 2026-10-16, frozen pair 6, downstream `49b65bc9` / Core `4e51c1da`, round 1), lane tree `fxwork/t565`.
  Steps: 187.
- Verdict: **failed**: the Flow was created (trial yes) but its playback failed `web.target.not_shown` (a zero-size
  "Set as my store" after four obstructed attempts) and the oracle failed; $0.191 of $0.25 (peak pricing: the same
  tokens cost about half off-peak).
- Cause (general; t652-t655 played no part): the extension's recovery for an absent target on the optional "No thanks"
  step closed the store picker the Flow's own step had just opened, so the next step's button was hidden; the promo
  that races the picker press is the site's trigger, so the two passing trials were luck. Trial feedback called the
  hidden button "not found, step is right, test again" and the picker "a dialog the page put in the way", which wasted
  most of the 20 submissions. Full chain: `docs/working/automation-project-agents-plan/reports/a8-bigbox-cart-run-mvac0ddx-debug.md`.
- Fixes: never clear a layer the run itself opened; on a missing target clear only page-blocking walls (pending).
