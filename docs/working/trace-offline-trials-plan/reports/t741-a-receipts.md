# Report: t741 a-receipts (A2-A4, Core)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime/`.
No commits, merges or pushes. No typecheck, build, audit or whole-package run (those are the lead's).

## Outcome

Partial. All four items are implemented and their new tests pass. Two **existing** tests in
`R/service/project-build/tests/project-build-reset-settle.test.ts` now fail. a-settle's A1 change to
`site-reset/ledger.ts` causes this, not my code (details below). They need the lead to decide on the
expectation.

## What changed and why

The file that builds a look's answer is **`R/service/project-build/brief-ports.ts`** (`placing`, plus the
new private `settlementAnswer`). It is on no other worker's list. I added no new source files.
`service/project-build/` and `site-reset/` already hold 25 source files each, which is the directory limit.

1. **A look under `undoes` says what it settled** (`brief-ports.ts`). After the reads around a call reach
   every ledger, a call naming an act under `undoes` gets `resetSettlement` beside its answer, unless Core
   refused it with a `candidate.*` code. `resetSettlement` holds:
   - either `settled: "act-N"` (when the act's standing is `restored` or `unchanged`), or `open: "act-N"`
     plus its `settle`;
   - `actsStillOpen`, every open act across the build, each with its `settle`;
   - `instruction` (`WORDS.lookSettled`).
2. **Refusals carry the whole build's open acts** (`reset-calls.ts`). The routing's `claim` and `target`
   rewrite `actsToUndo` on `candidate.undo_act_kept`, `candidate.undo_unknown_act` and
   `candidate.undo_already_done`:
   - The list is the build-wide union (`openActs`, moved here from `brief-ports.ts`). It keeps the owner's
     own choice of which of its acts to name, and drops the claimed act.
   - The words for `unknownAct` and `alreadyUndone` are recomputed from the merged list.
   - `ledger.ts` is unchanged.
   - The routing also gained `standing(act)` (taken from the owner's ledger) and `openActs()`. The
     reset's task (`resetTask`) and `remainingActs` now use `openActs()`.
3. **Witness, reset-loop and tool wording:**
   - `create-baselines.ts` passes `this.issuedRefs()` to `WORDS.witnessRequired(issued)`. The refusal now
     names each ref already issued, with its count and place, and never prints a withheld place (a
     local `placed()` helper in `words.ts`).
   - `reset-loop.ts`: `project.reset_acts_in_place` adds `issuedRefs` and one more sentence, with an
     example `{"undoes": "<act>", "resetDestination": "<ref>"}`, whenever the ports give refs.
     - Each act's `settle` was already listed.
     - The refs come from a new `issuedRefs()` on the reset ports that `brief-ports.ts` returns. That
       function reads a build-wide map, filled from every receipt `placing` prints.
     - The reset-loop input declares the field as `ports: AutomationStudioProjectResetPorts & { issuedRefs?: ... }`.
   - `undoes-tool.ts`: the `resetDestination` description now covers any reversible lasting press made
     before the first lasting change that has no other witness, not only `create_new`. It also says
     that a ref given without `undoes` settles nothing.
4. **A `resetDestination` with no `undoes` gets a note** (`brief-ports.ts`). The note applies to a call
   that made no act, while acts are open, and that Core did not refuse. It is `resetDestinationNote`
   with:
   - `instruction` (`WORDS.destinationWithoutUndoes`);
   - `actsStillOpen`;
   - `example: { undoes: <first open act whose settle asks for a named list, else the first>, resetDestination: <the call's ref when a receipt printed it, else the first issued ref> }`.

   The example is left out when no ref was ever issued.

All the new words are generic. A test checks them against the realistic scenarios' vocabulary.

## Commands run and observed results

Every command was run in `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ/packages/fluxiq`.

- Tests first: `pnpm exec vitest run .../service/project-build/tests/reset-calls.test.ts` printed
  **3 failed | 4 passed** before the routing change (`expected [] to deeply equal ['act-1','act-2']`),
  and **7 passed** after it.
- `project-build-reset-settle.test.ts` before the `brief-ports.ts` change: my 3 new answer tests failed
  (`Cannot read properties of undefined (reading 'settled')`), and the 2 existing tests also failed
  (see below). After the change, all 4 new tests in that file passed.
- The words, witness and tool tests were written before their fix, but **not run before it**. After it:
  `words.test.ts`, `reset-witness.test.ts`, `undoes-tool.test.ts` and `create-baselines.test.ts` printed
  **31 passed (4 files)**.
- After its change: `.../dispatch/tests/reset-loop.test.ts` (new) together with `brief-loops.test.ts`
  printed **9 passed**.
- Final run of every owned test file together:
  `pnpm exec vitest run` over `reset-calls`, `project-build-reset`, `project-build-reset-settle`,
  `project-build-brief-ports`, `create-baselines`, `reset-witness`, `words`, `undoes-tool`,
  `project-reset`, `reset-loop`, `brief-loops` and `reset-done`. It printed
  **Test Files 1 failed | 11 passed (12); Tests 2 failed | 73 passed (75)**:

  | File | Result |
  | --- | --- |
  | reset-calls | 7 passed |
  | project-build-reset | 10 passed |
  | project-build-brief-ports | 5 passed |
  | create-baselines | 10 passed |
  | reset-witness | 13 passed |
  | words | 6 passed |
  | undoes-tool | 2 passed |
  | project-reset | 2 passed |
  | reset-loop | 2 passed |
  | brief-loops | 7 passed |
  | reset-done | 4 passed |
  | project-build-reset-settle | 5 passed, 2 failed |

  The 2 failures are both pre-existing tests in that file:
  - "look at the stale list once themselves ...": `expected ['act-2'] to deeply equal ['act-2','act-3']`.
  - "tell the reset only the acts still open ...": `Cannot read properties of undefined (reading 'settle')`,
    because act-3 is no longer open.

## Not verified

- No typecheck, structure audit or full suite was run (brief rules). I checked types by reading only. The
  file sizes are within budget: `brief-ports.ts` is 562 lines.
- No live or Lab run took place, and no provider-free installed-gateway reproduction either (that is
  e2e-reset's job).
- The `undo_already_done` merge is covered only by the shared code path. No test hits that code directly.
- The witness, words and tool tests were not watched failing before their fix.

## Open questions or contradictions found

1. **a-settle's A1 moves two tests in my file.**
   - In `project-build-reset-settle.test.ts`, the fixture's act-3 is a trial act with no witness.
     destination-1 is issued in that fixture.
   - Under A1, act-3 adopts the issued list, so Core's own look at `loc:list` settles it `unchanged`.
     That matches A1's rule (`ledger.ts` `evaluate` now passes `adopted`).
   - Suggested update: the first test expects `["act-2"]`, and the second test drops its act-3
     assertions. Alternatively, change the fixture so act-3 stays open, for example a trial act whose
     adopted list differs.
   - I did not edit those two tests, because a-settle's change is still in flight.
2. **`issuedRefs` is not in `project-agents/dispatch/types.ts`.**
   - `AutomationStudioProjectResetPorts` lives in that file, which I do not own.
   - So `reset-loop.ts` declares the optional field on its own input, and `brief-ports.ts` returns it.
   - It works at runtime because `run-brief.ts` passes `ports` through whole.
   - The lead may want to add `issuedRefs?: () => readonly AutomationStudioSiteResetIssuedRef[]` to that
     type formally.
3. **The issued-ref list is tracked in `brief-ports.ts`.**
   - It comes from the receipts `placing` prints, because the ledgers hold the build's
     `createBaselines` privately (in a-settle's files).
   - It matches `createBaselines.issuedRefs()`, since `placing` is the only caller of `receipts()` in a
     project build. It carries no `location`.
   - A public `issuedRefs()` on the project ledger would let this map go.
