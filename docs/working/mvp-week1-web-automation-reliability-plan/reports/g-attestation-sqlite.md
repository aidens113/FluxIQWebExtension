# g-attestation-sqlite — the leak check scans the databases it skipped

## Outcome

Done. The leak scanner now searches SQLite databases and their `-wal` and `-shm` files for each literal instead of counting them as skipped binary files. It searches as UTF-8, UTF-16LE and UTF-16BE. If the scanner cannot read a store in full, it reports an `unscanned-store` finding. Three new test rows cover this, and the mutation that restores the binary skip fails all three. The Lab proof has not run (see Not verified).

## What changed and why

- `packages/test-runner/src/secret-leak-attestation.ts` (the scanner, shared by the redaction attestation and the demo attestations):
  - `.db`, `.sqlite` and `.sqlite3` are no longer in `binaryExtensions`.
  - A file counts as a store in either of two cases:
    - its name ends in `.db`, `.sqlite` or `.sqlite3`, optionally followed by `-wal`, `-shm` or `-journal`;
    - its first bytes are a SQLite database, write-ahead log or rollback journal header.
  - A store's raw bytes are searched for the literal in all three text encodings. Only `secret-literal` is reported for a store. Credential-syntax patterns are not applied to page bytes, where they would only be noise.
  - A store counts in `scannedFiles` and `scannedBytes`.
  - A store known by its name that is not scanned gets `unscanned-store` instead of `file-limit`, `oversize-text`, `byte-limit` or `unreadable-text`. That covers the file-count limit, the per-file size limit, the total-byte budget and a read error.
  - New category `unscanned-store` in `SecretLeakFindingCategory`.
  - The finding carries only a path and categories. The literal is never printed, hashed or quoted.
  - Beyond the brief's wording, all in the same spirit: UTF-16BE (SQLite supports it as an encoding), `-journal` files, `.db`, and detection by header.
- `redaction-attestation/run-redaction-scopes.ts`: doc comment only.
  - It now says the workspace scope's SQLite stores and their sidecars are searched byte for byte.
  - It also says that in a bounded workspace (`persistent-isolated`), a store this run wrote to is scanned whole.
  - No code change was needed. `attestRunRedaction` already routes every category that is not credential syntax into the failing findings, so `unscanned-store` fails the run without touching `attest-run-redaction.ts`.
- `src/tests/secret-leak-attestation.test.ts`, two new rows:
  - Stores and sidecars are searched in each encoding: UTF-8 `.sqlite`, UTF-16LE `-wal`, UTF-16BE `.sqlite3`, and `.dat` known only by its header. A clean `.sqlite` holding `"password":` and a zero-filled `-shm` produce no finding, and `skippedBinaryFiles` is 0.
  - An oversize `.sqlite` and a `-wal` over the total budget are each reported as `unscanned-store`, with the exact report checked.
- `redaction-attestation/tests/attest-run-redaction.test.ts`, one new row plus two helpers:
  - `sqliteDatabase(text, encoding)` builds a valid two-page SQLite file byte by byte. The test-runner has no SQLite dependency, and the probe below confirmed the file opens in SQLite 3.46.1.
  - `writeAheadLog(page)` wraps a page in a WAL frame.
  - The row plants the made-up password in a UTF-8 `global.sqlite` and the made-up card in a UTF-16LE `project.sqlite-wal`, beside a clean UTF-16LE `project.sqlite` and a `-shm`. It asserts exactly those two workspace findings, workspace `scannedFiles` 6 with `skippedBinaryFiles` 0, state `failed`, and no literal in the serialized result.

No file was added. `src/tests` is at its baselined 50 files.

## Commands run and observed results

All from `packages/test-runner` with `EXTENSION_TEST_BUILD_LABEL=g-attestation-sqlite`.

- **Private build.** `pnpm exec tsc -p tsconfig.json --outDir dist-gas` -> `tsc exit=0`, no output.
- **Full suite.** `node --test "dist-gas/**/*.test.js"` -> `test exit=0`, `# tests 524`, `# pass 524`, `# fail 0`.
  - The new rows appear as `ok 156 - a declared literal a workspace's SQLite store holds is a finding…`, `ok 485 - searches a SQLite store and its sidecars…` and `ok 486 - a store the scan cannot read in full is an unscanned-store finding…`.
- **Check.** `pnpm check` -> `check exit=0`.
- **Structure audit.** From the repo root, `node scripts/structure-audit.mjs` -> `audit exit=1`, `structure-audit: 2 violation(s) across 1 rule(s)`. Neither violation is in a file I own. A grep of the audit output for `secret-leak-attestation|redaction-attestation|test-runner/src/tests` matched nothing.
  - `FAIL [working-docs] docs/working/mvp-week1-web-automation-reliability-plan.md: 819 lines exceeds the 800-line compaction threshold`. Git status: ` M` (uncommitted, modified by someone else), `wc -l` 819.
  - `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`. Git status: clean. It is presumably stale because of the plan document's uncommitted header.
