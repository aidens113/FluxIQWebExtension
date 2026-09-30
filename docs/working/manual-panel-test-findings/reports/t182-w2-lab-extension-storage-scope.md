# t182-W2: Lab redaction attestation scans the extension's browser-profile storage

## Outcome

Done. The Lab's post-run redaction attestation now has a third scope,
`extension-storage`, covering the run-owned Chromium profile's extension
storage. LevelDB files there are searched byte for byte for every declared
literal in UTF-8 and UTF-16LE. They no longer fail closed as binary, and they
are no longer excluded. Snappy decoding was cheap enough to add without a
dependency, so tables are also decompressed block by block. The search is
still best effort, not a guarantee (see Limits).

## What changed and why

All paths are under `packages/test-runner/src/`.

- `redaction-attestation/leveldb-store/` (new module with barrel `index.ts`):
  - `is-leveldb-file.ts`: `isLevelDbFile(name)` matches `N.log`, `N.ldb`,
    `N.sst`, `MANIFEST-N`, `CURRENT`, `LOCK`, `LOG` and `LOG.old`.
  - `read-varint.ts`: a LevelDB/Snappy varint reader.
  - `decode-snappy.ts`: a raw Snappy block decoder. It throws on malformed
    input.
  - `log-records.ts`: reassembles log/MANIFEST records across 32 KiB block
    boundaries. In the raw file, a 7-byte fragment header can split a literal.
  - `table-blocks.ts` and `table-read.ts`: walk a sorted table's footer and
    index block, then decompress every data block (type 0 none, type 1
    Snappy). Any other case returns `{decoded:false, reason}`.
  - `search-leveldb-file.ts`: searches the raw bytes, then the reassembled log
    records or the decoded table blocks. Files over 32 MiB get only a chunked
    raw search and report `decoded:false`.
  - `scan-leveldb-files.ts`: searches every file once for all literals. A hit
    is a `secret-literal` finding. A read error is `unscanned-store` (fails
    closed). A file whose structure could not be walked is counted as
    undecoded, not failed.
- `redaction-attestation/chromium-extension-storage-dirs.ts` (new): lists the
  profile's `Default/Local Extension Settings/*` and
  `Default/Sync Extension Settings/*`, plus only the
  `Default/IndexedDB/chrome-extension_*` entries. Web origins' IndexedDB is
  left out. A missing directory (ENOENT) contributes nothing, and any other
  read error throws. The extension ID is not known at the call site. That is
  safe here because the Lab's browser loads only our extension
  (`--disable-extensions-except`), so every child is taken, including any
  component extension's storage.
- `redaction-attestation/run-redaction-scopes.ts`: new optional input
  `extensionStorage: { profileDir, dirs, writtenSince? }`. It produces
  `{ name: "extension-storage", root: <profile>, paths: [relative dirs], store: "leveldb", writtenSince? }`.
  The scope is omitted when there are no dirs, and the builder throws if a
  dir is outside the profile. The doc comment is updated; the old "profile
  deliberately not a scope" paragraph was replaced.
- `redaction-attestation/attest-run-redaction.ts`:
  - `RunRedactionScope` gains `store?: "leveldb"`.
  - `RunRedactionScopeSummary` gains `undecodedLevelDbFiles?` (set only on
    LevelDB scopes).
  - A LevelDB scope is walked with `writtenEntries`, whether bounded or not.
    That walk now returns `{relative, file}` so a link or unreadable entry is
    never byte-searched.
  - Regular files with LevelDB names go to `scanLevelDbFiles`. Everything else
    (other files, links, unjudgeable entries) goes to the existing text
    scanner in chunks, so those still fail closed.
- `redaction-attestation/index.ts`: exports the new modules. Header comment
  updated.
