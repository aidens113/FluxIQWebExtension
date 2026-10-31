# Narrow task setup support fix

Outcome: Done

Changed in `C:/Users/osrs_/FluxStuff/fxwork/t823/!FluxIQWebExtension`:
- `scripts/task/command-options.mjs`: start-only `--skip-workspace-build` option.
- `scripts/task/command-line.mjs`: forwards `skipWorkspaceBuild` boolean.
- `scripts/task/start.mjs`: skips only the downstream `runPnpm(created.root, ["build"])` call when requested, preserving Core preparation/current-commit checks and other guards. Reports `workspaceBuild` as `ran`, `skipped`, `planned` (dry-run default worktree), or `not-required` (branch-only). Added a narrow provisioning-operation seam for tests.
- `scripts/task/run-task.mjs`: documents the flag and remaining preparation.
- `scripts/task/tests/{arguments,command-line,start}.test.mjs`: parser ownership, forwarding/dry-run output, shared/paired Core preparation, default build callback, skipped build callback, currency refusal and dirty-checkout refusal.

Validation: `node --test scripts/task/tests/arguments.test.mjs scripts/task/tests/command-line.test.mjs scripts/task/tests/start.test.mjs` -> 27 tests passed, 0 failed, exit 0 (10.99 seconds).

Not verified: real workspace build, actual task worktree provisioning, other task tests, full suite, structure audit. All expensive provisioning/build callbacks in new execution-path tests were replaced; git writes occurred only in the tests' usual throwaway repositories. No source/Core edits, live task launches, panel/browser operations, APIs, or real repository git mutations.

Notes: Changes are uncommitted for lead review/integration. Default workspace-build behavior is unchanged. Dry-run result objects gain an explicit workspaceBuild status.
