# g-evidence-reader-merge — one Flow-lane evidence reader, not two

Worker report. Brief: `briefs/finish-week1.md`, section `g-evidence-reader-merge`.
HEAD `2b7acb0`. `git log f85ddad..HEAD` on `run-evaluation/`, `bench/evaluate-run.ts`
and its test lists no commits, so no one else had changed my files since
`g-single-run-evidence` committed the copy.

## Outcome

**Done.** The Flow lane's evidence-size reader now exists once, in a new module,
and both callers import it.

- **What the reader does.** It opens a run bundle's `snapshots/flow-lane.json`
  and returns the byte size of every measured evidence packet, plus a count of
  the trimmed ones. The bench and a single `lab run` both call it.
- **Not settled before I started.** At HEAD there were two identical private
  copies: `bench/evaluate-run.ts:129-146` and
  `run-evaluation/single-run-evaluation.ts:118-135`.
- **Behaviour did not change.** The moved code was diffed against both copies at
  HEAD, and the only difference is the added `export` (both `diff` runs exit 0).
  Every existing row still passes.
- **Tests.** The rows that pinned the two copies together are replaced by three
  rows on the new module, malformed input included. Two mutation runs broke five
  things and each failed its target row. Every file was restored byte-identical
  (`sha256sum -c`: 7 of 7 `OK`).
- **Gates.** Test-runner `check` exit 0. The full package suite, built into a
  private directory, passed 502 of 502. The structure audit passed with no
  finding on my files and no new baseline entry.

## What changed and why

### New: `packages/test-runner/src/run-evaluation/flow-lane-evidence-sizes.ts` (47 lines)

- **`flowLaneEvidenceSizes(bundlePath): RunEvidenceSizes`** (line 30) is the only
  export. Its private helpers moved with it unchanged: `FLOW_LANE_SNAPSHOT`
  (line 7), `snapshotActions` (35), `isMeasuredPacket` (44), `isRecord` (47).
- **Why here.** `bench` already imports `run-evaluation`, so this home creates no
  import cycle. That cycle is why `g-single-run-evidence` had to copy the reader
  (its open question 2).
- **Doc comment.** It merges the two copies' comments and says both Flow-lane
  producers read through this one function: the bench from the finalized bundle,
  and a single `lab run` from the staging directory before `finalize` renames it.

### `packages/test-runner/src/run-evaluation/index.ts`

- One added line: `export * from "./flow-lane-evidence-sizes.js";`.
- `bench/evaluate-run.ts` imports the reader through this barrel.

### `packages/test-runner/src/run-evaluation/single-run-evaluation.ts` (136 → 97 lines)

- **Imports.** It now imports `flowLaneEvidenceSizes` from `./flow-lane-evidence-sizes.js`
  (line 3). The imports only the copy used are gone: `readFileSync`, `path`,
  `RunEvidenceSizes` and `PersistedEvidencePacket`.
- **Deleted.** The `FLOW_LANE_SNAPSHOT` constant, and the copied reader with its
  doc comment.
- **The call is unchanged** (line 61).
- **Comment.** `singleRunEvaluation`'s doc comment now names the shared reader
  (lines 50-54).

### `packages/test-runner/src/bench/evaluate-run.ts` (258 → 220 lines)

- **Imports.** It now imports `flowLaneEvidenceSizes` from `../run-evaluation/index.js`
  (line 4). `readFileSync`, `path`, `RunEvidenceSizes` and `PersistedEvidencePacket`
  are gone.
- **Deleted.** The `FLOW_LANE_SNAPSHOT` constant, and the reader with its doc
  comment.
- **The call is unchanged** (line 106).
- **Left as they were.** The public `FLOW_LANE_SOURCES` wording and the
  `FlowRunInput` and `evaluateFlowRun` comments are still accurate.

### New: `packages/test-runner/src/run-evaluation/tests/flow-lane-evidence-sizes.test.ts` (75 lines)

It holds three rows, all calling the reader directly.