- `run-scenario.ts`: only the attestation call and its import changed. It now
  passes
  `extensionStorage: { profileDir: topology.allocation.browserProfileDir, dirs: await chromiumExtensionStorageDirs(profileDir), writtenSince }`
  whenever a topology exists. `writtenSince` is the run start on
  `persistent-isolated`, as for the workspace. In every target mode the
  profile is the allocation's own (`allocateRun` or `allocatePersistentRun`
  creates `browser-profile`). No mode launches a user's own profile, so no
  mode needed excluding. The browser context is closed (line ~538) before
  the attestation runs.
- Tests (new):
  - `redaction-attestation/leveldb-store/tests/search-leveldb-file.test.ts`
    (5 tests): LevelDB names; Snappy literal and overlapping copies, and that
    malformed input throws; a log record split by a block header is
    reassembled (the raw file provably lacks the literal); table decode, and
    that an unknown compression or missing magic is not decoded; the search
    finds a literal that a Snappy copy split (absent from raw bytes), finds
    UTF-8 and UTF-16LE literals in a `.log`, passes a clean file, and reports
    a footerless `.ldb` as `decoded:false`.
  - `redaction-attestation/tests/extension-storage-redaction.test.ts`
    (5 tests):
    - the dir lister includes extension settings and extension IndexedDB but
      not a web origin's IndexedDB, and returns `[]` for a never-launched
      profile;
    - the scopes builder includes, omits, bounds and rejects-outside as
      expected;
    - a literal in the extension `.log` is found in UTF-8 and in UTF-16LE,
      named by scope and path only, and the literal is absent from the
      result JSON;
    - a clean store passes as `verified`: 5 LevelDB files scanned, 0 skipped
      as binary, 1 undecoded (a footerless `.ldb`), and binary
      `.log`/`.ldb`/`MANIFEST` files no longer fail closed;
    - a non-LevelDB file (`notes.txt`) in the store still goes to the text
      scan and is found, and a bounded scope with nothing written since scans
      0 files.

## Commands run and observed results

- Free RAM was checked before each build or test: 4044 MB, then 1716 MB. The
  second reading is under the 2 GB bar the brief set. I ran only the same
  focused tests, and they completed.
- In `packages/test-runner`, `npx tsc -p tsconfig.json --noEmit` exited 0,
  both the first time and after the final edits.
  `domain/dist/index.d.ts` already existed.
- In `packages/test-runner`, I ran
  `npx tsc -p tsconfig.json --outDir .t182-w2-build`, then
  `node --test` on the four redaction-attestation test files: the two new
  files plus the existing `attest-run-redaction.test.js` and
  `scenario-redaction-literals.test.js`. Final run:
  `# tests 24  # pass 24  # fail 0`. I deleted the private build directory
  afterwards and did not touch the shared `dist/`.
- From the repo root, `node scripts/structure-audit.mjs` ended with
  `structure-audit: 4 violation(s) across 3 rule(s)`. None is in my paths.
  They are all in `apps/extension/src/background/`: `diagnostics/problem-log.ts`
  (failure-as-empty), `diagnostics/` (naming), `reconnect-watchdog.ts` and
  `storage.ts` (swallowed-failure). Those files are another worker's
  uncommitted changes. My first run also flagged
  `leveldb-store/table-blocks.ts` for failure-as-empty; I fixed that by
  returning `{decoded:false, reason}`, and the second run showed it gone.

## Limits (best effort, not a guarantee)

- **Snappy tables.** Only LevelDB table compression types 0 (none) and 1
  (Snappy) are decoded. An undecodable table (unknown type, malformed, or
  over 32 MiB) gets only the raw byte search, which a Snappy back-reference
  can defeat. It is counted in `undecodedLevelDbFiles` and does not fail the
  run. Block checksums are not verified.
- **Keys.** Table keys are prefix-compressed, so a literal inside a key could
  be split across entries. Values are searched whole after decoding.
- **Encodings.** Only UTF-8 and UTF-16LE are searched. A Latin-1 IndexedDB
  string equals UTF-8 for an ASCII literal. UTF-16BE is not searched.
- **Deleted data.** Old data that LevelDB compaction has already dropped is
  gone, and nothing can see it. On `persistent-isolated`, compaction can also
  rewrite an earlier run's value into a new `.ldb` file. A clean run would
  then be failed for a leak an earlier run left behind.
