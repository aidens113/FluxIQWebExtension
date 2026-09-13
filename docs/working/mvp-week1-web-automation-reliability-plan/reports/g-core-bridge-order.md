# g-core-bridge-order — a client's recording messages are stored in arrival order (Core)

Worker `g-core-bridge-order`, 2026-09-13. Brief: `briefs/finish-week1.md`, "g-core-bridge-order", under the twenty-sixth dispatch. Core at `F:\!FluxIQ`, HEAD `240c73e`, with other workers' uncommitted edits present.

## Outcome

**Done.** In Core's gateway bridge, a client's recording messages are now stored in the order the gateway received them. Both design items from `i-w25-live-wait` are in:
- **(a)** Each client has one ordered chain of message handling, and Stop waits for that chain after its drain.
- **(b)** Queued state snapshots are written before anything is appended directly.

The ordering lives in a new focused module beside the bridge. `bridge.ts` went from 796 lines to 760.

Every guard has a mutation proof: 6 mutations, each failing its own row with a real assertion diff and restored byte-identical. All five new rows also fail against today's `bridge.ts`. The client-gateway and recording tests, Core `pnpm check` and `pnpm docs:check` pass.

One incident during the work is described under "Commands run", item 5. For several minutes `bridge.ts` on disk was today's original. It was restored and verified by hash.

## What changed and why

### `packages/fluxiq/src/programs/automation-studio/client-gateway/client-recording-write-order.ts` (new, 99 lines)

This file holds the class `ClientRecordingWriteOrder<TItem>`, which keeps the order one client's recording writes reach storage in, per recording owner key.
- **`run(ownerKey, step)`** runs a step once every step queued before it for that owner has settled. It is called before the handler's first await. A failed step rejects only its own caller, and the next step still runs.
- **`settled(ownerKey)`** settles once the steps queued so far have. A step queued later is not waited for.
- **`enqueue` and `flush`** are the bridge's snapshot batch queue, moved here unchanged: the 25 ms timer, the 50-item threshold, 100-item batches, and grouping by project and recording. The bridge passes the write in, and it still goes through `appendOrDiscard`, so the late-discard accounting is untouched.

It is not exported from `client-gateway/index.ts`. The public API is unchanged, and `index.ts` was not edited.

**Why the queue moved too.** Adding the chain alone would have taken `bridge.ts` past 800 lines. The chain, the queue and the flush rule together are one responsibility: the order writes are stored in.

### `client-gateway/bridge.ts` (796 to 760 lines)

- **`handleGatewayEvent`.**
  - `client.start_recording` and Stop stay outside the chain, as the report designed.
  - The pending start is still read at the moment the message arrives, so only a start received before a message holds that message.
  - `client.recording_entry`, `client.recording_event`, `client.snapshot`, `client.state_update` and `client.error` go through `writeOrder.run(...)`. Each step awaits the pending start, then calls the new private `storeClientMessage`, which holds the old branches unchanged.
- **(b), a flush before every direct append.**
  - `appendRecordingEvent` flushes once, after the no-recording check. That covers both the IO-input path and the domain-event path.
  - The `client.error` marker flushes first.
  - `appendActionResult` flushes first. This goes beyond the report's list; see open question 2.
  - `appendStateUpdate` already flushed.
- **Stop.** `stopRecordingFromClient` and `stopRecording` both await `writeOrder.settled(ownerKey)` after the drain, before they flush and finalize.

### `client-gateway/tests/bridge.test.ts` (734 to 783 lines)

- **Removed** the row "does not flush queued snapshots before ingesting a recording action". It pinned the opposite of fix (b); see open question 1.
- **Report row 2, extended:** "stores a recorded event, a domain event and a client error received after a queued state snapshot after that snapshot". It uses fake timers, so only a flush can write a snapshot.
- **New:** "stores an action result after the state snapshots queued before it".
- **Report row 1:** "stores a client's messages in the order they were received when the host delivers them concurrently". It sends the eight W25 messages, started back to back with none awaited:
  1. the browser-state update;
  2. the tab evidence (an event-role input);
  3. the initial snapshot;
  4. click 1;
  5. click 1's snapshot;
  6. the page-change evidence;
  7. the late click;
  8. the late click's snapshot.

  Then a client Stop. The row expects that exact stored order and no discard audit.
- **Report row 3, once per Stop path:** "stores a message received before a client Stop's drain ends" and "... a web panel Stop's drain ends". The click's `appendRecordingEvents` is held before the service lock, so a Stop that did not wait would finalize first.
- **Support:**
  - a `page-changed` event-role input added to `lateEventIoRegistry`;
  - helpers `stateSnapshot` and `timelineKinds`;
  - a `recordingClient` helper.
