// Live provider execution for the Testing Lab: everything between a parsed
// `--live-llm` command line and a real, bounded, attested provider call.

export { authorizeFlowLiveLlmExecution, type LiveLlmAuthorization, type LiveLlmAuthorizationControl } from "./authorize-flow.js";
export { assertLiveLlmBudgetHeld, assertLiveLlmProviderWasReached, liveLlmBudgetBreaches } from "./budget.js";
export { liveLlmBudgetFindings, type LiveLlmBudgetFinding, type LiveLlmBudgetFindingCall } from "./budget/index.js";
export { budgetOverProductFailure } from "./budget-over-product-failure.js";
export { labBuildCallLimitEnvironment } from "./call-limit-env.js";
export { liveLlmBuildCostCeilingUsd } from "./build-cost-ceiling.js";
export { liveLlmBuildUsage } from "./build-usage.js";
export { liveLlmCoreDefaultModel } from "./core-default-model.js";
export { assertProviderCallsAsDeclared, declaredProviderCalls, type DeclaredProviderCalls } from "./declared-provider-calls.js";
export { liveLlmExplorationRecord, readLiveLlmExploration, type LiveLlmExplorationControl, type LiveLlmExplorationRecord, type LiveLlmExplorationSource } from "./exploration-record.js";
export { configureFlowLiveLlmExecution, type LiveLlmFlowSettingsControl } from "./flow-settings.js";
export { planLiveLlmExecution, type LiveLlmPlan, type LiveLlmPurpose } from "./live-llm-plan.js";
export { assertLlmMaxCostWithinCeiling } from "./max-cost-within-ceiling.js";
export { beginLiveLlmRun, LiveLlmRun, type LiveLlmRunBundle, type LiveLlmRunCredentials } from "./live-llm-run.js";
export { liveLlmObservedUsage, type LiveLlmObservedCall, type LiveLlmObservedUsage } from "./observed-usage.js";
export { readLiveLlmReauthor, type LiveLlmReauthorAttempt, type LiveLlmReauthorCallsSource, type LiveLlmReauthorEnding, type LiveLlmReauthorRecord } from "./reauthor-record.js";
export { liveLlmRunSpend, type LiveLlmBuildSpend, type LiveLlmFlowSpendControl, type LiveLlmFlowSpendPart, type LiveLlmPerBuildSpend, type LiveLlmRoleSpend, type LiveLlmRunSpend, type LiveLlmRunSpendPhases, type LiveLlmSpendPhase, type LiveLlmSpendSource } from "./flow-spend.js";
export { LiveLlmFlowSpendReader } from "./spend-reader.js";
export { resolveLiveLlmProviderCredential, type LiveLlmProviderCredential } from "./provider-credential.js";
export { ensureLiveLlmSecretKey, LAB_LIVE_LLM_KEY_NAME, type LiveLlmSecretKeyControl, type LiveLlmSecretKeyReference } from "./secret-key.js";
export * from "./cost-ceiling-env.js";
export * from "./default-model-env.js";
export * from "./authoring-mode-env.js";
