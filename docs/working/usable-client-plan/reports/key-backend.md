# Key backend (t928, sub-supervisor key-backend)

## Outcome

Done. A model key can now be saved, replaced and removed from a signed-in panel and from a paired extension with no password, PIN or authenticator code; IAM alone decides. Each save runs a free provider check and answers with the checked state. The state reflects refusals and empty balances and survives a restart. Every change is pushed to the panel's change stream and to paired clients with no timers. Proven live on the production build in a headed browser, including a real Claude reply in both clients.

Nothing is committed. Core tree `fxwork/t928/!FluxIQ` and extension tree `fxwork/t928/!FluxIQWebExtension`, both on `task/t928-key-backend`.

## Goals

1. **Writes with no password or PIN.** create, update, rotate and delete-key and the new save, replace and remove-model-key check no credential.
   - New values are sealed by host protection alone; old password-sealed records still open.
   - Two-step sign-in is never asked again (tested with TOTP on).
   - A paired client reaches only the three model-key writes (see "Outside the brief").
   - Secret Keys no longer reads PINs. Stored PIN hashes in Identity Access remain (t927).
2. **Free check on save.**
   - Anthropic: `GET /v1/models`. DeepSeek: `GET /models` and `GET /user/balance`.
   - The create-key, rotate-key and three new endpoints answer with the checked `modelAccess`.
3. **Failures recorded against the key.**
   - New contract status `no_credit` (additive; t925 must handle it).
   - A chat refused for balance records `no_credit`; a refusal records `provider_refused`.
   - Decision: the ledger persists, because it only reports and never blocks a call. It is keyed by the value's version, stored in program state, written only on change, and read before the first state read.
   - A save's change notice waits until its check is recorded, so a dead key never flashes "ready" (found live; fixed in round 3).
4. **Push.**
   - `server.model_access_changed {modelAccess}` (paired form, no key id) goes to each ready person-paired session whose person is still enabled.
   - The panel gets SSE `event: model-access` (re-read the snapshot), read from `selected.fluxiq.programs.modelAccessChanges` (the runtime instance), never a module-level singleton.
   - Sources: key and settings changes, ledger outcomes, IAM decision changes, identity directory changes.
   - Proven on the production build: the side panel heard the panel's save in 160 ms, and the panel stream heard the extension's save.
5. **Old-format keys.**
   - Upgraded automatically at the next sign-in through the existing login path (`restoreLoginKeys` → `unlockSession`); no outside edit was needed.
   - The state's message says so.
6. **`lastRevealedAtMs`.** No longer written by a model call; a person's own reveal still writes it.
7. **Lent keys in Flow calls.** A key lent to the workspace with both consents now pays.
   - Also found and fixed: every default Flow stores `llmProvider: "host"`, which `runtime.ts` read as a named provider. That hid the lent key, and t924's per-person key choice for default Flows.
   - The standing result-check and repair authority may also use a lent key (both consents, checked at each use). It now runs with no unlock or held session (tested). `resolveStanding` is now required.
8. **`/api/keys` 503.**
   - Cause: `server/key-sessions/config.ts` required `FLUXIQ_INSTANCE_ID` in every profile; discovery required it only in the service profile.
   - Fix: the local profile derives a stable `local-<sha256(origin)[:16]>` shared with discovery; the service profile still requires the variable.
   - Live: `GET /api/keys` answered 200.
9. **Extension.**
   - `RUNTIME_MESSAGES.panelModelKeySave/Replace/Remove` (`fluxiq.panel.modelKey*`) are mapped in `AUTOMATION_PANEL_MESSAGES` as `modelKeySave/Replace/Remove` and relayed to the three endpoints.
   - Each answers `{ ok: true, payload: { modelAccess } }`; the key value is cut from any failure.
   - The push becomes the side-panel broadcast `{ type: "fluxiq.panel.modelAccessChanged", modelAccess, at }`.

Lead additions:
- **Key-lock machinery removed:** `unlockClients`, `enrollLockedCredential`, `unlockTicketFor`, `liftable`, `lockedClientsFor` and `SecretKeyLockedClient`. Kept: `lock`/`lockPerson`, which are revocation on a password reset.
- **Activity outcome:** the key writes opt in to `auditOutcome`, so the audit records what the handler did ("succeeded" or "failed" with an error kind) beside the decision. t925's panel must join by `requestId` and show the outcome row.

