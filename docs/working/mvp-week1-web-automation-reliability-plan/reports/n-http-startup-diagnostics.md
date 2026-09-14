# `n-http-startup-diagnostics` — safe startup transport causality

## Outcome

Implemented. A rejected FluxIQ control fetch now becomes a closed
`RunnerFailure` with the caller's existing category, one fixed operation-stage
label, the fixed `network` transport category, and an optional allowlisted code
found within four cause links. The raw error, request URL/path, request body,
and credentials are not retained. Abort and timeout failures still take
precedence and keep their existing bounded meanings.

The three startup control operations are distinguishable as `auth.login`,
`project.create`, and `project.select`; cached-session validation is
`auth.session.validate`, and other control calls use `control.request`. No
request is retried. In particular, project creation remains single-attempt
because a lost response cannot prove that the mutation did not occur.

An isolated topology startup also preserves its primary failure if process
cleanup or run-root cleanup rejects. Cleanup remains attempted before the
primary failure is rethrown.

## Files changed

- `packages/test-runner/src/http-control.ts`
- `packages/test-runner/src/failure.ts`
- `packages/test-runner/src/coordinator.ts`
- `packages/test-runner/src/tests/http-control-auth.test.ts`
- `packages/test-runner/src/tests/failure.test.ts`
- `packages/test-runner/src/tests/coordinator-existing.test.ts`

## Focused proof

- Test-runner `check`: passed.
- Focused private-depth build and tests: 13/13 passed. The rows cover the fixed
  login/create/select labels and original categories; nested `ECONNRESET`;
  sentinel absence; raw-cause removal; abort and timeout precedence; bounded
  cause traversal; unknown-code refusal; and primary startup-failure precedence
  across rejecting cleanup.
- Full test-runner suite from an isolated same-depth build: 691/691 passed.
- `pnpm structure:check`: passed with the pre-existing advisory warnings and no
  baseline change.
- `git diff --check` over the six owned source/test files: passed.

## Mutation proof

All mutations were applied one at a time, produced the named focused failure,
and were then restored before the final check and 13/13 rerun.

1. Cause traversal was removed from `failure.ts`. `classifies an allowlisted
   socket code through only a bounded cause chain` failed: expected
   `process.startup`, received `unknown`.
2. The extracted transport code was discarded in `http-control.ts`.
   `startup control transports preserve fixed stages and bounded codes without
   leaking request data` failed because `transportCode: "ECONNRESET"` was
   absent.
3. Cleanup rejection was allowed to replace the caught startup failure in
   `coordinator.ts`. `isolated startup preserves its primary safe failure when
   cleanup also fails` failed because the observed error was no longer the
   original `RunnerFailure`.

Final SHA-256 values after restoration were
`66A19EC0C05ABB7485CF816F632C46364CA00022D935E3CAB7FB608367884DBA`
(`failure.ts`),
`D5B8D268FA1B6695C0C8D5A4E7618C5A90CBD1D59C85D5CD8F6011E9AC594F67`
(`http-control.ts`), and
`DB8FE040E30325219BC9C86B3FEE5753D991A06A8CFFF1894A7F2E8B78C572C7`
(`coordinator.ts`).

## Not verified

No Lab run was authorized. A later narrow concurrent W05/W25 stress run must
show that any startup transport failure is reported with a fixed stage and
category rather than bare `fetch failed`, while exposing no raw request/error
material. The change intentionally does not claim to prevent the transport
failure or to make non-idempotent project creation retryable.
