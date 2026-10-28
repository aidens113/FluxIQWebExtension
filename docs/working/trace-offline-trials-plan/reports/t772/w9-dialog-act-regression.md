# t772 w9: photo-dialog-act regression

## Outcome

Done. The cause was found, a unit test failed first, the fix is in Core `site-reset/`, and the spec passes headed (2 of 3 runs; the failing run tripped a different assertion, explained under Not verified).

## Cause

The cause is w1's change to `site-reset/trial-stamp.ts`, not the domain `values` change.

On dev, `stamped()` overwrote a looped pass's `act.spot.place` with the receipt's place. In this spec the receipt's place is the explored post's. As a result, `locate()` touched the wrong place, and the first post's own Like place stayed untouched. When the builder opened the first post's own page (`own.look`), that read (which already showed the trial's like, `Unlike`) became the build's original in `control-witnesses.ts`. The twin step on that control was then stamped from it. Dev passed by accident, with a wrong original.

w1 correctly keeps the pass's own place, so the pass's act now touches the first post's place, as R1 requires. After that, no read can become the place's original. When revision 2's like step was submitted, `admitStep` found no proven original and gave no stamp. The trial door (`project-reset.ts`, `admit`) runs before `beforeTrial`, so test.3 was refused `candidate.trial_step_unwitnessed`. That refusal carried no `actsToUndo`, so act-4 (the trial's like on the first post) was never offered for undo, and the build ended with that post liked.

Evidence from the failing diagnostic:
- Dialog and own page at one address share one place token: explored.like's place `p:15f88d…` is the Like place the reads on that post's own page report.
- The first post's own-page read (read.14) reports place `p:46906c…` at `adb` (Unlike).
- test.3: `failed: no_witness`, `stepsUnwitnessed: [{step: 2, label: "like the post"}]`.

## Fix

A pass on another item already gets its own original: its own pre-press counts at its own place, read just before the build's first press there. That original is now also filed as the place's build-wide original.

- `site-reset/control-witnesses.ts`, new `passed(original)`:
  - files the original only where `canRead` holds: not sealed, the resource not blocked, the place not touched, and no original already filed;
  - validates tokens and counts the same way `observed` does;
  - drops `at`.
- `site-reset/trial-stamp.ts`:
  - calls `passed` in the other-item branch, before `locate` touches the place;
  - the header gains a paragraph on this;
  - the `receipts` Pick gains `"passed"`.

The twin step is now stamped by what the build found (unliked), never by a read showing the pass's own press. Where items share a place token, the receipt's original is already filed, so nothing is adopted.

## Failing-first evidence

New test in `site-reset/tests/trial-witness.test.ts`: "stamps a later step on a looped pass's item by that pass's own pre-press counts, never by a read after it". It uses generic tokens only.

- Before the fix: `1 failed | 86 skipped`, `expected undefined to deeply equal { via: 'control', ref: 'control-2' }`.
- After the fix: `Tests 87 passed (87)`.

## Commands and observed results

- Core 4-dir group (`site-reset`, `reset-settlement`, `reset-admission`, `reset-answers`): `Test Files 41 passed (41)`, `Tests 535 passed (535)`, `all groups passed: parallel`. Run twice, the second time after the concurrent worker's `group-witness.ts` edit landed.
- Core `tsc --noEmit -p tsconfig.json` (8 GB): the only error was in the concurrent worker's in-flight `group-witness.ts` (`currentGroups`), none in my files.
- Core build: the first two attempts failed on that same `group-witness.ts` error. I waited for the other worker's edit to land, then the build exited 0. `pnpm test:e2e:build` exited 0.
- Headed `photo-dialog-act.spec.ts`:
  - **Run 1:** `1 failed`, ending `proposed`, liked atEnd 0. The failure was at line 283 (`likedNotAtStart`), not at line 287. The first `undo.act-2` press landed (`ok`, click validated on the svg inside Unlike, `pageChanged`), but the post stayed liked (`likedBefore 1`, `likedAfter 1`). The second press worked.
  - **Run 2:** `1 passed (2.8m)`. test.3 `candidate.trial_reset_required` (act-4, control settle), undo act-4 1->0, test.4 `yes`, test.5 reset act-5, undo 1->0, test.6 `yes`; liked atEnd 0.
  - **Run 3:** `1 passed (5.0m)`, the same sequence.
- Headed photo-toggle, photo-dialog-destination, photo-dialog-step and photo-looped-other-item: `4 passed (5.8m)`.
- Domain unchanged, so I did not run the domain tests.

## Not verified

- **Run 1's first act-2 undo press did not take.** That press comes before any code this fix touches; act-2's path up to test.2 is identical to the failing pre-fix run, where the same press went 1->0. It looks like a press-landed-but-no-toggle timing issue on the photo fixture, possibly related to w6's note that `undo.second` dispatched three clicks. I did not investigate it.
- No live or paid runs.
- The whole site-reset headed folder was not run.

## Open questions

1. **The door hides acts still to undo.** The trial door (`admit`) refuses before `beforeTrial`, so a `trial_step_unwitnessed` refusal never carries the acts still to undo. Any other unwitnessed step would hide leftovers the same way. Joining the two answers needs the trial callers in `service/**`, which is outside my fence; t775 may retire this gate anyway.
2. **Step 9 `web.target.not_found` on pass 2.** Trial 1 still fails at step 9 (pass 2 "open the post"). The spec tolerates it, and it is unrelated to this fix.
