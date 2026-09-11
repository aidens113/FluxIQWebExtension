# Worker Report: working-docs-tool

## Outcome

Done. `F:\!AgentBrain\tools\working-docs-audit.mjs` is a dependency-free
standalone port of Core's `working-docs` rule, with 18 child-process tests in
`F:\!AgentBrain\tools\tests\working-docs-audit.test.mjs`, all passing.

## What changed and why

Two new files, both inside the owned path `F:\!AgentBrain\tools\**`. Nothing
else was touched; the Core rule was read only.

`tools/working-docs-audit.mjs` (≈370 lines, one file, node builtins only). The
check logic is a faithful port of
`F:\!FluxIQ\scripts\structure-audit\rules\working-docs.mjs`: header block shape
and status vocabulary (one finding per document, first deviation only, because
the block is parsed positionally), `## Current State` within 20 lines after the
header while Active, `## Current State` at most 150 lines measured to the next
H2, `## Work Ledger` entries needing a real `- Validation:` bullet with the
hearsay phrases rejected across a wrapped continuation line, the 800-line
compaction threshold, and the generated `docs/working/README.md`. The same
constants, the same message wording, and the same CRLF handling. Differences
forced by the brief:

- Findings are plain strings printed one per line rather than ratchet records.
  There is no ratchet and no baseline: every finding fails, exit 1.
- `--update` regenerates the index and exits 0 without auditing.
- The index omits Core's cross-repository sentence and its column header is
  `Paired` rather than `Paired in Core` / `Paired downstream`.
- The index-out-of-date message names `node working-docs-audit.mjs --update`
  instead of `pnpm structure:baseline`.

Two judgement calls beyond a literal port, both commented in the source:

- Git discovery treats the root as a repository only when it is the **top
  level** of a work tree (`git rev-parse --show-toplevel` equal to the root),
  falling back to a directory listing otherwise. The first implementation used
  `--is-inside-work-tree`, and every test failed with `passed (0 documents)`:
  `C:\Users\mrjoh` is itself a git repository, so a temporary directory under
  `%TEMP%` answers "true" while `git ls-files` returns nothing. Any directory
  sitting under an unrelated checkout would have been silently reported as
  empty, so this is a real bug, not a test artifact.
- A repository with no working documents prints `working-docs: passed (0
  documents)` and exits 0 instead of reporting its absent index as out of date.
  Core never meets that case; a standalone tool aimed at arbitrary repositories
  does.

Smaller points: tracked-but-deleted files are filtered out before reading; an
unknown argument prints usage on stderr and exits 2; `--update` on a repository
with no `docs/working` directory says so on stderr and exits 0 rather than
throwing ENOENT.

`tools/tests/working-docs-audit.test.mjs` runs the tool as a child process
against temporary repositories built on disk, so it covers discovery, exit
codes and printed output the way a caller sees them. Covered: a passing
repository; each failure kind (bad Status, missing header field, Active with no
Current State, Current State over budget, ledger entry with no Validation
bullet, hearsay Validation across a wrapped line, document over 800 lines,
missing index, index that no longer matches the headers); `--update` producing
an index that then passes; two broken documents reporting one line each in
codepoint order; CRLF; nested/non-markdown/README exclusion; a git repository
where an untracked document is ignored; and the usage error. Failure fixtures
run `--update` first so the only finding is the one under test.

## Commands run and observed results

`node --test "tools/tests/*.test.mjs"` from `F:\!AgentBrain`:

```
# tests 18
# pass 18
# fail 0
# duration_ms 2450.9408
```

`node tools/working-docs-audit.mjs --root 'F:\!FluxIQWebExtension'` (exit 1),
verbatim:

```
docs/working/automated-testing-facility-plan.md: 1842 lines exceeds the 800-line compaction threshold. Compact it the next time work touches it: fold settled outcomes into Current State and move superseded detail to docs/working/automated-testing-facility-plan/archive/.
docs/working/extension-runtime-capabilities-plan.md: 1165 lines exceeds the 800-line compaction threshold. Compact it the next time work touches it: fold settled outcomes into Current State and move superseded detail to docs/working/extension-runtime-capabilities-plan/archive/.
docs/working/llm-production-automation-plan.md: 1577 lines exceeds the 800-line compaction threshold. Compact it the next time work touches it: fold settled outcomes into Current State and move superseded detail to docs/working/llm-production-automation-plan/archive/.
docs/working/README.md is out of date with the documents' header blocks. Run "node working-docs-audit.mjs --update" to regenerate it.
```

The three size findings are genuine. The README finding is the expected shape
difference, and it was checked rather than assumed: the eight top-level
documents were copied into a scratch directory, `--update` was run there
(`working-docs: wrote docs/working/README.md (8 documents)`), and
`git diff --no-index` against the checked-in index showed only

```
-Core's matching index is at `F:\!FluxIQ\docs\working\README.md`.
-
-| Document | Owner | Lines | Scope | Paired in Core |
+| Document | Owner | Lines | Scope | Paired |
```

(two table headers, one sentence, 2 insertions / 4 deletions). Every row, line
count and ⚠ flag matched Core's generator exactly.

`node --test hooks/tests/ tools/tests/` from `F:\!AgentBrain` (the repository's
own `test` script): `# pass 0 # fail 2`, with
`Error: Cannot find module 'F:\!AgentBrain\tools\tests'` — the directory form
does not discover tests under Node v22.11 here.

`git status --porcelain` in `F:\!AgentBrain`: `?? hooks/`, `?? templates/`,
`?? tools/`. No git command that changes history or state was run in either
repository.

## Not verified

- The tool was never run with `--update` against `F:\!FluxIQWebExtension` or
  any real repository; the only `--update` runs were against the scratch copy
  and the test fixtures.
- No check that the port stays in step with Core over time. Nothing links the
  two files, so a change to the Core rule will silently diverge from this copy.
  The hearsay regex had already changed on disk while this work was in progress
  (to `/reported success|workers? (reported|said|claimed)\b/i`); the current
  version is what is ported.
- Non-Windows behaviour, and behaviour when `git` is not on PATH (the code
  catches the spawn failure and falls back to a directory listing, but that
  path was not exercised).
- Nothing was wired into any repository's `check` script; the brief did not ask
  for it.

## Open questions or contradictions found

1. `F:\!AgentBrain\package.json` cannot run these tests. Both `test` and
   `check` use `node --test hooks/tests/ tools/tests/`, which fails here with
   `MODULE_NOT_FOUND`; the working form is
   `node --test "hooks/tests/*.test.mjs" "tools/tests/*.test.mjs"`.
   `package.json` is outside this brief's owned path, so it was left alone —
   the supervisor should decide.
2. The pass line reads `working-docs: passed (1 documents)` for a single
   document. That is the literal format the brief specifies, so it was kept,
   pluralisation included. Say the word if it should read `1 document`.
3. The standalone index shape and the FluxIQ-managed shape differ by design, so
   running `--update` inside `F:\!FluxIQ` or `F:\!FluxIQWebExtension` would
   rewrite their index into the neutral shape and put it at odds with the
   structure audit. The tool is for repositories that do not have the audit;
   nothing in it currently prevents that misuse.
