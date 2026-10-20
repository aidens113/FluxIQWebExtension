# Report: t743-w-unsat (S2/S3 wiring: acts no call can settle, and the build's places)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime/`.
No commits, no branch switches, no typecheck, build or whole-package run.

## Outcome

Done. All seven tasks are implemented and tested.

- The validation set passes: 97 files, 800 tests.
- The prompt contract test passes, and no pin moved.
- The structure audit reports one violation. It is in `R/flow-bootstrap/subflow-candidate/tests/` (26 files), which is not mine.

## What changed and why

The rule I applied everywhere: anything that tells someone what is on the site includes unsatisfiable acts, marked as left and not undoable. Anything that asks someone to undo leaves them out.

### Readers of `inPlace` and how each now treats unsatisfiable acts

I grepped every reader outside site-reset and reset-settlement. Besides the readers c1 named, two more turned up: `supervisor/read-task.ts` and `supervisor/dispatch-tool.ts` (`lastingActsInPlace`).

**Readers that tell someone what is on the site (now include them):**

- **`dispatch/reset-done.ts`**: before this change, these acts were neither in place nor in any `standing` category, so a reset said "Every lasting act ... is undone". They are now said separately: "N act(s) of this build can no longer be checked or put back, so it/they may still be on the site: ...". The Pick type gains `unsatisfiable`.
- **`supervisor/left-on-target.ts`**:
  - Each such act is named in the note as "(it can no longer be checked or put back; it may still be there)", with `undoable: false` and `unsettleable: true`.
  - A new top-level `unsettleable: boolean` says whether any such act is left.
  - The person is told it as an act the build could not undo. Where no read ever showed it change anything, they are told it may have changed nothing.
  - The supervisor's `projectLedger` port is a Pick of `snapshot | forBrief`, and `ports.ts` is not mine. So these acts are read through `forBrief(owner).unsatisfiable()`.
- **`service/project-build/phase-start.ts`**:
  - `onSite()` now returns `unsettleable` as well.
  - `explore` adds `actsUnsettleable` to what the phase is told, plus one generic sentence on its note: still on the site, do not try to undo them, no trial can run while they are there.
  - I did this in phase-start.ts rather than through `stillOnSite`, because for a reset `stillOnSite` says "they are what this reset undoes". It also kept me out of `phase-start-told.ts`, which I do not own.
- **`service/project-build/brief-ports.ts`**:
  - `startIsBuilds` is false while one of these acts is on the site.
  - The prepared entry's `predecessorsLeftOnSite` (`landed`) includes them.
- **`service/project-build/reset-calls.ts`**: a refusal that lists the build's open acts (`buildWide`) now also lists the whole build's such acts under `actsUnsettleable`.
- **`supervisor/whole-trial.ts`**: the repeated refusal also carries `actsUnsettleable`.
- **`supervisor/read-task.ts`** and **`supervisor/dispatch-tool.ts`**: add `lastingActsUnsettleable: N` beside `lastingActsInPlace` when N > 0.

**Readers that ask someone to undo (unchanged, still exclude them):**

- `run-brief.ts`'s fallback `remainingActs`
- `brief-ports.ts`'s `remainingActs` owners and its `resetTask`
- `reset-calls.ts`'s `openActs`

### Task 2: a reset whose only remaining acts are unsatisfiable

`remainingActs` leaves these acts out, so the reset's first completion is accepted and it does not loop. Its return then:

- comes back `blocked`, not `done`, with the reset-done words naming the acts as left;
- carries `terminalReason: "gate_unsatisfiable"` (task 3).

I chose `blocked` because a `done` reset leads the supervisor to "test now", and that test would be refused. The dispatch test checks that the model is asked exactly once.

### Task 3: `gate_unsatisfiable` on returns

- **`dispatch/ending.ts`** has a new `gateUnsatisfiable(brief, value, unsettleable)`:
  - With no such acts, or for a `done` build brief, it returns the value unchanged.
  - A reset's `done` becomes `blocked`.
  - A reset that is not done gets the acts named in its reason.
  - Any return that is not done gets `gate_unsatisfiable`, unless it already carries a closed reason. An existing reason wins.
- **`dispatch/run-brief.ts`** applies it once, where every return is made: the try's result and the catch's `thrown` both go through it, reading `dispatcher.ledger.unsatisfiable()`. Header paragraphs were added to both files.

### Task 4: the supervisor

- **`supervisor/completion.ts`**:
  - Repair-first holds nothing while `left.unsettleable` is true, because no changed brief could be tested.
  - Reset-first already holds nothing for these acts, since they are never `undoable`.
  - The ending's reason names them through `left.reason`.
- **`supervisor/guidance.ts`**:
  - Step 7's "nothing more can be done" list gains "or something the build did can no longer be checked or put back, so no test can run".
  - There are two new refusal texts: `trialUnsettleable` and `resetRequiredUnsettleable`.
- **`supervisor/whole-trial.ts`**:
  - A gate refusal that lists only `actsUnsettleable` is answered `project.trial_unsettleable` with no `retry_allowed`, and tells the supervisor to end honestly.
  - A refusal that also lists acts to undo stays `project.trial_reset_required`, with those acts named separately and the extra sentence added.

### Task 5: places

- **`service/project-build/brief-ports.ts`**: the builder ports and the reset ports both give `issuedRefs: () => project.ledger.issuedRefs()`, each ref with its `location`.
  - The builder return is built as a typed const (`AutomationStudioProjectBuilderPorts & { issuedRefs }`) so its other members keep their contextual types.
  - The reset ports previously returned `[...issued.values()]`, which carried no location. The `issued` map is kept for the `resetDestinationNote` example.

### Task 6: the settlement-observations forwarder

