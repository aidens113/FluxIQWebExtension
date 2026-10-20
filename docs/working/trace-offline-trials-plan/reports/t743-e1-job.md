# t743-e1-job: job's failed first save, retried, undone on its own item

## Outcome

Blocked on a product defect. The spec has been rewritten to the new truth. In both headed runs, every assertion
before the undo passes:

- the save with no witness is refused unrun;
- the ref comes from the plain My jobs read;
- the page's failed first save is retried and the retry lands;
- My jobs goes from 2 rows to 3;
- Core's settle points at My jobs;
- the undo on a row My jobs held before the build is refused with its condition.

The undo the brief asks for then fails, and so does every other undo of act-1. Core refuses all of them, so the
trial can never run. Per the brief I stopped there. I did not touch product code or weaken an assertion.

## What the spec proves now (`apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts`)

The scripted builder makes these calls, in order:

1. `saved.original`: open My jobs. The read is complete, has 2 rows, and issues `destination-1`.
2. `job`: open the job page.
3. `save.unwitnessed`: press the heart with no ref. Refused `candidate.reset_witness_required` (`failed: no_witness`),
   with no click and `permitted: false`.
4. `save`: press the heart naming `destination-1`. One `modify_existing` declaration, permitted. The answer has
   `ok: true`, `status: "succeeded"`, `attempts: 2`, and the clicks go 0 -> 2.
5. `undo.look`: open My jobs, `undoes: "act-1"`. My jobs now reads 3 rows, with both original subjects kept. The
   answer's `resetSettlement` has `open: act-1` and the settle "Destination-1 at <my jobs> still differs ...".
   `actsStillOpen` is `[[act-1, save]]`.
6. `undo.held`: Unsave job on the row for HELD (hv2), which My jobs held before the build, `modify_existing`,
   `undoes: act-1`. Refused `candidate.undo_unproved`, with `failed: subject_differs`, `canMeet: another_page`, a
   non-empty `condition`, no click, and `permitted: false`.
7. `undo`: Unsave job on the new row (g1), `modify_existing`, `undoes: act-1`. The spec expects it admitted, one
   click, and My jobs back to its baseline hash. **This assertion fails (defect below).**
8. Calls 8 to 11: look at My jobs, submit, `trial.clean`, complete. The spec asserts the trial answers `yes`, with
   nothing in `startedWith.cannotUndo` / `actsToUndo` / `actsToRestore`, "save the job" `succeeded`, and ending
   `proposed`.

Item 1 of the brief: the harness shows the retry only as `attempts: 2` plus two dispatched clicks for the one call.
The instrumented `outcomes` record one outcome per tool call (`ok: true`), not per attempt. So the first attempt's
`web.action.page_reported_failure` code is not visible from the spec, and the spec does not assert it.

## The defect (exact calls, answers, expected)

All of these are probes under `undoes: "act-1"`, where act-1 is the landed save (`call: save`, spot scope `p:<job
page>`, subject `s:3d32...`, with no item and no place):

| Call | Declared | Answer | Expected |
| --- | --- | --- | --- |
| Unsave job, new g1 row on My jobs | `modify_existing` | `candidate.undo_unproved`, `failed: subject_differs`, `canMeet: another_page` | admitted (`on: subject`), one click |
| Unsave job, new g1 row on My jobs | `delete` | `candidate.undo_unproved`, `subject_differs`, `another_page` | (either class) admitted |
| Heart on the job page | `modify_existing` | `candidate.undo_unproved`, `failed: no_destination_read_before`, `canMeet: no_call` | (admitted, if this were the intended inverse) |

What the declarations show (opaque tokens): the new row's control carries subject `s:01cab...`, which is also its
subject in the My jobs read; page `s:c23e...`; and item `i:00fa...`. The job page's heart carries subject
`s:3d32...`. The domain gives the same job one subject token on its detail page and a different one as a My jobs
row.

Why Core refuses, read in `fxwork/t743/!FluxIQ/.../flow-bootstrap/site-reset/undo-admission.ts`:

