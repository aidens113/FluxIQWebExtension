# g-bench-evidence-size — the bench's evidence-size fields, from the Flow lane's packets

Worker report. Brief: `briefs/finish-week1.md`, section `g-bench-evidence-size`.
Worked at HEAD `c29018f`, which moved to `1d7d1ab` during the work; neither
commit touched my files.

## Outcome

**Done.** The evidence sizes in a bench report now come from each Flow-lane
run's `snapshots/flow-lane.json`:

- `sanitizedPacketBytes` gets one entry per measured packet.
- `truncationCount` counts the packets marked `truncated: true`.
- A recording-lane run adds nothing, and the code says so where the fields are
  built.
- `rawSnapshotBytes` stays empty, with the reason given in the report text.

Six new test rows pass. Four mutations each failed the row they target, and
every mutated file was restored byte-identical.

**Checked at HEAD first.** The item was not already done:
`observed-run-evaluation.ts:69` still wrote
`{ sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 }` for
every run.

**The change takes effect without a file I do not own.**

- `run-bench.ts:170` already passes the runner's whole result object to
  `evaluateFlowRun`. That object includes the bundle `path`
  (`run-scenario.ts:45`).
- Making `path` a required field of `FlowRunInput` therefore compiles with
  `run-bench.ts` unchanged.
- The live bench reaches the new read.

## What changed and why

### `packages/test-runner/src/bench/evaluate-run.ts`

- **`FlowRunInput.result`** now requires `path: string` (line 69): the finalized
  bundle directory the runner already returns.
- **`evaluateFlowRun`** passes `evidence: flowLaneEvidenceSizes(input.result.path)`
  (line 110).
- **`flowLaneEvidenceSizes`** (lines 129-132) reads
  `<bundle>/snapshots/flow-lane.json` (constant at line 46). It flattens every
  `actions[].evidencePackets[]` entry, in action order and then capture order:
  - each packet's `bytes` goes into `sanitizedPacketBytes`;
  - `truncationCount` counts `truncated === true`;
  - `rawSnapshotBytes` is always `[]`.
- **What yields nothing:**
  - an absent file, meaning no Flow ran;
  - an unreadable or unparseable file;
  - a non-object document, or `actions` that is not an array;
  - any entry that is not `{ bytes: non-negative safe integer, truncated: boolean }`
    (`isMeasuredPacket`, line 143).
- **Why malformed sizes are filtered here.** The evaluation contract rejects a
  negative or fractional byte count, and `assertRunEvaluation` would then throw
  in the middle of a bench. Filtering first prevents that.
- **Why the read is synchronous.** `run-bench.ts:171` calls `evaluateFlowRun`
  synchronously. Making the call async needs an edit to `run-bench.ts`, which I
  do not own.
- **`evaluateRecordingRun`** has a doc comment (lines 72-78): a recording-lane
  run contributes no evidence sizes. It passes none and never reads the bundle.
- **Report text** (`evidenceSizes`), which the bench writes into `runs.json`
  (`run-bench.ts:103`) and `report.md` (`render-markdown.ts` `sourceLines`):
  - **Recording lane** (line 20): *"none: the recording lane runs no Flow, so
    Core captures no sanitized packet for it; sanitizedPacketBytes is empty and
    truncationCount is 0. rawSnapshotBytes is empty on every lane: no producer
    measures raw snapshots, and they are not a Week 1 metric"*.
  - **Flow lane** (line 40): *"the run bundle's snapshots/flow-lane.json
    actions[].evidencePackets: sanitizedPacketBytes holds the UTF-8 size of each
    state-snapshot packet Core captured before and after a web action attempt,
    one entry per measured packet, and truncationCount counts those the domain
    trimmed. The failure packet is not in Core's run detail and is not measured.
    Both are empty and 0 when that file is absent, which is a run in which no
    Flow ran, and also when it is unreadable. rawSnapshotBytes is empty: no
    producer measures raw snapshots, and they are not a Week 1 metric"*.
  - The Flow-lane text names the state-snapshot summary as the source, as
    `g-flow-lane-followups` open question 7 asked.
- No exported value was added. The file is 258 lines, under the 400-line
  advisory limit.

### `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts`

- **`ObservedRun`** gains an optional `evidence?: RunEvidenceSizes` (line 38).
  Its doc comment says three things:
  - only the bench's Flow lane passes it;
  - a recording-lane run contributes none;
  - a single `lab run` does not pass it yet.
