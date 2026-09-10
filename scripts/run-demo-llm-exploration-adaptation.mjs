import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = [
  "FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_DEMO_RUN_DIR", "FLUXIQ_CORE_ROOT",
  "FLUXIQ_DEMO_BASE_URL", "FLUXIQ_DEMO_GATEWAY_URL", "FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD",
  "FLUXIQ_TEST_PIN", "FLUXIQ_TEST_TOTP", "FLUXIQ_DEMO_PROJECT_ID", "FLUXIQ_DEMO_PROJECT_NAME",
  "FLUXIQ_DEMO_HEADLESS",
];

try {
  const [{ loadAllowlistedTestEnvironment }, workspace] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-workspace.js"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const config = workspace.resolveDemoWorkspaceConfiguration(repositoryRoot, environment);
  const result = await workspace.runDemoLlmExplorationAdaptationProposal(config);
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  const candidate = error && typeof error === "object" && error.details && typeof error.details === "object"
    ? error.details.reasonCode
    : undefined;
  const reasonCode = typeof candidate === "string" && /^(?:exploration_adaptation_run|exploration_adaptation_readiness|exploration_apply|adaptation_readiness)\.[a-z_]+$/.test(candidate)
    ? candidate
    : error && typeof error === "object" && error.name === "RunnerFailure" && typeof error.category === "string"
      ? `runner.${error.category}`
      : "exploration_adaptation_run.failed";
  const activeAdaptationStates = error && typeof error === "object" && error.details && Array.isArray(error.details.activeAdaptationStates)
    ? error.details.activeAdaptationStates
    : undefined;
  const runtimePatchDiagnostics = reasonCode === "exploration_adaptation_run.proposal_identity_invalid"
    ? safeRuntimePatchDiagnostics(error && typeof error === "object" && error.details ? error.details.runtimePatchDiagnostics : undefined)
    : undefined;
  process.stderr.write(JSON.stringify({ status: "failed", message: "Focused exploration runtime-adaptation proposal failed", reasonCode, ...(activeAdaptationStates ? { activeAdaptationStates } : {}), ...(runtimePatchDiagnostics ? { runtimePatchDiagnostics } : {}) }) + "\n");
  process.exitCode = 1;
}

function safeRuntimePatchDiagnostics(value) {
  if (!Array.isArray(value)) return undefined;
  const categories = new Set(["action_sequence", "wait_retry", "target_override", "recovery_subflow", "reroute", "response", "unknown"]);
  const statuses = new Set(["passed", "failed", "unknown"]);
  const codes = new Set(["runtime_patch.target_node_invalid", "runtime_patch.target_override_rejected", "runtime_patch.patch_count_invalid", "runtime_patch.side_effect_not_authorized", "runtime_patch.policy_rejected", "runtime_patch.preflight_rejected"]);
  return value.slice(0, 4).map(item => ({
    patchCategory: item && categories.has(item.patchCategory) ? item.patchCategory : "unknown",
    preflightStatus: item && statuses.has(item.preflightStatus) ? item.preflightStatus : "unknown",
    issueCodes: Array.isArray(item?.issueCodes) ? [...new Set(item.issueCodes.filter(code => codes.has(code)))].slice(0, 8) : [],
    adaptationCreated: item?.adaptationCreated === true,
    changeProposalCreated: item?.changeProposalCreated === true,
  }));
}
