# W2 humanness: service lines (t898)

Outcome: Done.

## What changed (Core, packages/fluxiq/src/framework/automation-service)
- service.ts, chat attempt: `readAutomationStudioFlowBootstrapGenerationRequest(...)` destructure gains `humanness`; the attempt input is `{ ..., caller: answerFirstOptions, ...(humanness === undefined ? {} : { humanness }) }` (not via `caller`).
- service.ts, runRuntimeSession: `const canonical` (2 lines incl. comment) moved above `const graphOptions`, and the `automationStudioRunGraphOptions({...})` call gets `humanness: automationStudioFlowHumanness(canonical?.metadata) ?? input.humanness,` after `maxSteps`. `automationStudioFlowHumanness` added to the existing flow-settings import. Used `??` instead of `resolveHumanness` (identical for flow over starting value; saves an import line). Graph-options already omits the field when undefined.
- Why shaped this way: service.ts is at its baseline line and statement-packing budget; a separate added line or packed statement failed `structure:check`. Net lines 0.
- service/answer-first/tests/later-attempts.ts: lane options gain `humanness?` passed on the generate request (one field).

## Tests
- NEW tests/run-session-humanness.test.ts (real-sql): Flow 40 over start 90 -> 40; Flow 0 over 90 -> 0; start 90 alone -> 90; none -> no `humanness` key. Observed on options handed to `runAutomationStudioGraph`.
- REWRITTEN service/answer-first/attempt/tests/task-humanness.test.ts (no attempt-input mock; request `humanness` through generateFlowBootstrapAdaptation): new task stores 70 and explore runs; task 20 beats start 90; stored task 0 beats 90; Flow 50 is the run's level when task has none and no start given; start alone is stored and run at; none -> no `humanness` on options.
- Finding: with a starting value on the request a task with no level stores it first, so the task level (not the Flow's) wins; Flow-over-start only shows when the request has no start.

## Commands (via heavy-slot t898-svc)
- vitest run tests/run-session-humanness.test.ts -> 1 file, 4 tests passed.
- vitest run .../attempt/tests/task-humanness.test.ts -> 1 file, 4 tests passed (an earlier version failed on the Flow case above; wording fixed).
- `pnpm structure:check` -> passed (532 warnings, 969 baselined).
Not verified: tsc (OOM exit 134 locally), other answer-first tests, library build (left to supervisor).
