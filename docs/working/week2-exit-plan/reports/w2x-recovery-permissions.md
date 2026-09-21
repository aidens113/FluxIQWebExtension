# w2x-recovery-permissions

Worker report, 2026-09-21. Task t050, plan step L4, slice C3 ("Item 3" of
`reports/w2x-existing-flow-and-repair-design.md`). Worktrees:
`F:\fxwork\t050\!FluxIQ` (branch `task/t050-recovery-permissions`, HEAD
`56d6106`) and `F:\fxwork\t050\!FluxIQWebExtension` (HEAD `9e25272`). Nothing
is committed. `AS/` = Core `packages/fluxiq/src/programs/automation-studio/`,
`TR/` = downstream `packages/test-runner/src/`.

## Outcome

**Partial.** The Core change is built and passes its focused tests (5 new, 1
rewritten, 356 run), Core `check`, Core `build` and downstream `check`.
`service.ts` stays at 6,275 lines.

**The live proof is blocked by a Lab defect**, outside what this brief owns.
The Lab reads a granted recorded-Flow run back before Core's recovery has
finished, so no `--flow` repair task can show a recovery, whatever Core does.
The unchanged baseline showed exactly the same symptom. I did not take live
run 2 (with `--llm-permit`): it would hit the same wall, add no evidence, and
possibly spend provider money that nothing records. The cause is under "Open
questions", item 1, with the fix it needs.

## What changed and why

All the changes are in Core. There are no downstream changes.

- **`AS/runtime/llm/execution-grants.ts`**: `resolve()` now also returns
  `permittedConsequences`, as a copy of the grant's set.
- **`AS/runtime/llm/resolver-contract.ts`**: `AutomationStudioLlmProviderResolution`
  gains `permittedConsequences?: readonly AutomationStudioActionConsequence[]`.
  Absent means nothing is permitted. The host resolver (`programs/_shared/runtime.ts:79-93`)
  passes `resolve()` through unchanged, so no host edit was needed.
- **New `AS/runtime/recovery/annotation/permissions.ts`** (`automationStudioRecoveryPermissionGate`):
  - Builds one gate at `stage: "recovery"`.
  - Its authority is two things. The first is the grant's classes (unrecognised
    words are dropped). The second is `currentAutomationStudioInstructedConsequences`
    over the parent Flow's `metadata.bootstrapInstructedConsequences`, checked
    against the Flow's **active** instructions by their full title and body.
    An edited or inactive instruction lapses its entries.
  - `instructionIds` are the active instructions.
  - It observes the failure evidence, so a request can name a control that was
    already shown to the model.
  - It returns `{ gate, summary() }`, where the summary is classes only:
    `{ granted, instructed, lapsed }`.
  - It never calls a model.
  - The file is exported from `annotation/index.ts`.
- **`AS/runtime/recovery/annotation/annotate.ts`**:
  - After the provider and the failure evidence, it reads `flowForRecovery`
    once. That port came from L0. The same read now also supplies the
    exploration's scope.
  - It builds the gate when a provider is present and passes it to the
    exploration.
  - After the exploration, if `gate.request` is set and a patch call would
    have followed, the patch call is skipped. It records:
    - `patchSkippedCode: "llm.runtime_patch_permission_required"`;
    - `patchSkipped: <the request's sentence>`;
    - the same code as the resolution stage's `skipCode`.
  - Whenever a request exists, it is written to `metadata.permissionRequest`
    (`automation-studio.action-permission-request.v1`, `reason.stage: "recovery"`).
  - `metadata.llmGate.permissions` records the summary.
  - The file grows from 454 to 483 lines.
- **`AS/runtime/recovery/annotation/exploration.ts`**: the input gains an
  optional `permissionGate`, which is passed through as `gate`. The registry
  resolution sets `mutationsGovernedByPermission: true`. The header comment
  that said the policy flag decides side effects is rewritten.
- **`AS/runtime/recovery/runtime-exploration.ts`**: gains an optional `gate`,
  which is used as it is. Passing it together with `permittedConsequences`,
  `instructionIds` or `shownEvidence` throws before anything runs. Without it,
  the gate is built from the loose fields as before.
- **`AS/runtime/llm/harness-options/registry.ts`**: the resolution gains
  `mutationsGovernedByPermission?`. When it is true, `sideEffectAllows` offers
  `mutate` options whatever the policy says. `destructive` is still never
  offered. Without the flag, behaviour is unchanged.
- **Core `docs/architecture/automation-studio.md`**: new subsection "What a
  recovery may do that outlasts it", before "LLM execution grant lifetime". It
  states that `policy.allowExternalSideEffects` is no longer read on the
  recovery exploration path. It also states that the patch stage's own
  preflight (`live-patch.ts`) still reads the flag until C4.
