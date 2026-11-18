# key-push (t928, key-backend): report

## Outcome

Done for the owned paths. The crashed worker's edits were nearly complete. I reviewed them against the brief, made
four fixes, and ran every named check. Every check for my paths passes. The two package typechecks still fail, but
only on files outside my paths (listed below). The runtime wiring is left for phase 2; the exact text is below.

## What changed and why

Reviewed as left by the crashed worker, and kept:
- Contracts (`packages/contracts/src/client-gateway/model-access/`): `ClientGatewayModelAccessChanged = { modelAccess:
  ModelAccessState }` and `readClientGatewayModelAccessChanged` (refuses an invalid state and any `key.id`). Also
  registered in `client-gateway/index.ts` and in the `server-message.ts` union.
- Gateway (`packages/fluxiq/src/client-gateway/service/model-access/`): `ClientGatewayModelAccessDelivery`, built
  as `ClientGatewayService.modelAccessPush` in `service.ts`, exported from `service/index.ts`, and
  `server.model_access_changed` added to `UNTRACED_OUTBOUND` in `trace-tap/tap.ts`. It has one lane per session (a
  publish during a read reads once more afterwards). It sends only when the state differs from what was last sent to
  that session for the same person, strips the key id and validates the state before sending, and uses
  `sendUnqueued`. A failed read sends nothing and is audited once per outage as `model_access_push.state_failed
  {sessionId, failureKind}`. It forgets what it last sent on `session.ready` or `session.disconnected`. It uses no
  timer.
- Web (`apps/web/src/app/api/panel/changes/`): a `model-access` topic, `event: model-access` with data `{version}`,
  coalesced like `gateway`, and only for the `panel` channel.
- Docs: both docs describe the push and the topic.

My fixes:
1. **Where the panel reads the source.** The worker read `selected.fluxiq.modelAccessChanges`, a property of the
   `FluxIQ` class (`framework/index.ts`). Phase 2 wires `programs/_shared/runtime.ts`, which builds
   `GlobalProgramRuntime`, and that is `selected.fluxiq.programs`. The route now passes `selected.fluxiq.programs`
   to `panelModelAccessSource`, so phase 2 needs no change outside runtime.ts. This is consistent with
   `selected.fluxiq.programs.automationStudio.conversations.signals`, which the route already reads. The accessor is
   narrow (it does not depend on `GlobalProgramRuntime` having the property) and returns undefined while the property
   is absent, so the topic is then left out. The route tests now set the property on `runtime.tenantX.programs`. The
   doc comments and the architecture doc say this.
2. **Structure audit FAIL on `delivery.ts`.** It imported `../project-focus/person-paired.ts`, which bypasses that
   folder's barrel. The barrel does not export `personPaired`, and `project-focus/index.ts` is on my must-not-touch
   list. Inside my paths, `speakerOf` now states the same rule: a trusted client and a person, and neither a managed
   host nor a channel-scoped stand-in. The cleaner fix is in Open questions.
3. **Unhandled rejection.** `publish` starts each lane as `void this.run(...)`. A throw after the read, such as
   `pairedClientModelAccessState(undefined)` from an authority that answered nothing, became an unhandled rejection,
   which can bring down a Node process. Each recompute is now guarded and audited like a failed read. New test: "audits
   an answer that is not a state at all". Mutation check: without the guard, that test fails and vitest reports
   "Unhandled Rejection". It passes again once the guard is restored.
4. **Type error in a test.** The test used session status `"pending"`, which `ClientGatewaySessionStatus` does not
   have. It is now `"pairing_required"`.

Files I edited: `service/model-access/delivery.ts`, `service/model-access/tests/delivery.test.ts`,
`apps/web/.../changes/route.ts`, `topics/model-access.ts`, `tests/route.test.ts`, `tests/panel-change-stream.test.ts`
(one test name), `docs/architecture/automation-studio/client-gateway.md`. Everything else in my paths is the
crashed worker's work, which I reviewed and left unchanged.

## Port signatures (fixed)

