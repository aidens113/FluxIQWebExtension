# g-attestation-sqlite-reader — the leak check reads SQLite, not only its bytes

## Outcome

Done. The leak scanner still searches every SQLite store file byte for byte. It now also reads every text and blob cell of every table in each database it finds, so a literal SQLite has split across pages is found. The reader is Node's built-in SQLite, run in a child process with `--experimental-sqlite`, and it needs no new dependency.

The split-page test covers 303 databases, one per start position, in UTF-8, UTF-16LE and UTF-16BE. It proves that in each encoding a byte search misses 36 starts (literal length minus 1), and that the scanner finds all 303. Turning the reader off fails that test and two others. Removing the virtual-table skip fails the virtual-table test. Both files were restored byte-identical. No Lab run was allowed (see Not verified).

## What changed and why

**Reader choice (task 2): `node:sqlite` in a child process.**
- No SQLite module is in this workspace's lockfile: a search of `pnpm-lock.yaml` for `sqlite` matched nothing.
- Core's `sqlite3@6.0.1` is Core's own dependency. The test-runner cannot resolve it, so using it would be a new dependency.
- `node:sqlite` is built into Node 22.11:
  - Without the flag, `require('node:sqlite')` fails with `ERR_UNKNOWN_BUILTIN_MODULE`.
  - With the flag, it exports `DatabaseSync` and `StatementSync`, on SQLite 3.46.1.
- **A limit the probe found:** this SQLite has no FTS5 and no R*Tree module (`no such module: fts5`, `no such module: rtree`). Core's project database declares both, at `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\storage\project\schema\relation-indexes.ts:49-52`.
  - A virtual table has no storage of its own in the file (`rootpage` 0). What it stores is in its shadow tables, which are ordinary tables.
  - So the reader skips tables with `rootpage` 0 and reads every other table, including the shadow tables and `sqlite_schema`.
  - Without this, every Lab run would fail with `unscanned-store`.
- **Probe of a real Core-shaped database** (single observation):
  - Core's own `sqlite3` wrote a WAL-mode database with an FTS5 table and an R*Tree table, and kept it open.
  - The literal was split across pages. File sizes: `project.sqlite` 4096, `-wal` 94,792, `-shm` 32,768. A byte search found nothing.
  - A separate `node --experimental-sqlite` process opened it, both from a copy and live. It skipped `docs_fts` and `bounds`, read the 9 shadow and ordinary tables, and found the literal in `docs_fts_content`.

**New module: `packages/test-runner/src/sqlite-store-reader/`** (`index.ts` barrel, `read-sqlite-stores.ts`).
- `readSqliteStores({ databaseFiles, literal })` returns one outcome per file: `clean`, `holds-literal` or `unreadable`.
- A text cell is matched as a string. A blob cell is matched in UTF-8, UTF-16LE and UTF-16BE.
- Integers are read as `bigint`, so a value past 2^53 does not fail the read.
- A file that does not exist is `unreadable`. It is never created.
- Any failure of the process makes every database `unreadable`: spawn error, non-zero exit, the 120 s timeout, over 1 MB of output, or output that is not the expected array.
- The child gets only `SystemRoot`, `TEMP`, `TMP` and `TMPDIR`: no token, no `NODE_OPTIONS`, no test-runner context.
- **Why a directory:** `src/` holds 49 source files against the 25-file limit, baselined at 49, and `src/tests` is baselined at 50. A new file in either would grow a ratcheted entry. The name also avoids a third `secret-` file in `src/`, which would trip the 3-file prefix rule.

**`packages/test-runner/src/secret-leak-attestation.ts`**, built on `g-attestation-sqlite`'s diff, which is kept.
- **Which database a store file leads to.** After a store file's byte search, `stageDatabase` finds the database it belongs to:
  - the file itself;
  - or, for a `-wal`, `-shm` or `-journal`, the database its suffix names, even when that database is not among the approved paths. This is so that a bounded (`persistent-isolated`) scan given only the log a run wrote still reads the rows in it.
- **The copy.** The scanner copies that database, with its `-wal` and `-journal`, once per database, into one `mkdtemp` directory under the OS temporary directory.
  - Copies are named by index, so no path carries a literal.
  - The reader applies the log it opens, so it only ever gets copies. A live store is never opened, and the scanned tree is not changed.
  - The staging directory is removed in a `finally` before the scan returns.
- **Reading.** After the walk, `readDatabases` runs the reader once over all copies. A database holding the literal gets `secret-literal`; one the reader could not read gets `unscanned-store`.
- **Outcomes, with the finding on the database's path:**
  - A database file that is a link or not a file: `unscanned-store`.
  - The database, its `-wal` or its `-journal` over the per-file ceiling: `unscanned-store`.
  - All copies together over the total ceiling: `unscanned-store`.
  - A file that cannot be read or copied: `unscanned-store`.
  - A `-wal` or `-journal` holding bytes with no database beside it: `unscanned-store` on the log itself.
  - A `-shm`, or an empty log, with no database: nothing.
