# t195-w31b: the chat interpreter's call inside the creation purse

## Outcome

Blocked. No source files changed. The brief's owned paths cannot carry the
interpreter's cost into the purse. Three links in the chain are in files the
brief does not own, and the one file it does allow (`R/service.ts`) is not
enough on its own. The details and a ready-to-brief design follow.

R = `packages/fluxiq/src/programs/automation-studio/runtime/` in the Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ` (branch `task/t195-live-control-flow`, HEAD `eed0cc34`).

## What I found (read, not guessed)

1. **The interpreter's cost is never measured.** The chat call is
   `R/llm/deepseek/panel-command.ts` (`createAutomationStudioDeepSeekPanelCommandModel`).
   It calls `fetch` itself rather than going through the harness, so
   `automationStudioLlmBuildPurseHoldCall` (`R/llm/build-purse/harness-hold.ts`)
   never sees it. `decide` returns only the content string. The cost is computed
   in just one place: the step log's `price` callback (`R/llm/step-log/model-step.ts`),
   and only when step logging is on. The port it implements
   (`R/conversations/instructions/model.ts`, owned) has no way to report spend. So
   `interpret.ts` (owned) has nothing to sum. **Missing ownership:
   `R/llm/deepseek/panel-command.ts`.**
2. **The interpretation does not reach create-here.** `respondToPersonTurn`
   (`R/conversations/conversations.ts:328`) spreads the interpretation into the
   response, so a new field would pass through. But `startAutomationStudioConversationCommand`
   (`R/conversations/commands/start.ts`) passes create-here only `context` and
   `invocation.arguments`, and `AutomationStudioConversationCommandContext`
   (`R/conversations/commands/command.ts`) has no field for it. **Missing
   ownership: `R/conversations/commands/start.ts` and `command.ts`.** I rejected
   the alternatives that stay inside owned files:
   - smuggling the figure through `invocation.arguments`: those are echoed to
     the client and parsed as capability arguments;
   - a module-level ledger keyed by conversation: shared mutable state, and still
     unreachable from where the purse is opened.
3. **create-here cannot reach the purse.** The purse is opened in
   `R/service/flow-bootstrap-commands/creation-purse.ts`
   (`automationStudioFlowBootstrapCreationPurse`, called at `R/service.ts:1550`).
   It opens from the record in `R/service/creation-spend.ts` (the store). create-here
   reaches Core only through registry calls (`commands/port.ts`). No endpoint
   writes the creation record. The build endpoint's request is read with
   `assertExactObjectFields` against a fixed `REQUEST_FIELDS` list
   (`R/service/flow-bootstrap-commands/generation-request.ts:21`), so it cannot
   take a new field either. **Missing ownership:
   `R/service/flow-bootstrap-commands/creation-purse.ts`, `generation-request.ts`,
   and the payload contract in `api/contracts/adaptation.ts` if that declares
   the fields** (I did not open it). Of these, `R/service.ts` is the only one I
   may touch. It needs one net-zero change, at line 1550, to pass the figure on.

## Carry in, or open early? Carry in.

The purse cannot be opened before the interpreter runs:

- **The purse belongs to a Flow.** It is keyed by `projectId` and `flowId`, and
  its record sits beside the Flow's file.
- **The Flow does not exist yet.** create-here makes it with `create-flow`
  after the interpretation.
- **Most messages never create a Flow.** The interpreter reads every message.

So the reading's settled cost has to be carried into the purse when it opens.
Because there is no purse before the call, the reading cannot be held at its
worst case beforehand. That worst case is small: 600 output tokens
(`PANEL_COMMAND_MAX_OUTPUT_TOKENS`). Once the cost is carried in as spent, the
purse's `hold` refuses any build call that would take carried + pending +
projected past the ceiling. So the creation's total stays within the ceiling
unless the reading alone costs more than the ceiling.

## Proposed design for a re-brief (partitioned by file)

- `R/conversations/instructions/model.ts`: add an optional `charge?(costUsd: number): void`
  to `AutomationStudioConversationModelExecution`.
- `R/llm/deepseek/panel-command.ts`: price the reply envelope's `usage` with the
  already-imported `estimateAutomationStudioDeepSeekCostUsd`, then call
  `execution.charge`. Do this for every attempt that got a 2xx reply, including
  one that fails to parse.
- `R/conversations/instructions/interpret.ts` and `decision.ts`: sum the charges
  across attempts into `AutomationStudioConversationInterpretation.spentUsd`.
  Zero for the fallback.
- `R/conversations/commands/command.ts` and `start.ts`: add
  `context.readingSpentUsd`, set from `response.spentUsd`.
- `R/conversations/commands/create-here.ts` and `build.ts`: send it on the build
  request, for a create only, as `readingSpentUsd`.
- `R/service/flow-bootstrap-commands/generation-request.ts`: accept it. It must
  be finite, at least 0, and allowed with `mode: create` only.
  - Trust: a client can only lower its own remaining budget with it.
- `R/service.ts:1550`: pass it into `automationStudioFlowBootstrapCreationPurse`,
  folded into the existing line (net zero).
- `R/service/flow-bootstrap-commands/creation-purse.ts`: add it to `carriedUsd`
  only when there is no creation record yet, so a later build never charges it
  twice.
  - The record it already saves (`spentUsd: purse.spentUsd()`) then includes
    the reading. That meets "the creation's recorded spend includes the
    interpreter's".
- Tests:
  - `instructions/tests/interpret.test.ts`: a scripted model charges X on each
    of two attempts, so `spentUsd` = 2X.
  - A `creation-purse` test: opened with reading X on a fresh Flow, `leftUsd()` =
    ceiling − X, a call projected at ceiling − X + ε is refused, and the saved
    record's `spentUsd` includes X. A second build does not add X again.

**Contradiction to resolve.** The build's accounting text in
`R/flow-bootstrap/unfinished-build/phases.ts:395` and `budget-exhausted.ts:111`
attributes `carriedUsd` to "earlier builds of this Flow". Folding the reading
into `carriedUsd` would misattribute it there, and both files are on the brief's
"Must not touch" list. To show the reading under its own name, either a separate
`readingUsd` on the purse refusal plus a wording change in those files is
needed, or that wording stays as it is.

## Commands run and observed results

Read-only inspection only (`cat`, `grep`, `sed` over the files named above). I
ran no vitest, tsc or structure audit, because no source was changed.

## Not verified

- `api/contracts/adaptation.ts`: I did not open it, so I do not know whether it
  declares the build request's payload fields.
- Whether any other chat model binding besides DeepSeek exists in production. I
  found only `createAutomationStudioDeepSeekPanelCommandModel` bound.

## Open questions or contradictions found

- The brief's owned paths do not include the cost source (`panel-command.ts`),
  the transport to the command (`commands/start.ts`, `command.ts`), or the purse
  open site (`service/flow-bootstrap-commands/creation-purse.ts`,
  `generation-request.ts`).
- The "shown in the build's accounting" wording lives in must-not-touch
  `flow-bootstrap/unfinished-build/*`.
