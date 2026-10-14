# Debug: run-mv8pwn3z-f5a56606

- Instance: a8-slot-2, task `bigbox-retail-pickup-towels` (single part), authoring mode `candidate` (A8 round three
  comparison, 2026-10-14, pair downstream `4d885223` / Core `8d6239a8`), lane tree `fxwork/t565`. Steps: (95).
- Verdict: failed, no Flow, $0.066 billed.
- What happened: the same arc as the `project` run (run-mv8p37k8-f1a90624): the right rows without the seller filter;
  it found the Retailer filter only by describing a checkbox whose raw value named it, and ran out before that revision
  was judged.
- Cause: the same web-domain page-view defect (legends dropped); shared by both modes, so it does not separate them.
- Fix: as run-mv8p37k8-f1a90624.
