import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

if (process.argv.includes("--help")) {
  await Promise.all([import("@fluxiq-web-extension/test-runner/target-config"), import("@fluxiq-web-extension/test-runner/demo-llm-exploration-request")]);
  process.stdout.write("Usage: node scripts/inspect-demo-llm-exploration-request.mjs [command arguments]\n--help  Show help without building, opening a browser or changing workspace data.\n");
  process.exit(0);
}

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = ["FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_LLM_SCENARIO_ID", "FLUXIQ_LLM_INSTRUCTION"];

try {
  const [{ loadAllowlistedTestEnvironment }, requestModule] = await Promise.all([
    import("@fluxiq-web-extension/test-runner/target-config"),
    import("@fluxiq-web-extension/test-runner/demo-llm-exploration-request"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const request = await requestModule.resolveDemoLlmExplorationRequest(repositoryRoot, environment);
  const readiness = requestModule.inspectDemoLlmExplorationRequestReadiness(request);
  process.stdout.write(JSON.stringify(readiness) + "\n");
} catch {
  process.stderr.write(JSON.stringify({ status: "failed", message: "Provider-free exploration request readiness failed", reasonCode: "exploration_request.invalid", providerCallCount: 0 }) + "\n");
  process.exitCode = 1;
}
