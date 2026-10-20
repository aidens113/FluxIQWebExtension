# l1-c1-settlement: one settlement model in the site-reset ledger

Worker report for brief `l1-c1-settlement`. Core worktree `fxwork/t724/!FluxIQ`, branch
`task/t724-reset-settlement-redesign`. Nothing committed. `SR/` = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/`.

## Outcome

Done, with one deviation from the brief's layout. The brief asked for a new `SR/settlement/` directory. That is not
possible under the structure audit: `SR/settlement/x.ts` has 10 path segments, the depth limit is 9, and the depth
rule does not ratchet, so the audit would fail. No non-test file in Core is deeper than 9 today. The settlement modules
are flat files in `SR/` with a shared `settlement-` prefix instead. The prefix-group rule exempts this depth. Their
tests are `SR/tests/settlement-shapes.test.ts` and `SR/tests/settlement-witnesses.test.ts`. No contract change was
needed: `contracts.ts` and `start-check.ts` were not touched.

## What changed and why

New modules: one export each, plus their own types.

- `settlement-toggle-witness.ts`: `automationStudioSiteResetToggleWitness({state, before, after})` returns
  `{from, to}` only when exactly one control at the place went from `state` to exactly one other state.
- `settlement-control-tracker.ts`: `AutomationStudioSiteResetControlTracker`.
  - It keeps controls per page scope. A place missing from a later read of that page counts as empty.
  - It keeps build-start counts per place (from the first sighting) and pending presses per place. The next read of
    the press's page fills a pending press. A read of that page that reports no `controls` at all resolves it as
    showing none.
  - It keeps the last filled press per place with its ledger clock.
  - `landed()` takes a trial step's press. `standing()` answers holds, stale or open. `unread()` answers stale while
    a press is still pending.
- `settlement-group-witness.ts`: the relevant-scopes rule, as a pure function.
  - Relevant scopes are the named or own scopes, plus every original scope of the group that held one of the act's
    subjects.
  - It holds only on a fresh read (group clock stamp at or after the act and at the current ledger clock) that holds
    every relevant scope restored row for row, where no other fresh scope holds an act subject it did not originally
    hold with the same value.
  - A missing relevant scope or a malformed group gives `incomplete`.
  - `changed` reports whether the latest read after the act showed a difference (feeds `changeSeen`).
- `settlement-decision.ts`: returns `settled: restored|unchanged`, or `open` with reasons `look`, `undo`, `toggle`
  and `name`, each with a ref and location.
- `settlement-trial-repeat.ts`: the trial-repeat matcher. It requires:
  - the same consequence set;
  - the same operation/definitionId where both are known;
  - the subject or page token positively equal;
  - no contradiction among subject, page and resource.

  Scope and place are not compared, because locations can differ between exploration and trial.
- `settlement-words.ts`: the generic `settle` sentence. It names only this run's refs, counts and locations.
- `settlement-observations.ts`: the ledger's complete-list state (originals, latest reads, group clock stamps and
  locations, `restored()`), moved out of the ledger.
- `settlement-transfer-witness.ts`: the existing t719 `witnessTransfer` logic, moved out unchanged as a pure function.
- `settlement-act-groups.ts`: gathers one act's group witnesses (destinations, transfer, subject undo, own list) with
  ref and location.

The last three were not in the brief. I added them to keep `ledger.ts` within 800 lines (it is now 799).

`ledger.ts`:

- **Removed:** `originalGroupRestored`, `subjectRestored` and `leftUnchanged`. The header is rewritten (the F1
  paragraph is replaced by an L1 paragraph).
- **New act fields:** `destinations[]` (accumulates, never removes), `repeats[]` (destinations resolved lazily),
  `clock`, `press`/`toggle` (only for an act declaring exactly `[modify_existing]`), `changeSeen`, and a sticky
  `settled`.
- **The clock** advances on:
  - a landed, permitted `mutate` that declares a lasting class, or that is recorded as a possible act;
  - any landed `mutate` under `undoes`;
  - each `trialRan`.

  An unrecorded navigation does not advance it.
- **`observed()`:** feeds the observations, the tracker and the clock stamps. It evaluates open acts before and after
  each read, so a witness named since the previous read counts what that read showed. It then settles acts for good.
- **`explored()`:** pends presses at `declared.control.place`, for acts and for undos. A ref named under `undoes`
  resolves through `createBaselines.named()` without the act's resource.
- **`target()`, toggle back:** a control at the toggle's place, showing `toggle.to`, declaring `[]` or
  `[modify_existing]`, is admitted `own` with `["modify_existing"]`. Any other control at that place is refused
  `undo_unproved`.
- **`trialRan()`:** advances the clock, records the toggle from `act.controls`, and fills repeats through the matcher.
- **`beforeTrial()`:**
  1. Calls `checks.lookAt` once per stale-witness location, then evaluates.
  2. `restored` marks the act undone.
  3. `unchanged` is listed under `startedWith.cannotUndo` with the `leftUnchanged` words.
  4. `open` stays in `inPlace()` with `settle`.

  Kept strict acts still refuse `trial_reset_unproved` (now carrying `settle`) until settled.
- **New `standing(actId)`:** returns `in_place`, `restored`, `unchanged`, `kept`, `irreversible` or `undefined`. A
  legacy act its page showed nothing of (`noEffect`) counts as `unchanged`.
- **Unchanged:** legacy unscoped acts keep their old paths (compareAt, undoSeen, kept).

Other edits:

- `destination-unchanged.ts` is deleted. The barrel `index.ts` drops it and exports the new files.
- `create-baselines.ts`:
  - each original keeps its read location;
  - new `named(ref)` resolves an issued ref of a valid group without checking resource;
  - new `described(scope)`;
  - new `issuedRefs()` returns ref, count and location;
  - `destination()` is unchanged.
- `words.ts`:
  - `NAME_DESTINATION` and `nameDestination()` are replaced by the generic `SETTLE_MODEL` and `settleModel()`;
  - new `unprovedReset()`;
  - `leftUnchanged()` is reworded;
  - `startedWith(true)` now says a kept act is either one with no control that undoes it, or one with no change seen;
  - `keptAct(false)` now describes only the legacy kept act it is said to. A strict open act is claimable and never
    gets it.
- `project-reset.ts`: passes `lookAt` through the shared checks, deduplicated per place for each ask across ledgers.
- `trial-policy.ts`: `named()` keeps `settle`. It is not part of the stall signature.

### Existing test expectations changed (each pinned removed behaviour; no invariant weakened)

1. **`tests/trial-policy.test.ts`**, "runs a trial with kept acts in place": it expected the old wording "could not be
   undone on this site". It now expects "the site offers no control that undoes it" and "nothing it could change showed
   a change". Reason: the startedWith words had to be true for strict acts settled unchanged.
2. **`tests/ledger-subject.test.ts`**, transfer restoration (renamed): the `sibling` defect, where an unrelated list
   `p:sibling` changed, now admits. The design says unrelated lists no longer block. The `fake`, `order` and
   `quantity` defects still refuse.
3. **`tests/ledger-subject.test.ts`**, "declared retry inverse": `sibling` and `partial` (the unrelated `p:sibling`
   changed or missing) now admit. I added `own-missing` (a list the acts touched is missing), which refuses.
4. **`tests/ledger-subject.test.ts`**, "settles a truly failed declared press": `partial` now drops the press's own
   list and refuses. I added `unrelated-partial`, which admits.
5. **`tests/ledger-subject.test.ts`**, F1 "still refuses a named destination with %s":
   - `partial` now drops the named list itself.
   - I added `held-subject-changed`: the pre-held subject's row value changed, and it refuses.
   - `own-list-unread` and `subject-held-before` moved to a new `it.each`, "settles on its named destination alone
     with %s", together with `unrelated-partial`. By design, the own list is a witness only when it was read before the
     act, and a pre-held subject settles by its unchanged row value. F1 had refused both.
6. **`tests/ledger.test.ts`**, F1 "still refuses the trial when the destination read is %s":
   - `sibling` is removed;
   - `partial` now drops the admitted destination;
   - a new `it.each` ("only an unrelated list of the page is sibling / sibling-missing") admits, and still refuses an
     undo of a pre-existing line.

### New tests

`tests/settlement-shapes.test.ts` has 19 tests.

- **One per design shape:**
  - A: wrong claim refused, retry inverse admitted, both restored.
  - B: a stale witness says exactly what to read, and Core's look admits at the first ask, looking once per place.
  - C: an admitted create left unchanged on Core's look. It is sticky across a trial, and a claim on it is refused.
  - D: failed presses with no list of their own. Undos on pre-existing rows are refused unrun, and the presses settle
    on the named list.
  - E: a trial act inherits the repeated explored act's destination and settles with no model work. A non-repeat trial
    act is asked to name its list (its `settle` words list the refs with counts and locations), cannotUndo does not
    settle it, and a look under `undoes` naming the ref without a resource settles it.
  - F: no complete list means no ref and an open act. A complete list issues a ref and the act settles.
  - G: a toggle pressed in a dialog is pressed back on the item's own page, admitted with `own` and
    `[modify_existing]`, and restored. A different place, a control already back, and a different class are refused
    unrun. A control still showing the set state stays open with the toggle words.
- **Invariants:**
  - partial, malformed and stale reads of a named list never settle;
  - cannotUndo never settles a strict act;
  - a toggle that reverts with no press never settles;
  - an unread own press never settles on the lists alone;
  - `standing` answers for every kind of act.

`tests/settlement-witnesses.test.ts` has 12 unit tests of the pure modules. The fixtures are a reading list and a
recipe box with opaque tokens. One assertion checks that the settle words contain no site nouns.

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQ`.

