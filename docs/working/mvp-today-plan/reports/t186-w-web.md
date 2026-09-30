# t186-W — Core web panel: remove LLM call grants

Worker report. Tree: `C:\Users\osrs_\FluxStuff\fxwork\t186\!FluxIQ` (branch
`task/t186-remove-call-grants`), `apps/web/**` only. Nothing committed.

## Outcome

Done. Under the default 5 s timeout, 3 core-contract tests time out on this machine. They pass
with a longer timeout (see "Commands run").

## What changed and why

Rule: pressing build / run / repair / verify calls the endpoint; nothing is
preflighted, issued, confirmed (high-token) or revoked. Consequence permission
(`permission_required`) stays and is sent as `permittedConsequences`.

Source:
- `src/app/api/auth/logout/route.ts` — no `llmExecutionGrants.revokeForSession`.
- `runtime/run-commands.ts` — deleted `preflightLlmExecution`, `issueLlmExecutionGrant`.
- `runtime/runtime-host.ts` — `RuntimeExecutionCommands` loses `preflightLlm`/`issueLlmGrant`;
  build commands take `{ projectId, flowId, permittedConsequences? }`.
- `runtime/FlowRunView.tsx` — deleted `authorizeLlm`, the high-token modal, its state and
  `RUNTIME_GRANT_CLAIM_WINDOW_MS`. A model-assisted mode runs `execute` straight away with
  `runIntent: mode` and `newRunId`; "Allow and run again" reruns the same intent with
  `permittedConsequences` = the request's `missing` classes (only when present). Failure text
  is fixed: "The LLM-assisted run could not be completed."
- `runtime/run-input-model.ts`, `runtime/index.ts` — deleted `runtimeLlmExecutionRequestFromFlow`
  (it only built the preflight/grant request).
- `runtime/RunPermissionRequest.tsx` — copy no longer says "grant".
- `authoring/llm-preflight-run-limits.ts` — deleted.
- `authoring/blank-flow-authoring-model.ts` — deleted `BLANK_FLOW_AUTHORING_LIMITS`,
  `WEBSITE_EXPLORATION_LIMITS` (claim window / run lease), `LLM_HIGH_TOKEN_WARNING_THRESHOLD`,
  `llmRequestRequiresHighTokenWarning`, and the saved-limits gate; request builders return
  `{ projectId, flowId }`; policy keeps only `generation`. `WEBSITE_EXPLORATION_OVERALL_TIMEOUT_MS`
  is now a plain 675 000 ms reply wait (unchanged value).
- `authoring/flow-model-binding.ts` — still requires a DeepSeek model and key on the Flow;
  payload is `{ projectId, flowId }` (no purpose/keyId/provider/model/settings).
- `authoring/existing-flow-improvement.ts` — payload `{ projectId, flowId }`.
- `authoring/authoring-commands.ts` — no `llmExecutionGrantId`; optional `permittedConsequences`.
- `authoring/improvement-host.ts` — `useFlowImprovementCommands()` takes no arguments.
- `authoring/BlankFlowAuthoringPanel.tsx` — no availability preflight, no grant, no high-token
  modal; build/explore call the endpoint; the consequence continuation sends
  `permittedConsequences`. Exploration bounds text now names the Flow's spending limit.
- `authoring/ImproveFlowPanel.tsx` — same; drops `stale_grant_binding` message.
- `authoring/index.ts` — barrel updated.
- `flow-editor/components/FlowEditorView.tsx` — `useFlowImprovementCommands()`.
- `conversation/capabilities/catalog/running.ts` — deleted `permission.allowModelRun` and
  `permission.check` (its endpoint `preflight-llm-execution` is deleted), `flowModelKey`, `PURPOSE`.
- `conversation/capabilities/catalog/flows.ts` — `flow.build`/`flow.explore` drop the
  `llmExecutionGrantId` argument; `flow.improve` no longer issues a grant.
- `conversation/capabilities/catalog/index.ts`, `dispatch.ts` — comments no longer list
  "granting a model run".

