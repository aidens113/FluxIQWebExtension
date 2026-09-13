# Report: g-small-fixes (C1, A3, A4, LR9, C3)

Worker: `g-small-fixes`. Brief: `briefs/finish-week1.md` "g-small-fixes". Rows
from `reports/c-remaining.md`. Tree at `HEAD b43a46a` with other workers' edits
in flight. No file outside the brief's Owns list was edited, and nothing was
left in the tracked tree. No `pnpm build` and no `pnpm lab` were run.

## Outcome

**Done.** All five rows were still Open when I re-checked them at HEAD, and all
five are now closed:
- **C1:** the false paragraph in `validation-outcome.ts` is rewritten, and so
  is the matching comment in its test. A type probe settled what the compiler
  now catches.
- **A3:** the domain runner reports every entry that throws while it loads,
  continues, and exits 1. A scratch before/after proof shows it.
- **A4:** `workers: 4` is pinned. The bare `--list` lists all 22 specs, and a
  bare run printed "using 4 workers" on a 12-CPU machine.
- **LR9:** both assertions now use `scenarioPageFactSchedule(...)`. A mutation
  that puts page-fact inheritance back makes each of them fail.
- **C3:** one paragraph on `expected.actions` is in `testing-facility.md`.

Every result below is a single observation on a machine with faulty RAM. No
run needed a retry.

## What changed and why

### C1: `apps/extension/src/content/action-runtime/validation-outcome.ts`, and its test (comments only)

**What was false.** The paragraph said deletion, not the type system, keeps the
failure builders gone. Its reason was that `BrowserActionResult["failure"]` is
Core's `AutomationStudioFailureRecord`, whose `code` is a bare `string`. That
stopped being true in two steps:
- `apps/extension/src/shared/protocol.ts:402` makes `BrowserActionResult` the
  domain's `WebAutomationActionResult`.
- `domain/src/actions/types.ts:359` types its `failure` as
  `WebAutomationFailureRecord`, and `domain/src/runtime/failure/codes.ts:89`
  gives that record the closed `WebAutomationFailureCode`.

**What I measured.** A scratch probe compiled with the extension's tsconfig
tried three literals typed as `NonNullable<BrowserActionResult["failure"]>`:
- A code outside the set (`"web.assert.state_mismatch"`): **`TS2322`**.
- A real code (`web.validation.state_mismatch`) with another row's category,
  flag and stage (`auth_required`, `true`, `dispatch`): **compiles**.
- The honest row: compiles.

**The rewrite.** The paragraph now says the type enforces the closed set. It
does not enforce each code's row, meaning the category, retryable flag and
stage the table binds to it. Only `webAutomationFailureRecord` reads those from
the table. So the builders' absence is defence in depth for the set, and still
the guard for the binding.

