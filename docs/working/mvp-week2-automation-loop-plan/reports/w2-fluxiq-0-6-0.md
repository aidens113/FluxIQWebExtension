# Report: w2-fluxiq-0-6-0

Repository changed: FluxIQ Core, `F:\!FluxIQ`. `AS/` = `packages/fluxiq/src/programs/automation-studio/`.
Nothing was committed or pushed. No source file, other document, `.structure-baseline.json` or generated doc was touched, and `pnpm docs:reference` was not run. In this repository, only this report file was written.

## Outcome

**Done.**

- `fluxiq` is now `0.6.0`.
- The version sentence in `docs/architecture/package-boundaries.md` says `0.6.0`.
- A `### 0.6.0: ...` entry now opens "Migration Notes", in the 0.5.0 entry's style:
  - it opens with who needs to read it;
  - it has one bolded section per break a host would observe, each saying what changed and what a host must do;
  - it has a closing "Smaller changes" list and a short contributor note.
- The entry states once, at the top, that nothing is forward-only (no stored shape changes). The one caveat about old adaptation records is under "Old records".

Package bumps:

- `@fluxiq/contracts`: not bumped. `packages/contracts/src` is byte-identical to 0.5.0, both committed and in the working tree (`git diff --quiet 0e5c447 -- packages/contracts/src` succeeded).
- `@fluxiq/client-gateway-websocket`: not bumped. It has no committed or uncommitted change.

Checks:

- `node scripts/structure-audit.mjs --rule docs-links` passes.
- Core `pnpm check` exited 0 on its second run. The first run died with a Windows access violation; see the commands section below.

**The other worker's per-provider-call receipt is in the tree and is included in the note.** It is still uncommitted:

- `AS/runtime/llm/run-call-record.ts` (untracked);
- the ledger's `callRecords()` (`AS/runtime/llm/run-budget.ts:266`);
- `metadata.llmGate.providerCalls` and `providerCallsOmitted` (`AS/runtime/recovery/annotation/annotate.ts:331-345`).

I cannot tell whether that worker has finished. If it adds more host-visible fields, the note's "What the run records" bullet needs them.

## How the breaks were established

The breaks come from the code, not from commit messages.

1. **Type-level comparison.**
   - I extracted the 0.5.0 sources with `git archive 0e5c447 … | tar -x` into my scratchpad.
   - For each tree (0.5.0 and the current working tree), a TypeScript compiler-API script listed every export of all 29 `package.json` subpaths, with a signature string. Private class members were filtered out.
   - A second script diffed the two lists.
   - Result: **0 exports removed, 182 names added** (on each of `.`, `./automation-studio` and `./programs`), and 64 names changed.
   - Of the 64 changes, about 30 are real. The rest are noise:
     - union members printed in a different order;
     - `zod` types that did not resolve in the extracted 0.5.0 tree (1 semantic error there). The contracts sources are identical.
2. **Endpoint PIN comparison.** An AST script over every `registry.register({...})` call compared, per endpoint, whether the 0.5.0 handler called a PIN check with today's `classification`. Counts:

   | 0.5.0 handler | Today | Endpoints |
   | --- | --- | --- |
   | PIN check | `authoring` | 45 |
   | PIN check | `destructive` | 12 |
   | no PIN check | `destructive` | 1 (`deleteRunDatasets`) |
   | no PIN check | `program-gated` | 19 |
   | no PIN check | `destructive-ungated` | 3 |
   | no PIN check | `read` | 94 |
   | no PIN check | `authoring` | 46 |

   There are 220 endpoints both before and after. The 57 PIN checks at 0.5.0 match the commit's census.

3. **Behaviour.** I read `git diff 0e5c447 -- packages/fluxiq/src` for the committed part and `git diff HEAD` for the uncommitted part, file by file, and compared them with the 0.5.0 sources.

## Every break in the note, with proof

Notation: `0e5c447:` means the 0.5.0 source. Every other path is the current working tree, relative to `packages/fluxiq/src/` unless it starts with `docs/` or `scripts/`.

### Endpoint classification

- **`register` requires `classification`.**
  - Now: `programs/_shared/api.ts:92`. `endpoints()` reports it (`:71` is the stored registration).
  - Was: `0e5c447:programs/_shared/api.ts:39`, with no classification.
