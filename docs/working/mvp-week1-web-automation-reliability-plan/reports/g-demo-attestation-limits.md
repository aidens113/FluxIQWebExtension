# g-demo-attestation-limits — the demo leak check can scan Core's databases

## Outcome

Done. The demo setup leak check now uses the Lab run's byte limits: 8 MiB per file and 64 MiB per scan. Before, it used the scanner's defaults of 1 MiB and 16 MiB. A Core database or `-wal` between 1 and 8 MiB is now scanned instead of failing demo setup as `unscanned-store`, and the same goes for store files that add up to between 16 and 64 MiB. Anything over the Lab limits still fails setup.

I checked the item at HEAD first. It was still open: `certifyDemoLlmSetupArtifacts` passed no `limits`. The two comments the brief names are corrected. I found and corrected a third inaccurate comment in the same file (open question 3).

The new test row fails under two mutations and passes once they are undone. The first mutation restores the defaults. The second restores only the 16 MiB total. The source was restored byte-identical. No Lab run was allowed.

## What changed and why

**`packages/test-runner/src/demo-llm-attestation.ts`** (limits only)
- A new constant, `SETUP_SCAN_LIMITS = { maxFileBytes: 8_388_608, maxTotalBytes: 67_108_864 }`, typed with `satisfies Partial<SecretLeakAttestationLimits>`. Its doc comment says why the defaults don't fit and that anything larger still fails.
- `certifyDemoLlmSetupArtifacts` passes `limits: SETUP_SCAN_LIMITS` to `attestWorkspaceSecretAbsence`.
- `maxFiles` (2,000) and `maxDepth` (16) keep their defaults, because the brief names only the byte limits (open question 2).
- The approved paths, the summary's shape and the failure message are unchanged.

**`packages/test-runner/src/redaction-attestation/run-redaction-scopes.ts`** (comments only)
- The `workspace` scope's comment used to say the stores are searched "byte for byte". It now also says the scan reads every text and blob cell of the database a store file belongs to, from a copy with its `-wal` and `-journal`.
- The `workspaceWrittenSince` paragraph now adds a case: if this run wrote only a `-wal` or `-journal`, the whole database behind it is still read, even when the database file itself was not written.

**`packages/test-runner/src/redaction-attestation/attest-run-redaction.ts`** (comments only)
- The `failed` status comment now names `unscanned-store`. That covers:
  - a SQLite store file or database the scan could not copy or read in full;
  - one over a limit;
  - a `-wal` or `-journal` with no database beside it.
- The comment on `ENTRIES_PER_BOUNDED_SCAN` said "no scan's count or total ceiling trips on how much the run wrote". That is no longer true. It now says:
  - the database copies the scan reads cell by cell count against the same total;
  - an entry that is a `-wal` or `-journal` also copies its database, which may not be an entry;
  - so those copies can still hit the total, as `unscanned-store`.
- This matches `stageDatabase` in `secret-leak-attestation.ts:175-209`: `stagedBytes` is checked against `maxTotalBytes`, and the database behind a sidecar is staged too.

**`packages/test-runner/src/tests/demo-llm-attestation.test.ts`**: two new rows.
- **Row 3, "scans Core databases and a -wal over the default 1 MiB, and over the default 16 MiB together, up to the Lab run's ceilings".** This is the brief's row, and the one the mutations target.
  - **Setup:** Node's SQLite creates real databases through the existing `sqlite-store-reader/tests/sqlite-fixtures.ts`, under `fluxiq-root/.fluxiq`:
    - `project.sqlite` holds a `zeroblob(7500000)`, and its uncheckpointed `-wal` a `zeroblob(2000000)`;
    - `global.sqlite` holds a `zeroblob(7500000)`.
  - **Checks before the attestation:** each of the three store files is over 1 MiB and under 8 MiB, and together they are over 16 MiB and under 64 MiB.
  - **Checks after the attestation:**
    - `findingCount` is 0;
    - `scannedBytes` is at least the store files' total;
    - `scannedFiles` is at least 7;
    - the result does not contain the workspace root or the literal.
- **Row 4, "still fails setup on a Core database over the Lab run's 8 MiB per-file ceiling, which the scan cannot read".** A real `project.sqlite` holding `zeroblob(8500000)` is asserted to be over 8 MiB. Setup must reject with a `RunnerFailure` whose message is exactly `DeepSeek setup artifact attestation failed` and does not contain the root.
- The fixtures hold only zero bytes, so no literal is planted, printed or hashed. The existing sentinel is a made-up test value, not a declared scenario secret.

## Commands run and observed results

All test-runner commands ran from `packages/test-runner` with `EXTENSION_TEST_BUILD_LABEL=g-demo-attestation-limits`, and exit codes were captured by redirecting to a file.

