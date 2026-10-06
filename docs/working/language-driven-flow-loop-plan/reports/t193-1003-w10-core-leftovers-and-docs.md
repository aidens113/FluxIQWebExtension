# t193-1003-w10: Core leftovers and docs

## Outcome

Done. All five tasks are finished in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`. In this report, R means `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing was staged or committed, and the downstream tree was not touched.

## What changed and why

### 1. Cause 8 wiring: the model is now told about a moved act

- **`R/llm/decision-handlers/amendment.ts`**
  - `tell` takes `moved`. It now runs when an edit landed whole and moved an act, not only when something was refused or undone. Held amendments carry `moved` until their rerun settles.
  - New export `automationStudioLlmEvidenceClaimWrittenAct(context, step, act)`. It claims the act and then tells, as an answer with nothing refused (`ok: true`, `llm_evidence_loop.draft_act_moved`), each step the act left that is still in the Flow and now has no act.
- **`R/llm/decision-handlers/types.ts`**: added the optional field `moved?` to `AutomationStudioLlmEvidenceRerunHeld`. This file was not named in the brief. It was needed so that a move inside a decision that also has a rerun is not silently dropped.
- **`R/llm/evidence-loop.ts`**: this is the write-with-act path that the live run's step 0144 took.
  - The step is pushed first, and the claim then goes through the new helper.
  - The file was exactly at the 800-line hard limit, so the change is net −2 lines (798).
  - Claiming after the push changes nothing: `ClaimAct` skips the step itself.
- **Test** `R/llm/decision-handlers/tests/moved-act-told.test.ts` (4 cases): the write path tells; a first claim tells nothing; an amendment that only moved an act tells; a move beside a refusal tells both. It sits in `decision-handlers/tests/` because `llm/tests/` would have gone over the 25-file limit, and both helpers live in `amendment.ts`. Before the wiring, 3 of the 4 cases failed.

### 2. D12: repair heading wording only

- **`R/flow-bootstrap/unfinished-build/phases.ts`**
  - When no judge ran and no steps were left unrun, and acts are still to do, the label is now "Building on the Flow". The text is "N of the things you asked are still to do. Going on live from the page as it stands." (or "One of the things you asked is ...").
  - With nothing left to do, the label stays "Repairing the Flow" and the text is "Going on live with what did not work when it was run."
  - `phase` stays `repairing`, so there is no change in behaviour.
- **`not-done.ts`**: the carried-steps heading also repeated the label. It now says "Repairing it live, running them again."
- **Tests**
  - `tests/phases.test.ts`: two label pins changed to "Building on the Flow". The `unusable_decisions` case now pins the full heading.
  - `tests/judged.test.ts`: one pin updated.

### 3. Unsettled-judge sentence and merged progress sentence

- **New `automationStudioFlowBootstrapUnsettledForBuild(reason)` in `not-done.ts`.** It swaps each `AUTOMATION_STUDIO_RESULT_UNSETTLED_WORDS.<basis>.run` sentence for `.build` and leaves every other reason unchanged. It is used by:
  - the repair heading (`automationStudioFlowBootstrapRepairingJudgedSaid`);
  - `budget-exhausted.ts` `judgeFoundSaid` ("The judge could not confirm it: ...").
- **Load cycle and the move it forced.**
  - Importing the `result-verification` barrel from flow-bootstrap created a load cycle (`result-verification/read-account/unread-columns.ts` imports the flow-bootstrap barrel). It broke 27 judge tests with `carriedStep is not a function`.
  - Importing the leaf file directly failed the structure audit's barrel rule.
  - So I moved w6's `result-verification/unsettled-words.ts` to `result-verification/unsettled/unsettled-words.ts`, with its own `unsettled/index.ts` barrel.
  - The imports were updated in `agreement.ts`, `check-activity.ts` (import line and one comment) and `result-verification/index.ts` (it now exports it, as w6 suggested). Those are w6's files; only the paths changed.
- **`budget-exhausted.ts` and `replies-unreadable.ts`** now use `automationStudioFlowBootstrapProgressAndTestSaid` and no longer append `TestSaid`.
- **Tests**
  - `tests/not-done.test.ts`: the swap, and the heading.
  - `tests/budget-exhausted.test.ts`: the merged sentence and the build sentence. One pin changed to "(13 steps)".
  - `tests/replies-unreadable.test.ts`: the merged sentence.
  - `tests/reserve-judging.test.ts`: one pin changed, because it pinned the duplicated sentence.

