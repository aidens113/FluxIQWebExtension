# Lane S-A (t728): Core publishes the run accounting the Lab reconstructs

Worker report for brief S-A (audit finding 6). Core tree:
`C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ` on branch `task/t728-single-sources-telemetry`.
Nothing was committed and Core dist was not built.

## Outcome

Done. All five items are in place, with tests. `pnpm --filter fluxiq check` exits 0, the
structure audit passes, and every vitest file beside the changes passes (counts below).

## What changed and why

Paths are relative to `packages/fluxiq/src/programs/automation-studio/`. AS is that directory
and RT is `AS/runtime`.

### 1. Exhausted balance gets its own code

- `RT/llm/provider-contract.ts`: adds `llm.provider_balance_exhausted` to
  `AUTOMATION_STUDIO_LLM_PROVIDER_CALL_ERROR_CODES`. Its provenance is attempted/received, and
  its safe message is "The LLM provider refused the request because the account's balance is
  exhausted."
- `RT/llm/failure-disposition.ts`: maps it to `end_model_calls`, so it is not a spent call and
  is never retried.
- `RT/llm/deepseek/balance-exhausted.ts` (new): `automationStudioDeepSeekBalanceExhausted(status, error)`
  returns true for HTTP 402. It also returns true when the screened error `code`, `type` or
  `message` matches `/insufficient[\s_-]*(?:account[\s_-]*)?(?:balance|quota|credits?|funds)/i`,
  whatever the status.
- `RT/llm/deepseek/provider.ts` `deepSeekRefusalFailure`: runs this check before the 401/403/429
  checks. The thrown error is `retryable: false`, keeps its status, and carries the screened
  refusal as before.
- `RT/llm/deepseek/panel-command.ts` `httpFailure(status, envelope)`: the same check, reading
  `envelope.value.error`.
- `RT/flow-bootstrap/generation-failure/codes.ts`, `failure-state.ts` and `harness-failure.ts`:
  map the new code to `flow_bootstrap.provider_balance_exhausted`, stage `provider_request`, rule
  `{retryable:false, attempted, received}`. `llm/unanswered-calls.ts` needed no change, because
  an exhausted balance ends the calls; it is not a "no answer".
- The step log already writes `meta.error.code` from the thrown code, so it now records
  `llm.provider_balance_exhausted`. Build failures carry `flow_bootstrap.provider_balance_exhausted`,
  and re-author attempts carry the same `code`.
- `RT/conversations/instructions/interpret.ts`: the chat tells the person "the model account's
  balance has run out, so add credit with the model provider and try again" instead of "the
  model call failed".

### 2. `instructedConsequences` on failed builds

- `generation-failure/diagnostic.ts`: adds the optional field
  `instructedConsequences?: AutomationStudioActionConsequence[]`. It holds consequence classes
  only, deduplicated, in Core's order. The gate's quote, instruction id and digest are never
  stored, so person words stay out of the diagnostic.
- `diagnostic-parse.ts`: an allowed field. A stored value must be a non-empty list of known
  classes, each listed once, in Core's order; anything else is refused.
- `generation-catch.ts`: takes an optional 6th parameter `instructed` and attaches the classes.
- `RT/service.ts`: three existing lines edited, with no lines added (the file stays at 4318).
  `let buildProviderCharge …, buildPermissions …` is declared as one statement, and
  `permissions = buildPermissions = automationStudioFlowBootstrapActionPermissions(…)` assigns
  it. The catch passes `buildPermissions?.instructed()`. `action-permissions.ts` was not edited.
- `RT/service/runtime-adaptation/reauthor-build.ts` `automationStudioRefutedResultFailureOf`
  carries the field into `AutomationStudioRefutedResultFailure`.
- `RT/recovery/refuted-result/reauthor.ts` writes it on the attempt record.

### 3. Call count on failed re-authors

- `AutomationStudioRefutedResultFailure` gains `calls?: number` and
  `instructedConsequences?: readonly string[]`.
- `automationStudioRefutedResultFailureOf` sets `calls` from `diagnostic.totalProviderCallCount`.
- If that is absent, the new `withReceiptCalls` sets `calls` from the build purse receipt's
  `charged.calls`. It does this only when the receipt was observed and consistent, and the count
  is a whole number.
- `COST_BOUND_FAILURE` (a build that was never started) now carries `calls: 0`.
- `automationStudioRefutedResultReauthored` writes `calls` and `instructedConsequences` on each
  attempt in `metadata.resultReauthor.attempts[]`.

### 4. Chat interpreter call count

- `interpret.ts` counts each priced attempt (`pricedCalls`). It is published beside `costUsd` as
  `pricedCalls` on `AutomationStudioConversationInterpretation` (`instructions/decision.ts`). It
  is left out of the client response, the same way `costUsd` is.
