# f-test-runner-ratchet — the `src/tests/` directory with no headroom

## Outcome

**Done: this was already settled at HEAD, and I changed no source file.** The
brief says to re-verify first and to stop with proof if the item has already
landed. It had. Commit `ab736a1` ("Live validation: what the green gates were
actually measuring") already did what the brief asks. Commit `99eca80` then
lowered the ratchet.

- `packages/test-runner/src/demo-llm-create-ui.ts` (837 lines) is gone. It is
  now the directory `packages/test-runner/src/demo-llm-create-ui/`: 14 files,
  including a barrel `index.ts`, all under 190 lines.
- `packages/test-runner/src/tests/demo-llm-create-ui.test.ts` (615 lines) is
  gone. It is now five test files and one helper under
  `packages/test-runner/src/demo-llm-create-ui/tests/`. This is the layout
  `p-test-split` "Remedies" recommended, using its five subjects, but with the
  `demo-llm-create-ui-` filename prefix dropped.
- `packages/test-runner/src/tests/` holds 50 tracked source files, and the
  baseline now records 50. `99eca80` lowered it from 51, lowered
  `packages/test-runner/src` from 50 to 49 and the `src::demo` prefix group
  from 17 to 16, and removed both baseline entries for the old 837-line
  module.
- All 20 tests and 197 assertions survive: title for title, and assertion line
  for assertion line.

## What changed and why

**No file in the repository changed.** For the ratchet proof, I created
`packages/test-runner/src/tests/demo-llm-create-ui-ratchet-probe.test.ts`
(contents `export {};`) inside my ownership glob. It existed for a single
audit command and was then deleted in that same command. `ls` confirmed it was
gone, and `git status` shows nothing under `packages/test-runner`. No `dist`
copy was produced (`ls dist/tests | grep -c probe` printed 0).

### Evidence that the item is settled (file:line)

- `.structure-baseline.json:21` has `"packages/test-runner/src/tests": 50`, and
  `:22` has `"packages/test-runner/src": 49`.
- `packages/test-runner/src/index.ts:36` has
  `export * from "./demo-llm-create-ui/index.js";`.
- Every import site inside `src/` now points at the directory barrel. These are
  `src/demo-llm-exploration-request.ts:5`,
  `src/tests/demo-llm-creation.test.ts:6`, and six files under
  `src/demo-workspace/`: `panel-run.ts:6`, `exploration-checkpoints.ts:9`,
  `diagnosis-ui.ts:7`, `creation-lanes.ts:7`, `bound-exploration.ts:7` and
  `adaptation-ui.ts:7`. All are listed as changed in `ab736a1`'s stat.
  `flow-lane/` has no import site.
- No flat leftovers exist. `packages/test-runner/src/tests/` contains no
  `*create-ui*` file, `packages/test-runner/src/` contains no
  `demo-llm-create-ui.ts`, and `packages/test-runner/dist/tests/` contains no
  stale `*create-ui*` build output (count 0).

## Commands run and observed results

Every command ran with `EXTENSION_TEST_BUILD_LABEL=f-test-runner-ratchet` and
`DOMAIN_TEST_BUILD_LABEL=f-test-runner-ratchet`. Exit status was captured by
redirecting to a file, never through a pipe. I ran no `pnpm build` and no
`pnpm lab` command.

| Command | Exit | Observed |
| --- | --- | --- |
| `git log --diff-filter=D -- …/src/tests/demo-llm-create-ui.test.ts` | 0 | `ab736a1`. The same commit deletes `src/demo-llm-create-ui.ts` and adds `demo-llm-create-ui/tests/*`. |
| `git show 99eca80 -- .structure-baseline.json` | 0 | `-"packages/test-runner/src/tests": 51` / `+… 50`, `-"packages/test-runner/src": 50` / `+… 49`, `-"…src::demo": 17` / `+… 16`, and removal of the `demo-llm-create-ui.ts` `file-lines` 837 and `exported-values` 21 entries. |
| `git ls-files packages/test-runner/src/tests \| wc -l` | 0 | `50` |
| Counting the original file (`git show ab736a1^:…/src/tests/demo-llm-create-ui.test.ts`) | 0 | 615 lines, 20 `test(` calls, 197 `assert(` / `assert.*(` calls. |
| The same count over `demo-llm-create-ui/tests/*.ts` | 0 | `adaptation-lifecycle` 74 lines, 5 tests, 13 assertions. `exploration` 95, 3, 55. `failure-sanitizer` 339, 4, 68. `provider-free-commands` 56, 5, 24. `readiness-gate` 119, 3, 37. `module-source.ts` 29 lines, 0 tests, 0 assertions. **Total: 20 tests, 197 assertions.** |
| `diff` of sorted test titles, before against after | 0 | No output: 20 titles before, 20 after, 20 unique. |
| `diff` of sorted, trimmed assertion lines, before against after | 0 | No output: the multiset is identical. |
| `node scripts/structure-audit.mjs`, real index, first run | 0 | `structure-audit: passed (35 warning(s), 17 baselined).` |
| `node scripts/structure-audit.mjs --json`, real index, first run | 0 | `failures` 0, `lowerable` 0, `suppressed` 17. There is no warning for `demo-llm-create-ui/` (14 files, under the 15-file advisory) or its `tests/` (6 files). |
| `pnpm --filter @fluxiq-web-extension/test-runner run check` | 0 | `tsc -p tsconfig.json --noEmit`, no diagnostics. |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | 0 | `# tests 439`, `# pass 439`, `# fail 0`, `# cancelled 0`, `# skipped 0`. |
| Occurrences of each of the 20 titles among the `ok N - <title>` lines of that run | 0 | Every title appeared exactly `1` time, so none is missing or duplicated. |
| **Ratchet proof.** Scratch `GIT_INDEX_FILE` (a copy of `.git/index`) plus `git add` of the on-disk probe file, then the audit | 1 | Scratch index count `51`. `FAIL [directory-files] packages/test-runner/src/tests/: 51 source files exceeds the 25-file limit. … Baseline for this entry is 50; baselined entries may shrink, never grow.` The probe was then deleted: `ls: cannot access '…ratchet-probe.test.ts': No such file or directory`. The real index count is still `50`. |
| `node scripts/structure-audit.mjs`, real index, rerun at the end | 1 | Only two failures, both `[working-docs]`: `mvp-week1-web-automation-reliability-plan.md: 819 lines exceeds the 800-line compaction threshold`, and `docs/working/README.md is out of date`. There is no `directory-files` failure. See Open questions 1. |

### A probe I first ran wrong

My first ratchet probe added a path that did not exist on disk to a scratch
index, using `git update-index --cacheinfo`. The audit **passed** with 51
entries in the scratch index. The ratchet was not at fault. The audit drops any
tracked path that does not exist on disk (`scripts/structure-audit/context.mjs:89-95`,
`existsSync(absolute) && statSync(absolute).isFile()`), so that probe tested
nothing. I discarded it and reran with a real file, as shown in the table
above. Anyone probing a directory ratchet through a scratch index needs the file
on disk as well.

## Not verified

- **No Lab run is needed for this item, and none was done.** This was a file
  move with no change in behaviour, and the tests are `node:test` unit tests
  over pure functions, source text and stubbed clients. The Lab would only show
  a change if the moved module's runtime behaviour changed. If the supervisor
  wants that covered anyway, the evidence is any `demo:llm:*` provider-free
  command still reporting `providerCallCount: 0`. Nothing in this item can
  change that.
- **I did not run root `pnpm check`, root `pnpm test`, or the content harness.**
  Five other workers are editing the tree, so a repository-wide result would not
  be attributable to this item. The brief names test-runner `check` and `test`
  plus the audit, and those ran.
- **I did not compare the moved code line by line.** I checked tests by title
  and assertion lines as a multiset, not by comparing whole test bodies. The
  837-line module's split into 14 files happened in `ab736a1`, before this
  brief. `check` and all 439 tests passing are the only evidence that it is
  faithful. I did not diff that split.
- **The two `working-docs` audit failures come from a file I do not own.** I
  reran the audit once, as the binding rules require, and they persisted. I did
  not investigate further.

## Open questions or contradictions found

1. **The root structure audit now fails, and this item did not cause it.**
   During my session, `docs/working/mvp-week1-web-automation-reliability-plan.md`
   became modified in the working tree (` M`) and reached 819 lines. That trips
   the 800-line compaction threshold and leaves `docs/working/README.md` stale.
   My first real-index audit passed and my rerun at the end failed on exactly
   those two findings. Root `pnpm check` runs the audit first, so it will fail
   until the plan document is compacted and the index regenerated. That work is
   the supervisor's.
2. **The brief was written against a state that no longer held.** It describes
   `src/tests/demo-llm-create-ui.test.ts` as 615 lines with `src/tests/` sitting
   at 51. Both were resolved by `ab736a1` and `99eca80`. The second is the
   commit that wrote this brief's session objective. `p-test-split` should
   probably be marked superseded by `ab736a1`, and item 5 of the plan's Open work
   ("The `packages/test-runner/src/tests/` ratchet has no headroom") can be
   closed.
3. **The scratch-index `git add` wrote a loose blob object** for the probe's
   one-line content into `.git/objects`. It is not referenced by any commit or by
   the shared index, and git's normal garbage collection removes it. I mention it
   only because workers are asked not to touch git state.
4. **Nothing in the baseline needs to change.** `lowerable` is 0.
   `src/tests` is 50 against a baseline of 50, and `src` is 49 against 49.
