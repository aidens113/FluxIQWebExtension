# w2x-recovery-permissions

Worker report, 2026-09-21. Task t050: plan step L4, slice C3 ("Item 3" of
`reports/w2x-existing-flow-and-repair-design.md`), plus the supervisor's scope
extension (the Lab defect, the model-facing policy text, and both live proofs).

Worktrees:

- `F:\fxwork\t050\!FluxIQ`, branch `task/t050-recovery-permissions`, HEAD `56d6106`
- `F:\fxwork\t050\!FluxIQWebExtension`, HEAD `9e25272`

Nothing is committed. Prefixes: `AS/` = Core `packages/fluxiq/src/programs/automation-studio/`;
`TR/` = downstream `packages/test-runner/src/`.

## Outcome

**Partial.** All the code is done, tested and checked, and both live proofs
were run on the final code. **Neither live proof showed a permission
request**, because in no run did the model attempt a press with a lasting
consequence:

- With no permit, the diagnosis skipped exploration and the patch model
  declined (`control_gone`).
- With `--llm-permit modify_existing`, the recovery explored with 2 actions, no
  request was raised, and a `temporary_target_override` was proposed and
  refused at preflight.

The request path (a press ends the recovery, the patch call is skipped, and
`metadata.permissionRequest` is written) is proven by unit tests only.

What the live runs do prove:

- The Lab now waits for Core's recovery. Before the fix, every run reported 0
  calls and no recovery. Now every recovery completes and is read back, with
  `observed.calls` equal to Core's own `costAccounting.calls`.
- Core records `llmGate.permissions` exactly as granted:
  `{granted:[], instructed:[], lapsed:[]}` without a permit, and
  `{granted:["modify_existing"], ...}` with one.
- The patch call is made after the exploration.

## What changed and why

### Core (slice C3)

- **`AS/runtime/llm/execution-grants.ts`**: `resolve()` returns a copy of the
  grant's `permittedConsequences`.
- **`AS/runtime/llm/resolver-contract.ts`**: `AutomationStudioLlmProviderResolution`
  gains `permittedConsequences?`. Absent means nothing is permitted. The host
  passes `resolve()` through unchanged.
- **New `AS/runtime/recovery/annotation/permissions.ts`**
  (`automationStudioRecoveryPermissionGate`), exported from the barrel:
  - one gate per recovery, at `stage: "recovery"`;
  - its authority is the grant's classes, plus the parent Flow's stored
    `bootstrapInstructedConsequences`, kept only while the instruction is
    active and its text is unchanged;
  - it observes the failure evidence;
  - its `summary()` returns classes only: `{ granted, instructed, lapsed }`;
  - it never calls a model.
