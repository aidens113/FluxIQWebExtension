# Report: w1-lab-consolidation

## Outcome

**Partial.** All three items in the brief are done and verified, but one
definition-of-done check fails, and the fix is outside my ownership.

- **Item 1, barrels.** All 22 scenario directories now have an `index.ts`
  barrel (21 are new; `modal-flows` already had one). `registry.ts` imports
  every scenario through its barrel.
- **Item 2, shared e2e fixture.** One shared module, `e2e/lab-fixture.ts`,
  replaces the lab fixture, network-guard fixture, and final-state helper
  that all eleven page specs copied. The same tests run and pass: 64 unique
  tests before and after, and 128 of 128 with `--repeat-each=2`.
- **Item 3, `testing-facility.md`.** The page now reflects 22 fixtures.

**What fails.** The structure audit on a scratch index that includes the
new files reports one violation:
`apps/scenario-lab/src/tests/registry.test.ts:5` imports
`../scenarios/basic-form/scenario.js`. The new `basic-form` barrel makes
that an import that reaches past a barrel.

**The fix.** Change that line's specifier to
`../scenarios/basic-form/index.js`. `src/tests/` is not in my Owns list, so
I did not edit it. The supervisor should apply this one-line change.

## What changed and why

### 1. Scenario barrels and the registry

New files are named `apps/scenario-lab/src/scenarios/<id>/index.ts`. Each
exports the scenario definition. Where the directory already publishes a
state type, the barrel exports that too, following `modal-flows/index.ts`.
Some barrels also export what the page specs need from the directory, so
that no spec has to reach past a barrel.

| Directory | Exports |
| --- | --- |
| `ambiguous-targets`, `delayed-ui`, `failure-surfaces`, `iframe-checkout`, `long-document`, `reconnect`, `sensitive-input` | The definition only; their `State` types are file-local. |
| `basic-form` | `basicFormScenario`, `type BasicFormState` |
| `dynamic-list` | `dynamicListScenario`, `type DynamicListItem`, `type DynamicListState` |
| `navigation` | `navigationScenario`, `type NavigationState` |
| `llm-target-drift` | `llmTargetDriftScenario`, `type LlmTargetDriftState`, `type TargetDriftMode` |
| `instruction-only-form` | `instructionOnlyFormScenario`, `type InstructionOnlyFormState` |
| `intermediate-state` | `intermediateStateScenario`, `type IntermediateStateState` |
| `auth-gate` | `authGateScenario`, `authGateDemoCredentials` (the spec uses it), `type AuthGateState` |
| `data-table` | `dataTableScenario`, `type DataTableState` |
| `file-transfer` | `fileTransferScenario`, `fileTransferReport` (the spec uses it), `type FileTransferState` |
| `identity-drift` | `identityDriftScenario`, `type IdentityDriftMode` (the spec uses it), `type IdentityDriftState` |
| `infinite-feed` | `infiniteFeedScenario`, `type InfiniteFeedMode`, `type InfiniteFeedState`, `feedItem` (the spec uses it) |
| `keyboard-forms` | `keyboardFormsScenario`, `type KeyboardFormsState` |
| `multi-tab` | `multiTabScenario`, `type MultiTabState` |
| `product-catalog` | `productCatalogScenario`, `type CatalogView` (the spec uses it), `type ProductCatalogState` |

**`apps/scenario-lab/src/registry.ts`.** The 22 import specifiers changed
from `./scenarios/<id>/scenario.js` to `./scenarios/<id>/index.js`. The
import order, the map entries, and the four exported functions are
unchanged.

**Other importers of scenario internals.** I searched `apps/` and
`packages/`, excluding each scenario's own directory and `tests/`. The
matches were:

- `registry.ts`: fixed.
- Ten fixture page specs: fixed, and they now import through the barrels.
- `src/tests/registry.test.ts:5`: not owned, so left as it is.

The `packages/test-matrix` matches are path strings, not imports.

### 2. Shared e2e fixture module

**The new file, `apps/scenario-lab/e2e/lab-fixture.ts`.** It sits beside
`network-policy.ts`. It is not a test file, so the test-placement rule does
not apply to it.

It exports two values (the limit is 15, the advisory threshold 8):

