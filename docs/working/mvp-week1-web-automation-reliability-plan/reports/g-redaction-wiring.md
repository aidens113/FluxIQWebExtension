# g-redaction-wiring — run the redaction attestation in every Lab run, and D3

Worker report, 2026-09-13, at `HEAD 082c2c0`, with other workers' uncommitted
edits in the tree (`g-bench-coverage` in `bench/` and `test-contracts` bench
files, `g-flow-lane-followups` in `flow-lane/`).

## Outcome

**Done.** Both parts are wired into `run-scenario.ts`, unit-tested, and each
guard has a mutation proof. No Lab run was made; the Lab proof each part still
owes is under Not verified.

1. **The redaction attestation now runs in every Lab run.**
   - It runs once Core has stopped and its logs are copied into the bundle, and
     before three things: the clone cleanup that deletes the workspace, the
     manifest, and bundle finalization.
   - A declared literal found anywhere fails the run as `security.redaction` and
     writes `snapshots/redaction-attestation.json`.
   - A scenario that declares no secrets now records
     `redactionState: "not_applicable"`, a new contract value, instead of
     `pending`.
2. **D3: a recording that reached Core short is now visible.** After the Core
   round trip on the isolated targets, the runner reads Core's gateway audit log
   and puts two things into the `runtime.settle` event:
   - this run's recording discards, carrying only type, recording id, counts and
     `sinceFinalizedMs`;
   - the extension's connection state after Stop.

   Any discarded action for this run's recordings fails the run as
   `recording.persistence`, before a Flow is built from it.

**Three edits outside the brief's Owns list, each one line or two.** The brief
made them unavoidable. I made them rather than stop, and name them here:

- **`packages/test-runner/src/flow-lane/index.ts`: one export line** for the new
  `recording-discards.js`. Without it, one of two things happens:
  - `run-scenario.ts` imports straight into the module, and the structure audit
    fails it. The `imports` rule counts an import past a barrel as a ratcheted
    violation (`scripts/structure-audit/rules/imports.mjs`).
  - The module ships and nothing calls it.

  The brief should have listed the barrel. `git diff` shows this line is the
  file's only change.
- **`redaction-attestation/tests/attest-run-redaction.test.ts:103`**, and
- **`run-manifest/tests/create-run-manifest.test.ts:56-58`.**

  These two assertions pinned the old `pending` result for "nothing to scan".
  The brief's `not_applicable` decision breaks them by design. The
  `g-redaction-attestation` report names exactly these two as the tests of
  `run-redaction-state.ts`, so I read the brief's "and its test" as them.
  `run-redaction-state.ts` has no test file of its own.

## What changed and why

### The contract: a `not_applicable` redaction state

- **`packages/test-contracts/src/run.ts`.** `RunManifest.redactionState` is now
  `"pending" | "verified" | "failed" | "not_applicable"`, with a doc comment
  that says what each value means.
- **`packages/test-contracts/src/run-validation.ts:48`.** The enumeration
  accepts `not_applicable`.
  - No consistency rule was needed: `not_applicable` is valid on a passed run
    and on a failed one.
  - The existing rules still stop a `failed` state on a passed verdict, and a
    `verified` state beside an artifact that is only marked `applied`.
- **`packages/test-contracts/tests/run-manifest.test.mjs`.** New row: *a run
  with no declared literal to scan records not_applicable, and no other
  spelling of it is accepted*.
  - `not_applicable` is accepted on a passed and on a failed run.
  - `not-applicable` (hyphen) and `skipped` are rejected at `$.redactionState`.
- **No other reader of the field.** A grep over the repository, excluding
  `dist*` and `node_modules`, finds it only in these contract files, the
  runner's manifest builder, one bench test fixture that uses `verified`, and
  working documents. No architecture page mentions it.

### The state mapping

**`packages/test-runner/src/redaction-attestation/run-redaction-state.ts`**

| Attestation result | `redactionState` |
| --- | --- |
| `passed` | `verified` |
| `failed` | `failed` |
| `not-applicable` | `not_applicable` (new) |
| no attestation | `pending` |

### The call site in `packages/test-runner/src/run-scenario.ts` (611 to 638 lines)

1. **Imports.**
   - `readRecordingDiscards` joins the existing `./flow-lane/index.js` import.
   - A new import from `./redaction-attestation/index.js` brings in
     `attestRunRedaction`, `runRedactionScopes`, `scenarioRedactionLiterals` and
     `RunRedactionAttestation`.
