# p-test-split — splitting the two oversized test files

## Outcome

**Partial.** `packages/test-runner/src/tests/demo-llm-create-ui.test.ts` (615
lines) is split into five subject files; all 20 tests and all 197 assertions
survive, `check` and `test` pass, and the 400-line advisory for it is gone.

`apps/extension/e2e/content/tests/identity-resolution.spec.ts` was **not
touched**: it is being actively rewritten right now, as the brief anticipated.

There is one blocker the brief did not anticipate, and it is the reason this
is Partial rather than Done: **the split cannot be committed as it stands.**
The `directory-files` ratchet on `packages/test-runner/src/tests/` is at
exactly its recorded value, so that directory has zero headroom, and the
ratchet is designed so that no baseline update can give it any. Detail and
remedies in "The blocker" below. Read that section before committing.

## The spec was left alone, and why

The brief said to check before touching it. It is being edited continuously:

| time | line count | source |
| --- | --- | --- |
| 17:34 (my first `ls`) | — | mtime 13:57 |
| 17:35:47 | — | rewritten while I was reading it |
| 17:36 audit (before) | 621 | `structure-audit` |
| 17:46 (last check) | 715 | `wc -l`, mtime 17:46:00 |

`git status` shows it as ` M` together with `identity/veto.ts`,
`identity/tests/veto.test.ts`, `identity/score.ts` and
`action-runtime/resolve-target.ts` — the veto re-measurement. A whole-file
write from me would have destroyed it. It grew 621 → 715 lines during my
session, so its advisory is still open and larger than when the brief was
written (the brief said 541).

The content harness was therefore not run: the brief scopes that to "if you
touched the spec".

## What changed

`packages/test-runner/src/tests/demo-llm-create-ui.test.ts` deleted; five
files created in the same directory. Split by subject, not by size — the
largest is six times the smallest.

| file | lines | tests | what it is about |
| --- | --- | --- | --- |
| `demo-llm-create-ui-exploration.test.ts` | 94 | 3 | The proposal-only evidence-guided checkpoint: the proposal parser, the launcher and UI driver that carry no approve/apply seam, and the terminal classifier that stops at the high-token confirmation. |
| `demo-llm-create-ui-provider-free-commands.test.ts` | 56 | 5 | The five `demo:llm:*` commands that must never reach a provider. One premise for all five: strip provider secrets, `providerCallCount: 0`, no generation endpoint. |
| `demo-llm-create-ui-readiness-gate.test.ts` | 119 | 3 | The provider-free readiness GET in front of the one paid call: the limits and seam ordering in the driver, the parser that decides what "certified" means, and the row proving an incompatible readiness reaches neither the UI nor generation. |
| `demo-llm-create-ui-failure-sanitizer.test.ts` | 341 | 4 | What a failed settings save or a failed generation is allowed to keep, and the domain-derived evidence-step allowlist. |
| `demo-llm-create-ui-adaptation-lifecycle.test.ts` | 74 | 5 | What the Lab does to an adaptation on either side of the paid call, through a stubbed control client: reject the one stale proposal, then inspect and verify what applying one built. |

Every file is under the 400-line advisory.

### The move was mechanical, and checked as one

Nothing was retyped. Each group is an exact `sed` line range out of the
original; only the import block and the `const root` line are new per file,
plus a header comment naming the subject. Verified two ways:

- The eight extracted ranges (`12-90`, `92-134`, `135-182`, `184-210`,
  `212-265`, `266-530`, `531-562`, `564-615`) reassemble to a 600-line body
  that is line-for-line identical, as a multiset, to the original's lines
  12–615 minus lines 91, 183, 211 and 563 — the four blank separators between
  the groups, each confirmed empty. `diff` on the sorted bodies produced no
  output and exit 0.
- Counts: original 20 tests / 197 `assert.*` calls; the five files together,
  20 tests / 197 `assert.*` calls.

### The negative controls stayed with what they guard

- `stale creation cleanup is a no-op when clear and fails closed on ambiguity
  or another adaptation kind` sits beside `stale creation cleanup rejects only
  one exact pending Flow bootstrap proposal`.
- `applied topology inspector rejects overlapping generated nodes` sits beside
  `applied topology inspector accepts registered structural nodes around
  executable actions`. Both pairs are in `-adaptation-lifecycle`, whose header
  says out loud that each pair is an acceptance plus the control that proves
  the acceptance is not a rubber stamp.