```ts
// packages/fluxiq/src/client-gateway/service/model-access/types.ts
type ClientGatewayModelAccessSubject = { sessionId: string; userId: string; trustedClientId: string };
type ClientGatewayModelAccessAuthority = (subject: ClientGatewayModelAccessSubject) => Promise<ModelAccessState | null> | ModelAccessState | null;
type ClientGatewayModelAccessPushPort = { setAuthority(stateOf: ClientGatewayModelAccessAuthority | undefined): void; publish(): number };
// ClientGatewayService.modelAccessPush: ClientGatewayModelAccessPushPort
// apps/web/src/app/api/panel/changes/topics/model-access.ts
type PanelModelAccessSource = { subscribe(listener: () => void): () => void };
panelModelAccessSource(programs: object): PanelModelAccessSource | undefined  // reads programs.modelAccessChanges
```

## Exact runtime.ts wiring for phase 2 (`packages/fluxiq/src/programs/_shared/runtime.ts`)

1. On `GlobalProgramRuntime` (next to `secretKeys`):
```ts
  /** Says "a person's model access may have changed", naming nothing; the panel's change stream reads it (t928). */
  modelAccessChanges: { subscribe(listener: () => void): () => void };
```
2. Directly after the `registerSecretKeysApi(api, secretKeys, …)` call. `pairedUnlockOf`, `holderOf`,
   `preferredModelKey`, `modelAccessLedger` and `AUTOMATION_STUDIO_PAIRED_CLIENT_SESSION_PREFIX` are already in
   scope there:
```ts
  // A person's model access, worked out as the Secret Keys snapshot answers their paired client (`client-gateway:<session>`).
  clientGateway.modelAccessPush.setAuthority(async ({ sessionId, userId }) => {
    const actorSessionId = `${AUTOMATION_STUDIO_PAIRED_CLIENT_SESSION_PREFIX}${sessionId}`;
    const snapshot = await secretKeys.snapshotFor({ userId, sessionId: pairedUnlockOf(userId, actorSessionId), ...holderOf(actorSessionId) });
    return automationStudioModelAccessState({ keys: snapshot.keys, userId, preferred: await preferredModelKey(), ledger: modelAccessLedger });
  });
  // Each committed key or choice change, and each changed last-call outcome, tells paired clients and the panel; no timer.
  const modelAccessListeners = new Set<() => void>();
  const modelAccessChanged = () => {
    clientGateway.modelAccessPush.publish();
    for (const listener of [...modelAccessListeners]) {
      try { listener(); } catch { /* best-effort: one listener must not stop the others */ }
    }
  };
  const stopModelKeyChanges = secretKeys.onModelKeysChanged(modelAccessChanged);
  const stopLedgerChanges = modelAccessLedger.subscribe(modelAccessChanged);
  const modelAccessChanges = { subscribe(listener: () => void) { modelAccessListeners.add(listener); return () => { modelAccessListeners.delete(listener); }; } };
```
3. In the returned object, add `modelAccessChanges,` and in `detach` add `stopModelKeyChanges(); stopLedgerChanges();
   clientGateway.modelAccessPush.setAuthority(undefined); modelAccessListeners.clear();`.
4. No `publish()` is needed at install, because no session exists yet, and a session that becomes ready reads its
   state itself.

Checked: a paired actor's session id is `client-gateway:<gateway session id>` (`server/program-route/program-route.ts:249`,
`project-focus/paired-read.ts:91`). The authority's `snapshotFor` arguments match those that `registerSecretKeysApi`
passes for that actor (runtime.ts, the `registerSecretKeysApi` call).

## Commands run and observed results

All were run in `C:/Users/osrs_/FluxStuff/fxwork/t928/!FluxIQ`.
- contracts `npx vitest run src/client-gateway`: 1 file, 4 tests passed.
- `heavy-slot … pnpm --filter @fluxiq/contracts check`: build-cache `reuse` ("inputs and outputs match the stamp").
  I changed no contracts file.
- fluxiq `heavy-slot … npx vitest run src/client-gateway --poolOptions.forks.maxForks=2`: it refused to start with
  `RangeError: options.minThreads and options.maxThreads must not conflict`. vitest 2.1.9's default `minForks` comes
  from the CPU count and is above 2. I reran it with `--poolOptions.forks.minForks=1` added: 79 files, 638 tests
  passed (including `delivery.test.ts`, 13 tests). That run came before fix 4, which is a test-only literal; after
  fix 4, `npx vitest run src/client-gateway/service/model-access` gave 13 passed.
- Mutation check of fix 3 (guard removed, then restored with cmp): the new test fails, with "Unhandled Rejection",
  and passes again (13/13) once restored.
