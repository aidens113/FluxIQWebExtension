# Key model access (t924, worker key-model-access)

## Outcome

Done. A saved key now serves project chats from the panel and from the extension. The cause was found, fixed in Core, and proven live on both clients: first a dummy key that Anthropic refused, then one real Claude reply in each. "No model key is set up yet" now appears only when no key exists. Every other failure names its real reason in the chat reply and in a new model-access state that clients read from the Secret Keys snapshot.

All changes are in Core (`fxwork/t924/!FluxIQ`, branch `task/t924-key-model-access`), uncommitted. The extension tree has only this report.

## Cause (reproduced, then traced)

Project chats were bound once, at startup, to the provider of the process-wide default model. They then looked only for a key of that provider. The default model is `deepseek-flash` unless `FLUXIQ_LLM_DEFAULT_MODEL` is set, so a saved Anthropic key was never considered.

Evidence, from `HEAD` (`297f26ff9`):

- `packages/fluxiq/src/programs/_shared/runtime.ts:310-313`: `chatProvider = automationStudioLlmModelProvider(AUTOMATION_STUDIO_LLM_DEFAULT_MODEL)!`, and the chat model is bound with `resolveKey: automationStudioPanelCommandKeyFromSecretKeys(sessionKeyPorts, { provider: chatProvider, model: AUTOMATION_STUDIO_LLM_DEFAULT_MODEL })`.
- `packages/fluxiq/src/runtime/models/catalog/default-model.ts:24`: `if (!raw) return "deepseek-flash";`.
- `packages/fluxiq/src/runtime/models/secrets/session-key.ts:41-42`: candidates are filtered by that provider (and by the default model, through `isProviderLlmKey`, `:76`). With only an Anthropic key the release throws "There is no enabled DeepSeek key of yours in Secret Keys."
- `packages/fluxiq/src/runtime/conversations/instructions/interpret.ts:166`: `/no enabled .* key/` maps that error to "No model key is set up yet…", and no provider is called. This matches the evidence: answered in the same second, with no provider call.
- The panel's workspace assistant did not have this defect. It chooses by the saved key (`runtime.ts:380`, `panelAssistantKeyModelSource` → `resolveAssistant()`). That is why it reached Anthropic while project chats did not.

A Flow call that names no provider (`bindLlmExecutionProvider`, `runtime.ts:298-306` at `HEAD`) fell back to the same default provider. A chat that went on to build a Flow would have failed the same way.

Live reproduction, pre-fix, on a fresh instance in the t924 trees (ports 3000/4777, headed Chromium with `apps/extension/dist/chrome`):

1. Signed in and added the key "Claude dummy" (`sk-ant-dummy-` plus random hex) through Security → Keys → Add Key. The provider select stores `Anthropic`, as in the user's store.
2. Paired the extension through its Connect button and the panel's Confirm pairing, then sent a chat in project "Key test". It answered "No model key is set up yet, so add one in Settings, under AI keys." (`18-ext-chat-before-fix.png`)
3. Wrote in that project chat from the panel (Chats → the thread). Same reply (`19-panel-thread-before-fix.png`).
4. The workspace assistant in the same panel, with the same key, reached Anthropic and was refused: "Anthropic refused the request" (`09-panel-chat-before-fix.png`).

What this rules out (the lead's hypotheses):

- **1, two Core copies.** Not the cause. The runtime instance is held on `globalThis` (`apps/web/src/lib/fluxiq.ts:24-29, 277-283`), so a key save and a chat use the same `SecretKeysService` object. The live run shows both behaviours in one process with one key. The double bundle is still a real defect for module-level singletons such as the activity hub and `iamStoreChanges`. I did not fix it, and I did not add the chunk check: both were conditional on it causing the key problem, and it does not.
- **2, case.** Not the cause. `automationStudioSessionKeyProvider` lowercases the provider (`session-key.ts:72`). The fault is the provider the chat asked for, not how "Anthropic" was compared.
- **3, scope.** Not the cause. Scope is never read on this path.
- **4, per-use box.** Not the cause. The release never reached `createUseAuthorization`; it failed at the candidate filter.
- **5, extension save path.** Not the cause. The extension does not save keys: "Add a model key" opens the panel's keys page (`apps/extension/src/background/panel/open-fluxiq.ts:15-22`). Its chat uses the same Core conversation model.

## Fix

The key decides the provider and model, once per call, through one choice shared by the chat, Flow calls and the state.

- `runtime/models/secrets/caller-key-choice.ts` (new): `chooseAutomationStudioCallerModelKey`.
  - It first uses the workspace's Settings choice (`resolveAssistant()`), when that key is the caller's own, a legacy key nobody is stamped on, or another person's key that is both chosen for the workspace and offered (the panel assistant's consent rule).
  - Otherwise it uses the caller's own newest enabled Anthropic or DeepSeek key, then a legacy key.
  - It answers `no_key` only when no such key exists, and `not_permitted` when the only key is someone else's and lacks consent.
