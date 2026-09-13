# g-core-start-order: a client's start is ordered with what follows it (Core)

Worker report for the `g-core-start-order` brief in
[finish-week1.md](../briefs/finish-week1.md), 2026-09-13.

- **Core HEAD:** `0e6d3ac` when work began and `c0e0ce9` at the end. The newer
  commit is another worker's. None of my files were in it.
- **Line numbers:** unmarked Core lines are the working tree after this change.
- **Faulty RAM:** every result below is a single observation unless it says it
  was rerun.

## Outcome

**Done.** All three parts of the brief are built and tested:

- **C1:** a client's start is now ordered with the messages behind it.
- **C2:** Core acknowledges the start.
- **C3:** discards are named after the recording they belong to, and snapshot and
  state-update drops are now audited.

What was checked:

- **The bridge test file passes 20 of 20.** It has four new tests.
- **Seven mutations each fail the tests.** After every restore, bridge.ts was
  byte-identical.
- **Core `pnpm check` exits 0**, and so does **`pnpm docs:check`**.
- **No generated reference needed regenerating.** The class line and the other
  lines the generated reference cites did not move, so `pnpm docs:reference` was
  not needed.

**In plain terms.** When the extension asks Core to start a recording, Core has
to look up the operator's project and write the new recording before it can take
anything. Core's WebSocket host does not wait for that. Under load, the
extension's first messages reached the bridge while the recording did not exist
yet, and were thrown away.

Now the bridge notes the start the moment it sees it. Every later recording
message from the same client waits until that start finishes:

- **If the recording opens,** the messages go into it. Core then tells the
  extension "started" (`server.start_recording`), which it never did before for
  a start the extension asked for.
- **If the start is refused,** the waiting messages are thrown away, but each
  one is written to the audit log under the refused recording's id.

**Two additions beyond the brief's text, both needed so C2 does not break the
extension.** They are explained under "Beyond the brief" and are for the
supervisor to accept or reject:

1. No "started" is sent to a client that already sent Stop for that recording.
2. A state update that says `recording: false` is not audited.

## What changed and why

### `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts` (746 → 796 lines)

**C1: pending start per owner key.**

- **New state.** A new field, `pendingStarts` (`:98`), holds one
  `PendingClientStart` (`:751`) per owner key. A pending start is
  `{ recordingId, settled, stopRequested }`.
- **Registration.** `startRecordingFromClient` (`:266`) registers the pending
  start before its first await. If a start for the same client is already in
  flight, it waits for that one first. It then calls the original body, now
  named `openClientRecording` (`:294`).
  - The split avoided re-indenting 40 lines of `createRecording` arguments.
- **Clean-up.** In `finally`, the start does three things:
  - if the client has no open recording with this start's id (the start was
    refused or threw before opening), it remembers the refused recording
    (`:276`);
  - it removes its registration;
  - it releases every message that waited.
- **Where messages wait.** `handleGatewayEvent` waits at one point, `:208`, for
  every type except `session.ready`, `session.disconnected` and
  `client.action_result`. The bridge has no branch for those three, and they now
  return early. So all six branches the brief names wait before reading
  `activeRecordings`: entry, event, snapshot, state update, error and stop.
- **The wait itself.** `awaitClientStart` (`:287`) looks up the pending start
  synchronously. When there is none it returns without an await, so a client
  with no start in flight sees no timing change.
- **Why a refusal is judged by the open recording.** A throw *after* the
  recording opened, such as a failed acknowledgement send, must not mark a live
  recording as refused. So the check reads `activeRecordings` rather than
  whether the function threw.
- **Why the ordering holds in the real host.** `ClientGatewayEventBus.emit` calls
  its handlers synchronously (`client-gateway/service/event-bus.ts:12-14`), and
  `ClientGatewayInbound.receive` has no await before `emit` for these message
  types (`client-gateway/service/inbound.ts:45-96`). So a message handled after
  the start message sees the registration. This is a code read; the tests call
  `gateway.receive` directly.
- **The host is not serialized,** as the brief requires.

**C2: the acknowledgement.**

- After activation, `:343-345` builds the payload
  `{ recordingId, projectId, taskId?, domainId? }`. It then calls
  `this.gateway.startRecording(...)` in place of `markActiveRecording`.
