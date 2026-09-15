# x01-test-runner: test-runner compiles again, and X0.7

## Outcome

**Partial, with nothing left inside this brief.**

Done and checked:
- test-runner builds.
- The X0.7 tests pass, along with every other owned test.
- The scenario-lab `test` script passes.
- The X0.7 mutation turned exactly the two new rows red, and was reverted.
- `apps/scenario-lab/e2e/product-catalog.spec.ts` type-checks against the pagination union.

One definition-of-done item is red for a reason outside this brief: `node scripts/structure-audit.mjs` exits 1. Its only violation is `[working-docs] docs/working/README.md is out of date with the documents' header blocks`. That index is a shared document, so I did not edit it or run `pnpm structure:baseline`. The mismatch comes from the uncommitted edits to `docs/working/first-class-data-extraction-plan.md`, which were already there at the start. No file I changed is under `docs/`. The supervisor clears it by regenerating the index once the working-document edits settle.

## What changed and why

### The compile follow-ups from X1.5

The test-contracts change (the `mode` union and `string | null` record values) broke test-runner's compile and scenario-lab's `test` script. These edits restore both.

- **`packages/test-runner/src/scenario-steps/extract-records.ts`.**
  - A new private `nextPagination(step)` returns the step's pagination when `mode` is absent or `"next"`.
  - Any other mode (`loadMore`, `scroll`, `numbered`) throws `RunnerFailure("fixture.invalid", "Extract step <id> paginates by <mode>, and the Lab's extract reader follows only next", { details: { stepId, mode } })`.
  - The check runs before any page is read or clicked, so another mode cannot pass as a one-page list.
  - `extractRecords` uses it in place of `step.pagination`, which removes the `:62` and `:67` errors.
  - The doc comment gains a paragraph saying so.
  - `ExtractedRecord` stays `Record<string, string>`: this reader never produces `null`.
- **`packages/test-runner/src/run-expectations/extraction.ts`.**
  - `assertExtraction` takes `readonly Record<string, string | null>[]`, which removes the `:20` error.
  - `sameRecord` compares the same widened type through a private `ExtractionRecord` alias.
  - An expected `null` matches only a field that is present and `null`, never a missing field or `""`. The doc comment says so.
- **`apps/scenario-lab/src/scenarios/auth-gate/tests/scenario.test.ts:199`.**
  - The loop now runs `assert.ok(value !== null, "every expected account value is text the page serves, never null")` before `body.includes(value)`.
  - A null account value fails the test rather than being skipped.
- **`apps/scenario-lab/e2e/product-catalog.spec.ts:154-158`.**
  - The fixture oracle returns when there is no pagination.
  - It throws `Unsupported pagination mode <mode>` for any mode other than `next`, in the same style as its `Unsupported step` error.
  - It then reads `maxPages` and `next` from the narrowed member. The doc comment names `next` as the only mode it reads.

### X0.7: the Flow-lane reader counts non-string values (report Part 2)

- **`packages/test-runner/src/flow-lane/persisted-flow-run.ts`.**
  - **`extractedRecords`** returns `{ records, nonStringValues }`. It counts 1 for each entry that is not a record (including `null`, strings and arrays) and 1 for each field value that is not a string. Those values are still left out of the records.
  - **`PersistedFlowAction`** gains `extractedNonStringValues?: number`. It is present exactly when `extracted` is, 0 included, and set in `flowAction`.
  - **`PersistedFlowRunOutcome`** gains `extractedNonStringValues: number`. `outcomeFromDetail` sums it over the actions, beside `extracted`.
  - The doc comments say it is a count only (D6).
- **`packages/test-runner/src/flow-lane/expectations.ts`.**
  - `assertFlowExtraction` takes a fourth, required parameter, `nonStringValues: number`.
  - When the extraction is judged and the count is above 0, it throws `RunnerFailure("runtime.behavior", "The Flow's extract attempts carried N field value(s) that are not strings", { details: { nonStringValues: N } })`.
  - The check comes before the attempt-count and record comparisons, because a dropped value is the cause of any record mismatch that follows. It is not an optional parameter with a default, so a caller cannot forget to pass the count.
- **`packages/test-runner/src/flow-lane/run-flow-lane.ts`.**
  - `:180` passes `run.extractedNonStringValues`.
  - `flowLaneSnapshot` publishes `extractionNonStringValues` beside `extractionCount`, and its doc comment says it is a count, never the values.
