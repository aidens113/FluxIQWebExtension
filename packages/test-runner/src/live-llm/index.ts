// Live provider execution for the Testing Lab: everything between a parsed
// `--live-llm` command line and a real, bounded, attested provider call.

export { authorizeFlowLiveLlmExecution, type LiveLlmAuthorization, type LiveLlmAuthorizationControl } from "./authorize-flow.js";
export { assertLiveLlmBudgetHeld, assertLiveLlmProviderWasReached, liveLlmBudgetBreaches } from "./budget.js";
export { budgetOverProductFailure } from "./budget-over-product-failure.js";
export { LIVE_LLM_BUILD_COST_CEILING_USD } from "./build-cost-ceiling.js";
export { liveLlmBuildUsage } from "./build-usage.js";
export { assertProviderCallsAsDeclared, declaredProviderCalls, type DeclaredProviderCalls } from "./declared-provider-calls.js";
export { liveLlmExplorationRecord, readLiveLlmExploration, type LiveLlmExplorationControl, type LiveLlmExplorationRecord, type LiveLlmExplorationSource } from "./exploration-record.js";
export { configureFlowLiveLlmExecution, type LiveLlmFlowSettingsControl } from "./flow-settings.js";
export { runLaneWithLiveLlmSettlement, type LiveLlmLaneSettlement } from "./lane-settlement.js";
export { planLiveLlmExecution, type LiveLlmPlan, type LiveLlmPurpose } from "./live-llm-plan.js";
export { beginLiveLlmRun, LiveLlmRun, type LiveLlmRunBundle, type LiveLlmRunCredentials } from "./live-llm-run.js";
export { liveLlmObservedUsage, type LiveLlmObservedCall, type LiveLlmObservedUsage } from "./observed-usage.js";
export { readLiveLlmReauthor, type LiveLlmReauthorAttempt, type LiveLlmReauthorCallsSource, type LiveLlmReauthorRecord } from "./reauthor-record.js";
export { liveLlmRunSpend, type LiveLlmBuildSpend, type LiveLlmJudgeCalls, type LiveLlmPerBuildSpend, type LiveLlmRunSpend, type LiveLlmSpendPhase } from "./run-spend.js";
export { resolveLiveLlmProviderCredential, type LiveLlmProviderCredential } from "./provider-credential.js";
export { ensureLiveLlmSecretKey, LAB_LIVE_LLM_KEY_NAME, type LiveLlmSecretKeyControl, type LiveLlmSecretKeyReference } from "./secret-key.js";
