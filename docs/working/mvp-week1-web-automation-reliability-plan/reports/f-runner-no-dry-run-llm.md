# f-runner-no-dry-run-llm: the Lab no longer switches Core's LLM on

Worker `f-runner-no-dry-run-llm`, 2026-09-13, this repository on `dev` (HEAD `30098dd`
plus other workers' uncommitted edits). Core was not read or edited.

## Outcome

Done. The Lab's `run-runtime-session` request no longer carries `dryRunLlm: true`. It
still sends `adaptiveMode: "deterministic"` and `authorizedExternalSideEffects: false`.
The test row now pins a request body without the flag. Putting the flag back fails that
row.

## What changed and why

- `packages/test-runner/src/existing-fluxiq-control.ts:250`: removed `dryRunLlm: true`
  from the `runPersistedFlow` request body. `i-harness-activation` traced it: Core's run
  override sets `invokeLlm`, `runRecovery` and `createAdaptations` back to true when
  `dryRunLlm === true`. So every failed Flow run recorded a `runtime_diagnosis` request
  that failed with `llm.provider_missing`, which the runner counts as a harness
  activation.
- `packages/test-runner/src/tests/existing-fluxiq-control.test.ts:259`: the expected body
  no longer contains `dryRunLlm`. The file imports `node:assert/strict`, so `deepEqual` is
  `deepStrictEqual`. An extra key fails it, as the mutation below shows. No separate
  absence assertion was added.
- **Was the flag a Lab requirement? (brief task 2.)** No.
  - `git log -S dryRunLlm -- packages/test-runner` returns one commit: `5e9d97e`
    (2026-09-04), the testing facility's first commit. Its message gives no reason.
  - The same commit's `docs/architecture/testing-facility.md` says the runner "starts and
    runs the persisted Flow in deterministic/dry-LLM mode with external side effects
    disabled". It is still at line 368.
  - So the stated intent was "no LLM", which Core's override does the opposite of.
    Removing the flag serves that intent.
  - Both callers are ordinary Lab Flow runs: `flow-lane/persisted-flow-run.ts:158` and
    `existing-flow-run.ts:88`. No live-LLM lane calls `runPersistedFlow`.
  - `testing-facility.md` places paid certification in `pnpm demo:llm:diagnose`, which
    drives the real panel UI, not this request.
  - No other file in the tree, outside build output, mentions `dryRunLlm`.
- No barrel change: `src/index.ts:9` already re-exports the module, and no signature
  changed.

## Commands run and observed results

The test-runner's check, private build and tests ran one at a time, each redirected to a
scratch file with the exit status echoed.

- `pnpm --filter @fluxiq-web-extension/test-runner check` → `exit=0`. The domain `dist`
  was present, so it was not rebuilt.
- **Private build and full test run** (from `packages/test-runner`):
  - `npx tsc -p tsconfig.json --outDir dist-f-no-dry-run` → `build exit=0`.
  - `node --test "dist-f-no-dry-run/**/*.test.js"` → `test exit=1`, `# tests 539`,
    `# pass 530`, `# fail 9`.
  - `ok 446 - starts and runs the exact persisted Flow with deterministic non-adaptive
    controls`.
  - **The 9 failures are not this change.** All nine print
    `SyntaxError: The requested module '@fluxiq-web-extension/test-contracts' does not
    provide an export named 'flowLaneExclusion'`, raised from
    `dist-f-no-dry-run/bench/expand-corpus.js:1` or `dist-f-no-dry-run/run-scenario.js:5`.
  - Failing files: `bench/tests/run-bench`, `bench/tests/week1-corpus`,
    `run-evaluation/tests/bench-parity`, `run-evaluation/tests/runner-wiring`,
    `run-evaluation/tests/single-run-evaluation`, `tests/cli-llm`,
    `tests/scenario-assertions`, plus the subtests "CLI auth status and clear need only
    existing origin and username" (`tests/auth-cli`) and "clone-cache refresh reports
    invalidate-now and refresh-on-next-run semantics" (`tests/clone-cache`).
  - Cause: another worker's uncommitted `flowLaneExclusion` (`test-contracts/src`,
    imported by `run-scenario.ts` and `bench/expand-corpus.ts`, both held by other
    workers).
  - A Grep for `flowLaneExclusion|flow-lane-exclusion` over `packages/test-contracts/dist`
    found 0 occurrences. That shared build is not mine to rebuild, and I did not.