**The test comment.** The comment at `tests/validation-outcome.test.ts:39-54`
made the same false claim ("compiles at exit 0 today … when that lands, this
row can go"). It now says:
- the narrowing has landed;
- the out-of-set literal is `TS2322`;
- the mismatched literal still compiles, which is why the surface-pinning row
  stays.

No test code changed.

### A3: `domain/scripts/test-domain.mjs`

Each `await import(bundle)` is now inside `try`/`catch`. A failure does four
things:
- records the entry's path relative to the package;
- sets `process.exitCode = 1`;
- prints `Domain test entry failed to load: <path>` and the error;
- moves on to the next entry.

After the loop, the runner prints `N of M domain test entries failed to load:`
with the list. A failing `test()` still sets the exit code through node:test.

### A4: `apps/extension/e2e/playwright.content.config.ts`

I added `workers: 4`, and the header comment now says why. Four is the count
Current State's operating rules run the harness at. A `--workers` flag still
overrides it, so pass `--workers=2` when the machine is under load.

### LR9: the two scenario tests, and the doc comment in `packages/test-contracts/src/scenario-workflow.ts`

**`intermediate-state/tests/scenario.test.ts`.** The inheritance assertion is
replaced by two schedule assertions for variant `unannounced`:
- `arms-after-loading` gives
  `{ atLoad: manifest.expected.pageFacts, afterArm: [] }`;
- `arms-before-loading` gives `{ atLoad: [], afterArm: [] }`.

The expected facts come from the authored manifest, not from the merge. The
`recordingEvents` inheritance assertion and its comment stay, because that
inheritance is real.

**`multi-tab/tests/scenario.test.ts`.** The same two assertions, for
`popup-blocked` against `scenario.manifest.expected.pageFacts`.

**The doc comment.** The parenthetical no longer names the two unit tests. It
now reads: "one fixture assertion still reads it for a variant
(`product-catalog.spec.ts`)". I checked this before writing it:
- Grepping `expected.pageFacts` across `apps/scenario-lab` found
  `product-catalog.spec.ts:62,65` as the only place that reads the merged
  facts of a *variant-resolved* workflow.
- The other readers resolve a workflow with no variant, where the merge equals
  the authored field. These are `storefront-checkout.spec.ts:81`,
  `multi-tab.spec.ts:73`, `file-transfer.spec.ts:64,76`,
  `intermediate-state.spec.ts:40`, `auth-gate.spec.ts:68`,
  `negative-variants.spec.ts:272`, and the unit tests
  `storefront-checkout/tests/scenario.test.ts:117` and
  `keyboard-forms/tests/scenario.test.ts:40`.
- A few readers read authored fields directly.

The old "three" was therefore an undercount of readers, not an overcount.

### C3: `docs/architecture/testing-facility.md`, "Scenario lab and contract" only

One paragraph after the manifest list. It says:
- `expected.actions` entries are an action type plus an optional `outcome`.
- The lanes that run a Flow pass an entry when *at least one* attempt of that
  type finished with that outcome. Order and extra attempts are not checked.
  That covers `assertFlowActions` in `flow-lane/expectations.ts:7-10`, and
  `executeExistingPersistedFlow` in `existing-flow-run.ts:107-108`, which both
  the existing lane (`run-scenario.ts:203-209`) and the clone lane (`:229-235`)
  call.
- An omitted outcome means `succeeded`.
- The outcomes are `succeeded` and `failed` (`expectedActionOutcomes`,
  `scenario.ts:82`). There is no `rejected`, and manifest validation refuses it
  (`validation.ts:143`).
- A client refusal is `failed`, with `expected.failure` set to category
  `blocked_by_capability_or_policy` and code `web.action.rejected`.

## Commands run and observed results

### Re-verification at HEAD

All five rows were read as Open before editing:
- `validation-outcome.ts:22-30` still had the Core bare-string claim.
- `test-domain.mjs:54-57` still had the bare loop.
- The config had no `workers`.
- `scenario-workflow.ts:13-18` still named the two tests.
- `intermediate-state` `:32` and `multi-tab` `:78` still asserted inheritance.
- `testing-facility.md` had no mention of `expected.actions`.

### C1 probe

- **Command:** `node apps/extension/node_modules/typescript/lib/tsc.js -p <scratchpad>/g-small-fixes/c1/tsconfig.node.json`.
- **Config:** extends `apps/extension/tsconfig.json`, with `outDir`/`rootDir`
  reset and `types: ["node"]`.
- **Result:** exit 2, one error:
  `probe.ts(6,66): error TS2322: Type '"web.assert.state_mismatch"' is not assignable to type 'WebAutomationFailureCode'.`
- **Other lines:** no error on probe lines 9 (mismatched row) or 12 (honest
  row).
- **Earlier attempts:**
  - The first attempt failed with `TS5009` because the inherited `outDir`
    spanned the C: and F: drives.
  - The second ran with `types: []`. It reported the same `TS2322` plus
    `node:crypto`/`Buffer`/`process` errors from domain files. Those came from
    my own `types: []`, not from the code.

### A3 proof

The proof ran entirely in the scratchpad (`<scratchpad>/g-small-fixes/a3/`),
using two copies of the runner:
- `before/` holds `git show HEAD:domain/scripts/test-domain.mjs`.
- `after/` holds a copy of the edited file. `cmp` against the working tree
  printed "byte-identical".
- Each root had the same four scratch entries:
  - `a` passes;
  - `b` registers a test, then throws `Error("scratch entry b throws on import")`;
  - `c` passes;
  - `d` runs `JSON.parse("{ …")` at top level.
- `node_modules` was a junction to `domain/node_modules`, removed afterwards.
  `domain/node_modules/esbuild` was still present after removal.
- Both roots ran with `DOMAIN_TEST_BUILD_LABEL=g-small-fixes node <root>/scripts/test-domain.mjs`.

**Before (HEAD): exit 1.**
- Only `a` and `b`'s test ran ("# tests 2").
- `c` and `d` never ran.
- The only message was
  `# Error: A resource generated asynchronous activity after the test ended. This activity created the error "Error: scratch entry b throws on import" which triggered an uncaughtException event, caught by the test runner.`
  It names no file.

**After: exit 1.**
- It printed
  `Domain test entry failed to load: src/b/tests/b-throws-on-import.test.ts`
  with the stack.
- Then it ran `c`, and printed
  `Domain test entry failed to load: src/d/tests/d-throws-on-import.test.ts`
  with `SyntaxError: Expected property name or '}' in JSON at position 2`.
- Then
  `2 of 4 domain test entries failed to load:\n  src/b/tests/b-throws-on-import.test.ts\n  src/d/tests/d-throws-on-import.test.ts`.
- node:test summary: "# tests 3 # pass 3 # fail 0". The exit 1 came from the
  load failures alone.

### LR9 mutation proof

The proof ran without touching the tracked tree or the shared `dist`:
- `packages/test-contracts/dist` was copied to `<scratchpad>/g-small-fixes/lr9/dist-copy`.
- The real compiled tests ran under a Node resolve hook
  (`node --import <scratchpad>/lr9/register.mjs <test>.js`). The hook sends
  `@fluxiq-web-extension/test-contracts` to the copy. Every run printed
  `[lr9] test-contracts redirected to …/dist-copy`.

**Control, unmutated copy:**
- `intermediate-state/tests/scenario.test.js`: exit 0, 9/9.
- `multi-tab/tests/scenario.test.js`: exit 0, 7/7.

**Mutation.** In the copy's `scenario-workflow.js:14`,
`const armedFacts = variant?.expected.pageFacts ?? [];` became
`?? workflowFacts;`. That makes a variant inherit the workflow's page facts
again.
- **intermediate-state:** exit 1, "# pass 8 # fail 1". The failing test is
  `not ok 1 - the manifest is valid, loopback-only, and resolves its primary workflow and unannounced variant`.
  The diff is `+ afterArm: [ { id: 'claim-form-visible', predicate: 'visible', subject: 'claim-form', value: true } ]`
  against `- afterArm: []`.
- **multi-tab:** exit 1, "# pass 6 # fail 1". The failing test is
  `not ok 2 - popup-blocked is armed by block-popups and expects output_not_observed with no extraction`.
  The diff is `+ afterArm: [ { id: 'order-list-visible', … } ]` against
  `- afterArm: []`.
- **Tracked dist afterwards:** `grep` of
  `packages/test-contracts/dist/scenario-workflow.js:14` still prints
  `?? [];`. No tracked file was mutated, so no restore was needed.

The old assertions could not have caught this mutation. They compared
`resolveScenarioWorkflow` merges, and the mutation does not touch that
function.

### Package gates

Run one at a time:

| Package | Command | Result |
| --- | --- | --- |
| test-contracts | `pnpm check` | exit 0 |
| test-contracts | `pnpm test` | exit 0, 59/59 |
| domain | `pnpm check` | exit 0 |
| domain | `DOMAIN_TEST_BUILD_LABEL=g-small-fixes pnpm test` | exit 0, 349/349, no "failed to load" line |
| scenario-lab | `pnpm check` | exit 0 |
| scenario-lab | `pnpm test` | exit 0, 197/197 |
| extension | `EXTENSION_TEST_BUILD_LABEL=g-small-fixes pnpm check` | exit 0 |
| extension | `EXTENSION_TEST_BUILD_LABEL=g-small-fixes pnpm test` | exit 0, 315/315 |

The domain test ran through the edited runner.

### Content harness (A4), from `apps/extension`

- **List:** `pnpm exec playwright test -c e2e/playwright.content.config.ts --list`
  exited 0 and printed "Total: 202 tests in 22 files". The listing names 22
  distinct `*.spec.ts` files, and `ls e2e/content/tests/*.spec.ts | wc -l` also
  gives 22.
- **One spec:**
  `EXTENSION_TEST_BUILD_LABEL=g-small-fixes pnpm exec playwright test -c e2e/playwright.content.config.ts identity-ambiguity.spec.ts`
  (no `--workers`) exited 0. It printed "Running 5 tests using 4 workers" and
  "5 passed (3.1s)".
- **Why that proves the pin:** `os.availableParallelism()` is 12, so
  Playwright's default of half the cores would have been 6.

### Structure and tree

- `node scripts/structure-audit.mjs`: exit 0, "structure-audit: passed (34
  warning(s), 17 baselined)". None of my files is mentioned.
  `.structure-baseline.json` has no entry for any of them; no baseline entry
  should change.
