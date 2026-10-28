# t775 D1: trials judged by their change; the trial-refusing reset gates retired (Core)

R = `packages/fluxiq/src/programs/automation-studio/runtime`. Tree `fxwork/t775/!FluxIQ`, branch
`task/t775-minimal-reset-judging`. Nothing was committed.

## Outcome

**Partial.** The parts that work:

- Live trials take before and after readings of their witnesses.
- `siteChange` reaches the judge's summary.
- Offline trials carry none.
- Every trial-refusing gate the brief lists is retired.
- The targeted `candidate.trial_starts_in_end_state` refusal exists.
- Exploration-door refusals and completion holds are gone.
- Core no longer runs a cleanup reset of its own.
- The model-facing words are reworded.
- Typecheck is clean, `pnpm check` exits 0, and the structure audit passes.

What is still open:

- **32 tests still fail.** All of them assert the retired behaviour.
  - 19 are in `R/flow-bootstrap/tests/`. I do not own those files: they test `action-permissions.ts` and the candidate build end to end.
  - 13 are scripted supervisor scenarios that I own. They still script a reset brief, or a held ending, into their model calls.
- **The whole run is not read.** The supervisor's judged whole run gets no `siteChange`: its reset has no look.
- **Lines need two one-line wiring changes in files I do not own.** See Open questions 1.

## What changed and why

### New: reading a trial's change (`R/flow-bootstrap/trial-change/`)

- **`steps.ts`.** Turns plan nodes into steps, with each step's definition, consequences, stamp and the parts its subflow serves.
- **`witnesses.ts`.** Resolves each lasting step's stamp through a ledger port into list or control witnesses. Steps that share a place share one witness.
- **`read-log.ts`.** Holds, per location, group and place, the newest read with its clock and sequence number.
- **`readings.ts`.** Takes the readings on each side of the trial:
  - **Before:** the latest read when it is fresh by the clock (`latest_read`). Otherwise Core looks once per location (`core_look`). The domain's `state` is kept.
  - **After:** Core looks at each location again, passing the before `state` as `start`, so the domain can give `lines`.
  - A look that did not land leaves its side unread.
- **`session.ts`.** Two steps:
  - `begin` takes the before readings, works out `carried`, and builds `leftFromEarlier`.
  - `finish(acts)` takes the after readings and attributes acts to witnesses, by stamp or else by definition. It then builds the proofs (with B's `proof`), the findings and the packet (with C's builder).
  - There is no session when the trial has no witness and nothing of the build is on the site.
- **`acts.ts` and `after-read.ts`.** Map the landed acts and the `already_in_state` acts. `after-read.ts` builds the read the ports call.
- **`contracts.ts`.** Holds the new types: `...ChangeStep`, `...ChangePart`, `...WitnessPlace`, `...LedgerPort`, `...ChangeSession` and `...ChangeAsk`.

### Ledger and reset

- **`site-reset/trial-change-port.ts` (new).** The ledger's read-only port for readings:
  - **places.** A destination ref, a control receipt, or a repeated explored act's lists and own control.
  - **latest and seq.**
  - **leftFromEarlier.** Acts that are in place, unsettleable, kept or irreversible, plus acts settled with no change seen. Including the last group covers t772 item 3.
  - **carried.** The repeated act, or the same definition at the same control place, with `changeSeen`.
  - **endStateClash.**

  I moved this out of `ledger.ts` because the ledger had grown to 43 methods and 892 lines, past the audit limits.
- **`ledger.ts` `beforeTrial`.**
  - Never refuses for acts in place, acts that cannot be settled, unproved resets, or a start that differs.
  - Keeps `lookFirst` and the `compareAt` settlement looks, because the "put it back" reset still uses them.
  - Takes the readings when `options.change` asks, then returns to the start through `compare()`.
  - Admits with `startedWith`.
  - Counts every act listed as in place as asked, so `cannotUndo` still works.
  - The one refusal left is `startsInEndState`.
