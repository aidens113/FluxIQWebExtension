# t1095/sync-defect: a pending connect request does not pop up in the panel

Paths: `C/` = Core worktree `fxwork/t1095/!FluxIQ`; `E/` = downstream `fxwork/t1095/!FluxIQWebExtension`.

## Outcome

Done (diagnosis only; no files edited). The main cause is confirmed in code and reproduced against Core's real
gateway service. A request expires on the server after 5 minutes. The browser keeps waiting on the same socket
and shows the dead code. Nothing gives it a new code until a new socket sends a new hello, and Cancel then
Connect is the only way the extension does that. Three more ways a request can stay hidden were found in the
panel. Each has a cited cause and a fix below.

## Root causes

**RC1 (primary; matches "had to cancel and make a new one"): an expired request is never replaced while the browser still waits.**
- How the extension asks: when the side panel finds FluxIQ, it connects on its own, once (`E/apps/extension/src/panel/getting-started/start/view.ts:184-185`). The socket sends a hello with no token, and Core's client sets the state to `pairing` at once (`C/packages/client-gateway-websocket/src/connection/connection.ts:324-327`).
- Core makes the request only while handling a hello: `handleHello` sets the session to `pairing_required`, then calls `ensureForSession` (`C/packages/fluxiq/src/client-gateway/service/lifecycle.ts:182-195`). Grep finds no other caller. The request gets `expiresAt = now + pairingTtlMs` (`service/pairings.ts:95`), which defaults to **5 min** (`service/config.ts:42`).
- On expiry, `pruneExpired` deletes the request and signals `pairing.expired` (`pairings.ts:120-132`, timer `:169-188`). Nothing is sent to the session, and the session stays `pairing_required` with a stale `pendingPairingCode`. The server never closes an idle unpaired socket (grep for idle/unpaired timeouts finds none).
- The panel drops expired requests (`C/apps/web/src/app/GlobalClientGatewayPairing.tsx:44`; Settings › Connect does the same, `features/settings-page/connect/pending-pairing.ts:13`). With nothing to show, the modal renders nothing (`:166`).
- The extension is never told: `server.pairing_required` carries no expiry (`C/packages/contracts/src/client-gateway/session/pairing-required.ts:8`). The code is cleared only on session ready (`connection.ts:152-155`), so the side panel shows "Waiting for approval" and the dead code for as long as the socket stays open (`E/.../start/steps.ts:123-128`). In that state the panel offers only "Cancel approval request" (`view.ts:61,97`). Connecting again while `pairing` *joins* the stale attempt (`E/apps/extension/src/background/connect/pending/joins-pending-connect.ts:24,34-37`). So only Cancel followed by Connect opens a new socket, sends a new hello and creates a new request, and only that makes the modal pop up.
- **Reproduction:** open the side panel (the request goes out by itself). Take more than 5 minutes to reach the approval: first-run setup, signing in, or the panel tab not open yet. Then open FluxIQ: no modal, and Settings › Connect is empty, while the extension still shows its code.
- **Proven:** a scratch probe ran on the real `ClientGatewayService` (scratchpad `syncprobe/lapse.probe.ts`; no repo file touched). Output: `pairings at hello: 1 ttlMs: 300000` / `pairings after TTL: 0` / `session status after TTL: pairing_required` / `messages sent to client after TTL: []` / `change kinds: ['pairing.requested','pairing.expired']` / `pairings after a fresh hello: 1`.

**RC2: dismissing the modal hides that request for the life of the tab.** Pressing X or Escape calls `dismissPairingPrompt` (`GlobalClientGatewayPairing.tsx:212-216,219`). That only adds the code to the in-memory `dismissedCodes` (`:131,175-178`). The server still holds the request and the browser still waits, but the modal filters the code out (`:44`) until the tab reloads. The only other place it shows is Settings › Connect. A new code is a new key, which is why a resend shows a modal again.

