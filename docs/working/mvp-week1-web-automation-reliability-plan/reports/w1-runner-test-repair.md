# w1-runner-test-repair: the 19 pre-existing test-runner failures

Worker report for `briefs/wave-1.md`, Brief: w1-runner-test-repair.

## Outcome

**Done.** All 19 tests pass, and so does the whole suite: 333 of 333 when run
from `packages/test-runner`, and 333 of 333 when run from the repository root.

- Eighteen fixes only change how a test finds a file. It now resolves the
  file from its own location, and six of them read the module the code moved
  to. No assertion changed.
- Test 147 (the ceiling test) is different. I established that the constant
  did not regress and rewrote the test. The supervisor should confirm that
  decision (Open questions 1).

Only the nine test files holding the 19 tests were edited. No source, script,
or constant was touched.

## What changed and why

I found the tests by title; their numbers differ between runs. Every
repository path is now resolved as
`path.resolve(import.meta.dirname, "../../../..")`. That is the convention
commit `e800499` used when it repointed `demo-llm-live.test.ts:7` and
`demo-llm-prepare.test.ts:17`. The compiled tests run from
`packages/test-runner/dist/tests/`, so four levels up is the repository root.

### Cause 1: repository paths read relative to the working directory (12 tests)

pnpm runs the suite from `packages/test-runner`. There, `package.json` is the
package's own manifest, and `scripts/` and `apps/` do not exist.

| Test | File | Fix |
| --- | --- | --- |
| 119 adaptation launcher exposes normal and no-build focused commands… | `demo-llm-adaptation.test.ts` | `const root = process.cwd()` replaced by the repository root |
| 161 exposes separate provider-free baseline and exact readiness commands | `demo-llm-exploration-adaptation-readiness.test.ts` | `package.json` and two `scripts/*.mjs` read from the root |
| 172 proposal launcher exposes the safe proposal identity reason code | `demo-llm-exploration-adaptation-wait.test.ts` | `scripts/run-demo-llm-exploration-adaptation.mjs` read from the root |
| 176 launcher imports provider-free environment and emits only a safe result… | `demo-llm-exploration-adaptation.test.ts` | the same launcher, read from the root |
| 188 package command is provider-free and delegates only to the apply checkpoint | `demo-llm-exploration-apply.test.ts` | `package.json` and `scripts/apply-demo-llm-exploration-proposal.mjs` read from the root |
| 189–193 (five tests in the request file) | `demo-llm-exploration-request.test.ts` | `resolveDemoLlmExplorationRequest(process.cwd(), …)` becomes `(repositoryRoot, …)`, nine calls in all; `loadScenarioManifests` needs the root to find `apps/scenario-lab/dist/registry.js` |
| 194 bound continuation commands are provider-free and separate from legacy… | `demo-llm-exploration-request.test.ts` | `package.json` and the two looped `scripts/*.mjs` read from the root |
| 214 bound run launcher exposes only allowlisted stage and reason diagnostics | `demo-workspace.test.ts` | `path.resolve("scripts/…")` replaced by the root plus the relative path |

### Cause 2: source text sliced from `src/demo-workspace.ts`, whose code moved (6 tests)

Each of these tests also read `package.json` and a launcher relative to the
working directory, fixed as above. Each takes a span of source from its
function's declaration up to the next `export async function`. Commit
`e800499` turned `src/demo-workspace.ts` into a five-line facade, so that
span is empty. The `e800499` commit message records the same 19 failures by
name before and after, so these tests were already failing at the working
directory reads when the move happened.

| Test | Function sliced | Now read from |
| --- | --- | --- |
| 162 single-run baseline is exact-scoped… | `runDemoLlmExplorationBaselineProbe` | `demo-workspace/exploration-checkpoints.ts` |
| 167 command is provider-free and does not use prepared or saved Flow state | `runDemoLlmExplorationAdaptationRevert` | `demo-workspace/exploration-adaptation.ts` |
| 168 reject launcher is provider-free… | `runDemoLlmExplorationAdaptationReject` | `demo-workspace/exploration-adaptation.ts` |
| 175 command targets exact exploration readiness… | `runDemoLlmExplorationAdaptationProposal` | `demo-workspace/exploration-adaptation.ts` |
| 179 apply launcher is secret-stripped… | `runDemoLlmExplorationAdaptationApply` | `demo-workspace/exploration-adaptation.ts` |
| 182 validate launcher is secret-stripped… | `runDemoLlmExplorationAdaptationValidation` | `demo-workspace/exploration-adaptation.ts` |

