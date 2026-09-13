# i-recording-loss: where recording entries go missing under load

Worker report for the `i-recording-loss` brief in
[finish-week1.md](../briefs/finish-week1.md), 2026-09-13. Read-only in both
repositories.

- **Stage 1 code:** this repository at `16ff729` (worktree
  `F:\fxlab\fxlab-16ff729`) and Core at `267a2ca` (worktree `F:\fxlab\!FluxIQ`).
  Unmarked file:line references are at those commits.
- **HEAD while I worked:** this repository moved from `1d7d1ab` to `12de09e`, and
  Core was at `0e6d3ac` with a clean `git status`.
- **Evidence:** the bundles under `F:\fxlab-runs\stage1\`.
- **Scratch files:** my two scratch scripts and their output are in the session
  scratchpad, prefixed `i-recording-loss-`.

This machine has faulty RAM. Every probe result below is a single observation.

## Outcome

**Done.** Entries are lost at the **start** of the recording, not near Stop.

**The window.** When the extension starts a recording, Core does two things before
it treats the recording as open:

1. it resolves the operator's project context;
2. it writes the new recording to its store (`createRecording`).

During that window, Core throws away every recording message it handles from the
extension.

**Why messages land in the window at all.** Two facts put the extension's
messages there:

- **Core never tells the extension it accepted the start**, so the extension
  always falls back to recording on its own after 750 ms.
- **Core's WebSocket host handles the messages from one socket concurrently**, not
  in the order they arrived.

**Why load matters.** Under load `createRecording` is slow, so the window grows.
It swallows first the extension's opening messages, then the user's first
actions, and finally the whole recording.

**The loss always takes the earliest actions and keeps the latest.** The bundles
show this directly:

- **W18 runs 2 and 3:** the Flow's first node types into `#password`, and the
  username entry that came before it is missing.
- **W25 run 3:** the only candidate is the *last* click (`late-action`), and the
  first click (`begin-delay`) is missing.
- **Nine step 4b runs:** the 2-candidate Flows keep the submit click (the last
  action) and lose the select (the second).

A loss near Stop would do the opposite and take the last actions first.

**Absent in passing runs.** Step 4b runs 1, 2, 22, 23 and the rerun of 12 hold all
13 entries. Run 22 is the useful contrast: Core appended 8 of its 13 entries
*after* the runner's first post-Stop poll, and nothing was lost. Slowness at the
end of a recording is harmless. Only slowness at the start loses entries.

**Reproduced with Core's own bridge code.** The pinned Core's built bridge, driven
concurrently the way the host drives it, gave (single observation each):

| Core's `createRecording` delay | Entries kept (of 8) |
| --- | --- |
| 50 ms | 8 |
| 450 ms | 3, the latest ones |
| 1000 ms | 0, and the recording still finalized |

The same 1000 ms delay with messages handled in order kept all 8.

**Not found in the Stage 1 evidence:**

- Core's `267a2ca` discard, which applies only after finalization. The start-window
  drops predate it.
- Interference between the two instances, other than shared machine load. The two
  instances ran separate Cores on separate ports. Their coinciding failures started
  their recordings within 1.3 s and 73 ms of each other, which fits one load spike
  slowing both Cores.

**The report's contradiction is two different waits, not a disagreement.** See
"The entries appended after Stop" below.

**Nothing committed since `16ff729` and `267a2ca` changes the cause.** HEAD's
runner now fails step 4b's short Flows earlier, as `recording.contract`. The
recording lane still passes an empty recording, and HEAD's discard-audit reader
still cannot see these drops. See "What HEAD changes".

**A consequence nobody had noticed.** Smoke gate 5.0's "4 of 4 passed" includes
both W01 `basic-form` recording-lane runs, and each stored a recording with **0
entries**:

- `F:\fxlab-runs\stage1\b\run-mtzi455h-b711dfcf`
- `F:\fxlab-runs\stage1\b\run-mtzi64iy-844650cc`

The recording lane cannot see this loss at all.

### The coordinator's lead from `i-stage1-failures`: confirmed, with three corrections

The lead, passed on in the coordinator's message and not read from that report:

- in partial losses the missing entry is always the earliest action;
- the runner waits only for the extension's local `recordingState`
  (`run-scenario.ts:261-268`);
- the extension starts locally when Core has not answered within 750 ms
  (`handshake.ts:7-10`, `:28`);
- so under load the first entries may be sent before Core's recording exists.

**Confirmed: the loss is at the head.** The bundles name what survived in W18
runs 2 and 3 and W25 run 3 (table below). The lead's W24 detail, that the
employee-name type was lost, is taken from the lead; I did not establish it.

