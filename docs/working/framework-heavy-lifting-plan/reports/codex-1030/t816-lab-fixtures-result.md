# t816 Lab fixture migration result

Status: Done. Source and compiled output remain frozen after the coordinated rebuild.

## Scope and cause

The supplied `test-runs/t816-unit/lab-paths.log` recorded 241 tests, 231 passing and ten failing in 36.525 seconds. The failures followed the deliberate Claude/default-budget migration: stale $0.25 creation expectations, stale key/UI source assertions, stale default-provider fixture metadata, stale provider-specific refusal text, and an over-budget value that was below the new $5 allowance.

The lead explicitly extended the seven-test-file brief to permit `packages/test-runner/src/flow-lane/creation/tests/fake-creation-core.ts`. That helper combined a hardcoded DeepSeek provider with the new default Claude model; correcting its accounting pair fixes the already-correct build-proposal assertion. No production source, scenario, oracle, manifest, shared working document, Core source, live-llm test, or git state was changed by this fixture pass.

## Changes

- `packages/test-runner/src/demo-llm-create-ui/tests/exploration.test.ts`: derive default creation costs from the shared Lab budget, keep aggregate cost rejection above the actual allowance, and preserve the existing token/run bounds.
- `packages/test-runner/src/demo-llm-create-ui/tests/readiness-gate.test.ts`: require the Claude Testing Lab key and default budget; retain the legacy key-name constant assertion and expand secret-boundary checks to Claude/Anthropic environment names.
- `packages/test-runner/src/demo-workspace/tests/adaptation-lane.test.ts`: keep wrong-provider and wrong-model inputs, matching the current default pair in the precise rejection message.
- `packages/test-runner/src/flow-lane/creation/tests/fake-creation-core.ts`: return the matching default provider/model accounting pair. The owning build-proposal test remains semantically unchanged.
- `packages/test-runner/src/tests/demo-llm-creation.test.ts`: use the shared default cost allowance; derive rejected usage/cost from the evaluator's actual budget and keep input/output token totals coherent so those failures prove the limit itself.
- `packages/test-runner/src/tests/demo-llm-live.test.ts`: require the Claude key and default provider/model UI selectors; expand the launcher secret-boundary check. The explicitly configured $0.25 diagnosis profile stays $0.25.
- `packages/test-runner/src/tests/environment.test.ts`: use synthetic Claude credential metadata and matching returned key provider. The explicit $0.10 authorization remains unchanged.

Default-provider substitutions already present when this brief started remain intact, including the existing `build-proposal.test.ts` expectations. No real credential was accessed; provider calls and paid cost are both zero.

## Validation

- `git diff --check` in the t816 downstream worktree -> exit 0; only the lead-owned plan's existing CRLF normalization warning.
- Reviewed the complete diff for the owned fixture changes -> default relationships, wrong-provider/model refusals, secret exclusions and lower explicit budgets preserved.
- The lead reported fresh downstream typecheck/build passed and froze the compiled output before this worker's test run. This worker did not launch another build or mutate source after that signal.
- `node --test --test-concurrency=1 packages/test-runner/dist/demo-llm-create-ui/tests/exploration.test.js packages/test-runner/dist/demo-llm-create-ui/tests/readiness-gate.test.js packages/test-runner/dist/demo-workspace/tests/adaptation-lane.test.js packages/test-runner/dist/flow-lane/creation/tests/build-proposal.test.js packages/test-runner/dist/tests/demo-llm-creation.test.js packages/test-runner/dist/tests/demo-llm-live.test.js packages/test-runner/dist/tests/environment.test.js` -> exit 0, 69 tests passed, zero failed/cancelled/skipped/todo, 40.6125052 seconds. All ten supplied fail-first cases passed.

The requested compiled test set is the seven files named in the brief: exploration, readiness-gate, adaptation-lane, build-proposal, demo-llm-creation, demo-llm-live, and environment. No full suite, browser, paid call, panel management or git mutation was run.

Outcome: Done
Changed: Seven fixture files listed above, including the approved fake-creation-core helper; existing default-pair edits in build-proposal.test.ts preserved; this report.
Validation: The exact seven-file compiled Node command above -> 69 passed, 0 failed, 40.612 seconds; git diff --check -> exit 0.
Not verified: Broader Lab acceptance, browser/live Claude behavior, real credentials, and package type/build checks independently by this worker; the lead owns those checks.
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/t816-lab-fixtures-result.md
Notes: Core 0.9.0 source/library and downstream source/output stay frozen. No commits or pushes by worker. Provider calls 0; paid cost $0.
