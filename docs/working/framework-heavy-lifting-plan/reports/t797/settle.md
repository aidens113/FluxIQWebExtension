# t797-settle: Core P4 items 1-4 (one truthful undo and reset answer)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t797/!FluxIQ` (branch `task/t797-fhl-undo-settlement`). No git mutation, no Lab runs, no model calls.
`F` = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap`.

## Outcome

Partial. All four items are implemented and their four tests pass. The typecheck is clean. The brief's `pnpm test` run
has 5 failures, all in `F/tests/site-reset-build.test.ts` (3) and `F/tests/site-reset-irreversible.test.ts` (2). They
come from the other worker's in-flight `cannotUndo` defaulting (`F/trial-defaults/`, `F/candidate/trial-gate.ts`), not
from my files (evidence below). One gap I found is left open (see Open questions).

## What changed and why, per item

### Item 1: one shared "back at its place" answer, keyed by one place per act

- **State before.** t772 had already added the shared standing function (`F/reset-settlement/own-control.ts:62`), and
  trial-stamp no longer files a pass's original at the receipt's place. But an act's place was still read from three
  sources:
  - the judge read `controlOriginal.place` in `originalStanding` (`F/reset-settlement/control-tracker.ts:227` fallback
    when `toggle.place !== original.place`);
  - `toggleOf` took `press.place` with no check against the original (`F/reset-settlement/judge.ts:284-294`);
  - the value admission read `act.spot.place` (`F/reset-undo/admission.ts` `sameControl`).
- **A second disagreement found by the new test.** `toggleOf` inferred a toggle from the retained original before
  reading the act's own observed press. A fresh read in a third state (free to waitlisted) was therefore taken as the
  act's own toggle, and a press back from the third state would have been admitted as `own`.
- **Change.**
  - `automationStudioSiteResetActOwnControl` (own-control.ts) returns the one place. The order is: the original's place,
    with its `found` counts and `at`; else the toggle's; else the press's; else the spot's.
  - `toggleOf` takes the act's own press first, and only when that press is at the one place. It infers from the
    original only as a fallback.
  - `ownStanding` replaces `ownBack`. It reads the fresh counts at the one place with the shared standing function.
  - `evaluate` keeps an open control `toggle` (press back) only when its own standing is `set`, the one state the
    admission admits `own`. A standing of `back` gives `own_back`. A standing of `other`, or no known toggle, gives the
    new `control_other`.
  - The value undo's `sameControl` now takes its place from the same function.
  - Settlement spot type gains `place`. Toggle standing gains `other`.
- **Tests.**
  - `F/reset-settlement/tests/own-control-shared-answer.test.ts`: 16-shape sweep (places shared|distinct, brief
    builder|supervisor, pressed entry 1|2, undone or not) × fresh read free|held|waitlisted|gone, on the real project
    ledger. It covers the supervisor path whose tracker never pressed the item. **Fail-first: 16/16 shapes failed on
    current code**, all at the third-state/gone read (the act stayed to undo with "press that same control back"). The
    free and held assertions passed: regression guards.
  - Existing `F/reset-settlement/tests/own-control.test.ts`:
    - its t772 "filed elsewhere" describe is rewritten to the one-place answer: a press at another place is never its
      toggle, and the act is closed `control_other`/`no_admissible_undo`;
    - one-place cases added for set, third, gone and back;
    - a unit for the new function added;
    - the waitlisted case failed until `toggleOf` read the press first.

### Item 2: a list read in place after an undo is never judged, for other acts too

- **State before.** The in-place fact counted only undos of acts that witness the group (`judge.ts` `undosOn`, about
  `:415-421`). An act witnessed by its own control alone can also put a row on the list. When it was undone on that
  page, the list read in place still drew the row. The other acts on the list were then judged `undo`, and the reach
  called them all `no_admissible_undo`: three rows against two acts, the b6dc shape.
- **Change.**
  - `judge.ts` counts every landed undo of the ledger (`landedUndos`) for `seen.loads` and `readInPlace`.
  - The headers of `observations.ts`, `decision.ts` and `reach.ts` are updated to match.
- **Test.** `F/reset-settlement/tests/decision-stale-in-place.test.ts`, on the real ledger. The library entry pages
  carry a "Your reservations" sidebar. act-1 reserves via its own control and names no list. act-2 and act-3 name the
  sidebar. act-1 is pressed back on its page and the page is read in place.
  - **Fail-first: 2 of 5 failed** ("calls neither act unsettleable…": got acts 2 and 3 listed apart; "judges again once
    Core's look loads it": no look was made).
  - The guard "a load showing a row no act can take back is still judged" and the 2 pure decision guards passed before
    and after.

### Item 3: one answer never says both "this page can" and "no call can"

- **State before.** `F/reset-answers/agreeing.ts` (t772 R2) trusted the refusal. It moved the refusal's own act out of
  `actsUnsettleable` into `actsToUndo` and kept `canMeet: this_page`. So that one answer contradicted the ledger
  (`unsatisfiable()`, `startedWith`, the ending). Where the ledger was right ("a row the list held before, changed":
  `undeclared_press this_page`, then `subject_there_before no_call`), the builder was sent round the same refused press.
- **Change.** `agreeing.ts` now follows the ledger's verdict. Where the refusal's own act is listed apart, the refusal
  gets:
  - `canMeet: "no_call"`;
  - its `condition` re-said with `no_call`;
  - the instruction replaced by the generic `AUTOMATION_STUDIO_SITE_RESET_LISTED_APART`;
  - the act dropped from `actsToUndo`.

  The source of t772 R2's false verdict (the in-place read) is closed at its source by item 2.
- **Tests.**
  - `F/reset-undo/tests/reach-one-answer.test.ts`: 5 ledger states × 24 undo calls on rows and book pages.
    **Fail-first: 4 of 7 failed** (the 3 listed-apart states and the "not vacuous" case). The 2 can-still-undo states
    and the guard passed: regression guards.
  - `F/reset-answers/tests/refusal.test.ts`: the agreeing describe is rewritten to the new direction.
- **Two existing tests asserted the old contradiction and are adjusted.**
  - `F/reset-undo/tests/admission.test.ts`, "a subject deletion names the condition it failed": its reads had no
    `resource`, so no receipt existed and the act was already listed apart as `nothing_to_name`. The reads now carry a
    resource, as web reads do, so the act is still to undo and each condition's own `canMeet` is checked as before.
  - `F/site-reset/tests/settlement-unmeetable.test.ts`, third-state case: see item 4.

### Item 4: every act to undo has an admitted call its words name, or it is closed

- **State before.** A `toggle` reason ("press that same control back") was left meetable whenever a fresh read showed
  the act's own control in a third state or no longer drawn at its place (`decision.ts` `TOGGLE_REASON`, `judge.ts`
  `unmet`). The admission refused every press there (`control_state_differs`, or no control to press). Only after one
  refused press did `pressBackRefused` close it, and with no control drawn it never closed. The words also falsely said
  "still shows the state this act set".
- **Change.**
  - New reason `control_other`, closed in `judge.unmet` as `no_admissible_undo`, with truthful words in `words.ts`.
  - A later fresh read showing the set state reopens the act.
  - The `answers.ts` header records the invariant.
  - The value path (6916 shape) already held after t772; the sweep confirms it.
- **Test.** `F/site-reset/tests/ledger-act-to-call.test.ts` drives the real ledger.
  - It sweeps 192 loop states: places × brief × passes first|second|both × seenSet × undo × fresh
    free|held|waitlisted|gone.
  - It sweeps 24 reloading `modify_existing` states: values given|none × a list read before or not × steps
    none|chosen|confirmed × fresh start|set.
  - For each state, every act to undo must have a call its `settle` words name that `target` admits (replayed per call),
    and every act listed apart must carry did, `gate_unsatisfiable` and a closed `failed`.
  - **Fail-first: 99 failed.** That is 96 loop states (exactly the waitlisted/gone ones) plus the 3 explicit
    honest-exit cases. All 96 free/held loop states and all 24 value states passed: regression guards.
  - `settlement-unmeetable.test.ts` third-state case updated: the act is now listed apart from the read, before any
    press. The comment-only path edit the other worker made there is kept.

## Commands run and observed results

- Fail-first runs (current code, before my edits), each `npx vitest run <file>` from `packages/fluxiq`:
  - ledger-act-to-call: `Tests 99 failed | 121 passed (220)`;
  - the item 1-3 files together: `Tests 20 failed | 9 passed (29)`;
  - reach-one-answer after one fixture fix of my own (the ref had not been shown): `4 failed | 3 passed (7)`.
- After the change, the four new tests plus own-control and refusal: `Tests 262 passed` (one own-control case failed
  until the `toggleOf` order fix, then passed).
- `node scripts/build-cache/cli.mjs fluxiq:check`, under the lock:
  - first run: 2 errors, both in my ledger-act-to-call test (look control typed `name: null`). Fixed.
  - second run: `exit 0`, no `error TS`.
- `pnpm test F/site-reset F/reset-settlement F/reset-answers F/reset-admission F/reset-undo F/reset-ledger F/tests`
  (spelled out), under the lock: `Test Files 2 failed | 66 passed (68)`, `Tests 5 failed | 1008 passed (1013)`.
  - Failing: `tests/site-reset-build.test.ts` (3) and `tests/site-reset-irreversible.test.ts` (2).
  - The output shows legacy act-1 under `startedWith.cannotUndo` where `acts` was expected. The cause is the other
    worker's `automationStudioTrialDefaultsBeforeTrial` (new `F/trial-defaults/before-trial.ts`, wired into
    `candidate/trial-gate.ts`), which defaults `cannotUndo`. Neither file is mine.
  - An earlier run also failed `reset-undo/tests/claims-inverse.test.ts`. That file was being written by the other
    worker at the time (mtime 05:50:07), and it passed in the later run.
- `node scripts/structure-audit.mjs`: `1 violation`, `[statement-packing]` in `F/reset-undo/tests/claims-inverse.test.ts`
  line 145 (the other worker's file). No failure in my files. Advisories only: `judge.ts` 468 lines (was 437, already
  past 400) and `admission.ts` 411 lines (was 403).

## Not verified

- No live or browser run. The model-facing words (`control_other` clause, `LISTED_APART` instruction) were not seen by a
  model.
- I did not run a baseline of the 5 site-reset-build/irreversible failures without my edits. Their attribution rests on
  the failure output and the other worker's diff.
- The cross-ledger case (an undo landing in one brief's ledger while another ledger's list is read in place) is not
  covered. `landedUndos` counts this ledger's acts only.

## Open questions or contradictions found

1. **The reverse invariant is still open.** An act with no witness whose list has no receipt is listed apart as
   `nothing_to_name`, yet the subject deletion is still admitted for it. A probe of the admission-test shape without a
   resource returned `apart: [{failed: "nothing_to_name"}]` while `target` admitted `on: "subject"`.
   - With item 3, its refusals now say `no_call`.
   - Web reads always carry a resource, so this is unlikely live.
   - The fix belongs in `judge.unmet` (`name` asking the reach for an open subject-deletion path), plus words for that
     path. Left undone.
2. **Two comments elsewhere are now stale.** `F/reset-ledger/claims.ts` (not mine) still says "Its own act, where a call
   can still meet the refusal, is never listed apart beside it (t772 R2)". The behaviour is now the reverse
   (`agreeing.ts` header). `reach.ts`'s old line "an act listed apart still refuses every trial" predates t775 and was
   not changed.
3. **Behaviour change.** `toggleOf` now prefers the act's observed press over a toggle inferred from its original, so
   the change is seen (`changeSeen`) from the press. No existing test changed because of this.

```text
Outcome: Partial
Changed: F/reset-settlement/{own-control,judge,decision,words,control-tracker,observations,spot}.ts, F/reset-undo/{admission,reach}.ts, F/reset-ledger/answers.ts, F/reset-answers/agreeing.ts; tests: F/reset-settlement/tests/{own-control-shared-answer,decision-stale-in-place}.test.ts (new), F/reset-undo/tests/reach-one-answer.test.ts (new), F/site-reset/tests/ledger-act-to-call.test.ts (new), F/reset-settlement/tests/own-control.test.ts, F/reset-answers/tests/refusal.test.ts, F/reset-undo/tests/admission.test.ts, F/site-reset/tests/settlement-unmeetable.test.ts
Validation: `fluxiq:check` -> exit 0, no errors; `pnpm test <7 dirs>` -> 1008 passed, 5 failed (site-reset-build x3, site-reset-irreversible x2: other worker's cannotUndo default); structure-audit -> 1 FAIL in other worker's claims-inverse.test.ts only
Not verified: live/model reading of the new words; baseline of the 5 failures without my edits; cross-ledger in-place undos
Report: C:/Users/osrs_/FluxStuff/fxwork/t797/!FluxIQWebExtension/docs/working/framework-heavy-lifting-plan/reports/t797/settle.md
Notes: fail-first: item1 16/16 shapes, item2 2/5, item3 4/7, item4 99/220 failed before; free/held/value shapes were guards.
Open: receipt-less nothing_to_name ignores an open subject-deletion path; reset-ledger/claims.ts comment now stale.
```
