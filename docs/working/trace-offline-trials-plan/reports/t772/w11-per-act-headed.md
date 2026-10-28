# t772 w11: why the per-act rule did not apply in the headed job flow

## Outcome

Partial.

- **The Core part is fixed, tested failing first, and visible in the headed run.** `trial.final` now names only `act-2`, the one act whose saved row really is still on the site. Before the fix it named `act-1`, `act-2` and `act-3`.
- **Spec line 134 (now line 137) still fails, and Core cannot make it pass.** Two defects outside Core block it, and both are proven from the run's own evidence below:
  - **domain:** a re-press undid `act-2`'s undo on the site;
  - **apps/extension:** the save acts carry a subject that is not their job, so no act's own row is known before its undo.

**Said first, as the brief asks: part of the cause is in domain and in apps/extension.** I fixed neither.

- **apps/extension** is not in my fence.
- **domain:** the brief allows a domain edit where the cause lies, but I did not make one, for two reasons:
  - fixing the domain cause alone would not make line 137 pass, because the extension cause remains;
  - the domain change alters t513's policy for every lasting press.

  The supervisor should decide both. Proposed fixes are below.

## What the real answers showed

Taken from the headed run's diagnostic (`reset-job-redraw.json`) and the new `subjects`/`pressedAgain` lines the spec now prints.

1. **No act carries its own row's subject.** All three saves declare `subject s:3d32b279…` with `page: null`, `item: null`.
   - I recomputed `webControlSpotToken("subject", …)`: `s:3d32b279…` is the digest of **"Apply on company site"**.
   - The list rows are `s:999a34…`, `s:f2aba2…` and `s:79bd2a…`: "Senior Rust Engineer", "Rust Engineer", "Rust Engineer, Settlement Systems".
   - **Cause (apps/extension):** in `apps/extension/src/content/identity/record.ts`, `recordSubject` → `nearestTitle` → `readRowTitle` starts at the heart's parent, the actions bar.
     - That bar has no heading, so `readRowTitle` falls back to its first link's words, the "Apply on company site" link beside the heart.
     - It never reaches the pane head, whose `h2` is the job title.
   - `pageSubject` is absent because `domain/src/runtime/llm-evidence/sanitize.ts` takes it only from an `h1`, and the board's job page titles the job with an `h2`.
2. **The undos were admitted as destination removals.** This path exists for exactly this shape (t743, `undo-admission.ts` header: "a save from an item's own page … the domain gives the item one subject token on its page and another as a row of the list").
   - Each admission recorded `subjectUndo = { scope, subject: <row>, group }`.
   - That is the only place Core learns which row is an act's own.
3. **`act-2`'s save really is back on the site.**
   - `undo.second` answered `pressedAgain: "Pressed again: the first press of "Unsave job" (t526) changed nothing, so it was pressed once more"`, with `changed: t538 "Job saved" was "Removed from saved jobs"`. That was 3 click dispatches against 1 for `undo.first`.
   - The first press did unsave on the server, but the page showed nothing new:
     - the list keeps the row until it loads again;
     - the button keeps its label;
     - the notice already read "Removed from saved jobs" from `undo.first`.
   - The second press saved the job again. Every later load shows "Rust Engineer / Saltmarsh Games" (`s:f2aba2…`) on My jobs:
     - step 16: 4 rows;
     - step 18: 3 rows, `[f2aba2, Product Designer, Frontend Engineer]`, against the original 2.
   - **Cause (domain):** `domain/src/runtime/llm-evidence/node-run/press-effect/settled.ts` with `certain-no-effect.ts` (t513). A lasting press whose page "did not change at all", with its control still shown and enabled, counts as certainly ignored and is pressed again. On a site that commits silently, that premise does not hold.
4. **The answers the brief asked about:**
   - the acts are witnessed by the list group (`destination-1`), with no toggle or value witness;
   - all three acts are in one ledger;
   - `lookFirst` ran (`site-reset.look.N.arrival` calls precede each gate), and the gate's read was a load (reason `undo`, not `reload`);
   - `undone` is not set on act-1 or act-2, because neither settled. That is correct for act-2 (its row is there). For act-1 it was the Core gap below.