**Every slice runs over the same text as before.** I applied each test's own
slicing rule to both the pre-move monolith (`git show e800499^:…`) and the
new module, and compared the results.

- All six slices are identical apart from trailing whitespace: 83, 18, 22,
  75, and 70 lines.
- `Validation` is the only difference. It is now its module's last function,
  so its slice runs to the end of the module (57 lines against the old 59).
  That span contains the same code.

The regexes, the slicing rule, and the offsets are unchanged. I added one
line after each slice, `assert.notEqual(start, -1)`. The next time a function
moves, the test fails at that line, not with an empty span and a confusing
regex mismatch. This only adds strictness.

### Cause 3: the live ceiling assertion (test 147, `demo-llm-creation.test.ts`)

The test asserted `FIRST_LIVE_CREATION_PROFILE.budget` equal to
2 000/512/3 000 tokens, one call, 20 s, $0.25. The actual value is
42 000/8 000/50 000, two calls, 60 s, 0 retries, $0.25.

**The constant did not regress.** The evidence:

1. `git log -S "one-call strict live ceiling"` shows the test was added in
   `488bb66` (2026-09-07). That same commit made
   `FIRST_LIVE_CREATION_PROFILE` a
   `/** @deprecated compatibility alias; use DEFAULT_DEMO_LLM_CREATION_PROFILE. */`
   of the `production` profile. The test was never green against the alias.
2. `docs/working/llm-production-automation-plan.md:188`: "the test-contract
   ceiling was two calls per run while the `production` creation profile
   declared four. The profile now declares two; the live creation UI remains
   stricter at exactly one call and zero retries."
3. Plan line 97: explicit profiles stay "within the two-call, $0.25, and
   50,000-total absolute contract ceilings". In code,
   `LLM_LAB_MAX_CALLS_PER_RUN = 2` (`packages/test-contracts/src/llm.ts:3`).
4. Plan line 96 documents the current strict creation limits: "4,000 input
   tokens, 1,000 output tokens, 5,000 total tokens, one call per run, zero
   retries, 20 seconds, and $0.25". They live in `FIRST_LIVE_CREATION_LIMITS`
   (`demo-llm-create-ui.ts:9`), which the live creation UI uses for its
   settings, its authorization check, and its accounting guard (`:799-803`).
5. The values the test asserted, 2 000/512/3 000/20, are the original
   first-live preset. Plan lines 201 and 207 record it as superseded.
6. `demo-llm-profile.test.ts:6`, which passes, asserts `maxCallsPerRun` is 2
   on the same object. The two tests could not both pass.

**The rewritten test keeps the one-call claim and adds to it.** It asserts:

- `FIRST_LIVE_CREATION_PROFILE` is `DEFAULT_DEMO_LLM_CREATION_PROFILE`.
- That profile's budget matches, field for field, the values the plan
  intends. Any widening fails.
- `FIRST_LIVE_CREATION_LIMITS` equals, field for field, the one-call,
  zero-retry, 4 000/1 000/5 000, 20 s, $0.25 limits from plan line 96.
- `evaluateDemoLlmCreation` rejects a two-invocation input with
  `/exactly one provider invocation/` (`demo-llm-creation.ts:277`). This new
  check covers the "enforces" in the test's title.

The task, approval mode, and raw-retention assertions are unchanged. A
three-line comment in the test names the plan.

### How the edits were made

I used a scratch script, `apply-edits.mjs`, in my session scratchpad. It
checked every expected replacement count, found each function's module by
searching `demo-workspace/`, rejected any leftover `process.cwd()`,
`readFile("package.json"`, `readFile("scripts/`, or `src/demo-workspace.ts"`,
and wrote nothing unless every file passed. The dry run passed before the
write. All nine files keep their LF line endings, and the BOM in
`demo-llm-adaptation.test.ts` is preserved.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner test` (baseline, before
  any edit): `# tests 333`, `# pass 314`, `# fail 19`, exit 1.
