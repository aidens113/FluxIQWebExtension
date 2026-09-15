# x1-test-contracts: step X1.5 test-contracts changes

## Outcome

**Partial.** Everything in step X1.5 that the brief assigns is done:
- the pagination `mode` union;
- `ScenarioStep.minItems`;
- `ExpectedExtraction` `pages`, `optionalFields` and `truncated`, plus nullable record values;
- the matching JSON Schema;
- the validator rules, including the D4 rule;
- `minItems: 0` on product-catalog's `extract-search-results` step.

The test-contracts suite passes, both named mutations failed their own rows and were reverted, and the structure audit passes.

One named check does not pass as a command. The scenario-lab package's `test` script stops at its `tsc` step with exit code 2. The cause is `apps/scenario-lab/src/scenarios/auth-gate/tests/scenario.test.ts:199`, a file outside this brief, which cannot take the new `string | null` record values. When its tests are run from the build output that `tsc` still emitted, all 205 pass.

`packages/test-runner` also no longer type-checks until step X1.5's planned follow-ups land (see Open questions).

`recordable-actions.ts`, `evaluation.ts` and `bench-report.ts` were held unchanged, as D14 requires.

## What changed and why

### `packages/test-contracts/src/scenario.ts`

- **Pagination modes.** A new exported constant, `scenarioExtractPaginationModes = ["next", "loadMore", "scroll", "numbered"]`, with the type `ScenarioExtractPaginationMode`. The JSON Schema test uses it to check that the schema lists every mode.
- **`ScenarioExtractPagination`** is now the D14 union, using the domain's member shapes from report X1.1:
  - `{ mode?: "next"; next; maxPages }`
  - `{ mode: "loadMore"; control; maxPages }`
  - `{ mode: "scroll"; maxScrolls }`
  - `{ mode: "numbered"; pages; maxPages }`
- **`ScenarioStep`** gains `minItems?: number`. Its doc comment says `minItems` belongs to extract only and is 1 when absent (D4).
- **`ExpectedExtraction`** gains `pages?`, `optionalFields?` and `truncated?`. Record values become `string | null`. The doc comment states the D4 requirement.
- **JSON Schema:**
  - `$defs.step.properties.pagination` is now `$ref: "#/$defs/pagination"`.
  - The new `$defs.pagination` is a `oneOf` with one member per mode, in the same order as the constant. Every member has `additionalProperties: false`, and only `next` omits `mode` from `required`.
  - `$defs.step.properties.minItems` is `{ type: "integer", minimum: 0 }`.
  - `$defs.extraction` gains:
    - `pages: { integer, minimum 1 }`
    - `optionalFields: { unique non-empty strings }`
    - `truncated: { boolean }`
    - record values of type `["string", "null"]`
  - A shared constant `pageBound` holds the page limit (1 to `SCENARIO_EXTRACT_MAX_PAGES`), and every mode's count uses it.
- **Doc wording.** The comments on the step operations and on `SCENARIO_EXTRACT_MAX_PAGES` were reworded for the new modes.
- **Exported values.** The file now has 7, under the advisory limit of 8.

### `packages/test-contracts/src/validation.ts`

- **Pagination keys by mode.** `PAGINATION_KEYS` is keyed by every mode, so a new mode fails to compile until it has a row. It gives each mode's control selector key and its bounded count key.
- **`validatePagination`:**
  - `mode` defaults to `next` when absent.
  - An unknown mode is reported at `pagination.mode`.
  - A key the mode does not take is reported as an "unknown property".
  - A missing selector is reported as "must be a non-empty string".
  - The count must be an integer from 1 to 50.
- **Extract-only keys.** A new list, `EXTRACT_ONLY = ["fields", "pagination", "minItems"]`, drives both the step key allowlist and the "is allowed only for extract" check. `validateExtractShape` checks that `minItems` is a non-negative integer.
- **`validateExtraction`:**
  - accepts the keys `pages`, `optionalFields` and `truncated`;
  - requires `pages` to be a positive integer;
  - requires `optionalFields` to be an array of unique, non-empty strings;
  - requires `truncated` to be a boolean;
  - accepts a record value that is a string or `null`.
