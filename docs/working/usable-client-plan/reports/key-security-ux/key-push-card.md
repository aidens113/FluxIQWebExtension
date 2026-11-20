# key-push-card report (t925, key-security-ux)

## Outcome
Done. The key card follows a pushed state with no read, and has a seventh state, No credit.

## What changed and why
Core U = packages/ui-components/src:
- `model-access/key/port.ts`: optional `subscribe(listener)` (state drawn at once, `null` = read again).
- `model-access/key/card.ts`: subscribes on create, draws a pushed state (supersedes an in-flight read, calls `onState`), `null` calls refresh, unsubscribes on destroy. The empty-state card and the composer key bar use the card, so they follow it too (comment updated in `chat/onboarding/composer-key-bar.ts`).
- `state.ts`, `words.ts`, `contract/*`: state `no-credit {provider,keyName}`, badge "No credit", the briefed sentence, action Replace key; `CoreModelAccess.status` gains `no_credit`, mapped by `modelAccessFromCore`.
Extension X = apps/extension/src/panel:
- New `chat/transport/ports/model-keys/subscribe-model-access.ts`: local constant `fluxiq.panel.modelAccessChanged`; parses `modelAccess` with `readModelAccessState`, maps with `modelAccessFromCore`; other messages ignored; an unreadable state gives `null` (read again) rather than a guess.
- `modelKeysPort(request, read, subscribe)`; the chat transport passes `subscribeModelAccess(listen, ...)`.
- `SetupPort.subscribeModelKey?`, implemented by `extensionSetupPort(request, listen = listenToRuntime)`; Settings > AI key passes it to the port (no timer, no second reader).
- Getting-started key step is a plain "to do" with no reading (per steps.ts), so nothing there lags. Shell needed no change (default setup port wires itself).
Tests added: words, from-core, card (push, null, destroy), composer bar (push, no read), subscribe-model-access (4), setup port, Settings card follows push.

## Commands run (all through the slot queue)
- `pnpm --filter @fluxiq/ui-components check` -> exit 0.
- U vitest src/model-access src/chat/onboarding -> 7 files, 39 tests passed (first run had 1 failure from a shifted STATES index in my edit; fixed, rerun green).
- `ui-components:build` -> built (1273 files).
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0.
- Extension tests (panel/chat panel/settings panel/getting-started panel/shell, label t925-push) -> 292 tests, 292 pass, 0 fail (first run 1 fail, my fixture lacked lastCall; fixed).
- structure-audit, extension tree -> "passed (253 warnings, 551 baselined)".
- structure-audit, Core tree -> 1 violation, not mine: `apps/web/src/features/model-keys/port/tests/create-panel-model-keys-port.test.ts` statement-packing line 176 (the other worker's file).

## Not verified
No live browser run. `no_credit` through the real contract reader: this tree's reader does not know it yet (reads as unreadable, so a broadcast gives `null`, then the read gives Update FluxIQ) until t928 merges; the mapping is tested by fixture. After t928 merges, switch the local constant to `PANEL_MODEL_ACCESS_CHANGED` from shared/protocol.ts.

## Open questions
None.
