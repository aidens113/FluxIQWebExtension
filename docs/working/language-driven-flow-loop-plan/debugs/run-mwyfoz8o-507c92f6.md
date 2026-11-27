# run-mwyfoz8o-507c92f6: job-board remote Rust roles, 4 of 4 right, attempt 2 "repaired" a Flow that had not broken

Lane: t1060 `live-lane-3`. Task: `job-board/job-board-remote-rust-roles` (read-only), answer-first, `--attempts 4`,
visible Chrome, run watcher on. fluxiq 0.54.32.
Provider: Anthropic `claude-sonnet-5-5` for build and judge. Cost: $1.51 over 37 calls, split by attempt:

| Attempt | Calls | Cost |
| --- | --- | --- |
| 1 | 28 | $1.16 |
| 2 | 8 | $0.31 |
| 3 | 1 | $0.05 |
| 4 | 0 | $0 |

Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwyfoz8o-507c92f6/steps/`. Debugged offline from the step
files, the attempt bundle (`fxwork/t1060-live-lane-3/test-runs/instances/live-lane-3/attempts/run-mwyfoz8o-507c92f6/`)
and the code at 0.54.32. No live or paid run was used. Report:
`docs/working/page-diff-delivery-plan/reports/run-mwyfc9uf-later-attempts.md`, "Addendum".

## What happened

- **One Flow throughout.** All four attempts saved and ran the same steps, digest `514e2de6…` (`attempt.json:122`,
  `:427`, `:777`, `:1078`).
- **Nothing stopped in attempt 2.**
  - Its run of the saved Flow passed every step to the end (0069-0099), and there is no "stopped at step" note.
  - The Lab's line "repaired the step that stopped it" is its generic sentence for `run_flow_then_repair`.
- **Attempt 2's judge said no to a right answer** (0101).
  - The replay was judged by rule: `flow_not_proven`, since no judged whole run of this Flow was behind it yet
    (`answer-first/completion/replay-stands.ts:67`).
  - That judge said **no**, in a fresh request (`no_decision_in_this_attempt`). Its own summary says the 7 rows are
    the right set and "on a closer read the order is actually newest-first".
  - It then says the verdict "stays no only because the sort cannot be confirmed from the stored columns (posted is
    not kept in the output rows)".
  - It names a `wrong_value` defect on a salary it had just confirmed.
- **The 6 decisions that followed tried to show `posted`, and no tool could.**
  - 0103 and 0116: `recall_result` with invented call ids, `not_found`.
  - 0114: an empty `set_result_processing`, `invalid`, then a repeat refused (0119).
  - A loop decision to finish with best (0121). Then a second judge said yes (0122).
- **Attempt 3's one judge call is a consequence.**
  - A Flow is marked proven only by a whole run of the saved Flow that its attempt's judge answered yes
    (`attempt/remember.ts:69-71`, `task-memory/better-flow.ts:34`). Attempt 2's run was answered no, so it saved
    `partly_works`.
  - Attempt 3's replay was therefore `flow_not_proven` again and judged (0154-0155, yes), which saved `ready`.
  - Attempt 4 stood on its record with 0 calls (0187).

## Why attempt 1's Flow reads the list twice

The saved Flow did replay. It is wasteful, not broken.
- **Two paging loops.** The Flow pages the results with step 5 (a raw read, `link/url/lines/text…`) and step 7,
  navigates back to page 1 (step 8), and pages them again with step 9 (the result read) and step 10.
- **How it came about.** At 0017 and 0019 the model looped step 5 and made it the result. Later it read again with
  named columns (0039) and moved the result and the loop to step 9 (0041, 0045). It never dropped the first loop.
  The checklist then said "Nothing on the checklist is still to do".
- **Why the framework kept it.** The framework's draft drops a read that is not the result, but this one was the
  model's own repeat span, so it stayed.
- **Cost.** Each replay spends about 20 s of its 55-63 s on the redundant pass: 3 Next-page presses of about 6 s
  each, plus a navigate.
- **The 7 repeated browser calls in attempt 1** are its three runs of the draft (0022-0025, 0048-0051, 0056-0062).

## Shared cause with bigbox run-mwyfc9uf?

No.
- **bigbox's later attempts stopped on a step.** The cart link was saved by words that are cart state, and
  playback could not find it.
- **Here no step failed.** The cost came from a wrong judge "no": the result shown to the judge carries the asked
  columns and not the sort key it was told was applied.
- **What they share.** Both show that a later attempt's cost depends on attempt 2 being clean. One defect in
  attempt 2 costs a full repair there, and here also one more judge call in attempt 3.

## Next

- Give the judge the values of the processing's sort and filter keys for each kept row
  (`runtime/result-verification/flow-less/question.ts:16`).
- Read a "no" whose summary names no concrete contradiction as the `unknown` its own instruction asks for
  (`question.ts:31`), so the framework supplies the missing evidence instead of the model.
- Make the draft drop a superseded loop: a repeat span whose read is no longer the result and feeds nothing.
- Prove all three offline on 0101's request and on attempt 1's draft, then rerun with `--attempts 4`. Expected:
  attempt 2 makes 1 judge call, attempts 3 and 4 make 0 calls, and each replay runs one paging pass.
