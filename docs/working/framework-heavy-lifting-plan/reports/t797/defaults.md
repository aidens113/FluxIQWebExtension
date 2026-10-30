# t797 defaults (Core P4: cannotUndo defaulted; words)

## Outcome
Done for the owned scope. Remaining check failures are other lanes' in-flight files (below).

## What changed and why
F = packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap (in the Core t797 tree).
- New `F/trial-defaults/before-trial.ts` (+ `index.ts`, `tests/before-trial.test.ts`): `automationStudioTrialDefaultsBeforeTrial(reset, signal, supplied, options)`.
  It asks `reset.beforeTrial` and remembers, per reset object, the act ids Core listed: `evidence.actsToUndo` of a refusal, and
  `startedWith.acts` (in place and listed apart as unsettleable) and `startedWith.cannotUndo` of an admission.
  Omitted `cannotUndo` -> all ids listed so far (undefined while none). A supplied list -> only its ids Core listed (narrowing; `[]` stays `[]`).
  The ledger's own filter is unchanged (listed at least once, legacy acts only).
- `F/candidate/trial-gate.ts` and `F/subflow-candidate/subflow-trial-gate.ts`: `beforeTrial(...)` call replaced by the shared function;
  the `cannotUndo` description now says "Optional; leave it out. Core defaults it to the acts a reset listed. Give it only to narrow that..."; the
  invalid-input instruction says "only to narrow what Core defaults". Subflow gate stays exactly 800 lines (its limit; it was 800).
- `F/candidate/index.ts` re-exports `../trial-defaults/index.ts` (same pattern as `../authoring-result`), so the subflow gate imports it from the candidate barrel.
- Why a gate-side memory and not the ledger's `inPlace()`/`unsatisfiable()`: `AutomationStudioSiteResetTrialReset` (site-reset/contracts.ts, not mine) exposes only
  `beforeTrial`/`trialRan`/`admit`, so the gates cannot call the ledger's answers. The listing the gates see in `beforeTrial`'s own answer is those same answers
  (`inPlace` + `unsatisfiable` are exactly `startedWith.acts`). If you want the default read from the ledger directly, a `listed()` on the TrialReset contract is needed (site-reset files).
- Tests: `trial-defaults/tests/before-trial.test.ts` (3: default when omitted, narrowing when supplied, description says optional);
  one test added to `subflow-candidate/tests/subflow-trial-gate.test.ts` (the subflow gate default and narrowing).

## Words (P4 items), already true, no change to words.ts or told.ts
- `outsideBrief` pointing to a plan amendment: already true. The builder note ends "...say so in your return, so the supervisor can amend the plan with project.amend_plan" (told.ts; told.test.ts line 36 asserts it). The reset-role note is for a reset that writes no subflow and has no plan to amend.
- A call under `undoes` never told it is outside the brief, any role: already true (`told.ts` early-returns on `undoes !== undefined` before `landedOutside`; told.test.ts "never go to a call naming an act under undoes, in a build brief or a reset").
- `retryRefused`: no longer exists in code (grep over packages/ finds none; only docs/architecture/automation-studio/llm-flow-bootstrap.md:432 and the plan mention it). No wording in site-reset/words.ts invites resending the same call/handle (checked every "again"/"repeat" line: they say not to repeat). Stale doc line 432 is outside my paths.

## Fail-first
New tests run against the old call (`Array.isArray(cannotUndo) ? cannotUndo : undefined`, temporarily swapped, then restored): 3 failed, 1 passed
(the description test, which was on the new text already). Candidate: `[undefined, undefined]` instead of `[undefined, ["act-1","act-2"]]`; narrowing test received
`["act-2","act-9"]` instead of `["act-2"]`; subflow got `["act-1","act-9"]`. This was run on the first layout (class in candidate/); the assertions are unchanged in the final layout, and the final run passes them.

## Commands and results
- `vitest run` on flow-bootstrap/{candidate,subflow-candidate,site-reset,trial-defaults} and service/project-build-notes (under the heavy-check lock): first run before the layout move 85 files / 773 tests all passed; final run 894 passed, 99 failed, all 99 in `site-reset/tests/ledger-act-to-call.test.ts` (a new file of another lane, "t797 P4 item 4", in flight). No other failure.
- Prompt-contract tests: `grep -rl "prompt-contract\|promptContract" packages/fluxiq/src --include=*.test.ts` found none (exit 1); also none under packages with a case-insensitive grep. Nothing to run.
- `node scripts/build-cache/cli.mjs fluxiq:check`: first run passed (exit 0) before the move; final run fails with 2 TS2322 errors, both in `site-reset/tests/ledger-act-to-call.test.ts` (lines 107, 149) - the other lane's in-flight file. No error in my files.
- `node scripts/structure-audit.mjs`: after fixing my own violations (candidate/ 25-file limit, depth, import through barrel, subflow gate 800 lines, statement packing) the only failure left is `reset-undo/tests/claims-inverse.test.ts:135` statement-packing, another lane's file.

## Not verified
No live run (not allowed). The default's effect on real reset flows (a legacy act kept without the model naming it) is covered only by the gate-level fake reset, not by an end-to-end build.

## Open questions
- Optionally add `listed()` to the TrialReset contract so the default reads the ledger directly rather than from the answers the gate saw.
- docs/architecture/automation-studio/llm-flow-bootstrap.md:432 still names `retryRefused`.
