# Key writes (t928, key-backend)

## Outcome

Done for all seven items, in my paths. Core tree `fxwork/t928/!FluxIQ`, branch `task/t928-key-backend`, uncommitted.

A previous worker on this brief was killed by a machine crash. It had written nearly all of the implementation. I reviewed it against the brief, fixed one defect in it, finished the tests it had not reached, and verified the result.

What remains outside my paths:
- three wiring lines in `programs/_shared/runtime.ts` (below);
- 16 type errors in other packages' tests, one fix each (below);
- one structure-audit violation in `apps/web` that is not mine.

## What changed and why

Everything is under `packages/fluxiq/src/programs/secret-keys/`.

### What the crashed worker wrote (reviewed, kept)

**Item 1: IAM only.**
- `api/handlers.ts`: create-key, update-key, rotate-key and delete-key no longer call a credential check. The registry's IAM gate decides alone (`secrets.manage`, Write).
- reveal-key keeps a password check (`authorizeReveal`). It calls `authorizeSessionCredentials({ …, pin: undefined, requirePin: false })` and never asks for a PIN. `requirePin` already existed in Identity Access, so no IAM edit was needed.
- `SecretKeyIdentityAuthority` no longer needs `authorizeSessionPasswordPin`.

**Item 1: host protection alone.**
- New seal version 3 (`types.ts` `EncryptedSecretValueRecordV3`; `value-sealer.ts` `sealForHost`). The value is AES-256-GCM under a random 32-byte data key. That key is kept only as the record's `hostProtection`, wrapped for the owner (`data-keys.ts` `protectHostSealed`).
- `createKey` and `rotateKey` (`runtime/service.ts`) take no password.
- A save is refused in plain words, with nothing written:
  - no owner: "Sign in to save a key: a saved key belongs to the person who saves it.";
  - no host protection configured, or configured but unreadable: "The key was not saved because this server's key protection is not available, and a key saved without it could never be opened. Restart FluxIQ on this machine, then save the key again."
- A password never opens a v3 seal, and nothing is derived for one:
  - `openRecord` returns null;
  - `sealedFor` excludes v3;
  - `needsReseal` returns false;
  - `record-guard.ts` accepts a v3 seal only with no salt, kdf, kdfParams or sealedByUserId;
  - `seal-digest.ts` hashes v1 and v2 exactly as before.
- Rotating a password-sealed key makes it v3 for its owner. An unowned key becomes the rotator's.
- reveal-key of a v3 key opens through the management proof (`access.openForManagement`).

**Item 2: endpoints.** `api/model-key-endpoints.ts` (new) registers save-model-key, replace-model-key and remove-model-key. Each has permission `secrets.manage`, classification `program-gated`, Write, on the workspace resource. Contracts are in `api/contracts.ts`:

```ts
type SaveModelKeyProvider = "anthropic" | "deepseek";
type SaveModelKeyRequest = { provider: SaveModelKeyProvider; value: string; name?: string }; // name defaults to "Anthropic key" / "DeepSeek key", max 200 chars
type ReplaceModelKeyRequest = { value: string };
type RemoveModelKeyRequest = Record<string, never>;
type ModelKeyWriteResponse = { modelAccess: ModelAccessState }; // never a value; no key.id for a paired client
```

- **save** creates an `llm` key owned by the caller, with provider stored as "Anthropic" or "DeepSeek". If the caller's model access does not already name it, it becomes the assistant key (`modelKeys.setAssistant`, which is gated by the same `secrets.manage` permission as set-assistant-model).
- **replace and remove** find the caller's in-use key from `modelAccessOf` (the host reading, which includes the id). They refuse in plain words:
  - no key: "Your chats use no model key yet, so there is none to replace. Save a key first." / "Your chats use no model key, so there is none to remove.";
  - a key lent by someone else: "The key your chats use belongs to someone else, so only they can replace it. Save your own key instead." / "The key your chats use belongs to someone else, so only they can remove it."
- If the host binds no `modelAccessOf`, all three refuse: "This server cannot tell which model key your chats use, so nothing was changed."
- The answer goes through `pairedClientModelAccessState` when `actor.channel === "paired-client"`.

**Item 3.**
- create-key and rotate-key answers add `modelAccess` when the host binds `modelAccessOf` (`SecretKeyMutationResponse = SecretKeySummary & { modelAccess?: ModelAccessState }`).
- `api/saved-key-check.ts`: `checkSavedModelKey` runs the host's `checkSavedKey` port before the state is read. It runs after create-key, rotate-key, save-model-key and replace-model-key, and only for an enabled `llm` key whose provider reads as Anthropic or DeepSeek (`api/model-key-provider.ts`).
- A failed check is logged by its error name only, and the save stands.