2. **The literals are read before the bundle**, beside `secrets`, so a bad
   declaration fails as `fixture.invalid` before a bundle exists. This matches
   `resolveDeclaredSecrets`.
   - The code is
     `redactionLiterals = target.mode === "existing" && scenario.secrets?.length ? undefined : scenarioRedactionLiterals(scenario)`.
   - **Not added to `secrets`.** The bundle's redactor would scrub them on write
     and hide the leak the bundle scan looks for.
   - **Existing target.** Its FluxIQ is remote and cannot be scanned.
     - If the scenario declares literals, no attestation runs and the manifest
       says `pending`. A bundle-only scan would have said `verified`, which
       overstates what was checked.
     - If it declares none, the manifest says `not_applicable`, as on every
       other target.
   - This departs slightly from the attestation report's proposal, which gave
     the existing target no literals at all. That would have recorded
     `not_applicable` even for a scenario that declares secrets, which is
     untrue.
3. **The scan runs in `finally`**, immediately after
   `if (topology) await copyProcessLogs(...)` and before the clone cleanup
   `if (target.mode === "clone" && topology) { ... removeRunOwnedTopologyState ... }`.
   - **Scopes.** It scans the bundle's staging path and
     `topology?.allocation.storageDir`. The latter is absent when the topology
     never started.
     - That case is a bundle-only scan. It is truthful: the literals are only
       typed by the recording script, which needs a started topology.
   - **A thrown attestation** fails the run as `security.redaction`:
     "Redaction attestation could not run: ...".
     - The error message is redacted against every declared literal before it
       is written. The event lands in the bundle after the scan, so nothing
       would catch a literal in it.
   - **A `failed` attestation** fails the run as `security.redaction`, and an
     error event carries the redacted findings.
     - Either way, a run that had already failed keeps its original
       `failureCategory`, and its verdict stays `failed`.
   - **The result** is written to `snapshots/redaction-attestation.json`.
   - **Credential-syntax hits stay advisories**, as the brief decided. This is
     unchanged in `attest-run-redaction.ts`: `CREDENTIAL_SYNTAX` goes to
     `advisories` and only a declared literal is a finding.
4. **`createRunManifest` now receives `redaction`**, so `redactionState` comes
   from the result.
5. **D3, in the isolated and persistent-isolated block**, after
   `const outcome = await assertCoreRoundTrip(topology, paired?.sessionId, recordingBaseline);`:
   - `readRecordingDiscards(await topology.control.gatewaySnapshot(), outcome.newRecordingIds)`.
     `gatewaySnapshot` is `GET /api/client-gateway/snapshot`
     (`http-control.ts:109-110`). Core's route spreads
     `clientGateway.snapshot()`, which includes `auditLog`
     (`F:\!FluxIQ\apps\web\src\app\api\client-gateway\snapshot\route.ts:23-28`;
     `packages/fluxiq/src/client-gateway/service/views.ts:48`).
   - The connection state after Stop comes from
     `runtimeMessage(extensionControl, { type: "fluxiq.getStatus" })`.
     - Only `status.connectionState` is kept.
     - If the extension answers without one, it records `"unreported"`; if the
       message itself fails, `"unavailable"`.
   - The `runtime.settle` event "Core persisted the completed recording" now
     also carries `recordingDiscards` and `extensionConnectionAfterStop`.
   - Then `if (discardAudit.failure) throw discardAudit.failure;`. It sits after
     the settle event, so the evidence is in the bundle first, and before the
     Flow lane, so a short recording never becomes a Flow.

### D3's audit filter: new `packages/test-runner/src/flow-lane/recording-discards.ts` (77 lines)

It exports one value, `readRecordingDiscards(snapshot, recordingIds)`, and two
types. It returns `{ discards, failure }`.

- **Recording filter.** Only `recording.action_discarded` and
  `recording.event_discarded` entries whose `metadata.recordingId` is one of
  this run's recordings count. The entry shape was read from Core
  `bridge.ts:449-467`.
- **What travels.** Only `type`, `recordingId`, `discardedActions`,
  `discardedEvents`, and `sinceFinalizedMs` when present. The entry's `message`,
  `clientId`, `clientName`, `eventType` and `inputId` do not travel.
