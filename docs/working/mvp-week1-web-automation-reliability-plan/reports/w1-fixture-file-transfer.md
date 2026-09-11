# w1-fixture-file-transfer report

Worker `w1-fixture-file-transfer`. Brief: `briefs/wave-1.md`, sections
`Brief: w1-fixture-file-transfer` and `Fixture briefs: common terms`.

## Outcome

Done. The `file-transfer` fixture replaces the placeholder with the primary
workflow W16 (download the seeded report CSV) and the `upload` workflow W17
(upload a file and see the echoed name). Neither has variants.

The three DoD commands pass in the repository. The final rerun ran at
12:54:16, after other workers' temporary breaks cleared: the build exited 0,
the node test passed 11 of 11, and Playwright passed 4 of 4. The structure
audit passes with no finding in my files.

## What changed and why

The placeholder `apps/scenario-lab/src/scenarios/file-transfer/scenario.ts` is
replaced by a real fixture for corpus rows W16 (download) and W17 (upload). The
export name `fileTransferScenario`, id `file-transfer`, seed `119`, start path
`/scenarios/file-transfer/`, and title `File transfer` are unchanged.

Files, all under `apps/scenario-lab/src/scenarios/file-transfer/` unless noted.
Each exports a single value.

| File | Exports | Responsibility |
| --- | --- | --- |
| `scenario.ts` | `fileTransferScenario` | `defineScenario` wiring (manifest, state, mutate, render, route) |
| `manifest.ts` | `fileTransferManifest` | primary workflow W16, `workflows[]` entry `upload` (W17) |
| `report.ts` | `fileTransferReport` (+ type) | seeded report: `report-<seed>.csv`, 4 rows derived arithmetically from the seed |
| `state.ts` | `createFileTransferState` (+ types) | the oracle published at `/__control/final-state` |
| `mutate.ts` | `mutateFileTransferState` | `record-download` and `upload` operations |
| `route.ts` | `routeFileTransfer` | `report.csv` and `download-status` |
| `page.ts` | `renderFileTransferPage` | start page markup and its module script |
| `tests/scenario.test.ts` | — | 11 node:test cases |
| `apps/scenario-lab/e2e/file-transfer.spec.ts` | — | 4 Playwright tests |

State (`FileTransferState`): `{ seed, reportFilename, downloadCount,
uploadCount, lastUpload: { name, size } | null }`. `createState(119)` is
`{ seed: 119, reportFilename: "report-119.csv", downloadCount: 0, uploadCount: 0, lastUpload: null }`.

Download:

- The link `<a data-testid="download-report" href="/scenarios/file-transfer/report.csv">Download report</a>`
  has no `download` attribute. The server header alone makes it a download,
  as on real sites.
- `route` answers `report.csv` with 200, `content-type: text/csv; charset=utf-8`,
  `content-disposition: attachment; filename="report-119.csv"`, and the seeded
  CSV body. It also returns `mutation: { operation: "record-download", payload: { filename } }`.
  The server applies that mutation on GET only; the HTTP test proves that a
  HEAD does not count.
- `record-download` counts only when the payload's filename equals the
  state's report filename, so a stray call cannot record an unrelated file.
- After the link is clicked, the page polls `GET /scenarios/file-transfer/download-status`
  (JSON `{ filename, downloadCount }`, no mutation) every 50 ms for up to 100
  attempts; both are fixed constants. When the server-side count rises, it
  inserts `<p data-testid="download-recorded">Downloaded report-119.csv</p>`
  into an `aria-live` region.
- Why the page polls: runner facts are DOM probes read once, without retry
  (`packages/test-runner/src/scenario-assertions.ts`). The server-recorded
  download has to show in the DOM for `expected.finalState` to mean "the
  download happened".

Upload:

- The form (`data-testid="upload-form"`, `novalidate`) holds
  `<label for="upload-file">File to upload</label>`, `<input type="file" id="upload-file" data-testid="upload-file">`,
  a hint referenced by `aria-describedby`, and `<button type="submit" data-testid="upload-submit">Upload</button>`.
- The submit handler reads `file.name` and `file.size`, calls
  `mutate('upload', { name, size })`, and writes `Uploaded <name>`
  (`upload-result`) and `<size> bytes` (`upload-size`) from the returned
  snapshot.
- With no file chosen it shows `upload-error` "Choose a file to upload." and
  does not call `mutate`.