- **`checkExtractionReferences`** now looks up the step each expectation names, for the workflow's expectations and for each variant's:
  - The step must be an extract step, as before.
  - `pages` is allowed only when that step has `pagination`. Otherwise the issue is at `...extracted[i].pages`.
  - Every `optionalFields` entry must be a key of that step's `fields`. Otherwise the issue is at `...extracted[i].optionalFields[j]`.
  - **New D4 rule:** an entry with `count: 0` or `records: []` needs the step to declare `minItems: 0`. Otherwise the issue is at `...extracted[i]`, with the message "expects no records, but step X fails on an empty list unless it declares minItems: 0 (D4)".

### `packages/test-contracts/tests/scenario-validation.test.mjs`

- **Fixture.** The `catalogScenario` step `products` gains `minItems: 0`, because its `no-results` variant expects `count: 0`.
- **New rows.** Eight new tests sit next to the malformed-scenario test:
  - every mode is accepted, including `next` when `mode` is absent, and the list covers exactly `scenarioExtractPaginationModes`;
  - an unknown mode, a key belonging to another mode (`next` on loadMore, `control` on next, `maxPages` on scroll), a missing `pages`, and `maxScrolls: 0` are each rejected;
  - `minItems` is allowed only on extract steps, and -1 and 1.5 are rejected;
  - `optionalFields` must be a subset of the step's fields, on both the workflow and variant paths;
  - `pages` is rejected on an unpaginated step and accepted on a paginated one, and `pages: 0` is rejected;
  - D4:
    - `count: 0` and `records: []` without the declaration are rejected on both the workflow and variant paths;
    - an explicit `minItems: 1` is rejected too, and `minItems: 0` is accepted;
    - the primary workflow in W06's shape is rejected without the declaration;
  - null record values and a boolean `truncated` are accepted, and a numeric value and `truncated: "no"` are rejected;
  - the JSON Schema lists the modes in order, only `next` omits `mode`, each schema member filled in completely passes the validator, and the `minItems` and extraction properties are checked.
- **Length.** The file is under the 400-line advisory limit.

### `apps/scenario-lab/src/scenarios/product-catalog/manifest.ts`

- **W06 fix.** The step `extract-search-results` gains `minItems: 0`, with a one-line comment. W06's `no-results` variant expects `count: 0, records: []`, which the new D4 rule would otherwise reject, invalidating the corpus. The primary workflow still expects `count: 4`.

## Commands run and observed results

Every test and audit command ran alone.

1. **Test-contracts suite, first run.** `pnpm --filter @fluxiq-web-extension/test-contracts test` printed `# tests 81`, `# pass 81`, `# fail 0`. Rows 73-80 are the new tests.
2. **Scenario-lab `test` script.** `pnpm --filter @fluxiq-web-extension/scenario-lab test` exited with code 2:
   - `src/scenarios/auth-gate/tests/scenario.test.ts(199,78): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.`
   - `(199,86): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string | Error | undefined'.`
   - `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`

   No other `error TS` lines appeared, and `node --test` did not run. That file has no uncommitted edits in git, so the break comes from this change.
3. **Build output check.** `apps/scenario-lab/dist/scenarios/product-catalog/manifest.js:80` contains `minItems: 0`, so `tsc` emitted fresh output despite the errors.
4. **Scenario-lab tests from the emitted build.** `pnpm --filter @fluxiq-web-extension/scenario-lab exec node --test "dist/**/*.test.js"` printed `# tests 205`, `# pass 205`, `# fail 0`. That includes:
   - `ok 160 - manifest declares W04-W07 as a valid primary workflow, three workflows, and their variants`
   - `ok 189 - every registered fixture exposes a valid versioned WebScenario manifest`
5. **Structure audit, first run.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (54 warning(s), 17 baselined).` with exit 0. One warning was new: `scenario-validation.test.mjs: 403 lines is past the 400-line advisory threshold`. I trimmed the test helper to fix it.
6. **Mutation 1, subset check removed from `checkExtractionReferences`.** `not ok 76 - rejects optionalFields that are not fields of the step they name`: the actual result was `[]` and the expected was `['$.workflows[0].expected.extracted[0].optionalFields[1]']`. The run printed `# tests 81`, `# pass 80`, `# fail 1`. Reverted.
7. **Mutation 2, count-0 `minItems` rule removed.** `not ok 78 - rejects an expectation of no records unless its step declares minItems: 0`: the actual result was `[]` and the expected was both entry paths. The run printed `# tests 81`, `# pass 80`, `# fail 1`. Reverted.
8. **Test-runner type check.** `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json --noEmit` was run read-only, deliberately without `pnpm domain:dist` because other workers are editing the domain. It exited with code 1 and three errors:
   - `src/run-expectations/extraction.ts(20,77): error TS2345: Argument of type 'Record<string, string | null>' is not assignable to parameter of type 'Record<string, string>'.`
   - `src/scenario-steps/extract-records.ts(62,66): error TS2339: Property 'next' does not exist on type 'ScenarioExtractPagination'.`
   - `src/scenario-steps/extract-records.ts(67,58): error TS2339: Property 'maxPages' does not exist on type 'ScenarioExtractPagination'.`