- **Mutation proof:**
  - The post-fix hashes were saved with `sha256sum`: `e36a9e4e…` for the source and
    `4288c6cb…` for the test.
  - With `dryRunLlm: true` restored at `existing-fluxiq-control.ts:250`:
    - `npx tsc … --outDir dist-f-no-dry-run` → `mut build exit=0`, and the compiled file
      contained `dryRunLlm` once;
    - `node --test dist-f-no-dry-run/tests/existing-fluxiq-control.test.js` →
      `mut test exit=1`, `# tests 17`, `# pass 16`, `# fail 1`,
      `not ok 13 - starts and runs the exact persisted Flow with deterministic
      non-adaptive controls`, `Expected values to be strictly deep-equal: … +   dryRunLlm: true,`.
  - Restored: `sha256sum -c` → `src/existing-fluxiq-control.ts: OK`,
    `src/tests/existing-fluxiq-control.test.ts: OK`, `hash check exit=0`. Both files are
    byte-identical to the post-fix state.
  - `grep -rn dryRunLlm src` → no match (exit 1).
  - Rebuilt and reran: `final build exit=0`, 0 `dryRunLlm` in the compiled file,
    `final test exit=0`, `# tests 17`, `# pass 17`, `# fail 0`.
  - `dist-f-no-dry-run` was removed afterwards (`ls` exit 2).
- `node scripts/structure-audit.mjs` → `audit exit=0`,
  `structure-audit: passed (41 warning(s), 17 baselined).`
  - `existing-fluxiq-control.ts` keeps its existing 469-line advisory warning.
  - The file has no baseline entry, and its line count is unchanged.
- `git diff --stat` on the two files → 1 line changed in each.

## Not verified

- **No Lab run** (the dispatch forbids it). The effect in Core rests on
  `i-harness-activation`'s code reading (`service.ts:6620-6624`, `:2879-2889`), not on an
  observation.
- **What a Lab run must show after this change alone:**
  - A failed Flow run records **1** harness activation, not 2. The ladder marker is
    record A in `i-harness-activation`; the harness request (record B) is gone.
  - It reaches **0** only once `g-core-ladder-llm-off` lands in Core.
  - One W25 `too-slow` Flow run keeps category `timeout` and code `web.action.timeout`.
  - One W15 `popup-blocked` Flow run keeps category `output_not_observed`.
  - Passing Flow runs stay at 0.
  - In a kept Core store, a failed run's `run_summary` metadata shows
    `trainingBehavior.invokeLlm: false`, and has no
    `intervention.runtime_diagnosis.*` intervention and no "Runtime override enabled
    dry-run LLM adaptation suggestions." diagnostic.
- **Not rerun after the other workers finish:** the 9 test failures caused by the missing
  `flowLaneExclusion` export in `test-contracts/dist`.

## Open questions or contradictions found

1. **A stale architecture sentence.** `docs/architecture/testing-facility.md:368` still
   says the runner uses "deterministic/dry-LLM mode". With the flag gone, the accurate
   wording is "deterministic (no LLM intervention) mode". I do not own that page; the
   supervisor or a docs brief should change it.
2. **Other work this change leaves open.** It removes only record B. Record A, the recovery
   ladder's LLM-diagnosis marker, is Core's (`g-core-ladder-llm-off`). Until that lands,
   harness activation is 1 per failed Flow run, not 0.
