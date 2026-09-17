# Report: w2-audit-scans-new-files

## Outcome

Done. The structure audit now checks every file git tracks plus every
untracked file git does not ignore, in both repositories. The mirror is
byte-identical. `pnpm structure:test` passes in both repositories (105 tests
each). `node scripts/structure-audit.mjs` runs in both. It **passes in Core**
and **fails in this repository** on two violations. Both come from other
workers' untracked files (see "Open questions"), not from this change. In each
repository, a throwaway untracked probe file made the audit fail by name, and
the probe was then deleted.

## What changed and why

The change is in Core first and was then copied here. `config.mjs` and
`.structure-baseline.json` were not touched in either repository; no rule
change needed that.

- **New `scripts/structure-audit/repository-files.mjs`** (one export:
  `listRepositoryFiles(root)`). It runs
  `git ls-files -z --cached --others --exclude-standard`, removes duplicates,
  keeps only regular files, and sorts the result.
  - Removing duplicates matters. A probe in a scratch repository showed that
    git lists a file with a merge conflict once per conflict stage, three
    times in all. Rules such as directory-files would have counted it three
    times. The old code had the same bug.
  - "Regular files only" drops three kinds of entry:
    - tracked files deleted from disk, including a file whose parent
      directory is now a file (`ENOTDIR`; the old
      `existsSync`/`statSync` pair would have thrown there);
    - submodules;
    - untracked nested repositories, which git lists as `dir/`.
  - Sorting is needed because git prints untracked files before tracked ones.
    For ASCII paths the sorted order equals the old tracked-only order.
- **`scripts/structure-audit/context.mjs`**
  - `createContext` now uses `listRepositoryFiles` and takes optional
    `{ root, config }`. Both default to this repository and its `config.mjs`,
    so the call in `structure-audit.mjs` is unchanged; a test can point the
    context at a fixture repository.
  - The context field `trackedFiles` is renamed to **`files`**, because it
    no longer holds only tracked files. `sourceFiles` and `scriptFiles` are
    derived from it.
  - The rule-contract comment now says rules list files only through the
    context and never call git themselves.
  - Nothing outside `scripts/structure-audit/` imports the context; I checked
    with `git grep` in both repositories.
- **Rules**
  - `ctx.trackedFiles` became `ctx.files` in `docs-links.mjs`,
    `facade-dispatch.mjs`, `imports.mjs` and `working-docs.mjs`.
  - A local helper `trackedDirectories` became `fileDirectories` in
    `docs-links.mjs` and `imports.mjs`.
  - In docs-links, the header comment and the broken-link message changed.
    The message was "no tracked file is at X"; it is now
    "no file git tracks or would add is at X".
  - Every other rule already walks `ctx.sourceFiles` or `ctx.scriptFiles`, so
    it picks up untracked files through the context without a code change.
- **Rule tests** (fake contexts)
  - The field rename was applied in `docs-links`, `facade-dispatch`,
    `imports`, `naming` and `working-docs` tests.
  - The docs-links test assertions now expect the new message, and two test
    names were reworded.
- **New `scripts/structure-audit/tests/untracked-files.test.mjs`** (9 tests).
  Each test builds a real git repository in a temporary directory; nothing is
  committed, since `git add` is enough to track a file. Each test removes its
  directory afterwards. The file clears `GIT_*` environment variables so that
  running it from a git hook cannot point git at the real repository. The
  tests check:
  - the listing covers tracked files and untracked files, including one in a
    new directory, and leaves out ignored files;
  - a tracked file deleted from disk (both the `ENOENT` and `ENOTDIR` cases)
    is left out without an error;
  - an untracked nested repository is left out;
  - a file with a merge conflict is listed once (the test first confirms git
    itself lists it three times);
  - the context's `files`, `sourceFiles` and `scriptFiles` include untracked
    files, and `read` and `repoRoot` use the given root;
  - file-lines: an untracked 801-line file fails the ratchet (it has no
    baseline entry), while a tracked file with the same entry recorded is
    suppressed;
  - contract-spread: an untracked test file with four forbidden spreads fails
    with value 4, which is today's incident;
  - docs-links: an untracked document is checked; its link to an untracked
    sibling (including a heading anchor) resolves; links to a missing file
    and to an ignored file both fail;
  - working-docs: an untracked working document gets a header finding and
    makes the index out of date; an ignored one is not audited.
  - The test sits in `scripts/structure-audit/tests/` because it has several
    subjects (the listing module, the context, and four rules), and that is
    the nearest directory containing all of them.
- **Mirror.** I copied the 12 changed or new files into this repository.
  `scripts/structure-audit.mjs` itself needed no change.

Behaviour to be aware of: `pnpm structure:baseline` (`--update`) now also sees
untracked files. It refuses to write while an untracked file has a violation
with no baseline entry. The working-docs index it regenerates would also list
an untracked top-level working document.

## Commands run and observed results

Before the change (tracked-only audit):
- Core `pnpm -s structure:test`: `# tests 96`, `# pass 96`, `# fail 0`.
- Core `node scripts/structure-audit.mjs`: exit 0,
  `structure-audit: passed (146 warning(s), 254 baselined).`
- Extension `pnpm -s structure:test`: `# tests 96`, `# pass 96`, `# fail 0`.
- Extension `node scripts/structure-audit.mjs`: exit 0,
  `structure-audit: passed (59 warning(s), 17 baselined).`

