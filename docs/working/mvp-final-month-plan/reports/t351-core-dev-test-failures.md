# t351: the ten Core test failures the first sweep found

Worker: t351-core-failures. Core tree: `C:\Users\osrs_\FluxStuff\fxwork\t351\!FluxIQ`
(branch `task/t351-core-dev-test-failures`, base `e0664f17`). Nothing committed.

## Outcome

Done. All six files pass (74 tests). The ten failures came from three causes:

1. **Four files (six tests): a new module cycle path, t299 `0b5d7543`.** Product
   structure defect, fixed in product code. The tests that guard this cycle caught it.
2. **One file (three tests): a stale re-author stub, t299 `87c4c9f9`.** t299's guard
   correctly refuses a build result that lacks `status: "proposed"`, and this stub
   returned only an id and accounting. That is the same pattern t341 fixed in
   `runtime-adaptation/tests`. The test was updated.
3. **One file (one test): a stale seam guard, t331 `8c5482e7`.** t331 moved node
   dispatch into `executor/node-execution/attempt.ts`, behind the one `try` in
   `executor/node-execution.ts`. The guard now checks both halves of the seam.

| File (under `runtime/`) | Tests | First bad commit | Last good | Cause | Fix |
| --- | --- | --- | --- | --- | --- |
| `llm/tests/loop-budget.test.ts` | 1 | `0b5d7543` (t299, "Add isolated explicit candidate authoring") | `1e77dcc5` (its parent) | Cycle, see below. `runAutomationStudioLlmHarness` reached `refusal.ts`, which called an undefined `automationStudioWithoutLocators`. The loop caught the TypeError as `invalid_decision`, so the provider was never asked (`asked` = 0). | Product: candidate is no longer re-exported from the flow-bootstrap barrel |
| `flow-bootstrap/generation-failure/tests/provider-refusal.test.ts` | 1 | `0b5d7543` | `1e77dcc5` | Cycle: `automationStudioWithoutLocators is not a function` | Same |
| `flow-bootstrap/generation-failure/tests/provider-throw.test.ts` | 3 | `0b5d7543` | `1e77dcc5` | Cycle: `runAutomationStudioLlmHarness is not a function` | Same |
| `tests/refuted-result/tests/carried-steps-between-rounds.test.ts` | 1 | `0b5d7543` | `1e77dcc5` | Cycle: `automationStudioEvidenceKey` undefined at `result-verification/build-test/observation.ts:91` | Same |
| `tests/refuted-result/tests/failed-step-reauthor.test.ts` | 3 | `87c4c9f9` (t299, "Wire explicit candidate requests to durable unverified drafts") | `08fb8668` (its parent) | Stale stub. `generate` returned `{ adaptationId, accounting }` with no `status: "proposed"`. `reauthor-build.ts:141` refuses that, so approve was never called and nothing re-ran. | Test: the stub returns t341's full typed proposal |
| `executor/tests/defensive-policy.test.ts` | 1 | `8c5482e7` (t331, "Propagate authentic command outcomes through actual Flow execution") | `030eca4f` (its parent) | Stale guard. The dispatch calls moved to `executor/node-execution/attempt.ts`. `node-execution.ts` still wraps the only call to `AutomationStudioNodeAttemptExecution.execute(...)` in its never-rejecting `try`. | Test: expect dispatch only in `attempt.ts`, and attempts started only from `node-execution.ts` |

### The cycle (cause 1) in detail

- `runtime/llm/` imports the flow-bootstrap barrel by value in many places: the
  DeepSeek adapter, `harness/context-packet.ts`, the draft checks and others.
  Flow-bootstrap's generation-failure module imports `runtime/llm/index.ts`. That
  cycle was already known and documented in `llm/harness/index.ts`.
- `0b5d7543` added `export * from "./candidate/index.ts"` to
  `flow-bootstrap/index.ts`. Candidate authoring drives the evidence loop, so it
  value-imports `llm/evidence-loop.ts` and `llm/harness-options/index.ts`. That gave
  the flow-bootstrap barrel a second way into `runtime/llm/` and changed the order the
  cycle evaluates in.
