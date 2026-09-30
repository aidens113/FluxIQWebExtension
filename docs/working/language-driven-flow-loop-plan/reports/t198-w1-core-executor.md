# t198 W1: Core conversation command executor and API wiring (worker report)

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t198/!FluxIQ`, branch `task/t198-extension-chat-builds`. Nothing committed.
`P` = `packages/fluxiq/src/programs/automation-studio`.

## Outcome

Done. When `append-turn` (with capabilities) decides `invoke` + `runNow` for an id in Core's catalog, Core runs it server-side through the program registry as the caller, and answers `payload.response.execution` per the contract. Type check clean, structure audit passes, 127 tests pass across the brief's set plus activity and registration pins.

## What changed and why

### New: `P/runtime/conversations/context/` (ambient thread)
- `storage.ts`: `AutomationStudioConversationAmbient` type ({projectId, conversationId}) and the AsyncLocalStorage instance. It imports only `node:async_hooks`, so the activity stream can read it without pulling in the store.
- `run.ts`: `runInAutomationStudioConversation(ambient, work)`.
- `current.ts`: `currentAutomationStudioConversation(projectId)`, which returns null when the ambient thread belongs to another project.
- `index.ts` barrel; `tests/context.test.ts`.

### New: `P/runtime/conversations/commands/` (the executor)

Exported names, by file:

- `command.ts` (types only):
  - `AutomationStudioConversationCommandPort`, `...CallResult`, `...Host` (appendAutomationTurn, pendingAsks, getAsk), `...Context`, `...Outcome`, `...Confirmation` and `...Command`.
  - `AutomationStudioConversationCommandExecution` = `{ capabilityId, status: "done"|"started"|"failed", summary, error?, flowId?, runId?, adaptationId? }`.
- `caller.ts`: `AUTOMATION_STUDIO_PAIRED_CLIENT_SESSION_PREFIX = "client-gateway:"`, `AutomationStudioConversationUnlockedSessionResolver`, `AutomationStudioConversationEffectiveCaller`, and `automationStudioConversationEffectiveCaller(actor, resolver)`.
  - A paired actor gets the resolver's session and `keyLocked: false`.
  - With no unlocked session it keeps its own session and gets `keyLocked: true`.
  - A non-paired actor is unchanged.
- `port.ts`: `automationStudioConversationCommandPort({ registry, actor, scope })`.
  - It calls `registry.call` as that actor and scope.
  - It refuses any endpoint whose registry classification is not `read` or `authoring`, and any endpoint that does not exist.
- `progress.ts`:
  - `automationStudioConversationCommandProgress(title, keyLocked)` records the steps that landed. A failure reads `"<title>" stopped because <cause>. Before that I <steps>.` or `Nothing was changed.`, and adds a locked-key sentence for a paired caller with no unlocked session.
  - `automationStudioConversationCallCause(what, response)` includes the build diagnostic's `stage: code` when present.
- `page.ts`: `automationStudioConversationPageShown(url)` returns origin+path for http/https and null otherwise.
- `argument.ts`: `automationStudioConversationCommandText(args, name)`.
- `build.ts`: `buildAutomationStudioFlowFromConversation(context, { flowId, mode })`.
  - It calls `generate-flow-bootstrap-adaptation` with `{projectId, flowId, authSessionId: context.sessionId, evidenceGuided: true}`.
  - It adds `startLocation` (when there is a page) for `create`, or `mode: "extend"` for improve. An extend is sent no startLocation.
  - It reports `awaitingPermission` when the build finished carrying a `permissionRequest`.
- `apply.ts`: `applyAutomationStudioConversationAdaptation`: `review-flow-adaptation` approve, then apply.
- `answer-words.ts`: `automationStudioConversationAnswerFromWords(ask, words)`.
  - Yes/no words map to grant/deny. Anything ambiguous answers null.
  - A choice matches the option id or label, an ordinal, the words unique to one option, then the closest name.
  - An open ask takes the words as text.
- Commands:

| Constant | Id | Runs | What it does |
| --- | --- | --- | --- |
| `AUTOMATION_STUDIO_CONVERSATION_CREATE_HERE` | `flow.createHere` | background | `create-flow` (name from the instruction's first sentence, 80 characters at most, when absent), then `save-flow-generation-instruction`, then the create build from the page, then approve and apply |
| `AUTOMATION_STUDIO_CONVERSATION_DESCRIBE` | `flow.describe` | in the request | `save-flow-generation-instruction` |
| `AUTOMATION_STUDIO_CONVERSATION_EXPLORE` | `flow.explore` | background | Saves the instruction if one was given, runs the create build from the page, then approves and applies |
| `AUTOMATION_STUDIO_CONVERSATION_IMPROVE` | `flow.improve` | background | `save-flow-instruction` (title `Improvement: <opening>`, `requirement: "required"`, `tags: ["generation"]`, as the web's `improvementInstruction`), then the extend build, then an outcome carrying a confirm |
| `AUTOMATION_STUDIO_CONVERSATION_RUN_FLOW` | `run.execute` | background | `run-runtime-session {projectId, flowId}` and reports how the run ended |
| `AUTOMATION_STUDIO_CONVERSATION_ANSWER_ASK` | `ask.answer` | in the request | Settles the ask named, or the newest pending ask in the thread, through `answer-ask` |
| `AUTOMATION_STUDIO_CONVERSATION_APPLY_CHANGE` | `adaptation.apply` | in the request | Runs only from a granted confirmation, and is not in the model catalog |

  - Explore applies only onto a blank Flow. It applies only after a create-mode build succeeds, and Core accepts create mode only on a blank Flow (`flow-bootstrap/extend.ts`). On a Flow with steps the build is refused and the thread says so.
  - `ask.answer` never grants an ask whose consequences (for a permission ask, its `missing`) include `delete` or `move_money`. It says the PIN is needed on the question itself.
- `catalog.ts`: `AUTOMATION_STUDIO_CONVERSATION_COMMANDS` (a Map of the six model-facing ids).
- `vocabulary.ts`: `automationStudioConversationCommandVocabulary(capabilities)`. Core's descriptor replaces a client's for catalog ids. Order is kept and no id is added.
- `work.ts`: `automationStudioConversationCommandWork` with `track`, `idle()` (the idle-wait for tests), `pending()` and `takeUnreported()`. `takeUnreported()` returns failures that could not be written into their thread.
- `confirmation.ts`: `AUTOMATION_STUDIO_CONVERSATION_COMMAND_ASK_PREFIX = "conversation-command."`, `AUTOMATION_STUDIO_CONVERSATION_COMMAND_ATTACHMENT = "conversation-command"` and `askToConfirmAutomationStudioConversationCommand`.
  - The ask is a confirm with `parks: false` and `consequences: ["modify_existing"]`.
  - Its attachment ref is base64url `{capabilityId, arguments}`, at most 1000 characters.
- `execute.ts`: `executeAutomationStudioConversationCommand({ command, context, arguments })`.
  - It runs inside the ambient thread context.
  - Background commands are tracked and answered `started`. Foreground commands answer `done` or `failed`.
  - It always writes the result turn with attachment `{ kind: "panel-capability-result", ref: capabilityId }`, then any confirm ask. A command that throws becomes a failed result turn.
- `confirmed.ts`: `runConfirmedAutomationStudioConversationCommand({ ask, attachment, context })`.
  - It returns null unless the ask has the prefix and was answered grant.
  - An unreadable ref, or a capability not on its confirmable list (only `adaptation.apply`), runs nothing and writes a turn saying so.
- `start.ts`: `startAutomationStudioConversationCommand({ response, context })`. It returns null when nothing is Core's to run, and never throws.
- `index.ts` barrel; tests in `tests/execute.test.ts`, `tests/answer-words.test.ts` and `tests/port.test.ts`.

### Edited
- `P/runtime/conversations/conversations.ts`:
  - `openConversation` with no `conversationId`, inside an ambient context for the same project, returns the ambient thread if it is open.
  - New `bindUnlockedSessionResolver(resolver)` and `callerFor(actor)`.
  - New `pendingAsks({projectId, conversationId})`: pending asks among the newest 50 turns, oldest first.
  - New `getTurn({projectId, conversationId, turnId})`.
  - `respondToPersonTurn` fills `onScreen.flowId` from the thread's subject when that subject is a Flow and none was sent.
- `P/runtime/conversations/index.ts`: exports `context/` and `commands/`.
- `P/runtime/conversations/instructions/decision.ts`: `AutomationStudioConversationOnScreen.pageUrl?`.
- `P/runtime/conversations/instructions/prompt.ts`: the model is told the page's origin+path only.
- `P/runtime/activity/emit.ts`: stamps the ambient `conversationId` when the scope has none and the projects match.
- `P/api/handlers/conversations.ts`, `append-turn` with capabilities:
  - `requestedOnScreen` accepts `pageUrl` if it is http/https, at most 2048 characters, and has no whitespace or control characters. Any other value is dropped, not refused.
  - The capabilities pass through `automationStudioConversationCommandVocabulary`.
  - The model caller is `callerFor(actor)`.
  - After the decision it calls `startAutomationStudioConversationCommand`. The port is built with the actor's `sessionId` replaced by the effective one, and the page is the start location.
  - The response is `{ ...response, execution }`, and `execution` is null when Core runs nothing.
- `P/api/handlers/conversations.ts`, `answer-ask`:
  - For a `conversation-command.` ask, it reads the ask before answering and runs the confirmation only if the ask was pending. An exact resend therefore applies nothing twice.
  - The payload becomes `{ ask, execution }` in that case, and stays `{ ask }` otherwise.
- `P/api/contracts/conversation.ts`: `onScreen.pageUrl`, a doc comment on Core-run ids, and `ConversationCommandExecution` (an alias of the runtime type).
- `P/api/handlers/tests/conversations.test.ts`:
  - The stub gains `callerFor`, `getAsk`, `getTurn`, `pendingAsks` and `appendAutomationTurn`.
  - The expected response gains `execution: null`.
  - Four new cases: the paired client under the unlocked session; `pageUrl` refusals; a confirmation applied once; and a real store where the thread subject is a Flow, "run it" runs in the background and a result turn is written.
- `packages/fluxiq/src/programs/_shared/runtime.ts`: `automationStudio.conversations.bindUnlockedSessionResolver((userId) => secretKeys.unlockedSessionFor(userId))`. W2's method was already present, and tsc is clean.
- `P/api/handlers/register.ts`: not changed. The existing `{ registry, service }` record already carries what the handler needs.

## Commands run and observed results

- From `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/conversations src/programs/automation-studio/api/handlers/tests/conversations.test.ts src/programs/automation-studio/runtime/activity src/programs/automation-studio/api/handlers/tests/domain-scope.test.ts src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts`.
  - This is the brief's set plus activity, domain-scope and registration pins.
  - It covers the new `commands/tests/*` and `context/tests/*`.
  - Observed: `Test Files 15 passed (15)`, `Tests 127 passed (127)`. This was after the final barrel-import change.
  - An earlier run had 1 failure (`answer-words` could not pick an option from "the large one please"). It was fixed by matching the words unique to one option.
- From the Core root: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t198 W1 tsc" npx tsc --noEmit -p packages/fluxiq`. Observed: `[heavy] t198 W1 tsc holds b3`, exit 0, no errors.
  - One early tsc ran outside the slot by mistake. It caught a regex that my edit script had mangled.
- From the Core root: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t198 W1 structure" node scripts/structure-audit.mjs`. Observed: `structure-audit: passed (197 warning(s), 354 baselined)`, exit 0.
  - The first run failed 6 `[imports]` findings (file imports instead of barrels), all fixed.
  - A warning remains that `commands/` has 24 source files, past the 15-file advisory; the limit is 25.
  - It also prints "1 baseline entries can be lowered"; I did not run `pnpm structure:baseline`.

## Not verified

- No live build, run or extension session. Every registry endpoint the commands call was faked, at the port or as stub registrations. The real `generate-flow-bootstrap-adaptation`, `review-flow-adaptation` and `run-runtime-session` were not exercised through the executor.
- It is not verified whether a Flow created by `create-flow` has a usable model key or settings for the build. The web's `flow.improve` checks the Flow's DeepSeek binding first; Core's command relies on the build's own diagnostic instead.
- Whether the paired actor's permission set includes `flows.write` and `runtime.control` is outside this code. If it does not, the registry refuses and the thread says "Permission required: ...".
- The ambient-context routing of a real service build's parking port (`service.ts` builds `parkingPort` on subject flow) was tested with a writer on subject flow, not with the real service.
- The apps/web typecheck and tests were not run. The contract changes are additive.

## Open questions or contradictions found

- `commands/` and `instructions/` barrels now import each other (prompt.ts needs `automationStudioConversationPageShown`, and commands use `instructions`' closest-name and constants). All cross-uses are at call time, so evaluation order is safe, and tests exercise both entry orders. The audit requires barrel imports, and I own no new file in `instructions/` where the helper could live without the cycle.
- The brief says to apply explore's change "only if the build was mode create on a blank Flow". The executor always sends create for explore, and Core refuses create on a non-blank Flow, so the check reduces to "the build succeeded". A Flow with steps gets a failure pointing at no alternative; `flow.improve` is the path for those.
- A build that finishes still carrying a `permissionRequest` is reported as failed, with its steps not applied. There is no Core-side "apply it" id in the model catalog; only the improve confirmation applies.
