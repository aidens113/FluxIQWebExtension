# g-evidence-budget-invariant: a Flow-lane run fails when a packet exceeds its budget

Worker `g-evidence-budget-invariant`, test-runner, 2026-09-13. Tree at `30098dd` plus other
workers' in-flight edits.

## Outcome

Done. Every Flow-lane evaluation with at least one measured packet now carries an
`evidence-packet-budget` invariant, judged against the domain's exploration budget, which is
imported, not restated. A packet one byte over fails. A run the runner had passed becomes
`failed` as `performance.budget`. A run with no packets gets no invariant. Both producers
(`lab run` and the bench) get the check without any caller edit.

Re-verified at HEAD first: a grep of `packages/test-runner/src` for
`WEB_LLM_EVIDENCE_BYTE_BUDGETS`, `evidence-packet-budget` and `exploration budget` found
nothing, so the item was open.

## What changed and why

All under `packages/test-runner/src/run-evaluation/`:

- **`evidence-budget-invariant.ts` (new).** `evidenceBudgetInvariant(packets)` returns
  `undefined` for no packets. Otherwise it returns one `InvariantResult`.
  - The budget is `WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration`, from
    `@fluxiq-web-extension/domain/node`. It is exported at `domain/src/runtime/llm-evidence/index.ts:10`,
    and `domain/dist/index.d.ts` reaches it through `runtime/index.js`, then `llm-evidence/index.js`.
  - The check is `packet.bytes > budget`, so a packet at the budget passes.
  - `expected`: `every sanitized evidence packet at most <budget> bytes`.
  - `actual` on a pass: `<n> packets, the largest <b> bytes`.
  - `actual` on a failure: `<k> of <n> packets over budget: action <position> <point>: <bytes> bytes; ...`.
  - `evidenceSequences: []`, because packets are not evidence events.
- **`flow-lane-evidence-sizes.ts`.** The reader now also returns `packets: MeasuredEvidencePacket[]`
  (`{ actionPosition, point, bytes, truncated }`), beside the unchanged sizes. It returns the new type `FlowLaneEvidence`.
  - `actionPosition` is 1-based over every entry of `flow-lane.json`'s `actions`, so it names the
    file's own entry.
  - `point` is `beforeAction` or `afterAction`, or `null` for anything else, so a malformed
    entry's text is never carried. A `satisfies Record<PersistedEvidencePacket["point"], true>`
    map keeps that list exhaustive at compile time.
  - Which entries are measured is unchanged.
- **`observed-run-evaluation.ts`.** `ObservedRun.evidence` is now `FlowLaneEvidence`.
  `evaluateObservedRun` appends the invariant through a private function, `withEvidenceBudget`.
  - The contract refuses a `passed` verdict beside a failed invariant, and a `failed` verdict
    needs a category (`test-contracts/src/evaluation-validation.ts:25-29`). So a breach turns a
    passed outcome into `failed` / `performance.budget`.
  - A run that was already failed or inconclusive keeps its verdict and category, and gains the
    invariant.
  - Only the three contract fields are copied into `evaluation.evidence`, so the packet list is
    never written.
- **`index.ts`.** Barrel exports the new module.
- **Why no caller changed:** `bench/evaluate-run.ts:106` and `single-run-evaluation.ts:61` both
  pass `flowLaneEvidenceSizes(...)` straight into `evaluateObservedRun`. The bench's aggregates
  read `evaluation.verdict` (`bench/aggregate-report.ts:66,192`, `bench/run-bench.ts:130`), so a
  breach fails the bench row too.
- **Tests:**
  - new `tests/evidence-budget-invariant.test.ts`, 7 rows:
    - at the budget passes; one byte over fails, with the exact message;
    - no packets: no invariant, on either lane;
    - within budget, the verdict is kept;
    - over budget, a passed run fails as `performance.budget` and stays contract-valid;
    - an already-failed run keeps its category;
    - read from a real bundle file, no packet content reaches the evaluation.
  - `tests/flow-lane-evidence-sizes.test.ts`: expectations gain `packets`, plus one new row for
    points and `null`.
  - `tests/observed-run-evaluation.test.ts`: evidence inputs gain `packets`.

`tests/runner-wiring.test.ts` shows as modified in `git status`. That edit is another worker's,
not mine.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check`: exit 0, no output after the scripts.
  Rerun at the end: exit 0, 0 `error TS` lines.
- `pnpm exec tsc -p tsconfig.json --outDir dist-g-evidence-budget` (in `packages/test-runner`): exit 0.
- `node --test "dist-g-evidence-budget/**/*.test.js"`: exit 1,
  `# tests 554 / # pass 543 / # fail 11`. None of the 11 is in code I changed:
  - **Nine** fail before any test runs, with `SyntaxError: The requested module
    '@fluxiq-web-extension/test-contracts' does not provide an export named 'flowLaneExclusion'`.
    They come from another worker's edits to `bench/expand-corpus.ts` and `run-scenario.ts`,
    against the shared test-contracts `dist`, which has not been rebuilt. The nine:
    - the test files `bench/tests/run-bench`, `bench/tests/week1-corpus`,
      `run-evaluation/tests/bench-parity`, `run-evaluation/tests/runner-wiring`,
      `run-evaluation/tests/single-run-evaluation`, `tests/cli-llm` and
      `tests/scenario-assertions`;
    - the tests `CLI auth status and clear need only existing origin and username` and
      `clone-cache refresh reports invalidate-now and refresh-on-next-run semantics`.
  - **Two** are real assertion failures in another worker's untracked
    `demo-workspace/tests/control-waits.test.js`:
    - `two new recordings fail as soon as both are listed`, with `Missing expected rejection.`;
    - `a second new recording listed while the first finalizes fails once the first is finished`,
      with `RunnerFailure: Recording operation created more than one recording`.
  - All 14 rows in my three test files passed.