- **Whether it does anything beyond marking and sending: no.**
  `ClientGatewayCommands.startRecording` (`client-gateway/service/commands.ts:39-44`)
  does the same `requireReady` and sets the same `activeRecordingId` and
  `projectId` as `markActiveRecording` (`:102-106`). It then calls
  `transport.send`, which pushes onto `session.outbound` and calls `socket.send`
  (`service/transport.ts:31-35`).
- **The only differences:**
  - it is async and awaited, so a socket send that throws now fails that start's
    receive, after the recording is open;
  - its payload also carries `taskId` and `domainId`;
  - it writes no audit entry.

**C3: louder discards.**

- **The message's own recording id.** `DiscardedClientMessage` gains
  `recordingId`. It is set from `client.recording_entry`'s
  `payload.recordingId` (`:219`) and from `client.recording_event`'s
  `recordingId` (`:384`). `noteDiscardedClientMessage` (`:488`) uses it ahead of
  the remembered recording's id.
  - `projectId` and `sinceFinalizedMs` go into the audit metadata only when the
    recording is the one the client last closed.
- **The summary text** (`:769`) gains a second wording: "Discarded … for
  recording X, which this client did not have open." It covers a refused start
  and a message that names another recording. The "N ms after recording X was
  finalized" wording is unchanged.
- **Snapshot drops** (`:560`) now go through `noteDiscardedClientMessage`.
  - The label is `client.<kind>_snapshot`.
  - They are evidence: reported once per recording, then counted.
- **State-update drops** (`:599`) go through it too, carrying their `domainId`
  and `inputId` so executability is judged. The exception is a state update
  that says `recording: false`.
- **Refused starts are remembered.** `rememberClosedRecording(…, finalized = false)`
  (`:455`) stores a refused start without `finalizedAt`.
- **Above the class, no line count changed.** The `ClosedClientRecording` comment
  lost one line to make room for the new field, so the class stays at `:91`. The
  other cited lines, `:18`, `:26`, `:30` and `:35`, are also unchanged. That is
  why the generated reference stayed current. Its two files were being changed by
  another worker's regeneration when I started.
- **Kept, because the brief's C3 does not list it:** the delete of the discard
  count when a recording opens (the design report's `:305`, now in
  `openClientRecording`). With C1, the start-window count it erased no longer
  builds up, except for messages sent before the start frame itself.

### Beyond the brief

**1. No acknowledgement after a Stop waited (`stopRequested`, `:287-291`, `:344`).**

- **The hazard.** The extension's `beginAccepted`
  (`apps/extension/src/background/connection/active-recording.ts:179-219`)
  starts a *new* local recording when `server.start_recording` arrives while it
  is idle: `resetLog`, `recordingState = "recording"`, then the start burst.
- **What would go wrong.** A user or runner that stops while Core is still
  opening would be restarted by a late "started". Core would have no recording
  for it, so every message after that would become a discard.
- **What the bridge does.** A `client.stop_recording` that waits on the start
  and names the same recording sets `stopRequested`. The start then only marks
  the session, as before.

**2. `recording: false` state updates are not audited.**

- **Why.** The extension sends page state whenever it is connected, recording or
  not (`active-page.ts:103-107`, and `browserStateFromTabs` at
  `browser-state.ts:47-50`). Auditing those would add an entry for every idle
  client.
- **The rule is protocol-level.** `ClientGatewayStateUpdate.recording?: boolean`
  is the client's own statement (contracts `client-gateway.ts:37-43`).

### `client-gateway/tests/bridge.test.ts` (564 → 711 lines)

**Helpers:**

- `clientStartInFlight(clientId, { refuse })` (`:653`) sends a real
  `client.start_recording` through `gateway.receive` without awaiting it, and
  holds the start at one of two points:
  - inside a spied `createRecording`, before the real call, so the recording
    does not exist yet;
  - with `refuse`, inside the project-context provider, which then refuses.
- It follows the held-finalization pattern from `g-core-late-event`.
- `clickFor(recordingId)` (`:632`) and `discardAudit(gateway)` (`:642`) are small
  helpers.

**Tests:**

