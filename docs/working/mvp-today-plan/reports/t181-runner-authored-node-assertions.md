# t181 Runner Authored-Node Assertions

Status: Complete
Worker: t181-runner-authored-node-assertions-resume
Date: 2026-09-26

## Outcome

The two failures were stale assertions, not a production regression. Core's screened-parameter result retains the safe navigation URL origin in `values` while listing `url` in `withheld` because the original path and query were removed. `createdFlowAuthoredNodes` correctly projects both `screened.values` and `screened.withheld`; changing that projection would discard required withholding evidence.

Updated the navigation expectations in:

- `packages/test-runner/src/flow-lane/creation/tests/authored-nodes.test.ts`
- `packages/test-runner/src/flow-lane/creation/tests/lane.test.ts`

Both now require `parametersWithheld: ["url"]`. No production files were changed.

## Validation

- Initial focused reproduction: 17 passed, 2 failed; both failures differed only because actual navigation records contained `parametersWithheld: ["url"]` while expected records contained an empty list.
- Focused build and tests: `pnpm --filter @fluxiq-web-extension/test-runner build`, then `node --test "packages/test-runner/dist/flow-lane/creation/tests/authored-nodes.test.js" "packages/test-runner/dist/flow-lane/creation/tests/lane.test.js"` — passed, 19 tests, 0 failed.
- Complete package suite: `pnpm --filter @fluxiq-web-extension/test-runner test` — passed, 1,462 tests, 0 failed.
- `git diff --check` on both edited tests — passed.

## Boundaries

No Lab run, repository-wide validation, Core edit, commit, or push was performed. No blocker remains within this brief.
