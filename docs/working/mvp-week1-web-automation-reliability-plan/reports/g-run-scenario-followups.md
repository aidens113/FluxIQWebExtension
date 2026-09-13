# g-run-scenario-followups — a second discard read, a bounded workspace scan, and one dead reader removed

Worker report, 2026-09-13. Tree at `HEAD c37d3fe`, which contains
`g-redaction-wiring` (`3c396b0`) and `g-flow-lane-followups` (`1c4e56c`). None of
my files differed from `1c4e56c` when I started (`git diff --stat 1c4e56c HEAD`
over them printed nothing). Other workers had uncommitted edits in `bench/` and
`run-evaluation/observed-run-evaluation.ts` at the same time.

## Outcome

**Done.** All three items are implemented and unit-tested. Every new guard has a
mutation proof, and each mutated file was restored byte-identical. The
test-runner `check` exits 0, and the full test-runner suite passes 496 of 496
from a private build. No Lab run was made; what a Lab run must show is under Not
verified.

Re-verified at HEAD first, and none of the three was already settled:

- `run-scenario.ts` read Core's audit once, after the round trip;
- the workspace scope was the whole `.fluxiq`;
- `readFlowSecretRequests` still existed at `declared-secrets.ts:114`.

1. **A second discard read.** The runner now reads Core's gateway audit log a
   second time in `finally`, once the browser has closed and before the topology
   closes. The two reads are unioned by audit entry id. A discarded action that
   either read finds fails the run as `recording.persistence`.
2. **A bounded workspace scan.** On `persistent-isolated`, the redaction
   attestation now scans only the workspace files created or modified since the
   run started. It still hands every link and every entry it cannot stat or list
   to the scan, which fails closed on them. The `isolated` target (and `clone`,
   which runs on an isolated topology) is unchanged.
3. **`readFlowSecretRequests` removed.** Its one test row now calls the lane's
   single read, `flowSecretRequests(await readFlowNodes(...))`, and keeps its
   title, fixture and assertion.

No file outside the Owns list was edited. Both barrels use `export *`, so no
barrel change was needed. Core was read, never edited: see Open questions 4.

## What changed and why

### Item 1 — the second read

**`packages/test-runner/src/flow-lane/recording-discards.ts`** (77 to 106 lines)

- The signature is now
  `readRecordingDiscards(snapshot, recordingIds, earlier = [])`.
- **`RecordingDiscard` gains an optional `entryId`.** It is Core's audit entry
  id, `id: randomUUID()` in `ClientGatewayAuditLog.record`
  (`F:\!FluxIQ\packages\fluxiq\src\client-gateway\service\audit-log.ts:14-23`).
  It carries no page data, and it is what the union matches on.
- **The union.** The result is `earlier`, followed by each entry of this read
  whose key is not already among them.
  - The key is `entryId`.
  - For an entry without an id, the key is its type, recording and running
    counts. Core's `discardedEvents` rises on every discard of a recording
    (`bridge.ts:444`), so no two of its entries share those counts.
  - An entry both reads return is counted once.
  - An entry that left Core's 100-entry snapshot window before the second read
    is kept from the first.
- **The failure is judged over the union.** A lost action either read saw fails
  as `recording.persistence`, with the same message as before, "Core discarded
  recorded actions that arrived after their recording was finalized (N for id)".
- **A response with no audit log** still fails closed as `gateway.connection`.
  The one exception: if `earlier` already holds a lost action, it fails as
  `recording.persistence`. With `earlier` empty, the behaviour is identical to
  before.

**`packages/test-runner/src/run-scenario.ts`** (638 to 658 lines)

- **A new `firstDiscardRead` variable.** It is set on the line right after the
  first read, and before the settle event and the throw, so a run the first read
  fails is still read again.
- **The second read, in `finally`.** It sits between
  `try { await context?.close(); }` and `try { await topology?.close(); }`:
  - It calls
    `readRecordingDiscards(await topology.control.gatewaySnapshot().catch(() => undefined), firstDiscardRead.recordingIds, earlier)`.
    A snapshot request that throws becomes a missing audit log, so it fails
    closed rather than throwing out of `finally`.
  - It publishes a `runtime.settle` event, "Core's discard audit was read again
    before the topology closed", with `recordingDiscards` (the union) and
    `discardsAfterFirstRead`.
  - **Why here.** Once the browser has closed, the extension cannot send another
    message. Core's audit lives in Core's memory, so it has to be read before
    the topology stops.
