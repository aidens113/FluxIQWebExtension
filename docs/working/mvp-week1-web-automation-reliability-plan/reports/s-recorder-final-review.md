# `s-recorder-final-review` — final read-only lifecycle audit

## Decision

**Not accepted yet.** The original stop-token ordering defect is fixed, including
rejected stops, but one duplicate-start race remains when a UI start and a new
server start are released by the same completed stop.

## Finding — UI and server starts can both win after the stop wait

**Severity:** high

**Files/lines:** `apps/extension/src/background/connection/active-recording.ts:177-205`
checks `handshake.isPending()` only before two asynchronous UI preflight steps
(`page.refresh` and `buildInitialRecordingState`). `beginAccepted()` at
lines 277-284 independently passes the stop wait and can install `starting`
during either await. The UI path never rechecks `starting`, recording state, or
the handshake immediately before `handshake.begin()`.

**Concrete path:** while an old stop is held, call `start()` and
`beginAccepted("server-new")`. Both capture and await that stop. After release,
the UI continuation passes its one handshake check and yields in page/evidence
preflight. The server continuation enters `beginOnce` and marks a server start
under way. The UI continuation then calls `handshake.begin()` for a different
client-generated ID and sends a second start request. Locally `beginOnce` may
still prevent two active recording states, but Core has received a duplicate /
competing start and the winning identity depends on acknowledgement timing.
The simultaneous-UI test covers two calls to `start()`, and the held-send test
covers one server acceptance; neither crosses UI and server starts together.

**Correction:** arbitrate both start sources through one lifecycle gate, or at
minimum recheck/await `starting` and recheck `recordingState`/handshake after the
last asynchronous UI preflight and immediately before `handshake.begin()`.
Define which source wins once and ensure the loser sends no second start. Add a
held-stop test that releases simultaneous UI and distinct server starts and
asserts one protocol start decision, one generation, and one initial
`browser.tab` identity.

## Rechecked properties

- Stop token clearing now occurs before public resolve/reject.
- `settleCapturedStop` tolerates stop rejection only after teardown.
- Simultaneous UI calls share `uiStart`.
- A lone new server start waits for stop settlement and keeps its initial event.
- Refusal cannot mutate an active stop.
- Old-generation navigation is drained before a new generation can start in the
  individually tested UI and server paths.
- No new stop-settlement deadlock was found.

I read only the two requested reports, final `active-recording.ts`, and its
changed focused tests. I ran no build and changed no product, test, shared-doc,
generated, Core, commit, or remote state. This report is the only file written.
