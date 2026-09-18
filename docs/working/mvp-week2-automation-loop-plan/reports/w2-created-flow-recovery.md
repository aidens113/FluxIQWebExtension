# w2-created-flow-recovery: does FluxIQ repair a Flow it just created?

Worker report. Worktree pair `F:\fxwork\t016\!FluxIQ` and
`F:\fxwork\t016\!FluxIQWebExtension`, both on `task/t016-created-flow-recovery`.
Nothing committed. Update 2 comes first. Update 1, the investigation and the
refused-trace change, follows below with its superseded points marked.

# Update 3: merge with dev (t012 verification grant, t022 run id)

Resolved by editing only (not committed): `creation/lane.ts`, `live-llm/live-llm-run.ts`
and `run-scenario.ts`, plus my own test `creation/tests/lane.test.ts`.
- **Verification grant removed.** The repair grant replaces dev's verification
  grant: `verificationAuthorizer`, `authorizeVerification`, the
  `authorizeVerification:` line in run-scenario, and the `grantOverride` line
  inside `authorize` are gone. `diagnose_and_adapt` covers `loop_verification`.
- **Timeout workaround removed.** The 300-second wait (`GRANTED_RUN_TIMEOUT_MS`)
  is deleted, and the lane passes `bounds` unchanged; t022's run-id-first fix
  replaces it.
- **Dev's extraction check kept.** `writeFlowExtractionMismatches` stays in
  the created lane's `flowRunHooks`, beside `authorizeRun` and `settleRun`.
- **The build's grant stays.** `authorize` never sets `this.grant`: only the
  build and Flow-lane authorizers do, and the repair grant goes to
  `repairGrant`. The live snapshot still reports `purpose: build_and_adapt`.
- **One lane doc comment.** It now describes one grant that repairs and judges.
- **My lane tests follow t022.** A granted run is now `run-runtime-session`
  under an id the runner names first, so it is settled from that id, even when
  the run throws.
- **Left in place.** The rest of the override path, `grantOverride` in
  `live-llm/authorize-flow.ts:38,58` and `override` in `execution-grant.ts:51`,
  is dev's code with its own tests and is now unused. I did not change it.

**Checks.** The test-runner type-check is clean (`tsc -p tsconfig.json
--noEmit`). The runner suite passes 1216 of 1221. All five failures are in dev
tests this merge did not touch, and they fail on dev too:
- `flow-lane/tests/live-repair-lane.test.ts` tests 388 to 391: their fake Core
  has no `run-runtime-session`, which t022's granted path now calls. dev changed
  `persisted-flow-run.ts` without updating this test.
