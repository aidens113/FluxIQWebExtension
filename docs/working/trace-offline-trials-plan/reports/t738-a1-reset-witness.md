# t738-a1-reset-witness report

## Outcome

Partial. The Core site-reset logic for all three defects is done, and the site-reset tests beside it pass in one fork. The Core structure audit passes. Two things outside my ownership still need the lead:

1. To refuse an invented ref on a look under `undoes`, the ref has to reach `claim`. The ledger now takes it (`claim(undoes, resetDestination?)`), but three callers I do not own still pass only `undoes` (see Open questions).
2. One test I do not own, in `action-permissions.test.ts`, now fails because of the intended behaviour change.

## What changed and why

Core, `<runtime>/flow-bootstrap/site-reset/`:

- **`reset-witness.ts` (new).** Pure `automationStudioSiteResetWitnessMissing(declared, known)`. It returns true for a reversible lasting press that has no witness:
  - effect `mutate`, every consequence in create_new/modify_existing/delete, and not exactly `["create_new"]`;
  - the control names a subject, page or scope, so the ledger would hold the act strictly.

  Any one of these is a witness:
  - the call names an issued ref that `destination()` resolves;
  - `control.scope` is a valid original of the same resource;
  - `control.state` and `control.place` are both present and the press declares exactly `modify_existing` (the toggle witness).
- **`create-baselines.ts`.** `check()` behaves as follows:
  - **Identified `create_new`:** unchanged. It keeps `candidate.create_baseline_required`, even for an invented ref.
  - **Any other call naming a ref no receipt printed:** refused `candidate.reset_destination_unissued`, before the seal and after it.
  - **Before the seal, with no witness:** refused `candidate.reset_witness_required`.
  - **After the seal:** admitted as before.

  New methods:
  - `unissued(reference)` returns the refusal evidence or undefined. Both `check` and the ledger use it.
  - `refsClosed()` is true when the baselines are sealed and every original has been issued, so no further ref can ever be issued.
  - private `original(scope, resource)`.

  A refusal never calls `seal()`, and the permission wrapper returns before `explored`, so no act is recorded.
- **`ledger.ts`.** `claim(undoes, resetDestination?)` refuses an unissued ref before anything else, with the same code. `named()` now passes `{ closed: refsClosed() }` to the settle words. I added a short header paragraph. The file grows by 7 lines, to 738 of its 800-line limit.
- **`settlement-words.ts`.**
  - When `closed` is true and no ref was issued, the `name` clause no longer tells the model to read a list and name a ref. It now says "this act cannot be settled in this build: nothing was read complete before the build's first lasting act, so no list can be named for it any more, and trials stay refused while it is in place".
  - When refs can still be issued and none has been shown, the old parenthetical "(no list was read complete before the build acted)" is replaced by "(no ref has been shown yet)". The old wording was false in that case, because an unissued original exists.
  - Every address goes through `where()`. It prints nothing when the location is absent or contains `AUTOMATION_STUDIO_WITHHELD_VALUE` (imported from the executor barrel). This covers reason locations and issued-ref locations.
- **`words.ts`.** Added `witnessRequired()` and `destinationUnissued()`. Both are generic: observe completely the list where the effect would show, retry naming the ref that observation issues, refs come only from a resetDestinations receipt, looking and navigating stay available, and no new permission is needed. I also added one sentence to `SETTLE_MODEL`: such an act cannot be settled when nothing was read complete before the first lasting act.

  I first put the refusals in a separate `reset-refusals.ts`. That took the directory to 26 source files, over the audit's 25-file limit, so I folded them into `words.ts` and deleted the file.
- **`contracts.ts`.** `claim` gains an optional `resetDestination` parameter. **`index.ts`** exports `reset-witness.ts`.
- **Tests.**
  - New `tests/reset-witness.test.ts`, with a reading-list example and 11 tests. It covers every definition-of-done item: refusal records no act; an issued ref is admitted; a control in a complete list is admitted; a stated toggle is admitted, while a stated `delete` is refused; a refusal does not seal; a sealed ledger admits as before, and unscoped, irreversible and creation presses keep their own policy; sealed with no ref, the settle words carry no resetDestination; no settle clause contains the marker, both directly and through the ledger with an original read at a withheld place; an invented ref is refused on a press, on an observe and on `claim` under `undoes`, and an issued one is admitted.
  - `create-baselines.test.ts`: the "ordinary modifications admitted" case now uses a stated toggle, because a bare scoped modification is refused before the seal.
  - `settlement-shapes.test.ts` shape F: now expects the cannot-settle words and no "resetDestination".

Downstream, `apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts`, edited and not run:

