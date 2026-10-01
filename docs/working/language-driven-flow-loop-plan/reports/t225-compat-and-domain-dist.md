# t225: URL.canParse compatibility, and a domain dist that never rebuilt

## Outcome

Done. Both defects fixed and validated in worktree
`C:/Users/osrs_/FluxStuff/fxwork/t225-compat-and-domain-dist`
(branch `task/t225-compat-and-domain-dist`, base `84766496`). Nothing committed.

## What changed and why

### Defect 1: `URL.canParse`

- New `apps/extension/src/shared/parsed-url.ts`: `parsedUrl(raw, base?)` returns
  `new URL(raw[, base])`, or `undefined` on the constructor's `TypeError`; other
  errors are rethrown, the same as the two private helpers that already existed.
- The five non-test call sites now use it (grep found a fifth beyond the four in
  the brief, `runtime/quoted-path.ts`):
  - `background/page-pace/page-origin.ts`
  - `content/extraction/pagination.ts`
  - `content/identity/record.ts`
  - `runtime/navigation-target.ts`
  - `runtime/quoted-path.ts`
- New `apps/extension/src/shared/tests/parsed-url.test.ts`, which covers:
  - absolute addresses;
  - relative addresses resolved against a base;
  - input that does not parse (empty, junk, relative with no base, bad base,
    bad IPv6) returning `undefined`;
  - an empty base counting as a bad base;
  - `parsedUrl` still working with `URL.canParse` deleted from `URL`.
- New guard test `apps/extension/src/shared/tests/no-url-can-parse.test.ts`:
  - It scans every non-test `.ts/.tsx/.js/.mjs` under `apps/extension/src`, skipping
    `tests/` folders and comments, and fails on `URL.canParse`.
  - Its failure message names the cause: Chrome 120 / Firefox 115, against the
    `minimum_chrome_version` read from `manifest.chrome.json`.
  - It finds the package root by walking up to `manifest.chrome.json`, because the test
    runs from a bundle under `.test-build-scratch/<label>/`.
  - It also checks that it found more than 50 files, so an empty scan cannot pass.
- I checked that the guard really catches the call: its regex and comment stripping
  flag the pre-fix `quoted-path.ts` (`true`) but not `page-url.ts`, which mentions the
  API only in a comment (`false`).

### Defect 2: stale domain dist

- `packages/test-runner/scripts/domain-dist.mjs` now always calls
  `runStep("domain:build")`. The existence check on `dist/index.d.ts` is removed. I
  rewrote the header comment to give the reason and the old failure (TS2305 against
  a stale dist).
- How `runStep` decides to reuse (`scripts/build-cache/decide-step.mjs`): it takes a
  stat-cached fingerprint of the step's inputs and compares it with the stamp. It also
  checks that the required outputs exist and that the output digest matches.
- Reuse returns at once with no lock taken. A rebuild takes the per-step lock, so
  concurrent callers do not build twice. A changed input can also be restored from
  the shared store.
- No test of `domain-dist.mjs` exists (`packages/test-runner/scripts/` has none).
  No authored doc under `docs/architecture/` names either behaviour, so no doc needed
  changing.

## Commands run and observed results

1. `heavy.sh "t225 extension check" pnpm --filter @fluxiq-web-extension/extension check`
   - First attempt failed with TS1005, caused by my own test file: the heredoc ate a
     backslash in a regex. Fixed.
   - Rerun: `{"build-cache":"build","step":"extension:check","reason":"no stamp; stored in the shared store ...","ms":125620}`, exit 0.
2. `heavy.sh "t225 extension test" pnpm --filter @fluxiq-web-extension/extension test`
   - Exit 0: `# tests 1720`, `# pass 1720`, `# fail 0`.
   - The new tests ran: ok 1676 (the guard), and 1677 to 1681 (`parsedUrl`).
3. `pnpm --filter @fluxiq-web-extension/test-runner test`, first run in the fresh worktree.
   - `{"build-cache":"build","step":"domain:build","reason":"no stamp; ..."}`, then TS2307:
     `@fluxiq-web-extension/test-evidence` was not built in this new worktree.
   - Built the prerequisites: `pnpm --filter ... test-contracts build && ... test-evidence build`.
     Both were restored from the store.
   - Rerun: 14 failures. 13 of them were `Scenario Lab build is missing: apps/scenario-lab/dist/registry.js`.
     Ran `pnpm --filter @fluxiq-web-extension/scenario-lab build`.
   - These are worktree prerequisites the test-runner test script does not build
     itself. They are not caused by this change.
4. Reuse run: `test-runner test`
   - `{"build-cache":"reuse","step":"domain:build","reason":"inputs and outputs match the stamp","ms":482}`
   - `# tests 1734`, `# pass 1734`, `# fail 0`, exit 0.
5. Touched a domain source file without changing it (`touch domain/src/index.ts`), then
   ran `node scripts/domain-dist.mjs`.
   - `{"build-cache":"reuse",...,"reason":"inputs and outputs match the stamp","ms":992}`.
     The fingerprint is content-based, so a touch alone correctly reuses.
6. Rebuild run: appended a comment line to `domain/src/index.ts`, then ran `test-runner test`.
   - `{"build-cache":"build","step":"domain:build","reason":"inputs changed: domain; stored in the shared store (591 file(s), 2200680 bytes)","ms":28319}`
   - `# tests 1734`, `# pass 1734`, `# fail 0`, exit 0.
   - Afterwards I restored `domain/src/index.ts` from a byte copy (`git status --short domain`
     is empty). A further `domain-dist.mjs` reported `reuse` ("restored from the shared
     store"), so the dist matches the source again.
7. `node scripts/structure-audit.mjs`
   - `structure-audit: passed (137 warning(s), 118 baselined).`, exit 0.
   - No warning names a changed file.

## Not verified

- No live run on Chrome 116 to 119. The browser path is covered only by unit tests,
  including the test that deletes `URL.canParse`, and by the guard test.
- `pnpm check`, `pnpm test` and `pnpm build` were not run across the whole repository.
- The test-runner `check` and `build` scripts also call `domain-dist.mjs`. They were
  not run separately; the `test` script exercises the same script.

## Open questions or contradictions found

- The brief says the Firefox manifest admits 109, but `apps/extension/manifest.firefox.json`
  has `strict_min_version: "128.0"`, which is above 115. Only Chrome (116 against 120)
  is actually affected.
- The comments in `background/panel/page-url.ts` and `background/panel/open-fluxiq.ts`
  still say the manifest admits Firefox 109, so they are stale. Both files keep their
  own private try/catch helper, which duplicates `parsedUrl`.
- I left both files alone because the brief did not list them. A follow-up could switch
  them to `parsedUrl` and correct the comments.
- In a fresh worktree, `test-runner test` needs `test-contracts`, `test-evidence` and
  `scenario-lab` built first, and its script does not build them. This is separate
  from this task and was not changed.