- **Working tree before the first compile:** `git status --short packages/test-runner` showed `g-lane-consistency`'s edits in `existing-flow-run.ts`, `scenarios.ts`, `tests/existing-flow-run.test.ts` and `tests/prerequisites.test.ts`, plus their `dist-glc/`. None of them broke a compile, so no wait-and-retry was needed. Their files were compiled in whatever state they were in at the time.
- `pnpm check` -> `check exit=0`.
- `sha256sum src/demo-llm-attestation.ts`, taken before mutating -> `1ca7867e7479220d6ed1e20497c82cc367337f137f0da3ffa998568a21e3f51e`.
- `pnpm exec tsc -p tsconfig.json --outDir dist-gdal` -> `tsc exit=0`.
- **Focused run:** `node --test dist-gdal/tests/demo-llm-attestation.test.js dist-gdal/redaction-attestation/tests/attest-run-redaction.test.js dist-gdal/tests/secret-leak-attestation.test.js dist-gdal/sqlite-store-reader/tests/read-sqlite-stores.test.js` -> `focused exit=0`, `# tests 26`, `# pass 26`, `# fail 0`, `# duration_ms 5644.9728`. This includes `ok 17 - scans Core databases and a -wal over the default 1 MiB…` and `ok 18 - still fails setup on a Core database over the Lab run's 8 MiB per-file ceiling…`.
- **Full suite:** `node --test "dist-gdal/**/*.test.js"` -> `full exit=0`, `# tests 550`, `# pass 550`, `# fail 0`, `# cancelled 0`, `# duration_ms 11733.0207`.
- **Structure audit:** `node scripts/structure-audit.mjs` from the repository root -> `audit exit=0`, `structure-audit: passed (39 warning(s), 17 baselined).`
  - A search of its output for `demo-llm-attestation`, `attest-run-redaction`, `run-redaction-scopes` or `sqlite-fixtures` matched nothing.
  - No new file was added, so no scratch index was needed.
- **Mutation 1, restoring the defaults:** removed `limits: SETUP_SCAN_LIMITS,` and added `void SETUP_SCAN_LIMITS;` so the unused constant still compiles.
  - `m1 tsc exit=0`, `m1 test exit=1`, `# tests 4`, `# pass 3`, `# fail 1`.
  - The failing row: `not ok 3 - scans Core databases and a -wal over the default 1 MiB, and over the default 16 MiB together, up to the Lab run's ceilings`, with `error: 'DeepSeek setup artifact attestation failed'`.
- **Mutation 2, restoring only the 16 MiB total:** undid mutation 1, then changed `maxTotalBytes: 67_108_864` to `16_777_216`.
  - `m2 tsc exit=0`, `m2 test exit=1`, `# tests 4`, `# pass 3`, `# fail 1`.
  - The failing row was the same, `not ok 3 - …`, with the same error.
- **Restored:** undid mutation 2, then:
  - `sha256sum -c` -> `src/demo-llm-attestation.ts: OK`, `byte-identical check exit=0`;
  - `restored tsc exit=0`, `restored test exit=0`, `# tests 4`, `# pass 4`, `# fail 0`.
- **Control bytes:** a Node byte count over the four edited files printed `control-bytes=0` for each.
- **Comments only:** counting changed diff lines that are not comment lines gave `run-redaction-scopes.ts non-comment changed lines=0` and `attest-run-redaction.ts non-comment changed lines=0`.
- **Diff stat:** `demo-llm-attestation.ts | 12`, `attest-run-redaction.ts | 14`, `run-redaction-scopes.ts | 13`, `tests/demo-llm-attestation.test.ts | 39`; `4 files changed, 68 insertions(+), 10 deletions(-)`. Git warned about LF to CRLF for each file; the diff holds only the intended hunks.
- **Cleanup:**
  - after all runs, `%TEMP%` held 0 entries matching `fluxiq-store-read-*`, `fluxiq-demo-llm-attestation-*` or `fluxiq-secret-attestation-*`;
  - `rm -rf dist-gdal` -> `dist-gdal absent`.

## Not verified

- **No Lab run and no demo command.** Lab Stage 3's provider-free `demo:record` and `demo:run` must show:
  - setup completes, with no `DeepSeek setup artifact attestation failed` (`recording.persistence`);
  - the returned summary has `findingCount` 0 and a `scannedBytes` that covers the `.fluxiq` stores.

  If setup still fails there, one of these is true: a Core store file is over 8 MiB, the stores total over 64 MiB, the workspace has more than 2,000 files (open question 2), or the literal really is present.
- **Real demo store sizes were not measured.** The fixtures stand in for Core's databases.
- **Why row 4 fails is not asserted.** `certifyDemoLlmSetupArtifacts` hides its findings, so row 4 checks only that setup fails, not that the finding is `unscanned-store`. No mutation fails row 4 alone, because the old defaults fail it too. It pins the brief's "anything larger fails" contract and does not guard the change.
- **Row 3 does not prove the cell reader read these large databases.** The byte search is proven by `scannedBytes`. The cell read rests on the scanner's contract that a staged database the reader cannot read, or one over a limit, is `unscanned-store`, which would fail row 3. No literal was planted in a large database; the existing `secret-leak-attestation` rows cover finding a literal in a database and its WAL.
- **Single observations:** the full suite ran once, as did the focused run of 26. The demo file ran three more times: under each mutation and once restored.
- **Parallel work:** other workers' files in this package were compiled mid-edit.

## Open questions or contradictions found

1. **The limits are written in two places.** `SETUP_SCAN_LIMITS` repeats the numbers in `RUN_LIMITS`, which is private to `attest-run-redaction.ts:59`. If the Lab's limits were lowered, the demo would not follow. It cannot go above them either way, because `resolveLimits` rejects anything over the scanner's `ABSOLUTE_LIMITS`. One shared constant would need `attest-run-redaction.ts` to export `RUN_LIMITS`, or the scanner to export its limits. That is a code change outside this brief's comments-only ownership of that file.
2. **The file count and depth limits are still the defaults** (2,000 files, depth 16), where the Lab uses 10,000 and 32. The brief named only the byte limits. A demo workspace past 2,000 scanned files would fail with `file-limit`. That was not measured.
3. **A third comment was wrong, and I corrected it.** The brief said "the two comments", but `ENTRIES_PER_BOUNDED_SCAN`'s comment in `attest-run-redaction.ts` also no longer described the check (see What changed). The edit is comments only, in a file whose comments I own. Say if it should have been left.
4. **Architecture pages** were not checked for the same outdated "byte for byte" wording. That is outside this brief.
