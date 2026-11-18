# Report: revoke-pairing (t929)

Worker: worker-heavy. Trees: Core `fxwork/t929/!FluxIQ` and extension `fxwork/t929/!FluxIQWebExtension`, both on `task/t929-revoke-pairing`. Nothing is committed.

## Outcome

Done. Revoking a browser now tells it at once (`server.revoked`). It stops, drops its credential, reports `pairingEnded: { state: "revoked" }`, and raises no pairing request until the person presses Connect. That held across panel status reads and a browser relaunch. Same-profile relaunches resume with no request (observed live). Expired and refused credentials still pair, and now say which one. Every check below passes, the live ones included.

One caveat on cause 2: the relaunch defect did not reproduce on a same-profile relaunch, and this diff leaves the resume path unchanged. The request t924 saw most likely came from the harness or from a dead credential (below), not from relaunching itself.

## Round 2

All Round 2 checks pass (results under "Round 2 results" below). What changed:

- **Silence is explicit.** `revocation/revoked-for.ts` no longer reads silence from the reason text: an omitted `revokedFor` is the protocol reason or `revoked_by_user`. `apps/web/src/server/browser-trust/teardown/hosted.ts:32` now passes `revokedFor: null` (granted).
  - New tests: `service/tests/revoked-credential.test.ts` ("only an explicit null keeps it quiet"), and `apps/web/src/server/browser-trust/teardown/tests/durable.test.ts` (the hosted teardown sends only `server.disconnect`, its `revokedFor` argument is `null`, and the trust records none).
- **Older extensions no longer loop.** Older builds ignore `server.revoked`, and after the close they reconnect. Each opened socket resets the backoff (`client-gateway-websocket/src/connection/connection.ts:331`), so they would retry the dead credential about once a second, forever. Older builds do stop on `server.disconnect` (`server-command-channel.ts:194`). So the gateway now sends `server.revoked`, then `server.disconnect`, then closes, both on a live revoke (`access.ts`) and on a hello carrying a revoked credential (`lifecycle.ts` `refuseRevoked`).
  - The new extension drops the trailing message because its socket is already closed. The extension's revoke test now delivers both messages and asserts the disconnect never reaches the channel.
  - The Core test expectations moved to `["server.revoked", "server.disconnect"]` in `revoked-credential`, `credential-reuse` and `service` tests.
- **Protocol version stays 0.1.** The contract policy (`platform/gateway/protocol-versions.ts`, `protocol/version.ts`) makes 0.2 additive over 0.1 within the same major, so a 0.1 peer ignores `server.revoked` and the `credential` field. The stamped version's comment says to raise it once the gateway sends 0.2 messages; that trigger was already met by `server.going_away`. It is not raised here, because it is also the version recorded traces are read under. `framework/automation-service/service/offline-trial/reader-contracts.ts:14` matches it exactly, so 0.2 would refuse every recording made so far. Raising it first needs that reader to accept any minor version of the same major: a separate trace-contract change. No capability is needed, because the trailing `server.disconnect` covers old clients.
- **Docs updated:**
  - Core `docs/architecture/automation-studio/client-gateway.md`: a new section "Revocation, refused credentials and relaunch", plus the protocol summary and the operator-revoke line.
  - Core `docs/integrations/client-gateway-websocket.md`: how a credential ends, `server.revoked` in the server message list, and that a relaunch resumes.
  - Extension `docs/architecture/extension-client.md`: "A browser relaunch resumes", a new subsection "When the approval ends", and `server.revoked` in the message list.

- **Generated reference regenerated.** `pnpm docs:reference` rewrote `docs/reference/framework-reference.md` and its copy in `packages/fluxiq/docs/reference/`, 158 lines each. Most of that is earlier work the committed file had never caught up with: the contract's split into per-file paths, and the change-feed kinds. My additions are a small part. It is generated output, current with this tree.
- **Teardown test expectations.** `apps/web/src/server/browser-trust/teardown/tests/forget.test.ts` asserts the exact arguments of `revokeTrustedClient`. Its two `toHaveBeenCalledWith` lines now pin the explicit `null`; one sits in a parametrised test, which is why four tests failed.