- **Fixture literals.** `lane-observation.test.ts:8` and `single-run-evaluation.test.ts:85,134` gain `extractedNonStringValues: 0`. `run-flow-lane.test.ts:260` gains `extractedNonStringValues: 2`.

### Tests added or changed

- **`persisted-flow-run.test.ts`.**
  - The existing extract row also asserts the count is 0 on the outcome and on the action.
  - **New row**, "an extracted value that is not a string, or an entry that is not a record, is left out of the records and counted":
    - The report's input `[{ name: "Alpha", price: null }, "stray", { name: "Beta", tags: ["x"] }]` yields records `[{ name: "Alpha" }, { name: "Beta" }]`, with a count of 3 on the outcome and on the action.
    - A second run has three attempts: two extract attempts that each drop one value, and a click. The actions carry `[1, undefined, 1]` and the outcome sums to 2.
- **`expectations.test.ts`.**
  - The existing calls pass `0`.
  - **New row**, "a judged extraction whose attempts carried a value that is not a string fails as that, even when the records match". The records match but the count is 1, and the call throws `runtime.behavior` with the exact message and `details: { nonStringValues: 1 }`. The same call against a click-only Flow, which is not judged, does not throw.
- **`run-flow-lane.test.ts`.** The snapshot test asserts `snapshot.extractionNonStringValues === 2`.
- **`extract-records.test.ts`.** **New row**: explicit `mode: "next"` reads all three pages with clicks `[0, 1]`. `loadMore`, `scroll` and `numbered` each reject with `fixture.invalid` naming the mode, with no locator call and no click.
- **`extraction.test.ts`.** **New row**: an expected `null` matches a `null`. A missing field, `""` in place of `null`, and `null` in place of `""` each fail as "record 0 does not match".

## Commands run and observed results

Every build, test, type-check and audit command ran alone. None crashed, so nothing needed a rerun for the RAM fault.

1. **First build.** `pnpm --filter @fluxiq-web-extension/test-runner build` exited 2. It printed `src/flow-lane/tests/expectations.test.ts(93,3): error TS2554: Expected 4 arguments, but got 3.` and the same at `(97,23)`. Those were two calls I had missed; I fixed them.
2. **Second build.** The same command exited 0, printing no errors. `domain:dist` found an existing `domain/dist` and did not rebuild it.
3. **The X0.7 command.** `node --test packages/test-runner/dist/flow-lane/tests/persisted-flow-run.test.js packages/test-runner/dist/flow-lane/tests/expectations.test.js packages/test-runner/dist/flow-lane/tests/run-flow-lane.test.js packages/test-runner/dist/flow-lane/tests/lane-observation.test.js` printed `# tests 50`, `# pass 50`, `# fail 0`. The new rows are `ok 6` and `ok 24`. The exit code shown in that session came from the output filter, so the pass rests on `# fail 0`; run 11 below captures node's own exit code.
4. **Other owned tests.** `node --test` on `scenario-steps/tests/extract-records.test.js`, `run-expectations/tests/extraction.test.js` and `run-evaluation/tests/single-run-evaluation.test.js` printed `# tests 23`, `# pass 23`, `# fail 0`, with `NODE_EXIT=0`.
5. **Scenario-lab suite.** `pnpm --filter @fluxiq-web-extension/scenario-lab test` printed `# tests 205`, `# pass 205`, `# fail 0`, with `PNPM_EXIT=0` and no `error TS` line.
6. **e2e type check, first attempt.** Nothing in the repository type-checks `apps/scenario-lab/e2e`. I wrote a scratch config, `<scratchpad>/x01-e2e-tsconfig.json`, extending `apps/scenario-lab/tsconfig.json` with `noEmit`, rootDir set to the app, and `include` of `e2e/**/*.ts`. `pnpm --filter @fluxiq-web-extension/scenario-lab exec tsc -p <that config>` exited 1. Almost every error was a missing DOM global, because the app's config has `lib: ["ES2022"]`. None named `product-catalog.spec.ts`.
7. **Mutation build.** I restored the silent drop in both halves: `extractedRecords` returned `nonStringValues: 0`, and the judge's condition became `nonStringValues > Number.POSITIVE_INFINITY`. The build exited 0.
8. **Mutation run.** The X0.7 command printed:
   - `not ok 6 - a judged extraction whose attempts carried a value that is not a string fails as that, even when the records match` with `error: 'Missing expected exception.'`;
   - `not ok 24 - an extracted value that is not a string, or an entry that is not a record, is left out of the records and counted` with `expected: 3`, `actual: 0`;
   - `# tests 50`, `# pass 48`, `# fail 2`, `NODE_EXIT=1`.

   I then reverted both halves.
