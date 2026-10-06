# t194-w75: missing key and timing words

## Outcome
Partial: both fixes made; domain fix test-first and passing; recorder wording has no test.

## What changed and why
- domain/src/runtime/llm-evidence/node-run/run.ts:312: mutate call without consequences now refused with `missing: ["consequences"]`, so the model knows which key it lacked.
- domain/src/runtime/llm-evidence/tool-rejection.ts:238: doc says `missing` names the keys the call left out for `missing_input_keys`.
- node-run/tests/unwritten-consequences.test.ts: two existing refusal tests (consequences null; nothing declared anywhere) now assert `detail.missing` deep-equals ["consequences"].
- packages/test-runner/src/run-scenario/ui-review/recorder.ts:110: log reads "(taken from -2 ms to 198 ms of the overlay window)".

## Commands run and observed results
- narrow-tests.mjs (package path has to be absolute: `domain` relative threw ERR_INVALID_ARG_VALUE in createRequire), before fix: `# pass 205`, `# fail 2` (the two new assertions).
- After fix: `# pass 207`, `# fail 0`.

## Not verified
- No test covers the recorder line. It is built inline in a private class method that needs a live Playwright session, and no ui-review test reaches it. I did not run the test-runner package tests because its test script runs the core build, domain dist and full build first. I did not typecheck the recorder change; it only changes text inside a template literal.

## Open questions
- To test the recorder wording, the line would need moving into a small formatter. That means a new file, which this brief does not own.