- `node compare-slices.mjs old-demo-workspace.ts` (scratch):
  `ALL SLICES IDENTICAL`, six lines of the form `identical after trimEnd: true`.
- `node apply-edits.mjs`, then `node apply-edits.mjs --write` (scratch): every
  count matched, `wrote 9 files`.
- `pnpm --filter @fluxiq-web-extension/test-runner test`, which runs `tsc`
  and so type-checks the edited tests. Run from the package: exit 0,
  `# tests 333`, `# pass 333`, `# fail 0`, `# duration_ms 9061.3533`.
- `node --test "packages/test-runner/dist/**/*.test.js"` from the repository
  root (`cwd=/f/!FluxIQWebExtension`): exit 0, `# tests 333`, `# pass 333`,
  `# fail 0`, `# duration_ms 9649.0006`.
- In both runs, all 19 formerly failing titles report `ok`: 119, 147, 161,
  162, 167, 168, 172, 175, 176, 179, 182, 188–194, and 214.
- `node scripts/structure-audit.mjs`: exit 0,
  `structure-audit: passed (27 warning(s), 19 baselined)`. There is no
  finding in my files.
  - It also printed: `structure-audit: 1 baseline entries can be lowered.`
    None of my nine files appears in `.structure-baseline.json` (the grep
    found no match), so this entry comes from another change. I did not run
    `pnpm structure:baseline`.
- The run from the root left nothing behind. There is no `fixture-repository`
  or `runs` directory at the root, and `git status` shows only other
  workers' paths as untracked.

## Not verified

- I did not run `check` separately. The `test` script's `pnpm build` runs
  `tsc -p tsconfig.json`, the same configuration, and it passed.
- The fix assumes the compiled tests sit at
  `packages/test-runner/dist/tests/`. A build that moves `dist/tests` would
  break every root-relative test in the package, the existing ones included.
- `w1-bench` was editing the package at the same time. Neither run hit a
  failure, so I did not need a rerun. A later bench edit could change the
  count of 333.

## Open questions or contradictions found

1. **Test 147 needs the supervisor's confirmation.** The numbers the test
   asserts on `FIRST_LIVE_CREATION_PROFILE.budget` went up, to the values
   the plan and history show are intended. The one-call ceiling is still
   asserted, now on `FIRST_LIVE_CREATION_LIMITS` and on the evaluator.
   - The production values 42 000/8 000/50 000/60 s exist only in code
     (`488bb66`). The plan documents only the ceilings they sit at.
   - If the one-call ceiling was meant to stay on the profile, the fix
     belongs in source: `demo-llm-profile.ts`, or removing the deprecated
     alias.
2. **The creation evaluator's token check is looser than the UI's.**
   `demo-workspace/creation-lanes.ts:317` calls `evaluateDemoLlmCreation`
   without a profile, so its token and cost check uses the production budget
   (42 000 input). The UI guard it follows uses 4 000.
   - The one-call cap holds regardless, because the parser requires exactly
     one invocation.
   - This is a source observation, not changed here.
3. **`FIRST_LIVE_CREATION_PROFILE` is a deprecated alias with a misleading
   name.** It reads as the one-call live profile but is the two-call
   production profile. Removing it is a source change, outside this brief.
4. **Some tests still use working-directory paths, but they are
   harmless.** Each builds a fake path string and reads nothing:
   - `demo-workspace.test.ts:8`, `path.resolve("fixture-repository")`
   - `environment.test.ts`
   - `windows-acl.test.ts`, which mocks `exec`
   - `secret-leak-attestation.test.ts:112`, which rejects before scanning

   They pass from both directories. I left the first as it is, and the other
   three are not mine.
5. **`git diff` also shows changes to two other test files.**
   `commands.test.ts` (a `--workflow` test) and `network-guard.test.ts`
   (origin-proof tests) belong to other workers. I did not touch them.