After the change:
- Core `pnpm -s structure:test`: `# tests 105`, `# pass 105`, `# fail 0`.
- Checking that the new tests catch the defect: I put the old
  `["ls-files", "-z"]` call back in `repository-files.mjs` and ran
  `node --test tests/untracked-files.test.mjs`. Result: `# pass 2`,
  `# fail 7`. The two that passed are the nested-repository and
  merge-conflict tests, which do not depend on untracked files. Removing only
  the de-duplication gave `not ok 4 - a file with a merge conflict is listed
  once...`, `# fail 1`. Then I restored the file and `cmp` against the saved
  copy printed `restored`.
- Core `node scripts/structure-audit.mjs`: exit 0,
  `structure-audit: passed (147 warning(s), 254 baselined).`
- Core probe. I wrote `scripts/w2-audit-scans-new-files-probe.mjs` (801
  exported constants; `git status` showed `??`) and ran the full audit. It
  exited 1 in 3 seconds with:
  - `FAIL  [exported-values] scripts/w2-audit-scans-new-files-probe.mjs: 801 exported values, exceeding the 15-value limit...`
  - `FAIL  [file-lines] scripts/w2-audit-scans-new-files-probe.mjs: 801 lines exceeds the 800-line limit...`
  - `structure-audit: 2 violation(s) across 2 rule(s).`

  The probe was then deleted (`probe removed`), and a rerun exited 0 with
  `passed (147 warning(s), 254 baselined).`
- Core `node scripts/structure-audit.mjs --rule docs-links --rule working-docs`:
  exit 0, `passed (0 warning(s), 16 baselined).`
- Mirror check: I compared every file from
  `git ls-files --cached --others --exclude-standard scripts/structure-audit`,
  plus `scripts/structure-audit.mjs`, with `cmp`. All printed `SAME` except
  `scripts/structure-audit/config.mjs`, which differs per repository and was
  not touched. The two repositories' file lists under
  `scripts/structure-audit` are identical (`diff` printed `same file list`).
- Extension `pnpm -s structure:test`: `# tests 105`, `# pass 105`, `# fail 0`.
- Extension `node scripts/structure-audit.mjs`: **exit 1**, with:
  - `FAIL  [directory-files] packages/test-runner/src/demo-workspace/: 27 source files exceeds the 25-file limit. Group them by feature (shared filename prefix) or kind.`
  - `FAIL  [directory-files] scripts/: 33 source files exceeds the 25-file limit. ... Baseline for this entry is 32; baselined entries may shrink, never grow.`
  - `structure-audit: 2 violation(s) across 1 rule(s).`
- Extension probe. I wrote
  `scripts/structure-audit/w2-audit-scans-new-files-probe.mjs` (801 lines;
  `git status` showed `??`). I put it there so it would not change the
  `scripts/` count. The audit exited 1 with `4 violation(s) across 3 rule(s)`:
  the two failures above, plus `[exported-values]` and `[file-lines]` failures
  naming the probe. The probe was then deleted (`probe removed`).
- Extension `node scripts/structure-audit.mjs --rule docs-links --rule working-docs`:
  exit 0, `passed (0 warning(s), 3 baselined).` The untracked reports under
  `docs/working/mvp-week2-automation-loop-plan/reports/` are now checked for
  broken links, and they pass.

No failure looked like the known RAM fault, so nothing was rerun for that
reason.

## Not verified

- `pnpm check`, `pnpm test` and `pnpm build` were not run in either
  repository. The brief did not ask for them, and they cover code outside
  `scripts/`.
- The full extension audit does not pass right now, because of other
  workers' files (below). I could not observe it passing with this change
  except with those files absent, and I did not remove them.
- I did not test running the audit from inside a real git hook (for example,
  pre-commit with `GIT_INDEX_FILE` set). Neither repository has a hook today.
  In that case the real audit would read the hook's index, which is the
  correct set to check.
- Paths with non-ASCII characters: JavaScript's default sort could order a
  few of them differently from git's byte order. This does not affect any
  finding.

## Open questions or contradictions found

Failures and warning changes caused by files I did not create. None were
fixed.

- **FAIL, extension:** `packages/test-runner/src/demo-workspace/` has 27
  source files; the limit is 25 and there is no baseline entry. Three new
  untracked files push it over: `launcher-failure.ts`,
  `proposal-structure.ts` and `run-timeouts.ts`. Their tests are in
  `tests/` and do not count toward this directory.
- **FAIL, extension:** `scripts/` has 33 source files against a baseline of
  32. The cause is the untracked `scripts/demo-launcher-failure.mjs`.
- **Warning count changed, extension:** `apps/extension/e2e/content/tests/`
  went from 23 to 24 source files. The cause is the untracked
  `unique-selectors.spec.ts`.
- **New warning, Core:** `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/`
  now has 16 source files, past the 15-file advisory threshold. The cause is
  the untracked `unusable-decision.test.ts`. It is a warning only; Core still
  passes.

The two extension failures are exactly the kind of problem this change is
meant to catch before a commit: those files would fail the audit once
committed. Whoever owns them must group the files by feature or kind before
the commit. The alternative, a baseline entry, needs `--update`, which refuses
to record a new violation, so the files have to be grouped.
