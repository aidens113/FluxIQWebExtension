# W2 humanness, chat path (lane t898)

## Outcome
Partial. Chat-turn to build/run request pass-through is done and tested. The run-session request now carries `humanness` into `runRuntimeSession`'s input, but it does not yet reach `AutomationStudioGraphExecutionOptions.humanness` (needs forbidden `service.ts`). The extension test could not run (Core `contracts` dist missing in the worktree).

## What changed (Core, under packages/fluxiq/src)
- `api-contracts/automation/conversation.ts` (the type is in this file, not `automation.ts`): `ConversationTurnAppendRequest.humanness?: number`, documented.
- `framework/automation-service/service/conversation-requests/requested-fields.ts`: new `requestedHumanness` (uses `humannessSchema`; throws `A turn's humanness must be an integer from 0 to 100.`, the convention of the other readers there).
- `.../conversation-requests/append-turn.ts` (~21): reads and validates before anything is written (a bad value rejects before `appendTurn`); passes it into `commandContext` only when present (~49).
- `.../conversation-requests/command-context.ts`: target accepts `humanness`, context carries it only when present.
- `runtime/conversations/commands/command.ts` (~106): context field `humanness?: number`.
- `runtime/conversations/commands/build.ts` (~198, ~256): `humanness` added beside `interpretationCalls`, only when present.
- `runtime/conversations/commands/run-flow.ts` (~70): `humanness` added to the `run-runtime-session` payload only when present. Note: the `taskRun` branch (answer-first, line ~68) does not receive it; that is lane t897 territory.
- `framework/automation-service/service/run-requests/run-session.ts`: payload type gains `humanness`; refused with `The run's humanness must be a whole number from 0 to 100.` unless `humannessSchema` passes; passed to `service.runRuntimeSession` only when present.
- `framework/automation-service/service/runtime-session/run-input.ts` (NOT in the brief's list; type-only, added `humanness?: number` to `AutomationStudioRuntimeSessionRunInput`, needed for the call to type-check).

## Extension
- `apps/extension/src/background/automation-relay/automation-relay.ts`: `AutomationRelayDeps.humanness?: () => number | undefined`; `runAutomation` adds `humanness` to the `run-runtime-session` body only when saved value is a number above 0.
- `apps/extension/src/background/index.ts` (~327, NOT in brief's list; one line): `automationRelayDeps` wires `humanness: () => manager.currentSettings().humanness` (same source as `panel-control-deps.ts:24`). Without it the dep is never set. No `panel/**` edit needed.

## Tests added
- `conversation-requests/tests/append-turn.test.ts` (new): 0/1/50/100 reach the context; 101, -1, 1.5, "x", null, NaN throw and nothing is written or started; absent leaves the context without the key.
- `run-requests/tests/run-session.test.ts` (new): accepts 0/25/100 and reaches `runRuntimeSession` input; refuses 101/-1/1.5/"x"/null before any run; absent input deep-equals `{ projectId, flowId }`.
- `commands/tests/build.test.ts`: create and extend include it when the context has it, omit key otherwise.
- `commands/tests/run-flow.test.ts`: payload deep-equals today's without it; with it adds `humanness: 60`.
- `automation-relay/tests/automation-relay.test.ts`: includes when 40, omits for 0 and undefined (existing test already proves the absent-dep payload is unchanged).

## Commands and results
- `pnpm --filter fluxiq exec vitest run` on the four test targets (conversation-requests, run-requests, build.test.ts, run-flow.test.ts): 4 files, 61 tests passed. Re-run of the two new dirs after lint fixes: 20 passed.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-chat node scripts/test-extension.mjs automation-relay`: FAILED to start, `ERR_MODULE_NOT_FOUND ... packages/client-gateway-websocket/node_modules/@fluxiq/contracts/dist/client-gateway.js` (Core's contracts dist is not built in this worktree). Not run; the supervisor must build contracts then run it.
- `node scripts/structure-audit.mjs` (extension): passed (245 warnings, 552 baselined).
- `pnpm structure:check` (Core): my own files passed after fixing an `as never` cast and statement packing in my new tests. Remaining FAILs are not mine: `engine/automation/pacing/{arrival-pause,humanness-seeded,trace-with-humanness}.ts` (imports reaching past a barrel) and `runtime/tests/client-gateway-transport.test.ts:116` (statement packing).

## Still needed elsewhere
- Run request to graph options: `framework/automation-service/service.ts:2487` (the `automationStudioRunGraphOptions({ carryActs, inputs, ..., maxSteps: input.maxSteps, ...` call) must pass `humanness: input.humanness`, and `framework/automation-service/service/runtime-session/graph-options.ts` needs `humanness?: number | undefined` in `RunGraphOptionsInput` (~line 56) and `if (input.humanness !== undefined) options.humanness = input.humanness;` in `runGraphOptions` (~line 101, beside `maxSteps`). Candidate trials (`trial-ports/environment.ts:46`) deliberately unchanged.
- `run-flow.ts` `taskRun` path (answer-first, t897) does not forward humanness.
- Extension test not run (see above).
