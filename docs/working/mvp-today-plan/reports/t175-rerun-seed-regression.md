# t175 rerun-seed regression

Status: Complete

## Scope

- Repository: `F:\!FluxIQ`
- Owned source/test paths: the executor run-state/graph-run/node-execution seam and `representation.test.ts`
- No commits, builds, shared working-document edits, or Lab runs.

## Finding

The two failures were stale-fixture failures, not a rerun-seed regression.

The fixture failed `gate` by resolving a nonexistent state path. The current executor now records that outcome as `graph_validation_or_unknown_node` / `executor.parameter.unresolved_state_path`, correctly non-retryable. Runtime recovery consequently classifies it as a structural defect requiring manual intervention, so no runtime patch attempt exists. The earlier `runtimePatchAttempts === undefined` assertion failure occurred before any rerun.

The fixture now uses `builtin.random.choice` with an empty choice list and `allowEmpty: false`. That gives the test a repair-eligible failed execution attempt without changing its `left: 6`, `right: 3`, and `note` inputs. The model's temporary retry still starts at the disconnected `divide` node.

Both representations now prove the intended boundary:

- the rerun trace succeeds by dividing the failed attempt's live `6 / 3` inputs;
- using persisted `[withheld]` values would fail that division;
- the saved failed attempt still withholds all three supplied inputs;
- no supplied note appears in persisted files.

The rerun's verification reason is now `expectation_empty`, because the synthetic failed attempt has a derived but empty expectation. It remains `unverifiable` with `restoredExpectedState: false`; only `traceStatus: "succeeded"` proves the seed behavior.

No executor production change was needed.

## Files changed

- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\tests\service-flows\tests\representation.test.ts`
- This report.

## Validation

- `pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/tests/service-flows/tests/representation.test.ts`
  - Passed: 1 file, 10 tests, including both routed and legacy rerun rows.
- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/tests/graph-run.test.ts src/programs/automation-studio/runtime/executor/tests/node-execution.test.ts --reporter=verbose`
  - Passed: 2 files, 62 tests.

## Remaining

Supervisor should verify this test-only reconciliation against the integrated tree. Repository-wide checks and builds were outside this brief.
