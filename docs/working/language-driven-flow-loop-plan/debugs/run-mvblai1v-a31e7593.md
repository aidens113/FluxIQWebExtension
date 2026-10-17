# Debug: run-mvblai1v-a31e7593

- Instance: a8-slot-4, task `everything-store-plus-earbuds-under-50`, authoring mode `project` (cost round, 2026-10-16, downstream `a835db3b` / Core `8ac92ef1`, after Core t671-t684), lane tree `fxwork/t567`.
  Steps: 84.
- Verdict: **passed**: Flow created, judged yes, the Lab's oracle passed; $0.049 of $0.25, at the off-peak price rate.
- Shape: one subflow, one part. Brief 1 (build): revision 2's single-path test (the judged whole run, P5) answered no (two accessories kept among 15 rows); revision 3's test was refused `candidate.trial_unaffordable` (step 0037: `refusedBy llm_budget.run_cost_limit`, $0.008605 left of the judging reserve against $0.010857 for two judge calls) while the build had spent about $0.02 of $0.25, so the brief ended partial. Brief 2 (repair) re-tested revision 3 (no), revision 4 (not judged, then yes); completed. 29 decisions, 11 judge calls.
- Cause: a Core t679 defect. On the single path every builder test is a whole trial run under the supervisor's purse frame, so its judge draws on the judging reserve, which is sized for one judged run and one repair round (4 calls): after two tests it was spent, though the brief's own allowance (sized near the whole purse) was nearly untouched. A repair brief and a re-test followed that a funded third test would have made unnecessary.
- Next: Core t685 pays single-path tests from the brief's allowance with the reserve as the backstop; then this task runs again on this lane.
