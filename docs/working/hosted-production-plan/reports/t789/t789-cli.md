# t789-cli report

## Outcome
Done. `fluxiq accounts <operation>` exists as a library in `packages/fluxiq/src/platform/provisioning/cli/` (core tree `fxwork/t789/!FluxIQ`). Nothing outside that directory was edited.

## What changed and why
Files (one export per file, barrel `index.ts`): `run-accounts-command.ts` (runner, exit 0/1/2), `build-accounts-input.ts` (flags/--json/stdin/password-file to input, UUID request id for mutating ops), `flag-fields.ts`, `usage.ts`, `argv-offline.ts`, `strip-trailing-newline.ts`, `transport-error.ts` (safe-message error), `in-process-accounts-transport.ts` (platform-admin / in-process), `http-accounts-transport.ts`, `provisioning-listener-url.ts` (0.0.0.0 and :: become loopback), `read-token-file.ts` (first non-empty line), `select-accounts-transport.ts`, `types.ts`. Tests in `cli/tests/` (`run-accounts-command.test.ts`, `http-accounts-transport.test.ts`, helper `cli-test-io.ts`).

Decisions the brief left open:
- `--workspace` maps to `workspaceId` for setPolicies and addMember, to `workspace` otherwise; `--workspace-id` also accepted.
- Flags override `--json`. A password inside inline `--json` is refused (argv); allowed via `--json -` on stdin. `--json -` plus `--password-stdin` is refused (one stdin).
- Over http, setPassword returns the typed `operation_unavailable` answer "setPassword needs --offline (in-process, server stopped)" without a request (exit 1); any input holding a `password` is refused client-side before a request.
- Transport failures (unreachable, bad token file, non-JSON or non-response answer) throw `AccountsTransportError`; the runner prints only its message, exit 1. Any other thrown error prints a generic message.
- `selectAccountsTransport` is synchronous and lazy (the in-process service is built on first `run`); exactly one of the two env vars set is a config error reported on use. The caller passes `accountsArgvOffline(argv)` as `offline`.
- Filenames avoid a shared `accounts-` prefix because the structure audit's naming rule failed on it (renamed once).

## Commands run and observed results
- `pnpm test src/platform/provisioning/cli` (packages/fluxiq): parallel group 2 files, 24 tests passed; real-sql group "No test files found" (exit 0); "all groups passed: parallel, real-sql".
- `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p .`: no output at all (zero errors, including outside cli/ at that moment).
- root `pnpm structure:check`: after the rename, no FAIL line and nothing mentioning provisioning/cli (the earlier run had one naming FAIL, since fixed). I grepped for FAIL and cli only, not the full output.

## Not verified
- The real provisioning service and listener (written by another worker) were not exercised; in-process was tested with a stub `PlatformProvisioning`. The token-file format and the response shape were checked only against my own `node:http` server.
- No bin entry or `fluxiq` wiring (out of scope); IPv6 listen addresses are handled but not tested.

## Open questions
- Only one of FLUXIQ_PROVISIONING_LISTEN / FLUXIQ_PROVISIONING_TOKEN_FILE set: I chose an error rather than silently going in-process. Say if you want the other reading.
