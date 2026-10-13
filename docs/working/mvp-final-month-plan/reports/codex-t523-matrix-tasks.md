# t523 explicit recovery matrix tasks

Status: implemented; source/tests frozen for integration and owning checks. Worker codex-t517, 2026-10-13. Downstream paired fxwork/t523; sibling Core read-only73550acb. No commits, browser/process/provider work, whole suites or Core source edits.

Four production owners only: recovery-matrix/matrix-row.ts, matrix-rows.ts, run/run-matrix-case.ts and compile/compile-flow-script.ts. Adjacent tests: compile/tests/compile-flow-script.test.ts and tests/matrix-rows.test.ts.

Every one of14 cases now contains an explicit tester-authored taskInstructions string, checked against its manually authored script. These are literal intended browser tasks, not transformations of generated title, script summary, fixture goal or site oracle. Shared script variants still carry bounded intent appropriate to their interruption/entry/checkpoint/planned-failure cases. Existing selectors, site expectations, goalFacts, script exports, check definitions and model guidance remain unchanged.

The sole browser compiler caller passes that authored text independently of its generated display name. Compiler input requires taskInstructions; missing/nonstring/blank/>4000 trimmed characters refuses before webNodeRuntime or FluxIQ.create, so no Core instance/durable writes occur. Valid text is trimmed and persisted through the existing public saveFlowGenerationInstruction API; its actual returned instructionId becomes sourceInstructionIds for bootstrap adaptation. No low-level fabricated title instruction, fallback/coercion or task injection into existing user Flows.

New/updated owning tests assert all14 tasks are nonempty/title-independent, invalid runtime inputs never open Core, and an independent Core instance reads the exact authored body for each compiled graph. Existing assembly, validation, source-handle refusal, topology and control tests remain. No claimed model creation proof: these are hand-authored deterministic recovery test automations.

Validation observed: git diff --check passed. With actual built/restored Core/domain/test-contracts/test-evidence prerequisites, the two owning test bundles passed23/23 in18.10s, native exit0. Supervisor will merge current dev into the task before final package types/audit. No unchanged matrix/browser run performed. Worker may bundle only these two owning tests in ignored package scratch once compatible prerequisites exist; no whole runner suite.

Exact owning validation: from apps/extension, use existing esbuild to bundle the two test entries (recovery-matrix/compile/tests/compile-flow-script.test.ts and recovery-matrix/tests/matrix-rows.test.ts) into packages/test-runner/dist/owning-t523 with outbase=recovery-matrix, platform=node, format=esm, target=node22, packages=external and .mjs output. From packages/test-runner:

```text
node --test dist/owning-t523/compile/tests/compile-flow-script.test.mjs dist/owning-t523/tests/matrix-rows.test.mjs
```

These bundles remain ignored generated dist; no aliases, public-gate bypass or whole package test suite. Invalid task7cases prove zero FluxIQ.create calls;10 actual script compile cases retain existing control/graph checks and independently read persisted exact task text; remaining handle/case inventory checks pass. No fail-first runtime claim: dependency preparation completed after source fix, and only final owning tests were run. Source/tests remain frozen for root's dev merge/type/audit and independent tests.
