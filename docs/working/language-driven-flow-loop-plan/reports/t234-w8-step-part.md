# t234 W8: step log part and read phase

## Outcome

Done.

## What changed and why

All in Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t234/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/`.

- `scope.ts`: exports `AutomationStudioLlmStepLogPart = "creation" | "reauthor"`; `AutomationStudioLlmStepLogPhase` adds `"read"`; `AutomationStudioLlmStepLogContext` is now `{ round?: number; phase?: AutomationStudioLlmStepLogPhase; part?: AutomationStudioLlmStepLogPart }`. `run({ round, phase }, fn, env?)` merges into the current context (so it keeps `part`). New `within(patch: { part?; phase? }, fn, env?)` merges the patch into the current context. Both are plain `fn()` when the step log is off. Undefined patch fields are never written as keys, so the existing phases.test `toEqual([{ round: 0, phase: "explore" }, ...])` still holds.
- `model-step.ts`: meta.json gains `part: scope?.part ?? null`. New duck-typed `paidUsage(error)` reads `error.paid` (`inputTokens`, `outputTokens`, `cacheHitInputTokens`, `estimatedCostUsd`). Usage is now chosen as the first of call usage, `reply.usage`, `paid`, envelope usage that has input or output tokens (each passed through `usageOf`). Before, an empty first candidate shadowed the later ones. Cost comes from that usage's `estimatedCostUsd`, else from `call.price`.
- `tool-step.ts`: meta.json gains `part: scope?.part ?? null`.
- `naming.ts`: unchanged. Phase defaults still apply when no scope phase is set. Folder names and index.md columns are unchanged.
- New `tests/scope.test.ts` has 4 tests: run inside within({part:"creation"}) gives part creation with round 1 and phase repair (model and tool steps); within({part:"reauthor"}) then within({phase:"read"}) gives phase read with round null; no scope gives part null with the kind's phase; a failed step whose error has `paid` writes that usage and `costUsd`.

## Commands run and observed results

- From packages/fluxiq: `npx vitest run src/programs/automation-studio/runtime/llm/step-log src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build` -> 12 files, 78 tests passed.
- I swapped the HEAD versions of scope.ts, model-step.ts and tool-step.ts back in temporarily and ran `npx vitest run .../step-log/tests/scope.test.ts`. All 4 new tests failed. I then restored my versions, and `git diff --stat` shows my 3 files changed.
- `npx tsc --noEmit -p .` in packages/fluxiq -> 0 `error TS` lines, which includes other workers' concurrent edits as of that moment.

## Not verified

- W9's call site (creation-purse.ts) and W7's `paid` field on AutomationStudioLlmProviderError do not exist yet. The `paid` path is tested with a plain error-shaped object.
- No Lab or live run.

## Open questions or contradictions found

- None blocking. One behaviour change: an empty `reply.usage`, one with no input or output tokens, no longer shadows the envelope's usage.