- The server records only a name of 1–255 characters with no `/` or `\`, and
  a size that is a non-negative safe integer. Every other payload field is
  dropped, so file contents never reach state.

Both status regions are also rendered server-side from state, so a reload
shows what the oracle recorded. Uploaded names are HTML-escaped.

No `index.ts` barrel: `apps/scenario-lab/src/registry.ts` (not mine) imports
`./scenarios/file-transfer/scenario.js`. With a barrel present, the imports
rule of `scripts/structure-audit.mjs` would count that line as reaching past
the barrel. Sibling scenario directories have no barrel either.

## Workflows and variants

| Workflow | Corpus row | Recording script | Expected outcome |
| --- | --- | --- | --- |
| primary | W16 | `click testid:download-report`; `waitForDownload "report-119.csv"` (5 s); `waitForState testid:download-recorded` (5 s) | Success. pageFacts: `download-report` visible, `report-filename` text `report-119.csv`, `download-recorded` absent. recordingEvents `web.element.clicked` ×1; actions `web.dom.click` succeeded; finalState `download-recorded` text `Downloaded report-119.csv`; no console errors. Oracle: `downloadCount: 1`. |
| `upload` | W17 | `upload testid:upload-file "expense-receipts.csv"`; `click testid:upload-submit`; `waitForState testid:upload-result` (5 s) | Success. pageFacts: `upload-form` visible, `upload-result` absent. recordingEvents `web.element.clicked` ×1; actions `web.dom.click` succeeded; finalState `upload-result` text `Uploaded expense-receipts.csv`; no console errors. Oracle: `uploadCount: 1`, `lastUpload: { name: "expense-receipts.csv", size: <bytes supplied> }`. |

Variants: none, per the brief. The manifest declares `variants` on neither
workflow; both the node test and the e2e spec assert this.

### Corpus decisions

1. **A trailing `waitForState` in each workflow.** This step is not in the
   brief's step list. Facts are evaluated once, immediately after the script,
   and the status lines appear asynchronously: a poll after the download, and
   a `mutate` round trip after submit. Without the wait, `finalState` would
   race.
2. **`report-<seed>.csv` follows the lab seed.** The state is created from the
   store seed. The manifest's `waitForDownload` value and pageFact are
   computed for seed 119, which the runner uses by default
   (`run-scenario.ts:46`, `options.seed ?? scenario.seed`). A run with an
   explicit different seed serves `report-<N>.csv` and fails W16 by design of
   the brief's filename rule.
3. **`expected.actions` lists only `web.dom.click`.** No upload or
   download-wait action exists yet, and I did not invent Phase 1.2 action
   names. With today's extension, a FluxIQ playback of W17 cannot set a
   file, so W17 is expected to fail on playback lanes (finalState unmet) until
   an upload action exists. That is the reliability gap the row measures, not
   a fixture defect.
4. **W17 `recordingEvents` asserts only the submit click.** I did not
   establish what the recorder emits for a file input set by `setInputFiles`,
   so that change is left unasserted.
5. **Capabilities and tags.** Capabilities are `download`, `forms`,
   `mutation`. Tags are `file-transfer`, `download`, `upload`, `forms`; the
   matrix-parity worker derives tags from manifests.

## Commands run and observed results

### Structure audit

- `node scripts/structure-audit.mjs`, run before my first edit and again after
  my last. Both runs printed `structure-audit: passed (27 warning(s), 19 baselined).`
  and `structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.`
- The lowerable entry predates my edits: the pre-edit output is identical.
  `grep -ciE "scenario-lab|file-transfer"` over the final output printed `0`.

### DoD commands in the repository

Every failure below is in another worker's files.

1. `pnpm --filter @fluxiq-web-extension/scenario-lab build` exited 2. Its only
   errors were `src/scenarios/data-table/table-page.ts(15,49)` and `(16,50)`,
   TS1487 "Octal escape sequences are not allowed".
   - `node --test apps/scenario-lab/dist/scenarios/file-transfer/tests/scenario.test.js`
     failed with `SyntaxError: Octal escape sequences are not allowed in template strings`
     while loading `dist/scenarios/data-table/table-page.js` through the registry.
   - `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/file-transfer.spec.ts`
     failed with Babel's `Invalid escape sequence in template` in
     `data-table/table-page.ts:15`, then `No tests found`.
2. Rerun once: identical results.
3. After data-table was fixed, the build still exited 2. Its only error was
   `src/scenarios/modal-flows/mutate.ts(35,22)`, TS2322; a rerun was identical.
   - The node test failed with `ERR_MODULE_NOT_FOUND: Cannot find module '…\packages\test-contracts\dist\bench-report-validation.js' imported from …\dist\index.js`.
   - Playwright failed on the same missing module, which it reached through
     the tsconfig `paths` entry pointing at `dist/index.d.ts`, then printed
     `No tests found`.
   - At 12:51:19, `packages/test-contracts/dist/index.js` (built 12:50:38)
     re-exported `./bench-report-validation.js`, a file absent from `dist`
     while `src/bench-report-validation.ts` existed. Another worker's rebuild
     was in progress.

### Isolated verification of this fixture

To prove the fixture itself while the shared tree was broken, I ran both
suites on copies in the scratchpad. Only the copy's data-table escapes were
patched (`\25B2` to `\\25B2`, and the same for `\25BC`). `node_modules` was
reached through a directory junction to `apps/scenario-lab/node_modules`,
removed after each run. The repository was not touched.

- The node test on a copy of `dist`: exit 0, `# tests 11`, `# pass 11`,
  `# fail 0`. All 11 cases were `ok`, from "manifest is valid…" to "over HTTP,
  a GET of the report records one download, HEAD records none, and uploads
  reach the oracle".
