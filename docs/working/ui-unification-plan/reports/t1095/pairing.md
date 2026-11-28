# t1095/pairing: a connect request appears without cancel and resend (Defect 2)

Tree: `fxwork/t1095/!FluxIQ` (branch `task/t1095-ui-audit-unify`). No git commands that change state were run. No live or paid runs. No ports used.

## Outcome

Done for this brief. Every test command named in the brief passes. The structure audit has no violations. `fluxiq:check` and `client-gateway-websocket:check` pass. `web:check` still exits 2, but both of its remaining errors are in `apps/web/src/features/panel-shell/top-bar/projects/tests/port.test.ts`, which is another worker's file and on my must-not-touch list. My own type error (`GlobalClientGatewayPairing.test.ts:17`) was fixed, and the re-run reports nothing in my files.

All five causes from `sync-defect.md` are fixed at their source. No timeout was lowered, no retry was capped and no error was hidden. Each code keeps its 5-minute lifetime. Interface I4 holds: there is no wire change, and `server.pairing_required` may now arrive more than once on one socket.

## What changed and why (before / after per RC)

**RC1: an expired request is never replaced while the browser still waits (the primary cause).**
- Before: `pruneExpired` deleted the challenge and signalled `pairing.expired`. The session stayed `pairing_required` with the dead code, and nothing was sent to it. Proven by the new test, run before the fix: 0 pending after the lifetime, and only 1 code ever sent.
- After:
  - `service/pairings.ts`: a new registry hook `lapsed(challenges)` hears the lapsed challenges. It fires after `pairing.expired` is signalled, in the same turn.
  - `service/lifecycle.ts`: the offer step of `handleHello` moved into a private `offerPairing`, which makes or reuses the code and sends `server.pairing_required`, or refuses over the pending caps as before.
  - `renewLapsedPairings` calls `offerPairing` again for each lapsed challenge whose session is still connected, still `pairing_required`, and whose `pendingPairingCode` was the lapsed one. It audits `pairing.renewed`; a failed send is audited as `pairing.renewal_failed`, not swallowed.
  - `service.ts` wires the hook.
  - The renewal runs synchronously in the turn of the lapse, so the change feed coalesces the lapse and the new request into one signal (tested). A disconnected, paired or declined session is not renewed (tested).
- Placement: I put this in lifecycle, not in pairing-flow as the diagnosis suggested, because it re-runs the hello's offer step. That reuses `PAIRING_REASONS` and `refuseOverCapacity` instead of copying them.

**RC1 follow-up in the panel: a renewed code is the same request.**
- Before: when the code on screen changed, the dialog raised "Pairing request closed / nothing was paired". The panel also dropped a request on its own clock (`expiresAt > nowMs`), so the countdown could close the request in the moment before the renewed code arrived.
- After (`GlobalClientGatewayPairing.tsx`):
  - `pendingPairingRequests(pairings, resolvedCodes)` no longer filters by the tab's clock. The gateway is the clock: it renews a lapsed code or drops the request.
  - The vanished-notice effect stays quiet when `pairingStillWaiting(shown, pending)` holds, meaning the same `requestedBySessionId` is still pending under any code.
  - A renewed code now updates the dialog in place (tested). A request that really ends still says "Nothing was paired" (tested).

**RC2: closing the dialog hid the request for the life of the tab.**
- Before: X or Escape added the code to `dismissedCodes`, and the request was filtered out until reload.
- After:
  - The state is split. `resolvedCodes` holds codes approved or declined here. `deferredKeys` holds requests the person closed the dialog on, keyed by `requestedBySessionId`, so a renewed code stays set aside.
  - A set-aside request shows in a fixed, non-modal bar: "<client> wants to connect" / "Waiting for your approval." with a **Review** button that reopens the dialog.
  - Decline is still the only refusal. When the request ends, the bar goes with no closed notice.
  - The bar is built from the existing `InlineNotice` and `Button`. Its container's only styling is a new file beside the component, `client-pairing-bars.css`: fixed bottom-right, under dialogs, using existing tokens.

