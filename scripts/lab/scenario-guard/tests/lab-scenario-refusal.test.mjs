// The Lab launcher refuses any scenario outside the ten realistic ones before
// it starts anything (user rule, 2026-09-29). On 2026-10-07 a lead ran
// `node scripts/lab/run-lab.mjs run basic-form --flow` because nothing refused it.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { labScenarioRefusal } from "../index.mjs";

const TEN = ["everything-store", "crossborder-marketplace", "bigbox-retail", "job-board", "local-classifieds", "auction-marketplace", "photo-social", "social-network-feed", "company-website", "professional-network"];
const RULE = /every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios \(user rule, 2026-09-29\): everything-store, crossborder-marketplace, bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed, company-website, professional-network\./u;
const RUN_LAB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "run-lab.mjs");

test("run, interactive and replay refuse basic-form and product-catalog, naming the rule and the ten", () => {
  for (const command of ["run", "interactive", "replay"]) {
    for (const scenario of ["basic-form", "product-catalog"]) {
      const refusal = labScenarioRefusal([command, scenario, "--flow"]);
      assert.ok(refusal, `${command} ${scenario}`);
      assert.ok(refusal.startsWith(`lab ${command} refused ${scenario}: `), refusal);
      assert.match(refusal, RULE);
    }
  }
});

test("run, interactive and replay admit each of the ten", () => {
  for (const command of ["run", "interactive", "replay"]) {
    for (const scenario of TEN) assert.equal(labScenarioRefusal([command, scenario, "--live-llm"]), null, `${command} ${scenario}`);
  }
});

test("a scenario that does not follow the command is refused rather than guessed", () => {
  assert.match(labScenarioRefusal(["run", "--flow", "basic-form"]), /takes its scenario right after the command/u);
  assert.match(labScenarioRefusal(["run"]), /takes its scenario right after the command/u);
});

test("matrix: --scenarios-json is held to the ten; --all is admitted because the runner expands it to the ten", () => {
  assert.match(labScenarioRefusal(["matrix", "--scenarios-json", JSON.stringify(["job-board", "basic-form"])]), /^lab matrix refused basic-form: /u);
  assert.equal(labScenarioRefusal(["matrix", "--scenarios-json", JSON.stringify(TEN)]), null);
  assert.equal(labScenarioRefusal(["matrix", "--all"]), null);
  assert.match(labScenarioRefusal(["matrix", "--scenarios-json", "[basic-form"]), /is not JSON/u);
});

test("commands that open no scenario pass the guard", () => {
  for (const args of [["inspect", "run-1"], ["auth", "status"], ["clone-cache", "status"], ["compare", "a", "b"], ["bench", "--corpus", "week1"], ["stop", "slot-1"], []]) {
    assert.equal(labScenarioRefusal(args), null, args.join(" "));
  }
});

test("run-lab.mjs refuses `run basic-form --flow` before the live-run guards, the Core checks and the build", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-scenario-guard-"));
  try {
    // Every place a started run would write is under `root`; a refusal leaves it empty.
    const env = { ...process.env, FLUXIQ_TEST_RUNS_DIR: path.join(root, "runs"), FLUXIQ_LAB_INSTANCE: "scenario-guard-test", FLUXIQ_CORE_ROOT: path.join(root, "no-core") };
    for (const args of [["run", "basic-form", "--flow"], ["run", "product-catalog", "--live-llm", "--llm-task", "create-flow"], ["interactive", "basic-form"]]) {
      const result = await spawnNode([RUN_LAB, ...args], env);
      assert.equal(result.code, 1, result.stderr);
      assert.match(result.stderr, RULE);
      const lines = result.stderr.split(/\r?\n/u).filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
      assert.deepEqual(lines.map((line) => `${line.lab}:${line.state}`), ["scenario-guard:refused"], "nothing ran before the refusal: no live guard, Core check, build or paths line");
    }
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** @param {string[]} args @param {NodeJS.ProcessEnv} env */
function spawnNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}