- The row path: `aboutTheAct` needs `control.subject === act.spot.subject` (or `act.spot.page`). That fails, so
  `unmatched` returns `subject_differs`. There is no transfer, because the act's spot is in no read list.
- The heart path: `aboutTheAct` holds and `reverses` holds. Then `subjectDeletionUnmet` finds no original read for
  the job page's scope and returns `no_destination_read_before`.
- `act.destinations` does hold `destination-1` (named by `resetDestination`), but no admission path reads it.

So Core's settle says "undo this act there [destination-1]", but no call can meet it. The act is not listed under
`actsUnsettleable` either, so `gate_unsatisfiable` does not apply. The build loops on
`candidate.trial_reset_required` until it fails with `flow_bootstrap.evidence_repeat_without_progress`.

There are two candidate fixes, and choosing between them is a supervisor or Core decision, so I made neither:

- (a) The domain gives a job one subject token whether it is read on its own page or as a list row.
- (b) Core admits removing, on an act's named destination, a subject that was absent from that destination's
  original read and is present now, for a `modify_existing` act whose own spot sat in no list.

There is also a related wording gap: the settle and the refusals point at a destination where no control is
admissible, and the act is not reported as unsettleable.

## Commands run and observed results

All from `fxwork/t743/!FluxIQWebExtension/apps/extension`, headed, one worker. The command was
`node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/job-failed-save.spec.ts --workers=1 --reporter=list --output <scratchpad>/<label>`.

- Probe runs (a temporary probe body in the same spec file, since replaced):
  - `e1-job-probe-1`: every undo had `permitted: false`. My answer capture was wrong in this run, so it was rerun.
  - `e1-job-probe-2`: the refusals in the table above, for the held row, the new row and the heart.
  - `e1-job-probe-3`: the new row with `delete` was refused `subject_differs`.
- Final spec, run 1 (`scratchpad/e1-job-1`): **1 failed**, at spec line 169 (the admitted-undo assertion). It
  received `failed: "subject_differs"`. Diagnostic line:
  `{"resetDiagnostic":{"ending":"failed","failure":{"code":"flow_bootstrap.evidence_repeat_without_progress",...,"issueCodes":["project.completion_nothing_assembled"]},"refused":"candidate.reset_witness_required","saveAttempts":2,"saveClicks":{"before":0,"after":2},"undoHeld":["candidate.undo_unproved","subject_differs"],"undo":["candidate.undo_unproved","subject_differs"],"tests":["candidate.trial_reset_required" x8]}}`
- Final spec, run 2 (`scratchpad/e1-job-2`): **1 failed**, with the same assertion, the same received value and the
  same diagnostic line.
- The diagnostics are in `.../scratchpad/e1-job-{1,2}/site-reset-tests-job-faile-fae66-nd-undoes-it-on-its-own-row/reset-job.json`,
  where `<scratchpad>` is
  `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad`.

## Not verified

- The brief's validation, "passes headed twice in a row", is not met. It cannot pass until the defect above is fixed.
- Everything after the undo has never been observed in this form: the clean trial's `yes`, its startedWith and acts
  lists, the "save the job" step status, ending `proposed`, and the fact that the undo lands in one click with My
  jobs back to baseline. Those assertions are written but untested. In particular, the trial's own save will fail
  first and then retry. I expect its step to still read `succeeded`, but I have not seen it.
- Whether `act-1` is really the right id: the look's `resetSettlement.open` confirms it (that assertion passes).
- The first attempt's own failure code, which the harness does not expose per attempt.
- No typecheck, by the brief. Playwright compiled and ran the spec.

## Open questions or contradictions found

- Should the defect be fixed in the domain (one subject token per job across its detail page and list rows) or in
  Core (admit removal of a newly present subject on the act's named destination)? See (a) and (b) above.
- The settle for an act with no admissible undo still says "undo this act there", and the act is not flagged
  unsettleable. If the fix is not to admit an undo, that act should probably surface under `actsUnsettleable`.
- The spec asserts `modify_existing` for the row undo, the inverse class Core's `REVERSES` allows for a
  `modify_existing` act. If the fix admits it under `delete` instead, the declared class at spec call 7 needs to
  change.
