# g-redaction-attestation — criterion 2's Lab-side leak check

Worker report, 2026-09-13, at `HEAD 4c53354` with other workers' uncommitted
edits in the tree.

## Outcome

**Done**, except for the call site. The brief withholds `run-scenario.ts`, so the
supervisor must wire it. The exact wiring is below.

- **What was built.** A new module, `packages/test-runner/src/redaction-attestation/`.
  - It reads a scenario's declared sensitive literals.
  - It scans the run's staging bundle and the isolated workspace's `.fluxiq`
    storage for them, through `attestWorkspaceSecretAbsence`.
  - It returns a result that holds no literal.
- **The manifest.** `createRunManifest` now derives `redactionState` from that
  result instead of the constant.
- **Re-verified at HEAD first.** The item was not already settled:
  - no `redaction-attestation` module existed;
  - `security.redaction` appeared only as a category label and in `inspect.ts:26`;
  - `create-run-manifest.ts:80` was `redactionState: "verified",` inside the
    returned object literal, with no condition on any path. It was unconditional.
- **Takes effect now, before any wiring.** Every Lab `run.json` records
  `redactionState: "pending"` instead of `"verified"`, because no attestation is
  passed yet. Grep finds no reader of the field outside `test-contracts`
  validation and test fixtures (`run-validation.ts:48,193,195`,
  `bench/tests/run-bench.test.ts:43`).

## What changed and why

**New: `packages/test-runner/src/redaction-attestation/`**

- `scenario-redaction-literals.ts` (`scenarioRedactionLiterals`)
  - **The literals.** The recorded `value` of each step named in
    `scenario.secrets[]`, across the primary script and every workflow script,
    each value once.
  - **Why `secrets[]` and not the `redaction` tag.** The tag does not say which
    typed values are secret. `storefront-checkout` deliberately types an
    unmarked security code that is not withheld, so scanning every typed value
    would fail that fixture for the very asymmetry it exists to expose.
  - **Bad declarations fail the run as `fixture.invalid`**, naming the secret and
    the step, never the value:
    - a declaration whose step is in no script;
    - a declared value shorter than 8 characters. The scanner refuses those, see
      `secret-leak-attestation.ts:154`.
  - **Current declared values are all 16–29 characters:** auth-gate
    `fixture-demo-password`; storefront-checkout's two card numbers and its
    password; sensitive-input's two typed values.
- `attest-run-redaction.ts` (`attestRunRedaction`, plus its types)
  - **How it scans.** One `attestWorkspaceSecretAbsence` call per literal per
    scope, merged by scope and path. Scope limits are raised to the scanner's
    absolute ceilings (10,000 files, 8 MiB per file, 64 MiB in total, depth 32),
    because the defaults were sized for a single demo result file.
  - **Status values:**
    - `not-applicable`: no literals were declared, so nothing was scanned;
    - `passed`;
    - `failed`: a literal was found, or the scan hit anything unreadable,
      oversize, a reparse point, or a limit. This fails closed.
  - **Credential-syntax hits do not fail the run.** The categories
    `credential-field`, `credential-assignment` and `authorization-material` go
    into a separate `advisories` list. They do not depend on the fixture's
    literal. See Open questions 2.
  - **Paths are redacted against every literal.** The scanner redacts only the
    literal it was scanning for from a finding's path. A path that spells a
    *second* literal would leak it, so each path is redacted again against all
    of them. This is unit-tested.
- `run-redaction-scopes.ts` (`runRedactionScopes`)
  - **`bundle` scope:** `EvidenceBundle.stagingPath`.
  - **`workspace` scope:** `RunAllocation.storageDir` (`fluxiq-root/.fluxiq`),
    left out when it is not given.
  - **Why `.fluxiq` holds the recordings.** Core persists them there as text:
    `artifacts/automation-studio/projects/<p>/recordings/<r>/recording.json`,
    `timeline.jsonl` and `snapshots/*.json`. I confirmed this read-only in
    `F:\!FluxIQ\packages\fluxiq\src\framework\index.ts:169` and
    `programs/automation-studio/storage/file-store.ts:193-206`.
  - **Why the browser profile is excluded.** The extension's storage there is
    LevelDB, whose binary `.log` files the text scan fails closed on.
- `run-redaction-state.ts` (`runRedactionState`)
  - `passed` becomes `verified`, and `failed` becomes `failed`.
  - `not-applicable` and absent both become `pending`.
