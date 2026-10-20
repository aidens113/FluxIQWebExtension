# Lane G, W-G: outbox byte budget and loss record

Brief: "Brief: lane-g-wg-outbox-budget" in [lane-g.md](lane-g.md). Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`, branch `task/t726-gateway-client-into-core`. No commits.

## Outcome

Done. Core's outbox now has a byte budget beside the count limit, an explicit loss record by reason,
never throws when the store refuses a write during enqueue, and reports the loss to the gateway as one
`client.error` marker sent before the surviving entries. The connection tells the host through
`handlers.onQueueLoss`. I wrote the tests first and saw them fail (22 failures) before I wrote the code.
The package was rebuilt last.

## What changed and why

All paths are under `packages/client-gateway-websocket/src/`.

- `outbox/loss/` (new directory; the structure audit refuses three `loss-` files side by side):
  - `reasons.ts`: `CLIENT_GATEWAY_OUTBOX_LOSS_REASONS = ["count_limit", "byte_budget", "write_failed"]`.
  - `types.ts`: `ClientGatewayOutboxLossReason`, `ClientGatewayOutboxLoss { count; byReason }`.
  - `merge.ts`: `clientGatewayOutboxLossMerge(...losses)` adds the counts reason by reason and returns
    `undefined` when nothing was lost.
  - `marker.ts`: `clientGatewayOutboxLossMarker(loss)` builds the `client.error` with
    `createClientGatewayMessage`. It sets `code: "client.outbox.entries_lost"`, the message "N queued
    messages were lost before they could be sent." (singular when N is 1), and `metadata: { count,
    byReason }`. It carries nothing else.
  - `index.ts`: the barrel.
- `outbox/types.ts`: adds `ClientGatewayOutboxEntry.bytes?` and `ClientGatewayOutboxState.lost?`. The
  loss types live in `loss/types.ts` (see the deviation below).
- `outbox/entry-bytes.ts` `clientGatewayOutboxEntryBytes(entry)`: the UTF-8 length (`TextEncoder`) of
  `JSON.stringify({ binding, message })`. This is the default measure.
- `outbox/keep.ts` `clientGatewayOutboxKeep(entries, { limit, byteBudget })` returns `{ kept, loss }`.
  1. Any entry alone over the budget is removed (`byte_budget`).
  2. Then the oldest entries past `limit` are removed (`count_limit`).
  3. Then the oldest are removed until the total fits (`byte_budget`).
  The order of what is kept never changes.
- `outbox/outbox.ts`:
  - Constructor: `ClientGatewayOutbox(store, { limit = 1000, byteBudget = Infinity, measure? })`. The
    options type is exported as `ClientGatewayOutboxOptions`. A budget that is NaN or not above 0 is
    refused.
  - `enqueue`: measures the new entry once and stores the size in `bytes`. A stored entry without
    `bytes` is measured at this point. It keeps the newest entries within both limits and adds what it
    dropped to `state.lost`.
  - When the store refuses a write during enqueue, it drops the oldest half (rounded up) of what it
    would keep, counts them `write_failed`, and retries, down to no entries. If even an empty write is
    refused, the store keeps its old state and only the new entry is counted lost (`write_failed`, or
    `byte_budget` if it was oversize). That loss is held in memory and merged into the next write of any
    kind that succeeds. The return value is the size the store still holds.
  - `flush` returns `{ delivered, dropped, lost }`. The steps:
    1. Drops are written first, carrying the loss.
    2. If a loss is recorded, the marker is sent next. A failure here rethrows and keeps both the loss
       and the entries.
    3. Only after the marker is sent are the held loss and the stored loss cleared, in a write made
       straight away.
    4. Then the entries are sent, keeping the existing tail-on-failure rule.
  - `lost()`: the stored loss merged with the held loss.
  - `setLineage` and `removeRecordingEvent` keep `lost` and merge in any held loss. The old
    `withEntries` helper, which would have dropped `lost`, is replaced by one private `persist`.
- `outbox/index.ts`: adds `entry-bytes`, `keep`, `loss/index`.
- `connection/types.ts`: adds `handlers.onQueueLoss?(loss)`.
- `connection/connection.ts`: `flushQueue` calls `onQueueLoss` after a flush that reported a loss, once
  the queue size has been refreshed. It is not called when the flush threw. The public API is otherwise
  unchanged.
- Tests:
  - New: `outbox/tests/budget.test.ts` (10 tests), `outbox/tests/write-failure.test.ts` (4),
    `outbox/tests/loss-flush.test.ts` (8), `outbox/tests/keep.test.ts` (3),
    `connection/tests/queue-loss.test.ts` (3).
  - Changed: `connection/tests/harness.ts` gained `outboxLimits` and records `onQueueLoss` into
    `losses`. The new connection tests went into their own file because `connection.test.ts` is
    already over the 400-line advisory threshold.
  - All payloads are synthetic. There are no tokens and no page data.

## Commands run and observed results

- Before the code: `npx vitest run src/outbox src/connection` printed "Test Files 4 failed | 8 passed
  (12)", "Tests 22 failed | 78 passed (100)".
- `npx vitest run` in `packages/client-gateway-websocket` printed "Test Files 27 passed (27)", "Tests
  178 passed (178)".
- `npx tsc --noEmit -p tsconfig.json` in the package: exit 0.
- `node scripts/structure-audit.mjs` (Core root): exit 0, "structure-audit: passed (409 warning(s), 1152
  baselined)". The package's only warnings are the two that existed before this brief: the connection
  class has 32 methods, and `connection.test.ts` has 422 lines. Two earlier audit runs failed on my
  layout and I fixed both:
  - naming: three `loss-` files, moved into `loss/`;
  - imports: files reached into `loss/` past its barrel, now imported through `./loss/index.ts`.
- `pnpm --filter @fluxiq/client-gateway-websocket build`: exit 0. The build cache said "inputs changed
  ... stored". `dist/outbox/loss/*` exists, and `dist/connection/types.d.ts` contains `onQueueLoss`.

## Not verified

- No downstream typecheck or tests were run against the new dist, because another worker owns that tree.
  The API change is additive, except that `flush`'s result gained a `lost` field.
- A store `read` that throws still throws out of every operation. The brief covered write failures
  only.
- No live browser run, and no real `chrome.storage.session` quota behaviour. The write-failure path was
  tested only with a fake store that refuses writes.

## Open questions or contradictions found

1. **The downstream reader discards the loss record.** `apps/extension/src/background/saved-state.ts`
   `readSavedOutbox` builds a fresh state from `lineage` and `entries` only. Any `lost` that Core stores
   is therefore dropped on the next read, and the extension would never send the marker after a reload.
   It keeps each entry's `bytes`, because it filters the original entry objects. A downstream follow-up
   is needed:
   - carry `lost` through, repairing a malformed one;
   - pass `byteBudget` from the storage quota;
   - wire `onQueueLoss`.
   Entries that the repair drops as malformed are not counted as lost. The follow-up may want to count
   them, probably under a new reason.
2. **Deviation from the brief: where the loss types live.** The brief put `ClientGatewayOutboxLossReason`
   and `ClientGatewayOutboxLoss` in `outbox/types.ts`. They live in `outbox/loss/types.ts` instead, so
   that `loss/` imports nothing from its parent and no type cycle appears. Both names are still exported
   from the package root through the barrels.
3. **The loss is not bound to a lineage.** It is one counter, reported by whichever lineage flushes
   next. A loss recorded under a trust lineage that later had to pair is reported under the new trusted
   client. It carries only counts, so no data crosses, but Core may file the marker in the new client's
   active recording. Say if it should be bound like an entry.
4. **The byte budget covers entries only.** The lineage and the loss record are outside it, so the host
   should pass its quota minus some headroom. This is documented on `ClientGatewayOutboxOptions.byteBudget`.
5. **A possible duplicate marker.** If the write that clears the loss after the marker was sent itself
   fails, `flush` throws and the stored loss stays, so the next flush sends the marker again.
