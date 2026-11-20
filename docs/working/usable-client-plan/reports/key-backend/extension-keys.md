# extension-keys report (t928)

## Outcome
Partial. Code and tests complete and passing; typecheck and build blocked by Core's stale build (supervisor must rebuild Core).

## What changed and why
Reviewed the crashed worker's edits; they were complete and matched the brief, so no code changes were needed.
- shared/protocol.ts: modelKeySave/Replace/Remove in AUTOMATION_PANEL_MESSAGES, MODEL_KEY_PROVIDERS, PANEL_MODEL_ACCESS_CHANGED + PanelModelAccessChangedMessage, key/provider fields on AutomationPanelRequest.
- background/model-access/ (new): model-key-relay.ts (maps each message to save-model-key / replace-model-key / remove-model-key on "secret-keys"; answers { modelAccess } read via readModelAccessState then pairedClientModelAccessState; cuts the key out of any failure text; refuses bad input before calling Core), model-access-changed.ts (push to broadcast, malformed dropped), index.ts, tests/.
- automation-relay.ts: one dispatch line.
- connection/server-command-channel.ts: one dep field and one dispatch branch; connection.ts: wiring entry.
- connection/tests/model-access-push.test.ts: push becomes the broadcast.

## Commands run and observed results
- `EXTENSION_TEST_BUILD_LABEL=t928keys node scripts/test-extension.mjs background/automation-relay background/model-access background/connection` (via heavy slot) -> tests 420, pass 420, fail 0.
- `node ../../scripts/structure-audit.mjs` (apps/extension) -> "structure-audit: passed (252 warning(s), 551 baselined)".
- `pnpm --filter @fluxiq-web-extension/extension check` -> failed at core-build gate: "FluxIQ Core's build ... is not current with its source. Stale: fluxiq:build: no stamp; ui-components:build: no stamp." No typecheck ran.
- `pnpm --filter ... build` -> did not complete (stopped; waited on heavy slot after the check failed; same Core-currency gate expected).

## Not verified
Extension typecheck and build (need Core rebuilt in C:\Users\osrs_\FluxStuff\fxwork\t928\!FluxIQ: `pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build`). No live browser check.

## Open questions or contradictions found
None. docs/working/usable-client-plan/reports/key-backend/key-check.md exists in the reports dir and is not mine.