## Workers

| Worker | Tier | Brief | Outcome | What I verified |
|---|---|---|---|---|
| key-check | Sonnet | free check, `no_credit`, ledger, lent release | Done | its tests in the final sweep |
| key-writes | Opus (3 rounds) | Secret Keys writes, endpoints, sealing, legacy upgrade; two-step, lock removal, standing; held notice | Done | secret-keys and key-access suites in the sweep; the live proof |
| key-push | Opus (2 phases) | gateway push, panel topic; `runtime.ts` wiring | Done | client-gateway, `_shared` and panel-changes suites; the live push |
| extension-keys | Sonnet | relays, broadcast | Done | extension tests, check and build |
| instance-id | Sonnet | `/api/keys` 503 | Done | key-sessions and discovery tests; live 200 |
| key-callsites | Sonnet | 16 test call sites | Partial (one test unrun) | ran it in the sweep: web 329/329 |
| paired-route | Opus | admit the three writes on the paired route | Done | program-route suite |
| audit-outcome | Sonnet | opt-in outcome audit row | Done | `_shared`/iam suites |
| key-live | Opus | headed live proof, production build | Done | read its evidence JSON: states, broadcasts, key scan 0 |

A machine crash at about 17:37 on 11-17 killed the first wave (key-writes, key-push, extension-keys, instance-id) with no reports. I re-dispatched each at the same tier to review and finish its edits. A NUL or empty-file scan of every changed file found none. No tier escalations.

## Integration edits I made

- `shared/constants.ts`: three `RUNTIME_MESSAGES` lines. `protocol.ts` maps them.
- `auditOutcome: true` on create, rotate and delete-key and the three model-key endpoints.
- New `secret-keys/api/tests/audit-outcome.test.ts`.
- A decision-rows-only filter in `workspace-choices.test.ts`.
- `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts:38` passes the program and endpoint to `isPairedClientClassification`, for hosted multi-tenant.
- The instance-id test imports discovery through its barrel (a structure-audit fix).
- The extension relay test uses the failure code `"refused"`; it had a nonexistent `"bad_request"`.
- Regenerated `assistant-tools.generated.json` and the IAM catalog (`contracts/src/iam/actions.generated.ts`).
- `docs/architecture/automation-studio/client-gateway.md`: a paragraph on the three token writes.

## Outside the brief's owned paths (lead to reconcile)

Core:
- `server/program-route/{program-route,handle-program-request}.ts`. This blocked goal 9: the paired cap dropped `secrets.manage`, and only `snapshot` was allowlisted. `secrets.manage` is now in the cap, and the endpoint allowlist names the three writes only. `program-gated` is admitted only for those three names.
- `programs/_shared/api.ts` and `platform/iam/**` (`auditOutcome`).
- `programs/_shared/key-access/**`.
- `programs/_shared/model-access/**` (new).
- `apps/web/src/server/key-sessions/**` and `apps/web/src/app/api/discovery/**`.
- `apps/web/.../api/programs/.../route.ts` (one line).
- Test call sites in `_shared/tests`, automation-studio, identity-access (granted), `src/tests` and `apps/web/src/lib/workspaces/tests`.
- Generated files.
- Two Core docs.
- The client-gateway registration lines in `service.ts`, `service/index.ts` and `trace-tap/tap.ts`.

Extension:
- `constants.ts` (granted).
- Registration lines in `connection/server-command-channel.ts` and `connection.ts`.

The brief's `packages/contracts/src/platform/client-gateway/` does not exist. The folder is `packages/contracts/src/client-gateway/model-access/`.

## Commands run and observed results (final sweep, after every edit, under one heavy slot)