- `node scripts/structure-audit.mjs`: the `delivery.ts` FAIL is gone. One violation remains, outside my paths:
  `apps/web/src/server/key-sessions/instance-id/tests/resolve.test.ts` reaches into
  `app/api/discovery/build-discovery-document`. Advisory warnings only: `route.test.ts` has 453 lines, and
  `ClientGatewayService` has 40 methods.
- The web tests first refused to run: "Core's library build is 16 minute(s) behind its source". I rebuilt with
  `heavy-slot … pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build`: exit 0
  (contracts reused, fluxiq and ui-components built).
- web `npx vitest run --config vitest.config.ts src/app/api/panel/changes`: 2 files passed
  (`panel-change-stream.test.ts` 15 tests, `route.test.ts` 23 tests, including the 3 model-access route tests).
- `heavy-slot … pnpm --filter fluxiq check`: exit 2. On the first run, one error was mine (the `"pending"` status,
  fixed). On the second run, 19 errors, none in my paths. They are all outside them, from the secret-keys work in
  flight: `'authorizationPassword' does not exist in type 'CreateSecretKeyInput'` in
  `programs/_shared/tests/runtime-access-fixture.ts`, `runtime-credential-changes.test.ts`,
  `runtime-session-revocation.test.ts`, `automation-studio/api/panel-assistant/tests/workspace-key.test.ts`,
  `identity-access/api/tests/handlers.test.ts`, `src/tests/anthropic-session-panel.test.ts`,
  `deepseek-session-key.test.ts`, `instance-leak.test.ts`, `model-provider-disabled-run.test.ts` and
  `session-key-provider.test.ts`; and `Property 'salt' does not exist on type 'EncryptedSecretValueRecord'` in
  `programs/secret-keys/runtime/tests/seal-upgrades.test.ts` (3 errors).
- `heavy-slot … pnpm --filter @fluxiq/web check`: exit 2, with one error, outside my paths:
  `src/lib/workspaces/tests/tenant-eviction.test.ts(90,105)`, the same `authorizationPassword` error.

## Not verified

- The runtime wiring is not applied (phase 2). No end-to-end path from a real key write to a socket or SSE event was
  exercised. The delivery and the topic are tested with fakes and the real gateway parts only.
- The bundle-copy claim, that the topic now reaches the instrumentation graph's runtime, is not checked against a
  `next build`. The source is read from the instance, which avoids the module-level hub, but no build-level test
  exists.
- No live browser or extension run.

## Open questions or contradictions found

1. **Duplicated person-paired rule.** The cleaner fix for the structure FAIL is one line in
   `client-gateway/service/project-focus/index.ts`, `export * from "./person-paired.ts";`, after which `delivery.ts`
   can import `personPaired` from `../project-focus/index.ts` again. That file was on my must-not-touch list, so the
   rule is restated in `speakerOf` for now.
2. **The authority does no person-enabled or role check.** The paired program route refuses a disabled person
   (`program-route.ts:249` builds the actor only after the role check). The wiring above does not, so a disabled
   person's still-open session could be pushed their own state. Phase 2 should answer null when the person is not
   enabled, or rely on t929 closing that person's sessions.
3. **Changes that fire neither source.** The state can also change through a person's held or unlocked session
   (`pairedUnlockOf`/`holderOf`, which affects `key_unavailable`) and through IAM or identity changes. Neither
   `onModelKeysChanged` nor the ledger fires for those. Phase 2 should decide whether to call `modelAccessChanged`
   from those places as well.
4. The briefed command `--poolOptions.forks.maxForks=2` fails alone on this machine; it needs
   `--poolOptions.forks.minForks=1` with it.
5. `apps/web/vitest.t928tmp.config.ts` was no longer in the tree when I listed `apps/web` (it was untracked at the
   start). I did not delete it.

## Phase 2

### Outcome

Done. Everything the three reports name is wired in `programs/_shared/runtime.ts` and a new
`programs/_shared/model-access/` helper, with tests:
- the free check;
- stored ledger outcomes;
- one push for paired clients and the panel, which answers nothing for a person who is no longer enabled;
- IAM and identity change signals;
- the lent key in Flow calls.

Both package typechecks now pass. One defect surfaced and was fixed at its cause: a default Flow's stored
`llmProvider: "host"` was read as a named provider. Three test failures remain in the shared vitest run, all in
files outside my paths (below).