- **Fail rule.** The run fails as `recording.persistence` when either holds:
  - there is an `action_discarded` entry for this run's recording;
  - any entry for it carries a running `discardedActions` above zero.

  The second case exists because Core's snapshot keeps only the 100 newest audit
  entries (`views.ts:9`, `AUDIT_LOG_SNAPSHOT_ENTRIES = 100`). An action's own
  entry can drop out while a later count still shows the loss. Discarded
  evidence alone does not fail the run.
- **Fails closed.** A response with no audit-log array fails as
  `gateway.connection`, rather than ruling every loss out unread. This choice is
  mine, not the brief's; see Open questions 3.
- **Test file: `flow-lane/tests/recording-discards.test.ts`**, 5 tests:
  - a discarded action on the run's recording fails, and the withheld fields do
    not travel;
  - a discard against another recording, or with no recording id, is ignored;
  - discarded evidence alone does not fail;
  - a running count above zero on an evidence entry fails;
  - a clean audit yields nothing, and a missing audit log fails closed.

### The wiring test: `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`

Two new rows read `run-scenario.ts` as text, the way the existing rows do.

1. ***The redaction attestation scans once Core has stopped and its logs are in
   the bundle, before cleanup, the manifest and finalization.***
   - `attestRunRedaction(` appears once.
   - Its call comes after `await topology?.close();` and
     `await copyProcessLogs(bundle, `.
   - It comes before `await removeRunOwnedTopologyState(topology);` (the clone
     cleanup), `await removeRunOwnedTopologyState(topology).catch(` (the
     isolated cleanup), `await createRunManifest({` and
     `await bundle.finalize(`.
   - The manifest input contains `redaction`, the snapshot is written, and
     `security.redaction` is assigned.
2. ***Core's audit of discarded recording messages is read after the round
   trip, published, and fails the run before the Flow lane.***
   - The order is: round trip, then the audit read and the status read, then
     the settle event, then the throw, then `runFlowLane`.
   - The settle event's details carry both new fields.

## Commands run and observed results

Every command ran from `F:\!FluxIQWebExtension` or `packages/test-runner`. Each
command's output went to a scratch file, and each exit status was read from
PowerShell's `$LASTEXITCODE`, never through a pipe. No `pnpm build`, no
`pnpm lab`, and no content harness were run.

1. **test-contracts, first run.**
   - `pnpm --filter @fluxiq-web-extension/test-contracts check` gave exit 0.
   - `pnpm --filter @fluxiq-web-extension/test-contracts test` gave exit 0,
     `# tests 63 # pass 63 # fail 0`, including
     `ok 38 - a run with no declared literal to scan records not_applicable, and no other spelling of it is accepted`.
2. **Private test-runner build.**
   `pnpm exec tsc -p tsconfig.json --outDir dist-g-redaction-wiring` gave exit 0
   with no diagnostics.
3. **Hashes before mutation** (`sha256sum`):
   - `test-contracts/src/run-validation.ts`: `e5ddcaf963afb37e06c26b7c9d0abc905323aa331cea48e44cc8cfc567913739`
   - `flow-lane/recording-discards.ts`: `a5178e3adae7de114b2a0b765a7249e270aac56e19acdf57531993c8519bcb34`
   - `redaction-attestation/run-redaction-state.ts`: `d526437636fa74dec7436be1260fca1f7e84be4c85de9c64690ec23eb655bd83`
   - `run-scenario.ts`: `a84168a08dd4baefaad44a18f5dee736458e1358fca6e27a6a9d2c41530b44c0`

### Mutation proofs

Each mutation was applied, its test run and quoted, then restored.

**(a) The contract enumeration.** `not_applicable` was removed from the list in
`run-validation.ts:48`.

- `pnpm --filter @fluxiq-web-extension/test-contracts test` gave exit 1,
  `# tests 63 # pass 62 # fail 1`.
- Quoted: `not ok 38 - a run with no declared literal to scan records not_applicable, and no other spelling of it is accepted`,
  `+ actual - expected` `+   '$.redactionState'`.
- **Restored.** `sha256sum` gave `e5ddcaf9…3739`, identical. A rerun gave exit
  0, 63 of 63 passed, and rebuilt the contracts `dist` before any test-runner
  test read it.

**(b) The attestation's position.** The clone-cleanup block was moved ahead of
the attestation block in `finally`. No rebuild was needed: the row reads the
source at runtime.

