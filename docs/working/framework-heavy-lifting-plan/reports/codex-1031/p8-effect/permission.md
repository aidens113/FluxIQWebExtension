# P8 trusted permission floor

Outcome: Done (bounded implementation and named tests; source frozen for lead acceptance)

Core source: `C:/Users/osrs_/FluxStuff/fxwork/t824/!FluxIQ`.

## Findings and implementation

- Both `AutomationStudioActionPermissionGate.checkFor` and `automationStudioActionPermissionDenied` discarded consequences solely on legacy `effect: observe`. They now use one permission-owned projection which unions trusted client classes before applying the read exemption. State and commit floors prevent that exemption; neither class alone invents a permission class.
- Gate requests and declaration records carry the same effective union. True reads and clients without the new floor retain the existing empty consequence/disregarded shape.
- Bootstrap reset, inverse-target and witness paths read the same normalized declaration, keeping baseline and witness checks in force for a client floor.
- Canonical plan resolution now accepts optional trusted registry/callback sources. Bootstrap completion and the service generation fallback pass their canonical registry. Recovery and learned interruption projection reuse the runtime peer's `graphOptions.resolveActionEffect` callback through a typed minimal native node. Raw predicate values remain present before the domain rewrites parameters. A plan's own metadata is never read as an effect source.
- The accepted consequence union is saved on the plan node, and a refused callback cannot be ignored by a resolver returning `unchanged` or `resolved`. A canonical known class with no client permission declaration refuses with `requestId: null`; no target, control name, evidence or grant is invented. Commit/state alone invents no class or new playback prompt. Unchanged inherited approved nodes retain their existing exemption.
- The plan parser already strips raw model-authored reserved metadata. A separate lower-level normalization probe reproduced preserved metadata replacing the accepted union with `[]`. Accepted node consequences now win after preserved metadata while unrelated metadata and legacy absence remain compatible.

## Changed paths

Relative to Core `packages/fluxiq/src/programs/automation-studio/`:

- `runtime/action-permissions/{projection,index,gate}.ts`.
- New focused helpers `runtime/action-permissions/plan/{source,resolve,projection,index}.ts`.
- New owning tests `runtime/action-permissions/tests/client-floor.test.ts` and `runtime/action-permissions/plan/tests/projection.test.ts`.
- `runtime/flow-bootstrap/{action-permissions,adaptation}.ts` and `runtime/flow-bootstrap/tests/action-permissions-witness-notes.test.ts`.
- `runtime/llm/harness-options/{plan-parameter-resolution,bootstrap-completion}.ts`.
- `runtime/service.ts` (canonical registry on the one plan-resolution call only).
- `runtime/service/runtime-session/{interruption-learning,in-run-repair}.ts` (trusted callback propagation only) and `runtime/service/runtime-session/tests/interruption-learning.test.ts`.
- `runtime/recovery/annotation/step-evidence-resolution.ts` and its owning `tests/step-evidence-resolution.test.ts`.

## Observed validation

Working directory: Core `packages/fluxiq` in t824.

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/action-permissions/tests/client-floor.test.ts src/programs/automation-studio/runtime/action-permissions/tests/gate.test.ts --maxWorkers=2 --minWorkers=1` -> **2 files, 40 tests passed**, 1.51 s.

The 13 new cases cover both gate entries, observe/none beside a known client class, state/commit precedence, union/order, requested and recorded classes, permitted and declined cases, outstanding requests, instruction versus granted authority, evidence-grounded control naming, unknown class refusal, no invented class from commit, and truthful read/legacy compatibility.

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/action-permissions/plan/tests/projection.test.ts --maxWorkers=2 --minWorkers=1` initially passed **11/11**, 21.05 s, including actual accepted completion and normalization. Raw model metadata was stripped by the parser, so that initial path did not reproduce the suspected lower-level overwrite.

The same command after explicitly supplying preserved metadata to the accepted normalization input reproduced **1 failed, 10 passed**, 20.33 s: expected `["move_money", "delete"]`, received `[]` at the actual graph-node metadata assertion. The run reached accepted completion and graph normalization; the cause was the final preserved metadata spread overriding accepted classes. The source ordering is now corrected.

