# Debug: run-mva6mlo8-f519063c

- Instance: a8-slot-4, task `bigbox-retail-pickup-towels`, authoring mode `candidate` (A8 wave 27, 2026-10-15, frozen pair 5, downstream `ee0723db` / Core `8c39a3f7`, round 1), lane tree `fxwork/t567`.
  Steps: 80.
- Verdict: **failed** (`lab.chat_build_failed`): ran out of time after 8 trials; $0.083 of $0.25.
- Cause (general; not a t650/t651 regression, neither fired): the 9-row results matched the oracle exactly, but the
  judges disputed them with objections naming nothing real, and Core could not answer: a split's no went unlabelled
  where Core's record refutes part of it, kept conditions came only from a double no, Core records nothing of what a
  site filter left out, a no naming an unseen row was not refuted, and four judge replies looped to the provider's
  output ceiling and were lost. Pair 4's project towels passed on lucky judge draws. Full chain (both runs and the
  passing pair-4 run): `docs/working/automation-project-agents-plan/reports/a8-towels-run-mva6mlo8-debug.md`.
- Fixes: Core t652 (split labelled; kept conditions from any trial; what a narrowing step left out recorded), t653 (a
  judge reply that loops keeps its verdict), t654 (a claim about a row the read never saw is refuted).
