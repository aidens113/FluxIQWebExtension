# Debug: run-mv8i8r0u-0b564e8b

- Instance: a8-slot-1, task `crossborder-marketplace-hub-to-cart`, authoring mode `project` (A8 round one, launch 8,
  2026-10-14, pair downstream `24dacba5` / Core `9b4c5a38`), lane tree `fxwork/t563`.
  Steps: `lab-runs/2026-10-14/run-mv8i8r0u-0b564e8b/steps/` (79).
- Verdict: **passed**: Flow created, the Lab's oracle passed, $0.0286 billed. The first `project` build to pass end to
  end.
- What happened: the supervisor planned `add_hub_to_cart` (p1) and `collect_coupon` (p2, after it) and dispatched both;
  `add_hub_to_cart` came back done on its third revision in 20 calls, `collect_coupon` done in 8, each trial yes;
  assembly; the whole test answered yes; the Flow was created and played back.
- Why it passed where launch 7 failed: the first builder no longer did the coupon (the subflow judge now sees the other
  part as out of scope, t594), each phase started from the shared start (t593), and the coupon builder's entry was
  prepared from the passing first subflow (t580, t585).
- Next: round one continues; the same task in mode `candidate` in round two.
