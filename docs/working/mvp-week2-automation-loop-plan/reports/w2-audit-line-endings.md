# w2-audit-line-endings: structure audit fails on a fresh Windows checkout

Worker report. Brief: make the structure audit's `working-docs` rule pass on a
fresh Windows checkout. Core `F:\!FluxIQ` (dev, `a8ce814`), this repository
(dev, `b181151`). Nothing was committed.

## Outcome

Done. The hypothesis was **confirmed, and narrowed down**. CRLF line endings
are the trigger, but the header reader and the line counter were already
line-ending neutral. The only fault was the index check itself.
`working-docs.mjs` compared the checked-in `docs/working/README.md` with the
generated index byte for byte (`current !== generateIndex(...)`). The generated
index always uses LF, and a fresh checkout holds the README with CRLF. No other
rule gives a different answer on CRLF.

The root cause is the script, not repository config. Config is only the
trigger: neither repository has a `.gitattributes`, and Git for Windows' system
gitconfig sets `core.autocrlf=true` (`file:C:/Program Files/Git/etc/gitconfig
true`, in both repositories and in `verify-core`). The index stores LF
(`i/lf`). The main checkouts hold LF (`w/lf`), and both fresh worktrees hold
CRLF (`w/crlf`) for every working doc, the README included.

## What changed and why

Core first, then mirrored byte for byte to this repository:

- `scripts/structure-audit/rules/working-docs.mjs`
  - New `withLf(text)`, which is `text.replaceAll("\r\n", "\n")`.
  - `run()` now compares `withLf(ctx.read(index))` with the generated index,
    so a CRLF copy of a current index is no longer reported as stale. A stale
    or missing index is still reported.
  - `update()` no longer writes when the file already matches the generated
    index, line endings aside. This is the same rule `saveBaseline()` already
    applies to `.structure-baseline.json` (`baseline.mjs:175`), so running
    `pnpm structure:baseline` on a CRLF checkout does not rewrite an unchanged
    index.
  - The header comment now says every read is line-ending neutral, and why.
- `scripts/structure-audit/rules/tests/working-docs.test.mjs`: four new tests,
  plus an updated header comment because `update()` is now tested through a
  temporary directory, as `baseline.test.mjs` already does.
  1. The same document with CRLF and LF endings generates a byte-identical
     index, with LF endings.
  2. A current index checked out with CRLF endings is not reported as out of
     date. All four combinations of CRLF and LF documents and index are
     tested. **Failed before the fix.**
  3. A stale or missing index is still reported, with either line ending.
  4. Regenerating leaves an index that differs only in line endings
     untouched, and rewrites a stale one. **Failed before the fix.**

No docs, baselines, `config.mjs`, or other rules were edited.

## Commands run and observed results

**Reproduction.**
- `verify-core` was reset as the brief describes and checked out at
  `a8ce814` (`git log --oneline -1` printed
  `a8ce814 Let a repair use what the exploration found`).
- `node scripts/structure-audit.mjs` there printed `FAIL  [working-docs]
  docs/working/README.md is out of date with the documents' header blocks.`
  and `structure-audit: 1 violation(s) across 1 rule(s).`, exit 1.

**Isolating the fault.** A diagnostic script in the scratchpad ran
`working-docs` in `verify-core` four ways:

| Reader | Stale-index finding |
| --- | --- |
| Raw | present |
| Everything converted to LF | gone |
| Only the documents converted | still present |
| Only the README converted | gone |

So the fault is the README comparison alone.

**All-rules comparison in `verify-core` (Core, CRLF throughout).**
- The diagnostic patched `fs.readFileSync` so that every text read, including
  the TypeScript parses, came back as LF. It ran all 13 rules raw and patched,
  and compared the findings.
- Only one line differed: the `working-docs` README finding. Every other
  finding matched in count, value, line and message.
- Counts per rule: class-methods 6, directory-files 22, exported-values 101,
  failure-as-empty 66, file-lines 86, imports 153, naming 23,
  swallowed-failure 35, working-docs 17 raw against 16 after conversion.
  docs-links, contract-spread, facade-dispatch and test-placement had 0 either
  way.

**Tests before the fix.** `node --test
scripts/structure-audit/rules/tests/working-docs.test.mjs` (Core): 15 tests.
- `not ok 13 - a current index checked out with CRLF endings is not reported
  as out of date`: the actual result was one `docs/working/README.md` finding.
- `not ok 15 - regenerating leaves an index that differs only in line endings
  untouched, and rewrites a stale one`: the file was rewritten as LF.
- Tests 12 and 14 passed, as expected for guard tests.

**After the fix.**

