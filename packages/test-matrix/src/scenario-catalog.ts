import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** One registered Scenario Lab scenario as the selector sees it: its id and its manifest's tags. */
export type ScenarioCatalogEntry = { id: string; tags: readonly string[] };
export type ScenarioCatalog = readonly ScenarioCatalogEntry[];

// This module compiles to packages/test-matrix/dist/, three levels below the repository root.
const packageRepositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * The catalog for the registry's manifests, in registry order. Only `id` and
 * `tags` are read; the registry validates each full manifest when it defines
 * the scenario.
 */
export function scenarioCatalogFromManifests(manifests: readonly unknown[]): ScenarioCatalog {
  const seen = new Set<string>();
  return manifests.map((manifest, index) => {
    const { id, tags } = (manifest ?? {}) as { id?: unknown; tags?: unknown };
    if (typeof id !== "string" || id.length === 0) throw new Error(`Scenario Lab manifest ${index} has no id`);
    if (seen.has(id)) throw new Error(`Scenario Lab registers "${id}" more than once`);
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) throw new Error(`Scenario Lab manifest "${id}" has no string tags`);
    seen.add(id);
    return { id, tags: [...tags] };
  });
}

/**
 * Reads the catalog from the built Scenario Lab registry
 * (`apps/scenario-lab/dist/registry.js`), the way the test runner loads
 * manifests. The registry is the one list of scenarios; nothing in this
 * package restates it.
 */
export async function loadScenarioCatalog(repositoryRoot: string = packageRepositoryRoot): Promise<ScenarioCatalog> {
  const registryPath = path.join(repositoryRoot, "apps", "scenario-lab", "dist", "registry.js");
  try {
    await access(registryPath);
  } catch (cause) {
    throw new Error(`Scenario Lab build is missing: ${registryPath}. Run "pnpm --filter @fluxiq-web-extension/scenario-lab... build".`, { cause });
  }
  const registry = await import(pathToFileURL(registryPath).href) as { listScenarioManifests?: () => unknown };
  if (typeof registry.listScenarioManifests !== "function") throw new Error(`Scenario Lab registry does not export listScenarioManifests(): ${registryPath}`);
  const manifests = registry.listScenarioManifests();
  if (!Array.isArray(manifests)) throw new Error("Scenario Lab listScenarioManifests() did not return an array");
  return scenarioCatalogFromManifests(manifests);
}
