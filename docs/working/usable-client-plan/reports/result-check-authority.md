# Result-check authority without an unlock (Core t915)

## Outcome
Done. A Flow's standing result-check authorization records who gave it and how (the person, or a paired client acting for them). Each use is authorized again through Secret Keys' per-use authority, with no held session, unlock or password. CORE = `fxwork/t915/!FluxIQ`; paths below are under `packages/fluxiq/src` unless stated.

## What changed and why
- **Record** (`runtime/result-verification/check-authorization/contracts.ts`): `unlockSessionId` is gone. The record now carries `authorizationId`, `authorizedByUserId` and `grantedThrough` (`person`, or `client` + `trustedClientId`). The person's `maxTotalCostUsd` and `maxCostUsdPerCall` stay. Redemptions return `authorizationId` (`redeem.ts`, `repair.ts`).
- **Use** (`reveal.ts`, `provider-contract.ts`): the key is minted with `createUseAuthorization` using Secret Keys' existing `standing` principal (user, authorizationId, project, Flow, purpose). The paired-browser refusal is removed (brief step 2). `runtime-adaptation/result-check.ts` and `repair-authority.ts` send `authorizationId`, plus `purpose` (`loop_verification` or `repair`), to the host.
- **Authority** (`programs/_shared/key-access/authority.ts`): a `standing` principal used to be refused outright. It is now bound by a new `resolveStanding` port. `programs/_shared/runtime.ts` wires that port to `automationStudioStandingResultCheckGrant` (`flow-settings/result-check-settings.ts`), which requires the same id, person and purpose on the stored grant, unexpired, with the repair clause on for a repair. The authority then checks:
  - the gateway still vouches for the client (client grants);
  - the person is still enabled;
  - the key is the person's own (the workspace-assistant delegation never applies);
  - IAM still allows `secrets:UseKey`.

  The runtime's provider ports now call `secretKeys.access.createUseAuthorization`.
- **Grant** (new `check-authorization/grant.ts`; `flow-settings-requests/stored-check-authorization.ts`, `update.ts`; `programs/automation-studio/api/handlers/flows.ts`): there was no grant path at all. Since 2026-11-04 every client write of the authorization was stripped, and nothing created one. `update-flow-settings` now takes a top-level `resultCheckAuthorization` (`{keyId, maxTotalCostUsd?, maxCostUsdPerCall?, ttlMs?, repair?}`, or `null` to withdraw). The grantor comes from `request.actor`: a panel session gives `person`; `client-gateway:<id>` gives `client` through `clientGateway.trustedClientIdOf`. The handler checks IAM `secrets:UseKey` at grant time. A grant written into the Flow's metadata is still ignored.
- **Legacy records** (step 3): a record with `unlockSessionId` and no `grantedThrough` reads back as `legacy_unlock`. Both redemptions refuse it with `core.check.authorization_renew` or `core.repair.authorization_renew` and a plain sentence ("Turn result checking on again in the Flow's settings…", with no unlock or password wording). I did not map it to the person. Until 2026-11-04 anyone who could edit the Flow could write this record. The unlock handle is not an identity a later use can be authorized as, and a live-session proof would bring back the session dependency. So "same person" is not provable.
- **IAM** (step 4): `secrets:Unlock` is removed from `platform/iam/predefined/user-access.ts`, comment included. The login-time migration calls `secretKeys.unlockSession` directly from web server code, not through IAM, and no endpoint declares the action (it is absent from `actions.generated.ts`). The IAM action catalog was already current, so it is unchanged. I regenerated `platform/iam/catalog/generated/assistant-tools.generated.json` (`FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1`). Its only diff drops the dead `secret-keys__unlock` tool and the snapshot summary's word "unlocked".
- **Tests**: new `programs/_shared/tests/runtime-result-check-authority.test.ts` runs on the real composition (identity, gateway, Secret Keys, Automation Studio on disk). It covers:
  - a grant from a panel session that still pays after logout and a Core restart with nobody signed in;
  - a grant from a paired client with no panel session, before and after a restart;
  - refusal at use after a client revoke, a disabled key, a disabled person, or an IAM denial (role `viewer`);
  - repair only when the clause is on, and nothing after withdrawal;
  - another person's key is never used;
  - a legacy record is refused, and a fresh grant then pays.

  Also new: `check-authorization/tests/grant.test.ts`. Updated: the redeem, repair, provider, result-check-settings, stored-check-authorization, flow-check-authorization, result-check and repair-authority tests. Deleted: `reveal-holder.test.ts` (its subject, the paired-browser refusal, is gone). Fixtures moved to the new shape in 9 service-adaptation, in-run-repair, project-parts and caller-paid tests.
