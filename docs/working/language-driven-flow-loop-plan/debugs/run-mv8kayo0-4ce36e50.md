# Debug: run-mv8kayo0-4ce36e50

- Instance: a8-slot-4, task `everything-store-plus-earbuds-under-50`, authoring mode `candidate` (A8 round two,
  2026-10-14, the frozen pair of launch 8), lane tree `fxwork/t567`. Steps: `lab-runs/2026-10-14/run-mv8kayo0-4ce36e50/steps/` (74).
- Verdict: failed, no Flow, $0.069 billed.
- What happened: seven whole tests; three stored 13 rows (the oracle's count) and came back `not_judged`, "the checks
  did not provide the required exclusion evidence"; one `unsure`; the rest wrong row counts, judged no.
- Cause: the same Core judge defect as the `project` run of this task (run-mv8id5vg-ed7b89fe): rows left out by
  presence and attribute conditions must each be quoted and named, and Core settles only numeric bounds. Shared by both
  modes, so it does not separate them.
- Fix: Core t599 (settle presence and absence rows Core measured; short ids for naming rows), merged after round two.