- **Why `recordingClient`.** With the new rows the file reached 801 lines, and the audit's 800-line limit counts test files (`.structure-baseline.json` lists `service.test.ts`). The growth came from five setup lines repeated in most rows. `recordingClient` replaces that setup in the new rows and in four existing ones:
  - "keeps a recorded click's event id...";
  - "still fails the receive...";
  - "audits a snapshot and a state update...";
  - the `recordingHeldAtFinalization` helper.

  Their assertions are unchanged.

### `client-gateway/tests/client-recording-write-order.test.ts` (new, 88 lines)

Five rows:
- one owner's steps run in queue order, even when an earlier step is slower;
- a failed step rejects only itself;
- owners do not wait for each other;
- `settled` does not wait for later steps;
- `flush` groups by recording and also writes what was queued during a write.

### `docs/architecture/automation-studio/client-gateway.md` (the order guarantee only)

- A new paragraph after the ordered-start section. It states the guarantee: failed appends, different clients, and Stop waiting for the chain as it stands when the drain ends.
- Rewrote the sentence that said the bridge "does not drain the snapshot queue before ingesting a `client.recording_event`". The queue is now written before every direct append.
- One clause in the WebSocket adapter paragraph: it forwards frames without waiting for one to be handled before the next.

### Generated references

`pnpm docs:reference` produced no diff. The files already matched the tree with the moved lines (`bridge.ts:19`, `:27`, `:31`, `:36`, `:86`), so another worker had regenerated them in the meantime.

### Migration-note line, for the supervisor

`g-core-input-withholding` owns `package-boundaries.md`. The line belongs in the note for the release after 0.4.0, or in 0.4.0's note if that version is still unpublished:

> - Client gateway recordings: a client's `client.recording_entry`, `client.recording_event`, `client.snapshot`, `client.state_update` and `client.error` messages are now stored in the order the gateway received them. Queued state snapshots are written before any later directly appended entry, action results included, and Stop waits for messages received before its drain ends. Stored timelines, entry sequences and the mapper's `following` lists can differ from 0.4.0, and a receive now resolves only after that client's earlier messages are stored.

## Task 2 — does `stateLink`, or anything reading state beside an action, change?

**`stateLink` does not change for entries that carry their own timestamps.** It is chosen by time, not by position in the timeline:
- `proposalNodeStateLinkFromIndex` (`runtime/service.ts:6045-6059`) reads `action.stateAtActionId`.
- `finalizeRecordingStateLinks` sets that from `selectStateForAction` (`runtime/state-linker.ts:57-83`). The rule is the nearest snapshot by `timestamp ?? startedAt ?? monotonicOffsetMs`; on a tie, the earlier one; then `compareStateItems`.
- Timeline `sequence` only orders the loop over actions (`compareEntryOrder`, `:85-91`). Each action's choice is independent of that loop.
- `resolveCandidateActionEntryId` (`service.ts:6061-6068`) works on entry ids.

**It can change in two cases:**
1. **An entry with no client timestamp.** `appendRecordingEntry` stamps `Date.now()` when the entry is stored (`model/recording-framework.ts:51`). A queued snapshot is now written earlier, before the next direct append rather than up to 25 ms later. A direct append now waits for that write. Both stamped times move, so the nearest-by-time choice can move too. The bridge keeps a client's own `timestamp` when the client sends one.
2. **Two snapshots with exactly the same timestamp.** `compareStateItems` breaks the tie on `entryId`, and default ids are `entry.<sequence>` (`recording-framework.ts:55`), so storage order decides. That comparison is lexicographic, so `entry.10` sorts before `entry.9`.

**The state lookup by entry** (`latestStateAtOrBeforeEntry`, `service.ts:6021-6043`) also uses time first. It falls back to sequence only when no time is present.

**What does change, on purpose, is the order the mapper sees.**
- `recordingMapperCalls` builds `following` in timeline order (`runtime/service/recordings/proposal-candidates.ts:28-39`).
- `recordingTimelineForProposalMapping` removes only `client.state_snapshot`, `client.state_update` and `state_checkpoint` (`runtime/service/recordings/timeline.ts:7-13`).
- So `input.state` and `input.event` observations and actions now appear in arrival order. That is the W25 fix.
- Every mapper that reads `following` sees the new order: the late-target wait, landing claims, and downstream evidence facts.
- The "Compacted N" count is unchanged, because it counts entries, not their order.
- `index.timeline.firstEntryId` and `lastEntryId` (`service.ts:5929-5933`) and entry sequences follow storage order.

**Not checked:** whether any week1 bench row's `stateLink` actually differs. That needs the Lab.

## Compatibility effect