- **Docs**: `docs/architecture/automation-studio.md` (the standing authorization section) and a migration note in `docs/architecture/package-boundaries.md`.

## Commands run and observed results (in CORE)
- `pnpm --filter fluxiq exec vitest run` over the check-authorization, flow-settings, flow-settings-requests, runtime-adaptation and `_shared/key-access` folders: 31 files, 346 passed.
- Same, over `flow-check-authorization`, `caller-paid-result-check`, `runtime-result-check-authority` and `runtime-credential-unlock`: 4 files, 40 passed.
- Same, over 8 service-adaptation and in-run-repair files plus `service/project-parts`: 240 passed, 1 failed. The failure is `project-parts/run/tests/driving-gate.test.ts`: the "another run in progress" gate let a part run proceed. That file imports nothing I changed; not mine.
- After the last edits: 11 files, 73 passed. `vitest run src/platform/iam`: all IAM tests pass, and only the assistant-tools drift failed before regeneration (2 passed after).
- `pnpm --filter fluxiq check`: exit 0. `pnpm --filter @fluxiq/contracts check`: exit 0.
- `node scripts/structure-audit.mjs`: I fixed my two violations (a swallowed `.catch` in `runtime.ts`, a packed line in my test). Three remain, all in files I did not edit: `service.ts` method and line counts, and `runtime/conversations/conversations.ts:337` swallowed failure.

## Remaining `git grep -i "unlockSession\|unlock"` hits (result-verification, framework)
- Mine, on purpose: the `legacy_unlock` reading and refusal and its comments (`contracts.ts`, `redeem.ts`, `repair.ts`, `result-check-settings.ts`), and tests asserting the legacy path or that no unlock is used.
- Unrelated meaning: `persistence/program-state/storage.ts` `writeUnlocked` and the transaction tests (file locks); `runtime-session/tests/late-action-result.test.ts` (lock order); `framework/index.ts:113` (close options).
- Stale wording outside this brief: comments in `flow-bootstrap-commands/contracts.ts:17` and `generation/request.ts:9` ("whose unlocked key pays"), `flow-bootstrap-requests/generate.ts:129` and `run-requests/run-session.ts:61` ("never an unlock", which is accurate), and test names in `run-requests/tests/run-session.test.ts:84` and `tests/person-humanness/tests/run-session.test.ts:55,72`.

## Not verified
- No UI sends `resultCheckAuthorization` yet. apps/web was out of scope; `apps/web/.../settings/tests/result-check-settings.test.ts` still uses an opaque `unlockSessionId` fixture and still passes, since it only round-trips the object.
- A live unattended run with a real provider; the hosted `resolvePrincipal` path (a person's grant reaches it as a `standing` principal, and hosts must handle that); the full `pnpm check`.

## Open questions or contradictions found
- Edits outside the brief's owned list were needed for the goal: `_shared/key-access/authority.ts` and its `index.ts`, `_shared/runtime.ts`, `flow-settings-requests/update.ts`, `automation-studio/api/handlers/flows.ts`, and fixtures in other test folders. None touch client-gateway, ui-components, apps/web or the extension.
- `SecretKeysService.createSessionRevealAuthorization` now has no production caller; delete it in a secret-keys pass.