- **The PIN check moved to `call()`, for `destructive` only.** `programs/_shared/api.ts:134`.
- **The registry takes Identity Access from its constructor.** `programs/_shared/api.ts:84`.
- **`registerAutomationStudioApi` ignores its `identityAccess` argument.** `AS/api/handlers/dependencies.ts:16-21` and `AS/api/handlers/register.ts:28`.
- **The helper throws when Identity Access is absent.** `programs/_shared/authorization.ts` (`authorizeProgramPin`) throws "PIN authorization service is not available.".
- **The 45 endpoints that lost the PIN**, all now `authoring`. Examples:
  - `AS/api/handlers/flows.ts:50,70,81,115`;
  - `AS/api/handlers/router.ts:171` (`deleteFlowMapRoute`);
  - `AS/api/handlers/runs.ts:131` (`reviewFlowAdaptation`, `classification: "authoring"` at `:135`);
  - `AS/api/handlers/client-gateway.ts:43` (`revokeClientTrust`).

  The full list is the script output in the commands section.
- **The 12 that kept the PIN**, now `destructive`:
  - nine deletes: `deleteFlow`, `deleteFlowMapRouteGroup`, `deleteFlowSubflow`, `deleteProject`, `deleteProjectArtifact`, `deleteProjectCategory`, `deleteProposal`, `deleteRecording`, `deleteRecordings`;
  - `executeClientAction` (`AS/api/handlers/client-gateway.ts:93`);
  - `sealLegacyWrites` (`flow-lifecycle.ts:114`);
  - `rollbackFlowMigration` (`flow-lifecycle.ts:117`).
- **`delete-run-datasets` newly asks for a PIN.** `AS/api/handlers/datasets.ts:85`. The wire name is at `AS/api/contracts/endpoints.ts:151`.
- **The three `destructive-ungated` endpoints**:
  - `database-manager/api/handlers.ts:106`;
  - `deployment-sync/api/handlers.ts:51,62`.

  They are listed in `docs/architecture/automation-studio/persistence.md:619-623`.

### Identity Access recheck

- **Recheck calls.** `programs/identity-access/api/handlers.ts` lines 81 (`create-user`), 152 (`begin-totp`), 168 (`confirm-totp`), 196 (`create-session`) and 224 (`unlock-vault`). Lines 99-100 are `update-user`, gated by `changesAuthority` (`roleId` or `enabled`); 0.5.0 gated only on `roleId`.
- **Refusal shape.** `{ ok:false, requiresRecheck:true, error }` is built in the `recheckCredentials` helper at the top of that file.
- **TOTP.** It is required only when the account has a TOTP secret: `identity-access/runtime/service.ts:638-639`.

### Evidence binding

- **Required fields.** `domainId` is at `AS/runtime/llm/harness-options/binding.ts:32` and `deniedEvidenceKeys` at `:52`. The `llmEvidenceRuntime` option type changed at `AS/runtime/service.ts` (diff hunk; it was an inline type with neither field).
- **`domainId` pattern.** It is checked at registration: `AS/runtime/llm/harness-options/registry.ts:35` (pattern) and `:85-86` (check).
- **Key denial.**
  - 0.5.0 denied the seven names at `0e5c447:AS/runtime/llm/harness/failure-evidence.ts:28`. Now the list comes from the caller, defaulting to `[]`, at `AS/runtime/llm/harness/failure-evidence.ts:48`.
  - Reusable context: 0.5.0 denied `selector|selectors` at `0e5c447:AS/runtime/llm/harness/context-packet.ts:134`. Now only the target family is denied, at `context-packet.ts:199`.
- **Packet refusal.** `AS/runtime/llm/harness/context-packet.ts:150-156` (throw at `:153`).
- **Forwarding.**
  - Flow Bootstrap: `automationStudioHarnessInputWithDeniedEvidenceKeys` (`binding.ts:111-117`), used at `AS/runtime/service.ts:1801`.
  - Recovery: `annotate.ts:231,298`.
- **Tool scoping.**
  - Scope rule: `registry.ts:225-229` (`scopeAllows`).
  - Tools pass through the registry for bootstrap (`service.ts:1910`) and for exploration (`AS/runtime/recovery/annotation/exploration.ts:112`).

### Opaque repair target

- **The type.** `AS/runtime/llm/harness/structured-response.ts:95`. At 0.5.0 it was `{ selector: string }` (`0e5c447:…/structured-response.ts:15`).
- **Model output accepts handles only.** `AS/runtime/llm/harness/provider-result.ts:176`.
- **The live-patch input callback takes the new type.** `AS/runtime/live-patch.ts` (the `validateTargetOverrideEvidence` field).

### Grant call counts