- Under vitest's module runner, `export * from` copies the exports a module has
  defined so far. `llm/harness.ts` (`export * from "./harness/index.ts"`) ran its copy
  while `harness/index.ts` was still stopped at `context-packet.ts`. Every export after
  that line was missing from `harness.ts` for good, including
  `automationStudioWithoutLocators`, `runAutomationStudioLlmHarness` and
  `automationStudioEvidenceKey`.
- **Production effect: none observed.** Native Node ESM keeps `export *` bindings
  live. I loaded the built `dist` (which still has the candidate re-export) with plain
  `node`, starting from the generation-failure barrel as the test does. It printed
  `native function function function function`, so all four symbols resolved. The
  defect is the extra cycle entry. Only the test loader turned it into an error, which
  is the job these tests do ("a top-level read added anywhere in that graph fails
  here").
- **Fix:** `flow-bootstrap/index.ts` no longer re-exports `./candidate/`. A comment
  there says why and must not be removed. The two consumers that read candidate
  symbols through the barrel now import `flow-bootstrap/candidate/index.ts`.
  `runtime/index.ts` publishes `./flow-bootstrap/candidate/index.ts` directly, so the
  public `fluxiq/automation-studio` surface is unchanged. Downstream
  `test-runner/.../candidate-outcome.ts` and `apps/web` import
  `AutomationStudioCandidateAuthoringResult` and
  `parseAutomationStudioCandidateAuthoringResult` from it.

## What changed and why

Product modules I identified before editing (the regression fix needs them):
`flow-bootstrap/index.ts`, `runtime/index.ts`, `service/candidate-drafts/record.ts`,
`service/flow-bootstrap-commands/candidate-generation.ts`. None is under
`runtime/conversations/**` and none is activity wording.

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`,
except the baseline file.
- `flow-bootstrap/index.ts`: removed the `./candidate/` re-export and added the comment
  explaining the cycle.
- `index.ts`: `export * from "./flow-bootstrap/candidate/index.ts";` placed after the
  flow-bootstrap barrel.
- `service/candidate-drafts/record.ts`: candidate types now come from
  `../../flow-bootstrap/candidate/index.ts` (type-only import).
- `service/flow-bootstrap-commands/candidate-generation.ts`:
  `runAutomationStudioFlowCandidateAuthoringLoop` now comes from
  `../../flow-bootstrap/candidate/index.ts`.
- `executor/tests/defensive-policy.test.ts`: the seam guard reflects t331's split and
  adds the second check that `AutomationStudioNodeAttemptExecution.execute(` is called
  only from `executor/node-execution.ts`.
- `tests/refuted-result/tests/failed-step-reauthor.test.ts`: the stub returns
  `automationStudioReauthorProposed(...)` for `project-1`/`flow-1`. Its existing
  `generate as never` cast is gone, because the typed stub fits the port.
- `service/runtime-adaptation/tests/reauthor-proposal.ts` (t341's test helper): new
  optional `subject` parameter, defaulting to `project.one`/`flow.one`. The other 13
  call sites are unchanged.
- `.structure-baseline.json`: removed the `as-never` entry for
  `failed-step-reauthor.test.ts`, because that cast is gone. `structure:baseline` also
  offered to lower `runtime/service.ts` file-lines from 4386 to 4381. I did not take
  that: I never touched `service.ts`, and lowering it could fail another task's merge.
- No new `as never` casts (one fewer). I did not touch `runtime/conversations/**`,
  activity wording, the extension or `docs/working/*.md` files.

## Commands run and observed results

All Core commands ran in `C:\Users\osrs_\FluxStuff\fxwork\t351\!FluxIQ`.
- Reproduction at `e0664f17`, running the six files with `npx vitest run <six files>`
  in `packages/fluxiq`, gave `Test Files 6 failed (6)` and
  `Tests 10 failed | 64 passed (74)`. The first errors matched the sweep.
- First bad commits came from a scan script in my scratchpad (`t351-scan.sh`). It
  checks out each commit detached in the t351 tree, runs the six files with the vitest
  JSON reporter, and returns the tree to `task/t351-core-dev-test-failures`.
  - All six files pass at `1e77dcc5` and `6c449022`.
  - The four cycle files fail at `0b5d7543` (parent `1e77dcc5`). `91903d4a` passes, but
    it is on the t300 branch, which does not contain `0b5d7543`.
  - `failed-step-reauthor` passes at `08fb8668` and fails at `87c4c9f9`.
  - `defensive-policy` passes at `030eca4f` and `66a310cc`, and fails at `8c5482e7` and
    `5eac215b`.
  - Every later dev merge fails the same way.
  - The tree is back on its branch at `e0664f17`. `git branch --show-current` printed
    `task/t351-core-dev-test-failures`.
- Experiment: with the candidate re-export commented out, the four cycle files gave
  `Test Files 4 passed`, `Tests 53 passed`.
- After the fix, the six files gave `Test Files 6 passed (6)`, `Tests 74 passed (74)`.
  I ran them again after restoring the patch, adding the 3 files in
  `src/programs/automation-studio/tests/`: `Test Files 9 passed (9)`,
  `Tests 93 passed (93)`.
- Directories around each change: `npx vitest run runtime/executor/
  runtime/flow-bootstrap/ runtime/service/candidate-drafts/
  runtime/service/candidate-trial/ runtime/service/flow-bootstrap-commands/
  runtime/service/runtime-adaptation/ runtime/tests/refuted-result/ runtime/llm/tests/`
  gave `Test Files 199 passed | 1 skipped (200)`,
  `Tests 2726 passed | 2 skipped (2728)`.
- Nonincremental typecheck: `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` gave
  `tsc exit 0`.
- Structure audit: `node scripts/structure-audit.mjs` gave
  `structure-audit: passed (287 warning(s), 508 baselined)`, exit 0. The one remaining
  "can be lowered" entry is the `service.ts` file-lines entry I left alone on purpose.
- Public surface: `node scripts/docs-reference.mjs` generated the reference at HEAD and
  again with the fix. `diff` of the two was empty (`REFERENCE IDENTICAL`).
- Native ESM check of the pre-fix `dist`: `node t351-native.mjs <dist runtime>`
  printed `native function function function function`.

## Not verified

- Core's full `pnpm test`, the other packages, and `apps/web`: the brief asks for
  narrow checks only. I also did not rebuild `dist` with the fix, and did not run the
  downstream typecheck against it. The public declarations are unchanged (the
  generated reference diff is empty), so downstream imports should resolve as before.
- `node scripts/docs-reference.mjs --check` fails with
  `docs/reference/framework-reference.md is stale`. It fails the same way at untouched
  HEAD `e0664f17`, so this predates t351. I did not regenerate it, because it is outside
  my brief.
- No Lab, browser or provider runs.

## Open questions or contradictions found

- The cycle guard is only these tests. The structure audit has an `importBoundaries`
  rule for `runtime/llm` to `runtime/recovery`. It has none stopping the flow-bootstrap
  barrel, which `runtime/llm/` imports, from re-exporting a module that value-imports
  `runtime/llm/`. A mechanical rule would need a barrel-specific check, because
  `flow-bootstrap/` already value-imports `llm/` in several places
  (`evidence-loop-steps.ts`, `generation-failure/*`, `unfinished-build/*`). I propose
  it here and did not build it.
- `docs/reference/framework-reference.md` was already stale at `e0664f17`. The sweep's
  Core `pnpm check` does not run `docs:check`, so nothing catches this. It needs an owner.
- The sweep guessed "renamed or moved exports" for the not-a-function errors. The real
  cause was evaluation order in the module cycle; no export was renamed.
