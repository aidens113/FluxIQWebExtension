# t772 w5: reset reach and answer consistency (fresh reach)

## Outcome

Partial. R1 and R2 are implemented. Every new test failed first and passes now. The four narrow Core directories pass (499 of 499) and the Core typecheck is clean.

Two things stop this from being Done:

- **The structure audit reports 1 violation, and it is not mine.** It is `service/project-build/` at 27 files. That count comes from another worker's untracked `brief-told.ts` and `evidence-beside.ts`, and `service/**` is outside my brief.
- **One expectation in the brief cannot hold under the current settlement model.** The brief said a load read showing the undone row gone settles that act `restored`. It does not; see "Open questions".

## What changed and why

Paths below are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

### R1: one fact, "this list was read in place after an undo landed"

**`reset-settlement/observations.ts`** now keeps the fact and its header explains it.

- **What counts as a load.** A read loads its page when either:
  - it is made at another location than the read before it, or
  - it is made during Core's own look there (`loading(location)`).
- **What is kept per group.** The number of undos that had landed on the acts the group witnesses at its latest load (`loads(undos)`). The judge supplies that count after every read.
- **The fact itself.** `readInPlace(group, undosNow)` is true when more undos have landed now than at the group's latest load.
- **A read with no location is judged as read, as before.** Neither the model nor Core can open its page again. Holding it as in place would leave its acts open forever. This is what the first draft did, and it broke `ledger-subject.test.ts` "purported Delete … sibling list" until I fixed it.

**`reset-settlement/judge.ts`**

- New `undosOn(group)`: the landed undos summed over this ledger's acts that witness that group.
- New `witnessed()`: the raw `actGroups` call, now shared by `groupsOf` and `undosOn`.
- `read()` now calls `seen.loads(undosOn)`.
- `groupsOf` marks each group `inPlace`.
- `differing()` returns `inPlace` for each group.
- `lookFirst`:
  - It reloads on the `reload` reason and no longer keeps the private `reloaded` WeakMap (deleted).
  - It wraps `lookAt` in `seen.loading(location)` and clears it in a `finally`.
  - `reached()` treats a `reload` group like a `look` group: if Core's look lands but the read still does not refresh that group, the group is lost.
- The header is rewritten to say this.

**`reset-settlement/decision.ts`**

- New open reason `reload`: a group that `differs` on a read made in place.
- `JudgedGroup.inPlace` added.
- A lost group that differs on an in-place read is unreadable. It becomes `unreachable` and is never a reload again.
- Header updated.

**`reset-settlement/words.ts`** has the settle clause for `reload`: "<list> at <loc> was read without loading again since an undo landed, and the page may show the removal only after it loads again: open that list's page again from another page (Core also loads it itself before the next trial)". The header now lists three guards.

**`site-reset/undo-reach.ts`**

- `noUndoReaches` returns `false` when any differing group is `inPlace`, the same as for an unnamed group.
- A removal equal to a spent act's landed `subjectUndo` (same scope and subject) is assigned to that act. It is no longer left for the others to match (new `removedBy`).
- Header paragraph added.

### R2: one answer never says both "a call can" and "no call can"

**New `reset-answers/agreeing.ts`** (exported from the barrel) is the closed check `automationStudioSiteResetAnswerAgreeing`.

- **When it applies.** The answer names its own `act`, and `canMeet` is `this_page` or `another_page`.
- **What it does.** That act is removed from `actsUnsettleable`, and the field is dropped when nothing is left in it. The act is then listed under `actsToUndo` as `{act, did, call}`.
- **When it does nothing.** A `no_call` refusal keeps its list unchanged.

**Where the check is applied.**

- `reset-answers/refusal.ts`: the constructor applies it to every refusal.
- `site-reset/ledger.ts` `target`: applies it again. `undo-claims.target` (not mine) appends `actsUnsettleable` after the constructor ran, so the constructor alone would miss it. The R2 clause of the brief allows this placement.
- `undo_unproved` is not in `reset-calls.ts` `LISTING`, so project builds also return this evidence unchanged.

**The "untried act on a stale read" half of R2** holds at its source. With R1 in place, no act is judged unsettleable on an in-place read.

**`ledger.ts` changes in total:** the import, that one line in `target`, and its header paragraph. Nothing else in `ledger.ts` changed. `undo-admission.ts`, `undo-claims.ts` and `own-control.ts` are untouched.

## Tests (each observed failing first)

**`site-reset/tests/settlement-reload.test.ts`** gains a new `describe` block. It uses a library with "Reserve" acts made from each book's page, witnessed on a "My reservations" list read complete before them, and one Cancel.

1. **The read in place still shows all three rows after act-1's undo landed.**
   - On that read: no act is unsettleable, and all three are in `inPlace()` with the reload words.
   - Core's look then loads the list without row 1. Nothing is unsettleable, and acts 2 and 3 remain in `actsToUndo`.
   - Acts 2 and 3 are then cancelled and the list loaded again. The trial is admitted and all three are `restored`.
   - Failing first: `expected [ { act: 'act-1', …(4) }, …(2) ] to deeply equal []` (all three were `no_admissible_undo`).
2. **Leaving the page and opening it again counts as a load.**
   - Failing first: `expected [] to deeply equal [ 'act-1', 'act-2', 'act-3' ]`. Before the fix all three acts were unsettleable, so none was in place.
