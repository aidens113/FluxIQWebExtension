# Sweep fix: FluxNode nested map returned one item's rows for another

## Outcome

Done. The product is not at fault. The test's scripted model always answered `findLoans("Atlas")`, whatever
title the run it was answering had been asked for. Which of two concurrent map calls explores first is not
fixed. When the "Clock" call reached the Flow first, the scripted model searched "Atlas" for it, so "Clock"
received "Atlas of Rivers". The "Atlas" call then replayed the saved Flow on its own title, correctly. I fixed
the test fixture so the scripted model answers the title its run was asked for, and added a test that forces
each order and checks that every item gets its own rows. No product code changed.

## Cause, with evidence

- **Order is not fixed.** In `create-fluxnode-service.ts` `launch`, each child call does its own file work (an
  execution-owner file lock, a scoped-memory check, execution targets, an execution-task file) before
  `runs.add`. `FluxNodeRunRegistry.add` chains runs of one Flow in the order `add` is called (`flowTails`).
  The host scheduler (`runtime/project-agents/host-resources/scheduler.ts`) is first-in-first-out. So the
  first call to finish its file work explores, and the other replays the Flow it saved. Neither the map step
  nor the docs promise any order between concurrent calls (`map-step.ts` promises only that "Records come out
  in the order they went in", and that held).
- **The input-blind script.** `managed-hosts.test.ts` used `script: [() => findLoans("Atlas"), complete(...)]`
  from its first commit (`fded721c0`, 2026-11-12). With judge off and no check, the run returns whatever
  the model found.
- **Probe, unforced (temporary file, since deleted).** I recorded the goal the exploring model was given.
  In both runs it was "Clock" (`exploredFor: ["Clock"]`), the engine's only "Find loans" press was the
  "Atlas" call's replay with `title: "Atlas"`, and the outputs were exactly the sweep's failure: Atlas got
  Atlas of Rivers (correct) and Clock got Atlas of Rivers (wrong). The same test run alone just before had
  passed (Atlas explored first). So the order flips from run to run.
- **Routing is correct.** Each output came from its own child run: the map step routes by index and the
  flow caller returns `child.result`. The real product question was whether a replay uses its own input
  whichever call explored. With the fixed script and "Clock" forced to explore, the "Atlas" replay pressed
  the engine with `title: "Atlas"` (`engineFinds == ["Atlas"]`) and got its own rows. The other order works too.

## What changed and why

- CORE `packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/library-lane.ts`: added
  `titleAsked(request)`, which reads the title from the attempt's instruction
  (`request.context.instructions.instructions[].body`, matching `findLoansSpec`'s goal) and throws if there is
  none. Also added `findLoansAsked(request)`. With these, a scripted model answers the run it was given, as a
  real model would.
- CORE `.../fluxnode/tests/managed-hosts.test.ts`:
  - The existing test "a one-host pipeline owns only its child leaves and completes nested map calls" now uses
    `findLoansAsked(request)`. Its expectations are unchanged.
  - `fixture()` now also returns `firstLeaf`, a promise that resolves on the first host bind.
  - New helper `explores(title, firstLeaf)`. It wraps `mapStep` through the map barrel and computes each
    record's invocation with the barrel's pure `pipelineMapInvocations`. It ties each child's act scope to its
    record's title through the `acts.fluxNodeChildActScope` spy. Every other call then waits at
    `acts.fluxNodeExecutionOwner` until the chosen call holds the host. If a record was never seen, it throws
    instead of hanging.
  - New `it.each`: "each nested map call gets its own rows when the {Atlas|Clock} call explores and the
    {Clock|Atlas} call replays its Flow". It asserts the explored title, `engineFinds == [the other title]`,
    and both items' outputs. This test pins the cause.

No waits, retries or reordering were added to product code. The forcing is only in the test, to cover both
orders on purpose.

## Commands run and observed results

All were run from CORE `packages/fluxiq` with `FLUXIQ_TEST_GROUP=real-sql` (the group that marked test files
run in) unless noted otherwise.

- Before the fix: `pnpm exec vitest run .../fluxnode/tests/managed-hosts.test.ts -t "nested map calls"`: 1
  passed. The failure is intermittent.
- Probe, before the fix (2 runs): both reproduced the sweep's output diff, with `exploredFor: ["Clock"]`.
- Negative check: I temporarily gave the final forced test the old `findLoans("Atlas")` script and ran
  `-t "Clock call explores"`. It failed with `- "title": "Clockmaking"` / `+ "title": "Atlas of Rivers"`,
  which is the sweep's diff. I then restored the file (temporary line count 0).
- After the fix, `-t 'map call'` (the original test plus both forced orders): 7 separate invocations, each
  `Tests 3 passed | 12 skipped (15)`. That is 5 runs with the first forcing version and 2 with the final
  barrel-based one. Overall the original test passed 7 of 7 times after the fix, and each forced order passed
  7 of 7 times.
- `pnpm exec vitest run src/framework/automation-service/service/fluxnode` with the group set to real-sql
  gave `Test Files 19 passed (19)`, `Tests 83 passed (83)`. With the group set to parallel it gave
  `Test Files 12 passed (12)`, `Tests 37 passed (37)`. Both ran before the final barrel-import edit, which
  touched only `managed-hosts.test.ts`.
- After the final edit, the whole of `managed-hosts.test.ts` (real-sql): `Tests 15 passed (15)`, exit 0.
- CORE `node scripts/structure-audit.mjs`: the first run failed on my direct import of
  `../../pipelines/map/invocations.ts`, so I switched to the map barrel. The rerun printed
  `structure-audit: passed (550 warning(s), 914 baselined)` with nothing reported for my files. It also says
  "2 baseline entries can be lowered". Those are not from my files, and I did not run
  `pnpm structure:baseline`, because the baseline file is not mine to change.
- CORE `pnpm --filter fluxiq check`: a fresh `tsc --noEmit` build (125 s), `check exit 0`.

## Not verified

- I did not run the whole sweep, or the full real-sql group over the package. Only the fluxnode directory ran
  in both groups.
- I did not rerun the fluxnode directory after the final barrel-import edit. Only `managed-hosts.test.ts`
  changed in that edit, and the whole file was rerun.
- I did not look into why the "Clock" call finished its file work first so often under the probe. Either
  order is valid.

## Open questions or contradictions found

- None in the product. One note for the lead: any future test that maps several items through one FluxNode
  with a scripted model must answer from the request (`findLoansAsked`), not a fixed title. I found no other
  such test: no other test file runs a concurrent map over the library lane.
