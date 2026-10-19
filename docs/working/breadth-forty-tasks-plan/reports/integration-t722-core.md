# F10: t722 Core integration, test fixes for the F1 reset rule

Worker report, 2026-10-19. Core integration worktree `C:/Users/osrs_/FluxStuff/fxwork/t722/!FluxIQ`, branch
`task/t722-f-round-integration`. Final HEAD during validation: `c453fda9` (the supervisor merged
`task/t566-a8-lane-4` into the branch while my first broad run was going; everything below was rerun at
`c453fda9`). Nothing was committed or pushed, and no Lab or browser run was made.

## Outcome

Partial. Everything in the brief and its addition is done. The three tests that encoded the removed
trial-on-leftovers admission now assert the new rule. The two stale headers are rewritten. The two
"this act stays as it is" tests pass after a wording fix in `words.ts`.

One more test still encodes the removed admission: `project-agents/supervisor/tests/reset-repeated.test.ts`,
second case. It is outside my ownership, so it is not edited. It passes on Core `origin/dev` and fails here,
so the F1 lane caused it. A probed one-line fix is below.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

**1. Tests that encoded the removed admission**

- `flow-bootstrap/candidate/tests/trial-gate-reset.test.ts`: replaced "admits the trial without progress,
  saying under startedWith what was still in place" with "refuses a trial without progress however often it is
  asked, and runs it only once the act is named under cannotUndo, saying under startedWith what was still in
  place".
  - Four tests in a row (past the policy's 3 refusals and its no-progress signature) are each refused
    `candidate.trial_reset_required`, naming act-1 and its `differs`.
  - A test that then names `cannotUndo: ["act-1"]` runs exactly one trial, with
    `startedWith: { cannotUndo: [act-1], differs: [...] }` and `leftOnSite: [act-1]`.
- `project-agents/supervisor/tests/whole-trial.test.ts`: the old case "runs the test with an act the site
  cannot undo kept..." became two cases.
  - **New:** a blocked reset (`undoes: false`) that names nothing under `cannotUndo` leaves the next whole
    test refused `project.trial_reset_required`, with act-1 and brief-2 in `actsInPlace`. No trial runs, and
    act-1 is still `inPlace`.
  - **Kept intent:** after the blocked reset, a whole test whose input names `cannotUndo: ["act-1"]` runs
    with `startedWith.cannotUndo` and verdict no. The ending still names the act "(the site offers no way to
    undo it)".
  - I used the supervisor's own test input for `cannotUndo` rather than F1's suggestion of changing the
    reset stand-in. The stand-in lives in `supervisor-fixture.ts`, which I do not own. The path is real:
    `whole-trial.ts` forwards the test's `value` to `gate.test`, which reads `cannotUndo`.
- `service/project-build/tests/project-build-reset.test.ts`: in "refuses an undo aimed at another item", the
  reset's completion now names `cannotUndo: ["act-1"]`, as F1 suggested. It names only act-1, so act-2 is
  still kept by its refused wrong-target undo alone. If that refusal ever stopped keeping act-2, the test's
  `lastingActsInPlace: 0` would catch it.

**2. Headers (comments only, no logic changes)**

- `project-agents/supervisor/whole-trial.ts`:
  - Removed "the ledgers' no-deadlock admission is for a reset that was tried and made no progress".
  - It now says an act stays only once it is kept: named under `cannotUndo` (by a reset's completion or by
    this test's input) after a reset asked for it, or because its undo was refused.
  - Identified reversible effects stay refused until proved restored (`candidate.trial_reset_unproved`).
  - No trial runs on leftovers. A reset that came back blocked without undoing or naming an act leaves every
    test refused.
  - The repeated-refusal rule is unchanged.
- `project-agents/dispatch/reset-loop.ts`: added "Only an act named or refused is kept".
  - No act is kept for having been asked for several times.
  - An act that was neither undone, settled against its named destination, named, nor refused stays to
    undo, so the reset ends `blocked` and trials are refused.
  - It also notes that naming an identified reversible effect keeps it reported, never restored.

**3. Addition: `site-reset/words.ts` `undoRefused()` (wording only, generic)**

I decided the wording was wrong and the tests were right. A refused undo does keep its act: `ledger.ts`
`explored` sets `act.kept = true` when `declared.permitted` is false, and the comment in
`action-permissions.ts` says so. `site-reset-build.test.ts` line 302 then sees the next trial run with
`startedWith.cannotUndo`. The text in use said only "this act remains unresolved", which never tells the model
the act is kept.

New text: "That undo was not allowed, so nothing was done, and this act stays as it is: it is kept and not
asked for again. Do not try to undo it again or repeat the refused effect. A trial run with it in place lists
it under startedWith.cannotUndo, and its judge is told; an identified reversible effect still requires proved
restoration before an ordinary trial. Undo another listed act, or report the unresolved reset honestly."

It still avoids "the next trial runs with it already done", which `site-reset/tests/words.test.ts` forbids.
That is right, because a strict reversible act is kept but still refused `trial_reset_unproved`.

## Commands run and observed results

All `npx vitest` commands were run from `packages/fluxiq`.

- **Before any edit**, the three owned tests: "Test Files 3 failed (3), Tests 3 failed | 27 passed (30)".
  The failures were exactly F1's three.
- **After the edits**, the six files (three owned, the two wording tests, and `site-reset/tests/words.test.ts`):
  "Test Files 6 passed (6), Tests 61 passed (61)".
- **Broad set at `c453fda9`**, every directory the brief names (site-reset/tests, flow-bootstrap/tests,
  candidate/tests, authoring/tests, script-statements/tests, plan/tests, flow-draft, llm/tests,
  llm/node-tools/tests, project-agents including supervisor/tests, service/project-build/tests,
  service/candidate-trial/tests, nodes/control-flow/tests, executor/tests):
  "Test Files 2 failed | 333 passed (335), Tests 7 failed | 3386 passed (3393)".
  - `executor/tests/ask-activity.test.ts`: 6 failures. The ask's activity id is expected to be
    `check.attempt.2`, but is now `person-needed.<uuid>`.
  - `project-agents/supervisor/tests/reset-repeated.test.ts`: 1 failure, the second case. The dispatch kinds
    were `[[build,build],[reset]]`, not `[[build,build],[reset],[reset]]`.
- **First broad run**, taken while the lane-4 merge was landing: "3 failed | 332 passed, 10 failed".
  - The extra three were `service/candidate-trial/tests/paging-feedback.test.ts`. I reran
    `service/candidate-trial/tests/` at `c453fda9` and got "24 passed (24), 190 passed". It was a mid-merge
    artefact.
- `pnpm --filter ./packages/fluxiq check` (at `c453fda9`): exit 0 (build-cache "inputs changed ... ms":47278).
- `node scripts/structure-audit.mjs` (at `c453fda9`): "structure-audit: passed (408 warning(s), 1152
  baselined)", exit 0.