### What changed and why

All in `packages/fluxiq/src/programs/_shared/` unless named.

- **New `model-access/` folder** (barrel, `types.ts`, `push.ts`, `ledger-store.ts`, `tests/push.test.ts`). I used a
  folder instead of growing `runtime.ts` further: it was already 558 lines, against a 400-line advisory threshold.
  - `installModelAccessPush({ gateway, sources, identity, stateOf })` answers `{ changes, stop }`.
  - One `changed()` runs `clientGateway.modelAccessPush.publish()` and then every `changes` listener. A listener
    that throws is logged by its error's kind only.
  - It installs the gateway's authority. That authority answers null for a person who is disabled, gone or has no
    role, read from the identity the paired program route reads (the same rule as `pairedClientActor`; programs
    never import `server/`). Otherwise it answers `stateOf`.
  - It watches that identity's `directoryChanges`: at install, and again on the first read in case the install
    read failed.
  - `stop` removes the authority (`setAuthority(undefined)`), every subscription and every listener. It is
    idempotent.
- `modelAccessLedgerStore(dataDir)`: a `ProgramJsonStore` at `programDataFile(data, "secret-keys",
  "model-access-ledger.json")`. Under layout v2 it lands in the root's SQLite `program.state`. It holds ids,
  versions, outcomes, times and the provider's failure words, never a key's value.
