# Debug: run-mv8k9k2e-1f1065a8

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `candidate` (A8 round two,
  2026-10-14, the frozen pair of launch 8; the Lab's guard scripts updated by t600 only), lane tree `fxwork/t566`.
- Verdict: failed (`runtime.behavior`) with the Flow created and **the Lab's oracle passed**, $0.048 billed.
- What happened: the single build loop built the Flow, the whole test passed, the Flow was created and its replay
  reached the oracle's expected state; the Lab then failed the run because "Core published no provider call accounting
  for 1 of 1 replay(s) of the applied Flow, so whether they called a model is unknown".
- Cause: a Core/Lab contract gap on the replay's provider-call accounting (crossborder's and bigbox's replays published
  it); under investigation.
- Comparison: on the product question this task passed in mode `candidate` and failed in mode `project` (launch 8).
