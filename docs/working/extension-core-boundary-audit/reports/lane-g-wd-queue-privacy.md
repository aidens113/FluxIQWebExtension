# Report: lane-g-wd-queue-privacy (W-D, Unit 1)

Worker report for brief "lane-g-wd-queue-privacy" in [lane-g.md](lane-g.md). Downstream worktree
`fxwork/t726/!FluxIQWebExtension`, branch `task/t726-gateway-client-into-core`. No commits. Nothing in Core
was edited or rebuilt.

## Outcome

Partial. All of Unit 1 is implemented and its tests pass. One file outside my ownership, which I did not
edit, no longer type-checks under `tsconfig.test.json`:
`apps/extension/src/background/connection/host-lease/tests/gateway-carriage.test.ts:48` still passes the
removed `queue:` dep (`TS2353 ... 'queue' does not exist in type 'GatewaySessionDeps'`). It still runs and
passes, because esbuild does not type-check. The fix is to replace that one line with
`outbox: new ClientGatewayOutbox(clientGatewayMemoryOutboxStore()), queueContext: () => ({ projectId: null, recordingId: null }),`
and import those two names from `@fluxiq/client-gateway-websocket`. The brief's
`tsc -p tsconfig.json` gate is clean because that config excludes `src/**/tests/**`.

## What changed and why

- **Store at a different path from the brief (deviation).** The brief named
  `background/connection/outbox-store.ts`. `background/connection/` and `connection/tests/` each already hold
  25 source files, which is the hard `directoryFiles` limit, so one more file in either would fail the
  structure audit. The store is therefore `background/connection/outbox/store.ts` (`extensionOutboxStore(area,
  { onRepaired? })`), with the barrel `outbox/index.ts`, the test `outbox/tests/store.test.ts`, and the
  connection barrel line `export { extensionOutboxStore } from "./outbox/index"`. The state is kept under
  `fluxiq.outbox` in a `ClientGatewayStorageArea`. Each read goes through `readSavedOutbox`. A repaired state
  is written back and reported by field name only.
- `saved-state.ts`: `readSavedQueue` is replaced by `readSavedOutbox`. It keeps a non-blank lineage string.
  It keeps an entry only when its binding is whole (a `session` string, plus `projectId` and `recordingId`
  that are each a string or `null`) and its message names a type. It names `outbox`, `outbox.lineage` or
  `outbox.entries` when it repairs.
- `storage.ts`: the four local-storage queue functions are gone. Two functions are new:
  - `discardPersistentQueue()` removes `fluxiq.queuedEvents` from `chrome.storage.local`.
  - `reportSavedStateRepair(key, fields)` is the existing repair warning plus problem-log note, pulled out so
    the outbox store can use it. The private `repaired` helper now calls it.
- `background/index.ts`: calls `discardPersistentQueue()` at worker start (failures go to the problem log).
  `statusWithQueue` now calls `manager.refreshQueueSize()` and returns `manager.status()`; the old reader is
  gone.
- `connection/gateway-session.ts`:
  - **Deps.** `queue` is replaced by `outbox: ClientGatewayOutbox` and `queueContext()`, plus an optional
    `mintLineage` that tests use to fix the minted id (default `crypto.randomUUID()`). The
    `GatewayEventQueue` type is removed from the module and its barrel.
  - **Lineage.** Each socket records whether its hello carried a token and whether
    `server.pairing_required` arrived on it. On `session_ready`, `adoptLineage` calls
    `clientGatewayLineageAfterReady` against `outbox.lineage()`, stores the result, and only then calls
    `onSessionReady`. If the lineage cannot be read, a fresh lineage is kept in memory and the error is
    reported, so the session is still reported ready.
  - **Offline send.** The context is captured synchronously. The message is then queued with
    `clientGatewayOutboxBinding(message, currentLineage, context)`. `currentLineage` is the lineage in
    memory, else the stored one, else `""`.
  - **flushQueue.** Calls `outbox.flush({ session, ...queueContext() }, send on this socket)` and refreshes
    the queue size in a `finally` block.
  - **Other methods.** `queuedActionResult` is now `outbox.actionResult(commandId, currentLineage)`. Two
    methods are new: `removeQueuedRecordingEvent(eventId)`, and `refreshQueueSize()`, which publishes status
    only when the size changed.
