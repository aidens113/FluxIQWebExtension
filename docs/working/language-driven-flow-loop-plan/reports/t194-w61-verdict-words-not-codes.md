# t194-w61: verdict words, not codes

## Outcome

Done. A verification call that does not come back usable is now described in chat in plain words, chosen by the family its diagnostic code belongs to. The exact code is kept on the verification as the optional field `failureCode`, and the run record stores it too.

## What changed and why

All paths below are under Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `result-verification/verdict.ts`: the `model_unavailable` reason no longer adds `(${failureCode})` to its sentence. The new private function `callFailureWords(code)` picks the wording by code family:
  - The call was aborted or cancelled: "the judge's call was stopped before it answered"
  - A code ending in `timeout`: "the judge ran out of time before it answered"
  - `llm_budget.*`, `llm_usage.*`, `*budget_exceeded` or `*usage_limit_exceeded`: "the judge's call would have gone past its spending or size limit"
  - `llm_output.*`, or `llm.provider_` followed by `malformed_response`, `output_*`, `response_oversize`, `usage_invalid` or `result_summary_invalid`: "the judge's reply could not be read"
  - `llm.provider_` followed by `http_error`, `network_error`, `rate_limited`, `auth_failed`, `secret_*`, `request_failed`, `request_setup_failed`, `redirect_rejected` or `model_unsupported`: "the model could not be reached"
  - `llm.request.*`, or any other `llm.provider_*_invalid` or `credential_in_request` code: "the judge's request could not be sent"
  - No code, or a code from no known family: "the verification call did not come back usable", as before
  - The verification object carries `failureCode` only when a code was given.
- `result-verification/contracts.ts`: adds an optional `failureCode?: string` to `AutomationStudioResultVerification` and to `AutomationStudioResultVerificationSkipped`. The change is additive.
- `result-verification/run-outcome.ts`: two more chat texts carried a raw identifier, and both are now plain words:
  - `verificationDidNotFinish` (about line 564) put `(${errorName(error)})`, for example "(Error)", into the reason.
  - `unreadableResult` put `: ${errorName(error)}` into the observation. `sayResultCheck` sends that observation to chat.
  - The error's name now goes to `failureCode` instead.
  - `recordedOutcome` copies `failureCode` into `metadata.resultVerification` for both the performed and the skipped shapes, so a debug reading the record still has it.
- `service/flow-bootstrap-commands/build-judge.ts`: no change was needed. The text it announces is `built.judged.why`, which comes from the verdict reason fixed above. `untested` lists only step positions such as "Steps 3, 4", with no codes or node ids.
- Tests:
  - `tests/verdict.test.ts`: the old assertion that the reason contains the code was reversed. New tests check the words for 14 codes across all families, that each reason has no dotted code, and that the record keeps `failureCode`.
  - `tests/run-outcome.test.ts`: the stored record keeps `failureCode`, and the reason and observation contain no error name.
  - `service/flow-bootstrap-commands/tests/build-judge.test.ts`: a new end-to-end test. A provider returns `observed: 42`, the harness reports `llm_output.invalid_diagnosis_text`, the judge's verdict is `unknown`, and the test checks the text `unverified` announces.

Readers of a stored verification:
- The Lab (`!FluxIQWebExtension/packages/test-runner/.../persisted-flow-run.ts` and `live-llm/live-llm-run.ts`) reads only `resultVerification.status`.
- `check-activity.ts` reads `reason`. `agreement.ts` spreads `...first` on its single-call paths, so the field passes through. Its two-call `unsettled` builds a new object that drops the field, but that reason is agreement's own prose and contains no code.
- Run detail metadata is a plain `JsonObject`.

None of these readers is broken by the additive field.

Proposed commit message:

```
Core: a verification call that did not come back is said in words, and its code kept on the record (run muqk713g screenshot 00013)

Task: t194
Worker: t194-w61
```

## Commands run and observed results

Failing first. Before the fix, `npx vitest run` over verdict.test.ts, run-outcome.test.ts and build-judge.test.ts reported 19 failures, including:
- verdict: `expected "The run's result was never judged: the verification call did not come back usable (llm.provider_timeout). ..." not to contain 'llm.provider_timeout'`
- run-outcome: `expected 'undefined' to be 'string'` (record had no failureCode); `Received: "...it failed before reaching a verdict (Error)."`; `Received: "The run's stored records could not be read: Error."`
- build-judge: `Received: "Its test was not judged to answer what you asked: The run's result was never judged: the verification call did not come back usable (llm_output.invalid_diagnosis_text). A result nobody checked is not a result that answers. Its first run is judged again."` This is the screenshot text, reproduced.

After the fix:
- `npx vitest run src/.../result-verification src/.../service/flow-bootstrap-commands`, through heavy.sh, reported `Test Files 26 passed (26)` and `Tests 266 passed (266)`.
- `pnpm check` in packages/fluxiq, through heavy.sh, returned rc=0 (tsc --noEmit, build-cache "inputs changed", 76 s).
- `node scripts/structure-audit.mjs` at the Core root printed `structure-audit: passed (218 warning(s), 349 baselined).` and returned rc=0.

Chat text before and after:
- Before: "Flow not verified -- Its test was not judged to answer what you asked: The run's result was never judged: the verification call did not come back usable (llm_output.invalid_diagnosis_text). A result nobody checked is not a result that answers. Its first run is judged again."
- After: "Flow not verified -- Its test was not judged to answer what you asked: The run's result was never judged: the judge's reply could not be read. A result nobody checked is not a result that answers. Its first run is judged again."
- Not-finished check, before: "...never judged: it failed before reaching a verdict (Error)." After: "...never judged: it failed before reaching a verdict." The record holds `failureCode: "Error"`.

## Not verified

- No live run or browser check.
- I did not run the whole Core suite.
- I did not rebuild the extension, so the rendered chat was not checked.

## Open questions or contradictions found

- `contracts.ts` also has another worker's uncommitted changes in the same working tree: `dropsEarlierPageRepeats` and `earlierPageRepeats` on the read account, alongside changes in read-account and build-test. My change to that file is only the two `failureCode` fields. The supervisor should split the hunks when committing.
- The announced sentence still says "judged" twice ("Its test was not judged ...: The run's result was never judged: ..."). This is a style point only. Changing it means editing build-judge's prefix or the verdict sentence, and I left both alone so the change stays small.
- `agreement.ts` (not mine) drops `failureCode` on the two-call `unsettled` path. That path is not reached after an unavailable first call, because there is no second ask. A second call that is unavailable after a first `no` loses its code there.