3. **A loaded read that still shows the cancelled row leaves that row to act-1.**
   - Failing first: the same `[act-1 …]` versus `[]` failure.
   - I also checked it on the fixed tree: with only the `removedBy` filter disabled it gives "1 failed | 5 passed". The file was restored afterwards.
4. **R2 at the ledger level.** An undeclared undo of act-2 gives `undo_unproved` with `this_page`. Neither act-2 nor the untried act-3 is in `actsUnsettleable`, and both are in `actsToUndo`.
   - Failing first: `expected [ 'act-1', 'act-2', 'act-3' ] to not include 'act-2'`. This is the round 6 0226/0227 shape.

**`reset-answers/tests/refusal.test.ts`** gains a new `describe` block.

- For both `this_page` and `another_page`, the act is removed from `actsUnsettleable` and appended to `actsToUndo`. When it was the only entry, `actsUnsettleable` is dropped.
- `undo_already_done` with `no_call` keeps the act listed.
- Failing first: `expected [ 'act-2', 'act-9' ] to deeply equal [ 'act-9' ]`.

None of the tests uses job, save, heart or board words, or any realistic scenario's names.

## Commands run and observed results

All commands ran from Core `packages/fluxiq` unless noted.

**Failing first, on the unfixed tree:**

- `node ../../scripts/vitest-groups.mjs --groups=parallel <FB>/site-reset/tests/settlement-reload.test.ts <FB>/reset-answers/tests/refusal.test.ts`
- Result: "Test Files 2 failed (2) / Tests 5 failed | 7 passed (12)". The 5 failures are exactly the new cases.

**After the fix, the same two files:** "Test Files 2 passed (2) / Tests 12 passed (12)".

**First full run:**

- `node ../../scripts/vitest-groups.mjs --groups=parallel <FB>/site-reset <FB>/reset-settlement <FB>/reset-admission <FB>/reset-answers`
- Result: "Tests 1 failed | 498 passed (499)", in `ledger-subject.test.ts` "does not count a purported Delete as restored when it moved the new subject into a sibling list".
- Cause: reads with no location were held in place forever. Fixed in `observations.ts` (see R1).

**Final run of the same command:** "Test Files 38 passed (38) / Tests 499 passed (499) / all groups passed: parallel".

**Typecheck:** `node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`

- First attempt: TS2322/TS2559 at `ledger.ts:383`. My weak-type generic on `agreeing` was the cause; fixed by `A extends object`.
- Final: exit 0, no output.

**Structure audit:** `node scripts/structure-audit.mjs`, run from the Core root.

- Result: "structure-audit: 1 violation(s) across 1 rule(s)".
- The violation: `FAIL [directory-files] .../runtime/service/project-build/: 27 source files exceeds the 25-file limit`. `git status` shows `brief-told.ts` and `evidence-beside.ts` there untracked, from another worker. `service/**` is outside my brief.
- Advisory warnings on my files, none of them failures:
  - `ledger.ts`: 786 lines, and 33 methods (I added none).
  - `reset-settlement/`: 19 files (I added none there).

## Not verified

- No live, browser or Lab run (forbidden by the brief), so I have not shown that the round 6 failure is gone on the real site.
- **Project builds look one extra time per ledger.** The `loading` mark is per ledger. In a project build, Core's look is made by one brief's ledger, but its read reaches every ledger (`reset-calls.ts`). Another ledger sees that read at the same location as its previous read, so for that ledger it is an in-place read. Each ledger's own `beforeTrial` then makes its own look, which costs one extra look per ledger. I reasoned this from the code; no test covers it.
- **Cross-ledger reach is unchanged.** `undosOn` counts only this ledger's acts. An undo that landed on another brief's act does not make this ledger's in-place read stale.
- **Opening the same address again from the same page does not count as a load.** Reads carry no load flag, and an explored call cannot tell a navigation from an in-place press, so the words say "from another page". Core's own look before a trial always clears the fact.
- The downstream tree was not built or tested. This change touches nothing downstream.

## Open questions and contradictions

1. **Brief versus model: "a load read showing the undone row gone settles that act restored".** Under the current group witness (`reset-settlement/group-witness.ts`, not mine), an act settles only when its whole relevant list matches the original row for row. With acts 2 and 3 still on the list, act-1 stays open with reason `undo`, so it is not `restored`. The test asserts what holds:
   - the other two acts stay in `actsToUndo`;
   - nothing is unsettleable;
   - all three are `restored` once they are all undone and the list is loaded again.

   Settling one act per subject on a shared list would be a group-witness change for the supervisor to decide.
2. **A risk of the spent-assignment rule (as the brief asked).** Suppose a freshly loaded list still shows the spent act's row, so its undo really did not take. That act now stays open with reason `undo` instead of being listed unsettleable. Its undo is then refused `undo_already_done` (`no_call`), and trials stay refused while it is in place. The honest exit then rests on the trial refusal's words or the repeat guard, rather than on `gate_unsatisfiable`. Worth a look when R3/R4 land.
3. **The audit cannot reach 0 within my fence.** It needs `service/project-build/` grouped, which is another worker's area.
4. **`site-reset/tests/` is still at 25 files.** I added no file there and extended `settlement-reload.test.ts` instead.