- **Backstop.** `AS/runtime/llm/execution-grants.ts:31` is now 64 (`0e5c447:…:19` was 8).
- **Default.** 26 at `:50`, applied at `:195`. At 0.5.0 the defaults were 1/2/4 (`0e5c447:…:105`), and `diagnose_and_adapt` had to be exactly 2 (`0e5c447:…:108`, now gone). `diagnosis_only` is still one (`:196`).
- **`maxUses`.** It must match the call count (`:262`). This line is unchanged, but the default count moved.
- **Default cost purse.** `Math.min(2, 0.25 × calls)`. The line is unchanged; the call count is what moved.
- **Task kinds per purpose.** `GRANT_CAPABILITIES` at `:706`, with `diagnose_and_adapt` at `:710`. `loop_plan` is added at `AS/runtime/llm/harness/task-kind.ts:23`.

### Run token budget

- **Default and range.** `execution-grants.ts:204-212` (default at `:208`).
- **Confirmation rule.** Now `:258`; it was `0e5c447:…:154`, which multiplied tokens by calls.
- **Grant-side enforcement.** `:524-529` (throw at `:528`), charged by `reportedTotalTokens`.
- **Contract.** `AS/api/contracts/llm.ts:45`.
- **Handler forwarding.** `AS/api/handlers/llm-generation.ts`.
- **Resolver field.** The `service.ts` diff (`AutomationStudioLlmProviderResolution.maxTotalTokensPerRun?`).

### `explore_and_adapt`

- **The purpose.** `execution-grants.ts:93`, and `AS/runtime/llm/runtime-session-grant.ts:37`.
- **API reachability.** `AS/api/handlers/runtime-execution.ts:32`. At 0.5.0 only two intents were accepted (`0e5c447:…/runtime-execution.ts:26`).
- **Context shaping.** `runtime-session-grant.ts` `automationStudioRuntimeAdaptationContextForGrant` (policy `proposalMode: "manual"`, no target-override exemption).
- **Patches are proposal-only only for `diagnose_and_adapt`.** `AS/runtime/recovery/annotation/annotate.ts:321` sets the proposal-only flag for that purpose alone, and `annotation/patches.ts:98-101` either proposes or executes accordingly.
- **Step cap.** 50, at `live-patch.ts:208`.
- **Side-effect preflight.** `live-patch.ts:89-90`.

### Claim window and lease

- **Lease constant.** `execution-grants.ts:71`.
- **The claim starts the lease.** `:483`.
- **Expiry check.** `expired()` at `:495`. At 0.5.0 a claimed grant was refused at `expiresAtMs` (`0e5c447:…:375`).
- **Authorization exchange.** `ensureLiveAuthorization` at `:554`.

### Recovery budget

- **Calls.** Now `AS/runtime/recovery/annotation/run-budget.ts:94`. At 0.5.0: `0e5c447:AS/runtime/service.ts:2933-2940`.
- **Tokens.** Now `run-budget.ts:103-112`. At 0.5.0: `0e5c447:…/service.ts:2990-2995` (12,000 default at `:2994`). Default Flow settings carry 12,000 at `AS/model/flows.ts:241`.
- **Cost.** `run-budget.ts:114-125`.
- **Backstop.** `AS/runtime/llm/run-budget.ts:43`. `maxCallsPerRun?` is at `:59`; 0.5.0 required it (`0e5c447:…:4`).
- **Lease `release()`.** `run-budget.ts:100`. At 0.5.0 the lease had only `complete(usage?)` (`0e5c447:…:25`).
- **Recovery deadline.**
  - `AS/runtime/recovery/recovery-deadline.ts:37` (600,000), started once at `annotate.ts:108`.
  - At 0.5.0 there was no `runtime/recovery/` directory at all, so the deadline is new relative to the release. The 120 s value only ever existed in unreleased commits (`6e3ff1e` to `0e0e2d6`).
  - It is fixed because `annotate.ts:108` passes no `maxDurationMs`.
- **No-progress limit.** 3, at `AS/runtime/recovery/progress-guard.ts:57`.

### Failed-run flow

- **Invocation gate.** `annotate.ts:109-111`, with its logic in `AS/runtime/recovery/llm-invocation.ts:63-104`.
- **Patch decision.**
  - Now: `AS/runtime/recovery/diagnosis-chain.ts:13-20` and `AS/runtime/recovery/plan.ts:148-165`.
  - At 0.5.0 a patch was requested whenever a provider existed (`0e5c447:…/service.ts:3042`).
