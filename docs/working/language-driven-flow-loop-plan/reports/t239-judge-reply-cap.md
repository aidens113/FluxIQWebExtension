# t239 judge reply cap: worker report

## Outcome

Done. Every model-backed judge call now reserves a reply of at most 2,000 tokens, down from the 8,000-token default. This fixes the first half of C7. The second half, in `flow-bootstrap/unfinished-build/**`, is untouched.

## What changed and why

All paths are in Core (`fxwork/t239/!FluxIQ`). `R/` means `packages/fluxiq/src/programs/automation-studio/runtime/`.

- **One shared call site.** All three judge call sites reach the model through `askOnce` in `R/result-verification/verify.ts`, so the cap is applied there and nowhere else:
  - the build-test judge (`build-test/judge.ts` calls `verifyAutomationStudioRunResult`);
  - the runtime result check (`run-outcome.ts:499,507`);
  - the recursive re-check after a repair's replay (`run-outcome.ts:344,410`, which goes back through `verifyAutomationStudioRuntimeSessionResult`).

  No other `loop_verification` caller exists. The other `runAutomationStudioLlmHarness` callers are recovery, service and instruction-authority, and none of them is a judge.
- **`R/llm/harness/token-limits.ts`** gains:
  - `AUTOMATION_STUDIO_LLM_JUDGE_REPLY_TOKENS = 2_000`. It is derived the same way as the decision cap: at least three times the largest recorded judge reply (412 tokens, run 38), rounded up to the thousand.
  - `automationStudioLlmJudgeTokenLimits(named)`, which keeps the resolver's input and total limits and sets the reply to `min(resolved, 2000)`. Limits the resolver refuses are passed through unchanged.
  - A private helper, `withReplyAtMost`, now shared with `automationStudioLlmDecisionTokenLimits`. The decision cap's behaviour is unchanged.
- **`R/result-verification/verify.ts`**: `askOnce` passes `tokenLimits: automationStudioLlmJudgeTokenLimits(request.tokenLimits)` to the harness. A small local helper, `withDefined`, satisfies `exactOptionalPropertyTypes`.
- **`R/llm/harness/index.ts`**: two names added to the barrel's `token-limits.ts` export list. This file is outside the paths the brief gave me (see open questions).
- **`R/result-verification/build-test/tests/judge.test.ts`** gains two tests:
  - **Run 38 (C7), failing first.** A purse has $0.009 left. The provider's price makes an 8,000-token reply cost $0.0112 (run 38's hold), so a 2,000-token reply costs $0.0028. The test asserts the verdict is `yes`, the request's `maxOutputTokens` is 2,000, and every `estimateCostUsd` call the purse priced used `outputTokens` 2,000.
  - A reply allowance that a resolver set below 2,000 (here 500) is kept.

## Commands run and observed results

- Before verify.ts was wired up, with only the constant and the barrel in place: `npx vitest run src/.../result-verification/build-test/tests/judge.test.ts` printed "1 failed | 15 passed". The failure was `expected { verdict: 'not_judged', … } to match object { verdict: 'yes' }`, which is run 38's outcome.
- After wiring: `npx vitest run src/programs/automation-studio/runtime/result-verification/` printed "Test Files 19 passed (19), Tests 193 passed (193)".
- `npx vitest run src/.../llm/harness/tests/ src/.../tests/service-bootstrap/tests/creation-spend.test.ts` printed "Test Files 17 passed (17), Tests 99 passed (99)". This covers the decision-cap refactor.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t239 fluxiq check" pnpm --filter fluxiq check` exited 0. tsc reported no errors.
- `node scripts/structure-audit.mjs` (Core) printed "structure-audit: passed (218 warning(s), 349 baselined)". The only warning touching a changed file is the advisory `exported-values` warning on `token-limits.ts`: it now has 12 exported values, up from 10, against an advisory threshold of 8 and a failure limit of 15. That warning already applied before this change.

## Not verified

- No full suites, no live runs and no provider calls.
- The 2,000-token figure rests on the one judge reply size in run 38's debug (412 tokens). There is no judge-reply corpus like t234's corpus for decisions.
- The extension repository was not touched apart from this report.

## Open questions or contradictions found

- The barrel `R/llm/harness/index.ts` was not in the paths I own, but the new export could not be imported without it. A deep import would have counted as a ratcheted barrel skip in the structure audit. Please confirm or reassign that two-line edit.
- The runtime result check (`run-outcome.ts`) also passes a resolver's `tokenLimits`. A Flow setting with a larger reply allowance is now narrowed to 2,000 for judge calls, which is intended.
