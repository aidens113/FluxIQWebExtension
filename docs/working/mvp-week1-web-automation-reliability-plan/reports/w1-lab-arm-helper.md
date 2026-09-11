# Report: w1-lab-arm-helper

## Outcome

**Done.** One shared `armVariant` in `apps/scenario-lab/e2e/lab-fixture.ts`,
next to `readFinalState`, replaces the arm helper that eight page specs each
defined. The definition-of-done run passes with the same tests as before:
`128 passed`. That is 64 unique titles, and all 128 title lines are identical
to the baseline. A grep finds no arm helper left in any spec.

No other helper is copied verbatim by two or more specs, so nothing else
moved. A mechanical check found zero such copies, both before and after the
change.

## What changed and why

### The shared helper: `apps/scenario-lab/e2e/lab-fixture.ts`

```ts
export async function armVariant(lab: RunningScenarioLab, scenarioId: string, variant: ScenarioVariant | undefined): Promise<void>
```

It sends one POST of `variant.arm.payload ?? {}` to
`${lab.origin}/api/${scenarioId}/${variant.arm.operation}`. The request
carries the run token as a bearer token, with a JSON content type. The helper
then asserts
`expect(response.status, "arming <scenarioId> variant <id>").toBe(200)`.

The file gains one import line, `import type { ScenarioVariant } from "@fluxiq-web-extension/test-contracts";`.
It now exports three values: `test`, `readFinalState`, and `armVariant`.

**Design choices.**

- **It takes the variant, not the bare `arm`.** Five of the eight helpers or
  their callers guarded against a missing variant. That guard now lives in one
  place, and the variant id appears in the failure message.
  - The guard only narrows types: `resolveScenarioWorkflow` already throws on
    an unknown `variantId` (`packages/test-contracts/src/scenario-workflow.ts:24`).
    The helper still throws if it is ever passed `undefined`.
- **It takes an explicit `scenarioId`,** the same shape as
  `readFinalState(lab, scenarioId)`. Each call passes the id its old helper
  hard-coded in the URL. `intermediate-state` passes `manifest.id`, as it did
  before.
- **It asserts `status` is 200.** Seven helpers asserted `response.ok`, and
  `product-catalog` asserted `status` 200.
  - The two are equivalent for this endpoint. `/api/` answers 200 on success,
    and otherwise 401, 405, or 404 (`apps/scenario-lab/src/server.ts:77-83`).
  - `status` keeps `product-catalog`'s exact assertion, and it prints the
    actual code on failure instead of a boolean.

### The eight specs

Each spec changed in three places only: its `./lab-fixture.js` import gained
`armVariant`, its own helper was deleted along with its leading comment, and
its call sites now call the shared helper. No test body's assertions changed.

| Spec | Removed helper | Call site(s) now |
| --- | --- | --- |
| `auth-gate` | `armExpired(lab)` | `armVariant(lab, "auth-gate", expired.variant)`, twice |
| `data-table` | `arm(lab, { operation, payload })` | `armVariant(lab, "data-table", workflow.variant)` |
| `identity-drift` | `arm(lab, { operation, payload })` | `armVariant(lab, "identity-drift", variant)` |
| `infinite-feed` | `arm(lab, variant)` | `armVariant(lab, "infinite-feed", workflow.variant)`; the now-unused `type ScenarioVariant` import was dropped |
| `intermediate-state` | `armVariant(lab, arm)` | `armVariant(lab, manifest.id, variant)`; see note 2 |
| `modal-flows` | `arm(lab, workflowId, variantId)` | Two lines per call; see note 1 |
| `multi-tab` | `arm(lab, operation, payload)` | `armVariant(lab, "multi-tab", variant)` |
| `product-catalog` | `arm(lab, { operation, payload })` | `if (workflow.variant) await armVariant(lab, "product-catalog", workflow.variant)` |

**Note 1, `modal-flows`.** Its old helper also resolved the workflow and
returned `expected`. Each of its two call sites now reads:

```ts
const { variant, expected } = resolveScenarioWorkflow(manifest, { workflowId: "…", variantId: "…" });
await armVariant(lab, "modal-flows", variant);
```

`expected` keeps its name, so every assertion after it is unchanged.