- **`evaluateObservedRun`** copies the lists when evidence is given (line 80).
  Otherwise it keeps the empty default. The comment at the assembly point says a
  recording-lane run contributes none and `rawSnapshotBytes` is not Week 1.
- **Optional rather than required**, because `single-run-evaluation.ts` also
  calls `evaluateObservedRun`, and I do not own it (see open question 1).
- The function doc now says the two callers can also differ on evidence sizes.

### Tests

**`packages/test-runner/src/bench/tests/evaluate-run.test.ts`**

- The existing Flow-lane rows now pass `path: NO_BUNDLE`, a directory that does
  not exist. No assertion changed.
- New row **"a Flow-lane bundle's measured packets are its evidence sizes…"**:
  - a real temporary bundle with two packets on two different actions: 2048
    bytes untrimmed and 4096 bytes trimmed, plus an action with no packets;
  - expects `{ sanitizedPacketBytes: [2048, 4096], rawSnapshotBytes: [], truncationCount: 1 }`.
- New row **"a recording-lane bundle adds no evidence sizes, even when its
  directory holds Flow-lane packets"**:
  - `evaluateRecordingRun` is given a result whose `path` points at that
    two-packet bundle;
  - it records empty sizes.
- New row **"a Flow-lane bundle with no snapshot, an unparseable one, or entries
  that are not packets adds nothing and never throws"**. It covers:
  - a missing file;
  - broken JSON;
  - `actions: "none"`;
  - a top-level array;
  - packets with `bytes` of -1 or 1.5, a string `truncated`, and non-object
    entries.

**`packages/test-runner/src/run-evaluation/tests/observed-run-evaluation.test.ts`**

This file is new and untracked; the supervisor must add it. The brief names
"its test", but no such file existed. Three rows:

- the evidence given reaches the evaluation as a copy, so mutating the input
  afterwards does not change the evaluation;
- no evidence gives empty lists and a truncation count of 0 (recording lane);
- a byte count the contract rejects (-1) makes the evaluation throw rather than
  be published.

## Commands run and observed results

All commands ran from `packages/test-runner` with
`EXTENSION_TEST_BUILD_LABEL=g-bench-evidence-size`. Output went to scratch
files, and exit status was read with `echo $?`, never through a pipe. The
private build directory was `packages/test-runner/dist-gbes`, the same depth
as `dist`. I removed it at the end.

### Before the mutations

| # | Command | Observed |
| --- | --- | --- |
| 1 | `pnpm check` | `exit=0`, no `error TS` |
| 2 | `pnpm exec tsc -p tsconfig.json --outDir dist-gbes` | `build exit=0` |
| 3 | `node --test "dist-gbes/**/*.test.js"` | `test exit=0`, `# tests 493`, `# pass 493`, `# fail 0`. All six new rows present |
| 4 | `sha256sum` of both source files | `48f5393b…8428 bench/evaluate-run.ts`, `421e1fff…685b run-evaluation/observed-run-evaluation.ts` |

### Mutation proofs

Each run rebuilt into `dist-gbes` and ran only
`dist-gbes/bench/tests/evaluate-run.test.js` and
`dist-gbes/run-evaluation/tests/observed-run-evaluation.test.js` (15 rows).

**Run A: the brief's mutation.** I deleted the line
`evidence: flowLaneEvidenceSizes(input.result.path),`.

- Build exit 0. Test exit 1: `# tests 15`, `# pass 14`, `# fail 1`.
- Failed row: `not ok 10 - a Flow-lane bundle's measured packets are its
  evidence sizes: …`, with
  `+   sanitizedPacketBytes: [], +   truncationCount: 0, -   sanitizedPacketBytes: [ -     2048,`.
- Restored. `sha256sum -c` printed `bench/evaluate-run.ts: OK`, exit 0.

**First attempt at B1 and B2: discarded.** B1 made `observed-run-evaluation.ts`
ignore the evidence it is given (`evidence: false ? …`). B2 removed
`value.bytes >= 0` from `isMeasuredPacket`.

- The build exited 2 with `TS18048 'evidence' is possibly 'undefined'`. tsc
  still emitted the JavaScript, and rows 10, 13 and 15 failed.
- Row 12 stayed green because B1 cleared all evidence, so B2's -1 byte never
  reached the contract.
- I did not count this as proof and redid both mutations below.