- `node --test dist-g-redaction-wiring/run-evaluation/tests/runner-wiring.test.js`
  gave exit 1, `# tests 5 # pass 4 # fail 1`.
- Quoted: `not ok 3 - the redaction attestation scans once Core has stopped and its logs are in the bundle, before cleanup, the manifest and finalization`,
  `error: 'the clone cleanup deletes the workspace the scan reads'`.
- **Restored** with one edit. `sha256sum` gave `a84168a0…44c0`, identical.

**(c) The recording filter.** `|| !wanted.has(recordingId)` was dropped in
`recording-discards.ts`. Rebuilt with tsc (exit 0).

- `node --test .../flow-lane/tests/recording-discards.test.js` gave exit 1,
  `# tests 5 # pass 4 # fail 1`.
- Quoted: `not ok 2 - a discard against another recording is not this run's loss`,
  `Expected values to be strictly deep-equal`.

**(d) The fail rule, with (e) the state mapping, together.** They are caught by
different test files, so the attribution is unambiguous.

- **The two mutations.**
  - (c) was restored first.
  - (d): the fail rule's `if (...) continue;` became `continue;`.
  - (e): `case "not-applicable": return "not_applicable";` was deleted from
    `run-redaction-state.ts`.
  - Rebuilt with tsc (exit 0).
- **The run.** `node --test` on `recording-discards.test.js`,
  `attest-run-redaction.test.js` and `create-run-manifest.test.js` gave exit 1,
  `# tests 14 # pass 10 # fail 4`.
- **Quoted from (d):**
  - `not ok 1 - a discarded action on the run's own recording fails as recording.persistence, ...`
    with `expected: true actual: false`;
  - `not ok 4 - an evidence entry whose running count shows a lost action still fails the run`
    with `+ undefined - 'recording.persistence'`.
- **Quoted from (e):**
  - `not ok 11 - a scenario that declares no literal is not applicable, scans nothing, and verifies nothing`
    with `expected: 'not_applicable' actual: 'pending'`;
  - `not ok 13 - a run no attestation vouched for records pending, and one with nothing to scan not_applicable, never verified`
    with `expected: 'not_applicable' actual: 'pending'`.
- **Restored both.** `sha256sum` gave `a5178e3a…bcb34` and `d5264376…bd83`,
  both identical. `run-scenario.ts` still gave `a84168a0…44c0`.

### Final gates, run one at a time

1. `pnpm exec tsc -p tsconfig.json --outDir dist-g-redaction-wiring` gave exit 0.
2. `node --test "dist-g-redaction-wiring/**/*.test.js"` gave exit 0,
   `# tests 483 # pass 483 # fail 0 # cancelled 0 # skipped 0`. My rows are:
   - `ok 99`–`ok 103` (recording-discards);
   - `ok 139` (attest-run-redaction, not-applicable);
   - `ok 152` and `ok 153` (runner-wiring);
   - `ok 186` (create-run-manifest).
3. `pnpm --filter @fluxiq-web-extension/test-runner check` gave exit 0.
4. **Structure audit.** My changed and new files were staged into a scratch
   index (`GIT_INDEX_FILE` set to a copy of `.git/index`, then `git add` of my
   paths), then `node scripts/structure-audit.mjs` was run. It gave exit 1,
   `structure-audit: 1 violation(s) across 1 rule(s).`
   - **The one failure is not mine:**
     `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.`
     That index belongs to the supervisor. I did not edit it or run the command.
   - **No finding names a file of mine except an advisory warning:**
     `warn [file-lines] packages/test-runner/src/run-scenario.ts: 638 lines is past the 400-line advisory threshold.`
     It is not ratcheted, and the file was already at 611 lines, past 400,
     before this change.
   - **`flow-lane/` now holds 11 source files**, under the 15-file advisory, and
     no warning names it.
   - **No `.structure-baseline.json` entry needs to change.**
5. **Cleanup.** `rm -rf packages/test-runner/dist-g-redaction-wiring`; `ls` then
   reports `No such file or directory`. `dist-g-flow-lane-followups/` belongs to
   the other worker and was left alone.

**Not run:** root `pnpm check` and root `pnpm test`, because other packages
were mid-edit by other workers.

## Not verified

