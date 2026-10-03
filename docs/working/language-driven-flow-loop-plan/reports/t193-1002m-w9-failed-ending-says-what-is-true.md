# t193-1002m-w9: the failed build's ending says what is true

## Outcome

Done. Both false claims from live run `run-murzln6g-11debe1d` (09-failure-panel) are fixed in Core, with tests that failed first. No downstream fixture needed a change.

## What changed and why

`R/` = `packages/fluxiq/src/programs/automation-studio/runtime/` in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`.

### 1. The contradiction: kept vs "empty"

The stored Flow holds no steps either way. What differs is whether the build kept its draft. The failed response already says which: `payload.diagnostic.evidenceLoop.incompleteDraft` (`{ revision, steps }`, steps >= 1). `flowBootstrapBuildEndingFailure` in `service/flow-bootstrap-commands/built-loop.ts` sets it from the same `kept` pointer the endings read, so no new wire field was added.

- `R/conversations/commands/build.ts`: the failure arm of `AutomationStudioConversationBuildResult` gains `kept: boolean`, read from `diagnostic.evidenceLoop.incompleteDraft` by a new `keptDraft()`.
- `R/conversations/commands/create-here.ts`: the `left` sentence now comes from a new `automationStudioConversationCreateHereLeft(name, built)`:
  - nothing kept: `What is left: the Flow "<name>", empty, with what you asked saved on it, so it can be built again.` (unchanged)
  - kept, and the build gave its own ending: `What is left: the Flow "<name>", with what you asked saved on it.` The ending has already said what was kept, so it is said once.
  - kept, and no ending: `What is left: the Flow "<name>", with what you asked saved on it and the steps found so far kept, so building again carries on from them.`
- `R/flow-bootstrap/unfinished-build/budget-exhausted.ts` l.95 and `replies-unreadable.ts` l.41: the old sentence was "The Flow so far was kept, and building again carries on from it". It claimed the Flow was kept, but the Flow is empty and only the draft was kept. It now reads `The steps found so far were kept, and building again carries on from them[, with $X left of this Flow's $Y].` This matches what `provider-unavailable.ts` already said. I updated the header and doc comments to match.

Before (screenshot): "... The Flow so far was kept, and building again carries on from it, with $0.011 left of this Flow's $0.10. What is left: the Flow "Switch my pickup store...", empty, with what you asked saved on it, so it can be built again."

After (same build): "... The steps found so far were kept, and building again carries on from them, with $0.011 left of this Flow's $0.10. What is left: the Flow "Switch my pickup store...", with what you asked saved on it."

### 2. The overclaim: "worked" after a judged "no"

`R/flow-bootstrap/unfinished-build/not-done.ts` `automationStudioFlowBootstrapProgressSaid`:
- Its `judgement` parameter also accepts `judge?: { verdict }`. The full judgement passed by the callers already carries `judge`, so no call site changed.
- It says "worked" only when `judge.verdict === "yes"`.
- Otherwise it says the proven count as steps that "ran, or could run". A proven step may only have been checked (`verify-only.ts`). After that count it adds:
  - `, but the Flow was judged not to do what you asked` for a no;
  - `, but the Flow was not judged to do what you asked` for unknown or not_judged;
  - nothing when there was no judge.
- I extended the header comment (runs 36/38, results not claims) with the R2-C3 reason.

Before: `5 of the 6 things you asked worked when the Flow was run from its start; still to do: ...`
After (judged no): `5 of the 6 things you asked have a step that ran, or could run, when the Flow was run from its start, but the Flow was judged not to do what you asked; still to do: ...`

Note: the unfinished judgement's `judge` type (`AutomationStudioFlowBootstrapJudgedWrong`) never holds "yes". A yes ends the build as a success. So in practice no unfinished ending says "worked" any more. That includes a test with no judge, which used to say "worked". This follows the brief's rule: keep "worked" only where the judgement said yes.

### Tests

- New `R/flow-bootstrap/unfinished-build/tests/budget-exhausted.test.ts` (3 tests): a kept ending says the steps were kept, never that the Flow was; a not-kept ending says nothing was kept; a judged-no ending has no "worked".
- `R/flow-bootstrap/unfinished-build/tests/not-done.test.ts`:
  - The existing unjudged test now expects "ran, or could run".
  - New: judged no never says worked, and not_judged says "not judged".
  - New: judged yes says worked.
- `R/conversations/commands/tests/execute.test.ts`, two new tests:
  - A kept draft with an ending: no "empty", "carries on from" said once.
  - A kept draft with no ending: the full kept sentence.
  - The two existing tests still assert "empty" when nothing was kept, and they pass.
- I updated quotes of the old kept sentence in `unfinished-build/tests/{shared-purse,replies-unreadable,phases,judged}.test.ts`. I also updated `R/tests/service-bootstrap/tests/judged-build.test.ts:263`. That file is outside the owned list, but it is a fixture that quotes the exact sentence, the same category as the downstream fixtures the brief allowed.
- Generated: `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md` were regenerated. The diff shows only line-number shifts for `automationStudioFlowBootstrapProgressSaid`, `automationStudioFlowBootstrapStopSaid` and `buildAutomationStudioFlowFromConversation`. Other uncommitted changes from other workers were already in those files.

Downstream: I searched both trees for the changed sentences. `live-run-display.test.ts` and `build-from-chat.test.ts` quote only the "empty" sentence as their own fixture text. Core still produces that sentence in the not-kept case, so neither needed a change. No downstream file quotes "The Flow so far was kept" or "things you asked worked".

## Commands run and observed results

- Failing first, before any source change: `npx vitest run .../unfinished-build/tests/budget-exhausted.test.ts .../unfinished-build/tests/not-done.test.ts .../conversations/commands/tests/execute.test.ts` -> `Test Files 3 failed (3)`, `Tests 6 failed | 28 passed (34)`. Excerpts:
  - execute: `expected 'The build stopped at its spending lim…' not to contain 'empty'`, received `"... The steps found so far were kept, and building again carries on from them. What is left: the Flow "Kettles", empty, with what you asked saved on it, so it can be built again."`
  - budget-exhausted: received `"... 2 of the 2 things you asked worked when the Flow was run from its start. The Flow (13 steps) ran from its start, but what it did was judged not to be what you asked. ... The Flow so far was kept, and building again carries on from it, with $0.011 left of this Flow's $0.10."`. This reproduces the live sentence.
  - not-done: `expected '3 of the 4 things you asked worked wh…' not to contain 'worked'`.
- `npx tsc --noEmit -p .` in `packages/fluxiq` -> no output, exit 0.
- `npx vitest run src/.../runtime/conversations src/.../runtime/flow-bootstrap/unfinished-build src/.../runtime/tests/service-bootstrap/tests/judged-build.test.ts` -> `Test Files 28 passed (28)`, `Tests 197 passed (197)`.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (223 warning(s), 349 baselined).`, exit 0.
- `node scripts/docs-reference.mjs --check` -> first run: `docs/reference/framework-reference.md is stale`. Ran `node scripts/docs-reference.mjs` (`Wrote ... (3013 public declarations).`), then `--check` -> `Deterministic framework reference is current.`, exit 0.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w9 core libs" node scripts/build-cache/cli.mjs contracts:build fluxiq:build` -> contracts `reuse`, fluxiq `build` (57.9 s), exit 0.

## Not verified

- No live run or browser view of the new sentences. They were checked only through unit tests against the live wording.
- The downstream test files were not run, because nothing in them changed. No downstream typecheck either.
- `explore.ts` and `improve.ts` are unchanged. They pass no `left`, so the ending's kept sentence is their only statement, and it is now true. I did not test them for this.
- A `not_doable` ending whose build kept a draft: that ending has no kept sentence (`not-doable.ts` is not mine). create-here would then say only `the Flow "<name>", with what you asked saved on it`. That is true but does not mention the kept steps.

## Open questions or contradictions found

- The brief's "after a judged 'yes' it may [say worked]" cannot happen in an unfinished ending: `judgement.judge` is `JudgedWrong` (no / unknown / not_judged). So the yes branch is reachable only by a direct caller, and is tested as one. Since no ending can carry a judged yes, endings now never say "worked", and Flows tested without a judge lose it too.
- The judged-no progress line and the test sentence after it both say the Flow was judged not to do what was asked, as the brief asked. The supervisor may want to drop one of them.
- `judged-build.test.ts` is outside the owned list, but I edited it as a quoting fixture (one line).
