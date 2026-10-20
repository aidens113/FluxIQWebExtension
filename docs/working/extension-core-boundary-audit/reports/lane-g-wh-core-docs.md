# Report: lane-g-wh-core-docs

## Outcome

Done. All three Core documents now describe what `@fluxiq/client-gateway-websocket` owns, as it stands today.

## What changed and why

All edits are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`:

- `packages/client-gateway-websocket/README.md`: rewritten. It opens with a summary of the client half and names the web extension only as one host. It then has one usage section per capability: Transport (the open deadline and `FluxIQClientGatewayOpenError` codes), Reconnecting connection (states, backoff defaults, heartbeat versus `keepAlive`, `on` across sockets, open-failure wording, a constructor example), Outbox (trust lineage and why it is not the wire `sessionId`, the binding, the flush rule, the count cap, the byte budget, the loss record and its `client.outbox.entries_lost` `client.error` marker, how a refused write degrades, the host-supplied store, `actionResult`), Command reconciliation, Host-lease fencing, Storage area, and Session pick (with an example). The license section is kept.
- `docs/architecture/automation-studio/client-gateway.md`:
  - Rewrote the package bullet at the top, which said "small typed client package". It now names the client half and links to the new section.
  - Corrected "the `client-gateway-websocket` package is a client transport" in the server-transport section to "the client half ... and holds no server code".
  - Added a `## Client half` section after the connection flow. It covers the connection, the trust lineage with Core's reasons (`recordingOwnerKey`, a new `sessionId` per socket, the token rotating on resume), the outbox, reconciliation (linked to the existing "Interrupted and late action results" section), host-lease fencing, the storage area, and the session-pick rule (`requireReady`). It also states that no wire message is specific to the client half.
- `docs/architecture/package-boundaries.md`: the package table row described the package's contents ("WebSocket transport and browser-facing client helpers"). It now lists the parts. Nothing else in that file changed.

## Commands run and observed results

- I read every non-test file under `packages/client-gateway-websocket/src/**` before writing.
- Every name I wrote, checked with grep for an exported symbol under `src/` (tests excluded): all 20 symbols cited were found (`clientGatewayOpenFailureMessage` ... `FluxIQClientGatewayOpenError`). I also checked the defaults in the source: 1,000 / 30,000 / 20,000 ms, limit 1,000, open timeout 10,000 ms, and the prefixes `fluxiq.inFlight.`, `fluxiq.commandSeen.` and `fluxiq.hostLease.`, with a seen limit of 64.
- Core names cited in the architecture doc, checked with grep: `recordingOwnerKey` is in `packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts`; `requireReady` is in `client-gateway/service/commands.ts` and `command-ledger/dispatch.ts`; `server.reconcile_command` is in `packages/contracts/src/client-gateway.ts`. `ClientGatewayClientType` includes `"extension"`, which the session-pick example uses.
- `node scripts/structure-audit.mjs` (in the Core worktree) printed `structure-audit: passed (409 warning(s), 1152 baselined).` The warnings are pre-existing file-line advisories in unrelated files.

## Not verified

- The README code examples were not type-checked. They are illustrative and use placeholder variables (`tokenStorage`, `publish`, `showError`, `gatewayView`). The connection example's `hello` copies the transport example that was already in the README.
- No link checker was run. The relative README link from `docs/architecture/automation-studio/` (`../../../packages/client-gateway-websocket/README.md`) and the `#client-half` and `#interrupted-and-late-action-results` anchors were checked by eye only.
- No migration note was added to package-boundaries. The brief did not ask for one, and the package version is the supervisor's decision.

## Open questions or contradictions found

- None in the source compared with the brief's Queue semantics. One point is outside these docs: the brief's Facts describe the downstream extension's storage choice (`chrome.storage.session`, and removing the old `fluxiq.queuedEvents`). Core only says that the host chooses the store's lifetime, which is correct for Core.
