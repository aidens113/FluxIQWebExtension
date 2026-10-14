# Debug: run-mv8c7unr-42a8456d

- Instance: a8-slot-2, task `bigbox-retail-pickup-cart`, authoring mode `project` (A8 round one, launch 7,
  2026-10-14, pair downstream `760d42bf` / Core `6a81a391`), lane tree `fxwork/t565`. Full analysis:
  `automation-project-agents-plan/reports/a8-bigbox-run-mv8c7unr-debug.md`.
- Verdict: failed (`lab.chat_build_unfinished`), no Flow, $0.112 billed, 337 steps.
- What happened: `switch_store` and `add_items` came back done (16 subflow trials, 32 judge calls, all right); the whole
  test failed to execute (`web.target.not_found`): it ran on the stale page the builders left, since the start hook
  resets only server state and the whole trial has no arrival. Eight repair briefs followed; none received the failing
  receipt, so each rebuilt the same subflow and reassembly was rightly refused unchanged; builders with no predecessor
  began on leftover state. The Lab's chat deadline ended the run mid-repair.
- Cause (product defects, Core): no shared start for a build's phases (the whole trial lacks the arrival subflow trials
  have; entry preparation runs no start hook for a builder without predecessors; the assembled Flow begins with no
  arrival); repair briefs carry no failure; no guard on a repair that changes nothing.
- Fix: the launch-7 tasks (phase start, supervisor-side), t592 (the deadline).
