import path from "node:path";
import { pathToFileURL } from "node:url";
import { withBuildLock } from "../build-lock.mjs";
import { repositoryRoot, resolveLabInstancePaths } from "../lab-instance.mjs";
import { distinct } from "./distinct.mjs";
import { labEnvironment, ramFaultSignature, runNode } from "./lab-run/index.mjs";

/**
 * Compiles the scenario lab into this instance's output, under the Lab's build
 * lock, and imports both task lists from the scenarios barrel: creation tasks
 * first, then repair tasks, with ids unique across the two.
 * `FLUXIQ_LAB_CAMPAIGN_CATALOG` names a module to import instead, unbuilt.
 */
export async function loadCatalog(options) {
  const override = process.env.FLUXIQ_LAB_CAMPAIGN_CATALOG?.trim();
  const paths = resolveLabInstancePaths(process.env);
  const modulePath = override || path.join(paths.scenarioOutDir, "scenarios", "index.js");
  if (!override && options.build) {
    const env = { ...labEnvironment(process.env), FLUXIQ_LAB_SCENARIO_OUT_DIR: paths.scenarioOutDir };
    const builder = path.join(repositoryRoot, "apps", "scenario-lab", "scripts", "build-scenario-lab.mjs");
    await withBuildLock(paths.buildLockPath, async () => {
      for (let attempt = 1; ; attempt += 1) {
        const outcome = await runNode(builder, env);
        if (outcome.code === 0) return;
        const fault = ramFaultSignature(outcome);
        if (fault === null || attempt >= options.maxAttempts) throw new Error(`The scenario lab build exited with ${outcome.code ?? outcome.signal}`);
        process.stderr.write(`[campaign] the scenario lab build died with this machine's RAM-fault signature (${fault}); retrying\n`);
      }
    }, { onWait: (owner) => process.stderr.write(`[campaign] waiting for the build lock held by process ${owner?.pid ?? "unknown"}\n`) });
  }
  const { LIVE_INSTRUCTION_TASKS: creations, LIVE_REPAIR_TASKS: repairs } = await import(pathToFileURL(modulePath).href);
  if (!Array.isArray(creations)) throw new Error(`${modulePath} exports no LIVE_INSTRUCTION_TASKS`);
  if (!Array.isArray(repairs)) throw new Error(`${modulePath} exports no LIVE_REPAIR_TASKS`);
  const misfiled = [...creations.filter((task) => task.kind === "repair"), ...repairs.filter((task) => task.kind !== "repair")].map((task) => task.id);
  if (misfiled.length > 0) throw new Error(`Tasks in the wrong list for their kind: ${misfiled.join(", ")}`);
  const catalog = [...creations, ...repairs];
  const ids = catalog.map((task) => task.id);
  const repeated = distinct(ids.filter((id, index) => ids.indexOf(id) !== index));
  if (repeated.length > 0) throw new Error(`Task ids used twice across the catalog: ${repeated.join(", ")}`);
  return catalog;
}
