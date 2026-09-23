// The command each task becomes, from options as the command line parses them.

import assert from "node:assert/strict";
import test from "node:test";
import { labRunArguments, parseCampaignArgs } from "../index.mjs";
import { CATALOG, REPAIR_LIMIT_ARGS, CREATE_LIMIT_ARGS, REPAIRS } from "./tasks.mjs";

test("each repair task becomes one adapt run of the recorded Flow, with the live limits unless they are given after --", () => {
  assert.deepEqual(labRunArguments(REPAIRS[0], parseCampaignArgs([])), [
    "run", "identity-drift", "--variant", "renamed-redesign", "--flow",
    "--live-llm", "--llm-profile", "lab-adapt-repair", "--llm-provider", "deepseek", "--llm-model", "deepseek-flash",
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

  // A creation task keeps its own profile, and builds a Flow rather than
  // running one, so it is never a `--flow` run. It does carry a call ceiling:
  // the default it used to inherit was set for a loop that no longer exists and
  // failed six of six live tasks that had already built something.
  const creation = labRunArguments(CATALOG[0], parseCampaignArgs([]));
  assert.equal(creation[creation.indexOf("--llm-profile") + 1], "lab-create-flow");
  assert.equal(creation.includes("--flow"), false);
  assert.equal(creation[creation.indexOf("--llm-max-calls") + 1], "48");
});

test("each task becomes one create-flow Lab run naming its scenario, variant and catalog id", () => {
  const options = parseCampaignArgs(["--llm-profile", "p", "--", "--target", "persistent-isolated"]);
  assert.deepEqual(labRunArguments(CATALOG[2], options), [
    "run", "data-table", "--variant", "column-reorder",
    "--live-llm", "--llm-profile", "p", "--llm-provider", "deepseek", "--llm-model", "deepseek-flash",
    "--llm-task", "create-flow", "--instruction-task", "table-read-reordered", ...CREATE_LIMIT_ARGS, "--target", "persistent-isolated",
  ]);
  assert.equal(labRunArguments(CATALOG[0], options).includes("--variant"), false);
});

test("--replays after -- reaches a creation task's run, which applies and replays its created Flow's repair", () => {
  const options = parseCampaignArgs(["--", "--target", "persistent-isolated", "--workspace", "w", "--replays", "1"]);
  const creation = labRunArguments({ id: "identity-drift-rename-redesigned-after-creation", scenarioId: "identity-drift", variantId: "renamed-redesign", kind: "form", judgeBy: "playback-goal" }, options);
  assert.deepEqual(creation.slice(-6), ["--target", "persistent-isolated", "--workspace", "w", "--replays", "1"]);
  assert.equal(creation[creation.indexOf("--llm-task") + 1], "create-flow");
  assert.equal(creation.includes("--flow"), false, "a created Flow's repair lane needs no recorded Flow lane");
});

test("a task whose instruction asks for an act is granted exactly the classes it names, and an operator's own permit replaces them", () => {
  // Nobody is watching a campaign, so a build that stops to ask a person waits
  // for an answer that never comes. Core already permits whatever it reads the
  // instruction as asking for; this is the corpus's second opinion for the
  // case where that reading and the model's declaration disagree.
  const buyKettle = { id: "buy-kettle", scenarioId: "everything-store", kind: "form", instruction: "Buy one kettle and pay with my Visa.", judgeBy: "playback-goal", permits: ["move_money", "create_new"] };
  const consequential = labRunArguments(buyKettle, parseCampaignArgs([]));
  assert.equal(consequential[consequential.indexOf("--llm-permit") + 1], "move_money,create_new");

  // A task that names none permits none: a task nobody has judged never
  // authorizes an act on its own.
  assert.equal(labRunArguments(CATALOG[0], parseCampaignArgs([])).includes("--llm-permit"), false);

  // The Lab refuses an option given twice, and somebody running one task by
  // hand is the person the question is for.
  const overridden = labRunArguments(buyKettle, parseCampaignArgs(["--", "--llm-permit", "send_or_publish"]));
  assert.equal(overridden.filter((arg) => arg === "--llm-permit").length, 1);
  assert.equal(overridden[overridden.indexOf("--llm-permit") + 1], "send_or_publish");
});