**Note 2, `intermediate-state`.** The in-test guard now binds `variant`
instead of `arm`: `const variant = unannounced.variant; if (!variant) throw …`.
The error message is the same.

The other three specs had no arm helper, because `file-transfer` and
`keyboard-forms` declare no variants. `file-transfer`, `keyboard-forms`, and
`scenario-pages` are byte-identical to before; `cmp` confirmed it.

### How the edits were applied

I used a scratch script, `apply-arm-helper.mjs`, and did not hand-edit the
nine files.

- It removes each helper's top-level declaration using the TypeScript
  compiler API, from its full start (including the leading comment) to its
  end.
- It makes exact replacements, each with a required occurrence count.
- It rejects CRLF files and checks that no spec still contains `/api/`,
  `runToken`, or `method: "POST"`.
- It validates all nine files before writing any. I ran it as a dry run
  first, then with `--write`.
- The unified diff of all nine files is in `edit.diff` in my scratch
  directory. It shows only import lines, the removed helper blocks, and call
  sites.

### Other copied helpers

**Method.** A scratch script, `find-copies.mjs`, lists every top-level
helper in the 11 specs: function declarations, `const` arrow functions, and
`.extend` fixture properties. It groups those whose whitespace-normalized
text is identical, ignoring the helper's own name. It found 0 groups before
and after the change, so nothing else qualified for the brief's "verbatim"
rule.

**Near-duplicates left in place** (not verbatim; see open question 2):

- **The `consoleErrors` fixture.** `file-transfer` and `intermediate-state`
  differ only in the list they compare against: `[]` versus
  `manifest.expected.allowedConsoleErrors ?? []`.
- **Other error collectors.** `modal-flows` has an auto `pageErrors` fixture
  that also filters `Failed to load resource`. `product-catalog` collects
  page errors inline.
- **Test-id target resolution.** The helpers differ in input shape and error
  text: `targetOf`, `byTarget`, `byTestId`, `testId`, `locate`, `selector`,
  and `css`.
- **Fact checkers** (`expectFacts`, `assertFacts`, `expectFinalState`). They
  differ in which predicates they support, in `.first()`, in the messages
  they print, and in whether they wait. `file-transfer` deliberately reads
  once, without waiting. Merging them would change assertions.

## Commands run and observed results

**Setup.**

- All Playwright runs were from `apps/scenario-lab`, using
  `--reporter=list --output <scratch>`. That keeps the config's HTML reporter
  and `outputDir` out of the shared `test-results/`. Afterwards, `find`
  reported 0 files in `e2e/test-results` or `test-results` newer than my first
  run.