### Round 2 results

All steps ran through the heavy-slot gate. Logs are `test-runs/t929/round2-2.log` and `round2-4.log`.

- **Core libraries.** `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` exited 0. It ran again after the reference regeneration, which counts as a fluxiq input.
- **Gateway tests.** In packages/fluxiq, `npx vitest run src/client-gateway src/programs/automation-studio/api --maxWorkers=2 --minWorkers=1` gave "Test Files 158 passed (158), Tests 1076 passed (1076)".
- **Web teardown tests.** In apps/web, `npx vitest run src/server/browser-trust/teardown` gave "Tests 34 passed (34)". The first run had 4 failures in `forget.test.ts`, from the exact-argument expectations above.
- **Typechecks.** `pnpm --filter fluxiq check`, `pnpm --filter @fluxiq/contracts check` and `pnpm --filter @fluxiq/web check` all exited 0.
- **Docs.** `pnpm docs:reference` exited 0. `pnpm docs:check` gave "structure-audit: passed (0 warning(s), 0 baselined)" and the reference check exited 0.
- **Core structure audit.** `pnpm structure:check` gave "structure-audit: passed (551 warning(s), 914 baselined)".
- **Extension background tests.** In apps/extension, `node scripts/test-extension.mjs src/background` gave "# tests 989 / # pass 989 / # fail 0".
- **Extension check.** `pnpm --filter @fluxiq-web-extension/extension check` exited 0. The first try refused because Core's dist was stale after the reference regeneration; it passed after the rebuild.
- **Extension structure audit.** `pnpm structure:check` gave "structure-audit: passed (253 warning(s), 551 baselined)".
- **Not re-run in Round 2:** the extension build and the live headed check. Round 2 changed no extension source outside tests and docs. On the Core side, the only behaviour change is the trailing `server.disconnect` after `server.revoked`, which the extension test covers.

## The two causes

### 1. Revoke said "approved: Done", then raised a new pairing request

This is one chain across both sides. Line numbers are `HEAD` before this change.

1. **Core never said "revoked".** `packages/fluxiq/src/client-gateway/service/access.ts:118` sent the live socket `server.disconnect` ("Client trust was revoked.") and closed it. `server.revoked` existed in the contract (`contracts/src/client-gateway/message/server-message.ts:21`, `session/revoked-notice.ts`), but nothing sent it.
2. **The extension kept the dead credential.** `server.disconnect` reaches `background/connection/server-command-channel.ts:194`, which calls `FluxIQConnection.disconnect()` (`connection.ts:507-514`). That stops reconnecting but leaves `session.token` in place. `isPaired()` is `Boolean(this.session.token)` (`connection.ts:639-641`), so the status still read `paired: true`. The panel's start steps print "Approve this browser in FluxIQ: Done" from `paired` (`panel/getting-started/start/steps.ts:93`). That is the "approved: Done".
3. **The background reconnected it by itself.** `shouldAutoConnect` connects a browser that is `paired` and `disconnected` (`background/panel/auto-connect.ts:34`). It runs on every panel status read (`background/index.ts:189`), at worker start (`:95`) and on the reconnect alarm (`:108`). Each of those hellos carried the revoked credential.
4. **Core turned the refused credential into a pairing request.** Revocation deletes the token index (`trusted-clients.ts:365`), so `resolveByToken` misses. `resumeTrustedSession` then audits `session.credential_rejected` and returns false (`lifecycle.ts:205-210`), and `handleHello` falls through to `server.pairing_required` (`lifecycle.ts:159-173`). The result was a new request in the panel that nobody had asked for.

### 2. Each relaunch raised a new pairing request

**Not reproduced, and not caused by relaunching.** Using the harness's own isolated topology (`test-runs/t929/repro-pairing.mjs`), I paired the extension, closed the browser and relaunched the same profile twice. Each relaunch resumed on its credential. The gateway audit read `session.disconnected(socket closed)`, `session.connected`, `session.reconnected`. There were zero pending pairings before and after the panel opened, and no `pairing.created`.