5. **The Core gap.** w10's per-act rule reads an act's own subjects only from its `spot`.
   - In this shape that is the shared "Apply on company site" token, so nothing ever explains a sibling's row.
   - Every act stayed open while any one row showed, and acts whose rows were gone were still told to "undo this act there".
   - At the final gate (list `[f2aba2, PD, FE]`), act-1 and act-3 should have been back by the contract:
     - each one's own undo landed;
     - each one's own row is gone on a load;
     - the only other difference is act-2's own row, and act-2 is open.

## What changed and why (Core)

Paths are relative to Core `…/flow-bootstrap/reset-settlement/`.

- **New `group-subjects.ts`, exported from the barrel.**
  - `automationStudioSiteResetGroupSubjects(act, group)` returns the act's spot subjects (`act-subjects.ts`), plus the subject its admitted subject undo removes, but only on that undo's group.
  - The admission proves that row is the act's own there: absent from the list, which was named for the act and read complete before it, and present after it.
  - The header explains the shape.
- **`act-groups.ts`:** the act's subjects are computed per group with it, and are handed to the group witness and to `others`. The `subjectUndo` input type gains an optional `subject`. Header updated.
- **`judge.ts`:**
  - `othersOn` reads the other acts' subjects per group with the same helper, so a sibling's proved row explains a difference.
  - `JudgedAct.subjectUndo` gains an optional `subject` (the ledger's act already carries it).
  - The `actSubjects` import was replaced, and a header paragraph added.
- **Unchanged:**
  - `group-witness.ts`, `decision.ts`, `observations.ts`;
  - `site-reset/**`, `reset-admission/**`;
  - w10's guards. A row no act's undo proved is still unexplained. The per-act path still runs only for undone acts on loads. The last open act on a group still needs the whole list.

## Spec change (`apps/extension/e2e/site-reset/tests/job-undo-redraws-on-load.spec.ts`)

**Diagnostic only. No expectation changed.**

- The `resetDiagnostic` summary now marks `pressedAgain: true` per call.
- A new `subjects` map prints each lasting call's declared `subject` and `page`.

**Line 137's expectation (`[act-3]` at mid) does not contradict the agreed contract.** It assumes two things the runtime does not deliver today: an undo that stays undone, and save acts whose own subject is their job. With both, the contract gives exactly `[act-3]`:

- act-1's and act-2's rows are gone on the load;
- act-3's row is act-3's own subject.

So I left it failing. It now fails for the two out-of-fence causes, not for Core.

## Failing first, then passing

Two new tests in `reset-settlement/tests/per-act-group.test.ts`, describe "acts whose own row only their landed undo proved settle by that row (t772 w11)". They reproduce the real shape:

- presses from each item's page with one shared non-row subject, no page token, `modify_existing`, naming a list read before them;
- undos from the list rows, admitted `on: "subject"`.

Test 1 checks three things:

- the mid gate with act-2's row still loaded keeps all three open, because act-3's row has no proved owner yet;
- after act-3 is undone, a load showing only act-2's row leaves exactly `[act-2]`;
- act-1 and act-3 are `restored`, and act-1 is not left.

Test 2 is a guard: a stranger row with two undone acts keeps all three open.

Results:

- **Unfixed tree:** `node ../../scripts/vitest-groups.mjs --groups=parallel <FB>/reset-settlement/tests/per-act-group.test.ts` gave `Tests 1 failed | 11 passed (12)`, with `expected [ 'act-1', 'act-2', 'act-3' ] to deeply equal [ 'act-2' ]`. That is the headed `trial.final` answer exactly. The guard test passed.
- **Fixed tree:** same command, `Tests 12 passed (12)`.

## Commands run and observed results

**Core builds.**

- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`:
  - first run: all three reused (already current with w10);
  - after the fix: `fluxiq:build` rebuilt, `Done`.
- `apps/extension pnpm test:e2e:build`: `core-build: … current`, then rebuilt and verified 22 files for each target.

**Headed spec before the fix** (`… test -c e2e/playwright.config.ts site-reset/tests/job-undo-redraws-on-load.spec.ts --workers=1`): `1 failed` at `:134`.

- `trial.mid`: `acts_in_place`, toUndo `[act-1, act-2, act-3]`, unsettleable `[]`.
- `trial.final`: toUndo `[act-1, act-2, act-3]`.

**Headed spec after the fix:** `1 failed` at `:137` (the same assertion, moved 3 lines by the diagnostic).

- `trial.mid`: toUndo `[act-1, act-2, act-3]`, unsettleable `[]`.
- `trial.final`: toUndo **`[act-2]`**.
- Diagnostic:
  - `undo.second.pressedAgain: true`;
  - `subjects`: `save.0/1/2 → s:3d32b2796f39691d27b63e2b4898af06, page null`;
  - `undo.first/second/third → s:999a34…/s:f2aba2…/s:79bd2a…`.

**Core narrow suites:** `node ../../scripts/vitest-groups.mjs --groups=parallel <FB>/site-reset <FB>/reset-settlement <FB>/reset-admission <FB>/reset-answers` gave `Test Files 41 passed (41)` / `Tests 537 passed (537)` / `all groups passed: parallel`.

**Typecheck:** `node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` exited 0 with no output.

**Structure audit** (`node scripts/structure-audit.mjs`, Core root): `structure-audit: passed (446 warning(s), 1152 baselined)`, so 0 violations. One advisory warning: `reset-settlement/` has 21 source files, past the 15-file advisory (the limit is 25).

**Regression specs:** see the section appended below.

## Not verified

- **That the mid gate gives `[act-3]` once both out-of-fence causes are fixed.** That is my reading of the contract, not a run.
- **Project builds with acts in several ledgers.** `othersOn` still reads only this ledger.
- **No live or Lab run** (the brief forbids one).

## Open questions and proposed fixes (supervisor)

1. **apps/extension identity** (`record.ts` `nearestTitle`/`readRowTitle`).
   - A lone control's "nearest titled part" should not take a link's words as a title in the lone-control walk. For example, accept only a heading there, or skip a part whose only "title" is another control beside the pressed one.
   - Here the walk would then reach the pane head's `h2`, giving each save its job title. That matches the list row's token, so the per-act rule applies before any undo.
   - Optionally, also let `pageSubject` fall back to the main region's first heading when there is no `h1`.
2. **domain re-press** (`press-effect/settled.ts`, `certain-no-effect.ts`, t513). "Nothing changed at all" is not certainty on a page that commits silently. Two directions to choose between:
   - hold back the second press of a lasting call made under `undoes`;
   - do not count a notice already showing before the press as "no change".

   This touches the t513 policy (the social Post button's needed second press), so it is the supervisor's decision.
3. **The final gate now asks only for act-2,** whose landed undo is spent (`undo-reach` `removedBy` keeps its row to it).
   - Its row will stay open as `undo`, refused `undo_already_done` on a retry. This is w5's open question 2.
   - Whether a spent act whose row a load still shows should be offered one more undo is a separate decision.
4. **`judge.ts` is still past the 400-line advisory** (436 lines).

## Regression specs (not finished at handback)

- **Command:** `… test -c e2e/playwright.config.ts site-reset/tests/{job-failed-save,job-unexplored-step,installed-project,photo-dialog-act,office-reloading-confirm-undo}.spec.ts --workers=1 --reporter=line`
- **Status at handback:** the run was still going, at test 2 of 6 (`installed-project` "distinguishes a failed save from its successful retry inverse"). No failure had printed yet.
- **Result:** not observed. The run's output file is in the session scratchpad: `C:\Users\osrs_\AppData\Local\Temp\claude\c--Users-osrs--FluxStuff--FluxIQWebExtension\b969a395-6436-4284-bccb-432f7f43683b\scratchpad\w11-regress.txt`.
- **Rerun needed:** the supervisor must rerun these five specs. Per w6, `photo-dialog-act` was already failing at line 288 before this work.
