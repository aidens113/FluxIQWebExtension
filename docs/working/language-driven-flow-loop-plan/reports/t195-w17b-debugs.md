# t195-w17b — debugs of seven unattended pickup-order runs

Worker t195-w17b (lane D, lead t195), 2026-09-30. Brief: write the missing debug files for the seven
`bigbox-retail-pickup-order` runs that the overnight relaunch loop started and no agent debugged.

## Outcome

Done. Seven debug files written under `docs/working/language-driven-flow-loop-plan/debugs/`.

## One line per run

| Run | Cost | Stage reached | Verdict | Causes |
| --- | --- | --- | --- | --- |
| `run-munzbfbj-2fb8947d` | $0.0534, 32 calls | 2 | **failed, stopped elsewhere** (Lab said `passed`): `move_money` on an **unnamed** control ("step") on the **cart page**; the Lab counts `controlName: null` as the declared point | Lab `permission-point.ts:37` passes unnamed; Core asks without a control name; model declared money on a cart press; dry runs re-did cart acts (napkins ×2, towels saved) (t196); draft cap (t200); act check refuses the refused press (`step_changed_nothing`), so no completion can pass after the ask |
| `run-munzihwx-47ccdf7c` | $0.0924, 52 calls | 2 | **failed, stopped elsewhere**: `move_money` at **"Continue to checkout"** (button) | model declared money on Continue to checkout (gate trusts it); press re-tried 5×; towels saved for later; 5 dry runs (t196); cap (t200) |
| `run-munzrj6r-6f754710` | $0.0712, 39 calls | 2 (completion accepted at 38, ended at review) | **`stopped_for_permission`** at "Place order", `flowCreated: false` — not a pass | panel/overlay say "Flow ready / a Flow is proposed" with no Flow (t191); 120 s ask (L1); Pay-at-pickup 4 checks; dry runs (t196); cap (t200) |
| `run-munzz9j1-f8c30ff5` | $0.0927, 49 calls | 2 | **`stopped_for_permission`** at "Place order", no Flow | slot 3pm–4pm with 2pm–3pm open (repeat r5 #6); post-ask completions refused to the end; 120 s ask; dry runs (t196); cap (t200); `handle_not_in_packet` ×4 (t200 if a cap) |
| `run-muo07nnh-9c8f7e46` | $0.1131, 64 calls (ceiling) | 2 | **`stopped_for_permission`** at "Place order", no Flow | 17 decisions after the ask to the ceiling (`cannot_answer_instruction` + `step_changed_nothing`); towels saved, soap kept; slot 3pm–4pm; dry runs (t196); up to 36 inputs withheld (t200) |
| `run-muo0g1ky-f3a866ba` | $0.1164, 64 calls (ceiling) | 2 | **`stopped_for_permission`** at "Place order", no Flow | 21 decisions after the ask, incl. two 12 s extractions of a confirmation that cannot exist; reload/press cycles (first-press trap, F20); slot 3pm–4pm; dry runs (t196); 40 inputs withheld, 31 steps unlisted (t200) |
| `run-muo0qepn-c0aa6dd0` | $0.0777, 43 calls | 2 | **failed, stopped elsewhere**: `move_money` at **"Continue to checkout"** | repeat of `munzihwx` #1; towels saved, soap kept; 5 completions refused `dry_run_refused` (t196); 4 dry runs, 122 s (t196); cap (t200) |

Total spend of the seven: **$0.6169**. None built a Flow; four stopped at the declared point, three elsewhere.

## What changed and why

Seven new files, one per run, from the template, each field from that run's bundle or `NO EVIDENCE:`. No other
file touched. Stage 1 is written once in `run-munzbfbj-2fb8947d.md` from `live-tasks.ts:5` and the r5 exemplar's
chain, and the other six refer to it (same task, same instruction hash).

## Findings across the seven (for the lead)

1. **Lab verdict defect**: `judgeCreatedFlowPermissionStop` returns `at_declared_point` for `controlName: null`
   (`packages/test-runner/src/flow-lane/creation/permission-point.ts:37`, current tree); `munzbfbj` "passed" on a
   cart-page press. Needs `elsewhere` or unproven.
2. **Wrong asks at Continue to checkout** (2 of 7, likely 3): the model's `move_money` declaration decides the ask.
3. **After an ask nobody answers, the build cannot finish**: every later completion claiming the refused press is
   refused `step_changed_nothing`, and the table cannot be produced without an order; 8–21 decisions are spent until
   the loop stops or hits 64. The outcome is then reported as `permission_required`, masking why the loop ended.
   L1 (the Lab answers the ask) changes this for the declared point; for a denial the build should end at once.
4. **Wrong lasting acts in exploration**: towels saved for later instead of the soap (4 runs); napkins added by dry
   runs (`munzbfbj`). Slot 3pm–4pm with 2pm–3pm open (3 runs; r5 #6).
5. **UI**: "Flow ready / a Flow is proposed" for a build with no Flow (`munzrj6r` 00022); the overlay never mentions a
   waiting question; "Build failed / Build failed"; two inconsistent "Worked for" summaries; raw `core.run_node` and
   `core.replay.*` codes; no failure reason. Composer at the bottom in every shot.

## Commands run and observed results

- `node <scratchpad>/w17b-extract.js <run>` for each run: joined `flow-lane.json` steps with `core.log` build-trace
  lines; output e.g. `build outcome permission_required calls 32 32 dur 265611`, `permStop
  {"verdict":"at_declared_point","consequence":"move_money","control":"unnamed"}` (munzbfbj).
- Decision-kind counts: munzbfbj 23/8/1, munzihwx 29/16/7, munzrj6r 33/2/3, munzz9j1 36/7/6, muo07nnh 49/9/6,
  muo0g1ky 53/4/7, muo0qepn 30/10/3 (tool_call/complete/amend_draft); the files state these.
- Dry-run durations from the replay lines (e.g. muo0qepn 21.7, 26.6, 36.9, 36.7 s).
- `grep -n "controlName === null" permission-point.ts` → line 37; `git status` → the file is modified in the tree.
- 35 screenshots opened (first, middle/ask, last of each run, plus extra for runs 1 and 3).
- `wc -l` on the seven files: 97–120 lines each.

## Not verified

- The Core file and line citations taken from the exemplars (`permission-ask.ts:39`, `loop-configuration.ts:355`,
  `instructed-acts/check.ts`, `gate.ts`) were not re-read against Core `f4feb028`.
- Which guard ended each loop short of 64 (not published); the control of `munzbfbj`'s unnamed press; the slot and
  Retry in `munzrj6r`; draft step contents (not in any bundle).
- Whether `permission-point.ts:37` read the same at run time (the file is modified in the tree; the run's
  `control: "unnamed"` event implies the rule held).

## Open questions or contradictions found

- The t195 tree's Lab scored four declared-point stops `passed`; under dev's honest verdict (`f2f80024`) they are
  `stopped_for_permission`. The lane's Runs table should not count them as passes.
- Read one file outside the brief: `apps/scenario-lab/src/scenarios/bigbox-retail/live-tasks.ts` (lines 1–45) for the
  verbatim instruction the template's Stage 1 requires.