- `run-expectations/tests/extraction-measurements.test.ts` test 711: dev's
  contracts refuse its schema version ("legacy evaluations must be parsed and
  normalized before use").

A machine-slot test failed once and passed alone, 16 of 16.

**Live run `run-mu7hke99-a1addea5`** (drift after creation, F:16):
- The Flow failed on a retryable `web.target.not_found`.
- Recovery was attempted, and a `temporary_target_override` was proposed:
  `proposalOnly: true`, `executed: false`, preflight ok.
- Core's store holds the proposal as **`pending`** and the adaptation as **`draft`**, never applied.
- The repair cost **$0.00617892** over 3 calls; the run total was $0.00879736.

**Not shown: a result verdict.** Core recorded none for this run, and cannot for
any failed run. `runtime/result-verification/run-outcome.ts:114` returns early
with `if (input.session.status !== "succeeded") return input.session;`, which
is the same under dev's `verify_result` grant. The repair grant does make the
verifier's provider reachable: `service.ts` resolves it when the grant's
session task kinds include `loop_verification`, and `diagnose_and_adapt`'s do.
Seeing a recorded verdict needs a created Flow that succeeds, which this task,
built to fail, never produces. I did not run one, because quota is nearly
gone.

# Update 2: a created Flow is now repaired, with the repair held for approval

## Outcome

**Done.** Live run `run-mu7gjreo-057ccafc` shows the whole chain:
- A Flow is created from an instruction on the baseline page.
- The site then changes (the playback meets `renamed-redesign`).
- The Flow fails with a retryable `web.target.not_found`.
- Recovery runs (a diagnosis, then a patch).
- The model proposes the right repair: a target override, proposal-only, never executed, preflight ok.

Core's own store holds the result. The adaptation's status is `draft` and it
was never applied. The change proposal's status is `pending`. The created
Flow's graph still targets the original Save control.

**Cost:** the repair attempt was **$0.0040502** over 2 calls (diagnosis
$0.00212784, patch $0.00192236). The whole run, build included, was $0.00661188.

## Where the requested mode was lost: the exact steps

1. `api/handlers/flows.ts:104` (`update-flow-settings`) merged
   `adaptationMode: manual_approval` over the stored metadata. It did not
   apply the mode to the training and policy settings the mode governs,
   which for a new Flow are the creation defaults (`normal`, `locked`). The
   document then said `manual_approval` and "no LLM" at once.
2. `runtime/service/flows/store.ts:308` built the SQL settings without an
   `interventionMode`, so `storage/project/flow-resource-repository.ts:79`
   worked the mode out again from those stale fields and got
   `no_llm_intervention`. The web settings view reads that row
   (`apps/web/.../flow-settings-model.ts:244`), so it showed "No LLM
   intervention" for a Flow set to manual approval.
3. What switched the model off at playback was neither of those. The runner
   starts every run that has no grant with `adaptiveMode: "deterministic"`
   (`test-runner/src/existing-fluxiq-control.ts:340`). And Core finds no model
   provider at all without an execution grant (`_shared/runtime.ts:80`). Both
   are deliberate, and both are left as they are: a replay with no grant stays
   deterministic. So the created Flow's playback needed a grant of its own.

Live evidence for steps 1 and 2 is the created Flow's `flow_settings` row.
Before the fix (workspaces t016probe and t016proof) it read
`no_llm_intervention` beside a stored DeepSeek key. After the fix (t016repair)
it reads `manual_approval`.

## What changed (Update 2)

Core:
- `store.ts`: passes `interventionMode: automationStudioInterventionMode(metadata)`,
  the mode the document states, read the way the runtime reads it. A new
  Flow still states `no_llm_intervention`, so nothing widens for Flows
  nobody opted in.
- `api/handlers/flows.ts`: a patch that names a valid version-1 mode and
  supplies no training or policy settings of its own gets that mode applied to
  them (`withStatedInterventionMode`). This is the same mapping the web settings view uses.
- `annotation/annotate.ts`: both refusal returns now carry a `code`:
  `llm.gate.training_mode`, `llm.gate.training_budget_exhausted`, or
  `llm.gate.<prior action>`.

Downstream:
- `test-contracts`: `RunHarnessRecovery.refusalCode?: string | null`. The
  validator requires it to be code-shaped and null when recovery was
  attempted; absent means a record written before the field existed. The
  `evaluation.ts` doc is updated.
- `flow-lane/harness-recovery.ts`: reads `llmGate.code` when the gate did not invoke the model.
- `existing-fluxiq-control.ts`: Core's `no_repair` receipt now reads as a
  decline, `kind: "no_repair"`, with issue code `runtime_patch.declined.<reason>`.
  It no longer reads as `runtime_patch.preflight_rejected`. Only the recovery
  parsing changed; the `deterministic` default at line 340 is untouched.
- `live-llm/live-llm-run.ts`: adds `repairAuthorizer`, a `diagnose_and_adapt`
  grant with the build's caps, and `settleRepair`. The repair's spend sits
  beside the build in `snapshots/live-llm.json`, is held to its caps, and an
  unreadable run is recorded rather than raised. `usage.calls` counts both.
- `creation/lane.ts`: adds `authorizeRun` and `settleRun`. The repair is
  settled on a throw too, and an overspend outranks the lane's own failure. A
  granted run waits up to 300 seconds. `prepareFlowPage` is told whether it is
  preparing the build or the playback.
- `run-scenario.ts`: wires the above. A task marked `variantArmedAfterBuild`
  has its build explore the unarmed page.
- `creation/instruction-task.ts` and `apps/scenario-lab/.../live-instructions.ts`:
  the `variantArmedAfterBuild` field, plus one new task,
  `identity-drift-rename-redesigned-after-creation`.
- `scripts/lab/live-campaign/row/reported-spend.mjs` and
  `summarize-task.mjs:25`: a row adds the repair's tokens, dollars and calls
  to the build's, and reads `build+repair` only when the repair called a
  provider.

**Departure from the brief:** the repair grant is `diagnose_and_adapt`, not
`explore_and_adapt`. Under `explore_and_adapt` the model proposed the right
override, but Core tries a repair live, and pressing Save is an external side
effect that a granted run can never authorize. Preflight refused it
(`runtime_patch.side_effect_not_authorized`, run-mu7gfuph-a57c6b18) and nothing
was proposed. `diagnose_and_adapt` holds a target override as a proposal and
never executes it (`recovery/annotation/patches.ts:142`), which is exactly
"propose freely, apply only with approval".

## Live runs (Update 2), each on DeepSeek, FLUXIQ_TEST_RUNS_DIR=F:\r16

| Run | Task | What happened | Cost |
| --- | --- | --- | --- |
| run-mu7f2dqb-a1220b2a | support-desk-triage-backlog | Granted run timed out at the client's 30-second limit. Repair spend was not recorded (`run_not_identified`). | build $0.01101 |
| run-mu7fas8b-66a630b1 | support-desk-triage-backlog | Retryable `web.target.not_found`; full recovery (diagnosis, exploration, patch). The model declined, `control_gone`, and was right: the Flow skipped the Reassign step. | $0.04121 (repair $0.01418 over 6 calls) |
| run-mu7fkwsd-3bc8711e | property-listings-last-page | Actions succeeded, then result verification failed (`ambiguous_or_unknown`). Diagnosis only. | $0.02094 |
| run-mu7froux-59d906e8 | property-listings-last-page | Build stopped (`flow_bootstrap.evidence_repeat_without_progress`). | $0.01922 |
| run-mu7fw0wo-02a2829a | company-directory-last-page | Same as run-mu7fkwsd. | $0.01935 |
| run-mu7g0tiq-565f1925 | property-listings-last-page | Build stopped (`flow_bootstrap.evidence_unusable_decision`). | $0.02289 |
| run-mu7g989o-a40ef608 | property-listings-last-page | Ended without a failed action to repair. | $0.01653 |
| run-mu7gfuph-a57c6b18 | drift after creation | Right override proposed under explore_and_adapt, refused `side_effect_not_authorized`. | $0.00885 |
| **run-mu7gjreo-057ccafc** | **drift after creation** | **Proof: override proposed and pending, not applied.** | **$0.00661 (repair $0.00405)** |

Total for Update 2: about $0.167, plus the first run's unrecorded repair.

## Checks (Update 2)

- `npx tsc --noEmit` (packages/fluxiq): exit 0, after fixing a type error it
  caught in my own new test.
- Narrow Core tests (`api/handlers/tests/flows.test.ts`, `annotate.test.ts`): 24 of 24 pass.
- **Mutation checks, both reverted:**
  - Dropping `interventionMode` in `store.ts` fails exactly "stores the mode a saved document states…".
  - Dropping the handler's mode rewrite fails exactly "stores, applies and shows manual_approval…".
- Full Core suite (`--minWorkers=1 --maxWorkers=4`): 10 failed and 2584 passed.
  Every failure was `EBUSY`/`EPERM` or a timeout, with no assertion
  differences. Rerun alone, 5 of the 6 files pass. `instruction-readiness`
  times out in 15 seconds even alone, and it times out the same way on the
  unchanged main-checkout Core (`F:\!FluxIQ` at dc9b5b5), so it is this
  machine's load, not this change.
- `pnpm --filter @fluxiq-web-extension/test-runner test`: 1149 of 1149 pass.
  That includes the new lane, repair-grant, refusal-code, declined-repair and
  task-parser tests, and `run-flow-lane.test.ts`, whose expected records now
  carry `refusalCode: null`.
- `pnpm --filter @fluxiq-web-extension/test-contracts test`: 115 of 115.
- `pnpm lab:test`: 70 pass, 0 fail.
- Structure audits pass in both repositories.
- Both repair-phase evaluations validate against the updated contract.

## Where the real fix for the 30-second timeout belongs (not built)

A granted run answers only when its recovery has finished, and Core names no
run until it answers. The 300-second wait is a workaround.
- **Core, `api/handlers/runtime-execution.ts:39`:** awaits
  `service.runRuntimeSession(...)` inside the request.
- **Core, `runtime/service.ts:3063`:** `runRuntimeSession` creates the session
  at the start but returns it only at the end.
- **Core, `runtime/llm/runtime-session-grant.ts:68`:** refuses a granted run on
  a pre-started `runId` (`flags.runId !== undefined`). That is what forbids
  the start-then-run pattern the grant-less path uses.
- **The fix:** return the session id at once and run in the background, or
  let a grant bind to a session Core itself started.
- **Runner, `persisted-flow-run.ts`:** then `:230`, which skips
  `startPersistedFlow` when a grant is present, and `:237`, the single
  blocking `runPersistedFlow`, become start, read the id, then poll
  `awaitTerminalRunDetail`.

## Other findings (Update 2)

1. **Under `explore_and_adapt`, a repair the grant may not execute is dropped
   rather than proposed** (`recovery/annotation/patches.ts:142`: only
   `explicitProposalGrant` proposes without executing). It is not changed
   here, because using `diagnose_and_adapt` avoids it.
2. **A created Flow that skipped a step can only be declined.** For
   `target_not_found` the plan offers only a target override. That is being
   closed by t020, per the coordinator.
3. **Only one live run shows a proposal.** It is a single observation on a
   machine with known noise. The eight runs before it failed for reasons
   recorded above, none of which contradicts it.

## Not verified (Update 2)

- Approving and applying the pending proposal, then replaying the repaired Flow.
- A live `refusalCode` other than null. Unit tests cover the codes; no live
  run in this phase hit a gate refusal with a code.
- A live `no_repair` read under the new parser. That decline happened in
  run-mu7fas8b, before the parser change; unit tests cover the new reading.
- The web UI's settings view after the mode fix. It reads the corrected row;
  the UI itself was not opened.

---

# Update 1 (earlier; superseded where marked)


## Outcome (Update 1; superseded: created Flows are now repaired, see Update 2)

**Partial, by design of the brief's own "or".** No. A Flow that FluxIQ creates
from an instruction is never repaired, and until this change the run gave no
reason in the four-stage recovery record. I removed the silence in Core and proved it live.
I did **not** make created Flows repairable. That needs a separate fix: Core silently drops a
requested setting. I found and evidenced it but left it alone, because
fixing it changes what every created-Flow run spends (see Open questions).

## The condition that decides it

**`packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/annotate.ts:91`**
(line 96 after this change):

```ts
if (!input.context.behavior.invokeLlm || (!explicitGrantBudget && !input.context.budgetDecision.ok)) {
```

For a created Flow `behavior.invokeLlm` is `false`, so recovery stops here,
before the failure is even classified, before a provider is resolved, and
before anything could look at `retryable`. The failure type does not matter.
Nothing in the recovery gate reads `retryable` at all.

Proven live, not inferred. The run detail Core persisted for the created
Flow's playback records `llmGate.reason` as this branch's exact sentence,
"Current training mode or settings do not allow LLM intervention.". The other
early returns write different sentences. Line 83 (no adaptation context) writes
nothing, and line 111 (deterministic-first) writes the diagnosis's own reason
with a full plan trace.

Why `attempted: false` proves an early return. Once recovery gets past these
gates, Core always records an intervention. `runAutomationStudioLlmHarness`
returns a required `intervention` even when no provider is configured
(`llm/harness/run.ts:115`, diagnostic `llm.provider_missing`), and `annotate.ts`
always appends it. The runner derives `attempted` only from interventions,
patch attempts, adaptations and proposals (`test-runner/src/flow-lane/harness-recovery.ts:48,63`).
So `interventions: []` is only possible if an early return fired.

### Why `invokeLlm` is false: two layers

1. **Core's default for a new Flow is "no LLM".** `model/flows.ts:225,228,265`
   sets `mode: "normal"`, `allowLlmIntervention: false`,
   `adaptationMode: "no_llm_intervention"`. `training-modes.ts:171-173` maps
   `normal` to `invokeLlm: false`. **This is deliberate and fails closed:**
   Core does not spend a provider call on a Flow nobody opted in.
2. **The Lab asks for `manual_approval` and Core drops it.** The runner pins
   `adaptationMode: "manual_approval"` on the created Flow, along with the
   DeepSeek key and limits, in one `update-flow-settings` call
   (`test-runner/src/live-llm/flow-settings.ts:34`). Core stores the key and
   the limits but not the mode. `runtime/service/flows/store.ts:308` builds the
   `settings` it persists without any `interventionMode`, so
   `storage/project/flow-resource-repository.ts:79` derives the mode from the
   still-default training and adaptation blobs, which gives `no_llm_intervention`.
   Live evidence from two independent runs: the created Flow's
   `flow_settings` row reads `intervention_mode = no_llm_intervention`,
   `training.mode = normal`, `allowLlmIntervention = false`, `preset = locked`,
   while `llm_json` holds `provider = deepseek` with a `secretKeyId`. Those
   values came from the same call that asked for `manual_approval`.

On top of that, the created-Flow lane plays the Flow back with **no
execution grant**, and it does so deliberately. `live-llm-run.ts:154` refuses to
turn a `build_and_adapt` grant into a run grant, and `creation/lane.ts:86`
says "The run is deterministic". `lane.ts:116` calls `executeRecordedFlowRun`
without `llmExecution`. A grant is the thing that overrides training mode
(`llm/runtime-session-grant.ts:98`, "whatever the training mode would have
decided"). With no grant, the Flow's own settings decide.

## Design or oversight

- **The refusal is a design boundary, and a correct one.** A Flow with LLM
  intervention off, played back with no grant, is not repaired. That is
  deliberate and fails closed.
- **The silence was an oversight.** `annotate.ts`'s own header says "Every
  early return carries a `recoveryTrace` ... so 'nothing happened' is always a
  stage saying so rather than an absent record." Line 111 kept that promise,
  but line 91 wrote only an `llmGate`. No test covered line 91: the test helper
  set `invokeLlm: true` for every test (`annotation/tests/annotate.test.ts`,
  `behavior()`).
- **Dropping `manual_approval` is also an oversight.** Core silently discards
  an explicit setting that was saved through PIN-gated authoring. It is not
  fixed here. See Open questions.

## Live reproduction (before the change)

Command, from the downstream worktree with the brief's env prefix:
`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=t016 pnpm lab:campaign support-desk-triage-backlog`

Run `run-mu7d3jrt-635f3620` reproduced the observation exactly:
- `evaluation.json`: `verdict: failed`, `flowCreated: true`,
  `automationFailureReported: {category: target_not_found, code: web.target.not_found}`,
  `harnessRecovery: {attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: []}`.
- `snapshots/flow-lane.json`: `lane: created-flow`, failure `retryable: true`,
  `stage: target_resolution`. The build spent 6 calls, about $0.027.

The isolated target deletes Core's data after a run, so I could not read that
run's gate. A second run on `persistent-isolated` (workspace `t016probe`)
kept Core's store. The Flow build finished, then that run timed out on an HTTP
call before playback, but its persisted `flow_settings` row already showed
the dropped mode.

## What changed

Core only. Two source files and one test file. Nothing downstream.

- `runtime/recovery/stages.ts`: new
  `automationStudioRuntimeRecoveryRefusedTrace(reason)`. It returns a
  four-stage trace (diagnosis, recovery_plan, exploration, resolution). Every
  stage is `refused`, `trace.ts`'s own word for "something declined to let
  it". `providerCalled` is `false` throughout, each stage carries Core's
  reason, and no stage claims a loop stage it did not drive. It is built through
  `buildAutomationStudioRecoveryTrace`, so ordering and prerequisites still
  apply. It is exported through the existing `recovery/index.ts` barrel
  (`export *`).
- `runtime/recovery/annotation/annotate.ts`: the line-91 return now writes
  `recoveryTrace` beside the unchanged `llmGate`. Both the training-mode and
  the budget-exhausted halves of that branch get it. Nothing new leaves the
  evidence boundary: the trace holds only the same Core-authored sentence the
  `llmGate` already carried.
- `runtime/recovery/annotation/tests/annotate.test.ts`: two tests in
  "a recovery the Flow's settings refuse". One runs a retryable
  `web.target.not_found` failure with `invokeLlm: false`. It asserts that no
  provider task was requested, that no intervention was recorded, the exact
  `llmGate`, and the full refused trace. The other covers the spent-budget
  case.

Behaviour is unchanged apart from the added trace. The gate refuses the same
runs as before and spends nothing.

## Live proof (after the change)

Core rebuilt, then the same task run on `persistent-isolated` (workspace
`t016proof`), run `run-mu7dp2r3-a8f5abbc`, Core run
`43af412c-4e8b-4f90-a9fc-92c64143948e`, status `failed`. Read from Core's own
persisted runtime stream:

```
llmGate:       { invoked: false, reason: "Current training mode or settings do not allow LLM intervention." }
recoveryTrace: stages diagnosis / recovery_plan / exploration / resolution,
               each { status: "refused", providerCalled: false,
                      reason: "Current training mode or settings do not allow LLM intervention." }
               refused: []
```

**One caveat, stated plainly.** Live model output varies between runs. This time
the build produced a Flow that failed with `web.intervention.required`
(`user_intervention_required`, `retryable: false`), not the retryable
`web.target.not_found`. The gate fires before classification, so the path
is the same. The retryable case specifically is pinned by the new
deterministic test rather than by a second live run. The first live run is
the retryable reproduction.

The Lab's `evaluation.json` still reads `harnessRecovery.attempted: false`
after the change, with no reason. That is expected: the runner never reads
`recoveryTrace` (see Open questions).

## Commands run and observed results

- `pnpm --filter fluxiq build` (Core worktree), before and after the change,
  exited 0 both times.
- Live runs: `run-mu7d3jrt-635f3620` (isolated, before the change),
  `run-mu7de9wf-ac7efb43` (persistent `t016probe`, before the change, timed
  out before playback), `run-mu7dp2r3-a8f5abbc` (persistent `t016proof`,
  after the change). Results are above.
- `node scripts/structure-audit.mjs` (Core root): "structure-audit: passed
  (164 warning(s), 361 baselined)". None of the warnings are in the changed
  files. `annotate.ts` was already past the 400-line advisory; it goes from 430
  to 436 lines against an 800-line limit.
- `npx vitest run` on `recovery/tests/stages.test.ts`, `recovery/tests/trace.test.ts` and
  `recovery/annotation/tests/annotate.test.ts` (in `packages/fluxiq`), before
  the new tests: 3 files, 42 passed.
- Same annotate file with the new tests: 20 passed.
- **Mutation check.** I restored `annotate.ts` to HEAD and reran it: 2 failed
  (exactly the two new tests), 18 passed. With the fix restored, all 20 pass. The
  tests guard the change.
- `npx tsc --noEmit` (in `packages/fluxiq`): exit 0, no output.
- Full Core suite in `packages/fluxiq`, final:
  `npx vitest run --minWorkers=1 --maxWorkers=4` gave **297 files passed; 2591
  passed, 1 skipped (2592); exit 0** (252 s).
  Two earlier full runs are hardware/load, per this machine's faulty-RAM rule. The
  failing set was different on each run, none of the failures were in a file this
  change touches, and every one passed when rerun alone:
  - Run 1 (default workers): 4 failed, 2587 passed. Named failures:
    `service-flows/tests/scale-pages.test.ts` (a timing budget, 3537 ms against
    500 ms) and `runtime/tests/deepseek-bootstrap-exploration.test.ts`. The
    other two names were lost to `tail`.
  - Run 2 (default workers): crashed. A tinypool worker-init `TypeError`
    (`workerData[0].workerId` undefined) followed a `RangeError: Maximum call
    stack size exceeded` in Node's promise-rejection handler. Before the crash,
    `storage/project/tests/flow-resource-repository.test.ts` (4 failed) and
    `run-dataset-store.test.ts` (2 failed) showed SQLite stalls of about 15 s.
  - Those four files rerun alone: 4 files passed, 38 tests passed.
  - A `--maxWorkers=4` attempt without `--minWorkers` refused to start
    (`options.minThreads and options.maxThreads must not conflict`). That was a
    flag error, not a test result.

## Not verified

- **Where exactly, in memory, the requested mode is lost.** It is proven
  missing from both persisted places: the SQL settings row, and the artifact
  source, whose metadata holds only representation fields. It is also proven
  absent at playback, because the live gate fired. The SQL write path is
  confirmed defective at `store.ts:308`. I did not trace whether the
  in-process artifact loses it on the settings save, on
  `applyCreatedFlowProposal`, or on a reload from disk.
- A live run of the *retryable* failure after the change. See the caveat
  above; covered by a deterministic test instead.
- The web UI's rendering of an all-`refused` trace. I did not open the panel.
- Downstream checks: none run. Nothing downstream was changed.

## Open questions or contradictions found

1. **The brief's framing was right about the outcome and partly wrong about the
   cause.** "Runs without a provider" is true but is not what disables
   recovery. The provider is never even resolved. What decides it is the Flow's
   settings (`invokeLlm: false`) combined with no grant.
2. **(Fixed in Update 2.)** **Core drops an explicit `adaptationMode` (the real hole behind "never
   repaired").** Recommended fix: have `store.ts:308` pass
   `interventionMode` from `metadata.adaptationMode` when
   `metadata.adaptationModeVersion === 1`, and rewrite the training and
   adaptation blobs to match (`withAutomationStudioInterventionMode`). A Flow
   that never set a mode keeps today's derivation, so defaults do not widen.
   I did not do this, because it changes spend. The Lab asks for
   `manual_approval` on every created Flow, so after the fix every created-Flow
   playback that fails would call DeepSeek for a diagnosis and record a manual
   proposal. That is a corpus-wide cost change, and a sibling worker is
   mid-campaign. The supervisor should decide on it and sequence it.
3. **(Fixed in Update 2: `harnessRecovery.refusalCode`.)** **The Lab cannot see the refusal.** `harnessRecovery` (in
   `packages/test-contracts`, read by `packages/test-runner/src/flow-lane/harness-recovery.ts`)
   has no field for "recovery was refused, and why". It reads only
   interventions, patch attempts, adaptations and proposals. So a refused
   recovery and a recovery that ran and changed nothing both still come out as
   `attempted: false`. Closing that belongs to the unit that owns those two
   packages. The cheapest form is to carry the trace's stage statuses, or the
   `llmGate.reason`, through. Both are content-free.
4. **(Addressed in Update 2: the lane plays back under a repair grant, and a new task drifts the site after creation.)** **The created-Flow lane never tests repair after creation, by design**
   (`creation/lane.ts:86`: "a later lane repairs it under its own grant"). If
   the product promise is "created & repaired", the corpus has no task where a
   created Flow is repaired. That also belongs to the test-runner owner.
