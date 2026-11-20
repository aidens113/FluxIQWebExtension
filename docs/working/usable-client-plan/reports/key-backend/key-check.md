# Key check (t928, key-backend)

## Outcome
Done for every owned item. One wiring edit in `programs/_shared/runtime.ts` is left for the owner (lines below).

## What changed and why
Core tree `fxwork/t928/!FluxIQ`, branch `task/t928-key-backend`, uncommitted.

1. **Free check** `runtime/models/secrets/model-access/check-key.ts`, exported from the barrel.
   ```ts
   type AutomationStudioModelKeyCheckInput = { provider: "anthropic" | "deepseek"; value: string; fetch?: typeof fetch; signal?: AbortSignal };
   type AutomationStudioModelKeyCheckResult = { outcome: "answered" | "provider_refused" | "no_credit" | "provider_unreachable"; message?: string };
   function checkAutomationStudioModelKey(input: AutomationStudioModelKeyCheckInput): Promise<AutomationStudioModelKeyCheckResult>;
   ```
   Anthropic: `GET https://api.anthropic.com/v1/models` (`x-api-key`, `anthropic-version`). DeepSeek: `GET /models`, then `GET /user/balance` (Bearer); `is_available:false` or no positive `total_balance` is `no_credit`. 401/403 refused; 402 or a balance sentence (`automationStudioProviderBalanceExhausted`) no_credit; network error, timeout (15 s, plus the caller's signal), 5xx, other statuses and an unreadable DeepSeek balance body unreachable. `redirect: "error"`. The key is only in the request header and appears in no message or error. Base URLs come from the providers' own constants.
2. **Contract** `packages/contracts/src/platform/model-keys/model-access.ts`: status `no_credit` and call outcome `no_credit`; the reader accepts it, and requires `lastCall.outcome === "no_credit"` with it. State words: "<Provider> says the account behind <key name> has no credit left." (`automationStudioModelAccessBalanceMessage(provider, keyName)`, signature changed). A chat call refused for balance (DeepSeek 402, Anthropic "credit balance is too low") now records `no_credit`: `automationStudioModelAccessOutcomeOf` maps `llm.provider_balance_exhausted` to it, and `caller-key-chat/model.ts` words it with the key name.
3. **Old-format wording**: "The saved model key is in an old format, and it is upgraded automatically the next time its owner signs in to the FluxIQ panel."
4. **Ledger** `model-access/ledger.ts`:
   ```ts
   new AutomationStudioModelAccessLedger(now: () => number = Date.now, persistence?: AutomationStudioModelAccessLedgerPersistence)
   type AutomationStudioModelAccessLedgerPersistence = { read(): Promise<unknown>; write(entries: AutomationStudioModelAccessLedgerEntry[]): Promise<void> };
   type AutomationStudioModelAccessLedgerEntry = { keyId: string; version: number; outcome: ModelAccessCallOutcome; atMs: number; message?: string };
   type AutomationStudioModelAccessLedgerKey = { id: string; updatedAtMs: number; lastRotatedAtMs?: number };
   ledger.note(key, outcome, message?) / ledger.noteCheck(key, { outcome, message? }) / ledger.lastCall(key) / ledger.lastMessage(key)
   ledger.subscribe(listener: () => void): () => void
   ledger.whenLoaded(): Promise<void>
   automationStudioModelAccessKeyVersion(key): number   // lastRotatedAtMs ?? updatedAtMs
   ```
   Entries are keyed by the value version, so a rename keeps a refusal and a rotation clears it. `subscribe` fires only when a key's outcome or version changes (not for a repeat, nor an `atMs`/message change). The port is read once on construction (malformed or failing store starts empty; an outcome noted meanwhile wins) and written only on such a change; a failed write is ignored (best-effort, it only reports). `AutomationStudioSessionKeySummary` gained optional `lastRotatedAtMs` (Secret Keys' summaries already carry it). Callers in my paths (`state.ts`, `caller-key-chat/model.ts`) work unchanged with the two-argument constructor; the state uses the new `no_credit` branch.
