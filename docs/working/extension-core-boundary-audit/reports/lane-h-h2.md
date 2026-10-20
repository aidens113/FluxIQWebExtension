# Lane H, brief H2 (t727): Core mirror check

## Outcome

Done. `pnpm check` now runs `node scripts/check/core-mirror.mjs` right after the
core-build gate. It fails when a mirrored file differs from Core's copy or exists
on one side only.

## What changed and why

- `scripts/check/core-mirror.mjs` (entry). Resolves Core with `resolveCoreSibling`
  (through the `scripts/worktree/index.mjs` barrel). A missing Core exits 1 with a
  message naming the expected path. Otherwise it compares every set, prints a one-line
  summary (exit 0), or lists the drifted paths and the remedy (exit 1). `--json` prints
  the result.
- `scripts/check/core-mirror/mirrors.mjs`: `CORE_MIRRORS`, the declared sets. Each set is
  `{ name, include, exclude }`. A path ending in `/` covers a directory. For now the only
  set is `structure-audit`: it includes `scripts/structure-audit.mjs` and
  `scripts/structure-audit/`, and excludes `scripts/structure-audit/config.mjs`. Adding a
  later mirror takes one entry.
- `set-files.mjs`: `mirrorSetFiles(set, files)` picks out the covered files and applies
  the excludes.
- `compare.mjs`: `compareMirrors({ extRoot, coreRoot, sets, listFiles? })`. Each side's
  file list comes from `listRepositoryFiles` (tracked plus untracked files that are not
  ignored), imported from `scripts/structure-audit/repository-files.mjs` rather than
  copied. It normalises CRLF to LF before comparing, and reports differences as
  `differs`, `extension-only` or `core-only`.
- `format.mjs`: `formatMirrorReport(result, coreRoot)` builds the summary or the drift
  list plus the remedy line ("change Core first, then copy the file here;
  scripts/structure-audit/config.mjs is the only per-repository file").
- `index.mjs` barrel.
- Tests in `scripts/check/core-mirror/tests/`:
  - `compare.test.mjs`: each case uses its own `mkdtemp(os.tmpdir(), "core-mirror-")`
    fixture with two `git init` repositories. It covers: in sync; a one-byte difference
    names the file; one-sided files on each side; a difference that is only CRLF passes;
    a differing or missing `config.mjs` passes.
  - `set-files.test.mjs`: tests the include and exclude logic.
- Root `package.json`:
  - `check` now runs the new gate right after `node scripts/check/core-build.mjs &&`.
  - New script: `"check:mirror": "node scripts/check/core-mirror.mjs"`.
  - The existing `"scripts/check/**/tests/*.test.mjs"` glob picks up the new tests.
  - No other scripts changed.

## Commands run and observed results

- `node --test "scripts/check/core-mirror/tests/*.test.mjs"` -> `# tests 6 / # pass 6 / # fail 0`.
- `node --test "scripts/check/**/tests/*.test.mjs"` (the glob used by `check` and `check:test`) -> `# tests 15 / # pass 15 / # fail 0`. The new tests are included.
- `node scripts/check/core-mirror.mjs` on the t727 tree -> `core-mirror: 1 mirror set(s) match FluxIQ Core at C:\Users\osrs_\FluxStuff\fxwork\t727\!FluxIQ: structure-audit (56 files).`, exit 0. The other worker's rule file was not one-sided at the time of the run: either it was not written yet, or it was already present on both sides.
- `node scripts/check/core-mirror.mjs --json` -> `"inSync": true`, set `structure-audit`, `"files": 56`, `"differences": []`.
- `node scripts/structure-audit.mjs` -> exit 0, `structure-audit: passed (212 warning(s), 635 baselined).` No finding or warning mentions `core-mirror` or `package.json`.

## Not verified

- The missing-Core branch of the entry: no test covers it, and Core was present.
- A drift failure on the real tree. It is covered only by the fixture tests, because the real mirror files were not modified.
- The full `pnpm check`, which per AGENTS.md runs only in the twice-daily sweep.

## Open questions or contradictions found

- The brief says to report the other worker's new rule file if it appears one-sided. At the time of my run the check reported nothing one-sided. If the rule file lands in only one repository, this gate will fail until the file is copied to the other side. That is the intended behaviour.