**Correction 1: the fallback fires in every run, not only under load.** Core sends
no acceptance for a start the extension asked for. `server.start_recording` is
sent only by `commands.ts:39-44`, on Core's own start path; the client path calls
`markActiveRecording`, which sends nothing. So `handshake.ts:149-155` fires every
time. Waiting for Core's acceptance, in the runner or the extension, would wait
forever. Load does not trigger the fallback; it lengthens Core's
`createRecording`.

**Correction 2: sending before the recording exists is not the whole mechanism.**
Even a message sent *after* `client.start_recording` is lost, because Core's host
handles a socket's messages concurrently (`client-gateway-websocket.ts:179`) and
the bridge opens the recording only after `createRecording` returns
(`bridge.ts:271`, `:304`). The probe separates the two causes: with a 1000 ms
start, concurrent handling kept 0 of 8 entries and in-order handling kept 8 of 8.
A fix only in the runner or extension wait therefore cannot close this. The
extension-only case, messages leaving before the start message itself, is the E1
hazard, and it is a code read, not observed.

**Correction 3: whole-recording losses.**

- W18 run 1 and W25 run 2 kept 0 entries.
- W25 run 1 kept **1** entry (`observation: 1`) and no action.
- Add step 4b runs 3 and 13-16, and both smoke-bench W01 runs, which passed with 0.

**What the timestamps can and cannot show.**

- **They show** the earliest action lost and a later one kept. In W18 run 2
  (recording start 07:22:26.513Z), the username type at 27.738 is gone and the
  password type at 28.016 is the Flow's first node. In W25 run 3 (07:36:14.263Z),
  the `begin-delay` click at 16.272 is gone and the `late-action` click at 16.625
  is kept.
- **They show** the extension did not start earlier in losing runs. Recording start
  to first action was 1161-1285 ms in passing step 4b runs and 1199-1423 ms in
  failing ones.
- **They cannot show** when Core opened the recording, because nothing in a bundle
  timestamps it. The passing contrast is structural instead:
  - run 1 kept all 13 entries, with its first action 1161 ms after start, in the
    same range as losing runs;
  - run 22 kept all 13 while Core appended 8 of them after the runner's first
    post-Stop poll.

## What changed and why

No tracked file in either repository was edited, and no Lab command was run.

I wrote only these files:

- this report;
- two scratch scripts in the session scratchpad:
  - `i-recording-loss-timing.mjs` reads every Stage 1 bundle's `events.ndjson`,
    `run.json` and `snapshots/flow-lane.json`, and prints one row per run;
  - `i-recording-loss-probe.mjs` imports the pinned Core's built bridge
    (`F:\fxlab\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\client-gateway\bridge.js`)
    and drives it with in-memory fakes;
- their outputs, `i-recording-loss-timing.tsv` and `i-recording-loss-probe.out`.

### The mechanism, in order, with file:line

**1. The extension starts a recording and never hears back.**

- `ActiveRecording.start()` mints the id `client.<clientId>.<Date.now()>`
  (`apps/extension/src/background/connection/active-recording.ts:138`). That
  number is the recording's start time in every bundle. Then `start()` builds the
  initial state (`:140`) and begins the handshake (`:145`).
- The handshake arms its 750 ms acceptance timer (`recording-start/handshake.ts:28`,
  `:137`) *before* the send. The send first awaits `projects.resolve`
  (`active-recording.ts:236`), which can be an HTTP lookup against Core
  (`project-context.ts:39-55`, `core-api.ts:39`). Then it sends
  `client.start_recording`.
- The extension treats the start as accepted only on `server.start_recording`:
  - `server-command-channel.ts:128-129`;
  - fed by `gateway-session.ts:273`;
  - fed by Core's client library, `packages/client-gateway-websocket/src/transport.ts:140`.
- **Core never sends that message for a start the extension asked for.** Its only
  sender is `ClientGatewayCommands.startRecording`
  (`packages/fluxiq/src/client-gateway/service/commands.ts:39-44`). That is
  reached only from Core's own start path (`bridge.ts:166`). The client path calls
  `markActiveRecording` instead (`bridge.ts:306`), and that only sets two fields
  (`commands.ts:102-106`).
- So the timer always fires: `handshake.ts:149-155` calls `beginWithoutAcceptance`
  (`active-recording.ts:280-282`). That calls `beginAccepted`, which sets
  `recordingState = "recording"` (`:200`) and immediately sends the **start burst**:
  - browser state (`:209`);
  - the `browser.tab` event, whose evidence goes out (`:210-217`);
  - the initial snapshot (`:218`, via `recording-evidence.ts:212-213`).
- The runner waits only for the extension's own `recordingState === "recording"`
  (`packages/test-runner/src/run-scenario.ts:263`, polled every 100 ms at `:519`).
  Then it runs the script (`:271`). Its comment at `:262`, "startRecording answers
  before Core accepts the recording", assumes that state means Core has accepted.
  It never does for this path.

