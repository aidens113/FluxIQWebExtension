# l1-c7-build-repeats: one rule for repeats, one rule for looks

Worker report for brief `l1-c7-build-repeats`. Core worktree `fxwork/t724/!FluxIQ`. Nothing committed. All edits are
under `SR/` = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/`.
`whole-trials.ts` was not touched: the rule fits inside `SR/`.

## Outcome

Done. All three parts are in place. Every check the brief names passes.

## What changed and why

### 0. Undo admission moved out of the ledger

- New file `SR/undo-admission.ts`. It has one value export, `automationStudioSiteResetUndoAdmission`, plus its types.
- The following moved into it from `ledger.ts` with no logic changes:
  - `target`'s body, after the unknown-act check;
  - `transferTarget` and `otherObservedEffect`;
  - `sameItem`, `aboutTheAct`, `reverses` and the `REVERSES` table.
- The subject-deletion branch is now its own private function, `subjectDeletion`. Its condition is the same, written
  as early returns.
- `ledger.target` keeps the unknown-act refusal. It then hands the admission a small view of the ledger: its acts,
  its observations, `claimable`, `inPlace`, `toggleOf`, `named`, and `namedAct` as `plain`.
- The ledger dropped two private methods (30 methods now).
- File sizes: `ledger.ts` went from 799 to 731 lines (the new header paragraphs are included). `SR/` now holds 24 of
  its 25 allowed files.

### 1. One rule for repeats (office E)

- `AutomationStudioSiteResetLedgerOptions` has a new option, `buildExplored?: () => readonly
  AutomationStudioSiteResetExploredAct[]`.
- New type `AutomationStudioSiteResetExploredAct`: `{ id, consequences, operation?, spot?, destinations }`.
- New public method `ledger.exploredActs()`. It returns this ledger's explored acts (those with a `call`), each with
  a copy of every destination named for it so far.
- New private method `buildExplored()`. It returns the option's result, or `exploredActs()` when the option is
  absent, so a standalone ledger keeps its own acts.
- `trialRan` matches repeats against `buildExplored()`.
- `evaluate` resolves `act.repeats` ids against `buildExplored()` each time it is called. That keeps the lookup lazy,
  so a destination named after the trial still counts. Act ids are unique across a build, so an id lookup is
  unambiguous.
- `project-ledger.ts` `forBrief` passes `buildExplored: () => every brief's ledger's exploredActs()`.
- Headers updated: `ledger.ts`, `project-ledger.ts`, `settlement-trial-repeat.ts`.

### 2. One rule for looks (the job "restored" note)

- In `explored()` under `undoes`, a call is a look when it was admitted `on: "moving"` and its declaration has no
  lasting class and no item (or it declared nothing).
- A look may still name a destination (`resetDestination`). Nothing else happens: no attempt, no `undoneBy`, no clock
  bump, no tracker press. The act's standing does not change either: no `kept`, no `spent`, no `chain`.
- Settlement then comes from the fresh read alone, so it is `unchanged` when the read equals the baseline.
- **One deviation from the literal wording, deliberately:** the look test also checks the declaration, not just `on`.
  - In production, `moving` is only admitted for calls with no consequences and no item, or for `observe` calls, which
    are not presses at all. So production behaviour is the same as the literal rule.
  - The extra check stops a call that declares a lasting class from skipping the clock bump. Skipping it would leave a
    read fresh when it should be stale.
  - It also keeps an out-of-scope fixture valid. `service/project-build/tests/project-build-phase-start.test.ts:92`
    labels a `["delete"]` undo `on: "moving"`, which `target` would never admit. With the `on`-only rule, two of its
    tests failed: "a builder's subflow trial after a predecessor with no start hook" and "the whole trial of the
    assembled Flow with no start hook". I may not edit that file.

### Changed legacy expectation, and why

`SR/tests/ledger.test.ts`, "may still be undone under `undoes`, judged as any undo is…" (t593 coupon):

- **Before:** a press with no consequences and no item, admitted `moving`, plus `undoSeen(true)`, undid the possibly
  lasting coupon act.
- **By the binding rule:** that press is a look. The ledger cannot tell it from a navigation or from opening a view, so
  it must not count as an undo.
- **The test now pins both sides:**
  - after the `moving` press, `possiblyInPlace` is still `[act-1, act-2]`;
  - the coupon act now sits on its own item (`card:coupon`); a press on that item is admitted `own`, counts as an
    undo, and leaves `[act-2]` as before.
- The start-hook half of the test is unchanged.

### New tests (generic opaque fixtures)

`SR/tests/project-ledger-repeats.test.ts`:

- **Single subflow.** The builder's explored press names destination-1. The whole run's act is recorded in the
  supervisor's ledger (`project.forBrief("brief:supervisor").trialRan`). It inherits the destination and is admitted
  `unchanged` on one Core look (`loc:box`), listed under `startedWith.cannotUndo`. No undo is made, and claiming it is
  refused `undo_act_kept`.
- **Multi subflow.** Brief B's trial act repeats brief A's press, which has no destination yet. It is refused with a
  settle that says "name that list's ref". A look under `undoes` in A's ledger then names destination-1. B's act
  settles `unchanged` on Core's look.
- **Negative.** A trial act matching nothing across the build stays `in_place`, is refused asking to name its list,
  and gets no Core look.

`SR/tests/ledger-looks.test.ts`:

- **Navigation look.** A navigation look under `undoes` (declared `mutate`, `[]`, admitted `moving`) names a ref for a
  press the site failed.
  - The trial is admitted with no Core look. The read before the look is still fresh, which proves no clock moved.
  - The act is listed under `startedWith.cannotUndo` with the "left unchanged" wording. Its standing is `unchanged`.
  - The claim is refused `undo_act_kept`, with no `undoneBy`.
  - `trialRan` still answers it as left on the site.
- **Real undo still counts.** A look before the undo leaves the act refused `trial_reset_required`. A press on the
  act's own control is then admitted `own` and settles `restored`.

**Discrimination check:** I temporarily reverted both fixes (`buildExplored: undefined`; `look = false`). The three
positive tests failed. The negative test and the restored test passed, as they should. Both files were then restored
from backups.

`SR/tests/settlement-shapes.test.ts` is unchanged and passes.

## Commands run and observed results

All commands were run from the Core worktree root.

| Command | Observed result |
| --- | --- |
| `npx vitest run` over `RT/flow-bootstrap/site-reset`, `RT/service/project-build`, `RT/project-agents`, `RT/flow-bootstrap/candidate`, `RT/flow-bootstrap/subflow-candidate`, `RT/service/candidate-trial` (final) | exit 0, `Test Files 173 passed (173)`, `Tests 1270 passed (1270)` |
| Same command, with the earlier `on`-only look rule | 2 failed in `project-build-phase-start.test.ts` (named above); fixed by the declaration guard |
| `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` (final) | exit 0 |
| `node scripts/structure-audit.mjs` (final) | `structure-audit: passed (409 warning(s), 1152 baselined)` |

Site-reset audit warnings are advisory only:

- class-methods: 30 (the warning starts at 25; the limit is 40);
- directory-files: 24 (the warning starts at 15; the limit is 25);
- file-lines: `ledger.ts` 731, `tests/ledger-subject.test.ts` 708, `tests/ledger.test.ts` 600 (the warning starts at
  400; the limit is 800).

## Not verified

- No browser rerun of office E or the job case. The installed-gateway proof (`l1-d3`) still has to be rerun, and the
  `test.fail` marker on office E removed once it passes.
- I read but did not test that, in the real office E flow, the supervisor's ledger sees the cart's original and Core's
  look before the builder's second test:
  - it adopts the project originals on every `forBrief`;
  - reads reach it through `reset-calls.ts`, as an owner, without a baseline;
  - the single-subflow test reproduces this routing.
- Full Core and repository suites were not run (twice-a-day rule).

## Open questions or contradictions found

1. The look rule also checks the declaration (no lasting class, no item), not only `on: "moving"`. The reasons are in
   part 2. If the supervisor wants the literal `on`-only rule, the fixture at `project-build-phase-start.test.ts:92`
   (`["delete"]` with `on: "moving"`) must first be changed to an admission `target` can actually return.
2. A possibly lasting act (t593) undone by a press with nothing lasting and no item is now never undone; only a press
   on its own item counts. That follows from the rule. It does mean such a coupon, pressed from no item, can only be
   taken back by a start hook.