- **Which order.** For every gateway client, the five recording message types are now stored in the order the gateway handed them to the bridge. `ClientGatewayInbound.receive` has no await before emitting them (`client-gateway/service/inbound.ts:45-95`), and the event bus calls its handlers straight away (`event-bus.ts:12-14`). So that is the order `receive` was called in; for the WebSocket host it is the order of frames on the socket.
- **A receive resolves later.** It now waits for every earlier message from the same client to be stored.
  - The WebSocket host does not await frames, so pings and action results on the socket are not delayed.
  - In-process callers that await `gateway.receive` wait longer.
- **One client's slow append holds up its later messages.** Before, later messages could overtake it. A failed append still fails only its own receive. Different clients never wait for each other.
- **Direct appends wait for the queued snapshot batch write.** That applies to a recording event, a client error marker, an action result, and a state update naming a registered input (the last already did). This reverses a deliberate earlier rule; see open question 1.
- **Stop can take longer to finalize.** Both the client and web-panel Stop now wait for messages received before the drain ended. Those messages are stored instead of discarded, so their discard audits go away. A message received after the drain still races finalization, exactly as before.
- **Stored timelines differ** for any client that sends snapshots and actions close together. Snapshots land earlier, and entry sequences, default entry ids (`entry.<sequence>`) and first and last entry ids shift.
- **No change** to the wire protocol, shared types or public exports.

## Commands run and observed results

1. **Backups before editing.** Copies of the three files I would change went to the scratch folder `gcbo-orig\`. `sha256sum` printed `8c61fa94…` for `bridge.ts`, `5f7af1c0…` for `bridge.test.ts` and `c78f6126…` for `client-gateway.md`.

2. **First run, before the harness change.** `npx vitest run <bridge.test.ts> <client-recording-write-order.test.ts> --no-file-parallelism`, from `F:\!FluxIQ`:
   - `exit=0`;
   - `Test Files 2 passed (2)`, `Tests 30 passed (30)`.

   `wc -l` then showed `bridge.test.ts` at 801 lines, over the 800-line limit.

3. **After the harness change.** The same run printed `exit=0`, `Tests 30 passed (30)`. `wc -l` showed 783 lines. `sha256sum` printed:
   - `bridge.ts`: `63056d7b3e0f459bd8562fb401c59ac4e7fb384e83c01eb83a9c31a6d51cd50b`;
   - `bridge.test.ts`: `d06e7693…`;
   - the module: `10235231…`.

4. **Mutation scripts.** Both are in the scratch folder:
   - `gcbo-make-mutations.mjs` writes each variant, and only if its anchor matches exactly once;
   - `gcbo-run-mutations.sh` refuses to start unless `bridge.ts` and its backup both hash to the good value. It restores the good file on exit and checks each restore.

5. **Incident: `bridge.ts` was reverted to today's original for several minutes.**
   - **What happened.** My first runner had no guards. The generator stopped because `bridge.ts` uses CRLF line endings, so the scratch folder `gcbo-mut\` was never created. The runner then copied `gcbo-orig\bridge.ts` into place, and its restore failed because the good copy did not exist.
   - **How it was caught.** `sha256sum` printed `8c61fa94…`, the original.
   - **What did not happen.** No test ran in that attempt, because the log redirect also failed. No other file was touched.
   - **The fix.** I re-applied the same edits, and `sha256sum` printed `63056d7b…`, byte-identical to the good version recorded in step 3. I also added the missing guards to both scripts.
   - **Effect on other workers.** Any Core check they ran in that window saw today's `bridge.ts`. That file compiles on its own, so nothing should have broken.

6. **Guarded mutation run**, `GCBO_EXPECTED_SHA=63056d7b… bash gcbo-run-mutations.sh all`. The generator printed a line for each variant, all CRLF. Every run printed `exit=1` then `restored byte-identical`, and the last line was `final bridge.ts sha256=63056d7b…`. The failures, quoted from each log:

   | Variant | Row that failed | Quoted failure |
   | --- | --- | --- |
   | Today's `bridge.ts` (the 5 new rows) | report row 2, extended | `expected [ 'action', 'domain_event', 'marker' ] to deeply equal [ 'client.state_snapshot', …(5) ]` |
   | | action-result row | `expected [ 'action' ] to deeply equal [ 'client.state_snapshot', 'action' ]` |
   | | report row 1 | `expected [ 'action', …(7) ] to deeply equal [ 'input.state', 'input.event', …(6) ]` |
   | | both Stop rows | `expected [] to deeply equal [ 'action' ]` |
   | (a) chain removed | report row 1 | `expected [ 'client.state_snapshot', …(7) ] to deeply equal [ 'input.state', 'input.event', …(6) ]` |
   | (b) recording-event flush removed | report row 2, extended | `expected [ 'action', 'domain_event', …(4) ] to deeply equal [ 'client.state_snapshot', …(5) ]` |
   | (b) error-marker flush removed | report row 2, extended | `expected [ 'client.state_snapshot', …(4) ] to deeply equal [ 'client.state_snapshot', …(5) ]` |
   | (b) action-result flush removed | action-result row | `expected [ 'action' ] to deeply equal [ 'client.state_snapshot', 'action' ]` |
   | Client Stop without the wait | "...client Stop's drain ends" | `expected [] to deeply equal [ 'action' ]` |
   | Web-panel Stop without the wait | "...web panel Stop's drain ends" | `expected [] to deeply equal [ 'action' ]` |

   The run against today's code printed `Tests 5 failed | 20 skipped (25)`. Each mutation printed `Tests 1 failed | 24 skipped (25)`.

   The full received orders, read from the diffs:
   - **Today's code, row 1:** action, client.state_snapshot, client.state_snapshot, action, input.state, input.event, client.state_snapshot, input.event. Both clicks are stored first, and the late click lands before the page-change evidence: the W25 flip.
   - **Chain removed, row 1:** client.state_snapshot, input.state, input.event, client.state_snapshot, client.state_snapshot, action, input.event, action. The first snapshot is stored ahead of the two evidence updates that arrived before it. This matches the report's finding for (b) alone.
   - **Recording-event flush removed, row 2:** action, domain_event, then three snapshots, then marker.
   - **Error-marker flush removed, row 2:** snapshot, action, snapshot, domain_event, marker, with the last snapshot still queued.

7. **Package type check.** `npx tsc --noEmit` in `packages/fluxiq` printed `exit=0`.

8. **Gateway and recording test files.** `npx vitest run ... --no-file-parallelism` over:
   - both client-gateway test files;
   - `client-gateway/tests/service.test.ts`;
   - `api/handlers/tests/client-gateway.test.ts`;
   - `runtime/tests/client-gateway-transport.test.ts`;
   - `runtime/tests/io-bridge.test.ts`;
   - `model/tests/state-recording.test.ts`;
   - `storage/tests/recording-index-store.test.ts`;
   - `runtime/service/proposals/tests/open-recording.test.ts`.

   It printed `core exit=0`, `Test Files 9 passed (9)`, `Tests 73 passed (73)`. Then, from `apps/web`, `npx vitest run src/server/tests/client-gateway-websocket.test.ts` printed `web exit=0`, `Test Files 1 passed (1)`, `Tests 3 passed (3)`.

9. **Core `pnpm check`**, run with `GIT_INDEX_FILE` pointing at a scratch copy of the index. The two new files were added there with `git add -N`, and the scratch index listed 2 of them. The real index was not touched.
   - `pnpm check exit=0`;
   - the structure tests printed `# fail 0`;
   - `structure-audit: passed (121 warning(s), 256 baselined)`. My files appear only as 400-line advisories: `bridge.ts` at 760 and `bridge.test.ts` at 783;
   - `packages/contracts`, `packages/fluxiq`, `packages/client-gateway-websocket` and `apps/web` each printed `check: Done`. Other workers' in-flight files were type-checked at the same time.

