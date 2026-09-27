# t293 Deadline Fixture Determinism Fix

Date: 2026-09-26
Repository changed: `F:\!FluxIQ`
Outcome: **PASS — deterministic post-entry timeout fixture and focused matrix green.**

## Change

Changed only
`packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`.
The deadline-retry case now returns a test-only `"timeout_after_send"` reply. After the fake
endpoint records that it was entered, it throws the typed retryable provider error
`AutomationStudioLlmProviderError("llm.provider_timeout", ...)`.

Endpoint entry occurs after the execution grant has revealed and released the credential, so the
fixture deterministically exercises the post-credential provider-timeout path instead of racing a
three-second wall clock against authorization work. The case proves the evidence loop continues
through iterations `[1, 2, 3]`, produces a proposed Flow, reveals for all three provider calls,
revokes exactly once during normal cleanup, and leaves zero active grants.

The obsolete `"hang"` reply branch and optional `create({ timeoutMs })` seam were removed. Grant
issuance retains the normal literal `timeoutMs: 25_000`; no production timeout or grant behavior
changed.

## Focused validation

Run from `F:\!FluxIQ` with `NODE_OPTIONS=--max-old-space-size=8192`:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts `
  src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-failures.test.ts `
  src/programs/automation-studio/runtime/llm/provider-retry/tests/policy.test.ts `
  src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts
```

Result: **4/4 files passed, 51/51 tests passed** in 59.89 seconds. The changed DeepSeek case passed
in 3.444 seconds; its file passed all 8 tests. Supporting coverage passed all 21 execution-grant
failure tests, 12 provider-retry policy tests, and 10 harness tests.

Scoped `git diff --check` passed. Git emitted only the repository's LF-to-CRLF working-copy warning;
it reported no whitespace error.

No production source, shared plan, generated output, or live state was changed. No root suite or
build was run; the brief required the focused four-file matrix.