- `runtime.ts`:
  - The ledger is built with that store when the instance has paths, and with none when it has no paths.
  - A shared `modelAccessOf(userId, snapshot)` awaits `whenLoaded()` before every state read. It serves both the
    Secret Keys API (5th argument) and the push.
  - `registerSecretKeysApi`'s 6th argument is the free check. It calls `modelAccessLedger.noteCheck({ id,
    updatedAtMs: lastRotatedAtMs, lastRotatedAtMs }, await checkAutomationStudioModelKey({ provider, value }))`,
    which is the version the state reads. It is passed only when `modelProvidersEnabled`: an instance with
    providers off makes no provider call, so its keys keep `lastCall: null`.
  - `installModelAccessPush` is fed by four sources:
    - `secretKeys.onModelKeysChanged`;
    - `modelAccessLedger` (subscribe);
    - `api.subscribeDecisionChanges` (IAM);
    - the identity's `directoryChanges` (people and roles).

    That covers the identity and IAM change signals in reach, with no timer. `stateOf` reads
    `secretKeys.snapshotFor({ userId, sessionId: pairedUnlockOf(...), ...holderOf(...) })` for
    `client-gateway:<session>`, exactly as the API's `keySessionOf` does for that actor.
  - `GlobalProgramRuntime.modelAccessChanges` was added and returned, and `detach` calls `modelAccessPush.stop()`.
  - The Flow lent-key lines from key-check.md were applied as written.
- **A defect found by the lent-key test, and fixed in `runtime.ts`.** Every new Flow stores `metadata.llmProvider:
  "host"`. The session-key resolver reads `"host"` as "no provider in particular", but `runtime.ts` read it as a
  named provider. The `!providerId && !modelId` branch therefore never ran for a default Flow. That made t928's
  lent key unreachable, and t924's "a Flow that names neither uses the key the person's calls use" never applied to
  default Flows either: they fell back to the default model's provider. `runtime.ts` now treats `"host"` as
  unnamed, for both the request and the metadata. Before the fix, the lent-key test failed with
  `llm.provider_secret_unavailable`. I confirmed in a scratch test, since deleted, that the release and the choice
  were correct on their own.
- Phase-1 files: the web accessor and route comments now say the runtime carries the signal. The architecture doc
  names the enabled check, the IAM and identity sources, and the stored ledger.

### Tests

- `programs/_shared/tests/runtime-model-access-push.test.ts` (real composition, layout v2, stubbed `fetch`):
  1. Saving a key through `save-model-key` (panel actor) runs the free check, which goes to Anthropic with the key
     and gets a 401. It pushes `server.model_access_changed` with status `provider_refused`, key name and provider,
     and `lastCall.outcome: provider_refused`, to the person's paired socket, and fires the
     `programs.modelAccessChanges` listener. No pushed state has `key.id`, and the key value is in no socket frame.
     The panel snapshot agrees. A repeat publish sends nothing. After `detach`, `publish()` reaches 0 sessions and
     the listener hears nothing.
  2. Restart: the refusal is in the store, a second instance on the same root reads `provider_refused` with its
     `lastCall`, and it makes no provider request.
  3. Lent key: the holder's DeepSeek key is offered and chosen for the workspace, and a second person ("builder",
     with no key of their own) makes a Flow call through the bound resolver. The single DeepSeek request carries
     `Bearer <lent value>`. After the holder withdraws the offer, the call fails and the lent value is never sent.
- `programs/_shared/model-access/tests/push.test.ts` (fakes, 5 tests): publish and listeners run on a change, one
  failing listener costs nothing and its words are not logged; an enabled person is answered; a disabled, gone or
  roleless person gets null and `stateOf` is not called; directory changes are watched once; `stop`.
- Mutation checks (each applied, run, then restored and compared with `cmp`):
  - ledger built without persistence: the restart test fails;
  - enabled-and-role check removed: the "answers null" unit test fails;
  - (before the fix) `"host"` read as a provider: the lent-key test fails.

### Commands run and observed results

All were run from the Core worktree. Heavy steps ran one at a time through `heavy-slot … key-push`.
- fluxiq `npx vitest run src/programs/_shared/model-access src/programs/_shared/tests/runtime-model-access-push.test.ts`:
  2 files, 8 tests passed. I reran it after the key-callsites worker removed `actorSession` from my test's
  `createKey` call: 8 passed. I kept that change, because `CreateSecretKeyInput` no longer has the field.
- fluxiq `heavy-slot … npx vitest run src/programs/_shared src/client-gateway --poolOptions.forks.maxForks=2 --poolOptions.forks.minForks=1`:
  124 files, 942 passed and 3 failed. None of the failures is in my paths or caused by my change:
  - `_shared/assistant/tests/generated-module.test.ts` "is current with the live registry".
    `assistant-tools.generated.json` has drifted from key-writes' secret-keys endpoint changes (the save, replace
    and remove model-key endpoints, and refusal reasons that no longer mention a password). Fix: regenerate it with
    `FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/programs/_shared/assistant` once key-writes is
    final. The file is not in my paths.
  - `_shared/key-access/tests/standing-result-check.test.ts` (2 tests; a new, untracked file from another worker in
    `key-access/**`, which I may not touch). `createFlow` throws "This Automation Studio service has no storage
    root" because the test boots no v2 layout. That happens before any code I touched runs.
- contracts `npx vitest run src/client-gateway`: 1 file, 4 passed.
- `heavy-slot … pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build`: exit 0.
- web `npx vitest run --config vitest.config.ts src/app/api/panel/changes` (against the rebuilt dist, where the
  tenant runtimes now carry the real `modelAccessChanges`): 2 files, 38 passed.
- `heavy-slot … pnpm --filter fluxiq check`: exit 0 (`fluxiq:check` built, no TS errors).
- `heavy-slot … pnpm --filter @fluxiq/web check`: exit 0 (`web:check` built, no TS errors).
- `node scripts/structure-audit.mjs`: my paths are clean. My first run flagged `[swallowed-failure]` in
  `model-access/push.ts`; I fixed it by saying in the catch that the first session read watches the identity
  again. One FAIL remains outside my paths: `apps/web/src/server/key-sessions/instance-id/tests/resolve.test.ts`
  imports `discovery/build-discovery-document` directly instead of through its barrel. Advisory: `runtime.ts` is
  593 lines (the limit is 800).

### Not verified

- No live provider call. The free check's real endpoints are exercised only through stubbed `fetch`.
- No live browser, extension or `next build`.
- The push after an IAM decision change or an identity directory change is unit-tested with fakes, not through the
  real `subscribeDecisionChanges` in a runtime test.
- A held-key or unlock change for a person (`pairedUnlockOf`, which affects `key_unavailable`) fires none of the
  four sources. Secret Keys has no signal for it in reach: `credentialUnlocks` exposes none, and those files belong
  to key-writes. So that state reaches a client only at its next change or snapshot read. No timer was added.

### Open questions

- The free check runs only when `modelProvidersEnabled`. If an instance with providers off should still check
  saved keys, pass the check unconditionally.
- Removing a key leaves its ledger entry (keyed by id). It is a few bytes per removed key and is never read again,
  because the state reads only current keys. Pruning would belong in the ledger, under `runtime/models/`, which is
  not my path.