- **Mutation proof.**
  - Before: `sha256sum secret-leak-attestation.ts` -> `e8a5ba3458b46feac1e1404c5753a5561f2a3c8d1ab840ff9d976dca70c3f956`.
  - Mutation: `".db"`, `".sqlite"` and `".sqlite3"` put back into `binaryExtensions`. Recompiled (`exit=0`), then ran `node --test dist-gas/tests/secret-leak-attestation.test.js dist-gas/redaction-attestation/tests/attest-run-redaction.test.js` -> `exit=1`, `# tests 17`, `# pass 14`, `# fail 3`. The three failures are exactly the new rows, each with a real diff:
    - `not ok 2 - a declared literal a workspace's SQLite store holds…`: the expected `.fluxiq/global.sqlite` finding is missing.
    - `not ok 13 - searches a SQLite store…`: `store/global.sqlite` and `store/legacy.sqlite3` findings are missing.
    - `not ok 14 - a store the scan cannot read in full…`: actual `findingCount: 0, findings: [], skippedBinaryFiles: 2, status: 'passed'`.
  - Restored: the hash is identical (`byte-identical to pre-mutation: yes`). Recompiled `exit=0`, and the same two files gave `# tests 17`, `# pass 17`, `# fail 0`. `dist-gas` was then deleted and confirmed absent.
- **Scratch probe.** `node --experimental-sqlite <scratchpad>/g-attestation-sqlite-probe.mjs <dist-gas scanner> <HEAD scanner compiled in scratch>` -> `exit=0`. It used a made-up literal and prints counts, file names and categories only. The scratch probe directories were removed.
  - **A. Real databases written by SQLite 3.46.1** in UTF-8, UTF-16le and UTF-16be, plus a clean one.
    - New scanner: `failed`, `scannedFiles 4`, `skippedBinaryFiles 0`, findings on all three planted files.
    - HEAD scanner: `passed`, `scannedFiles 0`, `skippedBinaryFiles 4`, no findings. This is the reported gap, reproduced.
  - **B. A WAL-mode database left open** with autocheckpoint off. File sizes: `live.sqlite 4096`, `-wal 12392`, `-shm 32768`.
    - New scanner: finding on `wal/live.sqlite-wal` only.
    - HEAD scanner: `passed`, `skippedBinaryFiles 3`.
  - **C. The unit test's byte-level builder.** Each of the 3 built files gives `integrity ok`, the expected `PRAGMA encoding` (UTF-8 or UTF-16le), `rows 1` and `row equals planted true`.
  - **D. Overflow-page sweep.** One database per offset, holding a 10,000-character row with the 30-character literal at offsets 1760 to 1860: `found 72 missed 29 missed range 1817-1845`. See open question 1.

## Not verified

- **No Lab run.** None was allowed in this dispatch. A Lab run must show all of the following:
  - The `auth-gate` recording lane, before fixes 1 to 4, reports workspace findings on `.fluxiq/global.sqlite` and on the project's `project.sqlite` (or its `-wal`). Its `findingCount` is 8 or more.
  - After fixes 1 to 4, both lanes report `findingCount` 0.
  - The workspace scope's `skippedBinaryFiles` no longer counts the databases.
  - No `unscanned-store` finding. One would mean a store is larger than `RUN_LIMITS`: 8 MB per file, or 64 MB across one scan. I did not measure the sizes of real Lab databases.
- **Reading a store while Core's own process holds it open on Windows.** The probe read a live WAL database opened by the same process, not by Core's `sqlite3` in another process.
- **The demo attestations were not run.** `certifyDemoLlmSetupArtifacts` scans `fluxiq-root/.fluxiq` under the scanner's default limits (1 MB per file, 16 MB in total). A demo workspace database over 1 MB now fails that attestation with `unscanned-store`, where before it was silently skipped. A database holding the DeepSeek key now fails it too, which is correct.
- **Single observations.** Every probe result and each test run above rests on one run, apart from the two attestation test files, which ran twice at the restored code.
- **Parallel work.** Other workers' `flow-lane/` files changed in the tree during this work. The 524-test run compiled whatever state they were in at that moment.

## Open questions or contradictions found

1. **A raw-byte search misses a literal split across SQLite pages.**
   - When a row is longer than one page, its text continues on overflow pages that begin with a 4-byte pointer. Those pages need not be adjacent in the file.
   - The probe missed the literal at every start offset where it straddled the boundary: exactly 29 of 101 offsets, as length − 1 predicts.
   - Recorded and state documents are routinely longer than a page, so this is a real gap, not merely a theoretical one.
   - A complete check needs a SQLite reader. Options are Core's `sqlite3`, not a dependency here, or `node:sqlite`, which is flagged on this Node 22.11 and unflagged from 22.13. That choice needs the supervisor's decision.
2. **A persistent workspace keeps failing after a leak.**
   - A bounded (`persistent-isolated`) workspace is scanned only for files written since the run started. A store this run wrote to is still scanned whole.
   - So an earlier run's row, or a freed page that still holds its bytes, fails every later run until the database is vacuumed or the workspace is reset.
   - I documented this in `run-redaction-scopes.ts`, but did not change it.
3. **`attest-run-redaction.ts` is not mine to edit.** Its `failed` doc comment lists "an unreadable, oversize, reparse-point or over-limit entry" and could name `unscanned-store`. The brief should have listed that file if the comment is to change.
4. **The demo side effect** described under Not verified is a behaviour change outside the redaction attestation. It follows from the scanner being shared, and no caller I own could have scoped it away.