10. **The generated reference was stale earlier.** After my first `bridge.ts` edits, `node scripts/docs-reference.mjs --check` exited 1 with "docs/reference/framework-reference.md is stale".

11. **Regenerating the reference.** `pnpm docs:reference` printed `exit=0` and "Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (1576 public declarations)". A `diff` against the copies taken just before was empty for both files, and the two files are identical. The `bridge.ts` rows cite lines `:86`, `:19`, `:27`, `:31` and `:36`.

12. **`pnpm docs:check`.** It printed `exit=0`, "Validated local links in 101 authored/reference Markdown files." and "Deterministic framework reference is current."

13. **Core `git status --short`.** My files are the three modified ones (`client-gateway.md`, `bridge.ts`, `tests/bridge.test.ts`) and the two untracked new ones. Every other entry belongs to the two parallel Core workers.

**Faulty RAM.** No uniform or impossible failure appeared. Every mutation failure was an assertion diff on the row it targeted. Each mutation result is a single observation. Row 1 passed with the fix in three separate full-file runs (steps 2, 3 and 8).

## Not verified

- **No Core build and no full test run.** No `pnpm build` (the brief forbids it) and no full `pnpm test`.
- **The domain row against fixed Core.** `f-w25-core-order-row` needs a Core build first.
- **The Lab.** A Lab run after a Core build must show:
  - **`delayed-ui --flow`, three times:** `candidateCount` 3; the actions `web.dom.click:succeeded`, `web.dom.wait_for_selector:succeeded`, `web.dom.click:succeeded`; `entryCount` 8 with "Compacted 3".
  - **`delayed-ui --flow --variant too-slow`, three times:** failure `timeout` / `web.action.timeout`, the wait `failed`, final state `late-action-absent`.
  - **The week1 bench:** no other row's candidate count or verdict changes; `recordedActions` for the extension equals Core's; `discardsAfterFirstRead=0`.
  - **Recommended:** export one W25 timeline's entry types in order, and compare one bench row's `stateLink` before and after.