- `readiness GET is the sole request and blocks the production UI/auth/
  generation path` stayed with the readiness parser and the driver it gates,
  in `-readiness-gate`, rather than being filed with the other driver rows.
- The sanitizer pair — `the evidence-step sanitizer admits exactly the tools
  and result codes the domain produces` and `the sanitizer's allowlist is
  derived from the domain package, not restated beside it` — stayed adjacent
  and in that order, with both of the comment blocks that explain why one
  without the other is worthless.

### The domain-derivation property is visible

The brief asked for it to stay legible. In `-failure-sanitizer.test.ts` it is
now the file's stated reason for existing: the header says both allowlists
were once hand-kept copies that had silently drifted, that they are derived
from `@fluxiq-web-extension/domain/node` now, and that the last two rows are
the pair that keeps them that way — "the first proves the sanitizer agrees
with the domain today, the second proves it cannot stop agreeing. Neither is
sufficient alone." The two original comment blocks moved with their rows
underneath it, including the one explaining that importing the package at all
is the first assertion.

## The blocker

`packages/test-runner/src/tests/` holds 51 tracked source files. The
`directory-files` hard limit is 25; the directory is baselined at **51** —
exactly its current value. Test files count toward that limit, and
`test-placement` requires a test's immediate parent directory to be named
`tests` or `e2e`, so a `tests/demo-llm-create-ui/` subdirectory is not
available: the files have to sit flat in that one directory.

51 − 1 (deleted) + 5 (new) = **55**, and the audit fails:

```
FAIL  [directory-files] packages/test-runner/src/tests/: 55 source files
exceeds the 25-file limit. Group them by feature (shared filename prefix) or
kind. Baseline for this entry is 51; baselined entries may shrink, never grow.
```

**This is not a headroom problem that a wider or narrower split avoids.** Any
split at all replaces one file with two or more, so the minimum reachable
count is 52 — over the recorded 51. A two-way split fails exactly as a
five-way split does.

**`pnpm structure:baseline` cannot fix it, by design.** From
`scripts/structure-audit/baseline.mjs`: "`--update` obeys the same law: it
lowers an entry to its current value and removes an entry whose violation is
gone, and it never adds or raises one. A ratcheted violation with no entry, or
above its entry, blocks the update and nothing is written."

**Two things make this dangerous to leave unread.**

1. `pnpm check` passes right now. `git ls-files` is what the audit reads, and
   the five new files are untracked while the deletion is staged, so the audit
   sees 50 files in that directory and reports `passed`. It will fail the
   moment the new files are added to the index. I verified both states — see
   the command table below.
2. In that same state the audit says "1 baseline entries can be lowered", and
   the entry it means is this one: `directory-files
   packages/test-runner/src/tests` now 50, recorded 51. Running
   `pnpm structure:baseline` before committing the new files would ratchet the
   entry down to 50 and make the wall one file higher.

### Remedies, neither of them mine to take

- **Move the subject into a directory of its own.**
  `packages/test-runner/src/demo-llm-create-ui.ts` is 837 lines and baselined
  over the 800-line hard limit; `packages/test-runner/src` is baselined at 50
  files against a 25 limit and carries a baselined 17-member `demo-` prefix
  group. The repository's own rule — a shared filename prefix becomes a
  directory — points at `packages/test-runner/src/demo-llm-create-ui/` with a
  barrel, and the five test files then live in
  `packages/test-runner/src/demo-llm-create-ui/tests/`. That lowers
  `src/tests` to 50, lowers the `demo-` prefix group, and gives the 837-line
  module somewhere to split into. It is a source change, which my brief
  forbids ("Must not touch: any source file").
- **Relocate five of the rows out of the package.** The five in
  `-provider-free-commands` do not import the module at all; their subject is
  `scripts/run-demo-llm-*.mjs` and the root `package.json`, so `scripts/tests/`
  is arguably their rightful home. That still leaves 54, needs a root script to
  run them, and changes the test-runner total the brief uses as its proof of
  no loss. I did not do it.

