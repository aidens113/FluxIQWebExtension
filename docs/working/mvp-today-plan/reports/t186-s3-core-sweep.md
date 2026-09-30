# t186-S3 Core sweep for leftover LLM-call-grant code and prose

## Outcome

Done. All edits are unstaged in `C:/Users/osrs_/FluxStuff/fxwork/t186/!FluxIQ`. I ran no git state commands.

## What changed and why

Paths are relative to `packages/fluxiq/src/programs/automation-studio/` (P) or `apps/web/src/features/automation-studio/` (W). Categories follow the brief: 1 is the disposition rename, 2 is LLM-grant prose, 3 is consequence permission that was called a "grant".

### Category 1: failure disposition (the only code change)
- P `runtime/llm/failure-disposition.ts`
  - Renamed the value `"end_grant"` to `"end_model_calls"`, and the constant `END_GRANT` to `END_MODEL_CALLS`.
  - Rewrote the header and JSDoc for the no-grant model. A failure no retry can fix (the key, the request, a cancellation, a billing overrun) ends the model's part in the run. A failure that only concerns one reply spends the call, which is charged to the run's budget.
  - The table entries, the `satisfies` closure and both exported functions are unchanged, so behaviour is identical. The type union name `AutomationStudioLlmProviderFailureDisposition` is unchanged.
- P `runtime/llm/tests/failure-disposition.test.ts`: the expectations now use `"end_model_calls"`. Test titles and comments are reworded. A fixture message that read "LLM execution grant is unavailable." now reads "The provider reply could not be read." (that test asserts the message is ignored).
- P `runtime/llm/unusable-decision.ts` (the only consumer; it imports only `automationStudioLlmProviderFailureSpendsCall`): comments only. The line is now drawn by the failure-disposition table, not by "the grant".
- Nothing in the searched trees (`packages/fluxiq/src`, `apps/web/src`) uses `end_grant` any more (grep count 0). The stale `packages/fluxiq/dist/.../failure-disposition.d.ts` still has it; that is build output.

### Category 2: LLM-grant prose rewritten to current behaviour, or history removed
- P `api/handlers/llm-execution-settings.ts`: the call-cap comment now names the run budget and `maxEstimatedCostUsdPerRun`.
- P `runtime/llm/deepseek/models.ts`: "the grant's key-compatibility check" becomes "a key-compatibility check".
- P `runtime/llm/deepseek/pricing.ts`: "a grant reserves / holds back / overspend" becomes an estimate against the run's budget.
- P `runtime/llm/deepseek/provider.ts`: "Two live grant tests" becomes "Two live runs".
- P `runtime/flow-bootstrap/generation-failure/codes.ts`:
  - Deleted the history of the removed `execution_grant_*` codes.
  - "the grant refusals were ruled out" becomes "every refusal with its own code was ruled out".
  - `permission_required` is reworded (category 3).
