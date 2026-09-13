# i-demo-recording-finalize — why the demo's recording lane finds no new recording after Stop

Worker `i-demo-recording-finalize`, 2026-09-13. Read-only. Brief: "i-demo-recording-finalize" in
`briefs/finish-week1.md`. Evidence came from `F:\fxlab-runs\stage3\demo\a1` and `a2`, and from
`F:\fxlab-runs\stage2d\kept\run-mu02vd6b-046b01e6` for comparison. Core source was read at
`F:\!FluxIQ` (`f22f401`, which Current State describes as a docs commit after the demo's pin
`3cb8976`). No `.s\<session>` directory was entered. Times ending in `Z` are UTC; `+N` means
N ms after the recording's `startedAt`.

## Outcome

**Done. Answer: (d), closest to (a).** Both times, Core was still storing the recording's entries
when the lane's 10 s wait ran out. The extension had produced those entries *before* Stop, and Core
was storing them one at a time, 0.5 to 1 s each. Core finalizes a recording only after every earlier
message from that client has been stored (`bridge.ts:378-386`), so finalize could not have run inside
the window. The lane's failure then stopped Core while those writes were still landing, so finalize
never ran at all.

- Not (c): no end marker exists in any of Core's three stores for either recording. A finalized Lab
  recording has one in all three.
- (b) is neither proven nor needed. No log shows whether the Stop message reached Core. Even if it
  did, finalize waits behind the backlog.
- Smallest fix: this repository, `test-runner`. `waitForNewRecording` should wait on Core's own
  `endedAt` through the Flow lane's `awaitFinalizedRecording`, with a longer, named bound.
  Core's slow per-entry storage is the underlying cause, but it is a larger Core change.

## What changed and why

- **Tracked files:** none. This report is the only file written in the repository.
- **Scratch files** in the session scratchpad, all named `idrf-*`:
  - `idrf-walk.mjs`: a directory walk that never follows links;
  - `idrf-times.mjs`: file write times in a project;
  - `idrf-keys.mjs`: JSON key shapes, names and types only;
  - `idrf-entries.mjs`: entry types and time offsets;
  - `idrf-steps.mjs`: demo step times from the evidence timeline;
  - `idrf-sqlite.mjs`, `idrf-kinds.mjs`, `idrf-state-ids.mjs`, `idrf-chunks.mjs`: SQLite summaries;
  - their output files, and the SQLite copies under `idrf-db-a1`, `idrf-db-a2`, `idrf-db-kept` and
    `idrf-db-kept-main`.
- **SQLite was read from copies.** Node 22.11's `node:sqlite` may ignore `readOnly`, and a reader
  writes to `-shm`. So each database (with its `-wal`/`-shm`) was copied into the scratchpad and the
  copy was opened. Nothing under `F:\fxlab-runs` was written.

## Commands run and observed results

### 1. What `waitForNewRecording` waits for, and what `list-recordings` returns for these recordings

**The wait** (`packages/test-runner/src/demo-workspace/control-waits.ts:28-42`):
- It polls `control.listRecordings(projectId)` every 100 ms, plus each response's time, for 10 s.
- It ignores ids in the baseline, and throws if more than one new recording appears.
- It returns the new id once that item has `status === "completed"` or a non-null `endedAt`
  (`recordingItems`, `:66-77`).
- At the deadline, with a new id seen, it throws `recording.persistence`:
  `FluxIQ persisted demo recording <id> but did not finalize it` (`:40`). That is almost certainly
  the lane message the cleanup `EBUSY` hid.

**The request** is `POST list-recordings` with `{ projectId }` and no `summaries`
(`http-control.ts:113-115`). In Core:
- The handler calls `listRecordingSessions` (`packages/fluxiq/src/programs/automation-studio/api/handlers/workspace.ts:18-29`).
- That loads the project's recordings, then lists the in-memory sessions with full timelines
  (`runtime/service.ts:847-851`, `:5418-5432`, `runtime/service/recordings/store.ts:165-186`).
- Core's `RecordingSession` carries no `status` (`summaryRecordingSession`, `service.ts:5693-5707`,
  spreads the session). So only `endedAt` can end the wait.
- `endedAt` is set only by `finalizeRecording` (`service.ts:1037-1047`,
  `model/recording-framework.ts:105-106`).
- After `finalizeRecording`, appends are refused: "Finalized recordings are immutable."
  (`service.ts:1016`).

**Persisted state.** Key names, status fields, ids and counts only:

| Store | a1 `…9f6ed733….1789321387077` | a2 `…8888e848….1789321714448` | Kept Lab recording (finalized) |
| --- | --- | --- | --- |
| `project.sqlite` `recordings` row | `status=recording`, `ended_at_ms=null`, events 29, actions 5, snapshots 8, updated 17:43:35.463Z | `status=recording`, `ended_at_ms=null`, events 21, actions 4, snapshots 5, updated 17:48:50.804Z | `status=completed`, `ended_at_ms` = start+1982, events 11, actions 3, snapshots 4 |
| `global.sqlite` `automation.state` `…/indexes/recordings` item (what `summaries: true` reads, `service.ts:858-872`) | keys `recordingId,taskId,startedAt,updatedAt,eventCount,noteCount`: **no `endedAt`** | same keys: **no `endedAt`** | keys include **`endedAt`** |
| `global.sqlite` `…/recordings/<rid>/recording` document (what a reload reads) | written 17:43:10.207Z: **no `endedAt`** | written 17:48:37.506Z: **no `endedAt`** | **`endedAt` present** |
| Per-recording `index.json` `summary` | no `endedAt` | no `endedAt` | **`summary.endedAt` present** |

Two notes on these stores:
- Core's `ProgramJsonStore` keeps `indexes/recordings.json` and `recording.json` as SQLite rows,
  not files (`programs/_shared/storage.ts:44-53`). The walks show no such files on disk.
- So `list-recordings` in either form returns both demo recordings **without `endedAt`**, and the
  wait could only time out. The absence of `summary.endedAt` in `index.json`, which `l-stage3-demo`
  observed, really does mean "not finalized": a finalized recording carries it there.

### 2. How the demo stops recording, and whether that stop reached Core's finalize

**The lane** clicks "Stop recording", then waits for the extension to report `recordingState === "idle"`
(`workspace-lanes.ts:56-59`).

**The extension** sets that state before it sends anything (`apps/extension/src/background/connection/active-recording.ts:174-197`):
- `recordingState = "idle"` and `emitStatus()` come first (`:186-192`);
- only then `send("client.stop_recording", { recordingId, projectId, endedAt })` (`:195`);
- `send` writes to the socket when it is connected, and otherwise uses the offline queue
  (`gateway-session.ts:183-187`).

So the `record-stop` step proves the local stop only.

**Core** handles the Stop message in `handleGatewayEvent` (`client-gateway/bridge.ts:204-216`), then
`stopRecordingFromClient` (`:373-395`) does, in order:
1. waits `stopDrainMs` (250 ms by default, `:102`);
2. waits `writeOrder.settled(ownerKey)`, which covers every message-handling step queued before it;
3. waits `writeOrder.flush(ownerKey)`;
4. calls `finalizeRecording` with the client's `endedAt`.

Every other client message runs on the same per-client chain (`:217-222`,
`client-recording-write-order.ts:34-47`). A `client.recording_event` is stored by its own append
(`bridge.ts:247-249`, `:397-450`); only entries, snapshots and state updates are batched
(`client-recording-write-order.ts:49-64`).

**One append** (`service.ts:1009-1030`) takes the recording mutation lock and then:
- writes the state snapshot object (`object-documents.ts:139-162`);
- appends a typed chunk to `project.sqlite` (`service.ts:5143-5155`);
- rewrites the per-recording state index (`:5434-5437`);
- rewrites the project recording index and the recording pipeline documents
  (`:5388-5403`, `recordings/store.ts:130-163`).

**Core's log shows HTTP routes only.** It has no gateway message, Stop, finalize or error line, so it
cannot show whether the Stop arrived.
- a1 `run-…06616b71-core.log`: one `list-recordings` before pairing (line 124), 13 after Stop
  (lines 143-156), then `[exit] code=1 signal=null` (line 157).
- a2 `run-…f354758a-core.log`: one before (line 123), 15 after (lines 142-157), exit at line 158.

**Client times** (`review/timeline.json`, step ids and times only):

| | `record-start` | user steps | `record-stop` clicked, then idle |
| --- | --- | --- | --- |
| a1 | 17:43:06.983Z to 17:43:11.001Z | 17:43:11.116Z to 17:43:11.992Z | 17:43:12.145Z (+5068), 17:43:13.810Z (+6733) |
| a2 | 17:48:34.358Z to 17:48:37.701Z | 17:48:37.801Z to 17:48:38.851Z | 17:48:38.946Z (+4498), 17:48:39.732Z (+5284) |

