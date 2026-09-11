# ext-test-runner — Phase 1 test relocation

## Outcome

Done.

All 51 test files that sat directly in `packages/test-runner/src` now live in
`packages/test-runner/src/tests/` with filenames unchanged. Imports repaired.
Test-file and test-case counts are identical before and after, and the set of
failing test names is byte-identical. The `test-placement` audit reports
`failures: []` and no longer reports `packages/test-runner/src` at all.

## What changed and why

**Moved (51 files, `git mv`, names unchanged):** every `src/*.test.ts` into
`src/tests/`. `src` drops from 101 files to 50 files plus the `tests`
directory. `demo-workspace.ts`, the other `demo-*.ts` modules, `index.ts`,
`cli.ts`, and every other non-test module were left exactly where they were.

**Import repair (81 lines).** Every relative specifier in the moved tests was
`from "./X.js"` — all double-quoted, none bare, none single-quoted, none
without a `.js` extension — so each gained one `../`. No test imports another
test, and no non-test module imports a test, so nothing outside `src/tests`
needed editing.

**Seven path-depth computations** would have silently resolved one directory
too shallow at the new compiled depth. These are not import statements, so a
specifier-only sweep would have missed them; three of them use
`import.meta.dirname` rather than `import.meta.url`:

| File (now under `src/tests/`) | Was | Now |
| --- | --- | --- |
| `auth-cli.test.ts:36` | `join(dirname(fileURLToPath(import.meta.url)), "cli.js")` | `..., "..", "cli.js")` |
| `clone-cache.test.ts:116` | same | same fix |
| `demo-llm-create-ui.test.ts:9` | `resolve(import.meta.dirname, "..", "..", "..")` | four `".."` |
| `demo-llm-create-ui.test.ts:136` | `new URL("./demo-llm-create-ui.js", import.meta.url)` | `"../demo-llm-create-ui.js"` |
| `demo-llm-live.test.ts:7` | `resolve(import.meta.dirname, "../../..")` | `"../../../.."` |
| `demo-llm-prepare.test.ts:17` | `resolve(import.meta.dirname, "../../..")` | `"../../../.."` |
| `demo-llm-setup-script.test.ts:6` | `new URL("../../../" + relative, import.meta.url)` | one more `../` |

Nothing else inside any test changed. `git diff` over `packages/test-runner/src`
is 81 added / 81 deleted, and a filter for changed lines that are neither an
import specifier nor an `import.meta` path line returns 0.

**`package.json` test glob quoted.** Was
`node --test dist/**/*.test.js`, now `node --test "dist/**/*.test.js"`.
See the next section — the glob did not break, but it was matching for a
depth-dependent reason in one of the two shells, and the quotes remove that.

No `tsconfig.json` change was needed: `include` is `src/**/*.ts` and `rootDir`
is `src`, so `src/tests/*.test.ts` still compiles, to `dist/tests/*.test.js`.

## The depth hazard, resolved

The brief's hazard is real but did not bite here, for two different reasons in
the two shells this repository is driven from:

- **PowerShell / cmd** (how `pnpm --filter ... test` actually runs here): the
  shell does not expand globs for a native command, so `node` receives the
  literal `dist/**/*.test.js` and globs it itself. Node's glob `**` *does*
  recurse, so it matched 51 files before the move and 51 after.
  Verified directly with `fs.globSync("dist/**/*.test.js")` — length `51`,
  first match `dist\tests\allocation.test.js`.
- **Git Bash / sh**: `**` collapses to a single `*`. Before the move,
  `dist/*/*.test.js` matched nothing, so bash passed the pattern through
  unexpanded and node globbed it correctly. After the move it expands to
  `dist/tests/*.test.js` and matches 51 — the right answer by accident of the
  tests being exactly one level deep. Measured both ways with an argv probe:
  unquoted gives node 51 argv entries, quoted gives it 1 (the literal
  pattern, left for node to expand).

Quoting the pattern makes node the only globber in both shells, so the script
is now depth-independent rather than accidentally correct.