- From there the count travels as `interpretationCalls` beside `interpretationCostUsd`, through
  these files:
  - `conversations.ts`
  - `instructions/request.ts`
  - `commands/command.ts`
  - `commands/build.ts`
  - `commands/run-flow.ts`
  - `AS/api/handlers/conversations.ts`
  - `AS/api/contracts/adaptation.ts`
  - `AS/api/handlers/llm-generation.ts` (validated as a whole number ≥ 0, else refused)
  - `RT/service/flow-bootstrap-commands/generation-request.ts` (allowed field, validated)
  - `flow-bootstrap-commands/contracts.ts`
  - `RT/service.ts` (generation destructure, creation purse and runtime-session Flow purse, all
    edits to existing lines)
  - `AS/api/handlers/runtime-execution.ts` (validated)
  - `runtime-session/run-input.ts`
  - `runtime-adaptation/flow-spend.ts`
  - `flow-bootstrap-commands/creation-purse.ts`
- Both purse entry points record the chat reading with
  `store.add(…, usd, { phase: "chat", calls: interpretationCalls ?? 0 })`.

### 5. Itemised Flow spend and the `get-flow-spend` endpoint

- `RT/flow-bootstrap/creation-spend/phases.ts` (new): `AUTOMATION_STUDIO_FLOW_SPEND_PHASES`.
- `phase-of.ts` (new): `automationStudioFlowSpendPhaseOf({judge}, stepLogScope)` picks the phase
  in this order: judge, then `part` reauthor, then `phase` read, then `part` creation (counted as
  build), otherwise runtime.
- `record.ts` and `parse.ts`: add `calls` and `byPhase`, which must appear together.
- The barrel is updated.
- `RT/llm/build-purse/types.ts` `onSettled(chargedUsd, call: { judge: boolean })`;
  `settlement-ledger.ts` `hold(heldUsd, projected, judge = false)`; `purse.ts` passes
  `call.judge === true`. Existing one-argument `onSettled` callers still compile.
- `RT/service/creation-spend.ts`:
  - `add(…, { build?, phase?, calls? })` itemises the addition (a call count must be a whole
    number, else it throws).
  - In `withFlowPurse`, `onSettled` adds each call with `phase: automationStudioFlowSpendPhaseOf(call, automationStudioLlmStepLogScope.current())`
    and `calls: 1`.
  - Product behaviour is otherwise unchanged: the same dollars, ceiling and build count.
- `RT/service.ts`: `creationSpends` is changed from `private readonly` to `readonly`, so the
  handler can read it. This adds no method.
- `AS/api/contracts/endpoints.ts`: `getFlowSpend: "get-flow-spend"`. The types are in
  `AS/api/contracts/run.ts`, and the handler is registered inside `registerRunEndpoints` in
  `AS/api/handlers/runs.ts`. I first wrote them as their own files; that broke the
  directory-file and prefix limits, so they moved into the existing files.

## Shapes the Lab reads

- **Step log** `meta.json`: `error.code` is `"llm.provider_balance_exhausted"` (DeepSeek 402, or
  an insufficient balance/quota/credit refusal). It used to be `llm.provider_http_error`.
