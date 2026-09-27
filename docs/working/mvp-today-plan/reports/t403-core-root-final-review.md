# t403 — Core root final review

> **Historical and superseded.** The NO-GO below predates the later supervisor-observed green Core
> check and t406's post-baseline structure audit. Retain the body only as audit history.

## Verdict

**NO-GO pending one command: rerun `pnpm check` from `F:\!FluxIQ`.** The
recorded Core evidence closes the former structure, docs-reference, build, and
root-test failures, but the last green root check predates the three final
test-local timeout edits. Those edits are small and the final full root test
passed with them present, but a Vitest pass is not a substitute for the
required structure and TypeScript check on the final tree.

No other Core gate is stale on the current tree. In particular, the later
edits do not require another build or reference generation/check. No command
in this review changed Core. I ran no broad test, check, build, docs generator,
provider, live, panel, browser, Lab, stage, commit, or push command.

## Current Core state inspected

The current Core checkout is `F:\!FluxIQ` on
`task/t170-mvp-today-integration`, at committed base
`d035e1b7d17977951a2a2ec6b5e51570e3f2c537`. It is intentionally very dirty:
`git status --porcelain=v1 -uall` reports 222 entries — 128 unstaged modified,
92 untracked, one index deletion, and one index rename with a further
worktree modification. The unique current-path inventory is 221 paths: 131
production/source-classified files, 82 tests, five docs, two config files,
and one other path. This review treats the existing dirty tree as the closure
unit and does not imply that unrelated changes are absent.

The scoped closure paths are present as expected:

- the old untracked
  `runtime/llm/tests/evidence-loop-progress.test.ts` path is absent and the
  ownership-correct untracked
  `runtime/llm/evidence-loop/tests/progress.test.ts` path is present;
- both generated framework references are modified and byte-identical;
- the three timeout-bearing test files are modified; and
- `packages/fluxiq/vitest.config.ts` has no working-tree change.

The current `.structure-baseline.json` diff only lowers existing findings
(`failure-as-empty` 18 to 16, `file-lines` 4584 to 4568) and removes two
obsolete entries. It adds or raises no baseline finding. The only current
`packages/fluxiq/package.json` delta is the already-intended version change
from `0.6.0` to `0.7.0`.

## Evidence chain

### Root check after the structure move — green, now stale

T388's root `pnpm check` failed only because
`runtime/llm/tests/` contained 26 direct source files. T393 moved the one
progress test into the existing `evidence-loop/tests/` owner, corrected its
relative import, passed the moved file's 7/7 tests, and then recorded a green
root `pnpm check`. The former 26-file violation did not recur; the structure
audit passed with advisory warnings only.

That check is not final-tree evidence. The moved test was written at
`2026-09-27T06:35:51.7521548Z`; the three timeout test files were subsequently
written at `06:45:09.6717665Z`, `06:45:09.6717665Z`, and
`06:45:25.2015596Z`. No later green `pnpm check` is recorded. Even though the
edits are valid Vitest third arguments and the full test suite transpiled and
ran them, the required Core type/structure gate must observe them too.

### Generated docs — green and current

T394 ran the owning `pnpm docs:reference` generator, which refreshed both
declared framework-reference mirrors, and then recorded a green
`pnpm docs:check`. T397 independently reran `pnpm docs:check` green and
reviewed the generated content and privacy boundary.

Both current files still have SHA-256
`17398DC099098C03619C70F5A8174AF611C5296F0EBABD43583E3965CCC44C7E` and
are byte-identical. The only Core writes after T397's review are the three
test-local timeout files. The reference generator reads the public entry
point/source surface, not test files, so those later edits do not stale the
generated docs or their check. Do not rerun `pnpm docs:reference` or
`pnpm docs:check` merely for this closure.

### Build, freshness, and downstream identity — green and still valid

T388's root `pnpm build` passed all Core workspaces and web. Its three named
packing outputs were newer than their production sources. Current inspection
reproduces the same built-byte hashes:

| Seam | Production source UTC | Built JS UTC | Current built SHA-256 |
| --- | --- | --- | --- |
| projection bound | `2026-09-27T06:07:34.1907572Z` | `2026-09-27T06:30:45.0261498Z` | `DC796ABE9DE0F780E964F6E80700D7628E92B9EA8647F325DBEE8327C4691131` |
| draft packing | `2026-09-27T06:15:49.6365039Z` | `2026-09-27T06:30:44.9388446Z` | `B8948F72BD2A804DE2930D85356E7B997393ECB3AB1FFA85C0AFA7CBB273B743` |
| packed measurement | `2026-09-27T06:12:43.2602761Z` | `2026-09-27T06:30:46.4759611Z` | `29A46A8F1947F906A2680D90548400BE74CB91B4D833C065864FF0BD31CF3153` |

`F:\!FluxIQWebExtension\domain\node_modules\fluxiq` remains a junction to
exactly `F:\!FluxIQ\packages\fluxiq\`; all three hashes read through that
junction are identical to the Core-path hashes.

After the root build, exactly six changed Core paths have later write times:
the two generated reference mirrors, the moved progress test, and the three
timeout tests. There is no later production or build-configuration edit.
Therefore the last build still represents every changed production seam, and
neither rebuild nor another freshness/identity proof is required.

### Full root test after local timeouts — green and final

T395 first reproduced the suite-load sensitivity, then added `60_000` only as
the third argument of the three named fixture-heavy `it()` cases. Its final
root `pnpm test` passed 670 files and 5,437 tests, with one intentional skip
and zero failures: contracts 53, FluxIQ 4,035, websocket 3, and web 1,346.
The corrected cases passed under full-suite pressure at 17,954 ms, 12,408 ms,
and 20,587 ms. No current Core file has a write time after that final test
report (`2026-09-27T06:51:04.4203760Z`).

T400's scoped diff re-review confirms that the remediation added exactly the
three intended per-test budgets. The global `testTimeout` and `hookTimeout`
remain 15,000 ms; worker/file concurrency and production code were not
changed. The broader worktree contains earlier local `60_000` test budgets,
but there is no global timeout/config relaxation. Current scoped
`git diff --check` reports no whitespace error (only Windows line-ending
advisories).

## Exact remaining command

With the tree held unchanged, run exactly this from `F:\!FluxIQ`:

```powershell
pnpm check
```

If it exits zero and no file changes during the run, Core root closure is
**GO** with the existing final evidence; `pnpm test`, `pnpm build`,
freshness/identity hashing, `pnpm docs:reference`, and `pnpm docs:check` do not
need repetition. If any production/public source, build configuration,
generated reference, or test file changes before that command completes, this
conclusion must be recalculated against the affected gate rather than blindly
reusing the sequence above.
