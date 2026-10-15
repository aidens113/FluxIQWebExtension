# Debug: run-mv9zn5ob-d929084d

- Instance: a8-slot-3, task `bigbox-retail-pickup-cart`, authoring mode `project` (A8 wave 17, 2026-10-15, frozen pair 3, downstream `8b770037` / Core `8b322a95`, round 1), lane tree `fxwork/t566`.
  Steps: 340 (165 decisions, 134 tool calls).
- Verdict: **failed** (`lab.chat_build_failed`): the supervisor ended the build, no Flow saved; $0.120 of $0.25.
- Cause (general to `project` mode; t641-t643 played no part): the plan invented a hand-off value (`storeName`) no step
  could make or use; Core accepted it; the producer builder switched the store but was refused 14 times handing the
  value on and ended with code-only reasons; the supervisor then amended the plan to drop the person's store-switch
  request into `notAsked`, which Core accepted; every later trial started from the reset store, where pickup is
  unavailable, and the build ended with a false "cannot be done". Full chain, fixes and UI review:
  `docs/working/automation-project-agents-plan/reports/a8-bigbox-cart-run-mv9zn5ob-debug.md`.
- Fixes: t645 (an amendment may not drop a request; an output the subflow cannot make is the plan's to change), t646
  (one read value expressible; the script-format example), t647 (a trial says when it explored on an act the reset
  undid), t648 (a repair may revisit its own proposal's addresses), t649 (chat cards: refused never drawn as done, no
  codes, a waiting brief says it waits, the ending says why).
