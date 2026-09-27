# t170 Core integration report

## Outcome

Completed the owned Core reconciliation. Runtime grants no longer restrict model work by purpose, dry-run, side-effect, risk, or task-kind gates; all purposes iterate and `build_and_adapt` is supported internally. The silent harness registry gate and plan-risk promotion were removed, the diagnosis/judge instructions and DeepSeek explored-evidence dependency were reconciled, and the public runtime-intent assertions retain the intended public union.

Provider retry now composes with authorization: `providerRetryCount` is a bounded numeric allowance (0–2), each retry still consumes a real grant use, and a resolved provider is capped to the attempts its remaining uses can fund. The integration test proves a transient 503 succeeds when a grant has spare uses and does not retry when only the last use remains.

Screened judge repair data now travels on the live failed-attempt trace as a bounded structured directive and is copied into recovery context independently of the 1,024-character failure prose. The boundary test proves advice beyond the flattened-prose truncation point still reaches recovery intact; no model prose was added to persisted result records.

## Focused validation

- `npx tsc --noEmit` in `packages/fluxiq`: passed.
- Consolidated focused Vitest command covering executor, result verification, action permissions, provider retry, grant tests, harness options, recovery context, DeepSeek recovery requests, iterating recovery, flow-bootstrap plan, and API LLM contract: 55 files / 769 tests passed.
- Final retry/grant rerun after dependency-boundary cleanup: 7 files / 90 tests passed.
- `node scripts/structure-audit.mjs`: failed with 3 violations. Two were outside this brief's edits (`runtime/llm/tests` has 26 files; `deepseek/preflight.ts` bypasses the harness barrel). The owned `deepseek/system-prompt.ts` deliberately imports the explored-evidence leaf because importing its harness barrel creates an initialization cycle and caused 29 runtime test failures; focused tests are green with the leaf import. The audit also reports two baseline entries can be lowered.

## Not run

No repository-wide checks/build, live Lab run, commit, or push was performed, per the worker brief.
