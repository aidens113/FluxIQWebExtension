# i-w25-live-wait — why a live `delayed-ui` recording proposes no wait

Worker `i-w25-live-wait`, 2026-09-13. Brief: `briefs/finish-week1.md`, "i-w25-live-wait".
This was read-only work.
- **Written:** this report, and scratch probes in my own scratch folder.
- **Not touched:** tracked files, domain and extension source, and Core. No build, test suite or Lab command was run.

**Code read:**
- This repository's working tree.
  - `git log` over the recording path (the recorder, `background/connection`, `recording/proposals`, `web-panel-host.ts` and `delayed-ui`) lists `32b4324` as its newest commit.
  - The five newest repository commits, `78d65a3` back to `49abd93`, are not among them, so the Stage 2b build at `6c22e22` ran this same code.
- Core at `F:\!FluxIQ`: HEAD `240c73e`, built at `187f40d`, working tree clean.
  - `git diff --stat 187f40d 5845f5d -- packages/fluxiq/src` printed nothing.

## Outcome

**Done. The rule fails on the order of the mutation against the late click.**

The order breaks inside Core's gateway bridge, not in the extension:
- the extension sends the page change before the click;
- Core stores the click first.

In plain terms:
- **What the rule needs.** It proposes a wait only from the page change's own mapper call, and only when a click comes after that page change in Core's stored recording.
- **What happened live.** The page change was stored after the late click. Nothing followed it, so no wait was proposed.
- **Why the order flips.**
  - Core's WebSocket host starts handling each incoming message without waiting for the one before (`apps/web/src/server/client-gateway-websocket.ts:179`). Core's own bridge comment says so (`bridge.ts:283-284`).
  - In the bridge, evidence (`client.state_update`) first waits for any queued state snapshots to be written (`bridge.ts:605`).
  - A recorded click (`client.recording_event`) is written at once (`bridge.ts:390-402`).
  - The clicks' state snapshots are queued (`bridge.ts:558-575`, with a 25 ms timer at `:667-671`).
  - So when a snapshot is still queued or being written as the page change arrives, the late click, arriving a few milliseconds later, overtakes it.
- **The other four conditions pass on the live message shape** (see the table in Task 2).

**How strong the evidence is:**
- **The probe uses Core's real code.** It runs Core's real client gateway, Automation Studio bridge and service, and the domain's own mapper. The extension's own payload builders build the messages.
- **Delivered in order,** the live recording gives 8 entries, "Compacted 3" and 3 candidates: click, wait, click.
- **With the late click stored first,** it gives 8 entries, "Compacted 3" and 2 candidates. That is exactly what all 8 live Stage 2b `delayed-ui` Flow recordings show: 6 in `stage2b\a` and 2 in the bench bundle `stage2b\d`.
- **Delivered as Core's WebSocket host delivers messages** (started back to back, none awaited), the late click was stored first in 5 of 5 runs, each with 2 candidates.
- **A fix prototype on the bridge instance** gave click, wait, click in every delivery mode tried (21 of 21 runs), with no Core file edited.
- **Not observed:** Core's live timeline. The live order is inferred from the matching fingerprint and from ruling out the other four conditions.

**The fix belongs in Core's bridge, a change that crosses into the Core repository.** This repository needs only a Core-run test row. The wait rule, the recorder flush and the manifest need no change.

## Findings

### Task 2 — each condition of the wait rule on a live recording

| Condition | Live verdict | Evidence |
| --- | --- | --- |
| The mutation observation's type | **Passes** | See the type note below the table. The probe timeline shows `observation:input.event:dom.mutation` in every run. |
| Its `latestEvidence`, or `added` | **Passes** | See the payload note below the table. |
| Its order against the click | **Fails** | Core stores the late click before the mutation (Task 1). The mutation is then the last entry the mapper sees, `following` is empty, and `webAutomationLateTargetWait` returns `undefined` (`late-target-wait.ts:55-63`). |
| The click's `selector` or frame | **Passes** | A live click becomes an `action` entry whose `parameters.selector` is `[data-testid="late-action"]`. It is the Flow click's target in the too-slow failure record, `l-stage2.md:1157`. `browserFrameId` is 0 (`gateway-mapping.ts:85`, `payloads.ts:28-31`). In the probe the entry is `action:web.dom.click:[data-testid="late-action"]`, and the in-order wait names that selector. |
| The between-evidence URL check | **Passes** | See the URL note below the table. |

