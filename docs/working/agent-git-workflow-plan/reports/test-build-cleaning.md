# Domain test build cleaning — fixed and measured

Fixed 2026-09-17 on the development machine, Git Bash, from
`F:\!FluxIQWebExtension` (dev). Every count and every command result below was
observed in this session; nothing is estimated.

## Outcome

**Done.** `domain/scripts/test-domain.mjs` now empties its out directory before
each build, behind a guard that refuses any path that is not this run's own
output. After the fix the directory holds exactly 84 `.mjs` bundles against the
84 current test entries — the 211 stale files and the 5 orphan bundles are
gone — and the suite still reports `# fail 0` on two consecutive runs.

## What changed and why

### `domain/scripts/test-domain.mjs`

The script bundled every `src/**/tests/*.test.ts` into `outdir` and called only
`mkdir`. esbuild writes the entries it is handed and deletes nothing, so
whatever an earlier run wrote survived forever. Measured before the fix:

| Before the fix | Count |
|---|---|
| Files under `domain/.test-build/` | 300 |
| Files under `.test-build/!FluxIQ/` (bundled Core source, 2026-08-01) | 196 |
| `.js` files under `.test-build/!FluxIQWebExtension/domain/src/` (same old shape) | 15 |
| **Stale total** (the two rows above) | **211** |
| `.mjs` bundles | 89 |
| Current test entries under `domain/src/**/tests/*.test.ts` | 84 |
| **Orphan bundles** (89 − 84) | **5** |

The 5 orphans included `.test-build/domain.test.mjs` and
`.test-build/domain.test.external.mjs` at the top level, which no current entry
could produce — a deleted or renamed test left a runnable bundle behind and
nothing detected it.

Four changes, in one file:

1. **`resolveTestBuildOutdir(label, root)`** — the existing label validation and
   path choice, now a named export so it can be tested. Semantics unchanged:
   an invalid `DOMAIN_TEST_BUILD_LABEL` throws the same message, a label gives
   `<root>/.test-build-scratch/<label>`, no label gives `<root>/.test-build`.
2. **`assertTestBuildOutdirIsRemovable(outdir, root)`** — the refusal guard. It
   is a whitelist of the only two shapes `resolveTestBuildOutdir` can produce,
   not a blacklist of paths to avoid. It refuses a value that is empty or not a
   string, a relative path, a path that is not already normalized (which is how
   `…/.test-build/../..` is caught), a path on another drive, the package root,
   anything outside the package, the `.test-build-scratch` **parent** (a
   concurrent labelled run's output lives there), anything nested below either
   output directory, and a lookalike name such as `.test-build-old`.
3. **`cleanTestBuildOutdir(outdir, root)`** — asserts, then
   `rm(recursive, force, maxRetries: 3, retryDelay: 50)`, then `mkdir`. The
   retries cover the Windows `EBUSY`/`EPERM` a scanner can raise mid-removal.
   It is called after entry discovery, so a discovery that finds nothing throws
   `No domain tests found under src/**/tests/` **before** anything is deleted.
4. **An entry-point check.** Running the file runs the suite exactly as before;
   importing it (which is how the guard is tested) does not. An import must set
   `DOMAIN_TEST_BUILD_IMPORT_ONLY=1`, and a load that is neither throws rather
   than exiting quietly — a run that built nothing and reported nothing would
   otherwise look like a pass.

What the script runs, how it reports and its exit codes are unchanged: the same
84 entries, the same esbuild options, the same per-entry `failedToLoad`
reporting, the same `process.exitCode = 1` on a load failure.

**Concurrency.** An unlabelled run only ever removes `<domain>/.test-build`; a
labelled run only ever removes `<domain>/.test-build-scratch/<its own label>`.
The scratch parent is explicitly refused, so one worker cannot take another
worker's label directory with it. Two runs sharing one label still collide, as
they did before this change.

### `domain/scripts/tests/test-domain.test.mjs` (new)

19 tests, on the pattern of `scripts/lab/tests/lab-instance.test.mjs` (a
`.test.mjs` in the `tests/` folder of the directory that owns the subject, run
with `node --test`). They cover the two accepted shapes; 13 refused shapes, one
per case; **the refusal on disk** — a temporary package is built with
`src/index.ts` and a sibling directory holding a file, `cleanTestBuildOutdir` is
called on the source tree, the sibling, the root, the workspace above it and
`""`, each rejects, and every file is then asserted to still exist; that the
run's own outdir really is emptied (a planted `!FluxIQ/packages/stale.js` and a
planted orphan `deleted-test.mjs` are both gone, the directory survives and is
empty); that a missing outdir is created rather than failing; that two labels
never nest; and that a non-kebab-case label never becomes a path.

## Commands run and observed results

