# Unlock cleanup (Core t915)

## Outcome
Done, with open items below. The dead lock path is gone from Core source and docs. A connected client uses the configured key; a missing or legacy key is a setup step.

## What changed and why (CORE = fxwork/t915/!FluxIQ)
- Removed (files deleted): `runtime/models/secrets/locked-wait.ts`, `locked-error.ts`, `person-wait-clock.ts` (its only user was the wait), `runtime/conversations/assistant/model/workspace-key-locked-error.ts`, answer-first `person-waits/key-wait.ts`, contracts `secrets-locked.ts`, `workspace-key-locked.ts`, `task-attempts/model-key-lock.ts`, and their tests.
- `session-key.ts`: ports type lost `createSessionRevealAuthorization`, `sessionHoldsKey`, `whenUnlockChanges`, `fallbackUnlockFor`, `unlockedSessionFor`, `instanceHost`; `createUseAuthorization` is now required; `automationStudioSessionKeyLocked` and the lock throw are gone.
- `session-key-provider.ts`: no locked map, `onKeyWait`, `observeHolds`, `whenReady` wait or `instanceHost`. It throws at composition time if the ports lack `createUseAuthorization`.
- Caller: `commands/caller.ts` is now `effectiveCaller(actor)` returning `{userId, sessionId, preferredSessionId, paired}`. `bindUnlockedSessionResolver`, `noteKeySetupStepTold`, `keyLocked/keyNeedsUnlock/keyLockReason`, the setup-step branches in `execute.ts`/`run-flow.ts`, `modelKeyLockedWords` use in `progress.ts` (signature now `(title)`), and the vestigial `needsModelKey` flag are removed. Consumers edited: `command-context.ts`, `run-session.ts`, `programs/_shared/runtime.ts` (binding call, `instanceHost`, `publicInstanceHost`), `_shared/key-access/model-ports.ts`, `llm/deepseek/index.ts`.
- Answer-first: key-wait watcher removed from `run-attempt.ts`/`state.ts`/`keep.ts`/`person-waits/index.ts`. `model_key_locked` stays only in the contract's `AutomationStudioTaskAttemptWaitReason` (persisted attempts); `fluxnode/result-of.ts` now says "Model access was unavailable...".
- secret-keys: unlock endpoint constant and `Unlock*` types, `keyLockReason`, `keyNeedsUnlock*`, `sessionHoldsKey`, `whenUnlockChanges`, `HeldKeys.whenChanged`, `lockReasonFor`, `noteFirstUnlockTold`, `lockedBecause` removed. The unlock store keeps `lock/lockPerson` with a local `SecretKeyLockReason` (stored `lockReason`, no wording). `ui/index.ts` no longer re-exports the lock helpers.
- `PAIRED_CLIENT_UNLOCK_PREFIX` is now `PAIRED_CLIENT_HOLDER_PREFIX` (same `"paired-client:"` value) in `contracts/platform/model-keys/paired-client-holder.ts`.
- Legacy-key wording: `model-unavailable-words.ts` and the Keys list label (`KeyAvailability.tsx`) now say sign in to the FluxIQ panel once to finish upgrading, or add the key again. The readiness code cannot tell "no hostProtection" from "no createdBy", so one sentence covers both (see open questions). `interpret.ts` secret_unavailable wording reworded too.
- `engine-tools.ts` and `apps/web/e2e/panel-security.spec.ts` use the availability wording.
- Docs rewritten: `docs/fluxnodes/README.md`, `architecture/{package-boundaries,platform,automation-studio,automation-studio/persistence,program-layout}.md`, `operations/data-and-state.md`. `framework-reference.md` (both copies) regenerated with `pnpm docs:reference`; its diff also carries other workers' new exports.
- Comments reworded in ~12 source files that described an "unlocked session".
- Required test (item 2): `runtime/models/secrets/tests/authenticated-use.test.ts` has a `@ts-expect-error` proof that legacy-shaped ports do not type-check; `tests/session-key-provider.test.ts` proves the resolver throws at composition without it.
- Test support `src/tests/held-session-ports.ts` adapts a real SecretKeysService to the new ports (test-only). Other tests were rewritten to the new caller (paired client keeps its own session) and the lock/wait tests deleted. Deleted the stale `api-iam-escalation` "secrets:Unlock" test (endpoint was never registered, failing before this task).

