# t174-w5 validation report

## Outcome
Partial. Commands 2 to 6 passed. Command 1 (Core full vitest) failed: 65 of 4458 tests across 32 files. About 50 of the 65 are timeouts under machine load. At least 11 are real assertion failures that do not depend on timing.

## What changed and why
Only this report. No source was edited. Every slotted command ran in build slot `b1` with an owner file and released it afterwards. At the start, t185 and t187 held both slots, so I waited. Command 6 did not need a slot. I did not touch `lab-slots/`.

## Commands run and observed results
Scratchpad logs: `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/eb370cd2-4295-44d0-ba0e-006eba343f41/scratchpad/w5-<n>.log`, plus `w5-1c.log` with ANSI escape codes stripped.

| # | Command | Exit | Duration | Summary |
|---|---|---|---|---|
| 1 | CORE/packages/fluxiq `npx vitest run` | 1 | 874s | Test Files 32 failed / 436 passed (468); Tests 65 failed / 4387 passed / 6 skipped (4458) |
| 2 | CORE `pnpm --filter fluxiq build` | 0 | 122s | tsc build and declaration rewrite succeeded |
| 3 | DS `pnpm --filter @fluxiq-web-extension/domain test` | 0 | 37s | tests 884, pass 884, fail 0 |
| 4 | DS `pnpm check` | 0 | 263s | all packages `check: Done` |
| 5 | DS `pnpm build` | 0 | 159s | all packages `build: Done`; e2e-chromium verified 22 files |
| 6 | DS/packages/test-runner `node --test dist/core-web-build/tests/server-process.test.js` | 0 | <1s | tests 2, pass 2, fail 0 |

### Command 1 failures

Error counts: 36 `Test timed out in 15000ms`, 5 at 60000ms, 1 at 30000ms, and 1 `Hook timed out in 180000ms`. There were also cleanup errors: ENOTEMPTY on rmdir of `fluxiq-flow-bootstrap-generation-*/.../runtime/sqlite`, and EBUSY on unlink of `project.million/project.sqlite{,-wal,-shm}`. The run's total duration was 870s, and 604s of it went to collect. Both slots were busy with other lanes' check and tsc runs, so the machine was heavily loaded.

**Most likely environmental** (timeouts and locked files). Each file below had failures, with the count in brackets. For most, the only error was a timeout:
- `_shared/tests/runtime-llm-grants.test.ts` (1)
- `api/handlers/tests/runs.test.ts` (1)
- `runtime/service/recordings/tests/proposal-candidates.test.ts` (1)
- `run-detail-read/tests/flow-run-detail-reader.test.ts` (2)
- `summaries/tests/run-detail-preservation.test.ts` (1)
- `refuted-result/tests/reauthor-service.test.ts` (3, all at 60s)
- `service-adaptation/tests/`: `adaptive-retry-resume` (2), `context-history-reads` (1), `durable-patches` (2), `failed-start` (4), `llm-grants` (2), `modes` (2), `runtime-patches` (1), `subflow` (2)
- `service-bootstrap/tests/`: `adaptation` (1), `extend` (1), `generation` (1), `plan-parameters` (1), `rejections` (9)
- `service-flows/tests/`: `canonical-persistence` (1), `execution-digest` (2), `instruction-readiness` (1), `runs` (1), `subflow-index-read` (1), `subflow-pagination` (1)
- `service-recordings/tests/`: `proposals` (1), `recorded-gap` (1), `task-proposals` (2)
- `storage/project/tests/runtime-stream-store.test.ts` (10). Its "million events" test timed out at 60s, and the EBUSY errors on the SQLite files followed. The other 9 failed tests in this file probably failed because that one left the files locked.

**Real assertion failures (not timing):**
- `runtime/tests/service-bootstrap/tests/accounting.test.ts`
  - "attributes pre-provider and resolver failures without claiming a provider call" at :123 fails with `AssertionError: expected { …(6) } to deeply equal { …(5) }`. The received value has an extra `"issueCodes": ["thrown.Error", "thrown.at:runtime.tests.service-bootstrap.tests.accounting.test.ts:113"]`.
  - The same extra `issueCodes` field causes the failures at :280 "attributes invalid successful output…" (7 vs 6 keys), :377 "distinguishes unavailable, failed, and malformed provider resolution" and :402 "reports a generation-lock failure by its closed code…".
- `runtime/tests/service-bootstrap/tests/catalog.test.ts`
  - "reports unavailable canonical settings binding before provider resolution" fails because of the same extra `issueCodes` field (`thrown.at:...catalog.test.ts:57`).
  - Two more tests in this file also failed: "projects the bound native runtime grants…" and "reports required instruction capabilities…". Their output is too long to show both errors cleanly, so I did not confirm whether they failed on the same field or timed out.
- `runtime/tests/deepseek-bootstrap-exploration.test.ts` (5 failed)
  - "does not count bad replies across a good one": :579 `expected { …(8) } to be undefined`
  - "saves a creation that looked more than sixteen times": :601 `expected { …(7) } to be undefined`
  - "names the ending of an exploration that ran out after more than sixteen decisions": :631 `expected [1..17] to have a length of 20 but got 17`
  - "reproduces the measured 26-decision creation exhaustion…": `expected [ Array(23) ] to deeply equal [ Array(26) ]`
  - "asks again after a provider decision reaches its deadline" timed out at 30s.
  - The shortfalls of 17 against 20 and 23 against 26 suggest the decision loop stops about three decisions early. Load could also cause that, so this is not conclusive.

## Not verified
- I re-ran nothing. The brief allowed one re-run, but the machine was loaded, so a re-run would not have separated load from real regressions. The timeout failures are unconfirmed and may pass on an idle machine.
- I did not compare against `dev` to see whether these failures existed before t174.

## Open questions or contradictions found
- A new `issueCodes` field appears in bootstrap failure accounting, but the accounting and catalog test expectations do not include it. Either production code gained the field without the tests being updated, or the field should not be there.
- It is unclear whether the deepseek exploration decision counts (17 vs 20, 23 vs 26) are a regression.
