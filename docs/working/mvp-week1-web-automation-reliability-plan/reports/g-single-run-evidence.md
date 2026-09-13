# g-single-run-evidence — a lone `lab run --flow` records the evidence the bench reads

Worker report. Brief: `briefs/finish-week1.md`, section `g-single-run-evidence`.
Base `3959823`. HEAD moved to `1f98375` while I worked. `git log 3959823..HEAD`
on my three files and on `bench/evaluate-run.ts` lists no commits, so no one
else changed them.

## Outcome

**Done.** A single `lab run --flow` now writes evidence sizes into its own
`evaluation.json`. They come from the same `snapshots/flow-lane.json` file the
bench reads, so a run and its bench row agree.

- **Not settled before I started.** At `3959823`, `singleRunEvaluation` passed
  no `evidence` to `evaluateObservedRun`. The doc comment in
  `observed-run-evaluation.ts:32-36` also says "neither yet does a single
  `lab run`".
- **Where the file is read from.** The runner evaluates a run before it seals
  the bundle, so the evaluation reads the file from the bundle's staging
  directory (`bundle.stagingPath`).
  - `finalize` only renames that directory (`test-evidence/src/bundle.ts:200`),
    and the bench then reads the renamed copy.
  - `writeStructured` redacts strings and leaves the numbers and booleans alone
    (`bundle.ts:134-139`). So the byte counts and truncation flags are identical
    in both reads.
- **Tests.** Four new test rows pass. Five mutations each failed the row they
  target, and every mutated file was restored byte-identical (`sha256sum -c`
  printed `OK` for all three files).
- **Gates.** Test-runner `check` exit 0. The full package run, built into a
  private directory, passed 500 of 500. The structure audit passed.

## What changed and why

### `packages/test-runner/src/run-evaluation/single-run-evaluation.ts`

- **`SingleRunInput.bundlePath?: string`** (line 37). This is the directory the
  run's bundle is being written into.
  - It is optional only because `run-evaluation/tests/bench-parity.test.ts`
    calls `singleRunEvaluation` without it, and I do not own that file.
  - Test row 4 below guards the one production caller against dropping it.
- **`singleRunEvaluation`** (lines 63-85) reads evidence sizes only when both
  hold:
  - the observation's lane is `"flow"`;
  - a bundle path was given.

  It then passes `evidence` to `evaluateObservedRun` (line 83). A recording-lane
  run never reads the file, exactly as the bench's `evaluateRecordingRun` never
  does. The function's doc comment now says this.
- **`flowLaneEvidenceSizes`, `snapshotActions`, `isMeasuredPacket`** (lines
  118-136) are private copies of the bench's reader (`bench/evaluate-run.ts:129-146`),
  with the same filtering.
  - I could not import the bench's reader. It is not exported, and `bench`
    imports `run-evaluation`, so importing back would create a cycle.
  - The shared home for this reader is `run-evaluation`, and moving it there
    needs files I do not own (see open question 2).
  - Until then, test rows 1 and 3 evaluate one bundle both ways and fail if the
    two copies ever record different sizes.
- **No new export.** The file is 136 lines.

### `packages/test-runner/src/run-scenario.ts`, the evaluation call only

- **Line 472.** The `singleRunEvaluation({ … })` call now also passes
  `bundlePath: bundle.stagingPath`.
- **Lines 468-470.** Two lines added to the comment above the call say where a
  Flow-lane run's sizes come from.
- **Why this is enough.** The Flow lane writes `snapshots/flow-lane.json` inside
  `recordEvidence`, and that write is awaited during `runFlowLane`, which
  finishes before this call. The call runs before `bundle.finalize`, so the
  staging directory still exists.
- Nothing else in the file changed.

### `packages/test-runner/src/run-evaluation/tests/single-run-evaluation.test.ts`

The six existing rows are unchanged. New helpers:

- **`bundleWith`** (line 107) writes a temporary bundle directory holding only
  the snapshot file.
- **`TWO_PACKETS`** holds two measured packets on two actions, one of them
  trimmed, plus an action with no packets.
- **`benchRowOf`** (line 134) evaluates the same run through the bench's own
  `evaluateFlowRun`.

New rows:

1. **"a Flow-lane single run records the packets its bundle measured, and agrees
   with its bench row field for field"** (line 142).
   - Evidence is `{ sanitizedPacketBytes: [2048, 4096], rawSnapshotBytes: [], truncationCount: 1 }`.
   - It survives `parseRunEvaluationJson`.
   - The whole evaluation deep-equals the bench's evaluation of the same bundle.
2. **"a recording-lane single run reads no evidence sizes, even from a directory
   holding Flow-lane packets"** (line 153).
