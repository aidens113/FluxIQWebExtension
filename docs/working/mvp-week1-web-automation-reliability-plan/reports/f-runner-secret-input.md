# f-runner-secret-input — the Flow run gets each secret once

Worker report for `f-runner-secret-input` in the twenty-fourth dispatch of
[finish-week1.md](../briefs/finish-week1.md). Repository `F:\!FluxIQWebExtension`,
branch `dev`, `HEAD e3df022` (g-flow-lane-expectations committed). Written
2026-09-13. No real declared secret was read, printed, hashed or quoted; the tests
use made-up values only.

## Outcome

**Done.** The Flow run's `inputs` now carry each declared value once, under the
`web.secret.<key>` path its node reads. The second copy, keyed by the secret id,
is gone, and so is `declaredSecretFlowInputs`, which nothing else called. A
wiring row pins it, and a mutation proof shows the row catching the old spread.

## What changed and why

- **`packages/test-runner/src/flow-lane/run-flow-lane.ts`**, the run's `inputs`
  only (now `:134`).
  - `inputs: { ...declaredSecretFlowInputs(input.secrets), ...secretInputs, scenarioId, facilityRunId }`
    became `inputs: { ...secretInputs, scenarioId, facilityRunId }`, with a
    one-line comment saying why: Core persists a run's inputs, so every extra
    copy is a copy on disk.
  - The import at `:3` drops `declaredSecretFlowInputs`.
  - Why: `i-secret-in-workspace` fix 2. Core persists run inputs in the session
    metadata and every run event. The Flow's nodes ask only for
    `web.secret.<key>`, so the id-keyed copy was read by nothing.
- **`packages/test-runner/src/flow-lane/declared-secrets.ts`**: removed
  `declaredSecretFlowInputs` and its doc comment (former `:73-80`).
  - Before removing it, a grep for `declaredSecretFlowInputs` over the repository
    found no caller outside tests other than `run-flow-lane.ts:3,133`, and nothing
    in `F:\!FluxIQ\packages`.
  - A grep for `auth-gate-password` found no reader of an input keyed by the
    secret id. The id appears only in the auth-gate manifest (`manifest.ts:105`),
    that scenario's test, and test-runner tests.
  - The barrel `flow-lane/index.ts` uses `export *`, so it needed no edit.
- **`packages/test-runner/src/flow-lane/tests/declared-secrets.test.ts`**:
  - dropped the import;
  - dropped the two pins at former `:33` (`{ "auth-gate-password": … }`) and
    `:72` (`declaredSecretFlowInputs([])`).
  - The rest of both tests still stands: resolution from the environment,
    `declaredSecretValues`, and an empty declaration list.
- **`packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts`**, the wiring
  row, `:292-301`.
  - The existing row "the run's inputs carry the declared value at the path the
    Flow's node asks for" pinned the id-keyed copy in its expected inputs. It is
    rewritten as "the run's inputs carry the declared value once, at the path the
    Flow's node asks for, and under no secret id".
  - It declares the auth-gate secret, plus a second secret for a step this
    workflow did not record (`auth-gate-passphrase`, made-up value).
  - It asserts:
    - no input passed to Core's start or run, which receive
      `executeRecordedFlowRun`'s `inputs` unchanged (`persisted-flow-run.ts:127-133`),
      is keyed by either secret id;
    - both the started and the executed inputs equal exactly
      `{ "web.secret.password": SUPPLIED, scenarioId, facilityRunId }`, so the
      value is sent once and the unpaired secret sends nothing.
  - Kept compact on purpose: the file was 398 lines, and a first draft took it
    to 411, which drew a `file-lines` advisory warning (`> 400`). It is now
    exactly 400, and that warning is gone.
  - The brief's `Owns` names only `run-flow-lane.ts` and `declared-secrets.ts`
    with its test. The dispatch message added "a wiring row for the inputs", and
    this file holds the existing row that pinned the copy being removed.

`git diff --stat -- packages/test-runner` (my four files):
`declared-secrets.ts | 9 ---------`, `run-flow-lane.ts | 5 +++--`,
`tests/declared-secrets.test.ts | 4 +---`, `tests/run-flow-lane.test.ts | 12 +++++++-----`;
`4 files changed, 11 insertions(+), 19 deletions(-)`.

## Commands run and observed results

All from `F:\!FluxIQWebExtension` or `packages/test-runner`, with
`EXTENSION_TEST_BUILD_LABEL=f-runner-secret-input`. Each exit code was captured
by redirecting to a file under the scratchpad and echoing `$LASTEXITCODE`, never
through a pipe.

- **Re-verify at HEAD.** Test-runner `git status --short` was clean before any
  edit. `run-flow-lane.ts:133` still held the spread, so the item was not
  already settled.
- **`pnpm check`** (test-runner; `domain:dist` found an existing dist and built
  nothing): `check exit=0`.
  - This ran after the source edits and before the test row was trimmed.
  - The trimmed test file was type-checked by the private `tsc` build below,
    which uses the same `tsconfig.json` and exited 0.
