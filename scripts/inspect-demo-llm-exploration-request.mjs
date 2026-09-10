import path from "node:path";
import { withoutProviderSecrets } from "./provider-secret-environment.mjs";

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = ["FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_LLM_SCENARIO_ID", "FLUXIQ_LLM_INSTRUCTION"];

try {
  const [{ loadAllowlistedTestEnvironment }, requestModule] = await Promise.all([
    import("../packages/test-runner/dist/target-config.js"),
    import("../packages/test-runner/dist/demo-llm-exploration-request.js"),
  ]);
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, withoutProviderSecrets(process.env), names);
  const request = await requestModule.resolveDemoLlmExplorationRequest(repositoryRoot, environment);
  const readiness = requestModule.inspectDemoLlmExplorationRequestReadiness(request);
  process.stdout.write(JSON.stringify(readiness) + "\n");
} catch {
  process.stderr.write(JSON.stringify({ status: "failed", message: "Provider-free exploration request readiness failed", reasonCode: "exploration_request.invalid", providerCallCount: 0 }) + "\n");
  process.exitCode = 1;
}
