# Sweep 2026-10-19 (Brief S1)

## Outcome

Done. Every command ran. Three of the eight failed: the Core tests, the downstream check and the downstream tests. Nothing was fixed.

Commits swept, each at `origin/dev` and in a fresh detached worktree under `C:/Users/osrs_/FluxStuff/fxwork/sweep-1019/`:

- FluxIQ Core: `a22b3a0f` (docs: regenerate working-document index)
- FluxIQWebExtension: `bb92ad17` (docs: record verified fixes F4, F6, F7, F9)

The full logs are in that folder (`<name>.log`), and `exits.txt` lists the exit codes. The script that ran them all is `run.sh`.

## What changed and why

Nothing in either repository changed. The only new file is this report.

## Commands run and observed results

| Command | Exit | Totals |
| --- | --- | --- |
| Core `pnpm install` | 0 | |
| Downstream `pnpm install` | 0 | |
| Core `pnpm build` | 0 | |
| Core `pnpm check` | 0 | |
| Core `pnpm test` | 1 | contracts: 14 files, 178 tests, all passed. client-gateway-websocket: 2 files, 10 tests, all passed. packages/fluxiq: 1447 files (13 failed, 1431 passed, 3 skipped); 12777 tests (29 failed, 12741 passed, 7 skipped). apps/web: 389 files (3 failed, 386 passed); 3123 tests (56 failed, 3067 passed). |
| Downstream `pnpm check` | 1 | The extension typecheck failed with 2 TypeScript errors. The structure audit and the script tests earlier in the run passed. |
| Downstream `pnpm test` | 1 | boundary-audit 6/6, real-site-policy 7/7, test-contracts 170/170, test-matrix 17/17. domain: 2166 tests, 2165 passed, 1 failed. pnpm stops at the first failing package, so the extension package's own tests did not run. |
| Downstream `pnpm build` | 0 | |

### Core packages/fluxiq failures (29 tests in 13 files)

All paths are under `packages/fluxiq/src/programs/automation-studio/`.

- `runtime/executor/tests/ask-activity.test.ts`, 6 failed, all in the group "a run's wait on the person, in the activity stream":
  - "opens with the ask id and settles on Continue / Stop / nobody answering with one row for the same ask" (3 tests)
  - "settles as cancelled for a run cancelled while it waited"
  - "settles as cancelled when the thread could not be read, or the answer could not settle the ask"
  - "settles a parked run's wait when it is resumed with the answer"
  - Message: `expected [ Array(2) ] to deeply equal [ Array(2) ]`; one case shows Array(4) instead.
- `runtime/flow-bootstrap/tests/site-reset-build.test.ts`: "lane D: an undo on the act's own row is admitted but removes nothing unasked; refused, the act is kept and the model is told plainly". Message: `expected 'That undo was not allowed, so nothing…' to contain 'this act stays as it is'`.
- `runtime/flow-bootstrap/tests/site-reset-calls.test.ts`: "asks about a removal the ledger admits on the act's own item with nothing unasked, and tells the model plainly when it is refused (t475)". Same message as above.
- `storage/canonical-authority/tests/whole-operation.test.ts`, 3 failed:
  - "has one sql writer admission while the actual first effect is pending"
  - "has one file writer admission while the actual first effect is pending"
  - "refuses unsupported graph input before admission or any canonical effect"
  - Message: `Test timed out in 15000ms`.