| Command | Observed result |
| --- | --- |
| `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset` | Final run: Test Files 13 passed (13); Tests 234 passed (234) |
| The same, combined with `.../runtime/service/project-build/tests`, `.../runtime/project-agents/dispatch/tests`, `.../runtime/project-agents/supervisor/tests`, `.../runtime/flow-bootstrap/candidate/tests` and `.../runtime/service/candidate-trial/tests` | Test Files 127 passed (127); Tests 990 passed (990) |
| `npx vitest run .../runtime/flow-bootstrap/tests/action-permissions.test.ts` (extra) | 26 passed |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (409 warning(s), 1152 baselined)`. The warnings on my files are advisory only: ledger has 30 methods (limit 40); `SR/` has 23 source files (limit 25); `ledger.ts` is 799 lines (limit 800); the two old ledger test files are over 400 lines. |
| `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` | exit 0, no output |

The failures seen during the work were all mine and were fixed:

- 10 pinned expectations, listed above;
- 3 mistakes in my new tests;
- 1 stale-invariant rewrite after settling became sticky at read time.

The neighbouring suites never failed. The other workers' Core edits (C2: `authoring-loop.ts`, `trial-gate.ts`,
`landed-acts.ts`; C3: `evidence-loop.ts`, `repeat-policy.ts`) were present during those runs. I checked that C2's
`authoring-loop.ts` passes a `lookAt` that feeds the read to `ledger.observed`, which is the contract the ledger
assumes. There were no type errors outside `SR/`.

## Not verified

- No live, Lab or browser run, and no downstream run. Real domain reads carrying `controls`, the list fact or
  `place`/`state` tokens (D1/D2) are exercised only through made-up fixtures.
- The project-build callers do not pass `lookAt` yet: `service/project-build/brief-ports.ts` (`phaseStart.reset` and
  the builder's subflow trial checks) and `project-agents/supervisor` whole trials. Core looks only where a caller
  passes `lookAt`. C2's `authoring-loop.ts` does; the others are outside my ownership.
- Full suites were not run, per the twice-a-day rule.
- One known residual risk, by design and unchanged from the old `originalGroupRestored`: an act whose only witness is
  its own list can settle `unchanged` while its real effect landed somewhere unwatched. The toggle witness narrows this
  wherever the domain reports `controls`.

## Open questions or contradictions found

1. **Brief versus audit.** The brief's `SR/settlement/` directory breaks the non-ratcheting 9-segment depth rule. I
   used flat `settlement-*.ts` files. Moving them into a directory needs the depth rule relaxed, or `site-reset/` moved
   up a level.
2. **Headroom is gone.** `SR/` holds 23 of 25 allowed source files. `ledger.ts` is at 799 of 800 lines with 30
   methods. The next change here needs a split first: the admission logic (`target`, `transferTarget`,
   `otherObservedEffect`, `sameItem`, `aboutTheAct`, `reverses`) is the natural collaborator.
3. **Design interpretations I made.** Each follows the design's text:
   - A scope missing from a fresh read blocks only when it is relevant.
   - An act with no named or own list has no group witness, even when a list it never named held its subject. The
     t719 "pre-existing quantity" test therefore still refuses.
   - Settlement is sticky the moment a fresh read settles it, not only when `beforeTrial` asks.
   - A pending own press keeps the act open until its page is read.
4. **C4 (words) can use** `standing(actId)` and each act's `settle`. `WORDS.nameDestination()` no longer exists;
   `WORDS.settleModel()` replaces it. Nothing outside `SR/` called it.
