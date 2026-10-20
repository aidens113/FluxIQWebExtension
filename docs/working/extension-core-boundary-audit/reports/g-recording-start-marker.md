# g-recording-start-marker: why the start marker never crossed as `client.recording_event`

Brief: g-recording-start-marker (read-only investigation). Worktree `fxwork/t726/!FluxIQWebExtension`
(branch `task/t726-gateway-client-into-core`) and its Core `fxwork/t726/!FluxIQ`. No edits except this report.

## Outcome

Done. Verdict: **by design.** The recording-start marker (`browser.tab`, `metadata.recordingState: "started"`)
is passive evidence. The extension sends it to the gateway as a `client.state_update` (reason
`recording-evidence`), never as a `client.recording_event`. The domain contract and an existing unit test both
say so. Lane G did not change anything on this path, and real Core neither needs nor reads a start marker: it
opens a server-started recording itself, before it sends `server.start_recording`. The headed spec did not see
the marker because it looked only at `client.recording_event`, and its socket comparisons leave out
`client.state_update`.

## What changed and why

Nothing in source. This report is the only file written.

## Trace (server-started path)

1. Core `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts` `startRecording` (line 121):
   it calls `automationStudio.createRecording(...)` (line 131), then
   `this.activeRecordings.set(ownerKey, { projectId, recordingId, domainId })` (line 170), and only then
   `this.gateway.startRecording(session.sessionId, ...)` (line 172). That last call sends
   `server.start_recording` (`client-gateway/service/commands.ts:71`). The recording exists in Core before the
   client hears about it.
2. Extension `background/connection/gateway-session.ts:112` turns `start_recording` into an `onCommand` call.
   `server-command-channel.ts:178` then calls `recording.beginAccepted(recordingId, projectId)`.
3. `active-recording.ts` `beginAccepted`: `expectsStart` passes when nothing else is in flight. It then runs
   `beginOnce` and `startRecording`. `startRecording` (around lines 412-452) sets the state to `recording`,
   attaches the tab and sends browser state. It then emits the marker through `deps.recordEvent({ kind:
   "browser.tab", ..., metadata: { recordingState: "started", recordingId } })`, with no `tab` field and no
   tabId. The user-started path takes exactly the same route: a handshake acceptance or a local fallback both
   reach `beginOnce` and then `startRecording`. So the marker looks the same in both paths.
4. `connection.ts` `handleRecordingEvent` passes it to `recorded-event-intake.ts` `accept`, then `processEvent`.
   `isExecutableRecordedAction(payload)` comes from `recordedInputId` in `gateway-payloads.ts`, which calls the
   domain function `webAutomationInputIdForRecordedEvent`. For `browser.tab` that reaches
   `domain/src/io/input-model.ts` `recordedTabInputId`, which returns undefined unless `payload.tab.operation` is
   `switch` or `close`. Its contract comment says:
   > "A tab switch or close the user made. Only an entry carrying `tab` is one: the recording-start marker is
   > stored under the same event type with no `tab`, and must stay evidence."
5. The event is not executable and is not an explained navigation, so `processEvent` sends no
   `client.recording_event`. It goes to `recording-evidence.ts` `sendRecordingEvidence`. With no tabId, and with
   `shouldRequireStateForEvidence` false for `browser.tab`, no DOM snapshot is taken. The function then sends
   `client.state_update` with metadata `{ reason: "recording-evidence", inputId: recordingEvidence, clientKind:
   "browser.tab", ..., recordingState: "started", recordingId }`. Project resolution does not stall: a
   server-started recording carries `projectId`, so `ProjectContext.resolve` returns the active recording
   project straight away.
6. The send goes through `gateway.send`. When connected, it is sent live. When offline, it is queued with the
   same `queueContext` binding as every other message. Nothing in the outbox, the lineage binding or the Core
   connection's queue-until-session_ready rule tells message types apart, so none of them drop this one. Not
   observed: the stand-in records every client message, but the spec never asserted on this one.

## What real Core expects

- Core's inbound gateway (`client-gateway/service/inbound.ts:76-96`) emits `client.state_update` and
  `client.recording_event` as separate events. The bridge's `storeClientMessage` sends a state update to
  `appendStateUpdate` (bridge.ts around line 637). For the active recording, a message with a `domainId` and an
  `inputId` is recorded as a gateway input (`recordGatewayInput`); otherwise it is stored as a
  `client.state_update` observation. Either way the marker lands in the recording's timeline as evidence.
- A recursive grep of Core `packages/` and `apps/` (excluding tests, dist and `.d.ts`) finds `recordingState`
  only in `RecordingStateIndexStore` code (`runtime/service.ts`, `recordings/deletion.ts`), which is an
  unrelated index of recorded states. No Core code reads a start marker, and no code makes opening or accepting
  a recording depend on one. A server-started recording is active in `activeRecordings` before the client
  starts. A client-started one is opened by `client.start_recording` (`startRecordingFromClient` and then
  `openClientRecording`), not by a marker.

## Did lane G introduce it?

No. `git diff --stat dev --` over `active-recording.ts`, `recorded-event-intake.ts`, `recording-evidence.ts`,
`gateway-payloads.ts`, `recorded-event.ts`, `domain/src/io/input-model.ts`, `server-command-channel.ts`,
`connection.ts` and `gateway-session.ts` lists only `connection.ts`, `gateway-session.ts` and
`server-command-channel.ts`. Their recording-related hunks are the outbox swap: `extensionOutboxStore`,
`queueContext`, and `removeQueuedRecordingEvent` moving onto the gateway. None of them touches the start path,
the marker, or how an event is classified. On `dev`, the marker is already evidence, and existing tests pin it:
- `apps/extension/src/background/connection/tests/recorded-event-intake.test.ts:445` ("...the recording-start
  marker is neither"): `assert.equal(h.sent.length, 0, "the marker is evidence")`, and the marker shows up in
  `evidenceKinds`.
- `apps/extension/src/background/connection/tests/gateway-payloads.test.ts:322`: `recordedInputId` of the
  marker is `undefined`.

## Commands run and observed results

- `grep` and `sed` reads over the files above. `git diff --stat dev -- <nine files>` printed 3 files changed:
  `connection.ts` (32), `gateway-session.ts` (490), `server-command-channel.ts` (44).
- `git diff dev -- server-command-channel.ts connection.ts | grep -i record|state_update|queueContext|start`
  showed only the outbox and in-flight refactor hunks.
- No builds, tests or browser runs (read-only brief).

## Not verified

- I did not see live that the marker reached the stand-in as `client.state_update` in the headed run. The
  conclusion comes from the code path and the unit tests. The spec's message log would show it if it asserted on
  `client.state_update` entries where `metadata.recordingState === "started"`.
- I did not run Core against a real gateway session.

## Open questions or contradictions found

- None against the contract. A suggestion for the spec owner, not a defect: if the start marker should be part
  of the browser oracle, wait for a `client.state_update` whose `metadata.clientKind` is `browser.tab` and whose
  `recordingState` is `started`, not for a `client.recording_event`. Then correct the lane-g.md and
  lane-g-wi-browser-exercise.md observation to say the marker crosses as a state update.
