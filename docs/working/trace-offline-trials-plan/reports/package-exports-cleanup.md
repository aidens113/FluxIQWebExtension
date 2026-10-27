# t754 package exports cleanup

Status: UNIT READY — owned edits and narrow validation complete; awaiting supervisor verification/integration.

## Confirmed ownership before edits

Core: `scripts/automation-studio-scale-baseline.mjs`, `scripts/automation-studio-scale-certification.mjs`, `scripts/flow-compiler.mjs`, `packages/fluxiq/package.json`; adjacent tests if present.

Downstream baseline-owned paths:

- `scripts/run/panel-golden-path.mjs`
- `scripts/inspect-demo-llm-adaptation-readiness.mjs`
- `scripts/prepare-demo-llm-workspace.mjs`
- `scripts/run-demo-llm-exploration.mjs`
- `scripts/setup-demo-llm-key.mjs`
- `scripts/apply-demo-llm-exploration-adaptation.mjs`
- `scripts/apply-demo-llm-exploration-proposal.mjs`
- `scripts/apply-demo-llm-exploration-request.mjs`
- `scripts/control-demo-llm-adaptation.mjs`
- `scripts/inspect-demo-llm-adaptation-run.mjs`
- `scripts/inspect-demo-llm-applied-creation.mjs`
- `scripts/inspect-demo-llm-exploration-adaptation-readiness.mjs`
- `scripts/inspect-demo-llm-exploration-request.mjs`
- `scripts/inspect-demo-llm-pending-creation.mjs`
- `scripts/record-demo-workspace.mjs`
- `scripts/reject-demo-llm-exploration-adaptation.mjs`
- `scripts/revert-demo-llm-applied-creation.mjs`
- `scripts/revert-demo-llm-exploration-adaptation.mjs`
- `scripts/run-demo-llm-adaptation.mjs`
- `scripts/run-demo-llm-applied-replay.mjs`
- `scripts/run-demo-llm-creation-readiness.mjs`
- `scripts/run-demo-llm-creation-settings.mjs`
- `scripts/run-demo-llm-creation.mjs`
- `scripts/run-demo-llm-diagnosis.mjs`
- `scripts/run-demo-llm-exploration-adaptation.mjs`
- `scripts/run-demo-llm-exploration-baseline.mjs`
- `scripts/run-demo-llm-exploration-request-flow.mjs`
- `scripts/run-demo-workspace-flow.mjs`
- `scripts/run/ui-e2e.mjs`
- `scripts/validate-demo-llm-exploration-adaptation.mjs`
- `domain/src/runtime/llm-evidence/node-run/tests/arrival.test.ts`
- `scripts/demo/launcher-failure.mjs`
- `scripts/lab/live-campaign/selection.mjs`
- `scripts/lab/scenario-guard/lab-scenario-refusal.mjs`
- `scripts/setup-demo-local-env.mjs`

Additional authorized manifests: downstream `packages/test-runner/package.json`; both root `package.json` and `pnpm-lock.yaml` for explicit owning package dependencies and normal scoped install/links. Adjacent tests may be edited/added when needed. No source runtime modules or baseline writes.

## Discovery

