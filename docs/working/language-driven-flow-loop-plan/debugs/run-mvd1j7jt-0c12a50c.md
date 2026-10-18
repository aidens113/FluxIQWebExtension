# Debug: run-mvd1j7jt-0c12a50c

- Instance: bf-slot-3, task `social-network-feed-delete-stranger-requests`, authoring mode `project`, 2026-10-17
  UTC, lane tree `fxwork/t566` (downstream `fb3919e2` + lane-3 fixes 1-3, Core `76d66fe8` + fixes 2-3).
  Steps: 69 (`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvd1j7jt-0c12a50c/steps`). LLM calls: 36.
- Verdict: **passed**: Flow created, judged yes, the Lab's oracle passed (one row, Diego Alvarez, and the account
  shows only `rq_3d6b28: deleted`). Billed $0.028 of $0.25 (builder $0.017, supervisor $0.010). Largest decision
  input 39,657 tokens. 9.5 min.
- Shape: 27 decide, 8 judge, 6 submit_subflow, 4 test_subflow (no, execution_failed, no, yes), playback of 6 steps.
- Cause of any failure: none. Trial 1's condition kept the wrong rows and trial 3 was judged no on its filter;
  both were corrected by the builder from the judges' diagnoses.
- UI review: plan, dispatch and trial cards were clear; the playback's Delete dismissed one dialog layer
  ("cleared 1 layer: dialog Close"), shown in the run step summary.
- Next: the queue goes on.