**RC3: the change stream can close for good with no sign.**
- Before: signing in again in place did not reopen the stream (the new test failed before the fix: `expected [] to deeply equal ['fluxiq:session-restored']`). "Not live" showed only inside an open dialog.
- After:
  - New `features/panel-changes/session-restored-event.ts` (`SESSION_RESTORED_EVENT`, exported from the barrel). `browser-sources.ts` `onWake` listens for it beside `visibilitychange` and `online`.
  - `SessionReauthentication` dispatches it after a successful in-place sign-in. It is not dispatched after a failed sign-in or the setup-form reload (tested).
  - `GlobalClientGatewayPairing` shows a "Not live" bar whenever `changes.status === "closed"` and no request dialog is open. Its button is **Reconnect** (`refresh`), or **Sign in again** when the snapshot read was refused, which opens Restore session through `requestProgramAuthentication`.
  - The dialog's own Not-live notice gets the same button. There is still no polling.

**RC4: a request made just as the stream opens could be missed (not reproduced; latent).**
- Before: `: open` was sent before the gateway topic read its first view.
- After:
  - `PanelChangeSink` gains `opensAfter(baseline)` (internal type, `topics/types.ts`). `gatewayChangeTopic` registers a baseline that settles once its first view is read, fails or stops.
  - `PanelChangeStream` holds the opening chunk until every baseline settles. Changes found meanwhile are queued after `: open`. A return or a topic failure during that wait still settles the opening, so the route's lease is never held by the wait.
  - The SSE format is unchanged.
- One existing test ("compares a change heard while the first view is still being read") had to stop awaiting the opening before releasing the first read. Its assertions are kept.

**RC5: on reconnect the client briefly showed the previous socket's code.**
- Before: the new test failed (`expected 'REF-1' to be undefined`).
- After: `onHelloToken` clears `pairingReferenceCode` before setting the state, for the live record only.

**Settings › Connect:** no change needed. Its list is rebuilt from each snapshot, so a renewed code shows there as soon as the snapshot changes. Its expiry filter is evaluated only at snapshot time.

## Tests added or changed

- `packages/fluxiq/src/client-gateway/service/tests/pairing-flow.test.ts`: renews an expired code on the same socket, sends `server.pairing_required` again with no `credential`, gives each code its full lifetime, makes one change-feed signal, and the renewed code approves with no resend. Also: keeps renewing while the browser waits; does not renew a disconnected, ready or dismissed session.
- `.../service/tests/pairings.test.ts`: `pruneExpired` reports which sessions' requests expired, after the signal, once they are gone; consumed challenges are excluded.
- `packages/client-gateway-websocket/src/connection/tests/connection.test.ts`: a second `pairing_required` on one socket replaces the code; a reconnect clears the old code before the gateway names one.
- `apps/web/src/features/panel-changes/tests/connection.test.ts`: a restored session reopens a closed stream (real `onWake`).
- `apps/web/src/app/session-reauthentication/tests/SessionReauthentication.test.tsx`: re-auth announces a restored session; a failed one does not.
- `apps/web/src/app/api/panel/changes/tests/panel-change-stream.test.ts`: `: open` waits for each topic's baseline; an opening still waiting settles on return or failure; no change is sent before the opening.
- New `apps/web/src/app/api/panel/changes/topics/tests/gateway.test.ts`: the baseline holds the opening until the first view; a request made between the baseline and the client's read is signalled; a failing first view still settles.
- New `apps/web/src/app/tests/GlobalClientGatewayPairing.review.test.tsx` (rendered):
  - A renewed code updates in place with no closed notice.
  - A real end still says nothing was paired.
  - A closed dialog leaves the Review bar across a renewed code, and Review reopens it.
  - The bar drops silently when the request ends.
  - Another client's request opens while one waits in the bar.
  - A closed stream shows Not live with no request open, and Reconnect calls `refresh`.
  - When refused, the button is Sign in again.
  - Nothing shows while live with no request.
  - Reconnect appears inside an open dialog.
  - Run against the original component from `HEAD`, 6 of these 9 failed: the renewal, Review and Not-live cases.