Tests updated to the new behaviour (no preflight/issue call, no grant id sent,
permitted consequences sent only after Allow): `authoring/tests/blank-flow-authoring.test.tsx`,
`authoring/tests/improve-flow.test.tsx`, `runtime/tests/diagnosis-authorization-interactions.test.tsx`,
`runtime/tests/run-permission-request.test.tsx`, `runtime/tests/runtime-views.test.tsx`,
`conversation/capabilities/catalog/tests/browser-endpoints.test.ts`, `.../catalog/tests/adaptations.test.ts`,
`conversation/capabilities/tests/{coverage,registry,core-contract}.test.ts`,
`conversation/capabilities/tests/core-contract-{world,arguments}.ts` (no Core grant service, 5-arg
`registerAutomationStudioApi`, no grant id), `flow-editor/components/tests/flow-editor-start-pane.test.tsx`.

## Commands run and observed results

- `npx tsc --noEmit -p apps/web` (from Core root) -> exit 0, 0 `error TS` lines (after the Core
  workers' changes landed; an earlier run showed only Core-package errors plus my then-unfixed tests).
- `npx vitest run --minWorkers=1 --maxWorkers=1 <file>`, one file at a time, from `apps/web`:
  - blank-flow-authoring 19/19 passed; improve-flow 9/9; diagnosis-authorization-interactions 6/6;
    run-permission-request 10/10; runtime-views 23/23; browser-endpoints 4/4; adaptations 7/7;
    coverage 7/7; registry 11/11; flow-editor-start-pane 2/2.
  - core-contract.test.ts: the first run printed 25 passing cases (flow.create through
    flow.settings, including flow.build, flow.explore, flow.improve and run.execute) and no failure
    lines. My output filter cut that run off at 25 lines. The full rerun reported 53 passed and 3 failed
    out of 56. All 3 failures are in "the capability catalog agrees with Core's own classification",
    and each one is "Test timed out in 5000ms": that block opens a Core contract world inside the
    test, and opening it took about 7.3 s on this machine. Rerunning that block with
    `--testTimeout=60000` passed 5 of 5, including the endpoint check ("declares only endpoints
    Core has a handler for", 7311 ms). So the assertions hold, and the failures are the
    5 s default timeout. I left that test's timing alone.
- Grep of `apps/web` for `llmExecutionGrant|LlmExecutionGrant|allowModelRun|preflight-llm|issue-llm|
  preflightLlm|issueLlm|highToken|llmPreflight|revokeForSession|executionGrant|grantClaimWindow|
  runLeaseMs|grantId|permission.check`: remaining hits are only negative assertions in the updated
  tests (`not.toHaveProperty("llmExecutionGrantId")`, `not.toContain("issue-llm-execution-grant")`, ...)
  and `features/programs/live-views/database-manager.tsx` `grantId` (sensitive-record reveal grants,
  unrelated to LLM calls). e2e/ and scripts/ have no hits.

## Not verified

- No live browser run; no `pnpm build` of the web app; full web vitest suite not run (RAM).
- Whether Core's `run-runtime-session` accepts `newRunId` together with `runIntent` (the web sends
  both; the old code sent both too, with a grant id).

## Open questions or contradictions found

- Chat capabilities have no permission-answer channel in `PanelCapabilityContext`, so `flow.build`,
  `flow.explore`, `flow.improve` and `run.execute` send no `permittedConsequences`. I did not add a
  model-suppliable `permittedConsequences` argument: a model could then permit consequences the
  person never answered.
- Flow Settings still stores `llmExecutionSettings` (tokens, timeout, cost). The panel no longer
  sends them; the spend ceiling is Core's `adaptationPolicySettings.maxEstimatedCostUsdPerRun`.
  Whether the settings UI should drop the per-call fields is out of this brief.
- `flowModelBinding` still gates builds on the Flow naming a DeepSeek model and key, though Core
  now picks the newest unlocked session key; kept as a readiness rule, not a grant.
