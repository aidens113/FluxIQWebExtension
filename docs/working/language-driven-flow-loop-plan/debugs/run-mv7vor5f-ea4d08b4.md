# Debug: run-mv7vor5f-ea4d08b4

- Instance: a8-slot-4, task `everything-store-plus-earbuds-under-50`, authoring mode `project` (A8 round 1 after
  t569, 2026-10-14, pair Core `e56fec59`), lane tree `fxwork/t567`. Steps: `lab-runs/2026-10-14/run-mv7vor5f-ea4d08b4/steps/`.
- Verdict: failed, no Flow, $0.1708 billed (the furthest run).
- What happened: the supervisor planned and dispatched; a builder built `find_earbuds`, read all 5 result pages
  (94 rows seen per page read, 15 then 12 kept) and stored 13 rows in revision 2 and 10 in revision 3; its subflow
  trials answered unsure once and no four times. The judges' diagnoses contradict themselves within one answer
  ("that one is fine ... wait, the conditions are ..."), and revision 2's 13 rows match the 13 an earlier correct
  build of this task returned (run-mv4v1v25-c7d57567), so at least one "no" is likely a false judgement. The build
  ended `flow_bootstrap.post_provider_validation_failed` after the last trial, with the calls nearly spent.
- Cause: (1) the call share problem (t570); (2) judge reliability on filtered list reads, the same weakness the
  single-agent mode shows (run-mv79nrcx-112c5ed7, run-mv6qr7fk-77f30b49); not specific to mode `project`.
- Fix: t570 for calls; judge reliability is recorded as a cross-mode follow-up, not fixed in this round, so the
  comparison measures both modes against the same judge.