Final combined narrow command:

```text
pnpm.cmd exec vitest run src/programs/automation-studio/runtime/action-permissions/tests/client-floor.test.ts src/programs/automation-studio/runtime/action-permissions/tests/gate.test.ts src/programs/automation-studio/runtime/action-permissions/plan/tests/projection.test.ts src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions.test.ts src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions-witness-notes.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/plan-parameter-resolution.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/plan-step-consequences.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts src/programs/automation-studio/runtime/recovery/annotation/tests/step-evidence-resolution.test.ts src/programs/automation-studio/runtime/service/runtime-session/tests/interruption-learning.test.ts src/programs/automation-studio/runtime/service/runtime-session/tests/in-run-repair.test.ts --maxWorkers=2 --minWorkers=1
```

Observed: **11 files, 228 tests passed**, 36.05 s. This includes all original checks in the named files, the corrected real graph-node publication assertion, three bootstrap baseline/witness/inverse-target regressions, two recovery regressions and one learned-interruption regression. No real action, model provider, browser or panel was called.

After adding the two final legacy normalization cases and making hostile metadata fixtures type-safe with `Object.assign`, the same one-file projection command passed **1 file, 13 tests**, 20.92 s. The two additional cases prove an absent accepted declaration preserves legacy metadata, while explicit accepted `[]` overrides stale metadata. The accepted consequence union reaches the actual normalized graph node after the completion/authoring permission path.

## Remaining verification and scope

- Lead owns package typecheck and structure-audit acceptance. Neither was run here, as instructed while peers edit. No build or full suite was run.
- Executor/native dispatch, retries, host errors/timeouts and outside-graph propagation belong to the runtime peer, and were not exercised by this worker. Recovery and learned-interruption tests verify trusted callback consumption without dispatching an action.
- No live browser, API, paid model, panel or git command was run. Tests use local stand-ins and ignored test machinery only. No test process remains running.
- No shared contract/parser, runtime executor/native/graph-options, I/O policy, downstream source, version, export map or shared working document was edited. `runtime/action-permissions/index.ts` exposes the new owning helpers through its existing barrel; the lead owns any public package integration.
- Recovery/interruption propagation and the preserved-metadata normalization seam were explicitly approved by the lead beyond the initial brief. `service.ts` changes only the canonical registry argument on its existing plan-resolution call; `in-run-repair.ts` changes only the optional trusted callback argument.

Return contract:

```text
Outcome: Done
Changed: Core permission projection/gates; canonical plan projection and call-site wiring; bootstrap reset/witness/publication seams; owning tests (exact paths above)
Validation: targeted 11-file command -> 228 passed; final plan projection command -> 13 passed
Not verified: lead typecheck/structure acceptance; executor/native/outside-graph dispatch; live browser/provider behavior
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1031/p8-effect/permission.md
Notes: Source frozen. No builds/types/full suites/API/browser/panel/git. No model metadata is promoted to trusted authority.
```

## Lead-audit correction

The lead's final structural audit flagged the literal declaration spread in `runtime/action-permissions/tests/client-floor.test.ts`'s unknown-class fixture. That fixture now names its valid contract fields explicitly on `AutomationStudioActionDeclaration` and injects the intentionally invalid client class through `Object.assign`; the two unnecessary type assertions were removed. No production source or baseline changed.

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/action-permissions/tests/client-floor.test.ts --maxWorkers=2 --minWorkers=1` -> **1 file, 13 tests passed**, 1.35 s. Both gate entries still reject the known-plus-unknown client class list with no declaration/request recorded. Source is frozen again for lead audit acceptance; no builds, types, audit, full suites, API, browser, panel or git command was run by this worker.

The lead's package typecheck then found the instructed-authority fixture lacked the required `instructionDigest`. The fixture now computes it with the owning `automationStudioInstructionDigest({ title: "Refund", body: "Refund the charge" })` helper, binding the digest to the actual quoted instruction text. No cast, fake digest, production change or baseline change was introduced.

The same focused `client-floor.test.ts` command after that correction -> **1 file, 13 tests passed**, 1.54 s. Source is frozen; the lead retains the typecheck/audit rerun.