- `runtime/llm/caller-key-chat/` (new): the chat model.
  - Each call chooses the key, builds that provider's existing panel-command adapter with that key's model, and releases exactly that key (`flowKeyId`) for the sender's authenticated principal.
  - Every access failure is thrown as `AutomationStudioModelAccessError` carrying the state: no key, a key the server cannot open (with its code), not permitted, the provider refusing the key (401/403/402), or the provider out of reach.
  - Out of reach stays retryable; a refusal does not.
  - Each outcome is noted in the ledger.
- `runtime/models/secrets/model-access/` (new): `state.ts` builds the state and its words, `ledger.ts` holds the last call per key (reset when the key changes, for example on rotate), and `error.ts` holds the error.
- `programs/_shared/runtime.ts`:
  - `:299` adds `preferredModelKey`, and `:304` creates one ledger per instance.
  - `:331` binds the new chat model.
  - `:319-325`: a Flow call that names neither a provider nor a model takes them from the caller's own chosen key.
  - `:413` attaches `modelAccess` to the Secret Keys snapshot read for a caller.
- `conversations/instructions/interpret.ts:101-104, 117, 132-137`:
  - A carried state is read through the contract reader, and the reply is the state's `message` alone, with `modelAccess` on the interpretation (`decision.ts`).
  - A confidently matched saved Flow still runs, as it did for "no key", with "(… because the model could not be used: <reason>)".
  - Out of reach is retried first.
  - The old `secretProblem` path stays for other model users.
- `programs/secret-keys/api/handlers.ts:30, 51-55` and `types.ts`: the snapshot carries `modelAccess` when the host supplies it.
- `server/program-route/program-route.ts:597-601`: paired clients receive `modelAccess`, rebuilt by the reader and without `key.id`, matching how their key list already omits ids.
- `framework/automation-service/service/conversation-requests/append-turn.ts`: the answer type is now named. The inferred type inlined `modelAccess` through a workspace path, and the declaration gate (`rewrite-declaration-imports.mjs`) refused it at `fluxiq:build`.
- Not removed: `automationStudioPanelCommandKeyFromSecretKeys`. The host no longer uses it, but it is a public export.

## Model-access contract (for t925)

`packages/contracts/src/platform/model-keys/model-access.ts`, exported from `@fluxiq/contracts/platform` (and therefore from the platform barrel):

```ts
type ModelAccessStatus = "ready" | "no_key" | "key_unopenable" | "not_permitted" | "provider_refused" | "provider_unreachable";
type ModelAccessKey = { id?: string; name: string; provider: "anthropic" | "deepseek"; model: string }; // id omitted for paired clients
type ModelAccessLastCall = { outcome: "answered" | "provider_refused" | "provider_unreachable"; atMs: number };
type ModelAccessState = {
  status: ModelAccessStatus;
  message: string;            // one sentence, shown as is; identical to the chat's reply for that failure
  key: ModelAccessKey | null; // null for no_key (and not_permitted when no key can be named)
  lastCall: ModelAccessLastCall | null; // null until a call used this key since it last changed
  unopenableCode?: "legacy_recovery_required" | "host_protection_unavailable" | "ciphertext_invalid"; // only, and always, with key_unopenable
};
function readModelAccessState(value: unknown): ModelAccessState | null; // refuses contradictory states
function pairedClientModelAccessState(state: ModelAccessState): ModelAccessState; // drops key.id
```