- **Diagnosis channel.** `AS/runtime/recovery/structured-diagnosis.ts:139-141`. Refusal of misrouted metadata: `:224-229`.
- **Exploration.** `annotate.ts:249-287`. The mutating-tool gate is at `registry.ts:252`. The patch hold-back is in `annotation/patch-reserve.ts`.
- **Run-detail metadata.** `annotate.ts:337-352`.
- **Staged prompt version.** `context-packet.ts:78`.

### Verification and applying

- **`testing` when unverifiable.** `live-patch.ts:278`. At 0.5.0 it was `validated` or `rejected` (`0e5c447:…/live-patch.ts:228`), and a missing comparison meant success (`0e5c447:…:326`).
- **Unapplied patch kinds and a missing target node.** `live-patch.ts:379` and `:402`.
- **`adaptationFromRuntimePatch` signature.** `live-patch.ts:229`.
- **The apply gate.**
  - Now: `AS/storage/project/adaptation-store.ts:164-165`.
  - At 0.5.0 a `validated` status sufficed (`0e5c447:…:161`).
- **`edit_recovery` is refused.**
  - Now: `adaptation-store.ts:398` and `AS/runtime/service/adaptations/durable.ts:105`.
  - At 0.5.0 it was treated as applicable (`0e5c447:…/durable.ts:97`).
- **Old records stay applicable.** 0.5.0's proposal-only path wrote a succeeded validation result: the removed lines in the `live-patch.ts` diff, "Proposal-only structural validation succeeded…".

### Graph rollback

- `AS/storage/project/graph-store.ts:141`, the cascaded records loop, and the `operation_count` update (diff of `fc444e8`).

### Smaller changes

- **Evidence loop ceiling.** 64 at `AS/runtime/loop-limits/evidence-loop.ts:28`; it was 16 at `0e5c447:AS/runtime/llm/evidence-loop.ts:5`.
- **Bootstrap loop limits.** Now `AS/runtime/loop-limits/flow-bootstrap-evidence-loop.ts:47,51`. At 0.5.0 they were in `0e5c447:…/service.ts:1924-1925`.
- **`recentAdaptations`.** `AS/runtime/service.ts:550`.
- **`recordInputPayload`.** `io/index.ts:97` and the `AS/runtime/io-bridge.ts` diff.
- **Structure-audit rule.** `scripts/structure-audit/config.mjs:40-47` (`importBoundaries`), last changed in `0e0e2d6`.

## Commands run and observed results

**Status and history.**

- `git status --short` and `git log --oneline 0e5c447..HEAD` in Core: 25 commits and the uncommitted set listed in the brief.
- `git tag -l` was **blocked by the worker hook**. I did not retry; the brief states there are no tags.

**Contracts.** `git diff --quiet 0e5c447 -- packages/contracts/src` printed "contracts identical to 0.5.0 incl. working tree".

**Export comparison.**

- `node exports.cjs <old> old.json` printed `29 subpaths, 4838 exports, 1 semantic errors`.
- `node exports.cjs F:/!FluxIQ new.json` printed `29 subpaths, 5383 exports, 0 semantic errors`.
- `node compare.cjs` printed `removed 0, added 545, changed names 64`.
- A final rerun on the current tree just before this report gave the same counts, and `182` names on the root subpath.

**Endpoint comparison.** `node endpoints.cjs <old>` printed:

```
oldPin=false now=authoring: 46
oldPin=true now=authoring: 45
oldPin=false now=read: 94
oldPin=true now=destructive: 12
oldPin=false now=destructive: 1
oldPin=false now=program-gated: 19
oldPin=false now=destructive-ungated: 3
old endpoints 220 new endpoints 220
```

**docs-links rule.** `node scripts/structure-audit.mjs --rule docs-links` printed `structure-audit: passed (0 warning(s), 0 baselined).`, `exit=0`.

**docs-links negative control.**

- I backed up the document to my scratchpad and changed the new link to `#declared-gaps-broken`.
- Result: `FAIL [docs-links] docs/architecture/package-boundaries.md:149: the link to automation-studio/persistence.md#declared-gaps-broken is broken …`, `exit=1`.
- I restored the file from the backup. `cmp` printed `restored-identical`.

**Core `pnpm check`, first run.** It exited 139: `Segmentation fault`, then `ELIFECYCLE Command failed with exit code 3221225477`. This happened right after the structure-audit node tests printed `# pass 96`, `# fail 0`. That is the Windows access violation this machine's failing RAM produces, so I reran once, alone.