- `storage/canonical-authority/tests/whole-process.test.ts`, 6 failed: "actual built sql kill after project_flow_document / flow_source / generated_config / sql_flow_metadata / project_change_feed / project_complete preserves both-participant hold". Message: `Test timed out in 30000ms`. The file ran for 320 seconds.
- `runtime/service/recordings/tests/entry-removal-command.test.ts`: "removes the event's entries, persists the removal, and refuses nothing it did not find". Message: `Test timed out in 15000ms`.
- `runtime/tests/service-adaptation/tests/context-history-reads.test.ts`: "fails a run's start when its history cannot be read". Message: `Test timed out in 15000ms`.
- `runtime/tests/service-flows/tests/subflow-index-read.test.ts`: "fails when the subflow index cannot be read, instead of listing no Subflows". Message: `Test timed out in 15000ms`.
- `runtime/flow-bootstrap/plan/tests/extraction-vocabulary.test.ts`: "is sent with the request the value is written into, not held back for a later one". Message: `expected 4394 to be less than or equal to 4000`.
- `runtime/flow-bootstrap/plan/tests/issue-feedback.test.ts`: "names every issue at its path, and gives the record output shape it accepts once for that parameter". Message: `expected { parameter: 'recordOutput', …(4) } to deeply equal { parameter: 'recordOutput', …(4) }`.
- `runtime/llm/deepseek/tests/system-prompt.test.ts`, 4 failed:
  - "is byte-identical to the pre-change message for loop_verification"
  - "is byte-identical to the pre-change message for loop_verification_build_test"
  - "keeps every word of Core's message for loop_verification, and adds the domain's"
  - "keeps every word of Core's message for loop_verification_build_test, and adds the domain's"
  - Message: `expected 'Return exactly one JSON object matchi…' to be 'Return exactly one JSON object matchi…'`.
- `runtime/result-verification/request-rows/tests/kept-condition-advice.test.ts`, 2 failed:
  - "is a no Core's record does not wholly refute, so t607 does not ask it again either". Message: `expected true to be false`.
  - "is not asked again: the trial stays unconfirmed, with no third call". Message: `expected [3 items] to have a length of 2 but got 3`.
- `runtime/tests/refuted-result/tests/failed-step-reauthor.test.ts`: "re-authors once: a re-run that fails at a step again is handed back failed". Message: `expected "spy" to be called 1 times, but got 0 times`.

### Core apps/web failures (56 tests in 3 files)

- `apps/web/src/features/automation-studio/tests/architecture-contract.test.ts`: "forbids imports of sibling domain-private modules". Message: `expected [ Array(1) ] to deeply equal []`.
- `apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract.test.ts`, 54 failed in "every chat capability sends a request Core accepts". These are one test per capability variant: flow.*, run.*, version.*, adaptation.*, subflow.*, route.*, project.*, data.delete, recording.*, conversation.start, permission.revokeClient. The one per-variant error the log prints is `AutomationInstructionError: Write active instructions in this automation's Instructions before running or building it.` Vitest groups identical errors, so this is most likely the shared cause, but I did not confirm it for each variant. The summary test "reaches every endpoint each capability declares, across its variants" fails with `Declared endpoints no variant reached. Add a variant in core-contract-arguments.ts.: expected [ 'flow.create -> create-flow', …(56) ] to deeply equal []`.
- `apps/web/src/features/automation-studio/conversation/capabilities/tests/coverage.test.ts`: "keeps the excuse list from rotting". Message: `The panel no longer writes these, so they no longer need excusing.: expected [ …(2) ] to deeply equal []`.

### Downstream check failures

- `apps/extension/e2e/site-reset/tests/installed-project.spec.ts(125,47)`: error TS7006, Parameter 'tool' implicitly has an 'any' type.
- `apps/extension/e2e/site-reset/tests/installed-project.spec.ts(316,216)`: error TS7006, Parameter 'error' implicitly has an 'any' type.

### Downstream test failure

- `domain/src/runtime/tests/adapter.test.ts`, compiled to `domain/.test-build/runtime/tests/adapter.test.mjs:6179`: "a succeeded command keeps its status and promotes the client's message". Message: deepStrictEqual expected `{ outputId: 'web.dom.click' }`, but the actual result also had `sessionId: 'session.one'`.

## Not verified

- The extension package's own tests (`apps/extension` test) never ran, because pnpm stopped the recursive run at the domain failure.
- The timeouts in whole-operation, whole-process, entry-removal, context-history and subflow-index may depend on machine load. I did not rerun them alone.
- I read the shared AutomationInstructionError cause of the core-contract failures from the log once. I did not check it for each variant.
- I did not diagnose any failure, as the brief asked.

## Open questions or contradictions found

None. The worktrees are left in place as instructed.