- **The failure rule** is
  `failure.category === "recording.persistence" ? failureCategory !== "recording.persistence" : verdict === "passed"`.
  - A discarded action fails the run as `recording.persistence`, even if the run
    had already failed for another reason, such as a Flow-lane failure. The
    error event then carries `supersededFailureCategory`. This is my decision:
    see Open questions 1.
  - An audit the second read cannot get fails only a run that had passed.
- **Which runs get it.** Every isolated and persistent-isolated run whose first
  read happened, recording-lane-only runs included: there the read still comes
  after everything the run did and before close. The existing and clone targets
  still read no audit.

### Item 2 — the bounded scan

**Which bound, and why.** I chose *files created or modified since the run
started*, not the run's own recording ids.

- A recording id bounds only `artifacts/.../recordings/<id>/`.
- A declared literal can also persist in the Flow document the Flow lane builds,
  and in the Flow run trace. That is exactly where W18's secret binding and
  Core's trace-withholding change operate.
- The time bound covers everything this run's Core wrote anywhere in the
  workspace.
- `startedAt` is taken before `startTopology` (and so before
  `allocatePersistentRun`), so no write by this run's Core predates it.

**`packages/test-runner/src/redaction-attestation/run-redaction-scopes.ts`**

- It takes a new optional input, `workspaceWrittenSince`.
- When that is given, the workspace scope carries it as `writtenSince`. The
  bundle scope never does.

**`packages/test-runner/src/redaction-attestation/attest-run-redaction.ts`** (110 to 190 lines)

- **`RunRedactionScope`** gains `writtenSince?: number`, in epoch milliseconds.
- **A bounded scope is expanded by `writtenEntries`**, a private walk that reads
  metadata only and follows no link. It selects:
  - every file with `Math.max(mtimeMs, birthtimeMs) >= since - 2_000`. The two
    seconds cover coarse filesystem timestamps; FAT's two seconds is the
    coarsest.
  - every link, every entry it cannot `lstat`, and every directory it cannot
    list, whatever their age. The scan reports these as `unsafe-reparse` or
    `unreadable-text`, so nothing this run wrote behind them passes silently.
- **Why modification time and creation time, but not change time:**
  - A write moves the modification time.
  - A copy that keeps the modification time (Windows `CopyFile` does) still
    gives the new file a new creation time.
  - `allocatePersistentRun` re-applies an inheritable ACL to the workspace
    directories on every run: `allocation.ts:94-96` calls `windows-acl.ts:24`,
    which runs `icacls /inheritance:r /grant:r (OI)(CI)F`. That can move the
    change time of every file beneath, which would lose the bound.
- **Scans of eight entries.** The selected entries are scanned in groups of
  `ENTRIES_PER_BOUNDED_SCAN = floor(maxTotalBytes / maxFileBytes) = 8`.
  - Eight files at the 8 MiB per-file ceiling fit the 64 MiB total, and eight is
    under the scanner's default of 32 approved paths.
  - So no scan's count or total ceiling trips on how much the run wrote. A file
    over 8 MiB still fails closed as `oversize-text`.
  - The scope summary adds the groups' counts up for each literal, then takes the
    largest across literals, as before.
  - A bounded scope with nothing written scans nothing.
- **`RUN_LIMITS` values are unchanged.** Only its declaration changed, to
  `Object.freeze({...}) satisfies Partial<SecretLeakAttestationLimits>`, so the
  constant above can read them.
- **Unbounded scopes** (bundle, isolated workspace) remain one scan of their
  `paths` with the same limits.
- **Consequence.** A bounded scope has no ceiling across groups: a run that
  writes more than 64 MiB of text into a persistent workspace is read in full
  rather than failed. See Open questions 2.

**The call site in `run-scenario.ts`.**
`runRedactionScopes({ ..., workspaceWrittenSince: target.mode === "persistent-isolated" ? Date.parse(startedAt) : undefined })`.
A comment line was added above the attestation block.

### Item 3 — `readFlowSecretRequests` removed

**`packages/test-runner/src/flow-lane/declared-secrets.ts`**