This diff does not touch that path. Core's resume (`resumeTrustedSession` in `lifecycle.ts`) and the extension's hello and token storage are unchanged, so `HEAD` should resume the same way. That last point is an inference: I did not run `HEAD` itself, because the crash took the pre-change build.

On `HEAD`, the thing that does produce "a request on every launch" is **a dead credential the extension never drops**. A hello whose credential is refused gets `server.pairing_required` (`lifecycle.ts:159-173`), but nothing on the extension side cleared the token on pairing. `paired` stays true, so every launch auto-connects with the same dead credential (`index.ts:95`, `auto-connect.ts:34`) and raises another request.

t924 ran the approved-client proof, which deliberately ends the trust by reuse (`aCopyIsCaughtWhenTheBrowserReturns`). A profile relaunched after that would behave exactly as t924 reported. The other candidate is specific to the harness: an unpacked extension's id comes from its path, so relaunching from a different build copy starts with empty storage and a new client id. t924's evidence is gone (its extension tree was removed), so neither candidate is confirmed.

The fix covers the product half: the extension now drops a refused credential at the first refusal (`pairingEnded: expired | refused`), so later launches stay quiet until the person connects.

## The fix

### Core (gateway and contract)

- **The revoke reason is recorded on the trust.** `ClientGatewayTrustedClient.revokedFor` (contract, `session/trusted-client.ts`) is what the client is told its trust ended for, recorded alongside `revokedAt`. It is absent in three cases: the client ended the trust itself (Forget), the trust never reached the client, or a newer approval of the same client took over.
- **Live sockets are told.** `ClientGatewayAccess.revokeTrustedClient(id, reason, revokedFor)` (`service/access.ts`) records `revokedFor`, sends each live socket `server.revoked { reason, message }` (`revocation/notice.ts`), then closes it. With no `revokedFor` it sends `server.disconnect`, as before.
  - When a caller gives no `revokedFor`, it follows the reason text (`revocation/revoked-for.ts`). A protocol reason such as `account_disabled` passes through. The client's own reasons ("forgotten by its person", and the hosted teardown's "The client revoked its own credential.") are quiet. Anything else is `revoked_by_user`.
  - Internal callers pass it explicitly. Forget, credential-delivery cleanup and re-approval pass `null`. Managed hosts pass `null`, because the engine enrols them again. Reuse passes `credential_reused`.
  - The facade port now carries the third argument (`service.ts`, `facade-ports.ts`).
- **A later hello with a revoked credential is told again.** In `service/lifecycle.ts`, after the resume fails, `credentialEnding(token)` (`revocation/credential-ending.ts`, using the same proof a forget uses) says how the trust ended. If it was revoked with a `revokedFor` other than `credential_reused`, the hello is told `server.revoked` and closed, `session.credential_revoked` is audited, and no pairing is offered. This also covers a browser that was offline when it was revoked, and a revoke that lands during a reconnect.
- **Expired and refused credentials still pair, and say why.** `server.pairing_required` now carries `credential: "expired" | "refused"` (new contract type `ClientGatewayPairingCredentialRefusal`, in `session/credential-refusal.ts`) and a matching `reason` sentence.
- **A reused credential keeps pairing.** It is answered `refused`, so a person decides, which is what the approved-client proof's copy check expects. The live holder is told `server.revoked { reason: "credential_reused" }`.

### Extension (`background/connection*`)

- **`GatewaySession` (`connection/gateway-session.ts`)** handles `server.revoked`. It stops reconnecting, closes the socket, drops the credential (so `paired` is false and nothing auto-connects), records the ended state and marks the connection `disconnected`. A `pairing_required` that carries `credential` drops the dead credential and records `expired` or `refused`; the request on that socket stands. A ready session, a new `connect()` (by the person or a launcher) and Forget each clear the state.
- **`connection/pairing-ended/`** holds the state in `chrome.storage.local` (`fluxiq.pairingEnded`), so a worker that restarts still reads revoked.
- **`FluxIQConnection` (`connection.ts`)** reports the state on the status, adds an activity entry, sets `lastError` for a revoke, loads the kept state at start, and clears it on Forget.

### The state for t925 (panel words)

