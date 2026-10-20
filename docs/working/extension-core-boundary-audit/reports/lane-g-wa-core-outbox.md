# Report: lane-g-wa-core-outbox

## Outcome

Done. Core `packages/client-gateway-websocket/src/outbox/` exists with the offline queue as specified under
"Queue semantics" in `lane-g.md`, no browser concept, tests written first and passing.

## What changed and why

All in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`, under
`packages/client-gateway-websocket/src/outbox/` only (`src/index.ts` untouched; the lead adds
`export * from "./outbox/index.ts";`).

- `types.ts`: `ClientGatewayOutboxBinding`, `ClientGatewayOutboxEntry`, `ClientGatewayOutboxState`,
  `ClientGatewayOutboxStore`, `ClientGatewayOutboxContext`, as briefed. The binding's doc comment says `session`
  is the trust lineage, not the wire `sessionId`.
- `binding.ts` `clientGatewayOutboxBinding(message, session, context)`: the payload's string `recordingId`, else
  `context.recordingId`, else `null`; project from the context. A non-string `recordingId` is ignored.
- `deliverable.ts` `clientGatewayOutboxDeliverable(entries, current)` -> `{ deliver, dropped }` (arrays, queue
  order). Same lineage and project, and recording `null`, the current one, or one whose `client.stop_recording`
  is queued under the same lineage and project.
- `lineage.ts` `clientGatewayLineageAfterReady({ stored, resumed, mint })`: `stored` when `resumed` and `stored`
  is non-empty, else `mint()` (not called when kept).
- `outbox.ts` class `ClientGatewayOutbox(store, { limit = 1000 })`. Throws on a limit that is not a positive
  whole number. `enqueue` -> size, newest `limit` kept. `flush(current, send)` -> `{ delivered, dropped }` as
  **counts**. It writes the drops first (only when something was dropped), sends in order, and on a send
  failure writes the undelivered matching tail (the failed entry first) and rethrows. Otherwise it writes an
  empty entry list (only when something was delivered). The lineage is kept on every write.
  `actionResult(commandId, session)` returns the first current-lineage `client.action_result` for that command,
  with `interrupted` read as `unknown`; its return type is contracts' `ClientGatewayActionResult`.
  `removeRecordingEvent(eventId)` -> count, across all lineages, as downstream `removeQueuedRecordingEvent` does.
  `size()`, `lineage()`, and `setLineage(id)` (entries untouched).
  Every operation runs on one promise chain (`then(() => undefined, () => undefined)` as the tail), so a failed
  operation does not block later ones. The class doc and `flush` doc say `send` must not call back into the
  outbox, because that would deadlock.
- `memory-store.ts` `clientGatewayMemoryOutboxStore()`: copies the state object and entry array on write and on
  read. The copy is shallow: entries are shared and never mutated. A first version used `structuredClone`,
  which made the 1,000-entry cap test take 12 s because the work grows quadratically. The shallow copy still
  guards the property the brief cares about, that no caller can add, remove or reorder stored entries.
- `index.ts` barrel.
- `tests/`: `binding.test.ts` (4), `deliverable.test.ts` (9), `lineage.test.ts` (4), `memory-store.test.ts` (3),
  `outbox.test.ts` (16), plus a non-test support file `tests/messages.ts` with synthetic message builders (no
  tokens, no page data).

## Commands run and observed results

All from the Core worktree root.

- Before the source existed, `pnpm --filter @fluxiq/client-gateway-websocket exec vitest run src/outbox`
  printed "5 failed (5)" with the error "Failed to load url ../index.ts".
- After writing the source, the same command printed "Test Files 5 passed (5), Tests 36 passed (36)". The final
  run took 3.26 s, with 71 ms of that in the tests.
- `pnpm --filter @fluxiq/client-gateway-websocket check`
  - First run: 24 `error TS` lines, all in W-B's in-progress `src/{host-lease,reconcile,session-pick,storage-area}`
    (missing `../index.ts` barrels). Filtering those paths out left nothing, so outbox had no type errors.
  - Later run: 7 errors, still all W-B's.
  - Final run: no errors. The build cache said "inputs and outputs match the stamp", which means a full
    passing check had run on this tree, apparently once W-B's files were complete.
- `pnpm structure:check`
  - First run: 1 violation, `[failure-as-empty] outbox.ts`, because the chain tail used `.catch(() => undefined)`.
    I changed it to `then(() => undefined, () => undefined)`.
  - Rerun: "structure-audit: passed (407 warning(s), 1152 baselined)", and the output did not mention any
    `outbox` path.

## Not verified

- The package `build` (dist) did not run, and outbox is not yet exported from the package barrel; both are the
  lead's step.
- I did not run the full package vitest suite, only `src/outbox`, as the brief said.
- Nothing downstream uses this yet (W-D).

## Open questions or contradictions found

- The brief did not say whether `flush`'s `{ delivered, dropped }` are counts or entry lists. I chose counts. W-D
  can ask for lists if the adapter needs them (`clientGatewayOutboxDeliverable` already returns lists).
- `removeRecordingEvent` ignores lineage, matching today's downstream behaviour. An entry from another lineage
  would be dropped at the next flush anyway.
- `lineage.ts` treats an empty stored string as absent and mints a new lineage.