- The function and its doc line are removed.
- So are the three imports only it used: `FluxIQHttpOptions`, `readFlowNodes`
  and `RecordingProposalControl`.
- `FlowNodeRecord` stays, as a type import.
- A search over the repository, excluding docs, `dist*`, build output and
  `node_modules`, finds no remaining reference.

**`flow-lane/tests/declared-secrets.test.ts`**

- The row "requests are read off the parent Flow and every Subflow graph, and a
  literal or other binding is none" keeps its title, its fixture Flows, its
  control stub, and its one `deepEqual` with the same expected request.
- Only the call changed, to
  `flowSecretRequests(await readFlowNodes(control, { projectId: "project.web", flowId: "flow.parent" }))`.

### Tests

**`flow-lane/tests/recording-discards.test.ts`**

- The fixture `discard()` takes an optional `id`.
- The two rows that list discards now expect `entryId`, and the first row's
  title says the entry id travels.
- New rows:
  1. *a second read is unioned with the first by audit entry: an entry both
     reads return is counted once, and an action discarded after the first read
     fails the run*;
  2. *a loss only the first read saw still fails the second, and an unreadable
     second read keeps the first read's discards*;
  3. *an audit entry without an id is matched by its type, recording and running
     counts*.

**`redaction-attestation/tests/attest-run-redaction.test.ts`**

- A new helper, `persistentRun`. It leaves an earlier run's literal in
  `recording_earlier`, and dates the run's own writes after a start one minute
  in the future. Files a test creates are all born now, and `utimes` cannot set
  a creation time.
- New rows:
  1. *a workspace that outlives the run is scanned only for what this run wrote,
     and fails closed on what it wrote and cannot read*. It covers:
     - a clean pass with workspace `scannedFiles` 1;
     - a literal the run wrote, found as `secret-literal`;
     - a `.json` holding a NUL byte, found as `unreadable-text`.
  2. *a bounded scope reads every file the run wrote however many there are, and
     hands the scan every link whatever its age*. It uses 40 written files, and a
     junction that predates the run, found as `unsafe-reparse`.
- The existing scopes row also asserts that `writtenSince` appears only on the
  workspace scope, and only when given.

**`run-evaluation/tests/runner-wiring.test.ts`**

- **The D3 row** now expects two `readRecordingDiscards(` calls.
- **The redaction row** pins the `workspaceWrittenSince` argument text.
- **A new row**, *Core's discard audit is read a second time, after the Flow lane
  and the browser close and before the topology closes, and unioned with the
  first*, pins this order:
  1. the first read;
  2. `firstDiscardRead` kept;
  3. the first throw.

  It then pins that the second read comes after `await runFlowLane({` and after
  `await context?.close();`, that the read and its publication both come before
  `await topology?.close();`, and the failure rule's text.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension` or `packages/test-runner`, with
`EXTENSION_TEST_BUILD_LABEL=g-run-scenario-followups`. Output went to scratch
files, and exit status was read from `$LASTEXITCODE`, never through a pipe. No
`pnpm build`, no `pnpm lab`, no content harness.

### 1. First private build

`pnpm exec tsc -p tsconfig.json --outDir dist-g-run-scenario-followups` gave
**exit 2**, with three errors, none in my files:

```
src/run-evaluation/observed-run-evaluation.ts(81,37): error TS18048: 'evidence' is possibly 'undefined'.
src/run-evaluation/observed-run-evaluation.ts(81,91): error TS18048: 'evidence' is possibly 'undefined'.
src/run-evaluation/observed-run-evaluation.ts(81,136): error TS18048: 'evidence' is possibly 'undefined'.
```

- That file was uncommitted in the tree: `git diff --stat` showed 23 insertions
  and 10 deletions.
- Beside it were an untracked `run-evaluation/tests/observed-run-evaluation.test.ts`
  and an untracked `dist-gbes/`. Both suggest another worker's edit in progress.
- **Rerun once:** the same exit 2, the same three errors.
- `tsc` still emits JavaScript on type errors, so my tests ran from that build.
  **Every later build** (the three mutation builds, then the final one) gave
  exit 0 with no diagnostics, so the other edit had settled by then.

### 2. Targeted tests on the unmutated tree