- Baselines name three Core scripts and 35 downstream paths (34 scripts and one domain test). No module-reach baseline section exists.
- Core DSL already exports its needed entry; testing and evidence-build-scope require exact exports. The domain regression must still load a second copy using a query on the resolved public module URL.
- Root manifests do not declare owning package dependencies and root node_modules has no corresponding links; supervisor authorized manifest/lock/install updates.
- Scenario guards intentionally load a dependency-free erasable TypeScript module before any build. Preserve that behavior through an explicit source-backed realistic-scenarios export.
- Most demo launchers lack help and otherwise start builds or write state. Add safe module-loading help paths before operations; never execute their live defaults.
- Logs will be external: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-21/codex-t754-review`.

## Implementation progress

- Supervisor reported lifecycle initial paired builds complete/native 0 and authorized edits. No shared plan, source runtime module or baseline changed.
- Core scripts import `fluxiq/automation-studio/testing` and existing `fluxiq/automation-studio/dsl`. New manifest exports: `./automation-studio/testing` and `./automation-studio/evidence-build-scope`. Root devDependency `fluxiq: workspace:0.7.0` explicitly selects the framework package instead of the identically named root workspace.
- Runner manifest adds 11 exact exports: `target-config`, `demo-workspace`, `panel-golden-path`, `demo-llm-exploration-request`, `realistic-scenarios`, `demo-llm-adaptation-readiness`, `demo-operation-status`, `demo-llm-attestation`, `ui-e2e`, `demo-workspace/launcher`, `windows-acl`. `realistic-scenarios` intentionally resolves existing dependency-free `src/realistic-scenarios/index.ts` so guards still run before build output exists; all other exports name normal dist outputs.
- Downstream root explicitly depends on runner (`workspace:*`) and framework (`link:../!FluxIQ/packages/fluxiq`). Setup-local's framework load now uses its public root export. Domain arrival regression resolves public evidence-build-scope then adds only a URL query, retaining its second-copy identity assertion without composing any private file path.
- All 31 launchers now accept `--help` before builds, environment loading or state changes. The help path imports their exact public modules, exercising actual Node package resolution without opening a browser or executing a model call. Three helper modules retain ordinary function-only behavior and are checked through adjacent owners.
- Downstream scoped install `pnpm.cmd install --offline --ignore-scripts --no-frozen-lockfile --filter .` native 0, six root-importer lock lines added only. Core same command native 1 because offline metadata for existing locked `@arethetypeswrong/cli@0.18.5` is absent; retry using `--prefer-offline` underway. External logs `downstream-install.log`, `core-install.log`, `core-install-network-metadata.log`.
- Core metadata retry native 0; lock diff exactly three root-importer lines for the new local framework dependency, with no package upgrades. New root links resolve to the owning paired packages.
- All package inputs frozen before final owning builds. Core contracts/fluxiq/gateway narrow build started (`core-build.log`). Core package types and docs check started in parallel; downstream core-mirror native 0 (`core-types.log`, `core-docs-check.log`, `core-mirror.log`).
- Downstream package-exports-only audit native 0, zero warnings/zero baselined (`downstream-package-exports-initial.log`). Baseline remains untouched for supervisor regeneration. Guard/campaign adjacent owners native 0 (`node --test scripts/lab/live-campaign/tests/selection.test.mjs scripts/lab/scenario-guard/tests/lab-scenario-refusal.test.mjs`, `guard-owner-tests.log`), including the real prebuild launcher refusal/no-state-write check.
- Core owning build native 0 with valid stamp (10,246 files, 273,955 ms). Core package typecheck native 0; docs check native 0, generated framework reference current. Both full audits native 0: Core 441 warnings/1,152 baselined, downstream 220 warnings/616 baselined; exactly the 3 and 35 package-exports entries disappear from active findings, with no new findings. Baselines themselves remain supervisor-owned.
- Domain owning arrival regression native 0: 22/22 tests, including the separate-copy function identity assertion; domain source/test checks native 0. Logs `arrival-owner.log`, `domain-types.log`. Runner owning build/check underway; its normal domain prerequisite rebuilt once and stored 1,524 files, with no broad workspace build.
- Each Core switched script has a real passing smallest command: `node scripts/automation-studio-scale-baseline.mjs 1`; `node scripts/automation-studio-scale-certification.mjs` (template only); `node scripts/flow-compiler.mjs --check <external exports-smoke.flow.ts>`. Logs `core-baseline-smoke.log`, `core-certification-smoke.log`, `core-compiler-smoke-generated.log`, native exits all 0. The first handwritten smoke fixture was correctly refused `flow.source_unsupported_module_shape` because the DSL requires a JSON-compatible exact module template; regenerated it using the owning public `compileFlowDefinition`/`generateFlowTypeScript` functions. Initial native 1 remains in `core-compiler-smoke.log`; no product code changed for the test fixture error.
- Runner owning build native 0, valid 2,326-file stamp (83,218 ms); runner package typecheck native 0 (44,179 ms). Logs `test-runner-build.log`, `test-runner-types.log`. Started external `launcher-smokes.mjs` harness: each changed top-level launcher runs its actual `--help`, with individual logs; the three function-only helper modules are covered by guard/selection owner tests and a public failure-describer/redaction smoke. No live launcher default is invoked.
- External launcher smoke harness native 0: all 31 actual `node <owned script> --help` subprocesses native 0. Launcher helper successfully loads the newly exported describer and preserves credential redaction/first-line-only detail. Summary `launcher-smokes.log`, harness `launcher-smokes.mjs`, individual logs named by replacing each script path's `/` with `_` and `.mjs` with `.log`. No browser, environment file, provider or workspace setup operations ran.
- Final both-tree `git diff --check` native 0. Final downstream Core freshness gate native 0. All launched commands collected/completed; final node/browser process inspection found no process referencing the paired t754 trees or external review harness.

## Final contract and supervisor handoff

Exact changed source paths are the 3 Core scripts and 35 downstream paths listed above, plus Core `packages/fluxiq/package.json`, downstream `packages/test-runner/package.json`, and both root manifests/locks. This own report is the only worker-authored documentation. No source runtime implementation was changed or copied. The supervisor-created `codex-t754-brief.md` remains outside the worker's authorship.

The exports are additive, exact public subpaths. Normal launcher behavior is preserved; `--help` now explicitly loads its dependencies and exits safely before work. Source-backed realistic scenario guards retain their existing Node TypeScript-loading requirement and independence from dist output. The arrival test still requires a genuinely distinct module copy sharing Core's process frame, and passed that assertion. Root framework dependency is pinned to workspace version 0.7.0 solely to distinguish it from the identically named 0.1.0 root workspace.

Supervisor baseline regeneration remains: remove precisely Core's 3 `package-exports` keys and downstream's 35 keys listed in confirmed ownership. Both rules have zero active findings; full audits show exactly those 38 fewer baselined findings and no new violations. This worker did not write either baseline. No `module-reach` baseline keys existed.

All final native gates pass: paired Core owning build/typecheck, runner owning build/typecheck, domain source/test typecheck and 22 arrival cases, 8 adjacent guard/selection tests, 31 launcher help commands plus failure helper, 3 Core real script commands, both full audits, Core docs check and downstream mirror/freshness checks. No unresolved actual failure. Earlier offline metadata and handwritten smoke-fixture failures are retained honestly above and resolved without product runtime changes.

Validation deliberately excludes live/paid launcher execution, browsers, user panel management, complete package test suites and daily sweeps. Module-loading help plus owner tests proves public import compatibility and pre-work refusal behavior; it does not claim a newly executed live automation session. All evidence remains external at `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-21/codex-t754-review` after task-tree removal. Native statuses were captured immediately from `$LASTEXITCODE`, not inferred from PowerShell redirection status.

UNIT READY