Nothing here has run in a real Lab. The dispatch rules forbid `pnpm lab` and
`pnpm build`, and the content harness does not apply, because no extension code
changed.

**1. What the redaction wiring must show.**

- **The run.** `FLUXIQ_TEST_ENV_FILES=none pnpm lab run sensitive-input --target isolated`
  passes.
- **The snapshot.** `snapshots/redaction-attestation.json` shows:
  - `status: "passed"`, `findingCount: 0`, and `literalCount` equal to the
    scenario's declared literals (2 once `g-scenario-secrets` has landed);
  - a `scannedFiles` above 0 in both the `bundle` and the `workspace` scope.
- **The manifest.** `run.json` records `redactionState: "verified"`.
- **A scenario with no `secrets`,** such as `basic-form`, records
  `redactionState: "not_applicable"` and no snapshot file.
- **A healthy run must not fail closed.** Not observed:
  - no `unsafe-reparse`, `unreadable-text`, `oversize-text` or limit finding on
    a real workspace;
  - how long the scan takes;
  - which advisories a real run produces.

**2. What D3 must show.** The 24-run `basic-form --flow` campaign from
`i-flow-lane-errors` D3 must show, on every run:

- `runtime.settle` "Core persisted the completed recording" carries
  `recordingDiscards: []`, or evidence-only entries, with no
  `recording.action_discarded`;
- `extensionConnectionAfterStop` is not `"error"`;
- no run fails as `recording.persistence` with "Core discarded recorded
  actions".

**3. Targets not exercised at all, not even by a unit test of the call site:**

- `existing`: the attestation is skipped when literals are declared, so it
  records `pending`;
- `clone`: the scan runs before the clone cleanup;
- `persistent-isolated`: the workspace scope is the whole long-lived workspace.

**4. D3 on the other targets.** The existing and clone targets also call
`assertCoreRoundTrip`, but D3 is wired only on the isolated and
persistent-isolated path, where the brief's design anchors it (old `:287`).
Their discards are not read.

**5. The audit is read once, right after finalization.** A message Core
discards after that read is missed. See Open questions 2.

## Open questions or contradictions found

1. **Defect in the brief: ownership drawn around files, not around the change.**
   - The new `flow-lane/recording-discards.ts` cannot reach `run-scenario.ts`
     without `flow-lane/index.ts`, which the brief did not list.
   - The `not_applicable` decision necessarily edits one assertion each in
     `attest-run-redaction.test.ts` and `create-run-manifest.test.ts`, which the
     brief names only as "its test".

   I made these three edits and named them above. Nothing else outside the
   Owns list was touched.
2. **Timing of the D3 read.** Core notes a discard only when the late message
   arrives. The runner reads the audit once, straight after `endedAt` is
   observed, so a message arriving a few hundred milliseconds later is not
   seen.
   - If the 24-run campaign shows late discards in Core's logs that the settle
     event misses, read the audit again after the Flow lane or in `finally`,
     before `topology.close()`.
   - I kept to the design's single read after the round trip.
3. **A missing audit log fails as `gateway.connection`.** This fails closed.
   The alternative is recording "audit unavailable" and passing, which would
   make D3 inert whenever Core's route changes. Note that the Automation Studio
   endpoint's `auditLog: []` is an array and would not be caught. Only the
   `/api/client-gateway/snapshot` route is read, and it carries the real log.
4. **`persistent-isolated` workspaces grow across runs.** The workspace scope
   there is the whole persistent `.fluxiq`, so two things follow:
   - a leak from an earlier run fails a later one;
   - a workspace that grows past the scan's ceilings (10,000 files, 64 MiB)
     will fail every run closed, as a limit finding.

   If that is unwanted, the options are to scope that target to the run's own
   recording directories, or to skip it and record `pending`. Both need a
   decision.
5. **The existing target stays `pending` for a secret-declaring scenario, for
   good.** The brief's "never a permanent pending" reads as being about
   scenarios with no secrets, and `not_applicable` covers that. A remote FluxIQ
   genuinely cannot be scanned, so I left that one case as `pending`, not
   `verified`.
6. **Documentation.** No architecture page mentions `redactionState` or the
   gateway audit read. `docs/architecture/failure-taxonomy.md` might want a line
   on the two new failures:
   - `security.redaction`, from the attestation;
   - `recording.persistence`, from a discarded action.

   That file is outside my ownership and was already modified in the tree by
   another worker.
