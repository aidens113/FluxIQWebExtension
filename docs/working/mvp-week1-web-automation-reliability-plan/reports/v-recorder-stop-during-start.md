# `v-recorder-stop-during-start` — completion report

## Result

Implemented and validated the pending-start Stop owner. Stop no longer resolves
while a UI preflight, client handshake, or accepted server start can later
activate the recorder.

## State-machine rule

There is one synchronous `stopRequest` owner for every lifecycle operation a
Stop can close. A crossing Stop caller receives that owner's exact promise.

- A UI start carries a cancellation bit. Stop sets it synchronously, and UI
  preflight checks it after every await and at the final shared start gate. If
  no handshake exists, cancellation is entirely local and sends no false wire
  notification.
- Once a client handshake exists, Core may own its recording id. Stop cancels
  the handshake timers, drains its current send (including a detached retry,
  without inheriting a start rejection), and sends at most one matching
  `client.stop_recording` when the winning Stop requested notification.
- Once `starting` exists, the start is accepted. Stop fences ordinary events,
  waits for that exact start to finish, admits only its synchronous initial
  `browser.tab` marker, and then performs the existing navigation drain and
  teardown exactly once. Its end timestamp is taken after the required marker,
  rather than claiming the accepted recording ended before it started.
- Starts requested after `stopRequest` was installed capture and wait for that
  owner. The Stop does not capture those later starts in return, so the wait
  graph is one-way and a UI request queued behind an older Stop cannot deadlock.
- `server.start_recording` and refusals also respect `stopRequest`; a late
  acceptance of the stopped identity is ignored after teardown.

## Files changed

- `apps/extension/src/background/connection/active-recording.ts`
- `apps/extension/src/background/connection/tests/active-recording.test.ts`
- `apps/extension/src/background/connection/recording-start/handshake.ts`
- `apps/extension/src/background/connection/recording-start/tests/handshake.test.ts`
- generated `apps/extension/build/background/index.js` and source map (via the
  owning extension build)

The handshake now exposes `cancelAndDrain()`: it drops pending ownership and
timers synchronously, then waits only for the already-running send and absorbs
that start-path rejection.

## Coverage added

Added controlled lifecycle tests for:

- Stop during held UI evidence preflight, including concurrent Stop identity;
- Stop during a pending client handshake, one start/stop wire pair, timer
  cancellation, and ignored late acceptance;
- Stop during a held retry lookup, proving the detached retry start is ordered
  before its one matching close;
- Stop during accepted `persistSession` and `allTabs` awaits, preserving one
  initial marker and one stop notification;
- a UI start queued behind a Stop which itself waits on an accepted start;
- a rejected in-flight client-start send, whose failure does not strand or
  reject the Stop owner;
- a later Stop crossing UI work released behind an older Stop, proving the
  cycle is absent.

## Mutation evidence

Eight intentional mutations were each killed by the full extension suite and
then restored:

1. disabling the UI cancellation assignment: 2 failures;
2. omitting handshake cancellation: 1 failure;
3. omitting the accepted-start wait: 2 failures;
4. removing the initial-marker exception from the event fence: 2 failures;
5. allowing a start rejection to reject its Stop: 1 failure;
6. replacing the unified owner check with the later teardown phase: 2 failures;
7. making queued starts observe only that later teardown phase: 1 failure.
8. omitting the detached pending-send drain: 1 failure.

## Final validation

- `pnpm --dir apps/extension check` — passed.
- `EXTENSION_TEST_BUILD_LABEL=v-recorder-final pnpm --dir apps/extension test`
  — passed: extension smoke test and 512/512 unit tests.
- `pnpm --dir apps/extension build` — passed; tracked extension build
  regenerated.
- `git diff --check` — passed (only existing line-ending warnings were shown).

No browser/Lab run was requested for this state-machine unit. I did not edit
Core or shared working documents, and did not commit or push.
