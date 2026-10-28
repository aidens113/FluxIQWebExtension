import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../../failure.js";

/** Where `apps/scenario-lab/src/scenarios/realistic-site-demonstrations.ts` compiles to, under a scenario lab build. */
const CATALOG_MODULE = ["scenarios", "realistic-site-demonstrations.js"] as const;

/**
 * The scripted demonstrations from the scenario lab build a run uses, loaded the way the live
 * instruction catalog is, so the demonstrations and the fixtures they drive come from the same
 * bytes. A build without the module is `environment.missing`; a module exporting something else is
 * `fixture.invalid`.
 */
export async function loadScenarioDemonstrations(scenarioLabDist: string): Promise<ScenarioDemonstration[]> {
  const modulePath = path.join(scenarioLabDist, ...CATALOG_MODULE);
  try { await access(modulePath); }
  catch (cause) { throw new RunnerFailure("environment.missing", `The demonstration catalog is not built: ${modulePath}`, { cause }); }
  const loaded = await import(pathToFileURL(modulePath).href) as { REALISTIC_SITE_DEMONSTRATIONS?: unknown };
  const list = loaded.REALISTIC_SITE_DEMONSTRATIONS;
  if (!Array.isArray(list)) throw new RunnerFailure("fixture.invalid", "The demonstration catalog does not export REALISTIC_SITE_DEMONSTRATIONS as a list");
  return list as ScenarioDemonstration[];
}