- `apps/web/src/app/tests/GlobalClientGatewayPairing.test.ts`: updated to the new `pendingPairingRequests` signature and source strings. Added: a request past its expiry is left to the gateway; a renewed code is the same request.

## Commands run and observed results

- `cd packages/fluxiq && npx vitest run src/client-gateway`: `Test Files 85 passed (85)`, `Tests 683 passed (683)`.
- `cd packages/client-gateway-websocket && npx vitest run`: `Test Files 29 passed (29)`, `Tests 215 passed (215)`.
- `cd apps/web && npx vitest run src/app/tests src/features/panel-changes src/app/api/panel/changes src/features/settings-page/connect src/app/session-reauthentication`: `Test Files 13 passed (13)`, `Tests 144 passed (144)`. After the statement-packing fix, `panel-change-stream.test.ts` was re-run alone: `Tests 18 passed (18)`.
- Before-fix runs:
  - RC5 test: 1 failed (`expected 'REF-1' to be undefined`).
  - RC1 tests: 2 failed (`expected [] to have a length of 1`; `expected 1 to be 3`).
  - RC3 panel-changes test: 1 failed (`expected [ FakeStream ] to have a length of 2 but got 1`).
  - RC3 re-auth test: 1 failed.
  - Rendered panel tests against `HEAD`'s component: 6 failed, 3 passed.
- `node scripts/structure-audit.mjs`:
  - First run: 4 violations. Mine was `statement-packing` in `panel-change-stream.test.ts:147`, which I fixed. The other 3 were `failure-as-empty` in `features/chat-widget/...` and `features/panel-shell/...`, other workers' files.
  - Re-run: no FAIL lines; it printed only "9 baseline entries can be lowered".
- Typecheck: `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1095-pairing -- node scripts/build-cache/cli.mjs fluxiq:check client-gateway-websocket:check web:check`:
  - First run: `fluxiq:check` built (159680 ms) and `client-gateway-websocket:check` built (13215 ms). `web:check` failed with exit code 2 on 3 errors:
    - `src/app/tests/GlobalClientGatewayPairing.test.ts(17,15): error TS2379` (exactOptionalPropertyTypes), which is mine.
    - `src/features/panel-shell/top-bar/projects/tests/port.test.ts(38,18)` and `(46,18): error TS2722`, which are not mine.
  - I fixed my line (a pairing with no `requestedBySessionId` is now built without the key; that test file re-ran with `Tests 14 passed (14)`).
  - Re-run `heavy-slot.mjs run t1095-pairing-web -- node scripts/build-cache/cli.mjs web:check`: only the two `panel-shell/top-bar/projects/tests/port.test.ts` TS2722 errors remain. It still fails with exit code 2, but nothing in my files.
  - One earlier attempt hit my own 10-minute command cap while queued for a slot and was re-run without a cap.

## Not verified

- No live browser or panel run, so the renewal is not exercised end to end with the real extension.
- RC4 depends on the browser firing `onopen` with the first chunk rather than with the headers alone. Node sends headers with the first write, so holding the first chunk holds the open; this is reasoned, not measured live.
- RC4 itself was never reproduced (as the diagnosis said). Its tests prove the ordering, not a recorded miss.
- Downstream extension behaviour on a repeated `pairing_required` (one "Waiting for approval" line per renewal) is not checked here.

## Open questions or contradictions found

