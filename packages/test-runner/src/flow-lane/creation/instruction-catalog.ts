// Loads the live instruction catalog from the scenario lab build a run uses,
// the same way the scenario registry is loaded (`scenarios.ts`), so an
// instance's catalog and its fixtures always come from the same bytes.

import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RunnerFailure } from "../../failure.js";
import { parseLiveInstructionTasks, type LiveInstructionTask } from "./instruction-task.js";

/** Where `apps/scenario-lab/src/scenarios/live-instructions.ts` compiles to, under a scenario lab build. */
const CATALOG_MODULE = ["scenarios", "live-instructions.js"] as const;

/**
 * The catalog's `LIVE_INSTRUCTION_TASKS`, checked. A build without the module
 * is `environment.missing`, because the fix is to build; a module that exports
 * something else is `fixture.invalid`, because the fix is to the catalog.
 */
export async function loadLiveInstructionTasks(scenarioLabDist: string): Promise<LiveInstructionTask[]> {
  const modulePath = path.join(scenarioLabDist, ...CATALOG_MODULE);
  try { await access(modulePath); }
  catch (cause) { throw new RunnerFailure("environment.missing", `The live instruction catalog is not built: ${modulePath}`, { cause }); }
  const catalog = await import(pathToFileURL(modulePath).href) as { LIVE_INSTRUCTION_TASKS?: unknown };
  if (!("LIVE_INSTRUCTION_TASKS" in catalog)) throw new RunnerFailure("fixture.invalid", "The live instruction catalog does not export LIVE_INSTRUCTION_TASKS");
  return parseLiveInstructionTasks(catalog.LIVE_INSTRUCTION_TASKS);
}
