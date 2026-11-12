# W3 t899: result-check limits and the attempt judge's limits test

## Outcome
Done. No source change was needed. The Flow-run result check already passes its judge resolution's `tokenLimits` to the harness. Two new test files prove both paths.

## Did verify.ts pass limits? Yes
- `runtime/result-verification/run-outcome.ts` (~line 599, 624): `resolved.tokenLimits` goes to the run budget and to `verifyAutomationStudioRunResult({ tokenLimits })`.
- `verify.ts` line 475: `...withDefined("tokenLimits", request.tokenLimits)` is in the `runAutomationStudioLlmHarness` input.
- `service.ts` (~2471-2475): both `resolveProvider` and `resolveCallerProvider` return resolutions normalised by `automationStudioResultVerificationProvider`, which keeps `tokenLimits`. I did not edit `service.ts`.
- Not covered: the harness-side `servedTokenLimits` override (W3's `served-limits.ts`) still applies to the provider verify passes, so a routed judge's own window wins there too.

## What changed (tests only, both new)
- `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/judge-token-limits.test.ts`: a real-service attempt with resolver `tokenLimits` of 60k input, 2k output and 62k total, and an answer of about 300k characters.
  - Every `loop_verification` request carries exactly those limits.
  - Its estimated input plus the output reserve is within the total.
  - The summary is sent in its shorter form: `summarised.items` contains `answerText.text`, and the note names `core.summarised`.
  - The attempt is answered, not setup_needed.
- `packages/fluxiq/src/runtime/result-verification/tests/judge-limits/tests/judge-token-limits.test.ts` (in a subfolder because `tests/` is at the 25-file limit): 2 tests.
  - A resolution with small `tokenLimits` reaches the harness request, which stays within them.
  - A window of 50 tokens refuses by size before the model is asked.

## Commands run and observed results
- First attempt test with 20k limits failed: the explore decisions themselves do not fit 22k, so the attempt ended `setup_needed flow_bootstrap.pre_provider_request_total_exceeded` before any judge. I raised the limits to 60k and the answer to ~300k chars.
- `npx vitest run` (packages/fluxiq) on both new files -> `Test Files 2 passed`, `Tests 3 passed`.
- After moving the result-verification test into the subfolder: `.../result-verification/tests/judge-limits` -> `1 passed`, `2 passed`.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (533 warning(s), 969 baselined).` The first run failed with a directory-files violation (the 26th file in `tests/`); fixed by the move.

## Not verified
- I did not run the whole `answer-first/attempt/tests` or `result-verification/tests` folders, only the new files. fluxiq tsc not run, as asked.
- The attempt test shows the attempt's limits reach the judge. Whether the judge's summary was shortened because of those limits rather than the default is shown by `summarised` being present, since the default window would hold the summary whole.

## Open questions
None.