**2. The extension sends each action in order on one socket.**

- Each executable action goes through `RecordedEventIntake.processEvent`:
  1. a snapshot capture (`recorded-event-intake.ts:125`);
  2. `client.recording_event` (`:127`);
  3. its evidence, either `client.snapshot` (`recording-evidence.ts:138`) or
     `client.state_update` (`:156`).
- `GatewaySession.send` (`gateway-session.ts:183-186`) calls the client library's
  `send`, which does a plain `socket.send` (`transport.ts:84-86`). Order on the
  wire is preserved.

**3. Core's host does not preserve that order.**

- `NativeWebSocketConnection.acceptData` calls `void this.handleFrame(frame)` for
  every frame (`apps/web/src/server/client-gateway-websocket.ts:179`). Each message
  then runs `gateway.receiveRaw` (`:134-139`) → `ClientGatewayInbound.receive`
  (`client-gateway/service/inbound.ts:45-96`) → `ClientGatewayEventBus.emit`
  (`event-bus.ts:12-14`) → the bridge.
- Nothing waits for the previous message. A slow `client.start_recording` does not
  hold back the messages behind it.

**4. The bridge opens the recording only after two awaits.**

- `startRecordingFromClient` (`packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts:258-308`)
  first awaits `resolveClientRecordingContext` (`:259`), then
  `automationStudio.createRecording` (`:271`).
- `createRecording` writes the session to the store and then to the project
  (`runtime/service.ts:984-996`, `:990`, `:992`). Only after both does the bridge
  run `this.activeRecordings.set(...)` (`:304`).

**5. Every message handled before `:304` is thrown away.**

- **`client.recording_event`** (`bridge.ts:336-348`): with no active recording it
  is passed to `noteDiscardedClientMessage` (`:439-467`).
  - The resulting audit entry carries **no `recordingId`**, because no recording
    was ever closed for this client. It reads "arrived while this client had no
    recording open" (`:727`).
  - A non-executable message is audited only once (`:446`).
  - When the start finally completes, `:305` deletes the discard count.
- **`client.snapshot`** returns silently (`:517-518`). No audit entry, no count.
- **`client.state_update`** returns silently (`:554-555`). No audit entry, no count.
- **`client.recording_entry`** is discarded (`:218-220`).
- These branches predate `267a2ca`:
  `git show 267a2ca~1:…/bridge.ts | grep "if (!active)"` prints `:205`, `:332`,
  `:469` and `:504`.

**6. Stop keeps everything already in flight.**

- `stopRecordingFromClient` (`bridge.ts:316-334`) waits 250 ms, flushes, and
  finalizes under the recording mutation lock.
- That lock is a first-in-first-out promise chain (`runtime/service/locks.ts:15-31`).
  So appends queued before finalization land before it. That is why slow appends
  at the end of a recording, as in run 22, lose nothing.

**7. The runner accepts a short recording on the recording lane.**

- `awaitFinalizedRecording` waits for `endedAt` and reads the entry count from
  Core's summary (`flow-lane/finalized-recording.ts:143-171`). It does not check
  that count against anything.
- A short recording therefore fails only through the Flow lane's action
  expectations. The recording lane passes with 0 entries, as smoke gate 5.0's two
  W01 runs show.

### The evidence in the bundles

`i-recording-loss-timing.mjs` printed one row per run (exit 0). The columns used
below:

- **start**: the recording id's millisecond timestamp;
- **first action**: `run.json` `steps[0].startedAt` minus start;
- **entries**: `runtime.settle` → `recordings[0]` as
  `entryCount / entriesAppendedAfterStop / finalizationWaitMs`.

**Losing runs, with the survivor named by the bundle itself:**

| Run | Recording start (Z) | Script order and times | What Core kept | Entries |
| --- | --- | --- | --- | --- |
| W18 run 2, `b\run-mtzhk4a3-3dba04fe` | 07:22:26.513 | username type 27.738, password type 28.016, submit 28.182 | The Flow's first node is `#password` type (`flow-lane.json` failure `expected`); the username type is missing | 12 / 7 / 5596 |
| W18 run 3, `b\run-mtzhlxiu-4b7622fa` | 07:23:57.332 | username 58.573, password 58.747, submit 58.896 | The same `#password` first node | 12 / 7 / 5171 |
| W25 run 3, `b\run-mtzi1vgu-d40300bd` | 07:36:14.263 | `begin-delay` click 16.272, `late-action` click 16.625 | The only candidate is the `late-action` click (the last); `begin-delay` is missing | 3 / 0 / 3181 |
| Step 4b run 4, `a\run-mtzhk2zd-6a6b4624` | 07:22:26.586 | name type, select, notes type, submit | `web.dom.type`, `web.dom.click`; the select is missing | 5 / 3 / 2491 |
| Step 4b run 3, `a\run-mtzhijv8-41c92075` | 07:21:15.545 | as above | nothing | 0 / 0 / 1131 |
| W18 run 1, `b\run-mtzhikvr-07c3f403` | 07:21:16.805 | as W18 above | nothing, while the extension counted 5 events | 0 / 0 / 1210 |