- `connection.ts`: builds `new ClientGatewayOutbox(extensionOutboxStore(inFlightRecordArea(), { onRepaired
  }), { limit: MAX_EVENT_QUEUE_SIZE })`. `queueContext` takes the project from
  `projects.activeRecordingProject() ?? session.projectId ?? null` and the recording from
  `recording.recordingId() ?? null`. `removeRecordedStep` now calls `gateway.removeQueuedRecordingEvent`.
  The new `refreshQueueSize()` delegates to the gateway.
- Tests:
  - `tests/saved-state.test.ts`: the queue case is replaced by two outbox-reader cases.
  - New `tests/storage-queue-discard.test.ts`: the old key is removed, other keys are kept, and a second
    call is harmless.
  - `connection/tests/gateway-session.test.ts`: the harnesses now share `harnessDeps()`.
    `queuedActionResult` is filtered by lineage. Seven new tests cover:
    - the lineage is kept on a token resume and is in place before `onSessionReady` runs;
    - a new lineage is minted after pairing, even when the hello carried a token;
    - a new lineage is minted when the hello carried no token;
    - an offline send records its binding;
    - a flush delivers matching entries in order (none, current, and ended-in-queue recordings) and drops
      entries from another lineage, project or recording;
    - `removeQueuedRecordingEvent`;
    - `refreshQueueSize`.
- `e2e/reconnect.spec.ts`: the malformed case now expects `fluxiq.queuedEvents` to be removed at start
  (`toBeUndefined`). It also seeds a malformed `fluxiq.outbox` in `chrome.storage.session` and expects it
  repaired to `{ entries: [] }` with `queueSize` 0.

## Commands run and observed results

- Before implementing (tests first): `EXTENSION_TEST_BUILD_LABEL=lane-g-wd node
  apps/extension/scripts/test-extension.mjs background/tests/saved-state
  background/connection/tests/gateway-session background/connection/outbox/tests
  background/tests/storage-queue-discard`. It failed: `Could not resolve "../index"` (the store did not
  exist yet).
- After implementing, the same command plus `background/tests/storage-settings`,
  `background/connection/host-lease/tests/gateway-carriage` and
  `background/connection/tests/server-command-channel` printed `# tests 44 / # pass 44 / # fail 0`
  (exit 0).
- Same runner with `background/tests/connection-status`, `background/tests/scripted-navigation-control`,
  `background/tests/recording-evidence-pipeline` and `background/tests/extraction` printed
  `# tests 69 / # pass 69 / # fail 0` (exit 0).
- `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit` printed no output
  (clean). I re-ran it after the final import tidy.
- `npx tsc -p tsconfig.test.json --noEmit`, run from `apps/extension`, printed exactly one error: the
  `gateway-carriage.test.ts:48` error above. It reported nothing in my files or in `e2e/reconnect.spec.ts`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (215 warning(s), 638 baselined)`
  (exit 0). The baseline run before my changes printed 213 warnings. The two new advisory warnings are
  `GatewaySession has 28 methods` (advisory threshold 25) and `gateway-session.test.ts: 432 lines`
  (advisory threshold 400).

## Not verified

- `e2e/reconnect.spec.ts` was not run (Playwright excluded by the brief).
- No live browser check of session-storage persistence across a real service-worker restart. No check of
  the Firefox fallback to worker memory.
- No check that the discard at start finishes before the spec reads local storage. Storage operations in
  one area are ordered, but this is untested.
- No full suites were run.

## Open questions or contradictions found

1. **Session storage quota.** `chrome.storage.session` has a quota of about 10 MB (1 MB before Chrome 112).
   A full 1,000-entry outbox of large recording events could exceed it. `enqueue` would then reject and
   `send` would throw, where the old `chrome.storage.local` queue had more room. The cap may need to be by
   bytes as well as by count.
2. **Every read loads the whole area.** The `ClientGatewayStorageArea.get(null)` port returns every
   session-storage item, including in-flight and lease records, on each outbox read. That is correct but
   does more work than needed. A keyed `get` on the port would avoid it (Core change, Unit 2).
3. **gateway-carriage test.** It needs the one-line change described under Outcome, by whoever owns
   `host-lease/**`.