| Line | Test | What it asserts |
| --- | --- | --- |
| `:461` | keeps what a client sends while Core is still opening its recording, and acknowledges the start once it is open | While held: no acknowledgement. After release and Stop: the timeline holds `action`, `client.state_snapshot` and `input.state`; no discards; exactly one `server.start_recording`, with the recording id, project and domain. |
| `:486` | discards what waited on a client start that Core refused, under the refused recording's id | The only server error is `recording.project_required`, and the recording does not exist. Audit is event (the state update, 1 event / 0 actions), then action (3 / 1), then action (4 / 2). Every entry carries the refused id, including a click that names no recording. The snapshot is counted between them. |
| `:512` | finalizes a start the client stopped while Core was still opening it, without telling the client to start | A 10 ms settle, then release. The Stop receive resolves, the recording is finalized, there is no `server.start_recording` and no server error. |
| `:528` | audits a snapshot and a state update that arrive after their recording closed, and names a message's own recording | A `recording: false` update adds no audit. A snapshot gives `event_discarded` "…ms after recording X was finalized". A `recording: true` update is counted. A click naming `recording.elsewhere` gives an action entry with that id and no `sinceFinalizedMs`. |

### `F:\!FluxIQ\docs\architecture\automation-studio\client-gateway.md`

- **New section at `:65-93`:** why start ordering lives in the bridge, which six
  message types wait, the acknowledgement and when it is withheld, the refused
  path, and why the host is not serialized. The `server.start_recording` bullet
  points to it.
- **`:112-121`:** snapshots and state updates are now counted, attribution is to
  the message's own recording first, and the `recording: false` exemption.
- **Removed:** "Snapshots and state updates that arrive after the recording is
  closed are dropped without being counted."
- **`:147`:** which fields a discard entry carries, and when.

## Compatibility effect on every gateway client

**No protocol type changed.** The wire change is one more server frame,
`server.start_recording`, now sent for a start the *client* asked for.

**FluxIQ Web Extension (code read, not run):**

- **How it reads the frame.** It reaches `server-command-channel.ts:128-129` and
  then `beginAccepted(recordingId, projectId)`.
- **Frame arrives within the 750 ms window.** `handshake.noteAccepted()` cancels
  the fallback, and recording begins only after Core opened the recording. The
  start burst no longer lands in the window. This is the intended effect.
- **Frame arrives after the fallback.** `beginAccepted` sees `"recording"` and
  returns, with two side effects:
  - it writes `projectId` into the stored session (`:181-183`), once per
    recording;
  - if the fallback linked no project, or a different one, it links Core's and
    sends **one extra `client.snapshot`**, "Project-linked snapshot captured"
    (`:184-188`). That adds one observation entry, which matters for the Lab's
    entry recount.
- **Still open: a Stop crossing the frame on the wire.** Core now withholds the
  frame when the Stop reached Core first. It cannot do so when the extension
  stops *after* Core sent the frame but before it arrived. The frame then lands
  while the extension is idle and restarts a local recording Core does not have.
  - The window is one localhost hop.
  - It needs an extension guard: ignore `server.start_recording` for a recording
    id this extension already stopped, in `active-recording.ts` `beginAccepted`
    or `server-command-channel.ts`.
- **The runner's assumption becomes partly true.** The comment at
  `packages/test-runner/src/run-scenario.ts:262` ("answers before Core accepts")
  now holds only when the acknowledgement beats the fallback. Seeing the
  extension recording still does not prove Core accepted.

**The test-runner's discard reader (`flow-lane/recording-discards.ts`):**

- **It now sees start-window drops.** They carry a `recordingId`: the message's
  own for recording events, or the refused start's.
- **New entries alone will not fail a run.** It fails a run only on
  `action_discarded`, or on an entry whose `discardedActions` is above 0
  (`:76`). Newly audited evidence-only entries are counted, not failed.
- **What T2 would still catch.** Its session-id check would cover drops with no
  recording to name: a snapshot sent before a client's *first* start frame.

**`@fluxiq/client-gateway-websocket` users of
`FluxIQAutomationStudioWebSocketClient.createRecording`
(`packages/client-gateway-websocket/src/automation-studio.ts:39-52`):**

- They now receive a `start_recording` event (`src/transport.ts:140`) after their
  own start.
- A consumer that treats every `start_recording` as "begin" must now handle a
  repeat for the recording it already started.