- **`AS/runtime/recovery/annotation/annotate.ts`**:
  - reads `flowForRecovery` once, and that read also supplies the exploration's
    scope;
  - builds the gate once the provider has resolved, and shares it with the
    exploration;
  - when a request is raised and a patch would have followed, it skips the
    patch call and records `patchSkippedCode: "llm.runtime_patch_permission_required"`
    and `patchSkipped` (the request's sentence);
  - writes `metadata.permissionRequest` and `llmGate.permissions`.
- **`AS/runtime/recovery/annotation/exploration.ts`**: takes `permissionGate`
  and `actionPermissions`; the registry resolution sets
  `mutationsGovernedByPermission: true`.
- **`AS/runtime/recovery/runtime-exploration.ts`**: an optional `gate` input is
  used as it is. Passing it together with the loose fields
  (`permittedConsequences`, `instructionIds`, `shownEvidence`) throws before
  anything runs.
- **`AS/runtime/llm/harness-options/registry.ts`**: `mutationsGovernedByPermission`
  offers `mutate` options whatever the policy says. `destructive` is never
  offered.

### Core (extension: what the model is told)

- **`AS/runtime/llm/harness/context-packet.ts`**:
  - new type `AutomationStudioLlmActionPermissions`, exported from the harness
    barrel;
  - when a call carries `actionPermissions`, `policyGates` drops
    `allowExternalSideEffects` and `requireApprovalForExternalSideEffects`;
  - it carries `actionPermissions: { permitted, granted, instructed, otherwise }`
    instead;
  - `otherwise` is Core's sentence: "An action with any other lasting
    consequence is still within reach: when the recovery needs one, the run
    asks the person for permission at that step instead of taking it. Needing
    permission never makes a step's result unachievable."
- **`AS/runtime/llm/harness/task-request.ts`**: the harness input gains
  `actionPermissions?`.
- annotate passes `actionPermissions` to the diagnosis and to every exploration
  decision.
- **The patch call deliberately still gets the flag.** Its preflight
  (`live-patch.ts`, C4's) still enforces the flag, and telling the model
  otherwise would be false.
- **Why the last clause of the sentence exists.** The first wording ended
  "...asks the person for permission, and that request is the run's answer".
  In run L1 the diagnosis then answered `stillAchievable: "no"`. The diagnosis
  instruction says to answer "no" where "only a person can settle it", and "no"
  ends the recovery with no request, which is exactly the silent refusal the
  product rule forbids. After the rewording, L3 answered "yes". That is n=1 on
  each side, so it is suggestive rather than proven.
- **Core `docs/architecture/automation-studio.md`**: new subsection "What a
  recovery may do that outlasts it". It says `policy.allowExternalSideEffects`
  is no longer read on the recovery exploration path, that the model is shown
  `actionPermissions`, and that the patch call and its preflight still use the
  flag until C4.

### Downstream (extension: the Lab defect)

- **`TR/flow-lane/persisted-flow-run.ts`**:
  - **The request bound.** The one request that runs a granted Flow now uses
    `GRANTED_RUN_REQUEST_MS` = min(the grant's run lease of 600 s, the client's
    ceiling of 300 s), not the 30 s default.
  - **What counts as finished.** For a grant that recovers (every purpose except
    `verify_result`), a `failed` run counts as finished only once
    `metadata.llmGate` or `metadata.recoveryTrace` is present. Every way out of
    Core's recovery writes both. The recovery ladder's placeholder intervention
    does not count, because it is written with the run's first save.
  - **Both read paths.** This applies on the timeout read-back, and on the
    answered path should Core ever answer early.
  - **The deadline.** A run still pending when the wait ends throws
    `RunnerFailure("performance.budget", ..., { code: "flow_lane.granted_run_unsettled", pending: "recovery" | "verdict", waitedMs })`,
    not the run's own failure. The wait is bounded by the grant's lease.
  - `verdictSettled` is replaced by `pendingWork`.
  - The answered path waits only for the recovery. The old code never waited
    for a verdict there, and the creation-lane fakes depend on that.
- **`TR/http-control/index.ts`**: exports `FLUXIQ_HTTP_MAX_TIMEOUT_MS = 300_000`,
  now used by `boundedTimeout`.

### Tests

- **Core, new**:
  - `annotation/tests/permissions.test.ts` (7);
  - `annotation/tests/recovery-permissions.test.ts` (5). It now also asserts
    that the diagnosis request carries `actionPermissions` and not the flag;
  - `llm/harness/tests/policy-gates.test.ts` (3).
- **Core, edited**:
  - `annotate.test.ts`: the "withholds a mutating option" pair is replaced;
  - `runtime-exploration-permission.test.ts`: +2;
  - `registry.test.ts`: +1;
  - `execution-grant-permissions.test.ts`: +2;
  - `service-adaptation/tests/{llm-grants,runtime-patches}.test.ts`: the
    diagnosis now asserts `actionPermissions`, and the patch still asserts the
    flag.
- **Downstream, new**: `TR/flow-lane/tests/granted-run-settlement.test.ts` (5):
  - the request bound is 300 s;
  - a timed-out run is read past a failed-but-recovering detail until the
    record is in;
  - an answered-early run is read the same way;
  - the deadline produces the closed code after exactly 600 s;
  - `verify_result` is final at once.
- **Downstream, edited**: `TR/flow-lane/tests/live-repair-lane.test.ts`. Its
  fake Core finished a recovery without writing the record real Core writes, so
  it now writes `llmGate` and `recoveryTrace`.

## Commands run and observed results

### Live runs

Every run used the campaign's command for the task with `--llm-task repair` and
`FLUXIQ_TEST_ENV_FILES=none`:

`node scripts/lab/run-lab.mjs run order-operations --workflow dispatch-batch --variant relabelled-dispatch --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task repair [--llm-permit modify_existing] --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 --llm-max-calls 26 --llm-max-cost-usd 0.25`

Before the Lab fix (baseline and after C3): `run-mubnt40m-21b3b65f`, `run-mubog4ky-60dfbc44`,
`run-mubop3er-4c5dbde5` and `run-mubosmk0-57653b21` all gave `observed.calls: 0`,
`gate: null` and no recovery trace.

After the Lab fix:

| Run | Code | Permit | Calls (kind: tokens) | Cost USD | `llmGate.permissions` | Diagnosis, plan | Exploration | Patch outcome |
|---|---|---|---|---|---|---|---|---|
| L1 `run-mubq7luu-e0f33737` | first wording | none | diagnosis: 4,564 | 0.00243 | granted [], instructed [], lapsed [] | stillAchievable **no**; plan `stop` | skipped | no call; `patchSkippedCode: llm.runtime_patch_not_requested` |
| L2 `run-mubqe65d-ffaf7a68` | first wording | modify_existing | diagnosis 4,612; decision 4,040; decision 4,478; patch 7,152 | 0.00990 | granted [modify_existing] | unknown; plan `explore`, `request_patch` | `evidence_gathered`, 2 actions, 2 observed, 0 refused | as L5 |
| L3 `run-mubqjkhq-8bb3d976` | **final** | none | diagnosis 4,745; patch 4,959 | 0.00495 | granted [], instructed [], lapsed [] | **yes**, deterministicRecoveryPossible yes; plan `request_patch` only | skipped (not requested) | `no_repair`, `runtime_patch.declined.control_gone` |
| L4 `run-mubqneip-ff8c7221` | final | modify_existing | 0 | 0 | none | none | none | facility failure before the Flow ran (see below) |
| L5 `run-mubqqeze-8e9a4bbd` | **final** | modify_existing | diagnosis 4,583; decision 4,040; decision 4,513; patch 7,213 | 0.00998 | granted [modify_existing], instructed [], lapsed [] | unknown; `explore`, `request_patch` | `evidence_gathered`, 2 actions, 2 observed, 0 refused | proposed `temporary_target_override`; `preflightOk: false`, see below |

The L5 patch codes (the same in L2):

- `runtime_patch.side_effect_not_authorized` ("External side effects are
  disabled by adaptation policy." and "...requires explicit authorization.");
- `runtime_patch.preflight_rejected`, twice (one is "Runtime patch requires
  host capability action-dispatch.");
- `runtime_patch.target_override_rejected.target_not_equivalent` (the domain's
  check found that the chosen handle does something other than what the failed
  target did).

The result was `adaptationIds: []` and `changeProposalIds: []`.

Accounting for every run: `observed.calls` equals Core's
`llmGate.costAccounting.calls` (1, 4, 2 and 4), with `budgetBreaches: 0` and
`pendingCalls: 0`, and `explorationCalls` is 2 in L2 and L5.

- There is no `build` accounting, because these are recorded Flows, not built
  ones.
- `repair` is `null` in `flow-lane.json`. A direct `lab run` carries no
  declared repair, so no repair was judged.
- Every run's verdict is `failed` / `runtime.behavior`, which is the Flow's own
  failure, now correctly reported after the recovery ended.
- `metadata.permissionRequest` was `null` in every run.
- Total provider spend across L1 to L5 was about USD 0.027.

**How I read `permissions` and `permissionRequest`.** The Lab's snapshot keeps
only the gate's code fields, not these. I ran a read-only watcher that copied
the isolated Core's project store during each run. I read the recovery record
from its typed run store, printing codes, classes and counts only, and deleted
every copy afterwards.

**L4's failure was probably caused by that watcher.** Core failed on
`update-flow-settings (400): SQLITE_READONLY: attempt to write a readonly database`
before the Flow ran. The watcher copied with `copyFileSync`, which on Windows
can open the database without write sharing, so SQLite falls back to read-only.
I rewrote it to use `readFileSync` (which shares with writers), to copy only
the project stores, and to poll every 3 s. L5 then ran clean.

### Checks

Core, from `packages/fluxiq` unless noted:

- `npx tsc --noEmit -p tsconfig.json`: clean.
- `npx vitest run` over 13 paths:
  - `recovery/annotation/tests`
  - `recovery/tests/runtime-exploration{,-permission}.test.ts`
  - `llm/harness-options/tests`
  - `llm/tests/execution-grant{-permissions,s}.test.ts`
  - `llm/tests/harness.test.ts`
  - `llm/harness/tests`
  - `tests/deepseek-recovery-requests.test.ts`
  - `tests/service-adaptation/tests/{iterating-recovery,llm-grants,runtime-patches}.test.ts`
  - `action-permissions/tests`

  The result was "Test Files 30 passed (30), Tests 312 passed (312)".
- Core root `pnpm check`: exit 0, every "# fail 0", "structure-audit: passed
  (170 warning(s), 361 baselined)".
- Core root `pnpm build`: exit 0.
- `node scripts/structure-audit.mjs`, re-run after the last doc edit: passed.
- `service.ts` is 6,275 lines.

Downstream, from `packages/test-runner` after `npx tsc -p tsconfig.json`, each
file run with `node --test`:

| Test file | Pass | Fail |
|---|---|---|
| `granted-run-settlement` | 5 | 0 |
| `persisted-flow-run` | 24 | 0 |
| `harness-recovery` | 8 | 0 |
| `live-repair-lane` | 4 | 0 |
| `tests/commands` | 29 | 0 |
| `live-llm/tests/execution-grant` | 11 | 0 |
| `flow-lane/creation/tests/lane` | 9 | **1** |

The creation-lane failure is pre-existing. The expected call list lacks
`get-flow-adaptation`, which committed `build-proposal.ts:262` makes (last
changed in `f1db4e9`, t027's reconcile) during the build step, before any Flow
run. None of my files are on that path.

Downstream root `pnpm check`: exit 0, "structure-audit: passed (84 warning(s),
122 baselined)", and every tsc check done.

## Not verified

- **The permission request, live.** No run attempted a press with a lasting
  consequence, so none of these was seen live:
  - a recovery `metadata.permissionRequest`;
  - `llm.runtime_patch_permission_required`;
  - `missing` being non-empty;
  - "nothing dispatched".
- **Whether L2 or L5 pressed anything.** Core's recovery trace does not publish
  the exploration's tool ids (`toolDetail: "not-published"`), and the gateway
  kept only the Flow's own command. The run is consistent either with only
  looking, or with a press the model declared as `[]` or as `modify_existing`
  (which was granted). The scenario describes "Pick and pack" as a shortcut
  that shows a view of orders, so a press may honestly declare `[]` and never
  need permission. If so, this task cannot show the request at all.
- Whether the rewording causes the diagnosis to say "yes" rather than merely
  coinciding with it (one run each).
- The instructed half of item 3. It needs DL.
- The full test suites, which the brief excludes.
- The `closed timeout` path live. It is covered by a test only; no live run
  reached the deadline.

## Open questions or contradictions found

1. **Nothing further can execute or propose on this task without C4 and a host
   capability.** L5's patch was refused on:
   - `side_effect_not_authorized` (C4's `live-patch.ts` gate);
   - "Runtime patch requires host capability action-dispatch" (the Lab's host
     binding does not declare it, so an `explore_and_adapt` patch cannot
     execute in the Lab at all);
   - the domain's `target_not_equivalent`.

   The first two block L5 and L6 on every repair task. The third means the
   domain's equivalence check rejected the control the model picked. I could
   not see which control that was: the handle is opaque, and the intervention
   keeps only kinds.
2. **This task may never exercise the request.** To prove item 3 live, a task
   whose repair needs a press that is truly lasting is more likely to raise a
   request. `social-scheduler-repair-renamed-composer` ("Add to queue") is the
   design's item-4 candidate.
3. **The exploration model never sees `policyGates`.** The DeepSeek provider
   projects the context of `evidence_tool_decision` calls down to instructions
   and the evidence loop (`deepseek-provider.ts`, around line 497). So
   `actionPermissions` reaches the packet and the record, but not the model, on
   exploration decisions; it reaches the model only on the diagnosis. The press
   tool's own description (`domain/.../harness-options/options.ts:81`) is what
   tells the explorer about permission. Changing the projection means editing
   `deepseek-provider.ts`, which is near its 800-line limit and shared with t033.
4. **Core does not store the diagnosis fields.** A diagnosis intervention keeps
   only `{kind, confidence}`, and the trace keeps only the verdicts. Why a
   model answered "not achievable" cannot be read after the run.
5. **Lab snapshots omit the permission record.** `live-llm.json` keeps only
   `invoked`, `reason`, `code` and `patchSkippedCode` from `llmGate` (`TR/existing-fluxiq-control.ts`,
   `runLlmGate`), and never `metadata.permissionRequest`. A future proof should
   carry `permissions` and the request's classes into the snapshot, so it does
   not need the storage watcher.
6. **A request is recorded even when no patch would have followed.** In that
   case the skip code stays the planned one rather than
   `llm.runtime_patch_permission_required`. This is unchanged from the first
   report.
