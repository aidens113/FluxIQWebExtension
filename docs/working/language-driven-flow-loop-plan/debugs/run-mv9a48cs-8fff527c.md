# Debug: run-mv9a48cs-8fff527c

- Instance: a8-slot-4, task `everything-store-plus-earbuds-under-50`, authoring mode `project` (A8 wave 6, 2026-10-15,
  pair downstream `0638d45f` / Core `95cc9a7d`), lane tree `fxwork/t567`. Steps: 55, 27 model calls. Full analysis:
  `automation-project-agents-plan/reports/a8-everything-store-run-mv9a48cs-debug.md`.
- Verdict: failed (`lab.chat_build_failed`, issues `post_provider_validation_failed`, `project.build_blocked`), no Flow;
  $0.066.
- What happened: the supervisor planned two subflows (wave 5's pass planned one); the purse was split three ways
  ($0.077 a brief); the first builder's Next page failed twice (`action_failed`, 4 attempts: t623 counted the search
  form's default "All" option as an applied filter and faulted), its one trial stored 17 rows (13 asked plus 2
  sponsored, 2 accessories) and came back unsure, and it stopped with $0.018 left against a next call of about $0.025
  while the purse held $0.184; the second brief never ran (its predecessor never passed); the repair was refused
  before its first turn (`request_refused_evidence_denied_key`: t622's `yourSubflow` carried 7 raw `selector` keys);
  the supervisor ended blocked.
- Cause (product): Core t622 regression (denied keys in the repair context), downstream t623 regression (a default
  select option read as a filter; the fault's reason never reached the model), Core allowance that cannot grow while
  the purse has room.
- Fix: Core t625, downstream t626, Core t627.
