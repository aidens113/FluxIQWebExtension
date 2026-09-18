// The command each task becomes, from options as the command line parses them.

import assert from "node:assert/strict";
import test from "node:test";
import { labRunArguments, parseCampaignArgs } from "../index.mjs";
import { CATALOG, REPAIR_LIMIT_ARGS, CREATE_LIMIT_ARGS, REPAIRS } from "./tasks.mjs";

test("each repair task becomes one adapt run of the recorded Flow, with the live limits unless they are given after --", () => {
  assert.deepEqual(labRunArguments(REPAIRS[0], parseCampaignArgs([])), [
    "run", "identity-drift", "--variant", "renamed-redesign", "--flow",
    "--live-llm", "--llm-profile", "lab-adapt-repair", "--llm-provider", "deepseek", "--llm-model", "deepseek-chat",
    "--llm-task", "adapt", ...REPAIR_LIMIT_ARGS,
  ]);
  const workflowOnly = labRunArguments(REPAIRS[2], parseCampaignArgs(["--llm-profile", "p"]));
  assert.deepEqual(workflowOnly.slice(0, 5), ["run", "sensitive-input", "--workflow", "extract-card-secrets", "--flow"]);
  assert.equal(workflowOnly[workflowOnly.indexOf("--llm-profile") + 1], "p");
  assert.equal(workflowOnly.includes("--variant"), false);
  assert.equal(workflowOnly.includes("--instruction-task"), false, "the Lab refuses --instruction-task outside create-flow");

  // A limit given after -- replaces its default: the Lab refuses an option given twice.
  const overridden = labRunArguments(REPAIRS[1], parseCampaignArgs(["--", "--llm-max-cost-usd", "0.1", "--target", "isolated"]));
  assert.equal(overridden.filter((arg) => arg === "--llm-max-cost-usd").length, 1);
  assert.deepEqual(overridden.slice(-4), ["--llm-max-cost-usd", "0.1", "--target", "isolated"]);
  assert.ok(overridden.includes("--llm-max-calls") && overridden.includes("--llm-max-run-tokens"));

  // Creation tasks carry no default limits and keep their own profile.
  const creation = labRunArguments(CATALOG[0], parseCampaignArgs([]));
  assert.equal(creation[creation.indexOf("--llm-profile") + 1], "lab-create-flow");
  assert.equal(creation.includes("--llm-max-calls") || creation.includes("--flow"), false);
});

test("each task becomes one create-flow Lab run naming its scenario, variant and catalog id", () => {
  const options = parseCampaignArgs(["--llm-profile", "p", "--", "--target", "persistent-isolated"]);
  assert.deepEqual(labRunArguments(CATALOG[2], options), [
    "run", "data-table", "--variant", "column-reorder",
    "--live-llm", "--llm-profile", "p", "--llm-provider", "deepseek", "--llm-model", "deepseek-chat",
    "--llm-task", "create-flow", "--instruction-task", "table-read-reordered", ...CREATE_LIMIT_ARGS, "--target", "persistent-isolated",
  ]);
  assert.equal(labRunArguments(CATALOG[0], options).includes("--variant"), false);
});