- **The report's timed and slow-write grids** were not rebuilt as Core tests, and ordering under a loaded host was not measured.
- **One client's slow append holding up its later messages** was not measured.
- **A pending start, concurrent snapshots and a Stop together** are covered only by the existing ordered-start rows, which pass. No new row combines them.
- **`stateLink`** was checked from code only, not against a real recording.
- **Live WebSockets.** The web app's WebSocket host was not exercised live.
- **Other socket adapters.** An adapter that awaits something before calling `receive` defines its own order; that was not checked.

## Open questions or contradictions found

1. **The fix reverses a deliberate Core rule.** Core's page said the bridge "does not drain the snapshot queue before ingesting a `client.recording_event`; actions and domain events are accepted immediately, while adjacent state remains correlated by timestamp…". The row "does not flush queued snapshots before ingesting a recording action" pinned that rule. Both came from `0e4edea` (2026-08-15). `i-w25-live-wait` did not mention them. Fix (b) reverses the rule, so I removed the row and rewrote the sentence. The supervisor should confirm the trade: a click is now stored only after the queued snapshot batch is written.
2. **The action-result flush goes beyond the report.** The report listed `appendRecordingEvent` and the client error marker. The brief says "a flush before every direct append", and `appendActionResult` is the remaining one, so it flushes too (mutation-proven). Action results stay off the chain, because they are not client recording messages.
3. **Two races the chain does not fix, neither covered by a test:**
   - A `client.start_recording` that arrives while a Stop for the previous recording is still draining opens the new recording, and Stop's later `activeRecordings.delete(ownerKey)` removes it. This race predates the fix; Stop now waits for the chain too, so the window is longer.
   - A message received just before a new start, whose step runs after that start opens, lands in the new recording, because the start sits outside the chain.
4. **Existing rows were touched.** The harness change edited the setup lines of four existing rows in `bridge.test.ts` to stay under the 800-line limit. Their assertions are unchanged, and all pass.
5. **Baseline.** No `.structure-baseline.json` entry needs to change. The audit passed with the new files included.

## Amendment — the two races, fixed

Brief: `briefs/finish-week1.md`, "Amendment to `g-core-bridge-order` — the two races it left (Core)". The supervisor accepted the reversal of `0e4edea`'s rule and the action-result flush, which closes open questions 1 and 2 above. The migration-note line goes to `g-core-withholding-execution`, so `package-boundaries.md` was not touched.

### Outcome

**Done, with one gate failing on another worker's change.**
- Both races are fixed in `bridge.ts`.
- Each race has a row for both paths, the client's and the web panel's, and a mutation proof for each guard.
- Every mutation run restored `bridge.ts` in a `finally` and confirmed the hash.
- The client-gateway and recording tests, the web adapter test, the type check and Core `pnpm check` pass.
- `pnpm docs:check` fails only because the generated reference lacks a new export from `g-core-withholding-execution`, not because of this change. See command 6.

### What changed and why

**Race 1 — a Stop and a start (`bridge.ts`).**
- **The client Stop** (`stopRecordingFromClient`) takes the project and domain only from the recording its Stop names. It removes the bridge's active recording only if that is still the recording it stopped.
- **The web-panel Stop** (`stopRecording`) removes the active recording only if it is still the one it stopped.
- **Before the fix,** Stop's unconditional `activeRecordings.delete(ownerKey)` removed a recording started while the Stop drained or finalized. Every later message from that client was then discarded as if no recording were open.
- **One more effect:** a client Stop naming a recording other than the open one no longer drops the open one, and no longer borrows its project.

**Race 2 — a message received before a start (`bridge.ts`).**
- **Both starts wait.** The client start (`startRecordingFromClient`) and the web-panel start (`startRecording`) each take `writeOrder.settled(ownerKey)` before their first await. They open the new recording only once that has settled.
- **So an earlier message** is handled against the recording that was open when it arrived, or discarded if none was. It is never stored in the recording the later start opens.
- **No deadlock.** A message waits only for a start that was already pending when the message arrived, so no message received before a start ever waits for that start.
- **The cost.** A start now waits for that client's earlier messages to be stored.

`bridge.ts` went from 760 lines to 769.

**`client-gateway/tests/bridge-restart.test.ts` (new, 165 lines).**
- **Why a new file.** `bridge.test.ts` is 783 lines, and the two rows with their helpers would take it past 800. Core already keeps different aspects of one subject in sibling test files: `runtime/tests/service.test.ts` sits beside `service-flow-representation.test.ts` and others, each with its own helpers. This file follows that pattern. `bridge.test.ts` is unchanged.
- **Row 1: "keeps open a recording started while a {client | web panel} Stop is closing the one before it".**
  1. The client opens its first recording in a project.
  2. `finalizeRecording` is held just after the service has finalized, so the bridge has not yet cleaned up.
  3. The client starts `recording.next`, then the hold is released.
  4. A click follows.

  The row expects the first recording to have `endedAt`, `recording.next` to hold `[action]`, and no discard audit.
