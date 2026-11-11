# t907 Managed-Host Enrolment (briefs B1 + B4): Worker Report

Worker report, 2026-11-11. Implements design section A (Core) and "Extension (redeeming during connect)" from `design.md`, with the lead's decisions: the hello keeps `clientType: "extension"`, Core records the role from the redeemed ticket (`managedHostId`), and a refusal never falls back to pairing.

## Outcome

Done, with three deviations from the design. Each is recorded below and needs the lead's review.

1. **`connection/` forward (outside owned paths).** I made a two-line additive edit in two Core files outside my owned list: `packages/client-gateway-websocket/src/connection/{types,connection}.ts`. The extension's `GatewaySession` extends `FluxIQClientGatewayConnection`, which builds the transport client itself. Without forwarding the new `enrolment` option there, B4 cannot pass `enrolment: { take }` as the design says. Nothing else touches that package.
2. **Facade shape.** The three facade methods are on a public field, `clientGateway.managedHosts`, and not on `ClientGatewayService` itself. Adding them took the facade to 43 methods, and the structure audit refuses more than 40 (`class-methods` FAIL). The method names and signatures are unchanged: `managedHosts.issueHostEnrolment(input)`, `managedHosts.revokeManagedHost(hostId, reason?)` and `managedHosts.revokeStaleManagedHosts()`. The precedent is the existing public `access` field. **B2 must call `gateway.managedHosts.*`.**
3. **Fifth refusal code.** I added `enrolment.revoked` beside the design's four codes. It is returned for a ticket that a newer ticket for the same host replaced. The extension treats every `enrolment.*` code alike.

## What changed and why

### Core (`!FluxIQ`)

- **`packages/contracts/src/client-gateway.ts`** (additive): `ClientGatewayClientHello.enrolmentTicket?`, `ClientGatewaySession.managedHostId?`, `ClientGatewayTrustedClient.managedHost?`, and a new `ClientGatewayManagedHost` type (`{hostId, profile: "fresh"|"named"}`). The package goes from `0.19.0` to `0.20.0`. The global rule asks for a minor bump below 1.0, and Core's AGENTS.md has no versioning section. Neither version is on npm.
- **`client-gateway-websocket`**:
  - `types.ts`: new `FluxIQClientGatewayEnrolmentSource { take() }` and option `enrolment?`. `client` now omits `enrolmentTicket`, so a ticket can only come from `enrolment`.
  - `transport.ts`: the hello carries `enrolmentTicket` only when it has no token, and calls `take()` at most once per hello.
  - `connection/{types,connection}.ts`: forwards `enrolment` (deviation 1).
  - The package goes from `0.1.1` to `0.2.0`.
- **`fluxiq/src/client-gateway/service/trust-grant.ts`** (new, `ClientGatewayTrustGrant`): this is the trust-granting tail of `pairing-flow.ts` `complete()`, moved here. It runs in this order:
  1. registers the trust;
  2. checks the late refusal, and revokes and throws if the session stopped waiting;
  3. calls `endEarlierTrust`;
  4. runs the path's `bind`;
  5. attaches the session, sets its project and `pairedAt`;
  6. records the trace lifecycle;
  7. calls `custody.issued`;
  8. records `sentCredentialHash`;
  9. sends `server.session_ready`;
  10. writes the audit entry with `recordSecurity`;
  11. emits `session.ready`.

  Pairing and enrolment both call it. Pairing keeps its event names, audit fields and revocation reasons unchanged.
- **`pairing-flow.ts`**: `complete()` now calls `trustGrant.grant(...)`. The fields for trusted clients, events, trace and custody are removed because they are no longer used here.
- **`service/enrolment/`** (new):
  - `host-enrolment-tickets.ts` (`ClientGatewayHostEnrolmentTickets`):
    - Ticket format is `fxet_` plus 32 random bytes in base64url. Only the SHA-256 is kept.
    - A ticket is consumed on first presentation, whatever that presentation comes to.
    - Each host has one live ticket; issuing revokes the earlier one.
    - Ended tickets are remembered for one TTL after expiry, then forgotten.
    - The default TTL is 60 s.
  - `host-enrolment.ts` (`ClientGatewayHostEnrolment`, which implements `ClientGatewayManagedHosts`):
    - `enrol(session, ticket)` redeems the ticket and checks it against the declared domain. A ticket that passes goes through the trust grant as `FLUXIQ_MANAGED_HOST_PRINCIPAL`, recording `managedHost`, and audits `session.enrolled`.
    - A refused ticket audits `enrolment.refused` (code, hostId if known, sessionId, clientId, peer prefix), sends `server.error {code,message}` and `server.disconnect`, then disconnects.
    - A session that leaves while its trust is being saved has the trust revoked and is audited as `enrolment.abandoned`.
    - `revokeManagedHost` and `revokeStaleManagedHosts` both await `ready()` first.
  - `enrolment-refusal.ts`: the codes and their messages.
  - `managed-host-principal.ts`: `FLUXIQ_MANAGED_HOST_PRINCIPAL = "fluxnode.owner"`.
  - `types.ts`, `index.ts`, and `tests/`.