Step 4b runs 6-11, 17 and 18 have the same 2-candidate shape as run 4, at 5 or 6
entries. Runs 13-16 have run 3's 0-entry shape. W24 runs 1 and 3 kept 2 of 3
actions (6 entries) and run 2 kept 3 (8 entries); the bundle does not say which
type was lost. W25 runs 1 and 2 kept 1 and 0 entries.

**Passing runs, with no loss:** step 4b run 1 (`run-mtzhfmkz-d780a9db`, 13 / 0 /
1480), run 2 (13 / 3 / 1501), run 22 (`run-mtzifeba-c96a149b`, **13 / 8 / 2146**),
run 23 (13 / 0 / 1524) and the rerun of 12 (13 / 6 / 1513).

**The extension did not behave differently in losing runs.**

- Recording start to first user action in step 4b:
  - passing runs: 1161, 1167, 1238, 1182, 1285, 1243, 1254, 1245, 1211 and 1222 ms;
  - failing runs: 1199-1423 ms.
- The extension started recording just as early in both. The variable is how long
  Core took to open the recording.

**Entry counts fall into a few fixed sizes, never a spread.**

Step 4b Core recordings held only 13, 10, 6, 5 or 0 entries. That fits a cut at a
point in the message stream, with Core opening the recording:

| Entries | Where Core opened the recording |
| --- | --- |
| 13 | before the start burst |
| 10 | after the start burst (runs 5, 19, 20, 21, 24; they passed, but still lost 3 entries) |
| 5-6 | after the name type and the select |
| 0 | after the last message |

*Inference, not observed:* a message model of 13 = 3 start-burst messages, plus 4
actions × 2 (event and evidence), plus 2 evidence-only events (the select's
keypress and the form submit) reproduces 10 and 5 exactly.

**Load.**

- Of the 15 runs that overlapped instance B, 14 lost entries.
- Of the 10 runs with A alone:
  - 5 kept all 13 entries;
  - 4 lost the start burst but no action;
  - 1 (run 18) lost actions.
- The window is crossed often even at single-instance load. It costs an action
  only when Core's start runs past the first user action, about 1.2 s after the
  extension's start.

**Coinciding failures across the two instances.** Each pair started its
recordings almost together, and both runs in each pair lost entries:

| Pair | Recording starts (Z) | Both lost |
| --- | --- | --- |
| Step 4b run 3 and W18 run 1 | 07:21:15.545 and 07:21:16.805 | every entry |
| Step 4b run 4 and W18 run 2 | 07:22:26.586 and 07:22:26.513 | their opening actions |

That fits both Cores' `createRecording` stalling under the same load spike.

**What the bundles cannot show.** They hold no timestamp for Core's start
handling, no gateway audit, and no retained Core store:

- the isolated workspaces were deleted;
- W18 run 1's leftover `F:\fxlab-runs\stage1\b\.work\run-mtzhikvr-07c3f403\core-workspace`
  holds one `.next` chunk map and nothing of Core's store.

So Core's start latency is inferred from which entries survived, the code, and the
probe. It was never measured.

### The entries appended after Stop

`l-stage1` open question 3 reports that `snapshots/flow-lane.json` and
`runtime.settle` disagree on `entriesAppendedAfterStop` and `finalizationWaitMs`
for the same recording. They are two different waits, and both numbers are true.

- **`runtime.settle`** comes from the runner's wait after Stop:
  `assertCoreRoundTrip` → `awaitFinalizedRecording` (`run-scenario.ts:287`, `:509`,
  written at `:289`).
- **`flow-lane.json`** comes from the Flow lane's own second wait on the same
  recording (`run-flow-lane.ts:70`, written at `run-scenario.ts:321`). By then the
  first wait has already seen `endedAt`, so the second always takes 2 polls with
  0 growth. That costs two `list-recordings` calls at roughly 400 ms plus one
  200 ms sleep (`finalized-recording.ts:67`, `:114`), hence 892-1803 ms.
- **Core's own log agrees.** After the runner's two `GET
  /api/client-gateway/snapshot` lines, each run's `logs/core.log` has exactly one
  id listing, then the first wait's polls, then 2 more:

  | Run | `list-recordings` calls | Breakdown | First wait |
  | --- | --- | --- | --- |
  | 1 | 6 | 1 + 3 + 2 | 1480 ms |
  | 3 | 5 | 1 + 2 + 2 | 1131 ms |
  | 4 | 7 | 1 + 4 + 2 | 2491 ms |