- **`test`**: `base.extend` with three fixtures.
  - `labSeed`: an option fixture, `[42, { option: true }]`.
  - `lab`: `startScenarioLab` with a random run token on `labSeed`, closed in
    `finally`.
  - `networkGuard`: `installDeterministicNetworkGuard`, which asserts clean
    at teardown.
- **`readFinalState<TState>(lab, scenarioId)`**: the shared
  `/__control/final-state` fetch. It keeps the `expect(response.ok).toBe(true)`
  assertion.

**Why the helper is named `readFinalState`.** Four specs already have a
local helper named `finalState`.

**How each spec changed.** Every change is in its header or its helper
binding; test bodies were not touched.

- **Imports.** `test` (and `readFinalState`) now come from
  `./lab-fixture.js`, and scenario imports come from the barrels. The
  unused `randomBytes`, `startScenarioLab`, and network-guard imports are
  removed. `RunningScenarioLab` is now a type-only import.
- **Seeds.** Every spec keeps its previous seed.
  - `file-transfer` sets `test.use({ labSeed: fileTransferScenario.seed })`,
    which is 119.
  - `intermediate-state` sets `manifest.seed`.
  - `multi-tab` sets `multiTabScenario.seed`.
  - `infinite-feed` sets `SEED`. Its expected records derive from `SEED`.
  - `product-catalog` sets an explicit 42 and keeps its "not the manifest
    seed 114" comment.
  - The other five specs use the default, 42.
- **Spec-specific fixtures.** Each is kept by extending the shared object:
  `const test = labTest.extend<...>({ ... })`.
  - `file-transfer`: `consoleErrors`.
  - `intermediate-state`: `consoleErrors`, still compared against
    `manifest.expected.allowedConsoleErrors`.
  - `modal-flows`: `pageErrors`, still `auto: true`.
- **Per-spec final-state helpers.** Each becomes a one-line typed binding
  with the same name and the same scenario id. For example:
  `const tableState = (lab: RunningScenarioLab) => readFinalState<DataTableState>(lab, "data-table");`.
  Because the names are unchanged, no call site changed.
  - `product-catalog`'s helper is declared below the tests that use it. A
    `const` is safe there because it is only called when a test runs.
- **`scenario-pages.spec.ts`.** Its generic `state<T>(lab, scenario)` was
  already the shared shape. Its ten call sites now read `readFinalState(...)`.

**A slip caught by a check.** My first `modal-flows` edit stopped short of
its `finalState` helper. The copy grep caught it at line 24. I replaced it
with the binding and re-ran the type-check and the grep.

### 3. `docs/architecture/testing-facility.md`

- **Fixture section.**
  - "The eleven deterministic fixtures are:" is replaced by "The Scenario
    Lab registers 22 deterministic fixtures". A sentence says each lives
    behind an `index.ts` barrel that the registry and the page specs import.
  - The fixtures are split into two tables:
    - **Twelve foundational fixtures.** This adds `instruction-only-form`,
      which was registered but missing from the old table.
    - **Ten FluxBench Week 1 fixtures.** Each row has a one-line purpose and
      its corpus rows, workflows, and variants, including every expected
      failure category. The purposes and rows come from the fixture reports'
      Outcome and workflow tables. I spot-checked these facts in source: the
      feed lengths (60 baseline, 25 `end-early`, `infinite-feed/scenario.ts:19`),
      the 10-post page size (`feed-content.ts:2`), `confirm(` in `modal-flows`,
      and `window.open` in `multi-tab`.
- **Tests paragraph.**
  - It now mentions each corpus fixture's `tests/scenario.test.ts` and
    `<id>.spec.ts`.
  - It notes that `scenario-pages.spec.ts` covers 11 of the 12
    foundational fixtures, all but `instruction-only-form`.
  - It describes `e2e/lab-fixture.ts`: `lab`, `labSeed`, `networkGuard`, and
    `readFinalState`.
- **Line 706.** "the ten-scenario registry" now reads "the 22-fixture
  Scenario Lab registry".
- **Beyond the literal brief.** The "A manifest contains" bullets beside
  the table were stale, so I updated them.
  - The step operations now list all 14, copied from `scenarioStepOperations`
    (`packages/test-contracts/src/scenario.ts:26-41`).
  - I dropped "nonempty", because the registered `instruction-only-form`
    has `recordingScript: []`.
  - I added one bullet each for extracted records and the expected failure
    category, and for `workflows`, `variants`, and `resolveScenarioWorkflow`.
  - The supervisor may revert these bullets if they belong to another task.