**Run C: B2 plus mutation C.** C replaced
`packets.filter((packet) => packet.truncated).length` with `packets.length`.
Before the run, `observed-run-evaluation.ts` was restored and checked
(`sha256sum -c`: OK).

- Build exit 0. Test exit 1: `# pass 13`, `# fail 2`.
- `not ok 10 …` (mutation C): `+   truncationCount: 2`, `-   truncationCount: 1`.
- `not ok 12 - a Flow-lane bundle with no snapshot, an unparseable one, or
  entries that are not packets adds nothing and never throws` (mutation B2):
  `- $.evidence.sanitizedPacketBytes[0]: must be a finite integer from 0 to 9007199254740991`.
  This is the mid-bench throw the guard prevents.
- Restored. `sha256sum -c` printed `bench/evaluate-run.ts: OK`, exit 0.

**Run B′: type-clean B1.** The mutation was
`const evidence = undefined as RunEvidenceSizes | undefined;` in place of the
destructured `evidence`.

- Test exit 1: `# pass 12`, `# fail 3`:
  - `not ok 10 …`: `+   sanitizedPacketBytes: []`, `-     2048`;
  - `not ok 13 - the evidence sizes a lane measured reach the evaluation,
    copied rather than shared`: the same diff;
  - `not ok 15 - a size the evaluation contract rejects is refused, never
    published`: `'Missing expected exception.'`.
- Build exit 2, but not from my mutation. The only errors were in a file
  another worker was editing:
  `src/flow-lane/persisted-flow-run.ts(214,18): error TS2552: Cannot find name 'TARGET_RESOLUTION_STATUSES'`.
- Restored. `sha256sum -c` printed `OK` for both files, exit 0.

### Final gates on the restored tree

| # | Command | Observed |
| --- | --- | --- |
| 5 | `sha256sum -c` (both files) | both `OK`, `sha exit=0` |
| 6 | `pnpm check` | `check exit=0`, no `error TS` |
| 7 | `rm -rf dist-gbes; pnpm exec tsc -p tsconfig.json --outDir dist-gbes` | `build exit=0` |
| 8 | `node --test "dist-gbes/**/*.test.js"` | `test exit=1`: `# tests 496`, `# pass 492`, `# fail 4` (below) |
| 9 | Rerun of 7 and 8, once, as the rules require | `build exit=0`, `test exit=1`: `# tests 496`, `# pass 494`, `# fail 2` (below). My six rows: `ok 22`, `ok 23`, `ok 24`, `ok 159`, `ok 160`, `ok 161` |
| 10 | Structure audit: copied `.git/index` to a scratch `GIT_INDEX_FILE`, `git add` of the new test, then `node scripts/structure-audit.mjs` from the repository root | `audit exit=0`, `structure-audit: passed (38 warning(s), 17 baselined)`. No finding names any of my four files. `git ls-files` listed the new test in `run-evaluation/tests` (4 files) |

**The failures in runs 8 and 9 are in other workers' files, and the set
changed between runs.**

- Run 8 failed four rows:
  - rows 108 and 110 in `dist-gbes/flow-lane/tests/recording-discards.test.js`
    (lines 70 and 99), for example `+   3,`;
  - rows 147 and 148 in
    `dist-gbes/redaction-attestation/tests/attest-run-redaction.test.js`
    (lines 107 and 126), for example `+ 'failed'`.
- Run 9 passed all four of those and failed two different rows:
  - row 99 in `dist-gbes/flow-lane/tests/persisted-flow-run.test.js:73`:
    `+ undefined`;
  - row 166 in `dist-gbes/run-evaluation/tests/runner-wiring.test.js:77`:
    `'read and published while Core, whose audit is in memory, is still running'`.
- At that moment `git status` showed all of these as being modified by others:
  `recording-discards.ts`, `persisted-flow-run.ts`, the redaction-attestation
  files, `run-scenario.ts` and `runner-wiring.test.ts`. A
  `dist-g-run-scenario-followups` build sat beside mine.
- None of them imports or tests `evaluate-run.ts` or
  `observed-run-evaluation.ts`.

## Not verified