`node --test` on recording-discards, declared-secrets, run-flow-lane,
attest-run-redaction and runner-wiring gave exit 0,
`# tests 43 # pass 43 # fail 0 # cancelled 0`.

### 3. Hashes before mutation

`sha256sum`:

| File | Hash |
| --- | --- |
| `run-scenario.ts` | `c38fe592…5d50` |
| `flow-lane/recording-discards.ts` | `d00bd132…7de8` |
| `flow-lane/declared-secrets.ts` | `77673b1e…2254` |
| `redaction-attestation/attest-run-redaction.ts` | `42cc008d…3f10` |
| `redaction-attestation/run-redaction-scopes.ts` | `aa3b4478…791c` |

Byte copies of the four files mutated went to a scratchpad backup directory.

### 4. Structure audit

`node scripts/structure-audit.mjs` gave exit 0,
`structure-audit: passed (38 warning(s), 17 baselined).`

- The only line naming a file of mine is advisory:
  `warn [file-lines] packages/test-runner/src/run-scenario.ts: 658 lines is past the 400-line advisory threshold.`
  The file was already at 638 lines, past 400.
- I created no new files, so no scratch index was needed.
- **No `.structure-baseline.json` entry needs to change.**

### 5. Mutation proofs

Three rounds. Within a round, each mutation was in a different file and caught by
a different test file. Each round: rebuild (exit 0), run the three test files,
restore by the reverse edit, then `cmp` against the backup.

**Round 1** gave exit 1, `# tests 23 # pass 18 # fail 5`.

- **M1a, the union's de-duplication.** `if (seen.has(key)) continue;` was
  removed. Caught by:
  - `not ok 6 - a second read is unioned with the first by audit entry: an entry both reads return is counted once, ...`,
    with `Expected values to be strictly deep-equal` and the `audit.first` entry
    listed a second time;
  - `not ok 8 - an audit entry without an id is matched by its type, recording and running counts`,
    with `+ 3,` (the event count appearing twice).
- **M2a, the time bound.** The select condition became `metadata.isFile()`.
  Caught by:
  - `not ok 15 - a workspace that outlives the run is scanned only for what this run wrote, ...`,
    with `expected: 'passed' actual: 'failed'`;
  - `not ok 16 - a bounded scope reads every file ...`, whose findings gained
    `path: '.fluxiq/artifacts/automation-studio/projects/project_one/recordings/recording_earlier/timeline.jsonl'`.
- **M3, the second read's position.** The second-read block was moved after
  `try { await topology?.close(); }`. Caught by
  `not ok 22 - Core's discard audit is read a second time, ...`, with
  `error: 'read and published while Core, whose audit is in memory, is still running'`.
- **Restored:** `cmp` printed IDENTICAL for `run-scenario.ts` (`c38fe592…`),
  `recording-discards.ts` (`d00bd132…`) and `attest-run-redaction.ts`
  (`42cc008d…`).

**Round 2** gave exit 1, `# tests 23 # pass 20 # fail 3`.

- **M1b, failure over the union.** `lostActions(discards)` became
  `lostActions(discards.slice(earlier.length))`. Caught by
  `not ok 7 - a loss only the first read saw still fails the second, ...`, with
  `+ undefined - 'recording.persistence'`.
- **M2b, scans of eight.** The groups of eight became one scan of every written
  entry. Caught by `not ok 16 - a bounded scope reads every file ...`, with
  `+ 'file-limit'` at `+ path: '.'` in place of `.fluxiq/flows/flow-39.json` and
  the `unsafe-reparse` link.
- **M4, the call site.** `target.mode === "persistent-isolated"` became
  `target.mode === "isolated"` in the `workspaceWrittenSince` argument. Caught by
  `not ok 20 - the redaction attestation scans once Core has stopped ...`, with
  `error: "a persistent-isolated workspace is bounded to what this run wrote since it started, and every other target's workspace is scanned whole"`.
- **Restored:** all three IDENTICAL, with the same hashes as before.

**Round 3** gave exit 1, `# tests 29 # pass 24 # fail 5`.

