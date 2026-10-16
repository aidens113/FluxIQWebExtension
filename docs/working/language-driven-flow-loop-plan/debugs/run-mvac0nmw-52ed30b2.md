# Debug: run-mvac0nmw-52ed30b2

- Instance: a8-slot-3, task `bigbox-retail-pickup-towels`, authoring mode `project` (A8 wave 32, 2026-10-16, frozen pair 6, downstream `49b65bc9` / Core `4e51c1da`, round 1), lane tree `fxwork/t566`.
  Steps: 178.
- Verdict: **failed** (`lab.chat_build_failed`): the supervisor ended with part of the Flow built, no Flow saved; $0.190
  of $0.25 (peak pricing).
- Cause (general): brief 1's `find_products` revision 6 stored exactly the oracle's 9 rows and was judged yes (0071);
  the supervisor, having ignored Core's reshape-only warning (0010), amended the plan to fold the table part in, and
  Core dropped the judged-yes proposal on that additive change (0089, `supervisor/state.ts`); the rebuild then lost
  its way on a builder trap (task-specific) and Core misreadings (a false unstated-exclusion mark, a missing-claim
  clause misparse that advised retests, a presence condition never accounted), and the purse ran out. t650 and t653
  worked; t654 was not exercised; t655's narrowing re-ask never fired. Full chain:
  `docs/working/automation-project-agents-plan/reports/a8-towels-run-mvac0nmw-debug.md`.
- Fixes: Core t658 (a done part survives an additive amend; reshape-only refused once), t659, t660, t661 (paid trials).