The status the panel already reads (`fluxiq.getStatus` and `fluxiq.statusChanged`) gains one optional field, typed in `apps/extension/src/shared/protocol.ts` as `ExtensionPairingEnded`:

```ts
pairingEnded?: {
  state: "revoked" | "expired" | "refused";
  reason?: string;   // revoked only: revoked_by_user, revoked_by_admin, password_changed, account_disabled,
                     // account_deleted, credentials_rotated, revoked_by_operator, credential_reused
  at: number;        // epoch ms
};
```

- **`revoked`:** `connectionState` is `disconnected` and `paired` is false. `lastError` is "FluxIQ revoked this browser's approval. Connect to pair it again." Nothing reconnects or asks to pair until the person presses Connect.
- **`expired` / `refused`:** `connectionState` is `pairing` with `pairingReferenceCode`; FluxIQ asked for a new approval at once.
- **Absent** otherwise. Connect, Forget or a ready session clears it.

`connectionState` keeps its six values. A seventh value (`revoked`) would break the exhaustive `switch` in `panel/copy/connection-copy.ts:23`, which t925 owns. t925 can render `pairingEnded` without that breaking change.

## Commands run and observed results

Heavy steps ran under `heavy-slot.mjs` (label t929), after the 17:13 crash. Logs are in `test-runs/t929/`, which git ignores.

Core (`fxwork/t929/!FluxIQ`):

- **Contracts typecheck.** `pnpm --filter @fluxiq/contracts check` exited 0 (`recheck-1.log`).
- **fluxiq typecheck.** `pnpm --filter fluxiq check` exited 0 (`core-check-3.log`). Two earlier runs failed only on the typing of my new test helper, which is now fixed.
- **Gateway tests.** `npx vitest run src/client-gateway src/programs/automation-studio/api --maxWorkers=2 --minWorkers=1` (in packages/fluxiq) gave "Test Files 158 passed (158) / Tests 1075 passed (1075)". The first run had 15 failures. They came from the facade port at `service.ts:164`, which forwarded only two arguments, so the internal callers' `revokedFor` was lost. I fixed the port. I also updated three existing tests whose expectations encoded the old behaviour:
  - `service.test.ts`: a hello with a revoked credential.
  - `credential-reuse.test.ts`: "a revoke while a reconnect is in flight".
  - `durable-revocation/tests/cleanup.test.ts`: failure injection now also fires on `server.revoked`.
- **Library build.** `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` exited 0.
- **Structure audit.** `pnpm structure:check` gave "structure-audit: passed (551 warning(s), 914 baselined)". The first run had one violation: three `pairing-` files in `contracts/.../session/`. The new type's file is now `credential-refusal.ts`.

Extension (`fxwork/t929/!FluxIQWebExtension`):

- **Background tests.** `node scripts/test-extension.mjs src/background` (in apps/extension) gave "# tests 989 / # pass 989 / # fail 0". The first run had 4 failures:
  - Test 488: my test closed the socket in the same tick as the notice. A browser delivers the message event first, so the test now gives it a turn. I also added a test for the race where the notice is lost and the reconnect's hello is told again.
  - Three tests in `background/tests/forget-pairing.test.ts`: its gateway stub lacked the new method.
- **Extension check.** `pnpm --filter @fluxiq-web-extension/extension check` exited 0.
- **Extension build.** `pnpm --filter @fluxiq-web-extension/extension build` exited 0, with chrome, firefox and e2e-chromium verified.
- **Structure audit.** `pnpm structure:check` gave "structure-audit: passed (253 warning(s), 551 baselined)". The first run had three violations, all mine (one barrel bypass, two packed lines); all are fixed.
- **Domain host.** `pnpm --filter @fluxiq-web-extension/domain host:build` was built before the crash; the domain is unchanged since.

Live, headed Chromium, provider-free: `node test-runs/t929/repro-pairing.mjs live-1` on an isolated Lab topology. Results are in `test-runs/t929/live-1/result.json`, with screenshots `01` to `05`.