- **Unchanged:** the byte search stays, since it covers freed pages and log frames no query returns. `scannedFiles` and `scannedBytes` keep their meaning, and the report's shape does not change.

**Tests.**
- `sqlite-store-reader/tests/sqlite-fixtures.ts` is test support, not a test. It creates real databases with Node's SQLite in one child process:
  - encoding and page size;
  - a virtual-table schema row written into `sqlite_schema` directly;
  - rows left in an uncheckpointed `-wal`, copied while the connection is open.
- `sqlite-store-reader/tests/read-sqlite-stores.test.ts`, four rows:
  - text in each database encoding and a blob in each text encoding, beside a clean database holding an integer past 2^53;
  - virtual FTS5 and R*Tree schema rows skipped, with the literal found in the shadow table;
  - a row held only in an uncheckpointed WAL;
  - a file that is not a database, and a missing file that stays missing, are both `unreadable`.
- `src/tests/secret-leak-attestation.test.ts`: `g-attestation-sqlite`'s two store rows used fake stores (a header and zeros) that no reader can open, so they now build real databases.
  - **Stores and sidecars:** `store/project.sqlite` is now a finding too, because the reader reads its WAL. An assertion shows the database file's own bytes lack the literal.
  - **Unscanned stores:** adds a `.sqlite` that is not a database and an orphan `-wal`. The limits are set relative to the real database's size.
  - **New split-page row:** one 10,000-character row per database, with the literal starting at offsets 1760 to 1860, in three encodings.

**Task 3: a database over the byte limit.** It gets `unscanned-store`, which fails the scan.
- **Lab:** the limits are `RUN_LIMITS`, 8 MB per file and 64 MB per scan (`attest-run-redaction.ts:59`).
- **Demo attestations:** `certifyDemoLlmSetupArtifacts` passes no limits, so the defaults apply: 1 MB per file and 16 MB in total.
  - Any store file under `fluxiq-root/.fluxiq` over 1 MB gets `unscanned-store`, and the attestation throws `RunnerFailure("recording.persistence", "DeepSeek setup artifact attestation failed")`. That covers a database, its `-wal` or its `-journal`.
  - A `-wal` can grow to about 4 MB before SQLite's default automatic checkpoint, so this can plausibly happen. It was not measured.
  - The other demo callers approve one result JSON file only, so this does not reach them.

**Task 4: does each Lab run get a fresh Core workspace?** Yes for `isolated`, the default, and for `clone`. No for `persistent-isolated`.
- **Fresh:** `startTopology` calls `allocateRun` for every target except `persistent-isolated` (`coordinator.ts:55-61`).
  - `allocateRun` makes a new run root, `run-<ISO time>-<8 random hex>`, with `mkdir(runRoot, { recursive: false })`, and a new `fluxiq-root/.fluxiq` inside it (`allocation.ts:40-54`).
  - The bench passes no run ID to `runScenario` (`bench/run-bench.ts:147-160`), so every bench row gets its own.
  - Lab Stage 3's command uses `--target isolated`. An earlier run's leak cannot fail a later one.
- **Not fresh:** `persistent-isolated` reuses `<runs>/persistent-isolated/<workspace>/fluxiq-root/.fluxiq` (`allocation.ts:75-92`). A database this run wrote to is read whole, so an earlier run's leaked row fails every later run until the workspace is reset. That is the byte scan's behaviour already; the reader adds a second path to it through a written `-wal`.
- **Not checked:** what the workspace scope reads for the `existing` target.

**Task 5: no literal is printed, hashed or quoted.**
- The literal goes to the reader on stdin, never on its command line.
- The reader prints only one of three outcome words per file, and its stderr is discarded.
- Findings carry a redacted path and categories only.
- Every test asserts that the serialized report does not contain the literal. Probes used made-up literals and printed booleans and counts only.

## Commands run and observed results

All test-runner commands were run from `packages/test-runner` with `EXTENSION_TEST_BUILD_LABEL=g-attestation-sqlite-reader`.