Until one of those happens, the five files are correct and green but should
not be staged.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=p-test-split` was exported for every command
below. No `pnpm lab` command was run. Exit statuses were captured by redirect,
never by pipe.

| command | exit | observed |
| --- | --- | --- |
| `node scripts/structure-audit.mjs` (before) | 0 | `passed (32 warning(s), 19 baselined)`. Included `warn [file-lines] packages/test-runner/src/tests/demo-llm-create-ui.test.ts: 615 lines`. |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (before) | 0 | `# tests 413 / # pass 413 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/test-runner run check` (after) | 0 | `tsc -p tsconfig.json --noEmit`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (after) | 0 | `# tests 417 / # pass 417 / # fail 0` |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` | 1 | `31 warning(s)`; the `demo-llm-create-ui.test.ts` advisory is gone and none of the five new files appear; one FAIL, `directory-files packages/test-runner/src/tests/: 55` |
| `node scripts/structure-audit.mjs` (real index) | 0 | `passed (31 warning(s), 19 baselined)` plus `1 baseline entries can be lowered` |
| `node scripts/structure-audit.mjs --json` (real index) | 0 | `failures: 0`; lowerable entry is `directory-files packages/test-runner/src/tests now 50 recorded 51` |

The scratch index was `cp .git/index <scratchpad>/scratch-index` followed by
`GIT_INDEX_FILE=<scratchpad>/scratch-index git add -- packages/test-runner/src/tests/`,
so the shared index was not used for the audit.

### About the 413 → 417 test count

The brief asked for an equal total as the proof nothing was lost. The total is
**not** equal — it went up by four — and the four are not mine:

```
a declaration that names no recorded step fails the run instead of resolving to nothing
a scenario that declares no secret sends the inputs it always did
auth-gate's Flow run is given the declared secret, never the value its recording script holds
with the variable unset, auth-gate's Flow run fails closed and no recorded value is substituted
```

They come from `packages/test-runner/src/flow-lane/tests/declared-secrets.test.ts`
(modified 17:42, during my test run) and
`packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts` (untracked,
new) — another worker's files, compiled into `dist` between my before and
after runs.

The per-title comparison stands in for the total, and is stronger than it: I
extracted the 20 titles from the five new files and counted each one's
occurrences in both runs. Every one is **1 / 1** — present exactly once
before, present exactly once after. Nothing lost, nothing duplicated. `comm`
on the sorted subtest-name lists shows four names only in the after run and
**zero names only in the before run**.

## Not verified

- **The spec's advisory is untouched and has grown**: 621 lines at the start of
  my session, 715 at the end. It is another worker's file right now.
- **The content harness was not run** (`pnpm --filter @fluxiq-web-extension/extension run test:content`).
  The brief scoped it to touching the spec, and I did not.
- **No browser or live behaviour was exercised.** These are `node:test` unit
  tests over pure functions, source text and stubbed clients.
- **Root `pnpm check` and `pnpm test` were not run.** The tree is full of other
  workers' in-flight edits, so a repository-wide result would not have been
  attributable to me. I ran the test-runner package's own `check` and `test`,
  plus the structure audit against both the real and a scratch index.
- **I did not confirm the five files are green once staged.** The audit fails
  in that state for the directory-count reason above; `check` and `test` do not
  read the index and are unaffected.

## Open questions and contradictions found

1. **The brief's "Done when" is not reachable as written.** It asks for the
   advisory cleared through a scratch `GIT_INDEX_FILE`. The advisory does
   clear, but the same run fails on `directory-files`, and no split of any
   shape avoids it. The directory has to shrink, or the subject needs a
   directory of its own; both are source changes outside my ownership.
2. **`git rm --cached` staged the deletion in the shared index.** I used it to
   remove the original, which staged the deletion repository-wide while other
   workers are running. I then tried `git reset -- <path>` to leave the index
   as I found it, and the hook correctly blocked it ("workers must not change
   git history"). So the shared index currently carries a staged deletion of
   `packages/test-runner/src/tests/demo-llm-create-ui.test.ts` that I put
   there. It is the deletion the work intends, but it is staged rather than
   merely on disk, and I could not undo it. Flagging it because it is also what
   makes the audit read 50 and offer to lower the baseline.
3. **A stale build artifact had to be removed by hand.** `tsc` does not clean
   `dist`, so `packages/test-runner/dist/tests/demo-llm-create-ui.test.{js,d.ts}`
   survived the source deletion, and `node --test "dist/**/*.test.js"` would
   have run the old file alongside the five new ones — inflating the count by
   20 and, worse, hiding a genuine loss behind a larger total. I deleted both.
   Any worker deleting a test file in this package has to do the same; nothing
   in the build enforces it.
4. **Nothing looked wrong in the rows themselves.** The brief asked me to
   report a row that looked wrong rather than fix it. I found none: every
   assertion moved verbatim.
