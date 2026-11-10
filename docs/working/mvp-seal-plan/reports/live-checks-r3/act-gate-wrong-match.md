# Act gate matched a different control to an earlier act (live checks r3)

## Outcome

Done. The cause is traced, two Core changes fix it, and a provider-free test reproduces the run's shape. That test fails when the fix is reverted. Each half of the fix was reverted on its own and checked against it. All the requested checks pass.

## Cause

Evidence: run-mwaszqeh-cc316c6d, under `fxwork/t893-web-instant-actions-4/test-runs/instances/t893/attempts/run-mwaszqeh-cc316c6d/steps/`. Read only.

- **0012:** a by-hand read of 3 rows (Ximena, Lucia, Chidi).
- **0014:** `accept-first`, a press on handle `t490` that declared `modify_existing`. It landed. Its answer's `actedOnItem` names Ximena's row, and `location` is the list page.
- **0016:** `close-7`, a press on handle `t617` ("Close your conversation with Priya Nair") that declared nothing. The gate answered `attempt.act_already_done` and named the act "Accept: XR Ximena Ruiz…". This came from the by-hand `alreadyDone()` in `act-gate.ts:86`, so the answer carries no `ok:false`.
- **0018 onward:** the loop guard refused the same call again three times.

**(a) How the gate matches a press to an act.** It does not use the handle, the position, or the step id. Both handles were distinct, and t617 is a fresh handle on the popup. The gate matches through the domain's foreseen form, which is the frozen `{selector, element}` the handle stands for, built in `domain/.../node-run/call-words.ts`:

1. `record.admit` calls `sameActs`, which calls `matchesForeseen` (`record.ts:683-695`).
2. The words of the close press name no row, so `foreseen.onPage` is the page's rows. After the Accept, `notePlace` set the page to the row its `actedOn` named, which is Ximena's row (`record.ts:359-369`).
3. Line 689 then counts the press as the same act when that row matches and the act and press share a control word (`sameWords`) or a key.
4. A control's words come from `controlWords` (`identity/target-keys.ts:120-127`). It reads every top-level string of the fingerprint except the fields `STRUCTURAL_FIELD` names. That regex is anchored and lists `role` and `type`, but not `implicitRole` or `inputType`.
5. The web domain writes `implicitRole: "button"` on every button. The run's own forward passes in run-mwat3vd9 (steps 0021 and 0022) show it on both the Close and the Accept.
6. So the two controls shared the word "button", and the close button on that page was taken for the Accept on Ximena's row.

The same mistake had two more effects:
- **The row's other control.** `matchesForeseen` line 688 refused a Decline on the accepted row for the same reason. The design (`record.ts` header) says a row's two different controls are two acts.
- **The act's displayed name.** `automationStudioAttemptActControlName` picks the shortest word, so it named a press "button" instead of "Accept".

**Could the same mistake let a repeat through?** The kind word only ever added sameness, so on its own it never let a repeat through. Removing it exposes a gap that it had been covering by accident. In `matches()` at `record.ts:677-679`, a fingerprinted form that names its control and a fingerprinted form that names nothing on the same row were read as two acts. With "button" gone, a Flow pass carrying the row and a thinner form of the same control (no name) would no longer be refused at the gate. The forward walker's `rowDone` still leaves such a row out, but the gate must not depend on that.

## What changed and why

All changes are in Core, under `packages/fluxiq/src/runtime/answer-first/act-record/`.

- **`identity/target-keys.ts`:** `STRUCTURAL_FIELD` now reads a kind by the field name's ending (`\w*role|\w*type|\w*kind`), so `implicitRole` and `inputType` are never control words. The rule stays generic: it names no domain field. This also stops the kind word entering a press's `says` words, which are used to tie a press to a row, and stops it becoming the act's displayed name.
- **`record.ts`, `matches()`:**
  - Where both forms name their control, the words decide.
  - Where only one does, the act is held the same: the other may be its thinner form, which is what the old line 676 comment promised.
  - Where neither names its control and both are fingerprinted, they stay two acts (t869).

  Compared with the behaviour the web actually had (every button shared "button"), this refuses no less in any case. Compared with the code as written, it refuses more only in the mixed case.