- Playwright on a copy of `src` and `e2e`, headless `channel: "chromium"`:
  exit 0, `Running 4 tests using 4 workers` … `4 passed (4.7s)`. The tests:
  - W16 primary (1.2 s)
  - W17 upload (758 ms)
  - submitting without a file (653 ms)
  - no variants declared (12 ms)

### Final rerun in the repository

This run started once `packages/test-contracts/dist` re-exported only files
that exist. It ran these three commands in sequence:

- `pnpm --filter @fluxiq-web-extension/scenario-lab build`
- `node --test apps/scenario-lab/dist/scenarios/file-transfer/tests/scenario.test.js`
- `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/file-transfer.spec.ts`

Observed output (the Playwright lines are grep-filtered from the list
reporter):

```text
contracts consistent at 12:54:16
build exit: 0
node test exit: 0
# tests 11
# pass 11
# fail 0
playwright exit: 0
Running 4 tests using 4 workers
  ok 4 e2e\file-transfer.spec.ts:114:1 › the fixture declares no variants, so no variant is armed (10ms)
  ok 3 e2e\file-transfer.spec.ts:106:1 › submitting the upload form without a file explains the problem and records nothing (706ms)
  ok 1 e2e\file-transfer.spec.ts:94:1 › W17 upload: the chosen file's name and size are recorded and the name is echoed (832ms)
  ok 2 e2e\file-transfer.spec.ts:82:1 › W16 primary: the download link yields the seeded report CSV and the download is recorded (908ms)
  4 passed (2.9s)
```

The build result is a snapshot. The other fixture workers are still editing
sibling directories and can break the shared build again.

What the e2e spec proves:

- It drives each workflow's own manifest script through Playwright.
- It reads every pageFact before the script and every finalState fact after
  it, once and without waiting, as the runner's probe does.
- W16: the downloaded file's name is `report-119.csv`, its bytes equal
  `fileTransferReport(119).csv`, the page does not navigate, and the oracle
  reads `downloadCount: 1`.
- W17: the oracle reads `lastUpload: { name: "expense-receipts.csv", size: 31 }`,
  and a reload shows the echo again.
- The network guard stays clean, and no console errors or page errors occur.

## Not verified

- The extension recording lane and FluxIQ playback on this fixture. Runner
  support for `upload` and `waitForDownload` is being added in parallel by
  `w1-runner-asserts`. Today's `executeStep` (`run-scenario.ts:357`) handles
  neither, so `pnpm lab run file-transfer` was not attempted.
- What the extension records for a file input change.
- Browsers other than Chromium (`channel: "chromium"`, headless).
- The e2e spec drives the lab at seed 119 only. Another seed's filename and
  CSV are covered by the node test (seed 42).

## Open questions or contradictions found

- **Another fixture breaks the build.** `apps/scenario-lab/src/scenarios/data-table/table-page.ts`
  lines 15–16 hold `\25B2` and `\25BC` inside a template literal (TS1487, and
  a SyntaxError at load). That breaks the whole scenario-lab build and every
  test that loads the registry. A likely cause: the Bash tool collapses `\\`
  to `\` even inside a quoted heredoc. I hit this on my own `mutate.ts`,
  where `/[\\/]/` became `/[\/]/`, and fixed it with Edit. The Bash tool also
  refuses a command whose text holds an odd number of apostrophes. Workers
  writing escapes or prose through Bash should be warned.
- **Barrels.** `AGENTS.md` asks for a barrel in every directory, but
  `registry.ts` deep-imports each `scenario.js`. Adding barrels to scenario
  directories needs a coordinated `registry.ts` change, which the supervisor
  owns.
- **The seed rule makes W16 seed-sensitive** (decision 2). If the bench ever
  runs fixtures at a non-default seed, the manifest needs a seed-independent
  name, or the runner must resolve `<seed>`.
- **A config change that is not mine.** `git status` shows
  `apps/scenario-lab/e2e/playwright.config.ts` as modified. I did not edit it:
  it already carried the `channel: "chromium"` change when I first read it.
  Playwright output from my runs went to `apps/scenario-lab/e2e/test-results/`,
  which `.gitignore:18` (`test-results/`) ignores.
- **Misleading pnpm message.** `pnpm --filter … exec playwright test …` prints
  `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "playwright" not found` whenever
  Playwright exits non-zero. Playwright did run; the message is pnpm's.