**Type.** Live evidence goes out as a `client.state_update`:
- with `metadata.inputId: "web.recording.evidence"` (`recording-evidence.ts:156-169`);
- Core's bridge sends it through the IO recorder (`bridge.ts:602-615`);
- the input's role is `event` (`input-model.ts:87`);
- so it is stored as an `observation` with `observationType: "input.event"` (`io-bridge.ts:54-64`).

**Payload.**
- The payload is `{ latestEvidence }` from `recordingEvidencePayload`, carrying `kind`, `url` and `mutation` (`gateway-payloads.ts:38-56`). The bridge passes the update's `state` as the payload (`bridge.ts:610`).
- `added >= 1` comes from the fixture, not from a live count: the reveal inserts one button into an empty container (`delayed-ui/scenario.ts:66`).
- In the in-order probe the mapper returned `web.dom.wait_for_selector:[data-testid="late-action"]` for this observation.

**URL.**
- In order, the mutation's `following` is exactly `["action:web.dom.click:[data-testid=\"late-action\"]"]`. The compacted state snapshots are removed before `following` is built (`service.ts:2388`, `:2401`; `timeline.ts:7-13`), so no skipped entry names a URL.
- When the order flips, the check is never reached.

### Task 1 — the order, step by step

**What the extension sends.** This comes from code and step timings, not from a capture of the wire.
- **The recorder flushes before a click.** Any kind that can be executable sends the pending mutation batch first (`content/recorder.ts:52-58`, `:111-119`). Both recorded clicks go through `emit` (`content/dom-events.ts:52`, `:70`).
- **The batch was still pending at the late click, in all 8 live runs.** The late click came 155, 229, 123, 210, 231, 170, 110 and 165 ms after `waitForState` saw the late button (`run.json` steps). That is inside the recorder's 500 ms quiet period, so the flush sent the batch immediately before the click.
- **The mutation goes out as evidence, sooner than the click.**
  - The mutation is sent as `client.state_update` after a cached project lookup (`recorded-event-intake.ts:194`; `recording-evidence.ts:115-169`).
  - The click first waits for a merged tab snapshot round trip, then sends `client.recording_event` (`recorded-event-intake.ts:179-181`).
  - The click then sends its state snapshot as `client.snapshot`, after a screenshot capture and upload (`recording-evidence.ts:121-154`; `state-assets.ts:29-47`).
  - So on the wire the mutation precedes the late click. This is inferred.
- **The recording start sends three more messages:** a browser-state update, a `browser.tab` evidence event, and an initial state snapshot (`active-recording.ts:294-303`).

**What Core does with them.**
- **Messages are handled concurrently.**
  - `NativeWebSocketConnection.acceptData` starts `handleFrame` for each frame and does not await it (`apps/web/src/server/client-gateway-websocket.ts:172-181`), which calls `receiveRaw` (`:134-136`).
  - The event bus awaits handlers only within one message (`client-gateway/service/event-bus.ts:12-14`).
  - The Lab's Core used this adapter: its `core.log` line "Client gateway WebSocket bound to shared runtime" is printed by `apps/web/src/lib/fluxiq.ts:231`.
- **The bridge treats each message kind differently:**
  - a state `client.snapshot` is queued, and written after 25 ms or by the next flush (`bridge.ts:558-575`, `:659-673`, `:675-711`);
  - a `client.state_update` naming an input awaits `flushRecordingEntries` first (`:605`), then appends (`:606-615`);
  - a `client.recording_event` naming an input appends at once, with no flush (`:390-402`), and so does the domain-event path (`:403-419`);
  - every append takes one per-recording lock in the service, in call order (`service.ts:1013-1014`).