- P `runtime/flow-bootstrap/generation-failure/evidence-failure.ts`: "its grant did not permit / a build whose grant adds" becomes permitted-consequence wording (category 3).
- P `runtime/llm/harness/runtime-patch-schema.ts`, `harness/structured-response.ts`, `llm/tests/no-repair-response.test.ts` (comments and one test title), `recovery/tests/plan.test.ts`, `tests/live-patch-target-override.test.ts`: "`diagnose_and_adapt` grant" and "proposal grant" become "`diagnose_and_adapt` run" and "proposal-only run".
- P `runtime/llm/harness/tests/run.test.ts`: "48-call Lab grant" becomes "48-call Lab budget".
- P `runtime/llm/harness/token-limits.ts`: "this program's grant default" becomes "this program's default".
- P `runtime/llm/loop-budget.ts`: "the same grant", "as the grant holds it" and "A grant refuses a call" now refer to the run budget.
- P `runtime/llm/run-budget.ts`: dropped "a grant" from the list of things that set `maxCallsPerRun`.
- P `runtime/llm/tests/loop-budget.test.ts`: test title "never at the grant" becomes "never at a budget refusal".
- P `runtime/llm/tests/unusable-decision.test.ts`: header comment, one row label ("a grant that is gone" becomes "a key that is gone"), and the error text "grant gone" becomes "key gone" (an untyped error; its message is not asserted).
- P `runtime/parking/permission-ask.ts`: "holds a provider grant" becomes "holds its run, its budget and its own request open" (twice). "What the caller does with a grant" becomes "…with a permission".
- P `runtime/recovery/exploration-budget.ts`: "a grant held for the patch" becomes "the patch call that follows".
- P `runtime/recovery/recovery-deadline.ts`: "a default grant allows twenty-six calls" becomes "a default recovery allows…".
- P `runtime/recovery/refuted-result/brief.ts` and `tests/brief.test.ts`: dropped "and a grant" from the history sentence.
- P `runtime/recovery/refuted-result/reauthor.ts`:
  - The t166 history is reworded around the run's "purpose", not a "grant purpose".
  - "Nothing about the grant is consulted" becomes "No permission is consulted".
  - "The grant the route runs under carries no permitted consequence" becomes "The route runs with no permitted consequence".
  - "a refused grant" becomes "a refused credential".
  - Note: this file was already unstaged-modified before I started. I edited comments only.
- P `runtime/recovery/refuted-result/tests/reauthor.test.ts`: the same rewording, plus the test title "whatever grant the run happens to hold" becomes "whatever purpose the run happens to have".
- P `runtime/recovery/refuted-result/repair.ts`: dropped "an execution grant" from the list of what the port needs. This file was also already unstaged-modified; comment only.
- P `runtime/recovery/stages.ts`: "its playback carries no execution grant" is removed. The comment now says the Flow is created with LLM intervention off.
- P `runtime/recovery/structured-diagnosis.ts`: "twenty-six granted" becomes "twenty-six allowed".
- P `runtime/recovery/tests/runtime-exploration.test.ts`:
  - "an exploring grant" becomes "an exploring run".
  - The timeout/cancellation comment now names the failure-disposition table.
  - "the run holds no grant" becomes "the run is permitted nothing".
- P `runtime/result-check-authorization/provider.ts`: the header rationale is rewritten. It had described going around "the execution grant service". It now says an unattended replay has no signed-in session for the ordinary session-key path (`llm/session-key-provider.ts`), and this narrow path exists for that case.
- P `runtime/result-verification/deadline.ts`: "the grant service's session and key validation" becomes "the session-key release and its validation".
- P `runtime/run-control/run-controller.ts`, `run-control/types.ts`, `run-control/tests/run-controller.test.ts` (test title): "the LLM grant held for it and the grant's lease" becomes "its admission and its run budget", and "grant and lease forever" becomes "browser and admission forever".
- P `runtime/tests/service-bootstrap/tests/plan-parameters.test.ts`: "the grant's own call count" and "what the grant allows" now refer to the run (comments and one test title).
- P `runtime/action-permissions/request.ts:6`: "`permittedConsequences` of an ordinary execution grant" becomes "…carries their answer as its `permittedConsequences`".
- P `runtime/recovery/runtime-exploration.ts:6`: dropped "the grant that lets a failed run reach it" from the Phase H history.
- P `runtime/recovery/annotation/tests/patches.test.ts`: "a granted run" becomes "a model-assisted run".

### Category 3: consequence permission called a "grant" (comments and test titles only)
Across these files, "grant" as a noun ("the grant", "the person's grant", "a grant carrying the missing classes", "the instruction is the grant", "an empty grant") became permission, permitted, or permitted set.
- Action permissions:
  - P `runtime/action-permissions/{consequences,cross-check,destructive,gate,instructed,request}.ts`
  - P `runtime/action-permissions/tests/{destructive,gate,instructed}.test.ts` (comments and titles)