## Commands run and observed results

All Playwright runs were from `apps/scenario-lab` with
`npx playwright test -c e2e/playwright.config.ts --reporter=list --output <scratch dir>`.
`--reporter=list` keeps the config's HTML reporter out of the shared
`test-results/`.

**1. Baseline before any change** (output `…/scratchpad/w1-lab-consolidation/pw-baseline`):
`64 passed (11.1s)`, exit 0. Per spec:

| Spec | Tests |
| --- | --- |
| `auth-gate` | 6 |
| `data-table` | 3 |
| `file-transfer` | 4 |
| `identity-drift` | 7 |
| `infinite-feed` | 4 |
| `intermediate-state` | 2 |
| `keyboard-forms` | 7 |
| `modal-flows` | 7 |
| `multi-tab` | 4 |
| `product-catalog` | 9 |
| `scenario-pages` | 11 |

**2. Type-check of `e2e/*.ts` and `src/**/*.ts`.** No package script
type-checks `e2e/`, so I used a scratch tsconfig that extends the lab's,
adds the DOM lib, and sets `noEmit`
(`npx tsc -p …/tsconfig.e2e.json`).

| Run | Result |
| --- | --- |
| Before the change | exit 0, no output |
| After the change | exit 0 |
| After the `modal-flows` fix | exit 0 |

**3. `pnpm --filter @fluxiq-web-extension/scenario-lab test`** (`tsc` build,
then `node --test dist/**/*.test.js`): exit 0, with
`# tests 118`, `# pass 118`, `# fail 0`.

**4. The definition-of-done Playwright run.**
`npx playwright test -c e2e/playwright.config.ts --repeat-each=2 --reporter=list --output …/pw-after`
gave `128 passed (28.4s)`, exit 0. Per spec:

| Spec | Tests |
| --- | --- |
| `auth-gate` | 12 |
| `data-table` | 6 |
| `file-transfer` | 8 |
| `identity-drift` | 14 |
| `infinite-feed` | 8 |
| `intermediate-state` | 4 |
| `keyboard-forms` | 14 |
| `modal-flows` | 14 |
| `multi-tab` | 8 |
| `product-catalog` | 18 |
| `scenario-pages` | 22 |

Every count is exactly double the baseline. No line matched failed, flaky,
or ✘.

**5. Same tests before and after.** I took each run's `ok` lines, stripped
the `:line:col` and duration, and sorted them uniquely. Both lists have 64
entries, and `diff` printed nothing: `identical test sets`.

**6. Copy grep.** Command:

```text
grep -nE "startScenarioLab|base\.extend|lab: async|randomBytes|installDeterministicNetworkGuard|__control/final-state" apps/scenario-lab/e2e/*.spec.ts
```

It printed nothing. Separately, 11 of 11 spec files import from
`./lab-fixture.js`. No spec file defines its own lab fixture or final-state
helper any more.

**7. Barrel grep.**

- `grep -nE "scenarios/[a-z-]+/[a-z-]+\.js" apps/scenario-lab/e2e/*.ts apps/scenario-lab/src/registry.ts | grep -v "/index\.js"`
  printed nothing.
- The repo-wide search for importers of scenario internals printed only
  `apps/scenario-lab/src/tests/registry.test.ts:5:import { basicFormScenario } from "../scenarios/basic-form/scenario.js";`.
- `ls apps/scenario-lab/src/scenarios/*/index.ts | wc -l` printed `22`.

**8. Structure audit, real index** (`node scripts/structure-audit.mjs`):
exit 0, `structure-audit: passed (27 warning(s), 19 baselined)`. It also
printed `1 baseline entries can be lowered`. From `--json`, that entry is
`imports` / `domain/src/client/index.ts`, recorded 2 and now 1. It is not
mine; it is for the supervisor's `pnpm structure:baseline` after a clean
audit. The real index holds only 29 Scenario Lab files and none of the new
ones, so this run cannot see my files.

**9. Structure audit, scratch index.** I copied the real index to the
scratchpad, staged `apps/scenario-lab/src` and `apps/scenario-lab/e2e` into
the copy, and ran the audit against it:

```text
cp "$(git rev-parse --git-path index)" <scratch>/git-index
GIT_INDEX_FILE=<scratch>/git-index git add apps/scenario-lab/src apps/scenario-lab/e2e
GIT_INDEX_FILE=<scratch>/git-index node scripts/structure-audit.mjs
```

The scratch index holds 127 Scenario Lab files: the barrels, the shared
module, every spec, and every fixture file. The audit exited 1 with
exactly one violation:

```text
FAIL  [imports] apps/scenario-lab/src/tests/registry.test.ts: 1 import(s) reach into another directory's files instead of its barrel, e.g. "../scenarios/basic-form/scenario.js" at line 5. Import from the directory (its index) instead.
```

- There were no findings in any barrel, in `lab-fixture.ts`, in the specs,
  in `registry.ts`, or in any fixture file.
- No directory-files warning appeared for `apps/scenario-lab/e2e/`, which
  now has 14 source files against an advisory threshold of 15.

**10. `git diff --stat`** of the three tracked files I changed:

| File | Change |
| --- | --- |
| `scenario-pages.spec.ts` | 44 lines (header removed, 10 call sites renamed) |
| `registry.ts` | 44 lines (22 specifiers) |
| `testing-facility.md` | 58 lines |

The ten fixture specs are untracked, so they have no git diff. Checks 4 to 6
are the evidence that their assertions were kept.

## Not verified

- **Whether the `registry.test.ts:5` change clears the scratch audit.** The
  audit reads file contents from the working tree, so I could not simulate
  the change without editing a file I don't own. By the imports rule
  (`scripts/structure-audit/rules/imports.mjs:127`), a specifier whose
  basename is `index` is exempt.
- **Repo-wide `pnpm check`, `pnpm test`, and `pnpm build`.** Not run; they
  are outside this brief's scope.
- **The package `test:e2e` script.** Not run; it rebuilds test-contracts
  first. I ran `npx playwright` directly, as the brief says, against the
  test-contracts `dist` present at the time.
- **Doc facts about fixture internals.** The purposes in the corpus-fixture
  table come from the fixture reports and the Wave 1 briefs. I re-checked
  in source only the facts listed in section 3.
- **Other documents with fixture counts.** I searched only
  `apps/scenario-lab/README.md` (no count found; line 48 mentions the
  registry without a number) and `testing-facility.md`.

## Open questions or contradictions found

1. **`registry.test.ts:5`, for the supervisor.** Change the specifier to
   `../scenarios/basic-form/index.js` (`basicFormScenario` is the barrel's
   export). This clears the only scratch-audit violation. The file is under
   `apps/scenario-lab/src/tests/`, which the brief neither gives me nor
   forbids.
2. **Lowerable baseline entry.** `domain/src/client/index.ts` (imports,
   recorded 2, now 1) can be lowered. This comes from another worker's
   change.
3. **The `arm` helper is still duplicated.** It POSTs to
   `/api/<id>/<operation>` with the bearer token and expects `ok`. It is
   copied in all ten fixture specs, with differing signatures: a variant, an
   `{ operation, payload }` object, `(operation, payload)`, and
   `(workflowId, variantId)` returning the expectations. The brief scoped
   the shared module to the lab, the network guard, and the final-state
   helper, so I left it. A shared
   `armScenario(lab, scenarioId, { operation, payload })` in
   `lab-fixture.ts` would be the next consolidation.
4. **The manifest bullets I updated.** These are outside the literal brief;
   see section 3. Keep or revert.
5. **The extension's content-script harness is not documented here.**
   `apps/extension/e2e/content/`, from w1-content-harness, starts the
   Scenario Lab in-process. `testing-facility.md` does not describe it. I
   only changed the count in the extension E2E paragraph and did not
   document the harness, which is outside my brief.
6. **Side effects of the scratch audit.**
   - `git add` against the scratch index wrote unreferenced blob objects
     into `.git/objects`. They are harmless, and `git gc` will prune them.
     It did not touch the real index, HEAD, or any ref.
   - Git printed LF-to-CRLF warnings for the staged files; this is the
     repository's existing autocrlf behaviour.
   - I first wrote one audit log to `/tmp`. I deleted it; everything else
     is in my scratchpad directory.