- **Structure audit**, `node scripts/structure-audit.mjs`:
  - first run: `structure exit=0`, `structure-audit: passed (40 warning(s), 17 baselined).`
    One warning was `run-flow-lane.test.ts: 411 lines is past the 400-line advisory threshold.`
  - after trimming: `structure exit=0`, `structure-audit: passed (39 warning(s), 17 baselined).`
    No `flow-lane` line; `test file lines: 400`.
  - No new files, so no scratch `GIT_INDEX_FILE` was needed. None of the four
    files is in `.structure-baseline.json`.
- **Private build and full test run**, before the mutation:
  - `pnpm exec tsc -p tsconfig.json --outDir dist-frsi` → `build exit=0`;
  - `node --test "dist-frsi/**/*.test.js"` → `test exit=0`, `# tests 521`,
    `# pass 521`, `# fail 0`.
- **Mutation proof.**
  - `run-flow-lane.ts` SHA-256 before:
    `BAC5C332F9A897E570EACAA779FBF181769433FDB44344A48322DF31A43F00DE`.
  - Mutation: re-added the id-keyed spread inline, since the function no longer
    exists:
    `inputs: { ...Object.fromEntries(input.secrets.map((secret) => [secret.id, secret.value])), ...secretInputs, … }`.
  - Rebuilt: `mutant build exit=0`. Then
    `node --test dist-frsi/flow-lane/tests/run-flow-lane.test.js`:
    `mutant test exit=1`, `# pass 13`, `# fail 1`, and:
    ```
    not ok 8 - the run's inputs carry the declared value once, at the path the Flow's node asks for, and under no secret id
      error: |-
        no input is keyed by a secret id
      expected:
      actual:
        0: 'auth-gate-password'
        1: 'auth-gate-passphrase'
      operator: 'deepStrictEqual'
    ```
    The mutant sent both ids, including the one for a step this run never
    recorded.
  - Restored with Edit. SHA-256 after:
    `BAC5C332F9A897E570EACAA779FBF181769433FDB44344A48322DF31A43F00DE`,
    `identical=True`.
- **After the restore:**
  - `restored build exit=0`;
  - `restored test exit=0`, `# tests 521`, `# pass 521`, `# fail 0`, including
    `ok 136 - the run's inputs carry the declared value once, at the path the Flow's node asks for, and under no secret id`
    and `ok 62 - declared secrets take their value from the environment, never from the recording`.
  - `Remove-Item -Recurse -Force dist-frsi` → `dist-frsi exists after delete=False`.
- **Final grep:** `declaredSecretFlowInputs` over the repository, excluding
  `docs`, build outputs and `node_modules`, found no matches.

## Not verified

- **No Lab run**, per the dispatch rules. The Lab proof owed for this fix:
  - `auth-gate --flow` still passes its sign-in, and its password node still
    types (`web.dom.type:succeeded` twice);
  - with a kept workspace, as `i-secret-in-workspace` ran it, no `inputs.auth-gate-password`
    key path appears:
    - in any runtime event chunk (`$.events[*].payload.inputs`);
    - in the `global.sqlite` `"automation.state"` runtime session row
      (`$.session.metadata.inputs`).
  - `inputs.web.secret.password` will still hold the value in both places until
    Core fix 3 (`g-core-input-withholding`) lands. This change halves those
    copies; it does not remove them.
- **Root gates** (`pnpm check`, `pnpm test`, `pnpm build`) and the content
  harness were not run. The change is test-runner only and touches no extension
  or domain code.
- **The full test run saw a parallel edit.** It included the working-tree state
  of `packages/test-runner/src/secret-leak-attestation.ts`, which
  `g-attestation-sqlite` modified during this work (`git status` shows it `M`).
  All 521 tests passed with it present. I did not read or touch that file.
- **Single observations.** Each gate ran once, apart from the build and test
  rerun after the restore. None failed unexpectedly, so no faulty-RAM rerun was
  needed.

## Open questions or contradictions found

1. **An earlier decision is reversed.**
   - `reports/p-secret-binding.md:288` advised "Keep that", the id-keyed input,
     and `reports/f-w18-secret-leg.md:88` recorded that "the run's `inputs` keep
     the id-keyed entries".
   - This dispatch removes them, on `i-secret-in-workspace`'s evidence that
     nothing reads them and Core persists them.
   - Those reports are historical and were not edited.
2. **The plan cites the removed function.**
   `docs/working/mvp-week1-web-automation-reliability-plan.md:760` still names
   `declaredSecretFlowInputs(input.secrets)` and `secretInputs` as the run's
   inputs. That is a shared document, so I did not edit it; the supervisor may
   want to update it when recording this fix.
3. **Ownership was drawn around the file, not the change.** The brief's `Owns`
   did not list `flow-lane/tests/run-flow-lane.test.ts`. Its existing row pinned
   the copy being removed, so the change could not pass without editing it. The
   dispatch message's "a wiring row for the inputs" covered it, and I edited that
   one row only (`:292-301`).