- **Row 2: "never stores a message received before a {client | web panel} start in the recording that start opens".**
  1. With the first recording open, the first write, a click, is held before the service lock.
  2. A page-state update, a client Stop and the start all arrive without being awaited. The start is a client message or `bridge.startRecording`.
  3. The test waits until the start has finished or 300 ms have passed, then releases the click.

  The row expects the first recording to hold `[action, input.state]`, `recording.next` to be empty, and no discard audit.

**`docs/architecture/automation-studio/client-gateway.md`.** A new "A start" bullet in the order guarantee, and one sentence added to the Stop bullet: Stop closes only the recording it stopped.

### Can the extension send messages in that order?

**Yes, in two ways.** This comes from reading the code, not from a live capture.
1. **Page state while idle.** `active-page.ts:93` sends a `client.state_update` carrying the browser state when tabs change, whether or not the extension is recording. Its `recording` flag is simply `recordingState === "recording"` (`browser-state.ts:50`, `:77`). When a recording is open, the bridge stores a state update in it whatever that flag says. It skips the flag only when no recording is open.
2. **Messages still in flight from a stopped recording.** `stop()` (`active-recording.ts:174-197`) marks the extension idle and sends `client.stop_recording` straight away. It does not wait for work already under way, such as a click still in its snapshot round trip. The next `client.start_recording` is sent by `sendStart` (`:309-328`) as soon as the user starts again. The new recording's own messages come from `startRecording` (`:272-304`), which runs after the start through `beginOnce` (`:247-262`).

Both orders can reach Core back to back, and Core's WebSocket host handles such messages concurrently. The new rows pin the rule either way.

### Commands run and observed results

1. **The three client-gateway test files.** `npx vitest run` over `bridge.test.ts`, `bridge-restart.test.ts` and `client-recording-write-order.test.ts` printed `exit=0`, `Test Files 3 passed (3)`, `Tests 34 passed (34)`. `bridge.ts` hashed to `867831571f1d867342b3ba9713cd68e8bcd7c3a8a6a5083be3f6b26b59ea41cf`, at 769 lines.

2. **Mutation runs.** The script is `gcbo-amend-mutations.mjs` in the scratch folder. As the amendment requires:
   - it refuses to start unless both `bridge.ts` and the copy it set aside hash to the expected value;
   - it writes each variant, runs it, and restores the copy in a `finally`, then hashes the restore;
   - it also restores the copy on exit and on SIGINT or SIGTERM;
   - it skips any variant whose anchor does not match exactly once.

   `node gcbo-amend-mutations.mjs <scratch> 867831571f1d…` exited 0. Every run printed `restored byte-identical`. The script ended with `final bridge.ts sha256=867831571f1d867342b3ba9713cd68e8bcd7c3a8a6a5083be3f6b26b59ea41cf`, and a separate `sha256sum` printed the same.

   | Variant | Rows run | Result | Quoted failure |
   | --- | --- | --- | --- |
   | Pre-amendment `bridge.ts` (`63056d7b…`) | the 4 new rows | `4 failed (4)` | both race 1 rows: `expected [] to deeply equal [ 'action' ]`; both race 2 rows: `expected [ 'action' ] to deeply equal [ 'action', 'input.state' ]` |
   | Client Stop without its guard | its race 1 row | `1 failed \| 3 skipped (4)` | `expected [] to deeply equal [ 'action' ]` |
   | Web-panel Stop without its guard | its race 1 row | `1 failed \| 3 skipped (4)` | `expected [] to deeply equal [ 'action' ]` |
   | Client start without its wait | its race 2 row | `1 failed \| 3 skipped (4)` | `expected [ 'action' ] to deeply equal [ 'action', 'input.state' ]` |
   | Web-panel start without its wait | its race 2 row | `1 failed \| 3 skipped (4)` | `expected [ 'action' ] to deeply equal [ 'action', 'input.state' ]` |
   | The six earlier mutations, rerun | their rows in `bridge.test.ts` | `1 failed \| 24 skipped (25)` each | the same rows and diffs as in the first report |

3. **Package type check.** `npx tsc --noEmit` in `packages/fluxiq` printed `exit=0`.

4. **Gateway and recording test files.** The earlier nine files plus `bridge-restart.test.ts` printed `core vitest exit=0`, `Test Files 10 passed (10)`, `Tests 77 passed (77)`. The web adapter test printed `web vitest exit=0`, `Test Files 1 passed (1)`, `Tests 3 passed (3)`.

