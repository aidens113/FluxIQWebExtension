# Runtime Ownership And Web Boundary Refactor

Status: Active
Status detail: First capability group package and focused browser checks pass; paired dev integration next; remaining runtime and final reusable chat UI phases required.
Created: 2026-11-01
Last updated: 2026-11-02
Owner: Senior supervisor agent
Scope: Separate framework runtime from Automation Studio ownership and audit all downstream web boundaries.
Paired document: ../!FluxIQ/docs/working/runtime-ownership-refactor.md
Related: [repository layout](../architecture/repository-layout.md)

## Current State

User authorized the complete Core/downstream ownership audit and refactor with Core workers, followed by the reusable chat widget package. Work is isolated on paired task/t842-runtime-boundary-refactor branches under C:/Users/osrs_/FluxStuff/fxwork/t842; these belong to the original repositories, not separate cloned histories. Original downstream changes are preserved.
Core owns neutral framework/runtime mechanisms; downstream owns active browser/DOM/selector/tab interpretation. Existing public entry points forward to canonical implementations for compatibility.
Implemented first capability group: neutral contracts, canonical automation nodes and engine/host support, provider/model and agent primitives, executable DSL/validation, and downstream calibrated web matcher with explicit domain registration.
Core package typecheck and library build pass. Selected Core run passed 2,350 tests and found eight failures; all five affected files subsequently passed their 22 tests after verified fixes. The preexisting cache test oracle was separately reproduced on original dev and corrected without production behavior changes.
Downstream: domain build/check and 55 host tests passed; the latest additional focused domain selection passed 80 tests. Test runner build/check and 32 persisted-run tests passed. Extension check passes from its valid build-cache stamp.
Exact matcher parity against original dev passed 582 comparisons; source-aliased identity/resolver checks passed 222 tests. The 34-case realistic-site Chromium identity selection now passes after correcting demonstrably stale test stimuli/expectations, with original calibrated scores and safety oracles preserved; independent lead Chromium rerun of all nine repaired cases passed (47.7 seconds).
Structure: Core full audit/pre-push gate passes; baseline only shrank (seven lowered, 33 removed). Downstream test responsibilities/helpers are split and the full structure audit passes with zero failures. Mirror check confirms 72 audit files match Core.
No paid runs, live providers, panel management or full daily sweeps started.
Core first-group commits are backed up on origin/task/t842-runtime-boundary-refactor. Next: finish independent browser verification, integrate/push this coherent first group to both real dev checkouts, then start paired follow-on work with the prepared R1/R2/R4/R5 briefs.
Remaining source work is explicitly required: SDK/native/adapter binding; environment/run control/resources; IO/graph options; compiled/composite execution; shared state/recording/gateway/normalization; router/gates/context; reusable authoring/repair/verification; remaining active browser semantics. Do not claim the audit/refactor complete at this checkpoint.
User requirement (2026-11-02): AFTER fully completing both repositories' audit/refactor, extract extension chat stream UI/component data to a separate reusable Core package (tentatively @fluxiq/ui-components), usable by any project/client. The extension consumes the standardized widget through downstream browser bindings. This is required continuation work.

## Phases

1. Inventory Core Automation Studio responsibilities, consumers and dependency cycles.
2. Inventory downstream ownership and web-specific code incorrectly retained by Core.
3. Refactor verified misplaced code into owning layers, preserve existing public exports and add mechanical boundaries.
4. Verify touched packages, focused regression tests and structure checks; document compatibility and integrate both repositories.

## Work Ledger

