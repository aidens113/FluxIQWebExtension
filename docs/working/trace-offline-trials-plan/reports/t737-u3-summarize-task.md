# t737 unit 3: summarize-task repair-call count

## Outcome

Done. The suspected double count was real, and it is now fixed where it started.

## What changed and why

- **Cause.** `packages/test-runner/src/live-llm/live-llm-run.ts` `writeSnapshot` writes
  `live-llm.json` `observed.calls = runSpend.calls`. That figure is Core's purse count for the
  whole run: build, read, judges, runtime/repair, re-author and chat. The repair's own calls
  are also kept beside it, as `repair.observed`. `summarize-task.mjs` (old line 39) added
  `repair.observed.calls` to `observed.calls`, so every repair call was counted twice whenever
  the purse had been read. The tokens and dollars were not affected: `reported-spend.mjs` already
  replaces the dollars with `runSpend.totalEstimatedCostUsd`, and its token sum adds the build's
  and the repair's separate figures.
- **Fix** (`scripts/lab/live-campaign/row/summarize-task.mjs`): a new private function
  `providerCallsOf(liveLlm, evaluation)`:
  - When `runSpend.calls` is a number, use `observed.calls` as it is (the whole-run count).
  - Older snapshots with no purse figure keep the old sum of build plus repair. The existing
    `created-flow-repair-calls.test.mjs` covers this case and still reads 12.
  - With no live record, fall back to `evaluation.llm.calls` as before.
  - The keying matches how `reported-spend.mjs` `withRunSpend` treats `runSpend`.
- **Test first** (`scripts/lab/live-campaign/row/tests/summarize-task.test.mjs`, new last test):
  a synthetic `live-llm.json` shaped the way `writeSnapshot` writes it after `settleRepair`.
  - Its contents: `observed` with the step-log rows (`call-rows.ts` row fields: requestId,
    taskKind, stage, provider, model, tokens, cost), plus `runSpend` (`flow_purse`, 9 calls, with
    phases), `build`, and `repair.observed` with 3 calls.
  - The run is 4 build calls, 1 judge, 1 chat and 3 repair calls.
  - Before the fix it failed with `expected: 9, actual: 12`. After the fix it passes, and it also
    checks that the row equals `evaluation.llm.calls` and that the spend source is `run` at $0.009.
  - No real run data was used.
- **Step-folder shape.** The row never reads `steps/` directly. The step log only reaches the row
  as the `observed.observedCalls` rows, which `call-rows.ts` builds from `steps/NNNN-*/meta.json`.
  The fixture models those rows. There is no `test-runs/` in this tree, so I inspected no real run
  folder.

## Commands run and observed results

- `node --test scripts/lab/live-campaign/row/tests/summarize-task.test.mjs`, before the fix:
  `not ok 6 ... expected: 9 actual: 12`, `# pass 5 # fail 1`.
- The same command after the fix: `# pass 6 # fail 0`.
- `node --test "scripts/lab/live-campaign/row/tests/*.test.mjs" "scripts/lab/live-campaign/summary/tests/*.test.mjs"`:
  `# pass 44 # fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (211 warning(s), 618 baselined)`.
  None of the warnings are for `live-campaign/row`.

## Not verified

- Not checked against a real run bundle, because none exists in this tree.
- Not checked whether historical campaign summaries already written to disk carry the inflated
  counts.
- No full suites or live runs, per the brief.

## Open questions or contradictions found

- Summaries made before this fix from runs with a `flow_purse` `runSpend` and a repair overstate
  `providerCalls` by the repair's call count.
- `build-spend.mjs` `derivedParts` also reads `repair.observed`, but only for older snapshots with
  no per-build record, so it does not double count.