5. **Core `pnpm check`.** It ran with a scratch git index that includes the three new files (`scratch index new files: 3`).
   - `pnpm check exit=0` and `# fail 0`;
   - `structure-audit: passed (121 warning(s), 256 baselined)`. My files appear only as 400-line advisories, `bridge.ts` at 769 and `bridge.test.ts` at 783;
   - `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web` each printed `check: Done`.

6. **`pnpm docs:check` exited 1.** It printed "Validated local links in 101 authored/reference Markdown files.", then "docs/reference/framework-reference.md is stale".
   - **How I found the cause.** A copy of `scripts/docs-reference.mjs` read Core's source but wrote its output into the scratch folder, leaving Core's files untouched. It printed `generate exit=0` with 1577 public declarations.
   - **The whole difference from Core's current file:**
     - `Public declarations: 1576` became `1577`;
     - `Value: 293` became `294`;
     - one new row, `` `fluxiqRuntimeTextWithholding` | Value | `packages/fluxiq/src/runtime/text-withholding.ts:20` ``.
   - **Whose change it is.** That is `g-core-withholding-execution`'s new runtime helper. My five `bridge.ts` rows are unchanged (`:86`, `:19`, `:27`, `:31`, `:36`).
   - **What I did not do.** I did not regenerate the reference, since the missing row comes from that worker's change. Core's `git status` still lists both reference files as modified by other workers, exactly as before this run.

7. **Core `git status --short`.** My files are three modified ones (`client-gateway.md`, `bridge.ts`, `tests/bridge.test.ts`) and three untracked new ones (`client-recording-write-order.ts`, `tests/bridge-restart.test.ts`, `tests/client-recording-write-order.test.ts`). Every other entry belongs to other workers.

**Faulty RAM.** No uniform or impossible failure appeared. Every mutation failure was a real assertion diff on the row it targeted. Each is a single observation. The race 2 mutations rely on the start opening within 300 ms while the click is held, and it did so in both runs for each start path. The rows with the fix in place do not depend on that timing.

### Not verified

- **No Core build and no full test run.** No `pnpm build` and no full `pnpm test`.
- **Live restarts.** No Lab scenario stops and restarts a recording within a Stop's drain, so neither race was exercised live. A Lab run can show only that nothing regressed: `discardsAfterFirstRead=0`, and `recordedActions` equal between the extension and Core on the week1 bench.
- **A start behind a stuck write.** A start waiting behind the same client's hung append was not measured.
- **The gateway session's `activeRecordingId`** was not tested; see open question 1.

### Open questions or contradictions found

1. **A leftover race outside my files.** `client-gateway/service/inbound.ts:75` sets `session.activeRecordingId = null` once a client Stop's handler returns. A start acknowledged during that Stop has just set it to the new recording (`commands.ts:41`).
   - **Effect.** The gateway session then reports no active recording while the bridge records the new one.
   - **Who reads it.** The bridge does not: its own `stopRecording` passes the recording id explicitly. But `stopRecording(sessionId)` in `client-gateway/service/commands.ts` falls back to it when given no id (`commands.ts:48`), and the session snapshot shows it.
   - **The window is longer now,** because the chain and the Stop wait make a client Stop take longer.
   - **The fix** is to clear it only when it still names the stopped recording. That needs a brief owning `client-gateway/service/inbound.ts` and its test.
2. **The framework reference needs regenerating** once `g-core-withholding-execution`'s `text-withholding.ts` export settles. Until then `pnpm docs:check` fails.
3. **A behaviour change:** a client Stop naming a recording other than the open one now leaves the open recording in place. Before, it dropped the bridge's entry and left that recording open in the service but unreachable. Only the restart rows cover this, not the mismatched-name case on its own.
4. **Scripts.** `gcbo-run-mutations.sh` (the first run, reported above) and `gcbo-amend-mutations.mjs` (this amendment) are both in the scratch folder.

### Follow-up — a client Stop keeps the id of a start opened during it (`inbound.ts`)

This closes open question 1 above, as the coordinator's second follow-up asked.

**The path in the grant was wrong.** The coordinator named `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\client-gateway\service\inbound.ts`, which does not exist: that folder holds only `bridge.ts`, `index.ts`, the write-order module and `tests/`. The file I cited, holding the client-Stop handling at `:75`, is `F:\!FluxIQ\packages\fluxiq\src\client-gateway\service\inbound.ts`. I edited that file, and only its client-Stop branch.

**Outcome: Done.**

**What changed.**
- **`packages/fluxiq/src/client-gateway/service/inbound.ts`** (97 lines to 98). After a `client.stop_recording`'s handlers return, the gateway session's `activeRecordingId` is cleared only if it still equals the Stop's `recordingId`. That field is a required string in `ClientGatewayStopRecordingRequest`.
  - **Before,** it was set to `null` unconditionally. So when the bridge opened the next recording during the Stop, the acknowledgement set the id (`commands.ts:41`) and the inbound handler then wiped it.
  - **Side effect:** a session that never had an active recording keeps `undefined` after a Stop, instead of being set to `null`.