**What the client produced before Stop:**
- a1's five action entries have `startedAt`/`completedAt` at +4371 to +4986. All eight state-snapshot
  ids are client millisecond stamps from +3746 to +4986. All of these are before the Stop click.
- a2's four actions are at +3595 to +4335, also before its Stop.

**When Core stored it** (`recording_event_chunks`; `created_at_ms` is Core's write time,
`first_event_at_ms` the entry's own time):

| | a1 | a2 | Kept Lab run |
| --- | --- | --- | --- |
| Core wrote the recording document | 17:43:10.207Z (+3.1 s) | 17:48:37.506Z (+3.1 s) | not measured |
| First entry stored | 17:43:14.289Z (+7212), after the client had stopped | 17:48:40.627Z (+6179), after the client had stopped | +1134 |
| Last entry stored | 17:43:35.542Z (+28465), when Core was stopped | 17:48:50.878Z (+16430), when Core was stopped | +3334 |
| Chunks; gap between writes | 26; 405-2683 ms, mostly 450-1000 | 18; 218-1579 ms | 10; 157-478 ms |
| Delay from entry time to storage, for entries stamped by the client | 7431 → 8978 → 10850 → 16984 → 17492 → 21307 ms, growing | 6492 → 7500 → 9490 ms | at most 1685 ms |
| Last client-stamped entry stored | +26154 (seq 24-25) | +13830 (seq 16) | — |

What that shows:
- **a1.** The lane's window ran from about 17:43:13.8Z to about 17:43:23.8Z; the evidence bundle
  was finalized at 17:43:24.678Z. In that window Core stored only about the first 17 of at least 29
  entries. It kept appending until 17:43:35.5Z, and the recording index, pipeline document and
  `project.sqlite` rows were all rewritten between 17:43:35.19Z and 17:43:35.88Z. Those appends were
  accepted, and `service.ts:1016` refuses appends after finalize. So **the recording was still not
  finalized when Core was stopped, about 22 s after the client's Stop.**
- **a2.** The lane failed at 17:48:50.053Z; Core's last entry was stored at 17:48:50.878Z, just
  before it exited.
- **Staging directories confirm the one-at-a-time pattern.** The project's `staging\<uuid>`
  directories (27 in a1, 19 in a2) and `objects\sha256` files follow the same rhythm, one content
  transaction per append (`storage/project/content-store.ts:144`).

### 3. Which reading is true

**(d), closest to (a).** Finalize had not happened when the 10 s wait expired, because Core was still
storing entries the extension produced before Stop, one at a time.

- **Why not a plain (a):** finalize never happened at all. The lane's failure ran
  `withPersistentDemoCore`'s cleanup, which stopped Core at about +28.4 s (a1) and +16.4 s (a2)
  while appends were still landing.
- **How long Core would have needed is not measured.** The backlog's size when Core stopped is
  unknown.
  - a2 stored 21 entries and 4 actions; a1 stored 29 and 5. The same four user steps were performed
    in both.
  - That suggests a2 still had queued entries, probably including at least one action, when it was
    stopped. This rests on a single pair of observations.
- **Not (b) as a cause:** whether the Stop reached the bridge cannot be observed. The Core log has no
  gateway lines, and the audit log only records discards (`bridge.ts:502-533`). A received Stop
  still waits behind the backlog (`bridge.ts:378-386`).
- **Not (c):** the table in section 1 shows no end marker in any of the three stores for either
  recording, while the finalized Lab recording has one in each.
- **Load around it** (`l-stage3-demo`): six to eight concurrent Lab processes, free memory dipping
  to 4.83 GB, and the demo Core running `next dev`. In the Lab run, Core stored entries 2 to 3 times
  faster and the recording was about a third as long.

### 4. The smallest fix

**Repository and files: this repository, test-runner.**
- `packages/test-runner/src/demo-workspace/control-waits.ts`, `waitForNewRecording`:
  - keep the "exactly one new recording" detection, but ask with `summaries: true`, the cheap index
    read (`finalized-recording.ts:141-147` explains why);
  - then wait with `awaitFinalizedRecording` (`flow-lane/finalized-recording.ts:82`, exported through
    `flow-lane/index.ts`, as `run-scenario.ts:29` already imports it). That function waits for Core's
    `endedAt` plus a repeated entry count, and fails with `recordingId`, `entryCount`,
    `entriesAppendedWhileWaiting`, `waitedMs` and `polls`;
  - use a named demo bound, for example 90 s, that tests can inject. The Flow lane's 30 s default
    (`finalized-recording.ts:71`) is not shown to be enough: a1 was still storing entries it had
    received before Stop 20 s after Stop, and never finished;
  - drop the `status === "completed"` shortcut, because this route never returns `status`.
- **No caller changes are needed.** `workspace-lanes.ts:61` and `diagnosis-lanes.ts:77` both call
  `waitForNewRecording`.
- **The structure audit allows the import:** `scripts/structure-audit/config.mjs:15` has
  `forbiddenImports: []`, and `.structure-baseline.json` has no `control-waits` entry.
- **No overlap with the cleanup fix:** `f-demo-cleanup-error` owns `core-process.ts`. The two are
  independent, but until that fix lands, a failed recording lane still reports `EBUSY` instead of
  this message.

**Tests.** No test covers `control-waits.ts` today; `demo-workspace/tests/` holds only
`core-process.test.ts`. Add `packages/test-runner/src/demo-workspace/tests/control-waits.test.ts`,
with an injected clock like `flow-lane/tests/finalized-recording.test.ts`. Rows:
1. A new recording listed without `endedAt` that gains it after N polls returns its id.
2. One that never gains `endedAt` fails `recording.persistence` with its id and the entry-count
   details.
3. Two new recordings fail.
4. A recording already in the baseline is ignored.
5. The request carries `summaries: true`.

Mutation proof: return on first sighting without waiting for `endedAt`, and row 2 must fail. Restore
the file byte-identical.

**The underlying cause is in Core, and is not the smallest fix.** Each client event is stored by its
own append, and each append rewrites the per-recording state index, the project recording index and
the pipeline documents, and opens the typed store (`service.ts:1024-1027`, `:5143-5155`,
`:5388-5403`). The cost grows with the recording, and under load it came to 0.5 to 1 s per entry.

## Not verified

- **Whether Core received the Stop.** Nothing records it: no log line, no persisted audit.
- **Whether finalize would have succeeded, and when.** Core was stopped first, and the backlog left
  at that point is unknown. So a 90 s bound is a proposal, not a measurement.
- **What made each append slow.** The concurrent benches, `next dev`, the demo's own non-summary
  polling (13 to 15 requests at 0.36 to 1.46 s each) and the faulty RAM were not separated.
- **What the Core-stamped observation entries are.** Most observation entries carry Core's write
  time as `timestamp`, so their send time is unknown. The "produced before Stop" claim rests only on
  action `startedAt`/`completedAt`, client-stamped chunk `first_event_at_ms`, and the state-snapshot
  ids.
- **Core source at the pin.** It was read at `F:\!FluxIQ` `f22f401`, not at the pinned
  `F:\fxlab\!FluxIQ` `3cb8976`, and the two were not diffed.
- **What a Lab run must show after the fix:** `demo:record` then `demo:run`, run alone and then
  beside a bench. `waitForNewRecording` should return after Core's `endedAt`, with `waitedMs`
  recorded. `review-recording-flow-proposal` should appear in Core's log,
  `workspace.json` should gain `latestRecordingId`, and both commands should exit 0. Subflow
  generation and playback after the wait have never been reached, so they may fail next.
- **The kept Lab run's `global.sqlite`, with its `-wal`/`-shm` copied as a set**, read "database disk
  image is malformed" twice. The main file alone opened cleanly, and that copy is the source of the
  kept-run rows above. The cause, most likely a mismatched WAL set in the kept snapshot, was not
  investigated.

## Open questions or contradictions found

1. **Core's per-entry storage cost** is a Core performance item, probably for Week 2. A 29-entry demo
   recording took more than 20 s to store under load, and the whole recording was stored after the
   client had already stopped. Longer Lab recordings under the same load could also exceed the Flow
   lane's 30 s `awaitFinalizedRecording` bound. That was not observed here: the kept Lab run
   finished in 3.3 s.
2. **Recording start latency.** Core wrote the recording document about 3.1 s after the client's
   `startedAt`, and stored the first entry after the client's Stop in both attempts. Any link to the
   recording-start work settled this session (`f-recording-start-send`, `f-recording-start-guard`,
   `g-core-start-order`) was not investigated.
3. **Small correction to `l-stage3-demo`:** it said Core took "about 1.2 s per `list-recordings`".
   Only the last two a1 requests did (1178 and 1203 ms). Most took 0.36 to 1.04 s, and a2's peaked at
   1.46 s.
4. **Kept Lab evidence:** a kept run whose `global.sqlite` and `-wal`/`-shm` cannot be opened together
   may matter to later leak checks that read SQLite from kept runs. Not investigated.