- `git diff --stat` on my eight files: 67 insertions, 30 deletions.
- `git status --short -- domain/.test-build`: 0 lines. The labelled run wrote
  only the ignored `domain/.test-build-scratch/g-small-fixes`
  (`.gitignore:24`).

## Not verified

- **Lab.** No Lab run applies to these rows:
  - C1 changes comments only, and C3 changes documentation only.
  - LR9 changes unit tests and a comment.
  - A3 and A4 change developer test tooling, which the Lab never invokes.

  The supervisor's live campaign needs nothing new from them. If it wants a
  sanity line, a Lab `intermediate-state --variant unannounced --flow` run
  should still check `claim-form-visible` at load and nothing after arming.
  That is already the behaviour of `run-scenario.ts:63`, which this work did
  not change.
- **Full content harness.** Not run: only `--list` and one spec
  (`identity-ambiguity.spec.ts`, 5 tests) with the bare command. The other 197
  tests did not run under `workers: 4` in this session.
- **Root gates.** Root `pnpm check` was not run as a whole; its
  `structure:test` and `lab:test` steps were skipped. The root `pnpm test` and
  test-runner's `check` and `test` were not run either. My only change on
  test-runner's dependency path is a comment in `scenario-workflow.ts`; the
  emitted `dist` changed in comments only, since the mutation proof's control
  used a copy of it and passed.