- `node --version` -> `v22.11.0`.
- **Probes** (scratchpad `gasr-probe-*.cjs`, each a single observation):
  - API probe -> `FAIL fts5 ... no such module: fts5`, `FAIL rtree ... no such module: rtree`, `FAIL read without bigints ERR_OUT_OF_RANGE`, `ok row types id:bigint,v:string,b:Uint8Array,n:bigint`, `ok version 3.46.1`, `FAIL notdb ERR_SQLITE_ERROR file is not a database`.
    - Its first run ended with `EBUSY` on cleanup, because handles were left open. It left `%TEMP%\gasr-probe-VRX5UD`, which was removed at the end (`rm exit=0`, `absent`).
  - Core probe -> `raw bytes hold the literal contiguously false`, then `copy read exit 0 ... "found":true,"tables":["docs","docs_fts_data","docs_fts_idx","docs_fts_content","docs_fts_docsize","docs_fts_config","bounds_rowid","bounds_node","bounds_parent"],"skippedVirtual":["docs_fts","bounds"]`. The live read gave the same.
  - Fixture probe -> `ok reopen tables notes_fts_content,notes_fts(virtual)`, `ok read shadow true`, `ok main alone holds literal false`, `ok copy read finds WAL row true`, and `ok UTF-16be bytes true`.
- **`pnpm check`** -> `check exit=0`, both before and after the repair below (`final check exit=0`).
- **Private build.** `pnpm exec tsc -p tsconfig.json --outDir dist-gasr` -> `tsc exit=0`.
- **Focused run.** `node --test dist-gasr/sqlite-store-reader/tests/read-sqlite-stores.test.js dist-gasr/tests/secret-leak-attestation.test.js dist-gasr/redaction-attestation/tests/attest-run-redaction.test.js` -> `focused exit=0`, `# tests 22`, `# pass 22`, `# fail 0`, `# duration_ms 1684.6055`.
  - That covers creating and reading the 303 split-page databases.
  - It includes `ok 2 - a declared literal a workspace's SQLite store holds is a finding…` from the redaction attestation, whose byte-built databases the reader now opens.
- **Full suite.** `node --test "dist-gasr/**/*.test.js"` -> `full exit=0`, `# tests 545`, `# pass 545`, `# fail 0`, `# duration_ms 13629.8096`.
- **Structure audit.**
  - Method: copied `.git/index` to the scratchpad, ran `GIT_INDEX_FILE=<copy> git add --intent-to-add` on the 4 new files, then `GIT_INDEX_FILE=<copy> node scripts/structure-audit.mjs`.
  - Result: `audit exit=0`. Every line naming the test-runner is an existing advisory warning for another file, such as `existing-fluxiq-control.ts` and `run-scenario.ts`. None names a file I own.
- **Mutation proof.** Both mutations shared one build. Their tests don't overlap: the attestation tests plant no virtual table, and the reader tests call the reader directly.
  - **Before:**
    - `secret-leak-attestation.ts` `c42d44fc6be2d79de00690b6788495eb1fa05a336d0781095bf4a15ef91ac1d0`;
    - `sqlite-store-reader/read-sqlite-stores.ts` `401f205cdf1eaa857f59178a5e3a8f88c631372fbfcb7945f6fbfb0cbd8a581c`.
  - **Mutations:**
    - Reader off: `if (databases.length > 0) return;` as the first line of `readDatabases`.
    - Virtual-table skip removed: ` AND rootpage <> 0` deleted from the reader's query.
  - **Mutated run:** `mutated tsc exit=0`, then `mutated test exit=1`, `# tests 22`, `# pass 18`, `# fail 4`:
    - `not ok 12 - passes over a virtual table…`: `+ 'unreadable', + 'unreadable'` against `- 'holds-literal', - 'clean'`. This is the skip mutation.
    - `not ok 17 - searches a SQLite store and its sidecars…`: the expected `path: 'store/project.sqlite'` finding is missing. This is the reader-off mutation.
    - `not ok 18 - a store the scan cannot read in full, or whose rows cannot be read…`: `+ findingCount: 3` against `- findingCount: 4`, and the `store/d-not-a-database.sqlite` `unscanned-store` finding is missing.
    - `not ok 19 - a literal SQLite has split across overflow pages…`: the list of databases with no finding begins `+ 'split/UTF-8-1780.sqlite'` and runs to `split/UTF-8-1815.sqlite`, 36 entries.
      - node:test cut the rest of the diff short ("Lines skipped"), so the UTF-16 part of the list cannot be counted from it.
      - The same test asserts, before the attestation runs, that a byte search misses exactly 36 starts in every encoding, and that assertion passed.
    - The redaction attestation's SQLite row still passed with the reader off. Its literals are contiguous, so the byte search finds them.
  - **Restored:** `secret-leak-attestation.ts: OK`, `sqlite-store-reader/read-sqlite-stores.ts: OK`, `byte-identical check exit=0`. Then `restored tsc exit=0`, `restored test exit=0`, `# tests 22`, `# pass 22`, `# fail 0`.
