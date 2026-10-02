# t194-w58 Lab call accounting

## Outcome

Done. `evaluation.json`'s `llm.calls` and the spend-ledger cost now count every provider call the run made. Both come from one figure, `liveLlmRunSpend` (`packages/test-runner/src/live-llm/run-spend.ts`), which is now reconciled against the run's own step log. Replayed on run-muqk713g-d08ad3dc's real bundle it gives **35 calls, $0.121156656**, which matches `steps/*/meta.json` exactly.

## True counts for run-muqk713g-d08ad3dc

Step folders: 35 provider calls, $0.121156656. By kind: chat 1 ($0.000305376), decide 29, judge 3, diagnose 1, repair 1. By phase:

| Phase | Steps | Calls | Cost |
| --- | --- | --- | --- |
| chat interpreter | 0001 | 1 | 0.000305376 |
| build | 0003-0025 decides (11) plus 0032 judge and 0033 decide | 13 | 0.047871768 |
| result check (judge) | 0034, 0035 | 2 | 0.00240468 |
| re-author | 0037-0063 decides | 17 | 0.061567476 |
| runtime | 0064 diagnose, 0065 repair | 2 | 0.009007356 |
| **Total** | | **35** | **0.121156656** |

The old figures were 17 calls (13 + 2 + 2 + 0) and $0.12085128 (the chat call was left out).

## Root causes

1. **Re-author calls (count only, not cost).** Core records the attempt's `accounting`, so the cost was already counted. It recorded no call count: the attempt has no `adaptationId` because the build failed with `flow_bootstrap.not_doable` at `provider_output_validation`, and `evidenceLoop` is written only when the failure diagnostic carries one. See Core `packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/reauthor.ts:225-226`. So `reauthor-record.ts` read `callsFrom: "not_recorded"` and `run-spend.ts` added 0 calls, listing `uncountedPhases: ["reauthor"]`. That part of the gap is in Core's record. I fixed the count downstream from the step log and did not change Core.
2. **Chat interpreter call (count and cost).** The `panel_command` call is in no record the settlement reads: not the build, the run detail, the interventions, or the re-author. Only Core's step log has it.

## What changed and why

- `packages/test-runner/src/live-llm/step-log-spend.ts` (new): `readLiveLlmStepLogSpend(stepsDirectory)` counts each complete `NNNN-*/meta.json` that names a `provider` as one call, sums `costUsd`, and groups both by `kind`.
  - Tool and test steps name no provider, so they are not counted.
  - A missing or cut-short meta is a step still being written, and is skipped.
  - A missing directory, or one with no provider calls, returns `null`.
  - Any other read error is raised, as the structure audit's failure-as-empty rule requires.
- `packages/test-runner/src/live-llm/run-spend.ts`: takes an optional `stepLog` input.
  - New phase `chat`, taken from the log's `chat` kind.
  - If the re-author is uncounted, it gets the calls the log saw beyond every counted phase (`filledReauthorCalls`), and `uncountedPhases` empties.
  - Any calls or cost still beyond the phases are added as `stepLog.unattributed`. A log that saw fewer calls takes nothing away. A cost gap under $1e-8 is treated as rounding.
  - New output field `stepLog: { calls, estimatedCostUsd, filledReauthorCalls, unattributed } | null`.
  - `perBuild` is unchanged, because the chat call is not a build.
- `packages/test-runner/src/live-llm/live-llm-run.ts`: new `readStepLogFrom(dir)`. `writeSnapshot` re-reads the log on every settlement before it computes the spend, so `observed.calls` and `observed.totalEstimatedCostUsd`, `runSpend`, the settle event's `runTotal` and `usage.calls` all include it.
  - The ledger reads `observed.totalEstimatedCostUsd` (`scripts/lab/live-guards/run-outcomes.mjs:51`).
  - `evaluation.json`'s `llm` block is `live.usage` (`run-scenario.ts:708`).
