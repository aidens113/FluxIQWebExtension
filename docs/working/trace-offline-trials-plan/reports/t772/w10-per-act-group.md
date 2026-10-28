# t772 w10: one act on a shared list settles by its own subjects

## Outcome

Done, with one deliberate narrowing of the brief, explained below.

- An act whose own undo landed now settles `restored` when two things hold:
  - a fresh load read (not stale in place) shows the subjects it added or removed back as the build found them;
  - every other difference on that list is the own subject of another act of the ledger that is still left on the site.
- A difference no act explains keeps every act open, exactly as before.
- Acts with no subject of their own, and acts with no landed undo, keep the whole-group rule.

**The narrowing: the rule applies only to acts whose undo landed.** The brief allowed "restored (or unchanged)". I limited it to undone acts, so they settle only `restored`. Applied to every act, it broke a pinned regression (settlement-shapes shape B) and exposed this hazard:

- A list that draws a new row only on its next load does not yet show act N's row on the read just after act N.
- Act N's own subject would then look "as found", and the siblings' rows would be put down to the siblings.
- So act N would settle `unchanged` for good, and its row, appearing later, would be explained by no one.

A new test pins this guard. It failed with the guard removed.

## What changed and why

Paths are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/reset-settlement/`.

- **`group-witness.ts`.**
  - New optional input `others`, of new type `AutomationStudioSiteResetOtherAct = { sequence, subjects }`.
  - New private `backButOthers`. A relevant scope that is not `restored` still holds when, after leaving out the subjects another act explains, it is its original row for row and value for value.
  - A subject is explained when it is not one of this act's own subjects, and some other act recorded after the scope's original was read has it among its subjects.
  - So this act's own subjects must be exactly as found. A row no one added, an original row gone or changed, or an unexplained reorder all keep the status `differs`.
  - The "other scopes of the group holding the act's subject" check is unchanged.
  - `currentGroups` was added to the observations `Pick`.
  - The header has a new paragraph.
- **`act-groups.ts`.** New optional input `others(group)`. It is consulted only when the act has subjects, and is passed through to the group witness. Header updated.
- **`judge.ts`** (strictly needed: only the judge knows the ledger's acts).
  - `AutomationStudioSiteResetJudgedAct` gains optional `undone` and `settled`. The ledger's `Act` already carries both, so `ledger.ts` is untouched.
  - `groupsOf` caches `readInPlace` per group. It hands `others` only when the act has `attempts > 0` and the group's latest read is not in place, which respects the R1 stale-in-place fact.
  - `witnessed` takes an optional `others` callback. `undosOn` still calls it without one, so there is no recursion.
  - New `othersOn(act, group)` returns the other acts of the ledger that are:
    - not undone and not settled;
    - holders of subjects of their own;
    - witnesses of that same group (with lent destinations included).
  - Because an explaining act witnesses the group and its own subject still differs there, it cannot settle while that subject shows. So the result does not depend on the order in which acts are judged.
  - The header has a new paragraph.
- **`decision.ts`, `act-subjects.ts`, `collection-groups.ts`:** unchanged; nothing was needed there.
- **Spent-act credit (w5):** compatible.
  - A spent act whose row still shows on a load stays open (`undo`), and it explains its own row for its siblings.
  - `undo-reach.removedBy` is untouched and still leaves that row to it.
- **Admission and settlement stay consistent.** An act settled this way is `undone`, so its undo is no longer admitted. The remaining act's differences are its own subject, which `undo-reach` still assigns to it, so it stays meetable.

## Tests

New file `reset-settlement/tests/per-act-group.test.ts` (10 tests). `site-reset/tests` was not touched. The fixture is a generic library: "Reserve" acts on "My reservations", with opaque tokens only.

Ledger level:

1. Three reserves, two cancels landed, then Core's load shows `[held-a, book-3]`:
   - the trial refusal's `actsToUndo` is exactly `[act-3]`, and `unsatisfiable()` is `[]`;
   - standings are `restored`, `restored`, `in_place`;
   - `leftover` gives act-1 and act-2 `{no, restored}` and act-3 `{yes, in_place}`, and `trialRan([])` is `[act-3]`;
   - an undo of act-1 is no longer admitted;
   - after act-3 is cancelled and the list loaded, the trial is admitted and act-3 is `restored`.
2. The same outcome on a load made by leaving the page and opening it again.
3. A read in place after the undos never settles anything, even when it draws the rows gone.
4. Never settles an act with no landed undo on a sibling's row. This is the load-drawn-row guard.
5. to 7. (it.each) Negatives. On a load showing a row no act added, an original row gone, or an original row's value changed:
   - all three acts stay open, whether to undo or listed apart;
   - act-1 and act-2 are never `restored`, and their `left` is never `no`.

Pure `groupWitness`:

8. It holds when every remaining difference is another act's own subject, including that subject's value or order. It differs without `others`, or with `others` empty.
9. It differs when:
   - its own subject is still there;
   - a stranger row shows;
   - an original row is gone or changed;
   - the other act shares its subject.
10. It never puts a difference down to an act recorded before the original was read, and an act with no subjects is judged on the whole list.

## Commands run and observed results

All test runs and `tsc` ran from Core `packages/fluxiq`.

- **Failing first, on the unfixed tree:** `node ../../scripts/vitest-groups.mjs --groups=parallel <FB>/reset-settlement/tests/per-act-group.test.ts`
  - Result: `Tests 4 failed | 5 passed (9)`.
  - Tests 1, 2, 8 and 9 failed, with `expected [ 'act-1', 'act-2', 'act-3' ] to deeply equal [ 'act-3' ]` and `expected 'differs' to be 'holds'`.
  - The negatives passed on today's tree, as guards should. In my first draft they asserted `inPlace()` only and failed, because today's code lists those acts apart (`no_admissible_undo`). I corrected them to assert "open and left".
- **After the first implementation:** same file `Tests 9 passed (9)`. The four-directory run gave `Tests 1 failed | 533 passed (534)`, in `site-reset/tests/settlement-shapes.test.ts` "shape B … admits at the first ask": `expected { Object (kind, startedWith) } to deeply equal { kind: 'admit' }`. The cause is the act-2 `unchanged` settle analysed above. Fixed by the `attempts > 0` limit, not by editing the test.
- **Guard proof:**
  - With `act.attempts === 0 ||` removed from `judge.ts`, test 4 failed: `expected 'unchanged' to be 'in_place'` (`Tests 1 failed | 9 passed (10)`).
  - With the guard restored: `Tests 10 passed (10)`. The file was restored from a scratch copy.
- **Final four-directory run:** `node ../../scripts/vitest-groups.mjs --groups=parallel <FB>/site-reset <FB>/reset-settlement <FB>/reset-admission <FB>/reset-answers` gave `Test Files 41 passed (41)` / `Tests 535 passed (535)` / `all groups passed: parallel`.
- **Typecheck:** `node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.
  - First run: `group-witness.ts(102,75): error TS2339: Property 'currentGroups' does not exist on type 'Pick<…>'`.
  - After the fix: exit 0, no output.
