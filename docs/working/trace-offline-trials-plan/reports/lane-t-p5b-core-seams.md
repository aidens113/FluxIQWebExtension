# Lane T P5b (t749): public Core seams for the offline experiment

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t749/!FluxIQ`, branch `task/t749-offline-reads-tier2`.

## Progress log

### 2026-10-20, unit 1: the rebuild seam

- Test first: `runtime/project-agents/single-subflow/tests/rebuild.test.ts` (4 tests) written before the code;
  `pnpm exec vitest run src/programs/automation-studio/runtime/project-agents/single-subflow/tests/rebuild.test.ts`
  printed `Tests 4 failed (4)`, each `TypeError: automationStudioProjectSingleSubflowRebuild is not a function`.
- Extracted the single-subflow assembly of one proposal out of `single-subflow-trial.ts` into
  `single-subflow/proposal-assembly.ts` (`automationStudioProjectSingleSubflowAssemble`); the trial now calls it.
- New `single-subflow/rebuild.ts` (`automationStudioProjectSingleSubflowRebuild`): dispatch scope from the record,
  a fresh scoped submission controller submits the script, then `automationStudioProjectSingleSubflowAssemble`
  through a fresh whole controller.
- Barrels: `single-subflow/index.ts` exports both; `dispatch/index.ts` now exports `./scope.ts` (one line, needed so
  the rebuild imports the scope through the barrel; outside the brief's literal ownership, see Open questions).
- After: same command printed `Tests 4 passed (4)`. The first test runs a real single-subflow build on the supervisor
  fixture and checks the rebuild's proposal `{revision, digest}` equals the builder's tested proposal and its whole
  candidate digest equals the digest the builder's whole test judged.

UNIT READY: runtime/project-agents/single-subflow/{proposal-assembly.ts,rebuild.ts,index.ts,single-subflow-trial.ts,tests/rebuild.test.ts}, runtime/project-agents/dispatch/index.ts
(all under `packages/fluxiq/src/programs/automation-studio/`)

### 2026-10-20, unit 2: the trial-ports seam and the trace store

- Tests first: `service/trial-ports/tests/{environment,whole-ports,service-ports}.test.ts` (with `tests/fakes.ts`) and
  `gateway-trace/wiring/tests/service-store.test.ts`. Before the code,
  `pnpm exec vitest run src/programs/automation-studio/runtime/service/trial-ports src/programs/automation-studio/runtime/gateway-trace/wiring/tests/service-store.test.ts`
  printed `Test Files 4 failed (4)`: the three trial-ports files `Failed to load url ../index.ts`, and the store's 2
  tests `TypeError: automationStudioGatewayTraceServiceStore is not a function`.
- New directory `runtime/service/trial-ports/` (`project-build/` is at its 25-file limit): `collaborators.ts` (type),
  `collaborator-registry.ts` (WeakMap adopt/of, the gateway trace pools' pattern), `registry-resolution.ts`,
  `environment.ts` (the build's inline trial environment, moved member by member), `whole-ports.ts` (environment +
  trial reads + judge), `service-ports.ts` (the public seam), `index.ts`.
- Callers switched in the same unit: `service.ts` adopts its collaborators in one new private field
  (`trialCollaborators`, a field, not a method: class-methods stays at its baseline), takes its registry from
  `automationStudioServiceRegistryResolution` and its trial environment from `automationStudioServiceTrialEnvironment`
  (two registry lines and three inline environment lines replaced; `readRecordSets` and the environment type import
  dropped). service.ts went from 4316 to 4315 lines. `project-build/whole-trials.ts` makes its ports with
  `automationStudioWholeTrialPorts`.
- New `gateway-trace/wiring/service-store.ts` (`automationStudioGatewayTraceServiceStore`), added to the wiring barrel.
- `runtime/index.ts` publishes the rebuild seam and its types, `automationStudioServiceWholeTrialPorts` and its input
  type, the `AutomationStudioCandidateTrialPorts` type, and `automationStudioGatewayTraceServiceStore`.
- After: same command printed `Test Files 4 passed (4)`, `Tests 12 passed (12)`.

UNIT READY: runtime/service/trial-ports/**, runtime/service.ts, runtime/service/project-build/whole-trials.ts, runtime/gateway-trace/wiring/{service-store.ts,index.ts,tests/service-store.test.ts}, runtime/index.ts

## Outcome

Done. Both seams exist, are exported from `fluxiq/automation-studio`, and Core's own construction calls them.

## What changed and why

Exports (all from `fluxiq/automation-studio`):

1. Rebuild seam (`runtime/project-agents/single-subflow/rebuild.ts`):
   `automationStudioProjectSingleSubflowRebuild(input: AutomationStudioProjectSingleSubflowRebuildInput): Promise<AutomationStudioProjectSingleSubflowRebuilt>`
   - `AutomationStudioProjectSingleSubflowRebuildInput = { record: AutomationStudioProjectBuildRecord; briefId: string; script: string; submission: AutomationStudioProjectSingleSubflowRebuildSubmission; instructionText: string; originalSource?: AutomationStudioCandidateOriginalSourceBinding | undefined }`
   - `AutomationStudioProjectSingleSubflowRebuildSubmission = Omit<ConstructorParameters<typeof AutomationStudioFlowCandidateSubmissionController>[0], "instructionText" | "originalSource">`
     (project, Flow, registry, resolution, binding, base dependency digest, start location, handle reach, permissionFor and the rest).
   - `AutomationStudioProjectSingleSubflowRebuilt = { ok: true; proposal: { revision: number; digest: string }; candidate: AutomationStudioFlowCandidate } | { ok: false; stage: "plan" | "subflow" | "assembly" | "composed"; codes: string[]; proposal?: { revision: number; digest: string } }`
   - Throws `AutomationStudioProjectRecordRefusal` (`project.brief_unknown`, or the dispatch scope's stale-plan codes).
   - The shared composition is `automationStudioProjectSingleSubflowAssemble` (`proposal-assembly.ts`, not published):
     `automationStudioProjectSingleSubflowTrial` (the builder's single-subflow test) now calls it, and so does the
     rebuild. The scope and scoped submission are Core's own pieces (`automationStudioProjectDispatchScope`,
     `AutomationStudioSubflowScopedSubmissionController`), called, not copied.
2. Trial-ports seam (`runtime/service/trial-ports/service-ports.ts`):
   `automationStudioServiceWholeTrialPorts(service: AutomationStudioService, input: AutomationStudioServiceWholeTrialPortsInput): Promise<AutomationStudioCandidateTrialPorts>`
   - `AutomationStudioServiceWholeTrialPortsInput = { projectId: string; flowId: string; sourceInstructionIds: readonly string[]; startLocation?: string | undefined; judge: AutomationStudioCandidateTrialPorts["judge"] }`
   - Composition: `automationStudioServiceRegistryResolution` -> `automationStudioServiceTrialEnvironment` (no
     `prepareStart`) -> `automationStudioWholeTrialPorts`; the build calls the same environment and whole-ports functions.
   - `observedStateKeys` is the bound binding's declaration, each key once: what the build's harness registry yields
     when any of the domain's tools is offered.
   - Rejects with `automation_studio.trial_ports_unavailable` when the service adopted no collaborators or has no
     evidence runtime bound (a build refuses the same condition).
   - `AutomationStudioCandidateTrialPorts` is now published as a type.
3. Trace store (`runtime/gateway-trace/wiring/service-store.ts`):
   `automationStudioGatewayTraceServiceStore(owner: object, projectId: string): ClientGatewayTraceStore | undefined`
   (undefined for an owner without project storage).

## Commands run and observed results

From `packages/fluxiq`:
- `pnpm exec vitest run src/programs/automation-studio/runtime/project-agents/single-subflow/tests/rebuild.test.ts`:
  before `Tests 4 failed (4)`, after `Tests 4 passed (4)`.
- `pnpm exec vitest run <service/trial-ports> <gateway-trace/wiring/tests/service-store.test.ts>`: before
  `Test Files 4 failed (4)`, after `Test Files 4 passed (4)`, `Tests 12 passed (12)`.
- `pnpm exec vitest run` over `runtime/project-agents/single-subflow`, `runtime/project-agents/dispatch`,
  `runtime/service/trial-ports`, `runtime/service/project-build`, `runtime/gateway-trace/wiring`:
  `Test Files 63 passed (63)`, `Tests 305 passed (305)`.
- `pnpm exec vitest run` over `runtime/service/flow-bootstrap-commands`, `runtime/flow-bootstrap/tests`,
  `runtime/tests/service-bootstrap` (the service's build path, which now uses the environment seam):
  `Test Files 65 passed (65)`, `Tests 434 passed (434)`.
- `pnpm exec tsc --noEmit -p .`: no output (clean), 1m21s.

From the Core root:
- `node scripts/structure-audit.mjs`: exit 1, `structure-audit: 5 violation(s) across 1 rule(s)`. All five are
  `[package-exports]` in `apps/web/.../capabilities/tests/core-contract-world.ts`, `apps/web/.../core-contract.test.ts`,
  `scripts/automation-studio-scale-baseline.mjs`, `scripts/automation-studio-scale-certification.mjs` and
  `scripts/flow-compiler.mjs`. That rule (`scripts/structure-audit/rules/package-exports.mjs`) is untracked, being
  written by another worker in this tree now; none of the flagged files is mine. No finding, fail or warn, names any
  file I touched. It also printed `1 baseline entries can be lowered` (presumably service.ts file-lines 4316 -> 4315).

## Not verified

- Core not built and docs reference not regenerated (the lead's, per the brief). Downstream still loads the deep files;
  a later unit switches `core-authoring.ts`, `rebuild-candidate.ts`, `core-trial-seams.ts`, `ports.ts` and `host.ts`.
- The rebuild seam was checked on the supervisor fixture's single-subflow build, not on a recorded Lab build.
- The audit could not be shown green because of the concurrent worker's in-progress package-exports rule.
- `pnpm structure:baseline` not run (shared baseline file).

## Open questions or contradictions found

- `runtime/project-agents/dispatch/index.ts` gained one line (`export * from "./scope.ts"`), outside the brief's literal
  ownership: the imports rule fails a new file that reaches past a barrel, and the dispatch barrel did not export the
  scope. No other lane's files touch it.
- "Core's own single-subflow test path calls the same function": the test receives an already-submitted proposal, so
  the function both share is the single-subflow assembly (`automationStudioProjectSingleSubflowAssemble`); the rebuild
  puts the scope and the scoped submission in front of it, as the dispatcher and the builder loop do.
- `gateway-trace/wiring/host.ts` still opens the same store inline over its `pool()` option (by pool, not by service);
  left as is, since it is not a construction site this brief extracts from.
- The rebuild has a `plan` refusal stage (`project.whole_trial_not_this_plan`) that the downstream `CandidateRebuild`
  type lacks; the downstream switch must map it.