- **The field name overstates what it measures.** `entriesAppendedWhileWaiting` is
  the count at the last poll minus the count at the *first poll*
  (`finalized-recording.ts:96`, `:108`). That first poll comes after
  `stopRecording` returns, the gateway snapshot and an id listing. It undercounts
  entries appended after Stop, and it is not measured from Stop.
- **No conflict with Core `267a2ca`.** Entries appended after the client's Stop are
  expected: Core keeps appending until it finalizes (`bridge.ts:320-322`) and
  discards only after that (`:496-509`). None of the Stage 1 evidence shows an
  after-finalization discard. The Stage 1 runner did not read the audit.

### What HEAD changes

**This repository at `12de09e`.**

- **Send path unchanged:** `git diff --stat 16ff729 HEAD` prints nothing for
  `recording-start/`, `active-recording.ts`, `gateway-session.ts`,
  `recording-evidence.ts`, `connection.ts` or `background/index.ts`.
- **`recorded-event-intake.ts` changed**, adding the explained-navigation event
  after a navigating click. That is one more message on the same path, and it does
  not touch the start.
- **A new discard reader.** The runner now reads Core's discard audit after
  finalization (`3c396b0`, `3959823`: `run-scenario.ts:301-306`, second read
  `:397-405`). But `readRecordingDiscards` keeps only entries whose
  `metadata.recordingId` is this run's (`flow-lane/recording-discards.ts:91-92`).
  - The start-window audit entries have no `recordingId`, and the snapshot and
    state-update drops are not audited at all.
  - The probe fed the bridge's real audit output to the built reader: "0 counted,
    failure null". That built file (`dist/…/recording-discards.js`, 00:30) is older
    than its source (01:00), but its filter at `:49` is the same.
- **A new proposal check.** `a4564c5` adds `assertProposalCoversRecording`
  (`flow-lane/recording-flow-proposal.ts:84-93`). It compares the candidate count
  against the workflow's pinned executable event counts.
  - If `basic-form` pins them, a 2-candidate step 4b run now fails as
    `recording.contract` before approval instead of `action.dispatch`.
  - It does nothing for the recording lane, and it names no cause.

**Core at `0e6d3ac`.** `bridge.ts:364-380` wraps `appendRecordingDomainEvent` in
`appendOrDiscard`, and `service.ts:1480` refuses a domain event on a finalized
recording. Both are at the finalization end. The start path (`bridge.ts:258-308`)
is byte-identical in line numbers and content.

## Fix design, partitioned by file

### FluxIQ Core (crosses the repository boundary: the user must be told first)

**C1. `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts`:
make a client start ordered with what follows it.**

- At the top of `startRecordingFromClient`, before its first await, record a
  pending-start promise per owner key.
- In `handleGatewayEvent`, the `client.recording_entry`, `client.recording_event`,
  `client.snapshot`, `client.state_update`, `client.error` and
  `client.stop_recording` branches await that promise before reading
  `activeRecordings`.
- If the start is refused (`:260-266`) or throws, the waiting messages are
  discarded with an audit entry naming the refused recording id.
- The alternative is a per-socket chain in the host
  (`apps/web/src/server/client-gateway-websocket.ts:179`). It would serialize
  *every* message behind slow appends, and leave other hosts and tests racing. The
  bridge owns the "open before append" rule, so the fix belongs there.

**C2. The same file: acknowledge the start.**

- After `:304`, call `this.gateway.startRecording(session.sessionId, { recordingId, projectId, domainId })`
  in place of `markActiveRecording`. That is `commands.ts:39-44`: it sets the same
  field and also sends `server.start_recording`.
- On the extension side, `beginAccepted` ignores a second start for a recording
  already running, apart from linking a new project (`active-recording.ts:184-190`).
  When the acknowledgement beats the 750 ms fallback, the extension begins recording
  only after Core opened it.
- This is a wire-behavior change. Protocol types are unchanged, but it needs the
  architecture doc and an extension test.

**C3. The same file: make the remaining drops loud.**

- Put the message's own `recordingId` into the audit. `ClientGatewayRecordingEvent`
  carries one (contracts `client-gateway.ts:47`), and the domain sets it
  (`domain/src/client/gateway-mapping.ts:65`).
- Count and audit the snapshot and state-update drops (`:518`, `:555`).
- Stop `:305` erasing the count.

**Tests: `client-gateway/tests/bridge.test.ts`.**

- Hold `createRecording` open with a spy, the way `g-core-late-event`'s
  `recordingHeldAtFinalization` holds finalization.