**Item 4.**
- `SecretKeysService.onModelKeysChanged(listener): () => void`. It fires after every committed key change: create, update, rotate, delete, and a sign-in upgrade that wrote a record (also through `migrateHeldSession`).
- `ModelKeySettings` gained `onChanged`, fired after setOffered, setDefault, setAssistant and setAssistantAllowance are persisted.
- A listener that throws is logged by its error name and costs nothing else.

**Item 5.** `revealKeyWithAuthorization` writes nothing: no `lastRevealedAtMs` and no store write. `revealKey` (the person's own reveal) still records it.

**Item 6: legacy upgrade at sign-in.**
- `unlockRecord` now calls `upgradeOpenedRecord` after a password opens an old-format record.
- A record nobody owns becomes the signing-in person's, since their password sealed it. The opened data key is wrapped with host protection for the owner. From then on, `availability` reads `available` with no password.
- The path is already wired: `apps/web/src/app/api/auth/login/route.ts` → `server/connect/restore-login-keys.ts` → `secretKeys.unlockSession({ …, passwordVerified: true })` → `unlockRecord`. Setup (`submitOwnerClaim.ts:73`) and welcome (`submitWelcome.ts:21`) also call `unlockSession`.
- **No line outside my paths is needed for item 6.**

**Item 7.** `authorizationPin` is gone from `SecretKeyAuthorizationPayload`. No secret-keys endpoint asks for or checks a PIN.

### What I changed

1. **Defect fix, `runtime/service.ts` `upgradeOpenedRecord`.** With no host protection configured, it claimed an unowned legacy record for the person signing in (wrote `createdBy`) without wrapping anything.
   - That was an extra store write with no gain.
   - It also narrowed who may use the record: an unowned record serves any authorized principal, an owned one only its owner.
   - It now returns without writing when `!this.dataKeys.configured`.
   - When protection is configured but unreadable, it still records the owner. Availability then reads `host_protection_unavailable` instead of `legacy_recovery_required`.
2. **`runtime/tests/secret-key-fixtures.ts` `rotatePasswordSealedKey`.** Its docstring says "exactly as `rotateKey` did before t928", but it had dropped that method's retry loop. It now retries over a write that landed first (a seal upgrade), as the old code did.
3. **Tests the crashed worker had not reached** (9 failures before my changes):
   - `runtime/tests/authenticated-access.test.ts`:
     - New `addPasswordSealed` helper.
     - Five custody tests now use password-sealed (old-format) keys, the only keys that machinery still serves: session delegation, legacy recovery, prepared credential change, old-master repair, approving-session check, failed envelope write.
     - The ambiguous-rotation test no longer passes a password.
     - New test: a v3 key under a lost host master reads `host_protection_unavailable`, a password sign-in cannot repair it, and saving the value again does.
   - `api/tests/authenticated-use.test.ts`:
     - Saving no longer resolves Identity Access, so that assertion became "the key is v3".
     - "rejects another actor's proof" became a test that a saved key belongs only to the authenticated caller, whatever session, password or `createdBy` the payload names.
     - reveal-key still refuses Bob presenting Alice's session and password.
   - `runtime/tests/seal-upgrades.test.ts`: narrowed the seal type before reading `.salt` (a typecheck error).
   - `runtime/tests/host-sealed-keys.test.ts`, two new tests:
     - with no host protection, a sign-in leaves an unowned legacy key unowned and unwrapped;
     - a no-password replacement that lands while the sign-in upgrade is being written wins: stored v3, and it opens after a restart.

### Acceptance coverage

| Required test | Where |
| --- | --- |
| Panel session and paired client save, replace and remove with no password | `api/tests/model-key-writes.test.ts` (7 tests) |
| IAM denial refused | `model-key-writes.test.ts`, "is refused by IAM to a caller without secrets.manage…" |
| Paired answer has no key.id | `model-key-writes.test.ts`, first test |
| Host-sealed keys open after a new service instance | `host-sealed-keys.test.ts`, first test; `authenticated-access.test.ts` |
| Release leaves lastRevealedAtMs | `host-sealed-keys.test.ts`, "writes nothing…"; `service.test.ts:179` |
| Legacy upgrade | `host-sealed-keys.test.ts`, "an old-format key at its owner's sign-in" (4 tests); `authenticated-access.test.ts`, "migrates a V1 owner record…" |

## Host-port signatures (exact)

```ts
// programs/secret-keys/index.ts exports these types
type SecretKeySessionOf = (actor: ProgramApiActor) => { sessionId: string | null; holderId?: string | undefined };
type SecretKeyModelAccessOf = (actor: ProgramApiActor, snapshot: SecretKeysSnapshot) => Promise<ModelAccessState>;
type SecretKeySavedKeyCheck = (key: { id: string; provider: "anthropic" | "deepseek"; value: string; lastRotatedAtMs: number }) => Promise<void>;

function registerSecretKeysApi(
  registry: GlobalProgramApiRegistry,
  service: SecretKeysService,
  identityAccess?: SecretKeyIdentityAuthority | (() => Promise<SecretKeyIdentityAuthority>), // Pick<IdentityAccessService, "validateSession" | "authorizeSessionCredentials">
  keySessionOf?: SecretKeySessionOf,
  modelAccessOf?: SecretKeyModelAccessOf,   // required by save/replace/remove-model-key; they refuse in plain words without it
  checkSavedKey?: SecretKeySavedKeyCheck    // must record its result before resolving; the state is read right after
): void;

SecretKeysService.onModelKeysChanged(listener: () => void): () => void; // returns unsubscribe
```

- `checkSavedKey` gets the value only for the free check. It must never log, store or answer it.
- `lastRotatedAtMs` is set by every create and rotate. It is the ledger's version (`automationStudioModelAccessKeyVersion` = `lastRotatedAtMs ?? updatedAtMs`), so `{ id, updatedAtMs: lastRotatedAtMs, lastRotatedAtMs }` matches the summary the state reads.

## runtime.ts lines needed (not edited)

`programs/_shared/runtime.ts`, at the current `registerSecretKeysApi` call (lines 410-413):

1. Pass a sixth argument:
   ```ts
   , async ({ id, provider, value, lastRotatedAtMs }) => {
       modelAccessLedger.noteCheck({ id, updatedAtMs: lastRotatedAtMs, lastRotatedAtMs }, await checkAutomationStudioModelKey({ provider, value }));
     }
   ```
   Import `checkAutomationStudioModelKey` from `../../runtime/models/secrets/index.ts`; the model-access barrel already exports it.
2. In the fifth argument (`modelAccessOf`), add `await modelAccessLedger.whenLoaded();` before `automationStudioModelAccessState(...)`. This only matters once the ledger gets persistence (key-check report).
3. Push key state from the service: `secretKeys.onModelKeysChanged(() => <the host's model-access push>)`. The push belongs to whoever owns `client-gateway/service/model-access/` and the panel change stream. Ledger outcome changes still come from `modelAccessLedger.subscribe`.

Without (1), the endpoints work but the answer's `lastCall` stays null until a chat call. Without (3), clients see a change only on their next snapshot read.

## Outside-path fixes needed (not edited)

`pnpm --filter fluxiq check` reports 16 errors outside my paths. All are `'authorizationPassword' does not exist in type 'CreateSecretKeyInput'`. Deleting the field is not enough on its own:
- `createKey` now requires `createdBy`;
- `createKey` needs host protection, which `createGlobalProgramRuntime` always configures (`runtime.ts:131`), but a bare `new SecretKeysService(...)` does not;
- a v3 key is never held by a session, re-sealed by a password change, or delegated to a client box.

**The rule:** if the test exercises password/session custody (`unlockSession` holding the key, credential change, session revocation of held keys, delegation), replace the call with `createPasswordSealedKey(service, { …same fields })` from `programs/secret-keys/runtime/tests/secret-key-fixtures.ts`. That writes the pre-t928 record verbatim. Otherwise drop the field, and for a bare service add `...hostProtectionOptions()` (same file) to its constructor.

| File:line | Fix |
| --- | --- |
| `programs/_shared/tests/runtime-access-fixture.ts:55` | Runtime has protection: drop `authorizationPassword`. |
| `programs/_shared/tests/runtime-credential-changes.test.ts:34, 71` | Tests password-change re-sealing: `createPasswordSealedKey(runtime.secretKeys, …)`. |
| `programs/_shared/tests/runtime-session-revocation.test.ts:27, 28` | Tests revocation of session-held keys: `createPasswordSealedKey`. |
| `programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts:120, 201` | Uses `unlock`: `createPasswordSealedKey`, or drop the field and add `hostProtectionOptions()` if unlock is incidental. |
| `programs/identity-access/api/tests/handlers.test.ts:191` | Drop the field; add `hostProtectionOptions()` to that service, or use `createPasswordSealedKey` if the test needs the key held by the target's session. |
| `tests/anthropic-session-panel.test.ts:95` | Same rule; its `secretKeys()` helper builds a bare service. |
| `tests/deepseek-session-key.test.ts:28` | `createdBy` is optional there: an unowned key is now refused, so use `createPasswordSealedKey` (it allows no owner). |
| `tests/instance-leak.test.ts:69` | Then unlocks a session to inspect held material: `createPasswordSealedKey`. |
| `tests/model-provider-disabled-run.test.ts:44` | No `createdBy`, so it is refused now: add `createdBy`, and host protection if bare, or use `createPasswordSealedKey`. |
| `tests/session-key-provider.test.ts:194, 204, 205, 219` | Same rule per call; its `secretKeys()` helper builds a bare service. |

I classified these from the call sites and the presence of `unlockSession`. I did not run the tests.

**Item 7, what remains outside secret-keys:**
- Identity Access still stores PIN hashes.
- It still has `authorizeSessionPasswordPin`.
- `authorizeSessionCredentials` and `verifyCredentialGate` default to `requirePin: true`.
- Many automation-studio handler payload types still name an unused `authorizationPin?: unknown` (`api/handlers/{artifacts,client-gateway,flow-lifecycle,flows,instructions,projects,recordings}.ts`, `api-contracts/automation/{adaptation,subflow}.ts`).

Clearing stored PINs and those defaults is Identity Access's task.

## Commands run and observed results

- `npx vitest run src/programs/secret-keys --poolOptions.forks.maxForks=2` failed at startup with "RangeError: options.minThreads and options.maxThreads must not conflict" (vitest config). Every run below adds `--poolOptions.forks.minForks=1`.
- First full run, before my changes: 3 failed files, 24 passed (27). 9 tests failed, 255 passed:
  - `authenticated-access.test.ts` ×5;
  - `authenticated-use.test.ts` ×2;
  - `seal-upgrades.test.ts` ×2 ("expected 2 to be 1" put count; "Secret key changed during rotation.").
- After my changes, the four touched files: 4 passed, 47 tests passed.
- Full secret-keys run (heavy slot): **27 files passed, 267 tests passed**, exit 0. The one "A Secret Keys change listener failed (Error)." line is the deliberate throwing-listener test.
- `pnpm --filter fluxiq check` (heavy slot), first run: exit 1 with 19 errors. 16 are outside my paths (the table above). 3 were in `seal-upgrades.test.ts:56-57`, which I fixed.
- Final re-run (heavy slot):
  - `npx vitest run src/programs/secret-keys/runtime/tests/seal-upgrades.test.ts …`: 1 file, 11 tests passed.
  - `pnpm --filter fluxiq check`: exit 2 with exactly the 16 outside errors listed above. **0 errors in `programs/secret-keys`.**
- `node scripts/structure-audit.mjs` (Core root): "structure-audit: 1 violation(s) across 1 rule(s)". The violation is `[imports] apps/web/src/server/key-sessions/instance-id/tests/resolve.test.ts`, not mine. secret-keys has only advisory warnings: `SecretKeysService` 31 methods, `service.ts` 794 lines, `secret-key-fixtures.ts` 12 exports, and older warnings in `credential-unlocks.ts` and its tests.

## Not verified

- No live run: no panel, no extension, no provider call. The endpoints were exercised through `GlobalProgramApiRegistry` with real IAM.
- I did not edit the runtime.ts wiring, so the `checkSavedKey` → ledger round trip is unit-tested with a stub port only.
- The outside-path fixes are classified, not applied or run.
- Concurrency between `save-model-key`'s create and its `setAssistant` and another writer is not tested.

## Open questions or contradictions found

- **Lost host master is now unrecoverable for new keys.** A password sign-in used to rewrap a password-sealed key under a new master. A v3 key has no password path, so its owner must save the value again. This follows from "protected by host protection alone". It is shown honestly as `host_protection_unavailable` and covered by a test.
- **save-model-key changes the workspace's assistant choice.** "Chats then use the saved key" is implemented as `setAssistant({ keyId, chosenBy })`, which is workspace-wide. The workspace assistant becomes the saver's key, even when another member's offered key was chosen. Other members' chats use it only if it is offered, since `chooseAutomationStudioCallerModelKey` applies the consent rule. If the lead wants a per-person choice instead, it needs a per-user preference in `model-key-settings.ts`, which does not exist today.
- **create-key no longer checks the payload's `authSessionId`.** Ownership comes from the authenticated `request.actor` alone, as every other endpoint already trusts it. A forged actor is a host-authentication defect, not something secret-keys can detect without a credential step.

# Round 2

## Outcome

Partial.
- Items 1, 2 and 3 are done and verified in my paths.
- The Activity item (4) cannot be fixed inside them; the exact outside lines are below.
- The blocking finding below means a real paired client still cannot save a key until `server/program-route` keeps `secrets.manage`.

Owned paths this round: `programs/secret-keys/**` and `programs/_shared/key-access/**`. I did not touch `runtime.ts`, `identity-access`, `apps/**` or the 16 outside test call sites.

**Blocking finding, outside my paths.** A real paired client cannot reach any key write today.
- `server/program-route/program-route.ts:191` narrows a paired client to `PAIRED_CLIENT_PERMISSIONS = ["programs.read", "programs.write", "runtime.control", "flows.write"]`.
- Every key write needs `secrets.manage`: create, update, rotate and delete-key, and save, replace and remove-model-key.
- So the extension's save-model-key is refused by IAM before Secret Keys sees it.
- Round 1's paired-client tests used a synthetic actor that added `secrets.manage`, so they did not catch this.
- **The fix is one line: add `"secrets.manage"` to that list.** Only the `admin` role holds `secrets.manage` (`identity-access/runtime/roles.ts:13`), so this reaches only an administrator's own clients.
- reveal-key still refuses a client: it needs a live panel session and its password.
- The same list is copied in `programs/_shared/key-access/authority.ts:19` and `programs/_shared/tests/iam-registry-fixtures.ts:59`. Those copies only build the use-authority actor and test actors, so they do not need it. One shared constant would stop the copies drifting.

## What changed and why

### 1. Two-step

No code change was needed.
- Since round 1, the key write handlers call no credential check.
- Their classification is `program-gated`, for which the registry adds nothing (`_shared/api.ts:43-45`).
- A person with TOTP on passes it once, at sign-in, and is not asked again.

New test `secret-keys/api/tests/two-step-writes.test.ts` (real runtime, in memory):
- TOTP is confirmed on `admin`; sign-in without a code is refused, and sign-in with one succeeds.
- From the panel session, and from a paired-client actor (as `program-route` builds one, with `secrets.manage` kept), all seven writes succeed with no code, password or PIN: create, update, rotate and delete-key, then save, replace and remove-model-key.
- `authorizeSessionCredentials` is never called, and no session unlock is held.
- The panel's answer carries `key.id`; the client's does not.
- A client without `secrets.manage` is refused by IAM, and nothing is written.

The `program-gated` classification now reads wrongly for these endpoints: the registry's docs say the program "runs its own, stronger credential check". The behaviour is right, because the registry adds nothing.
- Changing it to `authoring` means editing `programs/tests/endpoint-classification.test.ts`.
- Changing it to `destructive` (delete-key, remove-model-key) would make the registry demand a PIN or press grant.
- Both are outside my paths, so I left it. The registry docs need a line saying `program-gated` may mean "IAM only" (owner of `_shared/api.ts`).

### 2. Key-lock machinery removed

- **`runtime/service.ts`**
  - `unlockSession` no longer takes `unlockClients`; `fillSessionUnlock` no longer passes a `lift`.
  - `passwordVerified` is still accepted and ignored, with a comment. Its only caller, `apps/web/src/server/connect/restore-login-keys.ts:8,19`, can drop it.
  - No production caller passed `unlockClients`.
- **`runtime/unlocks/credential-unlocks.ts`** removed:
  - `ProofReach` and the `reach` parameter of `personProved` (it was already unused);
  - `enrollLockedCredential` (`:109`, an alias of `enrollCredential`);
  - the no-op stubs `unlockTicketFor`, `liftable` and `lockedClientsFor`.
- **`types.ts`**: `SecretKeyLockedClient` is removed. It was re-exported from the package barrel, but no code in Core, apps/web or the extension used it.
- **Tests:** `credential-unlock-proofs`, `credential-unlocks` and `strict-enrollment` no longer pass `unlockClients`. Their assertions on the no-op stubs became the real observable: a snapshot carries no `lockedClients` or `unlockTicket`.
- **Kept on purpose:** `lock` / `lockPerson`. They run on a password reset nobody proved (`runtime.ts:519`) and on "end every session" (`sessionEnded` with `wholeUserId`). They empty paired clients' password-derived boxes and held keys.
  - That is revocation, not an unlock gate.
  - Nothing reads `lockedAtMs` to refuse.
  - A host-sealed key never uses those boxes, so a client keeps model access through `localSecretKeyUseAuthority`.
- **Outside callers still using removed names** (tests and mocks only, so they compile or break only as mocks):
  - `apps/web/src/app/api/client-gateway/approve-pairing/tests/route.test.ts:19` mocks `credentialUnlocks.lockedClientsFor`;
  - `server/program-route/tests/program-route.test.ts:550,555`, `apps/web/src/features/chat-widget/transport/tests/models-port.test.ts:11` and `apps/web/src/features/security/keys/manager/tests/secret-keys-recovery.test.tsx:35` put `lockedClients` or `unlockTicket` in payload literals.
  - Their owners can drop them.

### 3. Standing result check and repair

I traced it first, and `resolveStanding` is wired:
- `runtime.ts:270` binds it to `automationStudioStandingResultCheckGrant`.
- That function matches the stored grant's id, person and purpose, refuses an expired or legacy-unlock grant, and allows repair only with the repair clause on.
- `access.createUseAuthorization` then opens a host-protected key with `dataKeys.open` when `exactHeld` is empty. So `exactHeld` returning nothing for `standing` does not refuse a host-sealed key.
- An old-format key without host protection still reads `legacy_recovery_required` until its owner's next sign-in upgrades it (round 1, item 6).

What I changed in `programs/_shared/key-access/authority.ts`:
- **`resolveStanding` is now required.** A host that left it out used to refuse every result check and repair silently. Now it is a type error. `runtime.ts` already passes it, so nothing outside changes.
- **A standing grant may pay with the workspace's lent key**, under the same consent rule as the assistant:
  - the key is the workspace's choice and is offered by its holder, both read again at every use;
  - the grant must still name that key;
  - IAM must allow the person `studio:UpdateFlowSettings` (`flows.write`) on that Flow (`project-child` resource), the action that grants a result check.
  - Before, a standing use paid only with the person's own key. A person whose chats run on a lent key had result checks and repairs refused, even though their chats and (since t928 key-check) Flow calls used it.
- Unchanged: grant matching, the client vouch, the person still enabled, and IAM `secrets:UseKey` on the person's own key.

Tests:
- `key-access/tests/authority.test.ts`, three new cases:
  - own key from the stored grant alone;
  - refused when the grant no longer matches, names another key, or was granted through a revoked client;
  - lent key paid only once chosen and offered, with the `studio:UpdateFlowSettings` decision, and refused when IAM denies.
- `key-access/tests/standing-result-check.test.ts` (new, real runtime, in memory, no `unlockSession` anywhere):
  - a Flow's result check gets the person's own key from the stored grant alone, before and after their session is revoked, with no session unlock held;
  - a lent key is refused, then refused while only chosen, paid once offered, and refused again after the offer is withdrawn.
- The outside test `_shared/tests/runtime-result-check-authority.test.ts` "never pays with another person's key, whoever names it" still holds: its foreign key is neither chosen nor offered.

### Structure

- `runtime/service.ts` reached 801 lines, past the 800 limit.
- The sign-in upgrade was a self-contained step, so it moved to `runtime/sign-in-upgrade.ts` (`upgradeOpenedRecord(ports, input)`, one export).
- `service.ts` is now 769 lines.

### 4. Activity says a key was added when the save failed (not fixable inside my paths)

Where it comes from:
- The panel's Activity (`apps/web/src/features/security/activity/`) reads `GET /api/security/audit`. That is the IAM **decision** audit: one row per authorization decision, `outcome: "allowed" | "denied"`, labelled from the action name ("Create key").
- The row is written by `iam.authorizer.decide(...)` inside the registry's `decideCall` (`programs/_shared/api.ts:390-402`). That runs before the handler (`:268-273`), so a call IAM allows reads "allowed" whether or not the save then succeeds.
- `IamAuditRecord` (`platform/iam/types.ts:147-161`) has no outcome field.
- The registry offers no outcome event and no registration option. `afterSuccess` (`:406-413`) only records created-resource owners.
- So secret-keys cannot change what that row says. I did not add the requested test, because it cannot pass without the outside change. A test that only pins today's wrong behaviour would mislead.

Exact change needed (owners of `_shared/api.ts`, `platform/iam` and apps/web):
1. `platform/iam/types.ts:147`: add `category: … | "outcome"` and `result?: "succeeded" | "failed"` to `IamAuditRecord`, keyed by the same `requestId` as the decision row.
2. `programs/_shared/api.ts:268-276`: after `registration.handler(handed)` returns, and in its `catch`, record one outcome row through the same sink, for the same `requestId` and action, with `result: response.ok ? "succeeded" : "failed"`. Do this for every Write call, or for registrations that opt in, for example `auditOutcome: true` on the secret-keys writes.
3. `apps/web/src/features/security/activity/model/shape-activity-page.ts:8` and the `/api/security/audit` route: join the outcome row onto its decision by `requestId`. An allowed call that failed then reads "Create key — failed", and only a succeeded one reads as done.

Then the test belongs beside `_shared/api.ts`: a create-key the service refuses (no host protection) records `allowed` + `failed` and no `succeeded`; a successful one records `succeeded` once.

secret-keys is ready for it:
- every write already answers `ok: false` with the plain reason when the save fails (`plainRefusal` / `refusedPlainly`), never `ok: true`;
- `onModelKeysChanged` fires only after a committed change, so the change push to clients already follows the real outcome.

## Commands run and observed results

- `npx vitest run src/programs/_shared/key-access src/programs/secret-keys --poolOptions.forks.maxForks=2 --poolOptions.forks.minForks=1` (heavy slot), final run after every edit: **30 files passed, 281 tests passed**, exit 0. The one "A Secret Keys change listener failed (Error)." line is the deliberate throwing-listener test.
- An earlier run of the same command: 29 passed, 1 failed. `standing-result-check.test.ts` refused to create a project in an in-memory runtime ("This Automation Studio service has no storage root"). I moved that test onto a temporary disk root, as `_shared/tests/runtime-result-check-authority.test.ts` does. Re-run alone: 1 file, 2 tests passed.
- Two earlier queued runs exited 127 before starting. The key-backend supervisor says the lead stopped them while the slot gate was broken; they never ran.
- `pnpm --filter fluxiq check` (heavy slot): exit 0. The build cache answered `{"build-cache":"reuse","step":"fluxiq:check","reason":"inputs and outputs match the stamp"}`. A stamp is written only after a passing tsc, so this exact tree passed, including my fix to `credential-unlock-proofs.test.ts:79,128,192` (a removed third `signIn` argument). **No remaining errors, outside my paths or in them.**
- `node scripts/structure-audit.mjs` (Core root): "1 violation(s)". It is `[imports] apps/web/src/server/key-sessions/instance-id/tests/resolve.test.ts`, not mine. My paths have advisory warnings only. My earlier run had one failure of mine, `service.ts` at 801 lines past the 800 limit, fixed by the split above.

## Not verified

- No live panel or extension run.
- The paired-client tests use the actor `program-route` would build with `secrets.manage` kept. Through today's route, a client is refused (blocking finding above).
- The lent-key result check was not run through a real Flow run's resolver. I drove the same `redeem` and `reveal` the resolver calls, against the real runtime.

## Open questions

- Adding `secrets.manage` to `PAIRED_CLIENT_PERMISSIONS` also lets an administrator's paired client call set-default-key, set-assistant-model and offer-key. That fits "a connected client has access". If only the three model-key writes should reach clients, the alternative is to put those three endpoints on a permission clients keep, `programs.write`. Then save-model-key must not change the workspace's assistant choice for a caller without `secrets.manage`. That is a product call for the lead.

# Round 3

## Outcome

Partial.
- The notice fix is done, and the focused tests pass.
- The full acceptance rerun and `pnpm --filter fluxiq check` were **not run; the supervisor runs them**. key-backend told me to stop waiting on the stalled slot queue.
- One extra fix came out of the earlier full run: keys saved in the same millisecond. It changes the service, not only the test (details under "workspace-choices flake").

The defect: each save of a dummy key pushed `ready`, then `provider_refused` about 120 ms later.
- The cause: `SecretKeysService` gave its change notice at the commit.
- The handler recorded the free check (`checkSavedKey`) only after that.
- So every client read the new key as ready for the moment between.

## What changed and why

**`secret-keys/runtime/model-keys-notice.ts` (new): `ModelKeysChangeNotice`.** It owns the listeners and lets a write hold its own notice.
- `holding(run)` runs the write with an `AsyncLocalStorage` hold. Every `announce()` on that write's async chain only marks the hold pending.
- When `run` settles (returns, throws or rejects), the hold is released in `finally` and, if anything was announced, listeners are told exactly once.
- No timer: the hold lasts exactly as long as the write.
- The hold is scoped to the write's own chain, so another person's write at the same time (a delete, a settings change) still notifies at once.
- A hold inside a hold joins the outer one.
- An announcement from work the write left running after its hold ended is told at once, never lost.
- A listener that throws is logged by its error name only, as before.

**`runtime/service.ts`**
- The listener set and the old announce loop now live in that class.
- New public `holdingModelKeysNotice(run)` passes through to it.
- 770 lines, under the 800 limit.

**The four writes that run the free check** now hold the notice across the write and the check:
- `create-key` and `rotate-key` (`api/handlers.ts`);
- `save-model-key` (create, choose as assistant, check) and `replace-model-key` (rotate, check) (`api/model-key-endpoints.ts`).

The answer's `modelAccess` is read after the hold, as before. `checkSavedModelKey` already catches a failing or throwing check, and the host's check has its own deadline. So a check that fails, throws or times out ends the hold through `finally`. A write that fails before committing announced nothing, so it gives no notice and leaves no hold. delete, update and the settings endpoints notify as before.

**Why exactly one push follows:**
- The ledger source (`modelAccessLedger`) fires when the check is recorded. The gateway then reads the state, already `provider_refused`, and sends it.
- The released notice runs one more publish. The gateway sends only where a session's state differs from what it was last sent, with one read at a time per session (`client-gateway/service/model-access/delivery.ts`). So nothing more is sent.

**key-backend's work is kept:** `auditOutcome: true` on create-key, rotate-key, delete-key and the three model-key endpoints, `api/tests/audit-outcome.test.ts`, and the decision-rows-only filter in `workspace-choices.test.ts`.

### Tests

- `secret-keys/runtime/tests/model-keys-notice.test.ts` (new):
  - one notice per hold, nested holds joined, given when the outer hold settles;
  - still given when the write throws, and none when nothing was announced;
  - leftover work after the hold is told at once.
- `secret-keys/api/tests/held-change-notice.test.ts` (new, real registry and service), with the check finished by hand:
  - save-model-key, check resolves or rejects: before the check ends, no notice; afterwards the events are exactly `["check started", "check <resolved|rejected>", "notice"]`;
  - create-key, rotate-key and replace-model-key: the same, exactly once, after the check;
  - another write during the hold (a delete) notifies at once;
  - a refused save (no host protection) gives no notice, and the next change notifies at once.
- `_shared/tests/runtime-model-access-push.test.ts`, extended (existing cases unchanged). New case "sends one state per save or replace of a refused key, the checked one, never ready first" runs through the real runtime with a paired socket and stubbed Anthropic 401:
  - save-model-key sends exactly one `server.model_access_changed`, status `provider_refused`, `lastCall.outcome` `provider_refused`;
  - replace-model-key does the same;
  - no `ready` state is ever pushed.
- **Proof the tests catch the defect.** A temporary probe test, run once and deleted, turned the hold off on its own instances only (`service.holdingModelKeysNotice = (run) => run()`):
  - unit order: `["notice","check done"]`;
  - runtime socket: `["ready","provider_refused"]`, the live proof's exact symptom.
  - With the hold, the same runtime path sends `["provider_refused"]` once.

### workspace-choices flake: a service change, not a test change

**Cause.**
- `ModelKeySettings.modelKeys()` orders keys "oldest first" by `createdAtMs`, with ties broken by `id.localeCompare`.
- Ids are random UUIDs.
- Before t928, each save ran scrypt, which kept two saves milliseconds apart. Host sealing is instant, so saves now share a millisecond, and the "first" key, which is the workspace default, became random.
- The test caught this: its three keys are saved back to back. The same thing can happen to a real workspace that saves two keys at once.

**What changed: `secret-keys/runtime/service.ts` `createKey` only, no test edit.**
- A new key's `createdAtMs` (and its `updatedAtMs` and `lastRotatedAtMs`, which take the same value) is now `Math.max(requested time, last creation time given out + 1, every saved key's createdAtMs + 1)`.
- The last time given out is reserved synchronously in a new private field, `lastCreatedAtMs`, before any await, so two saves at once never share one.
- Effect: a key saved in the same millisecond as another is stamped 1 ms later. Saving order decides "oldest first", and nothing else changes.
- `workspace-choices.test.ts` is unchanged, apart from key-backend's decision-rows filter, which I kept.

**New test** `secret-keys/runtime/tests/host-sealed-keys.test.ts`, "keeps saving order for keys saved in one millisecond, so the first saved is the default, every time": five rounds of three keys at the same `nowMs`, the third saved through `Promise.all`. Not run yet.

## Commands run and observed results

- `npx vitest run src/programs/secret-keys/api/tests/held-change-notice.test.ts src/programs/secret-keys/runtime/tests/model-keys-notice.test.ts src/programs/_shared/tests/runtime-model-access-push.test.ts --poolOptions.forks.maxForks=2 --poolOptions.forks.minForks=1` (heavy slot): **3 files, 14 tests passed**, exit 0.
- Probe: a temporary test file, deleted after its one run, turned the hold off on its own instances only. It printed `PROBE-UNIT ["notice","check done"]` and `PROBE-RUNTIME ["ready","provider_refused"]`. That is the defect, reproduced without the hold. The file "failed" only on the repository's real-SQL marker guard; its two tests passed.
- `npx vitest run src/programs/secret-keys src/programs/_shared --poolOptions.forks.maxForks=2 --poolOptions.forks.minForks=1` (heavy slot), run **before** the flake fix below: **76 of 77 files passed, 594 of 595 tests passed**. The one failure was `secret-keys/api/tests/workspace-choices.test.ts`, "refuse a member, even for the member's own key, on the workspace, and nothing changes": `defaultKeyId` expected the owner's first key, received another key.
- That rerun after the flake fix, and `pnpm --filter fluxiq check`: **not run, supervisor runs them.** The run was queued for about 30 minutes at place 4 behind live entries and then cancelled.
- The new host-sealed test "keeps saving order for keys saved in one millisecond…" has **not been run**; it is part of the supervisor's rerun.
- `node scripts/structure-audit.mjs` (Core root), before the flake fix: "structure-audit: passed (551 warning(s), 914 baselined)", exit 0. `service.ts` was 770 lines; it is now 774, under 800. The audit has not been re-run after those 4 lines.

## Not verified

- No live production-build run; the lead's live proof is the one to repeat.
- The probe ran in a test file, not against the old source, because I did not want an edited `service.ts` sitting in the shared tree while queued. A first attempt that edited `service.ts` was stopped before it ran, and the file was restored byte-for-byte from a copy.
- Nothing calls the panel's change stream (`runtime.modelAccessChanges`) per save in a test. It fires on the same publishes, so it is told once at the check and once at the release, and it re-reads the same checked snapshot both times.