### 2026-11-02 ? First extraction acceptance
- Agent: senior supervisor
- Changed: canonical execution group, downstream matcher migration, explicit capture boundary and cohesive test support; prepared remaining source briefs and R6/R7 ownership plans.
- Validation: Core `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/extraction-vocabulary.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/issue-feedback.test.ts` -> three files, 70 tests passed.
- Validation: downstream test-runner and extension checks after latest Core build -> exit 0; both rebuilt successfully rather than relying on an outdated stamp.
- Validation: `node --test packages/test-runner/dist/flow-lane/tests/persisted-flow-run.test.js packages/test-runner/dist/flow-lane/tests/target-resolution.test.js packages/test-runner/dist/flow-lane/repair/tests/run-repair-lane.test.js` after cohesive helper/test split -> 67 passed, zero failed.
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/extension test:content -- --workers=2 identity-resolution.spec.ts identity-ambiguity.spec.ts identity-veto.spec.ts` -> actual complete output: 34 passed; independent lead run of the same specs with the nine repaired cases selected by --grep -> nine passed, zero failed (47.7 seconds). Earlier failures exposed stale retry/place-context expectations; production scoring/target/retry logic unchanged.
- Validation: Core task branch commit and push -> succeeded; paired dev/main not yet merged or pushed.
- Outcome: Partial
- Follow-up: independent browser result and paired narrow-gated integration, then all remaining required source groups and final reusable UI package.


### 2026-11-02 ? Package integration and browser gate
- Agent: senior supervisor
- Changed: canonical capability integration, explicit capture result handling and domain matcher registration; focused test support split.
- Validation: Core `pnpm.cmd --filter fluxiq check` and `pnpm.cmd --filter fluxiq build` -> exit 0.
- Validation: Core selected regression runner -> 2,350 tests passed, eight failed; subsequent exact five affected-file rerun -> 22 passed, zero failed. Original dev reproduced stale cache oracle before correction.
- Validation: `pnpm.cmd --filter @fluxiq-web-extension/domain test element-fingerprint/tests output-nodes/tests/native-runtime output-nodes/tests/definitions actions/action-effect/tests runtime/tests/state-routing-run` -> 80 passed, zero failed.
- Validation: `node --test packages/test-runner/dist/flow-lane/tests/persisted-flow-run.test.js` -> 32 passed, zero failed (before cohesive support split).
- Validation: downstream test-runner and extension package checks -> exit 0, valid cache stamps reused.
- Validation: realistic-site Chromium identity-resolution/ambiguity/veto selection -> failures observed; investigation active, not accepted as passing.
- Outcome: Partial
- Follow-up: resolve browser failures, rerun split tests and structure gates; paired first-group integration, then all remaining phases including final shared UI package.


### 2026-11-02 — Required reusable chat UI package
- Agent: senior supervisor
- Changed: paired working documents; added explicit user-requested completion phase.
- Why: after the full audit/refactor of both repos, move the extension chat stream UI/component data into a separate reusable Core package, tentatively `@fluxiq/ui-components`, usable by any project/client; extension consumes it through browser-specific bindings.
- Validation: not validated; requirement recorded before implementation.
- Outcome: Partial
- Follow-up: execute only after the existing full audit/refactor phases, preserving stream behavior and keeping extension/browser APIs outside the shared package.

### 2026-11-01 — Begin t842
- Agent: senior supervisor
- Changed: paired plan and discovery briefs.
- Validation: not validated; initial dispatch only.
- Outcome: Partial

### 2026-11-01 — Verify shared tooling boundary
- Agent: senior supervisor
- Changed: audit report and canonical node import migration (72 downstream consumers).
- Why: confirm current tooling ownership rather than relying on old audit claims.
- Validation: `node scripts/check/core-mirror.mjs` -> structure-audit (72 files) match Core.
- Validation: `node --test scripts/core-scripts/tests/core-copies.test.mjs scripts/core-scripts/tests/import-core-script.test.mjs` -> 8 passed, 0 failed.
- Outcome: Accepted
- Follow-up: downstream package checks after new Core build.

### 2026-11-01 — Independent web matcher calibration checks
- Agent: senior supervisor
- Changed: web-owned scorer and Core matcher adapter boundary.
- Validation: domain `node node_modules/.cache/matcher-migration/parity.mjs` -> 582 exact score/rank/selection/projection comparisons passed; all default weights identical.
- Validation: domain `node node_modules/.cache/matcher-migration/identity.mjs` -> 25 entries, 222 tests passed, 0 failed.
- Outcome: Accepted
- Follow-up: normal package runners and realistic-site browser checks after Core rebuild; source-aliased checks are not package integration proof.


## Worker Briefs

Written briefs are under `runtime-ownership-refactor/briefs/`; each worker owns only its named report or source paths.
Core discovery: core-runtime and core-web. Downstream discovery: extension-boundaries.
Core implementation: runtime-contracts. Architecture review: execution-architecture.
Node implementation: node-ownership. Additional web audit: fingerprint-boundary.

## Decisions

- Existing Studio-prefixed names and persisted discriminator strings remain compatible.
- Framework execution consumers exist downstream; Studio naming does not establish program ownership.
- Executable graph types belong in flows/executable; neutral nodes in components/automation; executor in engine/automation.
- Studio retains editor/project APIs, persistence and product-specific authoring composition; shared execution support moves with its kernel.
- Framework owners must not import Studio, including type dependencies; the structure gate enforces the cut.
- Browser DOM producers and concrete web behavior remain downstream; generic web-panel rendering/HTTP transport are Core host concerns.

## Open Questions

No decisions requiring the user. Engine, provider/agent and web matcher ownership are implementation work.

None requiring user input.