- **So the order flips.**
  1. A snapshot is queued.
  2. The mutation arrives and waits for that snapshot's write.
  3. The late click arrives, calls its append at once, and takes the lock first.
  4. Stored order: the late click, then the mutation.

**The fingerprint, probe against live.**

| Delivery | Stored order | Entries | Compaction issue | `web` candidates |
| --- | --- | --- | --- | --- |
| Probe, awaited in order | mutation, then late click | 8 | Compacted 3 | 3: click, wait, click |
| Probe control: late click sent first | late click, then mutation | 8 | Compacted 3 | 2 |
| Probe, back to back as the host delivers, ×5 | late click, then mutation (5 of 5) | 8 | Compacted 3 | 2 |
| Live Stage 2b, 8 recordings | not observable | 8 | Compacted 3 | 2 |

**Timed grid.** Messages were sent at planned offsets:
- the first click's state snapshot `s` ms after the first click;
- the mutation at 385 ms;
- the late click `g` ms after the mutation.

Each cell is a single run and shows the `web` candidate count.

| `s` | g = 2 | g = 20 | g = 80 |
| --- | --- | --- | --- |
| 200 | 3 | 3 | 3 |
| 340 | **2** | **2** | 3 |
| 380 | **2** | **2** | **2** |

**Slow-write grid.** Here a batch carrying a state snapshot was held for `X` ms before being stored, standing in for a loaded host. `g` was 20. Each cell is a single run.

| `X` | s = 50 | s = 200 |
| --- | --- | --- |
| 0 | 3 | 3 |
| 150 | 3 | **2** |
| 400 | **2** | **2** |

**How to read the grids.**
- The flip needs a state snapshot queued, or being written, when the mutation arrives. A slower write widens that window.
- On the Lab host, 8 of 8 recordings hit it. That host ran two instances under load, and Core's dev routes in `core.log` took 312–1,033 ms. Which snapshot sat in front of the mutation, and how long its write took, were not observed.

**A second misorder, visible even in order.** The initial state snapshot, queued before the first click, is stored after the first click. The in-order probe timeline reads `input.state`, `input.event:browser.tab`, click 1, `client.state_snapshot`, `client.state_snapshot`, and so on. A direct append never flushes the queue.

### Task 3 — the fix design, partitioned by file

**The rule to make true:** a client's recording messages are stored in the order Core received them. This is generic gateway behaviour, so it belongs in Core (AGENTS.md, "Repository Boundaries").

#### FluxIQ Core (crosses the repository boundary; the supervisor alerts the user before the first Core edit)

**1. `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts`.** Two changes are needed together.

**(a) One ordered chain per recording owner (`recordingOwnerKey`).**
- In `handleGatewayEvent` (`:202`), queue each message that appends to a recording on its owner's chain before the first `await`: `client.recording_event`, `client.recording_entry`, `client.snapshot`, `client.state_update` and `client.error`. Run its `awaitClientStart` and its append inside that step.
- A step that fails rejects that message's receive and does not break the chain.
- Leave `client.start_recording` outside the chain. It already makes later messages wait (`pendingStarts`, `:262-292`).
- Leave `client.stop_recording` outside the chain as well, but make Stop wait for the owner's chain after its drain, before it flushes and finalizes. That applies to `stopRecordingFromClient` (`:355-360`) and to `stopRecording` (`:176-184`). A message received before the drain ends is then stored, not discarded.

**(b) Flush before any direct append.** `appendRecordingEvent` (`:375`) and the `client.error` marker (`:246-258`) flush the owner's queued entries first, as `appendStateUpdate` already does (`:605`). A queued snapshot is then stored before a later click.

**Why both.** Each was prototyped alone on the bridge instance, with no Core edit:
- **(a) alone** put the mutation before the late click in 5 of 5 back-to-back runs and 9 of 9 timed runs. But the initial snapshot was still stored after click 1, because the chain orders only handler steps and a snapshot handler merely queues.
- **(b) alone** also gave 5 of 5 and 9 of 9, but only because the two paths happen to have equal await depth. Back to back, it stored the initial snapshot ahead of the browser-state update and the tab evidence that arrived before it.
- **(a) and (b) together** put the mutation before the late click, and the initial snapshot before click 1, in every run:
  - in order: 1 of 1;
  - back to back: 5 of 5;
  - timed grid: 9 of 9;
  - slow-write grid: 6 of 6.