- **`site-reset/undo-admission.ts`** now imports `AutomationStudioSiteResetObservations` from `../reset-settlement/index.ts`.
- **`site-reset/settlement-observations.ts`** (the forwarder) is deleted. No importer was left; the only other mention is `packages/fluxiq/dist/runtime-build-identity.json`, which is build output.

### Task 7: the two project-build tests c1's rules changed

- **`project-build-reset-settle.test.ts`**: act-3's trial step now carries `controls: { page: "p:list-page", location: "loc:list", ... }`, as c1 proposed, so it adopts the lists read on its own page. The header comment says why.
- **`project-build-reset.test.ts` (~757)**: now asserts on `[...inPlace(), ...unsatisfiable()]`.

### New tests

- **`R/project-agents/dispatch/tests/unsettleable-acts.test.ts`** (new):
  - the reset-done words;
  - `gateUnsatisfiable`: a reset's done becomes blocked and is valid on read-back; names added to a blocked reset's reason; an existing reason kept; nothing changed with none in place;
  - a dispatched reset brief that completes after one decision and comes back blocked with `gate_unsatisfiable`, naming the acts;
  - a dispatched build brief that comes back blocked with `gate_unsatisfiable`.
- **`R/project-agents/supervisor/tests/`**: I added to existing files, because a new file put the directory at 26 and the audit failed it.
  - `left-on-target.test.ts`: the act is named and is not undoable.
  - `repair-repeats.test.ts`: an ending is held by neither rule, the reason names the act, and the dispatch answer has `lastingActsUnsettleable: 1`.
  - `whole-trial.test.ts`: `project.trial_unsettleable` comes from the real reset refusal; the mixed case stays reset-required.
- **`R/service/project-build/tests/`**:
  - `project-build-reset-settle.test.ts`: both ports give located `issuedRefs`. A build brief dispatched through the garden dispatcher with the real builder loop over the real brief ports has its opening call carry `places: ["loc:list"]`, and no later call carries them. The stub site now records the calls it is sent.
  - `project-build-phase-start.test.ts`: `onSite().unsettleable` and the told `actsUnsettleable` and note.
  - `reset-calls.test.ts`: a refusal lists `actsUnsettleable` build-wide, and `openActs()` is empty.

## Commands run and observed results

All vitest runs used `cd C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ/packages/fluxiq && pnpm exec vitest run --maxWorkers=2 --minWorkers=1 ...`.

- **Baseline, before any edit**, over the dispatch/tests, supervisor/tests, project-build/tests, site-reset and reset-settlement directories plus the prompt test: `Test Files 3 failed | 93 passed (96)`. The three failures:
  - the two project-build tests c1 named;
  - `left-on-target.test.ts` "counts acts in place no name says ...". c1's acts had left `inPlace`; my wiring fixed it with no change to that test.
- **Final run, same set:** `Test Files 97 passed (97)`, `Tests 800 passed (800)`. That includes `system-prompt.test.ts (39 tests)` passing. No pin moved, and I did not touch the pins file.
- **Mutation check.** I made three mutations, ran the three new-test files, then restored all three and confirmed with grep:
  - removing the `gateUnsatisfiable` call in run-brief;
  - making the builder and reset `issuedRefs` return `[]`;
  - removing completion's unsettleable skip.

  Result: `Tests 6 failed | 12 passed (18)`, each mutation caught by its own tests. The six failures included the existing reset-settle test "notes that a look naming resetDestination with no undoes ...", which depends on the reset's `issuedRefs`.
- **`node scripts/structure-audit.mjs` (Core root):** exits 1 with one violation, `[directory-files] R/flow-bootstrap/subflow-candidate/tests/: 26 source files`. That directory is not mine and I did not touch it.
  - My first attempt also failed `project-agents/supervisor/tests/` at 26, because of my new file. I fixed that by moving those tests into existing files.
  - The audit also prints "1 baseline entries can be lowered".

## Not verified

- **No typecheck.** The brief forbids it, and vitest does not check types. I checked these points by hand:
  - the typed `ports` const in brief-ports (contextual `observe`);
  - left-on-target's conditional spread of `seen` or `stays`;
  - the `Pick<..., "unsatisfiable">` in reset-done;
  - the `gateUnsatisfiable` parameter type, which accepts the project ledger's entries that carry `owner`.
- **No live or browser run.** I did not check how the domain treats `places` or `actsUnsettleable` beside `phaseStart`.
- **The reset model's task instruction (`resetTask`) does not list unsatisfiable acts.** That list is "Acts to undo". The reset is still told them through `phaseStart.actsUnsettleable` and through refusals. If the lead wants them in the task body too, it is a small addition.
- **Wording I did not update:** `guidance.ts`'s `TEST_CANDIDATE` tool description and the `resetRepeatedTest` refusal still speak only of resets. The refusal for unsettleable acts carries its own instruction, so I left them alone to keep the tool descriptions unchanged.

## Open questions or contradictions found

- **A reset's outcome.** "A reset is done when nothing is left to undo" (`contracts/builder-return.ts`) could be read as allowing `done` while only unsatisfiable acts remain. I made it `blocked` with `gate_unsatisfiable`, because trials stay refused while one is in place. Tell me if `done` is wanted.
- **Which closed reason wins.** When a return already carries `allowance_spent`, `stopped` or `person_ended`, that reason is kept rather than replaced by `gate_unsatisfiable`. Either one exempts the subflow from repair-first.
- **Files I edited that the brief did not list by name:** `supervisor/read-task.ts` and `supervisor/dispatch-tool.ts`, each with a small edit. Both are `inPlace` consumers outside site-reset and reset-settlement, which the brief's Owns clause covers. `dispatch-tool.ts` already had another worker's two-line `terminalReason` edit; I left it intact.
