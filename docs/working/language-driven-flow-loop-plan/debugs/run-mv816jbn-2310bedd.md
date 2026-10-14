# Debug: run-mv816jbn-2310bedd

- Instance: a8-slot-1, task `crossborder-marketplace-hub-to-cart`, authoring mode `project` (A8 round one, launch 5,
  2026-10-14, pair downstream `269de980` / Core `048a1d91`, 250-call cap), lane tree `fxwork/t563`.
  Steps: `lab-runs/2026-10-14/run-mv816jbn-2310bedd/steps/`.
- Verdict: failed, no Flow, $0.0034 billed, 11 steps.
- What happened: the supervisor read the task, looked once, and wrote a sound plan: `add_to_cart` (parts p1, p3,
  output `cartCount`) and `collect_coupon` (p2) after it. Core sized both briefs 77 turns and 77 calls. Each builder
  came back `blocked`, `llm_evidence_loop.invalid_configuration`, 0 calls; the supervisor dispatched once more with
  the same result, then ended honestly, naming the refusal.
- Cause (product defect, t570 + t576): brief sizing gave a builder as many turns as calls, capped at 1000, but the
  builder's evidence loop refuses more than 64 turns (`loop-limits/evidence-loop.ts:35`) before its first call. Under
  the old 64-call purse no share reached 64, so t570's tests never met it; t576 raised the Lab's cap to 250.
- Fix: Core t577 (`3a2cb555`): sizing and the brief contract cap turns at the loop's own 64; a larger share keeps its
  calls for its trials' judges; an end-to-end case runs one builder on a 250-call build.