- **Tests**:
  - New `annotation/tests/permissions.test.ts` (7 tests): grant only, the
    instructed set current, lapsed by an edit and by deactivation, unparseable
    entries, the name carried only when it was shown, and the summary as a copy.
  - New `annotation/tests/recovery-permissions.test.ts` (5 tests, driven
    through `annotate`, with a policy that forbids side effects):
    - the acting option is offered, and a destructive one is not;
    - with no grant: a request, no press, no patch call, and the new codes;
    - with a grant: the press happens and the patch call follows;
    - with the instructed set: the press happens;
    - with an edited instruction: a request, and the set reported as lapsed.
  - `annotate.test.ts`: the two tests that pinned "the policy flag withholds
    the mutating option" are replaced by one that asserts the option is offered
    under either flag value.
  - `runtime-exploration-permission.test.ts` (+2): a gate handed in is used as
    it is and holds the request; a gate plus loose fields throws before any
    decision.
  - `registry.test.ts` (+1): the governed flag, and never a destructive option.
  - `execution-grant-permissions.test.ts` (+2): `resolve()` returns a copy, and
    the empty set when nothing was granted.

A decision I took: when a request exists but no patch call would have been
made anyway (for example, no runtime Flow or `createAdaptations` off), the
original skip code is kept. `metadata.permissionRequest` is still recorded.

## Commands run and observed results

Live runs. Each set `FLUXIQ_TEST_ENV_FILES=none` and ran the campaign's command
for the task with `--llm-task repair`:

```
node scripts/lab/run-lab.mjs run order-operations --workflow dispatch-batch --variant relabelled-dispatch --flow --live-llm --llm-profile lab-adapt-repair --llm-provider deepseek --llm-model deepseek-chat --llm-task repair --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 --llm-max-calls 26 --llm-max-cost-usd 0.25
```

| Run | Core | Result |
|---|---|---|
| baseline `run-mubnt40m-21b3b65f` | unchanged (dist rebuilt first) | verdict failed; `live-llm.json` `observed.calls: 0`, `interventions: 1`, `gate: null`, `exploration.source: "absent"`, `settlement: "lane_failed"` |
| run 1 `run-mubog4ky-60dfbc44` | this change (fresh Core web build) | identical: `calls: 0`, `gate: null`, `exploration.source: "absent"` |
| run 1b `run-mubop3er-4c5dbde5` | this change | identical (storage watcher failed to copy) |
| run 1c `run-mubosmk0-57653b21` | this change | identical; watcher captured the isolated Core's storage, read and then deleted |

What the run 1c capture showed:

- The runtime session metadata was `{"adaptiveRuntime":true,"adaptiveMode":"manual_approval",...,"canonicalFlow":true}`.
  The trace status was `failed`, with the message "Recovery ladder reached LLM
  diagnosis fallback before a configured provider was invoked." The session was
  queued at 20:18:13.065Z and finished at 20:18:21.053Z. The Flow has a Router
  and a Subflow.
- The typed run store held only envelopes derived from the session
  (`compatibilitySource: "runtime-session"`). There was no `llmGate`, no
  `recoveryTrace` and no permission request anywhere in the project, root or
  runtime stores.
- The Lab's run ended at 20:18:44.590Z. That is about 30 s after the run
  request started.
- The only intervention is the recovery ladder's placeholder (`service/summaries/conversions.ts:221-240`),
  not one written by annotate.

Checks, all run from `F:\fxwork\t050\!FluxIQ\packages\fluxiq` unless noted:

- `npx tsc --noEmit -p tsconfig.json` printed nothing (clean), before and after
  the tests were added.
- `npx vitest run` over:
  - `recovery/annotation/tests`
  - `recovery/tests/runtime-exploration{,-permission}.test.ts`
  - `llm/harness-options/tests/registry.test.ts`
  - `llm/tests/execution-grant{-permissions,s}.test.ts`
  - `tests/deepseek-recovery-requests.test.ts`
  - `tests/service-adaptation/tests/iterating-recovery.test.ts`

  printed "Test Files 16 passed (16), Tests 172 passed (172)".
- `npx vitest run` over `action-permissions/tests`, `llm/tests/repair-exploration-tools.test.ts`,
  `llm/tests/harness.test.ts`, `flow-change/tests/trial.test.ts`,
  `executor/tests/node-execution.test.ts` and `llm/harness-options/tests`
  printed "Test Files 11 passed (11), Tests 184 passed (184)".
- `node scripts/structure-audit.mjs` (Core root) printed "structure-audit:
  passed (170 warning(s), 361 baselined)."