- **`tests/kind-is-no-control-word.test.ts` (new):** the run's shape through the real gate, with the web domain's call and answer keys (stand-in site words). It covers:
  - the popup's close after an Approve is sent;
  - the same row's Decline is sent;
  - Approve on another row is sent;
  - Approve on the same row by a new handle is refused;
  - a thinner form of the same control (no name) is refused, by hand and as a Flow pass that carries the row;
  - a kind is never the control's name.
- **`tests/thin-press.test.ts`:** the t869 case "a named control and one with no words: two controls" now expects `already_done`, and the comment says why: the wordless form may be the named one's thinner form, and on the web these two were already held the same through "button".

## Commands run and observed results

All commands ran from `fxwork/t885/!FluxIQ`.

| Command | Result | Exit |
| --- | --- | --- |
| `npx vitest run …/act-record/tests/kind-is-no-control-word.test.ts`, before the fix | 3 failed, 4 passed. Close and Decline gave `expected 'attempt.act_already_done' to be 'web.action.succeeded'`; the name test gave `expected 'button' to be 'Approve'`. | 1 |
| Probe: same test on unfixed code with `implicitRole` removed from the fixtures (fixtures restored after) | Close and Decline passed, which proves the kind word is the cause. The thin-form row pass failed, which proves the gap described above. | n/a |
| Same test with the fix | 7 passed | 0 |
| Same test with only the `STRUCTURAL_FIELD` change reverted (restored after) | 3 failed (Close, Decline, kind name) | n/a |
| Same test with only the `matches()` change reverted (restored after) | 1 failed ("still refused when a Flow's pass carries the row and a thinner form of the control") | n/a |
| `npx vitest run` over answer-first `run-acts`, `attempt`, `flow-run`, `tests` and `runtime/answer-first/act-record`, first run | 1 failed: the t869 thin-press mixed case, updated as described above | 1 |
| Same suite after the update | Test Files 94 passed (94), Tests 883 passed (883) | 0 |
| `pnpm --filter fluxiq check` (tsc `--noEmit`) | Passed | 0 |
| `pnpm structure:check` | `structure-audit: passed (526 warning(s), 969 baselined).` Advisory only for my files: `act-record/tests/` has 17 files (threshold 15); `record.ts` is 706 lines (was 704, already past 400). | 0 |

I ran no build, no Lab command, and nothing that writes dist output.

## Not verified

- No live rerun of professional-network, because the Lab is busy on this tree.
- I did not run the extension's own tests, for example `domain/.../labelled-press/tests/identity.test.ts`, which reads foresee. That would need a domain test build, and the extension is outside my paths.
- The run's act record was not persisted under the run folder. The match path was rebuilt from the step files, the run's sibling forward-pass fingerprints (run-mwat3vd9 steps 0021 and 0022), and the code, then confirmed by the probe above. It was not read from the record itself.

## Open questions or contradictions found

- **The t869 decision changed.** A named control and a control with no words on one row are now held the same act. Before the fix this held on the web anyway, through "button". The cost is a possible wrong "already done" for a wordless icon pressed after a named control on the same row. The forward run's `rowDone` already leaves the whole row out after any act.
- **Drawing tokens are read as addresses (not fixed).** A web control's drawing token (`d1.k3x9q2`, `domain/src/element-fingerprint/drawing.ts`) matches Core's address shape (`identity/address-shape.ts`). So it is left out of a fingerprint's stable fields and out of its control words. Two wordless icons that differ only by their drawing are told apart only by their other fields. That is a separate identity gap, conservative in direction. Fixing it touches act keys and persisted act ids, so it needs its own brief.
- **What happened to the speed lane's paths.** None of the cause is in `route/`, `task-key/`, `completion/`, `state-routing/` or `runtime/conversations/`, so no change is needed there.
