# t706 pairing keepalive: worker report

## Outcome

Done. While the gateway socket is open but not yet connected (`pairing` or `connecting`), every heartbeat tick (20 s) now makes one cheap extension API call. That resets Chrome's MV3 idle timer, so the service worker and its socket stay up for the whole approval window. Behaviour once connected is unchanged.

## What changed and why

- `apps/extension/src/background/connection/gateway-session.ts`
  - `GatewaySessionHandlers` gains an optional `keepAlive?: () => void`.
  - In `startHeartbeat`, the interval still calls `onHeartbeat` when the state is `connected`. When the state is `pairing` or `connecting` it now calls `keepAlive?.()`.
  - The timer still starts in `onOpen` and stops in `onClose` and `closeClient`, so nothing ticks once the socket has gone.
  - `keepAlive` is optional so that `host-lease/tests/gateway-carriage.test.ts`, which I do not own and which builds handlers without it, still compiles.
- `apps/extension/src/background/connection.ts`
  - Wires the handler as `keepAlive: () => chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError)`, with a two-line comment.
  - It is not a protocol message: an unpaired session may not send client data.
  - It uses the callback form so the call works on the `chrome` namespace in both Chrome and Firefox, and reading `lastError` keeps the console quiet.
- `apps/extension/src/background/connection/tests/gateway-session.test.ts`
  - Adds an `OpeningSocket` fake, which opens on a real `setTimeout` and has a `drop()` that fires close. Only `setInterval` is faked, through `mock.timers` from `node:test`.
  - Five new tests:
    - pairing: 15 ticks give 15 keepalives and no heartbeat (five minutes);
    - connecting with a saved token: two keepalives;
    - after `markSessionReady`: heartbeats only;
    - after the socket drops: nothing ticks;
    - after `closeClient`: nothing ticks.
- A first version put the call in its own module, `connection/keep-service-worker-awake.ts`, with its own test file. It was withdrawn because `connection/` and `connection/tests/` each already hold 25 files, and the structure audit failed both at 26 (`directory-files`). The call fits in one line, which the brief allows inline. No barrel change remains.

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t706-keepalive node scripts/test-extension.mjs background/connection/tests` -> `# tests 254`, `# pass 254`, `# fail 0` (final code).
- Mutation check: with the new `else if ... keepAlive?.()` line removed, the `gateway-session` tests gave `# pass 7`, `# fail 4`. Tests 7 to 10 (pairing, connecting, connected, dropped) failed. The line was then restored and `git diff` confirmed it.
- `pnpm.cmd --filter @fluxiq-web-extension/extension build` -> `Done in 11165ms`, then `chrome: verified 22 files`, `firefox: verified 22 files` (plus the existing gecko.id placeholder warning), and `e2e-chromium: verified 22 files`. The build script runs `tsc -p tsconfig.json --noEmit` first, and it passed.
- The test files are excluded from that tsconfig, so the test file was typechecked once with a scratch tsconfig, `tsc -p <scratchpad>/t706-tsconfig.json`, which extends the extension's tsconfig and lists only `gateway-session.test.ts`. It printed no errors.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (203 warning(s), 639 baselined).` There are advisory warnings only on touched files:
  - `connection.ts` is 529 lines (above 400) and has 36 methods;
  - `gateway-session.ts` is 407 lines (above 400; it was about 401 before).

## Not verified

- Live Chrome or Firefox behaviour: no browser was loaded. Nobody has yet watched the worker survive more than 30 s in `pairing`, or an approval after 30 s producing a token.
- That `getPlatformInfo` resets the idle timer comes from Chrome's documented rule (Chrome 110+: extension API calls reset the idle timer). It was not measured here.
- The full suites were not run, per the repository rule.

## Open questions or contradictions found

- The brief said to follow the test file's "fake-timer pattern", but the file had none. I used `mock.timers` from `node:test`, faking only `setInterval`.
- `connection/` and `connection/tests/` are both at the 25-file limit. The next file added to either needs a feature subdirectory first.
- Out of scope, noted only: Chrome 116+ also resets the timer on WebSocket messages, so this fix covers the silent window. If Core's challenge outlives the 5-minute approval window, the panel still shows the stale code. That is unchanged by this work.