**RC3: the change stream can close for good with no sign, and later requests never pop up.** The panel learns of a request by push only: the `gateway` topic of `GET /api/panel/changes` (`C/apps/web/src/app/api/panel/changes/route.ts:66-77`, `topics/gateway.ts:113-150`). The snapshot is read when the stream opens and on each change event (`features/client-gateway-changes/subscription.ts:69-76`). There is no timer. If the browser's automatic reconnect gets a refusal (401 after the session lapsed: `lib/workspaces/routes/streams/owner.ts:21,144` ends the stream, then `streams/response.ts:9` refuses the reconnect), `EventSource` closes for good and the status becomes `closed` (`features/panel-changes/connection.ts:124-127`). It reopens only on a visibility change, the network coming back, or `refresh` (`panel-changes/browser-sources.ts:176-188`). Signing in again in place calls none of these (`app/session-reauthentication/SessionReauthentication.tsx:62-65`). The "Not live" notice exists only inside an open modal (`GlobalClientGatewayPairing.tsx:121-125,220`), so with no request on screen the dead stream is invisible. A request raised while the tab stays visible never appears. A Core restart may lead here as well if the first reconnect gets a 401 or 503 (not confirmed live).

**RC4 (latent race, not reproduced): a request made just as the stream opens can be missed.** The topic reports a change only after its first fingerprint is set (`topics/gateway.ts:116,128-130`). The stream sends `: open` at once (`changes/panel-change-stream.ts:86-88`), and the client then reads the snapshot. If a request is created after the client's read but before the topic's first `view()` reads the registry, the first fingerprint already includes it. No event follows, and the client's copy lacks it.

**Minor (RC5): on a reconnect the extension briefly shows the previous socket's dead code.** `onHelloToken` sets `pairing` (`connection.ts:326`) while `pairingReferenceCode` (`:55`) still holds the old code. If the new gateway does not answer, the old code stays on screen.

## Cases the brief asked about

- **Request made before the panel tab opened (still within 5 min):** shown. The stream opens and the snapshot is read (`subscription.ts:16-27`); signing in reloads the whole page, so the layout mounts the modal (`AuthShell.tsx:165,217`; `layout.tsx:28,39`). Ruled out as a cause.
- **After the modal is dismissed:** RC2. **After expiry:** RC1.
- **Core restart:** the socket closes. `autoReconnect` defaults to true (`E/apps/extension/src/shared/browser.ts:8`), so the extension sends a new hello and gets a new code; the old request is gone with Core's in-memory store. The panel recovers when its stream reopens with a 200 (otherwise RC3); RC5 can show the old code meanwhile. The extension does not keep waiting on a request a restarted server no longer knows: it waits on one the *same* server let expire (RC1).
- **Panel-only restart:** the same as a fresh open. A runtime reload (`lib/fluxiq.ts:195-219`, only from setup migrate or rollback) replaces the gateway under open streams. That is rare and not the user's path.
- **`service` profile:** the panel's view always has `pairings: []` (`api/client-gateway/snapshot/view.ts:6,14`) by design (approval there is by typing the code). Out of scope here.

## Fix design (no timeouts lowered, no retries capped)

1. **RC1, Core (the root fix):** a request that expires while its browser still waits gets a fresh code on the same socket.
   - `service/pairings.ts`: `pruneExpired` returns or reports the expired requests with their `requestedBySessionId`.
   - `service/pairing-flow.ts`: add `renewLapsed(sessionIds)`. For each session that is still connected, still `pairing_required`, and whose `pendingPairingCode` was the expired one, call `ensureForSession` and send `server.pairing_required { referenceCode }` again (no `credential`). Wire it in `service.ts:163` and run it in the same turn, so the feed sends one signal.
   - The 5-minute lifetime of each code stays. The browser just never sits on a dead one.
   - **Wire contract:** no new message; `server.pairing_required` may now come more than once per socket. Core's client already handles that: `connection.ts:403-408` updates the code. The downstream handlers are safe to repeat (`gateway-session.ts:158-161`; `noteRefusedCredential` returns early with no `credential`).
   - Optional, additive: `expiresAt?` on `ClientGatewayPairingRequired`, so the side panel can say when the code renews.