- **Structure audit** (Core root): `node scripts/structure-audit.mjs` gave `structure-audit: passed (446 warning(s), 1152 baselined).` That is 0 violations. Two advisory warnings are on owned code:
  - `judge.ts` is 433 lines, past the 400-line advisory;
  - `reset-settlement/` has 20 source files.

## Not verified

- No headed, browser, live or Lab run (forbidden by the brief). I have not rerun `job-undo-redraws-on-load.spec.ts:134`. I expect its mid-gate `actsToUndo` to be `[act-3]` now, because the spec's flow matches test 1: saves naming the list ref, two landed undos, then Core's load. That is unconfirmed.
- Project builds: `othersOn` reads only this ledger's acts. An act in another brief's ledger never explains a difference, so such cases stay open as today (conservative).
- I did not run full suites or anything downstream. Nothing downstream changed.

## Open questions or contradictions found

1. **Narrowed from the brief.** "settles restored (or unchanged)" now applies only to acts with a landed undo, so an act can settle only `restored` this way. Reasons:
   - the load-drawn-row hazard above;
   - the pinned shape B, in `site-reset/tests`, which I may not touch.

   An act that never acted visibly beside a sibling's leftover row stays open until that row goes, as today. If the lead wants `unchanged` per act too, it needs evidence that the read came after the act's row could have been drawn (a load after the act). It also needs shape B's expectation revisited.
2. **Documentation.** Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` ("How an act settles") is outside my fence. It should gain a sentence on the per-subject settle of undone acts on a shared list.
3. `judge.ts` is now past the 400-line advisory threshold. A later split could move `othersOn`/`undosOn`/`witnessed` into a small helper module.