- Docs I do not own need updating in the same unit (`docs/architecture/automation-studio/client-gateway.md`):
  - Step 5 near line 1014 (the dialog's Review bar and renewed codes).
  - The change-feed paragraph near line 1107 (a lapse renews a still-waiting session's code in the same turn; `pairing.renewed` audit entry).
  - The route paragraph after it (the opening waits for the gateway topic's baseline).
  - That `server.pairing_required` may repeat on one socket (I4).
- The renewal is swapped in silently in the panel, as the diagnosis proposed. Its open question (show it as a renewal or not) stays with the supervisor.
- If a second hello ever arrives on a session whose code just lapsed, that hello and the renewal each send `pairing_required` with the same new code. It is harmless (the client updates to the same value), and no client sends two hellos on one socket today.

## Follow-up (sub-supervisor request: Core docs; no source touched)

Decision recorded: renewed codes are swapped in silently, and both docs say so.

**`docs/architecture/automation-studio/client-gateway.md`**
- "What a pairing approves" paragraph:
  - `first-project` is now callable by the panel too, and the panel passes `unscoped` on a page with no domain.
  - A new paragraph, **One current project per person (t1095)**, documents I5 from `identity.md`:
    - the `automation-studio-context` request body;
    - that a paired client writes the same per-person slot;
    - the 400 sentence for a `clientId` from a paired client, and the 403 sentence for a client bound to one project;
    - IAM per project or Flow, and the success payload;
    - the snapshot reading the slot back;
    - how the panel restores and follows it.
- Step 5 of the connection steps: Confirm/Decline; the code lifetime; renewal on the same socket (so `server.pairing_required` may repeat, I4); the silent in-place swap; no drop on the tab's own clock; the Review bar; Decline as the only refusal.
- Change-feed bullet: `renewLapsedPairings`, the `pairing.renewed` and `pairing.renewal_failed` audit entries, which sessions are not renewed, and one signal per lapse plus renewal.
- Route bullet: the opening waits for the gateway topic's first view (`PanelChangeSink.opensAfter`).
- Browser bullet: a closed stream also reopens on `SESSION_RESTORED_EVENT`, and the "Not live" bar offers Reconnect, or Sign in again when refused.

**`docs/integrations/client-gateway-websocket.md`**
- Pairing steps 4, 6 and 7: renewal on the same socket, the Review bar, and Confirm/Decline.
- "Pairing Required": a new paragraph saying the message may repeat on one socket with a fresh `referenceCode` and no `credential`. The client replaces the code and should not reconnect. The panel swaps the code silently. `FluxIQClientGatewayConnection` keeps only the newest code and clears the old one on a new hello.
- Recording Start Sequence, step 2: a paired client may set the same per-person value.
- New section "Current Project": the full request and response for `POST /api/client-gateway/automation-studio-context` (all refusal codes and sentences), the snapshot read-back, and `first-project` for both callers.

**Commands (from Core root)**
- `node scripts/structure-audit.mjs --rule docs-links`: `structure-audit: passed (0 warning(s), 0 baselined).`
- `node scripts/docs-reference.mjs --check`: `Deterministic framework reference is current.`

## Follow-up 2 (sub-supervisor request: paired-client allowlist, get-my-preferences, session policy, docs)

Rule enforced (downstream AGENTS.md, user 2026-11-27): keys, settings and creating or managing projects live in the panel for every client. Clients show the work and keep their chat.

### Callers checked before anything was removed

- Downstream extension (`fxwork/t1095/!FluxIQWebExtension/apps/extension/src`): it calls only `secret-keys snapshot` (`background/automation-relay/automation-relay.ts:157`). It calls no `create-project`, `rename-conversation`, `delete-conversation` or key write. `background/projects/projects-relay.ts` names `create-project` only in its header comment, which is now stale.
- Core `packages/sdk`, `packages/ui-components`, `packages/client-gateway-websocket`: no calls.
- Every other hit is the panel signed in with its cookie (`apps/web` chat-widget, panel catalog, panel-assistant), which is not a token call.
- So no non-extension client needed an endpoint kept.

### What changed

**`packages/fluxiq/src/server/program-route/program-route.ts`**
- `PAIRED_CLIENT_ENDPOINTS`:
  - removed from `automation-studio`: `create-project`, `rename-conversation`, `delete-conversation`;
  - removed from `secret-keys`: `save-model-key`, `replace-model-key`, `remove-model-key` (`secret-keys snapshot`, a read, stays);
  - added `identity-access: ["get-my-preferences"]`.
- The comment block now states the rule.
- `PAIRED_CLIENT_IAM_DECIDED_ENDPOINTS` is now empty, so no `program-gated` endpoint is reachable by token. I kept the named mechanism and the 3-argument signature of `isPairedClientClassification`, because `apps/web` calls it with 3 arguments.
- Removed: the create-project narrowing and projection, the thread rename/delete narrowing (`narrowThreadChange`), and the model-key write narrowing and projection.
- Added `narrowOwnPreferencesRead`: no body or an empty body becomes `{}`, and any field is refused by name with 403. The handler is never handed a body.
- Added `projectOwnPreferences`: the answer is rebuilt as exactly `{ startingHumanness: number | null }`.

**`paired-client-actor.ts`:** `PAIRED_CLIENT_ENDPOINT_PERMISSIONS` is now empty, so no paired actor carries `secrets.manage`.

**`handle-program-request.ts`:** a comment only.

**The self-only read needed no change in `programs/identity-access/api/**`.**
- The handler reads only `request.actor.userId`, which for a token is the approving person (`operatorUserId`), and it refuses a payload naming anyone.
- `programs.read` is already in `PAIRED_CLIENT_PERMISSIONS`.
- The route strips a token's `authSessionId` before narrowing, as it does on every endpoint.

**`packages/fluxiq/src/platform/iam/predefined/connected-session.ts`** (`FluxIQBrowserSession`, now `v2`; edit approved by you)
- Kept unchanged:
  - `SessionScope` (`gateway:*`, `studio:*`).
  - `SessionModelAccess` (`secrets:Snapshot`, `secrets:UseKey`). This is what a connected client needs to read readiness and to have its person's key used for its model calls (AGENTS.md "A connected client has model access").
  - The deny on `secrets:RevealKey` (now its own statement, `SessionNeverReveal`) and `SessionNeverDestructive*`.
- Dropped `SessionOwnModelKey`. It granted only key writes: `secrets:SaveModelKey`, `ReplaceModelKey`, `RemoveModelKey`.
- Added, replacing the former `SessionNeverIdentityOrReveal`:
  - `SessionOwnPreferencesRead`: allows `iam:GetMyPreferences` on `IAM_WORKSPACE_PATTERNS.ownUser` only.
  - `SessionNeverIdentity`: denies `iam:*` everywhere except the session's own user (`NotResource`). An unbound `NotResource` excludes nothing, so a session with no workspace is denied everything (fails closed).
  - `SessionOwnUserReadsPreferencesOnly`: on the session's own user, denies every action except `iam:GetMyPreferences` (`NotAction`).
- Net effect: every identity action except that one read is explicitly denied, including `UpdateMyPreferences`, `RecaseMyUsername` and `SetPassword`. Key writes on the person's own user are explicitly denied as well.

### Tests changed or added

- **`server/program-route/tests/program-route.test.ts`**
  - The allowlist table is updated.
  - `create-project`, `rename-conversation` and `delete-conversation` are now refused, and no key write is allowed by token.
  - `get-my-preferences` is allowed and `update-my-preferences` is refused; no `program-gated` endpoint is reachable.
  - New preferences-narrowing tests: an empty body only. `userId`, `id`, `startingHumanness`, `authSessionId`, a nested `user`, a string, an array and a number are each refused.
  - New preferences-projection tests.
  - Removed: the create-project, thread-change and model-key narrowing and projection cases.
- **`paired-client-actor.test.ts`:** every allowlisted endpoint gets exactly the generic actor, with no `secrets.manage` or `identity.manage` anywhere.
- **`paired-model-key-writes.test.ts`** (rewritten):
  - An admin's token and a member's token are each refused all three writes with 403 "This endpoint is not available to a paired client." before any handler runs, and nothing is written.
  - A token still reads the snapshot, with no key id and no `secrets.manage` on its actor.
  - A revoked token is refused, and every other key write is still refused.
  - The panel's own writes are unchanged.
- **`model-key-check-first.test.ts`:** the paired-client variant now asserts refusal before any provider request (`fetch` is never called). The panel cases are unchanged.
- **`paired-client-projects.test.ts`:** `create-project` joins the refused list, and the two make-a-project tests are removed.
- **`panel-and-paired-client-projects.test.ts`:** projects are made in the panel, and a token's `create-project` gets 403.
- **New `paired-own-preferences.test.ts`** (real-sql):
  - Local profile, with a real pairing token:
    - the approving person's own value is read through POST `{}`, POST with no body, and GET;
    - each person's client reads only that person's value (40 against 10);
    - any field is refused before the handler runs, and an `authSessionId` is stripped;
    - `update-my-preferences`, `snapshot`, `recase-my-username` and `set-password` by token are refused, and the value is unchanged;
    - a revoked token gets 401.
  - Service profile (`FluxIQBrowserSession`):
    - the read is allowed for the session's own person (55 for Alice, and 20 when the session is Bob's);
    - a change, and a body naming Bob, are refused, and both values are unchanged.
- **`platform/iam/predefined/tests/predefined-decisions.test.ts`:**
  - `GetMyPreferences` is allowed on the person's own user and explicitly denied on another person's.
  - `UpdateMyPreferences`, `RecaseMyUsername`, `SetPassword` and `iam:Snapshot` are explicitly denied.
  - `SaveModelKey` on the person's own user is explicitly denied.
  - An owner's browser also only reads its preferences.
- **`user-access.test.ts`:** the browser reads its own preferences and is refused every change. The browser's model-key writes are denied; the panel's are still allowed.
- **`programs/secret-keys/api/tests/own-model-key-service.test.ts`** (edit approved by you):
  - The paired-browser block is now "writes no key, its own person's included": 11 writes, each `authorization.forbidden`, with the snapshot unchanged.
  - New test, "still has model access": the browser reads `modelAccess` as ready on its person's key, and `secrets:UseKey` is allowed on its own key and refused on another member's.
  - The free-check block keeps the panel member's cases. The browser is refused before the provider is asked.

### Commands run and observed results (from Core root or `packages/fluxiq`)

- `cd packages/fluxiq && npx vitest run src/server/program-route src/programs/identity-access` -> `Test Files 35 passed (35)`, `Tests 360 passed (360)`.
- `npx vitest run src/platform/iam/predefined src/programs/secret-keys src/programs/_shared/tests/api-iam.test.ts src/programs/_shared/model-access src/programs/_shared/key-access src/programs/automation-studio/api/tests/person-project.test.ts src/platform/provisioning` (the predefined-policy tests and the service-profile paired-client tests) -> `Test Files 71 passed (71)`, `Tests 583 passed (583)`.
- `npx vitest run src/platform/iam` -> 1 failure, not mine.
  - Failing test: `catalog/tests/live-registry.test.ts`, "actions.generated.ts drifted".
  - The only difference is `studio:WorkInProjectThread`. It is still in the committed catalog, but the identity worker's in-progress panel-assistant change no longer registers it.
  - It needs `FLUXIQ_REGENERATE_IAM_CATALOG=1` run in that worker's unit; I touched no registration.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (583 warning(s), 895 baselined)`, no FAIL ("9 baseline entries can be lowered").
- `node scripts/structure-audit.mjs --rule docs-links` -> `structure-audit: passed (0 warning(s), 0 baselined).` Same result again after the doc deltas below.
- `node scripts/docs-reference.mjs --check` -> `Deterministic framework reference is current.` Same result again after the doc deltas.
- `heavy-slot.mjs run t1095-pairing-f2 -- node scripts/build-cache/cli.mjs fluxiq:check` -> `{"build-cache":"reuse","step":"fluxiq:check","reason":"inputs and outputs match the stamp"}`, exit 0. Because the tree is shared, I ran it again forced:
  `FLUXIQ_BUILD_FORCE=1 heavy-slot.mjs run t1095-pairing-f2-force -- node scripts/build-cache/cli.mjs fluxiq:check` -> `{"build-cache":"build","step":"fluxiq:check","reason":"FLUXIQ_BUILD_FORCE=1; stored in the shared store (0 file(s), 0 bytes)","ms":35066}`, exit 0.

### Breaks outside my paths (they need an owner)

- **`apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`** mirrors Core's Automation Studio allowlist.
  - Against the rebuilt `dist` (someone's `fluxiq:build` already compiled these changes), `npx vitest run src/app/api/programs` gives `Tests 6 failed | 227 passed`.
  - The six failures:
    - "reaches rename-conversation / delete-conversation / create-project as the person who approved the pairing" (three tests);
    - "mirrors Core's paired-client allowlist for Automation Studio exactly";
    - "forwards a thread's rename and delete...";
    - "refuses a rename or delete that carries anything beyond...".
  - Fix: remove `rename-conversation` and `delete-conversation` (lines 47-48, 91-92, 389-390, 401-404, 415) and `create-project` (lines 81, 126, 133, 240, 263, 287) from that test, and assert 403 for them instead.
- **Stale comments only, no code:**
  - `packages/fluxiq/src/platform/iam/predefined/own-model-key-actions.ts` says "`FluxIQBrowserSession` keeps them".
  - `user-access.ts` says "`FluxIQBrowserSession` narrows to the same three".
  - `apps/web/src/lib/app-route-iam/paired-client-route-actor.ts:11` mentions "the program route's three model-key writes".
  - `programs/secret-keys/api/tests/two-step-writes.test.ts:9`.
  - Downstream `background/projects/projects-relay.ts:5`.

### Exact request and response the extension should use for get-my-preferences

`POST {coreApiUrl}/api/programs/identity-access/get-my-preferences`, with:
- headers `Authorization: Bearer <pairing token>` and `content-type: application/json`;
- body `{}`;
- `?domainId=<bound domain>` only if the client already sends it (a different domain is refused).

`GET` with no body works the same.

- 200: `{ "ok": true, "payload": { "startingHumanness": 40 } }`. The value is a whole number from 0 to 100, or `null` when the person set none. The person is always the one who approved the pairing.
- 403 when the body has any field: `{ "ok": false, "error": "A paired client's read of its person's preferences may not carry userId.", "errorCode": "authorization.forbidden" }`. The message names the first field it finds. A body that is not an object gets "... carries no body." instead.
- 401 for a revoked or unknown token.
- 403 "This endpoint is not available to a paired client." for `update-my-preferences`.
- On the service profile, a person whose identity policies refuse the read gets an IAM 403.

### Doc deltas applied

**For this follow-up:**
- `docs/architecture/automation-studio/client-gateway.md`:
  - new paragraph **Configuration stays in the panel (t1095)** before the endpoint list;
  - the rename/delete-conversation bullet is gone (its `fresh` and cross-project list notes moved into the conversation bullet);
  - new bullets for the `projects` switcher and for Identity Access `get-my-preferences`;
  - the model-key paragraph is rewritten: keys are written in the panel, a token is refused, and the session keeps model access.
- `docs/integrations/client-gateway-websocket.md`: new section "What A Paired Client Calls On The Program Route", with the refusals and the exact `get-my-preferences` request and response.

**Queued deltas from identity.md lines 321-326:**
- `client-gateway.md`, around line 86:
  - `AUTOMATION_STUDIO_CONTEXT_LEASE_MS` is gone, and a recording goes into the person's lasting current project.
  - `recording.project_required` (no current project) and `recording.project_context_mismatch` (another project named) stay.
  - I checked this against `resolveClientRecordingProject` in `apps/web/src/lib/automation-studio-context.ts`.
- `client-gateway.md`, "One current project per person":
  - the `context` event on `GET /api/panel/changes` (`{ "version" }`) after each committed write, sent only to that person's own streams, panel and paired client alike;
  - checked against `topics/context.ts` and the header of `route.ts`.
- `client-gateway-websocket.md`:
  - recording steps 2 and 5, and the lease paragraph, are rewritten. The `sendBeacon` clearing went with the lease; I confirmed no `sendBeacon` remains in `apps/web/src`.
  - the Web Panel APIs bullet for `GET /api/panel/changes` now names the `context` event.
- I did not touch the assistant-architecture doc, which is the identity worker's.

### Not verified

- No live browser or extension run.
- `apps/web` tests beyond `src/app/api/programs` (the allowlist mirror above) were not run.
- `web:check` was not run in this follow-up. No export changed, and the `isPairedClientClassification` signature is kept.

## Follow-up 3 (sub-supervisor request: the apps/web program-route test, now mine)

**Outcome:** done. The test now matches Core's new allowlist. I kept the coverage and turned the old "reaches" cases into refusal assertions instead of deleting them. The live-registry catalog drift has gone to the identity worker.

**What changed in `apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`:**
- `ALLOWLISTED` loses `create-project`, `rename-conversation` and `delete-conversation`.
- New constant `PANEL_ONLY` lists those three. They stay in the mocked registry as `authoring`, which proves the allowlist refuses them, not their classification.
- The "reaches %s" case and `forwardedPayload` lose their create-project and rename/delete branches.
- The three rename/delete tests (forward; refuse extra fields; refuse a non-object body) are replaced. New test: "refuses %s, though registered as authoring, by GET and POST, whatever the body, without the token being looked up". It runs once for each `PANEL_ONLY` endpoint, with three bodies each, including a non-object body. Each call must answer exactly `403 { ok: false, error: "This endpoint is not available to a paired client." }`. It also checks that the token is never looked up and Core is never called.
- New test: "refuses every key write, the person's own model key included, and reads the key state". The three model-key writes are refused even when registered `program-gated`. The `snapshot` read still answers, with no key id.
- New test: "reads the person's own preferences with an empty body only, and never changes them". For `identity-access get-my-preferences`:
  - `{}` reaches Core as the approving person with payload `{}`, and the answer is cut to `{ startingHumanness }`.
  - A body naming `userId` gets 403 `authorization.forbidden`.
  - `update-my-preferences` gets 403.
  - Core is not called for either refusal.
- "mirrors Core's paired-client allowlist for Automation Studio exactly" is unchanged, and passes against the new allowlist.

**Commands run and observed results:**
- The first `cd apps/web && npx vitest run "src/app/api/programs"` refused to start: "Core's library build is 18 minute(s) behind its source". Another worker's later edit of `packages/fluxiq/src/programs/_shared/runtime.ts` had left `dist` stale.
- I rebuilt through the heavy slot: `heavy-slot.mjs run t1095-pairing-f3-build -- node scripts/build-cache/cli.mjs contracts:build fluxiq:build ui-components:build` printed `contracts:build` reuse, `fluxiq:build` build ("inputs changed: packages/fluxiq", 209683 ms), `ui-components:build` build (23241 ms), exit 0.
- `cd apps/web && npx vitest run "src/app/api/programs"` then gave `Test Files 13 passed (13)` and `Tests 232 passed (232)`.
- `node scripts/structure-audit.mjs` gave `structure-audit: passed (583 warning(s), 895 baselined)`, with no FAIL.

**Not verified:** no live run. `web:check` was not run; I changed only a test file and no exports.
