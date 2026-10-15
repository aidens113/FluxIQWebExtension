# Debug: run-mv9a4ah1-3269d74d

- Instance: a8-slot-3, task `social-network-feed-confirm-requests`, authoring mode `project` (A8 wave 6, 2026-10-15,
  pair downstream `0638d45f` / Core `95cc9a7d`, after t622-t624), lane tree `fxwork/t566`. Steps: 101.
- Verdict: **passed**: Flow created, the Lab's oracle passed ("The created Flow ran and met the task's judgement");
  $0.063 of $0.25.
- What happened: two builders returned done on passing trials (0012); assembly (0078); the whole test answered yes
  (0080); an interruption repair was opened (0085) and failed before its first turn,
  `flow_bootstrap.request_refused_evidence_denied_key`; the standing rescued pass was kept and the Flow completed on it
  (Core t622 working live; wave 5's identical run lost this pass).
- Defect it exposed (product, Core): the repair builder's request was refused by the evidence screen before it could
  act; the same refusal ended everything-store's repair in this wave (`run-mv9a48cs`). Suspected: t622's new
  `yourSubflow` repair context carries a key the web domain denies. Under investigation in
  `automation-project-agents-plan/reports/a8-everything-store-run-mv9a48cs-debug.md`.
- Next: fix the repair request; this pass counts toward the default flip (social's second `project` pass on a changed pair).