- **Blocked files, through a scratch resolve hook.** I built test-contracts privately
  (`tsc --outDir dist-g-evidence-budget`, exit 0). Then:
  `node --import <scratch>/g-ebi-register.mjs --test "dist-g-evidence-budget/run-evaluation/tests/*.test.js" "dist-g-evidence-budget/bench/tests/*.test.js"`
  gave exit 0, `# tests 73 / # pass 73 / # fail 0`. This includes the row where a single run
  agrees with its bench row field for field, now with the budget invariant on both sides.
- `GIT_INDEX_FILE=<scratch index with the 2 new files> node scripts/structure-audit.mjs`: exit 0,
  `structure-audit: passed (41 warning(s), 17 baselined)`. No finding names a run-evaluation file.
- **Mutation.** I changed `packet.bytes > budget` to `>=` in `evidence-budget-invariant.ts`.
  - Rebuild: exit 0. `node --test .../evidence-budget-invariant.test.js`: exit 1, `# tests 7 / # pass 4 / # fail 3`.
  - `not ok 1 - a packet exactly at the budget passes`: `+ actual: '1 of 2 packets over budget: action 2 afterAction: 6000 bytes'`, `- actual: '2 packets, the largest 6000 bytes'`, `+ passed: false`.
  - `not ok 2 - a packet one byte over the budget fails...`: `+ '3 of 3 packets over budget: action 1 beforeAction: 6000 bytes; ...'`.
  - `not ok 4 - within budget, a Flow-lane evaluation carries a passing budget invariant and keeps its verdict`: `+ 'failed' - 'passed'`.
  - **Restored.** `sha256sum -c` against the hash taken before the mutation printed
    `evidence-budget-invariant.ts: OK`, hash `ac81136fbc42...a2d0be`.
  - **Rebuild after the restore:** exit 2, on `TS2322`, `TS18046` and `TS2345` errors, all in
    `src/demo-workspace/control-waits.ts`. That file is another worker's and was mid-edit. tsc
    still emitted the build, and the final `check` above passed with 0 errors.
  - The 3 run-evaluation test files that load: `# tests 14 / # pass 14 / # fail 0`.
- **Cleanup:** `packages/test-runner/dist-g-evidence-budget` and
  `packages/test-contracts/dist-g-evidence-budget` are removed. `ls` confirms the first is gone.
  The scratch index is deleted.

## Not verified

- **No Lab run.** In the supervisor's campaign, one `lab run --flow` should show the following.
  - **Setup:** `product-catalog`, run after the domain's host-runtime fix (`f-host-runtime-policy-action`)
    lands.
  - **Within budget:** `evaluation.json` has an `evidence-packet-budget` invariant with
    `passed: true`. Its `actual` names a largest packet no bigger than every entry in
    `sanitizedPacketBytes`, and at most 6,000.
  - **If any packet is over 6,000:** `verdict: "failed"`, `failureCategory: "performance.budget"`,
    and the offending action's position and point in `actual`.
  - **The bench:** its row for the same run must carry the same invariant.
  - **Today:** no Flow-lane attempt carries packets (`i-evidence-packets`), so every current Lab
    evaluation has no such invariant. That is the designed no-packets case, not a defect.
- **One clean full run.** The whole package suite has not passed in a single run. Nine test
  files were exercised only through the resolve hook, against a private test-contracts build of
  another worker's in-progress `src`.
- **`run.json` and the exit status:** a breach does not change `run.json`'s verdict or
  `lab run`'s exit status. Only `evaluation.json` and bench rows fail. See question 2.

## Open questions or contradictions found

1. **Category.** `performance.budget` is the closest existing test-rig category. The taxonomy
   describes facility failures, though, and an oversized packet is a product-side evidence
   defect. Supervisor to confirm, or name another category.
2. **Should the run itself fail?** If so, `run-scenario.ts` must act on the evaluation's verdict.
   Another worker holds that file.
3. **Documentation not updated, because I don't own it:**
   - `bench/evaluate-run.ts:38`, `FLOW_LANE_SOURCES.evidenceSizes`;
   - `docs/architecture/testing-facility.md`.
   Neither mentions the new invariant.
4. **Restated point list.** `EVIDENCE_PACKET_POINTS` (`flow-lane/persisted-flow-run.ts:58`) is
   not exported, so the two point names are restated locally. The `satisfies` map keeps them
   compile-checked both ways. Exporting the constant from `flow-lane` would remove the
   restatement.
5. **A host that picks its own budget.** The check follows the exploration default because the
   host runtime passes no budget option. If a host ever does, the check must follow that
   instead.
