# lane-t-p2-lo-lab-outbox report

## Outcome

Done. Both tasks are implemented test-first, and every check the brief names passes.

## What changed and why

### Task A (downstream Lab, decision D11)

- `packages/test-runner/src/environment.ts`
  - `TopologyPaths` gains `tracing?: boolean`.
  - `buildFluxIQEnvironment` sets `FLUXIQ_CLIENT_GATEWAY_TRACE` right after `...inherited`. The value is `"0"` only
    when `paths.tracing === false`, and `"1"` otherwise. Because it comes after the inherited environment, a
    launcher's value cannot switch it off or on.
  - The variable name is a local constant, `CLIENT_GATEWAY_TRACE_ENV`. Core exports no constant for it yet.
  - The function's doc comment explains the variable.
- `packages/test-runner/src/coordinator.ts`
  - `TopologyOptions` gains `tracing?: boolean`. It is passed to `buildFluxIQEnvironment` at the Core launch only when
    it is set, the same way the neighbouring optional fields are.
  - The `existing` target starts no Core, so it is untouched.
- `packages/test-runner/src/tests/environment.test.ts` has a new test covering:
  - the default (`"1"`)
  - an inherited `"0"` is overridden (`"1"`)
  - explicit `true` gives `"1"`
  - `false` gives `"0"`, and an inherited `"1"` cannot override it
- `packages/test-runner/src/tests/coordinator-existing.test.ts` has a new test. It runs `startTopology` (isolated)
  over fake spawned processes until Core's readiness wait. It then checks the Core child's spawn environment:
  `"1"` when `tracing` is undefined or true, `"0"` when it is false.
  - I put it in this existing file, which already covers isolated startup, rather than a new file. A new file in
    `src/tests/` broke the structure audit's directory budget (50 files against a baseline of 49).

### Task B (Core websocket client, decision D16)

- `packages/client-gateway-websocket/src/transport.ts`
  - `send`'s third argument is now a module-local `FluxIQClientGatewaySendOptions`, `{ id?, timestamp?, correlationId? }`.
  - `id` and `timestamp` fall back to the existing minting.
  - `sessionId` is still always the current socket's.
  - A fresh send that passes no options behaves exactly as before.
- `packages/client-gateway-websocket/src/connection/connection.ts`
  - The `LooseSend` type gains the optional options argument.
  - `flushQueue`'s send passes each queued message's `id` and `timestamp`, plus its `correlationId` when it has one.
  - The hello path and the live `send` are untouched.
- Tests:
  - `src/tests/transport.test.ts`
    - `SilentWebSocket` now records what it sends.
    - New describe "send envelope" with two tests. The first checks that given values are kept, with the current
      `sessionId` and `clientId`. The second checks that a send without options still mints its own values and
      carries no `correlationId`.
  - `src/connection/tests/connection.test.ts`: a new offline-queue test.
    - It queues an envelope with id `queued.1`, timestamp 1111, correlation id `command.4` and an old session
      `wire.old`.
    - After reconnect, the flushed message carries those values with `sessionId: "wire.1"`.
- I kept Core's files in CRLF in the working copy (`core.autocrlf=true`, index LF), the same as the rest of the tree.

## Commands run and observed results

Downstream: worktree `fxwork/t736/!FluxIQWebExtension`, in `packages/test-runner`.

- `pnpm exec tsc -p tsconfig.json`: no output (clean).
- `node --test dist/tests/environment.test.js dist/tests/coordinator-existing.test.js`: `# tests 22`, `# pass 22`,
  `# fail 0`.
- Red check: I removed the `tracing` spread from `dist/coordinator.js` and ran `node --test --test-name-pattern=tracing`.
  - Result: `not ok 1 - an isolated topology traces ...`, with `# fail 1`.
  - After restoring the file: `# pass 1`, `# fail 0`.
- `node scripts/structure-audit.mjs` at the repository root: `structure-audit: passed (212 warning(s), 618 baselined).`

Core: worktree `fxwork/t736/!FluxIQ`, in `packages/client-gateway-websocket`.

- Before the fix, `npx vitest run src/tests/transport.test.ts src/connection/tests/connection.test.ts` gave
  `2 failed | 41 passed (43)`. The two D16 tests failed with `expected { id: 'fresh.2', ... } to match object { id: 'queued.7', ... }`
  and `expected { ... } to match object { id: 'queued.1', ... }`.
- After the fix:
  - transport and connection tests: `Tests 52 passed (52)`
  - whole package `npx vitest run`: `Test Files 27 passed (27)`, `Tests 182 passed (182)`
- `pnpm exec tsc --noEmit`: no output, exit 0.
- `node scripts/structure-audit.mjs` at the Core root: `structure-audit: passed (420 warning(s), 1152 baselined).`

## Not verified

- I did not rebuild Core's `client-gateway-websocket` dist. The brief said not to rebuild Core's fluxiq package or
  dist, so the downstream extension still consumes the old built `send` until the supervisor rebuilds.
- I have not checked whether Core's gateway intake de-duplicates or rejects a re-sent envelope `id`, for example
  after a flush that failed partway and was retried. Map item 5 already flagged this as unknown.
- I ran no live or Lab run, no full downstream suite, and nothing that reads the tracing variable in Core. Core's
  reader in `programs/_shared/runtime.ts` is another worker's.
- I did not change the demo-workspace Core launch (`demo-workspace/core-process.ts:124`). It goes through
  `buildFluxIQEnvironment` without `tracing`, so tracing is on by default there too.

## Open questions or contradictions found

- The loss marker the outbox sends first also goes through the flush's `send`. It now keeps the id and timestamp it
  was minted with, which happens at flush time, so in practice nothing changes for it.
- The `existing` target cannot have tracing set, because it starts no Core. Map item 6 already noted this.