### 4. Stale comments

- `R/llm/node-tools/dry-run-gate.ts`: lasting acts are now described by kind, and a failed read still names those acts.
- `R/result-verification/contracts.ts`: the `observed` doc now covers a replayed changing step's `changed` and `notice`.

### 5. Docs (Core `docs/architecture/automation-studio/`)

- **`llm-flow-bootstrap.md`**
  - Progress measures gain `judge_no_longer_refutes` (with `oneCallSaidYes`).
  - A stale "ends the build `not_doable`" now reads `not_finished`, with the not-finished ending's wording.
  - Added the merged progress-and-test sentence, the unsettled build sentence, and D12.
  - Added the lasting-acts-by-kind rule (`instructedLastingActs`).
  - Added the build-test `observed` for a replayed changing step.
- **`flow-authoring.md`**: the `bind_new_key` `control` case; every answer naming what is still to do; `moved` on both paths.
- **`client-gateway.md`**: refusal cards (`activityActionRefusal`, `ActivityAction.refused`, `ACTIVITY_ACTION_REFUSAL_WORDS`, "Edit the Flow", the refused-repeat card) and the build wording on a split judge's card.
- **Generated reference**: regenerated, with both copies of `framework-reference.md` updated.

## Commands run and observed results

All `npx vitest` and `tsc` commands ran from `packages/fluxiq`; the others ran from the Core root.

- Red before the task-1 wiring: `npx vitest run .../llm/tests/moved-act-told.test.ts` -> `Tests 3 failed | 1 passed (4)` (then in llm/tests; moved later).
- `npx vitest run` on R/llm/decision-handlers, R/llm/tests, R/llm/evidence-loop, R/llm/node-tools, R/llm/deepseek/tests, R/flow-bootstrap, R/flow-draft, R/result-verification, R/conversations and R/activity -> `Test Files 243 passed (243)`, `Tests 2810 passed (2810)`. This was the final run, after every code change except the one-line test-typing fix below.
  - An earlier run of the same set, while the result-verification barrel was imported, had about 30 failures from the load cycle. All of them pass now.
- `npx vitest run .../unfinished-build/tests/replies-unreadable.test.ts`, after that typing fix -> `Tests 3 passed (3)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w10 tsc" npx tsc --noEmit -p tsconfig.json` -> `[heavy] t193 w10 tsc holds b1`, `exit=0`. The first run had reported TS2339 in my replies-unreadable test; I fixed it and re-ran.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (242 warning(s), 349 baselined).`
  - Earlier runs failed on `llm/tests` having 26 files, `evidence-loop.ts` at 809 lines, and the not-done barrel bypass. All three are fixed.
- `node scripts/docs-reference.mjs` -> `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (3076 public declarations).`
- `node scripts/docs-reference.mjs --check` -> `Deterministic framework reference is current.`
- `node scripts/structure-audit.mjs --rule docs-links` -> `passed (0 warning(s), 0 baselined)`.
- `bash .../heavy.sh "t193 w10 core build" pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> contracts and client-gateway-websocket `reuse`, fluxiq `build` (`ms":227785`), `Done`, `exit=0`.

## Not verified

- No live run: the moved-act note has not been seen reaching a live model, and the new headings have not been seen in the panel.
- The full Core vitest suite and the `apps/web` tests were not run.
- The new tests in tasks 2 and 3 were written alongside the fix. I did not watch them fail on the old code, although each asserts text the old code could not produce.

## Open questions or contradictions found

1. **An amendment that only moves an act is classified "undone".** `R/llm/evidence-loop/amendment-memory.ts` `draftSignature` leaves out `acts`. So `{step 2, change: keep, act: a3}` on two kept steps gives `draft_amendment_undone` ("put the draft back exactly as it stood"), and the no-progress guard counts it as a step without progress. The `moved` note is still told beside it, but the answer contradicts itself. The fix is one line: add `acts` to the signature. That file is not mine. My test uses an `add` amendment so that it avoids this case.
2. `R/flow-bootstrap/unfinished-build/not-doable.ts` `judgedSaid` still quotes an unsure judge's `findings[0]` verbatim, so it can say "the run is not marked as failed for it". It can call `automationStudioFlowBootstrapUnsettledForBuild`, but that file was not in my brief.
3. In `client-gateway.md`, the documented card wording is taken from w6's report and the U/R code I read. I have not checked it against a rendered panel.