2. **RC1, panel follow-up:** in `GlobalClientGatewayPairing.tsx:157-163`, a replacement from the *same* `requestedBySessionId` is the same request with a new code. Show no "closed" notice for it; update the code in place.
3. **RC2, panel:** X or Escape no longer hides the request for the tab's life. It closes the modal and leaves a persistent "<client> wants to connect · Review" bar in `GlobalClientGatewayPairing.tsx` while the request is pending. Key the dismissal by `requestedBySessionId`, so a renewed code (fix 1) stays in the bar instead of popping up again. Decline stays the only way to refuse.
4. **RC3, panel:**
   - `features/panel-changes/browser-sources.ts` `onWake` also listens for a "session restored" window event, which `program-auth-recovery` fires when `resolveProgramAuthentication(true)` runs.
   - `GlobalClientGatewayPairing` shows a small non-modal "Not live · Reconnect" line whenever `changes.status === "closed"`, even with no request on screen; its button calls `refresh`.
   - Still no polling.
5. **RC4, panel server:** `PanelChangeTopic` gains an optional `ready: Promise<void>` (`topics/types.ts`). `gatewayChangeTopic` resolves it once its first fingerprint is set, and `PanelChangeStream.next()` waits for every `ready` before sending `: open`, so the client always reads after the baseline. This is an internal type only; the SSE format is unchanged.
6. **RC5, Core client:** clear `pairingReferenceCode` in `onHelloToken` (or `openRecord`) in `C/packages/client-gateway-websocket/src/connection/connection.ts`.

Repos: Core holds fixes 1-6. Downstream needs no code change for correctness. It may show `expiresAt` if that is added, and should keep one "Waiting for approval" activity line per renewal (`E/apps/extension/src/background/connection.ts:190-193`).

## Tests that would prove it

- `C/packages/fluxiq/src/client-gateway/service/tests/pairing-flow.test.ts`: "renews an expired code for a browser still waiting on the same socket and sends it `server.pairing_required` again"; "does not renew for a disconnected, ready or dismissed session".
- `C/.../service/tests/pairings.test.ts`: "pruneExpired reports which sessions' requests expired".
- `C/packages/client-gateway-websocket/src/connection/tests/connection.test.ts`: "a second `pairing_required` on one socket replaces the code"; "a reconnect clears the previous code before the gateway names one".
- `C/apps/web/src/app/tests/GlobalClientGatewayPairing.test.ts`: "a renewed code from the same session updates in place, with no closed notice"; "a dismissed request stays in the Review bar while pending"; "a closed stream shows Not live with no request open".
- `C/apps/web/src/features/panel-changes/tests/connection.test.ts`: "a restored session reopens a closed stream".
- `C/apps/web/src/app/api/panel/changes/tests/panel-change-stream.test.ts`: "`: open` waits for each topic's baseline". New `C/apps/web/src/app/api/panel/changes/topics/tests/gateway.test.ts`: "a request made between the baseline and the client's read is signalled".
- `E/apps/extension/src/background/connection/tests/gateway-session.test.ts`: "a repeated `pairing_required` without `credential` updates the code and ends nothing".

## Commands run

- Read-only greps and reads in both trees (cited above).
- The scratch vitest probe: `node node_modules/vitest/vitest.mjs run --root <scratchpad>/syncprobe`, run from `C/packages/fluxiq`. Result: 1 passed, with the output quoted under RC1.

## Not verified

- No live browser or panel run.
- RC3 on a Core restart (whether the first stream reconnect actually gets 401 or 503) is reasoned from code and `EventSource` behaviour.
- RC4 was not reproduced.
- How long the user actually waited before approving is unknown. RC1 needs more than 5 minutes; RC2 needs an X or Escape on the modal. Either matches the report.
- Existing unit suites were not run; only the probe was.

## Open questions

- Should a renewed code (fix 1) be shown to the person as a renewal, or swapped silently? The design above swaps it silently in both places.
