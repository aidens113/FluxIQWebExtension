# t752 unit A: closest trial and answer-set rows

## Outcome

Done. One test outside my files, a supervisor test, still asserts the old rule and now fails. Someone who owns that file has to update it (see Open questions).

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t752/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

- `R/service/candidate-trial/feedback.ts`: before this change, the trial feedback did not carry an answer-set count. It carried only `stored.rows`, which is `summary.totalRecordCount`, the sum over every set. A judged trial's `stored` now also carries `answerRows`: the `recordCount` of the set whose latest writing step (from `processing.passes[].node`) comes last in run order (`summary.flowShape`). If no set's step appears in that order, it uses the last set listed. The field is absent when no set was stored. I added a private helper `answerSetRows` and a header paragraph. Before editing I ran `git -C C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQ status --short`, which printed nothing, so t751 had not touched the file.
- `R/project-agents/dispatch/receipts.ts`: `storedRows` now reads `stored.answerRows` first. It falls back to `stored.rows` only when the feedback names no answer set (older feedback). Header paragraph added.
- `R/project-agents/contracts/builder-return.ts`: `trialRank` no longer ranks by the row count. Its second key is now whether the trial stored any answer rows (`rows > 0`). `trialAbove` ignores order: a trial ranks strictly above another only with a better verdict, or with the same verdict when it stored answer rows and the other did not. `closestTrial` already replaces the current pick with any later trial that does not rank below it. Together this gives: among trials of one verdict, the latest; if the latest stored no answer rows and an earlier one did, the latest that did. Verdict order is unchanged, and a yes is never chosen. Header and doc comments explain the cause in generic words.
- Tests, written first and seen failing before the change:
  - `R/project-agents/contracts/tests/closest-trial-latest.test.ts` (new): no 33 then no 30 gives the later; latest no with 0 and earlier no with 3 gives the earlier; unsure beats a later no; `trialAbove` cases.
  - `R/project-agents/dispatch/tests/receipts.test.ts`: added a case where feedback `stored: { rows: 30, answerRows: 3 }` gives `rows: 3`.
  - `R/service/candidate-trial/tests/processed-out.test.ts`: added a describe for `answerRows` (a 27-row working set plus a 3-row answer set gives `answerRows: 3`; a single set; the last-listed fallback; absent with no sets). I first wrote it as a new file, `answer-rows.test.ts`. That pushed `candidate-trial/tests/` to 26 files, over the audit's 25-file limit, so I moved the tests into the existing stored-feedback test file and deleted the new one.

The caller `R/project-agents/supervisor/dispatch-tool.ts:386` swaps a repair's named trial for `closest` only when `trialAbove(closest, named)`. With the new `trialAbove`, a named trial of the same verdict that also stored answer rows is kept, as the existing test "keeps the trial it named when that one is as close as any" expects, and that test passes. The file needs no change.

## Commands run and observed results

From `packages/fluxiq`:
- Before the change: `pnpm exec vitest run .../closest-trial-latest.test.ts .../receipts.test.ts .../answer-rows.test.ts` printed `Tests 6 failed | 5 passed (11)`. The failures were `expected 'trial-1' to be 'trial-2'`, `expected true to be false` (trialAbove), the receipts `rows: 3` mismatch, and the answerRows assertions. The "absent" case first failed with `TypeError: findings is not iterable`, a fixture defect that I fixed by adding `findings: []`.
- After the change: `pnpm exec vitest run src/programs/automation-studio/runtime/project-agents/contracts/tests src/programs/automation-studio/runtime/project-agents/dispatch/tests` printed `Test Files 31 passed (31)`, `Tests 204 passed (204)`.
- `pnpm exec vitest run .../service/candidate-trial/tests/processed-out.test.ts .../project-agents/supervisor/tests/closest-trial.test.ts` printed `Tests 1 failed | 12 passed (13)`. The failure is `closest-trial.test.ts` "is, among the same verdict, the one that stored more rows": `expected 'trial-2' to be 'trial-1'`. That is the old rule this task replaces.
- An earlier wider run of the neighbouring consumers, `vitest run R/service/candidate-trial/tests R/service/project-build-ending/tests/ending-truth.test.ts R/flow-bootstrap/unfinished-build/tests`, printed `Test Files 52 passed (52)`, `Tests 444 passed (444)`. That run included the since-deleted `answer-rows.test.ts`.
- `pnpm exec tsc --noEmit -p .` printed no output and exited 0.

At the Core root:
- `node scripts/structure-audit.mjs` printed `FAIL [directory-files] .../result-verification/request-rows/tests/: 27 source files exceeds the 25-file limit` and `structure-audit: 1 violation(s) across 1 rule(s)`. That directory is not mine. Another worker in this tree has uncommitted and untracked files there (`working-sets.test.ts`, `recipes-fixture.ts`). None of my paths are flagged.

## Not verified

- No full suites, live or paid runs.
- `answerRows` takes run order from `flowShape` and the writing node from `processing.passes`. I did not confirm on a real run record that every live trial summary fills both. If neither is filled, it falls back to the last set listed.
- The whole supervisor test folder was not run, only `closest-trial.test.ts`.

## Open questions or contradictions found

- `R/project-agents/supervisor/tests/closest-trial.test.ts` lines 24-27 (`it("is, among the same verdict, the one that stored more rows")`) assert the old rule (`[no 10, no 2]` gives trial-1). Its owner should change the expectation to `trial-2` and rename the case to "the latest". I was told not to edit supervisor files. The header comment of that test file also describes the t606 rule only.
- `trialAbove` ignores order, so when the supervisor names an earlier trial of the same verdict that also stored answer rows, `dispatch-tool.ts` keeps the supervisor's choice instead of moving it to the latest. That matches the existing "as close as any" test. Whether it should instead be forced to the latest is the supervisor's decision.
- The `request-rows/tests/` audit failure (27 files) comes from another worker's uncommitted files in this tree.
