# t738-a2-trial-act-address: report

## Outcome

Done, with one small step outside the brief's file list (see Open questions). A trial act now carries the page
address the trial actually ran on. Only the location is taken from the unwithheld run. Every other field of the act
still comes from the withheld trace, and the saved and persisted trace is unchanged.

## What changed and why

- The brief's premise was only partly true. `graph-run.ts` does pass both copies to `onExecutedTrace`, but none of the
  three callers can receive them. Their runners (`flow-bootstrap/verification/detached-execution.ts` and
  `detached-subflow.ts`, neither of which I own) call `runCanonicalAutomationStudioFlow` without that callback and
  return only the saved trace. So at the end of a graph run, Core now keeps the unwithheld location in memory, and
  `landed-acts.ts` reads it back from there.
- New directory `<runtime>/executor/executed-locations/`, containing `locations.ts` and its barrel `index.ts`. It
  exports one value, `automationStudioExecutedLocations`, which has two methods:
  - `remember(executed, saved)` pairs each saved attempt with the executed attempt of the same id and node in the same
    frame. It does this recursively into `childTrace`. It keeps one string, the executed `stateDiff.controls.location`,
    in a WeakMap keyed by the saved trace's own `controls` object.
  - `of(witness)` reads that string back.
  - In a called frame (Call Subflow or Call Flow), the parent's withholding rewrites the child's attempts into copies.
    Pairing the parent's executed copy (the child's saved attempt) with the parent's saved copy carries the address
    across.
  - An attempt id that appears twice in one frame is not paired. A lifecycle handler body that exists only in the
    saved trace pairs with nothing and keeps the marker.
- `<runtime>/executor/graph-run.ts` calls `automationStudioExecutedLocations.remember(defended, saved)` right before
  `onExecutedTrace`. Nothing else in the file changed.
- `<runtime>/service/candidate-trial/landed-acts.ts`: in `controlsOf`, the location is now
  `locationOf(automationStudioExecutedLocations.of(witness) ?? witness.location)`. The existing bounds check still
  applies. The header gained a t738 paragraph. All three callers (`subflow-trial/run.ts:201`, `candidate-trial/run.ts:157`
  and `project-build/entry-preparation.ts:131`) get their acts from this function, so each one now gets the address.
  None of the three caller files needed an edit.
- Tests:
  - `service/candidate-trial/tests/landed-acts.test.ts` gains one test. It runs a real graph: a row step outputs a link,
    a navigate is bound to `row.link`, then a "Want to read" toggle is pressed (a reading-list example). It checks
    three things. The saved trace contains no address, and the press's `controls.location` is the marker. The act's
    `controls.location` is the real address. The act equals what a plain copy of the saved trace yields, apart from
    that location.
  - New file `service/subflow-trial/tests/trial-act-address.test.ts` tests a caller seam through
    `runAutomationStudioSubflowTrial`. The predecessor and the target each run as called frames, so this exercises the
    child-copy pairing. It checks that `result.acts` (what the gate hands the reset ledger's `trialRan`) carry the
    address, while the session's saved trace and the feedback do not contain it and do contain the marker.

## Commands run and observed results

All vitest runs used `--pool=forks --poolOptions.forks.singleFork` from `!FluxIQ/packages/fluxiq`.

- `npx vitest run .../candidate-trial/tests/landed-acts.test.ts` printed `14 passed`.
- `npx vitest run .../subflow-trial/tests/trial-act-address.test.ts` printed `1 passed`.
- I temporarily reverted the landed-acts line to `locationOf(witness.location)` and reran the seam test. It printed
  `1 failed`, with the diff showing `"location": "[withheld]"` twice. I then restored the file and confirmed the fix
  line was back.
- One-fork run of the files beside the change: landed-acts, candidate-trial `run.test.ts`, every file in
  `subflow-trial/tests`, `project-build-entry-preparation.test.ts`, `executor/tests/graph-run.test.ts` and
  `executor/tests/trace-withholding.test.ts`. It printed `Test Files 14 passed (14)` and `Tests 108 passed (108)`.
- After moving the module into its own directory, I reran landed-acts, trial-act-address, entry-preparation,
  candidate-trial run and trace-withholding. That printed `5 passed`, `53 passed`.
- `node scripts/structure-audit.mjs` printed `1 violation(s)`:
  `[directory-files] .../flow-bootstrap/site-reset/: 26 source files exceeds the 25-file limit`. That directory belongs
  to another worker, and I did not touch it. My first placement, a file in `executor/` itself, made that directory 26
  files, so I moved the module into its own subdirectory. After the move, `executor/` no longer appears in the audit
  output.

## Not verified

- I did not run tsc or any typecheck, by instruction. The lead typechecks.
- No live or Lab run.
- I did not add a unit test of `executed-locations` by itself, for example the duplicate-id and handler-body cases.
  It is covered only through the two tests above.
- I did not trace `candidate-trial/run.ts` and `entry-preparation.ts` end to end with a withheld address. They read
  acts from the same function, and their existing tests pass.
- I did not test how the ledger and settle clause use the real address. That is the site-reset worker's area.

## Open questions or contradictions found

- **Outside the brief's file list.** I created `executor/executed-locations/` (two files) and added one export line to
  `executor/index.ts`. Both were needed: the callers cannot see the executed trace, adding an export to `graph-run.ts`
  would break the one-export rule and its ratchet, and a deep import from `landed-acts.ts` would break the barrel
  ratchet. The lead should review both.
- Design choice for the lead. The cleaner long-term alternative is for the detached runners to pass `onExecutedTrace`
  and return only the locations. That puts the change in files I do not own. The registry holds strings only, in
  memory, keyed weakly by saved-trace objects.
- Effect on model text: the real address now reaches the act, so it reaches the ledger and any settle clause built
  from it. The debug's supervisor decision allows this, because it is a page URL the model's own reads already showed.
  The site-reset worker's marker guard is unaffected.