**Core `pnpm check`, second run.** `exit=0`:

- structure-audit node tests: `# pass 96`, `# fail 0`;
- `structure-audit: passed (140 warning(s), 254 baselined).`;
- `structure-audit: 1 baseline entries can be lowered` (this was already known; `service.ts` belongs to another worker, and I did not run `structure:baseline`);
- `packages/contracts check: Done`, `packages/client-gateway-websocket check: Done`, `packages/fluxiq check: Done`, `apps/web check: Done`.

**Diff stat for my two files.** `git diff --stat -- packages/fluxiq/package.json docs/architecture/package-boundaries.md`:

```
 docs/architecture/package-boundaries.md | 278 +++++++++++++++++++++++++++++++-
 packages/fluxiq/package.json            |   2 +-
 2 files changed, 278 insertions(+), 2 deletions(-)
```

The `package.json` diff is the `version` line only (`0.5.0` to `0.6.0`).

## Not verified

- **No new tests, and no run of the suites.** I did not run `pnpm test`, `pnpm build` or `pnpm package:validate`. The behaviour descriptions come from reading code and diffs.
- **The note's backward-compatibility sentence was not tested.** It says no table, record or file changes shape. I checked that no schema, model or migration code changed, but I did not run 0.5.0 against data written by 0.6.0. The one new storage behaviour is that graph revisions now write a separate operation row for each cascaded edge deletion, and `operation_count` counts them. Whether 0.5.0 rolls such a revision back correctly was not exercised.
- **"Every result still goes to manual review" under `explore_and_adapt`.** I verified only that the policy's `proposalMode` is forced to `"manual"` (`runtime-session-grant.ts`). That manual mode then routes to review comes from the earlier `w2-core-contracts-and-docs` report (`service.ts:2912`, `training-modes.ts:313`); I did not re-read those lines.
- **Dollar figures are arithmetic from the code**, not observed spend: $0.50 and $1.00 at 0.5.0, $2.00 now, and $0.0104 against $0.125.
- **The 45 endpoints came from my AST script.** It detects a PIN check only inside the `register({...})` object literal. Its total of 57 matches the commit's census, but I did not hand-check all 45.
- **The other worker's per-call receipt.** It is described as it stands now. If that worker changes it further, the note may lag.
- **Generated reference.** `docs/reference/framework-reference.md` was not regenerated, as the brief instructed. With 182 new exports it is stale, so `pnpm docs:check` would fail until the supervisor runs `pnpm docs:reference`.

## Open questions or contradictions found

1. **Stale security comment (not my file).** `AS/runtime/llm/runtime-session-grant.ts:112` says "the ordinary PIN-gated review path remains required for application". But `review-flow-adaptation` has been `authoring`, with no PIN, since `cae0a67` (`AS/api/handlers/runs.ts:135`). The comment should say the review path is manual, not PIN-gated. The misleading `runRecovery` comment at `:120`, reported earlier, is still there.
2. **Silent loss of destructive endpoints.** `registerAutomationStudioApi` still accepts `identityAccess` positionally and ignores it (`dependencies.ts:16-21`). A host that relied on passing it there, and builds `new GlobalProgramApiRegistry()` with no options, now has every destructive endpoint refused at call time, with nothing at registration saying so. The note documents this.

   A mechanical fix is out of my scope; it belongs to the supervisor or a code worker. For example: throw at registration when a `destructive` endpoint is registered on a registry with no Identity Access, or drop the parameter.
3. **Intermediate names never reached a release.** `maxExplorationCallsPerRun`, `AUTOMATION_STUDIO_LLM_DEFAULT_MAX_EXPLORATION_CALLS_PER_RUN` and `llm_budget.run_exploration_call_limit` were added and removed between `0e5c447` and now. Measured against 0.5.0 they never existed, so the note does not list them as removed. The same holds for the 120 s recovery deadline: the note presents the deadline as new at 600 s. The brief's framing ("removed exports", "deadline moving to 600 s") describes the working history, not the release difference.
4. **Structure-audit rule.** The `runtime/llm` to `runtime/recovery` value-import rule lives in Core's own `scripts/structure-audit/config.mjs`, not in the mirrored `structure-audit.mjs`. It has no effect on hosts or on this repository, so the note puts it under "For Core contributors".
5. **Web warning mismatch (already reported by `w2-core-contracts-and-docs`).** The web panel's high-token warning still multiplies per-call tokens by calls. The note describes Core's rule. If the web fix has not landed, the panel will prompt where Core does not.
