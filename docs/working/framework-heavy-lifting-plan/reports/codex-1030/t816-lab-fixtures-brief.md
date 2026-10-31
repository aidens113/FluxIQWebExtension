# t816 Lab fixture migration

Role: Standard worker; gpt-6.1-sol, medium. Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t816/!FluxIQWebExtension`.
Goal: repair the ten observed non-live-llm test failures after the intentional Claude/$5 default migration.
Read `test-runs/t816-unit/lab-paths.log` for exact fail-first evidence and Current State of `docs/working/claude-live-provider-plan.md`.
Owned files only:
- packages/test-runner/src/demo-llm-create-ui/tests/{exploration,readiness-gate}.test.ts
- packages/test-runner/src/demo-workspace/tests/adaptation-lane.test.ts
- packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts
- packages/test-runner/src/flow-lane/creation/tests/fake-creation-core.ts (default-provider fixture only)
- packages/test-runner/src/tests/{demo-llm-creation,demo-llm-live,environment}.test.ts
Do not touch production, live-llm/tests, shared docs, package manifests, git or Core. Preserve explicit legacy-provider cases.
Expected: default Claude model/provider pair, whole-build $5; lower explicit limits retained; wrong provider/model and over-budget still refused.
Correct stale fixture metadata/expectations, use budget-derived overage, keep rejection assertions meaningful. Never weaken production/oracles.
Do not build while lead edits live tests. Return source ready; lead builds then you can run only seven owning compiled tests.
No browser, paid calls, real credentials, panel management or full suites.
Report: main checkout `docs/working/framework-heavy-lifting-plan/reports/codex-1030/t816-lab-fixtures-result.md`.
End with Outcome/Changed/Validation/Not verified/Report/Notes contract.