- Core libraries: `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build` -> exit 0.
- `pnpm --filter @fluxiq/contracts check` -> exit 0. `pnpm --filter fluxiq check` -> exit 0 (fresh tsc). `pnpm --filter @fluxiq/web check` -> exit 0 (fresh).
- fluxiq `npx vitest run` over `src/programs/secret-keys`, `src/programs/_shared`, `src/runtime/models`, `src/runtime/llm`, `src/client-gateway`, `src/server/program-route`, `src/platform/iam` and the changed `src/tests`, automation-studio and identity-access tests -> 492 files, 4671 tests passed.
- contracts `npx vitest run src/platform/model-keys src/client-gateway` -> 3 files, 10 passed.
- web `npx vitest run src/app/api/panel/changes src/server/key-sessions src/app/api/keys src/app/api/discovery src/app/api/programs src/lib/workspaces/tests/tenant-eviction.test.ts` -> 25 files, 329 passed.
- `node scripts/structure-audit.mjs`: Core passed (551 warnings, 914 baselined); extension passed (252, 551).
- Extension:
  - `pnpm --filter "./packages/*" build` -> exit 0. This worktree had never built its downstream packages, so the check could not resolve `domain/node` or `browser-host`.
  - `node scripts/test-extension.mjs background/automation-relay background/model-access background/connection` -> 420 pass, 0 fail.
  - `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0. `... extension build` -> exit 0.
- `pnpm --filter @fluxiq/web build`, via `scripts/run-fluxiq-web.mjs` in the live run -> "Compiled successfully in 3.4min". That was before round 3; the recheck rebuilds it.
- Live, headed, production build, ports 3300 and 5077, `FLUXIQ_INSTANCE_ID` unset (`reports/key-backend/key-live.md`; evidence in `test-runs/t928-key-proof/`):
  - `/api/keys` answered 200.
  - Panel save, replace and remove with no password: `provider_refused`, `provider_refused`, `no_key`.
  - Extension the same, with no key id in any answer.
  - Push heard both ways.
  - The real key saved from the extension read ready. The extension chat and a panel project chat each got a real Claude reply: two paid calls.
  - The real key was removed afterwards. A key scan of 386 files found 0 occurrences.
  - Ports were freed and the slot released.

## Not verified

- (Done, not a gap.) Live recheck after the round-3 notice fix, on a fresh production build ("Compiled successfully in 2.3min"):
  - panel save and replace, then extension save and replace, each gave the side panel exactly one `fluxiq.panel.modelAccessChanged`, status `provider_refused`, never `ready`;
  - the panel stream emitted `model-access` after the check each time, twice in the same millisecond, which costs one extra snapshot read;
  - no paid calls; evidence in `test-runs/t928-key-proof/step4b-push-recheck.json`. I confirmed four `provider_refused` states and no `ready` in that file.
- Hosted multi-tenant and the `service` IAM profile, end to end: the route line has no live run.
- A held or unlocked session change for a person fires no push (Secret Keys has no signal for it). IAM and identity pushes are tested with fakes only.
- Firefox. The docked Chrome side panel (the extension tab page was used). t925's card UI is not on this branch.
- No full suites, per the rules.

## Open questions and decisions for the lead

1. `save-model-key` makes the saved key the workspace's assistant choice, so "chats use the saved key". In a multi-person workspace it moves everyone's assistant key; others use it only if it is offered. A per-person choice would need a new setting.
2. With host-only sealing, a lost host master key means the owner saves the key again; there is no password to re-wrap from.
3. The free check runs only when model providers are enabled.
4. Removed keys leave small ledger entries, never read again. Pruning is not done.
5. `client-gateway/service/model-access/delivery.ts` restates the person-paired rule. One line in `project-focus/index.ts` (`export * from "./person-paired.ts"`, t929's area) would let it import the rule instead.
6. For other owners:
   - `apps/web/src/server/connect/restore-login-keys.ts` passes a now-ignored `passwordVerified`;
   - Identity Access still stores and requires PINs (t927);
   - the `program-gated` doc in `_shared/api.ts` should say "may mean IAM only";
   - t925 must handle `no_credit`, join the activity outcome rows by `requestId`, and fix the side panel's "Add a model key" banner, which lagged after a ready push in the live run.

## Fix round (security review F1-F3, lead items 5-7)

The trees were taken after the lead's verify-t928 merged dev in (Core 761765f2f, extension 6ca11b08e) and released its slot.

1. **F1 (confirmed): saving no longer moves the workspace's key.** Worker key-choice-fix, Opus; report `key-backend/key-choice-fix.md`.
   - `ModelKeySettings` gains a per-person choice (`personKeyChoices`, own keys only) and a `noAssistantKey` marker.
   - `save-model-key` calls `keySavedBy`. That sets the saver's choice, and fills the workspace slot only when it is empty, checked and written in one synchronous step.
   - `chooseAutomationStudioCallerModelKey` takes `ownKeyId` and picks in this order: the person's own choice, then the workspace choice under the consent rule, then their newest own key.
   - The chats, default Flows, the model-access state and the panel assistant (`key-model-source.ts`) all use it.
   - Removing the workspace key leaves the workspace with none; nobody is switched to another person's key.
   - Tests cover two admins and a member with an offered key, from the panel and through the real paired route; a solo first save; replace and remove; and removing the workspace key.
   - Lead decision (stands as built): after a removal, the next save fills the empty slot.
2. **F3:** the comment at `program-route.ts:41` is corrected: the person pressing Remove is the confirmation, and IAM decides. Lines 186-189 now state the first-save exception.
3. **F2:** one line in Core `docs/programs/global-programs.md` (Secret Keys): an offered key may pay for members' Flows and standing result checks, and withdrawing the offer stops it at the next use.
5. **`protocol.ts` split.** Worker protocol-split, Sonnet. The model-key and model-access message types moved to the new `apps/extension/src/shared/model-key-messages.ts`, with every importer updated and no re-export. `protocol.ts` went from 818 to 793 lines; the message strings are unchanged.
6. **`global.sqlite` handle leak.** Worker sqlite-leak, Opus; report `key-backend/sqlite-leak.md`.
   - Cause, traced on every SQLite handle: the model-access ledger read `secret-keys/model-access-ledger` from `global.sqlite` at construction. Nothing waited for that read, so it ran past the close.
   - Fix: the ledger reads lazily and has a `close()`, which `detach()` calls.
   - I closed the remaining gap: a runtime `settled()` member, which `FluxIQ.close()` (`framework/index.ts`) awaits before program state closes its connections. A write already in flight now lands before close.
   - New test in `_shared/model-access/tests/ledger-store.test.ts`: a close right after a save leaves no handle open, runs no SQL after the close, and the refusal is read back by a new instance.
   - It fails without the await ("expected [ Array(1) ] to deeply equal []"). I mutated the file, then restored it and confirmed the restore with `cmp`.
7. **Activity outcome join.** Worker activity-join, Sonnet.
   - `audit-read/assemble.ts` holds outcome rows by request id and action, and joins each onto its decision entry. It keeps reading, bounded, until a pending outcome meets its decision row. The outcome rows themselves are not sent.
   - `shape-activity-entry.ts` adds `result` and, on failure, `errorKind`. No request id leaves the server.
   - The new test file is `security/server/tests/activity-outcome-join.test.ts`.
   - The worker could not run anything because the slot gate stalled for two hours; my sweep ran it.
   - The local type `JoinedActivityEntry` stands until t925 unifies it with its shared `ActivityEntry` (lead's decision).

### Fix-round sweep (one heavy slot, after every edit)

- Core library build -> exit 0. `pnpm --filter fluxiq check` -> exit 0. `pnpm --filter @fluxiq/web check` -> exit 0.
- fluxiq `npx vitest run src/programs/secret-keys src/server/program-route src/programs/_shared src/runtime/llm src/runtime/models src/runtime/conversations/assistant/model src/programs/automation-studio/api/panel-assistant src/client-gateway src/platform/iam src/framework` -> 1258 files passed, 1 failed; 9852 tests passed, 1 failed.
  - The failure: `framework/automation-service/service/subflow-trial/tests/run.test.ts` "hands the start hook the brief's host lease … (A11)" (`seen[0]` undefined). It fails every time.
  - t928 changes nothing under `automation-service` or `engine` against its merge base (7431351c0, t930). That is dev's own defect, not this branch's.
- web `npx vitest run src/app/api/security src/lib/workspaces src/app/api/panel/changes src/server/key-sessions src/app/api/keys src/app/api/discovery src/app/api/programs` -> 52 files and 611 tests passed, 7 failed.
  - All 7 are in `web-workspaces.test.ts`, with the known `No "prepareLocalFirstRun" export … owner-claim mock` message (13 occurrences), which is dev's t927 breakage.
  - No EBUSY. The two named leak tests pass. The security tests, including the new join test, pass.
- Structure audits: Core passed (554 warnings, 911 baselined); extension passed (253, 551).
- Extension: `test-extension.mjs background shared` -> 1039 pass, 0 fail. `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0. Build -> exit 0.

### Not verified (fix round)

- No live run. What clients see changes only in that another person's save no longer moves your key; the saver's own answer is unchanged.
- F4 (the push not asking IAM) and the hosted profile refusing key writes are deferred to the hosted unit, per the lead.