9. **e2e type check with DOM types.** I added `"lib": ["ES2022", "DOM", "DOM.Iterable"]` to the scratch config, and tsc exited 1. The only errors were `e2e/member-directory.spec.ts(27,5)` and `(28,28)`, both `error TS2322`: a state literal not assignable to `Partial<MemberDirectoryState>`. Those predate this work, since git showed no uncommitted change under `apps/scenario-lab/e2e` before I started. `product-catalog.spec.ts` and `data-table.spec.ts` produced no errors.
10. **Build after the revert.** It exited 0. A search for `MUTATION-X01` in `packages/test-runner/src` found no matches.
11. **All seven owned test files after the revert.** `node --test` printed `# tests 73`, `# pass 73`, `# fail 0`, with `NODE_EXIT=0`.
12. **Structure audit.** `node scripts/structure-audit.mjs` exited 1:
    - it printed `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.` and `structure-audit: 1 violation(s) across 1 rule(s).`;
    - the warnings naming my files are `persisted-flow-run.ts: 430 lines` and `tests/run-flow-lane.test.ts: 487 lines`, both past the 400-line advisory. Both files were already past 400 before this change, at 409 and about 484 lines.
13. **Git status.**
    - `git status --short -- docs/working` shows `M docs/working/first-class-data-extraction-plan.md`, with uncommitted supervisor edits such as the new `### Brief: x0-page`, plus two untracked worker reports.
    - The owned areas show exactly the 14 files listed under "What changed".

## Not verified

- **Full gates.** `pnpm check`, `pnpm test` and `pnpm build` were not run, because of RAM and the in-flight domain work. The whole `packages/test-runner` suite (`dist/**/*.test.js`) was not run either, only the seven owned test files. The full build does type-check every test-runner file, including the bench tests that hold snapshot literals.
- **No browser.** No browser, Playwright or Testing Lab run, per the brief. The e2e oracle change was type-checked, never executed.
- **The pre-fix e2e errors.** I did not observe `product-catalog.spec.ts:155-156` failing before my edit, only that it type-checks afterwards.
- **Domain build.** test-runner was built against the existing `domain/dist`, not a fresh domain build, because other workers are editing the domain.
- **The mutation's halves.** The mutation was applied once with both halves together. Each half was not run on its own, although the failure messages show which half each row pins.
- **The auth-gate null guard.** It was never exercised with a real `null`. The auth-gate manifest's values are all strings.
- **Other manifests.** I did not check whether any scenario manifest expects a `null` record value yet.

## Open questions or contradictions found

1. **An expected `null` cannot be met on either lane today.**
   - The recording-lane reader, `extract-records.ts`, leaves a missing field out of the record and never writes `null`.
   - The Flow-lane reader drops `null`, and with X0.7 a judged run fails on it.
   - So a manifest record containing `null` fails both lanes, and a later phase (X3 or X5) needs to decide how each reader reports a field with no value.
2. **The report's mutation target is incomplete as written.** "Restore the silent drop (count always 0): both new rows fail" works only if the judge's check goes too, because the `expectations.test.ts` row calls `assertFlowExtraction` directly with a count of 1. I mutated both halves together, as described above.
3. **Choices the report did not specify:**
   - `extractedNonStringValues` on an action is present exactly when `extracted` is, 0 included;
   - the count check runs before the attempt-count comparison;
   - an extraction that is not judged is never failed on the count;
   - the new parameter is required, not defaulted.
4. **Nothing type-checks `apps/scenario-lab/e2e`.** The two pre-existing `member-directory.spec.ts:27-28` errors show that. An e2e tsconfig with DOM types in `pnpm check` would enforce it mechanically. The fix belongs to whoever owns that file.
5. **Documentation (X0.8, worker W7).** Two changes need describing:
   - the Flow-lane snapshot's new `extractionNonStringValues` field and the run failure it gates;
   - the Lab extract reader refusing modes other than `next` as `fixture.invalid`.
