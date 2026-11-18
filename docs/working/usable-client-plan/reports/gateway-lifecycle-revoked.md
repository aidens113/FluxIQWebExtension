# t949 gateway-lifecycle revoked test

Outcome: Done. The test was stale; the product is right.

## Why
Core c6851d9d6 (t929) made a hello carrying a credential revoked by a person or Core be told `server.revoked`, then `server.disconnect`, and closed (`ClientGatewayLifecycle.refuseRevoked`). No pairing is offered, so a revoked browser raises no request on its own. Only a credential-reuse revocation (`credential_reused`), an expired credential, or a refused credential still gets `pairing_required`. The failing assertion (line 41) revoked a client with "synthetic operator revoke", which `clientGatewayRevokedFor` maps to `revoked_by_user`, then expected `pairing_required` on the next hello. The old state contradicts the t929 rule, so the assertion was the bug. The third test in the file (reused obsolete credential then hello -> `pairing_required`) is the reuse exception and still passes unchanged.

## Change
`packages/fluxiq/src/platform/browser-trust/tests/gateway-lifecycle.test.ts`: the hello with the operator-revoked credential, from a freshly restarted gateway over the reopened durable store, now asserts status `disconnected`, outbound contains `server.revoked` and `server.disconnect`, does not contain `server.pairing_required`, and `snapshot().pairings` is empty. Rule checked: a revoked credential is told and closed, never offered pairing, and this holds across a gateway restart because the revocation is durable. No product or extension files changed.

## Commands
- `heavy-slot run t949 -- npx vitest run src/platform/browser-trust src/client-gateway/service` -> Test Files 50 passed (50), Tests 394 passed (394).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (552 warning(s), 911 baselined).`
- `heavy-slot run t949-check -- pnpm --filter fluxiq check` -> tsc step `fluxiq:check` completed and stored (88918 ms), no errors printed; wrapper exit 0.

## Not verified
Did not run the whole Core suite. Did not rebuild contracts/sdk (not needed; no source changed).