- **Other browsers.** Only Chromium is covered. The Lab's run browser is
  Playwright `chromium.launchPersistentContext` (`launch-browser.ts`), and
  there is no Firefox run lane, so `storage-sync-v2.sqlite` and
  `moz-extension+++*` are not scoped.
- **Profile layout.** The scope assumes Chromium's `Default/` profile layout.
  If Chromium renames those directories, the lister returns `[]` and the
  scope is silently omitted.

## Not verified

- No live Lab run, no browser launched. Per the brief, the scan has not been
  exercised against a real Chromium-written extension LevelDB directory.
  The Snappy and table readers were checked only against hand-built fixtures
  laid out from the leveldb and Snappy format documents. Whether real
  Chromium `.ldb` files decode (`undecodedLevelDbFiles == 0`) is unverified.
- Full `pnpm --filter @fluxiq-web-extension/test-runner test`,
  `pnpm check` and `pnpm build` were not run (RAM limits; the brief asked for
  focused tests). In particular, `run-evaluation/tests/runner-wiring.test.ts`
  and `run-manifest/tests/create-run-manifest.test.ts`, which reference
  redaction attestation, were not run.
- `interactive-session.ts` and `saved-flow-replay` launch browsers too, but
  they do not run this attestation. They were not touched.

## Open questions or contradictions found

1. **Panel `localStorage` is not scanned.** The extension also writes the
   panel page's `localStorage` (the Simple conversation draft,
   `panel/simple/conversation/draft-storage.ts`). Chromium keeps it in
   `Default/Local Storage/leveldb`, which is shared with every web origin the
   run visited. Scanning it would attribute a scenario site's own
   localStorage writes to FluxIQ. Separating origins needs per-key parsing
   (keys are prefixed `_chrome-extension://<id>`). The supervisor should
   decide whether to scan the whole directory or add key-level filtering.
2. **Undecodable tables do not fail the run.** I chose to count them rather
   than fail closed, because the reader is not a full LevelDB
   implementation. If the supervisor prefers failing closed, make any
   `undecodedLevelDbFiles > 0` an `unscanned-store` finding. That should
   happen only after confirming against a real run that Chromium tables
   decode.
3. **Existing-target docs disagree with the call site.** `testing-facility.md`
   says the existing target is left unattested. The call site passes the
   profile whenever a topology exists, which includes existing mode, because
   its profile is `allocateRun`'s. If redaction literals do reach existing
   mode, its extension storage is now scanned too.

## Doc edits needed (not made; `docs/architecture/` is not mine)

- `docs/architecture/testing-facility.md`, "Scopes" bullet (~line 1666):
  - add the `extension-storage` scope: the profile's
    `Default/Local Extension Settings/*`, `Default/Sync Extension Settings/*`
    and `Default/IndexedDB/chrome-extension_*`, bounded by `writtenSince` on
    `persistent-isolated`;
  - replace "The browser profile is not scanned, because the extension's
    LevelDB storage is binary" with a new **LevelDB stores** bullet beside
    "SQLite stores". It should cover: the byte-for-byte UTF-8/UTF-16LE
    search, log record reassembly, Snappy table decode, the best-effort
    limit, `undecodedLevelDbFiles` in the scope summary (recorded, not
    failed), `unscanned-store` for unreadable files, and that non-LevelDB
    files there still get the text scan;
  - note that Local Storage and Firefox are not covered.
- `docs/architecture/sensitive-values.md`: wherever it lists where recorded
  page data and pairing tokens can persist, and what the Lab attests
  (extension `chrome.storage.local` queued events and session), state that
  the Lab now scans extension `chrome.storage.local` on disk for declared
  literals, best effort for compressed tables. It should also state that the
  panel `localStorage` draft is not covered. I found no existing mention to
  amend (grep for redaction/attestation/LevelDB there found none relevant),
  so this is a new note.
