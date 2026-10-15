# Debug: run-mv9ul5dy-e9a1b1c1

- Instance: a8-slot-2, task `bigbox-retail-pickup-towels`, authoring mode `candidate` (A8 wave 14, 2026-10-15, frozen
  pair 2, downstream `805f7cbd` / Core `797452c1`), lane tree `fxwork/t565`. Steps: 87. Full analysis:
  `automation-project-agents-plan/reports/a8-towels-run-mv9ul5dy-debug.md`.
- Verdict: failed (`lab.chat_build_failed`, the build's time limit), no Flow; $0.066.
- What happened: trial 2 (0032) stored exactly the oracle's 9 rows in order and was judged no on advice Core's record
  partly refutes; in a double no `agreement.ts` `bothReadings` labels only fully refuted readings, so the advice reached
  the builder unlabelled; following it, revision 4 dropped the "Sponsored" condition and revision 5 the "Pickup today"
  condition, and no later revision got every clause back (trials 3, 5, 6, 8: right rows, two swapped; 1, 4, 7, 9, 10:
  extra rows). Every other no was right; trials 9 and 10 got one wrong yes each, rightly held. The `project` run on this
  pair passed: its plan keeps every clause, which the candidate loop lacks.
- Cause (product, Core): partly refuted advice passed on unlabelled; nothing remembers a condition Core's record showed
  removes nothing the request asks for, so a revision may drop it; the re-test advice keys on "one judge said yes"
  rather than Core's findings.
- Fix: after round 2 of frozen pair 2 (no fixes mid-pair): label partly refuted readings, remember conditions the record
  vindicated and refuse once a revision that drops one, key the re-test advice on Core's findings.