- **`packages/fluxiq/src/client-gateway/tests/service.test.ts`** (239 lines to 259). One new row: "keeps the recording a start opened while a client Stop was being handled as the session's active recording". It needs no Automation Studio code.
  1. A paired client has `recording.first` active.
  2. A test event handler calls `gateway.startRecording(..., { recordingId: "recording.next" })` the first time a `client.stop_recording` is handled, as the bridge can.
  3. After Stop for `recording.first`, the session must report `recording.next`.
  4. After Stop for `recording.next`, it must report `null`, which guards against a fix that never clears.

  The row goes through both `ClientGatewayService` and `service/inbound.ts`, so it sits in the `tests/` folder of `client-gateway/`, the nearest directory holding both. No test file existed for `inbound.ts` on its own.

**Commands run and observed results.**
1. **Before editing,** today's files were copied aside: `inbound.ts` hashed to `8309f8d4…` and `service.test.ts` to `34427bf2…`.
2. **The whole test file.** `npx vitest run packages/fluxiq/src/client-gateway/tests/service.test.ts --no-file-parallelism` printed `exit=0`, `Test Files 1 passed (1)`, `Tests 11 passed (11)`. `inbound.ts` hashed to `3cd1bf549ce4f2166dab56ce2d5152678bd22ae53b767c82b7ddfe9f5a450385`.
3. **Mutation proof.** `node gcbo-inbound-mutations.mjs <scratch> 3cd1bf54…` exited 0. The script has the same safeguards as `gcbo-amend-mutations.mjs`: it hash-checks the file and the copy it sets aside, restores in a `finally`, and also restores on exit, SIGINT and SIGTERM.

   | Variant | Result | Quoted failure | Restore |
   | --- | --- | --- | --- |
   | Today's `inbound.ts` | `Tests 1 failed \| 10 skipped (11)` | `expected null to be 'recording.next' // Object.is equality` | `restored byte-identical` |
   | The unconditional `session.activeRecordingId = null;` put back | `Tests 1 failed \| 10 skipped (11)` | the same | `restored byte-identical` |

   The script ended with `final inbound.ts sha256=3cd1bf54…`, and a separate `sha256sum` printed the same.
4. **The gateway and recording vitest set.** These are the same 10 files as before; `service.test.ts` was already among them.
   - **First run:** `core vitest exit=1`, `Test Files 5 failed | 5 passed (10)`, `Tests 32 passed (32)`. Every failure was one esbuild transform error in a file I don't own: `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/service.ts:3529:14: ERROR: The symbol "routedFailedTraceAttempt" has already been declared`. `g-core-withholding-execution` was editing that file. The five failing files all import it, so none of their tests ran.
   - **Rerun once, alone:** `core vitest rerun exit=0`, `Test Files 10 passed (10)`, `Tests 78 passed (78)`.
   - **Web adapter test:** `web vitest exit=0`, `Test Files 1 passed (1)`, `Tests 3 passed (3)`.
5. **Core `pnpm check`,** with the scratch index (`scratch index new files: 3`).
   - **First run:** `exit=1` with `structure-audit: 1 violation(s) across 1 rule(s)`. The only failure was `FAIL [file-lines] packages/fluxiq/src/programs/automation-studio/runtime/service.ts: 6808 lines exceeds the 800-line limit… Baseline for this entry is 6807`. That is `g-core-withholding-execution`'s file, mid-edit.
   - **Rerun once:** `pnpm check rerun exit=0`, `# fail 0`, `structure-audit: passed (121 warning(s), 256 baselined)`. `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web` each printed `check: Done`.
6. **`pnpm docs:check`** was not run, and the framework reference was not regenerated, as the coordinator instructed.
7. **Core `git status --short`,** filtered to this work's paths, lists:
   - modified: `client-gateway.md`, `client-gateway/service/inbound.ts`, `client-gateway/tests/service.test.ts`, `bridge.ts` and `tests/bridge.test.ts`;
   - untracked: `client-recording-write-order.ts` with its test, and `tests/bridge-restart.test.ts`.

**Faulty RAM.** Both first-run failures had a concrete cause in another worker's file, which was being edited at the time. Neither was a uniform or impossible failure. Both reruns passed. The mutation failures are single observations with real assertion diffs.

**Not verified.**
- **No end-to-end row.** No test combines the bridge with the gateway session id. `bridge-restart.test.ts` does not assert the session's `activeRecordingId`.
- **Nothing live.** The Connected Clients view and the extension were not exercised.
- **Whether anything relied on `null`** after a Stop with no active recording (rather than `undefined`). None of the 10 test files or the type checks did.