3. **"a Flow-lane single run whose snapshot is absent, unparseable, or not packets
   records only what the bench records, and never throws"** (line 159). Five
   cases, each checked against the expected sizes and against the bench's
   evaluation:
   - no bundle;
   - broken JSON;
   - `actions` that is not an array;
   - a top-level array;
   - a mix of bad entries (bytes of -1 or 1.5, a string `truncated`, non-object
     entries) plus one valid 512-byte trimmed packet, which gives `[512]` and a
     count of 1.
4. **"lab run hands its evaluation the bundle the Flow lane wrote its snapshot
   into, before the bundle is sealed"** (line 176). It reads `run-scenario.ts`
   the same way `runner-wiring.test.ts` does, and checks:
   - the snapshot is written before the evaluation, which comes before
     `finalize`;
   - the call passes `bundlePath: bundle.stagingPath`.

   This row exists because a reader that no caller hands a path to would leave
   rows 1-3 green.

## Commands run and observed results

All commands ran from `packages/test-runner` with
`EXTENSION_TEST_BUILD_LABEL=g-single-run-evidence`. Output went to scratch
files, and exit status was read with `echo $?`, never through a pipe. The
private build directory was `packages/test-runner/dist-gsre`, the same depth as
`dist`. I deleted it at the end; `ls` then printed `No such file or directory`.

### Before the mutations

| # | Command | Observed |
| --- | --- | --- |
| 1 | `sha256sum` of the three files | `68999cb6…f797 run-scenario.ts`, `ca80c9f5…dda6 single-run-evaluation.ts`, `b0947944…89e3 single-run-evaluation.test.ts` |
| 2 | `pnpm check` | `check exit=0`, 0 `error TS` |
| 3 | `rm -rf dist-gsre; pnpm exec tsc -p tsconfig.json --outDir dist-gsre` | `build exit=0`, no output |
| 4 | `node --test "dist-gsre/**/*.test.js"` | `test exit=0`: `# tests 500`, `# pass 500`, `# fail 0`. New rows `ok 174`, `ok 175`, `ok 176`, `ok 177` |

### Mutation proofs

Each run rebuilt into `dist-gsre` (build exit 0) and ran only
`dist-gsre/run-evaluation/tests/single-run-evaluation.test.js`, which has 10
rows. In that file the new rows are numbered 7 to 10.

**Run A: the read dropped.** I deleted `...(evidence ? { evidence } : {}),`.

- Result: `test exit=1`, `# pass 8`, `# fail 2`.
- `not ok 7` (row 1): `+   sanitizedPacketBytes: [], +   truncationCount: 0`
  against `-     2048, -     4096 … -   truncationCount: 1`.
- `not ok 9` (row 3): `+   sanitizedPacketBytes: []` against `-     512`,
  `-   truncationCount: 1`.

**Run B-E: four mutations at once, each aimed at a different row.**

- **B** removed `input.observation.lane === "flow" &&`.
- **C** replaced `packets.filter((packet) => packet.truncated).length` with
  `packets.length`.
- **D** removed `value.bytes >= 0 &&`.
- **E** removed `, bundlePath: bundle.stagingPath` from the `run-scenario.ts`
  call.

Result: `test exit=1`, `# pass 6`, `# fail 4`, rows 1-6 still `ok`:

- `not ok 7` (C): `+   truncationCount: 2` against `-   truncationCount: 1`.
- `not ok 8` (B): a recording-lane run got `+   sanitizedPacketBytes: [ +     2048, +     4096` against `-   sanitizedPacketBytes: []`.
- `not ok 9` (D): `- $.evidence.sanitizedPacketBytes[0]: must be a finite integer from 0 to 9007199254740991`.
  That is the contract throwing on a -1 packet the filter let through.
- `not ok 10` (E): `error: 'the evaluation reads the bundle this run is writing'`.

All five mutations were restored with the Edit tool.

### Final gates on the restored tree

| # | Command | Observed |
| --- | --- | --- |
| 5 | `sha256sum -c` against the hashes in row 1 | all three `OK`, `sha exit=0` |
| 6 | `pnpm check` | `check exit=0`, 0 `error TS` |
| 7 | `rm -rf dist-gsre; pnpm exec tsc -p tsconfig.json --outDir dist-gsre` | `build exit=0` |
| 8 | `node --test "dist-gsre/**/*.test.js"` | `test exit=0`: `# tests 500`, `# pass 500`, `# fail 0`; no `not ok` line; rows 174-177 `ok` |
| 9 | `node scripts/structure-audit.mjs` from the repository root. No scratch index was needed: all three files are already tracked | `audit exit=0`, `structure-audit: passed (38 warning(s), 17 baselined).` The only finding naming my files is the advisory `warn [file-lines] packages/test-runner/src/run-scenario.ts: 660 lines is past the 400-line advisory threshold.` |
| 10 | `git diff --stat -- packages/test-runner` | 3 files, `+153 -6`: `single-run-evaluation.ts` 58, its test 95, `run-scenario.ts` 6 |

