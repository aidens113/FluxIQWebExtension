# t195-w35: a done act is never repeated (R3, R7)

Lane D, round 1002-M, run `run-murwcaj0-40e56557`. Core tree `fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`. Nothing committed.

## Outcome

Done, with one deviation from the ownership list (see Open questions 1). R3 and R7 are both fixed, and each has failing-first tests that I watched fail and then pass.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime`.

- **R3: `R/flow-draft/verify-only.ts`.** `automationStudioFlowDraftStepReplayMode` now returns `verify` for a changing (`effect: "mutate"`) step that carries an instructed act (`acts` is non-empty), whatever the step declares. Every other case is unchanged: a read that carries an act is still replayed, an empty `acts` list makes no difference, and the old declaration rules still apply. I added a new predicate, `automationStudioFlowDraftStepActDone(step)`, which is true for a mutate step with acts whose own run worked (`effectApplied === true`, `proposes !== false`). The header now names the run for both rules.
- **R7: `R/llm/node-tools/rerun-check.ts` (new; exported from `node-tools/index.ts`).** `automationStudioNodeRerunAnswer` runs the call the loop decided:
  - An ordinary call, or a rerun of a step that has not done an act, runs as before (put-back note via `automationStudioNodeRerunPlaceNoted`).
  - A rerun of a step that has already done its act is sent, after the usual put-back, as the dry run's check: `{...newArgument, replay: "verify", from: step.replay.from}`.
  - On `core.replay.verified` or `core.replay.present`, the step takes the new argument as `input`. Its `ranWith` becomes the resolved form if the host's answer has one (`draft.ranWith`); otherwise `ranWith` is removed, so Amara's selector is never kept under Tom's name. Its `words` are refreshed and its stale `control` is dropped.
  - On anything else, the step keeps the argument it ran with, the same as after a rerun that did not work. A receipt step is appended with `effectApplied: false`, which cannot be proposed, so the held amendments are refused `did_not_work`.
  - The answer's evidence carries `rerunCheck: {checked: true, doneAgain: false, acts, answer, took, detail}`. The `detail` says the rerun was checked and not done again because the step already did the act once while the Flow was being built. When `took` is true, it also says that a repeated step does the act on each row its listing keeps.
  - This is not a refusal. Plain calls, and reruns of steps with no act or whose act has not been done, are unchanged.
- **`R/llm/evidence-loop.ts` (not on my list; see Open questions 1).** Three small edits at the call that runs the rerun:
  - The `runFlow.executeTool` / `automationStudioNodeRerunPlaceNoted` line is replaced by `automationStudioNodeRerunAnswer`.
  - A new `rerunTook` flag is declared.
  - When the check took, the held amendments settle onto the replaced step instead of the receipt.
- **`R/llm/evidence-loop/rerun-request.ts`.** Header paragraph only (no code change). It says a done-act rerun is requested as usual, is not refused, and is answered as a check.
- **`R/llm/decision-handlers/amendment.ts`.** Not changed. The handler's existing `replaces` already carries everything the check needs.
- **Tests:**
  - `flow-draft/tests/verify-only.test.ts`: 2 new cases (R3).
  - `llm/node-tools/tests/rerun-check.test.ts` (new): 6 cases through the real loop, using a fake friend-requests page. They cover: a check is sent and Tom is not accepted; the step takes the new argument with the resolved form; the `present` answer and a held `optional` applied to the step; `unreproducible` keeps the step as it ran; no resolved form means `ranWith` is dropped; a plain call still runs; a rerun of a step with no act still runs. I first put this file in `evidence-loop/tests`, but that folder then held 26 files and the structure audit failed its 25-file limit. I moved it beside its subject.

## Commands run and observed results

All commands ran from the Core root.

- Failing first, R3: `npx vitest run --exclude ".tmp/**" .../flow-draft/tests/verify-only.test.ts` printed `× ... checks a changing step that does an instructed act, whatever it declares → []: expected 'replay' to be 'verify'` and `Tests 1 failed | 13 passed (14)`.
- Failing first, R7 (before the fix): 4 failed and 2 passed out of 6. The rerun was sent as `["rerun.1", null, "Confirm Tom"]`, a plain press, where the test expected `"verify"`. `unreproducible` was likewise sent plain (`[null,'reset',null]`). `expected { target: '#confirm-tom' } to be undefined`. The two guard cases (plain call, rerun of a step with no act) passed both before and after the fix, as they should.
- After the fix, both files: `Test Files 2 passed (2) | Tests 20 passed (20)`.
- Brief validation, scoped to the real tree: `npx vitest run --exclude ".tmp/**" <flow-draft> <llm/evidence-loop> <llm/decision-handlers> <llm/node-tools>` gave `Test Files 57 passed (57) | Tests 458 passed (458)`. I ran it once more after moving the test: same counts.
- Brief validation, exact command as given (no exclude): `Test Files 969 passed (969) | Tests 7786 passed (7786)`, 600 s. Vitest's path filter also matches the `.tmp/core-web-build/*` copies, which is why the counts are so large. Add `--exclude ".tmp/**"` to run only the real tree.
- Neighbouring tests that use acts together with replay or rerun: `flow-bootstrap/unfinished-build/tests`, `instructed-acts/tests/object-binding`, `result-verification/build-test/tests`, `harness-options/tests/bootstrap-completion`, `harness/tests/request-evidence-check`, `evidence-progress/tests/progress-trace`, `llm/tests/draft-amendment-feedback`, `service-bootstrap/tests/generation`, `service-recordings/tests/assets`. Result: `Test Files 22 passed (22) | Tests 245 passed (245)`.
- `node scripts/structure-audit.mjs`:
  - First run, with the test in `evidence-loop/tests`: `FAIL [directory-files] .../evidence-loop/tests/: 26 source files exceeds the 25-file limit`.
  - After the move: `structure-audit: passed (223 warning(s), 349 baselined)`.

## Not verified

- No TypeScript typecheck. The brief forbids whole-package typecheck, and vitest strips types. The new code uses `parsed?.draft?.ranWith` from `automationStudioLlmEvidenceParseToolExecutionResult`, the same field `call-record.ts` reads, and destructures `({ ran, took: rerunTook } = ...)` into the existing `ran` variable. The lead's typecheck should confirm both.
- No live run. Two things are untested:
  - Whether the downstream web host answers a verify of a handle-form argument (`target: {handle}`) after the put-back reset. Its verify path does resolve handles (`verify.ts`, `handle_no_longer_on_page`).
  - How a dry run treats a step that took the new argument without a `ranWith` (see Open questions 2).

## Open questions or contradictions found

1. **Ownership.** The brief placed the rerun's execution under `R/llm/node-tools/`. It actually runs in `R/llm/evidence-loop.ts`, in `runCall`: put-back via `step-place.ts`, then `runFlow.executeTool`, then post-processing. Without editing that call site, no owned file could stop the second act or let the step take the new argument. So I put all the logic in `node-tools/rerun-check.ts` and made the smallest hook there (3 edits, +9/-4 lines; diff above). The hook is a deviation from the ownership list. No other worker had `evidence-loop.ts` modified when I checked `git status`.
2. **The downstream verify answer carries no resolved form.** In the downstream `domain/src/runtime/llm-evidence/node-run/verify.ts` and `replay-answer.ts`, `webNodeReplayAnswer` passes `draft` as `undefined`. So today a step that takes a new argument through a check ends up with `input` (handle form) and no `ranWith`, and the next dry run fails it: "A step with nothing to run it with is a failed step" (`replay-draft.ts`). That is honest but stops the Flow. Recommended downstream follow-up: on `verified`/`present`, return `draft: {ranWith: <resolved parameters>}` from verify. Core already reads it (tested with a fake host).
3. **Downstream header drift.** The downstream `verify.ts` header still says Core verifies "a step that changes something and declares any consequence but none". After R3, it also verifies a changing step that carries an instructed act. That is downstream documentation and outside this brief.
4. **The receipt.** The check's answer is still appended as a `taken` step that cannot be proposed (`effectApplied: false`, code `core.replay.verified`). The model sees it beside the `rerunCheck` explanation. A cleaner record would skip the receipt, but that means more edits in `evidence-loop.ts` (`draftRecord`, history rows), which I did not make.
