// `pnpm ui:e2e [--lane provider-free|provider|all] [--journey <id>...]`: the
// Week 2 end-to-end UI suite (packages/test-runner/src/ui-e2e/suite.ts).
// Prints one JSON line of ids, closed codes, counts and timings. Exits 0 only
// when every selected journey is verified, 2 when one is not, 1 on a rig or
// usage error. No journey here calls a provider, so provider credentials are
// removed from this process before anything it starts can inherit them.
import path from "node:path";
import { withoutProviderSecrets } from "../provider-secret-environment.mjs";

const repositoryRoot = path.resolve(process.env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
const names = ["FLUXIQ_WEB_EXTENSION_ROOT", "FLUXIQ_TEST_RUNS_DIR", "FLUXIQ_CORE_ROOT", "FLUXIQ_DEMO_EXTENSION_DIR", "FLUXIQ_DEMO_HEADLESS"];

const scrubbed = withoutProviderSecrets(process.env);
for (const key of Object.keys(process.env)) if (!(key in scrubbed)) delete process.env[key];

const began = Date.now();
try {
  const [{ loadAllowlistedTestEnvironment }, suite] = await Promise.all([
    import("../../packages/test-runner/dist/target-config.js"),
    import("../../packages/test-runner/dist/ui-e2e/index.js"),
  ]);
  const args = suite.parseUiE2eArguments(process.argv.slice(2));
  // Before a workspace is prepared or anything starts: browser test runs open only the ten realistic scenarios.
  const refusal = suite.uiE2eScenarioRefusal(args);
  if (refusal !== null) {
    process.stderr.write(JSON.stringify({ status: "refused", reasonCode: "ui_e2e.scenario_not_realistic", message: refusal, wallClockMs: Date.now() - began }) + "\n");
    process.exit(1);
  }
  const environment = await loadAllowlistedTestEnvironment(repositoryRoot, scrubbed, names);
  const run = await suite.prepareUiE2eRunConfiguration({ repositoryRoot, environment });
  const result = await suite.runUiE2eSuite({ lane: args.lane, journeys: args.journeys, config: run.config });
  process.stdout.write(JSON.stringify({
    ...result,
    runId: run.runId,
    ports: run.ports,
    prepareMs: run.prepareMs,
    wallClockMs: Date.now() - began,
  }) + "\n");
  process.exitCode = suite.uiE2eExitCode(result);
} catch (error) {
  const details = error && typeof error === "object" && error.details && typeof error.details === "object" ? error.details : {};
  const reasonCode = typeof details.reasonCode === "string" && /^ui_e2e\.[a-z_.]+$/u.test(details.reasonCode) ? details.reasonCode : "ui_e2e.rig.failed";
  const category = error && typeof error === "object" && typeof error.category === "string" ? error.category : "unknown";
  process.stderr.write(JSON.stringify({ status: "rig_error", message: "UI end-to-end suite could not run", reasonCode, category, wallClockMs: Date.now() - began }) + "\n");
  process.exitCode = 1;
}