- Flow bootstrap:
  - P `runtime/flow-bootstrap/{action-permissions,adaptation}.ts`
  - P `runtime/flow-bootstrap/authoring/consequences.ts`
  - P `runtime/flow-bootstrap/instructed-acts/contracts.ts`
- LLM harness:
  - P `runtime/live-patch.ts`
  - P `runtime/llm/harness/context-packet.ts`
  - P `runtime/llm/harness-options/{plan-parameter-resolution,plan-step-consequences}.ts` and its test
  - P `runtime/llm/harness/tests/policy-gates.test.ts` (title)
  - P `runtime/llm/node-tools/replay.ts`
- Panel, conversations and recovery:
  - P `runtime/panel-capabilities/vocabulary.ts` and its test
  - P `runtime/conversations/instructions/respond.ts`
  - P `runtime/conversations/writer.ts`
  - P `runtime/recovery/runtime-exploration.ts`
  - P `runtime/recovery/tests/runtime-exploration-permission.test.ts`
- Model, training and service tests:
  - P `runtime/training-modes.ts`
  - P `model/flows.ts`
  - P `model/tests/intervention-mode.test.ts`
  - P `tests/permission-defaults.test.ts`
  - P `runtime/tests/service-flows/tests/creation.test.ts`
  - P `runtime/tests/service-bootstrap/tests/permission.test.ts` (title)
  - P `runtime/tests/live-patch.test.ts`
- apps/web:
  - W `conversation/capabilities/{contract,dispatch}.ts`
  - W `conversation/capabilities/catalog/index.ts`
  - W `conversation/capabilities/tests/registry.test.ts`
  - W `runtime/tests/run-permission-request.test.tsx` (comment and one title)

No code identifier, field or wire value was renamed in category 3.

## Hits deliberately left, and why
- **Wire shape and answer kind, kept as the brief requires:** `granted` fields (`authority.granted`, `permissions.granted`, `routes.granted`), the ask answer `"grant"` and the SQL check in `storage/project/schema/conversations.ts`, `gate.settle("granted")`, the `grant()` answer helper in `executor/tests/resume.test.ts`, and the W thread answer kind `"grant"` with its `actionId: "grant"`.
- **Verbs that settle a permission ask** ("the person grants it", "a refusal nobody granted", "grants exactly the classes the ask listed"): these mirror the answer kind `"grant"`, not a grant object.
- **User-facing sentence strings**: "Neither its instruction nor a grant allows that, so … stopped to ask." in `action-permissions/request.ts:103/106/109`, asserted verbatim in about 8 test files. This is product text, not a comment, and changing it changes output. See the open questions.
- **Out of scope by rule**:
  - Database Manager and Secret Keys reveal grants, identity-access, `client-gateway/service/access.ts`, `_shared/*`
  - domain grants (`model/flows.ts:163`, `composites.ts`, `canonical-persistence.test.ts`, W `FlowSettingsView.tsx`, `run-flow.ts`, `commands.test.ts`)
  - native-node capability grants (`native-node-runtime.ts`, `importer-sdk.ts`, `catalog.test.ts`, W settings copy and its test)
  - For Each and `graph-run.ts`
  - `functionality-contract.ts` "commands not granted"
  - the `grantedAtMs` field of the result-check authorization (code field)
  - `triggerKind: "grant"` in `run-detail-merge.test.ts` (fixture value)
  - the `approval.ts` `routes.granted`
- **Negative regression assertions and "with no grant" statements of current behaviour**:
  - Negative assertions: `api/contracts/tests/adaptation.test.ts`, `api/handlers/tests/llm-generation.test.ts`, `llm-permission.test.ts`, `rejections.test.ts` ("a leftover execution grant"), `generation-request.test.ts`, the `not.toMatch(/grant/)` checks, and W `browser-endpoints.test.ts` / `program-route.test.ts` (`issue-llm-execution-grant`).
  - Titles such as "with no grant": `llm-run-caller`, `run-consequence-permission`, `generation`, `deepseek-bootstrap-exploration`, W `blank-flow-authoring`, `improve-flow`, `adaptations`, `diagnosis-authorization-interactions`, `runtime-views`, `run-permission-request:177`.
  - Past-tense comments that explain where a current number came from: `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`, `deepseek-recovery-requests.test.ts:118`, `iterating-recovery.test.ts`, `unattended-retry-verification.test.ts`, `llm-permission.test.ts:61`, `recovery-default-limits.test.ts`, `session-key.ts`, `model-caller.ts`, `llm-generation.ts`.
