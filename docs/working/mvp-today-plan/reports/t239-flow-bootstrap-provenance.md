# t239 — Flow Bootstrap three-state provider provenance

## Outcome

Implemented the minimal Core projection fix from t237. Flow Bootstrap diagnostics now admit
`providerInvocation: "unknown"`, and `flowBootstrapHarnessFailure` requires the invocation state
observed by the harness instead of inferring an attempt from provider metadata. The parser accepts
only code-compatible invocation states and rejects impossible invocation/response pairs.

No provider adapter, provider retry, service, budget, grant, request, or retry behavior changed.
This is a diagnostic fidelity and persisted-contract compatibility change.

## Production changes

- `flow-bootstrap/generation-failure/diagnostic.ts`
  - widened the durable invocation union to `not_attempted | attempted | unknown`.
- `flow-bootstrap/generation-failure/harness-failure.ts`
  - requires `providerInvocation` on every harness projection;
  - forwards it when the code's state admits it;
  - uses the code's canonical state for an inconsistent supplied combination, rather than deriving
    state from provider metadata.
- `flow-bootstrap/generation-failure/failure-state.ts`
  - separates one canonical producer invocation from the invocation states accepted for stored or
    observed diagnostics;
  - canonicalizes provider preflight, secret-unavailable, and configuration failures as
    `not_attempted`;
  - keeps known response and network failures `attempted`;
  - canonicalizes timeout, abort, transport-unknown, stage-default, and unclassified request errors
    as `unknown`;
  - accepts historical `attempted` records for ambiguous families, plus historical attempted
    secret/configuration records already produced by the former stage-wide rule.
- `flow-bootstrap/generation-failure/diagnostic-parse.ts`
  - admits `unknown` only when the state table permits it;
  - rejects `unknown/received`, `not_attempted/received`, and `not_attempted/unknown` pairs.
- `recovery/refuted-result/reauthor.ts`
  - widened the exact recovery-carriage union so `unknown` reaches stored reauthor metadata without
    a cast or behavioral branch.

The recovery file was added to t239 ownership after package type checking exposed its closed binary
union. No other closed-union consumer required an edit.

## Tests changed

- `generation-failure/tests/diagnostics.test.ts`
  - all harness fixtures now state observed invocation explicitly;
  - proves a timeout with provider metadata preserves `unknown`;
  - proves resolved provider preflight preserves `not_attempted`;
  - retains the historical combined-configuration record compatibility check.
- `generation-failure/tests/round-trip.test.ts`
  - proves transport-unknown round trips as `unknown`;
  - proves historical attempted timeout/abort/transport records still parse;
  - rejects unknown invocation with a received response and not-attempted invocation with an
    unknown response.
- `generation-failure/tests/provider-refusal.test.ts`
  - every projection fixture supplies the actual harness invocation state; provider refusal and
    bounded accounting assertions remain unchanged.
- `recovery/refuted-result/tests/reauthor.test.ts`
  - proves `unknown` is forwarded to the stored `resultReauthor` metadata.

Existing harness and provider-retry tests were not changed and passed, confirming that lower-layer
provenance and retry behavior remain intact.

## State matrix

| Failure family | Canonical invocation | Compatible stored/observed invocation | Response |
| --- | --- | --- | --- |
| Pre-provider stages and provider preflight | `not_attempted` | `not_attempted` | `not_received` |
| Secret/configuration preflight | `not_attempted` | `not_attempted`, legacy `attempted` | `not_received` |
| Authentication, rate limit, redirect, HTTP, network | `attempted` | `attempted` | code/status-defined |
| Provider output/usage and later stages | `attempted` | `attempted` | `received` |
| Timeout and abort | `unknown` | `unknown`, legacy `attempted` | `not_received` |
| Request default, transport unknown, unclassified request throws | `unknown` | `unknown`, legacy `attempted` | `unknown` |

Provider metadata is retained only for bounded provider/model/status/accounting data; it no longer
decides whether an invocation occurred.

## Validation

Passed focused suite:

```text
pnpm --filter fluxiq exec vitest run \
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts \
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts \
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts \
  src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts \
  src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts \
  src/programs/automation-studio/runtime/llm/provider-retry/tests/call.test.ts

6 files, 329 tests passed
```

Also passed:

- `pnpm --filter fluxiq check`
- Core root `pnpm check`
- Core root `pnpm build`
- scoped `git diff --check`; the four pre-existing untracked production files were additionally
  checked with `git diff --no-index --check NUL <file>`.

No live Lab, browser, or provider action was performed. No commit was made.

## Compatibility note

Existing diagnostics remain readable, including the historically attempted forms for ambiguous
request failures. A new diagnostic containing `unknown` is a widened persisted/public value; older
runtimes whose parser knows only two invocation states can reject it. Core and downstream readers
must therefore ship this widened value together before mixed-version emission is relied upon.
