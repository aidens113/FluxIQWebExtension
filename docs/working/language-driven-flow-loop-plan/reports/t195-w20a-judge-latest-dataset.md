# t195-w20a: the judge pairs the expected step with the right dataset

## Outcome

Done. `judgeCreatedFlowDataset` now pairs the expected step with the dataset that answers it, not with the first
extraction that ran. The four new tests pass with the fix and fail with it reverted. The existing tests still pass.

## What changed and why

`packages/test-runner/src/flow-lane/creation/judgement.ts`
- New private `pairingOrder(datasets, expected, executionOrder)`, called before `judgeFlowExtraction`. It orders the
  datasets like this:
  1. Candidates come first. A candidate is a dataset with at least one record that holds every required key of the
     step. The required keys are the union of the keys of the step's `expected.records`, minus `optionalFields`
     (new private `requiredKeys`).
  2. Candidates are sorted with the latest-run first. "Run" means the earliest first-attempt position of the
     dataset's nodes, from `executionOrder`. A candidate whose node never appears in the actions sorts last among the
     candidates.
  3. The rest follow in today's first-run order.
  - With no candidate, the result is exactly today's order. That covers an empty dataset, which has no records and
    so no keys, and an expectation without `records`.
- The ordered datasets are passed as `datasets`. A `candidateOrder` is built from that order: each node gets the index
  of the first dataset it wrote. `judgeFlowExtraction`'s stable sort therefore keeps the order.
- `expectations.ts` is unchanged.
- A candidate only needs to carry the required keys. Extra keys are allowed, so a listing with a `status` column is
  still a candidate and loses only because it ran earlier.
- "At least one record carries the keys" was chosen over "every record". Under "every record", a partly broken
  answer read would drop out and the earlier listing would be judged instead, which is the false pass this fix
  removes.
- The comment that explained the old empty-map and first-run history was rewritten to cover both earlier states and
  the new rule.

`packages/test-runner/src/flow-lane/creation/tests/judgement.test.ts`
- `catalogTask` now calls a general `scenarioTask(scenarioId, taskId)`.
- New helper `runReading`: one extract node per read, run in the given order. Core returns the datasets in reverse
  order, so the judge cannot rely on Core's order.
- Four new tests, built from the scenarios' own tasks and workflows through `loadCreatedFlowRequest`,
  `loadScenarioManifest` and `resolveScenarioWorkflow`:
  - **5 (brief case 1), confirm-requests honesty.** The listing (all 4 expected records) runs first and the answer
    (first 3) runs last. The answer dataset is judged, 3 records observed and matched, and the dataset does not hold.
  - **6 (brief case 2), confirm-requests false fail.** The listing (4 records plus `status: "Pending"`) runs first
    and the answer (the 4 expected) runs last. The answer is judged, matches 4 and holds.
  - **7 (brief case 3), pickup-order.** A cart read `{name}` (2 rows) runs first, then the order record. The order
    dataset is judged and holds. The order record alone also holds.
  - **8 (brief case 4).** Two reads that both carry the order's keys, one with `total: "$0.00"`. The later read is
    judged in both arrangements: right-later holds, wrong-later does not.
- Brief case 5 is the existing `muhrf6c4` test, test 1. It is unchanged and still passes, because its later dataset
  is empty and so is not a candidate.

## Commands run and observed results

1. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w20a tsc" npx tsc -p packages/test-runner/tsconfig.json --noEmit`
   exited 2 with exactly one error, in a file I do not own:
   `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts(18,10): error TS2305: Module '"@fluxiq-web-extension/domain/node"' has no exported member 'screenWebBuildRefusalDiagnostic'.`
   There were no errors in `judgement.ts` or `judgement.test.ts`.
2. Private build: `npx tsc -p packages/test-runner/tsconfig.json --outDir packages/.lab-instances/t195-w20a --declaration false --sourceMap false`,
   through `heavy.sh`. Only the same single foreign error was printed, and the files were emitted.
   - The output had to sit two levels below the repository root, because the test computes `repositoryRoot` from
     `import.meta.url` six levels up.
   - The output also needed a `node_modules` junction to `packages/test-runner/node_modules`.
   - Both are git-ignored (`.gitignore:32 .lab-instances/`, confirmed with `git check-ignore -v`). Both were removed
     afterwards; the junction was deleted first, so the real `node_modules` is intact (checked with `Test-Path`).
3. `node --test packages/.lab-instances/t195-w20a/flow-lane/creation/tests/judgement.test.js` with the fix:
   `# tests 8`, `# pass 8`, `# fail 0`.
4. Revert check: `judgement.ts` was replaced with `git show HEAD:<file>`, then rebuilt and rerun.
   - Result: `ok` for tests 1-4 and `not ok` for tests 5, 6, 7 and 8, so `# pass 4`, `# fail 4`.
   - My version was then restored from a scratchpad copy and rebuilt. The rerun gave 8/8 again.
5. `node scripts/structure-audit.mjs` (downstream root):
   - It printed `structure-audit: passed (139 warning(s), 118 baselined).` and exited 0.
   - It printed no line for either file I own. They are 144 and 220 lines.

## Not verified

- On revert, I saw only that tests 5-8 failed, not which assertion failed. Each test asserts the paired `datasetId`
  first, so on the old code they most likely failed there, on the listing or cart dataset.
- I did not separately observe the brief's "today it holds" for case 1 on the old code. The w19b audit had already
  shown the pickup case failing on the old code.
- No package typecheck came back clean, because of the foreign error above.
- No Lab, browser or live run (per the brief).

## Open questions or contradictions found

- The foreign error: `publishable-step-value.ts` imports `screenWebBuildRefusalDiagnostic` from
  `@fluxiq-web-extension/domain/node`, which does not export it. This is probably another worker's change to domain
  that has not been made yet or has not been rebuilt into the domain dist. I left it for its owner.
- Test 1's title still says "judged on the one that ran first". That remains true for its case, since the other
  dataset is empty, so I left it.
- The w19a spec said a candidate's key set must *equal* the expected key set. The brief says it must carry *every*
  required key. I followed the brief. Equality would make the listing with `status` a non-candidate, and test 6
  passes either way.