- **`unprovedReset` and the phase-refusal bookkeeping** are removed.
- **A strict act with no witness no longer seals every group.** Only legacy unscoped acts do. Without this, the admission the exploration door now gives would seal all lists, and every later step would be refused `trial_step_unwitnessed` forever.
- **`trial-policy.ts`.** Now a pure `startedWith` builder: in-place and unsettleable acts go under `acts`, kept ones under `cannotUndo`, plus `differs`.
- **`project-reset.ts`.**
  - The clash is checked across every ledger, with `carried` asked of all of them.
  - Ledgers are asked without `change`. One session is built over the own ledger's reads, with leftovers from every ledger, and is followed by `compare()`.
  - The unsettleable "honest exit" joining is gone.
- **`start-check.ts`.** `lookAt(location, signal, start?)`.
- **`contracts.ts`.** Adds `lookAt(location, start?)`, `BeforeTrialOptions.change`, and `Decision.admit.change`.
- **`reset-answers`.** `starts_in_end_state` is added. `acts_in_place`, `acts_not_settled`, `start_differs` and `acts_unsettleable` are removed.
- **`reset-admission/admission.ts`.** At the exploration door, the no-witness cases (rules 4 and 5, and the project control original) now admit with no witness. The step door still refuses them.

### Gates and ports

- **`candidate/trial-gate.ts` and `subflow-candidate/subflow-trial-gate.ts`.**
  - Both pass `{ change: { steps, parts } }` to `beforeTrial`.
  - On admission, the live request carries `siteChange: (acts) => session.finish(acts)`. Offline trials and kept failures have no reset, so they have no `siteChange`.
  - The subflow gate takes the brief's parts and their `effect` from the scope parts. Entry steps serve no part.
  - The candidate gate has a new optional `changeParts`. `supervisor-loop.ts` passes the task spec's parts and `partOf`.
- **`candidate/contracts.ts` and `subflow-candidate/contracts.ts`.** The request has an optional `siteChange`. The scope part has an optional `effect`.
- **`service/candidate-trial/summary.ts`.** New input `siteChangeRead`. It is called after the end view and before anything is judged.
- **`run.ts` (candidate and subflow).** Hands it the landed acts plus `automationStudioCandidateTrialAlreadyInState`. A failed read propagates, so the trial ends not judged: the audit refuses failure-as-empty.

### Supervisor

- **`whole-trial.ts`.**
  - Forwards straight to the shared project reset.
  - `project.trial_reset_required` and `project.trial_unsettleable`, and the repeated-refusal state, are gone.
  - `candidate.trial_starts_in_end_state` maps to `project.trial_starts_in_end_state`, which lists `actsToUndo` with their briefs.
- **`single-subflow-trial.ts`.** `project.trial_starts_in_end_state` maps back to `candidate.trial_starts_in_end_state`.
- **`completion.ts`.** The `project.completion_reset_first` hold and its counters are removed. Endings still name what is left.
- **`supervisor-loop.ts`.** `resetBeforeEnding`, its reasons and the unused `ending` and `personEnded` are removed.
- **`dispatch-tool.ts`.** Only wording changed. `resetToEnd` can no longer be set, so those answers are now unreachable. The state field is kept.
- **`state.ts`.** Not edited.

### Model-facing words that changed (all generic)

- **`core.test_candidate` and `core.test_subflow` descriptions.** Old: "put the site back... trial_reset_required". New: "runs on the site as it stands: what this build already did there stays, the judge is told it, and the trial is judged by what it changed from the state just before it. If this answers candidate.trial_starts_in_end_state, undo just the act it lists, then test again."
- **`cannotUndo` descriptions.** Now say "after a refusal listed them under actsToUndo... They stay on the site".
- **`WORDS.startedWith`.** "began with what is listed here already on the site...; nothing was undone first. Its judge... judges the trial by what changed from the state just before it, ... never by totals that include what was already there."
- **New `WORDS.startsInEndState`.** Names the act under `actsToUndo`, says to undo just that act with `core.run_node` + `undoes`, and to leave everything else.
- **`WORDS.stepWitnessRequired`.** "Name where this step's change shows, so its trial can be judged by the change: ...". It no longer says "before any act of this build changes it". This is the condition word `no_witness`.
- **`retryRefused`.** Press it again on its own page by its newest handle, naming the ref; otherwise make the call without `resetDestination`.
- **Words that said acts are undone before a trial, now reworded.** `keptAct`, `wrongTarget` (both roles), `alreadyUndone`, `alreadyBack`, `unknownAct` (now names `core.run_node`), `undoRefused`, `unprovedUndo`, `actionDeclarations` and `OWN_URL`.
- **Removed.** `resetRequired`, `unprovedReset`, `startDiffers`, `unsettleable`, `witnessRequired`, `createBaselineRequired` and the `JOINS` text.
- **Supervisor guidance.**
  - Step 6 no longer sends a reset before a test.
  - Step 7 says a reset is sent only when the person asked for one.
  - `TEST_CANDIDATE` names `project.trial_starts_in_end_state`.
  - `refusals.resetRequired`, `refusals.resetRequiredUnsettleable`, `refusals.trialUnsettleable` and `completion.resetFirst` are replaced by `refusals.startsInEndState`.
  - Two "with a reset brief first" clauses are dropped.
