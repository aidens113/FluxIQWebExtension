import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRealisticScenarioIds } from "./realistic-scenario-ids.js";

/** One registered Scenario Lab scenario as the selector sees it: its id and its manifest's tags. */
export type ScenarioCatalogEntry = { id: string; tags: readonly string[] };
export type ScenarioCatalog = readonly ScenarioCatalogEntry[];

// This module compiles to packages/test-matrix/dist/, three levels below the repository root.
const packageRepositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * The catalog for the registry's manifests, in registry order, keeping only
 * the scenarios `admitted` names when it is given. Only `id` and `tags` are
 * read; the registry validates each full manifest when it defines the
 * scenario. Every admitted id must be registered.
 */
export function scenarioCatalogFromManifests(manifests: readonly unknown[], admitted?: readonly string[]): ScenarioCatalog {
  const seen = new Set<string>();
  const catalog = manifests.map((manifest, index) => {
    const { id, tags } = (manifest ?? {}) as { id?: unknown; tags?: unknown };
    if (typeof id !== "string" || id.length === 0) throw new Error(`Scenario Lab manifest ${index} has no id`);
    if (seen.has(id)) throw new Error(`Scenario Lab registers "${id}" more than once`);
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) throw new Error(`Scenario Lab manifest "${id}" has no string tags`);
    seen.add(id);
    return { id, tags: [...tags] };
  });
  if (admitted === undefined) return catalog;
  const unregistered = admitted.filter((id) => !seen.has(id));
  if (unregistered.length > 0) throw new Error(`Scenario Lab does not register the realistic scenario(s) ${unregistered.join(", ")}`);
  return catalog.filter(({ id }) => admitted.includes(id));
}

/**
 * The scenarios a CI browser job may run: the ten realistic scenarios
 * (`realistic-scenario-ids.ts`), in registry order, read from the built
 * Scenario Lab registry (`apps/scenario-lab/dist/registry.js`) the way the
 * test runner loads manifests. Every job this package selects for opens a
 * browser, and every Lab or browser test run uses only the ten realistic
 * scenarios (user rule, 2026-09-29); the Lab refuses any other at launch. The
 * other registered scenarios are covered by unit tests in the static gate.
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
  return scenarioCatalogFromManifests(manifests, await loadRealisticScenarioIds(repositoryRoot));
}