- `index.ts` is the barrel.
- **Tests, in `tests/`:**
  - `attest-run-redaction.test.ts` has 7 tests: a planted literal is a finding;
    a clean run gives none, with files actually scanned in both scopes; a leak
    in the bundle is found; the cross-literal path redaction; credential syntax
    is only an advisory; a missing scope fails closed; the not-applicable case
    and the scope shape.
  - `scenario-redaction-literals.test.ts` has 4 tests.

**Modified: `packages/test-runner/src/run-manifest/create-run-manifest.ts`**

- Imports `runRedactionState`.
- Adds `redaction?: RunRedactionAttestation | undefined` to `RunManifestInput`.
  It is optional, so the current call site still compiles.
- Replaces the constant with `redactionState: runRedactionState(input.redaction)`.

**New: `packages/test-runner/src/run-manifest/tests/create-run-manifest.test.ts`**

- **Why it is new.** The brief's "its test" did not exist.
- **Setup.** It builds real manifests: git revisions of the facility checkout,
  with `packages/test-runner` as the second root so lockfile paths stay
  distinct, and a temporary extension directory beside the compiled test, which
  sits in ignored `dist/`.
- **What it asserts.** `pending` for a missing or not-applicable attestation;
  `verified` for a passed one; `failed` for a failed one. Every manifest also
  passes `assertRunManifest`.

## The exact wiring for `run-scenario.ts` (supervisor)

Line numbers are from the working tree as of this report, with
`g-flow-lane-observation`'s edits in it. Each step also names a code anchor, in
case the lines move.

1. **Import**, beside line 32 (`./run-manifest/index.js`):
   ```ts
   import { attestRunRedaction, runRedactionScopes, scenarioRedactionLiterals, type RunRedactionAttestation } from "./redaction-attestation/index.js";
   ```
2. **Read the literals before the bundle**, after line 69
   (`const declaredSecrets ...`) and before line 72 (`new EvidenceBundle`), so a
   bad declaration fails fast the way `resolveDeclaredSecrets` does. The
   existing target gets none, because the FluxIQ it persists to is remote and
   cannot be scanned, and claiming `verified` there would overstate what was
   checked:
   ```ts
   const redactionLiterals = target.mode === "existing" ? [] : scenarioRedactionLiterals(scenario);
   ```
   **Do not add these to `secrets`.** The bundle's own redactor would then scrub
   them on write and hide the very leak the bundle scope checks for.
3. **Declare the result** with the other `let`s:
   `let redaction: RunRedactionAttestation | undefined;`
4. **Run the scan in the `finally` block**, immediately after line 380
   (`if (topology) await copyProcessLogs(bundle, ...)`) and before line 381
   (`if (target.mode === "clone" && topology) {`):
   ```ts
   try {
     redaction = await attestRunRedaction({ literals: redactionLiterals, scopes: runRedactionScopes({ bundleStagingPath: bundle.stagingPath, workspaceStorageDir: topology && target.mode !== "existing" ? topology.allocation.storageDir : undefined }) });
   } catch (error) {
     redaction = undefined; // manifest says "pending"; the run still fails below
     if (verdict === "passed") { failureCategory = "security.redaction"; failureMessage = `Redaction attestation could not run: ${error instanceof Error ? error.message : String(error)}`; }
     verdict = "failed";
   }
   if (redaction?.status === "failed") {
     if (verdict === "passed") { failureCategory = "security.redaction"; failureMessage = `Redaction attestation found ${redaction.findingCount} file(s) holding a declared literal or left unread`; }
     verdict = "failed";
     await capture.trigger({ ...event(runId, scenario.id, undefined, "error", `Redaction attestation failed with ${redaction.findingCount} finding(s)`), details: { failureCategory: "security.redaction", findings: redaction.findings } }).catch(() => undefined);
   }
   if (redaction) await bundle.writeStructured("snapshots/redaction-attestation.json", redaction).catch(() => undefined);
   ```
5. **Pass it to the manifest** at line 397 (`createRunManifest({ ... })`): add
   `redaction` to the input object.

**Why step 4 goes exactly there**

- **After `topology?.close()` (line 375).** Core has stopped, so nothing is still
  appending to the recording or the run trace while it is scanned.
- **After `copyProcessLogs` (line 380).** The copied Core and gateway logs are
  inside the bundle, so they get scanned.