1. **"every measured packet's bytes, in action order and then capture order, and
   a count of the trimmed ones"** (line 28).
   - The fixture has two packets on the first action, an action with none, and
     two on the last, one of which is 0 bytes.
   - The expected result is `[2048, 1024, 0, 4096]` with a `truncationCount` of 2.
   - The 0-byte packet pins the `>= 0` boundary. The two packets per action pin
     capture order.
2. **"a snapshot that is absent, unreadable, unparseable, or has no list of
   actions yields no sizes and never throws"** (line 42). There are eight cases,
   each expecting empty lists and a count of 0:
   - a bundle that does not exist;
   - a bundle with no snapshot;
   - a snapshot path that is a directory (a read error that is not `ENOENT`);
   - an empty file;
   - broken JSON;
   - JSON `null`;
   - a top-level array;
   - `actions` given as an object.
3. **"only an entry in the shape the lane writes is measured: a size the
   evaluation contract would reject is left out"** (line 58).
   - Rejected packets: bytes of -1, 1.5, 2^53 or `"10"`; `truncated` given as
     `"yes"` or `1`; a missing `bytes`; a missing `truncated`; a string, `null`
     or an array in place of a packet.
   - Rejected actions: `evidencePackets` given as an object or a string, and an
     action that is a string, `null` or an array.
   - Two valid packets remain, so the result is `[512, 0]` with a count of 1.

These rows take in the malformed cases from the two rows deleted below, and add
the directory, empty-file, `null`, unsafe-integer and missing-field cases.

### `packages/test-runner/src/run-evaluation/tests/single-run-evaluation.test.ts`

- **Deleted row.** "a Flow-lane single run whose snapshot is absent, unparseable,
  or not packets records only what the bench records, and never throws" ran each
  malformed bundle through both copies and required them to agree. With one
  reader the comparison proves nothing, and its cases now live on the new module.
- **Deleted helper.** The now-unused `NO_BUNDLE` constant.
- **Kept, unchanged.** "a Flow-lane single run records the packets its bundle
  measured, and agrees with its bench row field for field" (line 140).
  - It still proves the single run passes the bundle to the reader.
  - Its whole-evaluation comparison with the bench now pins the two *producers*
    for the Flow lane, not two copies. `bench-parity.test.ts` has no Flow-lane
    case (see open question 2).
- The recording-lane row and the `run-scenario.ts` wiring row are unchanged.

### `packages/test-runner/src/bench/tests/evaluate-run.test.ts`

- **Deleted row.** "a Flow-lane bundle with no snapshot, an unparseable one, or
  entries that are not packets adds nothing and never throws" was a second copy
  of the reader's malformed-input test. Its cases, including `evidencePackets`
  given as an object, are on the new module.
- **Kept.** "a Flow-lane bundle's measured packets are its evidence sizes" (it
  proves the bench calls the reader) and the recording-lane row.

## Commands run and observed results

- **Where and how.** Every command ran from `packages/test-runner` with
  `EXTENSION_TEST_BUILD_LABEL=g-evidence-reader-merge`; the audit ran from the
  repository root.
- **Capturing status.** Output went to scratch files, and exit status was read
  with `echo $?`, never through a pipe.
- **Private build directory.** `packages/test-runner/dist-germ`, at `dist`'s
  depth. I deleted it at the end, and `ls` then printed `No such file or directory`.

### Behaviour preserved

| # | Command | Observed |
| --- | --- | --- |
| 1 | `git show HEAD:…/bench/evaluate-run.ts \| sed -n 129,146p` and `git show HEAD:…/single-run-evaluation.ts \| sed -n 118,135p`, each `diff`ed against lines 30-47 of the new module with `export ` removed | both `diff` runs printed nothing and exited 0 |

The first redirect in that command, to `$TMPDIR`, failed (`Permission denied`,
because `$TMPDIR` was unset) and wrote nothing. The diffs used the scratchpad
files.

### First gates, before the mutations