## Commands run and observed
- `pnpm --filter fluxiq check` -> exit 0 (after fixing `answer-ask.ts`); `pnpm --filter @fluxiq/contracts check` -> exit 0; `pnpm --filter @fluxiq/ui-components check` -> exit 0.
- vitest batch (secret-keys, `_shared/tests`, conversations commands/assistant/tests, llm/deepseek, answer-first, run-requests, automation-studio api tests, session-key tests; 214 files) -> 1559 passed, 1 failed (the stale unlock test, since deleted and re-run: 6 passed), 1 suite failed: `answer-first/task-memory/tests/flow-base.test.ts` "opened a real SQLite database without the real-SQL marker" (not a file I touched; not mine). Separately: commands + models/secrets + session tests 515 passed after one fix; contracts platform+task-attempts 264 passed; ui-components 4 files 27 passed; deepseek-bootstrap 11 passed.
- `node scripts/structure-audit.mjs` -> my one violation (held-session-ports.ts in `runtime/`) fixed by moving it to `src/tests/`. Remaining FAILs are all `apps/web` files I did not touch (load-connect, resolve-pairing, ChatsPage, load-chats, top-bar naming, statement-packing, shared-source). It also says 2 baseline entries can be lowered; I did not run `pnpm structure:baseline` because other workers edit the same tree.

## Remaining `git grep -n -i unlock -- packages apps/web/src docs` (excluding docs/working and tests)
- Legacy login migration (kept by the brief): `apps/web` login/welcome/setup/restore-login-keys/WorkspaceManager, `secret-keys/runtime/service.ts` (`unlockSession`, `migrateHeldSession`), `held-keys.ts`, `seal-upgrades.ts`, `credential-changes.ts`, `_shared/runtime.ts` store wiring, `trust-authority.ts`.
- Credential-unlock store (kept): `secret-keys/runtime/unlocks/*`, `types.ts` records, `server/program-route/present-panel-session.ts`.
- Identity credential vault (not touched): `identity-access/*`, `IdentityAccessLive.tsx`, `database-manager/sensitive-stores.ts`, `VaultUnlockRequest`.
- Persisted literal / compatibility: `task-attempt.ts` (`model_key_locked`), `models-port.ts` and `key-row.ts` (`unlocked:false` becomes `upgrade_required`), `ui-components model-readiness.ts` (same), `contracts snapshot.ts`.
- Held-session reveal path for unattended result checks: `runtime/result-verification/check-authorization/*`, `framework/.../runtime-adaptation/{result-check,repair-authority}.ts`, `flow-settings/result-check-settings.ts` (they still use `createSessionRevealAuthorization` and "unlock" in comments; out of brief).
- Generated or unrelated: `iam/catalog/generated/assistant-tools.generated.json`, `iam/predefined/user-access.ts` (`secrets:Unlock` action), `contracts iam/actions.generated.ts`, `framework-reference.md` (store and vault exports), docs sentences saying there is no unlock, changelog entries in `package-boundaries.md`, `engine/automation/defensive/*` (page "unlock" wording), `evidence-loop-decision.ts` (prompt text, "unlock another observation").

## Not verified
- `apps/web` vitest and the e2e spec: web tests refuse to start ("Core's library build is 5 minutes behind its source"); I did not rebuild Core's dist (shared by four workers). Core `dist` for `@fluxiq/contracts` was rebuilt by another worker's build during my work.
- No browser or live run; `pnpm check` for the whole repo; the stale `flow-base.test.ts` failure is unexplained.

## Open questions
- Legacy keys: `legacy_recovery_required` covers both no-`hostProtection` and no-`createdBy`, so the wording says both fixes. A separate availability code would let the UI say only the right one (contracts change).
- `secrets:Unlock` remains in `user-access.ts` and the generated IAM catalog; removing it needs the catalog regenerated (not in my paths).
- The check-authorization reveal path still depends on a held session; it is the remaining route that could need a login.