- **Base check against `origin/dev`.** I created a detached worktree at `a22b3a0f` in
  `C:/Users/osrs_/FluxStuff/fxwork/t722-base/!FluxIQ`, with node_modules junctioned from t722 for the run.
  I ran ask-activity, reset-repeated, paging-feedback, site-reset-build, site-reset-calls, trial-gate-reset
  and whole-trial there: "Test Files 3 failed | 4 passed (7), Tests 8 failed | 52 passed (60)".
  - ask-activity failed 6 there too, so it predates the lanes.
  - site-reset-build and site-reset-calls failed 1 each, on "this act stays as it is", so they predate the
    lanes. They are now fixed here.
  - reset-repeated passed on base (2 tests), so the F1 lane caused that failure.
  - paging-feedback passed on base (5 tests), and passes here (9 tests).
- **Probe of the reset-repeated fix.** I made a temporary copy, `supervisor/tests/zz-f10-probe.test.ts`, in
  which the middle `test` step of the second case became
  `call(IDS.testCandidate, (evidence) => ({ ...assembled(evidence), cannotUndo: ["act-1"] }))` and `assembled`
  was imported. Result: "2 passed (2)". I deleted the copy straight away.
- **Clean-up.** The base worktree's two junctions are removed (rmdir of the link only). t722's
  `node_modules/.pnpm` and `packages/fluxiq/node_modules/vitest` are confirmed still present. The base worktree
  itself is left in place.

## Not verified

- No live, browser, Lab or paid run, and no full suite.
- The plan/tests failures (extraction-vocabulary, issue-feedback) and `llm/deepseek/tests/system-prompt` are
  left to F11, as instructed. plan/tests passed in my broad run at `c453fda9`. `llm/deepseek/tests` is not in
  my set, and I did not run it.
- I did not check those on base, since F11 owns them.
- I did not test whether a supervisor test that names `cannotUndo` right after a refused test (with no new
  reset in between) reaches the ledgers. `whole-trial.ts` repeats the refusal "unasked of the ledgers" until a
  reset comes back, so a `cannotUndo` sent on that repeat is not seen. This may be a small gap; see below.

## Open questions or contradictions found

1. **`reset-repeated.test.ts`, second case: a lane-caused failure outside my ownership.** It sends `test`
   after a blocked reset and expects that test to run a trial on the leftovers. The trial's own acts then
   give the next reset something new to do. Under F1 that test is refused, so the next reset is answered
   `project.reset_repeated`.
   - **Fix, probed green:** the middle step names `cannotUndo: ["act-1"]`, which keeps the test's intent
     ("runs once something else changed the target").
   - The supervisor needs to assign this file.
2. **`supervisor-fixture.ts`'s reset stand-in never names `cannotUndo`.** Unlike the real `reset-loop.ts`,
   it cannot show a reset brief that keeps an act. Any future test of "a reset ends done with a kept act"
   through this fixture would need a fixture option for that.
3. **Possible gap in `whole-trial.ts`.** The repeated refusal is given before the ledgers are asked, so a
   whole test that names `cannotUndo` after a refused test, with no reset since, is refused without its
   `cannotUndo` being seen. In practice a reset must come back first, which the instruction already asks for.
   Flagged, not changed.
4. **`executor/tests/ask-activity.test.ts` (6) fails on Core `origin/dev` too.** It is unrelated to F1, F3
   and F5: the ask activity id changed from `check.attempt.N` to `person-needed.<uuid>`.
5. **Base worktree.** It is left at `C:/Users/osrs_/FluxStuff/fxwork/t722-base/!FluxIQ` (detached at
   `a22b3a0f`, no node_modules). Remove it with `git worktree remove` from any Core checkout when done.