| # | Command | Observed |
|---|---|---|
| 1 | `node --test scripts/tests/test-domain.test.mjs` (in `domain/`) | `# tests 19`, `# pass 19`, `# fail 0`, duration 103 ms |
| 2 | `pnpm --filter @fluxiq-web-extension/domain test` (first run) | exit 0 — `# tests 663`, `# pass 663`, `# fail 0`, `# skipped 0`, duration 7090 ms |
| 3 | `find .test-build -type f \| wc -l` | **84** (was 300) |
| 4 | `find .test-build -type f -path "*!FluxIQ*" \| wc -l` | **0** (was 211 including the `.js` files) |
| 5 | `find .test-build -type f -not -name "*.mjs" \| wc -l` | **0** |
| 6 | `find .test-build -name "*.mjs" \| wc -l` vs `find src -path "*/tests/*.test.ts" \| wc -l` | **84 and 84** |
| 7 | `diff` of the entry list (mapped `src/…/x.test.ts` → `…/x.test.mjs`) against the bundle list | identical, 84 lines each — exactly one bundle per current test entry, no orphans |
| 8 | `pnpm --filter @fluxiq-web-extension/domain test` (second run) | exit 0 — `# tests 663`, `# pass 663`, `# fail 0`, duration 6911 ms; directory still 84 files / 84 `.mjs`. Clean-then-build is idempotent |
| 9 | Two parallel labelled runs, `DOMAIN_TEST_BUILD_LABEL=clean-check-a` and `…=clean-check-b` | both exit 0, both `# tests 663 / # pass 663 / # fail 0`; each label directory ended with 84 `.mjs`; `.test-build` untouched at 84; the 99 pre-existing label directories were all still present |
| 10 | `node scripts/structure-audit.mjs` | exit 1 — **one** violation, `[working-docs] docs/working/README.md is out of date with the documents' header blocks`. Not from this work: no finding names `domain/scripts`, and `git status` shows the cause is another agent's uncommitted edit to `docs/working/agent-git-workflow-plan.md` (43 insertions, including a Current State rewrite that lists this very fix as in flight). Regenerating the index would mean editing a file this brief does not own and baking in that in-flight state |
| 11 | `pnpm --filter @fluxiq-web-extension/domain check` | exit 0 (both `tsc` passes) |
| 12 | `git status --short domain/` | ` M domain/scripts/test-domain.mjs`, `?? domain/scripts/tests/` — nothing else; `.test-build` no longer dirties the tree (untracked since `e46b987`) |

The two scratch labels created for step 9 were removed afterwards; 99 label
directories remain, exactly the set that existed before.

## Not verified

- **`node scripts/structure-audit.mjs` passing.** It exits 1 on the working-docs
  index, for the reason in row 10. The audit produced **no** finding against
  either file this brief owns, and `pnpm structure:baseline` was not run because
  it would rewrite `docs/working/README.md`, which is not mine to touch.
- **Nothing runs the new test automatically.** `domain`'s `test` script is
  `node scripts/test-domain.mjs`, which discovers `src/**/tests/*.test.ts` only;
  the root `check` runs `pnpm structure:test` and `pnpm lab:test`, whose globs
  are `scripts/structure-audit/**` and `scripts/lab/**`. Wiring it in needs a
  line in the **root** `package.json` (e.g. a `domain:scripts:test` script
  running `node --test "domain/scripts/tests/*.test.mjs"`, added to `check`) —
  a file this brief does not own, and one another agent is editing right now.
  Until that lands the test is run by hand, as in row 1.
- **Windows-only behaviour of the guard.** The case-insensitive entry-point
  comparison and the `path.sep`-based segment checks were exercised on Windows
  only; the POSIX branches were not run.
- **A same-label collision.** Two concurrent runs sharing one label still
  overwrite each other. That was true before this change and is unchanged.
- **The `EBUSY` retry path.** `maxRetries` was not exercised; no removal in
  these runs hit a locked file.
- No failure in this session looked impossible, so no run was repeated for the
  machine's RAM fault.

## Open questions and contradictions found

1. **The extension runner already did this.**
   `apps/extension/scripts/test-extension.mjs` has cleaned its out directory
   since it was written — `await rm(outdir, { recursive: true, force: true })`
   before `mkdir`, with the comment "Only this label's directory is cleared, so
   a deleted test leaves no stale bundle behind". The domain runner, which that
   file's header cites as the pattern it follows, was the one that never
   adopted it. The extension runner has no refusal guard; its outdir is bounded
   by construction (always `<root>/.test-build-scratch/<validated label>`), but
   the guard added here is the piece it would gain from sharing.
2. **`domain/.test-build-scratch/` is the same leak one level up.** It holds 99
   label directories and 4,388 files, one per past worker run, going back
   through the week-1 and extraction campaigns. Each is now self-cleaning when
   its label is reused, but an abandoned label is never removed by anything.
   The same is true of `apps/extension/.test-build-scratch/`. Sweeping them was
   out of scope here and is not safe to do blind: a concurrently running worker
   owns one of those directories while it runs. An age-based sweep at the start
   of a run, or removal by `pnpm task finish`, would close it.
3. **A stale bundle was only ever found by inspection.** Nothing fails when one
   exists; this fix removes the accumulation rather than detecting it. With the
   directory now exactly one bundle per entry, a cheap check — bundle count
   equals entry count after the build — would make a regression here fail the
   run instead of waiting for someone to count files again.