| # | Command | Observed |
| --- | --- | --- |
| 2 | `sha256sum` of the 7 owned files | `d02a8fd1… flow-lane-evidence-sizes.ts`, `4890df00… index.ts`, `fba6ca0f… single-run-evaluation.ts`, `6095c7af… single-run-evaluation.test.ts`, `f8834626… flow-lane-evidence-sizes.test.ts`, `247f3703… evaluate-run.ts`, `2856233e… evaluate-run.test.ts` |
| 3 | `pnpm check` | `check exit=0`, 0 `error TS` |
| 4 | `rm -rf dist-germ; pnpm exec tsc -p tsconfig.json --outDir dist-germ` | `build exit=0` |
| 5 | `node --test "dist-germ/**/*.test.js"` | `test exit=0`: `# tests 502`, `# pass 502`, `# fail 0`. New rows `ok 159`, `ok 160`, `ok 161`; the kept wiring rows `ok 22` (bench) and `ok 177` (single run) |
| 6 | `node --test` on only the three owned test files | `three exit=0`: `# tests 23`, `# pass 23`, `# fail 0` |
| 7 | A copy of `.git/index` as `GIT_INDEX_FILE`, `git add` of the two new files, then `node scripts/structure-audit.mjs` | `git ls-files` listed both new files; `audit exit=0`, `structure-audit: passed (38 warning(s), 17 baselined).` |

**Why the total is 502.** `g-single-run-evidence` counted 500. I deleted 2 rows
and added 3. `f-flow-start-page`'s parallel edit added 1:
`packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts` holds 10
`test(` rows at HEAD and 11 in the working tree. It is the only test file I do
not own that `git status` lists as modified.

### Mutation proofs

**Run A: three breaks in the new module, each aimed at one row.** It rebuilt
into `dist-germ` (`build exit=0`) and ran only `flow-lane-evidence-sizes.test.js`.
The three breaks were:

- `.filter(isMeasuredPacket)` became `.filter(isMeasuredPacket).reverse()`
  (aimed at row 1);
- `catch { return []; }` became `catch (error) { throw error; }` (row 2);
- `value.bytes >= 0 &&` was removed (row 3).

Result: `test exit=1`, `# pass 0`, `# fail 3`.

- `not ok 1`: `+ 1024, + 2048, + 4096, + 0` against `- 2048, - 1024, - 0, - 4096`.
- `not ok 2`: `error: "ENOENT: no such file or directory, open '…fluxiq-flow-lane-no-bundle-…\\snapshots\\flow-lane.json'"`.
- `not ok 3`: `+     -1,` in the actual sizes.

**Restore A.** I reverted with the Edit tool, and `sha256sum -c` on the module
printed `OK`.

**Run B: one break in each caller.** It rebuilt (`build exit=0`) and ran the
three owned test files. The two breaks were:

- **C.** In `bench/evaluate-run.ts`, the line `evidence: flowLaneEvidenceSizes(input.result.path),`
  was removed.
- **D.** In `single-run-evaluation.ts`, `flowLaneEvidenceSizes(input.bundlePath)`
  was replaced with `undefined`.

Result: `test exit=1`, `# pass 21`, `# fail 2`.