- **`single-subflow` `WORDS.startsInEndState`.** Replaces `resetRequired`.
- **Wording check.** No store, cart, like, save, job or checkout words; the tests assert this. The DeepSeek prompt pins did not move: `system-prompt.test.ts` passes.

### Tests

- **New: `trial-change/tests/session.test.ts` (4 tests).**
  - A stale before reading triggers a look, the after look is worded against the before state, and the proof is `shown`.
  - A fresh latest read needs no look; an unchanged witness gives `no_change` and `result.change_not_seen`.
  - An `already_in_state` act is attributed to its witness.
  - There is no session without witnesses or leftovers.
- **New: `trial-change/tests/ledger-trials.test.ts`.** Uses a real ledger and gate, and covers the brief's fail-first set:
  - An explored creation in place is admitted with no reset asked, and the packet shows the row 9 -> 10 with the domain's lines.
  - An act no call can settle is admitted and appears in `leftFromEarlier`.
  - The end-state clash names only that act and leaves an unrelated in-place act out. Once the step's own change has been seen (`carried`), the trial runs.
  - The gate gives a live port `siteChange` and an offline (`fixture`) port none.
- **Rewritten to the new rule, in owned directories:**
  - `site-reset/tests/` (`trial-policy`, `words`, `refusal-sites`, and the settlement and ledger suites: a refusal read as "acts still to undo" becomes `startedWith.acts`, and `settle` is read from `ledger.inPlace()`)
  - `reset-admission/tests/`
  - `reset-answers/tests/refusal-tools`
  - `reset-settlement/tests/`
  - `candidate/tests/trial-gate-reset`
  - `subflow-candidate/tests/subflow-trial-gate`
  - `service/subflow-trial/tests/site-reset`
  - `service/candidate-trial/tests/site-change` (adds a read-after-end-view case)
  - `single-subflow/tests`
  - `service/project-build/tests/{reset-calls,project-build-acts-record,project-build-phase-start}`
- **Deleted: 15 supervisor tests whose only subject was a retired mechanism.**
  - The Core cleanup reset before an ending.
  - The `completion_reset_first` holds and the answers to the resets they sent.
  - Whole-trial refusals and their repeat.
  - The unsettleable honest exit.
  - The time-limit reset.

  One test was rewritten instead: `supervisor-loop`'s "never holds an ending for acts still in place" (fail-first item 5). Item 4 is shown at the reset level: project-reset admits with `startedWith.acts`.

## Commands run and observed results

All runs are from `packages/fluxiq` unless noted.

- **Final test run.** Command: `node ../../scripts/vitest-groups.mjs --groups=parallel <R>/flow-bootstrap/{site-reset,reset-settlement,reset-answers,reset-admission,trial-change,candidate,subflow-candidate,tests} <R>/project-agents <R>/service/{candidate-trial,subflow-trial,project-build} <R>/llm/repeat-guard <R>/llm/tests/{loop-budget,repeat-policy}.test.ts <R>/activity src/ui/activity-status <R>/llm/deepseek/tests/system-prompt.test.ts <R>/flow-bootstrap/plan/tests/{issue-feedback,extraction-vocabulary}.test.ts`
  - Printed `Test Files 8 failed | 341 passed (349)`, `Tests 32 failed | 2783 passed (2815)` and `[vitest-groups] failed: parallel (exit 1)`.
  - The failures are: `flow-bootstrap/tests/action-permissions.test.ts` 6, `site-reset-build.test.ts` 10, `site-reset-irreversible.test.ts` 3, `supervisor/tests/rescued-pass-fallback` 6, `reset-next` 3, `supervisor-loop` 2, `whole-trial` 1, and `service/project-build/tests/project-build-phase-start` 1 (the whole-trial case).