- **Build failure** (`get-flow-bootstrap-failure` → `failure`, and the build's error diagnostic):
  - `code: "flow_bootstrap.provider_balance_exhausted"`, `stage: "provider_request"`,
    `retryable: false`, `providerInvocation: "attempted"`, `providerResponse: "received"`, and
    `accounting.providerStatus` (for example 402).
  - New optional field `instructedConsequences: ("move_money"|"delete"|"send_or_publish"|"modify_existing"|"create_new")[]`.
    It is present only when the gate had read the instruction and it asked for at least one
    class.
  - `totalProviderCallCount` is unchanged.
- **Re-author attempt** (`runDetail.metadata.resultReauthor.attempts[]`, and the latest fields
  on the marker): new optional fields `calls: number` (`0` for a cost-bound build that was never
  started) and `instructedConsequences: string[]`. A balance failure shows as
  `code: "flow_bootstrap.provider_balance_exhausted"`.
- **Chat cost path**: `interpretationCalls` (a whole number) is sent beside
  `interpretationCostUsd` on `generate-flow-bootstrap-adaptation` and `run-runtime-session`
  payloads.
- **Endpoint** `get-flow-spend` (programId `automation-studio`, permission `programs.read`,
  classification `read`):
  - Request: `{ projectId: string, flowId: string }`.
  - Response payload: `{ spend: FlowSpend | null }`. It is `null` when there is no record.
  - `FlowSpend = { projectId, flowId, spentUsd: number, builds: number, calls: number|null, byPhase: { build, read, judge, runtime, reauthor, chat: { calls: number, usd: number } } | null, createdAt: number, updatedAt: number }`.
  - `calls` and `byPhase` are `null` on a record that was never itemised (the per-creation path
    outside the Lab, or older records).
  - `byPhase` sums to `spentUsd` unless the record already held unitemised spend when itemising
    began.
- **Stored record** `creation-spend.json`: the same fields, plus `kind: "flow_creation_spend"`.

## Commands run and observed results

All Core commands were run in `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ` (vitest from
`packages/fluxiq`).

- `node scripts/structure-audit.mjs`, run before my changes: 1 violation, in another worker's
  file (`packages/contracts/.../condition-holds.test.ts`, statement packing).
- `pnpm --filter fluxiq check`, run four times. The final run printed `check exit 0` and no
  `error TS` lines.
- `node scripts/structure-audit.mjs`, final run: `structure-audit: passed (411 warning(s), 1152 baselined)`.
  The intermediate runs found my violations (two `as never` casts in tests, `api/handlers` and
  `api/handlers/tests` over 25 files, a non-barrel import, three `flow-` prefixes in
  `api/contracts`, and `llm-generation.test.ts` at 802 lines); all were fixed.
- `npx vitest run` on these runtime test sets, 71 files and 948 tests, all passed:
  - `llm/tests/failure-disposition.test.ts`, `llm/tests/deepseek-provider.test.ts`
  - `llm/deepseek/tests`, `llm/build-purse/tests`
  - `flow-bootstrap/generation-failure/tests`, `flow-bootstrap/creation-spend/tests`
  - `service/tests/creation-spend.test.ts`, `service/tests/creation-spend-itemised.test.ts`
  - `flow-bootstrap-commands/tests/{creation-purse,generation-request,failure-spend}.test.ts`
  - `service/runtime-adaptation/tests`, `recovery/refuted-result/tests`
- `npx vitest run` on these conversation, API and service-bootstrap sets, 33 files and 328
  tests, all passed:
  - `conversations/{instructions,commands,}/tests`
  - `api/handlers/tests/{llm-generation,runtime-execution,conversations,runs,domain-scope}.test.ts`
  - `api/contracts/tests`
  - `runtime/tests/service-bootstrap/tests/{creation-spend,accounting,permission}.test.ts`
- After relocating and compacting tests:
  - `api/handlers/tests/{llm-generation,runs,runtime-execution,domain-scope}`: 4 files, 48 tests
    passed.
  - `runtime-execution.test.ts` after the call-count case was added: 15 passed.

New or extended tests:

- `llm/deepseek/tests/balance-exhausted.test.ts` (new)
- `flow-bootstrap/creation-spend/tests/phase-of.test.ts` (new)
- `service/tests/creation-spend-itemised.test.ts` (new)
- `creation-spend/tests/parse.test.ts`
- `generation-failure/tests/generation-catch.test.ts` (instructed classes, the parse refusals,
  and the balance projection round-trip)
- `runtime-adaptation/tests/reauthor-build.test.ts` (the diagnostic count, the receipt fallback,
  and the cost bound giving 0)
- `instructions/tests/interpret.test.ts`
- `flow-bootstrap-commands/tests/generation-request.test.ts`
- `api/handlers/tests/{runs,llm-generation,runtime-execution}.test.ts`

## Not verified

- No live or paid run. The 402 classification is tested only with fake fetch responses. I did
  not check DeepSeek's real 402 body shape; the code relies on the status alone, so the body
  does not matter.
- Phase attribution reads the step-log scope, which `automationStudioLlmStepLogScope` keeps only
  while `FLUXIQ_LLM_STEP_LOG_DIR` is set. Every Lab run sets it. With it off, every call that is
  not a judge's lands under `runtime`.
- I did not exercise a real build end to end to see `instructedConsequences` written. The wiring
  is three edits in `service.ts`, covered by the catch unit test and the typecheck only.
- The `pnpm check` gate (contracts, web, client-gateway) and the full suites were not run, per
  the brief.
- `dist` was not built.

## Open questions or contradictions found

- `instructedConsequences` stores classes, not the gate's full entries. Those entries carry the
  person's quote, which diagnostics and run records deliberately never hold. If the Lab needs the
  quotes, that needs a separate decision.
- `interpretationCalls` absent with `interpretationCostUsd > 0` (an older client) records
  `chat.calls: 0`, not an invented count. A Lab check comparing calls with step-log folders will
  see that as uncounted.
- `git status` lists `api/contracts/index.ts` and `api/handlers/register.ts` as modified, but
  `git diff` on both is empty. I had edited them and then reverted them, so only their timestamps
  changed.
- Other workers' uncommitted changes are in the same tree, for example `packages/contracts/**`,
  `RT/llm/harness/*`, `deepseek/system-prompt*`, `RT/activity/**`, `ui/**`, `apps/web/**` and
  `nodes/index.ts`. I did not touch them. The final typecheck, which includes their files, was
  clean.
