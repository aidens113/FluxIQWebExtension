// Every adversarial condition the scenario corpus declares: the rows whose
// expectations name the recovery that must absorb them.
//
// A condition is not a list kept here. It is any workflow or variant of any
// scenario that declares `expected.recovery`, which is what makes the lane
// measure a condition somebody added without anybody editing this file. The
// declaration travels with the fixture, where the arming it describes is.

import path from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot, resolveLabInstancePaths } from "../lab-instance.mjs";
import { fixtureSecretEnvironment } from "../live-campaign/lab-run/index.mjs";

// The workspace package by its built path, not by its name: a script at the
// repository root is outside every workspace, so Node resolves no workspace
// name from here. `pnpm lab` builds this package before it runs anything.
const { resolveScenarioWorkflow } = await import(pathToFileURL(path.join(repositoryRoot, "packages", "test-contracts", "dist", "scenario-workflow.js")).href);

/**
 * One row to run: how the Lab is told to run it, and what it declared.
 *
 * `id` is the row key the corpus uses elsewhere -- `scenario/workflow/variant`
 * -- so a condition's name here is the same name it has in a campaign summary
 * and in the repair-task exclusions.
 */
export async function loadAdversarialConditions() {
  const paths = resolveLabInstancePaths(process.env);
  const registry = await import(pathToFileURL(path.join(paths.scenarioOutDir, "registry.js")).href);
  const manifests = typeof registry.listScenarioManifests === "function" ? registry.listScenarioManifests() : [];
  return manifests.flatMap((manifest) => rowsOf(manifest).flatMap((row) => {
    // The fixture's own replay secrets, from the step each declaration names.
    // A scenario that declares one refuses to run without it, and the value is
    // a loopback fixture literal written in the recording script, never
    // anything the machine set.
    const secrets = fixtureSecretEnvironment(manifest);
    const selection = { ...(row.workflowId === undefined ? {} : { workflowId: row.workflowId }), ...(row.variantId === undefined ? {} : { variantId: row.variantId }) };
    const { expected } = resolveScenarioWorkflow(manifest, selection);
    if (!expected.recovery) return [];
    return [{
      id: `${manifest.id}/${row.workflowId ?? "primary"}/${row.variantId ?? "-"}`,
      scenarioId: manifest.id,
      workflowId: row.workflowId ?? null,
      variantId: row.variantId ?? null,
      declared: expected.recovery,
      declaredProviderCalls: expected.providerCalls ?? null,
      declaredFailure: expected.failure ?? null,
      secrets,
    }];
  }));
}

/** Every workflow of a manifest, unarmed and with each of its variants. */
function rowsOf(manifest) {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : (manifest.workflows ?? []).find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)].map((variantId) => ({ workflowId, variantId }));
  });
}

/**
 * The Lab arguments one condition becomes.
 *
 * Deliberately provider-free: no `--live-llm`, so Core is issued no grant and
 * cannot consult the model at all. That is what makes the measurement a
 * measurement. A run with a grant that spends nothing shows that the model was
 * not needed *this time*; a run with no grant shows that whatever finished the
 * run was the deterministic runtime, because nothing else was available to it.
 * The `expected.providerCalls` declarations on these same rows are the guard
 * for the other case, when the campaign runs them live.
 */
export function conditionArguments(condition) {
  return [
    "run", condition.scenarioId,
    ...(condition.workflowId ? ["--workflow", condition.workflowId] : []),
    ...(condition.variantId ? ["--variant", condition.variantId] : []),
    "--flow",
  ];
}