- The integration page's recording flow
  (`docs/integrations/client-gateway-websocket.md:340-346`, "FluxIQ creates the
  recording there, marks the client session as recording") is now incomplete.
  I did not own it.

**Other callers:**

- **`apps/web/scripts/mock-client.mjs`:** unaffected. It never sends
  `client.start_recording`, and its `server.start_recording` handler (`:51-58`)
  only runs for panel-initiated starts, as before.
- **Web panel starts (`bridge.startRecording`, `:120-173`):** unchanged. They
  already sent `server.start_recording` and do not register a pending start.
- **In-process callers of `gateway.receive`:** a recording message from a client
  whose start is still in flight now resolves only after that start settles.
- **Operators reading the audit log:**
  - they see new evidence entries for snapshots and state updates with no open
    recording;
  - `recordingId` now prefers the message's own id;
  - there is the new "which this client did not have open" wording.

## Commands run and observed results

All commands ran from `F:\!FluxIQ`, with exits captured by redirecting to
scratch files, never through a pipe. Scratch files are prefixed
`g-core-start-order-`.

1. **First test run.**
   `npx vitest run packages/fluxiq/src/programs/automation-studio/client-gateway/tests/bridge.test.ts --no-file-parallelism`
   → exit 1, `Tests 1 failed | 19 passed (20)`.
   - The refused-start test got `[ 'recording.action_discarded', 'recording.action_discarded' ]`
     where I expected an `event_discarded` between the two.
   - **The code was right; my expectation was wrong.** An action's audit also
     sets `reported` (`if (closed.reported && !executable) return;`), so evidence
     discarded after an action is counted but gets no entry of its own. That
     rule is older than this change.
   - I reordered the waiting messages so the state update comes first.
2. **Second run** (same command) → exit 0, `Tests 20 passed (20)`.
3. **Mutation proofs** (`node g-core-start-order-mutations.mjs`). Each replaces
   one unique substring in bridge.ts, runs the file, and restores the original
   bytes. Original SHA-1 `d5e9989d10ad6ac84d6c1de53a59c404f77d2ad5`, and
   `restored … identical` after every mutation.

   | Mutation | Exit | Failure quoted |
   | --- | --- | --- |
   | M1: `await this.awaitClientStart(` → `void this.awaitClientStart(` (remove the pending-start await) | 1 | `3 failed \| 17 passed`, `Errors 1 error`. `× keeps what a client sends…` `→ expected [] to deeply equal [ 'action', …(2) ]`, the probe's 0-entry shape. `× discards what waited…` `→ expected 'Discarded a client state update (clie…' to contain 'recording recording.extension.refused…'`. `× finalizes a start the client stopped…` `→ promise rejected "Error: Unknown Automation Studio recordin… { …(4) }" instead of resolving`, plus an Unhandled Rejection. |
   | M2: `else await this.gateway.startRecording(…accepted)` → `else this.gateway.markActiveRecording(…accepted)` (remove the acknowledgement) | 1 | `1 failed \| 19 passed`. `× keeps what a client sends…` `→ expected [] to have a length of 1 but got +0` |
   | M3: `if (pending.stopRequested)` → `if (false)` (acknowledge after a Stop waited) | 1 | `1 failed \| 19 passed`. `× finalizes a start the client stopped…` `→ expected [ 'server.pairing_required', …(2) ] to not include 'server.start_recording'` |
   | M4: the snapshot drop call → `return void ({ kind: "snapshot" …})` (silent again) | 1 | `2 failed \| 18 passed`. `× discards what waited…` `→ expected { …(11) } to match object { …(4) }`; `× audits a snapshot…` `→ expected { …(11) } to match object { …(3) }` |
   | M5: `discarded.recordingId ?? closed.recordingId` → `closed.recordingId` | 1 | `1 failed \| 19 passed`. `× audits a snapshot…` `→ expected 'Discarded an executable action (dom.c…' to contain 'recording recording.elsewhere, which …'` |
   | M6: `!== input.recordingId)` → `!== input.recordingId && false)` (do not remember a refused start) | 1 | `1 failed \| 19 passed`. `× discards what waited…` `→ expected 'Discarded a client state update (clie…' to contain 'recording recording.extension.refused…'` |
   | M7: `if (stateUpdate.recording !== false)` → `if (true)` | 1 | `1 failed \| 19 passed`. `× audits a snapshot…` `→ expected [ { …(6) } ] to deeply equal []` |

   - **About the M1 row.** M1's first run failed only 2 tests: the stop test
     passed, because `release()` came right after the Stop. I added the 10 ms
     settle to that test. The table shows the rerun after the settle.
   - **About the M3 row.** M3 was also rerun after the settle, with the same
     result as its first run.
4. **Third run**, after the settle → exit 0, `Tests 20 passed (20)`.
5. **`pnpm check`** → exit 0.
   - `structure-audit: passed (121 warning(s), 256 baselined).`
   - `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq`
     and `apps/web` each printed `check: Done`.
   - Advisory warnings on my files:
     - `[class-methods] … AutomationStudioClientGatewayBridge has 26 methods, past the 25-method advisory threshold`
       (new: `awaitClientStart` and `openClientRecording`);
     - `bridge.ts: 796 lines` and `bridge.test.ts: 711 lines` are past the
       400-line advisory threshold.
6. **`pnpm docs:check`** → exit 0.
   `Validated local links in 100 authored/reference Markdown files.`
   `Deterministic framework reference is current.`
7. **Line endings.** A count of lines and carriage returns showed bridge.ts
   796/796 and the test 708/708 before the settle edit, and the doc 279/279. The
   files stay CRLF throughout.
8. **`git status --short` (Core), at the end.**
   - My three files are modified.
   - Also modified, by other workers and untouched by me:
     - `nodes/policy/expectation.ts` and `nodes/policy/index.ts`;
     - `runtime/executor/transition-comparison.ts` and its test;
     - `runtime/service/recordings/proposal-candidates.ts` and its test.
   - `pnpm check` passed with them present.

## Not verified

**Live behavior.** No Lab run and no Core build, by rule. The Lab runs the old
bridge until the supervisor builds Core. Run the report's step 4b Lab proof under
two-instance load: 24 runs of `basic-form --flow --target isolated` in a
commit with this change. It must show, in every run:

- `exit=0` and `candidateCount` 4;
- `runtime.settle.recordings[0].entryCount` at the no-loss count, never 10, 6, 5
  or 0. Recount it at the fix commit: the explained-navigation event, and the
  project-link snapshot when the fallback won, can each add one;
- zero `recording.action_discarded` for the run's recording, and no
  `gateway.receive_failed` server errors;
- the extension not back in `recording` after Stop (`fluxiq.getStatus`), which
  would be the wire-crossing restart above.

In the same window:

- W18 ×3, whose Flows start with the username type;
- W25 ×3, whose proposals include `begin-delay`;
- smoke W01 recording-lane runs, at the full entry count.

**Also not verified:**

- **The extension's handling of the new frame.** Code read only; no extension
  test was added or run.
- **The real host's ordering into the bridge.** Code read; the tests drive
  `gateway.receive`.
- **No pre-edit baseline of the test file.** The 16 existing tests pass after
  the change, and M1/M2 stand in for the pre-fix behavior.
- **Other Core test files.** Root `pnpm test` was not run (forbidden), nor the
  `apps/web` or `client-gateway-websocket` tests.
- **Untested paths:**
  - two starts in flight for one client (chained);
  - a throw after the recording opened;
  - a Stop crossing the acknowledgement on the wire.
- **Messages that leave the extension before its start frame** (the E1 hazard).
  Core cannot order what it has not received. Recording events among them are
  now named by their own id. A snapshot among them is attributed to the client's
  previous closed recording, or to none. That misattribution is possible and
  untested.

## Open questions or contradictions found

1. **Two additions beyond the brief:** withholding the acknowledgement after a
   Stop, and exempting `recording: false` state updates. The reasons are above.
   The supervisor should accept or reject both.
2. **The extension needs a guard** against a stale `server.start_recording` for a
   recording it already stopped (`active-recording.ts` `beginAccepted`). That is
   not the E1 file `handshake.ts`, so `f-recording-start-send` may not cover it.
3. **`docs/integrations/client-gateway-websocket.md:340-346` is stale** after
   C2. It needs one sentence, and it is outside my files.
4. **A Stop after a refused start still fails** (older than this change). Stop
   calls `finalizeRecording` for a recording that was never created, so the
   receive fails and the host answers `gateway.receive_failed`. The extension
   marks its connection as `error` on that. The Stop now at least waits for the
   refusal. Whether a Stop naming a refused start should be discarded quietly was
   not decided here.
5. **The Lab's no-loss entry count may change by one** in runs where the fallback
   had no project and the acknowledgement links one.
6. **The bridge class is at 26 methods** against a 25-method advisory, and the
   file is at 796 of 800 lines. The next change to this file should move a group
   of methods onto a collaborator. The discard accounting is the obvious one:
   `noteDiscardedClientMessage`, `rememberClosedRecording`, `appendOrDiscard` and
   `isFinalized`.
7. **Structure:** no baseline entry needs to change. There are no new imports,
   files or exports.