- **Pair:** connected, `paired: true`, one active trust.
- **Relaunch 1 and 2** (close the browser, relaunch the same profile, wait 12 s, then open the panel page): `connected`, `pendingBeforePanel: 0`, `pendingAfterPanel: 0`, audit `session.reconnected`.
- **Revoke while connected**, through `revoke-client-trust` (the endpoint the panel's Clients list calls):
  - Within 104 ms the status read `disconnected`, `paired: false`, `pairingEnded: { state: "revoked", reason: "revoked_by_user" }`, with lastError "FluxIQ revoked this browser's approval. Connect to pair it again."
  - After five more status reads (as a panel opening would make) and 8 s, it was unchanged, with `pending: 0`.
  - The audit read `trust.revoked`, then `session.disconnected(client trust revoked)`, with no `pairing.created`.
- **Relaunch while revoked:** `disconnected`, `paired: false`, `pairingEnded` read back from storage, `pending: 0`, and no audit entries (it did not even connect).
- **Pair again** with `fluxiq.connect` (what Connect sends): `pairing.created`, approved, `connected`.
- **Approved-client proof:** `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --model-key` exited 0 with `stage: done` and `failure: null`. All 29 checks were true, including `reconnectedWithoutReapproval`, `restartedWithoutReapproval`, `aCopyIsCaughtWhenTheBrowserReturns`, `neitherHoldsTrustAfterReuse`, `explicitRevokeReachesCore` and `revokedCredentialCannotCallModel`. Evidence is in `test-runs/t929/proof/2026-11-18T03-13-26-043Z-chrome`. It was provider-free (loopback model fixture), so there were no paid calls.

## Not verified

- **The controls themselves.** I did not click Revoke in the web panel's UI or Connect in the side panel. The live run called the same endpoint and runtime message those controls use.
- **The side panel's wording for `pairingEnded`.** Today it shows "Approve this browser in FluxIQ: To do" and Connect (screenshot `03-revoked.png`), no longer "Done", but it does not say revoked yet. That wording is t925's.
- **`expired` and `refused` live.** These are covered by Core and extension unit tests only.
- **The brief's ports (3400/5177).** The Lab topology allocates its own ports (this run used 51663/51664), and no panel was started on 3400.
- **`HEAD`'s relaunch behaviour.** I did not run `HEAD` itself (see cause 2).
- **Firefox.**
- **Full suites.** Not run, per the twice-a-day rule.

## Open questions or contradictions found

- **Missing report.** The brief's first reading, `docs/working/usable-client-plan/reports/key-security-ux.md`, does not exist in either checkout or in git history. The relaunch finding came from `key-model-access.md` ("Pairing request on every launch").
- **Wrong owned path.** The brief's owned path `packages/contracts/src/platform/client-gateway/**` does not exist. The client-gateway contract is `packages/contracts/src/client-gateway/**`; I edited its `session/` folder. Revocation reasons live in `contracts/src/platform/gateway/`, which I did not edit.
- **Two edits outside the owned paths:**
  - `apps/extension/src/shared/protocol.ts`: the `pairingEnded` field and its type, because the status type the panel reads lives there.
  - `apps/extension/src/background/tests/forget-pairing.test.ts`: the test of `connection.ts`'s `forgetPairing`. Its gateway stub gained the new method, plus one test that Forget clears the state.
- **Hosted teardown should pass `null`.** `apps/web/src/server/browser-trust/teardown/hosted.ts:32` revokes the client's own credential by reason text only. It should pass `revokedFor: null`; after that, the text list in `revocation/revoked-for.ts` can go. I did not edit it (outside the owned paths).
- **Protocol version unchanged.** `CLIENT_GATEWAY_PROTOCOL_VERSION` stays `0.1` although the gateway now sends `server.revoked`, as it already sends `server.going_away`. Its comment makes raising it the gateway lane's decision, because it is also a trace version. A 0.1 client that ignores `server.revoked` sees only the close, reconnects with backoff, and is told again; it never gets a pairing request.
- **Documentation not updated** (outside the owned paths). Core's gateway pairing and revocation docs, and the extension's connection docs, should describe `server.revoked`, `revokedFor`, `pairing_required.credential` and `pairingEnded`.
- **Line endings.** Some new files I created may be LF while the checkouts are CRLF; git normalises both.