- `packages/test-runner/src/live-llm/index.ts`: barrel exports for the new module and type.
- `packages/test-runner/src/run-scenario.ts`: one line after `LabRunRecord.open` hands `labRun.stepsDirectory` to `live.readStepLogFrom`. This is the only wiring point, and it falls outside the brief's named owns, so the supervisor should check it.
- Tests:
  - `live-llm/tests/step-log-spend.test.ts` (new, 2 tests).
  - `live-llm/tests/run-spend.test.ts`: 2 new tests, and 2 existing deepEquals now include `chat: null` and `stepLog: null`.
  - `live-llm/tests/live-llm-run.test.ts`: 1 new end-to-end test through `LiveLlmRun` with a real temporary step log, and 1 existing deepEqual gains `chat: null`.

## Commands run and observed results

- Failing first: `npx tsc -p tsconfig.json` (emitted, with type errors for the missing API), then `node --test dist/live-llm/tests/run-spend.test.js dist/live-llm/tests/step-log-spend.test.js dist/live-llm/tests/live-llm-run.test.js`.
  - Result: `not ok` for 7 tests: "a run that re-authored reports every call ...", "a run whose step log Core wrote counts every call ...", "a run whose own accounting leaves the result check out ...", "a run with nothing settled ...", "the run's step log fills the calls ...", "a step log that saw calls no phase claims ...", and the `step-log-spend.test.js` file (module missing).
- After the change: `bash heavy.sh ... npx tsc -p tsconfig.json` gave rc 0. The same three files gave `# tests 32 # pass 32 # fail 0`.
- `npx tsc --noEmit -p packages/test-runner/tsconfig.json`: rc 0.
- `node --test packages/test-runner/dist/live-llm/tests/*.test.js` (the owning directory): `# tests 121 # pass 121 # fail 0`.
- `node scripts/structure-audit.mjs`: rc 1, with 2 violations, neither mine.
  - `[directory-files] apps/extension/src/content/extraction/tests/: 26 source files`.
  - `[directory-files] domain/src/runtime/llm-evidence/node-run/tests/: 26 source files`.
  - Both come from other workers' new, untracked test files in this tree: `list-reader-earlier-page-repeats.test.ts` and `replay-read-rows.test.ts`.
  - The audit first flagged failure-as-empty in my `step-log-spend.ts`. I fixed that by naming ENOENT and `SyntaxError` and rethrowing everything else; it no longer appears.
- Replay on the real bundle: `readLiveLlmStepLogSpend(<bundle>/steps)` gives `{"calls":35,"estimatedCostUsd":0.121156656,...}`. `liveLlmRunSpend` with the snapshot's build, runtime, judge and re-author records plus that log gives `35 0.121156656`, re-author 17 calls, chat 1, `filledReauthorCalls: 17`, `unattributed {0,0}`, `uncountedPhases []`.

## Not verified

- No live run: the new snapshot fields have not been seen end to end in a real Lab run.
- Timing: I assumed Core has written every step's `meta.json` before the last settlement (`settleRepair`) runs. A call whose meta lands after the final snapshot would still be missed. The evidence fits that assumption (the repair step 0065 comes before the settle), but I have not proven it.
- Full `pnpm --filter test-runner test` and `lab-runs` tests were not run (narrow checks only).

## Open questions or contradictions found

- The structure audit fails on `dev`-tree files owned by other workers, so the audit gate will fail until those directories are grouped.
- A Core follow-up would record a call count on every re-author attempt, including a failed one with no `evidenceLoop` (`reauthor.ts:225-226`). The step log covers it downstream for now.
- `run-scenario.ts` is outside the brief's named owns, but the run needed that one line to pass the step-log path to `LiveLlmRun`.

## Commit message

```
Lab: count every provider call from the run's step log in llm.calls and the spend ledger

run-muqk713g-d08ad3dc's evaluation said 17 calls and its ledger $0.12085128,
while its step log held 35 calls for $0.121157: a failed re-author's 17 calls
(Core recorded their cost and no count) and the chat's interpreter call (in no
record the settlement reads) were left out. The run spend now reads Core's
step log on every settlement: the chat's calls are a phase of their own, an
uncounted re-author takes the calls the log saw beyond every counted phase, and
anything else beyond them is added as unattributed, never counted twice.

Task: t194
Worker: t194-w58
```