- `not ok 10` (C, the bench row "a Flow-lane bundle's measured packets are its
  evidence sizes"): `+ sanitizedPacketBytes: [], + truncationCount: 0` against
  `- 2048, - 4096 … - truncationCount: 1`.
- `not ok 21` (D, the single-run row "records the packets its bundle measured"):
  the same diff. It fails at the row's first assertion, on `evaluation.evidence`
  at `single-run-evaluation.test.js:124`, so this row catches D by itself and
  not only through its bench comparison.

**Restore B.** I reverted both with the Edit tool.

### Final gates on the restored tree

| # | Command | Observed |
| --- | --- | --- |
| 8 | `sha256sum -c` against the hashes in row 2 | all 7 files `OK`, `sha exit=0` |
| 9 | `pnpm check` | `check exit=0`, 0 `error TS` |
| 10 | `rm -rf dist-germ; pnpm exec tsc -p tsconfig.json --outDir dist-germ` | `build exit=0` |
| 11 | `node --test "dist-germ/**/*.test.js"` | `test exit=0`: `# tests 502`, `# pass 502`, `# fail 0`; 0 `not ok` lines |
| 12 | A fresh scratch index with the two new files added, then `node scripts/structure-audit.mjs` | `audit exit=0`, `structure-audit: passed (38 warning(s), 17 baselined).`; 0 audit lines name any of my files |
| 13 | `git diff --stat` on my tracked files | `evaluate-run.ts` 44 (mostly deletions), `evaluate-run.test.ts` 15 deletions, `index.ts` +1, `single-run-evaluation.ts` 52, `single-run-evaluation.test.ts` 19 deletions. The two new files are untracked (47 and 75 lines). The same stat also listed `observed-run-evaluation.ts`, which is `g-integration-small-fixes`' edit and not mine |
| 14 | `rm -rf packages/test-runner/dist-germ; ls packages/test-runner/dist-germ` | `No such file or directory` |

## Not verified

- **No Lab run**, because none is allowed in this dispatch. Nothing a Lab run can
  observe should differ from `g-single-run-evidence`. Its proof still applies,
  and a Lab run must show:
  - **A single Flow-lane run.** Run `pnpm lab run --flow --target isolated` on a
    scenario whose Flow executes a web action, such as `basic-form`. Its bundle's
    `evaluation.json` `evidence.sanitizedPacketBytes` must equal the `bytes` of
    every `actions[].evidencePackets[]` in `snapshots/flow-lane.json`, in order.
    `truncationCount` must equal the number of `"truncated": true` entries, and
    `rawSnapshotBytes` must be `[]`.
  - **Bench and bundle agree.** In a week1 bench, every Flow-lane run's bundle
    `evaluation.json` `.evidence` must deep-equal the bench's per-run `.evidence`.
  - **Empty cases.** A recording-lane run, and a Flow-lane run in which no Flow
    was created, record `sanitizedPacketBytes: []` and `truncationCount: 0`.
- **No real bundle.** The reader was exercised only on hand-written fixtures, as
  before.
- **Root gates not run.** No root `pnpm check`, `pnpm test` or `pnpm build`, and
  no domain or extension suites. Only `packages/test-runner` compiles the files I
  changed.
- **Other workers' files.** The suite passed with their uncommitted edits in the
  tree (`run-flow-lane.ts` and its test, `run-scenario.ts`,
  `observed-run-evaluation.ts`, `render-markdown.ts`). I did not review them.

## Open questions or contradictions found

1. **No structure-baseline entry should change.** None of my files is baselined,
   and the audit reports nothing on them. The new module exports one function;
   its test sits in the owning directory's `tests/` folder.
2. **`bench-parity.test.ts` still has no Flow-lane case.** I kept the single-run
   row that deep-equals a Flow-lane single run against its bench row, because it
   is currently the only place the two producers are pinned together on the
   Flow lane. A later brief owning `run-evaluation/tests/bench-parity.test.ts`
   could move it there, and make `SingleRunInput.bundlePath` required
   (`g-single-run-evidence` open question 3).
3. **A comment another worker owns may name the old location.**
   - The `g-single-run-evidence` report quotes the evidence comment in
     `run-evaluation/observed-run-evaluation.ts:32-36` as pointing at
     `bench/evaluate-run.ts` for the read.
   - The reader now lives in `run-evaluation/flow-lane-evidence-sizes.ts`.
   - That file is `g-integration-small-fixes`' and is modified in the working
     tree. I did not read its current text, so I do not know whether it still
     names the old location.
4. **No authored documentation needs updating.** A repository-wide search for
   `flowLaneEvidenceSizes` and `FLOW_LANE_SNAPSHOT` outside build output matched
   only source files and two historical reports (`g-bench-evidence-size.md`,
   `g-single-run-evidence.md`). Those reports cite line numbers of the deleted
   copies; I left them as the record of their time.