- Send `client.start_recording` through `gateway.receive` without awaiting it, then
  a recording event, a snapshot and a state update. Release, then stop. Assert all
  entries are in the timeline and `server.start_recording` was queued after
  activation.
- Test that a refused start audits the messages that waited, with the recording id.
- Mutations:
  - remove the pending-start await → the timeline comes back short (the probe's 3
    or 0 shape);
  - remove the acknowledgement → no `server.start_recording` is sent.

**Docs.** Update `docs/architecture/automation-studio/client-gateway.md`. Run
`pnpm docs:reference` if the exported class's line moves (see `g-core-late-event`
open question 5).

### This repository: extension

**E1. `apps/extension/src/background/connection/recording-start/handshake.ts`, and
its test in `recording-start/tests/`.**

- **The hazard.** The local fallback can begin while `client.start_recording` is
  still unsent: the timer is armed at `:137`, and the send's first step may be an
  HTTP project lookup. Messages sent then reach Core *before* the start. No Core
  ordering can repair that.
- **The fix.** Keep arming first, for the reason the comment at `:133-135` gives.
  But have `acceptWindowElapsed` begin locally only once the in-flight send has
  settled.
- **Unit test.** Use a send that resolves after the window, and assert
  `beginLocally` is not called before it resolves. Mutation: call it immediately,
  and the test fails.
- **Proof needed.** Content harness: none; this is background-only. This is a
  code-read hazard, not observed: whether the lookup ran in Stage 1 is inferred
  from one `GET /api/client-gateway/snapshot` per run in `core.log`.
- **Unchanged:** `recorded-event-intake.ts` and `gateway-session.ts`.

### This repository: domain

None. `createWebAutomationRecordingEvent` already stamps `domainId` and
`recordingId` (`domain/src/client/gateway-mapping.ts:57-66`).

### This repository: test-runner (make the loss visible on both lanes)

**T1. New module
`packages/test-runner/src/run-expectations/recording-completeness.ts`, its test,
its barrel entry in `run-expectations/index.ts`, and the call from
`run-scenario.ts`.**

- **Read the extension's count.** Before Stop, beside `recordedEvents`
  (`run-scenario.ts:279`), read the extension's `status.eventCount`: its count of
  executable actions sent (`recorded-event-intake.ts:118`, `connection.ts:235`).
- **Read Core's count.** After `assertCoreRoundTrip`, read Core's action count once
  from the full session (`service.ts:1537-1538`, `:6036`). The summary that
  `finalized-recording.ts` polls carries only `eventCount` (`service.ts:872`).
- **Compare, on both lanes.** Fail as `recording.persistence` with "Core's recording
  holds N of the M actions the extension recorded".
- **Proof.** Unit tests for equal, short and empty counts. Mutation: skip the
  comparison, and the short case passes.
- **What it closes.** The recording lane's silent pass: smoke W01 ×2 at 0 entries.

**T2. `packages/test-runner/src/flow-lane/recording-discards.ts`, its test, and
`run-scenario.ts:301` and `:399`.**

- Also count discard entries without `metadata.recordingId` whose `sessionId` is
  the run's paired session. Audit entries keep `sessionId`
  (`client-gateway/service.ts:192-196`, `service/audit-log.ts:20`).
- `run-scenario.ts` must pass `paired.sessionId` at both reads, or the change lands
  inert. Both files belong in one brief.

**T3. `packages/test-runner/src/flow-lane/finalized-recording.ts` and
`run-scenario.ts:289`, `:321`.**

- Rename `entriesAppendedAfterStop` to what it measures (after the first poll), or
  measure from Stop's return.
- Label `flow-lane.json`'s figures as the lane's second wait.

### Lab proof (the brief's done condition)

**Step 4b at 24 of 24 under two-instance load.**

- **Setup:**
  - run `basic-form --flow --target isolated` ×24 at a commit with C1 and C2;
  - have E1, T1 and T2 in that commit too, so the checks below are readable;
  - run a second Lab instance concurrently, in its own worktree, for the whole
    campaign, as in Stage 1.
- **Pass condition, every run:**
  - `exit=0`, and `candidateCount` exactly 4;
  - `runtime.settle.recordings[0].entryCount` equal to the no-loss count, with no
    10, 6, 5 or 0 runs. The count was 13 at `16ff729`; recount it at the fix commit,
    because the explained-navigation event may add entries;
  - T1's comparison holds: Core's actions equal the extension's `eventCount`;
  - zero `recording.action_discarded` or `recording.event_discarded` audit entries
    for the run's session, before or after finalization (T2);
  - `extensionConnectionAfterStop` is not `error`.