- The save on the job page (the heart icon, which has no stated state and sits in no list) was the build's first lasting press, with no ref. That press is now refused.
- New builder path:
  1. Read My jobs, which issues the ref.
  2. Open the job.
  3. `save.unwitnessed` with no ref. Asserted: `candidate.reset_witness_required`, no click dispatched, declaration not permitted.
  4. `save` naming the ref: admitted, one click.
  5. Submit.
  6. Trial. Expected `yes`, with `save` under `startedWith.cannotUndo`, because Core's own look at My jobs settles it as unchanged. No acts to undo or restore, and the trial's "save the job" step succeeded.
  7. Complete.
- The minimum count of My jobs reads drops from 3 to 2.
- Dropped: the old "undo aimed at a job saved before the build" step (`undo.held`) and the look naming the ref under `undoes`. That shape can no longer be reached before the seal, because a no-witness press cannot land, and the act id cannot be learned before a trial. `rowControl` is no longer imported.
- The test title changed.

The other three specs need no change:
- `photo-toggle`: the Like carries place and state, so it is admitted.
- `office-buy-now`: an identified create with a ref.
- `installed-project`: `add.missing` is a create refused under its own code, and the later modify presses come after the seal.

## Commands run and observed results

- `cd .../t738/!FluxIQ/packages/fluxiq && npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests --pool=forks --poolOptions.forks.singleFork` printed "Test Files 16 passed (16), Tests 252 passed (252)" (final run, after the words.ts fold).
- `cd .../t738/!FluxIQ && node scripts/structure-audit.mjs` printed "structure-audit: passed (421 warning(s), 1152 baselined)". The earlier failures I caused (26 files in the directory; two statements on one line in ledger.ts) were fixed and the audit was rerun.
- Consumer check, files I do not own: vitest on `flow-bootstrap/tests/action-permissions.test.ts`, `service/project-build/tests/{reset-calls,project-build-acts-record,project-build-reset-settle,project-build-brief-ports}.test.ts` and `project-agents/dispatch/tests/reset-done.test.ts` printed "1 failed | 44 passed (45)". The failure is in action-permissions.test.ts, "hands the ledger a destination named later, on a look that names the act under undoes (F1 continuation)": `expected { kind: 'admit' } to match object { kind: 'refuse' }` at line 123. Its `save` press (`modify_existing`, subject plus page, no scope in a list, no state, no ref) comes before any lasting act. It is now refused `candidate.reset_witness_required`, so no act exists, and the trial is admitted. This is the intended change. That consumer run happened before the words.ts fold. The fold changed only where the words live, not any logic.

## Not verified

- No tsc or package typecheck (left to the lead, per the brief).
- The edited e2e spec was not run. Its expected path rests on four things I could not confirm by running it:
  - Core's own `lookAt` reads My jobs before the trial and settles the save as unchanged.
  - The job page heart declares no `state` and resource-matches My jobs.
  - A trial admitted with `startedWith` answers `yes`.
  - The domain declares `permitted: false` for the refused press, so the instrumented runtime records it.
- How the refusal looks in a real build: the wrapper returns `createRefusal.evidence` with `resultCode` the same way as for `create_baseline_required`. I read this from action-permissions.ts lines 353-382 and did not exercise it.

## Open questions or contradictions found

1. **Wiring needed outside my ownership, for the invented-ref refusal under `undoes`.** Until the callers forward the ref, a look under `undoes` that names an invented ref still runs, and the ref is still ignored in `explored`.
   - `flow-bootstrap/action-permissions.ts` `claimed()`: `siteReset.claim(undoes)` should become `siteReset.claim(undoes, value.resetDestination)`. Read `resetDestination` from the destructured input before it is stripped.
   - `service/project-build/reset-calls.ts` line 45: `claim: (undoes, destination) => owner(undoes).claim(undoes, destination)`.
   - `service/project-build/acts-record.ts` line 68: `claim: (undoes, destination) => calls.claim(undoes, destination)`.

   A test belongs beside action-permissions: a look under `undoes` with `resetDestination: "destination-9"` returns `candidate.reset_destination_unissued` and is never executed. The lasting-press path already works through `createBaseline`.
2. **`action-permissions.test.ts` line ~103-128 needs updating** to the new behaviour. Either the `save` press names `resetDestination: ref`, or the test asserts the new `candidate.reset_witness_required` refusal reaching the model unrun.
3. **Interpretations I made.** Each is narrower than the brief's literal words:
   - The stated-state witness counts only for exactly `modify_existing` with a place, which is what the toggle witness actually needs.
   - The rule skips unscoped presses (legacy policy) and any exactly-`create_new` press ("create_new behaviour is unchanged").
   - An invented ref on an identified create keeps `create_baseline_required` rather than the new code.
4. `ledger.ts` `lookFirst` still passes any location, including a withheld one, to `checks.lookAt`. I left it unchanged because it was not in the brief. Another worker is removing the marker's source.