5. **Lent key in Flow calls**. The release already accepted a lent key (`flowKeyId` + `keyOwnerUserId`, `workspaceAssistant: true`; Secret Keys checks both consents; a claimed holder that is not the key's holder is refused). What was missing was the resolver passing it. `llm/resolver-contract.ts` input gained `lentKey?: { keyId; ownerUserId }`; `llm/session-key-provider.ts` uses `lentKey.keyId` when the Flow names no key and releases it with `keyOwnerUserId`.

## runtime.ts lines to change (not edited)
`programs/_shared/runtime.ts` in `bindLlmExecutionProvider`, replace lines 319-325 with:
```ts
    let lentKey: { keyId: string; ownerUserId: string } | undefined;
    if (!providerId && !modelId && request.caller) {
      const choice = chooseAutomationStudioCallerModelKey({ keys: (await sessionKeyPorts.snapshot()).keys, userId: request.caller.actorUserId, preferred: await preferredModelKey() });
      if (choice.ok) {
        providerId = choice.provider;
        modelId = choice.model;
        if (choice.keyOwnerUserId) lentKey = { keyId: choice.key.id, ownerUserId: choice.keyOwnerUserId };
      }
    }
    return resolveSessionProvider({ ...request, metadata, ...(lentKey ? { lentKey } : {}), ...(providerId ? { providerId } : {}), ...(modelId ? { modelId } : {}) });
```
(the old `return` on the next line goes away). Line 304: pass the host's persistence, `new AutomationStudioModelAccessLedger(Date.now, persistence)`, and `await modelAccessLedger.whenLoaded()` before the first state read so a restart reads the stored outcome. The snapshot path should also call `modelAccessLedger.noteCheck(key, result)` after a check, and a client that wants pushes calls `ledger.subscribe`.

## Commands run and observed results
- `npx vitest run src/runtime/models src/runtime/llm --poolOptions.forks.maxForks=2 --poolOptions.forks.minForks=1` (the brief's `--maxWorkers=2` fails here: "options.minThreads and options.maxThreads must not conflict", a config conflict) -> 292 files, 2947 tests passed. This run began before the final lint-driven edits to `check-key.ts` and `ledger.ts`.
- After those edits: `npx vitest run src/runtime/models/secrets src/runtime/llm/caller-key-chat ...` -> 7 files, 35 tests passed.
- `npx vitest run src/platform/model-keys` (contracts) -> 2 files, 6 passed.
- `pnpm --filter @fluxiq/contracts check` -> exit 0 (after the initial run built a stamp, no errors printed).
- `pnpm --filter fluxiq check` -> fails with 22+ TS errors; direct `tsc` rerun lists them: none in `runtime/models`, `runtime/llm` or contracts. All are in `programs/secret-keys/**`, `programs/_shared/tests`, `programs/identity-access`, `programs/automation-studio`, `client-gateway/service/model-access/tests` and `src/tests/*`, mostly `'authorizationPassword' does not exist in type 'CreateSecretKeyInput'` (the key-backend worker removing the password), plus `programs/secret-keys/api/handlers.ts` (1). Not mine, not fixed.
- `node scripts/structure-audit.mjs` -> 3 violations, none in my paths (two `apps/web` imports of `key-sessions`, one `client-gateway/service/model-access/delivery.ts`). My first run had 4 violations in my files (failure-as-empty, imports, swallowed-failure, statement-packing); fixed.

Tests added: `model-access/tests/check-key.test.ts` (stubbed fetch for every case, key never in a result), `model-access/tests/ledger.test.ts` (version keying, subscribe once per change, persistence surviving a new instance, malformed store), `secrets/tests/lent-key-release.test.ts` (lent key with and without both consents, wrong holder, no lending claimed), `state.test.ts` and `caller-key-chat/tests/model.test.ts` (no_credit for DeepSeek 402 and Anthropic "credit balance is too low"; legacy wording), `model-access.test.ts` (contract).

## Not verified
- No live provider call; the check was exercised with stubbed `fetch` only. Anthropic's real `/v1/models` accepts `x-api-key`, but the existing chat adapter sends `Bearer`; I followed the brief for the check.
- The resolver's use of `lentKey` has no test of its own (the provider's secret resolution is internal to the adapter); the release it calls is tested.
- The runtime.ts wiring and the persistence host implementation do not exist yet, so restart persistence is proven at the ledger level only.

## Open questions
- Check results are recorded under the key's id and version; the caller that runs the check must pass the same `{ id, updatedAtMs, lastRotatedAtMs }` summary the state uses.