- `<scratch>` is
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\2677150e-fabf-4de7-a29b-ed7919f99ef7\scratchpad\w1-lab-arm-helper`.

**1. Baseline, before any edit.**

- Command: `npx playwright test -c e2e/playwright.config.ts --repeat-each=2 --reporter=list --output <scratch>/pw-before`
- Result: `128 passed (22.0s)`, exit 0.
- Title list: 64 unique titles, taken from the `ok` lines with the
  `:line:col` and the duration stripped.

**2. Type-check, before the edit.** No package script type-checks `e2e/`, so
I used a scratch tsconfig. It extends `apps/scenario-lab/tsconfig.json`,
adds the DOM lib, sets `noEmit`, sets `rootDir` to the package, and includes
`e2e/*.ts` and `src/**/*.ts`.

- Command: `npx tsc -p <scratch>/tsconfig.e2e.json`
- Result: exit 0, with 14 `e2e/` files in the program.

**3. Copy finder, before the edit.** Printed
`Verbatim copies across two or more specs: 0`.

**4. Apply script.**

- Dry run: `dry run: 9 files validated, nothing written`, exit 0.
- `--write`: `wrote 9 files`.

**5. The definition-of-done run, after the edit.**

- Command: `npx playwright test -c e2e/playwright.config.ts --repeat-each=2 --reporter=list --output <scratch>/pw-after`
- Result: `128 passed (23.5s)`, exit 0.
- `diff` of the unique-title lists printed nothing (`unique titles: identical to baseline`).
- `diff` of all 128 title lines printed nothing (`all 128 title lines: identical to baseline`).
- `grep` found 0 lines that are `x`, `✘`, `failed`, or `flaky`.

Per-spec counts, identical before and after:

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

**6. Type-check, after the edit.** Same command: exit 0, with no output.

**7. Copy finder, after the edit.** Printed
`Verbatim copies across two or more specs: 0`.

**8. Arm-helper grep.**

- Command, in `apps/scenario-lab/e2e`: `grep -nE '/api/|runToken|method: "POST"|function arm|const arm|arm[A-Z][A-Za-z]* *=' *.spec.ts`
- Result: no output, exit 1.
- All eight specs with variants import `armVariant` from `./lab-fixture.js`.
  `grep -n "armVariant("` lists ten call sites, all in the table above.
- The only `fetch(` left in any spec is `product-catalog.spec.ts:109`. It is
  a GET that asserts 404 for an unknown product route, not an arm.

**9. Structure audit, real index.**

- Command: `node scripts/structure-audit.mjs`
- Result: `structure-audit: passed (27 warning(s), 19 baselined).`, exit 0.
- It also printed `1 baseline entries can be lowered`. The `--json` field
  `lowerable` names that entry: rule `imports`, key
  `domain/src/client/index.ts`, recorded 2, now 1. It is not mine.
- The real index tracks only 3 of the lab's `e2e/` files, so this run cannot
  see the changed files.

**10. Structure audit, scratch index.** I copied `.git/index` to
`<scratch>/git-index` and ran
`GIT_INDEX_FILE=<scratch>/git-index git add apps/scenario-lab/src apps/scenario-lab/e2e`.
The scratch index then held 127 Scenario Lab files, including all 14 `e2e/`
files.

- Command: `GIT_INDEX_FILE=<scratch>/git-index node scripts/structure-audit.mjs`
- Result: exit 0, `structure-audit: passed (27 warning(s), 19 baselined).`
- No FAIL or WARN line names any `apps/scenario-lab` file.
- `e2e/` still has 14 source files, because I added none.

## Not verified

- **The package `test:e2e` script.** Not run: it rebuilds
  `packages/test-contracts` first, and that package belongs to other workers.
  I ran Playwright directly, as the brief says, against the test-contracts
  `dist` present at the time (built 13:31).
- **`pnpm --filter @fluxiq-web-extension/scenario-lab test`,** the node:test
  units under `src/`. Not run; I changed nothing under `src/`.
- **Repository-wide `pnpm check`, `pnpm test`, and `pnpm build`.** Not run.
- **`armVariant`'s `variant === undefined` branch.** No test reaches it.
  From the current call sites it cannot be reached, because
  `resolveScenarioWorkflow` throws first.

## Open questions or contradictions found

1. **Lowerable baseline entry.** `imports` / `domain/src/client/index.ts`
   (recorded 2, now 1) can be lowered. This is for the supervisor's
   `pnpm structure:baseline` after a clean audit; it comes from another
   worker's change.
2. **The near-duplicate `consoleErrors` fixture.** It appears in
   `file-transfer` and `intermediate-state` and would fit in `lab-fixture.ts`
   as a `consoleErrors` fixture with an `allowedConsoleErrors` option,
   defaulting to `[]`. It is not a verbatim copy, so it is outside this brief.
   Your call.
3. **`ok` changed to `status` 200 in seven specs.** This is equivalent on
   this server (see above). If you prefer `ok`, change the one line in
   `armVariant`; `product-catalog` would then lose its exact-200 check.
4. **Untracked files.** The ten fixture specs and `lab-fixture.ts` are
   untracked, so git shows no diff for my changes to them. The evidence is
   `<scratch>/edit.diff`, and the baseline copies are in
   `<scratch>/specs-before/`. The commit must add these files.
5. **Side effects of the scratch audit.** `git add` into the scratch index
   wrote unreferenced blob objects into `.git/objects`. They are harmless, and
   `git gc` prunes them. The real index, HEAD, and refs were not touched.
6. **A resolved finding from w1-lab-consolidation.** It reported a
   scratch-audit violation at `apps/scenario-lab/src/tests/registry.test.ts:5`.
   My scratch audit no longer reports it; that file shows as modified in the
   working tree, presumably by your fix.
