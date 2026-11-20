# shared-model-access (worker, Sonnet)

## Outcome
Done, with three small edits outside the brief's owned list (below, flagged) and one thing not wired (E13 title).

## Exports (U = Core packages/ui-components/src; all from the U root barrel, `export * from "./model-access/index.ts"` plus one named export)
- `type ModelAccessState` = `{kind:"ready";provider;keyName} | {kind:"no-key"} | {kind:"cant-open";keyName} | {kind:"not-accepted";provider;keyName} | {kind:"unreachable";provider} | {kind:"update-fluxiq"}` (`provider` is the display name, e.g. "Anthropic").
- `modelAccessWords(state): {badge; tone:"ok"|"warn"|"bad"|"neutral"; sentence; action:{id; label}}`; `MODEL_ACCESS_CHECKING = "Checking your AI key..."` (null state). Words are exactly the brief's.
- `modelAccessFromReadiness(readiness: ModelReadiness, keys?: unknown): ModelAccessState | null` (U/chat/onboarding/access-from-readiness.ts, one file). ready->ready (provider/name from the first enabled llm key in `keys`, else "Your AI provider"/"your key"), missing->no-key, the three unavailable causes->cant-open, upgrade_required->update-fluxiq, unknown->null.
- `ModelKeysPort = { readState(): Promise<ModelKeysResult<{state: ModelAccessState; keyId?: string}>>; save({provider,name?,value,password?}): Promise<ModelKeysResult<{keyId?: string}>>; replace(keyId,value,password?): Promise<ModelKeysResult>; remove(keyId,password?): Promise<ModelKeysResult>; check?(keyId): Promise<ModelKeysResult>; readonly requiresPassword: boolean; readonly canWrite: boolean }`; `ModelKeysResult<T> = ({ok:true}&T) | {ok:false; message}`; `ModelKeySave`.
- `createModelKeyCard({port, variant:"full"|"compact", providers, onAction(action)}): {element, refresh(): Promise<void>, destroy()}`; `ModelKeyHostAction = "change-model"|"try-now"|"how-to-update"|"open-fluxiq"`; `defaultModelKeyProviders` (Anthropic (Claude) first, DeepSeek; key pages console.anthropic.com/settings/keys, platform.deepseek.com/api_keys); `ModelKeyProvider`.
- `ChatTransport.modelKeys?: ModelKeysPort` (U/chat/ports/transport.ts), the way a client hands the port to the chat. `ChatModelsPort` unchanged.
- Behaviour: Add/Paste it again/Replace key open the inline form (replace asks the key alone and calls `replace(keyId,...)`; no keyId falls back to `save`); Save -> "Checking with <Provider>..." -> optional `check(keyId)` -> `readState()` -> new state in place; password field and requirement only when `requiresPassword`; `canWrite=false`: nothing is sent, Save says "Add it in FluxIQ for now." and shows an "Open FluxIQ" button that calls `onAction("open-fluxiq")`; the value field is cleared as soon as it is sent; full variant has Remove with one inline confirm (compact has none).

## Files
New: U/model-access/{index,state,words}.ts, key/{index,card,form,remove,providers,port,result}.ts, model-access.css, tests/words.test.ts, key/tests/card.test.ts; U/chat/onboarding/access-from-readiness.ts + tests/access-from-readiness.test.ts.
Changed: U/chat/view/empty-state.ts (compact card in place of the key line when hooks.modelKeys is given; refreshes when it reappears), empty-state-model.ts (new `access` field; MODEL_KEY_LINE is now the no-key sentence), conversation/composer.ts (disabled placeholder is the reason sentence; read error says "Can't read this chat right now."), view/thread-header.ts (optional `firstMessage`), onboarding/model-unavailable-words.ts (now the shared sentences; the old "Sign in to the FluxIQ panel once" wording is gone), onboarding/index.ts, ports/transport.ts, U/index.ts, chat/chat.css (one @import of the card sheet, so a chat host needs nothing more), package.json (0.15.0, `./styles/model-access.css` export, file in `files`). Tests updated: view/tests/empty-state-model, view/tests/thread-header (+2 tests), conversation/tests/composer-unavailable, tests/chat-widget (old "host configuration" assertion).

## Commands (Core tree, observed)
- `pnpm --filter @fluxiq/ui-components check` (run as `pnpm check` in the package) -> passed (tsc, 18s).
- `npx vitest run src/model-access src/chat` (package) -> 112 files, 758 tests passed. New tests cover each of the six states' words and action, save -> checking -> state, canWrite=false, requiresPassword, no key value in the DOM after save (ok and refused), remove confirm, failed read.
- `node scripts/structure-audit.mjs` -> 3 violations, all in apps/web (settings-page/connect naming, security/sign-in YourSignIn.tsx packing, identity-call.ts swallowed failure): the other worker's tree, none in my paths. My own violations (naming prefixes, packing, swallowed catch) were fixed and re-checked.
- `node scripts/build-cache/cli.mjs ui-components:build` -> succeeded (1253 files stored).
- Banned words: grep over new person-facing strings found none (only in code comments).

## Edits outside the owned list (please accept or revert)
1. U/chat/chat-widget.ts: one added line passing `modelKeys: {port, onAction}` into `createEmptyState`; every card host action (change model, try now, how to update, open FluxIQ) clicks the host's existing Open FluxIQ control (`keyOpener`). Without it the card never appears in a real chat. A host wanting a richer Change model action needs a `ChatWidgetOptions` hook.
2. packages/ui-components/src/chat/chat.css: the `@import` (listed as "only if needed").

## Not done / not verified
- E13 not fully wired: thread-header now hides a title that is only the first message, but nothing passes `firstMessage`. Core's thread summary has no first-message field; `threads/chat-threads.ts:182` (not mine) must pass it, or Core's title should stop being the message.
- Composer: the placeholder now says the reason sentence, but the model-access sentence is not wired to the composer (the composer is not disabled by a key state; widget would call `composer.setPlaceholder`). Not done.
- No real browser look at the card; CSS is tokens only and unseen at 360px. P12 (draft kept across layout switch) not touched (not in this brief).
- The adapter will be replaced by t924's mapping; `not-accepted`, `unreachable` and no-credit are not producible from today's readiness, so only ready/no-key/cant-open/update-fluxiq appear until then.
- Extension/panel adapters (`modelKeys` port, `canWrite=false` in the extension) are not built here.