- **Where to read it.** It is the `modelAccess` field of the `secret-keys` `snapshot` reply when that snapshot is read for a caller: the panel's `/api/programs/secret-keys/snapshot`, or the paired-client program route. In a chat it is also `response.modelAccess` on the `append-turn` answer when the turn failed for an access reason.
- **When it changes.** `provider_refused` and `provider_unreachable` come from the last call's outcome. They are held in memory per host instance, reset when the key is rotated or edited, and reset on a restart, after which the state reads `ready` until a call says otherwise.
- **Extension relay.** The extension's background relay `modelReadiness` (`apps/extension/src/background/automation-relay/automation-relay.ts:162-185`) rebuilds the snapshot and does not forward `modelAccess` yet. To show it in the extension, t925 or the owner of that file must add one line that passes `readModelAccessState(field(snapshot.payload, "modelAccess"))`. I did not touch it, because it is not a key or credential file.

## Commands run and observed results

- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` (Core): first run, all five reused, exit 0. After the fix it failed once at `fluxiq:build` with "Nonportable declaration imports: …append-turn.d.ts:12:30 "packages/contracts/dist/platform.js"". I fixed that with the named type. The rebuild exited 0, and the final run reused all five stamps.
- `pnpm build` (extension) → exit 0.
- Regression test `npx vitest run src/programs/_shared/tests/runtime-chat-model-key.test.ts`. It uses the real runtime with a stubbed `fetch` that answers 401, and covers a panel session, a paired client, and no key.
  - Before the fix: 2 failed, 1 passed, with `expected 'No model key is set up yet, so add on…' not to be 'No model key is set up yet, so add on…'` (log: `test-runs/t924-key-proof/regression-before-fix.log`).
  - After the fix, together with `model-provider-admission.test.ts`: 2 files, 6 passed.
- `pnpm --filter @fluxiq/contracts check` → exit 0.
- `pnpm --filter fluxiq check` → exit 0, the last time after the final edits.
- `pnpm --filter @fluxiq/web check` → exit 0.
- `npx vitest run src/platform/model-keys` (contracts) → 2 files, 5 passed.
- `npx vitest run src/runtime/models/secrets src/runtime/llm/caller-key-chat src/runtime/conversations src/programs/secret-keys src/server/program-route src/programs/_shared --maxWorkers=4` (fluxiq) → 134 files, 1110 passed.
- After the final file moves: secrets, caller-key-chat, `interpret.test.ts`, the regression test and the admission test → 7 files, 55 passed. `src/framework/automation-service/service/conversation-requests` → 1 file, 11 passed.
- `pnpm --filter @fluxiq/web build`, run by `scripts/run-fluxiq-web.mjs` → "Compiled successfully in 2.6min", types checked, 42/42 pages, "Runtime build identity is stamped: no placeholder in 1375 server files."
- `node scripts/structure-audit.mjs`:
  - Core: first run, 6 violations from my change (two classes in one file, an import cycle through the `llm` barrel, two packed test lines). After fixing them: "passed (549 warning(s), 914 baselined)".
  - Extension: "passed (251 warning(s), 551 baselined)".
- Live proof after the fix (screenshots in the t924 extension tree, git-ignored, at `test-runs/t924-key-proof/`):
  1. Dummy key, extension chat → "Anthropic (Claude) refused the saved model key, so check or replace it in Settings, under AI keys." (`20-ext-chat-after-fix-dummy.png`)
  2. Dummy key, panel project chat → the same words (`23-panel-thread-after-fix-dummy.png`). The panel snapshot read `modelAccess: { status: "provider_refused", key: { provider: "anthropic", model: "claude-sonnet-5-5", … }, lastCall: { outcome: "provider_refused" } }`.
  3. I rotated the key to `CLAUDE_API_KEY` from the tree's `.env.local` through Keys → … → Rotate value ("Secret value rotated", `25-key-replaced.png`). The state then read `ready` with `lastCall: null`.
  4. Real call 1, panel project chat → "Hello! Nice to meet you, and I'm ready whenever you want to work on something in this project." (`26-panel-real-reply.png`)
  5. Real call 2, extension chat → "Hello from the FluxIQ extension, and I'm here whenever you need me." (`27-ext-real-reply.png`)
  6. The state then read `ready`, `lastCall.outcome: "answered"`. No other paid calls were made.
  7. The key value was written only to a scratch file that the rotate step read and then deleted. A scan of 1,453 output, log and script files found it in none.
- Test-instance sign-in: the account is `admin` and still uses the temporary password. The setup page appeared, but my scripted replacement did not complete. A generated password sits unused in `test-runs/panel-test-credential.txt`. The panel is stopped and ports 3000/4777 are free.

## Answers to the lead's questions (from code and the live runs)

1. **Does an owner's own key serve the extension chat without "offer to the workspace"?** Yes. The live key was created by `admin`, never offered, and served the paired extension's chat. Offers matter only when a key pays for another person: `caller-key-choice.ts` uses the caller's own key, or a key nobody is stamped on, with no consent, and so do the old `callerKeys` (`session-key.ts:81-84` at `HEAD`) and `unofferedKeyRefusal` (`api/unoffered-key-refusal.ts:11-15`). It was not part of the cause.
2. **Does "Credential vault: Locked" block the chat or model path?** No. It is Identity Access's own `vault` field: it is set at `programs/identity-access/runtime/service.ts:74, 478-500, 575` and displayed at `apps/web/src/features/security/sign-in/IdentityAccessLive.tsx:332`. Nothing in `programs/secret-keys`, `runtime/models` or `runtime/llm` reads it (grep finds no reader outside Identity Access). The live chats worked while it read Locked. It is a stale display that the UX team can remove or relabel.

Observations for the key-backend follow-up (not fixed):

- **Password or PIN on key changes.** Saving, replacing and removing a key still require the password, and Create also asks for the configured PIN. Every Secret Keys mutation goes through `authorizeSecretMutation` (`api/handlers.ts:269-290`): create at `:74` (password and PIN, no TOTP), update `:93`, rotate `:111`, reveal `:129` and delete `:147` (password, PIN and TOTP when set). The service also requires the password itself (`runtime/service.ts:171` create, `:242` rotate, `:285` reveal), because it seals with it. Live: Add Key showed "Confirm your current password and configured PIN"; Rotate asked "Your password". A paired client cannot pass `authorizeSecretMutation` at all, since its session is not a panel session (`:272-274`).
- **Old-format upgrade.** A key with no `createdBy` reads `legacy_recovery_required` (`runtime/access/access.ts:68, 77`; `runtime/access/data-keys.ts:43`) and works only after a panel sign-in upgrades it. The new state reports this as `key_unopenable` with that code.
- **"Last revealed" updated by use.** Every per-use release, which means every model call, writes `lastRevealedAtMs` and persists the store (`runtime/service.ts:465-467`, in `revealKeyWithAuthorization`). The person-initiated reveal does the same (`:312-314`). `runtime/access/version.ts:7-8` excludes that field from version checks, so it does not break releases, but "last revealed" really means "last used by a model call".

## Not verified

- Flow builds were not run live (that would mean more paid calls). The default provider for a Flow call that names none is covered by type checks and the shared choice only, with no test of its own.
- A key lent to the workspace was tested only at unit level. In Flow calls a lent key is deliberately not used (`runtime.ts:320`, `!choice.keyOwnerUserId`), so a person with no key of their own whose workspace lends one still gets a Flow-build failure. The chat does use it.
- `provider_unreachable`, `key_unopenable` and `not_permitted` were tested at unit level only, not live.
- No full suites were run, per the rules.
- Firefox was not tested.
- The double-bundle split (hypothesis 1) is unchanged.

## Open questions or contradictions found

- **Pairing request on every launch.** On each new browser launch of the same profile, the paired extension raised a fresh "Client pairing request" dialog in the panel, even though its chat worked without one (the panel's chat page was covered until it was confirmed). This may be specific to the test harness relaunching Chromium. It needs a look by the owner of `connection*` (another task).
- **Contract change.** `ModelAccessKey.id` is optional so that paired clients get no key ids. Tell t925 if the panel needs the id to link to a key; it is present on panel reads.
- **Branch.** Commit and finish this on the Core branch `task/t924-key-model-access`. The extension branch has only this report.