- **`lifecycle.ts`**:
  - `handleHello` redeems `hello.enrolmentTicket` before the token branch, then returns. There is no pairing fallback, and any token in the same hello is ignored.
  - `connect()` trace redaction gains `["hello","enrolmentTicket"]`.
- **`trusted-clients.ts`**: `register` accepts and persists `managedHost`.
- **`sessions.ts`**: `attachTrustedClient` copies `managedHostId` from the trust, or deletes it when the trust has none. `toPublic` exposes it through the existing spread.
- **`trace-tap/credential-fields.ts`**: `client.hello` now redacts `["payload","enrolmentTicket"]`.
- **`client-gateway/service.ts`**: builds the trust grant and enrolment, exposes `readonly managedHosts`, and exports `CLIENT_GATEWAY_ENROLMENT_REFUSALS`, `FLUXIQ_MANAGED_HOST_PRINCIPAL` and the request, ticket, managed-hosts and refusal-code types.
- **`service/index.ts`**: the barrel now exports `enrolment/` and `trust-grant.ts`.

### Extension (`!FluxIQWebExtension`)

- **`shared/protocol.ts`**:
  - New `ConnectRequest { settings?, enrolment?: { ticket } }`.
  - `ExtensionStatus.enrolmentRefusalCode?` carries Core's code while `connectionState` is `error`, and never the ticket.
- **`background/index.ts`**: `fluxiq.connect` reads `enrolment.ticket` (a non-empty string, or nothing) and passes it to `manager.connect({ enrolmentTicket })`. It is never merged into settings. The message stays control-page-only, because the gate is unchanged.
- **`background/connection.ts`**:
  - `connect(options)` calls `gateway.prepareConnect(ticket)` and then connects.
  - `status()` reports `error` with the failure's message and `enrolmentRefusalCode` while an enrolment failure stands. Whatever closes the socket afterwards, the status stays `error`.
- **`background/connection/gateway-session.ts`**:
  - **Ticket handling.** A private `EnrolmentAttempt` holds the ticket in memory only. `take()` hands it over once. `prepareConnect(ticket)` holds it and drops a stored token first, so a named profile whose resume failed spends its ticket. `prepareConnect()` with no ticket forgets the previous failure.
  - **No pairing while enrolling.** Auto-reconnect is off while an enrolment is pending, because a reconnecting hello would carry no ticket and so would pair.
  - **Failures.** Each of these ends the attempt: a `server.error enrolment.*`, a `server.pairing_required` during enrolment, or the current socket closing before `session_ready`. Ending it stops reconnecting, closes the socket and marks the connection `error`, so the launcher retries with a new ticket.
  - **Superseded sockets.** A close from a socket that the enrolment connect replaced is ignored. This was a bug I found and fixed in my own change; it has a test.
  - **Success.** On `session_ready` the token is stored exactly as pairing stores it, by the unchanged transport `tokenStorage.write` and `handleSessionReady`.

## Commands run and observed results

Core: the ones marked "via heavy-slot" ran through `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t907 -- "..."`.

- In `packages/fluxiq`, via heavy-slot: `pnpm exec vitest run src/client-gateway` printed `Test Files 63 passed (63)` and `Tests 474 passed (474)`. Of these, 9 tests are the tickets unit tests and 14 are `tests/host-enrolment.test.ts`.
- `pnpm --filter @fluxiq/contracts test` printed `Test Files 105 passed (105)` and `Tests 891 passed (891)`.
- `pnpm --filter @fluxiq/client-gateway-websocket test` printed `Test Files 27 passed (27)` and `Tests 187 passed (187)`, including the new transport and connection enrolment tests.
- Fluxiq typecheck, run with `NODE_OPTIONS=--max-old-space-size=6144 pnpm --filter fluxiq check`:
  - The first run failed with 2 errors, both in my new test file: an `exactOptionalPropertyTypes` mismatch and a listener that returned a number.
  - After fixing them, the re-run gave `FLUXIQ_CHECK=0`.
- `pnpm --filter @fluxiq/contracts check` and `pnpm --filter @fluxiq/client-gateway-websocket check` both completed with no errors.
- `node scripts/structure-audit.mjs`:
  - The first run printed `FAIL [class-methods] ... ClientGatewayService has 43 methods`, which led to deviation 2.
  - After the change: `structure-audit: passed (535 warning(s), 969 baselined)`.
  - The new warnings are only at-threshold advisories: the facade at 40 methods, and `service/` at 25 files.
- Builds, via heavy-slot, all exit 0: `CONTRACTS_BUILD=0`, `WS_BUILD=0`, `FLUXIQ_BUILD=0`, `SDK_BUILD=0`, `UI_BUILD=0`.
  - `sdk` and `ui-components` were rebuilt as well, because the extension's `core-build` gate reported both stale after the contracts change.
  - I checked that `dist/server/managed-hosts/index.d.ts` existed before building.

What the tests prove:

- A valid ticket gives `session_ready` with a token and `managedHostId`, and no pairing.
- Unknown, expired, used, revoked and domain-mismatched tickets (including a client that declares no domain) are each refused with their code, `server.disconnect` is sent, and the socket closes.
- A ticket is consumed on first presentation.
- Issuing a ticket revokes the host's previous live ticket.
- Neither the ticket nor the token appears in the trace, the audit, a security event or the snapshot. This was checked both for the inbound hello and for a hello handed over through `connect()`.
- `revokeManagedHost` and `revokeStaleManagedHosts` behave as designed, across a restart with a store.
- Abandonment revokes the trust.
- Pairing is unchanged: the existing `pairing-flow`, `trust-domain`, `service`, `credential-*` and `trace-tap` suites all pass.

Extension:

- `node ../../scripts/check/core-build.mjs`, then `EXTENSION_TEST_BUILD_LABEL=t907-enrol node scripts/test-extension.mjs src/background/connection/tests/gateway-session src/background/tests/connection-status src/background/tests/credential-messages src/background/tests/forget-pairing` printed `tests 30 pass 30 fail 0`. A narrower run listed each new test as `ok`: tests 11-17 (gateway-session enrolment) and 22-23 (status).
- `pnpm --filter @fluxiq-web-extension/extension build` exited 0 (`EXT_BUILD=0`). This includes `tsc -p tsconfig.json --noEmit` over the extension source, and it printed `chrome: verified 26 files`, `firefox: verified 26 files` and `e2e-chromium: verified 26 files`.
- `pnpm --filter @fluxiq-web-extension/extension check` **failed with exit 1**, printing 25 `error TS` lines. All 25 are in the test project, under `e2e/content/tests/offline-reads/` and `packages/test-runner/src/`. Each is `Cannot find module '@fluxiq-web-extension/domain/node'` or an implicit `any` that follows from it. **None is in `apps/extension/src`.** `domain/dist` does not exist in this worktree (`ls domain/dist`: No such file or directory). I did not build the domain, because that is outside this brief.
- `node scripts/structure-audit.mjs` (EXT) printed `structure-audit: passed (248 warning(s), 552 baselined)`. `FluxIQConnection` is at 40 methods (warn); I added no methods to it.

## Not verified

- **Extension check with the domain built.** The full `extension check` has not been seen to pass with `domain/dist` built (`pnpm --filter @fluxiq-web-extension/domain build` or the host build). The failures above are environmental, but I did not see a clean check.
- **Live browser.** Nothing ran in a browser: I did not load the extension, and enrolment ran against no real gateway socket. The browser-host worker (B6) and proof P1-P3 cover that.
- **Fluxiq version.** `fluxiq`'s own version was not bumped (0.45.0). Its `package.json` was not in my paths; the lead should bump it with B2/B3.
- **Full suites.** No full Core or extension suite ran beyond the commands above.
- **Rebuilt dist.** I rebuilt Core `dist` while other workers may be editing Core `src` (B2's `server/managed-hosts`), so the dist may go stale again for them.

## Open questions or contradictions found

1. **IAM: a managed host's program-API calls are refused (401), and this needs must-not-touch files.**
   - `server/program-route/handle-program-request.ts` authorises a token through `pairedClientActor` (`server/program-route/program-route.ts:218`). That function requires `session.operatorUserId` to be an **enabled user in the IdentityAccess directory, with a role**.
   - `fluxnode.owner` is not a directory user. A grep finds it only in `create-fluxnode-service.ts` and my principal constant. So every token call from an enrolled host returns `401 Authentication required`. This covers the capture-policy refresh after `session_ready`, the panel relays and chat, and `fetchProjectFromCoreSnapshot`.
   - `askCoreForFirstProject` posts to `/api/client-gateway/first-project`. That is a Next route (`apps/web/...`), uses the same actor check, and is not served by the headless `fluxiq dev` listener. It answers 404 or 401, and the extension treats either as "no project".
   - Gateway commands over the socket (`execute_action`, which is what FluxNode runs use) need no program-API actor and work.
   - Fixing this needs either a directory principal for `fluxnode.owner` (`platform/iam/**` or `programs/identity-access`), or a managed-host actor path in `server/program-route/**`. All of these are must-not-touch for me, so I did not edit them.
2. **Out-of-ownership edit.** See deviation 1. The lead should accept `client-gateway-websocket/src/connection/{types,connection}.ts` into B1's scope or move it to another brief.
3. **Facade shape for B2.** B2 must call `clientGateway.managedHosts.issueHostEnrolment` (and the two revoke methods), not `clientGateway.issueHostEnrolment` (deviation 2).
4. **Security-events list.** `enrolment.refused`, `enrolment.abandoned` and `session.enrolled` go to security listeners through `audit.recordSecurity`. They are not added to `CLIENT_GATEWAY_SECURITY_EVENT_TYPES` (`service/security/security-events.ts`, not in my paths). Anything that filters on that list will not see them.
5. **Same principal for every host.** All managed hosts share the approver `fluxnode.owner`. So `endEarlierTrust` ends one host's earlier trust when a host enrols again under the same client id, which is the intended behaviour for a named profile. Two hosts claiming one client id would also end each other's trust. Hosts are engine-launched with their own profiles, so their client ids should differ.
