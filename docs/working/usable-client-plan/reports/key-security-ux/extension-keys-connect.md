# extension-keys-connect (worker, Sonnet)

X = apps/extension/src. Files below are relative to X unless stated.

## Outcome
Partial: all six items built and checked, but 3 tests in `background/panel/tests/open-purpose.test.ts` (not mine) now fail because the keys page moved to `/settings#ai-keys`; the lead must update them (below). No live browser look.

## Per item
1. **Port.** New `panel/chat/transport/ports/model-keys/` (`read-model-access.ts`, `refuse-key-write.ts`, `model-keys-port.ts`, index, test). `readState` reads `panel.modelReadiness`, `readModelAccessState` then `modelAccessFromCore`; absent/unreadable -> Update FluxIQ; failed request -> `{ok:false,"Couldn't check your AI key just now."}`. `canWrite:false`, `requiresPassword:false`; save/replace/remove all go through `refuseKeyWrite()` (takes no value; the one place to wire the relay). Handed to the chat as `ChatTransport.modelKeys` (`create-extension-chat-transport.ts`). Tests: each card state with/without `modelAccess`, writes send nothing and the value is in no answer, log or storage, transport carries the port.
2. **Settings > Model.** New `settings/model-section.ts` (full card; reads only while connected, else "Connect to FluxIQ to see your AI key."). Open FluxIQ / Change model press a silent Open FluxIQ (`open-fluxiq-button.ts` gained `look:"silent"` and `press()`); Try now re-reads. Route: `shared/fluxiq-web-routes.ts` keys -> `/settings#ai-keys` (new `shared/tests/fluxiq-web-routes.test.ts`). Tests in `settings/tests/settings-order.test.ts` (6 states, not connected, host actions, Save says "Add it in FluxIQ for now." and sends nothing) and `open-fluxiq/tests/silent-press.test.ts`.
3. **One reader.** `extensionSetupPort` now calls `readModelAccess` (the card's reader); `ModelKeyReading = ModelAccessState | "unknown"` (`model-key-reading.ts`). Settings' card reads through `SetupPort`. Deleted `getting-started/model/` (key/ parser, reader, tests), `setup-card.ts` and its test, `model-key-dismissal.ts`, the setup-card CSS and the key step (a key line no longer appears in the steps; steps 1-4 stay), `settings/model-key-line.ts`.
4. **Server check.** `reachability/reader.ts`: `discoveryProbe` accepts only a valid discovery document naming the origin it fetched (`parseFluxIQDiscoveryDocument`), not any 200; reader answers `ServerFinding {origin, host, found, gatewayUrl}` for the configured address (built-in default only when none is saved). Step 1 says "FluxIQ found at 127.0.0.1:3100" or "isn't answering at ..." with **Change** (`start/server/change-address.ts`: one field, checks the address, saves web address plus the document's `gatewayUrl`). Connect saves the found `gatewayUrl` first if it differs. Tests: `reachability/tests/{reader,discovery-probe}.test.ts` (valid vs any-200, wrong origin, non-JSON, 404, throw), `start/tests/{steps,view}.test.ts`.
5. **Revoke wording.** Step 4 is never Done while not connected (`steps.ts`); after error/reconnecting it says "FluxIQ may have removed this browser. Connect again to ask for approval."; paired + disconnected says "This browser was approved earlier. Connect to check it still is." Same words in `settings/approval-line.ts`. Disconnect hides while disconnected (`settings-view.ts`). Tests: steps.test.ts, settings-order.test.ts, small-fixes.test.ts.
6. **Small fixes.** "Saved." clears on leaving (`settings-view.ts hidden()`); Forget question `scrollIntoView` (`forget-confirmation.ts`); Open FluxIQ under step 2 also while the code waits, every step keeps its title, pairing Cancel is "Cancel approval request" (`view.ts`); "Allow direct requests" hidden while forbidden (`form-fields.ts hideWhenForbidden`, `address-form.ts`); problem report "versions and recent failures"; E11 "Not now" is gone with the setup card. Tests: `settings/tests/small-fixes.test.ts`.

## Commands (observed)
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit clean ("extension:check ... source: command", 143 s; runs tsc for src and tests, and bundles every entry).
- `EXTENSION_TEST_BUILD_LABEL=t925-ekc node scripts/test-extension.mjs panel/settings panel/getting-started panel/chat panel/open-fluxiq panel/shell shared/tests background/panel` -> `# tests 425, pass 422, fail 3`; the 3 are `background/panel/tests/open-purpose.test.ts` #45-47 (expect `/security/keys`). Without `background/panel` the same run: 0 failures.
- `node scripts/structure-audit.mjs` (EXT) -> no FAIL lines (first run found 6 mine, all fixed: `as never`, packed statements, deep import).
- `pnpm --filter @fluxiq-web-extension/extension build` -> chrome, firefox, e2e-chromium "verified 26 files".
- Banned-word grep (unlock, vault, seal, credential, scope, token, ids) over person-facing strings I touched -> none.

## Edits outside the owned list (please accept or revert)
- `panel/shell/mount-panel.ts`: removed the setup card, the key reader and its focus refresh; passes the probe to the start view and `reachability.current()` to `startGuide`. `panel/shell/contracts.ts`: one comment.
- `e2e/content/tests/screens/journey-panel.ts`: the fake setup port returns card states, and the fake `modelReadiness` reply carries `modelAccess` (type check needed it).
- Deleted `createModelKeyReader`: with the card gone nothing used it.

## Lead actions
- Update `background/panel/tests/open-purpose.test.ts` lines 36-37, 46-47, 55 to `/settings#ai-keys` (path `/settings`, hash `ai-keys`).
- `packages/test-runner/src/extension-chat-check/prove/approved-client/keys-page.ts` still expects `/security/keys`.

## Not verified
- No live browser: the card at 360 px, Change form, Open FluxIQ landing on the panel's `/settings#ai-keys` (panel worker's page).
- "Read after a chat failure" and "on reconnect" for the chat's compact card: the shared card refreshes only when its empty state reappears; no hook from a failed reply exists in this tree. Settings reads on open, on focus and on reconnect.
- `how-to-update` also opens FluxIQ (no update page is known). Revoke is still inferred from error/reconnecting (background does not say revoked).
- Real `/.well-known/fluxiq` against a running panel was not fetched (ports are off limits); the probe is tested with a faked fetch and Core's own reader.
- Popup (`popup/**`) needed no change.

```text
Outcome: Partial
Changed: apps/extension/src/panel/{chat,getting-started,settings,open-fluxiq,shell}/**, src/shared/fluxiq-web-routes.ts (+ shared/tests), e2e/content/tests/screens/journey-panel.ts; deleted getting-started/model/, setup-card.ts, model-key-dismissal.ts, settings/model-key-line.ts
Validation: `pnpm --filter @fluxiq-web-extension/extension check` -> clean; changed-dir tests 422/425 (3 background open-purpose tests expect the old /security/keys); structure-audit no FAIL; build verified
Not verified: live browser, compact card refresh after chat failure/reconnect, real discovery fetch
Report: C:/Users/osrs_/FluxStuff/fxwork/t925/!FluxIQWebExtension/docs/working/usable-client-plan/reports/key-security-ux/extension-keys-connect.md
Notes: Lead must update background/panel/tests/open-purpose.test.ts (route moved) and test-runner keys-page.ts.
```
