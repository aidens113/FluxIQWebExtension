# G3 panel mark (t807)

Outcome: Partial. The panel half is done and green. The background confirm path still drops `mark` (not mine to edit).

Changed (apps/extension/src): panel/extraction/{view-model,confirm-payload,field-row}.ts, extraction.css, three tests in panel/extraction/tests/ (confirm-payload, view-model, field-row); shared/extraction-messages.ts (one added optional `mark` on `ExtractionConfirmField`, strictly required by the payload type).

- Row type carries `mark` (type is `WebAutomationExtractFieldSpec["mark"]`; `WebAutomationExtractFieldMark` is not exported from `domain/client`). Proposal -> row -> confirm payload keep it; unset stays undefined.
- Picker shows a "Badge marker" / "Flag marker" / "State marker" tag (text plus title hint) on the field's meta row; unmarked rows unchanged.
- Preview table needs no change: it renders cells by column key and a mark column is an ordinary column (empty where off).
- No authored doc under docs/architecture names the picker fields (grep empty).

Open: `apps/extension/src/background/extraction/definition.ts` (`proposedColumns`, `fieldSpec`) builds the recorded spec from the confirm field and does not copy `mark`, so the confirmed spec still loses it end to end. It needs `mark` written in both, only under the kinds that read it (flag: attribute; badge/state: attribute or text). Owner of background/extraction should do it.

Checks (from apps/extension; the brief's `scripts/test-extension.mjs` lives in apps/extension/scripts): tsc tsconfig.json 0 and tsconfig.test.json 0; panel/extraction suite 174/174 (no hang); structure-audit passed; model-text exit 0. First run had one failing test (fake DOM does not reflect `.title`; fixed with setAttribute). Fail-first not separately run before implementing.