## Not verified

- **No Lab run**, because none is allowed in this dispatch. A Lab run must show
  all of the following:
  - **A single Flow-lane run.** Run `pnpm lab run` with `--flow --target isolated`
    on a scenario whose generated Flow executes a web action (for example
    `basic-form`). In its bundle, `evaluation.json`
    `evidence.sanitizedPacketBytes` must equal the `bytes` of every
    `actions[].evidencePackets[]` in `snapshots/flow-lane.json`, in order.
    `evidence.truncationCount` must equal the number of `"truncated": true`
    entries, and `rawSnapshotBytes` must be `[]`.
  - **Bench and bundle agree.** In a week1 bench, every Flow-lane run's bundle
    `evaluation.json` `.evidence` must deep-equal the bench's own per-run
    evaluation `.evidence` for that run.
  - **Empty cases.** A recording-lane `lab run`, and a Flow-lane run in which no
    Flow was created, have `sanitizedPacketBytes: []` and `truncationCount: 0`.
  - **Contract.** `lab inspect` on that bundle verifies `evaluation.json`
    against the artifact index, and no evidence size breaks the contract.
- **Never run on a real bundle.** The read was only exercised on hand-written
  fixtures in the shape `flowLaneSnapshot` writes. In particular, reading the
  staging directory of a live bundle on Windows, before `finalize` renames it,
  was not exercised.
- **Root gates not run.** No root `pnpm check`, `pnpm test` or `pnpm build`, and
  no domain or extension suites. I changed nothing they compile.

## Open questions or contradictions found

1. **The brief section for `g-single-run-evidence` runs into
   `g-integration-small-fixes` text.**
   - After its `**Report:** reports/g-single-run-evidence.md` line
     (`finish-week1.md:1067`), the section continues through line 1082. That
     text includes `domain/src/io/input-model.ts`, a second **Read**/**Task**/**Tests**
     block, and `**Report:** reports/g-integration-small-fixes.md`.
   - I read it as `g-integration-small-fixes` text pasted in the wrong place and
     did none of it.
2. **There are now two copies of the evidence reader.**
   - They live in `bench/evaluate-run.ts:129-146` and
     `run-evaluation/single-run-evaluation.ts:118-136`. The tests pin them to
     agree, but one reader would be better.
   - **Fix:** move it to a new `run-evaluation/flow-lane-evidence-sizes.ts`,
     export it through `run-evaluation/index.ts`, and have both callers use it.
     Its tests can stay where they are.
   - **Files a brief would need:** `run-evaluation/index.ts`,
     `bench/evaluate-run.ts`, `single-run-evaluation.ts`, and the new file.
     `bench` already imports `run-evaluation`, so this creates no cycle.
3. **`bundlePath` is optional only because of `bench-parity.test.ts`.**
   - That test's `fromSingleRun` omits it. Making the field required, and adding
     a Flow-lane case to that parity file, needs
     `run-evaluation/tests/bench-parity.test.ts`.
   - Its header (lines 14-18) still says the two producers differ only in the
     observation. That remains true, and now also covers evidence.
4. **A stale comment, which I do not own, for `g-integration-small-fixes`:**
   `run-evaluation/observed-run-evaluation.ts`.
   - **Lines 32-36** currently read: "Only the bench's Flow lane passes them,
     read from the bundle's `snapshots/flow-lane.json` (`bench/evaluate-run.ts`).
     A recording-lane run contributes none, and neither yet does a single
     `lab run`: absent, both lists are empty and the truncation count is 0."
     Proposed replacement: "Both Flow-lane producers pass them, read from the
     bundle's `snapshots/flow-lane.json`: the bench's (`bench/evaluate-run.ts`)
     and a single `lab run` (`single-run-evaluation.ts`). A recording-lane run
     contributes none: absent, both lists are empty and the truncation count is 0."
   - **Lines 50-52**, "and only the bench's Flow lane reads evidence sizes, from
     the run bundle", should become "and both producers' Flow lanes read
     evidence sizes from the same bundle file".
5. **No structure-baseline entry should change.**
   - None of my files is baselined.
   - `run-scenario.ts` was already past the 400-line advisory threshold. It grew
     by two comment lines to 660, and the audit still passes.