- **In the same load window:**
  - W18 ×3, whose Flows begin with the username type;
  - W25 ×3, whose proposals include the `begin-delay` click;
  - smoke W01 recording-lane runs, with the full entry count.
- **Why two instances.** A single-instance campaign is not enough: 5 of the 10
  single-instance Stage 1 runs already lost the start burst.

## Commands run and observed results

All exits below were captured by redirecting to a file, never through a pipe.

**The timing script.**
`node i-recording-loss-timing.mjs > i-recording-loss-timing.tsv 2> i-recording-loss-timing.err`
printed `exit=0`, empty stderr, and 40 rows (24 A runs, 16 B runs including 4 bench
runs). Excerpts:

```
a run-mtzhfmkz-d780a9db basic-form … recIdToFirstActionMs=1161 entryCount=13 appendedAfterFirstPoll=0 finalizationWaitMs=1480 laneWait=0/1209/2 candidates=4 passed
a run-mtzhijv8-41c92075 basic-form … 1256 0 0 1131 - - recording.contract failed
b run-mtzhikvr-07c3f403 auth-gate  … 1428 0 0 1210 - - recording.contract failed
a run-mtzhk2zd-6a6b4624 basic-form … 1262 5 3 2491 0/951/2 2 action.dispatch failed
b run-mtzhk4a3-3dba04fe auth-gate  … 1225 12 7 5596 0/972/2 2 runtime.behavior failed
b run-mtzi455h-b711dfcf basic-form … 1397 0 0 2166 - - - passed
b run-mtzi64iy-844650cc basic-form … 1258 0 0 999 - - - passed
a run-mtzifeba-c96a149b basic-form … 1254 13 8 2146 0/918/2 4 passed
```

**Which actions survived.** A `node -e` read of `flow-lane.json` and `run.json` for
W18 runs 2 and 3, W25 run 3 and W24 runs 1-3 printed each Flow's actions and each
script's step times. For example, W18 run 2:

```
"actions":[{"actionType":"web.dom.type","status":"failed","failure":{"category":"target_not_found",…,"expected":"an element matching selector #password, …"}}]
steps [["enter-username","type","07:22:27.738Z"],["enter-password","type","07:22:28.016Z"],["submit-sign-in","click","07:22:28.182Z"],…]
```

W25 run 3:

```
"c":1,…"actions":[{"actionType":"web.dom.click",…"expected":"an element matching selector [data-testid=\"late-action\"], …"}]
steps [["begin-delay","click","07:36:16.272Z"],["await-late-action","waitForState","07:36:16.469Z"],["late-action","click","07:36:16.625Z"],…]
```

**Recording start times.** `node -e` on the recording ids printed:

```
a3 0e 2026-09-13T07:21:15.545Z
bW18r1 0e 2026-09-13T07:21:16.805Z
a4 5e 2026-09-13T07:22:26.586Z
bW18r2 12e/user lost 2026-09-13T07:22:26.513Z
bW18r3 12e/user lost 2026-09-13T07:23:57.332Z
bW25r3 3e/begin lost 2026-09-13T07:36:14.263Z
a1 13e pass 2026-09-13T07:18:47.109Z
```

**The probe.** `node i-recording-loss-probe.mjs > i-recording-loss-probe.out 2>&1`
printed `exit=0`. Its output, verbatim:

```
{"mode":"concurrent","createDelayMs":50,"entries":8,"timeline":["domain_event:web.tab.state_changed","observation:client.state_update","observation:client.state_snapshot","domain_event:web.element.input_changed#1","observation:client.state_snapshot","domain_event:web.element.changed","domain_event:web.element.clicked","observation:client.state_snapshot"],"finalized":true,"errors":[]}
  runner readRecordingDiscards: {"discardsCounted":0,"failure":null}
{"mode":"concurrent","createDelayMs":450,"entries":3,"timeline":["domain_event:web.element.changed","domain_event:web.element.clicked","observation:client.state_snapshot"],"finalized":true,"errors":[]}
  audit {"id":"audit-1","type":"recording.event_discarded","recordingIdInMetadata":null,"message":"Discarded a client recording event (web.tab.state_changed) that arrived while this client had no recording open."}
  runner readRecordingDiscards: {"discardsCounted":0,"failure":null}
{"mode":"concurrent","createDelayMs":1000,"entries":0,"timeline":[],"finalized":true,"errors":[]}
  audit {"id":"audit-1","type":"recording.event_discarded","recordingIdInMetadata":null,"message":"Discarded a client recording event (web.tab.state_changed) that arrived while this client had no recording open."}
  runner readRecordingDiscards: {"discardsCounted":0,"failure":null}
{"mode":"serial","createDelayMs":1000,"entries":8,"timeline":["domain_event:web.tab.state_changed","domain_event:web.element.input_changed#1","domain_event:web.element.changed","domain_event:web.element.clicked","observation:client.state_update","observation:client.state_snapshot","observation:client.state_snapshot","observation:client.state_snapshot"],"finalized":true,"errors":[]}
  runner readRecordingDiscards: {"discardsCounted":0,"failure":null}
exit=0
```

