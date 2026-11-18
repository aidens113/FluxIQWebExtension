# protocol-split report

## Outcome
Done. `shared/protocol.ts` is 793 lines (was 818).

## What changed and why
- New `apps/extension/src/shared/model-key-messages.ts`: `PanelModelKeySummary`, `MODEL_KEY_PROVIDERS`, `ModelKeyProvider`, `PANEL_MODEL_ACCESS_CHANGED`, `PanelModelAccessChangedMessage`, moved verbatim with comments. It takes the two type imports (`ModelAccessState`, `ModelKeyAvailability`) with it.
- `protocol.ts`: declarations and those two imports removed. `AUTOMATION_PANEL_MESSAGES` is untouched (message strings unchanged).
- Import lines updated (no re-export from protocol.ts): `background/automation-relay/automation-relay.ts`, `background/model-access/model-access-changed.ts`, `background/model-access/model-key-relay.ts`. No file under `panel/**` imported the moved names.

## Commands run and observed results
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (253 warning(s), 551 baselined)."
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0.
- `node apps/extension/scripts/test-extension.mjs background shared` -> 1039 tests, 1039 pass, 0 fail.

## Not verified
- `panel` test directory not run: nothing there imports the moved names.

## Open questions or contradictions found
None.
