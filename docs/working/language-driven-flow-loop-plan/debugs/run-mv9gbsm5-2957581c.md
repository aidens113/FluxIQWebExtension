# Debug: run-mv9gbsm5-2957581c

- Instance: a8-slot-2, task `bigbox-retail-pickup-towels`, authoring mode `project` (A8 wave 8, 2026-10-15, pair
  downstream `003c3353` / Core `be766f29`, after t629 and t630), lane tree `fxwork/t565`. Steps: 136. Full analysis:
  `automation-project-agents-plan/reports/a8-towels-run-mv9gbsm5-debug.md`.
- Verdict: failed (`lab.chat_build_failed`), no Flow; $0.082.
- What happened: the trials at 0051, 0080, 0084 and 0108 stored exactly the oracle's 9 rows in order; 6 of the 8 judge
  calls on them were wrong (they asked to drop name conditions that on their own left out no row, or called settled
  rows dropped in a wording t629's patterns do not match). Every other revision kept a holder row and was rightly judged
  no (t628's kind exclusion stood). Each builder swung between the two Flows, hit `candidate.unchanged_after_no` (0055,
  0124) and ended on the repeat guard. t630 rightly stayed silent; the delivery-counted-as-today cause does not appear.
- Cause (product, Core judge): a no is refuted by its wording, not by the conditions or rows it references; no memory
  across a subflow's trials of an exclusion the judges upheld.
- Fix: Core t631 (refute by referenced conditions and rows against the read account), t632 (upheld exclusions held
  across trials; the refusal names the right submit tool).