- **New trial-change tests alone.** Printed `Tests 28 passed (28)`.
- **First run after the source change, before any test was edited.** Printed `Tests 206 failed | 2549 passed (2755)`. Those were the old tests asserting the retired refusals, for example `expected { Object (kind, startedWith) } to match object { kind: 'refuse' }`. This is the only "fail-first" evidence: I made the source change before writing the new tests.
- **Typecheck.** `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit ...` printed no `error TS` lines. Earlier runs had test-only errors, which I fixed.
- **`pnpm check`.** Exit 0, with `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; ..."}` and no TS errors.
- **`pnpm structure:check` (Core root).**
  - The first run had 3 violations: the ledger at 43 methods and 892 lines, and failure-as-empty in `after-read.ts`. I fixed all three.
  - The final run printed `structure-audit: passed (447 warning(s), 1152 baselined).`

## Not verified

- **No live or headed run, and no Lab run.**
- **Concurrent workers.** D2 and D3 were editing the same tree while I ran the tests: `activity/**`, `llm/**`, `ui/**`, `brief-ports.ts`, `project-build-notes`, `action-permissions.ts` and `explored-toggles`. Their files appear in `git status` and are not mine.
- **Readings against a real domain.** The `lines` and `state` round-trip is unproven: whether the web domain's `startState` with `start` gives useful lines at an arbitrary witness location.
- **The cost of looking.** The extra page loads per trial (before when stale, and always after) were not measured.
- **A witness on the page the run ended on.** It is still reloaded by a look, not read from the end view.
- **The seal change** (a strict act with no witness seals nothing) was reasoned, and tested only through the updated reset-calls case. A complete read taken after such an act becomes an original. This still never lets an undo touch what that read held.

## Open questions or contradictions found

1. **Lines in candidate and builder trials need two one-line changes in files I do not own.** Both look wrappers ignore the new `start` argument, so after readings there carry counts but no `lines`:
   - `flow-bootstrap/candidate/authoring-loop.ts`: its `lookAt` wrapper should be `async (location, start) => { const read = await startCheck.lookAt(location, resetSignal, start); ... }`.
   - `service/project-build/brief-ports.ts`: `looking()` should pass `start` the same way.
2. **The scope part's `effect` is never filled yet.** `project-agents/dispatch/scope.ts` (not owned) should copy `part.effect` into the scope part, next to `lastingActs`. Until then:
   - subflow trials have parts with no effect, so they get no proofs and no targeted clash;
   - the whole trial does get parts and effects, through the supervisor's `changeParts`.
3. **The supervisor's judged whole run has no readings**, because its reset has no `lookAt` (`whole-trial.ts` uses `UNLOOKED`). It would need a start check over the binding's arrival node, outside a build loop, which I did not find. With no look, I deliberately begin no session. A session without a look would mark every effect part `unproven`, and C's rule would then hold every whole-run yes as unsure.
4. **Remaining failing tests:**
   - The 19 in `R/flow-bootstrap/tests/` (not owned) assert the old candidate-build reset flow and exploration-door refusals. They need rewriting as settlement or "runs on the site" assertions, like the site-reset suites.
   - The 13 supervisor scenarios (`rescued-pass-fallback`, `reset-next`, two in `supervisor-loop`, one in `whole-trial`, one in `phase-start`) still script a Core reset brief or a held ending into their model calls. They need their scripts redone, not just their assertions.
5. **`resetToEnd`, `resetCameBackLast` and their dispatch answers are now unreachable.** I left them in place rather than delete state another worker may read. They are a cleanup candidate.
6. **Showing in-place acts counts as asking for them.** To keep `cannotUndo` working, an act is counted as asked once a trial's `startedWith` lists it. `ASKED_BEFORE_KEPT` therefore keeps a subject-undo act after two trials, not two refusals.
