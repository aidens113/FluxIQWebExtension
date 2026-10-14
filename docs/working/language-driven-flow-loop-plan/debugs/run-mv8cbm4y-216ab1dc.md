# Debug: run-mv8cbm4y-216ab1dc

- Instance: a8-slot-4, task `everything-store-plus-earbuds-under-50`, authoring mode `project` (A8 round one, launch
  7, 2026-10-14, pair downstream `760d42bf` / Core `6a81a391`), lane tree `fxwork/t567`.
  Steps: `lab-runs/2026-10-14/run-mv8cbm4y-216ab1dc/steps/` (102).
- Verdict: failed (`lab.chat_build_unfinished`), no Flow, $0.074 billed.
- What happened: the supervisor planned and dispatched one subflow; its builder (t584's fix in: it ran) explored the
  filtered list for about 90 steps and had not returned when the Lab's chat deadline passed.
- Cause (Lab defect): as run-mv8cam5t-436efa46, the Lab's 795 s chat deadline is shorter than a project build.
- Fix: t592. Whether this builder would have finished inside its own 540 s loop bound and been judged right is for the
  relaunch to show.
