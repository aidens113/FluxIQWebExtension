# Debug: run-mvahlxuu-760d9e28

- Instance: a8-slot-4, task `bigbox-retail-pickup-towels`, authoring mode `candidate` (A8 wave 37, 2026-10-16, frozen pair 7, downstream `813a3340` / Core `917ca845`, round 1), lane tree `fxwork/t567`.
- Verdict: **failed**: the build's trial was judged yes on a wrong result and the Flow was created; playback stored the
  same 10 rows (the oracle's 9 plus a paper towel holder, the only row with no `unitPrice`); the playback's judges named
  the holder, Core refuted the result, and the oracle failed on records; $0.123 of $0.25 (peak price).
- Cause (general): every gate a yes must pass is about rows a condition left out, none about rows the read kept; the
  build's first two nos gave a wrong reason (they wanted "Pickup tomorrow" rows), Core rightly refuted it, and the
  re-ask, naming only left-out rows, turned both calls into a yes. t662's playback hold did not fire though its rule
  said it should, and had it fired it would have set aside two correct nos. Full chain:
  `docs/working/automation-project-agents-plan/reports/a8-towels-run-mvahlxuu-debug.md`.
- Fixes: Core t663 (kept rows checked before a yes), t664 (the playback hold only sets aside nos Core refutes, and says
  why it did or did not fire).
