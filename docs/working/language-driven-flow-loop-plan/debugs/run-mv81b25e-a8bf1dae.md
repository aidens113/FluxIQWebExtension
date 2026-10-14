# Debug: run-mv81b25e-a8bf1dae

- Instance: a8-slot-4, task `everything-store-plus-earbuds-under-50`, authoring mode `project` (A8 round one, launch
  5, 2026-10-14, pair downstream `269de980` / Core `048a1d91`, 250-call cap), lane tree `fxwork/t567`.
  Steps: `lab-runs/2026-10-14/run-mv81b25e-a8bf1dae/steps/`.
- Verdict: failed, no Flow, $0.0032 billed, 11 steps.
- What happened: the supervisor planned without looking: one subflow `collect_earbuds` (parts p1, p2, output
  `earbuds`). Core sized its briefs 116-117 turns; both dispatches came back `blocked`,
  `llm_evidence_loop.invalid_configuration`, 0 calls; it re-read the task and ended honestly.
- Cause: as run-mv816jbn-2310bedd (brief turns above the builder loop's 64).
- Fix: Core t577 (`3a2cb555`).