- `pnpm check` (Core root) exited 0: "# pass 182 / # fail 0", "# pass 20 /
  # fail 0", "structure-audit: passed", and `tsc` done for `fluxiq`,
  `client-gateway-websocket` and `apps/web`.
- `pnpm build` (Core root) exited 0, including the Next.js build of `apps/web`.
- `pnpm check` (downstream root) exited 0: every "# fail 0", "structure-audit:
  passed (84 warning(s), 122 baselined)", and `test-runner check` done.
- `wc -l .../runtime/service.ts` printed 6275.

## Not verified

- **Neither live proof.** The Lab never read a completed recovery, so none of
  the following was observed live: `llmGate.permissions.granted: []`, a
  recovery `permissionRequest` naming "Pick and pack", the press appearing in
  the trace under a permit, or whether a patch is then proposed and with what
  outcome code (the question L5 and L6 need answered).
- Whether the web domain's recovery press really calls the permission check
  before acting. The design says it does (`domain/.../harness-options/execute.ts:115-129`,
  `press.ts:55-63`). I did not read that code, and no live run reached it.
- Whether DeepSeek calls were made and billed in the four runs. Core's recovery
  had about 22 s after the Flow finished before the Lab tore it down. That is
  enough for at least the diagnosis call, but the Lab recorded 0 because it
  read the detail first. Any such calls are unrecorded.
- Whether the model presses a lasting control at all under this recovery. It
  is still shown `adaptationPolicyGates(policy).allowExternalSideEffects: false`
  in its context packet (see "Open questions", item 2).
- The instructed half of the live proof (build `order-operations-dispatch-run`
  with `create-flow`, then repair it through DL) was not attempted. DL does not
  exist yet.
- The full Core and downstream test suites were not run, per the brief.

## Open questions or contradictions found

1. **The Lab abandons a granted Flow run before Core's recovery ends. This
   blocks L4, L5 and L6 on every `--flow` repair task.**
   - Where: `TR/flow-lane/persisted-flow-run.ts`. The fix is downstream and
     needs a slice that owns `TR/flow-lane/`.
   - The chain:
     - `runGrantedFlow` calls `run-runtime-session` with the flow lane's
       `bounds`. That is `{}` from `run-scenario.ts:427` through
       `run-flow-lane.ts:133`, so it gets the default 30,000 ms bound
       (`TR/http-control/index.ts:269`).
     - Core returns only after the graph and the whole recovery are done
       (`service.ts` routed path, then annotate, then `saveFlowRunDetail`).
     - A recovery with failure evidence, diagnosis and exploration takes
       longer than that.
     - When the request times out, `awaitTerminalRunDetail` accepts the first
       read whose status is terminal. `verdictSettled` (`persisted-flow-run.ts:449-451`)
       returns true for any run that did not succeed.
     - So the Lab takes the session-derived detail as soon as the Flow fails,
       settles the grant with `calls: 0`, and tears Core down mid-recovery.
   - Created-Flow runs on t049 still show a recovery (`gate=invoked`,
     `recovery-trace`). Their `diagnose_and_adapt` recoveries evidently finish
     within the 30 s.
   - Fix options:
     - give `runGrantedFlow` a bound as long as the grant's run lease
       (`AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`, already used as
       `GRANTED_RUN_WAIT_MS`);
     - or, for a granted run, have the terminal wait require Core's recovery
       record (`metadata.llmGate` or `metadata.recoveryTrace`) before treating
       a failed run as settled.
   - Until then, a recorded-lane repair campaign measures nothing about repair,
     and it may spend provider money that no snapshot shows.
2. **The model is still told the flag is false.** `AS/runtime/llm/harness/context-packet.ts:400`
   (`adaptationPolicyGates`) puts `allowExternalSideEffects` into every
   recovery request's context, and the Lab's policies hold it `false`. The
   registry now offers the press anyway, but a model told "no external side
   effects" may decline to use it. This was outside my files. If live runs show
   the model avoiding presses, that line needs the same change of meaning:
   drop the flag, or state that the permission gate decides.
3. **A request is recorded even when no patch would have followed.** Its skip
   code then stays the planned one (for example `llm.runtime_patch_unavailable`)
   rather than `llm.runtime_patch_permission_required`. I chose this because
   granting the permission would not produce a patch in that case. CU1 should
   show the request either way.
4. The brief named `provider-resolution.ts` as moved to `resolver-contract.ts`.
   That was confirmed: the type lives in `AS/runtime/llm/resolver-contract.ts`
   and `service.ts` only re-exports it. L0 had already made the `flowForRecovery`
   port change, so this slice did not repeat it.