**One measurement trap worth recording.** `tsc` does not clean `dist`. After
the first post-move build, `dist` held *both* the stale `dist/*.test.js` (51)
and the new `dist/tests/*.test.js` (51), and the glob matched all 102 —
which would have reported a doubled, meaningless count. Every count below was
taken after `rm -rf dist` and a full rebuild.

## Commands run and observed results

Baseline, before any file moved
(`pnpm --filter @fluxiq-web-extension/test-runner test`, from PowerShell):

```text
# tests 266
# suites 0
# pass 247
# fail 19
# duration_ms 24387.5955
```

Final, after the move, the import repair and the glob quoting, on a wiped and
rebuilt `dist`:

```text
# tests 266
# pass 247
# fail 19
```

Both exit 1, on the same 19 failures. `not ok` lines extracted, stripped of
their numbers, sorted and `diff`ed: **identical, 19 vs 19, no difference**.
Test files matched by the glob: **51 before, 51 after**.

`pnpm build` (`tsc -p tsconfig.json`): exit 0, no diagnostics, both before and
after the import repair.

`node scripts/structure-audit.mjs --rule test-placement --json`:

```json
{ "failures": [], "warnings": [], "suppressed": 0, "lowerable": [] }
```

`packages/test-runner/src` no longer appears in the output at all — its 51
findings went to zero, and `baseline.mjs` only lists an entry as `lowerable`
when it still has findings below the recorded number
(`if (finding.value < recorded)`), so a directory that reaches zero
disappears instead. That is the "or disappear entirely" branch of the brief's
acceptance condition. The baseline still records
`"packages/test-runner/src": 51` and was not touched. Human-readable form:
`structure-audit: passed (0 warning(s), 0 baselined)`, exit 0.

Working tree, scoped to the package: 51 `RM` entries (staged rename plus the
import edit) and one ` M` on `package.json`. Nothing else under
`packages/test-runner` changed, and nothing outside it was touched by me.

## The 19 failures are pre-existing

They fail identically before and after, by name and by count. Six of them
report `Scenario Lab build is missing:
...\packages\test-runner\apps\scenario-lab\dist\registry.js` —
`loadScenarioManifests` takes `repositoryRoot` as an argument and several
tests pass `process.cwd()`, which under `pnpm --filter` is the *package*
directory, not the repository root. The path is therefore assembled wrong
regardless of where the test file lives. The count of that message is 6 in
both logs. The remaining failures are in the same demo-LLM launcher family.
This is outside my brief; I did not touch it and I did not investigate
further.

## Not verified

- I did not run the full-suite `pnpm check`, `pnpm test`, or `pnpm build` at
  the repository root — only this package's `build` and `test`, and the
  single `test-placement` audit rule.
- I did not run the other audit rules, so I cannot say whether moving 51 files
  out of `src` changed the `directory-files` finding for
  `packages/test-runner/src` (it should now be 50, under the 101 recorded).
  The supervisor will see it when regenerating the baseline.
- I did not run `pnpm structure:baseline`, per the brief.
- No browser or live validation applies to this change.
- The 19 pre-existing failures were not diagnosed beyond reading the error
  text; I confirmed only that they are unchanged.
- The other worker's changes (`ext-rest`) were landing in the same working
  tree while I ran. Between two audit runs a minute apart, `suppressed` went
  from 1 to 0, which is their last directory clearing, not mine. My package
  reads clean in both runs.

## Open questions or contradictions found

- **The glob quoting is slightly beyond a literal reading of the brief**,
  which said to fix the glob only "if a glob no longer matches". It still
  matched. I quoted it anyway because in `sh` it matches only while the tests
  sit at exactly one directory below `dist`, which is the same silent failure
  the brief was guarding against, one phase later. Easy to revert — it is a
  single pair of quotes in `packages/test-runner/package.json`.
- **`demo-llm-prepare.test.ts` asserts on source paths**, reading
  `packages/test-runner/src/demo-workspace.ts` and
  `packages/test-runner/src/demo-llm-blank-workspace.ts` as text. Those two
  files did not move, so the test still passes — but whichever phase splits
  `demo-workspace.ts` will break this test, and it will break by reading a
  file that no longer exists rather than by a type error.