- **A3, other failure paths.** Not exercised:
  - an esbuild *build* failure, which still aborts before any entry runs;
  - an asynchronous rejection after an entry's import resolves.
- **C1 at runtime.** The probe proves what the compiler catches. Whether Core's
  parser drops a record whose category, flag or stage contradicts its code was
  not measured.

## Open questions or contradictions found

1. **Another stale sentence in C1's file, not rewritten.** The earlier
   paragraph at `validation-outcome.ts:17-20` says "a contradiction is dropped
   whole by Core's parser". The code table's comment (`codes.ts:109-111`) says
   Core forbids six categories from being retryable. So Core drops only the
   contradictions it can see, not a code paired with another row's category.
   The brief named only the one paragraph (lines 22-30), so I did not rewrite
   it. It is worth a one-line check.
2. **A3's HEAD failure mode was not an exit-0 hide.** At HEAD, node:test caught
   the rejection as an `uncaughtException` and still exited 1. The defect was
   that every later entry was silently skipped and the message named no file.
   The row's "aborts on the first throw" is right; any note implying a green
   exit is not.
3. **A4's other trap is still open.** `apps/extension/package.json:10`
   (`test:content`, where `--` forwarding finds no tests) is not in my Owns.
   The bare `pnpm exec` command is now correct, but the `pnpm --filter …
   test:content --` form is still a trap. If the supervisor wants it fixed, the
   brief should have included `apps/extension/package.json`.
4. **`testing-facility.md` grammar, left untouched.** The manifest list has
   "; and" on two consecutive bullets (the `variants` bullet and the `secrets`
   bullet). This is outside C3's paragraph.