9. **Test-contracts suite, final run after both reverts.** It printed `# tests 81`, `# pass 81`, `# fail 0`, exit 0. A search for `MUTATION` in `packages/test-contracts/{src,tests}` found no matches.
10. **Structure audit, rerun.** It printed `structure-audit: passed (53 warning(s), 17 baselined).` with exit 0. No warning names any of the four changed files. The `packages/test-contracts/src/: 19 source files` advisory was already there, and no file was added.
11. **Git status.** `git status --short` shows the four files above as mine. The modified domain files belong to other workers.

## Not verified

- **Full gates.** `pnpm check`, `pnpm test` and `pnpm build` were not run: they are heavy on this machine's RAM, and domain edits are in flight. They will be red until the auth-gate test and the test-runner follow-ups land.
- **Scenario-lab e2e types.** scenario-lab's `tsconfig.json` includes only `src/**`, so its build never type-checks `e2e/`. The type effect on two e2e files was not checked, and Playwright was not run because the brief forbids a browser:
  - `e2e/product-catalog.spec.ts:155-156` reads `pagination.maxPages` and `pagination.next`;
  - `e2e/data-table.spec.ts:43` uses `ExpectedExtraction`.
- **Test-runner check without a domain build.** The type check above used whatever domain build output already exists, so domain-dependent errors may be missing or stale. Only the three extraction errors appeared.
- **D4 on the real manifest.** The rule was not observed failing on the real product-catalog manifest; I did not remove `minItems: 0` and rebuild. The contract test's W06-shaped primary-workflow row covers it.
- **JSON Schema engine.** The JSON Schema was not run through a JSON Schema engine. Only its shape is asserted, plus a check that every key it lists passes the validator.
- **Domain agreement.** No test checks that the mode names match the domain's `WebAutomationExtractListPagination`. test-contracts does not import the domain, and the domain worker is still in flight.

## Open questions or contradictions found

1. **An unlisted follow-up.** Report X1.5 lists the follow-ups as the product-catalog manifest and test-runner's `extract-records.ts` and `run-expectations/extraction.ts`. It misses `apps/scenario-lab/src/scenarios/auth-gate/tests/scenario.test.ts:199`, `for (const value of Object.values(expectedRecord)) assert.ok(body.includes(value), value);`, which fails to compile once record values can be `null`. That keeps scenario-lab's `test` script red. It needs an owner; the fix is one line that skips or rejects `null` values.
2. **Wrong line reference.** The report says `run-expectations/extraction.ts:10,27`, but the compile error is at `:20`. The `extract-records.ts:62,67` errors match the report's description.
3. **Test-runner is red until W6 lands.** test-runner does not compile until W6's serial follow-up narrows `extract-records.ts` to `next` and widens `extraction.ts` to `string | null`, so W6 should run immediately after this.
4. **Recordable actions for other modes.** `recordable-actions.ts:68`, held per D14, treats any `pagination` as yielding the click actions. That is wrong for `mode: "scroll"`, which scrolls rather than clicks. The file's doc comment also still says a paginated extract "clicks `next`". Decide both in X5.
5. **D4 rule scope.** The rule is exactly as briefed: it covers `count: 0` or `records: []` only. An expectation of `count: 2` against `minItems: 3` is just as unmeetable. Generalizing it to "an expected record count below the step's `minItems`, 1 when absent" would be a natural follow-up.
6. **Choices not specified in the plan:**
   - `maxScrolls` uses the same 1-50 limit as `maxPages`.
   - `pages` must be an integer of 1 or more, and is not compared with the step's `maxPages`.
   - `optionalFields` entries must be unique.
   - The D4 issue is reported at the expectation entry, not at the step.
   - The JSON Schema does not restrict `minItems` to extract steps, matching how it already treats `fields` and `pagination`.
   - The portable JSON Schema uses `oneOf`. Report open question 10 is about Core's parameter-schema dialect, not this schema.