- **M5, item 3's re-pointed row.** In `flowSecretRequests`, `nodes.flatMap(` became
  `nodes.slice(0, 1).flatMap(`. Caught by:
  - `not ok 10 - requests are read off the parent Flow and every Subflow graph, and a literal or other binding is none`,
    with `+ []` against the expected `node.password` request;
  - the lane's own rows, `not ok 17`, `18` and `19` in `run-flow-lane.test.js`,
    with "... Declaration auth-gate-password for the step enter-password (paired with 0 requests)."
- **M2c, links handed to the scan.** `{ entries.push(relative); return; }` for a
  link became `{ return; }`. Caught by `not ok 28 - a bounded scope reads every file ...`,
  with the `unsafe-reparse` finding for `.fluxiq/linked-recordings` missing.
- **Restored:** `cmp` printed IDENTICAL for all four mutated files:
  `run-scenario.ts` `c38fe592…`, `recording-discards.ts` `d00bd132…`,
  `attest-run-redaction.ts` `42cc008d…`, `declared-secrets.ts` `77673b1e…`.

### 6. Final gates, one at a time

1. `pnpm exec tsc -p tsconfig.json --outDir dist-g-run-scenario-followups` gave
   exit 0, with no output.
2. `node --test "dist-g-run-scenario-followups/**/*.test.js"` gave exit 0,
   `# tests 496 # pass 496 # fail 0 # cancelled 0 # skipped 0`. My rows:
   - `ok 71` (the re-pointed declared-secrets row);
   - `ok 108`, `ok 109`, `ok 110` (the second-read rows);
   - `ok 147`, `ok 148` (the bounded-scan rows);
   - `ok 166` (the second-read wiring row).
3. `pnpm --filter @fluxiq-web-extension/test-runner check` gave exit 0 (the
   `domain:dist` step, then `tsc -p tsconfig.json --noEmit`, with no diagnostics).
4. **Cleanup.** `rm -rf packages/test-runner/dist-g-run-scenario-followups` and
   the scratch backups. `ls` then printed `No such file or directory`, and the
   package directory holds `dist node_modules package.json src tsconfig.json`.

**Not run:** root `pnpm check` and root `pnpm test`, because other packages were
mid-edit by other workers; `pnpm build` and `pnpm lab`, which the dispatch
forbids; and the content harness, because no extension code changed.

## Not verified

**1. The second read, live.** Nothing has run in a real Lab. In the 24-run
`basic-form --flow` campaign (`i-flow-lane-errors` D3), every run's
`events.ndjson` must show:

- the existing settle event "Core persisted the completed recording";
- after the `final` event, or after the error event on a failed run, a
  `runtime.settle` "Core's discard audit was read again before the topology
  closed". Its `recordingDiscards` must be a superset of the first event's
  `recordingDiscards` (matched by `entryId`), with a `discardsAfterFirstRead`
  count;
- no run failing as `recording.persistence` with "Core discarded recorded
  actions";
- if a late discard does occur, `discardsAfterFirstRead > 0`. A late
  `recording.action_discarded` must fail the run as `recording.persistence`. If
  the Flow lane had already failed, the new error event must carry
  `supersededFailureCategory`.

Also not observed:

- whether `gatewaySnapshot` still answers once the browser context is closed (it
  should, since it is Core's own HTTP route);
- whether closing the browser makes Core audit late evidence discards, which
  would appear without failing the run.

The override logic in `finally` is text-pinned by `runner-wiring.test.ts` but
executed by no test: `runScenario` needs the whole Lab.

**2. The bounded scan, live.** Run
`FLUXIQ_TEST_ENV_FILES=none pnpm lab run sensitive-input --target persistent-isolated --workspace <name>`
twice against the same workspace. The second run's
`snapshots/redaction-attestation.json` must show:

- `status: "passed"`;
- a workspace `scannedFiles` about equal to the first run's, not the sum of
  both.

`run.json` must record `redactionState: "verified"`.

If the second run's workspace count grows to cover both runs, file times are
moving on files the run did not write. The likeliest cause is the ACL hardening,
which would mean modification or creation time is touched too. That was reasoned
from `windows-acl.ts`, not observed.

Also not observed:

- whether Core keeps an append-only file in `.fluxiq` that grows across runs.
  Such a file is modified every run and read in full; once past 8 MiB it would
  fail every later run closed as `oversize-text`;
- the timestamp resolution of the Lab machine's filesystem.

**3. Fail-closed branches with no unit row.**

- A directory the walk cannot list, and an entry it cannot `lstat`. Only a link
  and a NUL-byte file are exercised.
- A written path over the scanner's 512-character approved-path limit. The
  scanner reports it as `path-escape`, which I reasoned from
  `secret-leak-attestation.ts:166-170` and did not test.

**4. The walk has no depth ceiling.** The scanner's depth ceiling applies inside
each approved path, and the approved paths here are files, so a written file at
any depth is read. This was reasoned, not tested.

## Open questions or contradictions found

1. **The second read overrides an earlier failure category. This is my decision;
   the brief does not settle it.** If the second read finds a discarded action
   after the run already failed for another reason (typically the Flow lane),
   the run becomes `recording.persistence`, and the old category travels as
   `supersededFailureCategory`.
   - **Why.** The first read's loss already pre-empts the Flow lane. A loss seen
     only by the second read means the recording the Flow was built from, and
     judged against, was short. So the Flow lane's own verdict is not the cause.
   - **The alternative** mirrors the redaction attestation, which keeps the
     earlier category. Decide which the bench should report.
2. **A bounded scope has no ceiling across groups.** The per-file 8 MiB ceiling
   still fails closed. But an isolated workspace fails at 64 MiB of text in
   total, and a persistent run that writes more than that is read in full.
   - Holding the bounded scope to the same total needs either a fixture over
     64 MiB or 10,000 files, or ceilings the attestation input can override.
   - I did neither, rather than ship a guard with no mutation proof.
3. **`entryId` now travels.** It appears in `recordingDiscards` in both settle
   events and in the failure details. It is Core's random UUID and carries no
   page data. The `g-redaction-wiring` report had said only type, recording,
   counts and timing travel; the doc comment and the first test title now say
   the entry id does too.
4. **Core read beyond the brief, read-only.** The brief's "union by audit entry"
   could not be done correctly without knowing whether Core's entries carry a
   unique id and how the running counts move. I read:
   - `F:\!FluxIQ\packages\fluxiq\src\client-gateway\service\audit-log.ts` (all
     28 lines);
   - `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\client-gateway\bridge.ts:420-471`;
   - one grep hit in `client-gateway/service.ts:192`.

   No Core file was edited.
5. **Documentation.** No architecture page describes the audit reads or the
   redaction scopes (per the `g-redaction-wiring` report). If the supervisor adds
   the two failures to `docs/architecture/failure-taxonomy.md`, the second read
   and the persistent bound belong there too. That file is outside my ownership.
6. **D4 was not touched**, as the brief directs.
7. **Final hashes of my files** (`sha256sum`), for the supervisor's check:

   | File | Hash |
   | --- | --- |
   | `run-scenario.ts` | `c38fe5925d846a573b51c961c420961d98a51fd82bba0933a177f3a10bbb5d50` |
   | `flow-lane/recording-discards.ts` | `d00bd132e6cc8f3c0d72c537a3d0b54ebbd4760683567f6c8580ec75da3d7de8` |
   | `flow-lane/declared-secrets.ts` | `77673b1eda60a8bec479a2e8b74627806fc08fce8f06f7074763a92cb4392254` |
   | `redaction-attestation/attest-run-redaction.ts` | `42cc008d649675ba7180f6af3410038b8b414b72f19455e22892360c41e33f10` |
   | `redaction-attestation/run-redaction-scopes.ts` | `aa3b44787f47b37d7f6e71957361f57d046ec3cd1fea11d734ed025e46b4791c` |
   | `flow-lane/tests/recording-discards.test.ts` | `08a22afdc305b90be5e3b43a3dadc4d1f4059b0606116a770e82f893a34f9b52` |
   | `flow-lane/tests/declared-secrets.test.ts` | `293c51491d3b859c91343dddfcc4a8a8fff69a13d1ae5d91527f68da680b365c` |
   | `redaction-attestation/tests/attest-run-redaction.test.ts` | `fa2ce07c28074dcffa6731306c680af5bf4bbe3e1a3b3c61d64d11383c500a11` |
   | `run-evaluation/tests/runner-wiring.test.ts` | `2a339d680c1211cd43d42f77dc3c51e6d9d367cfa60569821d38bfca359bd2e1` |
