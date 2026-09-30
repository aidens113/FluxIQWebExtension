# t198-W4: web panel stops running what Core runs

## Outcome

Done.

## What changed and why

Repo `C:/Users/osrs_/FluxStuff/fxwork/t198/!FluxIQ`, W = `apps/web/src/features/automation-studio/conversation`.

- `W/instruction-commands.ts`
  - New exported type `ConversationInstructionExecution = { capabilityId, status: "done" | "started" | "failed", summary, error? }`. `ConversationInstructionResult` gains a required `execution: ConversationInstructionExecution | null`.
  - `instructionExecution()` reads `response.execution` forgivingly. It returns null when the value is absent, not an object, an array, has no non-empty string `capabilityId`, or a status outside the three. `summary` defaults to "". `error` is kept only when it is a non-empty string. Extra contract fields (`flowId`, `runId`, `adaptationId`) are not surfaced; the brief's shape did not ask for them.
  - When execution is non-null, nothing is dispatched locally and `dispatch` is null. When it is null, behaviour is unchanged: invoke + runNow dispatches through `runConversationCapability`.
  - Header comment now says that Core runs the capabilities it knows and the panel runs the rest.
- `W/useConversationThread.ts`: comment only, in `sendReply`. No code change was needed. See below.
- `W/tests/instruction-commands.test.ts`: three new cases, plus `execution: null` in the existing refused-case `toEqual`.
  - Execution present with done, started or failed means no local dispatch and only one `append-turn` call.
  - `execution: null` with runNow means a local dispatch.
  - Six unreadable execution values are each treated as null and dispatched locally.

### Refresh after send

I relied on existing code. `sendReply` calls `afterWrite` after every stored send, whatever the result. `afterWrite` reads the turns from the start and publishes `conversation.changed`. That mutation resets the backoff poller (`thread/poller.ts`) to its 1 s fast beat. The poller never stops: `active: () => true`, it decays to a 10 s ceiling, and it runs every 5 s while the tab is hidden. So a `started` result turn that arrives later is read within 10 s at worst, and sooner if it lands shortly after the send.

A send that was not stored (`ok: false`) is not re-read. Nothing was written in that case, which matches the behaviour before this change.

## Commands run and observed results

- From apps/web: `npx vitest run .../tests/instruction-commands.test.ts .../tests/conversation-instructions.test.tsx .../tests/conversation-view.test.tsx .../tests/conversation-architecture.test.ts`. Output: `Test Files 4 passed (4)`, `Tests 42 passed (42)`.
- From apps/web: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t198 W4 tsc" npx tsc --noEmit`. The script printed `[heavy] t198 W4 tsc holds b1` and nothing else, with exit code 0. That is the `check` script, `tsc --noEmit`. There were no errors anywhere, including in packages/fluxiq.

## Not verified

- Against the real Core `append-turn`: the other worker's executor was not exercised. The tests script the wire answer from the contract.
- Live browser behaviour of a `started` result turn arriving through the poller.

## Open questions or contradictions found

- The barrel `W/index.ts` (not owned) does not export the new `ConversationInstructionExecution` type. A consumer that needs it by name would have to add it there.
- The existing test "runs 'run my kettle flow' ..." still dispatches `run.execute` locally because its scripted response has no `execution`. That matches the contract: null means Core did not run it. Against a new Core, though, `run.execute` will always come back with an execution.