**2. `packages/fluxiq/src/programs/automation-studio/client-gateway/tests/bridge.test.ts`.** New rows, each with a mutation proof:
- **"A client's messages are stored in the order they were received when the host delivers them concurrently."**
  - Receive without awaiting a state `client.snapshot`, a `client.state_update` on an event-role input, and a `client.recording_event` on an action input.
  - After Stop, the timeline must read snapshot, observation, action.
  - Today the action is stored first (probe, back to back, 5 of 5). Mutation: remove the chain.
- **"A recorded event received after a queued state snapshot is stored after it."**
  - Receive both awaited, in order.
  - Today the action is stored first (the probe's in-order timeline). Mutation: remove the flush in `appendRecordingEvent`.
- **"A message received before Stop's drain ends is stored."**
  - Receive a message without awaiting, then Stop.
  - Mutation: finalize without waiting for the chain.
- **Existing rows must still pass:** the late-message discard and ordered-start rows, which use the helpers at `:618-712`.

**3. Core documentation.**
- `docs/architecture/automation-studio/client-gateway.md`: state the order guarantee beside the WebSocket adapter paragraph (`:220-226`).
- Add a migration-note line for 0.4.x: entries are now stored in arrival order.

#### This repository

**4. `domain/src/tests/web-panel-host.test.ts` — the Core-run row.** If the row would take this 245-line file over the advisory size, it goes in a sibling test file instead.
- **Title:** "W25: the live delayed-ui messages through Core's client gateway, received as its WebSocket host receives them, propose click, wait, click".
- **Harness:**
  - build `ClientGatewayService` (`fluxiq/client-gateway`) and `AutomationStudioClientGatewayBridge` (`fluxiq/automation-studio`), both of which Core exports;
  - register the web IO registry, native runtime and recording domain as `recordThroughCore` does;
  - use a `mkdtemp` data directory and a paired session.
- **Messages.** Send the live recording's 8 messages, all started without awaiting:
  1. the browser-state update;
  2. the tab evidence;
  3. the initial snapshot;
  4. click 1;
  5. click 1's state snapshot;
  6. the mutation evidence;
  7. the late click;
  8. the late click's state snapshot.
- **How they are built.** Use the domain's own `createWebAutomationRecordingEvent`, `createWebAutomationStateUpdate` and `createWebAutomationStateFromSnapshot`, with the evidence metadata `recording-evidence.ts:159-168` sends. The domain may not import `apps/extension`.
- **Assertions:**
  - 8 entries;
  - the "Compacted 3" issue;
  - `web` candidates `[web.dom.click begin-delay, web.dom.wait_for_selector late-action, web.dom.click late-action]`;
  - Core's fallback proposes 2 clicks.
- **Proof it guards the right thing.**
  - Against today's Core, built at `187f40d`, it fails with 2 candidates: the probe's back-to-back mode did so 5 of 5.
  - Against Core with the fix, it passes.
  - Mutation proof: remove the chain in Core's bridge, rebuild Core, rerun.

**5. No other change.** These stay as they are:
- `domain/src/recording/proposals/late-target-wait.ts`;
- `domain/src/web-panel-host.ts`;
- `apps/extension/src/content/recorder.ts`;
- the `delayed-ui` manifest.

With the live message shape delivered in order, they already give click, wait, click.

#### Rejected alternatives

- **Domain only, from the late click's own call.**
  - *The idea:* find a mutation stored after the click whose content `sequence` is lower than the click's. The click's sequence is in its event id, `web.<sequence>.<timestamp>`, which the action entry has kept since `187f40d`. Then return the wait plus a copy of Core's fallback click, as `linkedClickEntry` does.
  - *Rejected because:* it works around a Core defect downstream and re-implements Core's fallback candidate. It also leaves every other timeline reader out of order: state links, landing claims and evidence facts.
- **Extension only.** Nothing the extension sends can prevent it, because the flip happens after Core has received both messages.
- **Awaiting each frame in Core's WebSocket adapter** (`client-gateway-websocket.ts:179`).
  - It would order everything, but a slow append would hold up pings and action results on the same socket.
  - Hosts that bring their own adapter (`client-gateway.md:228-229`) would not get the guarantee.

#### What the supervisor's Lab run must show after the fix

- `delayed-ui --flow` ×3:
  - `candidateCount` 3;
  - actions `web.dom.click:succeeded`, `web.dom.wait_for_selector:succeeded`, `web.dom.click:succeeded`;
  - `entryCount` 8 with "Compacted 3".
- `delayed-ui --flow --variant too-slow` ×3: failure `timeout` / `web.action.timeout`, the wait `failed`, and final state `late-action-absent`.
- The week1 bench:
  - no other row's candidate count or verdict changes;
  - `recordedActions` for the extension equals Core's;
  - `discardsAfterFirstRead=0`.
- Optionally, and decisive for the live order: export one W25 recording's timeline entry types, in order, before Core's workspace is deleted.

## What changed and why

- **Written:** only this report, which is what the brief owns.
- **Scratch files,** all under `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\iw25\`:
  - `iw25-build.mjs` bundles the probe with the domain's esbuild. It leaves `fluxiq` imports external, pointed at Core's built package.
  - `iw25-probe.ts` is the probe itself: the live message sequence, the delivery modes, and the fix prototypes applied as instance overrides.
  - `iw25-*.log` hold the run outputs.
- **Probe data folders** were created per run and removed. 0 were left over.
- **No tracked file** was edited here or in Core. Core's `git status --short` printed 0 lines. This repository's `git status` lists only other workers' files.

## Commands run and observed results

1. **Bundle reads,** numbers, run ids and key names only, over the 6 W25 runs in `stage2b\a` and the 2 `delayed-ui` Flow runs in `stage2b\d`:
   - every run had `entryCount` 8, `proposalIssues` `["Compacted 3 high-frequency state entries before mapper proposal generation. Raw recording data was preserved."]` and `candidateCount` 2;
   - `secondWait.entriesAppendedAfterFirstPoll` was 0 in all 8;
   - first click to late click: 385, 464, 433, 436, 466, 462, 329 and 361 ms;
   - `core.log` in two runs lists no state-asset upload route.
2. **Core checks:**
   - `git diff --stat 187f40d 5845f5d -- packages/fluxiq/src` printed nothing;
   - `git -C F:/!FluxIQ rev-parse --short HEAD` gave `240c73e`.
3. **`git merge-base --is-ancestor a840001 6c22e22`** printed "a840001 is in 6c22e22".
4. **`node iw25-build.mjs`,** run three times, once after each probe change: `build exit=0` each time.
5. **Probe runs.** Each command printed `exit=0`. The summary lines:
   - **In order:** `serial  entries=8  Compacted 3   web=3  order=mutation<click2  mutationMapped=web.dom.wait_for_selector:[data-testid="late-action"]`.
   - **Late click sent first:** `click2-first  entries=8  Compacted 3   web=2  order=click2<mutation  mutationMapped=none  mutationFollowing=[]`.
   - **Back to back:** `concurrent-1` to `concurrent-5` each gave `entries=8  Compacted 3   web=2  order=click2<mutation  mutationMapped=none`.
   - **Timed:** `timed-s200-*` gave `web=3`; `timed-s340-g2` and `timed-s340-g20` gave `web=2`; `timed-s340-g80` gave `web=3`; `timed-s380-g2`, `-g20` and `-g80` gave `web=2`.
   - **Slow writes:** `grid-slow0-*` gave `web=3`; `grid-slow150-s50-g20` gave `web=3`; `grid-slow150-s200-g20` gave `web=2`; `grid-slow400-*` gave `web=2`.
   - **Prototype (a),** `IW25_FIX=chain`: back to back 5 of 5 and timed 9 of 9 gave `web=3  order=mutation<click2`. Back to back, the timeline still stores click 1 before both state snapshots.
   - **Prototype (b),** `IW25_FIX=flush-first`: back to back 5 of 5 and timed 9 of 9 gave `web=3  order=mutation<click2`. Back to back, the timeline begins with `client.state_snapshot` before `input.state`.
   - **Prototypes (a) and (b) together,** `IW25_FIX=chain-flush`:
     - in order, back to back 5 of 5 and timed 9 of 9 all gave `web=3  order=mutation<click2  initialSnapshotBeforeClick1=true`;
     - the slow-write grid with the fix gave `web=3` in all 6 cells.
6. **Hygiene:** `leftover data dirs: 0`, and Core's status showed `core-status-lines=0`.

**Faulty RAM.** No run failed: every command exited 0 with coherent output. The back-to-back and fix results repeat 5 of 5, and 9 of 9 for the timed grid. Each timed-grid and slow-write cell is a single observation.

## Not verified

- **The live stored order.** No bundle holds Core's timeline or the mapper's inputs.
  - The conclusion that Core stored the late click first rests on two things:
    - the fingerprint: 8 entries, "Compacted 3" and 2 candidates, equal to the flipped probe and the click-first control, while the in-order probe gives 3;
    - every other condition passing on the live message shape.
  - Which queued snapshot sat in front of the mutation, and how long its write took on the Lab host, were not observed.
  - The slow-write grid is a simulation.
- **The extension's send order.** That the mutation went out before the late click is inferred from the recorder flush, the click's snapshot round trip and the step timings. If the extension ever sent the click first, the Core fix alone would not help. The Lab check above covers it.
- **The live `added` count.** It is in no bundle. `added >= 1` comes from the fixture code.
- **Probe values.**
  - Element descriptors held only selector, tag, text, test id and bounds.
  - The DOM snapshot was minimal, with no screenshot reference.
  - The browser-state update used the domain's snapshot builder instead of `browserStateSnapshotFromTabs`, which imports the extension runtime.
  - The rule reads none of these fields.
- **The fix prototypes.** They were instance overrides in a probe, not a Core change.
  - Stop and its drain, and a pending start, were not exercised: the probe stops after every receive settles, with `stopDrainMs` 0.
  - The Stop wait in design item 1(a) is untested.
- **Proposal state links.** Whether they change once snapshots land in arrival order was not checked (`resolveCandidateActionEntryId`, `service.ts:2417`).
- **Tests.** No domain, extension or Core test ran, since the brief was read-only.

## Open questions or contradictions found

1. **This crosses the repository boundary.** The fix is in Core's `bridge.ts`, its test, and its client-gateway page. The supervisor must alert the user before the first Core edit.
2. **A premise of two earlier reports is wrong.**
   - `i-late-target-wait` says Core appends in arrival order (`model/recording-framework.ts:50-63`). That holds for the model, not for the bridge: the order Core receives messages on a socket is not the order it stores them.
   - `w25-wait-mapper`'s "Not verified" assumed the recorder's order reaches the timeline.
3. **The fix moves state snapshots relative to actions in every recording.** For example, the initial snapshot moves before click 1. Whether any proposal's `stateLink`, or any Lab row reading state beside an action, changes needs checking with the Core fix.
4. **The domain row copies the extension's evidence message shape by hand,** because the domain may not import `apps/extension`. Should an extension-side row pin what `recording-evidence.ts` sends? Or should the Core-run row live in `apps/extension`, which could use `gateway-payloads.ts` directly, as this probe did?
5. **Where the chain lives.** It is recommended in the bridge, not in `ClientGatewayInbound.receive`. The event bus fans each event out to every subscribed handler, and those other handlers may depend on handling messages concurrently. Action results, for example, are settled in `inbound.ts:90-92`.
6. **Where the domain row goes.** `web-panel-host.test.ts` is 245 lines, and the row with its gateway harness adds roughly 100. A sibling test file may be the better home.
