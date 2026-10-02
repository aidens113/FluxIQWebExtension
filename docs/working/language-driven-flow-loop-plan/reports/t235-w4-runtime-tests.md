# t235-W4: Core runtime-level tests against the names-only catalog

## Outcome

Partial. Changing the test fixed the 10 known `deepseek-bootstrap-exploration` failures: 8 of them pass, and the other 2 now fail for a reason that is not this change. The 5 failures left in the step-1 set all fail the same way on the HEAD versions of the 13 changed source files, so the t235 change did not cause them. I found no source defect. The structure audit fails on a violation that the t235 change introduced, in a path I do not own (see Open questions).

## What changed and why

One file changed: `R/tests/deepseek-bootstrap-exploration.test.ts`, in the stub DeepSeek `endpoint()`.

- **Cause of the 10 known failures:** the stub read `context.flowBootstrap.nodeCatalog` as an array of entries and called `.flatMap` on it. On the wire that value is now `{category: ["<id>: <description>"]}`, which is an object. The `TypeError` was thrown inside `fetchImpl`, so it came back as `llm.provider_network_error` and then `flow_bootstrap.provider_unavailable`. This is an intended behaviour change, not a source defect.
- **Fix:** the stub now reads the ids from the names-only lines (the text before the first `:` of each line in each category). A one-line comment records why.
- **No assertion changed.** `visibleRecordProducerCount` keeps the same meaning: how many registered record-producing nodes the request shows the model. The two cases that assert it equals 1 pass on the current source.

## Per-failing-test table

| # | Test (file > name) | Cause | Fix | File |
|---|---|---|---|---|
| 1 | exploration > ends six unreadable replies in a row... | Intended change: the stub threw on the names-only `nodeCatalog` | Stub reads the names-only shape | R/tests/deepseek-bootstrap-exploration.test.ts |
| 2 | exploration > does not count bad replies across a good one | same | same | same |
| 3 | exploration > still ends at once when the provider rejects the credential | same | same | same |
| 4 | exploration > saves a creation that looked more than sixteen times | same | same | same |
| 5 | exploration > records a build's token totals past one request's ceiling... | same | same | same |
| 6 | exploration > names the ending of an exploration that ran out after more than sixteen decisions | same | same | same |
| 7 | exploration > reproduces the measured 26-decision creation exhaustion... | same | same (asserts `visibleRecordProducerCount === 1`, which passes) | same |
| 8 | exploration > converges from the same prefix when the corrected plan retains the record-producing node | same | same (asserts `visibleRecordProducerCount: 1`, which passes) | same |
| 9 | exploration > asks again after a malformed decision, carries on, and creates the Flow | First the stub (as rows 1-8). After that fix: `revealed` has 6 entries, expected 3. **Not caused by this change.** The extra 3 reveals come from `result-verification/verify.ts` `askOnce` (the build judge added by 4f78cadc, t195 Lane D F43). The key is released before the stub throws on a non-`evidence_tool_decision` task. | Not fixed (outside this brief) | R/tests/deepseek-bootstrap-exploration.test.ts:473 |
| 10 | exploration > asks again after a provider decision reaches its deadline | Same as row 9: 6 reveals, expected 3. **Not caused by this change.** | Not fixed | same, around line 490 |
| 11 | refuted-result/reauthor-service > does not leak private retention to a same-caller generation on another Flow | `taskKinds` has one more `loop_verification` than expected. **Not caused by this change** (same failure on base). Most likely the build judge from 4f78cadc. | Not fixed | R/tests/refuted-result/tests/reauthor-service.test.ts |
| 12 | refuted-result/reauthor-service > uses the run's caller for verification, extend, approval, and apply | Same as row 11. **Not caused by this change.** | Not fixed | R/tests/refuted-result/tests/reauthor-service.test.ts:486 |
| 13 | refuted-result/repair-replay-chain > is refuted, repaired from the judge's directive... | Sequence ends `loop_verification, loop_verification`; one was expected. **Not caused by this change.** | Not fixed | R/tests/refuted-result/tests/repair-replay-chain.test.ts:287 |