- **Before the clone cleanup at lines 381-393.** Its `removeRunOwnedTopologyState`
  deletes the run root and the workspace with it. The isolated removal at line
  429 comes after `finalize`, so it is later still.
- **Before `createRunManifest` (line 397).** The verdict is already `failed`
  when the manifest is built. `assertRunManifest` rejects a `failed`
  redactionState on a `passed` verdict (`run-validation.ts:193`).
- **Before `bundle.finalize`.** Finalizing renames the staging directory, and a
  scan after that would fail closed with `unreadable-text` at the scope root.

**What the scan does not cover.** Files written into the bundle after it are not
scanned: the snapshot above, `run.json`, `evaluation.json`, and finalize's
summary and index. They are built from structured run data, and the attestation
result is unit-proven to carry no literal.

**When the run already failed.** A run that failed for another reason keeps its
original `failureCategory`, and the redaction failure is still recorded in the
error event and as `redactionState: "failed"`.

## Commands run and observed results

All commands were run from `F:\!FluxIQWebExtension`, or from
`packages/test-runner`, with exit status captured by redirecting to a file.

1. **Private build**, to avoid racing parallel workers on `dist/`:
   `pnpm exec tsc -p tsconfig.json --outDir .build-g-redaction-attestation`
   → exit 2.
   - The only error was in a file I do not own:
     `src/flow-lane/tests/run-flow-lane.test.ts(87,39): error TS2345 ... Property 'recordingEvents' is missing`
     (`g-flow-lane-observation`, still in flight).
   - tsc emitted anyway. Every later build exited 0.
2. `node --test` on the compiled `attest-run-redaction.test.js`,
   `scenario-redaction-literals.test.js` and `create-run-manifest.test.js`
   → exit 0, `# tests 13 # pass 13 # fail 0`.
3. **Hashes before mutation** (`sha256sum`):
   - `attest-run-redaction.ts`: `6359288983a6bdfcddeacdb437883d6a685a73cd11fdbd5571cc628f6b5a8873`
   - `create-run-manifest.ts`: `5a85271f2282c0030a7dd4370a917659e4aec4c361b029a779bf9fe08dcbafc3`
4. **Mutation proof.** Both mutations were applied together; each is covered by
   separate tests.
   - (a) Skip the scan: `for (const scope of input.scopes)` became
     `for (const scope of input.scopes.slice(0, 0))`.
   - (b) Restore the constant: `redactionState: "verified",`.
   - Rebuilt with tsc (exit 0), then ran the tests → exit 1, `# pass 6 # fail 7`.
   - Quoted from (a):
     - `not ok 1 - a declared literal persisted in the workspace's recording is a finding, named by scope and path only` with `expected: 'failed' actual: 'passed'`.
     - Tests 2 to 5 also failed. Tests 3 and 5 gave `expected: 'failed' actual: 'passed'`.
   - Quoted from (b):
     - `not ok 12 - a run no attestation vouched for records its redaction as pending, never verified` with `expected: 'pending' actual: 'verified'`.
     - `not ok 13 - ...` with `expected: 'failed' actual: 'verified'`.
5. **Restored** both edits. `sha256sum` gave the identical hashes from step 3,
   so both files are byte-identical. Rebuilt with tsc (exit 0); the tests passed
   13 of 13 again.
6. **Structure audit** with the new files staged into a scratch index
   (`GIT_INDEX_FILE=<scratch> git add -- <my paths>`, then
   `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs`)
   → exit 0, `structure-audit: passed (34 warning(s), 17 baselined)`. No
   finding or warning names any of my paths.
7. `pnpm --filter @fluxiq-web-extension/test-runner check` → exit 0.
8. `pnpm --filter @fluxiq-web-extension/test-runner test` → exit 0,
   `# tests 471 # pass 471 # fail 0 # cancelled 0 # skipped 0`. My 13 tests are
   `ok 124`–`ok 134` and `ok 174`–`ok 175`.
9. **Cleanup.** Removed `packages/test-runner/.build-g-redaction-attestation`.
   `git status --porcelain -- packages/test-runner` shows my changes as
   `M run-manifest/create-run-manifest.ts`, `?? redaction-attestation/` and
   `?? run-manifest/tests/create-run-manifest.test.ts`; the other modified files
   are `g-flow-lane-observation`'s. No `extension-*` directories were left in
   `dist/run-manifest/tests/`.

**Baseline.** No `.structure-baseline.json` entry needs to change. Subdirectories
do not count toward `packages/test-runner/src`'s 49-file entry
(`rules/directory-files.mjs:2`).