- **No Lab run**; none is allowed in this dispatch. A Lab run must show all of
  the following:
  - **`report.md` Distributions table.** In a week1 bench `report.md` (for
    example `pnpm lab bench --corpus week1 --repeat 1 --target isolated`), the
    **Sanitized packet bytes** row has `Samples` above 0 and numeric p50 and
    p95, whenever at least one Flow-lane run executed a web action.
  - **Truncation count.** The `Truncation count, …:` line equals the number of
    `"truncated": true` entries across the Flow-lane runs'
    `snapshots/flow-lane.json` files.
  - **Per run.** Each Flow-lane run's `evaluation.json` in the bench directory
    has `evidence.sanitizedPacketBytes` equal to its bundle's `evidencePackets`
    `bytes`, in order.
  - **Recording-lane runs and Flow-lane runs where no Flow was created** have
    `sanitizedPacketBytes: []` and `truncationCount: 0`.
  - **`rawSnapshotBytes`** has 0 samples everywhere.
  - **The `evidenceSizes` source text** in `report.md` and `runs.json` reads as
    quoted above.
  - **Budget.** No `bytes` value exceeds `WEB_LLM_EVIDENCE_BYTE_BUDGETS`.
- **Not exercised against a real bundle.** The read was never run against a
  `flow-lane.json` produced by the live runner; only hand-written fixtures in
  the shape `flowLaneSnapshot` writes (`run-flow-lane.ts:148-161`). The newest
  bundles on disk under `test-runs/` predate `1c4e56c` and hold no packets. I
  did not open them.
- **Full suite never green.** I never saw a fully green run of the whole
  package, because of the parallel edits described above. My own rows passed
  in every run.
- **Root gates not run.** I ran no `pnpm test` or `pnpm check` at the
  repository root, and no `pnpm build`.

## Open questions or contradictions found

1. **A single `lab run --flow` still records empty evidence, so a bench row and
   a single run of the same run now disagree.**
   - `single-run-evaluation.ts` and `run-scenario.ts` are outside my ownership,
     so that path still passes no evidence.
   - `run-evaluation/tests/bench-parity.test.ts` compares only the recording
     lane, so no test catches the difference.
   - **Fix:** `run-scenario.ts` passes sizes built from the in-memory
     `flowEvidence.run.actions[].evidencePackets` through `SingleRunInput` into
     `evaluateObservedRun`'s new `evidence` field, and a parity row pins it.
   - **Files a brief would need:** `run-evaluation/single-run-evaluation.ts`
     and its test, `run-scenario.ts`, and `bench-parity.test.ts`.
   - `run-scenario.ts` is being edited by another worker now.
2. **An unreadable snapshot is silently empty.**
   - The bench's `problems` list (`run-bench.ts:166-169`) cannot be reached from
     `evaluate-run.ts`, so a corrupt `flow-lane.json` shows as "no packets"
     rather than as a problem. The source text says so honestly.
   - The better home for the read is `bench/read-run-bundle.ts`, which already
     reports unreadable files as problems. `run-bench.ts` would then pass the
     sizes in, and `evaluateFlowRun` would go back to being pure.
   - That needs `read-run-bundle.ts`, `run-bench.ts` and their tests. I kept
     the read in `evaluate-run.ts` because the brief placed the read and its
     mutation there, and a reader that nothing called would have landed
     disconnected.
3. **Proposed wording for `render-markdown.ts`**, which `g-w29-row` owns. I
   could put the "not Week 1" wording where `report.md` renders the sources,
   but the Distributions section itself has no such sentence.
   - **Current line 154:** ``Truncation count, ${ALL_LANES}: ${metrics.truncationCount}. Week 2 metrics (harness recovery; adaptation cost, validation, persistence, and reuse) are null.``
   - **Proposed:** ``Truncation count, ${ALL_LANES}: ${metrics.truncationCount}. Sanitized packet bytes and the truncation count come from Flow-lane runs only: a recording-lane run runs no Flow, so Core captures no sanitized packet for it. Raw snapshot bytes has no samples on any lane: no producer measures raw snapshots, and they are not a Week 1 metric. Week 2 metrics (harness recovery; adaptation cost, validation, persistence, and reuse) are null.``
   - **Why:** the Sanitized packet bytes row is labelled as covering all lanes,
     but only Flow-lane runs contribute samples to it.
4. **Report comparison is unaffected by the text change.** Neither
   `compare-reports.ts` nor `load-report.ts` reads `sources` or `flowSources`
   (grep, no matches). The wording change cannot make `lab compare` disagree
   with an older report, including the smoke baseline `bench-mtxoim0b`.
5. **No structure-baseline entry should change.** None of my files is
   baselined, and none has a finding.
6. **The new test file is untracked:**
   `packages/test-runner/src/run-evaluation/tests/observed-run-evaluation.test.ts`.
