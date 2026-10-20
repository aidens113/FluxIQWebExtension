# Lane G W-C report: Core `connection/` (t726)

Brief: "Brief: lane-g-wc-core-connection" in [lane-g.md](lane-g.md). Worker, 2026-10-19. No commits.

## Outcome

Done. `packages/client-gateway-websocket/src/connection/` exists in the Core worktree
(`fxwork/t726/!FluxIQ`, branch `task/t726-gateway-client-into-core`). It is the reconnecting session
layer ported from downstream `gateway-session.ts` (read at `HEAD`, before W-D's edits), with the trust
lineage and the outbox wired in. Its tests were written first and failed first. The package barrel
`src/index.ts` is untouched: the lead adds `export * from "./connection/index.ts";`.

## What changed and why

New files, one export each, `.ts` specifiers, outbox imported through `../outbox/index.ts`:

- `types.ts`: `ClientGatewayConnectionState`, `ClientGatewayConnectionStatus`,
  `ClientGatewayConnectionSender` (the downstream `GatewayMessageSender` shape),
  `ClientGatewayConnectionHello` (= the transport's `client` option),
  `ClientGatewayConnectionTokenStorage` (= the transport's `tokenStorage`, required here),
  `ClientGatewayConnectionHandlers`, `ClientGatewayConnectionOptions` (every option the brief names,
  with the brief's defaults: 1,000 / 30,000 / 20,000 ms, and a mint of `globalThis.crypto.randomUUID()`).
- `reconnect-delay.ts`: `clientGatewayReconnectDelay(attempt, { baseDelayMs, maxDelayMs })` =
  `min(max, base * 2^attempt)`.
- `open-failure-message.ts`: `clientGatewayOpenFailureMessage(error)`, the downstream
  `connectFailureMessage` strings character for character.
- `connection.ts`: class `FluxIQClientGatewayConnection`. Methods `state`, `statusFields`, `connect`,
  `stopReconnecting`, `retryNow`, `wantsConnection`, `closeClient`, `markDisconnected`,
  `markSessionReady`, `markFailed`, `noteMessageReceived`, `send`, `queuedActionResult`,
  `flushQueue`, and the new `removeQueuedRecordingEvent`, `refreshQueueSize` and `on`.
- `index.ts` barrel; `tests/` with `connection.test.ts`, `reconnect-delay.test.ts`,
  `open-failure-message.test.ts`, and the support files `fake-socket.ts` and `harness.ts`.

How the lineage and the queue are wired:

- The client learns whether the hello carries a token by wrapping `tokenStorage.read`. The transport
  calls `read` exactly once per socket, after `open` and before it sends the hello, and it sends
  `hello.token ?? stored`. The wrapper records `Boolean(hello.token ?? stored)` on the socket and sets
  the state to `connecting` or `pairing`, which is what downstream `onOpen` did from
  `session().token`. `server.pairing_required` marks the socket as having paired.
- On `server.session_ready` the client reads `outbox.lineage()` and calls
  `clientGatewayLineageAfterReady` with `resumed = tokenInHello && !pairingSeen`. It holds the result in
  memory, calls `outbox.setLineage`, and only then calls `onSessionReady`. If the stored lineage cannot be
  read, the client fails closed: it reports "Could not read the connection lineage, so a new one was
  started: <cause>" through `reportError`, forces `resumed` to false, and mints a new lineage. A failed
  `setLineage` is also reported, and `onSessionReady` still runs, so a broken store cannot stall the
  connection.
- Offline `send` captures `context()` first, builds the message with `clientId()`, then binds it with
  `clientGatewayOutboxBinding(message, lineage, context)`. The lineage is the in-memory one, else the
  outbox's, else `""`. The client stores the size the enqueue returns and emits the status.
  `flushQueue` builds `{ session: lineage, projectId, recordingId }` from `context()`, flushes through
  `client.send` on the socket captured at the start (never through `this.send`, which could enqueue
  into the outbox's own chain), and refreshes the size in a `finally`, so a failed flush also reports
  the tail it kept.
- `on(type, handler)` keeps a live subscription set. Each socket's client gets one dispatcher per
  subscribed type when it is attached, or when `on` is called while a socket exists. Subscriptions
  therefore survive reconnects, and an unsubscribe takes effect on the open socket.

Deliberate differences from downstream:

1. **Late events from a replaced socket are ignored.** A socket that a newer `connect()` replaced no
   longer has its `open`, `close` or `error` acted on, nor its token-read state change. The check is
   `this.current !== null && this.current !== record`. Downstream had no such guard: a real browser
   delivers the old socket's `close` asynchronously after the replacement exists, and that `close` would
   null the live client and schedule a reconnect that closes it. If no socket is current (after
   `closeClient`), a `close` is still handled as before. Test: "a superseded socket that closes late
   does not drop the live connection".
2. **The queued envelope no longer carries a `sessionId`.** Downstream stamped it from the persisted
   session. Nothing reads it, because a flush re-sends type and payload and the transport stamps the
   current wire session. Only `clientId` is kept.
3. `connecting` is now set when the token is read rather than in `open`. Both happen before
   `connect()` resolves, so callers see no difference.

## Commands run and observed results

All commands ran in `fxwork/t726/!FluxIQ/packages/client-gateway-websocket` unless stated otherwise.

- Red first: `npx vitest run src/connection` with no source failed all 3 files ("Failed to load url
  ../index.ts").
- `npx vitest run src/connection`, final run: "Test Files 3 passed (3), Tests 39 passed (39)". The 39th
  test, "starts a new lineage, and says why, when the stored one cannot be read", was added after the
  audit fix below. Before the first passing run, two test-harness timing problems were fixed. Under fake timers, a 0 ms timer scheduled during a
  tick fires 1 ms late, so the fake socket now opens on a microtask. The backoff test now measures gaps
  from each socket's faked `Date.now()` creation time. Neither fix changed source.
- Mutation check on `connection.test.ts` (32 tests), restoring the source each time and confirming it
  with `diff`:
  - no close guard: 1 failed
  - `resumed: true`: 2 failed
  - pairing not noted: 1 failed
  - lineage not stored: 3 failed
- First audit run: `node scripts/structure-audit.mjs` (Core root) printed "2 violation(s)", both in
  `connection.ts`:
  - `as never`: the subscription dispatcher cast the event `as never`. It now calls `handler(event)`
    without a cast.
  - `failure-as-empty`: an unreadable lineage was caught as `undefined`. It is now the fail-closed path
    described above.
- Final runs:
  - `npx tsc --noEmit -p tsconfig.json`: exit 0.
  - `node scripts/structure-audit.mjs`: "structure-audit: passed (409 warning(s), 1152 baselined)", exit
    0. Two of the warnings are in these files, both advisory: `class-methods` (the class has 32 methods
    against the 25 advisory threshold; the hard limit is 40) and `file-lines` (`tests/connection.test.ts`
    has 419 lines against the 400 advisory threshold; the hard limit is 800).

## Not verified

- Not run in a browser and no downstream caller uses it yet: W-E switches `GatewaySession` onto it.
- Not run: the package `build`, the whole package vitest suite beyond `src/connection`, and Core
  `pnpm check`.
- The barrel line is not added, so the class is not yet importable from `@fluxiq/client-gateway-websocket`.

## Open questions or contradictions found

- Existing behaviour kept: `send` writes to the socket whenever it is open, including while the socket
  is `pairing` or `connecting` before `session_ready`. During that window a send skips the outbox and
  goes ahead of the entries still queued, and Core refuses client data from an unpaired session. The
  same is true downstream. Gating `send` on `connected` would change behaviour, so it is left for the
  lead to decide.
- The class has 32 methods, counting private ones. That is past the audit's advisory threshold of 25 and
  under its limit of 40. If it grows, the queue methods (`send`, `queuedActionResult`, `flushQueue`,
  `removeQueuedRecordingEvent`, `refreshQueueSize`, `lineage`) are the natural collaborator to move out.