| Where | Command | Result |
| --- | --- | --- |
| Core | `pnpm structure:test` | `# tests 166`, `# pass 166`, `# fail 0` |
| Core main checkout | `node scripts/structure-audit.mjs` | exit 0, `structure-audit: passed (154 warning(s), 355 baselined).` |
| `verify-core` (`a8ce814` plus the two fixed files) | `node scripts/structure-audit.mjs` | exit 0, `passed (153 warning(s), 355 baselined).` README still `i/lf w/crlf` |
| `verify-core` | `pnpm structure:test` | 166 pass, 0 fail |
| `verify-core` | `node scripts/structure-audit.mjs --update --rule working-docs` | `baseline already current, not rewritten ... (0 lowered, 0 removed)`, exit 0 |
| This repository | `pnpm structure:test` | 166 pass, 0 fail |
| This repository's main checkout | `node scripts/structure-audit.mjs` | exit 0, `passed (60 warning(s), 122 baselined).` |

- **`--update` in `verify-core`:** the README checksum
  (`9b2f5bfa90725afb59737d38e7793dfd`) and the baseline checksum
  (`e65b259121b0284afc96735fd777e964`) were the same before and after, and the
  README was still `w/crlf`.
- **154 against 153 warnings:** a `diff` of the warning lines shows three
  differences, all `file-lines` warnings on files with uncommitted edits in
  Core's main checkout: `evidence-loop.ts` (648 against 473 lines),
  `unusable-decision.test.ts` (present against absent), and
  `generation-failure.ts` (647 against 643; `git diff --stat` shows +4 lines).
  None comes from line endings.

**`lab-ext` (this repository's code on CRLF), read-only.** A diagnostic ran
the rules against `F:\fxlab\lab-ext` (`79839f4`, clean, README `i/lf
w/crlf`). Its `config.mjs` matches this repository's apart from line endings
(`diff --strip-trailing-cr` shows no difference).
- **`lab-ext`'s own, unfixed rules:** `failures:["working-docs
  docs/working/README.md"]`.
- **This repository's fixed rules:** `failures:[]`, 60 warnings, the same
  count as this repository's main checkout.
- **Raw against LF:** every finding from every rule is identical ("no finding
  differs").
- **Left untouched:** the README checksum stayed
  `084e8e553b5ce23a0da1832eeaf54d19`, and `git status --short` stayed empty.

**Mirror check.**
- Every file under `scripts/structure-audit/` was compared with `cmp`
  (Core against this repository): all `same` except `config.mjs`, which is
  per-repository and unchanged.
- `scripts/structure-audit.mjs` is also the same.
- The `verify-core` copies of the two changed files are identical to Core's.

## Other rules that read text files

| Rule | What it reads | Answer on CRLF |
| --- | --- | --- |
| `file-lines`, `working-docs` size and index line counts (`context.mjs` `lineCount`) | Splits on `\n`; a trailing `\r` does not change the count | Same |
| `working-docs` header, Current State and ledger | `splitLines` already drops a trailing `\r` | Same (existing CRLF test, plus new test 1) |
| `docs-links` headings | `ATX_HEADING` uses the `m` flag: `$` matches before `\r` and `.` excludes `\r` | Same |
| `docs-links` fences | `FENCE_MARKER` has no end anchor | Same |
| `docs-links` blanking and line numbers | `blank()` keeps `\n` and offsets; `lineOf` counts `\n`; `\r` counts as `\s` in `LINK` | Same |
| `baseline.mjs` | `JSON.parse`; the save compare already strips `\r` | Same |
| TypeScript-based rules (class-methods, exported-values, imports, naming, failure-as-empty, swallowed-failure, facade-dispatch, contract-spread) | TypeScript AST | Same |

The comparisons above confirm this against real files. `docs-links` resolved
28 anchored links in `verify-core` (133 docs files CRLF) and 217 in `lab-ext`
(597 docs files CRLF), with 0 findings in both modes. **Nothing else needed
fixing.**

## Not verified

- A genuinely fresh clone of this repository at `b181151` with the fix. The
  extension side was proven by running this repository's fixed code against
  `lab-ext` (`79839f4`, CRLF) read-only, because the brief forbids modifying
  `lab-ext`.
- `pnpm check`, `pnpm test` and `pnpm build` were not run in either
  repository. Only the audit and its tests are in scope.
- A lone `\r` line ending, which autocrlf never produces. `splitLines`
  handles one only at the end of a line.
- The Core main checkout's audit ran with another worker's uncommitted files
  present (the files named above). It passed with them.

## Open questions or contradictions found

- **Optional repository config, not made.** The script no longer needs it.
  If LF checkouts are wanted everywhere, add a `.gitattributes` at both
  repository roots containing `* text=auto eol=lf` and run
  `git add --renormalize .`. The index is already LF for the files checked, so
  the renormalize should be close to a no-op. It would also stop the
  "LF will be replaced by CRLF" warnings. It is a repository-wide checkout
  change, so it is left to the supervisor.
- **`verify-core` state.** It is left at detached `a8ce814` plus this brief's
  two files (`scripts/structure-audit/rules/working-docs.mjs` and its test),
  identical to Core's, so the supervisor can re-run the check. Reset it with
  the brief's commands before reusing it.
- **Stale comment.** The existing comment in `working-docs.mjs` ("Two working
  documents in this repository still use CRLF") predates this change and was
  not checked or edited.