The 450 ms run dropped 5 messages. Only one was audited, with no recording id; the
snapshot and state-update drops left no trace.

**Code and history reads.**

- `git log --oneline 16ff729..HEAD` in this repository printed 23 commits, ending
  at `12de09e`.
- `git diff --stat 16ff729 HEAD` over the send-path files printed nothing, as
  quoted in "What HEAD changes".
- `git log --oneline 267a2ca..HEAD` in Core printed `0e6d3ac` and `6f172b9`, with
  the `bridge.ts` and `service.ts` diff quoted above. Core `git status --short` was
  empty.
- `git show 267a2ca~1:…/bridge.ts | grep -n "if (!active)"` printed
  `173 205 332 469 504 611`.
- The `F:\fxlab-runs\stage1\b\.work` listing printed one file:
  `core-workspace/apps/web/.next/server/chunks/886ea_@shikijs_langs_dist_typespec_mjs_9eef6980._.js.map`.
- `iconv` of `l-stage1-l-stage1-a-step4b-03.log` showed only build output and the
  result line, with no timing beyond the bundle.

## Not verified

- **Core's start latency was never measured.** Neither the bundles nor Core's logs
  time `resolveClientRecordingContext` or `createRecording`. The cause rests on:
  - which actions survived, named by the bundles;
  - the fixed entry-count sizes;
  - the code path at file:line;
  - a probe with fake delays.
- **The probe uses fakes.** The service is in memory and there is no IO registry:
  - so a discarded action is audited as a non-executable event, and only once;
  - with the real registry and a `domainId`, each action would be audited as
    `recording.action_discarded`, still without a recording id;
  - the probe's timings are not the Lab's.
- **Which `basic-form` type survived** in the 2-candidate runs. The bundle does not
  record targets for succeeded actions. The select's loss and the click's survival
  are observed.
- **The 13 = 3 + 8 + 2 message model** is an inference that matches the 10 and 5
  counts. It is not a read of Core's timeline.
- **Whether the extension's project lookup ran at start** in these runs, and how
  long it took. The attribution of one `GET /api/client-gateway/snapshot` per run is
  inferred, so E1's hazard is a code read.
- **When Core opened the recording in the 0-entry runs:** after the last message, or
  only after Stop. Both give 0 entries. The second would also leave a stale
  `activeRecordings` entry. Not distinguished.
- **The permanent loss in `L-dropped-action`'s persistent run 1** is plausibly this
  same race rather than an after-finalization discard. Not checkable.
- **HEAD's `assertProposalCoversRecording`:** whether `basic-form`'s
  `expected.recordingEvents` pins counts was not read.
- **Firefox, `reconnect`** (no loss observed at 3-5 entries), and the W28 bench
  rows.
- **W24's lost type.** The lead says employee-name; the bundle does not name
  succeeded targets, and I did not read `i-stage1-failures.md`.
- **No mutation proof:** nothing was changed, by brief.

## Open questions or contradictions found

1. **The `l-stage1` candidates are resolved.**
   - Load is the amplifier.
   - "Interference between concurrent instances" is only shared machine load: the
     Cores and ports were separate.
   - Core `267a2ca`'s discard is not involved. It acts after finalization, and the
     start-window drops are older than it.
2. **Smoke gate 5.0's "4 of 4 passed" rests on two empty recordings.** Both W01
   recording-lane runs stored 0 entries and passed. That gate result should not be
   quoted as a pass until T1 exists.
3. **The step 4b pass condition in `i-flow-lane-errors` (a) cannot see
   start-burst loss.** Runs 5, 19, 20, 21 and 24 lost 3 entries each and passed.
   The Lab proof above adds entry-count equality and T1.
4. **The runner's comment at `run-scenario.ts:262` rests on a false premise.** The
   extension's `recordingState` never means Core accepted a start the extension
   made, because Core sends no acceptance. Waiting on it cannot prevent this loss.
5. **Brief-ownership notes for the fix dispatch.**
   - T2 needs `run-scenario.ts` in the same brief as `recording-discards.ts`.
   - C2 changes what Core sends the extension. Pair it with an extension
     server-command test and the client-gateway architecture doc.
   - C1 to C3 need the user alert for a Core edit.
6. **`l-stage1`'s own inference holds.** It guessed that W18 runs 2 and 3's
   username node was missing. Their Flow's first node is `#password` and the script
   typed the username first, so the username action is absent from the recording.