- **A defect of my own, caught and repaired.**
  - **What happened:** my rewrite of the scanner wrote the control characters in `sanitizePath`'s regex (`\u0000-\u001f\u007f`) as raw bytes, NUL included.
  - **How it was caught:** `grep` then called the file "Binary file". `pnpm check` had passed with the broken line, so a compile alone would not have caught it.
  - **Repair:** a scratch script replaced that one line.
  - **Checks after repair:**
    - `cmp` against HEAD's line -> `cmp exit=0`;
    - `remaining control bytes 0` in the scanner, and 0 in each of the other five files.
  - The full `git diff HEAD` of the scanner shows only the intended hunks plus a trailing newline that HEAD lacked.
- **Cleanup.**
  - `dist-gasr` was deleted -> `dist-gasr absent`.
  - After all runs, `%TEMP%` held no `fluxiq-store-read-*`, `fluxiq-sqlite-reader-*` or `fluxiq-secret-attestation-*` entry. The only leftover was the probe directory named above, now removed.

## Not verified

- **No Lab run.** A Lab run must show:
  - **Before Core's withholding fixes,** the `auth-gate` recording lane's workspace scope has a `secret-literal` finding on the project database file itself, `…/project.sqlite`, not only on its `-wal`. It also has one on `.fluxiq/global.sqlite` if that database holds the literal.
  - **After the fixes,** both lanes report `findingCount` 0, with no `unscanned-store` finding. An `unscanned-store` means a store is over `RUN_LIMITS`, or Node's SQLite could not read a Core database.
  - **Why a pass proves the reader ran:** every store file the byte scan counts either leads to a copied and read database or produces a finding. The only exceptions are an empty or `-shm` sidecar with no database. So a pass with the stores counted in `scannedFiles` means every database was read. The Lab report carries no count of databases read.
- **Core's real process and schema.** The probe held the database open in one process and read it from another, on Windows. It used a stand-in schema, not Core's real process and full schema. The copies are taken with `readFile` while Core may hold the files; that exact path was not exercised against Core.
- **Node versions after 22.11.** I did not check how they treat `--experimental-sqlite`; from 22.13, `node:sqlite` needs no flag. If a later Node rejected the flag, every database would get `unscanned-store`: the check would fail closed and visibly, not pass silently.
- **Untested reader failure paths:** the 120 s timeout and the 1 MB output limit.
- **The demo attestations were not run.** The 1 MB default's effect on a live demo workspace was not measured.
- **Coverage of the split sweep.** It crosses one page boundary of one row shape at 4096-byte pages. A literal split across freed pages, or across WAL frames outside the committed state, is visible only to the byte search, and a split there is missed (see open question 1).
- **Single observations:** every probe, and the full suite, which ran once. The focused files ran twice at the correct code and once mutated.
- **Parallel work.** Other workers' files in this package were compiled in whatever state they were in at the time.
- **The supervisor's rebuild of `packages/test-contracts/dist` and `apps/scenario-lab/dist`.** The coordinator warned that during the rebuild, 8 tests could fail with "names web.dom.extract, which no step of this workflow's recordingScript records": week1-corpus 35-37 and demo-llm-exploration-request 391-395.
  - My only full-suite run passed 545 of 545 and did not show that failure. It was not rerun after the warning.
  - I cannot say whether that run read the old or the new `scenario-lab` output. Those tests do not touch the scanner or the reader.

## Open questions or contradictions found

1. **Deleted data is still not fully covered.** No query returns rows SQLite has freed, or old log frames. So a literal split across pages there is still missed; only a contiguous one is found, by the byte search. Closing that needs Core to zero freed content (`PRAGMA secure_delete = ON`) or to checkpoint and vacuum before the check. That is a Core decision.
2. **The demo 1 MB default may now fail demo setup.** A demo workspace's `-wal` over 1 MB would get `unscanned-store`. Raising the limit for stores means `demo-llm-attestation.ts` passing `limits`, and that file is not mine.
3. **Staged copies can outlive a killed process.** They sit in the OS temporary directory (`fluxiq-store-read-*`) and are removed in a `finally`. If the Lab process is killed mid-scan, copies holding a declared literal stay there. Staging under the run's own directory would need a caller I don't own to pass a directory.
4. **A sidecar's database is read even when it was not approved.** Its finding is reported under the database's path. This is deliberate, for bounded scans; say if approved paths must be strict.
5. **A non-SQLite file named `.db` now fails closed** as `unscanned-store`, where the byte scan alone passed it. Windows `Thumbs.db` is one example.
6. **Docs that are now incomplete, in files I don't own:**
   - `redaction-attestation/run-redaction-scopes.ts:14-16` says the stores are "searched byte for byte". They are now also read cell by cell.
   - `attest-run-redaction.ts`'s `failed` comment still does not name `unscanned-store`, as `g-attestation-sqlite` already noted.
   - No architecture page was updated.
