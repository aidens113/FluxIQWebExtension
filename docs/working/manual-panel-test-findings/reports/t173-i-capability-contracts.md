# t173-I: chat capability contracts against Core's real handlers

Worker report for brief t173-I. Core `apps/web`, branch `task/t173-audit-close` in `F:\!FluxIQ`. Nothing was committed.

## Outcome

Done. `core-contract.test.ts` passed 54 of 54 tests; it started at 19 failed and 35 passed. The capability contract line reads `47/47 variants accepted by Core across 39 capabilities`. All 12 test files under `conversation/` passed (161 tests). The web type check exits 0, and Core's structure audit passes.

## What changed and why

For each failure, the table says whether the capability or the test world was at fault. All paths are under `apps/web/src/features/automation-studio/conversation/capabilities/`.

| Failure | Verdict | Fix |
| --- | --- | --- |
| `version.publish`, `version.deprecate` | Capability defect | `catalog/versions.ts`: removed the `PIN` argument and `authorizationPin` from both requests, and removed "Asks for your PIN first." from deprecate's summary. Core classes both endpoints as `authoring`. |
| `project.create`, `project.rename` | Capability defect | `catalog/projects.ts`: removed `PIN` and `authorizationPin`. Both endpoints are `authoring`. |
| `recording.note` (note and marker), `recording.rename` | Capability defect | `catalog/recordings.ts`: removed `PIN` and `authorizationPin`. Also, the marker request no longer sends `linkedEntryIds: []`. Core's marker takes only a single optional `linkedEntryId` and never read the list, which the test showed once the PIN was out of the way. |
| `permission.revokeClient` | Capability defect | `catalog/running.ts`: the consequence is now `modify_existing` (it was `delete`), and the capability no longer takes or sends a PIN. Core classes `revoke-client-trust` as `authoring`. |
| `permission.check`, `permission.allowModelRun` | Capability defect: no `keyId` | `catalog/running.ts`: both capabilities now read the Flow first with `get-flow`. They take `keyId` from `metadata.llmSecretKeyId`, and the provider and model from `llmProvider`/`llmModel`, which is where the panel's build button gets them (`blank-flow-authoring-model.ts`). `get-flow` is added to both capabilities' `endpoints`. Both take an optional `purpose` argument (the shared `PURPOSE`). With no key chosen, they fail with a sentence that says to choose one in Flow settings. |
| `route.delete` | Capability defect | `catalog/settings.ts`: sends `ruleId` (taken from the `routeId` argument), because Core reads `ruleId`. The consequence is now `modify_existing` and there is no PIN, because Core classes `delete-flow-map-route` as `authoring`. |
| `flow.instruct` | Capability defect | `catalog/flows.ts`: sends `title` and `body` in place of `text`. `title` is a new optional argument. When it is left out, the title is the first sentence of the instruction's first line, cut to 80 characters (`instructionTitle`). |
| `flow.build`, `permission.allowModelRun`: "runtime is unavailable" | Test-world gap | `tests/core-contract-world.ts`: the service now has a native node runtime (Core's built-in control nodes plus one executable `contract.action`) and a scripted `llmProviderResolver`. The scripted model returns a minimal Start→End plan, as Core's own `service-bootstrap/tests/adaptation.test.ts` does. `flow.build` now **succeeds end to end**; it is not excused. |
| `flow.describe`, `flow.build`: "Flow without a Router" | Test-world gap | The world seeds a second, blank Flow (`ids.blankFlowId`) with a model key and a saved generation instruction. The build grant is now bound to this Flow. `tests/core-contract-arguments.ts` points `flow.describe`, `flow.build` and `flow.explore` at it through an "on a blank Flow" override. |
| `subflow.delete`: "Remove this Subflow from Router routes" | Test-world gap | The seeded route now targets a third part ("In stock"), so the part that `subflow.delete` removes is not referenced by any route. |
| `flow.explore` | Refusal is correct product behaviour | `tests/core-contract.test.ts` has one `EXPECTED_REFUSALS` entry. It matches exactly `Flow Bootstrap generation failed (flow_bootstrap.evidence_runtime_unavailable).`, and a comment explains why. An exploration needs a paired browser's evidence tools. Core refuses in the service, after the handler has read every field and checked the grant, so the check that every sent field was read still applies. |
| Aggregates | Resolved | They passed once the capability fixes above were in: every declared endpoint reached, the PIN matching Core's classification, and a PIN argument only where the capability asks first. |

Two more edits:

- **`tests/registry.test.ts`.** "Asks only where something is deleted" had the old asking list hard-coded. It now leaves out `permission.revokeClient` and `route.delete`, with a comment giving the reason.
- **Supervisor's mid-task request.** I changed the `AutomationStudioNativeNodeRuntime` import in `core-contract-world.ts` to come from the `runtime/index.ts` barrel. It had been imported directly from `runtime/native-node-runtime.ts`. The structure audit is now clean for my files.

## Commands run and observed results

All were run in `F:\!FluxIQ` or `F:\!FluxIQ\apps\web`.

- **Baseline.** `npx vitest run src/features/automation-studio/conversation/capabilities/tests/core-contract.test.ts` gave `Tests 19 failed | 35 passed (54)`, the same failures the audit lists.
- **After the capability and world fixes.** The same command gave `1 failed | 53 passed`; the one failure was `recording.note [marker]` with "never read linkedEntryIds[]". After I fixed that: `capability contract: 47/47 variants accepted by Core across 39 capabilities`, `Tests 54 passed (54)`.
- **`node scripts/structure-audit.mjs`.**
  - First run: two failures. One was my deep import. The other was `runtime/llm/tests/` with 26 files, which is not my file.
  - After the barrel import: `structure-audit: passed (194 warning(s), 355 baselined)`, exit 0. It printed the same result on the final tree.
- **`npx vitest run src/features/automation-studio/conversation`.**
  - First run: `1 failed | 160 passed`. The failure was the pin in `registry.test.ts`.
  - After updating that test: `Test Files 12 passed (12)`, `Tests 161 passed (161)`.
- **`npx tsc --noEmit -p apps/web/tsconfig.json`.** Exit 0, and the same on the final tree.

## Not verified

- No live browser or panel check of the changed capabilities.
- No repository-wide `pnpm check`, `pnpm test` or `pnpm build`, as the brief said.
- `flow.explore` has not been shown to succeed. There is no evidence runtime in the world, so it is excused as described above.
- The `instructionTitle` heuristic has no unit test of its own; the contract test only exercises it through `flow.instruct`.
- `permission.check` and `permission.allowModelRun` now make an extra `get-flow` round trip. I did not measure its latency.

## Open questions or contradictions found

- **Destructive or authoring.** Core classes `revoke-client-trust` and `delete-flow-map-route` as `authoring`. The panel had treated both as destructive and asked for a PIN. I aligned the catalog with Core, as the brief directs. If product wants a PIN for these, the fix belongs in Core's classification (`packages/fluxiq`), not here.
- **Core working tree.** The working tree already had uncommitted edits under `packages/fluxiq` that are not mine: `generation-failure/*`, `llm/loop-budget.ts`, `evidence-loop/resume.ts`, and tests. I believe another worker made them. I did not touch them.
- **Structure audit.** At the end it prints "1 baseline entries can be lowered". That is not from my files, and I did not run `pnpm structure:baseline`.