## Not verified

- **Not run: the call site, the content harness, `pnpm build` and any `pnpm lab`
  command.** The call site is unowned and unwired. The dispatch rules forbid the
  last two, and the content harness does not apply.
- **What a Lab run must show once the wiring above and `g-scenario-secrets`
  land.** Command: `FLUXIQ_TEST_ENV_FILES=none pnpm lab run sensitive-input --target isolated`,
  three times.
  - Verdict `passed`.
  - `snapshots/redaction-attestation.json` shows `status: "passed"`,
    `literalCount: 2` and `findingCount: 0`.
  - **The workspace scope read real recordings:** its `scannedFiles` is above 0,
    and a `recording.json` or `timeline.jsonl` exists under that run's
    `.fluxiq`. This rests on Core's layout as read from source; no real Lab
    workspace was inspected.
  - The bundle scope's `scannedFiles` is above 0.
  - `run.json` records `redactionState: "verified"`.
- **A healthy run must not fail closed.** Not observed:
  - no `unsafe-reparse` from a junction on the runs-directory path;
  - no `unreadable-text` from NUL bytes in a `.log` or `.json` text file;
  - no `oversize-text` or limit finding on a real workspace.
  - The `advisories` a real run produces were not seen either.
- **Flow lane: `storefront-checkout --flow` and `auth-gate --flow`, not run.**
  - For auth-gate, the declared secret must equal `fixture-demo-password` for
    the login to succeed. The scan of the Core workspace therefore also tests
    Core's run-trace withholding, the uncommitted Core change named in Current
    State.
  - If Core persists the supplied value, expect `security.redaction` there.
    That would be a real leak, not a false positive.
- **Existing and clone targets:** not exercised, even by a unit test of the
  wiring.
- **How long the scan takes** on a real workspace: not measured.

## Open questions or contradictions found

1. **`pending` vs `verified` for a scenario that declares no literal.** I chose
   `pending` because nothing was scanned. That is the bench-honesty rule.
   - Consequence: once wired, every ordinary run records `pending` permanently.
     The contract's enum (`run.ts:115`) has no value meaning "not applicable".
   - If the supervisor prefers `verified` there, the change is one line in
     `run-redaction-state.ts`, plus test 12 and test 6's last assertions.
   - A cleaner fix is a `not-applicable` enum value in `test-contracts`, a file
     this brief did not own.
2. **Credential-syntax categories are advisories, not failures.** The brief asks
   for the fixture's literals. A persisted Core document or log holding a key
   spelled `"token":` or an `Authorization:` line would otherwise fail every
   run, for reasons unrelated to any declaration.
   - The first real Lab run should show whether any advisories appear.
   - To make them fail, move the three categories out of `CREDENTIAL_SYNTAX` in
     `attest-run-redaction.ts`.
3. **sensitive-input declares no `secrets` at HEAD.** Until `g-scenario-secrets`
   lands, its attestation is `not-applicable`, and criterion 2's row
   ("`findingCount: 0` recorded") cannot be observed.
   - **Values never typed are never scanned.** The fixture also renders
     `SYNTHETIC_PASSWORD_DO_NOT_USE`, `4111111111111111` and the billing field's
     `4222222222222220`, whose multi-token `autocomplete` is the leak its
     comments describe.
   - The scenario contract has no way to declare such render-only values, so
     covering them needs a `test-contracts` change.
4. **The bundle scope is blind wherever the bundle already redacts.** A literal
   that equals a declared secret's environment value (auth-gate) or a configured
   credential is on the bundle's redaction list (`run-scenario.ts:70`). The
   redactor scrubs it on write, so a leak into the bundle cannot be seen there.
   The workspace scope is the independent check for those literals.
5. **Files I read beyond the brief, and why:**
   - `g-scenario-secrets`'s brief section, and `flow-lane/declared-secrets.ts`
     (read only): what "declares sensitive fixtures" means now.
   - `run-scenario.ts`, `coordinator.ts`, `allocation.ts`: the cleanup order and
     the workspace path.
   - `test-evidence/src/bundle.ts`: the staging path.
   - `test-contracts` `run.ts`, `scenario.ts`, `evaluation.ts`,
     `run-validation.ts`: the contracts.
   - Structure-audit config and rules: the budgets.
   - A read-only grep of FluxIQ Core: whether recordings persist as scannable
     text or SQLite.