### How rows 9-13 were shown not to be caused by this change

1. I saved the 13 modified non-test source files under R to scratch: plan/contracts.ts, plan/index.ts, deepseek/request-body.ts, deepseek/request-shape.ts, evidence-loop-decision.ts, harness-options/binding.ts, harness/context-packet.ts, harness/task-request.ts, node-tools/index.ts, node-tools/run-node.ts, route-state/build-routing.ts, service.ts, and service/flow-bootstrap-commands/state-digest.ts.
2. I overwrote each one with `git show HEAD:<file>`.
3. I ran the three failing files with my updated test in place. Result: `Tests 7 failed | 12 passed (19)`.
   - Rows 9 and 10 failed with the same message: "expected [ …(6) ] to have a length of 3 but got 6".
   - Rows 11 and 12 failed with the same message: "[ 'loop_verification', …(4) ] to deeply equal [ …(3) ]".
   - Row 13 failed with the same message: "[ …(5) ] to deeply equal [ …(4) ]".
   - The other two base failures (26-decision and converges) are expected. My stub reads the names-only shape, which the HEAD source does not send, so `visibleRecordProducerCount` is 0. Both pass on the current source.
4. I restored every file from the saved copies. `cmp` reported no differences for all 13 files.
5. In `git diff --stat`, every R line count matches the pre-swap baseline. The only new rows are the docs worker's concurrent docs/** edits and my test file.

## Commands run and observed results

All run from packages/fluxiq unless stated.

- **First run of the step-1 set** (the step-1 vitest command plus every R/tests file that mentions the brief's terms, 71 files): `Test Files 3 failed | 68 passed (71)`, `Tests 13 failed | 650 passed (663)`.
- **After the fix, `npx vitest run R/tests/deepseek-bootstrap-exploration.test.ts`:** `Tests 2 failed | 9 passed (11)`.
- **Base-source swap run:** see above.
- **`npx tsc --noEmit -p .`:** exit 0, no output.
- **Final run of the same step-1 set:**
  - `Test Files  3 failed | 68 passed (71)`
  - `Tests  5 failed | 658 passed (663)`
  - The 5 failures are rows 9-13.
- **`node scripts/structure-audit.mjs` (repo root):**
  - `FAIL [directory-files] packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/: 26 source files exceeds the 25-file limit.`
  - `structure-audit: 1 violation(s) across 1 rule(s).`
  - The extra file is the new untracked `R/llm/tests/evidence-loop-decision.test.ts`, which is part of the t235 change. It is not a file I wrote.
- **`wc -l R/service.ts`:** 4491. I did not touch it.

## Not verified

- I did not run test files outside R/tests that mention the terms (R/llm/tests, R/llm/node-tools/tests, R/llm/harness/tests, R/llm/deepseek/tests, and others). The brief scoped step 1 to R/tests and R/recovery.
- No Lab or live run, as the brief says.
- During the swap window (about 3 minutes), any concurrent reader of R saw HEAD source for those 13 files.

## Open questions or contradictions found

1. **Structure audit:** `R/llm/tests/` has 26 files against a limit of 25 because the t235 change added `evidence-loop-decision.test.ts` there. It needs grouping into a feature subfolder, or another test moved. That is outside the paths I own.
2. **Rows 9-13 are a HEAD regression from 4f78cadc (t195 F43, the build judge).** The tests were not updated for the judge's extra `loop_verification` call. In the exploration stub, that call releases the key before the stub refuses it. Someone needs to decide:
   - whether the exploration stub should answer the judge;
   - whether the "one release per call" count should now include judge calls;
   - whether the refuted-result sequences should gain the judge call.

   This needs an owner. It is outside "agree with the names-only catalog".
