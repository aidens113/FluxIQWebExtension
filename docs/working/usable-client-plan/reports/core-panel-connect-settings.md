# Core panel: Connect a client in Settings (Brief D, connect part)

## Outcome
Partial. The feature is built and its tests pass. `pnpm --filter @fluxiq/web check` still fails on one error in a file I do not own (below), none in my files.

## What a person now sees
Settings has a new "Connect a client" section (after AI keys, before Starting humanness):
- Three copy rows, each with a Copy button and a "Copied." or "Could not copy" message: Panel address, Gateway address (the WebSocket URL), and the `/.well-known/fluxiq` data shown as JSON. If the gateway is off it says so; if discovery cannot be read it says so and keeps the other two.
- Three plain steps for pairing the browser extension.
- "Waiting to pair": each request shows the client name and its code, with Approve and Dismiss. Approve pairs the client and nothing else is asked (no unlock, password or key). The list refreshes every 4 seconds, so a new request appears on its own.
- "Connected clients": every paired client with its state, last use and a Forget button with a confirmation, including revoked or inactive ones (previously Forget showed only for active clients; the Security page list is the same component, so it changed there too).
- While loading: a status line. If the first read fails: an alert with "Try again". A later failed refresh keeps what is shown.

## What changed
New `W/features/settings-page/connect/` (barrel + one thing per file): `ConnectClientSection.tsx`, `CopyField.tsx`, `PendingPairings.tsx`, `use-connect-view.ts` (poll + retry), `load-connect.ts` (reads `/api/client-gateway/snapshot` and `/.well-known/fluxiq`), `connect-info.ts`, `pending-pairing.ts`, `resolve-pairing.ts` (posts to the existing `approve-pairing` and `dismiss-pairing` routes), `tests/connect.test.tsx`.
Edited: `ui/SettingsPage.tsx` (mounts the section), `ui/settings-page.css` (copy row styles), `security/access/PairedClientsList.tsx` (Forget for every row).
Forget uses the existing `forgetPairedClient` (automation-studio `revoke-client-trust`), not the credential-only `forget-pairing` route. No routes or `engine-tools.ts` touched.

## Commands run and observed
- `pnpm --filter @fluxiq/web exec vitest run ...` refused to start: "Core's library build is 5 minute(s) behind its source" (another worker is editing `packages/fluxiq/src/server/program-route/program-route.ts`). I did not rebuild the shared Core.
- Instead ran vitest with a scratch config that is the same as `apps/web/vitest.config.ts` minus the freshness guard (`.../scratchpad/vt.config.mjs`), on `src/features/settings-page/connect`, `settings-page/ui/tests`, `settings-page/model/tests`, `security/access/tests`: 12 files, 59 tests, all passed.
- `pnpm --filter @fluxiq/web check` (twice, slow: waited on other workers' runs). First run: my test had a type error (fixed). Second run: one error left: `packages/fluxiq/src/runtime/conversations/commands/answer-ask.ts(66,73): TS2554 Expected 1 arguments, but got 2`. The first run also showed `ChatsPage.test.tsx` and `FlowsProjectPicker.test.tsx` (13,136) type errors and `runtime/llm/index.ts` missing `AutomationStudioSecretsLockedError`; these were gone by the second run (other workers' files, in flux).

## Not verified
- The real vitest config run (blocked by the stale-Core guard) and a clean `check` (blocked by `answer-ask.ts`, not mine).
- Live browser: the section was not opened in a running panel; no real pairing was approved. Only mocked fetch in tests.
- Whether the snapshot returns `pairings` under the service profile: `callerGatewaySnapshot` sends `pairings: []` for non-panel or service callers, so on a hosted service profile the waiting list will be empty.
- The stale "lock and unlock" wording in `engine-tools.ts` and the legacy `unlocked` mapping in `security/keys` (not in this brief's scope).

## Open questions
- Connected clients are the trusted (paired) clients; live online/offline from `sessions` is not shown. Say if you want it.
