import assert from "node:assert/strict";
import test from "node:test";
import { campaignEnvironment } from "../campaign-environment.mjs";
import { renderPairInstructions } from "../instructions.mjs";

test("the campaign environment names the pair's Core with forward slashes and isolates the build", () => {
  const environment = campaignEnvironment({ coreRoot: "F:\\fxlab\\!FluxIQ", instance: "lab-pair" });
  assert.deepEqual(environment, { FLUXIQ_CORE_ROOT: "F:/fxlab/!FluxIQ", FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_LAB_INSTANCE: "lab-pair", npm_config_workspace_concurrency: "1" });
  assert.ok(Object.isFrozen(environment));
});

test("the instructions quote every value for bash and say where the provider key comes from", () => {
  const environment = campaignEnvironment({ coreRoot: "F:\\fxlab\\!FluxIQ", instance: "lab-pair" });
  const text = renderPairInstructions({ extRoot: "F:\\fxlab\\lab-ext", environment, providerKey: { name: "DEEPSEEK_API_KEY", found: true, source: "the process environment" } });
  const lines = text.split("\n");
  assert.ok(lines.includes("cd 'F:/fxlab/lab-ext'"));
  assert.ok(lines.includes("export FLUXIQ_CORE_ROOT='F:/fxlab/!FluxIQ' FLUXIQ_TEST_ENV_FILES='none' FLUXIQ_LAB_INSTANCE='lab-pair' npm_config_workspace_concurrency='1'"));
  // By absolute path, so the campaign stays visible to the in-use check between tasks.
  assert.ok(lines.includes("node 'F:/fxlab/lab-ext/scripts/lab/live-campaign.mjs' --all --max-attempts 4 -- <lab options>"));
  assert.ok(lines.some((line) => line.startsWith("node 'F:/fxlab/lab-ext/scripts/lab/run-lab.mjs' run basic-form --target isolated")));
  assert.ok(!lines.some((line) => line.startsWith("pnpm ")));
  assert.match(text, /DEEPSEEK_API_KEY: a live run from the pair reads it from the process environment\./u);
});

test("a key the pair cannot reach is said plainly, with both ways to provide it", () => {
  const text = renderPairInstructions({
    extRoot: "F:/fxlab/lab-ext",
    environment: { FLUXIQ_LAB_INSTANCE: "it's" },
    providerKey: { name: "DEEPSEEK_API_KEY", found: false, searched: ["the process environment", "F:/fxlab/lab-ext/.env"] },
  });
  assert.match(text, /NOT reachable from the pair \(searched the process environment, F:\/fxlab\/lab-ext\/\.env\)/u);
  assert.match(text, /copy \.env\.local from the working checkout into F:\/fxlab\/lab-ext/u);
  assert.ok(text.includes("export FLUXIQ_LAB_INSTANCE='it'\\''s'"));
});