- **Must-not-touch files that still carry grant prose**:
  - P `runtime/llm/evidence-loop.ts:158` ("Provider grants, …" in the loop's JSDoc). Current-behaviour prose that needs a follow-up by whoever owns that file.
  - P `runtime/tests/refuted-result/tests/reauthor-service.test.ts:405/409/456/527`.
  - P `runtime/tests/refuted-result/tests/repair-replay-chain.test.ts:8`.
  - P `runtime/tests/service-adaptation/tests/runtime-patches.test.ts:159`.
  - `apps/web/src/lib/program-route.ts:191`.

## Commands run and observed results
- Type check: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t186-S3 tsc" npx tsc --noEmit -p tsconfig.json` (from `packages/fluxiq`).
  - Printed `[heavy] t186-S3 tsc holds b2`, then `EXIT 0`.
  - It ran past my 600 s tool timeout, so it finished in the background; the job reported exit code 0.
- `npx vitest run runtime/llm/tests runtime/llm/harness/tests/run.test.ts runtime/llm/harness/tests/policy-gates.test.ts runtime/llm/harness-options/tests/plan-step-consequences.test.ts --maxWorkers=2 --minWorkers=1 --testTimeout=120000` printed `Test Files 28 passed (28)`, `Tests 322 passed (322)`.
- `npx vitest run runtime/action-permissions/tests, refuted-result/tests/{brief,reauthor}, recovery/tests/{plan,runtime-exploration-permission,runtime-exploration}, annotation/tests/patches, run-control/tests/run-controller, panel-capabilities/tests/vocabulary, model/tests/intervention-mode, tests/permission-defaults` (same flags) printed `Test Files 14 passed (14)`, `Tests 217 passed (217)`.
- `npx vitest run runtime/tests/service-bootstrap/tests/{plan-parameters,permission}, service-flows/tests/creation, live-patch, live-patch-target-override` (same flags) printed `Test Files 5 passed (5)`, `Tests 89 passed (89)`.
- apps/web: `npx vitest run conversation/capabilities/tests/registry.test.ts runtime/tests/run-permission-request.test.tsx conversation/capabilities/catalog/tests` (same flags) printed `Test Files 5 passed (5)`, `Tests 36 passed (36)`.
- `grep -rn "end_grant\|END_GRANT" packages/fluxiq/src apps/web/src | wc -l` printed `0`.

## Not verified
- I did not run apps/web tsc; the apps/web changes are comments and test titles only.
- I did not run the full package suites.
- I did not rebuild `packages/fluxiq/dist`, so its `.d.ts` still says `end_grant`.
- There were no Lab or browser runs (none are in scope).

## Open questions or contradictions found
1. The user-facing sentence "Neither its instruction nor a grant allows that" (`action-permissions/request.ts`) still calls consequence permission "a grant". Changing it, for example to "…nor a person's permission allows that", needs the verbatim assertions updated in about 8 test files: `gate.test.ts`, `destructive.test.ts`, `conversations.test.ts`, `store.test.ts`, `patches.test.ts`, and some W fixtures. I left it because the brief limited category 3 to comments.
2. `runtime/llm/evidence-loop.ts:158` (must not touch) still describes "Provider grants" as current behaviour.
3. `recovery/refuted-result/{reauthor,repair}.ts` already had unstaged modifications from someone else when I started. My edits there are comment-only and sit on top of them.
