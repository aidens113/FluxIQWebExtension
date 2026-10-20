# Report: lane-g-wb-core-ledgers

## Outcome

Done. Four new browser-free directories in Core's `packages/client-gateway-websocket/src/`, written tests first. The tests were run red (12 files failed because `../index.ts` did not exist yet), then green.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ/packages/client-gateway-websocket/src/`. Each file exports one thing, each directory has an `index.ts` barrel, and imports use `.ts` specifiers. I did not touch `src/index.ts`, `src/outbox/`, `src/connection/` or the downstream tree.

- `storage-area/`: `area.ts` holds the `ClientGatewayStorageArea` type (`get(keys: null)`, `set(items)`, `remove(key: string)`). `memory-area.ts` holds `clientGatewayMemoryArea()`, which copies each value with `structuredClone` as it is set.
- `reconcile/`:
  - `types.ts`: `ClientGatewayCommandPlace` (`Record<string, string | number>`) and `ClientGatewayInFlightRecord { commandId, actionType, committing, startedAt, place? }`.
  - `record-store.ts`: `ClientGatewayInFlightRecordStore(area, { keyPrefix = "fluxiq.inFlight." })`. It reads each field and checks it. A `place` that is not a flat map of strings and numbers is dropped, and the rest of the record is kept.
  - `seen-store.ts`: `ClientGatewaySeenCommandStore(area, { keyPrefix = "fluxiq.commandSeen." })`. It keeps the newest 64 ids.
  - `answer.ts`: `clientGatewayReconcileAnswer` and `ClientGatewayCommandKnowledge`. It returns the contracts type `ClientGatewayReconcileAnswer`.
  - `command-reconciliation.ts`: `ClientGatewayCommandReconciliation`, plus the `...Deps` type and `ClientGatewayRepeatAnswer`. It behaves the same as downstream, with these changes:
    - The signature is `begin({ commandId, actionType, parameters? }, place?)`.
    - `placed(commandId, place)` replaces `dispatched`. The new place replaces the old one completely, the same way downstream dropped `documentId` when it was absent. There is no `documentOf`.
    - New deps: `commits(actionType, parameters)`, `interruptedResult(record, completedAt)` and `notSeenResult(commandId, at)`. The `notSeenResult` dep builds the whole refusal result, including any `payload.status: "not_seen"` marker. The caller supplies that marker; Core does not add it.
    - The 16 recent results and 64 disowned ids work exactly as downstream.
- `host-lease/`:
  - `types.ts`: the refusal-code, reading and judgement types.
  - Functions: `reading.ts` `clientGatewayHostLeaseReading`, `judgement.ts` `clientGatewayHostLeaseJudgement`, `refusal-code.ts` `clientGatewayHostLeaseRefusalCode` and `refusal.ts` `clientGatewayHostLeaseRefusal`.
  - `ledger.ts`: `ClientGatewayHostLeaseLedger(area, { keyPrefix = "fluxiq.hostLease." })`, with `admit` and `verdict`, plus the Admission, Verdict and Options types.
  - The refusal codes come from contracts' `CLIENT_GATEWAY_HOST_LEASE_REFUSAL_CODES` (a value import from `@fluxiq/contracts/client-gateway`), so there is no restated copy. The refusal messages now say "client" where they said "browser".
- `session-pick/`:
  - `types.ts`: `ClientGatewaySessionCriteria { clientType, serves(capability), alsoDeclaring? }`.
  - `eligible.ts`: `clientGatewaySessionEligible`. A session is eligible when it is `ready`, has no `disconnectedAt`, is the given client type, has no truthy `activeRecordingId`, declares a capability `serves` accepts, and declares `alsoDeclaring` when one is named.
  - `pick.ts`: `pickClientGatewaySession(sessions, criteria & { requestedSessionId?: string | undefined })`. When an id is requested, it returns that session only if it is eligible and never falls back to another one, matching `gateway-output-dispatcher.ts` today. Otherwise it returns the session only when exactly one is eligible.
- Tests (12 files, 65 tests), one per subject, in each directory's `tests/`. They are ported from the downstream tests the brief named. They use generic action types (`demo.press`, `demo.type`) and fake outcome builders, with no tabs, frames, documents or web codes. Two-client restart cases share one memory area.
  - Added beyond the ports: custom key prefixes, a stored value under the prefix that is not a record or lease, `verdict` paths, a read fault with an empty memory, the no-seen-store `not_seen` case, the not-seen refusal sent through `notSeenResult`, `placed` replacing the place, and `disconnectedAt` and `connected` refusal in the session pick.

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`.

- `pnpm --filter @fluxiq/client-gateway-websocket exec vitest run src/storage-area src/reconcile src/host-lease src/session-pick`
  - Before the sources existed: `Test Files 12 failed (12)`, with "Failed to load url ../index.ts".
  - After: `Test Files 12 passed (12)`, `Tests 65 passed (65)`.
- `pnpm --filter @fluxiq/client-gateway-websocket check` printed `"build-cache":"reuse" ... "inputs and outputs match the stamp"` and exited 0. A cache reuse proves nothing, so I also ran the next command.
- `npx tsc --noEmit -p tsconfig.json` in the package directory: no output, exit 0. This covers every `src/**/*.ts`, including the other worker's `outbox/` as it stood then.
- `pnpm structure:check` printed `structure-audit: passed (407 warning(s), 1152 baselined)`. Grepping its output for my four directories found nothing (grep exit 1).

## Not verified

- The package barrel (`src/index.ts`) does not export the new directories yet; the lead adds those lines. Nothing has been built into `dist`.
- No downstream caller uses these classes yet; a later brief switches them over. The downstream originals are unchanged.
- The package-wide `vitest run` was not run. I scoped it to my directories as the brief said.

## Open questions or contradictions found

- The brief names the record field `place`, so I used it. Downstream's `tabId` and `documentId` become place keys, for example `{ tabId: 9, documentId: "..." }`. Records stored in session storage by an older build keep top-level `tabId` and `documentId` fields. The new store reads those records but drops the old fields. Nothing reads those fields when reporting, so this is harmless.
- The `ClientGatewayActionResult` type is used for results, as downstream does. The reconcile answer's `result` is the contracts' `ClientGatewayReportedActionResult`, which accepts it.
- `seen-store` keeps its 64-id limit as a constant, and `command-reconciliation` keeps its 16-result and 64-disowned limits as constants. None of them can be configured, as before.
